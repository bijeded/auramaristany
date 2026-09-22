# Proposal

## Why

`scripts/seed-demo.ts` writes synthetic Stripe ids (`sub_seed_NNN`, `cus_seed_NNN`) that do not exist in Stripe (BACKLOG **D28**). Every flow that calls Stripe first — `cancelSubscription`, `reactivateSubscription` — returns the generic error on demo data, so their smoke cards cannot be run. It has already cost two unrunnable cards (churn badge, prefer-not-to-say) and one accepted-risk skip. The only workaround is a fresh client through checkout each time.

## What Changes

- `seed-demo.ts` creates **real Stripe test-mode customers and subscriptions** for a small, named set of clients and writes those real ids into `profiles` / `subscriptions`. Every other client keeps its synthetic ids.
  - **Cancellable** (status `active`, no cancellation pending): 2 clients — Gabriela Torres (CM Principiante Poco) and Patricia Reyes (Strong & Fit Principiante).
  - **Reactivatable** (grace — `active` + `cancel_at_period_end`): Adriana Ortega, already the seed's grace client.
- The real subscription's billing period matches the period the seed already computes for that client, so the portal grid and admin dates stay as they are today.
- On every run the seed removes the Stripe test objects a previous run created (identified by metadata), so reseeding does not pile up orphans.
- The seed refuses to create Stripe objects unless `STRIPE_SECRET_KEY` is a test key (`sk_test_`). `--dry-run` never calls Stripe.
- The printed client table marks which clients are backed by a real Stripe subscription, and which flow each can exercise.
- Docs: `openspec/config.yaml` `context:` ("What the demo data cannot do") and `CLAUDE.md` Verification are updated to name the Stripe-backed clients; BACKLOG D28 is removed.

## Non-goals

- Not converting all 32 clients. States Stripe cannot produce on demand (`past_due`, `unpaid`, `paused`, `incomplete*`, `completed`, `completing`) stay synthetic — producing them in Stripe needs test clocks and failing cards, which is a separate change.
- No app code change: server actions, webhook handlers, middleware and KPIs are untouched.
- No standalone "make me a cancellable client" script — the seed stays the one entry point.
- No Stripe-backed `trialing` subscription (D8 stays open).
- No schema change, no migration.

## Sensitive surface and fan-out

- **Money / Stripe: yes** — the seed creates real test-mode customers and subscriptions (no invoice at creation — D2).
- **Webhooks: touched indirectly** — handlers unchanged, but the live demo's `/api/webhooks/stripe` will receive seed-originated events.
- **Service-role: yes** — the seed already uses it; unchanged.
- Auth, RLS, migrations: no.
- **Fan-out: yes** — each reseed deletes and creates Stripe objects and triggers webhook deliveries. Verified at runtime before merge.
- → `/security-review` before the PR.
- Money figures: no new KPI. Seeding creates no Stripe invoice, so the money KPIs see the same synthetic invoices as today.

## CLAUDE.md review rules touched

- **1** — the Stripe secret stays in the script's env.
- **8** — the scenario → status map is unchanged; the Stripe-backed set is a subset of existing scenarios, not a new union.
- **13** — the grace client is produced through Stripe `cancel_at_period_end`, and its row must agree so `deriveCancellationState` reads what Stripe will later send.
- **14** — no money-side change: seeded invoices stay synthetic; a later real renewal is a correctly-counted paid month.
- **16** — seeding fires no `invoice.paid` (no invoice at creation); the first real one is the renewal at the anchor, which increments `months_elapsed` as designed.
- **17** — the real period must start before today (`dayOffset ≥ 1`).

## Capabilities

### New Capabilities
- `demo-seed`: which seeded clients can exercise Stripe-touching flows, and how the seed treats Stripe on each run.

### Modified Capabilities
- None.

## Impact

- `scripts/seed-demo.ts` (main change), plus a small pure helper with tests.
- `openspec/config.yaml`, `CLAUDE.md`, `BACKLOG.md` (docs).
- Stripe test account: seed-tagged customers/subscriptions created per run; the previous run's deleted.
- Demo DB: reseed after merge (destructive by design — the seed already wipes user data).
