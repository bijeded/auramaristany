# admin-dashboard-kpis

## Purpose

The admin dashboard's KPI row and its charts (`/admin/dashboard`) — which subscriptions each
figure counts, and why the money figures and the people figures deliberately disagree. A
subscription that is winding down still serves content, so it belongs in a headcount and not in
recurring revenue; every figure here has to declare which of the two it is. See
`docs/adr/0004-ending-subscriptions-money-versus-access.md`.

## Requirements

### Requirement: Revenue by variant is an all-time figure

The admin dashboard SHALL render "Ingresos por variante" from **every** paid invoice, with no date cutoff, so each row is that variant's lifetime earnings. This figure SHALL NOT be derived from `getPaidInvoices(monthsBack)`, whose 12-month window belongs to "Ingresos por mes" and must not change meaning to serve this card.

Only invoices with `status = 'paid'` SHALL contribute. The card title SHALL carry the grand total of all rows, formatted with `formatMXN`.

This is a money figure, so it counts what was actually collected (ADR 0004): whether the subscription that produced an invoice is still active, ending, or long since cancelled is irrelevant — the money was charged.

#### Scenario: Revenue predates the twelve-month window
- **WHEN** a variant's only paid invoice is 18 months old
- **THEN** that variant appears on the card with that invoice's amount, even though it contributes nothing to "Ingresos por mes"

#### Scenario: Unpaid invoices are excluded
- **WHEN** a variant has invoices in `open`, `void`, or `uncollectible` status
- **THEN** none of them contribute to its total

#### Scenario: Revenue from a cancelled subscription is retained
- **WHEN** a client whose subscription is now `canceled` paid three invoices while active
- **THEN** those three amounts still count toward her variant's total

#### Scenario: Title shows the grand total
- **WHEN** the card renders any number of rows
- **THEN** the title displays the sum of every row's total in MXN

### Requirement: The two variant cards share row order but not membership

"Clientes por variante" and "Ingresos por variante" SHALL each list only variants with a non-zero value of their own measure. The lists MAY therefore differ in length and in membership: a variant with active clients but no paid invoice yet appears only on the left card, and a variant whose clients have all churned but which earned money appears only on the right.

For variants present on both cards, the income card SHALL follow the clients card's order. Variants present only on the income card SHALL be appended after those, ordered by total descending. This makes the two cards read against each other at the top, where the overlap is, rather than presenting two independently sorted lists that happen to share labels.

The two cards SHALL render at equal height when displayed side by side, with row content top-aligned in each.

#### Scenario: Shared variants keep the clients card's order
- **WHEN** variants A and B both have clients and revenue, and the clients card orders them A then B
- **THEN** the income card also orders them A then B, regardless of their revenue totals

#### Scenario: Variant with clients but no revenue
- **WHEN** a variant has active subscriptions but no paid invoice
- **THEN** it appears on the clients card and is absent from the income card

#### Scenario: Variant with revenue but no active clients
- **WHEN** every subscription for a variant has ended, but it has paid invoices
- **THEN** it is absent from the clients card and appended to the end of the income card, ordered against other such variants by total descending

#### Scenario: Uneven lists render at equal height
- **WHEN** the two cards contain different numbers of rows
- **THEN** both cards render at the same height, each with its rows top-aligned

#### Scenario: Neither card has rows
- **WHEN** there are no active subscriptions and no paid invoices
- **THEN** each card shows its own empty-state message rather than an empty bar list

### Requirement: Bar fills meet the graphical-object contrast floor

Every bar fill on the dashboard's bar-list cards SHALL be a token defined in `app/globals.css` — never a hand-written hex — and SHALL reach at least 3:1 contrast against the `--gris-claro` track it sits on, per WCAG 1.4.11.

Contrast SHALL be measured against the **track**, not against the white card: the track is the adjacent color for the filled portion of the bar, and measuring against white is what let the previous fill pass inspection while failing in place. See `docs/adr/0005-bar-fill-contrast-measured-against-the-track.md`.

Cards displayed adjacently SHALL use different fills, so that stacked or side-by-side bar lists do not read as one continuous list. The dashboard now has four such cards in two pairs — the variant pair ("Clientes por variante", "Ingresos por variante") and the churn pair ("Cancelaciones por variante", "Razones de cancelación") — and the requirement applies to each new fill on the same terms as the original two.

The churn pair SHALL be filled in a hue that reads as attrition rather than achievement. Green is reserved: the dashboard already spends `--exito-text` on graduation, and a churn bar in the same family would contradict the very distinction `isChurned` exists to preserve.

#### Scenario: Clients bars
- **WHEN** the clients card renders
- **THEN** its bars are filled with `--lavanda-dark`, which clears 3:1 against `--gris-claro`

#### Scenario: Income bars
- **WHEN** the income card renders
- **THEN** its bars are filled with `--rosa-bar`, which clears 3:1 against `--gris-claro`

#### Scenario: Churn bars clear the floor
- **WHEN** either card of the churn pair renders
- **THEN** its bars are filled with a token that clears 3:1 measured against `--gris-claro`, verified before merge

#### Scenario: Adjacent cards are distinguishable
- **WHEN** the two churn cards render side by side
- **THEN** their fills differ from each other, and neither is filled in the green family reserved for graduation

#### Scenario: No raw hex remains
- **WHEN** the dashboard's bar components are inspected
- **THEN** no bar fill is expressed as a literal hex value

### Requirement: Active subscriptions are partitioned by billing outcome

The finance layer SHALL classify every `active` subscription into exactly one of three outcomes — `billing` (will be charged again), `completing` (final month of a fixed term), or `cancelling` (voluntary cancellation winding down) — by calling the existing `deriveCancellationState` derivation rather than inspecting `cancel_at_period_end` or `completed_at` directly. The partition SHALL be a single pure pass, so that no subscription can be counted in two outcomes or dropped from all three.

`getActiveSubscriptions` SHALL carry `status`, `cancel_at_period_end` and `completed_at` on each row so the derivation receives real column values rather than a hardcoded assumption about the query's filter.

#### Scenario: Ordinary renewing subscription
- **WHEN** a subscription is `active` with `cancel_at_period_end = false`
- **THEN** it is classified as `billing`

#### Scenario: Final month of a fixed-term program
- **WHEN** a subscription is `active` with both `completed_at` set and `cancel_at_period_end = true`
- **THEN** it is classified as `completing`, not `cancelling`

#### Scenario: Voluntary cancellation in its grace window
- **WHEN** a subscription is `active` with `cancel_at_period_end = true` and `completed_at` null
- **THEN** it is classified as `cancelling`

#### Scenario: A stale completed_at alone does not schedule an ending
- **WHEN** a subscription is `active` with `completed_at` set but `cancel_at_period_end = false`
- **THEN** it is classified as `billing`, because `completed_at` alone does not prove a cancellation exists in Stripe

#### Scenario: Every row lands in exactly one bucket
- **WHEN** the partition runs over any set of `active` subscriptions
- **THEN** the three bucket sizes sum to the number of input rows

### Requirement: Recurring revenue excludes subscriptions that will not renew

"Ingreso mensual recurrente" SHALL be computed from the `billing` bucket only. A subscription that is ending — whether completing a fixed term or winding down a voluntary cancellation — SHALL NOT contribute to the MRR figure, because it will produce no further charge.

`computeMRR` SHALL keep summing whatever rows it is given; the exclusion happens by feeding it the `billing` bucket, not by teaching it about subscription lifecycle.

#### Scenario: Ending subscription is excluded from MRR
- **WHEN** one of two otherwise identical `active` subscriptions has `cancel_at_period_end = true`
- **THEN** the MRR figure reflects only the other one

#### Scenario: Renewing subscriptions are unaffected
- **WHEN** no active subscription is ending
- **THEN** the MRR figure is identical to the previous behaviour

### Requirement: Client headcount includes ending subscriptions

"Suscripciones activas" and "Clientes por variante" SHALL continue to count every `active` subscription, including those classified `completing` or `cancelling`. A client in her final month or grace window still has portal access and is still training, so excluding her would understate how many people Aura is currently serving.

The adjacent "Ingresos por variante" card SHALL NOT be brought into agreement with this headcount. It is a money figure and counts collected invoices; the headcount is a people figure and counts current access (ADR 0004). The two cards therefore share an axis and a row order while deliberately covering different populations, and a variant may legitimately appear on one and not the other.

#### Scenario: Ending client still counted as active
- **WHEN** a client's subscription is `active` with `cancel_at_period_end = true`
- **THEN** she is included in "Suscripciones activas" and in her variant's bar

#### Scenario: Headcount and MRR deliberately disagree
- **WHEN** at least one active subscription is ending
- **THEN** the headcount includes it while the MRR figure does not, and this divergence is intended

#### Scenario: Headcount and variant revenue deliberately disagree
- **WHEN** a variant's clients have all ended their subscriptions
- **THEN** its bar disappears from "Clientes por variante" while its lifetime total remains on "Ingresos por variante", and this divergence is intended

### Requirement: Forward-looking KPI cards separate the three cohorts

The dashboard SHALL show three cards over the same rolling 7-day horizon, each drawn from one bucket and each stating its horizon in its own label:

- **"Renuevan (próx. 7 días)"** — count and MXN amount, from `billing`
- **"Terminan (próx. 7 días)"** — count only, from `completing`
- **"Cancelaciones (próx. 7 días)"** — count only, from `cancelling`

A subscription SHALL be counted when its `current_period_end` falls between now and 7 days from now, inclusive. The two ending cards SHALL NOT display an MXN amount. The completion and cancellation cards SHALL NOT be styled so as to read as the same event — completing a fixed term is a graduation into the next program, not churn.

The three cards are a view of the coming week, not a monthly projection: "Ingreso mensual recurrente" is the month's figure, and these cards answer what happens in the next seven days.

Each ending card SHALL link to the client-list filter for its own cohort, so the count resolves to names.

#### Scenario: Renewing subscription inside the horizon
- **WHEN** a `billing` subscription's `current_period_end` is 5 days from now
- **THEN** it is counted in "Renuevan (próx. 7 días)" and its `price_mxn` is added to that card's amount

#### Scenario: Ending subscription is not counted as a renewal
- **WHEN** a `completing` subscription's `current_period_end` is 5 days from now
- **THEN** it is counted in "Terminan (próx. 7 días)" and absent from "Renuevan (próx. 7 días)"

#### Scenario: Cohorts are not conflated
- **WHEN** one `completing` and one `cancelling` subscription both end within 7 days
- **THEN** each is counted in its own card and neither appears in the other

#### Scenario: Renewal beyond the week is not counted
- **WHEN** a `billing` subscription's `current_period_end` is 20 days from now
- **THEN** it is counted in none of the three cards, while still contributing to "Ingreso mensual recurrente"

#### Scenario: Boundary and null handling
- **WHEN** a subscription's `current_period_end` is in the past, beyond 7 days, or null
- **THEN** it is counted in none of the three cards

#### Scenario: Horizon is visible in the label
- **WHEN** the admin reads any of the three cards
- **THEN** the label states "próx. 7 días", so the figure cannot be misread as a monthly total

#### Scenario: Ending card links to its cohort
- **WHEN** the admin clicks through from "Terminan (próx. 7 días)" or "Cancelaciones (próx. 7 días)"
- **THEN** the client list opens filtered to that cohort

#### Scenario: Responsive layout with 6 cards
- **WHEN** the dashboard renders at mobile, tablet, and desktop widths
- **THEN** the KPI row wraps cleanly with no overflow or broken layout

### Requirement: Finance queries read only fully active subscriptions

`getActiveSubscriptions` SHALL select `status = 'active'` only, deliberately excluding `trialing` and `past_due`. This makes every finance figure conservative by decision rather than by accident: a trialing client who has not yet paid and a past-due client whose charge has already failed are both absent from MRR and from the renewal projection.

#### Scenario: Past-due subscription absent from revenue figures
- **WHEN** a subscription is `past_due`
- **THEN** it contributes to neither MRR nor any of the three horizon cards, and is surfaced only by "Requieren atención"

#### Scenario: Trialing subscription absent from revenue figures
- **WHEN** a subscription is `trialing`
- **THEN** it contributes to neither MRR nor any of the three horizon cards
