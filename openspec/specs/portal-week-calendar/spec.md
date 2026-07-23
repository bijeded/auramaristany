# portal-week-calendar Specification

## Purpose
TBD - created by archiving change a12-portal-week-calendar. Update Purpose after archive.
## Requirements
### Requirement: Week calendar window
The system SHALL compute the calendar window as up to 8 consecutive days starting at today (today plus the next 7 days), using the same UTC date arithmetic and `DEV_DATE` override as `/portal/today`. Days whose real date is on or after the subscription's `current_period_end` MUST be excluded. Days beyond week 4 of the period but before `current_period_end` MUST be clamped to week 4.

#### Scenario: Full window mid-period
- **WHEN** a client with an active subscription opens the calendar 10 days into their billing period
- **THEN** 8 rows are shown: today plus the next 7 days

#### Scenario: Window cut at renewal
- **WHEN** the client's `current_period_end` falls 3 days from today
- **THEN** only today plus the 2 future days before `current_period_end` are shown (3 rows), and no day of the next period appears

#### Scenario: Days 29–31 repeat week 4
- **WHEN** a window day falls after day 28 of the period but before `current_period_end`
- **THEN** that day's content is resolved with `week_number = 4` (same clamp as `/portal/today`)

### Requirement: Read-only titles with no future navigation
The calendar SHALL display, per row, a capitalized Spanish date label and the day's title only. Future rows MUST NOT link anywhere nor expose day ids. Today's row MUST be visually highlighted and link to `/portal/today`. Day blocks/exercise content MUST NOT be fetched.

#### Scenario: Today row links to Hoy
- **WHEN** the client taps the first (today) row
- **THEN** they navigate to `/portal/today`

#### Scenario: Future rows are inert
- **WHEN** the client taps any future row
- **THEN** nothing happens (no link, no navigation affordance)

### Requirement: Rest days and unpublished days
Days with no `program_day` row visible to the client for the resolved (series, week, day) SHALL render as rest days ("Descanso"). The calendar reads through the RLS-aware client; the `program_days` policy (`published = true or is_admin()`) therefore hides unpublished days, which render as "Descanso" like rest days. The query SHALL NOT add its own `published` filter nor bypass RLS.

#### Scenario: Rest day rendering
- **WHEN** a window day has no `program_day` row
- **THEN** the row shows the date with a "Descanso" label

#### Scenario: Unpublished day hidden by RLS
- **WHEN** a window day exists but has `published = false`
- **THEN** the row renders as "Descanso" for the client (RLS filters the row); no service-role read is used

### Requirement: Access gating
The calendar SHALL be served only to authenticated clients whose subscription status grants portal access (`active`/`trialing`/`past_due` via the existing access path), reading data with the RLS-aware client and identity from `getUser()`. Series selection MUST use `months_elapsed` (never dates).

#### Scenario: No accessible subscription
- **WHEN** a user without an access-granting subscription requests `/portal/semana`
- **THEN** they are handled like other portal routes (redirected per middleware / sin-suscripcion flow), and no calendar data is returned

### Requirement: Navigation tab "Semana"
The portal bottom nav SHALL include a "Semana" tab (icon `CalendarDays`) routed to `/portal/semana`, placed between "Hoy" and "Pilares"; the "Hoy" tab icon SHALL change to `Sun`; the "Configuración" tab SHALL be renamed "Perfil" with icon `User` (route `/portal/settings` unchanged). If 6 tabs visually break at 375px width, "Perfil" moves to the portal top bar (right-aligned) with the date centered.

#### Scenario: Tab present and ordered
- **WHEN** the portal nav renders for a client with Pilares enabled
- **THEN** tabs appear in order: Hoy (Sun) · Semana (CalendarDays) · Pilares · Historial · Mensajes · Perfil (User)

#### Scenario: Active state
- **WHEN** the client is on `/portal/semana`
- **THEN** the "Semana" tab renders in the active (lavender) state

