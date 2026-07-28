## MODIFIED Requirements

### Requirement: Settings page surfaces the cancellation controls

The `/portal/settings` page SHALL surface the cancel entry point for eligible subscriptions and, when `cancel_at_period_end = true` on a subscription whose status is `active`, `trialing`, or `past_due`, SHALL display that the plan ends on `current_period_end` along with a "Reactivar" action. The cancel control SHALL appear at the bottom of the settings page, below the "Cerrar sesión" button, styled as a full-width button consistent with the page's other actions. Copy SHALL be warm, first-person, neutral Mexican Spanish.

A `completed` subscription also carries `cancel_at_period_end = true`, because completion schedules the Stripe cancellation at period end. The page SHALL therefore branch on **status before that flag**: a `completed` subscription SHALL show completion messaging and the continue-with-Extra call to action, and SHALL offer neither "Reactivar" nor "Cancelar mi plan". Offering "Reactivar" on a finished program would resume billing against content that has ended; offering "Cancelar mi plan" would invite a client to cancel something already over.

#### Scenario: Active subscription shows cancel option
- **WHEN** a client with an eligible subscription views the settings page
- **THEN** a "Cancelar mi plan" control is visible below "Cerrar sesión"

#### Scenario: Grace window state
- **WHEN** a subscription whose status is `active`, `trialing`, or `past_due` has `cancel_at_period_end = true`
- **THEN** the settings page shows "Tu plan termina el {fecha}" and a "Reactivar" action instead of the cancel control

#### Scenario: Completed subscription is not a grace window
- **WHEN** a `completed` subscription has `cancel_at_period_end = true`
- **THEN** the settings page shows completion messaging and the continue-with-Extra call to action, and offers neither "Reactivar" nor "Cancelar mi plan"
