## MODIFIED Requirements

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
