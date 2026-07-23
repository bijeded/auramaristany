# Design — fase6-quick-batch-ui

## Context

Four small UI items from Aura's demo feedback (BACKLOG A2, A3, A10, A11). Current state:
- Rest labels render raw seconds: `Descanso: {ex.rest_seconds} seg` in `components/portal/blocks/ExerciseListLogged.tsx:59` and `ExerciseListReadOnly.tsx:42`. The admin editor input (`ExerciseListBlockEditor.tsx`, "Descanso (seg)") is data entry, not display.
- The exercise-done control lives in `components/portal/blocks/ExerciseListBlock.tsx` (per-exercise `completed` in `formState`, card tint on done).
- Dashboard revenue-by-program is a donut (`components/admin/ProgramRevenueDonut.tsx`); a bar-chart pattern already exists in `components/admin/RevenueBarChart.tsx`.
- `computeRenewalsThisMonth` (`lib/admin/finance-helpers.ts:106`) hardcodes a 30-day horizon.

## Goals / Non-Goals

**Goals:**
- Rest labels in minutes everywhere they are *displayed* to the client.
- "Hecho ✓" pill button (≥48px) as the done control per exercise card.
- Revenue-by-program as bars; 5th KPI card "Vencen en 7 días".

**Non-Goals:**
- No data/JSON changes (`rest_seconds` stays seconds; `exercise_list` untouched).
- Admin editor keeps its seconds input (data entry).
- No change to `groupRevenueByProgram` or KPI query logic beyond the N-day generalization.
- No migrations, no new dependencies.

## Decisions

1. **`formatRestLabel(seconds)` pure helper** in a portal/content helper module (+ AAA tests). Rules: `60 → "1 min"`, `90 → "1:30 min"`, `<60 → "45 seg"`, `120 → "2 min"`. Alternative (inline formatting in each component) rejected — duplicated logic, untestable.
2. **A3 = button-style "Hecho"** (user decision): replace the current checkbox/tint control with an explicit `✓ Hecho` pill button, ≥48px tall, full-width or right-aligned in the card footer. Done state: lavender fill (`#9982f4`) + white check; undone: outlined. Toggling remains the same `formState` mutation — presentation only.
3. **A10 = horizontal bars via Recharts**, reusing `RevenueBarChart`'s config (colors, tooltip, axis). Replace donut internals inside the same component file (rename optional) so the dashboard page import barely changes. Apply the `dataviz` skill when styling.
4. **A11 = generalize** `computeRenewalsThisMonth` → `computeRenewalsWithinDays(subs, days, now)` keeping a thin 30-day wrapper for backward compatibility (existing tests stay valid). Dashboard calls it twice (30d card + new 7d card). KPI row: adjust grid to wrap cleanly with 5 cards (e.g. `grid-cols-2 md:grid-cols-3 xl:grid-cols-5`).

## Risks / Trade-offs

- [Whole-card tap removed vs prototype's CheckRound] → Accepted: explicit button was Aura-side choice; keeps ≥44px targets.
- [5-card KPI row breaks layout on tablet widths] → verify responsive breakpoints in browser before PR.
- [`1:30 min` format ambiguity for odd values (e.g. 75s)] → helper covers `M:SS min` generally; tests pin edge cases (0, <60, exact minutes, non-round).
- [First PR through CI (D7) — gate never exercised] → if CI itself fails for infra reasons, fix workflow in the same branch.
