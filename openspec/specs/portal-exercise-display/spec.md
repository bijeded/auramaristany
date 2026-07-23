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
