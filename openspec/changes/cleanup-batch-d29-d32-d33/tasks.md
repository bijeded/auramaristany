# Tasks

## 1. D29 — one weight-unit toggle

- [x] 1.1 Create `components/portal/WeightUnitToggle.tsx` from the `UnitToggle` in `ExerciseListBlock.tsx`, with the same styles, the transition and an optional layout `className`. Verify with `npx tsc --noEmit`.
- [x] 1.2 Replace the local `UnitToggle` in `ExerciseListBlock.tsx` and the inline copy in `PerformanceTab.tsx` with it. Verify: `grep -rn '\["kg", "lb"\]' components` finds only the new file.

## 2. D32 — `created_at` nullability

- [x] 2.1 Widen `cancellation_surveys.Row.created_at` to `string | null` in `lib/supabase/types.ts`, and leave `nullsFirst: false` in `clients-queries.ts` as it is. Verify with `npx tsc --noEmit`.

## 3. D33 — single font definition

- [x] 3.1 Point `tailwind.config.ts` `fontFamily.head`/`body` at `var(--font-head)`/`var(--font-body)`. Verify `npm run build` succeeds, and check in the compiled CSS that `.font-head` resolves to `var(--font-head)`.

## 4. Verification and handoff

- [x] 4.1 Run `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`, and confirm all four are green.
- [ ] 4.2 On the Preview URL at ~375px (non-destructive, using an existing demo client): check `/portal/today` on an exercise with weight, and Desempeño with Peso selected. The toggles look identical and both animate. Headings are in Oswald and body text in Hind on the portal, admin and login pages.
- [x] 4.3 Remove D29, D32 and D33 from `BACKLOG.md`.
- [ ] 4.4 Open PR `chore: unify weight toggle, font tokens and survey created_at type (D29, D32, D33)`. Silent-defect flag: **yes, `types.ts` of a table with a DB column constraint mismatch (D32)**. It isn't an enum, money or a migration.
