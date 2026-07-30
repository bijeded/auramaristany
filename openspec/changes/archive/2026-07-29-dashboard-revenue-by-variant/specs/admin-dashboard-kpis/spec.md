## ADDED Requirements

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

Every bar fill on the dashboard's variant cards SHALL be a token defined in `app/globals.css` — never a hand-written hex — and SHALL reach at least 3:1 contrast against the `--gris-claro` track it sits on, per WCAG 1.4.11.

Contrast SHALL be measured against the **track**, not against the white card: the track is the adjacent color for the filled portion of the bar, and measuring against white is what let the previous fill pass inspection while failing in place.

The two cards SHALL use different fills, so that stacked or adjacent bar lists do not read as one continuous list.

#### Scenario: Clients bars
- **WHEN** the clients card renders
- **THEN** its bars are filled with `--lavanda-dark`, which clears 3:1 against `--gris-claro`

#### Scenario: Income bars
- **WHEN** the income card renders
- **THEN** its bars are filled with `--rosa-bar`, a token added by this change that clears 3:1 against `--gris-claro`

#### Scenario: No raw hex remains
- **WHEN** the dashboard's bar components are inspected
- **THEN** no bar fill is expressed as a literal hex value

## REMOVED Requirements

### Requirement: Revenue by program is a bar chart

**Reason**: The dashboard now reports revenue at the variant grain, matching "Clientes por variante", so the two cards can be read against each other. Program-grain revenue is not shown anywhere else and is not being relocated.

**Migration**: `groupRevenueByProgram` and the `ProgramRevenue` type are deleted (zero callers after the swap), along with `components/admin/ProgramRevenueDonut.tsx`. Callers move to `groupRevenueByVariant` fed by `getRevenueByVariantAllTime()`. Note that the totals are not comparable across the change: the old card summed 12 months at program grain, the new one sums all time at variant grain.

## MODIFIED Requirements

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
