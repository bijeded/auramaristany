## ADDED Requirements

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

## MODIFIED Requirements

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
