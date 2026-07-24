## Why

Aura needs to spot paying clients who have gone quiet so she can reach out before they churn. Today `/admin/clients` can only filter by subscription status (Activas/Vencidas/Canceladas) — there is no way to surface active clients who have stopped logging their training. This also builds the reusable "last activity" signal that the future A4 automated-nudge cron will depend on.

## What Changes

- Add a 4th **"Sin actividad"** pill to the client list filters, in the same exclusive group as Activas/Vencidas/Canceladas.
- Define "sin actividad" as: an **active or trialing** subscription whose most recent `progress_logs.log_date` is **≥10 days** ago — a client who has **never** logged (no logs at all) also counts as inactive.
- Expose a reusable **`last_activity_date`** (max `progress_logs.log_date` per client) on each client row — the durable signal A4 will reuse with its own threshold.
- Add a pure, tested `isInactive(lastActivityDate, now, thresholdDays)` helper; the reference `now` is provided by the server (DEV_DATE-aware) so the filter never depends on the browser clock.
- Extend the pure `filterClients` helper, the `StatusFilter` type, and `STATE_FILTERS` to carry the new pill; wire it into `ClientsTable` (including the "Limpiar filtros" reset).

No new dependency, no migration (read-only aggregation over existing `progress_logs`).

## Capabilities

### New Capabilities
- `admin-clients-list`: The admin client-list view — its filter pills (status + activity), the last-activity signal, and how inactivity is defined and computed.

### Modified Capabilities
<!-- None — no existing spec covers the clients list; behavior is captured as a new capability. -->

## Impact

- **Code:** `lib/admin/clients-helpers.ts` (`StatusFilter`, `filterClients`, new `isInactive`, `ClientListRow.last_activity_date`), `lib/admin/clients-queries.ts` (`getClientsList` nested `progress_logs` embed + server `now`), `components/admin/ClientsTable.tsx` (4th pill + reset), `app/admin/clients/page.tsx` (pass server `now`).
- **Tests:** update existing `filterClients` tests; new AAA tests for `isInactive` (never-logged, 9/10/11-day boundary) and for the new pill in `filterClients`.
- **Data/APIs:** read-only; no migration, no schema change, no new RLS. Reads `progress_logs` via the existing admin RLS path.
- **Downstream:** `last_activity_date` is the shared signal for A4 (automated messages).
