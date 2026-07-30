## ADDED Requirements

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

#### Scenario: Ending client still counted as active
- **WHEN** a client's subscription is `active` with `cancel_at_period_end = true`
- **THEN** she is included in "Suscripciones activas" and in her variant's bar

#### Scenario: Headcount and MRR deliberately disagree
- **WHEN** at least one active subscription is ending
- **THEN** the headcount includes it while the MRR figure does not, and this divergence is intended

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

## REMOVED Requirements

### Requirement: KPI card for subscriptions expiring in 7 days

**Reason**: The 7-day card counted every subscription whose period ended in the window, mixing renewals with terminations under a revenue label, and its "Renuevan este mes" sibling described a rolling 30-day window as a calendar month. Both are replaced by three cohort-specific cards over a single 7-day horizon, each naming it: "Renuevan (próx. 7 días)", "Terminan (próx. 7 días)" and "Cancelaciones (próx. 7 días)".

**Migration**: None for data. `computeRenewalsThisMonth` is deleted along with the card — `computeRenewalsWithinDays(rows, 7, now)` is called directly, once per bucket. The 30-day lookahead is gone: a subscription renewing in three weeks now appears in no card, though it still contributes to "Ingreso mensual recurrente". The horizon cards become a view of the coming week and the monthly figure stays with MRR, so the two no longer answer overlapping questions.
