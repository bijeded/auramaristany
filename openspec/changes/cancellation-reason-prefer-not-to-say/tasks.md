## 1. Migration first (before any app code merges)

- [x] 1.1 Write `supabase/migrations/019_cancellation_reason_prefer_not_to_say.sql`: drop and recreate the `cancellation_surveys.reason` `CHECK` with `prefiero_no_decir` added to the existing seven. Comment says why the value exists — declining to answer is not "Otro" — so the next reader does not re-merge them.
- [x] 1.2 Apply the migration. **Applied by the human on 2026-07-30** — no `SUPABASE_ACCESS_TOKEN`, Supabase CLI not logged in and no `psql` available to this agent, so DDL could not be run here. (SQL on ONE single line if going through the Management API: the pipeline eats newlines, so a `--` comment silently comments out everything after it and returns `[]` as though it worked.)
- [x] 1.3 Verify against the real database, not the file. **The `pg_constraint` query was NOT run** — no SQL access. Verified functionally instead via PostgREST, which excludes both failure modes and is arguably stronger than reading the catalogue:
      · service-role insert `prefiero_no_decir` → **201**. Rules out "not applied" and "drop was a no-op + a second check added alongside" — a surviving seven-value check would reject it.
      · service-role insert `motivo_inventado` → **400 / 23514**. Rules out "constraint dropped but the `add` failed", which would look identical to success on the first probe alone.
      · the rejection message names the constraint — `cancellation_surveys_reason_check` — which is the evidence the before/after query was meant to supply: the migration dropped the right name, and exactly one check enforces `reason`.
- [x] 1.4 Probe the write path end to end under a **client** session (not service-role), which is the one check proving migration 011's insert policy and the `CHECK` agree:
      · client insert `prefiero_no_decir` → **201**, accepted by `with check (profile_id = auth.uid() and source = 'voluntary' and reason <> 'pago_fallido')`.
      · client insert `pago_fallido` → **403 / 42501**, still unforgeable by a client.
      · probe row deleted by the same client session, which also exercised `delete_own_voluntary`.
      · table back to its 7 seed rows, no `prefiero_no_decir` left behind — Aura's dashboard untouched.
- [x] 1.5 Record in the PR when 1.2–1.4 ran and what they returned (rule 11).

## 2. Types and pure helpers (TDD)

- [x] 2.1 Write tests: `cancellationReasonLabel("prefiero_no_decir")` returns "Prefiero no decir"; `reasonRequiresDetail("prefiero_no_decir")` is **false**; `CANCELLATION_REASON_OPTIONS` contains it, places it **last**, and still excludes `pago_fallido`.
- [x] 2.2 Add `prefiero_no_decir` to the `CancellationReason` union in `lib/supabase/types.ts`.
- [x] 2.3 Add the `REASON_LABELS` entry and extend `CANCELLATION_REASON_OPTIONS` in `lib/portal/cancellation.ts`. `DETAIL_REASONS` stays unchanged — the test from 2.1 is what keeps it that way.
- [x] 2.4 Confirm `isChurned` and the dashboard denominator need no change (they key on subscription status, not on reason), and say so rather than leaving it unexamined.

## 3. Server action (TDD)

- [x] 3.1 Write tests: the zod enum accepts `prefiero_no_decir`; an omitted reason results in `prefiero_no_decir`, **not** `otro`; a `detail` submitted alongside `prefiero_no_decir` is not stored.
- [x] 3.2 Add the value to `cancelInputSchema` in `lib/portal/settingsActions.ts` and change the fallback from `reason ?? "otro"` to `reason ?? "prefiero_no_decir"`.
- [x] 3.3 Leave the swallow-on-insert-failure behavior exactly as it is, and add a line to its comment naming what it costs: a value the `CHECK` rejects disappears silently. That comment is the reason task group 1 runs first.

## 4. Modal — one source of options

- [x] 4.1 Delete the hardcoded "Prefiero no decir" radio at `components/portal/settings/CancelSubscriptionSection.tsx:172` and the `reason === null` modelling around it, so every radio comes from `CANCELLATION_REASON_OPTIONS`.
- [x] 4.2 Check the state type: if `reason` was `CancellationReason | null` only to model the extra radio, narrow it. If `null` still means "nothing selected yet", keep it and say which meaning survived.
- [x] 4.3 Confirm no free-text field appears for `prefiero_no_decir` (it follows from `reasonRequiresDetail`, but the modal's `showDetail` is the thing that must actually honor it).
- [x] 4.4 Tap targets stay >=44px and the option keeps its existing styling; the deleted radio had its own inline style, so check nothing regressed visually.

## 5. Verification

- [x] 5.1 Local gate: `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` — all green, no regression in `__tests__/cancellation.test.ts` or `__tests__/settings-actions.test.ts`.
- [ ] 5.2 Runtime, on Preview: cancel a demo subscription selecting "Prefiero no decir", confirm the row lands with that reason and no detail — then confirm the same for cancelling with nothing selected.
- [ ] 5.3 Runtime: the new bar appears on "Razones de cancelación" in `/admin/dashboard` with its Spanish label, and the "Otro" bar no longer absorbs the declines.
- [ ] 5.4 Reactivate the probe client and confirm her survey row is deleted as before (the reactivation path deletes the latest voluntary row; the new reason must not change that).
- [ ] 5.5 `code-review` subagent verdict before the PR. `security-review` is required too: the diff touches a client-facing write path, a zod schema, and an RLS-governed insert.
- [ ] 5.6 Restore any demo data touched by 5.2–5.4, so the dashboard Aura sees is not left carrying a test cancellation.

## 6. Close-out

- [ ] 6.1 Tell Aura, in the PR or wherever she reads it, that the "Otro" bar keeps its pre-change declines and that no backfill is possible — only cancellations after this change are clean.
- [ ] 6.2 Delete the D19 row from `BACKLOG.md`.
- [ ] 6.3 `openspec validate` and `/opsx:archive` — through a PR, never a direct push to `main`.

## Parallelization

Sequential, and group 1 is a hard gate rather than a preference: the app code must not merge until the migration is applied and verified (rule 11). Groups 2 and 3 could be written in parallel with 1 but must not merge before it.

Sequential: 1 → 2 → 3 → 4 → 5 → 6
