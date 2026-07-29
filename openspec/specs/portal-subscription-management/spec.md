# portal-subscription-management

## Purpose

Client-facing management of an active subscription from `/portal/settings`: cancelling with an optional exit survey, reactivating during the end-of-period grace window, and system-recorded involuntary (payment-failure) cancellations. Cancellation always takes effect at the end of the already-paid billing period with no refund (all prices are monthly `recurring`). `subscriptions.cancel_at_period_end` is the shared flag, synced from Stripe by the billing webhook.
## Requirements
### Requirement: Client cancels an active subscription with an optional exit survey

The system SHALL allow a client with an `active`, `trialing`, or `past_due` subscription to cancel it from `/portal/settings`. Cancellation SHALL take effect at the end of the already-paid billing period (`current_period_end`) with no refund, by setting `cancel_at_period_end = true` on the Stripe subscription. A survey-first modal SHALL be presented where every field is optional and the client MAY skip it. The client identity SHALL be resolved from `getUser()` on the server; the client-supplied subscription ID SHALL NOT be trusted.

#### Scenario: Cancel with a selected reason
- **WHEN** the client opens the cancel modal, selects a reason, and confirms
- **THEN** the system sets `cancel_at_period_end = true` in Stripe, inserts a `cancellation_surveys` row (`source = 'voluntary'`, the selected `reason`) owned by the client, and shows the grace-window state

#### Scenario: Cancel while skipping the survey
- **WHEN** the client confirms cancellation without selecting any reason
- **THEN** the system still sets `cancel_at_period_end = true` in Stripe and records a `cancellation_surveys` row with `reason = 'otro'` and no detail

#### Scenario: Reason requiring detail
- **WHEN** the client selects "Encontré otra opción" or "Otro" and types free text
- **THEN** the `detail` is validated server-side with zod (max 200 chars) and sanitized before being stored

#### Scenario: Detail exceeds the limit
- **WHEN** the submitted `detail` is longer than 200 characters
- **THEN** the server action rejects the request with a generic error and stores nothing

#### Scenario: No active subscription
- **WHEN** a client without an `active`/`trialing`/`past_due` subscription attempts to cancel
- **THEN** the server action returns an error and makes no Stripe call and inserts no row

#### Scenario: Survey insert never orphans a cancellation
- **WHEN** the Stripe cancellation call fails
- **THEN** no `cancellation_surveys` row is written (Stripe runs first; the survey insert is best-effort only after Stripe succeeds)

### Requirement: Client reactivates during the grace window

The system SHALL allow a client whose subscription has `cancel_at_period_end = true` to reactivate it before `current_period_end`. Reactivation SHALL set `cancel_at_period_end = false` in Stripe and delete the client's most recent voluntary `cancellation_surveys` row for that subscription. It SHALL NOT delete any `pago_fallido` (involuntary) row.

#### Scenario: Reactivate before period end
- **WHEN** a client in the grace window clicks "Reactivar"
- **THEN** the system sets `cancel_at_period_end = false` in Stripe and deletes the latest `source = 'voluntary'` survey row for that subscription, returning to the normal active state

#### Scenario: Reactivation only touches voluntary rows
- **WHEN** reactivation deletes the survey row
- **THEN** the delete is scoped to `source = 'voluntary'` and never removes a `pago_fallido` row

### Requirement: System records involuntary cancellations

When Stripe deletes a subscription because dunning exhausted payment retries, the system SHALL record the cancellation reason automatically without any survey UI. The webhook handler SHALL read `subscription.cancellation_details.reason` and, when it is `payment_failed` or `payment_disputed`, insert a `cancellation_surveys` row with `reason = 'pago_fallido'` and `source = 'involuntary'`. The insert SHALL be idempotent across Stripe event redeliveries.

#### Scenario: Payment failure cancellation
- **WHEN** a `customer.subscription.deleted` event arrives with `cancellation_details.reason` of `payment_failed`
- **THEN** the handler sets the subscription status to `canceled` and inserts a `pago_fallido` involuntary survey row

#### Scenario: Voluntary deletion does not double-log
- **WHEN** a `customer.subscription.deleted` event arrives with `cancellation_details.reason` of `cancellation_requested`
- **THEN** the handler sets the status to `canceled` and inserts no additional survey row (the voluntary row already exists)

#### Scenario: Redelivery does not duplicate
- **WHEN** the same `customer.subscription.deleted` (payment failure) event is redelivered and a `pago_fallido` row already exists for that subscription
- **THEN** the handler inserts no second row

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

