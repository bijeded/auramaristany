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

### Requirement: Client rows carry the completion marker

The client list SHALL expose `completed_at` on each client row alongside the `cancel_at_period_end` flag it already carries. Both signals are required: `cancel_at_period_end` alone cannot distinguish a client graduating from a fixed-term program from a client who chose to leave, since both wear that flag while still `active`.

#### Scenario: Fixed-term client in her final month
- **WHEN** a client's subscription is `active` with `completed_at` set and `cancel_at_period_end = true`
- **THEN** the row carries both signals, and the two are distinguishable downstream

#### Scenario: Voluntary cancellation in its grace window
- **WHEN** a client's subscription is `active` with `cancel_at_period_end = true` and `completed_at` null
- **THEN** the row is distinguishable from the fixed-term case above

### Requirement: Filter pills for cohorts that are still active

The client list SHALL present two additional pills in the same exclusive filter group as "Activas", "Vencidas", "Canceladas", "Completadas" and "Sin actividad":

- **"Último mes"** — clients whose subscription is `active` and whose completion is scheduled (`completed_at` set **and** `cancel_at_period_end = true`)
- **"En cancelación"** — clients whose subscription is `active` with `cancel_at_period_end = true` and no `completed_at`

Both cohorts are still `active` and still training, which is precisely why they need their own pills: they are otherwise indistinguishable from "Activas". The labels SHALL NOT reuse "Completadas" or "Canceladas", which denote subscriptions that have already ended. Membership SHALL be determined by the same shared derivation the dashboard uses, not by inspecting the flags inline. Selecting one pill clears the others, re-clicking the active pill clears the filter, and "Limpiar filtros" resets these pills along with the rest.

#### Scenario: "Último mes" shows only scheduled completions
- **WHEN** the admin selects "Último mes"
- **THEN** the list shows only clients whose `active` subscription has both `completed_at` and `cancel_at_period_end = true`

#### Scenario: "En cancelación" shows only voluntary departures
- **WHEN** the admin selects "En cancelación"
- **THEN** the list shows only clients whose `active` subscription has `cancel_at_period_end = true` and no `completed_at`

#### Scenario: Already-ended subscriptions are excluded from both
- **WHEN** a client's subscription is `completed` or `canceled`
- **THEN** she appears under "Completadas" or "Canceladas" respectively, and in neither new pill

#### Scenario: A stale completion marker does not qualify
- **WHEN** a client's `active` subscription has `completed_at` set but `cancel_at_period_end = false`
- **THEN** she appears in neither new pill, because nothing is scheduled to end

#### Scenario: Pills are exclusive with the existing group
- **WHEN** "Activas" is selected and the admin clicks "En cancelación"
- **THEN** "Activas" is deselected and only "En cancelación" is active

#### Scenario: Clearing filters resets the new pills
- **WHEN** "Último mes" is selected and the admin clicks "Limpiar filtros"
- **THEN** the pill is cleared and all clients matching the remaining filters are shown

#### Scenario: Reached from the dashboard
- **WHEN** the admin clicks through from the dashboard's "Terminan (próx. 7 días)" or "Cancelaciones (próx. 7 días)" card
- **THEN** the client list opens with the corresponding pill already active

### Requirement: The next-charge cell keeps ignoring the completion marker

`nextChargeCell` SHALL continue to derive whether a subscription bills again from `status` and `cancel_at_period_end` only, and SHALL NOT consult `completed_at` even though that column is now available on the row. The case `completed_at` would bring is already covered by `cancel_at_period_end`, and on its own the marker proves nothing — an older row can carry it with no cancellation scheduled in Stripe.

#### Scenario: Stale completion marker does not suppress the charge
- **WHEN** a subscription is `active` with `completed_at` set and `cancel_at_period_end = false`
- **THEN** the cell still announces "Próximo cobro" with its date and amount

#### Scenario: Scheduled ending shows access, not a charge
- **WHEN** a subscription is `active` with `cancel_at_period_end = true`
- **THEN** the cell shows "Acceso hasta" with the date and no amount, as before
