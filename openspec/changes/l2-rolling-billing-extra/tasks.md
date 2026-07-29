## 1. Preconditions

- [x] 1.1 Confirm `l2-level-ladder-progression` is merged and its migration applied. Flipping Extra to rolling before the ladder exists moves the content cliff rather than removing it.
- [x] 1.2 Run `/opsx:sync` for `l2-level-ladder-progression` first, so its specs are in `openspec/specs/` before this change is synced.
- [x] 1.3 Inspect live Extra subscriptions and decide explicitly: reset or grandfather. With demo data only the answer is reset — verify that is still true rather than inheriting the assumption.
- [x] 1.4 Re-read `handleSubscriptionDeleted` and the A9 settings UI as they actually stand; both collide with completion (design Decisions 2 and 3) and may have moved.

## 2. Migration 017

- [x] 2.1 Write `supabase/migrations/017_rolling_billing_extra.sql`: extend the `subscriptions.status` CHECK with `completed` and `trialing`; set `cuarenta-mas-extra` to `billing_model = 'rolling_monthly'`, `duration_months = null`; delete the `program_variant_prerequisites` rows for the Extra variants.
- [x] 2.2 Apply via the Supabase Management API — **SQL on ONE single line**. The CHECK is replaced with `drop constraint` + `add constraint`, not edited in place.
- [x] 2.3 Verify `completed` and `trialing` are both writable after applying.
- [x] 2.4 Update `lib/supabase/types.ts` if the status union or program fields shift.

## 3. Fixed-term completion (TDD)

- [x] 3.1 Write a failing test pinning the completion **timing**: the invoice bringing `months_elapsed` to `duration_months` triggers completion, the previous one does not, and no later invoice is required. This is the off-by-one that would either cut a paid month short or charge a seventh.
- [x] 3.2 Write a failing test that a `rolling_monthly` subscription never completes regardless of `months_elapsed`.
- [x] 3.3 Implement completion in `handleInvoicePaid`: set `status = 'completed'`, record `completed_at`, and call Stripe to cancel **at period end**.
- [x] 3.4 Write a failing test that `handleSubscriptionDeleted` leaves a `completed` status intact, then implement the guard (design Decision 2 — today it unconditionally writes `canceled`, which would erase completion and strip the client's graduated access).
- [x] 3.5 Confirm the completion-initiated deletion writes no involuntary cancellation survey row (`cancellation_details.reason` is `cancellation_requested`).

## 4. Remove the eligibility gate

- [x] 4.1 Remove the prerequisite check from `app/api/subscriptions/create-checkout/route.ts`.
- [x] 4.2 Delete `lib/subscriptions/prerequisites.ts` and its tests rather than leaving them unreferenced.
- [x] 4.3 Confirm a client with no prior subscription can start checkout for Extra Avanzado — the evaluated-client path that is blocked today.

## 5. Graduated access

- [x] 5.1 Add a second, separately named predicate in `lib/content/subscription-access.ts` for portal-shell access. Leave `subscriptionGrantsAccess` and `ACCESS_STATES` semantically unchanged — do NOT add `completed` to the existing array (design Decision 4).
- [x] 5.2 Update `middleware.ts` to admit `completed` to the portal shell but not to content routes. The `matcher` must stay an inline literal and keep excluding `api/webhooks` and `api/cron`.
- [x] 5.3 Confirm every content-serving path still uses the strict predicate: `getTodayContent`, `getPerformanceData`, the week view, the pillars.
- [x] 5.4 Hide training tabs in the portal shell for the graduated tier; keep account, payment history, progress history and progress photos reachable.
- [x] 5.5 Add the continue-with-Extra CTA. Warm, first-person, neutral Mexican Spanish.
- [x] 5.6 Update `/portal/settings` to branch on status before `cancel_at_period_end`: a `completed` subscription shows completion messaging and the CTA, and offers neither "Reactivar" nor "Cancelar mi plan" (design Decision 3).
- [x] 5.7 Update `subscriptionProgressLabel` and the admin client detail for a completed subscription.

## 6. Review

- [x] 6.1 Route this change through `security-review`, not `code-review` alone — it widens an access boundary and touches middleware.
- [x] 6.2 Confirm RLS still scopes a graduated client to her own data only, and that no admin-only or content query became reachable.

## 7. Verification

- [x] 7.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all green.
- [x] 7.2 Smoke on a Preview URL with a **real test-checkout** subscription — not a `sub_seed_*` demo row — driving a fixed-term subscription to its final month via a Stripe test clock. Confirm: status `completed`, cancellation scheduled at period end, content still served for the remainder of the period.
- [x] 7.3 Let the period end and confirm no further invoice is raised and the status stays `completed` after `customer.subscription.deleted`.
- [x] 7.4 Smoke the graduated portal: account, payment history, progress history and photos reachable; day view, week view and pillars refused; CTA present.
- [ ] 7.5 Smoke that an Extra subscription passes month 6 without completing and keeps billing. — **NOT smoke-tested live.** Verified two other ways: `programs.billing_model` for `cuarenta-mas-extra` reads `rolling_monthly` with `duration_months = null` in production after migration 017, and `computeMonthsUpdate` is unit-tested to never complete a rolling subscription at any `months_elapsed`. Driving a second test clock through an Extra month 6 would close it.
- [ ] 7.6 Closes **D10** — **NOT done; held deliberately.** Attempted during the L2c smoke and blocked for the documented reason: every demo subscription carries a fabricated `sub_seed_*` Stripe id, so the cancel action 404s. Needs a real Stripe test-mode subscription on a portal-loggable account (~2 min to set up). D10 stays open in `BACKLOG.md` with that explanation.
- [x] 7.7 Update `BACKLOG.md` (L2c and L2 → ✅ Done, D10 → ✅ Done), run `/opsx:sync`, `openspec validate`, then `/opsx:archive`, and re-index codebase-memory in `fast` mode.
