# Tasks

## 1. Confirm the Stripe mechanics

- [x] 1.1 Check current Stripe docs via context7 for `subscriptions.create` with `backdate_start_date`, `billing_cycle_anchor`, `proration_behavior`, and for `customers.search`, on the pinned API version. Make one throwaway test-mode subscription with the D1 params, confirm `items.data[0].current_period_start/end` equal the requested period and note the first invoice amount, then delete it. If the period can't be produced, `/opsx:update` design D1 before continuing.
- [x] 1.2 Read `handleSubscriptionDeleted` in full and confirm it is a no-op (no survey insert, no throw) when no row matches; record the finding in design D4.

## 2. Seed changes (pure logic test-first)

- [x] 2.1 Failing tests for `stripeSeedParams(client, today)`: period equals `computeDates` for the client; start strictly before today; grace client sets `cancel_at_period_end`; a client outside the set returns `null`.
- [x] 2.2 Implement the helper and the exported Stripe-backed constant (Gabriela Torres, Patricia Reyes → cancel; Adriana Ortega → reactivate); tests green.
- [x] 2.3 Test-key guard before any write; `--dry-run` builds no Stripe client (D6).
- [x] 2.4 After the DB wipe, delete seed-tagged Stripe customers (D4).
- [x] 2.5 Right after cleanup, create customers (`pm_card_visa`, `metadata.seed = "demo"`) and backdated subscriptions; update the grace client's to `cancel_at_period_end: true` (D1, D3, D7).
- [x] 2.6 Write the real `cus_`/`sub_` ids and the Stripe-reported period, status and `cancel_at_period_end` into `profiles` and `subscriptions`; invoices stay synthetic (D2, revised).
- [x] 2.7 The printed table marks Stripe-backed clients and their flow.
- [x] 2.8 `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` green.

## 3. Runtime verification (before merge — CI reaches neither Stripe nor the DB)

- [x] 3.1 Run `npx tsx --env-file=.env.local scripts/seed-demo.ts --dry-run`; confirm no network call and the table marks the 3 clients.
- [x] 3.2 Run the seed against the demo DB and Stripe test mode; for each of the 3 rows, `GET /v1/subscriptions/<id>` matches the row's period, status and `cancel_at_period_end`. **Result (2026-09-22):** all 3 match on customer id, status, `cancel_at_period_end` and both period bounds; 0 Stripe invoices each.
- [x] 3.3 Run the seed a second time; Stripe holds exactly 3 seed-tagged customers, and any non-seed test customer is untouched. Stripe webhook delivery log for both runs is all 2xx; no Stripe invoice exists for the seeded customers; the rows are unchanged after webhooks settle. **Result:** second run deleted the 3 previous seed customers; Stripe holds 3 seed-tagged of 12 total (9 non-seed untouched); all 24 events of the run `pending_webhooks=0`; rows re-verified after.
- [x] 3.4 Smoke on the Preview URL, seeded data only: log in as Gabriela Torres → cancel with a reason → grace state shown and survey row exists; log in as Adriana Ortega → reactivate → grace state gone. Non-destructive — a reseed restores both. **Result (2026-09-22):** passed, run by the maintainer.
- [x] 3.5 After 3.4, Gabriela's row period is unchanged by the `subscription.updated` webhook; admin dashboard money KPIs are unchanged from a synthetic-only seed. **Result:** webhook half verified directly — Stripe `cancel_at_period_end` true then false on Gabriela's sub; the live webhook mirrored both and the period stayed `2026-09-10 → 2026-10-10`; row restored. KPIs unchanged by construction: 133 invoices, all synthetic, no Stripe invoice exists.

## 4. Docs

- [x] 4.1 Rewrite "What the demo data cannot do" in `openspec/config.yaml` `context:` to name the Stripe-backed clients and the states that remain synthetic.
- [x] 4.2 Update the Smoke checks line in `CLAUDE.md` Verification if it now misstates the demo data; remove D28 from `BACKLOG.md`, including its "Now" line.

## 5. Review and handoff

- [x] 5.1 `/security-review` (sensitive surface: Stripe money, webhooks); address or dismiss each finding in the PR body. **Result:** no findings (cleanup scoped to server-only `seed` metadata; script unreachable from the app; no secret logged; live-key guard before any write).
- [ ] 5.2 Open the PR from `task/demo-seed-test-mode-subscriptions` with the runtime verification results and the silent-defect flag: touches money aggregation input (invoices) and cancellation state (grace client); no enum/union, migration, RLS or CHECK change. Squash-merge on green CI.
