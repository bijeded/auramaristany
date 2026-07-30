# 0006. Churn is a second derivation with its own denominator

Status: Accepted · Date: 2026-07-30

## Context

ADR 0003 settled how a subscription ends — graduating from a fixed term versus leaving
voluntarily — and ADR 0004 settled the reader side for *live* subscriptions: `deriveCancellationState`
is the one function that decides whether a subscription is ending, and money figures exclude
what will not be charged again while people figures include it.

The dashboard's churn charts ask a question neither ADR answers: **how did a subscription that
is already over actually end?** That is not the same question as "what can this client do right
now", and the difference is not academic. `deriveCancellationState` classifies a terminal
`canceled` row as `none` — it has no live-subscription affordance to report — so asking it for
a churn numerator returns zero, silently and forever.

The charts also need something the codebase had never written down: who counts as *ever having
been a client*. `subscriptions` accumulates rows that were never clients at all —
`incomplete_expired` is an abandoned Stripe checkout — and rows whose subscription ended in
success rather than departure.

## Decision

**Two derivations, each owning one question, neither serving the other.**

- `deriveCancellationState(row)` — "what can this **live** subscription do now?" Feeds the
  portal's buttons, the client list's cohort filter, and the dashboard's three horizon cards.
- `isChurned(status)` — "did this subscription **end** in churn?" Feeds every churn figure.
  `completed` is never churn, under any combination of `cancel_at_period_end` and `completed_at`.

`isChurned` needs only `status` because `handleSubscriptionDeleted` already resolved the two
endings before the row was written: `completed` for a fulfilled term, `canceled` for a departure.
The flags cannot change the answer, which is exactly why a graduating client — who carries
`cancel_at_period_end = true` — cannot leak into the churn count.

**The churn denominator is everyone who ever became a client**: `active`, `trialing`,
`past_due`, `unpaid`, `paused`, `completed`, `canceled`. Expressed as a `Record<string, true>`
read with a `false` default, so a status added to the `CHECK` in a future migration falls out of
both numerator and denominator and leaves the chart standing.

- **`incomplete` and `incomplete_expired` are excluded.** An abandoned checkout was never a
  client; there is nothing to leave.
- **`completed` counts in the denominator, never the numerator.** A graduate was a real client
  who did not depart.
- **`unpaid` counts in the denominator only.** The client list already files `past_due` and
  `unpaid` together as "Vencidas"/"Impaga" in amber — a client in trouble, not a client gone.

## Alternatives considered

- **Widen `deriveCancellationState` with a `churned` kind.** Rejected: its three callers switch
  on the union to decide what a live client may do, so every one would gain a branch for a state
  none of them can encounter. It would also break the property that makes it trustworthy — that
  it answers exactly one question.
- **Inline `status === "canceled"` at each call site.** Rejected: this is the "five readers each
  derived it differently" failure of ADR 0003 in miniature, and it is untestable by convention,
  since queries carry no tests.
- **Derive the variant chart from `cancellation_surveys`.** Rejected: surveys are optional, so
  the count would be short by however many clients skipped the form, and
  `cancellation_surveys.subscription_id` is `on delete set null` — the variant vanishes when a
  client is deleted, and the undercount grows over time. `subscriptions.program_variant_id` is a
  direct column over the complete population.
- **A denominator of "everything except incomplete".** Rejected: an inverted set auto-enrols
  every future status into the denominator, which is the wrong default for a rate — it can only
  ever understate churn.
- **Aggregate in Postgres via an RPC.** Rejected under rule 10: populating
  `Database["public"]["Functions"]` switches PostgREST embed resolution to the hand-maintained
  `Relationships: []` and fails `tsc` on every join in the repo. The row counts are small.

## Consequences

- **Two cancellation derivations now live side by side, and a future cleanup pass will want to
  merge them.** Both carry comments naming the question each owns. Merging them re-introduces a
  silent zero.
- **A churn rate is a third kind of figure**, neither money nor people in the sense of ADR 0004:
  its numerator counts departures and its denominator is a people figure that deliberately
  includes graduations. ADR 0004's rule stands — a new KPI declares its side before it is
  written — with "a rate, and here is its denominator" now an available answer.
- **The two churn cards' totals differ routinely, and mostly for one reason: a timing lag.** A
  survey row is written the moment a client *decides* to leave; the churn count includes her only
  once she *has* left. Between those two moments she sits on the reasons card and not on the
  variant card. Two states live in that gap, and both are ordinary rather than exceptional:

  - **grace window** — she cancelled, her subscription is still `active` until the period ends,
    she still has portal access, and she is already counted by the "Cancelaciones (próx. 7 días)"
    KPI. If she reactivates, her survey row is deleted and she never becomes churn at all.
  - **`unpaid`** — dunning exhausted, so the webhook wrote her `pago_fallido` survey, but Stripe
    has not deleted the subscription yet. Per the denominator decision above, she is not churn.

  A third, much rarer cause: a survey outlives its subscription
  (`subscription_id` is `on delete set null`), so a deleted client keeps her reason and loses her
  variant. On the demo dataset the split is 5 churned against 7 surveys — 5 departed, 1 in grace,
  1 unpaid — and *none* of that gap comes from deletion.

  This was mis-documented on first writing: the deletion case was named and the lag was not, which
  is exactly backwards from how often each occurs. Anyone reconciling the two cards should reach
  for the lag first. Reconciling them by widening the churn count is rejected — it would make the
  rate mean "people who might leave", double-count anyone who reactivates, and break the ADR 0004
  requirement that a figure declare its population.
- **A small denominator produces a loud percentage.** One departure out of one subscription reads
  `1 (100%)`. Bars are scaled by count, so such a row sorts to the bottom. Whether a
  minimum-sample floor is worth adding is deferred until Aura has read the card with real numbers.
- **Adding a terminal status to the `CHECK` is now a two-file decision**: `EVER_SUBSCRIBED` says
  whether it counts as ever-subscribed, and `isChurned` says whether it counts as a departure.
  Neither `tsc` nor lint will ask.
