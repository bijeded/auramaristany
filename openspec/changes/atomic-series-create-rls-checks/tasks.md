# Tasks

## 1. Migration

- [x] 1.1 Snapshot the live policies, read-only, on project `bgvxaagfnzvzamtxqbkg`: `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and cmd = 'ALL' and with_check is null order by tablename;`. Verify: exactly the 13 policies named in the proposal (the 9 targets plus the 4 D36 ones). Any other result stops the change for an `/opsx:update`. Keep the output for the PR body as the "before" snapshot.
  **Deviation:** 022 was applied before this ran, so no "before" snapshot exists. Substitute evidence from 1.3: `alter policy … with check` cannot modify `using`, and after the apply every one of the nine still shows `qual = is_admin()`, the expression 001 and 004 declare. Exactly the four D36 policies still have `with_check` null, so the pre-apply set was the 13 the proposal named.
- [x] 1.2 Write `supabase/migrations/022_atomic_series_create_rls_checks.sql`:
  - `create_series_with_mappings(uuid, text, text, jsonb) returns uuid`, per design decision 2: `security invoker`, fixed `search_path`, array / empty / >50 guards, `published = false`, and `series_id` taken only from the inserted row.
  - `revoke … from public, anon`, `grant … to authenticated`.
  - Nine `alter policy <name> on <table> with check (is_admin());` statements (design decision 3).
  - Block-comment header only, with no `--`.

  Verify: it is the next number after 021 and no existing migration is modified (`git diff --stat supabase/migrations`).
- [x] 1.3 Apply 022 through the Management API (SQL on one line), then `notify pgrst, 'reload schema'`. Verify (rule 11):
  - `select proname, prosecdef from pg_proc where proname = 'create_series_with_mappings'` returns 1 row with `prosecdef = false`.
  - Re-running 1.1's query returns only the 4 D36 policies.
  - `select policyname, qual, with_check from pg_policies where policyname in (<the nine>)` shows each `qual` identical to its "before" value and `with_check = '(is_admin())'`.

  Record both snapshots and the apply time for the PR body.
- [x] 1.4 Verify atomicity and RLS against the real DB without leaving any trace. Every call runs inside `begin; … rollback;` with `set local role authenticated` and `set local request.jwt.claims` naming the seeded admin, so RLS applies. The checks:
  - (a) A call whose last mapping reuses an ordinal an existing seeded variant already holds raises 23505. The `program_series` row count is unchanged afterwards.
  - (b) A valid call returns an id that has exactly N `variant_series_map` rows and `published = false`.
  - (c) The same valid call with claims naming a seeded non-admin client fails with an RLS error (42501), which exercises the new `with check`.

  Verify: the counts after `rollback` equal the counts before. Record the queries and output in the PR body.

## 2. `createSeries`

- [x] 2.1 Test-first in `__tests__/series-actions.test.ts`:
  - `createSeries` calls `rpc("create_series_with_mappings", { p_program_id, p_title, p_description, p_mappings })` exactly once, with `p_mappings` shaped `[{ program_variant_id, ordinal }]`.
  - It makes no `program_series` or `variant_series_map` insert or delete call.
  - An RPC error with `code: "23505"` returns the position-taken message with `field: "ordinal"`. Any other error returns `logAndGeneric`'s message.
  - Remove the "borra la serie si el mapeo falla" test and adapt the remaining createSeries tests to the RPC. The validation-refusal tests keep asserting that nothing is called.

  Verify: the new tests fail against the current code for the stated reason (`npm run test:run -- series-actions`).
- [x] 2.2 Rewrite `createSeries` (`lib/admin/seriesActions.ts`) to the RPC with the `// keep:` client cast (design decision 5). Delete the compensating delete and its comment, and delete `toRows` if nothing else uses it. Verify: the 2.1 tests pass, and `grep -n "createSeries.rollback\|toRows" lib` is empty (or `toRows` has another caller).

## 3. Housekeeping and verification

- [x] 3.1 `BACKLOG.md`: add a **D36** row to "Everything else" for the four non-content `for all` policies with no `with check` (`profiles_admin_insert_update_delete`, `invoices_admin_write`, `subscription_events_admin_only`, `message_recipients_admin_write`), noting that they are functionally equivalent, a money/identity surface, and to be fixed with `alter policy` like 022. Change the index row `D1–D35` to `D1–D36`. Leave the D34 and D35 rows alone; the archive PR deletes them. Grep `docs/adr/` for `createSeries` and update any reference (rule 20). Verify: grep output shown in the PR.
- [x] 3.2 Run `npx tsc --noEmit`, `npm run lint`, `npm run test:run` and `npm run build` locally. Verify: all four exit 0.
- [ ] 3.3 Runtime check on the Preview URL (or local dev against the real DB), with seeded data, in the content editor of a seeded program:
  - Create a month for one variant at a position that variant does not use. It appears, unpublished, at that position.
  - Create another month at a position that variant already uses. The inline position-taken error appears. After a reload, the program's month count (read by SQL before and after) has grown only by the first month.
  - Then delete **only the month this step created**, from the editor.

  Verify: observations and counts recorded in the PR body.
- [x] 3.4 Run `/security-review` (sensitive surface: migration, RLS policies, an RLS-governed function). Address each finding, or dismiss it with a reason in the PR body.

## 4. PR handoff

- [ ] 4.1 Open PR `fix(admin): make series creation atomic and add with check to content policies` from `task/atomic-series-create-rls-checks`. The body states when 022 was applied and verified (rule 11) and carries the before/after `pg_policies` snapshots, the 1.4 and 3.3 evidence, the security-review outcome, and the silent-defect flag: **yes, a migration and RLS policies**. Squash-merge on green CI. Then open the separate `chore/archive-atomic-series-create-rls-checks` PR, which syncs the delta spec and deletes the D34 and D35 backlog rows.
