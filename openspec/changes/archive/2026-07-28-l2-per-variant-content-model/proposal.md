## Why

Aura cannot author the content she needs. `program_series` carries `unique(program_id, series_number)` ([001_initial_schema.sql:92](../../../supabase/migrations/001_initial_schema.sql)), but a program holds **several levels** — CuarentaMás Extra has Intermedio and Avanzado, Strong & Fit has Principiante, Intermedio and Avanzado. Each level needs its own six months of content numbered from 1. The moment she creates "Mes 1" for Extra Avanzado after "Mes 1" for Extra Intermedio, `createSeries` returns `El mes 1 ya existe en este programa` ([seriesActions.ts:42-43](../../../lib/admin/seriesActions.ts)).

Today the whole Strong & Fit program can hold exactly six series total, shared across three levels that are meant to be three distinct half-year curricula.

It is worse than a numbering clash. Content differs **per variant**, not per level: CuarentaMás Principiante *Poco Tiempo* and Principiante *Tiempo Suficiente* are different workouts, not the same workout with a different duration. So the axis that owns an ordering is the **variant**, and `series_number` — a program-wide integer that doubles as both identity and position — cannot express it.

This lands first and alone because it is a content-authoring blocker that exists independently of any billing question, and because **all current content is demo content that will be redone**. The rebuild is destructive today and expensive after Aura writes the real curriculum. This is the last cheap moment.

## What Changes

- **Position moves out of `program_series` and into `variant_series_map`.** The map gains `ordinal int not null` with `unique(program_variant_id, ordinal)`. A variant's curriculum is its ordered list of mapped series; "Mes 3 de Strong & Fit Avanzado" is the map row with `ordinal = 3`.
- **`series_number` is dropped entirely**, along with its `unique(program_id, series_number)` constraint. Keeping it as a "label" would leave a second month-number with no integrity guarantee and no reader, free to drift from the `ordinal` actually shown to clients — two numbers meaning the same thing and able to disagree. Display month numbers come from `ordinal`, scoped to the variant being viewed.
- **Readers advance to the next *existing* ordinal, never to `ordinal + 1`.** The unique constraint prevents duplicates but not gaps; deleting a middle mapping leaves `1,2,4,5,6`. Successor is defined as the smallest ordinal greater than the current one, so a gap stays a cosmetic oddity instead of pushing a client into the next rung early.
- **Every series must map to at least one variant.** `createSeries` currently tolerates an empty selection, producing a series reachable by nobody; once position lives on the mapping, an unmapped series has no position at all.
- **`program_variants` gains `ladder_next_variant_id`** (nullable self-reference). It declares the progression Principiante → Intermedio → Avanzado explicitly rather than inferring it from the `level` enum's alphabetical or declared order. The column is written here and **read by the next change** — this change ships the schema and admin surface, not the traversal.
- **Content resolution switches to `ordinal`.** `getCurrentSeriesNumber(months_elapsed)` becomes an ordinal lookup scoped to the subscription's variant. Behavior is unchanged for every client who entered at their program's first rung, which is every client today; the ladder itself arrives in `l2-level-ladder-progression`.
- **Admin authoring becomes variant-scoped.** `/admin/content/[programId]` groups series by variant, and "Mes #" is the ordinal within the variant being edited. Creating a series requires choosing the variant it belongs to.
- **Destructive migration.** Existing demo series, days, blocks and maps are dropped and reseeded. No backfill, no dual-read window.

## Capabilities

### New Capabilities
- `content-curriculum-model`: how a variant's ordered curriculum is expressed (`variant_series_map.ordinal`), how successor position is defined, how a series is resolved for a subscription, and the declared rung order between variants.
- `admin-content-authoring`: how Aura authors an ordered curriculum per variant — creating a series at a position, the mandatory variant mapping, shared series, and deletion.

### Modified Capabilities
<!-- None. No spec covers the content editor or the content model today (both predate OpenSpec
     adoption in this repo), so there is no existing requirement text to modify. -->


## Impact

- **Migration 015 (destructive).** `variant_series_map` + `ordinal` and its unique constraint; drop `program_series_program_id_series_number_key`; `program_variants.ladder_next_variant_id`. Reseed demo content under the new shape. ⚠ Destructive by design — safe **only** while all content is demo. If Aura has begun authoring real content when this is picked up, **stop and re-scope**.
- **Modified code:** `lib/content/queries.ts` (series resolution ×2 call sites) · `lib/content/access.ts` (`getCurrentSeriesNumber`) · `lib/content/pillars.ts` (resolves via `series_number`) · `lib/cron/notice-queries.ts` (A4 resolves `series_id` the same way — **the automated-message rules break silently if missed**) · `lib/admin/queries.ts` (`getAdminProgram`) · `lib/admin/seriesActions.ts` · `components/admin/{SeriesAccordion,SeriesFormModal,SeriesDeleteDialog}.tsx` · `lib/supabase/types.ts`.
- **Unchanged:** `months_elapsed` and its role as the billing arbiter; `program_days` and its `(series_id, week_number, day_of_week)` grid; every block type; RLS policies.
- **Explicitly out of scope:** rung traversal, the Avanzado loop, billing model changes. `ladder_next_variant_id` is populated but unread until the next change.
- **No external dependency on Aura**, but she should not author real content until this lands.
