## ADDED Requirements

### Requirement: A variant owns an ordered curriculum

The system SHALL express a variant's curriculum as its ordered list of mapped series. Position SHALL be carried by the mapping between a variant and a series (`variant_series_map.ordinal`), not by the series itself, and SHALL be unique per variant.

Position SHALL NOT be expressed on `program_series`. The program-wide `series_number` and its uniqueness constraint SHALL be removed, so that each variant numbers its curriculum independently from 1 and two variants of the same program may both hold a first month.

#### Scenario: Two variants each hold a first month
- **WHEN** Aura authors a first month for CuarentaMás Extra Intermedio and a first month for CuarentaMás Extra Avanzado
- **THEN** both are created successfully and each appears at position 1 within its own variant

#### Scenario: A position is unique within a variant
- **WHEN** a second series is mapped to the same variant at a position already taken
- **THEN** the write is rejected

#### Scenario: A shared series may sit at different positions
- **WHEN** one series is mapped to two variants with different ordinals
- **THEN** each variant presents it at its own position, and the series itself carries no position

### Requirement: Successor position is the next existing ordinal

The system SHALL define the successor of a position as the smallest mapped ordinal greater than it, and SHALL define the end of a variant's curriculum as the absence of any such ordinal. No reader SHALL assume that positions are contiguous or that the successor of *n* is `n + 1`.

Uniqueness prevents duplicate positions but does not prevent gaps, which arise whenever a mapping is deleted from the middle of a curriculum. Treating a gap as the end of the curriculum would advance a client out of her level early.

#### Scenario: Gap in the middle of a curriculum
- **WHEN** a variant has ordinals 1, 2, 4, 5, 6 and a client is at position 2
- **THEN** her successor position is 4, and the curriculum is not treated as ended

#### Scenario: End of a curriculum
- **WHEN** a client is at the highest mapped ordinal for her variant
- **THEN** no successor exists and the curriculum is reported as ended

### Requirement: Content is resolved through the variant mapping

The system SHALL resolve the series to serve a subscription by looking up the mapping for the subscription's variant at the required position. Resolution SHALL NOT depend on any program-wide series numbering.

Behavior SHALL be unchanged for existing clients, all of whom entered at their program's first level, until the content ladder is introduced separately.

#### Scenario: Resolving a client's current series
- **WHEN** the portal resolves content for a subscription at a given position
- **THEN** it returns the series mapped to that subscription's variant at that ordinal

#### Scenario: No series at the requested position
- **WHEN** no mapping exists for the variant at the requested position
- **THEN** no series is returned and the caller handles the absence explicitly

### Requirement: Rung order between variants is declared

The system SHALL store the progression order between the variants of a program as data on `program_variants`, as a nullable reference to the variant that follows. A null reference SHALL mean the variant has no successor.

The declaration SHALL NOT be self-referential and the declared chains SHALL terminate. This change SHALL populate the references; no behavior in this change reads them.

#### Scenario: A laddered program declares its chain
- **WHEN** the Strong & Fit variants are inspected
- **THEN** Principiante references Intermedio, Intermedio references Avanzado, and Avanzado references nothing

#### Scenario: A fixed-term program declares no chain
- **WHEN** the CuarentaMás variants are inspected
- **THEN** every variant's successor reference is null

#### Scenario: Self-reference is rejected
- **WHEN** a variant is given itself as its successor
- **THEN** the write is rejected
