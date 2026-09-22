# Proposal

## Why

Six small backlog debts (D15, D20, D23, D25, D26, D27) are unblocked, cheap, and two of them are real defects: D27 is a WCAG contrast failure and D20 is an RLS policy with no `with check`, which is now the only thing guarding the reorder RPC. D15 has to be closed before L8, because a spec with no `## Purpose` stops the delta-spec sync that runs at archive. Grouping them into one change keeps the review cost low. D6 is dropped from the backlog without being fixed, at the maintainer's request.

## What Changes

- **D20:** new migration `020` recreates `onboarding_questions_admin_write` as `for all using (is_admin()) with check (is_admin())`. Migration 001 is not edited.
- **D23:** the three raw `#9a7b1f` / `rgba(240,198,116,.18)` pairs in `lib/admin/payment-status.ts`, `components/portal/settings/SubscriptionCard.tsx` and `components/admin/ClientDetailTabs.tsx` become `var(--ambar)` / `var(--ambar-tint)`.
- **D25:** the program filter pills in `ClientsTable` carry `aria-pressed`.
- **D26:** `settingsActions.ts` stops declaring `CANCELABLE_STATUSES` and uses the list exported from `lib/portal/cancellation.ts` (`ELIGIBLE_STATUSES`). `ACCESS_STATES` and `BILLING_STATUSES` are left alone: they answer different questions.
- **D27:** `RevenueBarChart` (bar fill) and `PerformanceChart` (line and dot stroke) move from `#9982f4` to `var(--lavanda-dark)`. ADR 0005 is updated so it no longer lists them as non-compliant.
- **D15:** `openspec/specs/admin-richtext-color/spec.md` gets a real `## Purpose`.
- **Backlog:** delete D6 (dropped, not fixed). Delete the D15/D20/D23/D25/D26/D27 rows at archive.

## Non-goals

- D6 (`.env.example` typo) is not fixed. It is only removed from the backlog.
- `PaymentsTable` pills (the D31 half of D25) and the `ClientsTable` status `<select>` are out of scope.
- The `#9982f4` swatch in `components/admin/blocks/TextBlockEditor.tsx:17` stays as it is. Its value is stored content, and D27 says to decide that case rather than convert it by reflex.
- D22, D24, D31, D33 and the other chart colors (`CartesianGrid #f0eae9`) are out of scope.

## Review rules touched

- **3** (`for all` policies need `with check`)
- **11** (migration applied and verified against the real DB before merge)
- **13** (one derivation of "may she cancel?" — D26 removes a second copy)
- **20** (ADR 0005 names the two chart components)
- CLAUDE.md → Design (colors from tokens; contrast floor)

## Sensitive surface

**Yes: RLS and a migration** (D20). This requires `/security-review` before the PR, plus runtime verification against the real DB. No money, webhook, auth-flow or service-role code changes. No fan-out.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `admin-onboarding-questions`: admin writes are checked against the written row, not only the row being replaced.
- `admin-dashboard-kpis`: the revenue chart's bars meet the same contrast floor, and the same no-raw-hex rule, as the bar-list cards.
- `portal-performance-display`: the progress chart's line meets the graphical-object contrast floor.
- `admin-clients-list`: the program filter pills tell assistive technology which one is active.

D23 and D26 change no behavior. D15 is a direct edit to a main spec's Purpose, which a delta cannot express.

## Impact

- `supabase/migrations/020_*.sql` (new)
- `lib/portal/settingsActions.ts`, `lib/portal/cancellation.ts` (export only)
- `lib/admin/payment-status.ts`, `components/portal/settings/SubscriptionCard.tsx`, `components/admin/ClientDetailTabs.tsx`
- `components/admin/ClientsTable.tsx`
- `components/admin/RevenueBarChart.tsx`, `components/portal/PerformanceChart.tsx`
- `docs/adr/0005-bar-fill-contrast-measured-against-the-track.md`
- `openspec/specs/admin-richtext-color/spec.md`, `BACKLOG.md`
