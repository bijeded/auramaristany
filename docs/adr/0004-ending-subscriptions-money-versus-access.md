# 0004. An ending subscription counts for access and not for money, and one function decides it is ending

Status: Accepted · Date: 2026-07-29

## Context

ADR 0003 gave a subscription two endings — graduating from a fixed term, and leaving
voluntarily — and settled the *writer* side: who sets `completed_at`, when Stripe is told to
cancel, what `completed` withdraws. It left the *reader* side unstated, and D17 found the cost
of that on the admin dashboard.

`getActiveSubscriptions` selected `status = 'active'` and returned three presentation fields.
Five KPIs were computed from that one row-set. Because the rows carried no lifecycle columns,
a subscription in its final paid month and one renewing next week were indistinguishable — so
a client who will never be charged again contributed her full `price_mxn` to "Ingreso mensual
recurrente" and to the renewal projection. Aura was shown money that will not arrive.

The naive correction — filter the ending rows out of the query — is wrong, and that is the
whole point of this record. The *same rows* legitimately belong in "Suscripciones activas" and
"Clientes por variante": a client in her final month still has portal access and is still
training, and dropping her would understate how many people Aura is serving. One row-set,
two opposite correct answers, depending on what the number is *for*.

Compounding it, "is this subscription ending?" lives across three columns (`status`,
`completed_at`, `cancel_at_period_end`). L2c fixed four readers that each derived it
independently and each got a different subset wrong; the fifth reached production. The
dashboard would have been the sixth.

## Decision

**1. Figures about money exclude subscriptions that will not be charged again; figures about
people include them.** MRR and the renewal projection are fed from the `billing` cohort only.
Headcounts and distribution-by-variant are computed over every `active` row, ending or not. The
two are *intended* to disagree, and the divergence is specified rather than incidental.

**2. No reader derives "is this ending?" itself. Every one calls `deriveCancellationState`.**
The dashboard is its fourth caller, not a fourth copy. `partitionByOutcome` maps that
function's `kind` onto three cohorts — `eligible → billing`, `completing`, `grace → cancelling`
— plus an `excluded` bucket for rows that already ended, in a single pass. Every row lands in
exactly one bucket, so the four always sum to the input: nothing can be silently dropped if the
query is ever widened. The invariant that follows (over any horizon, the three cohort cards
partition the live rows falling in it) is therefore structural, not a rule someone has to
remember.

**3. A cohort count is not shipped without a way to see who is in it.** Each ending card links
to a client-list filter for its own cohort. A number Aura cannot act on is not a feature, and
the filters shipped first so the links were never dead. This required `/admin/clients` to grow a
URL contract it did not have — `?status=<label>`, validated against the closed filter list and
seeded into the table's state — so the cohort labels are named constants rather than literals
repeated across the pill, the parser and the link. Note the link carries the cohort but **not**
the horizon: the card counts the coming week, the list shows the whole cohort, so the list is a
deliberate superset and the card says "Ver todas" rather than implying a match.

**4. Completing and cancelling stay separate, everywhere.** They are one flag apart in the data
and opposite in response — a graduation into CuarentaMás Extra is an upsell conversation, a
cancellation is a retention call. Two cards, two filters, deliberately different styling. Never
one combined "ending" number, which would make a good month read as churn.

## Alternatives considered

- **Filter ending rows out of `getActiveSubscriptions`.** Rejected: it silently deflates the
  headcount KPIs, which are correct as they are. The exclusion belongs per-consumer.
- **Extract a `billsAgain` predicate from `nextChargeCell`.** Rejected: it duplicates what
  `deriveCancellationState` already does, and re-opens the ordering trap — `cancel_at_period_end`
  must be tested *after* completion, because a graduating client carries it too. That ordering
  is already correct inside the shared function; a new predicate would have to re-earn it.
- **Teach `computeMRR` about the lifecycle.** Rejected: it stays a summing function and simply
  receives the right rows. Lifecycle knowledge in a money-formatting module is how the two
  concerns get welded together.
- **A calendar-month horizon for the cards.** Rejected after being designed: renewing rows have
  `current_period_end` pushed into next month by `invoice.paid`, and ending rows leave the
  `active` set entirely, so the past half of any month is empty by construction. A calendar
  month could only ever mean "what is still to come", decaying to zero by the 28th.

## Consequences

- **The two figures will visibly disagree, and that is correct.** When a real cancellation
  exists, MRR drops while "Suscripciones activas" does not. Anyone reading the dashboard — or
  reconciling it against Stripe — needs to know this is by design.
- **`Record<>`s keyed on a cohort are safe; the horizon is one argument.** Both the horizon
  (7 days) and the cohort mapping live in one place each, so revisiting either is a one-line
  change rather than a hunt.
- **Any new KPI must declare which side it is on** — money or people — before it is written.
  There is no default, and picking wrong is invisible to every test, since the row-set is
  identical either way.
- **`deriveCancellationState` is now load-bearing for admin finance as well as the portal.**
  Its precedence order is not a detail: changing it would silently re-file every graduation as
  churn, in three surfaces at once. It has tests; they matter more than they look.
- **The narrower `status` filter is a decision, not an omission.** `trialing` and `past_due`
  are deliberately absent from every finance figure, which makes them conservative; `past_due`
  surfaces on its own through "Requieren atención". Widening the query would change MRR, and
  is a spec change, not a fix.
