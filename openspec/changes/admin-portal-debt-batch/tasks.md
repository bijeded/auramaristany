# Tasks

## 1. Client-list filters: D22 (widened)

- [x] 1.1 Write failing tests in `__tests__/clients-helpers.test.ts`, one per new option. Each asserts that "En prueba", "Pausadas", "Incompletas" and "Expiradas" match only their status. Include `incomplete` vs `incomplete_expired`, and a quiet `trialing` row that matches both "En prueba" and "Sin actividad" but not "Activas". Verify: `npm run test:run` fails because the filters don't exist yet.
- [x] 1.2 Write the exhaustiveness test: `const ALL = {…} satisfies Record<SubscriptionStatus, true>`, and for each status a recently-active row is returned by at least one entry of `STATUS_FILTERS`. Verify: it fails today on `trialing`, `paused`, `incomplete` and `incomplete_expired`.
- [x] 1.3 Add the four literals to `StatusFilter`, append them to `STATUS_FILTERS` after "Sin actividad", and add one status-equality guard each in `filterClients`. Verify: 1.1 and 1.2 pass, and every existing `clients-helpers` test still passes, so existing memberships are unchanged.
- [x] 1.4 Add a `parseStatusFilter` test showing `"Pausadas"` round-trips and an unknown value still yields `null`. Verify: `npm run test:run` is green.

## 2. First component render test: D30

- [x] 2.1 Create `__tests__/clients-table-status-select.test.tsx`. Render `ClientsTable` with `next/navigation` mocked (`useRouter`, `usePathname`, `useSearchParams`) and assert the status `<select>` option values equal `["", ...STATUS_FILTERS]` in order. Verify: the test passes, then fails when a literal `<option>` is added to the component temporarily. Revert that edit.
- [x] 2.2 If the `.tsx` test needs any Vitest config change, make it in this task and state why in the commit. Verify: `npm run test:run` picks up and passes the file with no other test affected.

## 3. Badge contrast: D8 (widened)

- [x] 3.1 Write failing tests for `lib/ui/contrast.ts`, test-first:
  - `contrastRatio("#000000", "#ffffff") = 21`
  - `#767676` on white ≈ 4.54
  - `compositeOverWhite("rgba(76,175,125,.14)")` equals the expected hex

  Then implement the helper. Verify: the new tests pass.
- [x] 3.2 Create `lib/ui/badge-tones.ts` with `BADGE_TONE` (`success`, `lavender`, `danger`, `warning`, `neutral`), holding only `var(--…)` references. Write `__tests__/badge-contrast.test.ts`: it parses `:root` in `app/globals.css`, resolves each tone, and asserts ≥ 4.5:1 with the tone named on failure. Verify: it fails on four tones with today's tokens.
- [x] 3.3 In `app/globals.css`:
  - add `--exito-tint` (today's success rgba)
  - add `--lavanda-text`, `--error-text` and `--ambar-text`
  - darken `--exito-text`
  - keep each hue and target ≥ 4.7:1
  - do not touch the base tokens

  Verify: `badge-contrast.test.ts` passes for all five tones.
- [x] 3.4 Write a failing test for `paymentStatusBadge(status)` in `lib/admin/payment-status.ts`: known statuses keep their label, and an unknown status returns itself in the neutral tone. Implement it. Verify: the test passes.
- [x] 3.5 Point every badge site at `BADGE_TONE`, labels unchanged:
  - `STATUS_PRESENTATION` and `AMBAR` in `lib/admin/clients-helpers.ts`
  - `lib/admin/payment-status.ts`
  - `components/portal/settings/SubscriptionCard.tsx`
  - the program chip in `components/admin/ClientsTable.tsx`
  - `components/admin/AutomatedMessagesEditor.tsx`
  - `components/admin/OnboardingBuilder.tsx`

  Verify: the grep `rgba(76,175,125,.14)|var(--ambar)"|var(--error)" |lavanda-dark)"` over `components lib` finds no colour pair left at the listed sites, and the existing `statusBadge` tests pass. (Updated during apply: the grep also hits plain text, icons and five more tinted chips in files this change does not name; those chips go to D38.)
- [x] 3.6 Route the four payment-status sites through `paymentStatusBadge`: `PaymentsTable`, `app/admin/dashboard/page.tsx`, `ClientDetailTabs` and `components/portal/settings/PaymentHistory.tsx`. Delete `PAY_STATUS` and the `?? STATUS_LABEL.x` fallbacks. Verify: `grep -rn "PAY_STATUS\|STATUS_LABEL\[" components app` returns nothing, and `npx tsc --noEmit` passes.

## 4. Portal header date: D12 (widened)

- [ ] 4.1 Add two tests to `__tests__/date-helpers.test.ts`. The first uses fake timers: with the system time set to 2026-06-08, `weekdayLabel()` returns "Lunes, 8 de junio". The second sets `DEV_DATE` and asserts `weekdayLabel()` still follows the system time. Verify: both pass (this pins existing behaviour).
- [ ] 4.2 Give `TodayView`, `ProgressView` and `WeekView` a `dateLabel` prop and remove their clock reads (`todayLabel()`, and `weekdayLabel(content?.effectiveDate)` in `TodayView`). Verify: `npx tsc --noEmit` fails at each page that doesn't pass it yet.
- [ ] 4.3 In each of the seven pages (`app/portal/{today,semana,pilares,history,messages,messages/[id],settings}/page.tsx`), compute `weekdayLabel()` and pass it down. Delete the three page-level `todayLabel()` functions, and drop `serverToday()` from `/pilares` if nothing else there needs it. Verify: `grep -rn "function todayLabel" app components` returns nothing, and `npx tsc --noEmit` passes.

## 5. Backlog

- [ ] 5.1 Update `BACKLOG.md`:
  - Remove D22, D8, D12, D30, D31 and D21.
  - Add **D37**: portal "today" is UTC and rolls over at 18:00 Mexico time; date labels set no `timeZone`; a platform-wide decision, since the specs mandate UTC day math.
  - Add **D38**: text-on-tint contrast outside badges, e.g. white on `--lavanda` 3.06:1 on `.pill.active` and the nav/message counters, the "Pilares del mes" link chip at 3.92:1, and icon tiles.
  - Update the Index row's D-range.

  Verify: `grep -nE "\*\*D(8|12|21|22|30|31)\*\*" BACKLOG.md` returns nothing, and D37 and D38 are present.

## 6. Verification and handoff

- [ ] 6.1 Run the full gate locally: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`. Verify: all four exit 0; quote the summary lines.
- [ ] 6.2 Smoke checks on the Preview URL, using seeded rows and read-only steps only:
  - (a) `/admin/clients`: pick each of "En prueba" (Verónica Salas), "Pausadas" (Silvia Ochoa), "Incompletas" (Claudia Núñez) and "Expiradas" (Javier Alcántara); each shows its client, and "Activas" shows none of them.
  - (b) D8: Verónica's "Prueba" badge and every other status badge is legible at ~375px and desktop.
  - (c) the client detail, `/admin/payments` and the dashboard show the same payment-status badge colours.
  - (d) signed in as a seeded client: Hoy, Semana, Pilares, Mi progreso, Mensajes, one message and Ajustes all show the same header date, and there is no hydration warning in the console.

  Record the results in the PR body. Anything not checked is marked *not verified*.
- [ ] 6.3 Open the PR from `task/admin-portal-debt-batch` with a Conventional Commit title.
  - The body lists the visible restyle (darker badge text on admin and portal screens) and states that there is no sensitive surface, so no `/security-review`.
  - It carries the silent-defect flag: **yes**, a status/filter union (`StatusFilter`) widened, and the payment-status fallback changed on four screens.
  - Squash-merge on green CI. Verify: report the PR number, the CI result and the merge commit.
