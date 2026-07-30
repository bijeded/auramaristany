# Backlog — Aura Maristany

Living list of pending work. **Each item has a stable ID** to launch it directly into the OpenSpec loop.

```
/opsx:propose "A2 — rest in minutes"     # when scope is already clear
/opsx:explore "A6 — booking system"      # when it still needs defining
```

**When closing an item:** `/opsx:archive` → mark it here as `✅ Done` → re-index codebase-memory in `fast` mode.

**Sources:** Aura's feedback (2026-07-18) + pending items from `handoff.md`/`SPEC.md`.
**Size:** `S` ≈ hours · `M` ≈ ~1 day · `L` ≈ several days.

---

## Index

| ID | Item | Size | Status |
|----|------|:----:|--------|
| **A2** | Rest in minutes | S | ✅ Done |
| **A3** | More visible exercise checkbox | S | ✅ Done |
| **A10** | Bars in "Ingresos por programa" | S | ✅ Done |
| **A11** | 5th stat card: expiring in 7 days | S | ✅ Done |
| **A1** | kg / lb selector | M | ✅ Done |
| **A5** | "Sin actividad" filter in Clients | M | ✅ Done |
| **A8** | Color and background in the text editor | M | ✅ Done |
| **A9** | Cancellation + exit survey | M | ✅ Done |
| **A12** | 7-day calendar in the portal | M | ✅ Done |
| **A6+A7** | Booking system (Calendly) + "Agendar" block | M | ✅ Done |
| **A4** | Automated messages | L | ✅ Done (rules ship **switched off** — see **L11**) |
| **A13** | Automated-message builder (own triggers) | L | Nice-to-have, does NOT block launch |
| **L1** | Stripe LIVE + real prices | M | Blocked (Aura's pricing) |
| **L2** | Level ladder + recurring billing (**3 changes**) | L | ✅ **Done** — L2a (PR #16, #17) · L2b (#18–#21) · **L2c (#23, #24)** |
| **L3** | Onboarding question set | S | Blocked (Aura defines them) |
| **L4** | E2E smoke test with Aura | S | Pending |
| **L5** | Real WhatsApp | S | Blocked (Aura's number) |
| **L6** | Demo data cleanup | S | Pending |
| **L7** | Minor demo fixes | S | Needs detailing |
| **L8** | production-checklist | M | At the end |
| **L9** | Admin UI for plans/prices? | L | Decision pending |
| **L10** | Preview env vars in Vercel | S | ✅ Done |
| **L11** | Turn the A4 automated rules on | S | Blocked (L6 + Aura's content) |
| **D1–D21** | Deferred / technical debt | — | See below |

---

## A · Aura's Requests

### A2 · Rest in minutes — `S`
Show `1 min` / `1:30 min` instead of `60 seg`. **Label only**; `rest_seconds` doesn't change.
- **Touches:** new pure helper (+ tests, AAA pattern) · exercise card in `/portal/today` · `components/portal/blocks/ExerciseListLogged.tsx` (read-only history) · review admin editor preview.
- **Watch out:** purely presentational — don't migrate data or touch the `exercise_list` JSON.

### A3 · More visible exercise checkbox — `S`
Make the "exercise done" control in `/portal/today` more noticeable.
- **Touches:** portal exercise card (prototype's `CheckRound` pattern: `rosa-deep` border → lavender fill + check).
- **Still to decide:** size / contrast / whether the whole card becomes tappable. Present 2–3 options before implementing.
- **Watch out:** respect ≥44px tap targets and the brand tokens.

### A10 · Bars in "Ingresos por programa" — `S`
Change the donut chart to bars on the dashboard.
- **Touches:** `components/admin/ProgramRevenueDonut.tsx` → bars (reuse the pattern from `components/admin/RevenueBarChart.tsx`).
- **Watch out:** the data doesn't change (`groupRevenueByProgram` in `lib/admin/finance-helpers.ts`). Apply the `dataviz` skill.

### A11 · 5th stat card: expiring in 7 days — `S`
KPI with subscriptions expiring in ≤7 days.
- **Decided:** a fifth card is **added**; it does NOT replace "Renuevan este mes" (≤30d).
- **Touches:** `lib/admin/finance-helpers.ts` (generalize `computeRenewalsThisMonth` to N days, pure + TDD) · `app/admin/dashboard/page.tsx`.
- **Watch out:** review the KPI row's responsive layout when going from 4 to 5 cards.

### A1 · kg / lb selector — `M`
The client chooses the weight unit; history must stay consistent.
- **Decided (recommendation):** always store **canonical in kg**; convert only when logging/displaying. Never store mixed units.
- **Touches:** exercise logging + `hooks/useProgressForm.ts` · `ExerciseListLogged` · `lib/content/history-helpers.ts` (`aggregateDayValue`/`buildPerformanceSeries` average weight) · `components/portal/PerformanceChart.tsx` (axis label) · user preference in `/portal/settings` (`lib/portal/settingsActions.ts`, `account-queries.ts`).
- **Watch out:** the JSON key is literally `weight_kg` and `metrics: ["reps_done","weight_kg"]` — decide whether to keep the name (recommended) and only convert at the view layer. Likely **migration 011** for the preference in `profiles`.

### A5 · "Sin actividad" filter in Clients — `M` — ✅ Done (PR #5, change `a5-clients-inactivity-filter`)
4th exclusive pill next to Activas/Vencidas/Canceladas: active/trialing clients with no `progress_logs` in ≥10 days (never-logged counts as inactive).
- **Shipped:** pure `isInactive(lastActivityDate, now, thresholdDays)` (UTC whole-day diff, server DEV_DATE-aware `now`) + reusable `last_activity_date` (max `progress_logs.log_date`) on `ClientListRow`. 🔗 **`last_activity_date` is the signal A4 reuses.** `trialing` added to `SubStatus`. Read-only, no migration.

### A8 · Color and background in the text editor — `M`
Text color and background for the Text block (Tiptap).
- **Touches:** MIT deps `@tiptap/extension-text-style` + `@tiptap/extension-color` + `@tiptap/extension-highlight` · text block editor in `components/admin/blocks/`.
- **⚠ Gotcha:** `lib/admin/sanitize-html.ts` **strips styles** unless the whitelist is extended (`allowedStyles` with `color` / `background-color`). Without this, the color is lost on save and looks like a "bug".
- **Still to decide:** palette limited to brand tokens (recommended) vs. free-form picker.

### A9 · Cancellation + exit survey — `M` — ✅ Done (PRs #6 backend + #7 UI, change `a9-cancellation-exit-survey`)
Cancel from the account + optional exit survey (survey-first, all optional). **end of the already-paid period, no refunds** (all 10 prices are monthly `recurring`).
- **Shipped:** migration 011 `cancellation_surveys` (dedicated table + RLS: owner insert-voluntary / select / delete-voluntary; blocks client-authored `pago_fallido`). `cancelSubscription`/`reactivateSubscription` server actions (getUser identity, zod ≤200 + `sanitizePlainText` on detail, Stripe `cancel_at_period_end`, optimistic mirror; reactivate deletes the latest voluntary row). `handleSubscriptionDeleted` logs `pago_fallido` on `payment_failed`/`payment_disputed`, **idempotent** (Stripe redelivers). UI: "Cancelar mi plan" red button at settings-page bottom (below lavender "Cerrar sesión") → survey-first modal (6 reasons + "Prefiero no decir", free-text detail for `encontre_otra_opcion`/`otro`); grace state "Tu plan termina el {fecha}" + Reactivar.
- **✅ Tested end-to-end 2026-07-29** (L2c task 7.6, closes **D10**): cancelar → gracia → Reactivar → cancelar sobre una suscripción real de Stripe en modo test. Demo subs still can't exercise it — their `sub_seed_*` IDs 404 — so any future re-check needs a real test-mode sub, not a demo client.
- **Stripe enum:** the real `cancellation_details.reason` value is `payment_failed` (not `payment_failure`); no `canceled_by_retention_policy` handling.

### A12 · 7-day calendar in the portal — `M` — ✅ Done (PR #4, archived `2026-07-23-a12-portal-week-calendar`)
`/portal/semana` ("Semana" tab): today (linked to Hoy) + next 7 days, titles only, cut at `current_period_end`; days 29–31 repeat week 4. Nav: 6 tabs — Hoy→`Sun`, "Configuración"→"Perfil" (`User`).
- **Note:** unpublished days render as "Descanso" — the `program_days` RLS policy (`published = true or is_admin()`) filters them; decided to keep RLS as the boundary (no service-role, no migration).

### A6+A7 · Booking system (Calendly) + "Agendar" block — `M` — ✅ Done (PRs #8 foundation + #9 webhook + #10 UI + #11 diagnostics; migrations 012–013; archived `2026-07-25-calendly-booking-agendar-block`; ADR 0001)
Verified live end-to-end in production: client books via Calendly embed → `invitee.created` webhook (sig-verified) → `bookings` ledger → the "agendar" block on Hoy flips to disabled "Tu llamada es el {fecha}". **Deploy done:** `NEXT_PUBLIC_CALENDLY_URL` + `CALENDLY_WEBHOOK_SIGNING_KEY` set in Vercel; Calendly webhook registered. **D11** (CSP for the external Calendly script) ✅ shipped in PR #12.
Biweekly Zoom/Meet calls, booked from the portal. **Merged A6+A7** — the "Agendar" block *is* the booking CTA (idea A). Explored 2026-07-24.
- **⚠ Deviation from the original plan:** TheBooking (WordPress) is **abandoned/unsupported** → switched to **Calendly** (free tier, embedded widget at `/portal/booking`). Because the embed lives on our **own same-origin route**, the **HMAC signed-link is dropped** — eligibility is re-derived server-side (`getUser()` + `subscriptionGrantsAccess`), the way every other portal gate works. No `BOOKING_SIGNING_SECRET`.
- **Decided design:**
  - **Cadence = content-driven.** Aura places the "agendar" block on program_days (e.g. a **3-day window** = the block on 3 consecutive days). No rolling-window math — the block only renders on its day (past/future days aren't navigable).
  - **Dedup = ledger.** `bookings` table fed by a Calendly **inbound webhook** (`invitee.created`/`invitee.canceled`, signature-verified, idempotent upsert — Stripe-webhook pattern). Rule: **one future non-canceled call at a time**. The block renders its state from the ledger → auto-disables ("Tu llamada es el {fecha}") on the other window days once booked. Cancel → eligible again.
  - **Identity mapping:** embed prefills `?email=` → webhook matches `profiles.email` → `user_id`. Caveat: invitee can edit the email (breaks mapping/dedup) — acceptable risk; consider passing `user_id` as a Calendly custom field/UTM.
- **Touches:** migration 012 (`bookings` + RLS: owner-select, webhook writes via service-role) · `/portal/booking` server gate + embed · new `block_type` in `content-validation.ts` + editor (`components/admin/blocks/`) + palette + `BlockView.tsx` render · `/api/webhooks/calendly` (middleware matcher must exclude it) · env `NEXT_PUBLIC_CALENDLY_URL` + `CALENDLY_WEBHOOK_SIGNING_KEY`.
- **External dependency (Aura):** Calendly account not needed to *build* (env placeholders + unit tests against the contract); needed at deploy for the event type (Zoom/Meet attached), webhook registration + signing key, and E2E smoke. Track like L1/L3.
- **Edge to state explicitly:** disable rule is "has a future call" — a call still in the future when the next window opens keeps the block disabled until it passes (one upcoming call at a time; rare at monthly cadence).

### A4 · Automated messages — `L` — ✅ Done (PRs #13 foundation + #14 rules/cron + #15 admin UI; migration 014; ADR 0002)
Two automated rules: **booking reminder** (first day of an `agendar` window) + **inactivity nudge** (10 days with no `progress_logs`). In-app message + email for both. Explored and shipped 2026-07-27; all decisions in the change's `design.md` and in ADR 0002.
- ⚠ **Both rules are `is_active = false` in production.** The code is live and the cron is armed (daily 15:00 UTC), but nothing sends until **L11**.
- **Decided:** the **billing reminder is NOT** implemented — Stripe sends it (Phase 4 decision).
- **Decided — cadence is content-driven, grid-relative.** The content grid is `(week_number, day_of_week)`, **not** day numbers: each client walks it from *their own* `current_period_start`, so "day 1" differs per client and Aura cannot target it. Rule: fire when the client's current cell has an `agendar` block and **yesterday's cell did not** (= first day of a run). Aura authors runs in **W1 and W3** for a biweekly rhythm.
- **Decided — dedupe via a dedicated `automated_notices` ledger**, never by querying `messages` (the `purge-messages` cron deletes >180d → history-based dedupe silently re-sends). `unique(profile_id, rule, period_key)`; booking key = `<period_start>:W<n>-<dow>` (also absorbs the week-4 clamp repeat on days 29–31), inactivity key = `<last_activity_date>` (streak-anchored).
- **Decided:** `past_due` gets the nudge but **not** the booking reminder; `cancel_at_period_end` gets neither; unpublished cells are filtered out.
- **Decided:** copy lives in an `automated_messages` table (2 seeded rows) editable at `/admin/automated-messages` with an `is_active` **kill switch** — no create/delete (see **A13**).
- **Side-effect (intentional):** `NewMessageEmail` now carries the message **body**, so Aura's **manual** messages include it too.
- **Folds in D9** (`serverToday()` DEV_DATE helper). Reuses the last-activity signal from **A5** and `hasFutureCall` from **A6**.

### A13 · Automated-message builder (own triggers) — `L` · nice-to-have, does NOT block launch
Let Aura **create** automated messages, not just edit the two shipped ones.
- **Why it's a separate change:** in A4 the DB row is only the *copy* — the **trigger is code** (`lib/admin/notice-rules.ts`). A newly created row would have no rule to fire it and would silently never send. Real create/delete requires Aura to author the **trigger** (window opens / N days inactive / N days before renewal / day N of the period) + a per-trigger dedupe strategy + preview & test-send.
- **Blast radius:** this hands Aura the ability to schedule mail to every client with no code review — needs its own guardrails.
- **Signal to build it:** wait until the two hardcoded A4 rules have run in production and Aura asks for a third. Her requests will show which triggers are actually worth offering.

---

## L · Before Opening to Real Clients

### L1 · Stripe LIVE + real prices — `M` · blocked
Create 10 Products/Prices in live mode (`scripts/seed-stripe.ts` in live mode) → update `stripe_price_id`/`price_mxn` in `program_variants` → flip keys to `sk_live`/`pk_live` in Vercel → register **live webhook** + new `STRIPE_WEBHOOK_SECRET`.
**Blocked:** Aura's prices (P1) are still missing.

### L2 · Level ladder + recurring billing — `L` · explored 2026-07-27, **3 changes**
Originally scoped as "flip `billing_model` for `cuarenta-mas-extra`". Exploration showed that is the *last* and smallest part. Proposals written in `openspec/changes/l2-*` (delta specs + tasks are generated per change when each is picked up).

**The domain rule (from Aura):** a client walks a ladder of levels within a program. Strong & Fit = 6 months Principiante → 6 Intermedio → Avanzado indefinitely. CuarentaMás Extra = 6 months Intermedio → Avanzado indefinitely. Each level has **its own** series numbered from 1, and content differs **per variant** (Principiante *Poco Tiempo* ≠ Principiante *Tiempo Suficiente*). Aura evaluates clients on the WordPress site and redirects them to the level they qualify for, so **entry at any rung** must work. At the top rung the client wraps to its first series. **CuarentaMás stops billing at month 6; Extra and Strong & Fit bill until the client cancels.**

| Change | Ships | Depends on |
|---|---|---|
| **L2a** `l2-per-variant-content-model` — **✅ Done 2026-07-28** (PR #16, #17; migration **015** applied) | `variant_series_map.ordinal` (position moved off `program_series`), dropped `unique(program_id, series_number)`, `program_variants.ladder_next_variant_id` seeded, variant-scoped admin authoring. **Destructive migration — all demo content reseeded** (60 series / 720 days) and the `progress_logs` on the removed days deleted. | — |
| **L2b** `l2-level-ladder-progression` — **✅ Done 2026-07-28** (PR #18, #19, #20 + hotfix #21; migration **016** applied) | Content pointer on the subscription + one advance rule, `invoice.paid` idempotency fix, top-rung loop, `Repitiendo Mes N`, `Avanzado · Mes 2`, admin content-runway signal. Full `design.md`. | L2a |
| **L2c** `l2-rolling-billing-extra` — **✅ Done 2026-07-29** (PR #23 + fix #24; migration **017** applied) | Extra → `rolling_monthly`, real fixed-term completion (schedule at the final invoice, `completed` at period end), `status` CHECK, prerequisite gate removed, **graduated portal tier**. ADR 0003. | L2b |

- **✅ L2b landed 2026-07-28.** The content address is now stored state (`content_variant_id`, `content_ordinal`, `content_loops`) that advances one step per newly recorded paid invoice, not a count derived from `months_elapsed`. `invoice.paid` is idempotent per invoice, which also closed a live defect where a Stripe redelivery double-incremented the month. Verified against **production** with a Stripe test clock: one paid month advances exactly one step, four redeliveries of the same event move nothing, Principiante 6 → Intermedio 1, and Avanzado 6 → Avanzado 1 with `content_loops = 1`. Screens confirmed in the browser.
  ⚠ **The smoke also caught a production outage the whole CI gate had missed** — see the `CLAUDE.md` review rule on second FKs and PostgREST embeds. Migration 016's `content_variant_id` made every `subscriptions(program_variants(...))` embed ambiguous; PostgREST returned an *error*, readers checked only `!data`, and the portal silently served a rest day to everyone between PR #19 and hotfix #21. Nothing in `tsc`, lint, 533 tests or the build talks to the database.
- **✅ L2a landed 2026-07-28.** Aura can now author a "Mes 1" per **variant**, so the real curriculum is unblocked (the old `unique(program_id, series_number)` made a second level's "Mes 1" impossible). Verified on a Preview against the live DB: two variants of one program each hold their own Mes 7, and a duplicate within one variant is refused by name.
  - **Lesson worth keeping — `z.string().uuid()` rejects this project's ids.** The catalog ids are seeded by hand (`00000000-0000-0000-0002-000000000010`) and carry no RFC 4122 version/variant nibbles, so zod refused *every real id* and silently broke create/update/delete. Use the `uuidLike` regex in `lib/admin/seriesActions.ts`, never `.uuid()`. The 484-test suite missed it because its fixtures were canonical v4 uuids — **more** conformant than production data.
  - **Lesson worth keeping — an `!inner` join can be a load-bearing RLS gate.** Removing `program_series!inner` from the readers silently removed the publication gate (RLS hid unpublished series, so PostgREST dropped the row). Client readers now filter `program_series.published` explicitly. Never rely on a join's RLS side effect to enforce a rule.
- **✅ L2c landed 2026-07-29.** Both live defects are closed: a fixed-term subscription now stops billing at its defined end, and `completed` is writable and reachable. **Verified against production with a Stripe test clock**: the invoice reaching month 6 of 6 schedules the Stripe cancellation at period end and stamps `completed_at` while leaving `status = active` (so her paid month still serves content); two redeliveries of that invoice moved nothing; at period end the status became `completed`, **no month-7 invoice was raised**, and no cancellation-survey row was written. Portal screens verified in the browser.
  - **The design was amended mid-implementation.** Decision 1 originally wrote `status = completed` at the *start* of the final month — which is exactly the status that withdraws content, so it would have taken the month she had just paid for. Completion is now *scheduled* then (`completed_at` + Stripe `cancel_at_period_end`) and *takes effect* at period end via `customer.subscription.deleted`. See `design.md` "Amended" paragraphs and **ADR 0003**.
  - **Lesson worth keeping — a lifecycle state spread across three columns needs exactly one derivation.** "Is this subscription ending?" lives in `status`, `completed_at` and `cancel_at_period_end`. Three readers each derived it from a different subset and each was wrong about a different case; four review rounds kept finding the same shape of bug in a new place, and a fifth instance (the admin list) survived to production and was caught by a screenshot. It is now one exported helper, `isCompletionScheduled`, plus `nextChargeCell` for the admin cell. **`completed_at` alone proves nothing** — L2b wrote it without cancelling anything in Stripe.
  - **Lesson worth keeping — splitting a change along a seam its two halves straddle.** L2c was planned as two PRs (portal tier / billing). Each half told the truth only if the other had shipped: the tier alone would have told a month-6 client "no further charge" and then charged her. They were merged into one PR.
  - **Lesson worth keeping — put the outward call before the idempotency gate.** The smoke's first `invoice.paid` failed (a test-clock restriction, 429). Because the Stripe cancellation is attempted *before* the invoice is recorded, nothing was written and a resend completed the whole operation. In the reverse order the retry would have found the invoice already recorded, returned without scheduling the cancellation, and charged month 7 silently forever.
- **Decided:** prerequisites move to the funnel (Aura's WordPress evaluation is the real gate) · rung order is declared via `ladder_next_variant_id`, not inferred from `level` · position is stored state, never derived from a count (a growing Avanzado catalog would otherwise retroactively reshuffle looping clients) · a `completed` client keeps account + payment history + progress history/photos + a continue-with-Extra CTA, but no training content.
- **Follow-on (not scoped):** notify the client when she crosses a rung. Fits A4's `automated_messages` exactly, and is the "third rule" signal **A13** was waiting for.

### L3 · Onboarding question set — `S` · blocked
Aura loads her real questions from `/admin/onboarding-settings`. Currently there are 3 test seed questions left (migration 002).

### L4 · E2E smoke test with Aura — `S`
Admin/demo client login + real registration → email confirmation → onboarding → test checkout (`4242 4242 4242 4242`) → webhook creates sub → portal.

### L5 · Real WhatsApp — `S` · blocked
Replace `NEXT_PUBLIC_AURA_WHATSAPP` (currently `525512620404`, a test number) with the real number.

### L6 · Demo data cleanup — `S`
Delete only client data (profiles/subs/invoices/photos), keeping admin and the catalog. Base: `scripts/seed-demo.ts` (already additive and secret-free).

### L7 · Minor demo fixes — `S` · needs detailing
UI tweaks found during browser verification; never itemized. **First step: list them out.**

### L8 · production-checklist — `M`
Run the `production-checklist` skill before opening to real clients (includes the `npm audit` vulnerability gate).
- **Carried over from D11:** tighten the baseline CSP to a **nonce-based** `script-src`/`style-src` (today both keep `'unsafe-inline'`).

### L9 · Admin UI for plans/prices? — `L` · decision pending
Decide whether to build a UI to manage variants/prices or keep the script + SQL approach.

### L10 · Preview env vars in Vercel — `S`
Set the 11 vars for Preview (the CLI prompts for a branch interactively; do this when creating the 1st dev branch).

### L11 · Turn the A4 automated rules on — `S` · blocked
A4 shipped with both rules `is_active = false`. Enabling them is a deliberate, one-at-a-time step, **not** a leftover chore — each one starts mailing every matching client the next morning.
- **`inactivity_nudge`** — blocked on **L6**. A dry run on 2026-07-27 matched **17 of 18** demo clients, and every demo address is `@test.aura.mx`, a domain that does not resolve. Enabling before the cleanup means ~17 hard bounces in one batch from the freshly-verified sender.
- **`booking_reminder`** — blocked on Aura placing `agendar` runs in **W1 and W3**. With no runs in the grid it simply never fires, so this one is safe but pointless until she does.
- **How:** re-run `GET /api/cron/automated-messages?dryRun=1` with the `CRON_SECRET` bearer token first and read the counts, then
  `update automated_messages set is_active = true where rule = '<rule>';` (or the Activar button in `/admin/automated-messages`).
- **Carries A4's task 9.3**, the one smoke that could not run pre-launch: the send path is unit-tested and dry-run-verified but has never delivered a real message. On the first enabled rule, confirm a client receives the in-app message **and** the email, then re-run the cron the next day and confirm **nothing** is re-sent (the `automated_notices` dedupe).

---

## D · Deferred / Technical Debt

| ID | Item | Size | Note |
|----|------|:----:|------|
| **D1** | Admin notes on the day's log | M | Deferred from Phase 3. |
| **D2** | `saveBlocks`/`savePillarBlocks` transactionality | M | Non-atomic save → possible partial state. Logged as out of scope for C+D. **Same family as D13.** |
| **D13** | `updateSeries` mapping reconciliation is not atomic | M | From L2a. `variant_series_map` is reconciled by delete-then-insert; on failure the previous rows are read beforehand and re-inserted, but that compensation is best-effort — if the *restore* fails, or the process dies between the delete and the insert, the series is left mapped to **zero** variants: it has no position in any curriculum, renders nowhere in the editor, and cannot be recovered from the UI. Real fix is one Postgres RPC doing delete+insert in a single transaction (would also close **D2**). Second-best: surface unmapped series in the editor so they can be re-mapped or deleted. **Second path, same root cause:** metadata (`title`/`description`/`published`) is written *after* the mapping succeeds — deliberately, so a position conflict doesn't leave the title saved under an error that says nothing was — but that means the reverse failure (mapping written, metadata update fails) leaves the month moved with stale title/`published`, again under a generic error. One transaction closes both. |
| **D16** | `invoice.paid` records the invoice and advances the pointer in two statements | M | From L2b PR2 (security review). The idempotency gate is "was this invoice newly recorded", so the invoice row is written *first* and the `subscriptions` update follows. A crash between them permanently loses that month's advance: the redelivery finds the invoice already recorded and returns without advancing. **Not a regression** — it is the price of the gate, and the ordering is deliberate: the reverse order would risk a *double* advance, which silently skips a month of workouts and is indistinguishable from normal progress afterwards, whereas a lost advance is inspectable state a human can correct. Real fix is one Postgres RPC doing both writes in a single transaction — **same root cause as D2 and D13**, so all three should be closed together rather than growing a fourth hand-rolled compensation. |
| **D3** | Zapier on-subscribe | M | Deferred from Phase 4. |
| **D4** | 250-photo cap not race-safe | S | Acceptable for single-user. |
| **D5** | `getSentMessages` loads all `message_recipients` | S | Scaling concern; fine for now. |
| **D6** | Typo in `.env.example` | S | `noreply@auramristany.com` → `no-reply@auramaristany.com`. |
| **D7** | Verify CI + gitleaks on the 1st PR | S | ✅ Done — exercised on PR #1 (2026-07-22). |
| **D8** | Visually review `trialing` "Prueba" badge | S | From A5. Badge added but unverified — no trialing sub in demo data. Check when one exists. |
| **D9** | Extract shared `serverToday()` DEV_DATE helper | S | ✅ Done (folded into **A4** PR1). Was inlined in **8** places, not the ~5 estimated (`lib/content/queries.ts` ×3, `lib/content/booking-queries.ts`, `app/admin/clients/page.tsx`, `app/portal/{messages,messages/[id],settings,pilares}/page.tsx`) → `lib/content/server-today.ts`. Also hardens against an empty/malformed `DEV_DATE` (previously propagated `Invalid Date`). |
| **D12** | `todayLabel()` duplicated in 3 portal pages | S | Found during the D9 refactor (A4 PR1), left alone per the scope rule. Byte-identical in `app/portal/messages/page.tsx`, `app/portal/messages/[id]/page.tsx`, `app/portal/settings/page.tsx` (`/pilares` builds the same label inline via `weekdayLabel`). Extract to a shared portal helper next time one of them is touched. |
| ~~**D10**~~ | ~~Verify A9 cancellation end-to-end after demo refresh~~ | — | ✅ **Done 2026-07-29** (L2c task 7.6). Closed the way the row always said it had to be: with a **real** Stripe test-mode subscription (month 2 of 6) on a portal-loggable account, since demo subs carry fabricated `sub_seed_*` IDs and 404 — which is why this deferred four times. Full round trip cancelar → gracia → Reactivar → cancelar verified in the UI and against the DB: the grace window shows the end date and "Reactivar mi plan", withdraws "Cancelar mi plan", and keeps content access; `status` stayed `active` throughout and `completed_at` stayed null, so grace and completion never collide; one survey row at rest, proving Reactivar deletes the prior one. Test objects cleaned up. |
| **D14** | `requireAdminPage()` missing on 5 admin pages | S | From L2a security review. Defense-in-depth only — **not exploitable**: `getRedirectPath` sends no-session and `role === 'client'` away from `/admin`, and the matcher covers it. But `app/admin/content/page.tsx` and the four `content/[programId]/series/**` pages rely on middleware alone, unlike the other seven admin pages. The systematic fix is a guard in `app/admin/layout.tsx` so it can't be forgotten per page — blocked on that layout being `"use client"` (it uses `usePathname`), so it needs splitting into a server wrapper + client nav. |
| **D15** | 4 main specs fail `openspec validate --specs --strict` | S | Found while archiving **L2a**. `admin-dashboard-kpis`, `admin-richtext-color`, `portal-exercise-display` and `portal-performance-display` have no `## Purpose` section, which the strict validator requires — they jump straight from the `#` title to `## Requirements`. Pre-existing (they predate L2a; `admin-dashboard-kpis` last touched in `8c6ff1f`), harmless at runtime, but every `--specs --strict` run reports `9 passed, 4 failed`, so a real regression in a spec would be easy to miss in the noise. Fix is one `## Purpose` paragraph each — cheap, and worth doing before **L8 production-checklist** so that gate starts from green. Note the archive command seeds `TBD - update Purpose after archive`; write a real one rather than leaving the placeholder. |
| ~~**D17**~~ | ~~Dashboard projects phantom renewal revenue~~ | — | ✅ **Done 2026-07-29** (PRs #32 + #34, ADR 0004). The phantom revenue was the visible half; the missing half mattered more. **Nothing in the product told Aura a client was about to end** — the A4 cron deliberately stays silent on the grace cohort and a completing client filed under "Activas" — so the dashboard was the only surface that could carry the fact, and it was carrying it as revenue. Fixed by reusing `deriveCancellationState` rather than extracting a new predicate: it already produces the right buckets *in the right precedence order* (the flag must be read after completion, since a graduating client carries it too), so the dashboard became its fourth **caller**, not a fourth copy. `partitionByOutcome` is one pass with a fourth `excluded` bucket, so the four sum to the input unconditionally and widening the query can never drop rows silently. **MRR excludes ending subscriptions; the headcount includes them** — an ending client still has portal access and is still training — and the two figures are now *specified* to disagree (ADR 0004). Three cards replaced two: `Renuevan / Terminan / Cancelaciones (próx. 7 días)`, one 7-day horizon, each label saying so. **The old label was the actual defect** — "Renuevan este mes" described a rolling 30-day window as a calendar month; a calendar month was designed and abandoned because `invoice.paid` pushes `current_period_end` forward and ending rows leave the `active` set, so the past half of any month is empty by construction. Also shipped: `completed_at` on `ClientListRow` plus `Último mes` / `En cancelación` pills (deliberately *not* named like `Completadas`/`Canceladas`, which mean already-gone), and the `?status=` URL contract the cards' links needed — `/admin/clients` read no `searchParams` at all, so the links would have been dead ends. |
| **D19** | The exit survey cannot tell "Otro" from "prefiero no decir" | XS | Found in the D10 walkthrough (2026-07-29). The modal models "Prefiero no decir" as `reason = null`, and `lib/portal/settingsActions.ts` inserts `reason ?? "otro"` — so declining to answer is stored as the same value as an explicit "Otro" pick. Pre-existing A9 behaviour, untouched by L2c, and harmless to the cancellation flow itself. But it blunts the one report Aura would read to learn *why* clients leave: "Otro" (which may carry free-text `detail`) and "no quiso decir" are different signals. Fix is a distinct value (e.g. `prefiero_no_decir`) in the `CancellationReason` union **plus the matching `CHECK` migration in the same change** — see the enum/CHECK rule in `CLAUDE.md`. |
| ~~**D18**~~ | ~~`subscriptionGrantsPortalShell` is exported and tested but never called~~ | — | ✅ **Done 2026-07-29** (PRs #27 + #28). The sweep found **four** test-only exports, of three species, and only two were deletions. `subscriptionGrantsPortalShell` was redundant *by construction* — the three shell readers push `PORTAL_SHELL_STATES` into SQL, so every row reaching memory is already a shell row and the predicate answered `true` unconditionally; removed, with the spec requirement reworded to name what actually enforces the boundary. `isDayAccessible` (plus `DAY_ORDER`, which only served it) was orphaned by the superseded "Día X de 180" model; removed. **`reindexOrder` was not dead but bypassed** — `reorderQuestions` re-implemented it inline, so the tested rule was not the one that ran, and the inline loop could leave the questionnaire half-renumbered; it now computes the positions and migration 018 applies them in one write that rolls back if it doesn't touch a row per pair. `cancellationReasonLabel` was kept deliberately and documented — not dead, early. |
| **D20** | `onboarding_questions_admin_write` has no `with check` | XS | From D18's security review. The policy is `for all using (is_admin())` with no `with check`, contrary to the RLS rule in `CLAUDE.md`. Pre-existing and functionally equivalent for `update` (Postgres falls back to `using`), but D18 made that policy the sole guard for a new callable entry point (`reorder_onboarding_questions`), so it is worth making explicit. New migration — **never edit 001**. |
| **D21** | Should a CI check catch unused `lib/` exports? | S | Open question from D18, deliberately not answered there. Four instances across the whole project is not yet evidence of a systemic leak, and such a rule would immediately fire on `cancellationReasonLabel` — which is kept on purpose — so it needs an opt-out annotation, which is its own small design. Revisit if a later sweep finds more. The sweep itself is a one-liner recorded in D18's PRs. |
| **D22** | `paused`/`incomplete` have no client-list pill | XS | From the D17 review. The three statuses the DB accepts beyond the six the UI modelled (`paused`, `incomplete`, `incomplete_expired`) match no filter pill, so such a client is visible only with no status filter applied. Coherent with the existing pills today (each maps to one explicit status) and nothing mis-buckets them — verified: `filterClients` uses positive `!==` guards and the cohort branch gates on `status === "active"` first. Worth a `Pausada` pill only if Aura starts pausing subscriptions routinely. |
| **D23** | Three raw `#9a7b1f` copies remain | XS | The D17 review found that amber hand-written in **five** files. `--ambar`/`--ambar-tint` now exist in `globals.css` and the two copies belonging to the D17 series were converted; three pre-existing ones remain in `lib/admin/payment-status.ts`, `components/portal/settings/SubscriptionCard.tsx` and `components/admin/ClientDetailTabs.tsx`. Same shape as the `--exito` finding: **the token system was missing the token**, not the callers being careless. |
| **D24** | Client-list filter is write-only after the first render | S | From the D17 review, deliberately deferred. `initialStatus` seeds `useState`, so `?status=` is read **once**: a soft navigation between two `?status=` URLs that keeps `ClientsTable` mounted ignores the new value, and clicking a pill leaves the URL stale — so the filter is not linkable or shareable in either direction. The fix is to drive `estado` from `useSearchParams` + `router.replace`, which changes the behaviour of the **four pre-existing pills** too, not just the two D17 added — which is exactly why it is its own change with its own scope rather than a widening of PR #34. |
| **D25** | Filter pills carry no `aria-pressed` | XS | From the #32 review. Each pill is a plain `<button>` whose active state is conveyed by a CSS class only, so a screen reader gets no signal about which filter is on. Pre-existing across the whole group (programs + status), not introduced by D17, and left alone under the scope rule. One attribute: `aria-pressed={estado === f}`. |
| **D26** | `CANCELABLE_STATUSES` duplicates `ELIGIBLE_STATUSES` | XS | Noticed while tracing D17. `lib/portal/settingsActions.ts` declares its own `["active","trialing","past_due"]` alongside the identical list in `lib/portal/cancellation.ts` — a **genuine** duplication, answering the same question ("may she cancel?"). Note this is *unlike* `ACCESS_STATES` and `BILLING_STATUSES`, which answer **different** questions ("may she see content?", "will Stripe charge her again?") with a coincidentally identical list today — those must NOT be merged. |
| **D11** | CSP for external scripts (Calendly `widget.js`) | S | ✅ Done (PR #12, `b915e1e`). Baseline CSP + hardening headers in `next.config.mjs` `headers()`: whitelists the app's external origins (Calendly, Google Fonts, YouTube, Supabase Storage, Stripe), blocks the rest, `frame-ancestors 'none'`. **Residual:** `script-src`/`style-src` keep `'unsafe-inline'` (App Router inline hydration + inline style props) → **nonce-based CSP deferred to L8**. |

---

## Suggested Sequence

1. **Quick batch:** `A2` · `A3` · `A10` · `A11` — low risk, highly visible, first to exercise the CI gate.
2. **Mediums:** `A1` · `A5` · `A8` · `A9` · `A12` (`A5` before `A4`).
3. **Projects:** `A6+A7` (Calendly booking) → `A4`.
4. **In parallel (depends on Aura):** `L1` pricing · `L5` WhatsApp · `L3` onboarding questions.
5. **`L2` ✅ complete** — L2a and L2b done 2026-07-28, L2c 2026-07-29.
6. **Launch close-out:** `L4` · `L6` · `L7` → `L8` production-checklist. (`L10` ✅ done.)
