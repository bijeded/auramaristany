# portal-exercise-display

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

#### Scenario: Choosing lb for one exercise
- **WHEN** the client switches an exercise's toggle to lb
- **THEN** that exercise's weight column header reads "Peso (lb)" and its inputs are interpreted as lb, while other exercises keep their own unit

#### Scenario: Flip converts typed values in place
- **WHEN** the client has typed `55` with the unit in lb and flips the toggle to kg
- **THEN** the input value is rewritten to the kg equivalent (`24.9`); empty inputs stay empty

#### Scenario: Round-trip stability
- **WHEN** the client flips kg → lb → kg without editing
- **THEN** the displayed value returns to its original kg value (1-decimal rounding, no cumulative drift)

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
