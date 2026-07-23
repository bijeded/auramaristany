# Design — a1-kg-lb-selector

## Context

Weights are logged per set in `/portal/today` (`ExerciseListBlock` → `MetricInputs`, strings in `useProgressForm` state, serialized to `weight_kg: number` on debounced autosave). History (`ExerciseListLogged`) and the Desempeño chart (`PerformanceChart`, fed by `buildPerformanceSeries`/`aggregateDayValue`) all read kg. Decisions from exploration (confirmed with the human): unit is chosen per exercise at entry; storage canonical kg; in-place conversion on toggle flip; sticky per-session choice; chart gets a kg/lb display toggle; Historial list stays kg.

## Goals / Non-Goals

**Goals:**
- kg/lb toggle per exercise card at log time; all sets of that exercise share the unit.
- Flip converts typed values in place (55 lb ⇄ 24.9 kg).
- Save always converts to kg (1-decimal rounding); drafts hydrate in kg with toggle reset to kg.
- Sticky per-exercise unit within the session (component state only).
- Desempeño "Peso" chart: kg/lb display toggle, conversion after aggregation.

**Non-Goals:**
- No `profiles.weight_unit`, no migration, no settings UI (rejected approach).
- No unit stored in `progress_logs`/JSON — never mixed units.
- Historial day list (`ExerciseListLogged`) stays kg — no toggle there.
- Admin surfaces untouched.

## Decisions

1. **Pure helpers** in `lib/content/weight-units.ts` (+ AAA tests): `lbToKg(lb)` = `round1(lb × 0.45359237)`, `kgToLb(kg)` = `round1(kg / 0.45359237)`. All rounding to 1 decimal — sub-display-precision drift accepted. Alternative (store entered unit) rejected: violates canonical-kg invariant.
2. **Toggle state lives in `ExerciseListBlock`** (client component), `Record<exerciseId, "kg" | "lb">` default `"kg"` — not in `useProgressForm`, so the hook's serialize contract stays "strings are in the displayed unit; convert before building the payload". Concretely: `onUpdateSeries` values pass through unchanged; conversion to kg happens in the component's flip handler (in-place rewrite of the input strings) **and** at save-serialize time when the exercise's unit is `lb`. Simplest wiring: keep the form state always-kg and have the component convert on the way in (input in lb → state in kg) and on the way out (state kg → shown as lb). Pick whichever keeps `useProgressForm` untouched-or-minimal; the invariant is *state handed to autosave is kg*.
3. **Flip handler** rewrites non-empty inputs via the helpers; empty strings stay empty. Placeholder stays `"0"`. Column header becomes `Peso (kg)` / `Peso (lb)` dynamically.
4. **Chart toggle** in `PerformanceTab` (already a client component with metric pills): a small `kg | lb` segmented control shown **only when activeMetric is `weight_kg`**; `PerformanceChart` receives `unit` and converts point values + axis/tooltip labels at render. `aggregateDayValue`/`buildPerformanceSeries` untouched (math in kg).
5. **Sticky choice**: the per-exercise unit map persists for the life of the mounted block (session navigation away resets to kg) — no persistence layer, matching "component state only".

## Risks / Trade-offs

- [Double conversion drift on repeated flips (kg→lb→kg)] → helpers round to 1 decimal; a 55 lb ⇄ 24.9 kg cycle is stable (55.0 ↔ 24.9). Tests pin round-trip stability for common plate values.
- [Client flips unit after autosave already fired] → autosave always receives kg (invariant in Decision 2); the flip rewrites the same kg value, next debounce re-saves identical data — idempotent.
- [Chart toggle adds UI density on mobile] → reuse the existing metric-pill styling; verify at 375px.
- [lb users see kg in Historial list] → accepted by product decision (chart has the toggle; list stays kg).
