# Spec Delta

## ADDED Requirements

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
