## Why

Today a client can only cancel a subscription through Stripe's hosted Customer Portal — there is no in-app path, and we capture no reason for the churn. Aura needs cancellation to live inside the account UI (warm, Spanish, on-brand) and to learn *why* clients leave so she can improve retention. This is the last self-contained medium item before the launch close-out.

## What Changes

- Add an in-app **cancel** flow to `/portal/settings`: a survey-first modal (all fields optional) → server action that inserts a cancellation-survey row and sets `cancel_at_period_end = true` in Stripe. Access continues until `current_period_end` (monthly billing → **no refunds**).
- Add a **reactivate** action for the grace window (`cancel_at_period_end = true`): flips it back to `false` and deletes the client's just-submitted voluntary survey row.
- Capture **involuntary** cancellations: when Stripe's dunning exhausts retries and the subscription is deleted, auto-log a `pago_fallido` reason (read from `subscription.cancellation_details.reason`) — no UI, no survey.
- New **`cancellation_surveys`** table (migration 011) storing `profile_id`, `subscription_id`, `reason`, optional `detail`, `source`, `created_at`. Free-text `detail` (for "Encontré otra opción" / "Otro") validated with zod (≤200) + sanitized (INP-5 pattern).
- Extend `SubscriptionCard` with a **grace-window state** ("Tu plan termina el {fecha}" + Reactivar) and the cancel entry point.

## Capabilities

### New Capabilities
- `portal-subscription-management`: client-facing cancellation of an active subscription with an optional exit survey, reactivation during the end-of-period grace window, and system-recorded involuntary (payment-failure) cancellations.

### Modified Capabilities
<!-- None: no existing spec covers subscription cancellation; the webhook sync behavior is implementation detail, not a spec-level requirement change. -->

## Impact

- **DB:** new migration `011_cancellation_surveys.sql` (table + RLS: owner inserts/reads own rows; service-role writes involuntary rows) + `lib/supabase/types.ts` (hand-maintained, add table with `Relationships: []`).
- **Server actions:** `lib/portal/settingsActions.ts` — new `cancelSubscription` and `reactivateSubscription` (identity from `getUser()`; Stripe API call; zod + sanitize-html on `detail`).
- **Webhook:** `lib/webhooks/stripe-handlers.ts` — `handleSubscriptionDeleted` reads `cancellation_details.reason` and inserts `pago_fallido` on `payment_failure`/`payment_disputed`.
- **UI:** `components/portal/settings/SubscriptionCard.tsx` (grace state) + new cancel modal component; `lib/portal/account-queries.ts` (expose `cancel_at_period_end` on `AccountSubscription`).
- **Pure logic + tests:** cancellation reason enum/labels + grace-window helper (AAA tests).
- **Stripe:** uses existing SDK; `cancel_at_period_end` already synced by `handleSubscriptionUpdated`. No apiVersion change.
