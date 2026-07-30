# 0003. A subscription has two endings, and finishing one keeps a reduced portal

Status: Accepted · Date: 2026-07-28 · Extended by [0004](0004-ending-subscriptions-money-versus-access.md) (the reader side: which figures count an ending subscription)

## Context

CuarentaMás is a six-month program; CuarentaMás Extra and Strong & Fit run until the client
cancels. Only the first of those was modelled, and even that one never actually ended:
`shouldComplete` wrote a timestamp and nothing else, so a client on a fixed-term program
kept being charged in month 7, month 8, and onward against content that stopped at month 6.
The `completed` status the code referred to was absent from the database's CHECK constraint
and had never been written by any path.

Making a subscription genuinely end forced three questions that outlive this change.

**When does it end?** Stripe bills upfront, so `months_elapsed` reaches 6 as the *sixth*
period begins. There is a month between "she has paid for the whole program" and "her access
is over", and it is a month she has paid for.

**What happens to a client who finished?** Portal access is gated on `ACCESS_STATES`, which
propagates to nine call sites. A finished client falling out of it would lose her account,
her payment history, her progress history and her progress photos — at the exact moment we
want her to continue with Extra.

**Who decides she may buy the next program?** The database held content-derived prerequisites
("Extra follows CuarentaMás"). Aura holds a human rule ("I evaluated her, she is ready for
Avanzado") and links straight to that level's checkout.

## Decision

**1 · Completion is scheduled and then takes effect, a month apart.** The final paid invoice
records `completed_at` and cancels the Stripe subscription *at period end*. The status becomes
`completed` only when that period actually ends, driven by `customer.subscription.deleted`.
`completed_at` is the marker that completion is pending; the status is what withdraws content.
The deletion handler is therefore the arbiter of *which* ending occurred: carrying
`completed_at` means she finished, anything else means she quit, and `completed` is terminal —
neither the deletion nor the update handler may downgrade it.

**2 · Graduated access is a second, separately named definition.** `subscriptionGrantsAccess`
keeps its exact meaning — may this client receive training content — and shell access is decided
by `PORTAL_SHELL_STATES` (applied in the query, where the three shell readers select rows) plus
`derivePortalTier`, which turns a client's statuses into her tier. Content paths keep calling the
strict one. A `completed` client keeps her account, payments, progress history, photos and
messages, plus a CTA to continue with Extra; she gets no training content. The reachable set is
an allow-list, so a training route added later is closed to her by default.

> Amended by **D18** (2026-07-29). This originally named a second *predicate*,
> `subscriptionGrantsPortalShell`. That function was retired as redundant by construction: the
> shell boundary is applied in SQL, so every row reaching memory is already a shell row and the
> predicate answered `true` unconditionally. The separation this decision protects — never
> widening `ACCESS_STATES` to include `completed` — is unchanged and is now pinned by a test.

**3 · Eligibility is enforced by the funnel, not by the application.** The
`program_variant_prerequisites` rows for Extra are deleted and the checkout gate removed.

## Alternatives considered

- **Write `completed` at the start of the final month** (the original design). Rejected during
  implementation: it withdraws content the client has paid for. Its mirror image — waiting for
  the next `invoice.paid` — charges her a seventh month, which was the live defect.
- **Teach the content paths that `completed` still serves content until `current_period_end`.**
  Rejected: it puts time-based logic inside the access boundary and changes all eight strict
  call sites, which is exactly the widening decision 2 exists to prevent.
- **Add `completed` to `ACCESS_STATES`.** Rejected: it would serve training content to clients
  who are no longer paying, through every call site at once.
- **Keep prerequisites and add exceptions.** Rejected: the SQL rule and Aura's judgement do not
  reconcile — the rule refuses precisely the clients she has approved.

## Consequences

- Anyone holding a checkout URL can subscribe at any level. Accepted: the practical gate is
  Aura's funnel. If self-selection becomes a real problem — this is strength training for
  women 40+, so level is a safety property — the replacement is an admin-issued approval
  record, not a return to content-derived prerequisites.
- Two predicates must be kept honest. Any new content path that reaches for the shell predicate
  silently serves training content to non-paying clients, and no test would fail.
- Completion now depends on a webhook arriving. If `customer.subscription.deleted` is never
  delivered, the client keeps content she is no longer billed for — inspectable state
  (`completed_at` set, status not `completed`) that a human can correct, and the safer of the
  two failure directions.
- A client can hold a `completed` row and a paying row at once. Every reader of "her
  subscription" must decide which wins; paying does.
