## 1. Preconditions

- [ ] 1.1 Confirm `l2-level-ladder-progression` is merged and its migration applied. Flipping Extra to rolling before the ladder exists moves the content cliff rather than removing it.
- [ ] 1.2 Run `/opsx:sync` for `l2-level-ladder-progression` first, so its specs are in `openspec/specs/` before this change is synced.
- [ ] 1.3 Inspect live Extra subscriptions and decide explicitly: reset or grandfather. With demo data only the answer is reset — verify that is still true rather than inheriting the assumption.
- [ ] 1.4 Re-read `handleSubscriptionDeleted` and the A9 settings UI as they actually stand; both collide with completion (design Decisions 2 and 3) and may have moved.

## 2. Migration 017

- [ ] 2.1 Write `supabase/migrations/017_rolling_billing_extra.sql`: extend the `subscriptions.status` CHECK with `completed` and `trialing`; set `cuarenta-mas-extra` to `billing_model = 'rolling_monthly'`, `duration_months = null`; delete the `program_variant_prerequisites` rows for the Extra variants.
- [ ] 2.2 Apply via the Supabase Management API — **SQL on ONE single line**. The CHECK is replaced with `drop constraint` + `add constraint`, not edited in place.
- [ ] 2.3 Verify `completed` and `trialing` are both writable after applying.
- [ ] 2.4 Update `lib/supabase/types.ts` if the status union or program fields shift.

## 3. Fixed-term completion (TDD)

- [ ] 3.1 Write a failing test pinning the completion **timing**: the invoice bringing `months_elapsed` to `duration_months` triggers completion, the previous one does not, and no later invoice is required. This is the off-by-one that would either cut a paid month short or charge a seventh.
- [ ] 3.2 Write a failing test that a `rolling_monthly` subscription never completes regardless of `months_elapsed`.
- [ ] 3.3 Implement completion in `handleInvoicePaid`: set `status = 'completed'`, record `completed_at`, and call Stripe to cancel **at period end**.
- [ ] 3.4 Write a failing test that `handleSubscriptionDeleted` leaves a `completed` status intact, then implement the guard (design Decision 2 — today it unconditionally writes `canceled`, which would erase completion and strip the client's graduated access).
- [ ] 3.5 Confirm the completion-initiated deletion writes no involuntary cancellation survey row (`cancellation_details.reason` is `cancellation_requested`).

## 4. Remove the eligibility gate

- [ ] 4.1 Remove the prerequisite check from `app/api/subscriptions/create-checkout/route.ts`.
- [ ] 4.2 Delete `lib/subscriptions/prerequisites.ts` and its tests rather than leaving them unreferenced.
- [ ] 4.3 Confirm a client with no prior subscription can start checkout for Extra Avanzado — the evaluated-client path that is blocked today.

## 5. Graduated access

- [ ] 5.1 Add a second, separately named predicate in `lib/content/subscription-access.ts` for portal-shell access. Leave `subscriptionGrantsAccess` and `ACCESS_STATES` semantically unchanged — do NOT add `completed` to the existing array (design Decision 4).
- [ ] 5.2 Update `middleware.ts` to admit `completed` to the portal shell but not to content routes. The `matcher` must stay an inline literal and keep excluding `api/webhooks` and `api/cron`.
- [ ] 5.3 Confirm every content-serving path still uses the strict predicate: `getTodayContent`, `getPerformanceData`, the week view, the pillars.
- [ ] 5.4 Hide training tabs in the portal shell for the graduated tier; keep account, payment history, progress history and progress photos reachable.
- [ ] 5.5 Add the continue-with-Extra CTA. Warm, first-person, neutral Mexican Spanish.
- [ ] 5.6 Update `/portal/settings` to branch on status before `cancel_at_period_end`: a `completed` subscription shows completion messaging and the CTA, and offers neither "Reactivar" nor "Cancelar mi plan" (design Decision 3).
- [ ] 5.7 Update `subscriptionProgressLabel` and the admin client detail for a completed subscription.

## 6. Review

- [ ] 6.1 Route this change through `security-review`, not `code-review` alone — it widens an access boundary and touches middleware.
- [ ] 6.2 Confirm RLS still scopes a graduated client to her own data only, and that no admin-only or content query became reachable.

## 7. Verification

- [ ] 7.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all green.
- [ ] 7.2 Smoke on a Preview URL with a **real test-checkout** subscription — not a `sub_seed_*` demo row — driving a fixed-term subscription to its final month via a Stripe test clock. Confirm: status `completed`, cancellation scheduled at period end, content still served for the remainder of the period.
- [ ] 7.3 Let the period end and confirm no further invoice is raised and the status stays `completed` after `customer.subscription.deleted`.
- [ ] 7.4 Smoke the graduated portal: account, payment history, progress history and photos reachable; day view, week view and pillars refused; CTA present.
- [ ] 7.5 Smoke that an Extra subscription passes month 6 without completing and keeps billing.
- [ ] 7.6 Closes **D10** — verify A9 cancellation end to end against a real test-checkout subscription (cancel → grace → Reactivar → survey row written and deleted).
- [ ] 7.7 Update `BACKLOG.md` (L2c and L2 → ✅ Done, D10 → ✅ Done), run `/opsx:sync`, `openspec validate`, then `/opsx:archive`, and re-index codebase-memory in `fast` mode.
