# Tasks — A4 Automated Messages

Suggested as **3 PRs** (foundation → rules+cron → admin UI), mirroring the A6+A7 shape. Each PR must leave `tsc`, `lint`, `test:run` and `build` green. Baseline: 252 tests.

## PR 1 — Foundation: migration, D9 helper, email body

### 1. Migration 014
- [x] 1.1 Write `supabase/migrations/014_automated_messages.sql`: `automated_notices` (id, profile_id → profiles on delete cascade, rule text + `CHECK (rule in ('booking_reminder','inactivity_nudge'))`, period_key text not null, sent_at timestamptz default now(), `unique (profile_id, rule, period_key)`) + index on `(profile_id, rule)`.
- [x] 1.2 Same migration: `automated_messages` (rule text primary key with the **same** `CHECK` values, subject text not null, body text not null, is_active boolean default true, updated_at timestamptz default now() + `set_updated_at` trigger).
- [x] 1.3 Same migration: seed both rows with the initial Spanish copy (warm, 1st person, no "bienestar", 'cliente' never 'clienta'); `{nombre}` in each body.
- [x] 1.4 Same migration: RLS. `automated_notices` — enable RLS, **no policies** (service-role only; the client never reads its own nudge history). `automated_messages` — enable RLS + admin-only `for all using (is_admin()) with check (is_admin())`.
- [x] 1.5 Apply via Supabase Management API — ⚠ send the SQL on **ONE single line** (the pipeline eats newlines → `--` comments out the rest).
- [x] 1.6 Add both tables to `lib/supabase/types.ts` **by hand**, including `Relationships: []`. Export the `NoticeRule` union — it mirrors the `CHECK` constraint.

### 2. D9 — shared `serverToday()`
- [x] 2.1 Write tests for `serverToday()`: honors `DEV_DATE` (noon-anchored, avoiding the midnight-UTC → prior-day drift), falls back to `new Date()`.
- [x] 2.2 Implement `lib/content/server-today.ts`.
- [x] 2.3 Refactor the ~5 inline call sites: `lib/content/queries.ts` (×3), `lib/content/booking-queries.ts` (`getBookingState`), `app/admin/clients/page.tsx`. Behavior must be identical — existing tests stay green with no edits.
- [x] 2.4 Mark **D9** done in `BACKLOG.md`.

### 3. Email carries the body
- [x] 3.1 `lib/email/templates/NewMessageEmail.tsx`: render the body via `{body}` inside a `<Text>` with `whiteSpace: "pre-line"`. Keep the "Ver mensaje" CTA. **Never** `dangerouslySetInnerHTML`.
- [x] 3.2 `lib/email/send.ts`: `sendNewMessageEmail` takes `body`; `sendNewMessageEmailBatch` takes `{ email, subject, body }[]` and renders per recipient while keeping the 100-item `resend.batch.send` chunking.
- [x] 3.3 `lib/admin/messageActions.ts`: pass the body through to the batch sender. ⚠ Intentional side-effect — **Aura's manual messages now include their body in the email**. Call it out in the PR description.

> **PR 1 shipped — deltas vs. the text above** (PR #13, merged `53c29d1`; migration applied and smoke-verified 2026-07-27):
> - **1.1** the extra `(profile_id, rule)` index was **dropped** — the `unique (profile_id, rule, period_key)` constraint's implicit index already serves that prefix (code review).
> - **1.4** `automated_notices` also got `force row level security` + `revoke all from anon, authenticated`, so "service-role only" is explicit rather than inferred from the absence of policies (security review). **Consequence for PR 2/3: admins cannot read the ledger either — any nudge-history view must use the service-role client.**
> - **2.3** was **8** call sites, not ~5: `lib/content/queries.ts` ×3, `lib/content/booking-queries.ts`, `app/admin/clients/page.tsx`, `app/portal/{messages,messages/[id],settings,pilares}/page.tsx`.
> - **2.x** `serverToday()` additionally **ignores `DEV_DATE` in production** (`NODE_ENV`/`VERCEL_ENV`) and warns on a malformed value — a prod misconfiguration would otherwise freeze `period_key` and jam the dedupe ledger permanently (security review).
> - **3.2** `sendNewMessageEmail` (single-recipient) was **deleted**, not widened — zero callers; the cron uses the batch path. `safeSend` stays covered via `sendWelcomeEmail`.
> - Added `__tests__/notice-rule-constraint.test.ts`: fails CI if `NoticeRule` and the migration's `CHECK` literals drift in either direction.
> - Migration 014 is **run-once** (plain `create table`); only the seed is idempotent. Do not re-run the file.

## PR 2 — Rules engine + cron

### 4. Pure rule layer (TDD — this is the whole risk surface)
- [ ] 4.1 Tests for `isFirstDayOfAgendarRun(periodStart, today, agendarCells, seriesNumber)`: first day of a run → true; second/third day → false; two clients with different period-start weekdays each get their own first day; run straddling a week boundary; **week-4 clamp** — day 29 resolving to an already-visited W4 cell.
- [ ] 4.2 Tests for `bookingPeriodKey` (`<period_start>:W<n>-<dow>`, naming the **first cell of the run**) and `inactivityPeriodKey` (`<last_activity_date>` | `never:<enrollment_date>`).
- [ ] 4.3 Tests for `renderTemplate(body, vars)`: substitutes `{nombre}`; leaves unknown placeholders literal; never throws.
- [ ] 4.4 Tests for `evaluateNotices(clients, agendarCells, sentKeys, templates, now)` covering the full eligibility matrix from `design.md` §5: `past_due` (nudge ✅ / reminder ❌), `cancel_at_period_end` (neither), `hasFutureCall` (reminder ❌), inactive rule (nothing), already-sent key (nothing).
- [ ] 4.5 Implement `lib/admin/notice-rules.ts` — pure, no DB, no clock, `now` injected. Reuse `getCurrentDayKey`/`getCurrentSeriesNumber` (`lib/content/access.ts`), `isInactive` + `INACTIVITY_THRESHOLD_DAYS` (`lib/admin/clients-helpers.ts`), `hasFutureCall` (`lib/content/booking-helpers.ts`) — do not reimplement any of them.

### 5. Server-only queries
- [ ] 5.1 `lib/admin/notice-queries.ts` (`import 'server-only'`, service-role — the cron has no session, `purge-messages` pattern).
- [ ] 5.2 `getAgendarCells()` — **one** query: every `(series_id, week_number, day_of_week)` with an `agendar` block, `published = true`.
- [ ] 5.3 `getNoticeCandidates()` — **one** query: clients whose subscription grants access, with `current_period_start`, `months_elapsed`, `cancel_at_period_end`, `status`, `program_variant_id`, `email`, `full_name`, `enrollment_date`, `last_activity_date` (max `progress_logs.log_date` — reuse the A5 join shape) and their future non-canceled bookings.
- [ ] 5.4 `getSentKeys()` / `claimNotice()` — insert into `automated_notices` **on conflict do nothing**, returning whether the row was actually inserted. The insert *is* the dedupe; no read-then-write race.
- [ ] 5.5 `getActiveTemplates()`.

### 6. Cron route
- [ ] 6.1 `app/api/cron/automated-messages/route.ts` — Bearer `CRON_SECRET` → 401 otherwise; `export const dynamic = "force-dynamic"`.
- [ ] 6.2 Orchestrate: 2 queries → `evaluateNotices` → per intent **claim the ledger row first**, and only on a successful claim insert `messages` (+ `sender_id` = Aura's admin profile) and `message_recipients`, then batch the emails.
- [ ] 6.3 `?dryRun=1` — report matches, write nothing, send nothing.
- [ ] 6.4 Per-run cap — abort loudly without sending if a run would exceed it.
- [ ] 6.5 Add the daily entry to `vercel.json` (after `purge-messages`; pick an hour that lands mid-morning in Mexico given the UTC schedule).
- [ ] 6.6 Verify the middleware `matcher` still excludes `api/cron` as an **inline literal**.

## PR 3 — Admin UI

### 7. Server actions
- [ ] 7.1 `lib/admin/automatedMessageActions.ts`: `updateAutomatedMessage` (subject/body) + `toggleAutomatedMessage`. `requireAdmin()`, zod, reuse `MESSAGE_SUBJECT_MAX`/`MESSAGE_BODY_MAX` + `sanitizePlainText`, `logAndGeneric` on raw Postgres errors, `revalidatePath`.

### 8. Screen
- [ ] 8.1 `app/admin/automated-messages/page.tsx` — Server Component behind `requireAdminPage()`, listing both rules.
- [ ] 8.2 Client form component: subject input + **plain textarea** (bodies are plain text — no Tiptap, no `sanitize-html`), activo/inactivo toggle, per-row save with inline error.
- [ ] 8.3 Show the available placeholders (`{nombre}`) under the textarea, plus help text telling Aura to place `agendar` runs in **week 1 and week 3** — *not* "day 1 and day 15", which is not a thing the editor can express.
- [ ] 8.4 Add the entry to the admin sidebar nav.

## Close-out

- [ ] 9.1 `npx tsc --noEmit` · `npm run lint` · `npm run test:run` · `npm run build` all green.
- [ ] 9.2 `code-review` subagent; `security-review` as well — this change adds a service-role cron that mails every client and a new admin write surface.
- [ ] 9.3 Smoke on the Preview URL with `DEV_DATE` to land on a window's first day; verify the reminder, then re-run and verify **nothing** is re-sent.
- [ ] 9.4 **Before enabling the schedule in production, invoke once with `?dryRun=1`** and confirm the match count is plausible — on first run every eligible client is a fresh key.
- [ ] 9.5 `/opsx:sync` + `openspec validate` → `/opsx:archive`; mark **A4** ✅ in `BACKLOG.md`; re-index codebase-memory (`fast`).

## Parallelization

Sequential: PR1 → PR2 → PR3. PR2's rule layer imports `serverToday()` and the `NoticeRule` union from PR1; PR3's admin screen reads the `automated_messages` table created in PR1.

Within PR1 — Sequential: 1 → 2 → 3. Tasks 1 and 2 both touch `lib/supabase/types.ts` / `lib/content/`, and task 3's batch-sender signature change is consumed by `messageActions.ts` in the same task. No independent tasks to parallelize.

Within PR2 — Sequential: 4 → 5 → 6 (queries consume the pure helpers; the route consumes both).

Within PR3 — Sequential: 7 → 8.
