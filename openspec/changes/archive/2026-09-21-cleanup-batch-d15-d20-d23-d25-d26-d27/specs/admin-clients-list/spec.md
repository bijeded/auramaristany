# Spec Delta

## ADDED Requirements

### Requirement: Program filter pills expose their pressed state

Each program filter pill on the client list SHALL expose whether it is the active filter to assistive technology, not only through visual styling. Exactly one program pill SHALL be reported as pressed at any time.

#### Scenario: Default state
- **WHEN** the client list first renders
- **THEN** the "Todas" pill is reported as pressed and every other program pill as not pressed

#### Scenario: Selecting a program
- **WHEN** the admin selects a program pill
- **THEN** that pill is reported as pressed and the previously active one as not pressed
