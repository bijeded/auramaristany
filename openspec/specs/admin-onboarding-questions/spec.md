# admin-onboarding-questions Specification

## Purpose

Integridad del orden en el constructor de preguntas de onboarding: cómo se guarda el orden que la admin arrastra, y qué pasa cuando ese guardado falla. El cuestionario es lo que se le pregunta a cada cliente nueva, así que un orden a medias no es un detalle de UI — lo contestan personas antes de que nadie lo note. La regla que convierte una lista de ids en posiciones vive en un solo sitio, y el orden se aplica de una sola vez o no se aplica.

## Requirements

### Requirement: The onboarding question order is saved as a whole

When the admin reorders the onboarding questions, the system SHALL persist the new order as a single write. A failure SHALL leave the previously saved order intact, and SHALL NOT leave the questionnaire partially renumbered.

Saving position by position lets a failure land between two writes, which produces an order that the admin never chose and never saw: some questions renumbered, the rest not. The questionnaire is what every new client is asked, so a silently scrambled order is answered by real people before anyone notices.

#### Scenario: Reorder is persisted
- **WHEN** the admin drags a question to a new position and the save succeeds
- **THEN** the new order is stored and is the order shown on reload

#### Scenario: A failed reorder changes nothing
- **WHEN** the write of a new order fails
- **THEN** the previously saved order remains in effect, with no question left renumbered

#### Scenario: Positions start at zero
- **WHEN** an order is saved
- **THEN** the first question is stored at position `0` and each following question at the next consecutive position

### Requirement: The ordering rule has a single definition

The rule that turns an ordered list of question ids into stored positions SHALL be defined in exactly one place, and that definition SHALL be the one the save path uses.

A second copy of the rule inside the save path is not exercised by the tests that cover the first, so the two can drift while the suite stays green — the defect this project has already shipped once, on the admin client list.

#### Scenario: The save path uses the shared definition
- **WHEN** the reorder action computes the positions to store
- **THEN** it uses the single shared definition rather than deriving positions itself

### Requirement: Reordering is authorized as an admin write

Reordering SHALL be permitted only to an administrator, and SHALL be authorized by the same row-level policy that governs every other write to the onboarding questions. Applying the order SHALL NOT require or introduce a privileged path that bypasses row-level security.

#### Scenario: A non-admin cannot reorder
- **WHEN** a client attempts to reorder the onboarding questions
- **THEN** the write is refused

#### Scenario: No privilege escalation is introduced
- **WHEN** the order is applied
- **THEN** it is applied under the caller's own permissions, governed by the existing admin write policy

### Requirement: Admin writes are checked against the row being written

Every insert and update to the onboarding questions SHALL be authorized against the row as written, and not only against the existing row it replaces. The policy that governs admin writes SHALL state an explicit write check, so no write path relies on the implicit fallback to the read condition.

#### Scenario: A non-admin cannot insert a question
- **WHEN** an authenticated client attempts to insert an onboarding question
- **THEN** the insert is refused by row-level security

#### Scenario: An admin can still write
- **WHEN** an administrator creates, edits, or reorders onboarding questions
- **THEN** each write succeeds as before

#### Scenario: The policy declares its write check
- **WHEN** the policies on the onboarding questions table are inspected in the database
- **THEN** the admin write policy carries a write check equal to its read condition
