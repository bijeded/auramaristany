## 1. Churn derivation (pure, TDD)

- [ ] 1.1 Write tests for `isChurned` in `__tests__/` covering every value of the nine-value `subscriptions.status` `CHECK`: `canceled` → true; `completed` → false even with `cancel_at_period_end` and `completed_at` set; `active` mid-grace → false; `unpaid`, `past_due`, `trialing`, `paused` → false; `incomplete`, `incomplete_expired` → false.
- [ ] 1.2 Implement `isChurned` in `lib/portal/cancellation.ts`, directly below `deriveCancellationState`, typed against the `SubscriptionStatus` alias from `lib/supabase/types.ts`.
- [ ] 1.3 Add the comment that keeps the two derivations apart: `deriveCancellationState` answers what a **live** subscription can do now and returns `none` for terminal rows; `isChurned` answers whether a subscription **ended** in churn. State that neither can serve the other's question, so a future cleanup pass does not merge them.
- [ ] 1.4 Delete the D18 "no caller yet" paragraph from `cancellationReasonLabel`'s doc comment — this change is the admin view it predicted. Keep the rest of the comment.

## 2. Denominator + grouping helpers (pure, TDD)

- [ ] 2.1 Write tests for the churn denominator membership set: the seven counted statuses in; `incomplete` and `incomplete_expired` out; an unrecognized status string in neither numerator nor denominator, with the chart data still produced.
- [ ] 2.2 Implement the denominator set in `lib/admin/finance-helpers.ts` with an explicit `false` default for unknown statuses, and a comment naming `incomplete`/`incomplete_expired` as deliberately excluded (an abandoned checkout was never a client and would drive every rate toward zero).
- [ ] 2.3 Write tests for `groupChurnByVariant`: 3 churned of 12 → `{ churned: 3, everSubscribed: 12, rate: 25 }`; a variant whose only rows are `completed` is absent; 8 `incomplete_expired` rows do not change a rate; ordering is by `churned` descending; `Math.round` on the rate; empty input → `[]`.
- [ ] 2.4 Implement `groupChurnByVariant`, numerator via `isChurned`, denominator via the set from 2.2.
- [ ] 2.5 Write tests for `groupCancellationReasons`: counts sum to the input length; `pago_fallido` included; shares are whole numbers; unused reasons absent; ordering by count descending; empty input → `[]`.
- [ ] 2.6 Implement `groupCancellationReasons`, taking labels from `cancellationReasonLabel` (no second label map).
- [ ] 2.7 Add a display helper (or inline formatting in the page) producing the `"3 (25%)"` string, so `VariantBarList` keeps `value` = raw count and needs no change.

## 3. Queries

- [ ] 3.1 Add `getChurnByVariantAllTime()` to `lib/admin/finance-queries.ts`: RLS-aware client, `from("subscriptions").select("status, program_variants!program_variant_id(name)")`, no status filter (the helper partitions). Errors through `logAndGeneric`, returning `[]`.
- [ ] 3.2 Add `getCancellationReasonsAllTime()`: RLS-aware client, `from("cancellation_surveys").select("reason")`, no join, no read of `detail`. Errors through `logAndGeneric`, returning `[]`.
- [ ] 3.3 Add the row types to the file's existing type block and, if a join shape requires it, a `// keep:`-marked cast that is not narrower than the database.
- [ ] 3.4 Confirm no service-role client is introduced in either query, and that neither is imported from anything outside the admin dashboard route.

## 4. Tokens

- [ ] 4.1 Measure candidate bar fills against `--gris-claro` (`#f5f5f5`), not against white. Pick two distinct tokens clearing 3:1, outside the green family reserved for graduation; `--ambar` is the candidate for the churn-by-variant card.
- [ ] 4.2 If no existing token qualifies for the second card, add one to `app/globals.css` with a comment recording its measured ratio against the track. No hand-written hex in any component.

## 5. Dashboard cards

- [ ] 5.1 Extend the `Promise.all` in `app/admin/dashboard/page.tsx` with the two new queries.
- [ ] 5.2 Render the pair below the "Pagos recientes" card: `flex`, `gap: 16`, `alignItems: stretch`, mirroring the existing variant pair's anatomy so both headers are the same height and the first rows align.
- [ ] 5.3 "Cancelaciones por variante" — title, subtitle naming the denominator ("% de quienes se suscribieron") plus "Histórico completo", `VariantBarList` with `value` = count and `display` = `"3 (25%)"`, empty state in Mexican Spanish.
- [ ] 5.4 "Razones de cancelación" — title, subtitle ("% del total de cancelaciones" + "Histórico completo"), same bar list shape, empty state in Mexican Spanish, labels from `cancellationReasonLabel`.
- [ ] 5.5 Proofread every new string: neutral Mexican Spanish, 'cliente' never 'clienta', no "bienestar", first person where the existing cards use it.
- [ ] 5.6 Check the pair at mobile, tablet and desktop widths — no horizontal overflow, no bar list collapsing to zero width.

## 6. Specs and docs

- [ ] 6.1 Add the churn-rate line to `docs/adr/0004-ending-subscriptions-money-versus-access.md`: a rate is neither a money nor a people figure — its numerator counts departures and its denominator is a people figure that deliberately includes graduations.
- [ ] 6.2 Grep `docs/adr/*.md` for any statement that `deriveCancellationState` is the *only* cancellation derivation and amend it to name `isChurned` alongside (rule 20 — an ADR is what a future reader consults before the code).
- [ ] 6.3 Run `openspec validate` and `/opsx:sync` for the two spec files.

## 7. Verification

- [ ] 7.1 Local gate: `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` — all green, no test count regression.
- [ ] 7.2 Runtime verification on the Preview URL, which CI cannot cover: both cards render with real data; the `program_variants!program_variant_id` embed returns rows rather than a PostgREST error (check the server log, not just an empty card); percentages match a hand count against the database.
- [ ] 7.3 Verify both empty states — a variant with no churn absent from the card, and the reasons card's empty message when no survey row exists.
- [ ] 7.4 Verify `pago_fallido` appears as "Pago fallido" when a dunning-exhausted survey row exists, and that no `detail` text appears anywhere on the dashboard.
- [ ] 7.5 `code-review` subagent verdict before the PR. Security review is not required: no new write path, no new secret, no service-role client, no user input reaching either query.
- [ ] 7.6 Open the PR stating explicitly that step 7.2 ran against the real database and what it showed.

## Parallelization

N/A — sequential. Group 2 depends on `isChurned` from group 1; group 5 depends on 2, 3 and 4.
Group 3 has no logical dependency on 1–2 but shares `finance-queries.ts` and `finance-helpers.ts`
with them, so a parallel branch would only buy merge friction.

Sequential: 1 → 2 → 3 → 4 → 5 → 6 → 7
PR grouping: one PR, three review units — A (groups 1–2, pure), B (3–4, queries + tokens),
C (5–6, cards + docs, UI-bearing).
