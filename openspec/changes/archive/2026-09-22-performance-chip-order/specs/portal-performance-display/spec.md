# Spec Delta

## ADDED Requirements

### Requirement: Exercise chips follow chronological template order
The Desempeño view SHALL list its exercise selector chips in the order the exercises first appear in the client's program during the current month. Days are taken oldest log first. Within a day, blocks follow their authored order, and exercises follow their authored order inside each block. An exercise that appears again on a later day keeps the position from its first appearance. The order SHALL NOT depend on exercise identifiers or on how the logged data happens to be stored.

#### Scenario: Chips match the authored order of a single day
- **WHEN** the client's only log this month is for a day whose exercises are authored as "1. A", "2. B", "3. C", with ids that sort in reverse
- **THEN** the chips read "1. A", "2. B", "3. C"

#### Scenario: Blocks are taken in authored order
- **WHEN** a logged day has two exercise lists, the one authored first holding "X" and the one authored second holding "Y"
- **THEN** the chip for "X" comes before the chip for "Y"

#### Scenario: Later days append their new exercises
- **WHEN** the first log of the month covers a day with "A", "B" and a later log covers a day with "C", "A"
- **THEN** the chips read "A", "B", "C"

#### Scenario: An earlier day wins regardless of weekday
- **WHEN** the client's oldest log this month is a Thursday day holding "T" and a later log is a Monday day holding "M"
- **THEN** the chip for "T" comes before the chip for "M"
