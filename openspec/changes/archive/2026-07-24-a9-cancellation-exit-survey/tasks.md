## 1. Database

- [x] 1.1 Write `supabase/migrations/011_cancellation_surveys.sql`: table (`id`, `profile_id` FK profiles, `subscription_id` FK subscriptions nullable, `reason` text + CHECK enum, `detail` text nullable, `source` text CHECK `voluntary|involuntary`, `created_at` timestamptz default now()); indexes on `profile_id` and `subscription_id`.
- [x] 1.2 Add RLS policies: owner (`profile_id = auth.uid()`) may `insert` and `select` own rows; owner may `delete` own `source='voluntary'` rows (for reactivation); no client `update`. Involuntary insert path runs under service-role.
- [x] 1.3 Apply the migration via Supabase Management API (single line) and verify the table + policies exist.
- [x] 1.4 Update `lib/supabase/types.ts` by hand: add `cancellation_surveys` (Row/Insert/Update + `Relationships: []`).

## 2. Pure logic (TDD)

- [x] 2.1 Add cancellation reason enum + `cancellationReasonLabel(reason)` (Spanish labels) with AAA tests; exclude `pago_fallido` from the UI-facing option list.
- [x] 2.2 Add a grace-window helper deriving "plan ends on {date}" / cancel-eligible state from `status` + `cancel_at_period_end` + `current_period_end`, with AAA tests.

## 3. Queries

- [x] 3.1 Expose `cancel_at_period_end` on `AccountSubscription` in `lib/portal/account-queries.ts`.

## 4. Server actions

- [x] 4.1 `cancelSubscription({ reason?, detail? })` in `lib/portal/settingsActions.ts`: identity from `getUser()`; resolve the subscription server-side; guard status ∈ active/trialing/past_due; zod-validate `reason` + `detail` (≤200) and `sanitize-html` the detail; insert `cancellation_surveys` row (`source='voluntary'`); call Stripe `subscriptions.update(id, { cancel_at_period_end: true })`; revalidate `/portal/settings`.
- [x] 4.2 `reactivateSubscription()`: identity from `getUser()`; resolve sub; call Stripe `subscriptions.update(id, { cancel_at_period_end: false })`; delete the latest `source='voluntary'` survey row for that subscription; revalidate.
- [x] 4.3 Generic error handling (`logAndGeneric` pattern) — never leak Postgres/Stripe errors to the client.

## 5. Webhook (involuntary)

- [x] 5.1 In `handleSubscriptionDeleted` (`lib/webhooks/stripe-handlers.ts`): read `subscription.cancellation_details.reason`; on `payment_failed`/`payment_disputed` insert a `pago_fallido` row (`source='involuntary'`) under service-role; `cancellation_requested` → no extra row. Keep existing status→canceled + ended email.

## 6. UI

- [x] 6.1 New cancel modal component (survey-first, all optional, "omitir" path; free-text input for `encontre_otra_opcion`/`otro`); brand tokens, ≥44px tap targets, warm first-person Spanish.
- [x] 6.2 Extend `components/portal/settings/SubscriptionCard.tsx`: cancel entry point for eligible subs; grace-window state ("Tu plan termina el {fecha}" + "Reactivar"); wire both server actions.

## 7. Verification

- [x] 7.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run` green.
- [x] 7.2 Smoke: cancel (with reason, and skipped) → grace state; reactivate → row deleted + normal state; simulate involuntary delete → `pago_fallido` row.
- [x] 7.3 Update `BACKLOG.md` (A9 → Done) after archive; note migration 011 applied.
