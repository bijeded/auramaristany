# Proposal

## Why

Three backlog debts share one root cause: one decision recorded in two places that already disagree or can drift silently. D29 is the `kg | lb` toggle written twice, and the two copies have already drifted. D32 is `cancellation_surveys.created_at` typed non-nullable while the DB allows null. D33 is the font stacks declared in both `globals.css` and `tailwind.config.ts`. Each is XS, and none is blocked on Aura.

## What Changes

- **D29:** one exported `WeightUnitToggle` component used by both `/portal/today` (`ExerciseListBlock.tsx`) and Desempeño (`PerformanceTab.tsx`). Both screens get the `0.15s` transition. Delete the "both copies must stay identical" sentence and scenario wording from the `portal-performance-display` spec.
- **D32:** widen `cancellation_surveys.Row.created_at` in `lib/supabase/types.ts` to `string | null`. There's no migration.
- **D33:** `tailwind.config.ts` `fontFamily.head`/`body` point at `var(--font-head)` / `var(--font-body)`, so `globals.css` is the single definition.

**Non-goals:** a `not null` migration for `created_at` (the D32 alternative; deferred on purpose, see design). Touching `nullsFirst: false` in `getClientDetail` (keep it). D30 render tests, even though D29 creates a component they could target. Any change to the toggle's 32px/44px dimensions or the documented 32px exception.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `portal-performance-display`: the toggle requirement stops asserting that two copies stay identical, and states one shared control instead.

## Impact

- Code: `components/portal/blocks/ExerciseListBlock.tsx`, `components/portal/PerformanceTab.tsx`, a new shared toggle component under `components/portal/`, `lib/supabase/types.ts`, `tailwind.config.ts`.
- Review rules touched: **8** (duplicated tables, here applied to JSX and tokens), **10** (hand-maintained `types.ts`), and **21** (layout verified by eye at ~375px, since nothing in CI resolves a font or lays out text).
- **Sensitive surface: none.** No auth, RLS, service-role, webhooks, money or migrations. No fan-out.
- Visible change: the Desempeño toggle now animates its pressed state. Font rendering must look the same.
