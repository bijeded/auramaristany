## Context

Clients can currently only cancel via Stripe's hosted Customer Portal, and no churn reason is captured. All 10 Stripe prices are `recurring: { interval: "month" }`, so cancellation always means "end of the already-paid period, no refund" — there is no installment/refund case (verified in `scripts/seed-stripe.ts`). The DB already has `subscriptions.cancel_at_period_end`, and `handleSubscriptionUpdated` already syncs it from Stripe. This change adds the in-app UI, an exit survey, reactivation, and involuntary-cancellation logging on top of that existing plumbing.

## Goals / Non-Goals

**Goals:**
- In-app, on-brand cancellation from `/portal/settings` with an optional survey.
- Capture *why* clients leave (voluntary) and distinguish payment-failure churn (involuntary) for Aura's future analytics.
- Reactivation during the grace window.
- Reuse the existing `cancel_at_period_end` + webhook sync; do not reinvent billing state.

**Non-Goals:**
- Refunds or proration (no refund case exists).
- An admin analytics view of survey results (future; the table is built to support it).
- Migrating existing/legacy cancellations into the new table.
- Changing `months_elapsed` semantics or access rules (`subscription-access.ts` unchanged).

## Decisions

**D1 — Dedicated `cancellation_surveys` table (not JSONB on `subscriptions`).**
Rationale: the whole point is aggregate churn insight; a table gives clean queries, a timestamp, and one row per event (cancel → reactivate → cancel = two events). JSONB on the sub would be wiped on row deletion and is awkward to aggregate. Columns: `id uuid pk`, `profile_id uuid` (FK profiles, kept so analytics survive if the sub row is deleted), `subscription_id uuid` (FK subscriptions, nullable), `reason text` (CHECK against the enum), `detail text` (nullable, ≤200), `source text` (CHECK in `'voluntary' | 'involuntary'`), `created_at timestamptz default now()`.

**D2 — Survey-first, all fields optional.** Higher response rate than post-hoc while staying kind: the client can skip. The reason list (UI radios): `precio_muy_caro`, `no_tengo_tiempo`, `no_logre_objetivo`, `no_veo_resultados`, `encontre_otra_opcion` (+detalle), `otro` (+detalle). `pago_fallido` is a valid stored `reason` but is **system-only** — never a radio option.

**D3 — Involuntary detection via `subscription.cancellation_details.reason`.** In `handleSubscriptionDeleted`, `payment_failed`/`payment_disputed` → insert a `pago_fallido` row (`source='involuntary'`); `cancellation_requested` → nothing (the voluntary row already exists from the UI). This avoids a "does a row already exist" race and needs no extra state. Alternative rejected: inferring intent from whether a survey row exists — brittle and racy.

**D4 — Reactivation deletes the latest voluntary survey row.** Per the agreed model, a standing voluntary row means "this cancellation holds"; reactivating removes it so Aura's churn view can trust the table without joining on `status`. The delete is scoped `source='voluntary'` and to the client's own subscription (RLS-owned), so it can never touch a `pago_fallido` row.

**D5 — Server actions in `lib/portal/settingsActions.ts`, identity from `getUser()`.** `cancelSubscription({ reason?, detail? })` and `reactivateSubscription()`. Both resolve the subscription from the authenticated user server-side (never trust a client-sent sub ID — INP-4/EDGE-5 lesson). `detail` validated with zod (≤200) and run through `sanitize-html` (INP-5 pattern). Stripe calls use the existing `stripe` singleton; the `cancel_at_period_end` change flows back through `handleSubscriptionUpdated` (no new webhook wiring for the voluntary path).

**D6 — RLS.** Owner may `insert` and `select` their own rows (`profile_id = auth.uid()`); the involuntary insert runs under service-role in the webhook (no client path). No `update`/`delete` policy for clients except the reactivation delete, which is performed by the server action under the RLS-aware client scoped to the owner's rows.

**D7 — Pure helpers with tests.** `cancellationReasonLabel(reason)` (enum → Spanish label) and `subscriptionEndsLabel`/grace-window derivation kept pure and unit-tested (AAA); the card and modal consume them. `cancel_at_period_end` is added to `AccountSubscription` in `account-queries.ts`.

## Risks / Trade-offs

- **[Stripe/webhook echo lag]** After `cancelSubscription`, `cancel_at_period_end` in our DB updates only when `customer.subscription.updated` arrives. → The server action optimistically updates the local row (or revalidates after the Stripe call returns the updated object) so the UI reflects the grace state immediately; the webhook remains the source of truth.
- **[Double-logging churn]** An involuntary row plus a stale voluntary row could co-exist if a client cancelled then failed payment. → Voluntary cancellation already sets `cancel_at_period_end`; a subsequent delete carries `cancellation_requested`, so no `pago_fallido` row is added. Acceptable.
- **[Free-text abuse]** `detail` free text. → zod ≤200 + `sanitize-html`, same guard as `sendMessage` (INP-5).
- **[Reactivation race]** Webhook and reactivation both touch the sub row. → Reactivation only flips Stripe + deletes the voluntary survey row; status/period stay owned by the webhook. No conflicting writes.

## Migration Plan

- Add `supabase/migrations/011_cancellation_surveys.sql` (table + CHECK constraints + RLS policies + indexes on `profile_id`, `subscription_id`). Apply via Supabase Management API **on one single line** (pipeline eats newlines). Never edit 001–010.
- Update `lib/supabase/types.ts` by hand (new table, `Relationships: []`).
- Rollback: drop the table + policies; the feature is additive and the UI can be reverted independently.
