# portal-booking Specification

## Purpose
TBD - created by archiving change calendly-booking-agendar-block. Update Purpose after archive.
## Requirements
### Requirement: Booking route is gated to active subscribers

The `/portal/booking` route SHALL be a server-rendered page that denies access unless the request comes from an authenticated user whose subscription grants access (`subscriptionGrantsAccess` over `active`/`trialing`/`past_due`). Identity SHALL be derived from `getUser()` on the server; the route MUST NOT trust any identifier sent by the client.

#### Scenario: Unauthenticated request
- **WHEN** a request to `/portal/booking` has no authenticated session
- **THEN** the user is redirected to sign in (same behavior as other portal routes)

#### Scenario: Authenticated user without an access-granting subscription
- **WHEN** an authenticated user with no `active`/`trialing`/`past_due` subscription opens `/portal/booking`
- **THEN** the Calendly embed is not rendered and the user is redirected to the no-subscription page

#### Scenario: Active subscriber
- **WHEN** an authenticated user with an access-granting subscription is otherwise eligible
- **THEN** the page renders the Calendly embed

### Requirement: Booking eligibility is derived server-side from content

Access to the embed SHALL additionally require that the client is within an open booking window — defined as today's published `program_day` exposing an `agendar` block. The window is content-driven (Aura placing the block); the system MUST NOT compute a rolling date window. Typing the URL directly on a non-eligible day MUST be refused.

#### Scenario: Eligible day
- **WHEN** an active subscriber opens `/portal/booking` and today's published plan contains an `agendar` block
- **THEN** the Calendly embed is rendered

#### Scenario: Non-eligible day (direct URL)
- **WHEN** an active subscriber navigates directly to `/portal/booking` on a day whose plan has no `agendar` block
- **THEN** the embed is not rendered and the client sees a message that booking is not available right now

### Requirement: One future call at a time (dedup)

The system SHALL allow a client to hold at most one future, non-canceled call at a time. When the client already has a future call in the bookings ledger, the booking embed MUST NOT be offered; instead the client is told when their scheduled call is. Canceling that call SHALL make the client eligible to book again.

#### Scenario: Client already has a future call
- **WHEN** an eligible client who already has a future, non-canceled booking opens `/portal/booking`
- **THEN** the embed is not rendered and the client sees "Ya tienes una llamada agendada para el {fecha}"

#### Scenario: Client cancels then rebooks
- **WHEN** a client cancels their scheduled call (ledger row marked canceled) and it is still an open window
- **THEN** the client becomes eligible to book again

### Requirement: Bookings ledger is maintained by a signed Calendly webhook

An endpoint `/api/webhooks/calendly` SHALL receive Calendly `invitee.created` and `invitee.canceled` events, verify the webhook signature before processing, and idempotently upsert the corresponding row in the `bookings` table. Writes SHALL use the service-role client (the client never writes bookings). The middleware `matcher` MUST exclude this route with an inline literal. Rows SHALL be readable by their owner via RLS only.

#### Scenario: Valid invitee.created
- **WHEN** a correctly signed `invitee.created` event arrives whose invitee email maps to a known profile
- **THEN** a booking row is upserted for that user with the scheduled time and status active

#### Scenario: Redelivered event
- **WHEN** the same Calendly event is delivered more than once
- **THEN** the upsert leaves a single row (idempotent, no duplicate)

#### Scenario: Invalid signature
- **WHEN** an event arrives with a missing or invalid signature
- **THEN** the request is rejected and no row is written

#### Scenario: Cancellation
- **WHEN** a correctly signed `invitee.canceled` event arrives for an existing booking
- **THEN** the matching row is marked canceled

### Requirement: Embed identifies the client to the webhook

The embed SHALL prefill the invitee email with the authenticated user's email so the inbound webhook can map the booking back to a profile. When the incoming invitee email does not match any profile, the event SHALL be acknowledged without writing a booking row (no error), and the mapping gap is accepted.

#### Scenario: Email maps to a profile
- **WHEN** `invitee.created` carries an email equal to a profile's email
- **THEN** the booking row is written for that profile

#### Scenario: Email does not map
- **WHEN** `invitee.created` carries an email that matches no profile
- **THEN** the webhook returns success and writes no booking row

