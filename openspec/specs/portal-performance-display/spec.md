# portal-performance-display

## Purpose

Defines the Desempeño view, where the client sees her own progress over time for a chosen exercise and metric, plus the "Historial de ejercicios" list of her logged days. Presentation converts but never mutates: the `kg | lb` toggle re-renders chart values, axis and tooltip labels at display time only, while the underlying series and every aggregation stay in canonical kilograms — a day's average is computed in kg and converted after, never the reverse.

## Requirements

### Requirement: Weight chart display unit toggle
The Desempeño performance view SHALL offer a `kg | lb` display toggle when the selected metric is weight (`weight_kg`). Default is kg. The toggle converts chart values, axis and tooltip labels at render time only; underlying series data and aggregation stay in kilograms.

The toggle SHALL be the same control as the per-exercise toggle in `portal-exercise-display`. It has the same appearance, a minimum height of 32px, a minimum width of 44px, and the same pressed-state transition.

#### Scenario: Switching the chart to lb
- **WHEN** the client selects lb on the Peso chart
- **THEN** point values, tooltip, and unit label render converted to lb (1-decimal rounding), and the stored data remains kg

#### Scenario: Toggle hidden for non-weight metrics
- **WHEN** the selected metric is reps (`reps_done`)
- **THEN** no unit toggle is shown

#### Scenario: Aggregation stays canonical
- **WHEN** a day has several sets and the chart shows lb
- **THEN** the day's average is computed in kg first and converted for display, giving the same point as converting after aggregation

#### Scenario: Toggle control height
- **WHEN** the Desempeño view renders the Peso chart on mobile
- **THEN** each `kg` / `lb` button is at least 32px tall and at least 44px wide

#### Scenario: Pressed state animates like the log-time toggle
- **WHEN** the client switches the Desempeño toggle from kg to lb
- **THEN** the pressed-state change animates, the same way it does on `/portal/today`, instead of snapping

### Requirement: The progress chart's line meets the graphical-object contrast floor

The client's progress chart in Desempeño SHALL draw its line and point outlines with a token defined in `app/globals.css`, never a hand-written hex. That token SHALL reach at least 3:1 contrast against `--gris-claro`, per WCAG 1.4.11.

#### Scenario: Line and points clear the floor
- **WHEN** the progress chart renders with at least one data point
- **THEN** the line stroke and each point's outline use a token that clears 3:1 against `--gris-claro`

#### Scenario: No raw hex stroke
- **WHEN** the progress chart component is inspected
- **THEN** neither the line stroke nor the point stroke is a literal hex value

### Requirement: Exercise chips follow chronological template order
The Desempeño view SHALL list its exercise selector chips in the order the exercises first appear in the client's program during the current month. Days are taken oldest log first. Within a day, blocks follow their authored order, and exercises follow their authored order inside each block. An exercise that appears again on a later day keeps the position from its first appearance. The order SHALL NOT depend on exercise identifiers or on how the logged data happens to be stored.

#### Scenario: Chips match the authored order of a single day
- **WHEN** the client's only log this month is for a day whose exercises are authored as "1. A", "2. B", "3. C", with ids that sort in reverse
- **THEN** the chips read "1. A", "2. B", "3. C"

#### Scenario: Blocks are taken in authored order
- **WHEN** a logged day has two exercise lists, the one authored first holding "X" and the one authored second holding "Y"
- **THEN** the chip for "X" comes before the chip for "Y"

#### Scenario: Later days append their new exercises
- **WHEN** the first log of the month covers a day with "A", "B" and a later log covers a day with "C", "A"
- **THEN** the chips read "A", "B", "C"

#### Scenario: An earlier day wins regardless of weekday
- **WHEN** the client's oldest log this month is a Thursday day holding "T" and a later log is a Monday day holding "M"
- **THEN** the chip for "T" comes before the chip for "M"
