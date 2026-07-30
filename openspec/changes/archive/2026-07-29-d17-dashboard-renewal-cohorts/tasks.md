## 1. The partition (TDD, pure)

- [x] 1.1 Widen `FinanceSubRow` in `lib/admin/finance-helpers.ts` with `status`, `cancel_at_period_end` and `completed_at`
- [x] 1.2 Write failing tests for `partitionByOutcome` in `__tests__/finance-helpers.test.ts`: ordinary renewal → `billing`; `completed_at` + `cancel_at_period_end` → `completing`; flag alone → `cancelling`; `completed_at` alone (stale marker) → `billing`; buckets sum to input length
- [x] 1.3 Implement `partitionByOutcome` as a single pass calling `deriveCancellationState` from `lib/portal/cancellation.ts` — map `eligible`→`billing`, `completing`→`completing`, `grace`→`cancelling`; do **not** re-derive from the raw flags
- [x] 1.4 Add a test asserting the horizon invariant: for a 7-day window, `renewals.count + terminan.count + cancelaciones.count` equals the number of rows whose `current_period_end` falls in it
- [x] 1.5 Delete `computeRenewalsThisMonth` and its tests; keep `computeRenewalsWithinDays` untouched and remove the test that asserted the 30-day equivalence between the two

## 2. Finance query

- [x] 2.1 Add `status, cancel_at_period_end, completed_at` to the `getActiveSubscriptions` select in `lib/admin/finance-queries.ts` and to its local `Raw` type, mapping them onto the returned rows
- [x] 2.2 Leave the `.eq("status","active")` filter as-is — `trialing`/`past_due` stay excluded by decision; note it in a comment so a future reader does not "fix" it

## 3. Dashboard KPI row

- [x] 3.1 In `app/admin/dashboard/page.tsx`, call `partitionByOutcome(activeSubs)` once and feed `computeMRR` from `billing` only
- [x] 3.2 Keep `activeSubs.length` and `groupClientsByVariant(activeSubs)` on the **full** row-set — ending clients still have access and must stay counted
- [x] 3.3 Retarget the renewals card to a 7-day window and relabel it "Renuevan (próx. 7 días)", still count + `formatMXN`, now from `billing`
- [x] 3.4 Replace the "Vencen en 7 días" card with "Terminan (próx. 7 días)" (count only, from `completing`) and "Cancelaciones (próx. 7 días)" (count only, from `cancelling`), each over the same 7-day window and with a `Ver clientes →` subtitle linking to its own filter
- [x] 3.5 Style the two ending cards distinguishably from each other — a fixed-term completion is a graduation into the next program, not churn
- [x] 3.6 Verify the six-card row wraps cleanly (aim for a deliberate 3+3, not a ragged 5+1) at mobile, tablet and desktop widths

## 4. Client list: the completion marker

- [x] 4.1 Add `completed_at` to the `getClientsList` select and to `RawSubRow` in `lib/admin/clients-queries.ts`, and carry it onto the built `ClientListRow`
- [x] 4.2 Add `completed_at` to the `ClientListRow` interface in `lib/admin/clients-helpers.ts`
- [x] 4.3 Confirm `nextChargeCell` is unchanged and still ignores `completed_at`; add a test pinning that a stale `completed_at` with `cancel_at_period_end = false` still renders "Próximo cobro"

## 5. Client list: the two new pills

- [x] 5.1 Write failing tests in `__tests__/clients-helpers.test.ts` for the new `StatusFilter` values: `Último mes` matches only `active` + `completed_at` + `cancel_at_period_end`; `En cancelación` matches only `active` + flag + no `completed_at`; `completed`/`canceled` rows match neither; a stale `completed_at` without the flag matches neither
- [x] 5.2 Extend the `StatusFilter` union and `filterClients` in `lib/admin/clients-helpers.ts`, deciding membership via the shared derivation (`deriveCancellationState`, per the code review) rather than inline flag checks
- [x] 5.3 Add the two pills to `components/admin/ClientsTable.tsx` in the existing exclusive group, verifying exclusivity and that "Limpiar filtros" resets them
- [x] 5.4 Confirm the dashboard cards' links land with the corresponding pill already active

## 6. Gates and verification

- [x] 6.1 `npx tsc --noEmit` clean, `npm run lint` clean, `npm run test:run` fully green, `npm run build` OK
- [x] 6.2 Smoke on a Preview URL: hand-set `cancel_at_period_end = true` (and separately `completed_at`) on one real `active` row, confirm MRR drops by that row's `price_mxn`, the row moves out of "Renuevan" into the right ending card, and "Suscripciones activas" is unchanged — the mocked unit tests never talk to Supabase
- [x] 6.3 Restore the hand-edited row to its original values and confirm the dashboard returns to its previous figures
- [x] 6.4 Verify both new pills against that same row, including the click-through from each dashboard card
- [x] 6.5 `openspec validate d17-dashboard-renewal-cohorts`, then `/opsx:sync`, update `BACKLOG.md` (close D17, note the deferred `CANCELABLE_STATUSES` duplication), and open the PR
