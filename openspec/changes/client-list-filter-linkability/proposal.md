# Proposal

## Why

Backlog D24 (deferred from the D17 review). `ClientsTable` seeds `useState` from `initialStatus`, so `?status=` is read once: a soft navigation between two `?status=` URLs that keeps the table mounted ignores the new value, and changing a filter never updates the URL. The filter is linkable in neither direction. The program pills have the same write-only behaviour, and have no URL parameter at all.

## What Changes

- The status select and the program pills are driven by the URL (`?status=`, `?program=`) instead of by local component state.
- Changing either filter updates the URL with `router.replace` (no new history entry per click); choosing the unfiltered value removes its parameter.
- A URL change while the table stays mounted (soft navigation, back/forward) re-applies the filters.
- A `program` value that names no program in the current data falls back to "Todas", mirroring how an invalid `status` falls back to unfiltered.
- "Limpiar filtros" clears both parameters.
- Pagination resets to page 1 whenever the applied filters change, as it does today on a click.

**Non-goals** (the scope is the two filters D24 names — no more):
- The search box (`q`) and the page number stay local state and are not written to the URL.
- No change to which clients each filter matches, to `STATUS_FILTERS`, or to the options offered.
- No change to the dashboard deep links (`/admin/clients?status=…`) — they keep working unchanged.
- `PaymentsTable` (D31) is not touched.

## Capabilities

### New Capabilities
_None._

### Modified Capabilities
- `admin-clients-list`: the status and program filters become two-way bound to the URL query string.

## Impact

- `components/admin/ClientsTable.tsx` — filter state read from `useSearchParams`, written via `router.replace`; `initialStatus` prop removed.
- `app/admin/clients/page.tsx` — stops parsing `searchParams` (the client component owns it).
- `lib/admin/clients-helpers.ts` — new pure helpers: parse the program param, build the filter query string. Tests in `__tests__/clients-helpers.test.ts`.

**Review rules touched:** 8 (options list stays sourced entirely from `STATUS_FILTERS`; the URL and the select keep sharing the one `parseStatusFilter`), 20 (`initialStatus` is retired — check `docs/adr/` for mentions during apply).

**Sensitive surface:** none — no auth, RLS, service-role, webhooks, money, or migrations. **Fan-out:** none. So no `/security-review`; verification beyond CI is a read-only manual smoke on the Preview URL.
