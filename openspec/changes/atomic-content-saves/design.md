# Design

## Context

See proposal.md - Why. Today each save is 2-4 PostgREST calls from a server action (`lib/admin/dayActions.ts:60`, `lib/admin/pillarActions.ts:29`, `lib/admin/seriesActions.ts:269`); PostgREST commits each call separately, so no client-side ordering makes them atomic. The only transaction boundary available to the app is a single call, i.e. a Postgres function via `rpc`. Migration 018 (`reorder_onboarding_questions`) is the repo's precedent and `lib/admin/onboardingActions.ts:85` its caller.

The three tables are governed by `for all using (is_admin())` policies (001, 004); `block_type` is constrained by `CHECK`s on both block tables.

## Goals / Non-Goals

**Goals:**
- One database call per save; any error inside it rolls the whole save back.
- Keep every existing TypeScript-side guard exactly where it is.

**Non-Goals:**
- Moving validation or sanitizing into SQL.
- `createSeries`' own compensating delete (insert series, then map, delete on failure) — same family, not in D13; note it in BACKLOG as a follow-up rather than widening scope.
- Tightening the existing `for all` policies with an explicit `with check` (rule 3 / D20) — noted as a follow-up, not changed here.

## Decisions

**1. Three functions, not one generic block function.** `save_day_blocks` and `save_pillar_blocks` are near-identical, but a shared function would need the table name as an argument → dynamic SQL (`format('%I')`) inside a function reachable by `authenticated`. Two static functions of ~15 lines each are easier to review and have no injection surface. Alternative rejected: one function with a `kind` enum branching to two static statements — saves little, adds a second enum to keep in sync.

**2. `SECURITY INVOKER`, `set search_path = public, pg_temp`, `revoke … from public, anon`, `grant … to authenticated`.** Same reasoning as 018: RLS stays the authorization boundary (rule 3); a `DEFINER` would bypass it and need its own `is_admin()`. Revoking from `anon` is least privilege on top. Block-list payloads get a size cap (e.g. 200 elements) for the same reason as 018.

**3. TypeScript computes the rows; SQL only writes them.** The server action keeps `requireAdmin()`, `validateBlock`, `sanitizeRichText`, zod, `idSchema`, the program-ownership check and `variantsBelongToProgram`, then passes already-shaped rows (`[{block_type, sort_order, content}]`, `[{program_variant_id, ordinal}]`) as `jsonb`. `sort_order` stays computed in TS (array index), so ordering has one home, as with `reindexOrder` in 018. The function inserts via `jsonb_to_recordset`; the parent id comes from the scalar argument, never from the payload, so a payload cannot target another day/pillar/series.

**4. `update_series_with_mappings` does map-delete → map-insert → series update, in that order, in one call.** The existing "metadata after mapping" ordering was only a mitigation for non-atomicity; it is kept because it costs nothing, but correctness no longer depends on it. It also asserts the series update touched exactly one row and raises otherwise (018's "raise inside, not check after" rule), so an RLS-filtered or missing id rolls back instead of reporting success.

**5. Errors.** A unique violation inside the function surfaces as the RPC error with `code: "23505"`; `updateSeries` keeps branching on it to `positionTakenMessage`. Everything else goes through `logAndGeneric` (rule 6). The best-effort restore block and its `readMap` query are deleted.

**6. Calling convention (rule 10).** Each action casts the **client** to a local `{ rpc(fn, args): Promise<{ error }> }` shape with a `// keep:` comment, exactly as `onboardingActions.ts:85`. `Database["public"]["Functions"]` in `types.ts` stays empty.

**7. Empty lists.** `save_day_blocks(day, '[]')` deletes all blocks and inserts none — preserving today's behavior of saving an emptied day. `update_series_with_mappings` with `[]` is already refused by zod (≥1 mapping), and the function also raises on an empty mapping array, so "a series mapped to no variant" is impossible from this path even if called directly.

## Risks / Trade-offs

- [PostgREST schema cache not reloaded after apply → RPC 404s on the demo] → task includes `notify pgrst, 'reload schema'` and a real call before merge.
- [Deploy ordering: code merged before migration applied → every save fails] → rule 11: migration applied and verified against the real DB **before** merge; the functions are additive, so applying them early is harmless to the current code.
- [Unit tests fake `rpc` with an arrow function and miss the detached-receiver bug] → keep the cast on the client (decision 6); runtime verification exercises the real `supabase-js` call.
- [Mocked tests cannot prove rollback] → atomicity is verified at runtime by forcing a real failure (see tasks), not by unit tests.

## Migration Plan

1. Write `supabase/migrations/021_atomic_content_saves.sql` (block comment header, no `--` comments, per the one-line Management API constraint).
2. Apply via the Supabase Management API as a single line; `notify pgrst, 'reload schema'`.
3. Verify each function exists and runs (see tasks), then merge the code.

Rollback: revert the code PR; the functions are additive and can remain, or be dropped by a new migration `022`.
