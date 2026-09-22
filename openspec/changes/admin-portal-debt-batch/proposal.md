# Proposal

## Why

Four small backlog items (D22, D8, D12, D30) touch the same two screens and one helper module, so they ship as one change instead of four. Two of them turned out larger than the backlog recorded:

- **D8** was "visually check the `trialing` badge". Checking it showed the badge fails the 4.5:1 text-contrast floor (3.92:1). So do four of the five colour pairs every status badge uses: Activa/Completada is at 2.40:1.
- **D12** listed three duplicated `todayLabel()` copies. There are five, and they disagree: two honour `DEV_DATE` and the others don't.

Two further items are decided without code: D31 is accepted as-is and D21 is dropped.

## What Changes

- **D22, widened: every subscription status the DB accepts becomes reachable from the client-list filter.** The status select gains four options: "En prueba" (`trialing`), "Pausadas" (`paused`), "Incompletas" (`incomplete`) and "Expiradas" (`incomplete_expired`). Today a client in any of these states is visible only with no filter applied. The one exception is a `trialing` client, who also appears under "Sin actividad" when inactive; the backlog missed `trialing`. The demo seed has one client in each state: Verónica Salas, Silvia Ochoa, Claudia Núñez and Javier Alcántara. Each label reads as the badge its rows already carry.
- **D30: first component render test.** It asserts that the client-list status select offers exactly `STATUS_FILTERS` plus the unfiltered sentinel. This is the first automated enforcement of the options-list half of review rule 8, which until now only a smoke step checked. It is written after D22 changes the list.
- **D8, widened: status and label badges meet 4.5:1.** Badge colours come from one shared tone table backed by text tokens that pass on their tint. Every badge of that shape (a small label on a tinted pill) is converted:
  - subscription status: admin list and detail
  - portal subscription card
  - payment status: payments table, dashboard, client detail and the portal payment history
  - the program chip on the client list
  - the automated-message Activo/Inactivo chip
  - the onboarding-builder badges

  All four payment-status sites use one lookup. It shows an unknown status as itself, where two sites currently mislabel it "Pendiente" and one "Anulado". The client detail's private copy of the map is deleted. **Visible restyle:** badge text gets darker on every screen above.
- **D12, widened: every portal header shows the current real date.** All seven headers (Hoy, Semana, Pilares, Mi progreso, Mensajes, a single message, Ajustes) use the existing `weekdayLabel()` on the real clock. The five `todayLabel()` copies are removed. `/today` and `/pilares` stop deriving the header from `serverToday()`. This only affects local dev: `serverToday()` already ignores `DEV_DATE` in production. The label is computed in the server page and passed down, so no client component reads the clock.
- **Backlog:**
  - Remove D22, D8, D12, D30, D31 (accepted: four payment pills fit on one line) and D21 (dropped).
  - Add **D37**: the portal's "today" is UTC and rolls over at 18:00 Mexico time.
  - Add **D38**: text-on-tint contrast outside badges, e.g. white on `--lavanda` is 3.06:1 on `.pill.active` and the nav/message counters, and the "Pilares del mes" link chip.

### Non-goals

- **D36** (missing `with check` on four non-content RLS policies). It ships on its own because it is a money and identity surface.
- **D31**: the payments table keeps its four pills.
- **Time zones (D37).** The header date stays whatever the server's clock says, which is UTC on Vercel. Fixing the headers alone would make them disagree with the day's content.
- **Contrast beyond badges (D38).** Buttons, active pills, counters, icon tiles and link chips are not recoloured here.
- **Filter semantics that already exist.** "Activas", "Vencidas", "Canceladas" and the rest keep their membership exactly. `trialing` is not folded into "Activas", and `incomplete_expired` is not folded into "Canceladas".
- **Badge labels.** Text is unchanged, including the portal card's deliberately client-facing wording ("Pago pendiente", "Sin pagar").
- **The `--exito`, `--error`, `--ambar` and `--lavanda` base tokens.** They also drive icons, fills and charts. Only text tokens are added or darkened.

### Review rules touched

- **Rule 8:** the `StatusFilter` union widens, the select's options still come entirely from `STATUS_FILTERS`, and D30 adds the test that enforces it.
- **Rule 21, by principle:** badge surfaces are enumerated by shape (small label on a tinted pill), not by one colour spelling.
- **Rule 20:** `todayLabel` and `PAY_STATUS` are retired. A grep of `docs/adr/` finds neither name, so no ADR changes.
- **Design → tokens, D23:** new colours arrive as tokens in `app/globals.css`, never as raw hex.

### Surface declaration

- **No sensitive surface:** no auth, RLS, service-role, webhook, money computation or migration. Payment badges change colour only; no amount or aggregation is touched.
- **No fan-out.**
- **Silent-defect surface: yes.** A status/filter union (`StatusFilter`) widens, and a filter's row-set is the kind of defect CI cannot see. Its membership gets pure tests.

## Capabilities

### New Capabilities

- `status-badge-contrast`: every status or label badge draws its colours from one tone table, and every tone meets 4.5:1 text contrast.
- `portal-header-date`: every portal page header shows the current real date in one format, computed on the server.

### Modified Capabilities

- `admin-clients-list`: the status filter gains "En prueba", "Pausadas", "Incompletas" and "Expiradas", so every status the DB accepts is reachable.

## Impact

- **Filters:**
  - `lib/admin/clients-helpers.ts`: `StatusFilter`, `STATUS_FILTERS`, `filterClients` and the badge presentation map
  - `components/admin/ClientsTable.tsx`: the program chip. The select needs no change; it maps the constant.
- **Badges:**
  - `lib/admin/payment-status.ts`
  - `components/admin/ClientDetailTabs.tsx` (loses `PAY_STATUS`)
  - `components/portal/settings/SubscriptionCard.tsx`, `components/portal/settings/PaymentHistory.tsx`
  - `components/admin/PaymentsTable.tsx`, `app/admin/dashboard/page.tsx`: payment lookup only
  - `components/admin/AutomatedMessagesEditor.tsx`
  - `components/admin/OnboardingBuilder.tsx`
  - `app/globals.css` (text tokens)
  - a new tone module and a pure contrast helper
- **Headers:**
  - pages: `app/portal/{today,semana,pilares,history,messages,messages/[id],settings}/page.tsx`
  - components: `components/portal/{TodayView,WeekView,ProgressView}.tsx`
- **Tests:**
  - `__tests__/clients-helpers.test.ts` and `__tests__/date-helpers.test.ts`
  - a new contrast test
  - the first component render test, for the `ClientsTable` select
- **Docs:** `BACKLOG.md`.
- **No DB, Stripe, email or cron change.** CI covers everything except layout and colour, which the smoke steps cover by eye.
