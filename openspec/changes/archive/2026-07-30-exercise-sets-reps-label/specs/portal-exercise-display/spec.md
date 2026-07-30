## ADDED Requirements

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
