# Proposal: a12-portal-week-calendar

## Why

Clients can only see today's activity (`/portal/today`) and their past (`/portal/history`); they have no visibility into what is coming, which Aura flagged as feedback (backlog **A12**). A read-only 7-day preview lets clients plan their week without violating the "no access to future days" rule, because it shows **titles only** with no navigation into future activities.

## What Changes

- New portal route `/portal/semana`: a read-only list of **up to 8 rows** — today (linked to `/portal/today`) plus the next 7 days (inert, titles only).
- The window is **cut at the current billing period**: future days whose real date is on or after `current_period_end` are dropped (not yet paid for), so the list shrinks near renewal.
- Days past day 28 but still inside the period **repeat week 4** (same clamp `/portal/today` already applies).
- Days with no `program_day` row render as rest days ("Descanso"). Unpublished days also render as "Descanso": the `program_days` RLS policy (`published = true or is_admin()`) filters them at the DB boundary, and we keep RLS as the security boundary (decision revisited during smoke).
- New pure helper in `lib/content/access.ts` to generate the upcoming day keys (TDD) + new server query in `lib/content/queries.ts` for batch title reads.
- `PortalNav` gains a "Semana" tab (icon `CalendarDays`) between "Hoy" and "Pilares"; "Hoy" changes icon to `Sun`; "Configuración" is renamed to "Perfil" (icon `Settings` → `User`) to fit the 6-tab row. Fallback if 6 tabs still break on 375px: move "Perfil" to the top bar (right), date centered.

## Capabilities

### New Capabilities
- `portal-week-calendar`: read-only 7-day upcoming view — window computation (period cut, week-4 clamp), row content (titles, rest days, unpublished visibility), navigation rules (today linked, future inert), and nav integration.

### Modified Capabilities

<!-- none — existing specs (portal-exercise-display, portal-performance-display, admin-*) are unaffected -->

## Impact

- **New:** `app/portal/semana/page.tsx`, week-calendar components under `components/portal/`.
- **Modified:** `lib/content/access.ts` (pure helper + tests), `lib/content/queries.ts` (new query; first consumer of `subscriptions.current_period_end`), `components/portal/PortalNav.tsx` (5→6 tabs, icon swap).
- **No migration, no RLS change** — reads go through the existing owner RLS path.
- Tests: new Vitest suites for the pure window helper; baseline 252 must stay green.
