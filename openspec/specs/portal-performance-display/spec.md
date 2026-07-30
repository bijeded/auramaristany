# portal-performance-display

## Purpose

Defines the Desempeño view, where the client sees her own progress over time for a chosen exercise and metric, plus the "Historial de ejercicios" list of her logged days. Presentation converts but never mutates: the `kg | lb` toggle re-renders chart values, axis and tooltip labels at display time only, while the underlying series and every aggregation stay in canonical kilograms — a day's average is computed in kg and converted after, never the reverse.

## Requirements

### Requirement: Weight chart display unit toggle
The Desempeño performance view SHALL offer a `kg | lb` display toggle when the selected metric is weight (`weight_kg`). Default is kg. The toggle converts chart values, axis and tooltip labels at render time only; underlying series data and aggregation stay in kilograms.

The toggle buttons SHALL render at a minimum height of 32px and a minimum width of 44px, matching the per-exercise toggle in `portal-exercise-display`. Both copies of this control MUST stay dimensionally identical; if they ever diverge, that is a defect, not a local styling choice.

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
- **THEN** each `kg` / `lb` button is at least 32px tall and at least 44px wide, visually identical to the toggle on `/portal/today`

