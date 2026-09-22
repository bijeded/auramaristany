# Design

## Context

See proposal.md → Why. Current renewal path in `lib/webhooks/stripe-handlers.ts` `handleInvoicePaid`:

1. Read the subscription (+ program billing model) with the service-role client.
2. `computeMonthsUpdate` → `newMonthsElapsed`, `shouldComplete`.
3. If `shouldComplete && !completed_at`: `stripe.subscriptions.update(cancel_at_period_end: true)` — outward call, before the gate (rule 16).
4. **Gate:** `recordInvoice` upserts into `invoices` with `ignoreDuplicates`; zero rows back = redelivery → return. *Commit #1.*
5. `nextContentPosition` reads the ladder and curriculum and calls the pure `advanceLadderPosition`.
6. `subscriptions.update(...)` guarded by `.eq(months_elapsed).eq(content_ordinal)`; zero rows or error → throw. *Commit #2.*

Every throw in step 6 happens after commit #1, so the retry stops at step 4. Supabase JS has no client-side transaction; the repo's precedent for multi-statement atomicity is a Postgres function per write (migrations 021, 022).

## Goals / Non-Goals

**Goals:**
- Steps 4 and 6 commit together, so the gate means "invoice recorded **and** advanced".
- Keep the advance computation where it is, in tested TypeScript.

**Non-Goals:**
- Moving the reads (steps 1, 5) into the transaction. They stay outside; the optimistic guard is what makes a stale read safe, and it now rolls back the invoice with it.
- Changing the first-invoice paths (proposal → Non-goals).

## Decisions

### D1 — The function applies a computed advance; it does not compute one

`record_invoice_and_advance` receives the new values (`months_elapsed`, completion flag, content position) plus the values the handler read (`expected_months_elapsed`, `expected_content_ordinal`). It inserts the invoice, applies the update under the guard, and raises if the guard misses.

*Alternative:* port `advanceLadderPosition` (branch order, ladder hop, wrap, fixed-term freeze) to PL/pgSQL so read-compute-write is one transaction. Rejected: it creates a second derivation of the advance rule, untested by Vitest, that must stay identical to the TypeScript one used elsewhere — exactly what the "one derivation" discipline (rule 13's principle, `openspec/config.yaml` specs rule on duplicates) forbids. The optimistic guard already makes the out-of-transaction read safe.

Same shape as 021/022: the function decides nothing, the caller passes validated values.

### D2 — Signature and contract

```
record_invoice_and_advance(
  p_subscription_id uuid,
  p_stripe_invoice_id text, p_amount_paid numeric, p_currency text,
  p_status text, p_invoice_date date,
  p_expected_months_elapsed int, p_expected_content_ordinal int,
  p_months_elapsed int, p_complete boolean,
  p_content_variant_id uuid, p_content_ordinal int, p_content_loops int
) returns boolean
```

- Scalar arguments, not jsonb: a fixed, small shape; no `jsonb_to_recordset` needed.
- `insert into invoices … on conflict (stripe_invoice_id) do nothing`; no row inserted → **return false** (redelivery), subscription untouched.
- Guard: `p_months_elapsed = p_expected_months_elapsed + 1`, else raise. The function can only ever advance by one month, whatever the caller passes.
- Position: all three `p_content_*` null → content columns untouched (today's `position === null` branch); a partial triple → raise.
- `p_complete` → `completed_at = now()`, `cancel_at_period_end = true`, written together as today (rule 13). `status` is not touched (subscription-billing-lifecycle).
- `update subscriptions … where id = p_subscription_id and months_elapsed = p_expected_months_elapsed and content_ordinal = p_expected_content_ordinal`; `row_count <> 1` → raise with `errcode = 'serialization_failure'` and a message naming the guard. The raise rolls back the insert.
- Returns true after a successful advance.

**Concurrency, by case:**
- *Same invoice twice at once:* the second insert blocks on the first's uncommitted unique key; if the first commits it does nothing → false; if the first rolls back it proceeds. No double advance, no loss.
- *Two different invoices at once:* both insert; the second update blocks on the row lock, then re-evaluates its `where` against the committed row, matches nothing → raise → its invoice rolls back → Stripe retry reads fresh state.

### D3 — `SECURITY INVOKER`, executable by `service_role` only

The only caller is the webhook, which already uses the service-role client (BYPASSRLS). `SECURITY DEFINER` would add nothing. `revoke execute … from public, anon, authenticated` explicitly — Supabase's default privileges grant `execute` on new `public` functions to `anon` and `authenticated`, so revoking `public` alone is not enough — then `grant execute … to service_role`. Unlike 021/022 (callable by admins through RLS), there is no human caller: an admin forging a recorded invoice through an RPC is surface with no use.

### D4 — One source for the invoice row's fields

`recordInvoice` (first-invoice paths) and the RPC arguments (renewal path) would otherwise both map a `Stripe.Invoice` to `amount_paid`/`currency`/`status`/`invoice_date`. Extract a pure exported `invoiceRecord(invoice)` in `stripe-handlers.ts`, test-first, used by both. A divergence here would record the same Stripe invoice differently depending on which event recorded it.

### D5 — Calling the RPC

`// keep:` cast on the service client, never on the detached method (rule 10), same pattern as `lib/admin/dayActions.ts`. `Functions` in `types.ts` stays `Record<string, never>`. `error` → `console.error` + throw (route returns 500 → Stripe retries). `data === false` → return (redelivery). The comments on the gate, on the old update, and in `recordInvoice`'s docblock that describe the two-statement flow are rewritten; the one explaining why the Stripe call precedes the gate stays.

## Risks / Trade-offs

- [A persistent guard miss (e.g. a bug in the expected values) now fails the event on every retry instead of recording the invoice once] → Intended: it surfaces as a failing webhook in the Stripe dashboard instead of a silently missing month. Stripe retries for ~3 days, which is the window to notice.
- [Stripe-side `cancel_at_period_end` is scheduled but the local advance rolls back] → Same as today: on retry `completed_at` is still null, the Stripe call repeats (idempotent no-op), and the advance records `completed_at` + `cancel_at_period_end` together.
- [Mocked Vitest tests cannot prove atomicity; nothing in CI talks to the DB] → Runtime verification against the real DB inside `begin … rollback` (tasks 1.3), covering insert-then-guard-miss, duplicate, and success.
- [Code deployed before the function exists → every renewal 500s] → Rule 11: apply and verify 023 before merge. The function is additive, so the currently deployed code is unaffected by applying it early.

## Migration Plan

1. Apply `023_atomic_invoice_paid.sql` to `bgvxaagfnzvzamtxqbkg` via the Management API (SQL on one line; block comments only), then `notify pgrst, 'reload schema'`.
2. Verify grants and behavior (tasks 1.2–1.3).
3. Merge the code PR.

**Rollback:** revert the code PR. The function can remain unused; if removal is wanted, a new migration drops it (never edit 023).
