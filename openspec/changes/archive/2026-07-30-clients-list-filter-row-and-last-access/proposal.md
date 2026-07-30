## Why

The `/admin/clients` filter row now renders 11 pills (4 program + 7 status) inside a 1040px container, so it wraps to two lines at an arbitrary point — mid-way through the status group, orphaning the divider that was the only hint the two groups are different things. It reads as a rendering bug rather than a layout. The program list is derived from the data, so a fifth program makes it worse on its own.

Separately, Aura's recurring question when scanning this list is "who has gone quiet?" — and the answer already exists on every row (`last_activity_date`) but is only reachable by deliberately clicking the "Sin actividad" filter. Surfacing it as a column turns a drill-down into something she sees while scanning for anything else.

## What Changes

- **Status filters become a single `<select>`.** The seven status/cohort filters ("Activas", "Vencidas", "Canceladas", "Completadas", "Último mes", "En cancelación", "Sin actividad") collapse into one dropdown, so the filter row fits on one line. Program filters stay as pills. The divider `<span>` goes away.
  - Options are generated **only** from the exported `STATUS_FILTERS` constant, plus a single "Todos los estados" option representing the `null` (no filter) sentinel. No hand-written option may duplicate a filter value (framework review rule 8).
  - **BREAKING (interaction only, no API):** re-clicking an active filter to clear it no longer exists — selecting "Todos los estados" is the clear. "Limpiar filtros" continues to reset it.
  - The D17 deep-link path (`/admin/clients?status=…` from the dashboard's "Terminan" / "Cancelaciones" cards) must preselect the select **and** visibly show the active cohort on arrival.
- **New "Último acceso" column**, positioned after "Estado" and before the delete-action column. Two-line cell: relative recency on top ("hace 21 días"), absolute date below ("9 jul 2026"). Renders "Sin registros" when `last_activity_date` is `null` — the client has never logged, which is known information, not missing information.
- **The column visually marks inactive clients**, reusing `isInactive(…, INACTIVITY_THRESHOLD_DAYS)` — the same derivation behind the "Sin actividad" filter and the A4 inactivity cron, so the threshold keeps exactly one definition. The tint comes from a token in `app/globals.css`; if no suitable token exists the change adds one (D23 — a raw hex in a component means the token system had a gap).
- **New pure helper `relativeDayLabel(iso, now)`** in `lib/admin/date-helpers.ts`, alongside `dayLabel`: "hoy" / "ayer" / "hace N días". Never emits "hace 1 días".
- **CSV export gains an "Último acceso" column** (`clientsToCSV`), so what Aura sees is what she can export.

Explicitly out of scope: `PaymentsTable`, which uses the same `.pill` pattern and is left untouched.

## Capabilities

### New Capabilities

None. Every behavior here extends or amends the existing client-list capability.

### Modified Capabilities

- `admin-clients-list`: the status filter group changes control type from an exclusive pill group to a single select, which amends the interaction clauses in three existing requirements ("Sin actividad" filter, cohort filter pills, and their shared exclusivity/re-click-to-clear semantics). Adds a requirement for the rendered "Último acceso" column, its `null` and inactive-marking behavior, and its presence in the CSV export.

## Impact

- `components/admin/ClientsTable.tsx` — filter row markup, new `<th>` / `<td>`, select wiring for `initialStatus`.
- `lib/admin/clients-helpers.ts` — `clientsToCSV` header and row (`STATUS_FILTERS` itself is unchanged and remains the single source for the options).
- `lib/admin/date-helpers.ts` — new `relativeDayLabel`.
- `app/globals.css` — possible new token for the inactivity tint.
- `__tests__/clients-helpers.test.ts` and `__tests__/date-helpers.test.ts` (or equivalent) — CSV column and the new helper.

**No migration. No query change. No new field.** `getClientsList` already returns `last_activity_date` on every row; this change only renders and exports what is already there. `parseStatusFilter` already validates the URL value against `STATUS_FILTERS` and needs no change.

Filter semantics are unchanged: which clients match a given filter is still decided entirely by `filterClients`. Only the control that selects the filter changes.
