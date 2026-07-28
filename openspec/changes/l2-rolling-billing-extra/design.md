## Context

CuarentaMás Extra is modelled as a six-month fixed term but sold as an open-ended monthly subscription. Correcting that is one migration line. Everything else in this change exists because correcting it makes two dormant defects reachable, and because making a subscription genuinely *end* collides with machinery A9 built for a different kind of ending.

Explored 2026-07-27. The billing rule, in Aura's words: a **CuarentaMás** client stops being charged when she finishes month 6; a **CuarentaMás Extra** or **Strong & Fit** client keeps being charged until she cancels.

## Goals / Non-Goals

**Goals**
- Fixed-term programs stop billing at their defined end. Rolling programs never do.
- A client who finishes CuarentaMás can buy Extra, which today she cannot.
- A finished client keeps her own data and is shown the way forward.
- The database and the TypeScript union agree on what a subscription status can be.

**Non-Goals**
- Content behavior past the end of a rung — `l2-level-ladder-progression`.
- Proration, refunds, or mid-term plan switching. Cancellation remains end-of-period, no refund.
- Re-introducing eligibility enforcement in the app.

## Decision 1 — Completion cancels at period end, and the timing is exact

Stripe bills upfront, and `handleCheckoutCompleted` seeds `months_elapsed: 1` while the `subscription_create` invoice deliberately does not increment it. So `months_elapsed` reaches 6 as period 6 *begins*:

```
period 1 begins   checkout          months_elapsed = 1
period 2 begins   invoice.paid      months_elapsed = 2
…
period 6 begins   invoice.paid      months_elapsed = 6  → completion fires
                                    status = 'completed', cancel_at_period_end = true
period 6 ends     subscription ends; no month-7 invoice
```

Completion therefore fires at the **start** of the client's final month. `cancel_at_period_end` lets month 6 play out and suppresses the month-7 invoice.

The two neighbouring options are both wrong in ways that are easy to ship: cancelling **immediately** cuts short a month she has already paid for; waiting for the **next** `invoice.paid` charges her for a seventh month, which is the current live defect. This off-by-one must be pinned by a test.

## Decision 2 — `customer.subscription.deleted` must not clobber `completed`

`handleSubscriptionDeleted` unconditionally writes `status: 'canceled'`. When completion sets `cancel_at_period_end`, Stripe fires `customer.subscription.deleted` at period end — which would overwrite `completed` with `canceled` and erase the distinction the graduated tier depends on. A client who *finished* the programme would be recorded as having *quit*, and would lose the graduated access this change grants her.

**Rule:** `handleSubscriptionDeleted` SHALL NOT downgrade a subscription already in `completed`. Completion is terminal and outranks the generic deletion path.

The involuntary-survey branch is unaffected: a completion-initiated cancellation carries `cancellation_details.reason = 'cancellation_requested'`, which already writes no survey row.

## Decision 3 — Completion must not present A9's grace-window UI

A9 renders "Tu plan termina el {fecha}" plus a **Reactivar** action whenever `cancel_at_period_end` is true. Completion sets exactly that flag, so a client finishing CuarentaMás would be offered a button to reactivate a programme she has finished — resuming billing against content that has ended.

`cancel_at_period_end` is therefore no longer sufficient to identify the grace window. The UI branches on **status** first: a `completed` subscription shows completion messaging and the continue-with-Extra CTA; only an `active`/`trialing`/`past_due` subscription with `cancel_at_period_end` shows the grace window and Reactivar. Since completion writes both fields together, the status is always available to branch on.

## Decision 4 — Graduated access is a second named check, not a wider `ACCESS_STATES`

`ACCESS_STATES` is documented as the single source of truth for portal access and propagates to `middleware.ts`, `getTodayContent`, and `getPerformanceData`. Adding `completed` to it would silently serve training content to clients who are no longer paying, through three call sites at once.

**Chosen:** `subscriptionGrantsAccess` keeps its exact current meaning — may this client receive training content — and a second, separately named predicate answers may this client reach the portal shell at all. Content paths keep calling the strict one; middleware admits the graduated tier to the shell and to her own data only.

```
completed client CAN reach    account · payment history · progress history · progress photos
                              continue-with-Extra CTA
completed client CANNOT reach /portal/today · /portal/semana · pillars · any series content
```

The tier encodes the distinction: she keeps what she earned, and loses what she was paying for. It also turns the CuarentaMás → Extra handoff into a funnel inside the app rather than a round trip through WordPress.

Her own data remains reachable because it is owner-scoped by RLS, which is unaffected by subscription status.

## Decision 5 — Eligibility enforcement moves to the funnel

The seeded prerequisites encode a *content* rule ("Extra follows CuarentaMás"). Aura applies a *human judgement* rule ("I evaluated her and she is ready for Avanzado"), then redirects from WordPress straight to that level's checkout. These do not reconcile in SQL: the DB rule refuses exactly the clients she has approved.

**Chosen:** remove the gate. Eligibility is decided by Aura's evaluation, and the practical protection is that nobody reaches the checkout URL without going through her funnel.

**Accepted trade-off:** anyone with a checkout URL can subscribe at any level. If self-selection into an inappropriate level later proves to be a real problem — it is a strength programme for women 40+, so level is a safety property — the replacement is an admin-issued approval record, not a return to content-derived prerequisites.

Note that the prerequisite requiring "Extra Intermedio completed" before Extra Avanzado is dead regardless: with automatic rung progression, nobody buys Avanzado after Intermedio — they arrive there.

## Decision 6 — The union and the CHECK constraint migrate together

`SubscriptionStatus` lists `completed` and `trialing`; the `subscriptions.status` CHECK permits neither. Writing `completed` against the current constraint fails outright, which is why the completion path could never have worked even had it tried.

Both values are added to the constraint in the same migration that starts writing one of them, per the project's standing rule that an app-level enum and its mirroring CHECK ship together.

## Risks / Trade-offs

- **Stripe cancellation is outward-facing and irreversible per subscription.** Verify against a real test-mode subscription before enabling; a bug here stops a paying client's billing early.
- **In-flight Extra subscriptions** are mid-term when the model flips. With demo data only, resetting them is fine — but the assumption must be re-verified at implementation time, not inherited from this document.
- **This change widens an access boundary and touches middleware**, so it routes through `security-review` rather than `code-review` alone.
- **The graduated tier is separable.** It is the only part of this change that does not touch billing; if the change proves unwieldy, that is the clean seam to split out.
- **A9's spec is modified, not extended.** The settings page requirement changes shape, so the delta must carry the full updated requirement rather than a fragment.
