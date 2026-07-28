## ADDED Requirements

### Requirement: Content position is explicit state on the subscription

The system SHALL address a client's content through position state stored on the subscription, not through `months_elapsed`. Each subscription SHALL carry `content_variant_id` (the rung the client is currently on), `content_ordinal` (position within that rung), and `content_loops` (how many times the client has wrapped at the top rung). `months_elapsed` SHALL remain unchanged in meaning and SHALL continue to serve billing and elapsed-time display only.

Content resolution SHALL read `content_variant_id` and `content_ordinal`, never `program_variant_id`, which SHALL remain immutable as the record of what the client purchased and the link to her Stripe price.

#### Scenario: Content is resolved from the pointer
- **WHEN** the portal resolves the day's content for a subscription
- **THEN** it looks up the series mapped to `(content_variant_id, content_ordinal)` and ignores `months_elapsed`

#### Scenario: Purchased variant is never rewritten
- **WHEN** a client advances to a new rung
- **THEN** `content_variant_id` changes and `program_variant_id` is left untouched

#### Scenario: Position is never derived from a count
- **WHEN** the number of series authored for a variant changes
- **THEN** no existing subscription's `content_ordinal` or `content_variant_id` changes as a result

### Requirement: The pointer advances one step per paid month

On each newly recorded paid invoice, the system SHALL advance the subscription's content position by exactly one step, evaluating these branches in order:

1. If the subscription's program is `fixed_term_monthly` and `months_elapsed` has reached `duration_months`, the position SHALL NOT advance.
2. Otherwise, if the current variant has a mapped ordinal greater than `content_ordinal`, `content_ordinal` SHALL become the **smallest** such ordinal.
3. Otherwise, if the current variant declares a `ladder_next_variant_id`, `content_variant_id` SHALL become that variant and `content_ordinal` SHALL become that variant's smallest mapped ordinal.
4. Otherwise, if the current variant declares **no** `ladder_next_variant_id`, `content_ordinal` SHALL become the current variant's smallest mapped ordinal and `content_loops` SHALL be incremented.
5. Otherwise — a next rung is declared but has no series mapped to it — the position SHALL NOT advance.

Branch 5 exists because wrapping is not recoverable and freezing is. A Principiante finishing month 6 with no Intermedio series authored would otherwise wrap to Principiante 1 with a loop counted: a wrong state that persists, reads to the client as a bug, and does not correct itself once Aura publishes. Frozen, she moves into Intermedio on her next paid invoice as soon as the first series exists. The admin content-runway signal exists so Aura sees this coming before any client reaches it.

Successor SHALL be the next **existing** ordinal and SHALL NOT be computed as `content_ordinal + 1`, because ordinals may contain gaps; treating a gap as the end of a rung would advance a client into the next level early. The first position of a rung SHALL likewise be its smallest mapped ordinal rather than a hardcoded 1.

Rung length SHALL be determined by the series actually mapped to the variant at the moment of advancement, never from a stored or cached count.

#### Scenario: Advance within a rung
- **WHEN** a paid invoice is recorded for a client at ordinal 3 of a rung that has 6 series
- **THEN** `content_ordinal` becomes 4 and `content_variant_id` is unchanged

#### Scenario: Advance across a gap in the ordinals
- **WHEN** a paid invoice is recorded for a client at ordinal 2 of a rung whose mapped ordinals are 1, 2, 4, 5, 6
- **THEN** `content_ordinal` becomes 4, `content_variant_id` is unchanged, and the client is NOT moved to the next rung

#### Scenario: Advance to the next rung
- **WHEN** a paid invoice is recorded for a client at the last ordinal of Principiante, and Principiante declares Intermedio as its next rung
- **THEN** `content_variant_id` becomes Intermedio and `content_ordinal` becomes 1

#### Scenario: Wrap at the top rung
- **WHEN** a paid invoice is recorded for a client at the last ordinal of Avanzado, which declares no next rung
- **THEN** `content_ordinal` becomes 1 and `content_loops` is incremented

#### Scenario: The next rung has no content authored yet
- **WHEN** a paid invoice is recorded for a client at the last ordinal of Principiante, which declares Intermedio as its next rung, and no series is mapped to Intermedio
- **THEN** `content_variant_id`, `content_ordinal`, and `content_loops` are all unchanged, and the client does NOT wrap to Principiante 1

#### Scenario: New content is reached instead of wrapping
- **WHEN** a client sits at ordinal 6 of Avanzado, Aura publishes a 7th Avanzado series, and the client's next paid invoice is recorded
- **THEN** `content_ordinal` becomes 7 and `content_loops` is NOT incremented

#### Scenario: Growing a rung does not shift a looping client
- **WHEN** Aura publishes an additional series for a rung while clients are positioned within it
- **THEN** every affected client's next advancement moves exactly one step from her own current ordinal, with no reshuffle

### Requirement: Fixed-term subscriptions never wrap

A subscription whose program is `fixed_term_monthly` SHALL stop advancing once `months_elapsed` reaches `duration_months`. Its content position SHALL freeze at its final ordinal. The fixed-term check SHALL be evaluated before the wrap branch, because fixed-term variants declare no `ladder_next_variant_id` and would otherwise satisfy the wrap condition.

This requirement SHALL hold independently of any change to billing or subscription status.

#### Scenario: CuarentaMás freezes rather than looping
- **WHEN** a CuarentaMás subscription with `duration_months = 6` reaches `months_elapsed = 6` and a further paid invoice is recorded
- **THEN** `content_variant_id`, `content_ordinal`, and `content_loops` are all unchanged

#### Scenario: Rolling programs are unaffected by the guard
- **WHEN** a `rolling_monthly` subscription reaches the end of its top rung
- **THEN** the wrap branch applies normally and the guard does not suppress it

### Requirement: Advancement is idempotent per invoice

The system SHALL advance `months_elapsed` and the content position only when the triggering invoice is recorded for the first time. When an already-recorded invoice is received again, the handler SHALL record nothing, advance nothing, and complete successfully.

This closes an existing defect: the `months_elapsed` increment is currently unguarded, so a redelivered `invoice.paid` advances it twice. With a content pointer on the same event, an unguarded redelivery would silently skip a month of content.

#### Scenario: Redelivered invoice does not double-advance
- **WHEN** Stripe redelivers an `invoice.paid` event whose invoice has already been recorded
- **THEN** `months_elapsed`, `content_ordinal`, `content_variant_id`, and `content_loops` are all unchanged

#### Scenario: First delivery advances exactly once
- **WHEN** an `invoice.paid` event arrives for an invoice not yet recorded
- **THEN** the invoice is recorded and both `months_elapsed` and the content position advance by exactly one step

### Requirement: A client may enter at any rung

The system SHALL support a client subscribing directly to any level, because eligibility is decided by Aura's evaluation outside the platform. On subscription creation the content position SHALL be initialised to the purchased variant at ordinal 1. No offset or back-fill from earlier rungs SHALL be applied.

#### Scenario: Direct entry at an advanced level
- **WHEN** a client subscribes directly to Strong & Fit Avanzado
- **THEN** `content_variant_id` is Strong & Fit Avanzado and `content_ordinal` is 1, and her first month serves Avanzado content

#### Scenario: Entry at the first rung
- **WHEN** a client subscribes to Strong & Fit Principiante
- **THEN** `content_variant_id` is Strong & Fit Principiante and `content_ordinal` is 1

### Requirement: A repeating client is told she is repeating

When a client has wrapped at the top rung, the portal SHALL display a persistent, low-emphasis marker naming the position being repeated, for as long as the repeat lasts. It SHALL NOT be a one-time dismissable notice, because a client silently redoing content she recognises would otherwise conclude the application is broken.

Copy SHALL be warm, first-person, neutral Mexican Spanish, consistent with the rest of the portal.

#### Scenario: Repeat marker is shown
- **WHEN** a client with `content_loops` greater than 0 views her day
- **THEN** a persistent marker such as "Repitiendo Mes 3" is displayed alongside the content

#### Scenario: No marker before the first wrap
- **WHEN** a client with `content_loops` of 0 views her day
- **THEN** no repeat marker is displayed

### Requirement: Progress display is rung-aware

For a subscription on a `rolling_monthly` program, the system SHALL present progress as the client's current rung and position within it, rather than as a count of elapsed months or a fraction with no denominator. Fixed-term programs SHALL continue to display progress against their defined duration.

#### Scenario: Rolling program shows rung and position
- **WHEN** a Strong & Fit client at month 14 is on Avanzado at ordinal 2 and views her subscription
- **THEN** the progress is displayed as "Avanzado · Mes 2"

#### Scenario: Fixed-term program keeps its duration
- **WHEN** a CuarentaMás client at `months_elapsed = 3` with `duration_months = 6` views her subscription
- **THEN** the progress is displayed as "Mes 3 de 6"
