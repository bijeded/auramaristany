# Proposal — fase6-quick-batch-ui

## Why

First batch of Aura's demo feedback (2026-07-18): four small, low-risk, highly visible UI improvements (A2, A3, A10, A11 in `BACKLOG.md`). Shipping them quickly shows Aura her feedback lands, and this is the first change to exercise the full CI gate (D7).

## What Changes

- **A2 — Rest in minutes:** exercise rest labels render as `1 min` / `1:30 min` instead of `60 seg`. Presentation only — `rest_seconds` data and the `exercise_list` JSON are untouched. Applies to the portal exercise card (`/portal/today`), the read-only history view (`ExerciseListLogged`), and the admin editor preview if it shows rest.
- **A3 — Visible "done" control:** the exercise-done checkbox in `/portal/today` becomes an explicit **"Hecho ✓" pill button** (≥48px) at the exercise card footer. Same underlying toggle/state; only the control changes.
- **A10 — Bars for "Ingresos por programa":** the admin dashboard donut becomes a bar chart, reusing the pattern of `RevenueBarChart`. Data source (`groupRevenueByProgram`) unchanged.
- **A11 — 5th stat card:** new dashboard KPI "subscriptions expiring in ≤7 days". Added as a fifth card; does NOT replace "Renuevan este mes" (≤30d). Requires generalizing `computeRenewalsThisMonth` to N days (pure + TDD) and adjusting the KPI row's responsive layout for 5 cards.

No migrations, no data changes, no new dependencies.

## Capabilities

### New Capabilities
- `portal-exercise-display`: presentation of exercises in the client portal — rest-time labels in minutes and the "Hecho" done control.
- `admin-dashboard-kpis`: admin dashboard visualizations — revenue-by-program chart form and the KPI stat-card row including the ≤7-day expiring metric.

### Modified Capabilities

_None — no existing specs in `openspec/specs/`._

## Impact

- **New:** pure helper for rest-label formatting (+ AAA tests); generalized N-day renewal helper (+ tests).
- **Modified:** portal exercise card in `/portal/today` · `components/portal/blocks/ExerciseListLogged.tsx` · `components/admin/ProgramRevenueDonut.tsx` (→ bars) · `lib/admin/finance-helpers.ts` · `app/admin/dashboard/page.tsx`.
- **Untouched:** DB schema, migrations, Stripe, webhooks, `exercise_list` JSON, `groupRevenueByProgram` data logic.
- **Process:** first PR through CI — verifies the `ci` + gitleaks gate (closes D7 as a side effect).
