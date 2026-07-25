## ADDED Requirements

### Requirement: Agendar block type

The content editor SHALL support an `agendar` block type, added to the allowed `BLOCK_TYPES` and validated by zod. Aura SHALL be able to place it on a `program_day` from the block palette like any other block. Placing the same block on consecutive days SHALL constitute a multi-day booking window (no separate window configuration).

#### Scenario: Add an agendar block
- **WHEN** Aura adds an `agendar` block to a program day and saves
- **THEN** the block is persisted and passes server-side validation

#### Scenario: Unknown block type rejected
- **WHEN** a block with a type not in the allowed set is submitted
- **THEN** validation fails with "Tipo de bloque no permitido"

### Requirement: Agendar block renders booking state in the portal

When rendered in the portal, the `agendar` block SHALL reflect the client's current booking status. If the client has no future non-canceled call, it SHALL render an active call-to-action linking to `/portal/booking`. If the client already has a future call, it SHALL render a disabled state naming the scheduled date, so that booking on an earlier window day auto-disables the CTA on the remaining days.

#### Scenario: No future call — active CTA
- **WHEN** the `agendar` block renders for a client with no future non-canceled call
- **THEN** it shows an enabled "Agendar tu llamada" control linking to `/portal/booking`

#### Scenario: Has a future call — disabled
- **WHEN** the `agendar` block renders for a client who already has a future non-canceled call
- **THEN** it shows a disabled state "Tu llamada es el {fecha}" and does not link to the booking page

#### Scenario: Tap target and tone
- **WHEN** the active CTA renders
- **THEN** it respects the brand tokens and ≥44px tap target, with warm first-person Mexican-Spanish copy
