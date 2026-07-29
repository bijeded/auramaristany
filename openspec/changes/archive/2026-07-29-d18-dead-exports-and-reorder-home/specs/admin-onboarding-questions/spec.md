## ADDED Requirements

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
