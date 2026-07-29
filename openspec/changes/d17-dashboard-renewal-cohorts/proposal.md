## Why

The dashboard shows Aura money that will not arrive. `getActiveSubscriptions` selects on `status = 'active'` alone, so a subscription winding down in an A9 grace window — or in its final fixed-term month, both of which are `active` with `cancel_at_period_end = true` — still adds its full `price_mxn` to "Ingreso mensual recurrente" and to the projected amount of "Renuevan este mes". This is the same defect PR #24 fixed on the client list, one screen further along: a lifecycle state spread across three columns, derived inline by a reader that only knows about one of them.

Worse than the inflated figures is the missing one. Nothing in the product tells Aura that a client is about to end: the A4 cron deliberately stays silent on the grace cohort (`notice-rules.ts`), and a client in her final month files under "Activas" in the client list. The dashboard is the only place that fact can surface, and today it surfaces as revenue instead.

## What Changes

- `getActiveSubscriptions` carries `status`, `cancel_at_period_end` and `completed_at` into `FinanceSubRow`. It keeps selecting `status = 'active'` only — deliberately excluding `trialing` and `past_due`, which is now a recorded decision rather than an accident.
- A new pure `partitionByOutcome` splits those rows into three buckets — `billing`, `completing`, `cancelling` — by calling the existing `deriveCancellationState`. The dashboard becomes the fourth *caller* of that derivation, not a fourth copy of it.
- "Ingreso mensual recurrente" is computed from `billing` only. `computeMRR` keeps its `{ price_mxn }[]` signature; it simply receives the right rows.
- The two existing horizon cards ("Renuevan este mes" at 30 days and "Vencen en 7 días") are replaced by **three cards over one 7-day horizon**, one per cohort, each naming that horizon in its own label: **"Renuevan (próx. 7 días)"** (count + MXN amount, billing only), **"Terminan (próx. 7 días)"** (count only) and **"Cancelaciones (próx. 7 días)"** (count only).
- **The renewals figure will read substantially lower.** Its window shrinks from 30 days to 7, and renewals are monthly, so roughly a quarter as many subscriptions fall inside it on any given day. This is intended: MRR answers "the month", the cards answer "this week". It is a change in what the card means, not only in what it is called.
- `computeRenewalsThisMonth` is **removed**. Its only value was the "este mes" framing — which was wrong twice over, describing a rolling 30-day window as a calendar month — and its only production caller is this dashboard, so it does not survive as a test-only export (D18's lesson). `computeRenewalsWithinDays` is unchanged and now called three times with `days = 7`, once per bucket.
- `completed_at` is threaded into `getClientsList` → `ClientListRow` → `filterClients`, and two pills are added: **"Último mes"** and **"En cancelación"**. Without them the new cards are counts Aura cannot act on.
- "Suscripciones activas" and "Clientes por variante" are deliberately **unchanged**: an ending client still has portal access and is still training, so she belongs in both.

Not a breaking change for clients — no schema change, no migration, no API surface. The visible change is confined to Aura's dashboard and client list.

## Capabilities

### New Capabilities

None. This corrects and extends two existing capabilities.

### Modified Capabilities

- `admin-dashboard-kpis`: the "KPI card for subscriptions expiring in 7 days" requirement is replaced. The KPI row's forward-looking cards must exclude subscriptions that will not be charged again, must state their 7-day horizon in their own labels, and must separate fixed-term completion from voluntary cancellation as distinct cohorts.
- `admin-clients-list`: the filter-pill group gains two members for cohorts that are still `active` — "Último mes" and "En cancelación" — which requires `completed_at` on the client row, since `cancel_at_period_end` alone cannot tell a graduation from a churn.

## Impact

**Code**
- `lib/admin/finance-queries.ts` — `getActiveSubscriptions` select + row mapping
- `lib/admin/finance-helpers.ts` — `FinanceSubRow` fields; new `partitionByOutcome`; `computeRenewalsThisMonth` removed
- `app/admin/dashboard/page.tsx` — six KPI cards, MRR fed from `billing`, two new filter links
- `lib/admin/clients-queries.ts` — `completed_at` in the select and `RawSubRow`
- `lib/admin/clients-helpers.ts` — `completed_at` on `ClientListRow`; two new `StatusFilter` values in `filterClients`
- `components/admin/ClientsTable.tsx` — two new pills
- `__tests__/finance-helpers.test.ts`, `__tests__/clients-helpers.test.ts`

**Reused, not modified:** `deriveCancellationState` / `isCompletionScheduled` (`lib/portal/cancellation.ts`). `nextChargeCell` keeps deliberately ignoring `completed_at` — its comment says so, and that stays true even though the column is now available on the row.

**Not touched:** no migration (all columns exist since 001). Stripe, webhooks, portal, and email are untouched. The dashboard's UTC month bucketing in `groupRevenueByMonth` is out of scope.

**Verification:** demo data cannot exercise this — `seed-demo.ts` sets `cancel_at_period_end` only on rows already `canceled`, so no `active` row carries the flag. Coverage is unit tests on the partition plus one hand-flipped row checked against the real database.
