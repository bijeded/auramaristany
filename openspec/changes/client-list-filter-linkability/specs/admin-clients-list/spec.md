## ADDED Requirements

### Requirement: Client-list filters are reflected in the URL

The status filter and the program filter on the client list SHALL be represented in the page URL as the `status` and `program` query parameters, so that the URL always describes the filters currently applied. Changing either filter SHALL update the URL without adding a browser history entry. Choosing the unfiltered value of a filter ("Todos los estados", or the "Todas" program pill) SHALL remove that filter's parameter from the URL. The search text and the page number are not part of the URL.

#### Scenario: Selecting a status updates the URL
- **WHEN** the admin selects "Activas" in the status filter
- **THEN** the URL carries `status=Activas` and the list shows only active clients

#### Scenario: Selecting a program updates the URL
- **WHEN** the admin selects a program pill while `status=Activas` is applied
- **THEN** the URL carries `program=<that program's name>` and still carries `status=Activas`

#### Scenario: Clearing a filter removes its parameter
- **WHEN** `status=Activas` and a program are applied and the admin chooses "Todos los estados"
- **THEN** the URL no longer carries a `status` parameter and the `program` parameter is kept

#### Scenario: Filter changes do not pile up history
- **WHEN** the admin opens the client list, changes the status filter three times, and presses the browser's back button
- **THEN** the browser returns to the page visited before the client list, not to an earlier filter value

#### Scenario: Limpiar filtros clears the URL
- **WHEN** both filters are applied, no client matches, and the admin clicks "Limpiar filtros"
- **THEN** neither `status` nor `program` remains in the URL and all clients are shown

#### Scenario: Copied URL reproduces the view
- **WHEN** the admin copies the URL of a filtered client list and opens it in a new tab
- **THEN** the same status and program filters are applied and shown on their controls

### Requirement: Client-list filters follow URL changes while mounted

When the `status` or `program` query parameter changes while the client list is already displayed — a link to another filtered client-list URL, or browser back/forward — the list SHALL apply the new values, and their controls SHALL display them, without a full page reload. When the applied filters change, the list SHALL return to its first page.

#### Scenario: Soft navigation between two filtered URLs
- **WHEN** the client list is showing `status=Último mes` and the admin navigates in-app to `/admin/clients?status=En cancelación`
- **THEN** the status select shows "En cancelación" and the list shows only that cohort

#### Scenario: Filter change resets pagination
- **WHEN** the admin is on page 2 of the list and the status filter changes
- **THEN** the list shows page 1 of the newly filtered results

### Requirement: Invalid program parameter leaves the program filter unset

A `program` query parameter that names no program present in the client list SHALL be ignored: the "Todas" pill SHALL be the one reported as pressed and the list SHALL NOT be filtered by program. This mirrors the existing handling of an invalid `status` parameter.

#### Scenario: Unknown program
- **WHEN** the client list is opened with `program=NoExiste`
- **THEN** "Todas" is pressed and clients of every program are shown
