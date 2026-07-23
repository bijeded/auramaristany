# portal-performance-display

## Requirements

### Requirement: Weight chart display unit toggle
The Desempeño performance view SHALL offer a `kg | lb` display toggle when the selected metric is weight (`weight_kg`). Default is kg. The toggle converts chart values, axis and tooltip labels at render time only; underlying series data and aggregation stay in kilograms.

#### Scenario: Switching the chart to lb
- **WHEN** the client selects lb on the Peso chart
- **THEN** point values, tooltip, and unit label render converted to lb (1-decimal rounding), and the stored data remains kg

#### Scenario: Toggle hidden for non-weight metrics
- **WHEN** the selected metric is reps (`reps_done`)
- **THEN** no unit toggle is shown

#### Scenario: Aggregation stays canonical
- **WHEN** a day has several sets and the chart shows lb
- **THEN** the day's average is computed in kg first and converted for display, giving the same point as converting after aggregation
