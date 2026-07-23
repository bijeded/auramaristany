# Proposal — a1-kg-lb-selector

## Why

Aura's clients train with mixed equipment — some dumbbells/machines are labeled in lb, plates in kg (BACKLOG A1). Forcing mental conversion at log time produces wrong data. The unit is a property of the **moment of entry**, not of the user: the client picks kg/lb per exercise while logging; storage stays canonical kg.

## What Changes

- **Per-exercise unit toggle at log time:** each exercise card in `/portal/today` gets a `kg | lb` toggle above the series rows (applies to all sets of that exercise). Flipping it **converts already-typed values in place** (e.g. `55` lb → `24.9`). Choice is **sticky per session** (component state, remembered per exercise; default kg).
- **Canonical kg storage:** values entered in lb are converted (`×0.45359237`, rounded to 1 decimal) before save. The `weight_kg` JSON key, `metrics` array, and `progress_logs` rows are untouched. Never store mixed units.
- **Historial/Desempeño display toggle:** the performance chart ("Peso") gets a `kg | lb` display toggle — data stays kg underneath; conversion applied after aggregation, at render. Default kg.
- **No migration, no profile preference, no settings change** — explicitly out of scope (the earlier profile-preference approach was rejected in exploration).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `portal-exercise-display`: ADDED requirements — per-exercise weight-unit entry toggle with in-place conversion and canonical-kg persistence.
- `admin-dashboard-kpis`: _not touched._

### New Capabilities (spec files)
- `portal-performance-display`: performance chart display units — kg/lb toggle for the "Peso" metric, kg-canonical data.

## Impact

- **New:** pure helpers `convertToKg(value)` / `convertToLb(value)` + rounding rules (AAA tests).
- **Modified:** `components/portal/blocks/ExerciseListBlock.tsx` (toggle UI + in-place conversion) · `hooks/useProgressForm.ts` (serialize lb→kg on save; hydrate always kg) · `components/portal/PerformanceChart.tsx` + `PerformanceTab.tsx` (display toggle for Peso).
- **Untouched:** `progress_logs` schema, `exercise_list` JSON, `lib/content/history-helpers.ts` math (stays kg), `ExerciseListLogged`/Historial list (kg), admin surfaces, migrations, settings.
