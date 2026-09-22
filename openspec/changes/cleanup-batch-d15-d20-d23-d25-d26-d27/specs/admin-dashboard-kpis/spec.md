# Spec Delta

## ADDED Requirements

### Requirement: The revenue chart's bars meet the graphical-object contrast floor

The dashboard's monthly revenue chart SHALL fill its bars with a token defined in `app/globals.css`, never a hand-written hex. The fill SHALL reach at least 3:1 contrast against both the chart's surface and the `--gris-claro` track color, per WCAG 1.4.11. Contrast is measured the way `docs/adr/0005-bar-fill-contrast-measured-against-the-track.md` prescribes, and meeting the stricter of the two surfaces meets both.

#### Scenario: Revenue bars clear the floor
- **WHEN** the revenue chart renders
- **THEN** its bars are filled with a token that clears 3:1 against `--gris-claro`

#### Scenario: No raw hex fill
- **WHEN** the revenue chart component is inspected
- **THEN** its bar fill is not a literal hex value
