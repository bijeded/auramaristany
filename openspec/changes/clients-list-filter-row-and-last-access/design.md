## Context

`/admin/clients` renders through one client component, `components/admin/ClientsTable.tsx`, fed by a Server Component page that calls `getClientsList()` and passes `rows`, `now` (server date-only, from `serverToday()`), and `initialStatus` (parsed from `?status=`).

Two facts shape this design:

1. **The data for "Último acceso" already exists.** `ClientListRow.last_activity_date` is computed in `getClientsList` as `max(progress_logs.log_date)` and already drives the "Sin actividad" filter and the A4 inactivity cron. This change is rendering-only — no migration, no query, no type change.
2. **The status filter set is already centralised.** `STATUS_FILTERS` is exported from `lib/admin/clients-helpers.ts` and consumed by both the pills and `parseStatusFilter`. Swapping the control must not fork that list.

## Goals / Non-Goals

**Goals**
- Filter row fits one line and stays that way as programs are added.
- Inactivity becomes visible while scanning, not only when deliberately filtered.
- Table and CSV agree on what columns exist.
- Exactly one definition of "inactive" continues to serve the filter, the cron, and now the column.

**Non-Goals**
- Changing *which* clients match a filter. `filterClients` is untouched.
- Touching `PaymentsTable`, which shares the `.pill` pattern. Left deliberately inconsistent for now; a follow-up backlog item, not this change.
- Sorting by last access, or making the column clickable.
- Reworking the program pills beyond removing the divider `<span>`.

## Decisions

### Status filters → one `<select>`, program filters stay pills

The wrap is caused by 11 controls in a 1040px row. Collapsing the seven status filters into one select removes the wrap at its source and makes the row insensitive to how many programs exist — the program list is derived from data (`new Set(rows.map(r => r.program_name))`), so it can grow.

```
BEFORE                                                    AFTER
[Todas][CuarentaMás][+2] │ [Activas][Vencidas][+3]        [Todas][CuarentaMás][CuarentaMás Extra][Strong & Fit]  [Estado ▾]
[En cancelación][Sin actividad]              ← wraps
```

The divider `<span>` is removed: with two visibly different control types, it no longer carries information.

**Alternative rejected:** two labelled rows ("Programa" / "Estado"). It makes the wrap look intentional but keeps two rows, and the dropdown's usual cost — losing at-a-glance visibility of the "Sin actividad" cohort — is repaid by the new column, which surfaces quiet clients in the table itself. The two halves of this change are what make each other affordable.

### Options come from `STATUS_FILTERS`, plus exactly one sentinel

Framework review rule 8: *an options list rendered by a component comes entirely from one exported constant*. The D19 defect was a hand-written option sitting beside a mapped list, letting the UI offer a value the DB could not store.

Here the mapped list is `STATUS_FILTERS`. The one hand-written option is legitimate and must be the **only** one:

```
<option value="">Todos los estados</option>     ← the null sentinel; not a filter value
{STATUS_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
```

`""` maps to `null` on change; every non-empty value is already a `StatusFilter` literal. The select's `value` is `estado ?? ""`, which makes the control a pure function of state and gives the deep-link case its behaviour for free.

### Deep links keep working via `value`, not an effect

`initialStatus` already seeds `useState`. Because the select is controlled by `estado ?? ""`, an arrival at `?status=Último mes` renders the select already showing "Último mes" — no `useEffect`, no separate synchronisation path. `parseStatusFilter` continues to reject unknown values to `null`, so a bad URL shows "Todos los estados" and an unfiltered list.

This is the piece most likely to be silently dropped, so it gets its own verification step: the dashboard's "Terminan" and "Cancelaciones" cards must still land on a visibly-filtered list.

### Toggle-off becomes the sentinel option

Today: `onClick={() => setEstado(estado === f ? null : f)}` — re-clicking clears. A select has no such gesture, so "Todos los estados" *is* the clear. `resetPage` still wraps the setter so changing the filter returns to page 1, and the "Limpiar filtros" button in the empty state already calls `setEstado(null)` and needs no change.

### `relativeDayLabel` is a new pure helper next to `dayLabel`

`lib/admin/date-helpers.ts` already holds `dayLabel`, `monthLabel`, `weekdayLabel`, `longDateLabel` — all pure, all `es-MX`, all taking an ISO string. `relativeDayLabel(iso, now)` joins them.

It takes `now` explicitly rather than reading the clock, matching `isInactive(lastActivityDate, now, thresholdDays)` and the `now` prop the component already receives from the server. A helper that reads `Date.now()` would disagree with the filter it sits next to whenever the browser's timezone differs from the server's date-only "today".

```
relativeDayLabel(iso, now):
  0 days  → "hoy"
  1 day   → "ayer"        ← never "hace 1 días"
  N days  → "hace N días"
```

The "ayer" case is the whole reason this is a helper with tests rather than an inline template string.

### The cell is two lines, reusing the table's existing pattern

"Programa" and "Cobro / acceso" already render two-line cells (a primary line plus a smaller muted line). "Último acceso" follows that shape: relative label on top for scanning, `dayLabel(...)` beneath for the exact date.

```
Estado        Último acceso
[Activa]      hace 3 días
              27 jul 2026

[Activa]      hace 21 días     ← marked
              9 jul 2026

[Activa]      Sin registros    ← marked
```

### `null` reads "Sin registros", not "—"

An em-dash means "we don't know". We do know: this client has no rows in `progress_logs`. `isInactive` already treats `null` as inactive, so the cell is marked like any other quiet client, and the wording tells Aura which kind of quiet it is — never started, versus stopped.

### The mark reuses `isInactive`, and its colour is a token

The component calls `isInactive(c.last_activity_date, now, INACTIVITY_THRESHOLD_DAYS)` — the same call the "Sin actividad" filter makes. No inline `daysBetween(...) >= 10` at the render site: that would be a fourth reader of the threshold and the exact shape of defect the framework rules exist to prevent.

Per D23, the colour comes from a token in `app/globals.css`. If no token expresses "needs attention / quiet", one is added there rather than a hex literal being written into the component — a missing token is a gap in the token system, not a licence to inline. Contrast must clear 4.5:1 for this text size.

### CSV gains the column in the same position

`clientsToCSV` currently emits `Nombre,Email,Programa,Variante,Estado,Inscripción`. "Último acceso" is appended so that the header and the row array stay index-aligned — the two are positional and a mismatch is silent.

The exported value is the **raw `last_activity_date`** (`YYYY-MM-DD`), empty for `null`. Spreadsheets sort and filter raw dates; "hace 21 días" is a presentation string that would be frozen at export time and become wrong the next day. Presentation belongs in the table, data belongs in the export.

## Risks / Trade-offs

- **Losing the "Sin actividad" pill's visibility.** Mitigated by design: the new column shows the same signal on every row, so the filter becomes the drill-down rather than the discovery path. Worth confirming with Aura at smoke time that she can still find the filter.
- **Table width.** A seventh column inside `maxWidth: 1040`, next to a right-aligned delete button. The dropdown frees space in the *filter* row, not the table. Verify on the Preview URL; if it's tight, widen the container rather than truncating "Cobro / acceso", which carries price information.
- **Select tap target.** Buttons ≥48px / tap targets ≥44px is the project floor, with one documented exception (the kg/lb toggle) that this change does not extend. The select must be sized to clear the floor; the pills it replaces do not currently, so this is an improvement, not a regression to defend.
- **`relativeDayLabel` vs. timezone.** Taking `now` as a parameter removes the class of bug entirely, at the cost of every caller having to pass it. The component already has `now` as a prop.

## Migration Plan

None. No schema change, no data backfill, no feature flag. The change is additive at the row level and swaps one control for another; a deploy is complete on merge, and reverting is a straight revert.

## Open Questions

- Does a suitable "quiet / needs attention" colour token already exist in `app/globals.css`, or does this change add one? Resolved during implementation by reading the token block — the answer changes a task, not the design.
- Exact container width after the seventh column lands. Deliberately deferred to visual verification on the Preview URL rather than guessed here.
