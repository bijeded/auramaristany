## Context

An exercise block stores `sets: number` and `reps: string` (`lib/content/queries.ts`). `reps` is a free-text input in the admin editor (`components/admin/blocks/ExerciseListBlockEditor.tsx`, default `"12"`), so its content is whatever Aura types. In her catalog today only two shapes appear: a count (`"12"`) and a range (`"10 a 12"`).

Three components render the pair, with two different spellings:

| Surface | Component | Today |
|---|---|---|
| Current day, logging card | `ExerciseListBlock.tsx` | `4 × 12` (lavender pill) |
| Other day, no log | `ExerciseListReadOnly.tsx` | `Meta: 4×12` |
| Past day, with a log | `ExerciseListLogged.tsx` | `Meta: 4×12` |

The last two are reached through `BlockView.tsx`. There is an exact precedent for how to fix this: `formatRestLabel` in `lib/content/rest-label.ts` is a pure, tested function imported by all three of these same components for the rest-time badge.

Constraints: neutral Mexican Spanish; colors from tokens; pure logic separated from queries and tested (Vitest, AAA); no migration wanted for a wording change.

## Goals / Non-Goals

**Goals**

- The target volume names its units, as Aura asked: `4 series × 12 repeticiones`.
- One shared function so the three surfaces cannot drift apart again.
- A non-numeric `reps` value degrades to today's unit-less wording instead of producing nonsense.
- The longer label still wraps inside its card at 375px.

**Non-Goals**

- Changing what Aura types or how `reps` is stored. No `reps_unit` column, no migration, no admin-editor change.
- Changing the `Mi registro · N series de N reps` heading inside the logging box (`ExerciseListBlock.tsx:166`). Its redundancy with the pill is accepted.
- Reworking the badge row's layout, the rest badge, or the card's visual design beyond what wrapping requires.
- Pluralizing `series` for `sets = 1`. Confirmed absent from the catalog, and Spanish `serie`/`series` would need a singular branch that no data exercises.

## Decisions

### Decision 1 — Sniff `reps` for a repetition count instead of always appending the noun

`formatSetsReps(sets, reps)` appends `repeticiones` only when the trimmed `reps` matches a count or a range: `/^\d+(\s*(a|-|–)\s*\d+)?$/i`. Otherwise it returns `<sets> series × <reps>`.

*Why:* appending unconditionally is one less line but bets the wording on a field the author controls. The day Aura types `30 seg` or `AMRAP`, the portal tells clients `4 series × 30 seg repeticiones` — a visible defect with no failing test behind it, since no test asserts on her future content. The sniff makes the bad case degrade to exactly today's behavior.

*Alternatives considered:*
- **Always append.** Rejected per above. Note the existing heading at `ExerciseListBlock.tsx:166` already takes this bet; this change does not extend it to a second, more prominent surface.
- **Add a `reps_unit` column** (reps / segundos / máx) and render from it. This is the correct model and removes the guessing. Rejected as out of proportion: migration, admin UI, backfill, and a decision from Aura about what units she wants — for a change she framed as a wording fix. If her content ever outgrows the sniff, this is the upgrade path.
- **A generic pluralizer.** No: the problem is not plurality, it is whether the value denotes repetitions at all.

### Decision 2 — Put it in `lib/content/sets-reps-label.ts`, mirroring `rest-label.ts`

Same directory, same shape (pure, no `server-only`, no imports), same three consumers, same test style. `formatRestLabel` is already the answer to "we render this figure in three places"; this file is the second instance of that pattern rather than a new one.

The three call sites each replace an inline template string with the call. `ExerciseListReadOnly` and `ExerciseListLogged` keep their `Meta: ` prefix and their `· Descanso: …` suffix — only the `{ex.sets}×{ex.reps}` fragment changes.

### Decision 3 — Wrapping is part of this change, not a follow-up

The pill is a `<span>` inside `<div className="flex gap-2 flex-wrap mt-2">`. It grows from roughly 50px to roughly 200px and now carries author-controlled text, which puts it squarely in the `long-text-wrapping` surface class. As a flex child its default `min-width: auto` makes `overflow-wrap` inert, so it needs `minWidth: 0` alongside `overflowWrap: "break-word"` — the same pairing the admin message-subject heading needed.

*Why now:* the surface becomes a free-text surface as a direct result of this edit. Deferring it recreates precisely the split that review rule 21 was written about.

### Decision 4 — Tests cover the helper; the layout is verified by eye

Unit tests assert the count, range (all three separators), whitespace-trimmed, and fallback cases. jsdom has no line boxes, so no test can prove the pill wraps; that is a manual check at 375px on the Preview URL, recorded on the smoke card.

## Risks / Trade-offs

- **The sniff regex misclassifies a value Aura writes later** (e.g. `12 por lado` → falls back, reading `4 series × 12 por lado`) → Acceptable: the fallback is today's behavior, never worse than the status quo. The failure mode is a missing word, not a wrong one.
- **A range typed with a comma or `x` (`10, 12`) falls back** → Same as above, and unobserved in the catalog. Widening the regex later is a one-line change with a new test.
- **The badge row grows a line on narrow screens**, adding vertical height to every exercise on a long day → Accepted; it is the direct cost of the wording Aura asked for. Confirm at 375px that the two badges stack cleanly rather than looking broken.
- **A future contributor adds a fourth surface with an inline string** → Mitigated by the shared helper plus the spec requirement that all surfaces render identical text.

## Migration Plan

None. No schema change, no data change, no dependency. Presentation-only, so rollback is a revert of the branch.

## Open Questions

None. Wording (`×`, not `de`), scope (all three surfaces), the redundant heading (left alone), and the fallback strategy were all settled in the explore session.
