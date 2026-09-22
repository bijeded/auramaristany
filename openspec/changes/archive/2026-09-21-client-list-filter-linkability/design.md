# Design

## Context

See proposal.md → Why. `ClientsTable` is a client component holding `q`, `prog`, `estado`, `page` in `useState`; the server page parses `?status=` once via `parseStatusFilter` and passes `initialStatus`. The dashboard builds `/admin/clients?status=<label>` (`app/admin/dashboard/page.tsx:96`).

## Goals / Non-Goals

**Goals:** the URL is the single source of truth for `status` and `program`.

**Non-Goals:** URL state for `q` or `page`; a generic URL-state hook for other tables.

## Decisions

1. **Read filters from `useSearchParams` on every render; no mirrored `useState`.** The defect is two copies (prop-seeded state vs. URL) drifting. Alternative — keep `useState` plus a `useEffect` syncing from the URL — keeps two copies and renders stale state for a frame. Rejected.
2. **Write with `router.replace(`${pathname}?${query}`, { scroll: false })`.** `replace` over `push` so filter clicks don't flood history (spec scenario). Trade-off: the control updates after the navigation round-trip; judge on the Preview whether it feels laggy.
3. **One parser per filter.** `status` → existing `parseStatusFilter` (rule 8: same validator for URL and select). `program` → new pure `parseProgramFilter(raw, programs)` returning the name or `"Todas"`; the valid set is the program list derived from `rows`, since program names come from data, not a constant.
4. **Query building is a pure helper** `buildClientFilterQuery({ status, program }, current)` that sets/deletes the two keys and preserves unrelated params. Tested; the component only calls it.
5. **Page reset on filter change:** `page` stays local; store it together with the filter key it belongs to (`{ key, page }`) and treat a mismatched key as page 1. Avoids a reset effect and a stale-page render. Alternative — `useEffect` on `[estado, prog]` — also valid, one extra render.
6. **Server page stops reading `searchParams`**; `initialStatus` is removed. Whether `useSearchParams` here needs a `Suspense` boundary (the page is already dynamic via `requireAdminPage`) is confirmed against Next 14.2 docs during apply.

No enum, status list or token is introduced; `STATUS_FILTERS` stays the single source; no DB `CHECK` involved.

## Risks / Trade-offs

- [Values with spaces/accents, e.g. "Último mes"] → `URLSearchParams` encodes; helper test round-trips them.
- [Program renamed while a link is shared] → falls back to "Todas" by spec; acceptable.
- [Each `replace` refetches the RSC payload, re-running `getClientsList`] → acceptable at demo scale; noted, not optimized.
