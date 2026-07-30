## Why

The dashboard tells Aura how much she earns and how many clients she serves, but nothing about who leaves or why. `cancellation_surveys` has been collecting reasons since migration 011 and no screen has ever read it — the data exists and is invisible. Worse, the only churn figure on the dashboard is "Cancelaciones (próx. 7 días)", a 7-day forward count: Aura can see a cancellation coming but has no way to ask whether one variant leaks clients faster than the others, or whether people leave over price, time, or results.

Two all-time charts close that gap with no new table and no migration.

## What Changes

- **New chart "Cancelaciones por variante"** on `/admin/dashboard`, below "Pagos recientes". One row per program variant, showing the raw count of churned subscriptions and, in parentheses, that variant's all-time churn rate — `3 (25%)` reads "3 people left, a quarter of everyone who ever subscribed to this variant".
- **New chart "Razones de cancelación"** beside it. One row per reason from `cancellation_surveys`, raw count plus share of all surveyed cancellations — `5 (42%)`. `pago_fallido` (involuntary, written by the Stripe webhook when dunning is exhausted) is included: it is churn Aura can actually act on, and hiding it would make the reasons chart cover a population nobody can name.
- **New pure helper `isChurned`** in `lib/portal/cancellation.ts`, next to `deriveCancellationState`. The existing derivation answers a **live** subscription's question ("what can this client do right now") and returns `none` for a terminal `canceled` row, so it cannot serve as the churn numerator. `isChurned` answers the historical question — *did this subscription end in churn, or in graduation?* — and exists precisely so that a graduated client can never be counted as churn.
- **Churn denominator is defined once and stated in the spec**: `active`, `trialing`, `past_due`, `unpaid`, `paused`, `completed` and `canceled` all count as "ever subscribed"; `incomplete` and `incomplete_expired` are excluded, because a checkout that never completed was never a client and would dilute every rate toward zero. `unpaid` sits in the denominator only, matching the existing client list, which files `past_due` and `unpaid` together under "Vencidas" in amber — a client in trouble, not a client gone.
- **`cancellationReasonLabel` gets its first caller.** Its doc comment says it is kept alive for "la vista de admin sobre `cancellation_surveys`, que es un cambio aparte y planeado". This is that change; the comment is retired in the same diff so the next dead-export sweep does not read a prediction as a fact.
- No new component: `VariantBarList` renders both charts unchanged — `value` carries the raw count (which scales the bar), `display` carries the `"3 (25%)"` string.
- No migration. Migration 011 already has `cancellation_surveys`, and its admin `select` policy is already in place.

Not breaking: the change is additive to one page.

## Capabilities

### New Capabilities
- `admin-cancellation-analytics`: The dashboard's two churn charts — which subscriptions count as churn and which count as "ever subscribed", why graduation is excluded from the numerator while remaining in the denominator, how each chart's percentage is defined, and why the two charts' totals may legitimately disagree.

### Modified Capabilities
- `admin-dashboard-kpis`: the bar-fill contrast requirement extends to the two new cards, and the existing purpose statement — every figure declares which population it counts — now has to cover a third kind of figure alongside money and people: a rate.

## Impact

- **`app/admin/dashboard/page.tsx`** — two cards appended below the "Pagos recientes" table, in a side-by-side pair mirroring the existing variant pair.
- **`lib/admin/finance-queries.ts`** — two new server-only queries. The variant one reads `subscriptions` (variant is a direct column, so the population is complete) and must disambiguate the embed as `program_variants!program_variant_id` (framework rule 9); the reasons one reads `cancellation_surveys` and needs no join at all.
- **`lib/admin/finance-helpers.ts`** — new pure grouping helpers, with tests.
- **`lib/portal/cancellation.ts`** — `isChurned` added; the D18 "no caller yet" note on `cancellationReasonLabel` removed.
- **`app/globals.css`** — a bar-fill token per new card if the existing two do not suffice; no hand-written hex.
- **`docs/adr/`** — ADR 0004 governs money-versus-people figures. A churn *rate* is neither, so it needs its own line: the numerator is a money-irrelevant count of departures and the denominator is a people figure that deliberately includes graduations.
- No migration, no new dependency, no change to any Stripe or webhook path.
