# Design

## Context

For motivation, see proposal.md (Why). `createSeries` (`lib/admin/seriesActions.ts:204`) makes two committing PostgREST calls plus a compensating delete. Migration 021 set the pattern for making this atomic: an invoker plpgsql function that receives rows already validated in TS. Its sibling, `update_series_with_mappings`, together with its caller `updateSeries`, is the template for everything here.

The nine target policies were created in 001 and 004 as `for all using (is_admin())`, and no later migration touches them. Migration 020 tightened a policy of the same shape by dropping and recreating it. 009 and 017 did the same for others.

## Goals / Non-Goals

**Goals:**
- Series creation becomes a single database call, so any error rolls the whole creation back.
- The nine policies gain `with check (is_admin())`, and their `using` clauses stay byte-identical.

**Non-Goals:**
- Reconciling the pre-existing difference between `createSeries` and `updateSeries` in how they scope ids. Both keep their current TS checks.

## Decisions

**1. One migration, two concerns.** The create function depends on `program_series_admin_write` and `variant_series_map_admin_write` as its authorization boundary, and those are two of the nine policies. Shipping them together means the function is born under explicit checks. The rejected alternative was separate migrations. That adds a second apply-and-verify cycle and buys nothing, since both are additive and each is idempotent in its own way (decision 3).

**2. `create_series_with_mappings(p_program_id uuid, p_title text, p_description text, p_mappings jsonb) returns uuid`.** It is a straight mirror of `update_series_with_mappings`:
- `security invoker`, `set search_path = public, pg_temp`, `revoke … from public, anon`, `grant … to authenticated`.
- It raises unless `p_mappings` is an array, if it is empty, or if it holds more than 50 elements.
- It inserts `program_series (program_id, title, description, published)` with `published` fixed to `false`, then `returning id into v_id`. A creator cannot publish at insert time, matching today's action.
- It inserts `variant_series_map` from `jsonb_to_recordset(p_mappings) as m(program_variant_id uuid, ordinal int)`, with `series_id` taken from `v_id` only. A payload therefore cannot attach mappings to an existing series.
- Header in block comments only, with no `--` (the Management API receives SQL on one line).

It returns the id rather than `void`. The action does not need it today, but the runtime verification does: task 1.4 checks that a successful call's id has exactly N mappings. Returning it costs nothing. The rejected alternative was `void` plus a lookup by title, which is ambiguous because titles are not unique.

Program and variant ownership (`variantsBelongToProgram`) stays in TS, which is 021's decision 3. The functions write and never decide. Under invoker rights the caller is already an admin who could write those rows directly, so moving the check into SQL would add no security boundary.

**3. `alter policy … with check (is_admin())`, not drop-and-recreate.** This deliberately departs from 020's precedent:
- `alter policy name on table with check (…)` leaves `using` untouched. Drop-and-recreate retypes `using` nine times, which is the silent-defect path the proposal names.
- A mistyped policy name makes `alter policy` fail loudly. With `drop policy if exists` plus `create policy`, a misspelled name silently no-ops the drop, and the create then adds a second, permissive policy beside the unfixed one. Policies OR together, so the table ends up with two write policies.
- There is no window, however brief, in which the table has no write policy.
- It is safe to re-run: setting the same check twice is a no-op. That satisfies CLAUDE.md's "guard only what can plausibly re-execute" without needing `if exists`.

**4. Error mapping (unchanged semantics).** A duplicate `(program_variant_id, ordinal)` (015's unique constraint) or a repeated variant (001's PK) raises 23505 inside the function. The whole insert, series row included, rolls back, and `createSeries` routes the error to `positionTakenMessage(supabase, mappings)` with `field: "ordinal"`. `excludeSeriesId` is not needed because the new row no longer exists. Everything else goes through `logAndGeneric("createSeries", error)`.

**5. Calling convention (rule 10).** `createSeries` casts the **client** to a local `{ rpc(fn, args): Promise<{ data: string | null; error: { code?: string; message: string } | null }> }` with a `// keep:` comment, exactly like `updateSeries`. `Database["public"]["Functions"]` stays empty.

## Risks / Trade-offs

- [The code merges before 022 is applied, so every creation fails] → Rule 11: apply and verify before merge. The function is additive and harmless to the current code.
- [PostgREST's cache doesn't see the new function, so the RPC returns 404] → `notify pgrst, 'reload schema'`, then a real call before merge.
- [A policy alteration changes who can write, and no test sees it] → Snapshot `pg_policies` (`policyname, cmd, qual, with_check`) for all 13 before the apply. After it, all nine must show `qual` byte-identical to before and `with_check = '(is_admin())'`, and the four D36 policies must still show `with_check` null. Both snapshots go in the PR.
- [Mocked unit tests cannot prove the rollback] → Force a real 23505 inside `begin; … rollback;` and compare row counts (task 1.4).
- [Unit tests fake `rpc` as a bare function and miss a detached receiver] → Keep the cast on the client (decision 5). The runtime check on the Preview exercises the real `supabase-js` call.

## Migration Plan

1. Read the live `pg_policies` for every `cmd = 'ALL'` policy with `with_check is null`. The result must be exactly the 13 named in the proposal. If it isn't, stop and revise the proposal before writing 022.
2. Write `supabase/migrations/022_atomic_series_create_rls_checks.sql`.
3. Apply it through the Management API as one line, then `notify pgrst, 'reload schema'`.
4. Verify the function (existence, `prosecdef = false`, atomicity) and the policies (the before/after snapshot). Then merge the code.

Rollback: revert the code PR. The function can stay, since it is unused without the caller. The policy checks equal `using`, so they need no rollback. Removing one would take a new migration that drops and recreates the policy, because `alter policy` cannot remove a `with check`.
