## Why

Two moments in a client's month currently depend on Aura remembering to reach out by hand: when a booking window opens (she wants clients to actually use their biweekly 1:1 call) and when someone quietly stops logging progress (the point at which a subscriber is most likely to churn). Both signals already exist in the data — the `agendar` block placement from A6+A7 and the `last_activity_date` join from A5 — but nothing acts on them. This change turns those two signals into automated in-app messages + emails, with the copy editable by Aura and a kill switch she can reach without a deploy.

Now, because both dependencies just shipped: A5 landed the last-activity signal and A6+A7 landed both the booking ledger and the `agendar` block that defines a booking window.

## What Changes

- **New daily cron `/api/cron/automated-messages`** (Vercel Cron, Bearer `CRON_SECRET`, `purge-messages` pattern) evaluating two rules and sending an in-app message + email for each match.
- **Rule A — booking reminder.** Fires on the **first day of an `agendar` run**: the client's current content cell exposes an `agendar` block and the cell they were on yesterday did not. Cadence stays **content-driven** — Aura opens a window by placing the block, exactly as A6+A7 decided; there is no day-number math and no second source of truth for the schedule. Suppressed when the client already has a future call (`hasFutureCall`), when `cancel_at_period_end` is set, or when the subscription is `past_due`.
- **Rule B — inactivity nudge.** Fires when the client has no `progress_logs` for ≥10 days (`isInactive`, the A5 helper). Never-logged counts as inactive. Sent to `past_due` clients too.
- **New `automated_notices` ledger** (migration 014) providing dedupe via `unique (profile_id, rule, period_key)`. Dedupe MUST NOT be derived from message history — the `purge-messages` cron hard-deletes messages older than 180 days, so a history-based check silently starts re-sending.
- **New `automated_messages` table** (migration 014, 2 seeded rows) holding each rule's subject/body template plus an `is_active` flag, edited at a new **`/admin/automated-messages`** screen. Bodies are plain text with a small whitelist of placeholders (`{nombre}`). **No create/delete** — the row is only the copy, the trigger is code (see backlog **A13**).
- **Emails now include the message body.** `NewMessageEmail` gains the body, and `sendNewMessageEmailBatch` takes per-recipient `{email, subject, body}` tuples so `{nombre}` can be personalized while keeping Resend's 100-per-batch chunking. **This intentionally also changes Aura's manual messages**, which will now include their body in the notification email instead of subject-only.
- **Folds in D9:** the `DEV_DATE`-aware "today" expression, currently inlined in ~5 places, is extracted to a shared `serverToday()` helper and those call sites are refactored to use it.
- **Operational guardrails:** `?dryRun=1` returns what *would* send without sending; a per-run cap aborts loudly rather than fanning out if a rule evaluates true for an implausible share of clients.

## Capabilities

### New Capabilities
- `automated-messages`: the two automated rules — when each fires, what suppresses it, how repeat sends are prevented, and the delivery of an in-app message plus email for each.
- `admin-automated-messages`: how Aura edits each rule's copy and activates/deactivates it, including the placeholder contract and the absence of create/delete.

### Modified Capabilities
<!-- None. `portal-booking` and `admin-agendar-block` are read by the new rules but none of their
     requirements change: the `agendar` block still opens a window exactly as specified, and this
     change only observes it. The message-body email change alters delivery, not any spec'd requirement. -->

## Impact

- **New code:** `app/api/cron/automated-messages/route.ts` · `lib/admin/notice-rules.ts` (pure, TDD — first-of-run detection, both `period_key` schemes, `renderTemplate`) · `lib/admin/notice-queries.ts` (server-only scan + ledger writes) · `lib/admin/automatedMessageActions.ts` (edit/toggle server actions) · `app/admin/automated-messages/` + `components/admin/` form.
- **Modified code:** `lib/email/send.ts` + `lib/email/templates/NewMessageEmail.tsx` (body in email; per-recipient batch payload) · `lib/admin/messageActions.ts` (pass bodies to the batch sender) · `lib/content/access.ts` or a new `lib/content/server-today.ts` (D9 `serverToday()`) and its ~5 call sites (`lib/content/queries.ts` ×3, `lib/content/booking-queries.ts`, `app/admin/clients/page.tsx`) · `vercel.json` (second cron entry).
- **Migration 014:** `automated_notices` (ledger, RLS: no client access — service-role only) + `automated_messages` (templates, RLS: admin-only via `is_admin()`), seeded with both rules' initial copy. ⚠ The `rule` column carries a `CHECK` constraint mirroring a TypeScript union — any future rule must ship the migration in the same change.
- **Middleware:** `matcher` already excludes `api/cron` (inline literal) — no change needed, but must be re-verified.
- **Blast radius:** this is the first code path that emails every active client with no human action. Mitigated by `is_active`, `?dryRun=1`, the per-run cap, and inserting the ledger row *before* sending (a crash costs a missed message, never a duplicate).
- **Reused, unchanged:** `isInactive` + `last_activity_date` (A5), `hasFutureCall` (A6), `getCurrentDayKey`/`getCurrentSeriesNumber` (`lib/content/access.ts`), `messages`/`message_recipients` and the client inbox, `MESSAGE_SUBJECT_MAX`/`MESSAGE_BODY_MAX`, `sanitizePlainText`, `requireAdmin`, `logAndGeneric`.
- **No external dependency on Aura to build or ship.** She edits the copy after it lands; the seeded defaults are usable as-is.
