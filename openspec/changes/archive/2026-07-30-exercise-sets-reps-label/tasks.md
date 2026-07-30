## 1. The shared formatter (TDD)

- [x] 1.1 Write `__tests__/sets-reps-label.test.ts` (AAA) covering: count `("12")` → `4 series × 12 repeticiones`; range with `a` `("10 a 12")`, with `-` `("10-12")`, with `–` `("10 – 12")` → all end in `repeticiones`; surrounding whitespace `(" 12 ")` trimmed; non-count `("30 seg")` → `4 series × 30 seg`, no `repeticiones`; empty/whitespace-only `reps` → `4 series` with no trailing `×`
- [x] 1.2 Create `lib/content/sets-reps-label.ts` exporting the pure `formatSetsReps(sets: number, reps: string): string`, mirroring the shape of `lib/content/rest-label.ts` (no imports, no `server-only`)
- [x] 1.3 Run `npm run test:run` and confirm the new file passes with the rest of the suite green

## 2. Wire the three rendering surfaces

- [x] 2.1 `components/portal/blocks/ExerciseListBlock.tsx:317` — replace `{ex.sets} × {ex.reps}` in the lavender pill with `formatSetsReps(ex.sets, ex.reps)`
- [x] 2.2 `components/portal/blocks/ExerciseListReadOnly.tsx:40` — replace `{ex.sets}×{ex.reps}` with the helper, keeping the `Meta: ` prefix and the `· Descanso: …` suffix intact
- [x] 2.3 `components/portal/blocks/ExerciseListLogged.tsx:59` — same replacement, same surrounding text preserved
- [x] 2.4 Confirm no other surface renders the sets/reps pair: grep for `.sets` across `app/`, `components/`, and `lib/`, and check each hit is either a call to the helper, the untouched `Mi registro` heading at `ExerciseListBlock.tsx:166`, or a non-rendering use (e.g. `Array.from({ length: ex.sets })`)
- [x] 2.5 Verify the `Mi registro · N series de N reps` heading is byte-identical to before

## 3. Wrapping in the pill

- [x] 3.1 Add `overflowWrap: "break-word"` **and** `minWidth: 0` to the pill's inline style in `ExerciseListBlock.tsx` — `minWidth` is required because the pill is a flex child of `flex gap-2 flex-wrap` and its default `min-width: auto` makes `overflow-wrap` inert
- [x] 3.2 Check whether the `Meta:` lines in `ExerciseListReadOnly` / `ExerciseListLogged` need the same treatment — they are block `<p>` elements, not flex children, so `minWidth` is likely unnecessary; add only what the layout actually requires and say which you added

## 4. Gates and verification

- [x] 4.1 `npx tsc --noEmit` · `npm run lint` · `npm run test:run` · `npm run build` all green
- [x] 4.2 Manual check at 375px on the Preview URL — jsdom cannot verify wrapping. Open a training day in the portal and confirm: the pill reads `4 series × 12 repeticiones`; an exercise with a range reads `4 series × 10 a 12 repeticiones`; the pill and the `Descanso` badge stack cleanly instead of overflowing; the page gains no horizontal scroll
- [x] 4.3 Open a past day with a log and a future/rest day from the calendar and confirm both `Meta:` lines show the same wording as the current-day pill
- [x] 4.4 `code-review` subagent verdict before opening the PR (presentation-only diff, no sensitive surface → no `security-review` needed; state that explicitly in the PR)
- [x] 4.5 Write the smoke card for the 375px check (every step possible with existing demo data, non-destructive)

## 5. Close out

- [x] 5.1 `openspec validate --strict` for this change (no `/opsx:sync` — archive applies the deltas; running both makes archive abort)
- [x] 5.2 PR to `main` via `github-pr`, green CI, merge
- [x] 5.3 `/opsx:archive`, add/close the backlog row, re-index codebase-memory in `fast` mode
