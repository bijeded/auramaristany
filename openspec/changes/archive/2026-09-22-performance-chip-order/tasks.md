# Tasks

> design.md was deliberately skipped: this is a single-helper ordering fix with no architectural choice. The approach is recorded here instead. `LogForPerf` gains an ordered list of the day's exercise ids, and `buildPerformanceSeries` walks that list instead of `Object.entries(exercisesDone)`.

## 1. Reproduce (test-first)

- [x] 1.1 In `__tests__/history-helpers.test.ts`, add a failing test. The `exercisesDone` object's keys are inserted in UUID order, which is the order jsonb returns them in, and the day's template order is "1. A", "2. B", "3. C" with UUIDs that sort in reverse. Assert that the chips (`result.map(e => e.name)`) come back in template order. Verify with `npm run test:run -- history-helpers`: the new test fails and the existing tests pass.
- [x] 1.2 Add failing tests for the remaining spec scenarios: a second day appends only its new exercises, and an older day comes first regardless of weekday. Verify with the same command.

## 2. Implement

- [x] 2.1 `lib/content/history-helpers.ts`: add `exerciseOrder: string[]` to `LogForPerf`. Make `buildPerformanceSeries` iterate `exerciseOrder`, reading each exercise's entry from `exercisesDone` and skipping ids with no entry or no meta. Verify with `npm run test:run -- history-helpers`: every test is green, including the ones from 1.1 and 1.2.
- [x] 2.2 `lib/content/history.ts` `getPerformanceData`: select `sort_order`, order blocks by it, and build a `dayId -> ordered exercise ids` map from the `exercise_list` blocks. Pass `exerciseOrder` for each log. Verify with `npx tsc --noEmit`, which must pass.
- [x] 2.3 Update any other `LogForPerf` / `buildPerformanceSeries` callers and fixtures that `tsc` flags. Verify with `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`, all green.

## 3. Runtime verification

- [x] 3.1 On the Preview URL, log in as the seeded client Sofía, whose month-1 history comes from PR #84. Open Historial -> Desempeño and confirm that the chips follow the numbered template order of her first logged day, with exercises from later days appended after them. This check is read-only.

## 4. Handoff

- [x] 4.1 Open a PR titled `fix(portal): order Desempeño exercise chips by template order` on `task/performance-chip-order`. The PR body states that the change touches no sensitive surface (so no `/security-review` is needed) and no silent-defect surface (no enum/status unions, money/people aggregation, cancellation state, migrations, RLS or DB CHECK). Squash-merge on green CI.
