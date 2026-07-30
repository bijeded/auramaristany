## Why

The exercise card shows its target volume as a bare `4 × 12`. Aura's feedback is that the numbers carry no units, so a client has to already know which one is sets and which is reps. She wants it to read `4 series × 12 repeticiones`.

The same shape is rendered on three different screens with two different spellings, so fixing only the one Aura pointed at would leave the other two inconsistent (review rule 21: enumerate a rendering surface by the shape of the content, not by one call site).

## What Changes

- The target-volume label spells out both units: `4 series × 12 repeticiones` instead of `4 × 12` / `Meta: 4×12`. The `×` separator is kept.
- The label is produced by a single pure helper instead of three inline template strings, so the three surfaces cannot drift apart again.
- Because `reps` is free text authored by Aura (not a number), the unit noun is appended **only** when the value is numeric-ish — a count (`12`) or a range (`10 a 12`, `10-12`). Anything else falls back to today's unit-less form, so a future `30 seg` or `AMRAP` reads as `4 series × 30 seg`, never `4 series × 30 seg repeticiones`.
- The pill that carries this label is a flex child holding author-controlled text, so it gains the wrapping treatment that surface class already requires.
- Not changed: the `Mi registro · 4 series de 12 reps` header inside the logging box. It restates the same figures deliberately; the redundancy is accepted.

No breaking changes. No migration, no new dependency, no data change — `sets` and `reps` are read exactly as they are stored.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `portal-exercise-display`: adds a requirement fixing how an exercise's target volume is worded, including the fallback for a non-numeric `reps` value and the guarantee that all three rendering surfaces share one format.
- `long-text-wrapping`: adds the exercise target-volume pill to the set of surfaces that render authored free text without overflowing, including the `min-width: 0` needed because it is a flex child.

## Impact

**Code**
- `components/portal/blocks/ExerciseListBlock.tsx` — the lavender pill on today's day (the surface Aura screenshotted).
- `components/portal/blocks/ExerciseListReadOnly.tsx` — `Meta: 4×12` on a day with no logging, via `BlockView`.
- `components/portal/blocks/ExerciseListLogged.tsx` — `Meta: 4×12` on a past day with a log, via `BlockView`.
- New pure module for `formatSetsReps`, with unit tests.

**Not affected**
- Admin authoring (`ExerciseListBlockEditor.tsx`) — Aura keeps typing `reps` exactly as today.
- The database, `lib/content/queries.ts` types, and every stored value.

**Verification**
- Unit tests cover the helper's cases; jsdom cannot verify wrapping, so the 375px rendering is a manual smoke check.
