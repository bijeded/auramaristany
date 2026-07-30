## Context

`/admin/dashboard` renders two cards side by side in a flex row ([page.tsx:179-201](../../../app/admin/dashboard/page.tsx#L179-L201)):

```
┌─ Clientes por variante ─────┐  ┌─ Ingresos por programa ─────┐
│ inline JSX, hand-rolled     │  │ <ProgramRevenueDonut/>      │
│ bars, no component          │  │ Recharts horizontal bars    │
│ groupClientsByVariant(      │  │ groupRevenueByProgram(      │
│   activeSubs)               │  │   getPaidInvoices(12))      │
│ ~10 rows (variant grain)    │  │ 3 rows (program grain)      │
└─────────────────────────────┘  └─────────────────────────────┘
```

Neither card is a reusable component: the left one is inline JSX, the right one is a Recharts wrapper whose name has been wrong since A10 replaced the donut with bars. The catalog is 3 programs / 10 variants (migration 002), so the grains are an order of magnitude apart and the cards cannot be read against each other.

Constraints that shaped this design:

- **`getPaidInvoices(12)` has two consumers.** "Ingresos por mes" needs exactly 12 months. Widening or parameterizing that cutoff to serve the new card would silently change the other card's meaning.
- **Variant names are long** — `CuarentaMás Principiante Tiempo Suficiente` is 42 chars — and the cards stay at half width (~460px).
- **Review rule 14** (ADR 0004): a money figure must declare which subscriptions it counts before it is written.
- **Review rule 9**: `invoices → subscriptions → program_variants` needs the `!program_variant_id` FK disambiguation, already present in the existing selects.

## Goals / Non-Goals

**Goals:**

- Report revenue at the variant grain, all time, so the two dashboard cards share an axis.
- Make the two cards one visual system — same row anatomy, one component.
- Fix the contrast defect in the existing bar fill while the bars are being rewritten anyway (D23).
- Keep the change read-only: no migration, no schema change, no Stripe or webhook surface.

**Non-Goals:**

- Preserving program-grain revenue anywhere. It is being removed, not relocated.
- A toggle or selector between measures — an earlier shape of this idea, discarded because a single card toggling between a people figure and a money figure would silently swap the underlying population (rule 14) with no visual cue.
- Making the two cards agree on membership. They deliberately cover different populations.
- Redesigning "Ingresos por mes" or the KPI row.

## Decisions

### 1. A dedicated all-time query, not a widened `getPaidInvoices`

`getRevenueByVariantAllTime()` is new in `lib/admin/finance-queries.ts`. It selects paid invoices with no date cutoff and aggregates by variant name.

*Why not parameterize the existing query?* Making `monthsBack` optional gives one function two meanings and two call sites that must never drift — the classic shape of a figure that is quietly wrong. Rule 14's discipline is that a money figure declares its scope; a nullable cutoff hides it.

*Why not aggregate in Postgres via an RPC?* It would avoid pulling every invoice into memory, and that memory cost does grow without bound as the business ages. But an RPC means populating `Database["public"]["Functions"]`, which review rule 10 forbids outright — it switches PostgREST embed resolution onto the hand-maintained `Relationships: []` and fails `tsc` on every join in the repo. The workaround (a local `// keep:` cast on the client) is available, but not worth it for a table that will hold low thousands of rows for years. **Revisit if the invoice count reaches a scale where the round-trip is measurable** — the query is isolated behind one function, so the swap is local.

The select mirrors the existing one, one level shallower:

```
.from("invoices")
.select("amount_paid, subscriptions(program_variants!program_variant_id(name))")
.eq("status", "paid")
```

`invoice_date` is not selected — nothing needs it once the window is removed.

### 2. Ordering: clients-order first, revenue-only appended

```
clientsByVariant  →  [Princ.Poco(2), Interm.Poco(2), S&F Avanzado(2), …]
revenueByVariant  →  { Princ.Poco: 9990, Interm.Poco: 6993, Extra Avanzado: 4995 }
                                                              └─ churned, no active client

ordered income rows:
  1. walk clientsByVariant in order, emit those with revenue > 0
       → Princ.Poco $9,990 · Interm.Poco $6,993      (S&F Avanzado dropped: no revenue)
  2. append the remainder, sorted by total desc
       → Extra Avanzado $4,995
```

A pure helper `orderRevenueByClientsOrder(revenue, clientsOrder)` does this, so it is testable without a database. The alternative — sorting the income card independently by total — was rejected because two independently sorted lists sharing labels invite exactly the misreading the change exists to prevent: the eye assumes row *n* on the left is row *n* on the right.

The partial-alignment consequence is accepted and documented: alignment holds at the top, where the overlap is, and drifts below.

### 3. One `VariantBarList`, two instances

```tsx
<VariantBarList
  rows={[{ label, value, display }]}   // display: "2" | "$9,990"
  fill="var(--lavanda-dark)"
  emptyMessage="Sin suscripciones activas"
/>
```

Bar width is `value / max(rows.value)` within each card — each card scales to its own maximum, as the clients card does today. The two cards are *not* on a shared scale; they measure different units.

`display` is precomputed by the caller (`String(count)` / `formatMXN(total)`) rather than passed as a formatter function, keeping the component free of both `formatMXN` and any conditional on which card it is.

Two cards of identical anatomy drifting apart is the copied-table failure of review rule 8, made literal in JSX. One component is the enforcement.

Row internals need three fixes the current inline JSX does not have, all caused by long labels at half width:
- `align-items: baseline` so a wrapped two-line name does not drag the value down with it
- `white-space: nowrap` on the value so `$9,990` never breaks across lines
- a `gap` between label and value so they never touch at the wrap point

### 4. Colors: measured against the track, not the card

WCAG 1.4.11 requires 3:1 for graphical objects against **adjacent** colors. For the filled portion of a bar, the adjacent color is the `--gris-claro` (`#f5f5f5`) track, not the white card behind it.

| token | hex | vs `#f5f5f5` track | vs white card |
|---|---|---|---|
| `--rosa` | `#eddbd8` | **1.22 : 1** ✗ | 1.34 : 1 ✗ |
| `--rosa-deep` | `#e0c8c3` | **1.46 : 1** ✗ | 1.59 : 1 ✗ |
| `--lavanda` (current fill) | `#9982f4` | **2.81 : 1** ✗ | 3.06 : 1 ~ |
| `--lavanda-dark` (exists) | `#7a63d4` | **4.22 : 1** ✓ | 4.60 : 1 ✓ |
| `--rosa-bar` (**new**) | `#b8746a` | **3.35 : 1** ✓ | 3.66 : 1 ✓ |

Two findings worth stating plainly:

1. **The current bar already fails**, at 2.81:1. It clears 3:1 only where it overlaps the white card, which is not where it sits. This is pre-existing and is being fixed here because the bars are being rewritten regardless.
2. **No existing pink token can be a bar fill.** `--rosa` is the brand pink and it is a *background* color — that is its entire job. A pink bar at 1.22:1 against its own track is close to invisible. `--rosa-bar` at `#b8746a` is the lightest pink that clears the floor, and it reads as terracotta rather than the brand blush. That divergence is the honest cost of "pink for income", and Aura should be told rather than surprised.

Both literals at [page.tsx:191](../../../app/admin/dashboard/page.tsx#L191) and [ProgramRevenueDonut.tsx:33](../../../components/admin/ProgramRevenueDonut.tsx#L33) are retired — a raw hex in a component means the token system had a gap (D23), and here it did.

### 5. Recharts leaves this card

With the income card adopting the inline-bar form, `ProgramRevenueDonut.tsx` has no reason to exist and is deleted rather than renamed. `RevenueBarChart` still uses Recharts for "Ingresos por mes", so the dependency stays in `package.json` — this is not a dependency removal.

### 6. Equal height is the existing `alignItems: "stretch"`

The flex row already stretches both cards. Since the two lists may now differ in length, the shorter card gets trailing whitespace below its last row. That is correct and must not be "fixed" by distributing rows with `space-between` — uneven bar spacing would read as a rendering bug and would break the row-to-row comparison at the top.

## Risks / Trade-offs

- **The nested join returns an error, not rows, if the FK embed is wrong** → `!program_variant_id` is carried through, matching the existing `getPaidInvoices` select. Nothing in `tsc`, lint, the tests (which mock the client) or the build talks to the database (rule 11), so the query must be run against the real database and the row count confirmed before merge. A reader that only checks `!data` would degrade silently — the exact failure that served rest days to everyone for three PRs (rule 9).

- **Totals are not comparable across the change** → the old card summed 12 months at program grain; the new one sums all time at variant grain, so every number on that half of the dashboard changes at once and most will get larger. Flag it for Aura in the PR and the smoke card, or it reads as a data bug.

- **The demo data does not exercise the uneven-height case** → 20 clients spread 2-per-variant across all 10 variants means both cards will land at ~10 rows. The equal-height and the revenue-only-append paths are therefore untested by clicking around. The smoke card must call for a variant with active clients but no paid invoice (left-only) and, if reachable, a variant with revenue but no active client (right-only).

- **`--rosa-bar` is visibly off-brand** → accepted deliberately; see decision 4. The alternative (keeping brand pink and outlining each bar to reach contrast) adds a border to every row for a worse result.

- **Unbounded in-memory aggregation** → every paid invoice is fetched to sum it. Fine at the current and near-future scale; isolated in one function so a future move to server-side aggregation is a local change. Noted, not mitigated.

- **Long labels still wrap at half width** → mitigated by the row fixes in decision 3, not eliminated. Two-line labels will occur and are acceptable; the card grows taller rather than truncating a name, since a truncated variant name is genuinely ambiguous (two "Principiante" variants exist under different programs).

## Migration Plan

No data migration — the change is read-only against existing tables.

1. Branch off `main`; never push to `main` directly (it is the live demo).
2. Implement per `tasks.md`, TDD on the pure helpers.
3. Run the new query against the real Supabase project and confirm it returns rows with non-null variant names (rule 11). Record the result in the PR.
4. Preview URL → visual check of both cards side by side, including the empty state.
5. `code-review` verdict required. No `security-review`: no new input, no new write, no auth surface, admin-only read behind the existing `requireAdminPage()`.
6. CI green → merge → `/opsx:sync` (updates `openspec/specs/admin-dashboard-kpis/spec.md`) → `/opsx:archive`.

**Rollback:** revert the merge commit. No state to unwind.

## Open Questions

- Should the income card's title total be labelled as all-time (`· $128,871 MXN histórico`) rather than bare? The bare total is cleaner, but the clients card next to it is a live snapshot, so "histórico" removes a real ambiguity. Proposed: bare in the title, with the window stated in a small subtitle under the heading. Confirm during implementation against the rendered card.
- Does Aura want the revenue-only (fully churned) variants on the card at all? They are lifetime-accurate but represent nothing she can act on today. Keeping them for now — dropping them would make the card's grand total disagree with the sum of its visible rows, which is worse.
