# Spec Delta

## Purpose

Guarantees that every admin screen verifies on the server that the requester is an authenticated admin before rendering, so the admin area does not depend on middleware as its only gate.

## ADDED Requirements

### Requirement: The admin area is guarded server-side at the layout

Every route under `/admin` SHALL verify on the server, before rendering the admin shell, that the request comes from an authenticated user whose profile role is `admin`. A request that fails the check SHALL be redirected to `/portal/today` and SHALL NOT receive the admin sidebar or any page content.

#### Scenario: Admin opens an admin screen
- **WHEN** an authenticated admin requests `/admin/content`
- **THEN** the page renders with the admin sidebar, and "Contenido" is the highlighted item

#### Scenario: Middleware does not intercept a non-admin
- **WHEN** a request by an authenticated client (role `client`) reaches `/admin/content` without being redirected by middleware
- **THEN** the server redirects it to `/portal/today` and no admin content is returned

### Requirement: Every admin page guards itself

Every admin page that renders data SHALL perform the same server-side admin check itself, independently of the layout. A page whose only behavior is an unconditional redirect to another admin route, rendering nothing, is exempt.

#### Scenario: Deep content editor page
- **WHEN** a non-admin request reaches `/admin/content/<programId>/series/<seriesId>/days/<dayId>` without being redirected by middleware or the layout
- **THEN** the page redirects to `/portal/today` before loading any content

#### Scenario: A new admin page is added without the guard
- **WHEN** a page that renders data is added under `app/admin/` without the admin check
- **THEN** the test suite fails, naming that page

### Requirement: The admin sidebar behaves as before

The admin sidebar SHALL keep its items, order, labels, active-item highlighting and logout control unchanged.

#### Scenario: Navigating between admin sections
- **WHEN** an admin moves from Dashboard to Clientes
- **THEN** "Clientes" becomes the highlighted item and "Dashboard" is no longer highlighted
