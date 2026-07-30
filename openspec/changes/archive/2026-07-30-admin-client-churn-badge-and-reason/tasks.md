## 1. Pure helper + tests (TDD)

- [x] 1.1 Write failing tests for a pure helper that maps a subscription plus its optional survey row to the card's cancellation presentation: badge shown only when `isChurned(status)`; no badge for `completed`, for the final-paid-month case (`completed_at` + `cancel_at_period_end`), or for the grace window; reason text from `cancellationReasonLabel`; `detail` appended when non-empty; `Sin motivo registrado` when there is no row; `prefiero_no_decir` distinct from that fallback; an unknown reason value renders raw
- [x] 1.2 Implement the helper in `lib/admin/clients-helpers.ts`, calling `isChurned` and `cancellationReasonLabel` — no second reason table, no local `status === "canceled"` comparison
- [x] 1.3 Confirm the helper takes badge label/colours from `statusBadge(status)` rather than defining its own, and that the tests pin that

## 2. Query

- [x] 2.1 Extend `getClientDetail` in `lib/admin/clients-queries.ts` with a select on `cancellation_surveys` (`subscription_id, reason, detail, created_at`) filtered by `.in("subscription_id", subIds)` over the already-loaded subscription ids, through the same RLS-aware client — no service-role
- [x] 2.2 Skip the query entirely when `subIds` is empty; build a `Map<subscriptionId, survey>` keeping the most recent row by `created_at` when a subscription has more than one
- [x] 2.3 Extend the `ClientSubscription` type (and its construction) to carry the optional survey fields; verify `lib/supabase/types.ts` already types `cancellation_surveys` and leave it unchanged if so

## 3. Rendering

- [x] 3.1 Render the churn badge in the Resumen subscription block of `components/admin/ClientDetailTabs.tsx`, driven solely by the helper from group 1
- [x] 3.2 Render the `Motivo` row in the same block, only when the badge is shown; ensure `detail` reaches a React text node and never `dangerouslySetInnerHTML`
- [x] 3.3 Confirm no raw hex is introduced — all colours come from existing tokens via `statusBadge`

## 4. Verification

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all green
- [x] 4.2 Verify against the real database that the admin read of `cancellation_surveys` returns rows for a churned subscription — the CI gate never touches the DB
- [x] 4.3 Write the smoke card for the Preview URL, covering a churned client with a reason, a churned client with no survey row, and a `completed` client showing no badge; state explicitly how the churned test client is produced, given that seeded subscriptions carry synthetic Stripe ids (BACKLOG D28) and cannot be cancelled through the product
- [x] 4.4 `code-review` verdict before the PR
