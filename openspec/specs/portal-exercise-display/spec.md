# portal-exercise-display

## Purpose

Defines how exercises are presented to the client in the portal and how she logs her work against them: rest times as minute-based labels, an explicit "Hecho ✓" completion control, per-set entry of reps and weight, and a per-exercise `kg | lb` unit toggle. The unit is a property of the moment of capture — it is chosen per exercise, converts typed values in place, and is never stored; weight always persists as canonical kilograms so that history, charts and aggregation share one unit. Covers both the live `/portal/today` view and the read-only rendering of a logged day.
## Requirements
### Requirement: Rest time is displayed in minutes
The portal SHALL display exercise rest times as minute-based labels wherever they are shown to the client, derived from `rest_seconds` at render time. The stored `rest_seconds` value MUST NOT change.

Formatting rules: values under 60 render as `<n> seg`; exact minutes render as `<m> min`; other values render as `<m>:<ss> min`.

#### Scenario: Exact minute
- **WHEN** an exercise has `rest_seconds: 60`
- **THEN** the label reads `Descanso: 1 min`

#### Scenario: Minute and a half
- **WHEN** an exercise has `rest_seconds: 90`
- **THEN** the label reads `Descanso: 1:30 min`

#### Scenario: Under a minute
- **WHEN** an exercise has `rest_seconds: 45`
- **THEN** the label reads `Descanso: 45 seg`

#### Scenario: History view uses the same format
- **WHEN** a logged day is shown read-only (ExerciseListLogged)
- **THEN** rest labels use the same minute-based format as `/portal/today`

### Requirement: Exercise done control is an explicit "Hecho" button
Each exercise card in `/portal/today` SHALL present a "Hecho ✓" pill button of at least 48px height as the control to mark the exercise done. Toggling MUST preserve the existing completion state behavior (count, autosave, card done styling).

#### Scenario: Marking an exercise done
- **WHEN** the client taps the "Hecho" button on an undone exercise
- **THEN** the exercise is marked completed, the button shows its filled (lavender) done state, and the day's done count updates

#### Scenario: Unmarking
- **WHEN** the client taps the button on a completed exercise
- **THEN** the exercise returns to not-done and the button returns to its outlined state

#### Scenario: Tap target size
- **WHEN** the card renders on mobile
- **THEN** the button is at least 48px tall

### Requirement: Per-exercise weight unit toggle at log time
Each exercise card with the `weight_kg` metric in `/portal/today` SHALL offer a `kg | lb` toggle that applies to all of that exercise's set inputs. The default unit MUST be kg. The chosen unit MUST persist per exercise while the screen stays mounted (sticky per session), and MUST NOT be persisted to the database.

The toggle buttons SHALL render at a minimum height of 32px and a minimum width of 44px. The 32px height is a deliberate, documented exception to the ≥44px tap-target rule in `CLAUDE.md`: this control was judged visually too heavy at 44px next to the compact "Mi registro" header, and the shorter height was chosen with the tradeoff stated. It applies to this control only and MUST NOT be read as license to shrink other tap targets.

#### Scenario: Choosing lb for one exercise
- **WHEN** the client switches an exercise's toggle to lb
- **THEN** that exercise's weight column header reads "Peso (lb)" and its inputs are interpreted as lb, while other exercises keep their own unit

#### Scenario: Flip converts typed values in place
- **WHEN** the client has typed `55` with the unit in lb and flips the toggle to kg
- **THEN** the input value is rewritten to the kg equivalent (`24.9`); empty inputs stay empty

#### Scenario: Round-trip stability
- **WHEN** the client flips kg → lb → kg without editing
- **THEN** the displayed value returns to its original kg value (1-decimal rounding, no cumulative drift)

#### Scenario: Toggle control height
- **WHEN** the exercise card renders on mobile
- **THEN** each `kg` / `lb` button is at least 32px tall and at least 44px wide

#### Scenario: Shrinking the toggle does not shrink its neighbours
- **WHEN** the "Mi registro" panel renders alongside the "Hecho ✓" button
- **THEN** the "Hecho ✓" button keeps its own ≥48px height, unaffected by the toggle's 32px height

### Requirement: Weight is always stored in kilograms
Regardless of the entry unit, the system SHALL persist `weight_kg` values in kilograms rounded to 1 decimal. The `weight_kg` JSON key and the `progress_logs` structure MUST NOT change, and the entry unit MUST NOT be stored.

#### Scenario: Saving a value entered in lb
- **WHEN** the client logs `55` with the unit set to lb and autosave fires
- **THEN** the stored value is `24.9` (`55 × 0.45359237`, rounded to 1 decimal)

#### Scenario: Draft hydration is kg
- **WHEN** a previously saved day is reopened
- **THEN** inputs show the stored kg values and every exercise's toggle is reset to kg

#### Scenario: History list unaffected
- **WHEN** a logged day is viewed in Historial
- **THEN** weights display in kg exactly as stored

### Requirement: An exercise's target volume names its units

Every surface that shows an exercise's target volume SHALL word it as `<sets> series × <reps> repeticiones` — naming both units, separated by `×` — rather than showing the two numbers alone.

`sets` is a whole number and `reps` is free text authored by Aura. Because Aura may enter a value that is not a repetition count, the noun `repeticiones` SHALL be appended only when `reps` is a repetition count: a single number (`12`) or a range written with `a`, `-`, or `–` (`10 a 12`, `10-12`). For any other value the label SHALL fall back to `<sets> series × <reps>`, leaving Aura's text to speak for itself.

The label SHALL be produced by one shared pure function, so that all surfaces showing target volume render byte-identical text for the same exercise.

#### Scenario: Fixed repetition count

- **WHEN** an exercise stores `sets = 4` and `reps = "12"`
- **THEN** its target volume reads `4 series × 12 repeticiones`

#### Scenario: Repetition range

- **WHEN** an exercise stores `sets = 4` and `reps = "10 a 12"`
- **THEN** its target volume reads `4 series × 10 a 12 repeticiones`

#### Scenario: Range written with a dash

- **WHEN** an exercise stores `reps = "10-12"` or `reps = "10 – 12"`
- **THEN** the value is recognized as a repetition count and the label ends in `repeticiones`

#### Scenario: A value that is not a repetition count

- **WHEN** an exercise stores `sets = 4` and `reps = "30 seg"`
- **THEN** its target volume reads `4 series × 30 seg`
- **AND** the word `repeticiones` does not appear

#### Scenario: Surrounding whitespace does not change the wording

- **WHEN** an exercise stores `reps = " 12 "`
- **THEN** the label reads `4 series × 12 repeticiones`, with the stored value trimmed

#### Scenario: The same exercise reads identically on every screen

- **WHEN** the same exercise is shown on the current day, on a future or rest day with no logging, and on a past day that already has a log
- **THEN** all three render the same target-volume text for that exercise

#### Scenario: The logging box keeps its own wording

- **WHEN** a client views the current day's exercise card, whose logging box is headed `Mi registro · 4 series de 12 reps`
- **THEN** that heading is unchanged by this requirement, and it may restate figures already shown in the target-volume label

