# Tasks

## 1. D20 — RLS write check (migration first, alone)

- [x] 1.1 Add `supabase/migrations/020_onboarding_questions_admin_write_check.sql`: `drop policy if exists "onboarding_questions_admin_write" on onboarding_questions;` then `create policy … for all using (is_admin()) with check (is_admin());`. Do not edit 001. Verify: the file is the next number in the directory listing.
- [ ] 1.2 Apply 020 to the real database via the Management API, sending the SQL on one line. Verify with `select policyname, qual, with_check from pg_policies where tablename = 'onboarding_questions';`: the `with_check` column reads `is_admin()`. Record the timestamp for the PR (rule 11).
- [ ] 1.3 Runtime-verify, with no destructive writes. (a) As a client JWT, attempt an insert; it must be refused with an RLS error, and no row is created. (b) As the admin, reorder the questions in `/admin/onboarding-settings` and then restore the original order; both saves must succeed.

## 2. D26 — single "may she cancel?" list

- [x] 2.1 Export `ELIGIBLE_STATUSES` from `lib/portal/cancellation.ts`. Delete `CANCELABLE_STATUSES` from `lib/portal/settingsActions.ts` and use the import. Leave `ACCESS_STATES` and `BILLING_STATUSES` untouched. Verify: `grep -rn CANCELABLE_STATUSES lib app components` is empty, and `npx tsc --noEmit` plus `npm run test:run` are green.

## 3. D23 — amber token

- [x] 3.1 Replace `#9a7b1f` → `var(--ambar)` and `rgba(240,198,116,.18)` → `var(--ambar-tint)` in `lib/admin/payment-status.ts`, `components/portal/settings/SubscriptionCard.tsx` and `components/admin/ClientDetailTabs.tsx`. Verify: `grep -rn "9a7b1f\|240,198,116" lib components app` returns only `app/globals.css`, and existing tests stay green.

## 4. D27 — chart contrast

- [ ] 4.1 `components/admin/RevenueBarChart.tsx` bar fill, and the line and dot strokes in `components/portal/PerformanceChart.tsx`: `#9982f4` → `var(--lavanda-dark)`. Leave `TextBlockEditor.tsx` alone. Verify: grep shows no `#9982f4` in either file, and by eye on the Preview both charts render in the darker lavender (not black and not blank, which would mean the var didn't resolve).
- [x] 4.2 Update `docs/adr/0005-bar-fill-contrast-measured-against-the-track.md` so both components are listed as compliant (rule 20). Verify: the ADR no longer says they "still carry" the old fill.

## 5. D25 — pressed state

- [ ] 5.1 Add `aria-pressed={prog === f}` to the program pills in `components/admin/ClientsTable.tsx`. Verify on the Preview (`/admin/clients`, seeded data): in DevTools → Accessibility, "Todas" shows pressed=true by default, and selecting another pill moves it.

## 6. D15 — Purpose

- [x] 6.1 Add a real `## Purpose` (not the `TBD` placeholder) to `openspec/specs/admin-richtext-color/spec.md`. It covers what the Text block editor's color, highlight and underline controls do, and the sanitizer that keeps only hex color styles. Verify: `openspec validate --specs` passes for that spec.

## 7. Backlog

- [x] 7.1 Delete the D6 row from `BACKLOG.md` (dropped, not fixed). Also remove D6 from the "Suggested Sequence" list. Verify: `grep -n D6 BACKLOG.md` is empty. The D15/D20/D23/D25/D26/D27 rows are deleted at archive, not here.

## 8. Gate and handoff

- [x] 8.1 Run `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`, all green.
- [ ] 8.2 Run `/security-review` on the branch (RLS and migration surface). Address each finding, or dismiss it with a reason in the PR body.
- [ ] 8.3 Open the PR from `task/cleanup-batch-d15-d20-d23-d25-d26-d27`. The body states when 020 was applied and verified. It also carries the silent-defect flag: **yes, it touches RLS and a migration (D20) and a status list (D26)**. Merge on green CI.
