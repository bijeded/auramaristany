# admin-automated-messages Specification

## ADDED Requirements

### Requirement: Admin screen listing the automated messages

The admin area SHALL expose a screen listing every automated message rule with its subject, body and active state. The screen SHALL be reachable only by an authenticated admin, enforced server-side with `requireAdminPage()`. The list is fixed: the screen MUST NOT offer creating or deleting rules, because a rule's trigger is implemented in code and a user-created row would never be sent.

#### Scenario: Admin opens the screen
- **WHEN** an authenticated admin opens the automated-messages screen
- **THEN** both rules are listed with their current subject, body and active state

#### Scenario: Non-admin attempts access
- **WHEN** a client or an unauthenticated visitor requests the automated-messages screen
- **THEN** access is refused the same way as every other admin route

#### Scenario: No create or delete
- **WHEN** an admin views the screen
- **THEN** no control is offered to add a new automated message or to delete an existing one

### Requirement: Editing a rule's copy

An admin SHALL be able to edit each rule's subject and body and save them. Bodies are plain text, edited in a plain multi-line control — message bodies are not rich text and are rendered as plain text with preserved line breaks in both the portal and the email. Saved content SHALL be validated server-side against the same subject and body length limits used for manual messages, and sanitized as plain text. Identity SHALL come from the server; the action MUST NOT trust an identifier sent by the client.

#### Scenario: Admin saves new copy
- **WHEN** an admin edits a rule's subject and body and saves
- **THEN** the new copy is persisted and used by the next run of that rule

#### Scenario: Body exceeds the limit
- **WHEN** an admin submits a body longer than the message body limit
- **THEN** the save is rejected with a message explaining the limit, and the stored copy is unchanged

#### Scenario: Empty subject or body
- **WHEN** an admin submits an empty subject or an empty body
- **THEN** the save is rejected and the stored copy is unchanged

#### Scenario: Line breaks are preserved
- **WHEN** an admin writes a body containing blank lines between paragraphs
- **THEN** the client sees those paragraph breaks both in the portal message and in the email

### Requirement: Placeholders available to the admin

The screen SHALL show which placeholders are available for use in a body. Only whitelisted placeholders are substituted at send time; anything else is left literal.

#### Scenario: Admin sees the available placeholders
- **WHEN** an admin edits a rule's body
- **THEN** the screen displays the list of placeholders that will be substituted

#### Scenario: Admin uses an available placeholder
- **WHEN** an admin includes a whitelisted placeholder in the body and saves
- **THEN** each recipient receives the message with their own value substituted

### Requirement: Activating and deactivating a rule

An admin SHALL be able to switch each rule on or off independently, taking effect on the next run without a deployment. Deactivating a rule stops it from sending; it MUST NOT delete the rule's copy or its send history.

#### Scenario: Admin deactivates a rule
- **WHEN** an admin switches a rule off
- **THEN** that rule sends nothing on subsequent runs, while the other rule keeps operating

#### Scenario: Admin reactivates a rule
- **WHEN** an admin switches a previously deactivated rule back on
- **THEN** the rule resumes sending on the next run, using its saved copy

#### Scenario: Deactivation preserves data
- **WHEN** a rule is deactivated
- **THEN** its subject and body remain stored and its past sends remain recorded
