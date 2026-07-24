## 1. Pure helpers (TDD)

- [x] 1.1 Add `isInactive(lastActivityDate: string | null, now: string, thresholdDays: number)` to `lib/admin/clients-helpers.ts` with a UTC whole-day diff; `null` ⇒ inactive.
- [x] 1.2 Write AAA tests for `isInactive`: never-logged (null), 9-day (active), 10-day boundary (inactive), 11-day (inactive).
- [x] 1.3 Extend `StatusFilter` to include `"Sin actividad"` and add it to `STATE_FILTERS`; add `last_activity_date: string \| null` to `ClientListRow`; add `INACTIVITY_THRESHOLD_DAYS = 10` constant.
- [x] 1.4 Extend `filterClients` signature with `now: string` and handle `"Sin actividad"` = `status ∈ {active, trialing} && isInactive(row.last_activity_date, now, 10)`.
- [x] 1.5 Update existing `filterClients` tests for the new `now` param and add a case for the "Sin actividad" pill (active+stale included, canceled+stale excluded, active+recent excluded).

## 2. Query (server-only)

- [x] 2.1 Extend the `getClientsList` select to embed `progress_logs(log_date order by log_date desc limit 1)` under the `profiles` join; keep the existing `// keep:` cast comment style.
- [x] 2.2 Reduce the embedded logs to `last_activity_date` (max `log_date`, or `null`) per client and include it on each `ClientListRow`; add `trialing` handling if a primary sub can be `trialing`.

## 3. UI wiring

- [x] 3.1 In `app/admin/clients/page.tsx`, compute a DEV_DATE-aware server `now` (date-only) and pass it to `ClientsTable`.
- [x] 3.2 In `components/admin/ClientsTable.tsx`, accept the `now` prop, pass it to `filterClients`, and render the "Sin actividad" pill within the existing exclusive `STATE_FILTERS` group.
- [x] 3.3 Ensure "Limpiar filtros" resets the new pill; add a `trialing` badge entry to `STATUS_BADGE` if `trialing` rows can appear.

## 4. Verification

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run` (all green), `npm run build`.
- [x] 4.2 Manual smoke: select "Sin actividad" and confirm only active/trialing quiet clients appear; verify a never-logged active client shows and a recently-active one does not.
- [x] 4.3 `code-review` (subagent) per the dev-loop; `security-review` not required (read-only, no new surface) — note the rationale in the PR.
