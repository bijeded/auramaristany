## 1. Thin the toggle at both render sites

- [x] 1.1 In `components/portal/blocks/ExerciseListBlock.tsx`, inside `UnitToggle`, change the button style `minHeight: 44` to `minHeight: 32`. Leave `minWidth: 44`, `padding`, `fontSize`, colors and the border untouched.
- [x] 1.2 In `components/portal/PerformanceTab.tsx`, in the inline `kg | lb` group rendered when `activeMetric === "weight_kg"`, change the button style `minHeight: 44` to `minHeight: 32`. Leave `minWidth: 44` and the Tailwind `px-3 py-1` untouched.
- [x] 1.3 Confirm no other file sets a height on this control: `grep -rn "minHeight" components/portal` should show no remaining 44 on a `kg`/`lb` button.

## 2. Verify

> 2.3–2.5 deferred to the Vercel Preview URL by decision on 2026-07-30 (`[~]` = deferred, not skipped). They must still be performed on Preview before merge.

- [x] 2.1 Run `npx tsc --noEmit`, `npm run lint`, and `npm run test:run` — all must stay green (659/659 baseline; no test change is expected in this change).
- [x] 2.2 Run `npm run build`.
- [~] 2.3 Visual check on `/portal/today`: the toggle in the "Mi registro" panel is visibly shorter, both `kg` and `lb` are still legible and tappable, and the neighbouring "Hecho ✓" button is unchanged at its ≥48px height.
- [~] 2.4 Visual check on the Desempeño tab with the Peso metric selected: the toggle above the chart is the same height as the one on `/portal/today`, and the "Historial de ejercicios" list below it is unaffected.
- [~] 2.5 Functional check: flipping kg ↔ lb still converts values in place on `/portal/today` and still re-renders the chart in the chosen unit on Desempeño. No behavior was meant to change.

## 3. Ship

- [ ] 3.1 Commit on a feature branch with a Conventional Commit message, push, and confirm the Vercel Preview URL renders both toggles correctly on a phone-width viewport.
- [ ] 3.2 Obtain a `code-review` verdict before opening the PR (required by CLAUDE.md; no security-review needed — presentation-only diff, no auth, data, or input surface).
- [ ] 3.3 Open the PR, merge after green CI, then run `/opsx:sync` and `/opsx:archive`.
- [ ] 3.4 Add a `BACKLOG.md` row for the deferred follow-up: extract a single shared `WeightUnitToggle` used by both `ExerciseListBlock` and `PerformanceTab`, retiring the hand-duplicated copies.
