# Spec Delta

## MODIFIED Requirements

### Requirement: Client cancels an active subscription with an optional exit survey

The system SHALL allow a client with an `active`, `trialing`, or `past_due` subscription to cancel it from `/portal/settings`. Cancellation SHALL take effect at the end of the already-paid billing period (`current_period_end`) with no refund, by setting `cancel_at_period_end = true` on the Stripe subscription. A survey-first modal SHALL be presented where every field is optional and the client MAY skip it. The client identity SHALL be resolved from `getUser()` on the server; the client-supplied subscription ID SHALL NOT be trusted.

Declining to answer SHALL be recorded as its own reason, `prefiero_no_decir`, and SHALL NOT be folded into `otro`. The two describe opposite situations — a reason the list does not cover, versus a client who chose not to give one — and they call for opposite responses from Aura. Because the survey feeds the admin's "Razones de cancelación" chart, conflating them puts two populations in one bar with no way to separate them afterwards.

Declining SHALL be expressed only by confirming without selecting a reason. "Prefiero no decir" SHALL NOT be offered as a radio option, and the server action SHALL NOT accept `prefiero_no_decir` as a client-submitted reason; the server alone assigns it when no reason is sent.

Every option in the modal's radio list SHALL come from `CANCELLATION_REASON_OPTIONS`. No option may be written directly into the component: a hand-maintained second list next to the real one is the same copied-table defect as two label maps, and it is what let the modal offer a choice the database could not store.

`prefiero_no_decir` and `pago_fallido` SHALL NOT be client-selectable; `prefiero_no_decir` is server-assigned on skip, `pago_fallido` is system-only.

#### Scenario: Cancel with a selected reason
- **WHEN** the client opens the cancel modal, selects a reason, and confirms
- **THEN** the system sets `cancel_at_period_end = true` in Stripe, inserts a `cancellation_surveys` row (`source = 'voluntary'`, the selected `reason`) owned by the client, and shows the grace-window state

#### Scenario: Cancel while skipping the survey
- **WHEN** the client confirms cancellation without selecting any reason
- **THEN** the system still sets `cancel_at_period_end = true` in Stripe and records a `cancellation_surveys` row with `reason = 'prefiero_no_decir'` and no detail, distinguishable from a row stored as `otro`

#### Scenario: Client explicitly declines to give a reason
- **WHEN** the client confirms without selecting any option (the only way to decline now that "Prefiero no decir" is not a radio)
- **THEN** the row is stored with `reason = 'prefiero_no_decir'`, and it is distinguishable from a row stored as `otro`

#### Scenario: Declining to answer never asks for detail
- **WHEN** the client has not selected a reason
- **THEN** no free-text field is shown, and the stored `prefiero_no_decir` row has no `detail`

#### Scenario: The modal does not offer "Prefiero no decir"
- **WHEN** the cancel modal renders its radio list
- **THEN** the options are, in order, "Precio muy caro", "No tengo tiempo", "No logré el objetivo", "No veo resultados", "Encontré otra opción", "Otro" — and no "Prefiero no decir"

#### Scenario: Client-submitted prefiero_no_decir is rejected
- **WHEN** the cancel server action receives `reason = "prefiero_no_decir"` from the client
- **THEN** it returns a generic error, makes no Stripe call, and inserts no row

#### Scenario: The modal offers exactly the storable reasons
- **WHEN** the cancel modal renders its radio list
- **THEN** every option shown comes from `CANCELLATION_REASON_OPTIONS`, and every option shown is a value the database `CHECK` accepts

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

#### Scenario: A reason the database cannot store is never silently dropped
- **WHEN** the application offers a reason whose value is absent from the `cancellation_surveys.reason` `CHECK`
- **THEN** the insert is rejected and the error is swallowed by design (the cancellation itself already succeeded), so the survey row is lost with nothing visible to the client or to Aura — which is why the migration must be applied and verified before the code that names the new value is deployed
