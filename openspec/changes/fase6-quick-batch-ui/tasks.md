# Tasks — fase6-quick-batch-ui

## 1. Setup

- [ ] 1.1 Create branch `feature/fase6-quick-batch-ui` from `main`

## 2. A2 — Rest in minutes

- [ ] 2.1 TDD: pure helper `formatRestLabel(seconds)` (+ AAA tests: 0, 45, 60, 75, 90, 120)
- [ ] 2.2 Use the helper in `components/portal/blocks/ExerciseListBlock.tsx` (if it shows rest), `ExerciseListLogged.tsx:59`, and `ExerciseListReadOnly.tsx:42`
- [ ] 2.3 Verify admin editor preview — the "Descanso (seg)" input stays in seconds (data entry, untouched)

## 3. A3 — "Hecho" button

- [ ] 3.1 Replace the done control in `components/portal/blocks/ExerciseListBlock.tsx` with a `✓ Hecho` pill button (≥48px; outlined ↔ lavender-filled), preserving `formState.completed` behavior, done count, and autosave
- [ ] 3.2 Verify done-card styling and mobile tap target in the browser

## 4. A10 — Bars in "Ingresos por programa"

- [ ] 4.1 Load the `dataviz` skill, then convert `components/admin/ProgramRevenueDonut.tsx` to a bar chart reusing the `RevenueBarChart` pattern (data from `groupRevenueByProgram` unchanged)
- [ ] 4.2 Verify totals match the previous donut and tooltips/colors are brand-consistent

## 5. A11 — 5th stat card (expiring ≤7 days)

- [ ] 5.1 TDD: generalize `computeRenewalsThisMonth` → `computeRenewalsWithinDays(subs, days, now)` in `lib/admin/finance-helpers.ts`, keeping the 30-day wrapper; tests for 5d/20d/past/null/boundary
- [ ] 5.2 Add the "Vencen en 7 días" card in `app/admin/dashboard/page.tsx` (count + MXN), keeping "Renuevan este mes"
- [ ] 5.3 Adjust the KPI row grid for 5 cards and verify responsive at mobile/tablet/desktop

## 6. Verification & PR

- [ ] 6.1 Full gate locally: `npx tsc --noEmit` · `npm run lint` · `npm run test:run` · `npm run build`
- [ ] 6.2 Browser smoke: `/portal/today` (labels + Hecho), admin dashboard (bars + 5 cards)
- [ ] 6.3 Push branch, open PR (github-pr skill) — first exercise of the CI gate (D7); fix CI infra issues in-branch if any

## Parallelization

Independent: group A (tasks 2.x + 3.x, portal exercise components) vs group B (tasks 4.x + 5.x, admin dashboard).
Sequential within groups: 2.x → 3.x (share ExerciseListBlock.tsx); 4.x and 5.x touch dashboard page — commit 4 before 5.
