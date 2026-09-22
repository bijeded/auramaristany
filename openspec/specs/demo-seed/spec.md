# demo-seed Specification

## Purpose

The demo seed produces the data Aura's demo and every manual smoke check run against. This capability states which seeded clients are backed by real Stripe test-mode subscriptions, so Stripe-touching flows (cancel, reactivate) can be exercised on seeded data.

## Requirements


### Requirement: Named seeded clients are backed by real Stripe test-mode subscriptions

The seed SHALL create, for a fixed and documented set of clients, a Stripe test-mode customer and subscription on the client's variant price, and SHALL store those real ids in the client's profile and subscription row. At least two clients in the set SHALL be cancellable (active, no cancellation pending) and at least one SHALL be in the grace window (active, cancellation scheduled at period end). All other seeded clients keep synthetic ids.

#### Scenario: Cancelling a Stripe-backed active client succeeds
- **WHEN** a freshly seeded, Stripe-backed cancellable client cancels from portal settings with a reason
- **THEN** Stripe reports the subscription with `cancel_at_period_end = true`, the client sees the grace state, and a `cancellation_surveys` row with that reason exists

#### Scenario: Reactivating the Stripe-backed grace client succeeds
- **WHEN** the Stripe-backed grace client reactivates from portal settings
- **THEN** Stripe reports `cancel_at_period_end = false` and the client no longer sees the grace state

#### Scenario: Synthetic clients are unchanged
- **WHEN** the seed finishes
- **THEN** every client outside the Stripe-backed set has the same scenario, status and synthetic ids it had before this change

### Requirement: Stripe-backed rows match their Stripe subscription

For each Stripe-backed client, the row's `status`, `cancel_at_period_end`, `current_period_start` and `current_period_end` SHALL equal what Stripe reports, and the period SHALL be the one the seed computes for the client's scenario, with today strictly after `current_period_start`.

#### Scenario: A later webhook does not move the period
- **WHEN** Stripe delivers `customer.subscription.updated` for a Stripe-backed client (for example after a cancel)
- **THEN** the row's current period is the same as right after seeding

#### Scenario: Seeding charges nothing
- **WHEN** the seed creates a Stripe-backed subscription
- **THEN** Stripe holds no invoice for that customer, and the client's invoice rows are the same synthetic history the seed writes for its scenario

### Requirement: Reseeding does not accumulate Stripe objects

On every run that creates Stripe objects, the seed SHALL first remove the Stripe test-mode customers a previous seed run created, identified by seed metadata, and SHALL never touch Stripe objects without that metadata.

#### Scenario: Second run
- **WHEN** the seed runs twice in a row
- **THEN** Stripe holds exactly one set of seed-tagged customers, the ones the current DB references

#### Scenario: Checkout-created customers are left alone
- **WHEN** a client registered through real test-mode checkout exists and the seed runs
- **THEN** that customer and its subscription still exist in Stripe

### Requirement: The seed only creates Stripe objects in test mode

The seed SHALL abort before any Stripe or database write when `STRIPE_SECRET_KEY` is not a test-mode key. `--dry-run` SHALL make no Stripe call.

#### Scenario: Live key
- **WHEN** the seed runs with a key not starting with `sk_test_`
- **THEN** it exits non-zero with a message naming the problem, and neither Stripe nor the database changed

#### Scenario: Dry run
- **WHEN** the seed runs with `--dry-run`
- **THEN** it prints the client table, marking the Stripe-backed clients, and makes no network call

### Requirement: The seed's output names the Stripe-backed clients

The printed client table SHALL mark every Stripe-backed client and the flow it can exercise, so a smoke card can pick a client whose flow is possible on the data that exists.

#### Scenario: Table after a real run
- **WHEN** the seed completes
- **THEN** the table shows, for each Stripe-backed client, that it is Stripe-backed and whether it exercises cancel or reactivate

### Requirement: Month-1 history follows the portal's day grid
The seed SHALL give Sofía Ramírez (`sofia.ramirez@test.aura.mx`) an active month-1 subscription whose period started 25 days before the run date. For each past date in that period (from `current_period_start` up to but excluding today), any log written SHALL reference the Mes 1 program day that the portal resolves for that date, and SHALL carry that date as its `log_date`. No log SHALL be dated before `current_period_start`, on today, or after today.

#### Scenario: Log matches the portal's cell for its date
- **WHEN** the seed has run and a log for Sofía is dated D
- **THEN** its program day is the Mes 1 day at week `floor((D - current_period_start)/7) + 1` and D's weekday, which is the day `/portal/today` would have shown on D

#### Scenario: Week 4 dates do not wrap
- **WHEN** a date is 21–24 days after `current_period_start`
- **THEN** its log references a week-4 day, never week 1 or a previous period

#### Scenario: Today is not pre-logged
- **WHEN** Sofía opens `/portal/today` after a seed run
- **THEN** today's workout has no existing log

### Requirement: Rest days and missing content are never logged
The seed SHALL NOT write a log for a Sunday, for a cell with no published program day, or for a program day with no `exercise_list` exercises.

#### Scenario: Descanso Activo stays empty
- **WHEN** the seeded history is listed
- **THEN** no entry is dated on a Sunday

### Requirement: Logged content comes from the captured program
Each exercise entry in a log SHALL be keyed by an exercise id that exists in that day's `exercise_list` blocks at seed time. It SHALL hold at most as many series as the exercise prescribes sets, and SHALL fill only the metrics the exercise declares. The seed SHALL NOT write to any catalog table.

#### Scenario: Aura edits Mes 1 and the seed is re-run
- **WHEN** Aura renames or replaces an exercise in Mes 1 and the seed runs again
- **THEN** Sofía's history shows the current exercise and no entry references the removed one

#### Scenario: Metrics respect the exercise
- **WHEN** an exercise declares only `reps_done`
- **THEN** its logged series carry no `weight_kg`

### Requirement: History reads as a realistic first month
Of Sofía's loggable days, the seed SHALL leave 2 or 3 unlogged (skipped) and SHALL log 1 or 2 as partial (not every exercise completed). All remaining loggable days SHALL be fully completed. For each exercise logged in more than one week, the logged values SHALL NOT decrease from its first logged week to its last. The outcome SHALL be the same on every run relative to the period start.

#### Scenario: Performance chart shows a trend
- **WHEN** Sofía opens Desempeño for an exercise that is logged in several weeks
- **THEN** the chart shows several points and the last is not lower than the first

#### Scenario: Historial shows a mix of outcomes
- **WHEN** Sofía opens Historial
- **THEN** the entries include fully completed days, at least one partial day, and gaps where days were skipped
