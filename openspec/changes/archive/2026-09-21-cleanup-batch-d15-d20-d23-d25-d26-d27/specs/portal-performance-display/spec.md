# Spec Delta

## ADDED Requirements

### Requirement: The progress chart's line meets the graphical-object contrast floor

The client's progress chart in Desempeño SHALL draw its line and point outlines with a token defined in `app/globals.css`, never a hand-written hex. That token SHALL reach at least 3:1 contrast against `--gris-claro`, per WCAG 1.4.11.

#### Scenario: Line and points clear the floor
- **WHEN** the progress chart renders with at least one data point
- **THEN** the line stroke and each point's outline use a token that clears 3:1 against `--gris-claro`

#### Scenario: No raw hex stroke
- **WHEN** the progress chart component is inspected
- **THEN** neither the line stroke nor the point stroke is a literal hex value
