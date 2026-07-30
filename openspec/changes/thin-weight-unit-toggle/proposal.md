## Why

The `kg | lb` toggle reads as a heavy, oversized pill next to the compact controls around it — in the "Mi registro" panel of `/portal/today` and above the Desempeño chart, on the same screen as the "Historial de ejercicios" list. Both copies are sized to a 44px minimum height, which dominates the row and pushes the surrounding layout taller than it needs to be. Aura asked for a visually thinner control.

## What Changes

- The `kg | lb` toggle buttons drop from a 44px minimum height to **32px** at both sites that render them.
- `minWidth: 44` stays: horizontal reach is not the problem, and the `kg` / `lb` labels need the width.
- No change to behavior, defaults, stickiness, conversion, or storage. Weight is still entered in the chosen unit, converted for display only, and persisted canonically in kilograms.
- **Accepted tradeoff, recorded deliberately:** 32px is below the ≥44px tap-target floor stated in the design rules of `CLAUDE.md`. The alternative (keep a 32px visual pill but restore a 44px hit area with a transparent overlay) was offered and declined. This change records 32px as an explicit, intentional exception for this one control so a future reader does not "fix" it back to 44 as a stray violation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `portal-exercise-display`: the per-exercise `kg | lb` toggle gains an explicit control-height requirement (32px) documenting the accepted deviation from the ≥44px tap-target rule.
- `portal-performance-display`: the Desempeño `kg | lb` display toggle gains the same explicit control-height requirement, so both copies of the control are pinned to one stated dimension.

## Impact

- `components/portal/blocks/ExerciseListBlock.tsx` — `UnitToggle`, the `minHeight` in the button style.
- `components/portal/PerformanceTab.tsx` — the inline duplicate of the same control, its `minHeight`.
- No migration, no server action, no query, no API surface. Presentation only.
- No test change expected: the existing suites cover conversion and persistence logic, none of which moves. Verification is visual.
- Note for scope: the two toggles are hand-duplicated (one styles inline, the other with Tailwind utilities) and have already drifted apart. Unifying them into one shared component is **out of scope here** and is left as a follow-up so this change stays a two-line visual edit.
