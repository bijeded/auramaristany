# Spec Delta

## MODIFIED Requirements

### Requirement: Saving authored content is all-or-nothing

When Aura saves a day's blocks, a pillar's blocks, or a series' details together with its variant positions, or creates a series with its variant positions, the system SHALL either persist the entire write or persist nothing. A failed write SHALL leave the previously saved content exactly as it was and SHALL be reported to Aura as an error. A write reported as successful SHALL have persisted every part of it.

A failed write SHALL NOT leave a day or pillar with fewer blocks than before, a series mapped to no variant, a series whose details were saved while its positions were not (or the reverse), or a newly created series that exists without its positions.

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

#### Scenario: Creating a month at a position already taken
- **WHEN** Aura creates a new month and picks, for any selected variant, a position that variant already uses
- **THEN** she sees the inline position-taken error, and no new month exists in the program, neither in any variant's list nor unmapped

#### Scenario: A successful save
- **WHEN** Aura saves a day's blocks, a pillar's blocks, or a month's details and positions without error
- **THEN** reopening the editor shows everything she saved

#### Scenario: A successful creation
- **WHEN** Aura creates a month for one or more variants without error
- **THEN** the month appears, unpublished, at the chosen position in every variant she selected
