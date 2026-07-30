## ADDED Requirements

### Requirement: Churn is a historical question with its own derivation

The system SHALL provide a pure helper (`isChurned`) that answers whether a subscription **ended in churn**, and every churn figure SHALL obtain its numerator from that helper rather than from a `status` comparison.

This is deliberately a second derivation alongside `deriveCancellationState` and not a widening of it. `deriveCancellationState` answers what a **live** subscription can do right now — it returns `completed`, `completing`, `grace`, `eligible`, or `none` — and a terminal `canceled` row falls through to `none`. It therefore cannot produce a churn numerator, and reusing it for one would silently return zero. The two helpers live side by side and each states which question it answers, so the framework rule that a lifecycle state gets exactly one derivation is honored per question, not per column.

A subscription that reached `completed` SHALL NOT be churn under any circumstance. Completing a fixed term is a graduation — the moment Aura offers the next program — and counting it as churn would turn her best outcome into her worst metric. `completed` outranks `cancel_at_period_end`, which a graduating subscription also carries (ADR 0003).

#### Scenario: A cancelled subscription is churn
- **WHEN** a subscription's status is `canceled`
- **THEN** `isChurned` returns true

#### Scenario: A graduated subscription is never churn
- **WHEN** a subscription's status is `completed`
- **THEN** `isChurned` returns false, regardless of `cancel_at_period_end` or `completed_at`

#### Scenario: A live subscription winding down is not yet churn
- **WHEN** a subscription is `active` with `cancel_at_period_end = true` and `completed_at` null
- **THEN** `isChurned` returns false, because it has not ended — it is already counted by "Cancelaciones (próx. 7 días)"

#### Scenario: An unpaid subscription is not churn
- **WHEN** a subscription's status is `unpaid`
- **THEN** `isChurned` returns false

#### Scenario: An abandoned checkout is not churn
- **WHEN** a subscription's status is `incomplete` or `incomplete_expired`
- **THEN** `isChurned` returns false

### Requirement: The churn denominator is everyone who ever became a client

The all-time churn rate SHALL be computed over a denominator of subscriptions whose status is one of `active`, `trialing`, `past_due`, `unpaid`, `paused`, `completed` or `canceled`. Statuses `incomplete` and `incomplete_expired` SHALL be excluded.

The exclusion is the load-bearing part. An `incomplete_expired` row is an abandoned Stripe checkout: nobody was ever a client, no content was ever served, and there is nothing to leave. Counting those rows would inflate every denominator with people who never arrived and drive every rate toward zero, making the chart read as "nobody churns" exactly when churn is worst.

`unpaid` SHALL count in the denominator and SHALL NOT count in the numerator. The client list already files `past_due` and `unpaid` together under the "Vencidas" filter and labels `unpaid` "Impaga" in amber — Aura's existing reading is *a client in trouble*, not *a client gone*. Treating it as churn would contradict a filter she already uses and would double-count the subscriptions that later cancel for real and produce a `pago_fallido` survey row.

`completed` SHALL count in the denominator while being excluded from the numerator. A graduate did become a client, so she belongs to "everyone who ever subscribed"; she simply did not leave.

The denominator SHALL be derived from the status set as a `Record<string, …>`-style membership test with a defined default for unknown values, never from a hardcoded union narrower than the database `CHECK`. A status added to the `CHECK` in a future migration and not added here SHALL be treated as outside the denominator rather than crashing or silently blanking the chart.

#### Scenario: Graduate counts as ever-subscribed
- **WHEN** a variant has one `completed` subscription and one `canceled` subscription
- **THEN** its denominator is 2, its numerator is 1, and its rate is 50%

#### Scenario: Abandoned checkout does not dilute the rate
- **WHEN** a variant has one `canceled` subscription, one `active` subscription and eight `incomplete_expired` rows
- **THEN** its denominator is 2 and its rate is 50%, not 10%

#### Scenario: Unpaid sits on the denominator side only
- **WHEN** a variant has one `unpaid` subscription and one `active` subscription
- **THEN** both count toward its denominator and neither toward its numerator, so the variant has no churn and is absent from the card entirely (a zero row is never rendered)

#### Scenario: An unrecognized status does not break the chart
- **WHEN** a subscription row carries a status not named in the denominator set
- **THEN** the row is excluded from both numerator and denominator and the chart still renders every other row

### Requirement: "Cancelaciones por variante" reports a count and an all-time churn rate

The admin dashboard SHALL render a card titled "Cancelaciones por variante" showing one row per program variant that has at least one churned subscription. Each row SHALL display the raw count of churned subscriptions and, in parentheses, that variant's churn rate as a whole-number percentage — for example `3 (25%)`.

The bar length SHALL be scaled by the raw **count**, not by the rate, so the card ranks by volume while the percentage supplies the context that volume alone hides: three departures out of forty clients and three out of four rank identically by count and are entirely different problems.

The card SHALL read `subscriptions` rather than `cancellation_surveys`. The variant is a direct column on `subscriptions`, so the population is complete — every churned subscription is counted whether or not the client filled in a survey. Deriving this card from surveys would undercount by however many people skipped the form, and would lose the variant entirely for any client since deleted, because `cancellation_surveys.subscription_id` is `on delete set null`.

The variant embed SHALL be disambiguated as `program_variants!program_variant_id`. Two foreign keys to one target make PostgREST return an error instead of rows, which a reader checking only `!data` degrades past silently.

Rows SHALL be ordered by count descending. A variant with no churned subscription SHALL be absent rather than rendered as a zero row.

#### Scenario: Row shows count and rate
- **WHEN** a variant has 3 churned subscriptions out of 12 that ever subscribed
- **THEN** its row reads `3 (25%)`

#### Scenario: Bars rank by volume, not by rate
- **WHEN** variant A has 3 churned of 40 and variant B has 2 churned of 4
- **THEN** A's bar is longer than B's, while B's row shows the higher percentage

#### Scenario: A churned client who never filled the survey still counts
- **WHEN** a subscription is churned and has no row in `cancellation_surveys`
- **THEN** it is counted in its variant's numerator

#### Scenario: Graduation does not appear as churn
- **WHEN** every subscription for a variant reached `completed`
- **THEN** the variant is absent from the card, because its numerator is zero

#### Scenario: Nobody has churned yet
- **WHEN** no subscription is churned
- **THEN** the card shows an empty-state message in Spanish rather than an empty bar list

### Requirement: "Razones de cancelación" reports a count and a share of the total

The admin dashboard SHALL render a card titled "Razones de cancelación" showing one row per reason present in `cancellation_surveys`, with the raw count and, in parentheses, that reason's share of all survey rows as a whole-number percentage — for example `5 (42%)`. The shares SHALL be a partition of the whole: every survey row counts toward exactly one reason.

`pago_fallido` SHALL be included. It is written by the Stripe webhook under service-role when dunning is exhausted, so it represents involuntary churn — and it is the one reason Aura can act on operationally, by chasing a card update rather than a change of mind. Excluding it would leave the card describing a population no label on screen names.

Reason labels SHALL come from `cancellationReasonLabel`, not from a second table of strings written for this card. Two maps of the same enum are one copied table and drift apart on the next reason added.

Rows SHALL be ordered by count descending. A reason with no survey rows SHALL be absent rather than rendered as a zero row.

The card SHALL NOT display the free-text `detail` column. That column may hold HTML-shaped text and belongs only in escaping sinks; an aggregate chart has no place to put it, and surfacing individual answers on a dashboard would expose one client's words as though they were a statistic.

#### Scenario: Row shows count and share
- **WHEN** 5 of 12 survey rows carry reason `no_tengo_tiempo`
- **THEN** its row reads `5 (42%)`

#### Scenario: Involuntary churn is visible
- **WHEN** 3 survey rows carry reason `pago_fallido`
- **THEN** a row labelled "Pago fallido" appears with those 3 counted

#### Scenario: Shares partition the total
- **WHEN** the card renders any number of rows
- **THEN** the counts sum to the total number of survey rows

#### Scenario: Unused reasons are omitted
- **WHEN** no client has selected `no_veo_resultados`
- **THEN** no row appears for it

#### Scenario: No survey has been filled
- **WHEN** `cancellation_surveys` is empty
- **THEN** the card shows an empty-state message in Spanish rather than an empty bar list

#### Scenario: Free-text detail stays off the dashboard
- **WHEN** a survey row carries a `detail`
- **THEN** that text appears nowhere on the card

### Requirement: The two cards' totals may disagree, and each card says what it measures

Each of the two cards SHALL carry a subtitle naming the population its percentage is taken over, plus the window. The variant card's percentage is a **rate** over everyone who ever subscribed to that variant; the reasons card's percentage is a **share** of all cancellations. Both are all-time.

Without the two subtitles the cards are a readability trap: side by side, both show `N (%)`, and a reader has no way to know that one percentage can exceed the other's scale or that the two sets of percentages sum to different things — the reasons column sums to 100% and the variant column does not.

The two cards' totals SHALL NOT be forced into agreement, and the reasons total will routinely exceed the variant total. The dominant cause is a **timing lag**: a survey row is written when a client decides to leave, while the churn count includes her only once she has left. A client in her grace window (cancelled but still `active`) and a client in `unpaid` (survey written, subscription not yet deleted in Stripe) both appear on the reasons card and on neither side of the variant card's numerator. A survey outliving a deleted subscription (`subscription_id` is `on delete set null`) is a real but far rarer third cause.

This is the same deliberate divergence already documented for "Clientes por variante" versus "Ingresos por variante" (ADR 0004), not a reconciliation defect. Widening the churn numerator to close the gap SHALL be rejected: it would make the rate mean "clients who might leave", double-count anyone who reactivates during her grace window, and contradict the requirement that each figure declare its population.

Both cards SHALL state "Histórico completo", matching the existing income card, so neither is misread against the dashboard's rolling 7-day KPI cards.

#### Scenario: Variant card names its denominator
- **WHEN** the variant card renders
- **THEN** its subtitle states that the percentage is of everyone who subscribed to that variant, and that the window is the full history

#### Scenario: Reasons card names its denominator
- **WHEN** the reasons card renders
- **THEN** its subtitle states that the percentage is of the total cancellations, and that the window is the full history

#### Scenario: Totals diverge while a cancellation is still in its grace window
- **WHEN** a client has cancelled but her subscription is still `active` until the period ends
- **THEN** her reason is counted on the reasons card while she is absent from the variant card's numerator, because she has not left yet

#### Scenario: Totals diverge for a client whose payments failed
- **WHEN** a client is `unpaid` and the webhook has written her `pago_fallido` survey
- **THEN** her reason is counted on the reasons card while she counts only toward the variant card's denominator

#### Scenario: Totals diverge after a client is deleted
- **WHEN** a churned client's subscription row is deleted while her survey row remains
- **THEN** the reasons card counts her and the variant card does not, and neither figure is adjusted to match the other

### Requirement: The churn charts are admin-only and read through the RLS boundary

Both queries SHALL run behind `requireAdminPage()` on the dashboard route and SHALL use the RLS-aware Supabase client, never the service-role key. Migration 011 already grants admins `select` on `cancellation_surveys` through `is_admin()`, and `subscriptions` is likewise readable by admins under RLS, so no elevated client is needed.

Raw Postgres errors SHALL be routed through `logAndGeneric` rather than surfaced, and a failed query SHALL render the card's empty state rather than breaking the dashboard.

#### Scenario: Non-admin cannot reach the charts
- **WHEN** a client-role session requests `/admin/dashboard`
- **THEN** `requireAdminPage()` redirects before either query runs

#### Scenario: No service-role client is introduced
- **WHEN** the two new queries are inspected
- **THEN** neither constructs a service-role client

#### Scenario: A query failure degrades to the empty state
- **WHEN** one of the two queries returns an error
- **THEN** the error is logged server-side, a generic message is used, and the rest of the dashboard still renders
