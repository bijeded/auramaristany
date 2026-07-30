## Context

`/admin/dashboard` reads its subscription figures from a single query, `getActiveSubscriptions`, which filters on `status = 'active'` and returns only `{ current_period_end, price_mxn, variant_name }`. Five KPIs are computed from that one row-set:

```
getActiveSubscriptions()                .eq("status","active")   ← no lifecycle columns
        │
        ├─ computeMRR ──────────────► "Ingreso mensual recurrente"   forward-looking  ✗ phantom
        ├─ activeSubs.length ───────► "Suscripciones activas"        who has access   ✓ correct
        ├─ groupClientsByVariant ───► "Clientes por variante"        who has access   ✓ correct
        ├─ computeRenewalsThisMonth ► "Renuevan este mes" (30d)      forward-looking  ✗ phantom
        └─ computeRenewalsWithinDays(7) ► "Vencen en 7 días"         mixes both       ✗
```

Because the rows carry no lifecycle columns, a subscription that is `active` but will never be charged again is indistinguishable from one that renews next week. Two populations are in that state, and both are `active` with `cancel_at_period_end = true`:

- a **voluntary cancellation** in its A9 grace window, and
- a **fixed-term completion** in its final already-paid month (`completed_at` also set).

Both inflate MRR and the renewal projection. This is the same defect PR #24 fixed on the client list — L2c's recorded lesson is that "is this subscription ending?" lives across `status`, `completed_at` and `cancel_at_period_end`, and that every reader deriving it independently got a different subset wrong.

Two constraints shape the fix. First, the *same* rows legitimately belong in the headcount KPIs — an ending client still has portal access and is still training — so the exclusion cannot happen in the query. Second, `lib/admin/clients-helpers.ts` already imports `formatMXN` from `finance-helpers.ts`, so finance cannot import clients-helpers; the derivation cannot simply be lifted out of `nextChargeCell`.

## Goals / Non-Goals

**Goals:**

- MRR and the renewal projection count only money that will actually arrive.
- Surface the ending cohorts, which no other part of the product reports. The A4 cron deliberately stays silent on the grace cohort (`notice-rules.ts:243`) and a completing client files under "Activas" in the client list.
- Distinguish a fixed-term graduation from a voluntary departure, since Aura's response to each is opposite (upsell to the next program vs. retention call).
- Add exactly zero new lifecycle logic. Reuse the derivation that already exists.
- Make the counts actionable — a number with no way to see who it refers to is not a feature.

**Non-Goals:**

- Widening `getActiveSubscriptions` to `trialing` / `past_due`. Considered and declined; now recorded as a deliberate decision in the spec so it is not "fixed" in passing.
- Any calendar-month reframing of the horizon. Considered at length and abandoned — see Decisions.
- The dashboard's timezone. `groupRevenueByMonth` buckets by `getUTCMonth`, so a month boundary is UTC while Aura reads Mexico time. Correcting it would shift the revenue chart's entire history; out of scope.
- Teaching `nextChargeCell` about `completed_at`.
- Any migration. Every column involved exists since migration 001.

## Decisions

### 1. Reuse `deriveCancellationState` instead of extracting a new predicate

The obvious move is to lift the `bills` boolean out of `nextChargeCell` (`clients-helpers.ts:35`) into a shared `billsAgain` predicate. Rejected: `deriveCancellationState` in `lib/portal/cancellation.ts:82` **already** produces exactly the buckets needed, in exactly the right precedence order, and is already tested and called from three places.

```
deriveCancellationState(row).kind
   │
   ├─ "eligible"   → bills again              → billing[]
   ├─ "completing" → final paid month         → completing[]
   ├─ "grace"      → voluntary, winding down  → cancelling[]
   ├─ "completed"  ─┐ unreachable here — the query filters status='active',
   └─ "none"       ─┘ and neither kind can arise from an active row
```

The dashboard becomes the **fourth caller** of the one derivation rather than the fourth copy of it. This also inherits, for free, the ordering trap L2c hit three times: `cancel_at_period_end` must be tested *after* `isCompletionScheduled`, because a completing subscription carries the flag too, and checking the flag first misfiles every graduation as a churn. That ordering lives inside `deriveCancellationState` and does not have to be re-established here.

Cost: `lib/admin/` importing from `lib/portal/`. Precedent exists — `clients-helpers.ts` already imports `contentProgressLabel` from `lib/portal/progress-display`. The alternative (a new `lib/subscription-lifecycle.ts` holding a duplicate of logic that already works) is worse.

Alternatives considered:

| Option | Verdict |
|---|---|
| Extract `billsAgain` from `nextChargeCell` into a new shared module | Rejected — duplicates `deriveCancellationState`'s job and re-opens the ordering trap |
| Put the predicate in `finance-helpers.ts` | Rejected — billing-lifecycle logic in a money-formatting module, and still a duplicate |
| Filter inside `getActiveSubscriptions` | Rejected — would deflate "Suscripciones activas" and "Clientes por variante", which must include ending clients |
| Call `deriveCancellationState` from finance | **Chosen** |

### 2. A three-way partition, in one pass, at the top of the page

`partitionByOutcome(rows)` returns `{ billing, completing, cancelling }`, computed in a single pass, and `page.tsx` consumes the buckets declaratively:

```
activeSubs (status='active', + status/cancel_at_period_end/completed_at)
   │
   ├─ partitionByOutcome()  ── deriveCancellationState per row
   │     ├─ billing[]    ─► computeMRR ─────────────────► "Ingreso mensual recurrente"
   │     │              └─► withinDays(7) ─────────────► "Renuevan (próx. 7 días)"      count + $
   │     ├─ completing[] ─► withinDays(7) ─────────────► "Terminan (próx. 7 días)"      count
   │     └─ cancelling[] ─► withinDays(7) ─────────────► "Cancelaciones (próx. 7 días)" count
   │
   ├─ activeSubs.length ───────────────────────────────► "Suscripciones activas"
   └─ groupClientsByVariant(activeSubs) ───────────────► "Clientes por variante"
```

Two properties this buys over passing a predicate into each helper:

- **`computeMRR` stays dumb.** It keeps its `{ price_mxn }[]` signature and simply receives the right rows. No lifecycle knowledge leaks into a summing function, and its existing tests stand.
- **No inline derivation in the Server Component.** An `activeSubs.filter(...)` in `page.tsx` would be the fourth copy wearing a component's clothes. The partition is named, exported, and unit-tested once.

It also makes the invariant true *by construction* rather than by discipline: one pass assigns each row to exactly one bucket, so for any horizon `renewals.count + terminan.count + cancelaciones.count` equals the number of rows whose `current_period_end` falls in it. That is the structural version of the "one derivation" lesson, and it is directly testable.

`FinanceSubRow` gains `status`, `cancel_at_period_end` and `completed_at`. Note that with the query pinned to `status = 'active'`, the predicate reduces in practice to the flag — but `status` is carried and passed anyway, so that if the query is ever widened (Non-Goal 1 reopened) the derivation stays correct instead of silently going wrong on a hardcoded assumption.

### 3. One rolling 7-day horizon for all three cards, named in each label

The original defect report treated "Renuevan este mes" as a calendar-month figure. A calendar-month window was designed and then abandoned, for a reason worth recording because it is not obvious:

> **The past part of the current month is empty by construction.** When a subscription renews, `invoice.paid` rolls `current_period_end` forward into next month, so it leaves the window the moment it charges. When an ending one expires, `customer.subscription.deleted` flips its status to `canceled` / `completed`, so it leaves the `status = 'active'` set entirely.

So a calendar-month window could never mean "this month's expected recurring revenue" — that figure is unrecoverable from `current_period_end`. It could only mean "what is still to come before the month closes", which decays to zero as the month ends: on the 28th the card would read 0 while twenty clients renew on the 3rd. A rolling window has no such boundary artefact, so all three cards use one, and each names it in its own label rather than leaving the reader to guess — which is what "Renuevan este mes" did wrong.

**The horizon is 7 days, not 30.** This gives the three cards a single clear job: they describe the coming week. "Ingreso mensual recurrente" is already the monthly figure, so a 30-day horizon card sitting beside it answered nearly the same question with a different method, and the two invited reconciliation that was never meant to work. At 7 days the division is clean — MRR is the month, the cards are the week.

The cost is real and should not be glossed: **the renewals count and amount drop to roughly a quarter of their current values**, because renewals are monthly and only ~7/30 of the book falls inside any given week. A subscription renewing in three weeks now appears in no card at all, while still counting toward MRR. The 30-day lookahead is gone. For the ending cohorts this also tightens the reaction window — a week's notice before a grace-window cancellation lapses, or before a graduating client needs the CuarentaMás → Extra conversation — where 30 days would have given more room. Accepted deliberately: a card that says "this week" and means it beats a card whose horizon nobody remembers.

This keeps `computeRenewalsWithinDays` exactly as it is, now called three times with `days = 7`. `computeRenewalsThisMonth` is deleted: it was a wrapper whose only value was the "este mes" framing being abandoned, its sole production caller is this page, and per D18's lesson it does not get to survive as a test-only export.

### 4. Two count-only cards, each linking to its own client-list filter

Six KPI cards. The completion and cancellation cards carry no MXN amount — Aura asked for counts, and it keeps a graduation from being priced like a loss — which leaves the card's subtitle slot free for `Ver clientes →`, the thing that makes the count actionable.

That link requires new filter values, because `filterClients` has no way to name either cohort today: a grace-window client files under "Activas" (`clients-helpers.ts:103`). And distinguishing the two requires `completed_at`, which `ClientListRow`, `RawSubRow` and the `getClientsList` select all currently lack — so the column is threaded through in this change. `nextChargeCell` keeps ignoring it, per its own comment; that is pinned by a scenario in the spec so a future reader does not "helpfully" wire it in.

**Pill labels.** The existing pills include `Canceladas` and `Completadas`, and both mean *already gone*. The new cohorts are still `active`. Reusing those words, or near-homographs of them, would make the filter row read as four synonyms — `Cancelaciones` beside `Canceladas` is one letter apart in a pill row. So the pills read **`Último mes`** and **`En cancelación`**: the first states the literal fact and cannot be confused with `Completadas`; the second is unmistakably a process rather than an outcome. The dashboard cards keep the labels Aura asked for, accepting a mild wording mismatch on the click-through in exchange for pills that cannot be misread.

## Risks / Trade-offs

**Demo and test data cannot exercise this** → `seed-demo.ts` sets `cancel_at_period_end` only on rows that are already `canceled`, so no `active` row carries the flag and every figure on the deployed demo will be byte-identical after the change. Verification is unit tests on the partition plus one hand-flipped `active` row checked against the real database, per the §8 smoke lesson that neither `tsc`, lint, the mocked unit tests, nor the build ever talks to Supabase.

**MRR will drop when a real cancellation exists** → The figure is currently too high, so a fall is the fix landing, not a regression. Worth telling Aura before she sees it, since a number moving down without explanation reads as a bug.

**Losing the 30-day lookahead** → The renewals card no longer shows a subscription renewing in three weeks, and its figure falls to roughly a quarter of today's. Mitigated by MRR, which still counts every billing subscription and remains the monthly number; the cards deliberately answer a narrower question. If Aura misses the longer view, the horizon is a single argument to `computeRenewalsWithinDays` and the cost of revisiting is one line plus three labels.

**Seven days is a tight reaction window on the ending cohorts** → A grace-window cancellation surfaces at most a week before access lapses, and a graduating client a week before the CuarentaMás → Extra conversation needs to happen. There is no automated backstop: the A4 cron deliberately says nothing to either cohort. Accepted on the same terms as above, and cheap to widen for these two cards alone if a week proves too short in practice.

**Six cards in a `maxWidth: 1000` flex row** → At `minWidth: 150` six cards plus gaps need 980px, so they fit at full width and then wrap raggedly (5+1) just below it. A deliberate 3+3 wrap reads better than a ragged row; the spec requires a clean wrap at all widths.

**`lib/admin` → `lib/portal` import direction** → Mildly odd by path name; `cancellation.ts` is in practice the lifecycle module (it holds `isCompletionScheduled`, `deriveCancellationState`, `ELIGIBLE_STATUSES`) and imports nothing but `types.ts`, so there is no cycle. Renaming or relocating it is a larger, separate cleanup.

**Adding a seventh and eighth pill to the client list** → The filter group grows to seven members and gets visually busy. Accepted: the alternative is a dashboard card that leads nowhere.

## Migration Plan

No schema change and no migration — `status`, `cancel_at_period_end` and `completed_at` all exist since migration 001. No data backfill, no Stripe or webhook change, nothing to roll forward.

Deployment is the ordinary flow: feature branch → Preview URL → CI green → review → merge to `main` (Production, the live demo). Rollback is a revert; because no state is written, reverting restores the previous figures exactly.

## Open Questions

- **Pill wording** — `Último mes` / `En cancelación` is a judgement call made here to avoid collision with `Completadas` / `Canceladas`. Aura may prefer wording that matches the dashboard cards verbatim; trivially changeable, one string each.
- **Should `Terminan` be styled as a positive?** The spec forbids styling it identically to `Cancelaciones`, but stops short of prescribing a celebratory treatment. Worth revisiting once Aura has seen a real completion.
- **Deferred, not part of this change:** `CANCELABLE_STATUSES` in `settingsActions.ts` duplicates `ELIGIBLE_STATUSES` in `cancellation.ts` — a genuine duplication, unlike `ACCESS_STATES` and `BILLING_STATUSES`, which answer different questions with a coincidentally identical list. Backlog material.
