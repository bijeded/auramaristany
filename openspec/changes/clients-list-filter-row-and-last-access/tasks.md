## 1. Pure helper: relativeDayLabel

- [ ] 1.1 Write failing tests for `relativeDayLabel(iso, now)` in the date-helpers test file: "hoy" when `iso === now`, "ayer" at exactly 1 day, "hace 21 días" at 21 days, and an explicit assertion that "hace 1 días" is never emitted
- [ ] 1.2 Add a test that `relativeDayLabel` tolerates a full ISO timestamp as well as a date-only string, matching `dayLabel`'s existing `split("T")` behaviour
- [ ] 1.3 Implement `relativeDayLabel` in `lib/admin/date-helpers.ts` next to `dayLabel`, taking `now` as an explicit parameter and never reading the clock; tests green

## 2. CSV export

- [ ] 2.1 Write a failing test for `clientsToCSV`: the header ends with "Último acceso" and a row carries the client's raw `last_activity_date`
- [ ] 2.2 Write a failing test that a client with `last_activity_date: null` exports an empty cell in that column
- [ ] 2.3 Add the column to `clientsToCSV` in `lib/admin/clients-helpers.ts`, appending to both the header string and the row array so the two stay index-aligned; tests green

## 3. Inactivity colour token

- [ ] 3.1 Read the token block in `app/globals.css` and determine whether an existing token expresses "quiet / needs attention" at sufficient contrast
- [ ] 3.2 If none fits, add a new token to `app/globals.css` (no hex literal in the component, per D23) and verify it clears 4.5:1 against the row background at the cell's text size

## 4. Status filter: pills → select

- [ ] 4.1 Replace the seven status pills in `components/admin/ClientsTable.tsx` with a single `<select>` whose options are `STATUS_FILTERS.map(...)` plus exactly one hand-written `<option value="">Todos los estados</option>` sentinel — no other literal option (framework review rule 8)
- [ ] 4.2 Control the select with `value={estado ?? ""}` and an `onChange` that maps `""` back to `null`, wrapped in the existing `resetPage` so changing the filter returns to page 1
- [ ] 4.3 Remove the divider `<span>` between the two filter groups; keep the program pills as pills
- [ ] 4.4 Size the select to clear the project's ≥44px tap-target floor (the kg/lb exception does not extend here)
- [ ] 4.5 Confirm the empty-state "Limpiar filtros" button still resets the select (it already calls `setEstado(null)` — verify, don't assume)

## 5. "Último acceso" column

- [ ] 5.1 Add the `Último acceso` header between "Estado" and the empty delete-column header in the `<thead>` label array
- [ ] 5.2 Add the matching `<td>` in the same position in the row, rendering a two-line cell in the style already used by "Programa" and "Cobro / acceso": `relativeDayLabel(c.last_activity_date, now)` above `dayLabel(c.last_activity_date)`
- [ ] 5.3 Render "Sin registros" with no date line when `last_activity_date` is `null`
- [ ] 5.4 Apply the marked style when `isInactive(c.last_activity_date, now, INACTIVITY_THRESHOLD_DAYS)` is true — call the shared helper, never an inline day comparison at the render site
- [ ] 5.5 Verify header and cell counts match across `<thead>` and `<tbody>` (7 columns), since the header is rendered from an array and a mismatch is silent

## 6. Verification

- [ ] 6.1 Run `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, and `npm run build` — all green against the documented baseline
- [ ] 6.2 On the Preview URL, confirm the filter row occupies a single line and check whether the seventh column forces the `maxWidth: 1040` container to widen; adjust the container rather than truncating "Cobro / acceso"
- [ ] 6.3 On the Preview URL, click through from the dashboard's "Terminan (próx. 7 días)" and "Cancelaciones (próx. 7 días)" cards and confirm the client list opens with the cohort **visibly selected** in the select and the list actually filtered (D17 deep link — the regression most likely to slip through)
- [ ] 6.4 Confirm `/admin/clients?status=noExiste` shows "Todos los estados" and an unfiltered list
- [ ] 6.5 Spot-check the column against real demo data: a recently active client, a client quiet past 10 days (marked), and a client who never logged ("Sin registros", marked)
- [ ] 6.6 Export the CSV and confirm the "Último acceso" column is present, holds raw dates, and is empty for never-logged clients

## 7. Close out

- [ ] 7.1 Note in the PR that `PaymentsTable` still uses the old pill pattern and was left untouched by decision, and add a backlog row for reconciling it
- [ ] 7.2 Run `/opsx:sync` and `openspec validate`, then archive the change
