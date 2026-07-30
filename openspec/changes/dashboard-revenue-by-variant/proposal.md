## Why

The admin dashboard pairs "Clientes por variante" (10 variants) with "Ingresos por programa" (3 programs). The two cards sit side by side but answer questions at different grains, so neither can be read against the other: Aura can see that a variant has clients and that a *program* earns money, but never which variant earns it.

Regrinding revenue to the variant grain makes the pair comparable — and the useful signal becomes the mismatch between the two cards. Many clients with little revenue means recent signups; few clients with high revenue means long-tenured ones. Neither is visible today.

## What Changes

- **"Ingresos por programa" is replaced by "Ingresos por variante"** on `/admin/dashboard`. Program-grain revenue disappears from the dashboard entirely; no other screen showed it.
- **The revenue figure becomes all-time, not 12-month.** Today the card is fed by `getPaidInvoices(12)`. The new card sums every paid invoice ever, so a variant's total is its lifetime earnings. The "Ingresos por mes" chart above keeps its 12-month window, unchanged.
- **The card title carries the all-time grand total** — `Ingresos por variante · $128,871 MXN`.
- **The card drops Recharts and adopts the inline-bar form of "Clientes por variante"**, so the two cards are visually one system. `components/admin/ProgramRevenueDonut.tsx` is deleted (it has been misnamed since A10 turned the donut into bars) and both cards render through a single shared `VariantBarList`.
- **Row order is shared, membership is not.** The income card follows the clients card's order for variants they have in common, then appends revenue-only variants (churned ones with no active client) by total descending. Each card lists only its own non-empty rows, so the two lists can differ in length.
- **The two cards stay equal height** side by side, as they are today.
- **Bar colors move to tokens (D23).** The two `#9982f4` literals are retired. Clients bars become `--lavanda-dark`; income bars get a new `--rosa-bar` token. This is not cosmetic: the current `#9982f4` bar sits at 2.77:1 against its `--gris-claro` track, below the 3:1 WCAG 1.4.11 floor for graphical objects, and no existing pink token clears it either (`--rosa` is 1.18:1 — it is a background color).
- **`groupRevenueByProgram` and the `ProgramRevenue` type are deleted**, having zero callers after the swap.

## Capabilities

### New Capabilities
<!-- none — this modifies an existing dashboard capability -->

### Modified Capabilities
- `admin-dashboard-kpis`: the "Revenue by program is a bar chart" requirement is replaced by a revenue-by-variant requirement (all-time window, shared ordering with the clients card, inline-bar form, contrast-passing tokens). The existing requirement on client headcount is extended to state that the clients card and the income card deliberately list different variant sets.

## Impact

**Code**
- `lib/admin/finance-queries.ts` — new `getRevenueByVariantAllTime()`; `getPaidInvoices` untouched.
- `lib/admin/finance-helpers.ts` — new `VariantRevenue` type, `groupRevenueByVariant`, `orderRevenueByClientsOrder`; delete `groupRevenueByProgram` + `ProgramRevenue`.
- `components/admin/VariantBarList.tsx` — new shared presentation component.
- `components/admin/ProgramRevenueDonut.tsx` — deleted.
- `app/admin/dashboard/page.tsx` — swap the card, extract the inline bars into `VariantBarList`.
- `app/globals.css` — new `--rosa-bar` token.
- `__tests__/finance-helpers.test.ts` — replace the `groupRevenueByProgram` block with the two new helpers.

**Docs**
- `openspec/specs/admin-dashboard-kpis/spec.md` names "Ingresos por programa" and `groupRevenueByProgram` explicitly; updated by `/opsx:sync`. No ADR names these symbols, so review rule 20 is satisfied by the spec update alone.

**Untouched**
- DB schema, migrations, Stripe, webhooks, RLS. This is read-only against existing tables.
- `RevenueBarChart` (keeps Recharts, so the dependency stays), the KPI row, `/admin/payments`.

**Risk**
- Low. Read-only, admin-only, no migration. The one thing `tsc`/lint/tests cannot verify is that the new query's nested join returns rows — `invoices → subscriptions → program_variants` already carries the `!program_variant_id` disambiguation (review rule 9) and must be confirmed against the real database before merge (review rule 11).
