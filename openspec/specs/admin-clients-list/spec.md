# admin-clients-list

## Purpose

The admin client-list view (`/admin/clients`) — its filter pills (subscription status, ending cohort, and activity), the per-client last-activity signal, and how client inactivity is defined and computed. Two cohorts are still `active` yet on their way out — finishing a fixed term, or leaving voluntarily — and telling them apart needs two signals, not one.

## Requirements

### Requirement: Last activity signal per client

The client list SHALL expose, for each client row, a `last_activity_date` equal to the most recent `progress_logs.log_date` for that client, or `null` when the client has no progress logs. This signal SHALL be computed server-side and reused by downstream automation (A4) rather than being recomputed ad hoc.

#### Scenario: Client with progress logs
- **WHEN** a client has progress logs on 2026-07-01 and 2026-07-10
- **THEN** the client's `last_activity_date` is `2026-07-10`

#### Scenario: Client that has never logged
- **WHEN** a client has no rows in `progress_logs`
- **THEN** the client's `last_activity_date` is `null`

### Requirement: Inactivity determination

The system SHALL provide a pure `isInactive(lastActivityDate, now, thresholdDays)` helper that determines inactivity relative to a caller-supplied reference date `now`, never the browser clock. A client SHALL be considered inactive when the number of whole days between `last_activity_date` and `now` is greater than or equal to `thresholdDays`, or when `last_activity_date` is `null`. The default threshold for the "Sin actividad" filter SHALL be 10 days.

#### Scenario: Activity older than threshold
- **WHEN** `last_activity_date` is 11 days before `now` and `thresholdDays` is 10
- **THEN** the client is inactive

#### Scenario: Activity exactly at threshold
- **WHEN** `last_activity_date` is exactly 10 days before `now` and `thresholdDays` is 10
- **THEN** the client is inactive

#### Scenario: Recent activity within threshold
- **WHEN** `last_activity_date` is 9 days before `now` and `thresholdDays` is 10
- **THEN** the client is not inactive

#### Scenario: Never logged
- **WHEN** `last_activity_date` is `null`
- **THEN** the client is inactive regardless of `now`

### Requirement: "Sin actividad" filter pill

The client list SHALL present "Sin actividad" as one option of the single status filter control described in "Status filters are a single select"; selecting it clears any other status selection. When "Sin actividad" is selected, the list SHALL show only clients whose subscription status is `active` or `trialing` AND who are inactive per the 10-day threshold. The "Limpiar filtros" reset SHALL clear this selection along with the other filters.

Which clients match is unchanged; only the control that selects the filter has changed.

#### Scenario: Selecting the pill filters to quiet active clients
- **WHEN** the admin selects "Sin actividad" in the status filter
- **THEN** the list shows only clients with an active or trialing subscription whose last activity is ≥10 days ago (or who never logged)

#### Scenario: Canceled inactive client is excluded
- **WHEN** a client's subscription is canceled and they have no recent activity
- **AND** the "Sin actividad" filter is selected
- **THEN** that client is not shown

#### Scenario: Pill is exclusive with status pills
- **WHEN** "Activas" is selected and the admin selects "Sin actividad"
- **THEN** the status filter holds "Sin actividad" only, and "Activas" is no longer applied

#### Scenario: Clearing filters resets the pill
- **WHEN** "Sin actividad" is selected and the admin clicks "Limpiar filtros"
- **THEN** the status filter returns to its unfiltered value and all clients matching the remaining filters are shown

### Requirement: Client rows carry the completion marker

The client list SHALL expose `completed_at` on each client row alongside the `cancel_at_period_end` flag it already carries. Both signals are required: `cancel_at_period_end` alone cannot distinguish a client graduating from a fixed-term program from a client who chose to leave, since both wear that flag while still `active`.

#### Scenario: Fixed-term client in her final month
- **WHEN** a client's subscription is `active` with `completed_at` set and `cancel_at_period_end = true`
- **THEN** the row carries both signals, and the two are distinguishable downstream

#### Scenario: Voluntary cancellation in its grace window
- **WHEN** a client's subscription is `active` with `cancel_at_period_end = true` and `completed_at` null
- **THEN** the row is distinguishable from the fixed-term case above

### Requirement: Filter pills for cohorts that are still active

The client list SHALL offer two additional options in the single status filter control, alongside "Activas", "Vencidas", "Canceladas", "Completadas" and "Sin actividad":

- **"Último mes"** — clients whose subscription is `active` and whose completion is scheduled (`completed_at` set **and** `cancel_at_period_end = true`)
- **"En cancelación"** — clients whose subscription is `active` with `cancel_at_period_end = true` and no `completed_at`

Both cohorts are still `active` and still training, which is precisely why they need their own options: they are otherwise indistinguishable from "Activas". The labels SHALL NOT reuse "Completadas" or "Canceladas", which denote subscriptions that have already ended. Membership SHALL be determined by the same shared derivation the dashboard uses, not by inspecting the flags inline. Selecting one option clears any other, and "Limpiar filtros" resets the selection along with the rest.

#### Scenario: "Último mes" shows only scheduled completions
- **WHEN** the admin selects "Último mes"
- **THEN** the list shows only clients whose `active` subscription has both `completed_at` and `cancel_at_period_end = true`

#### Scenario: "En cancelación" shows only voluntary departures
- **WHEN** the admin selects "En cancelación"
- **THEN** the list shows only clients whose `active` subscription has `cancel_at_period_end = true` and no `completed_at`

#### Scenario: Already-ended subscriptions are excluded from both
- **WHEN** a client's subscription is `completed` or `canceled`
- **THEN** she appears under "Completadas" or "Canceladas" respectively, and in neither cohort option

#### Scenario: A stale completion marker does not qualify
- **WHEN** a client's `active` subscription has `completed_at` set but `cancel_at_period_end = false`
- **THEN** she appears in neither cohort option, because nothing is scheduled to end

#### Scenario: Pills are exclusive with the existing group
- **WHEN** "Activas" is selected and the admin selects "En cancelación"
- **THEN** the status filter holds "En cancelación" only

#### Scenario: Clearing filters resets the new pills
- **WHEN** "Último mes" is selected and the admin clicks "Limpiar filtros"
- **THEN** the status filter returns to its unfiltered value and all clients matching the remaining filters are shown

#### Scenario: Reached from the dashboard
- **WHEN** the admin clicks through from the dashboard's "Terminan (próx. 7 días)" or "Cancelaciones (próx. 7 días)" card
- **THEN** the client list opens with the corresponding cohort already selected in the status filter, and that cohort's label is visible on the control

### Requirement: The next-charge cell keeps ignoring the completion marker

`nextChargeCell` SHALL continue to derive whether a subscription bills again from `status` and `cancel_at_period_end` only, and SHALL NOT consult `completed_at` even though that column is now available on the row. The case `completed_at` would bring is already covered by `cancel_at_period_end`, and on its own the marker proves nothing — an older row can carry it with no cancellation scheduled in Stripe.

#### Scenario: Stale completion marker does not suppress the charge
- **WHEN** a subscription is `active` with `completed_at` set and `cancel_at_period_end = false`
- **THEN** the cell still announces "Próximo cobro" with its date and amount

#### Scenario: Scheduled ending shows access, not a charge
- **WHEN** a subscription is `active` with `cancel_at_period_end = true`
- **THEN** the cell shows "Acceso hasta" with the date and no amount, as before

### Requirement: Status filters are a single select

The client list SHALL present its status and cohort filters as a **single select control**, not as a group of pills, so that the filter row fits on one line regardless of how many programs exist. Program filters SHALL remain pills.

The select's options SHALL be generated from the exported `STATUS_FILTERS` constant and nothing else, plus exactly one additional option representing the absence of a filter (the `null` sentinel). No status value may be written as a literal option beside the generated list: a hand-written option is a second copy of the filter table and permits the UI to offer a value the rest of the system does not recognise.

Because a select has no toggle-off gesture, the unfiltered option SHALL be how the admin clears the status filter; the previous "re-click the active pill to clear" behaviour no longer applies.

#### Scenario: Filter row occupies one line
- **WHEN** the client list renders with the current set of programs
- **THEN** the program pills and the status select sit on a single row, with no wrapped second row of filters

#### Scenario: Options come from the shared constant
- **WHEN** the status select is rendered
- **THEN** it offers exactly one option per entry of `STATUS_FILTERS`, plus one unfiltered option, and no others

#### Scenario: A new status filter appears without touching the component
- **WHEN** an entry is added to `STATUS_FILTERS`
- **THEN** the select offers it without any change to the rendering component

#### Scenario: Selecting the unfiltered option clears the filter
- **WHEN** a status filter is selected and the admin chooses the unfiltered option
- **THEN** no status filter is applied and the list shows all clients matching the remaining filters

#### Scenario: Deep link preselects and displays the cohort
- **WHEN** the client list is opened with a `status` query parameter naming a valid filter
- **THEN** the select is preselected to that filter and displays its label, so the admin can see why the list is filtered

#### Scenario: Invalid deep link leaves the filter unset
- **WHEN** the client list is opened with a `status` query parameter that names no known filter
- **THEN** the select shows the unfiltered option and the list is not filtered by status

### Requirement: "Último acceso" column

The client list SHALL render an "Último acceso" column positioned after the "Estado" column and before the row's delete-action column. Each cell SHALL present the client's `last_activity_date` as two lines: a relative recency label on the first line and the absolute date on the second. When `last_activity_date` is `null` the cell SHALL read "Sin registros" — the client has verifiably never logged progress, which is known information and MUST NOT be rendered as an em-dash or other missing-data placeholder.

The column SHALL derive nothing new: it renders the `last_activity_date` already present on every client row and MUST NOT trigger an additional query.

#### Scenario: Client with recent activity
- **WHEN** a client's `last_activity_date` is 3 days before the reference date `now`
- **THEN** the cell shows "hace 3 días" above the absolute date of that activity

#### Scenario: Client that has never logged
- **WHEN** a client's `last_activity_date` is `null`
- **THEN** the cell shows "Sin registros" and no date line

#### Scenario: Column position
- **WHEN** the table renders
- **THEN** "Último acceso" appears immediately after "Estado" and immediately before the delete-action column

### Requirement: Relative day labelling

The system SHALL provide a pure `relativeDayLabel(iso, now)` helper that renders a date's recency relative to a caller-supplied reference date `now`, never the browser clock, in neutral Mexican Spanish. It SHALL render "hoy" for the reference date itself, "ayer" for the preceding day, and "hace N días" for anything older. It SHALL NOT emit the ungrammatical "hace 1 días".

#### Scenario: Same day
- **WHEN** `iso` equals `now`
- **THEN** the label is "hoy"

#### Scenario: Previous day
- **WHEN** `iso` is exactly 1 day before `now`
- **THEN** the label is "ayer", never "hace 1 días"

#### Scenario: Older date
- **WHEN** `iso` is 21 days before `now`
- **THEN** the label is "hace 21 días"

### Requirement: Inactive clients are marked in the column

The "Último acceso" cell SHALL be visually distinguished when the client is inactive, where inactivity is determined by the existing shared `isInactive(lastActivityDate, now, INACTIVITY_THRESHOLD_DAYS)` derivation — the same one behind the "Sin actividad" filter and the A4 inactivity automation. The threshold MUST NOT be re-expressed, re-derived, or duplicated at the rendering site.

The distinguishing colour SHALL come from a design token defined in `app/globals.css`; a literal hex value in the component is not acceptable, and a missing token SHALL be added to the token set rather than worked around.

#### Scenario: Quiet client is marked
- **WHEN** a client's last activity is 21 days before `now` and the threshold is 10 days
- **THEN** the cell is rendered in the marked style

#### Scenario: Recently active client is not marked
- **WHEN** a client's last activity is 3 days before `now` and the threshold is 10 days
- **THEN** the cell is rendered in the ordinary style

#### Scenario: Never-logged client is marked
- **WHEN** a client's `last_activity_date` is `null`
- **THEN** the cell shows "Sin registros" in the marked style, consistent with `isInactive` treating `null` as inactive

### Requirement: "Último acceso" is exported

The CSV produced by the client list SHALL include an "Último acceso" column, so that every column visible in the table is present in the export. The exported value SHALL be the raw `last_activity_date`, and SHALL be empty when it is `null`.

#### Scenario: Export includes the column
- **WHEN** the admin exports the filtered client list
- **THEN** the CSV header includes "Último acceso" and each row carries that client's last activity date

#### Scenario: Never-logged client exports empty
- **WHEN** an exported client has `last_activity_date` of `null`
- **THEN** that client's "Último acceso" cell in the CSV is empty

### Requirement: Program filter pills expose their pressed state

Each program filter pill on the client list SHALL expose whether it is the active filter to assistive technology, not only through visual styling. Exactly one program pill SHALL be reported as pressed at any time.

#### Scenario: Default state
- **WHEN** the client list first renders
- **THEN** the "Todas" pill is reported as pressed and every other program pill as not pressed

#### Scenario: Selecting a program
- **WHEN** the admin selects a program pill
- **THEN** that pill is reported as pressed and the previously active one as not pressed

### Requirement: Client-list filters are reflected in the URL

The status filter and the program filter on the client list SHALL be represented in the page URL as the `status` and `program` query parameters, so that the URL always describes the filters currently applied. Changing either filter SHALL update the URL without adding a browser history entry. Choosing the unfiltered value of a filter ("Todos los estados", or the "Todas" program pill) SHALL remove that filter's parameter from the URL. The search text and the page number are not part of the URL.

#### Scenario: Selecting a status updates the URL
- **WHEN** the admin selects "Activas" in the status filter
- **THEN** the URL carries `status=Activas` and the list shows only active clients

#### Scenario: Selecting a program updates the URL
- **WHEN** the admin selects a program pill while `status=Activas` is applied
- **THEN** the URL carries `program=<that program's name>` and still carries `status=Activas`

#### Scenario: Clearing a filter removes its parameter
- **WHEN** `status=Activas` and a program are applied and the admin chooses "Todos los estados"
- **THEN** the URL no longer carries a `status` parameter and the `program` parameter is kept

#### Scenario: Filter changes do not pile up history
- **WHEN** the admin opens the client list, changes the status filter three times, and presses the browser's back button
- **THEN** the browser returns to the page visited before the client list, not to an earlier filter value

#### Scenario: Limpiar filtros clears the URL
- **WHEN** both filters are applied, no client matches, and the admin clicks "Limpiar filtros"
- **THEN** neither `status` nor `program` remains in the URL and all clients are shown

#### Scenario: Copied URL reproduces the view
- **WHEN** the admin copies the URL of a filtered client list and opens it in a new tab
- **THEN** the same status and program filters are applied and shown on their controls

### Requirement: Client-list filters follow URL changes while mounted

When the `status` or `program` query parameter changes while the client list is already displayed — a link to another filtered client-list URL, or browser back/forward — the list SHALL apply the new values, and their controls SHALL display them, without a full page reload. When the applied filters change, the list SHALL return to its first page.

#### Scenario: Soft navigation between two filtered URLs
- **WHEN** the client list is showing `status=Último mes` and the admin navigates in-app to `/admin/clients?status=En cancelación`
- **THEN** the status select shows "En cancelación" and the list shows only that cohort

#### Scenario: Filter change resets pagination
- **WHEN** the admin is on page 2 of the list and the status filter changes
- **THEN** the list shows page 1 of the newly filtered results

### Requirement: Invalid program parameter leaves the program filter unset

A `program` query parameter that names no program present in the client list SHALL be ignored: the "Todas" pill SHALL be the one reported as pressed and the list SHALL NOT be filtered by program. This mirrors the existing handling of an invalid `status` parameter.

#### Scenario: Unknown program
- **WHEN** the client list is opened with `program=NoExiste`
- **THEN** "Todas" is pressed and clients of every program are shown

### Requirement: Filter options for trialing, paused, incomplete and expired subscriptions

The client list SHALL offer four additional options in the single status filter control, listed after the existing ones:

- **"En prueba"** — clients whose subscription status is `trialing`
- **"Pausadas"** — clients whose subscription status is `paused`
- **"Incompletas"** — clients whose subscription status is `incomplete`
- **"Expiradas"** — clients whose subscription status is `incomplete_expired`

Each label SHALL read as the badge its rows already carry: the plural of "Pausada", "Incompleta" and "Expirada", and "En prueba" for "Prueba", which has no plural form. Membership SHALL be decided by the subscription status alone.

The existing options SHALL keep their membership exactly:
- `trialing` SHALL NOT be added to "Activas", and it stays eligible for "Sin actividad" as before.
- `incomplete_expired` SHALL NOT be counted under "Canceladas".
- `paused` and `incomplete` SHALL NOT be counted under "Vencidas" or "Sin actividad".

Selecting one of the new options clears any other status selection, and "Limpiar filtros" resets it along with the rest. A `status` query parameter naming one of them SHALL preselect it, exactly as it does for the existing options.

With these four options, every value the database accepts for a subscription status SHALL be matched by at least one status filter option regardless of the client's activity. No client is reachable only by clearing the filter.

#### Scenario: "En prueba" shows only trialing subscriptions
- **WHEN** the admin selects "En prueba"
- **THEN** the list shows only clients whose subscription status is `trialing`, whether or not they have recent activity

#### Scenario: "Pausadas" shows only paused subscriptions
- **WHEN** the admin selects "Pausadas"
- **THEN** the list shows only clients whose subscription status is `paused`

#### Scenario: "Incompletas" shows only incomplete subscriptions
- **WHEN** the admin selects "Incompletas"
- **THEN** the list shows only clients whose subscription status is `incomplete`, and no client whose status is `incomplete_expired`

#### Scenario: "Expiradas" shows only expired checkouts
- **WHEN** the admin selects "Expiradas"
- **THEN** the list shows only clients whose subscription status is `incomplete_expired`

#### Scenario: Existing options keep their membership
- **WHEN** a client's subscription status is `paused`, `incomplete` or `incomplete_expired`
- **THEN** the client appears under no option other than the one named for that status

#### Scenario: A quiet trialing client still appears under "Sin actividad"
- **WHEN** a client's subscription is `trialing` and the client has been inactive for at least the inactivity threshold
- **THEN** the client appears under both "En prueba" and "Sin actividad", and not under "Activas"

#### Scenario: Every accepted status is reachable
- **WHEN** a client with recent activity has a subscription in any status the database accepts
- **THEN** at least one status filter option lists that client

#### Scenario: Deep link preselects a new option
- **WHEN** the client list is opened with `status=Pausadas`
- **THEN** the select shows "Pausadas" and the list shows only paused subscriptions

#### Scenario: Selecting a new option replaces the previous one
- **WHEN** "Activas" is selected and the admin selects "Expiradas"
- **THEN** the status filter holds "Expiradas" only
