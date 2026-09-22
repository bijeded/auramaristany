## MODIFIED Requirements

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
