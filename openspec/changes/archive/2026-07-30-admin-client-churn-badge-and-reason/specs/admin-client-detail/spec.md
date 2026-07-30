## ADDED Requirements

### Requirement: Churn badge on the client detail Resumen card

The Resumen tab of the admin client detail card SHALL display a cancellation badge on a subscription block if and only if that subscription is terminal-cancelled, as determined by `isChurned(status)` from `lib/portal/cancellation.ts`.

No other lifecycle state SHALL produce the badge. In particular, a subscription that completed its programme and one that is in its final paid month both carry `cancel_at_period_end = true` and MUST NOT be presented as cancelled.

The badge SHALL be identical regardless of whether the cancellation was voluntary or involuntary.

#### Scenario: Terminal-cancelled subscription
- **WHEN** an admin opens the Resumen tab for a client whose subscription has `status = "canceled"`
- **THEN** the subscription block displays a cancellation badge

#### Scenario: Graduated client is not labelled cancelled
- **WHEN** an admin opens the Resumen tab for a client whose subscription has `status = "completed"`, `completed_at` set and `cancel_at_period_end = true`
- **THEN** no cancellation badge is displayed

#### Scenario: Final paid month is not labelled cancelled
- **WHEN** an admin opens the Resumen tab for a client whose subscription is in its last paid month (`completed_at` set and `cancel_at_period_end = true`, status still active)
- **THEN** no cancellation badge is displayed

#### Scenario: Grace window is not labelled cancelled
- **WHEN** an admin opens the Resumen tab for a client who has cancelled but whose access has not yet ended (`cancel_at_period_end = true`, status `active`/`trialing`/`past_due`, no `completed_at`)
- **THEN** no cancellation badge is displayed

#### Scenario: Involuntary cancellation reads the same
- **WHEN** an admin opens the Resumen tab for a client whose subscription reached `status = "canceled"` through failed payment (survey `source = "involuntary"`)
- **THEN** the same cancellation badge is displayed, with no separate voluntary/involuntary marker

### Requirement: Cancellation reason on the client detail Resumen card

For a subscription that displays the churn badge, the Resumen card SHALL display a "Motivo" row stating why the client left.

The reason text SHALL be produced by `cancellationReasonLabel()` from `lib/portal/cancellation.ts`. The card MUST NOT define its own reason-to-label mapping.

When the survey row carries a free-text detail, that detail SHALL be shown alongside the label. When no survey row exists for the subscription, the row SHALL read `Sin motivo registrado`.

A subscription that does not display the churn badge SHALL NOT display a "Motivo" row.

#### Scenario: Reason with a stored label
- **WHEN** a churned subscription has a survey row with `reason = "no_tengo_tiempo"`
- **THEN** the Motivo row reads "No tengo tiempo"

#### Scenario: Reason carrying free text
- **WHEN** a churned subscription has a survey row with `reason = "otro"` and a non-empty `detail`
- **THEN** the Motivo row shows the "Otro" label together with the stored detail text

#### Scenario: Client declined to give a reason
- **WHEN** a churned subscription has a survey row with `reason = "prefiero_no_decir"`
- **THEN** the Motivo row reads "Prefiero no decir", distinct from the no-row case

#### Scenario: No survey row exists
- **WHEN** a churned subscription has no matching row in `cancellation_surveys`
- **THEN** the Motivo row reads "Sin motivo registrado"

#### Scenario: Unknown reason value
- **WHEN** a churned subscription has a survey row whose `reason` is a value the application's union does not yet contain
- **THEN** the Motivo row shows the raw stored value rather than rendering blank

#### Scenario: Active subscription shows no reason row
- **WHEN** a subscription is not terminal-cancelled
- **THEN** no Motivo row is rendered for it

### Requirement: Cancellation reasons are read per subscription

`getClientDetail` SHALL read cancellation survey rows scoped to the subscription ids it has already loaded for the client, using the RLS-aware Supabase client.

Survey rows whose `subscription_id` is null — orphaned when a subscription row was deleted — SHALL NOT be attributed to any subscription.

#### Scenario: Reason attributed to the right subscription
- **WHEN** a client has two subscriptions and only one of them is churned with a survey row
- **THEN** the reason appears on that subscription's block and on no other

#### Scenario: Orphaned survey row is ignored
- **WHEN** a survey row exists for the client with `subscription_id = null`
- **THEN** it is not shown against any subscription, and the affected subscription falls back to "Sin motivo registrado" if it is churned

#### Scenario: Access is admin-gated
- **WHEN** the survey rows are read
- **THEN** the read goes through the existing admin gate and the RLS-aware client, with no service-role key involved
