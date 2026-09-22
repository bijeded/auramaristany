# Design

## Context

- `seed-demo.ts` wipes user data, recreates 32 clients, and inserts `subscriptions` rows with periods computed relative to today (`computeDates`, `dayOffset ≥ 1`).
- The Stripe test-mode webhook endpoint is the live demo. Handlers that will see seed-originated events (`lib/webhooks/stripe-handlers.ts`):
  - `invoice.paid` with `billing_reason = subscription_create` records the invoice only if the row already exists — upsert on `stripe_invoice_id`, `ignoreDuplicates`.
  - `customer.subscription.updated` overwrites `status`, `cancel_at_period_end`, `current_period_start/end` from Stripe.
  - `customer.subscription.deleted` updates by `stripe_subscription_id`; with no matching row it should be a no-op (confirmed in task 1.2).
  - `checkout.session.completed` does not fire — there is no checkout session.
- Price per variant: `program_variants.stripe_price_id` (10 test prices from `seed-stripe.ts`).

## Goals / Non-Goals

**Goals:** three Stripe-backed clients whose rows agree with Stripe from the moment they are written; reseeding is idempotent in Stripe; no app code change.

**Non-Goals:** see proposal.

## Decisions

**D1 — Backdate the real subscription to the seed's period.** Create with `backdate_start_date = periodStart`, `billing_cycle_anchor = periodEnd`, `proration_behavior: 'none'`, and `pm_card_visa` as the customer's default payment method. Stripe then reports the period the seed computes, so a `subscription.updated` after a cancel rewrites the row with identical values. The seed writes the DB period **from the Stripe response**, not from `computeDates`, so any rounding Stripe applies wins.
*Rejected:* starting the subscription today — the period would start today (`dayOffset = 0`, rule 17) and change those clients' grid in the demo.
*Unverified:* the exact behavior of these three params together on `2026-05-27.dahlia`. Task 1.1 checks via context7 and one throwaway test-mode call before the seed is touched. If the backdated period can't be produced, the fallback is a Stripe test clock, recorded with `/opsx:update`.

*Verified (task 1.1, 2026-09-21):* a probe with these params returned `status: active` and `current_period_start/end` equal to the requested values to the second.

**D2 — Seeding creates no Stripe invoice, so all seeded invoices stay synthetic.** The probe showed `latest_invoice: null` and zero invoices on the customer: with `proration_behavior: 'none'` the backdated span is not billed and the first charge is at the anchor (`periodEnd`). So seeding fires no `invoice.paid`, charges nothing, and cannot duplicate an invoice; the seed keeps writing `in_seed_*` invoices exactly as today. When the anchor arrives, Stripe charges the test card and `invoice.paid` (`subscription_cycle`) renews the row the normal way — `months_elapsed` +1 (rule 16). That is the real lifecycle, not a defect. *(Revised from the original D2, which assumed a first invoice at creation.)*

**D3 — Grace through Stripe, not only the DB.** The grace client's subscription is updated to `cancel_at_period_end: true` right after creation; the row is written from that response. Its existing `cancellation_surveys` row stays as today.

**D4 — Cleanup by metadata, after the DB wipe.** Every seed-created customer and subscription carries `metadata.seed = "demo"`. After step 1 (DB wipe), the seed lists customers (`customers.list`, auto-paginated) and deletes those with `metadata.seed === "demo"` (which cancels their subscriptions). `customers.list` is used instead of `customers.search` because search is eventually consistent and a quick rerun would miss the objects the previous run just created. Running after the wipe matters: `handleSubscriptionDeleted` with no matching row updates nothing, logs no survey and sends no email (confirmed in task 1.2 — `getContactBySubscription` returns null). Before the wipe it would flip seeded rows to `canceled` and email each client "tu suscripción terminó".

**D5 — The Stripe-backed set is one exported constant**, keyed by client email, with the flow each exercises (`'cancel' | 'reactivate'`). The Stripe step and the printed table both read it; there is no second list. A pure helper `stripeSeedParams(client, today)` returns the create params (or `null` for synthetic clients) and is unit-tested.

**D6 — Test-key guard** at the top of `main()`, before step 1. `--dry-run` exits before any Stripe client is built.

**D7 — Stripe objects are created right after the wipe, before any user.** The subscription needs only the variant price, not the profile id. A Stripe failure then aborts with no clients created, and a rerun recovers, instead of leaving a half-built demo.

Sources of truth: scenario → status stays `SCENARIO_STATUS`; `subscriptions.status` CHECK lives in the migrations and is unchanged. No new enum.

## Risks / Trade-offs

- **Webhook deliveries to the live demo during a reseed** — bounded (3 created, ≤3 deleted), all handlers idempotent. Checked in the webhook delivery log in task 3.3.
- **The seed now depends on Stripe being reachable** — handled by D7.
- **A real renewal at the anchor** — if the demo isn't reseeded before a Stripe-backed client's `periodEnd`, Stripe charges the test card (no real money) and the row renews normally; a real `in_…` invoice joins the synthetic ones. Money KPIs then count one more paid month, which is correct for that state.
