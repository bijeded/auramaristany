# automated-messages Specification

## ADDED Requirements

### Requirement: Daily evaluation of automated rules

The system SHALL evaluate all automated message rules once per day via a scheduled cron route. The route MUST authenticate with `Authorization: Bearer <CRON_SECRET>` and MUST reject any request without the correct secret. The middleware `matcher` MUST continue to exclude `api/cron` so the route is reachable without a session. All date arithmetic SHALL use whole-day UTC comparisons and SHALL derive "today" from the shared `serverToday()` helper so `DEV_DATE` is honored in development.

#### Scenario: Request without the cron secret
- **WHEN** a request reaches the automated-messages cron route without a matching `Authorization: Bearer <CRON_SECRET>` header
- **THEN** the route responds 401 and evaluates no rules and sends nothing

#### Scenario: Authorized daily run
- **WHEN** the cron route is invoked with the correct secret
- **THEN** every active rule is evaluated against every client whose subscription grants access, and a summary of what was sent is returned

#### Scenario: Dry run
- **WHEN** the cron route is invoked with the correct secret and `dryRun=1`
- **THEN** the route reports which clients and rules would have matched, and writes no ledger rows, no messages, and sends no email

#### Scenario: Implausible fan-out
- **WHEN** a single run would send to more than the configured per-run cap of clients
- **THEN** the run aborts without sending, and reports the attempted count as an error

### Requirement: Booking reminder fires on the first day of a booking window

The system SHALL send the booking reminder when the client's current content cell exposes an `agendar` block and the cell they occupied on the previous day did not. The current and previous cells SHALL be resolved with `getCurrentDayKey` against the client's own `current_period_start`, so the reminder lands on the first day the window is open *for that client*. The system MUST NOT compute the reminder from a fixed day number of the billing period. Only cells on `published` program days SHALL be considered.

#### Scenario: First day of a booking window
- **WHEN** a client's current cell has an `agendar` block and yesterday's cell did not
- **THEN** the booking reminder is sent to that client

#### Scenario: Later day of the same window
- **WHEN** a client's current cell has an `agendar` block and yesterday's cell also had one
- **THEN** no booking reminder is sent

#### Scenario: Two clients with different period start weekdays
- **WHEN** Aura places an `agendar` run on the same cells and two clients have different `current_period_start` weekdays
- **THEN** each client receives the reminder on their own first day of that run, which may be a different calendar date and a different day-number of their period

#### Scenario: Window on an unpublished day
- **WHEN** the client's current cell carries an `agendar` block but the program day is not published
- **THEN** no booking reminder is sent, because the client cannot see the window

#### Scenario: Aura moves the window
- **WHEN** Aura relocates the `agendar` run to different cells
- **THEN** the reminder follows the new placement with no code or configuration change

### Requirement: Booking reminder suppression

The system SHALL NOT send the booking reminder to a client who already holds a future non-canceled call, whose subscription has `cancel_at_period_end` set, or whose subscription status is `past_due`.

#### Scenario: Client already booked
- **WHEN** an otherwise-matching client has a future, non-canceled booking in the ledger
- **THEN** no booking reminder is sent

#### Scenario: Client is cancelling
- **WHEN** an otherwise-matching client's subscription has `cancel_at_period_end = true`
- **THEN** no booking reminder is sent

#### Scenario: Client is past due
- **WHEN** an otherwise-matching client's subscription status is `past_due`
- **THEN** no booking reminder is sent

### Requirement: Inactivity nudge fires after ten quiet days

The system SHALL send the inactivity nudge when the client has recorded no `progress_logs` for at least 10 whole days, using the same inactivity helper as the admin client list. A client who has never logged progress SHALL count as inactive. Clients whose subscription status is `past_due` SHALL receive the nudge; clients with `cancel_at_period_end` set SHALL NOT.

#### Scenario: Client inactive for ten days
- **WHEN** a client's most recent progress log is 10 or more whole days old
- **THEN** the inactivity nudge is sent

#### Scenario: Client active within the threshold
- **WHEN** a client's most recent progress log is fewer than 10 whole days old
- **THEN** no inactivity nudge is sent

#### Scenario: Client has never logged progress
- **WHEN** a client has no progress logs at all
- **THEN** the client counts as inactive and the nudge is sent

#### Scenario: Past-due client goes quiet
- **WHEN** a `past_due` client has been inactive for at least 10 days
- **THEN** the inactivity nudge is sent

#### Scenario: Cancelling client goes quiet
- **WHEN** a client with `cancel_at_period_end = true` has been inactive for at least 10 days
- **THEN** no inactivity nudge is sent

### Requirement: Repeat sends are prevented by a dedicated ledger

The system SHALL record every automated send in a dedicated `automated_notices` ledger with a uniqueness constraint over `(profile_id, rule, period_key)`, and SHALL treat that constraint as the sole dedupe mechanism. Dedupe MUST NOT be derived from message history, because retained messages are purged after 180 days. The ledger row SHALL be written before the message and email are sent, so that an interrupted run costs a missed message rather than a duplicate.

The `period_key` SHALL be:
- for the booking reminder, the client's `current_period_start` combined with the first cell of the run (week number and day of week);
- for the inactivity nudge, the client's last activity date, or a sentinel derived from their enrollment date when they have never logged progress.

#### Scenario: Second run on the same day
- **WHEN** the cron runs twice on the same day
- **THEN** each client receives each message at most once, because the second insert collides with the existing ledger row

#### Scenario: Two booking windows in one period
- **WHEN** a client passes through two separate `agendar` runs within one billing period
- **THEN** two reminders are sent, because the runs produce different period keys

#### Scenario: Week-four cell revisited on days 29 to 31
- **WHEN** a booking window sits on a week-4 cell and the billing period runs longer than 28 days, causing the client to resolve to that same cell a second time
- **THEN** no second reminder is sent, because the period key names the cell and collides with the existing row

#### Scenario: Client stays inactive for weeks
- **WHEN** a client remains inactive for many consecutive days
- **THEN** exactly one nudge is sent for that quiet spell

#### Scenario: Client returns and lapses again
- **WHEN** a nudged client logs progress and later becomes inactive again for 10 days
- **THEN** a second nudge is sent, because the new last-activity date produces a new period key

#### Scenario: Messages purged after retention
- **WHEN** the message retention cron has deleted the original automated messages
- **THEN** no automated message is re-sent, because dedupe does not consult message history

#### Scenario: Send fails after the ledger row is written
- **WHEN** the ledger row is written and delivery then fails
- **THEN** the message is not retried on the next run, and no duplicate is created

### Requirement: Delivery as an in-app message plus email

Each automated send SHALL create a message in the client's portal inbox and SHALL send that client a notification email. The email SHALL contain the rendered message body in addition to the subject. Email delivery SHALL be best-effort: a failure MUST NOT prevent or roll back the in-app message.

#### Scenario: Successful send
- **WHEN** a rule matches a client
- **THEN** the client sees the message in their portal inbox and receives an email containing the same rendered body

#### Scenario: Email provider unavailable
- **WHEN** email delivery fails for a matched client
- **THEN** the in-app message still exists in the client's inbox and the run continues for the remaining clients

### Requirement: Message content comes from the editable template

Each rule SHALL render its subject and body from the corresponding row in the automated-message templates, substituting a fixed whitelist of placeholders with the client's own values. Unrecognized placeholders SHALL be left untouched rather than raising an error. A rule whose template is marked inactive SHALL NOT be evaluated or sent.

#### Scenario: Placeholder substitution
- **WHEN** a template body contains the client-name placeholder
- **THEN** the sent message contains that client's name in its place

#### Scenario: Unknown placeholder
- **WHEN** a template body contains a placeholder that is not in the whitelist
- **THEN** the text is sent with the placeholder left literal and the run does not fail

#### Scenario: Rule deactivated
- **WHEN** a rule's template is marked inactive
- **THEN** that rule sends nothing on any run, while the other rule continues to operate
