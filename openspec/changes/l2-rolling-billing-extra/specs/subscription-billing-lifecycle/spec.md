## ADDED Requirements

### Requirement: A fixed-term subscription stops billing at its defined end

A subscription on a `fixed_term_monthly` program SHALL stop billing once the client has paid for the program's full duration. On the paid month at which `months_elapsed` reaches `duration_months`, the system SHALL set the subscription's status to `completed`, record `completed_at`, and cancel the Stripe subscription **at period end**.

Cancellation SHALL be at period end and never immediate: the client has paid for that month and SHALL retain it in full. The system SHALL NOT wait for a further paid invoice before ending the subscription, as that would charge the client for a month beyond the program.

#### Scenario: Final month of a fixed-term program
- **WHEN** the paid invoice that brings a CuarentaMás subscription to `months_elapsed = 6` with `duration_months = 6` is recorded
- **THEN** the status becomes `completed`, `completed_at` is recorded, and the Stripe subscription is set to cancel at period end

#### Scenario: The client keeps her final paid month
- **WHEN** a subscription has completed and its current period has not yet ended
- **THEN** the client retains access to that month's content until the period ends

#### Scenario: No invoice beyond the program
- **WHEN** the period following a completed subscription's final month would begin
- **THEN** no further invoice is raised and the client is not charged

#### Scenario: Before the final month
- **WHEN** a paid invoice brings a CuarentaMás subscription to `months_elapsed = 3` with `duration_months = 6`
- **THEN** the status is unchanged and no cancellation is scheduled

### Requirement: A rolling subscription bills until the client cancels

A subscription on a `rolling_monthly` program SHALL NOT complete and SHALL continue billing every month until the client cancels it. `CuarentaMás Extra` SHALL be a rolling program, matching how it is sold.

#### Scenario: Rolling subscription passes six months
- **WHEN** a CuarentaMás Extra subscription reaches `months_elapsed = 7`
- **THEN** it continues billing, its status is unchanged, and no completion occurs

#### Scenario: Rolling subscription ends only by cancellation
- **WHEN** a client on a rolling program cancels
- **THEN** the subscription ends at the end of the already-paid period, per the existing cancellation behavior

### Requirement: Completion is terminal and outranks generic cancellation

Once a subscription's status is `completed`, no later event SHALL change it to `canceled`. When Stripe deletes the subscription at the end of the completed period, the deletion handler SHALL leave a `completed` status intact.

Without this rule, completing a program would be recorded as quitting it, and the client would lose the access granted to clients who finished.

#### Scenario: Stripe deletes a completed subscription at period end
- **WHEN** a `customer.subscription.deleted` event arrives for a subscription whose status is already `completed`
- **THEN** the status remains `completed` and is not overwritten with `canceled`

#### Scenario: Ordinary cancellation is unaffected
- **WHEN** a `customer.subscription.deleted` event arrives for a subscription that is not `completed`
- **THEN** the status becomes `canceled` as before

#### Scenario: Completion logs no involuntary cancellation
- **WHEN** the subscription deleted at the end of a completed period carries `cancellation_details.reason` of `cancellation_requested`
- **THEN** no cancellation survey row is written

### Requirement: Stored statuses and application statuses agree

The set of statuses the database permits SHALL match the set the application defines. `completed` and `trialing` SHALL both be permitted, and any future status value SHALL be added to the constraint in the same change that introduces it.

#### Scenario: Completion is storable
- **WHEN** the system writes a status of `completed`
- **THEN** the write succeeds

#### Scenario: Trial status is storable
- **WHEN** the system writes a status of `trialing`
- **THEN** the write succeeds

### Requirement: Checkout enforces no eligibility gate

Purchase eligibility SHALL be decided by Aura's evaluation outside the platform, which directs a client to the program and level she qualifies for. The checkout path SHALL NOT refuse a purchase on the basis of the client's previous or current subscriptions.

The content-derived prerequisite rules SHALL be removed, because they refuse precisely the clients Aura has evaluated and approved: a client sent directly to an advanced level has no qualifying prior subscription.

#### Scenario: Evaluated client enters at an advanced level
- **WHEN** a client with no prior subscription starts checkout for CuarentaMás Extra Avanzado
- **THEN** the checkout proceeds

#### Scenario: Client continuing from a finished program
- **WHEN** a client whose CuarentaMás subscription is `completed` starts checkout for CuarentaMás Extra
- **THEN** the checkout proceeds

#### Scenario: No prerequisite refusal remains
- **WHEN** any client starts checkout for any active variant
- **THEN** the purchase is never refused for failing a prerequisite
