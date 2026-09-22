# Spec Delta

## Purpose

Makes the date in the client portal's page header always today's real date, in one format, on every portal page that shows today in its header.

## ADDED Requirements

### Requirement: Portal headers show the current real date

Every portal page whose header shows today's date SHALL show the current real date. That is Hoy, Semana, Pilares, Mi progreso, Mensajes, a single message, and Ajustes. The date SHALL be formatted as the weekday, day and month in Mexican Spanish with the first letter capitalized and no year, e.g. "Lunes, 8 de junio". The header SHALL NOT follow a development date override: in local development with a simulated date set, the header still shows the real date. A page whose header labels a different day, such as a past day in the history detail, keeps that day's date.

#### Scenario: Header shows today
- **WHEN** a client opens any of the seven portal pages on 8 June
- **THEN** the header reads "Lunes, 8 de junio"

#### Scenario: Development date override is ignored by the header
- **WHEN** the app runs locally with a simulated date different from the real date
- **THEN** every one of the seven headers shows the real date, while the day's content keeps following the simulated date

#### Scenario: All headers agree
- **WHEN** a client moves between the seven portal pages within the same day
- **THEN** every header shows the same date string

#### Scenario: A past-day header is unchanged
- **WHEN** a client opens a past day from their history
- **THEN** the header shows that day's date, not today's

### Requirement: The header date is decided on the server

The header date SHALL be computed when the page is rendered on the server and delivered with the page. It SHALL NOT be recomputed in the browser. This way the server-rendered page and the hydrated page always show the same string.

#### Scenario: No hydration mismatch on the header
- **WHEN** a portal page with an interactive view is server-rendered and then hydrated in the browser
- **THEN** the header date the client sees does not change during hydration
