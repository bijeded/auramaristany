## 1. Preconditions

- [ ] 1.1 Confirm `l2-per-variant-content-model` is merged and its migration applied — `variant_series_map.ordinal` and `program_variants.ladder_next_variant_id` must exist. Stop here if not.
- [ ] 1.2 Run `/opsx:sync` for `l2-per-variant-content-model` so `content-curriculum-model` exists in `openspec/specs/` before this change is synced.
- [ ] 1.3 Verify the backfill assumption against live data: every existing subscription entered at its program's first rung, so `content_variant_id = program_variant_id` and `content_ordinal = months_elapsed` is correct. Record the row count checked.
- [ ] 1.4 Confirm `ladder_next_variant_id` is populated: Strong & Fit Principiante → Intermedio → Avanzado → null; Extra Intermedio → Avanzado → null; all CuarentaMás variants null.

## 2. Migration 016

- [ ] 2.1 Write `supabase/migrations/016_content_ladder_pointer.sql` adding `content_variant_id` (FK to `program_variants`), `content_ordinal` (int, not null, default 1), `content_loops` (int, not null, default 0) to `subscriptions`.
- [ ] 2.2 Backfill existing rows from `program_variant_id` and `months_elapsed` per task 1.3.
- [ ] 2.3 Apply via the Supabase Management API — **SQL on ONE single line** (the pipeline eats newlines and `--` comments out the remainder).
- [ ] 2.4 Update `lib/supabase/types.ts` by hand for the three new columns (keep `Relationships: []`).

## 3. Advance rule (pure, TDD)

- [ ] 3.1 Write failing tests for the advance rule covering, in order: fixed-term freeze, advance within a rung, advance across a gap in the ordinals (successor is the next existing ordinal, never `+1`), advance to the next rung, wrap at the top rung, reaching newly published content instead of wrapping.
- [ ] 3.2 Add a test asserting branch **order**: a fixed-term subscription at `duration_months` whose variant declares no next rung must freeze, not wrap. This is the guard that keeps this change correct while shipping ahead of `l2-rolling-billing-extra`.
- [ ] 3.3 Add a test asserting rung length is read from the series present at evaluation time, never from a stored count.
- [ ] 3.4 Implement the pure advance function until the tests pass. It takes the current position, the rung's available ordinals, the declared next rung, and the program's billing model plus duration; it returns the next position. No DB access.

## 4. Webhook: idempotency and advancement

- [ ] 4.1 Write a failing test: a redelivered `invoice.paid` for an already-recorded invoice leaves `months_elapsed` and all three pointer columns unchanged.
- [ ] 4.2 Change `recordInvoice` to report whether it inserted a new row or hit the `stripe_invoice_id` conflict.
- [ ] 4.3 Gate the `months_elapsed` increment on that result, closing the existing unguarded-increment defect.
- [ ] 4.4 Advance the content pointer in the same guarded path, using the pure function from task 3.4.
- [ ] 4.5 Initialise the pointer on subscription creation in `handleCheckoutCompleted`: `content_variant_id = program_variant_id`, `content_ordinal` = that variant's **smallest mapped ordinal** (not a hardcoded 1), `content_loops = 0`.
- [ ] 4.6 Verify the fixed-term freeze end to end with a simulated CuarentaMás subscription past month 6.

## 5. Content resolution via the pointer

- [ ] 5.1 Switch `lib/content/queries.ts` series resolution (both call sites) to `(content_variant_id, content_ordinal)`.
- [ ] 5.2 Switch `lib/content/pillars.ts` to the pointer.
- [ ] 5.3 Switch `lib/cron/notice-queries.ts` to the pointer — the A4 automated-message rules resolve `series_id` the same way and break silently if missed.
- [ ] 5.4 Remove `getAccessibleSeries` from `lib/content/access.ts` and its tests (no production callers; the cumulative rule it documents has never run).
- [ ] 5.5 Run the full suite and confirm no remaining reader addresses content by `months_elapsed`.

## 6. Portal display

- [ ] 6.1 Add the persistent repeat marker ("Repitiendo Mes N") to the day view, shown while `content_loops > 0`. Low emphasis, warm first-person Spanish, no modal.
- [ ] 6.2 Make the progress label rung-aware for `rolling_monthly`: "Avanzado · Mes 2" instead of an elapsed-month count or an empty denominator.
- [ ] 6.3 Keep the fixed-term label as "Mes X de Y" (`lib/admin/clients-helpers.ts` `subscriptionProgressLabel` and `components/portal/settings/SubscriptionCard.tsx`).
- [ ] 6.4 Audit every read that means "the client's level" and choose deliberately between `program_variant_id` (what she pays for) and `content_variant_id` (what she is doing). Known cases: `ClientDetailTabs`, the portal header.

## 7. Admin content-runway signal

- [ ] 7.1 Write the runway query: for each active subscription, the number of authored series remaining ahead of her, and whether her declared next rung has any series at all.
- [ ] 7.2 Surface one admin list covering both shapes, with the empty-next-rung case marked more urgent.
- [ ] 7.3 Handle the empty state explicitly ("no client is running out of content") rather than rendering a blank area.
- [ ] 7.4 Confirm the screen is behind `requireAdminPage()`.

## 8. Verification

- [ ] 8.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all green.
- [ ] 8.2 Smoke on a Preview URL with a test-checkout subscription: advance a month via Stripe test clock or a replayed invoice and confirm the pointer moves exactly one step.
- [ ] 8.3 Smoke the redelivery case: replay the same `invoice.paid` from the Stripe dashboard and confirm nothing moves.
- [ ] 8.4 Smoke rung crossing: a subscription at the last ordinal of a rung advances into the next rung at ordinal 1.
- [ ] 8.5 Smoke the wrap: a top-rung subscription at its last ordinal wraps to 1, increments `content_loops`, and shows the repeat marker.
- [ ] 8.6 Update `BACKLOG.md` (L2b → ✅ Done), run `/opsx:sync`, `openspec validate`, then `/opsx:archive`, and re-index codebase-memory in `fast` mode.
