# Proposal

## Why

On a renewal, `invoice.paid` records the invoice and then advances the subscription (`months_elapsed` + content pointer) in two separately committed statements. The idempotency gate is "was this invoice newly recorded", so any failure after the first commit loses that month's advance **permanently**: every Stripe retry finds the invoice already recorded and stops at the gate. (D16, from the L2b PR2 security review.)

Exploring the handler shows the loss is reachable by more than a crash:

- **An advance write error** — the handler throws so Stripe retries, but the retry stops at the gate. The comment on that throw says it prevents the loss; it does not.
- **A lost optimistic-guard race** — two distinct invoices for the same subscription processed concurrently. The loser throws "so Stripe retries with the fresh value", and the retry stops at the gate. The existing test is named *"relanza … (no pierde el avance)"* but only asserts the throw, never the retry.

So every failure path between the two statements silently drops one paid month of training. The current ordering was chosen deliberately (a lost advance beats a double advance); making the two writes one transaction removes the trade-off instead of re-choosing a side.

## What Changes

- A new Postgres function records the renewal invoice and advances the subscription **in one transaction**. If the invoice is already recorded it changes nothing and reports a duplicate; if the advance cannot be applied (write error, or the row moved since it was read) it raises, which also rolls back the invoice insert — so the Stripe retry reprocesses the invoice from a fresh read.
- `handleInvoicePaid`'s renewal path calls that function once instead of `recordInvoice` + a separate `subscriptions` update. The advance is still **computed** in TypeScript exactly as today (`computeMonthsUpdate`, `nextContentPosition` / `advanceLadderPosition`); the function decides nothing and only applies it under the same optimistic guard (`months_elapsed`, `content_ordinal`).
- The fixed-term `stripe.subscriptions.update({ cancel_at_period_end: true })` call stays **before** the gate, unchanged (rule 16).
- The first-invoice paths (`handleCheckoutCompleted` and the `subscription_create` safety net) keep using `recordInvoice`: they advance nothing, so there is no second statement to lose.
- The misnamed concurrent-write test is replaced by tests that pin the new contract.

**Non-goals**
- No change to *what* an advance is: branch order, ladder rules, fixed-term freeze and completion semantics are untouched.
- No change to `handleCheckoutCompleted`'s own two statements (subscription insert, then first-invoice record). Losing that record is recoverable by the `subscription_create` safety net and involves no advance; it is not D16.
- No repair or backfill of past lost advances. None is known to have happened in the demo.
- No change to the `invoices` table, its RLS policies (D36 is separate), or `lib/supabase/types.ts` `Functions` (stays empty, rule 10).
- No change to other webhook handlers.

**Sensitive surface: yes** — webhooks, money (the paid-month counter that drives completion and the end of billing), service-role, and a migration. `/security-review` is required before the PR. **Fan-out: none** (one row per event).

**Review rules touched:** 1 (service-role client stays server-only), 3 (service-role use outside `requireAdmin` — the webhook's existing signature-gated exception), 10 (RPC via a `// keep:` cast on the client; `Functions` untouched), 11 (function applied and verified on the real DB before merge), 13 (`completed_at` and `cancel_at_period_end` still written together; no new derivation), 16 (outward Stripe call stays before the idempotency gate; `months_elapsed` still incremented only by `invoice.paid`).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `content-ladder-progression`: adds a requirement that recording a renewal invoice and advancing the subscription succeed or fail together, so a failed or lost advance is retried instead of dropped.

## Impact

- `supabase/migrations/023_atomic_invoice_paid.sql` — new function; `execute` granted to `service_role` only.
- `lib/webhooks/stripe-handlers.ts` — renewal branch of `handleInvoicePaid`; comments around the gate rewritten.
- `__tests__/webhooks.test.ts` — renewal-path tests move from the `invoices.upsert` + `subscriptions.update` mocks to an `rpc` mock.
- `BACKLOG.md` — D16 removed at archive.
- No UI, env vars, or Stripe configuration.
