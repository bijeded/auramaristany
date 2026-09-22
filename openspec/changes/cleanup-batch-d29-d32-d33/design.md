# Design

## Context

See proposal.md for the three items. Only D32 involves a real choice. D29 and D33 are mechanical unifications.

## Goals / Non-Goals

**Goals:** each decision has one source of truth. There are no visual changes except the Desempeño transition.

**Non-Goals:** changing the schema. Adding component render tests (D30).

## Decisions

- **D32: widen the type, don't migrate.** The type becomes `created_at: string | null`, which matches migration 011 as it stands. The alternative was a `not null` migration. It would make the column stricter, but it's a schema change. Rule 11 would then require a check against the real DB, and the change would pick up a sensitive surface. That cost is out of proportion for an XS item. `getClientDetail`'s `nullsFirst: false` stays as it is. Single source of truth: migration 011, with `types.ts` following it.
- **D29: one `WeightUnitToggle` in `components/portal/WeightUnitToggle.tsx`,** with props `{ unit, onChange }`, plus an optional `className` for layout-only placement (Desempeño needs `ml-auto`). The styling comes from the current `ExerciseListBlock` copy: inline `style` with padding `4px 12px` and the transition. Callers can't override the dimensions.
- **D33: tokens flow CSS to Tailwind.** Tailwind reads `var(--font-head)` and `var(--font-body)`. The fallback stack lives only in `globals.css`. The single source of truth for the fonts is `app/globals.css` `:root`.

## Risks / Trade-offs

- A `var()` in `fontFamily` renders the wrong face if the property isn't defined at the use site. → `:root` defines it everywhere. Check by eye on the marketing, auth, portal and admin pages.
- Widening the type can surface `tsc` errors in any reader that treats `created_at` as a string. → Today no reader consumes the survey's `created_at` value (it is only used to order). `tsc` confirms this.
