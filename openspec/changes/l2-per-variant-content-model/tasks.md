## 1. Preconditions

- [ ] 1.1 **Confirm all program content is still demo content.** Query `program_series`/`program_days` and confirm nothing Aura authored for real is present. If real content exists, STOP — the migration below is destructive and must be re-scoped to a backfill.
- [ ] 1.2 Confirm with Aura that she has not begun the real curriculum, and that she should not until this ships.
- [ ] 1.3 Record the current row counts for `program_series`, `program_days`, `program_day_blocks`, `series_pillar_blocks`, `variant_series_map` so the reseed can be sanity-checked.

## 2. Migration 015 (destructive)

- [ ] 2.1 Write `supabase/migrations/015_per_variant_curriculum.sql`: add `variant_series_map.ordinal` (int, not null) with `unique(program_variant_id, ordinal)`; drop `program_series_program_id_series_number_key`; drop `program_series.series_number`; add `program_variants.ladder_next_variant_id` (nullable FK to `program_variants`) with a self-reference check.
- [ ] 2.2 In the same migration, delete existing demo content (`program_day_blocks`, `series_pillar_blocks`, `program_days`, `variant_series_map`, `program_series`) in FK-safe order.
- [ ] 2.3 Reseed a minimal demo curriculum under the new shape — at least two variants of one program, each with its own months numbered from 1, so the per-variant case is exercised in the running app.
- [ ] 2.4 Seed `ladder_next_variant_id`: Strong & Fit Principiante → Intermedio → Avanzado → null; Extra Intermedio → Avanzado → null; all CuarentaMás variants null.
- [ ] 2.5 Apply via the Supabase Management API — **SQL on ONE single line** (the pipeline eats newlines and `--` comments out the remainder). Seed inserts take `on conflict do nothing`.
- [ ] 2.6 Update `lib/supabase/types.ts` by hand: `ordinal` on `variant_series_map`, `ladder_next_variant_id` on `program_variants`, remove `series_number` from `program_series`. Keep `Relationships: []`.

## 3. Curriculum resolution (pure, TDD)

- [ ] 3.1 Write failing tests for successor resolution: contiguous ordinals, a gap in the middle (successor is the next existing ordinal, not `n + 1`), the highest ordinal (curriculum ended), and an empty curriculum.
- [ ] 3.2 Implement the pure successor/position helper until the tests pass. No DB access.
- [ ] 3.3 Add a test that a series mapped to two variants at different ordinals resolves independently in each.

## 4. Readers switch to the mapping

- [ ] 4.1 Switch `lib/content/queries.ts` series resolution (both call sites) to the variant mapping and its `ordinal`.
- [ ] 4.2 Switch `lib/content/pillars.ts`.
- [ ] 4.3 Switch `lib/cron/notice-queries.ts` — the A4 automated-message rules resolve `series_id` the same way and will keep running while silently matching nothing if missed.
- [ ] 4.4 Update `lib/content/access.ts` where it derives a series number, keeping current behavior for clients at their program's first level.
- [ ] 4.5 Grep for every remaining reference to `series_number` and confirm none resolves content.

## 5. Admin authoring

- [ ] 5.1 Rework `getAdminProgram` to return content grouped by variant with ordinals, instead of one program-wide series list.
- [ ] 5.2 Update `createSeries` to require at least one variant and a position per mapping; map the unique violation to an inline error naming the variant and position.
- [ ] 5.3 Update `updateSeries` and `deleteSeries` for the new shape; removing the last mapping is presented as deleting the series.
- [ ] 5.4 Rework `SeriesAccordion`, `SeriesFormModal` and `SeriesDeleteDialog` for per-variant lists and per-variant month numbers.
- [ ] 5.5 Mark shared series wherever they appear, and warn before saving an edit to one.
- [ ] 5.6 Update `getAdminPrograms` series counts for the new shape.
- [ ] 5.7 Confirm the editor is still behind `requireAdminPage()`.

## 6. Reconcile the dependent change

- [ ] 6.1 Update `l2-level-ladder-progression` so its advance rule uses the next *existing* ordinal rather than `ordinal + 1` — proposal, design Decision 1, and the `content-ladder-progression` spec scenarios.
- [ ] 6.2 Confirm the column names this change ships match what that change assumes (`variant_series_map.ordinal`, `program_variants.ladder_next_variant_id`).

## 7. Verification

- [ ] 7.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all green.
- [ ] 7.2 Smoke on a Preview URL: create a first month for two different variants of the same program and confirm both succeed — the failure this change exists to fix.
- [ ] 7.3 Smoke: a client's `/portal/today` still serves the correct day after the reseed.
- [ ] 7.4 Smoke: the A4 automated-message cron still resolves a series (`?dryRun=1` with the `CRON_SECRET` bearer token).
- [ ] 7.5 Update `BACKLOG.md` (L2a → ✅ Done), run `/opsx:sync`, `openspec validate`, then `/opsx:archive`, and re-index codebase-memory in `fast` mode.
- [ ] 7.6 Tell Aura the editor is ready and she can begin the real curriculum.
