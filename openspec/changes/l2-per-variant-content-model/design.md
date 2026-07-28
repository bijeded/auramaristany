## Context

`program_series` currently carries `unique(program_id, series_number)`, which makes a series number unique across an entire program. A program holds several levels, each of which needs its own curriculum numbered from 1, so the constraint makes Aura's actual content impossible to author: the whole Strong & Fit program can hold six series total, shared across three levels that are meant to be three distinct half-year curricula.

Explored 2026-07-27. Aura confirmed content differs **per variant**, not per level — CuarentaMás Principiante *Poco Tiempo* and Principiante *Tiempo Suficiente* are different workouts, not the same workout at a different duration. That is what rules out the cheaper fix.

All current content is demo content and will be rewritten. This is the last moment the restructure is free.

## Goals / Non-Goals

**Goals**
- Aura can author an independent, ordered curriculum for every variant.
- A series' position is expressed once, unambiguously, and belongs to the variant that shows it.
- The rung order between variants is declared as data, ready for the ladder.
- Content resolution keeps working exactly as it does today for every existing client.

**Non-Goals**
- Rung traversal, the top-rung loop, the content pointer — all `l2-level-ladder-progression`.
- Any billing change — `l2-rolling-billing-extra`.
- Preserving existing demo content.
- Reworking `program_days`, blocks, or the pillars editor. The `(series_id, week_number, day_of_week)` grid is unaffected, and pillar blocks key off `series_id`.

## Decision 1 — Position moves to `variant_series_map.ordinal`

**Rejected: add `level` to `program_series`,** with `unique(program_id, level, series_number)`. It matches how Aura talks about the content and it is the smaller migration, but it assumes `level` is the content axis. It is not — `time_availability` splits content too, so CuarentaMás Principiante Poco and Principiante Suficiente would collide on `(program, principiante, 1)`. The constraint would have to become `unique(program_id, level, time_availability, series_number)`, which is the variant's identity spelled out the long way.

**Chosen:** the join table carries the position.

```
program_series          identity + content (title, description, published, days)
variant_series_map      program_variant_id, series_id, ordinal
                        unique (program_variant_id, ordinal)
```

A variant's curriculum is its ordered list of mapped series. "Mes 3 de Strong & Fit Avanzado" is the map row with `ordinal = 3`. Because position lives on the mapping rather than on the series, a series shared by two variants can legitimately sit at a different position in each.

## Decision 2 — `program_series.series_number` is dropped, not retained

The proposal originally kept it as a "stable authoring label". That is a mistake: with `ordinal` carrying position and `unique(program_id, series_number)` gone, `series_number` would be a second month-number with no integrity guarantee and no reader — free to drift from the ordinal actually shown to clients. Two numbers that mean the same thing and can disagree is precisely the defect this change exists to remove.

The column is dropped. Display month numbers come from `ordinal`, scoped to the variant being viewed.

## Decision 3 — Readers advance to the *next existing* ordinal, never to `ordinal + 1`

`unique(program_variant_id, ordinal)` prevents duplicates but not gaps. If Aura deletes the Mes 3 mapping of a six-month curriculum, ordinals become `1,2,4,5,6`.

This matters more than it looks, because `l2-level-ladder-progression` advances a client by testing whether a series exists at `ordinal + 1`. Against a gap that test fails at 3, and the client is pushed to the **next rung** six months early — a silent, serious mis-advance.

**Rule for every reader:** the successor of ordinal *n* is the smallest ordinal greater than *n* mapped to that variant, and "end of rung" means no such ordinal exists. Gaps then degrade to a cosmetic numbering oddity instead of a progression bug.

The admin surface should still keep ordinals contiguous, but correctness must not depend on it. **This requires a corresponding change to `l2-level-ladder-progression`'s advance rule, which currently specifies literal `ordinal + 1`.**

## Decision 4 — Every series must be mapped to at least one variant

`createSeries` currently tolerates an empty `variantIds`, producing a series attached to a program and reachable by nobody. Once position lives on the mapping, an unmapped series has no position at all — it is not merely unreachable, it is unrepresentable in any curriculum.

Creation therefore requires at least one variant. Removing a series' last mapping is a deletion and is presented as one.

## Decision 5 — `ladder_next_variant_id` is written here and read later

`program_variants` gains a nullable self-reference declaring rung order: Strong & Fit Principiante → Intermedio → Avanzado → null, Extra Intermedio → Avanzado → null, every CuarentaMás variant null. Reasoning for declaring rather than inferring from `level` is recorded in `l2-level-ladder-progression`'s design (Decision 3); the column is seeded here so the ladder change has data to traverse.

Nothing reads it in this change. It must not be self-referential, and the seeded chains must terminate — a cycle would not hang the later traversal (it advances one step per invoice) but would cycle a client through rungs forever.

## Decision 6 — The migration is destructive

Series, days, blocks and mappings are dropped and reseeded rather than backfilled. Backfilling would mean inventing per-variant ordinals for series currently shared across all five CuarentaMás variants, and the result would be discarded when Aura writes the real curriculum anyway.

**This is safe only while all content is demo.** If real content exists when this is implemented, stop and re-scope to a backfill — the migration as designed would destroy Aura's work.

## Risks / Trade-offs

- **The admin editor restructures**, from one list per program to one ordered list per variant. This is the largest single piece of work in the change and the part Aura sees. A series shared across variants now appears in each variant's list, which is correct but new.
- **Sharing becomes rarer but is deliberately retained.** Given content differs per variant, most series will map to exactly one. The many-to-many is kept anyway: it costs nothing, it already exists, and collapsing it to a foreign key would forbid the shared-content case permanently.
- **`l2-level-ladder-progression` was written before Decision 3** and specifies `ordinal + 1`. It must be reconciled before it is implemented.
- **Silent breakage risk in A4.** `lib/cron/notice-queries.ts` resolves `series_id` the same way the portal does. If it is missed, the automated-message rules keep running and quietly stop matching.
