# Proposal

## Why

The exercise chips in Desempeño come out in a seemingly random order ("1. Push Up Pared a Silla", "5. Crunch de Pie", "4. Elevación Frontal…"). `buildPerformanceSeries` orders them by first appearance, walking `Object.entries(exercises_done)`, but `exercises_done` is `jsonb`. Postgres stores jsonb object keys sorted by length and then by bytes, not in insertion order, so the chips are really sorted by exercise UUID. The template order Aura authored is never consulted.

## What Changes

- The Desempeño chips follow **chronological template order**. Walk the month's logs oldest first. Within each log, walk that day's `exercise_list` blocks by `sort_order`, then each block's `content.exercises` array in order. An exercise's chip slot is the first position where it appears.
- Grouping by normalized name stays as it is. An exercise that repeats on later days keeps the slot it got the first time.
- Logged exercise ids that are not in the day's current template still get dropped, the same as today (they already have no meta).

Non-goals:
- The day-detail screen (`/portal/history/[logId]`) is out of scope. It already renders in template order.
- The admin client profile is out of scope. It shows only counts.
- No change to which exercises appear, to the chart values or aggregation, or to the `kg | lb` toggle.
- No schema or data change, and no ordering by weekday.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `portal-performance-display`: adds a requirement that the exercise chips follow chronological template order.

## Impact

- `lib/content/history-helpers.ts`: `LogForPerf` carries the day's ordered exercise ids, and `buildPerformanceSeries` iterates them instead of the jsonb keys.
- `lib/content/history.ts` (`getPerformanceData`): selects `sort_order` and builds the ordered id list for each day.
- `__tests__/history-helpers.test.ts`: new failing-first test.
- **Sensitive surface:** none. The change adds no auth, RLS, service-role, webhook, money or migration work, and it has no fan-out. The query stays on the RLS-aware client.
- **Review rules touched:** none of the numbered rules apply directly. Rule 12 is not affected, because no `!inner` joins or published filters change.
