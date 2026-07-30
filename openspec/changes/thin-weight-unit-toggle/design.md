## Context

The `kg | lb` weight-unit toggle exists in two places, written by hand twice:

```
components/portal/blocks/ExerciseListBlock.tsx
  └─ UnitToggle()                     ← used by TodayView only
       inline style: minWidth 44 · minHeight 44 · padding "4px 12px" · fontSize 12

components/portal/PerformanceTab.tsx
  └─ inline JSX copy (no component)   ← Desempeño tab, above the chart
       mixed:  Tailwind px-3 py-1  +  style minWidth 44 · minHeight 44 · fontSize 12
```

Both render a rounded-full group of two buttons with a 1.5px `--gris-linea` border, lavender fill on the pressed side. They are visually the same control and have already drifted in *how* they are styled (inline vs Tailwind utilities), though not yet in *what* they look like.

The Historial the client sees is the "Historial de ejercicios" list inside `PerformanceTab.tsx` — the same screen as the second toggle. The separate log-detail route `/portal/history/[logId]` renders `ExerciseListLogged`, which has **no** toggle (it prints stored kg as text). So there is no third site to change.

## Goals / Non-Goals

**Goals:**
- Reduce the toggle's minimum height from 44px to 32px at both render sites.
- Keep the two copies visually identical after the change.
- Record the sub-44px height as an intentional, reasoned exception rather than an accidental rule violation.

**Non-Goals:**
- Extracting a shared `WeightUnitToggle` component. Tempting while both files are open, but it converts a two-line visual edit into a refactor with its own review surface. Left as a follow-up.
- Any change to unit conversion, stickiness, defaults, or storage. `weight_kg` stays canonical kilograms.
- Any change to `/portal/history/[logId]` or `ExerciseListLogged`.
- Any change to other tap targets, notably the ≥48px "Hecho ✓" button that sits near the toggle.

## Decisions

**Change `minHeight` only; leave `minWidth: 44`.** The complaint is vertical bulk. The `kg` / `lb` labels still need horizontal room, and a narrower pill would make the two options harder to hit *and* look cramped. Alternative considered: dropping both to 32 — rejected, it makes the control worse on both axes for no gain.

**Accept 32px rather than faking the hit area.** The standard fix for "thin control, big target" is a transparent `::after` overlay that extends the touch region past the visible pill, keeping the 44px floor. This was offered explicitly and declined in favour of the simpler literal change. Recording it here so the option is on file if mobile mis-taps ever show up. Alternative considered: `padding` reduction instead of `minHeight` — rejected, `minHeight` is the binding constraint, so trimming padding alone would not shrink the button.

**Pin the dimension in both specs instead of only in code.** The neighbouring "Hecho" requirement already states its ≥48px size as a normative scenario, so a stated height is idiomatic in this spec set. Writing 32px into both `portal-exercise-display` and `portal-performance-display` is what stops a future reader from "correcting" the value back to 44 to satisfy the `CLAUDE.md` design rule — the deviation is deliberate, and a spec is where deliberate deviations survive.

**Do not add tests.** The existing suites cover conversion and persistence, none of which moves. A test asserting an inline `minHeight` literal would restate the implementation rather than a behaviour, and would break on any future refactor to Tailwind classes. Verification here is visual.

## Risks / Trade-offs

- **32px is below the ≥44px tap-target floor for an audience of women 40+, so mis-taps get more likely on mobile** → The control is only two large-ish adjacent options with no destructive outcome; a mis-tap flips the display unit and is instantly reversible by tapping the other side. If complaints appear, apply the transparent-overlay approach recorded above without changing the visual height.
- **The rule violation is now in the codebase and could be cited as precedent for shrinking other targets** → Both spec deltas state explicitly that the exception is scoped to this control, and one scenario asserts the "Hecho ✓" button keeps its own ≥48px height.
- **The two hand-duplicated copies can drift again** → The `portal-performance-display` delta states the two must stay dimensionally identical and calls divergence a defect. The durable fix is the deferred shared-component extraction.
- **Only one of the two sites gets updated** → The tasks list names both files and line positions; a reviewer checking the diff sees two changed files or knows one is missing.

## Migration Plan

None — no schema, no data, no API. Ship on a branch, confirm on the Preview URL that both toggles look right and still switch units, merge to `main`. Rollback is reverting the commit.

## Open Questions

- Should the deferred shared `WeightUnitToggle` extraction get a `BACKLOG.md` row now, or wait until a third site needs the control? Leaning toward a row, since duplicated UI has already caused a repeat defect class in this repo (review rule 8).
