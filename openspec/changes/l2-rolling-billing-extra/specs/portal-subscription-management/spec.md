## MODIFIED Requirements

### Requirement: Settings page surfaces the cancellation controls

The `/portal/settings` page SHALL surface the cancel entry point for eligible subscriptions and, when `cancel_at_period_end = true` on a subscription whose status is `active`, `trialing`, or `past_due`, SHALL display that the plan ends on `current_period_end` along with a "Reactivar" action. The cancel control SHALL appear at the bottom of the settings page, below the "Cerrar sesión" button, styled as a full-width button consistent with the page's other actions. Copy SHALL be warm, first-person, neutral Mexican Spanish.

A fixed-term subscription that is ending also carries `cancel_at_period_end = true`, because completion schedules the Stripe cancellation at period end — so that flag alone no longer identifies the grace window. The page SHALL branch on the **completion signals before that flag**, across both of the moments completion passes through:

- **Scheduled to complete** — `completed_at` is set and the final paid month is still running. The page SHALL say the program is in its last month and that no further charge will be made, and SHALL offer neither "Reactivar" nor "Cancelar mi plan".
- **Completed** — the status is `completed`. The page SHALL show completion messaging and the continue-with-Extra call to action, and SHALL offer neither action.

Offering "Reactivar" in either state would clear the scheduled cancellation in Stripe and bill the client for a month the program does not have; offering "Cancelar mi plan" would invite a client to cancel something already ending.

Hiding a control is presentation, not enforcement. The reactivation server action SHALL itself refuse a subscription carrying `completed_at`, since it is invocable independently of the page.

#### Scenario: Final paid month is not a grace window
- **WHEN** a subscription carries `completed_at` and `cancel_at_period_end = true` while its status is still `active`
- **THEN** the settings page shows the last-month notice and offers neither "Reactivar" nor "Cancelar mi plan"

#### Scenario: Reactivation is refused server-side
- **WHEN** the reactivation action is invoked for a subscription carrying `completed_at`
- **THEN** it is refused and the Stripe subscription's scheduled cancellation is left in place

#### Scenario: Active subscription shows cancel option
- **WHEN** a client with an eligible subscription views the settings page
- **THEN** a "Cancelar mi plan" control is visible below "Cerrar sesión"

#### Scenario: Grace window state
- **WHEN** a subscription whose status is `active`, `trialing`, or `past_due` has `cancel_at_period_end = true`
- **THEN** the settings page shows "Tu plan termina el {fecha}" and a "Reactivar" action instead of the cancel control

#### Scenario: Completed subscription is not a grace window
- **WHEN** a `completed` subscription has `cancel_at_period_end = true`
- **THEN** the settings page shows completion messaging and the continue-with-Extra call to action, and offers neither "Reactivar" nor "Cancelar mi plan"
