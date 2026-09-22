# Tasks

## 1. Pure planning module (test-first)

- [x] 1.1 Write `__tests__/history-seed.test.ts` (AAA) first and see it fail. Cover: dates run from period day 0 to 24 and exclude today; the cell comes from the portal's `getCurrentDayKey` for every period start weekday; days 21–24 map to week 4; Sundays are excluded; the skip, partial and complete counts match the spec; the output is deterministic; the series count is at most `sets` and only declared metrics appear; values never decrease across weeks per exercise. Verify with `npm run test:run` failing for the missing module.
- [x] 1.2 Implement `scripts/history-seed.ts` as pure functions with no DB access, importing `getCurrentDayKey` from `lib/content/access.ts`. Verify with `npm run test:run` green.

## 2. Seed wiring

- [x] 2.1 In `scripts/seed-demo.ts`, change Sofía's `dayOffset` from 5 to 25. Verify with `--dry-run`: the table shows her period start 25 days back.
- [x] 2.2 Add a seed step after the subscriptions are created: resolve Sofía's month-1 series via `variant_series_map`, read its published days and `exercise_list` blocks (read-only), plan with `history-seed`, and insert her `progress_logs`. Print how many logs were written. Verify with `npx tsc --noEmit` and `npm run lint` clean.

## 3. Runtime verification (real demo DB)

- [x] 3.1 Run `npx tsx --env-file=.env.local scripts/seed-demo.ts` and quote its output, including Sofía's log count.
- [x] 3.2 Query the DB for Sofía's logs: no Sunday dates, no `log_date` before `current_period_start` or on or after today, every `program_day_id` inside her Mes 1 series, and every exercise key present in that day's blocks. Quote the results.
- [x] 3.3 Smoke check (non-destructive, with seeded data): log in as `sofia.ramirez@test.aura.mx` / `12345678`. Check that Historial lists the days with completed and partial counts and gaps; that a detail entry matches Aura's Mes 1 exercise names; that Desempeño shows an upward trend; and that `/portal/today` is not pre-logged. Browser automation only if the maintainer approves; otherwise leave it as a manual card in the PR.

## 4. Ship

- [x] 4.1 Run the full CI suite locally (`tsc`, `lint`, `test:run`, `build`) and quote the results. No `/security-review` is needed, because the proposal declares no sensitive surface.
- [ ] 4.2 Open the PR on `task/seed-sofia-month1-history`. The PR states the silent-defect flag: no enum or status unions, money aggregation, cancellation state, migrations, RLS or `CHECK` are touched, only demo data written by the seed. Squash-merge on green CI.
