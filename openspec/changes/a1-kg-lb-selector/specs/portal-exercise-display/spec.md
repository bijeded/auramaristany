# portal-exercise-display — delta

## ADDED Requirements

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
