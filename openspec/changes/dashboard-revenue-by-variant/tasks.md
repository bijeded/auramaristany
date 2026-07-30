## 1. Tokens

- [ ] 1.1 Add `--rosa-bar: #b8746a;` to `app/globals.css` next to the other `--rosa-*` tokens, with a comment recording why it exists: the brand `--rosa` is a background color at 1.22:1 against the `--gris-claro` track and cannot be a bar fill (WCAG 1.4.11 needs 3:1); `--rosa-bar` measures 3.35:1 against that track.
- [ ] 1.2 Confirm `--lavanda-dark` already exists and is `#7a63d4` — no new token needed for the clients bars.

## 2. Pure helpers (TDD)

- [ ] 2.1 Write failing tests for `groupRevenueByVariant`: sums `amount_paid` per `variant_name`; returns `[]` for no input; collapses several invoices of one variant into one row; sorts by total descending.
- [ ] 2.2 Add `VariantRevenue { variant: string; total: number }` and implement `groupRevenueByVariant` in `lib/admin/finance-helpers.ts`, mirroring `groupClientsByVariant`. Tests green.
- [ ] 2.3 Write failing tests for `orderRevenueByClientsOrder(revenue, clientsOrder)`: shared variants follow the clients order regardless of their totals; a clients-order variant with no revenue is omitted; revenue-only variants are appended after the shared ones sorted by total descending; empty revenue and empty clients order each return sensibly.
- [ ] 2.4 Implement `orderRevenueByClientsOrder` in `lib/admin/finance-helpers.ts`. Tests green.
- [ ] 2.5 Delete `groupRevenueByProgram`, the `ProgramRevenue` interface, and their block in `__tests__/finance-helpers.test.ts`. Confirm no remaining references (`rg 'groupRevenueByProgram|ProgramRevenue\b' lib app components __tests__`).

## 3. Query

- [ ] 3.1 Add `getRevenueByVariantAllTime(): Promise<FinanceVariantInvoiceRow[]>` to `lib/admin/finance-queries.ts` — `.from("invoices").select("amount_paid, subscriptions(program_variants!program_variant_id(name))").eq("status", "paid")`, no date cutoff. Map to `{ amount_paid, variant_name }` with the same `// keep:` nested-join cast pattern as the neighbouring queries, falling back to `"—"` on a null name.
- [ ] 3.2 Leave `getPaidInvoices` and its 12-month cutoff untouched; verify "Ingresos por mes" still reads from it.

## 4. Presentation

- [ ] 4.1 Create `components/admin/VariantBarList.tsx` — props `{ rows: { label: string; value: number; display: string }[]; fill: string; emptyMessage: string }`. Bar width is `value / max(values)` per card. Row layout: label left, `display` right, `align-items: baseline`, `gap`, `white-space: nowrap` on the value, full-width track below. Render `emptyMessage` when `rows` is empty. Server Component — no `"use client"`, it has no interactivity.
- [ ] 4.2 Replace the inline bar JSX in the "Clientes por variante" card (`app/admin/dashboard/page.tsx`) with `<VariantBarList fill="var(--lavanda-dark)" …>`, `display={String(count)}`, empty message "Sin suscripciones activas". Confirm the rendered output matches the current card apart from the bar color.
- [ ] 4.3 Delete `components/admin/ProgramRevenueDonut.tsx`.
- [ ] 4.4 Replace the "Ingresos por programa" card with "Ingresos por variante": heading plus the grand total via `formatMXN`, a subtitle stating the all-time window, and `<VariantBarList fill="var(--rosa-bar)" …>` with `display={formatMXN(total)}` and its own empty message. Wire the data through `getRevenueByVariantAllTime` → `groupRevenueByVariant` → `orderRevenueByClientsOrder(…, clientsByVariant)`; add the query to the existing `Promise.all`.
- [ ] 4.5 Keep the flex row's `alignItems: "stretch"` so the two cards stay equal height with uneven lists; do not switch to `flex-start` or distribute rows.
- [ ] 4.6 Confirm no `#9982f4` literal remains anywhere in `app/` or `components/`.

## 5. Verification

- [ ] 5.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run` (baseline 659 tests plus the new helper tests), `npm run build` — all green.
- [ ] 5.2 **Runtime check against the real database** (review rule 11): run `getRevenueByVariantAllTime`'s select against the live Supabase project and confirm it returns rows with non-null variant names — a wrong FK embed returns an error, not rows, and a `!data` check would hide it (review rule 9). Record the row count in the PR.
- [ ] 5.3 On the Preview URL, check both cards side by side: equal height, no horizontal overflow at half width, long variant names wrap to two lines without displacing their value, bar colors visibly distinct.
- [ ] 5.4 Verify the grand total in the title equals the sum of the visible rows.
- [ ] 5.5 Write the smoke card, covering: a variant with active clients but no paid invoice (appears left only); if reachable in the demo data, a variant with revenue but no active client (appears right only, appended at the end); and both empty states. Note that the demo's even 2-per-variant spread will not exercise the uneven-list paths on its own. Every step must be non-destructive and possible with data that exists.

## 6. Close out

- [ ] 6.1 In the PR body, state explicitly that the revenue numbers change meaning — old card was 12 months at program grain, new card is all time at variant grain — so the larger totals are expected, not a data bug. Note the `--rosa-bar` terracotta divergence from the brand pink and why.
- [ ] 6.2 `code-review` verdict (required). No `security-review`: read-only, admin-only behind the existing `requireAdminPage()`, no new input and no new write.
- [ ] 6.3 After merge, `/opsx:sync` (rewrites the "Revenue by program" requirement in `openspec/specs/admin-dashboard-kpis/spec.md`), `openspec validate`, then `/opsx:archive` and delete the row in `BACKLOG.md` if one exists.
- [ ] 6.4 Re-index codebase memory in `fast` mode so the graph does not keep the deleted symbols.
