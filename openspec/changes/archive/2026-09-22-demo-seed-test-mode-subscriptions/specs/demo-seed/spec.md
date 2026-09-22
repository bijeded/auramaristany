# Spec Delta

## Purpose

The demo seed produces the data Aura's demo and every manual smoke check run against. This capability states which seeded clients are backed by real Stripe test-mode subscriptions, so Stripe-touching flows (cancel, reactivate) can be exercised on seeded data.

## ADDED Requirements

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
