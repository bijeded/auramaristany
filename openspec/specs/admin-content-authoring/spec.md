# admin-content-authoring Specification

## Purpose
How Aura authors program content in the admin editor: one ordered list of months per variant, a required variant-and-position on every series, and shared series marked as shared so an edit's reach is visible before saving.
## Requirements
### Requirement: Aura authors an ordered curriculum per variant

The admin content editor SHALL present a program's content grouped by variant, each as its own ordered list of months. Creating a series SHALL require the variant or variants it belongs to and its position within each, and the month number shown SHALL be the position within the variant being viewed.

The editor SHALL be reachable only by an administrator, through the existing admin guard.

#### Scenario: Content is listed per variant
- **WHEN** Aura opens a program with several variants
- **THEN** each variant is presented with its own ordered list of months

#### Scenario: Creating a month for a specific variant
- **WHEN** Aura creates a month, choosing its variant and position
- **THEN** the series is created and mapped to that variant at that position

#### Scenario: Position already taken within the variant
- **WHEN** Aura creates a month at a position that variant already uses
- **THEN** she is shown an inline error naming the conflict, and nothing is written

#### Scenario: Same position in a different variant is allowed
- **WHEN** Aura creates a first month for a variant while another variant of the same program already has one
- **THEN** the creation succeeds

### Requirement: Every series belongs to at least one variant

The system SHALL require at least one variant mapping when a series is created, and SHALL NOT allow a series to be left mapped to no variant. A series with no mapping has no position and cannot appear in any curriculum.

Removing a series' last remaining mapping SHALL be presented to Aura as deleting the series, not as unmapping it.

#### Scenario: Creation without a variant is refused
- **WHEN** Aura attempts to create a month without selecting any variant
- **THEN** the creation is refused with an explanatory message and nothing is written

#### Scenario: Removing the last mapping
- **WHEN** Aura removes the only variant a series is mapped to
- **THEN** she is asked to confirm deletion of the series, with its days and blocks

### Requirement: Shared series are visible as shared

When a series is mapped to more than one variant, the editor SHALL make that visible wherever it appears, so that Aura knows an edit affects every variant showing it.

#### Scenario: A shared series is marked
- **WHEN** a series mapped to two variants is displayed in either variant's list
- **THEN** the editor indicates that it is shared and which variants show it

#### Scenario: Editing a shared series
- **WHEN** Aura edits a series mapped to more than one variant
- **THEN** she is informed before saving that the change affects every variant it is mapped to

