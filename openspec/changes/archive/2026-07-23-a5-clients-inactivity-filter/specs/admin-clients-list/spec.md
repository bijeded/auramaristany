## ADDED Requirements

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

The client list SHALL present a "Sin actividad" pill in the same exclusive filter group as "Activas", "Vencidas", and "Canceladas"; selecting one clears the others, and re-clicking the active pill clears the filter. When "Sin actividad" is selected, the list SHALL show only clients whose subscription status is `active` or `trialing` AND who are inactive per the 10-day threshold. The "Limpiar filtros" reset SHALL clear this pill along with the other filters.

#### Scenario: Selecting the pill filters to quiet active clients
- **WHEN** the admin selects "Sin actividad"
- **THEN** the list shows only clients with an active or trialing subscription whose last activity is ≥10 days ago (or who never logged)

#### Scenario: Canceled inactive client is excluded
- **WHEN** a client's subscription is canceled and they have no recent activity
- **AND** the "Sin actividad" filter is selected
- **THEN** that client is not shown

#### Scenario: Pill is exclusive with status pills
- **WHEN** "Activas" is selected and the admin clicks "Sin actividad"
- **THEN** "Activas" is deselected and only "Sin actividad" is active

#### Scenario: Clearing filters resets the pill
- **WHEN** "Sin actividad" is selected and the admin clicks "Limpiar filtros"
- **THEN** the pill is cleared and all clients matching the remaining filters are shown
