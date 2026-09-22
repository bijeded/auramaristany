# Spec Delta

## ADDED Requirements

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
