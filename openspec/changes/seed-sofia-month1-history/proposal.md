# Proposal

## Why

The demo has no seeded workout history, so Historial and the Desempeño charts are empty for every client Aura opens. Mes 1 of CuarentaMás Principiante Poco Tiempo has real content Aura captured, which makes it the one month where seeded history can match the actual program.

## What Changes

- Sofía Ramírez (`sofia.ramirez@test.aura.mx`) moves from `dayOffset: 5` to `dayOffset: 25`. She stays `active` in month 1 (`monthsElapsed: 1`).
- The seed writes `progress_logs` for her past period days (period days 0 to 24, today excluded). Each log resolves to the Mes 1 `program_day` that the portal shows for that date: week `floor(days/7)+1` and the real weekday.
- Log content comes from the day's `exercise_list` blocks as they exist in the DB at seed time: one `series` entry per prescribed set, filling only the metrics the exercise declares.
- Realism: most workouts complete, 2–3 skipped, 1–2 partial, and reps and weight rising slightly week to week.
- Sundays (Descanso Activo) are never logged. The same goes for cells with no published `program_day` and days with no `exercise_list` block.
- The seed only reads the catalog and never writes to it.

## Non-goals

- History for any other client, or for any month other than Mes 1.
- Progress photos, body metrics (never, by product rule), or general day notes.
- Any change to the portal, admin screens, schema or migrations.
- Hardcoded content ids or exercise names. If Aura edits Mes 1, the next seed run follows her edits.

## Review rules touched

- **17** (grid-relative day math): every `log_date` must fall on or after `current_period_start`. The cell is derived with the portal's own day-key function, not re-implemented.
- **8** (a union never narrower than the DB `CHECK`): not touched, because no status or enum values are introduced.
- **11**: not touched, because there is no new column or function.

## Sensitive surface / fan-out

- **Sensitive surface:** none of auth, RLS, webhooks, money or migrations changes. The seed already runs with the service-role key as a local script, and that stays the same.
- **Fan-out:** the seed writes to the real demo database, so runtime verification against that DB is required before merge. There is no cron, email or Stripe effect, because Sofía is not in `STRIPE_BACKED`.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `demo-seed`: adds requirements for Sofía's seeded month-1 workout history.

## Impact

- `scripts/seed-demo.ts`: Sofía's `dayOffset`, plus a new step that writes her logs after the subscriptions exist.
- New pure module `scripts/history-seed.ts` (planning dates to cells, building `exercises_done`), with `__tests__/history-seed.test.ts`. This follows the `scripts/stripe-seed.ts` pattern.
- The demo DB rows for Sofía, visible in Historial, Desempeño and the admin client detail.
