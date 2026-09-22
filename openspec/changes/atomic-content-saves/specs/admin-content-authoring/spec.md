# Spec Delta

## ADDED Requirements

### Requirement: Saving authored content is all-or-nothing

When Aura saves a day's blocks, a pillar's blocks, or a series' details together with its variant positions, the system SHALL either persist the entire save or persist nothing. A failed save SHALL leave the previously saved content exactly as it was, and SHALL be reported to Aura as an error. A save reported as successful SHALL have persisted every part of it.

A failed save SHALL NOT leave a day or pillar with fewer blocks than before, a series mapped to no variant, or a series whose details were saved while its positions were not (or the reverse).

#### Scenario: A block fails to save
- **WHEN** Aura saves a day's blocks and one of them is rejected by the database
- **THEN** she sees an error, and the day still shows exactly the blocks it had before the save

#### Scenario: A pillar block fails to save
- **WHEN** Aura saves a pillar's blocks and one of them is rejected by the database
- **THEN** she sees an error, and the pillar still shows exactly the blocks it had before the save

#### Scenario: Moving a month to a position already taken
- **WHEN** Aura edits a month's title and moves it to a position its variant already uses
- **THEN** she sees the inline position-taken error, the month keeps its previous positions in every variant, and its title is unchanged

#### Scenario: Series details fail after positions are valid
- **WHEN** Aura edits a month's positions and details, and the details cannot be written
- **THEN** she sees an error, and neither the positions nor the details have changed

#### Scenario: A successful save
- **WHEN** Aura saves a day's blocks, a pillar's blocks, or a month's details and positions without error
- **THEN** reopening the editor shows everything she saved
