## Context

`/admin/dashboard` currently ends with the "Pagos recientes" table. Above it sit six KPI cards, a 12-month revenue chart, and a side-by-side pair of bar lists ("Clientes por variante", "Ingresos por variante") that share `VariantBarList`. Every figure on the page declares which population it counts, because money figures and people figures deliberately disagree (ADR 0004).

`cancellation_surveys` (migration 011) has been collecting `reason`, `detail` and `source` since the portal cancel flow shipped, written by the client under RLS and by the Stripe webhook under service-role for `pago_fallido`. Nothing reads it. `cancellationReasonLabel` in `lib/portal/cancellation.ts` was kept alive by an explicit doc comment predicting this change.

Constraints that shape the design:

- **Two lifecycle questions, not one.** `deriveCancellationState` is the single derivation for "what can this live subscription do right now" (framework rule 13, ADR 0003/0004). It returns `none` for a terminal `canceled` row. The churn charts ask a different question about ended subscriptions, so a second named derivation is required — extending the first would either break its callers or return zero.
- **Status unions are never narrower than the DB `CHECK`** (rule 8). Migration 017 widened `subscriptions.status` to nine values; a hardcoded six-value union once blanked the entire clients list.
- **PostgREST embed ambiguity** (rule 9): `subscriptions` has two FKs reachable toward programs, so every existing embed already spells out `program_variants!program_variant_id`.
- No migration is available or needed; the table and its admin `select` policy exist and are applied.

## Goals / Non-Goals

**Goals:**

- Two all-time cards below "Pagos recientes": churn count + rate per variant, and reason distribution.
- One named, tested pure helper (`isChurned`) that permanently separates graduation from churn.
- A denominator definition written down once, in a form that survives a future status added to the `CHECK`.
- Zero new UI components — `VariantBarList` renders both cards unchanged.

**Non-Goals:**

- Any time window other than all-time. A 7-day or monthly churn *rate* at this volume is noise; the KPI row already owns the short horizon.
- Per-client drill-down, free-text `detail` display, or a cancellations list screen. The `detail` column is deliberately unread.
- Reconciling the two cards' totals (they legitimately diverge).
- Any migration, new dependency, Recharts usage, or change to webhook/Stripe paths.

## Decisions

### D1 — `isChurned` as a new sibling helper, not a widened `deriveCancellationState`

**Chosen:** add `isChurned(status)` to `lib/portal/cancellation.ts`, immediately below `deriveCancellationState`, with a comment stating which question each answers.

Alternatives rejected:

- *Add a `churned` kind to `CancellationState`.* Every existing caller switches on that union to decide what buttons to show a live client. A new kind is a new branch in each, for a state none of them can encounter.
- *Inline `status === 'canceled'` in the query.* This is exactly the "five readers each derived it differently" failure ADR 0003 exists to prevent, and it is untestable — the queries are not unit-tested by convention.

The comment matters as much as the code: the next reader will otherwise see two cancellation derivations and try to merge them.

### D2 — Denominator as a status membership set with an explicit default

**Chosen:** a `Record<string, boolean>`-shaped set (or a `readonly string[]` typed against the `SubscriptionStatus` alias from `types.ts`) naming the seven counted statuses, consulted with a `false` default. `incomplete` and `incomplete_expired` are named as excluded in a comment, not merely absent, so a reader cannot mistake the omission for an oversight.

The default is the load-bearing part: rule 8's failure mode is a status that exists in the database and not in the union. Here an unknown status must land outside both numerator and denominator and leave the chart rendering — never throw, never blank the card.

*Rejected:* an inverted set ("everything except incomplete") — it auto-enrolls any future status into the denominator, which is the wrong default for a rate.

### D3 — Variant card reads `subscriptions`; reasons card reads `cancellation_surveys`

Two sources, on purpose. `subscriptions.program_variant_id` gives the complete churn population with a direct column; surveys are optional and their `subscription_id` is `on delete set null`, so a survey-based variant chart undercounts and degrades further over time.

Consequence accepted: the two cards' totals may differ. That divergence is stated in both subtitles and mirrors the existing Clientes/Ingresos pair.

### D4 — Two new queries, aggregated in pure helpers

`getChurnByVariantAllTime()` selects `status, program_variants!program_variant_id(name)` from `subscriptions` with no status filter — the helper partitions numerator from denominator, so the query stays dumb and the decision stays tested. `getCancellationReasonsAllTime()` selects `reason` from `cancellation_surveys`, no join.

Both are RLS-aware (`requireAdminPage()` already gates the route; migration 011's `is_admin()` policy covers the read). No service-role client. Errors through `logAndGeneric`, degrading to the card's empty state.

Grouping and percentage formatting live in `lib/admin/finance-helpers.ts` with AAA tests: `groupChurnByVariant(rows)` → `{ variant, churned, everSubscribed, rate }[]` ordered by `churned` desc, and `groupCancellationReasons(rows)` → `{ reason, count, share }[]` ordered by `count` desc.

*Rejected:* a Postgres aggregate / RPC. Rule 10 makes populating `Database["public"]["Functions"]` in `types.ts` a repo-wide `tsc` hazard, and the row counts here are trivially small. Aggregating in TypeScript keeps the logic testable and the types boring.

### D5 — Percentage as an integer inside `display`

`VariantBarList` takes `value` (scales the bar) and `display` (already-formatted string). So `value = churned` and `display = "3 (25%)"`, computed by the helper. No component change, no formatting flag, no knowledge of which card it is rendering.

Rounding: `Math.round`, whole numbers. A rate is a shape-of-the-problem signal, not an accounting figure — `24.7%` implies a precision the sample size does not support. `100%` is reachable and correct (every subscription for a variant churned); `0%` rows do not appear because a variant with no churn is omitted entirely.

### D6 — `pago_fallido` in the reasons card

Included, per the user's decision. It is the one reason with an operational remedy (chase a card update, not a change of mind), and excluding it would make the card describe a population no on-screen label names. It also brings the reasons total much closer to the variant total, which is the friendlier reading of two adjacent cards.

Labels come from `cancellationReasonLabel` — the existing map, not a second one (rule 8's copied-table failure in string form). Its D18 "no caller yet" comment is deleted in this change; leaving a prediction in place after it comes true is how a stale comment outlives its subject.

### D7 — Layout mirrors the existing pair

A `display: flex; gap: 16` row of two `Card`s below "Pagos recientes", each with title, subtitle line, and `VariantBarList` — the same anatomy as the variant pair, including equal-height headers so the first rows align. Subtitles are load-bearing, not decoration: one percentage is a rate and the other a share, and side by side without labels they invite exactly the wrong comparison.

Bar fills: two tokens that clear 3:1 against `--gris-claro`, verified before merge, distinct from each other and outside the green family that the dashboard reserves for graduation. `--ambar` (`#9a7b1f`, already used for the cancellation KPI) is the natural candidate for the variant card; the second is a new token if no existing one qualifies. No hand-written hex (D23).

## Risks / Trade-offs

- **A small denominator makes a loud percentage.** One churn out of one subscription reads `1 (100%)`, which on the demo dataset will look alarming and mean nothing. → Bars rank by count, so the 100% row sits at the bottom where a one-person variant belongs. Accepted for now; a minimum-sample suppression rule is a later refinement if Aura finds it noisy, not something to guess at before she has seen it.
- **The two cards' totals will visibly differ once a client is deleted.** → Both subtitles name their own population, and the divergence is spec'd as intended (ADR 0004 precedent). The alternative — reconciling them — would require a worse data source.
- **A future status added to `subscriptions.status` silently sits outside the denominator.** → The default is `false` by design, so the chart keeps rendering and slightly understates rather than crashing. The spec pins this as a scenario; the comment in the helper names the `CHECK` as the thing to update alongside.
- **`isChurned` looks redundant next to `deriveCancellationState` to a future cleanup pass.** → Both carry comments stating which question they answer and why one cannot serve the other. This is the same failure mode that nearly deleted `cancellationReasonLabel`.
- **Verification gap.** Nothing in CI talks to the database: `tsc`, lint, tests (mocked client) and build all pass on a query that PostgREST rejects — the rule 9 embed being the classic case. → The two queries must be exercised against the real Preview deployment before merge, and the PR states that they were.

## Migration Plan

No database migration. Ship on a branch → Preview URL → PR → green CI → merge. Rollback is a revert: the change is additive to one route, and nothing writes.

Runtime verification on Preview before merge (CI cannot cover any of it): both cards render with real data, the variant embed returns rows rather than a PostgREST error, `pago_fallido` appears when a dunning-exhausted survey row exists, and both empty states render on a variant/table with no rows.

## Open Questions

- Does a second bar-fill token need to be added, or does an existing token clear 3:1 against `--gris-claro` while staying distinct from `--ambar` and outside the green family? Resolved by measurement during implementation, not by guess.
- Whether Aura wants a minimum-sample floor on the churn rate. Deliberately deferred until she has seen the card with real numbers.
