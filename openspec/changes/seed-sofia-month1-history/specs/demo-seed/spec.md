# Spec Delta

## ADDED Requirements

### Requirement: Month-1 history follows the portal's day grid
The seed SHALL give Sofía Ramírez (`sofia.ramirez@test.aura.mx`) an active month-1 subscription whose period started 25 days before the run date. For each past date in that period (from `current_period_start` up to but excluding today), any log written SHALL reference the Mes 1 program day that the portal resolves for that date, and SHALL carry that date as its `log_date`. No log SHALL be dated before `current_period_start`, on today, or after today.

#### Scenario: Log matches the portal's cell for its date
- **WHEN** the seed has run and a log for Sofía is dated D
- **THEN** its program day is the Mes 1 day at week `floor((D - current_period_start)/7) + 1` and D's weekday, which is the day `/portal/today` would have shown on D

#### Scenario: Week 4 dates do not wrap
- **WHEN** a date is 21–24 days after `current_period_start`
- **THEN** its log references a week-4 day, never week 1 or a previous period

#### Scenario: Today is not pre-logged
- **WHEN** Sofía opens `/portal/today` after a seed run
- **THEN** today's workout has no existing log

### Requirement: Rest days and missing content are never logged
The seed SHALL NOT write a log for a Sunday, for a cell with no published program day, or for a program day with no `exercise_list` exercises.

#### Scenario: Descanso Activo stays empty
- **WHEN** the seeded history is listed
- **THEN** no entry is dated on a Sunday

### Requirement: Logged content comes from the captured program
Each exercise entry in a log SHALL be keyed by an exercise id that exists in that day's `exercise_list` blocks at seed time. It SHALL hold at most as many series as the exercise prescribes sets, and SHALL fill only the metrics the exercise declares. The seed SHALL NOT write to any catalog table.

#### Scenario: Aura edits Mes 1 and the seed is re-run
- **WHEN** Aura renames or replaces an exercise in Mes 1 and the seed runs again
- **THEN** Sofía's history shows the current exercise and no entry references the removed one

#### Scenario: Metrics respect the exercise
- **WHEN** an exercise declares only `reps_done`
- **THEN** its logged series carry no `weight_kg`

### Requirement: History reads as a realistic first month
Of Sofía's loggable days, the seed SHALL leave 2 or 3 unlogged (skipped) and SHALL log 1 or 2 as partial (not every exercise completed). All remaining loggable days SHALL be fully completed. For each exercise logged in more than one week, the logged values SHALL NOT decrease from its first logged week to its last. The outcome SHALL be the same on every run relative to the period start.

#### Scenario: Performance chart shows a trend
- **WHEN** Sofía opens Desempeño for an exercise that is logged in several weeks
- **THEN** the chart shows several points and the last is not lower than the first

#### Scenario: Historial shows a mix of outcomes
- **WHEN** Sofía opens Historial
- **THEN** the entries include fully completed days, at least one partial day, and gaps where days were skipped
