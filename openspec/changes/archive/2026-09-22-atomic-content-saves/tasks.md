# Tasks

## 1. Migration

- [x] 1.1 Write `supabase/migrations/021_atomic_content_saves.sql` with `save_day_blocks(uuid, jsonb)`, `save_pillar_blocks(uuid, jsonb)` and `update_series_with_mappings(uuid, jsonb, text, text, boolean)`: `security invoker`, fixed `search_path`, payload-size cap, parent id taken only from the scalar argument, series update raising unless exactly one row changed, empty mapping array raising; `revoke execute … from public, anon`, `grant … to authenticated`; block-comment header only (no `--`). Verify: file is the next number after 020 and no existing migration is modified (`git diff --stat supabase/migrations`).
- [x] 1.2 Apply 021 to project `bgvxaagfnzvzamtxqbkg` via the Management API (SQL on one line), then `notify pgrst, 'reload schema'`. Verify: `select proname, prosecdef from pg_proc where proname in (…)` returns 3 rows with `prosecdef = false` (rule 11).
- [x] 1.3 Verify atomicity against the real DB, non-destructively: inside `begin; … rollback;`, call each function on an existing seeded day / pillar / series with a payload whose last element violates a constraint (invalid `block_type`; a duplicate ordinal) and confirm the row counts and series title before and after the call are identical; also confirm a valid call inside the same wrapped transaction replaces the rows. Record the queries and output in the PR body.

## 2. Day and pillar blocks (D2)

- [x] 2.1 Test-first in `__tests__/day-actions.test.ts`: `saveBlocks` calls `rpc("save_day_blocks", { p_day_id, p_blocks })` once with sanitized text HTML and index-based `sort_order`, makes no `delete`/`insert` calls, returns `logAndGeneric`'s message on RPC error, and still refuses an invalid block before calling `rpc`. Verify: new tests fail against current code for the stated reason (`npm run test:run -- day-actions`).
- [x] 2.2 Rewrite `saveBlocks` (`lib/admin/dayActions.ts`) to the RPC via a `// keep:` cast on the client (rule 10, pattern of `onboardingActions.ts:85`). Verify: 2.1 tests pass.
- [x] 2.3 Same test-first pair for `savePillarBlocks` (`lib/admin/pillarActions.ts`, new or existing pillar test file) against `save_pillar_blocks`. Verify: tests fail first, then pass.

## 3. Series mappings (D13)

- [x] 3.1 Test-first in `__tests__/series-actions.test.ts`: `updateSeries` calls `rpc("update_series_with_mappings", …)` once after ownership and variant checks pass; an RPC error with `code: "23505"` returns the position-taken message with `field: "ordinal"`; other errors go through `logAndGeneric`; no `variant_series_map` read/delete/insert and no restore path. Replace the existing restore-path tests. Verify: new tests fail against current code for the stated reason.
- [x] 3.2 Rewrite `updateSeries` (`lib/admin/seriesActions.ts`) to the RPC; delete the read-previous/restore block and update the comment that references D2. Verify: 3.1 tests pass and `grep -n restoreMap lib` is empty.

## 4. Housekeeping and verification

- [x] 4.1 `BACKLOG.md`: mark D2 and D13 resolved by this change; add follow-ups for `createSeries`' compensating delete and the missing `with check` on the `for all` policies of the three tables. Grep `docs/adr/` for `saveBlocks`/`savePillarBlocks`/`updateSeries` and update any reference (rule 20). Verify: grep output shown in the PR.
- [x] 4.2 Run `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` locally. Verify: all four exit 0.
- [x] 4.3 Runtime check on the Preview URL (or local dev against the real DB) with seeded data: edit a day's blocks and save, edit a pillar's blocks and save, edit a month's title and save — each reloads showing the change; then move a month to a position its variant already uses — inline error appears and, after reload, title and positions are unchanged. Restore any edited text to its original value afterwards. Verify: observations recorded in the PR body.
- [x] 4.4 Run `/security-review` (sensitive surface: migration + RLS-governed functions); address or dismiss each finding with a reason in the PR body.

## 5. PR handoff

- [x] 5.1 Open PR `fix(admin): make block and series saves atomic` from `task/atomic-content-saves`; body states when 021 was applied and verified (rule 11), the 1.3 and 4.3 evidence, security-review outcome, and the silent-defect flag: **yes — migration, RLS-governed functions, DB `CHECK` on `block_type`**. Squash-merge on green CI; then the separate `chore/archive-atomic-content-saves` PR.
