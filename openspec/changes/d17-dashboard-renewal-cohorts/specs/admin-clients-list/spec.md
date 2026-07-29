## ADDED Requirements

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
