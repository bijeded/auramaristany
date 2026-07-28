## Why

A client who keeps paying is meant to keep progressing. Strong & Fit is six months of Principiante, then six of Intermedio, then Avanzado indefinitely; CuarentaMás Extra is six months of Intermedio, then Avanzado. Nothing in the code does this. Content is addressed by the subscription's own variant, so month 7 of Strong & Fit Principiante resolves to no series at all and `getTodayContent` returns `null` ([queries.ts:141](../../../lib/content/queries.ts)) — the client is charged and shown nothing.

A second path is broken in the same place. Aura evaluates clients on the WordPress site and redirects those who are ready straight to Intermedio or Avanzado. Content position is currently `months_elapsed`, so a client entering at Intermedio is served **month 1 of Principiante** — wrong content from day one, in a strength program for women 40+ where level is a safety property, not a preference.

## What Changes

- **Content position becomes explicit state on the subscription**, replacing `months_elapsed` as the content address. Three new columns: `content_variant_id` (the rung), `content_ordinal` (position within it), `content_loops` (times wrapped at the top rung). `months_elapsed` is untouched and keeps its role as the billing/progress arbiter.
- **One advance rule, applied on each paid month**, covers rung progression, variable rung length, entry at any level, and the top-rung loop:
  ```
  next = smallest mapped ordinal > content_ordinal   (NOT content_ordinal + 1)
  ├─ such an ordinal exists              → ordinal = next
  ├─ else ladder_next_variant_id is set  → variant = next rung, ordinal = first mapped
  └─ else                                → ordinal = first mapped, loops += 1
  ```
  Successor is the **next existing** ordinal, never `+1`: `unique(program_variant_id, ordinal)` prevents duplicates but not gaps, and deleting a mapping from the middle of a curriculum leaves `1,2,4,5,6`. Testing for `+1` would treat the gap as the end of the rung and push the client into the next level six months early.
  Rung length is read at advance time, never derived from a stored count, so publishing new content never retroactively shifts a live client. A client sitting at the last Avanzado series when Aura publishes the next one advances *into* it instead of wrapping past it.
- **Fixed-term programs never wrap.** The wrap branch triggers on a null `ladder_next_variant_id` — which is exactly what CuarentaMás variants carry. Since real fixed-term termination does not land until `l2-rolling-billing-extra`, this change must guard it itself: a `fixed_term_monthly` subscription that has reached `duration_months` **stops advancing** and its pointer freezes. Without this guard, shipping the ladder alone would make CuarentaMás clients wrap to Mes 1 and repeat the program indefinitely. The fixed-term check is evaluated **before** the wrap branch.
- **`getAccessibleSeries` is removed rather than ported.** It has no production callers — only tests. The rule it documents ("Strong & Fit is cumulative: series 1…n−1 fully accessible") has therefore never run, and reimplementing it against the ladder would be shipping a new, unrequested behavior under cover of a refactor. If cumulative access to completed rungs is wanted, it is a separate product decision.
- **Entry at any level needs no offset.** The pointer initialises to the purchased variant at ordinal 1. Direct entry and laddered entry are the same code path.
- **`invoice.paid` becomes genuinely idempotent.** The `months_elapsed` increment is currently a blind read-then-`+1` ([stripe-handlers.ts:196-212](../../../lib/webhooks/stripe-handlers.ts)) with no invoice-level guard; `recordInvoice` is upsert-idempotent but does not gate it. Stripe redelivers `invoice.paid`. Today that costs an off-by-one month counter; once the content pointer rides the same event a redelivery makes a client **skip a month of workouts** undetectably. Advancement is gated on the invoice being newly recorded.
- **Top-of-ladder state, persistent and quiet.** A client repeating Avanzado content sees a small `Repitiendo Mes 3` marker for the duration of the repeat, not a one-time dismissable notice — a client silently redoing workouts she remembers will otherwise assume the app is broken.
- **Rung-aware progress display.** A rolling client sees her rung and position — `Avanzado · Mes 2` — instead of `Mes 14` or the empty denominator that `duration_months = null` produces today in `SubscriptionCard`.
- **One admin signal for running out of content**, folding two failures that look different but mean the same thing: clients approaching the end of the top rung, and clients whose *next* rung has no content authored yet. The second is the more dangerous — a Principiante finishing month 6 with no Intermedio series would wrap back to Principiante 1 and read as a bug.

## Capabilities

### New Capabilities
- `content-ladder-progression`: how a subscription's content position is stored and advanced — the advance rule, entry at an arbitrary rung, rung traversal, the fixed-term guard, per-invoice idempotency, the top-rung repeat, and the rung-aware progress display.
- `admin-content-runway`: the signal warning Aura which clients are about to run out of new content.

### Modified Capabilities
<!-- None. `content-curriculum-model` is created by `l2-per-variant-content-model` and is not yet
     synced, so there is no requirement text to modify; the pointer-based addressing rule lives in
     `content-ladder-progression` instead. `portal-subscription-management` is cancellation-only and
     holds no progress-display requirement, so the rung-aware label is ADDED, not MODIFIED. -->


## Impact

- **Migration 016:** `subscriptions` gains `content_variant_id` (FK), `content_ordinal`, `content_loops`. Backfill from `program_variant_id` + `months_elapsed`.
- **New code:** pure advance rule + rung resolution (TDD — the arithmetic-free rule is exactly the kind of logic that belongs in a tested pure module) · runway query for the admin signal.
- **Modified code:** `lib/webhooks/stripe-handlers.ts` (advance the pointer; gate on new-invoice) · `lib/content/queries.ts` · `lib/content/pillars.ts` · `lib/cron/notice-queries.ts` · `components/portal/settings/SubscriptionCard.tsx` · `lib/admin/clients-helpers.ts` (`subscriptionProgressLabel`) · admin dashboard for the runway signal.
- **Depends on `l2-per-variant-content-model`** for `variant_series_map.ordinal` and `program_variants.ladder_next_variant_id`. Cannot start before it lands, and its `content-curriculum-model` spec must be `/opsx:sync`ed first — this change modifies a capability that one creates.
- **Removed code:** `getAccessibleSeries` in `lib/content/access.ts` and its tests in `__tests__/content-access.test.ts` (no production callers).
- **Blast radius:** this change writes to subscriptions from a webhook on a schedule. A double-advance skips content silently; a missed advance strands a client. Both are mitigated by the invoice-gated increment, and both are recoverable by hand because the pointer is inspectable state rather than derived arithmetic.
- **Deliberately out of scope:** notifying the client when she crosses a rung. It is a genuine milestone and the A4 `automated_messages` infrastructure fits it exactly — tracked as a follow-on, and the natural candidate for backlog **A13**'s "wait until Aura asks for a third rule" signal.
