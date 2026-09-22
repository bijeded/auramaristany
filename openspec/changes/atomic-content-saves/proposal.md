# Proposal

## Why

Three admin saves reconcile rows by delete-then-insert across separate PostgREST calls, each committing on its own (backlog D2, D13). A failed insert after a committed delete leaves a day or pillar with **no blocks**, or a series mapped to **zero variants** (invisible in every curriculum, unrecoverable from the editor). `updateSeries` also writes metadata after the mapping, so the reverse failure leaves a month moved with a stale title under a generic error. Migration 018 already proved the fix: one `SECURITY INVOKER` Postgres function per write, all-or-nothing.

## What Changes

- New migration `021` with three `SECURITY INVOKER` plpgsql functions, each doing its whole write in one transaction:
  - `save_day_blocks(p_day_id, p_blocks)` — delete + insert `program_day_blocks`.
  - `save_pillar_blocks(p_pillar_id, p_blocks)` — delete + insert `program_pillar_blocks`.
  - `update_series_with_mappings(p_series_id, p_mappings, p_title, p_description, p_published)` — delete + insert `variant_series_map`, then update `program_series`.
- `saveBlocks`, `savePillarBlocks`, `updateSeries` call these via the rule-10 `// keep:` client cast. Validation, sanitizing, zod, ownership checks and `requireAdmin()` stay in TypeScript, before the call.
- `updateSeries` loses its best-effort restore path; a 23505 still maps to the inline "position taken" message.
- Backlog D2 and D13 are marked resolved.

No user-visible behavior changes on success. On failure, "error" now means "nothing was written".

**Non-goals**
- **D16** (`invoice.paid` two-statement advance) — webhook/money surface, separate change.
- `deleteDay` / `cloneDay` multi-step writes.
- The "surface unmapped series in the editor" fallback from D13 — unnecessary once the write is atomic.
- Changing RLS policies on the affected tables.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `admin-content-authoring`: adds a requirement that saving a day's blocks, a pillar's blocks, or a series' metadata and mappings is all-or-nothing.

## Impact

- **Code:** `lib/admin/dayActions.ts`, `lib/admin/pillarActions.ts`, `lib/admin/seriesActions.ts`; tests in `__tests__/day-actions.test.ts`, `__tests__/series-actions.test.ts` (plus a pillar test); `BACKLOG.md`.
- **DB:** new migration `supabase/migrations/021_atomic_content_saves.sql`; requires a PostgREST schema reload after apply.
- **Sensitive surface: yes — migrations and RLS** (functions run as invoker under existing `is_admin()` policies). `/security-review` runs before the PR. No webhooks, money, service-role, or fan-out.
- **Review rules touched:** 3 (RLS boundary, invoker not definer), 4 (validation/sanitizing stay server-side before the RPC), 6 (`logAndGeneric` on RPC errors), 7 (block `CHECK`s now fail inside the transaction — the data-loss path rule 7 describes is closed), 10 (`// keep:` cast on the client, `Functions` untouched), 11 (migration applied and verified against the real DB before merge), 20 (none expected; grep ADRs for renamed symbols).
- **Silent-defect surface:** migration + DB `CHECK` on `block_type`.
