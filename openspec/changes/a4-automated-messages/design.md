## Context

Two automated outreach rules on top of signals that already exist. The hard parts are not the sending — `messages`/`message_recipients` + Resend are already wired — but (1) expressing "when a booking window opens" in the vocabulary the content model actually speaks, and (2) preventing repeat sends in a way that survives the existing retention cron.

Explored 2026-07-27. Every decision below was taken deliberately; the alternatives are recorded because several are the obvious-but-wrong choice.

## Goals / Non-Goals

**Goals**
- Remind a client to book exactly once per booking window, on the first day that window is open *for them*.
- Nudge a client who has gone quiet, once per quiet spell.
- Let Aura edit both messages and switch either off without a deploy.
- Keep the entire decision layer pure and unit-tested; keep the cron dumb.

**Non-Goals**
- Aura authoring her own triggers (backlog **A13** — the trigger is code, not data).
- A billing/renewal reminder — Stripe sends it (Phase 4 decision, unchanged).
- Retrying failed sends. Email is best-effort, as everywhere else in the app.
- Per-client scheduling preferences or quiet hours.

## Decision 1 — The booking rule is grid-relative, not day-numbered

**The framing "send on day 1 and day 15" cannot be implemented, because Aura cannot place a block on "day 1".**

The content model is not a 1–28 sequence. `program_days` is `unique(series_id, week_number, day_of_week)`, and `getCurrentDayKey(current_period_start, today)` resolves a client's current cell as:

```
week_number = min(floor(daysElapsed / 7) + 1, 4)   ← relative to THEIR period start
day_of_week = today's calendar weekday             ← absolute
```

Aura authors **one** grid per series; every client walks it from their own `current_period_start`, which is whatever weekday they subscribed on. The same cell is a different "day N" for each client:

```
Aura places "agendar" on cells:  (W1, mié) (W1, jue) (W1, vie)

Ana — period starts Wednesday          Bea — period starts Sunday
  day 1 = W1 mié  ← agendar ✓            day 1 = W1 dom
  day 2 = W1 jue  ← agendar              day 2 = W1 lun
  day 3 = W1 vie  ← agendar              day 3 = W1 mar
  day 4 = W1 sáb                         day 4 = W1 mié  ← agendar ✓
                                         day 5 = W1 jue  ← agendar
                                         day 6 = W1 vie  ← agendar
```

Same three cells; Ana is reminded on her day 1, Bea on her day 4. Both are correct — each is reminded on the first day *their* window is open.

**Rule:** fire when the client's current cell exposes an `agendar` block **and** the cell they occupied yesterday did not. "Yesterday's cell" is `getCurrentDayKey(period_start, today − 1 day)` — well-defined per client, and it detects the start of a run regardless of how the run straddles a week boundary in that client's traversal.

**Guidance for Aura (goes in the admin screen's help text):** place `agendar` runs in **week 1 and week 3** for a biweekly rhythm. Not "day 1 and day 15" — that vocabulary does not exist in the editor.

**Alternatives rejected**
- *Fixed day 14/28 from `current_period_start`.* Simplest, but creates a second source of truth for cadence. Aura moves the block to W2 and the email keeps pointing at a closed window, silently, forever.
- *Fixed day, gated on a nearby window.* Half-measure: still drifts, and fails silently in the other direction (skips the reminder entirely when placement is off-grid).

## Decision 2 — Dedupe is a dedicated ledger, never message history

`/api/cron/purge-messages` hard-deletes `messages` older than `RETENTION_DAYS = 180`. Any "have I already sent this?" implemented as a query over `messages` is correct for 180 days and then silently starts re-sending. A dedicated table is not gold-plating — it is required by an existing cron.

```sql
automated_notices
  id          uuid pk
  profile_id  uuid → profiles(id) on delete cascade
  rule        text check (rule in ('booking_reminder','inactivity_nudge'))
  period_key  text not null
  sent_at     timestamptz default now()
  unique (profile_id, rule, period_key)   ← the entire mechanism
```

The unique constraint *is* the dedupe: insert with on-conflict-do-nothing and send only for rows that actually inserted. No read-then-write race.

⚠ `rule`'s `CHECK` constraint mirrors a TypeScript union. Per the project review rule (learned from the `agendar` block), adding a rule value in code without migrating the constraint fails the insert. They ship together.

### `period_key` per rule

| Rule | `period_key` | Example |
|---|---|---|
| `booking_reminder` | `<period_start>:W<n>-<dow>` — the **first cell of the run** | `2026-07-01:W1-miercoles` |
| `inactivity_nudge` | `<last_activity_date>`, or `never:<enrollment_date>` when null | `2026-07-05` |

**Why the first cell for Rule A.** It distinguishes the W1 run from the W3 run within one period (two keys → two reminders, correct), and it absorbs an edge that a period-only key would miss: `week_number` is **clamped to 4**, so on a 30-day period days 29–30 re-resolve to W4 cells the client already visited (the A12 "days 29–31 repeat week 4" behavior). A run placed in W4 would otherwise fire twice. Keyed on the cell, the second pass collides with the existing row and sends nothing.

**Why streak-anchored for Rule B.** The inactivity condition has no period — a client inactive for 40 days satisfies it on 31 consecutive days. Anchoring the key to `last_activity_date` means one nudge per *distinct* quiet spell: the client logs progress → `last_activity_date` moves → new key → eligible again if they lapse a second time. It is purely derivable, append-only (history is preserved, unlike a mutated cooldown row), testable without a clock, and it explains itself from the data when someone asks "why did she get two?".

*Rejected:* a `last_sent_at` cooldown. Mutates a row, loses history, and swallows the legitimate second nudge for a lapsed→returned→lapsed client.

## Decision 3 — Two queries, regardless of client count

Content-driven does not mean per-client day resolution. The set of cells carrying an `agendar` block is tiny and shared:

```
Q1  every (series_id, week_number, day_of_week) with an agendar block,
    published = true                                      ← a handful of rows
Q2  active/trialing/past_due clients + current_period_start + months_elapsed
    + program_variant_id + last_activity_date + future-booking flag
         │
         ▼
   evaluateNotices(clients, agendarCells, sentKeys, templates, now)   ← PURE
         │   per client: getCurrentSeriesNumber(months_elapsed) → series,
         │   getCurrentDayKey(today) and (today − 1d), Set membership
         ▼
   intents[]  →  insert automated_notices (on conflict do nothing)
              →  for rows that inserted: messages + recipients + email
```

Two queries total. The entire rule surface is `getCurrentDayKey` called twice plus a `Set` lookup — no clock, no DB, unit-testable in the AAA style. The route handler stays thin: auth, orchestrate, report.

`published = true` is filtered in Q1 so a reminder can never announce a window the client cannot see (`getTodayContent` applies the same filter).

## Decision 4 — Insert the ledger row before sending

If we send first and crash before recording, the next run re-sends. Insert-first means a crash costs a missed message, never a duplicate. For an automated nudge that trade is clearly right, and the unique constraint gives us the transaction boundary the app otherwise lacks.

## Decision 5 — Eligibility edges

| Condition | `booking_reminder` | `inactivity_nudge` |
|---|:---:|:---:|
| `active` / `trialing` | ✅ | ✅ |
| `past_due` | ❌ | ✅ |
| `cancel_at_period_end = true` | ❌ | ❌ |
| already has a future call | ❌ | n/a |
| current cell unpublished | ❌ | n/a |
| rule `is_active = false` | ❌ | ❌ |

`past_due` clients retain portal access (`subscriptionGrantsAccess`), so the nudge is still appropriate — but asking someone to book a call while their card is failing is bad timing, and Stripe is already emailing them about the payment. Clients who have chosen to cancel get neither; the grace period is not a re-engagement opportunity.

## Decision 6 — Editable copy, no create/delete

`automated_messages` holds two seeded rows: `rule` (PK-ish, `CHECK`-constrained), `subject`, `body`, `is_active`. Edited at `/admin/automated-messages` — a textarea per rule plus a toggle, mirroring `/admin/onboarding-settings`. Not CRUD: the two rows are fixed.

**Plain text, not rich text.** `app/portal/messages/[id]/page.tsx` renders `{msg.body}` with `whiteSpace: "pre-line"` — message bodies have never been HTML. A textarea is the correct control; no Tiptap, no `sanitize-html`. Validation reuses `MESSAGE_SUBJECT_MAX`/`MESSAGE_BODY_MAX` + `sanitizePlainText`, behind `requireAdmin()`.

**The `is_active` toggle matters more than the copy editing.** This is the first path that mails every client with no human action. A kill switch Aura can reach without a deploy is the primary risk control; being able to reword the message is a bonus.

**Placeholders** are a whitelist rendered by a pure `renderTemplate(body, vars)`. `{nombre}` to start. Unknown placeholders are left literal — a cron must never throw because someone typed `{nombre2}`. Available placeholders are listed under the textarea.

**Why not create/delete** (→ **A13**): the row is only the copy; the trigger lives in `notice-rules.ts`. A created row would have no rule to fire it and would silently never send — a UI promising something the system cannot do. Delete is worse than useless: the cron looks its rules up by key, so deleting a row makes a lookup return nothing, which is exactly what `is_active` already does safely and reversibly. Real create/delete requires Aura to author *triggers*, which is a rule engine plus per-trigger dedupe plus test-send — a separate, larger change.

## Decision 7 — The email carries the body

Today `sendNewMessageEmail({ to, subject })` sends subject-only; the batch path renders the HTML **once** and reuses it for up to 100 recipients.

Including the body with `{nombre}` personalization means per-recipient HTML — but `resend.batch.send` already accepts a per-object `html`, so batching survives unchanged; we simply render N times (negligible at this client count) and keep the 100-item chunking.

- The body is escaped automatically as `{body}` inside a React Email `<Text>`. It must **never** be passed through `dangerouslySetInnerHTML`.
- The `<Text>` needs `whiteSpace: "pre-line"` to match the portal, or Aura's paragraph breaks collapse.
- Full body, and the "Ver mensaje" CTA stays — there is nothing left to click through for, but the CTA pulls people back into the app, which is the point of the inactivity nudge in particular.

**Intentional side-effect:** `NewMessageEmail` is shared with Aura's manual messages, which will now include their body too. Accepted deliberately rather than forked into a near-duplicate template — the inconsistency ("why does the automated one show the text and mine doesn't?") would be the worse outcome.

## Decision 8 — D9 folded in

`now = DEV_DATE ? new Date(\`${DEV_DATE}T12:00:00\`) : new Date()` is inlined in ~5 places (`lib/content/queries.ts` ×3, `lib/content/booking-queries.ts`, `app/admin/clients/page.tsx`). A cron whose entire behavior is date-driven is the natural moment to extract `serverToday()` and refactor the call sites — D9's "promote to a rule if it recurs" condition is met, and it removes a whole class of bug from the code most sensitive to it.

All day arithmetic is whole-day **UTC** (the `getUTCDay`/EDGE-3 convention, already followed by `getCurrentDayKey` and `isInactive`). Vercel Cron runs in UTC; `log_date` is a `date` while `current_period_start`/`scheduled_at` are `timestamptz`. One convention, no second one invented here.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| A date-math bug fans out to every client | `?dryRun=1`; per-run cap that aborts loudly; `is_active` kill switch; pure rule layer with dense unit tests |
| Cron misses a day (Vercel outage) | Rule A's window is ≥1 day and the ledger is keyed on the *run*, not the date — a late run still sends once, on a day the window is likely still open. Rule B's condition persists. Accepted: no catch-up logic |
| Two automated emails/month + manual broadcasts + Stripe mail → sender fatigue | Both rules individually switchable; volume is visible to Aura in `/admin/messages` |
| Aura places `agendar` runs in a way that produces >2 reminders/period | By design — the reminder follows the content. Documented in the admin help text |
| Client edits their email in Calendly, breaking the booking mapping | Pre-existing A6 residual, unchanged here: the reminder still sends, it just isn't suppressed by a booking we failed to attribute |

## Migration Plan

Migration 014, applied once, additive, no backfill: `automated_notices` (empty) + `automated_messages` (2 seeded rows). On first run every eligible client is a fresh key, so the first cron execution may send to a batch of clients at once — **run it with `?dryRun=1` first in production** and confirm the count is plausible before the schedule goes live.

## Open Questions

None blocking. Copy is drafted by us and edited by Aura after it lands.
