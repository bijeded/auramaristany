## 1. Tokens

- [x] 1.1 Add `--rosa-bar: #b8746a;` to `app/globals.css` next to the other `--rosa-*` tokens, with a comment recording why it exists: the brand `--rosa` is a background color at 1.22:1 against the `--gris-claro` track and cannot be a bar fill (WCAG 1.4.11 needs 3:1); `--rosa-bar` measures 3.35:1 against that track.
- [x] 1.2 Confirm `--lavanda-dark` already exists and is `#7a63d4` — no new token needed for the clients bars.

## 2. Pure helpers (TDD)

- [x] 2.1 Write failing tests for `groupRevenueByVariant`: sums `amount_paid` per `variant_name`; returns `[]` for no input; collapses several invoices of one variant into one row; sorts by total descending.
- [x] 2.2 Add `VariantRevenue { variant: string; total: number }` and implement `groupRevenueByVariant` in `lib/admin/finance-helpers.ts`, mirroring `groupClientsByVariant`. Tests green.
- [x] 2.3 Write failing tests for `orderRevenueByClientsOrder(revenue, clientsOrder)`: shared variants follow the clients order regardless of their totals; a clients-order variant with no revenue is omitted; revenue-only variants are appended after the shared ones sorted by total descending; empty revenue and empty clients order each return sensibly.
- [x] 2.4 Implement `orderRevenueByClientsOrder` in `lib/admin/finance-helpers.ts`. Tests green.
> Deleting `groupRevenueByProgram` is deliberately **not** in this group: `app/admin/dashboard/page.tsx` still imports it until task 4.4, so a commit removing it here would not typecheck. It runs as task 4.7 instead.

## 3. Query

- [x] 3.1 Add `getRevenueByVariantAllTime(): Promise<FinanceVariantInvoiceRow[]>` to `lib/admin/finance-queries.ts` — `.from("invoices").select("amount_paid, subscriptions(program_variants!program_variant_id(name))").eq("status", "paid")`, no date cutoff. Map to `{ amount_paid, variant_name }` with the same `// keep:` nested-join cast pattern as the neighbouring queries. Label a null name `"Sin variante"` — **not** `"—"`, which was the original plan and was reversed in review: unlike `getActiveSubscriptions`, which filters such rows out, here the orphan bucket gets its own bar, and a dash in that position reads as a variant's name. Read `error` as well as `data` and route it to `logAndGeneric`: rule 9's failure mode is a PostgREST error, not an empty result.
- [x] 3.2 Leave `getPaidInvoices` and its 12-month cutoff untouched; verify "Ingresos por mes" still reads from it.

## 4. Presentation

- [x] 4.1 Create `components/admin/VariantBarList.tsx` — props `{ rows: { label: string; value: number; display: string }[]; fill: string; emptyMessage: string }`. Bar width is `value / max(values)` per card. Row layout: label left, `display` right, `align-items: baseline`, `gap`, `white-space: nowrap` on the value, full-width track below. Render `emptyMessage` when `rows` is empty. Server Component — no `"use client"`, it has no interactivity.
- [x] 4.2 Replace the inline bar JSX in the "Clientes por variante" card (`app/admin/dashboard/page.tsx`) with `<VariantBarList fill="var(--lavanda-dark)" …>`, `display={String(count)}`, empty message "Sin suscripciones activas". Confirm the rendered output matches the current card apart from the bar color.
- [x] 4.3 Delete `components/admin/ProgramRevenueDonut.tsx`.
- [x] 4.4 Replace the "Ingresos por programa" card with "Ingresos por variante": heading plus the grand total via `formatMXN`, a subtitle stating the all-time window, and `<VariantBarList fill="var(--rosa-bar)" …>` with `display={formatMXN(total)}` and its own empty message. Wire the data through `getRevenueByVariantAllTime` → `groupRevenueByVariant` → `orderRevenueByClientsOrder(…, clientsByVariant)`; add the query to the existing `Promise.all`.
- [x] 4.5 Keep the flex row's `alignItems: "stretch"` so the two cards stay equal height with uneven lists; do not switch to `flex-start` or distribute rows.
- [x] 4.6 Confirm no `#9982f4` literal remains **in the two variant cards** (`app/admin/dashboard/page.tsx`, the deleted `ProgramRevenueDonut.tsx`). Scoped deliberately: `#9982f4` also appears in `components/admin/RevenueBarChart.tsx`, `components/portal/PerformanceChart.tsx` and `components/admin/blocks/TextBlockEditor.tsx`, none of which this change touches — see the D23 follow-up note at the end of this file. `app/globals.css` keeps the literal as the `--lavanda` token *definition*, which is correct.
- [x] 4.7 Now that no caller remains, delete `groupRevenueByProgram`, the `ProgramRevenue` interface, and their block in `__tests__/finance-helpers.test.ts`. Confirm no remaining references (`rg 'groupRevenueByProgram|ProgramRevenue\b' lib app components __tests__`).

## 5. Verification

- [x] 5.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run` (baseline 659 tests plus the new helper tests), `npm run build` — all green.
- [x] 5.2 **Runtime check against the real database** (review rule 11): run `getRevenueByVariantAllTime`'s select against the live Supabase project and confirm it returns rows with non-null variant names — a wrong FK embed returns an error, not rows, and a `!data` check would hide it (review rule 9). Record the row count in the PR.
- [x] 5.3 On the Preview URL, check both cards side by side: equal height, no horizontal overflow at half width, long variant names wrap to two lines without displacing their value, bar colors visibly distinct.
- [x] 5.4 Verify the grand total in the title equals the sum of the visible rows.
- [x] 5.5 Write the smoke card, covering: a variant with active clients but no paid invoice (appears left only); if reachable in the demo data, a variant with revenue but no active client (appears right only, appended at the end); and both empty states. Note that the demo's even 2-per-variant spread will not exercise the uneven-list paths on its own. Every step must be non-destructive and possible with data that exists.

## 6. Close out

- [x] 6.1 In the PR body, state explicitly that the revenue numbers change meaning — old card was 12 months at program grain, new card is all time at variant grain — so the larger totals are expected, not a data bug. Note the `--rosa-bar` terracotta divergence from the brand pink and why.
- [x] 6.2 `code-review` verdict (required). No `security-review`: read-only, admin-only behind the existing `requireAdminPage()`, no new input and no new write.
- [x] 6.3 After merge: `/opsx:sync` **then** `/opsx:archive`, then `openspec validate`, then delete the row in `BACKLOG.md` if one exists. The original task text was right and a mid-execution "correction" to `/opsx:archive` alone was wrong — reverted here. **In this repo `/opsx:archive` is a pure `mv`** (see `.claude/commands/opsx/archive.md` step 5): it moves the change directory and applies nothing. Skipping sync would leave `openspec/specs/admin-dashboard-kpis/spec.md` permanently describing "Ingresos por programa" and `groupRevenueByProgram`, neither of which still exists. The `task-execution` guidance that archive applies deltas — and that sync+archive therefore aborts — describes a **different** archive implementation and does not hold for this `core` profile. Verify which one you have before trusting either.
- [x] 6.4 Re-index codebase memory in `fast` mode so the graph does not keep the deleted symbols.

---

## Deferred (out of scope for this change)

**D23 follow-up — three remaining `#9982f4` literals.** Found while doing task 4.6, not fixed here: `components/admin/RevenueBarChart.tsx:25` (bar fill), `components/portal/PerformanceChart.tsx:63` (line stroke + dot stroke), `components/admin/blocks/TextBlockEditor.tsx:17` (a color-picker swatch, where a literal is arguably correct since the value is stored as content). The first two are the same contrast defect this change fixes on the dashboard cards — `#9982f4` is 2.81:1 against `--gris-claro` and 3.06:1 against white — so `RevenueBarChart` in particular is a bar fill that does not clear WCAG 1.4.11. Not fixed here because this change's Step 1 scope names `RevenueBarChart.tsx` as must-not-touch, and widening mid-flight is what the scope-creep rule forbids. Worth its own small change.

