# Design: a12-portal-week-calendar

## Context

Portal clients today have `/portal/today` (current day only, gated by `getCurrentDayKey` + week-4 clamp) and `/portal/history` (past). All access math lives in pure helpers in `lib/content/access.ts`; server reads live in `lib/content/queries.ts` (`import 'server-only'`, RLS-aware client). `subscriptions.current_period_end` exists (migration 001, `lib/supabase/types.ts:268`) but has never been queried. `PortalNav` is a bottom bar with 4–5 tabs (`showPilares`).

## Goals / Non-Goals

**Goals**
- Read-only week preview: today + next 7 days, titles only, cut at the billing period.
- Reuse the existing access model — no new access logic, only composition.
- Keep pure window computation testable and separate from the Supabase query.

**Non-Goals**
- No navigation into future days (only today's row links, to `/portal/today`).
- No change to `/portal/today` behavior or its `published=true` filter.
- No draft/unpublished badge; no migration; no admin-side changes.

## Decisions

### D1 — Pure helper `getUpcomingDayKeys` in `lib/content/access.ts`
Signature (approx): `(currentPeriodStart: string, currentPeriodEnd: string | null, today: Date) → Array<{ date: string; week_number: number; day_of_week: DayOfWeek; isToday: boolean }>`.
- Generates 8 entries (today + 7) from real UTC dates.
- Drops entries whose date `>= current_period_end` (list shrinks near renewal). If `current_period_end` is null, no cut is applied (defensive; Stripe always sets it).
- `week_number` computed like `getCurrentDayKey` (same UTC arithmetic), **clamped to 4** — days 29–31 of a long period repeat week 4, consistent with `/portal/today`.
- Rationale: composition over new logic; TDD-able (AAA), mirroring existing helpers. Alternative considered: computing the window inside the query — rejected, violates the data/presentation separation convention.

### D2 — One batch query `getWeekCalendar(userId)` in `lib/content/queries.ts`
- Same sub → `variant_series_map` → series resolution as `getTodayContent` (`getCurrentSeriesNumber(months_elapsed)`), now also selecting `current_period_end`.
- Single `program_days` select on `series_id` with `.in("week_number", …)`, no explicit `published` filter in code. **Note (smoke finding):** the `program_days` RLS policy (`published = true or is_admin()`, migration 001) filters unpublished rows at the DB boundary anyway, so unpublished days render as "Descanso". Decision: accept this — RLS stays the security boundary; no migration, no service-role in the portal. Match rows to day keys in JS.
- Days with no row → rest day ("Descanso", reuse `lib/content/rest-label.ts` if applicable).
- Only titles/metadata selected (`week_number, day_of_week, title, day_type, workout_focus`) — no blocks, no ids leaked into links.
- Uses `DEV_DATE` the same way `getTodayContent` does (`T12:00:00`).

### D3 — Route `/portal/semana`, Server Component
- RSC page mirroring `/portal/today`'s auth/subscription guard pattern (middleware already gates `/portal`).
- 8 rows max: date label ("Lun 22 Jul" style, capitalized in JS per convention) · title or "Descanso". Today's row highlighted and wrapped in `<Link href="/portal/today">`; future rows are plain, non-interactive elements (no href, no cursor-pointer).

### D4 — Nav: 6 tabs, icon swap
- Insert `{ href: "/portal/semana", label: "Semana", icon: CalendarDays }` between "Hoy" and "Pilares"; "Hoy" switches to `Sun`.
- Rename "Configuración" → "Perfil" (shorter label for the 6-item row); icon `Settings` → `User`. Route stays `/portal/settings`.
- Tab order: Hoy · Semana · Pilares* · Historial · Mensajes · Perfil.
- **Conditional fallback** (apply only if 6 tabs visually break at 375px): move "Perfil" to the portal top bar aligned right, center the date.

## Risks / Trade-offs

- [Unpublished titles visible to clients] → Accepted explicitly by the user (calendar-only). If Aura objects post-demo, re-adding `.eq("published", true)` is a one-line revert.
- [Future-day leakage concern ("sin acceso a días futuros")] → Mitigated: titles only, no ids/links for future rows; blocks never fetched.
- [`current_period_end` null/stale] → Defensive null handling (no cut); `months_elapsed` remains the arbiter of series selection, unchanged.
- [6-tab crowding on small screens] → Short labels likely fit; explicit fallback defined in D4.

## Migration Plan

None (no schema change). Ship on `feature/a12-portal-week-calendar` → Preview → PR → merge to `main`.

## Open Questions

None — window rule, unpublished visibility, tab placement/icons, and row count were all decided during exploration.
