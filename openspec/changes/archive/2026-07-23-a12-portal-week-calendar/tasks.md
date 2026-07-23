# Tasks: a12-portal-week-calendar

## 1. Pure window helper (TDD)

- [x] 1.1 Add `getUpcomingDayKeys(currentPeriodStart, currentPeriodEnd, today)` to `lib/content/access.ts` — 8 entries max (today + 7), UTC arithmetic, week clamp to 4, drop dates `>= current_period_end` (null end → no cut). Write Vitest suite first (AAA): full window, cut at renewal, week-4 repeat, null end, today flag.

## 2. Server query

- [x] 2.1 Add `getWeekCalendar(userId)` to `lib/content/queries.ts`: sub select (+ `current_period_end`) → variant/series resolution via `getCurrentSeriesNumber` → single `program_days` select (title metadata only, NO `published` filter, no blocks) → match rows to day keys in JS; rest day when no row. Honor `DEV_DATE` (`T12:00:00`).

## 3. Route and UI

- [x] 3.1 Create `app/portal/semana/page.tsx` (RSC) following `/portal/today`'s guard pattern; render up to 8 rows: capitalized Spanish date label + title or "Descanso"; today row highlighted with `<Link href="/portal/today">`; future rows inert (no href, no ids).
- [x] 3.2 Update `components/portal/PortalNav.tsx`: insert "Semana" tab (`CalendarDays`) between "Hoy" and "Pilares"; switch "Hoy" icon to `Sun`; rename "Configuración" → "Perfil" with icon `User` (route unchanged); verify 6-tab layout at 375px. If broken, apply fallback: "Perfil" to top bar right, date centered.

## 4. Verification

- [x] 4.1 Green baseline: `npx tsc --noEmit` · `npm run lint` · `npm run test:run` (252 + new) · `npm run build`.
- [x] 4.2 Smoke with `DEV_DATE`: mid-period (8 rows), near renewal (shrinking list), day 29+ (week-4 repeat), rest day, unpublished day visible, today link works, nav active states.
