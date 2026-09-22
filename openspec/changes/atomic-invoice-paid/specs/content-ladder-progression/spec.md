# Spec Delta

## ADDED Requirements

### Requirement: Recording a paid month and advancing it are all-or-nothing

For a renewal invoice, the system SHALL record the invoice and advance the subscription (`months_elapsed`, the content position, and — on a fixed-term final month — the completion record) as a single all-or-nothing operation. Either the invoice is recorded **and** the subscription has advanced exactly one step, or neither has happened.

When the advance cannot be applied — because the write fails, or because the subscription changed between being read and being written — the invoice SHALL remain unrecorded and the event SHALL fail, so that Stripe's retry processes the invoice again from the subscription's current state. A paid month SHALL NOT be recorded without its advance, and SHALL NOT be advanced twice.

This does not change what an advance is; it guarantees that one either happens in full or is retried.

#### Scenario: A failed advance leaves the invoice unrecorded
- **WHEN** a renewal `invoice.paid` for an unrecorded invoice arrives and the subscription update fails
- **THEN** the invoice is not recorded, `months_elapsed` and the content position are unchanged, and the event responds with a failure so Stripe retries

#### Scenario: The retry after a failed advance advances once
- **WHEN** Stripe retries that same `invoice.paid` and the subscription update now succeeds
- **THEN** the invoice is recorded and `months_elapsed` and the content position advance by exactly one step

#### Scenario: A concurrently moved subscription is retried, not skipped
- **WHEN** two different renewal invoices for the same subscription are processed at the same time and one advances the subscription first
- **THEN** the other records nothing and fails, and its retry advances the subscription one further step from the updated position

#### Scenario: A redelivery after success still changes nothing
- **WHEN** Stripe redelivers a renewal `invoice.paid` whose invoice was already recorded and advanced
- **THEN** no second invoice is recorded, nothing advances, and the event responds successfully

#### Scenario: A fixed-term final month records completion only with its advance
- **WHEN** the renewal that brings a fixed-term subscription to its final paid month fails to apply
- **THEN** the subscription carries neither `completed_at` nor `cancel_at_period_end` from that event, and both are recorded together with the advance when the retry succeeds
