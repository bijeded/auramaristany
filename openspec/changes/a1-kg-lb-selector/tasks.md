# Tasks — a1-kg-lb-selector

## 1. Setup

- [x] 1.1 Create branch `feature/a1-kg-lb-selector` from `main`

## 2. Unit conversion helpers

- [x] 2.1 TDD: `lib/content/weight-units.ts` — `lbToKg` / `kgToLb`, 1-decimal rounding; tests incl. round-trip stability for common plate values (55, 45, 25, 10 lb), empty/zero handling

## 3. Entry toggle in /portal/today

- [x] 3.1 Add per-exercise `kg | lb` toggle to `components/portal/blocks/ExerciseListBlock.tsx` (default kg, sticky per exercise in component state; ≥44px tap target; dynamic "Peso (kg/lb)" header)
- [x] 3.2 Flip handler converts non-empty typed values in place via the helpers; empty inputs stay empty
- [x] 3.3 Guarantee autosave payload is always kg (values handed to `useProgressForm` state / serialize path in kg; hydration shows kg with toggle reset) — keep `useProgressForm` changes minimal
- [x] 3.4 Verify: log in lb → stored `weight_kg` is converted; reopen day → kg shown, toggle kg

## 4. Chart display toggle in Desempeño

- [x] 4.1 Add `kg | lb` segmented control in `components/portal/PerformanceTab.tsx`, visible only when activeMetric is `weight_kg` (reuse metric-pill styling)
- [x] 4.2 `components/portal/PerformanceChart.tsx` accepts a `unit` prop — convert values, axis and tooltip labels at render; `history-helpers` untouched
- [x] 4.3 Verify chart at 375px width (mobile density)

## 5. Verification & PR

- [x] 5.1 Full gate: `npx tsc --noEmit` · `npm run lint` · `npm run test:run` · `npm run build`
- [x] 5.2 Browser smoke: entry toggle flip/convert/save, chart toggle
- [x] 5.3 Push branch, PR via github-pr; frontend → human review + Preview verification

## Parallelization

Independent: group 3 (entry toggle, ExerciseListBlock) vs group 4 (chart toggle, PerformanceTab/Chart).
Sequential: 2.1 (helpers) → both groups; run 3 then 4 in-session (same branch/PR).
