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
| **L2** | Level ladder + recurring billing (**3 changes**) | L | **L2a ✅ Done** (PR #16, #17) · **L2b ✅ Done** (PR #18, #19, #20, #21) · L2c next |
| **L3** | Onboarding question set | S | Blocked (Aura defines them) |
| **L4** | E2E smoke test with Aura | S | Pending |
| **L5** | Real WhatsApp | S | Blocked (Aura's number) |
| **L6** | Demo data cleanup | S | Pending |
| **L7** | Minor demo fixes | S | Needs detailing |
| **L8** | production-checklist | M | At the end |
| **L9** | Admin UI for plans/prices? | L | Decision pending |
| **L10** | Preview env vars in Vercel | S | ✅ Done |
| **L11** | Turn the A4 automated rules on | S | Blocked (L6 + Aura's content) |
| **D1–D10** | Deferred / technical debt | — | See below |

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
- **⚠ Not yet tested end-to-end (see D10):** demo subs have fabricated `sub_seed_*` Stripe IDs → cancel 404s ("No se pudo guardar"). Verify after the demo refresh with a real test-checkout sub.
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
| **L2c** `l2-rolling-billing-extra` | Extra → `rolling_monthly`, real fixed-term completion (cancel at period end), `status` CHECK, prerequisite gate removed, **graduated portal tier** for completed clients. | L2b |

- **✅ L2b landed 2026-07-28.** The content address is now stored state (`content_variant_id`, `content_ordinal`, `content_loops`) that advances one step per newly recorded paid invoice, not a count derived from `months_elapsed`. `invoice.paid` is idempotent per invoice, which also closed a live defect where a Stripe redelivery double-incremented the month. Verified against **production** with a Stripe test clock: one paid month advances exactly one step, four redeliveries of the same event move nothing, Principiante 6 → Intermedio 1, and Avanzado 6 → Avanzado 1 with `content_loops = 1`. Screens confirmed in the browser.
  ⚠ **The smoke also caught a production outage the whole CI gate had missed** — see the `CLAUDE.md` review rule on second FKs and PostgREST embeds. Migration 016's `content_variant_id` made every `subscriptions(program_variants(...))` embed ambiguous; PostgREST returned an *error*, readers checked only `!data`, and the portal silently served a rest day to everyone between PR #19 and hotfix #21. Nothing in `tsc`, lint, 533 tests or the build talks to the database.
- **✅ L2a landed 2026-07-28.** Aura can now author a "Mes 1" per **variant**, so the real curriculum is unblocked (the old `unique(program_id, series_number)` made a second level's "Mes 1" impossible). Verified on a Preview against the live DB: two variants of one program each hold their own Mes 7, and a duplicate within one variant is refused by name.
  - **Lesson worth keeping — `z.string().uuid()` rejects this project's ids.** The catalog ids are seeded by hand (`00000000-0000-0000-0002-000000000010`) and carry no RFC 4122 version/variant nibbles, so zod refused *every real id* and silently broke create/update/delete. Use the `uuidLike` regex in `lib/admin/seriesActions.ts`, never `.uuid()`. The 484-test suite missed it because its fixtures were canonical v4 uuids — **more** conformant than production data.
  - **Lesson worth keeping — an `!inner` join can be a load-bearing RLS gate.** Removing `program_series!inner` from the readers silently removed the publication gate (RLS hid unpublished series, so PostgREST dropped the row). Client readers now filter `program_series.published` explicitly. Never rely on a join's RLS side effect to enforce a rule.
- **🐛 Two live defects found, both fixed in L2c** — pull forward as a `bug-fix` if any real client nears month 6:
  - **Fixed-term subs are never ended.** `shouldComplete` writes only `completed_at` and never cancels the Stripe subscription; all 10 prices are monthly `recurring` → **a CuarentaMás client is charged in month 7, 8, … indefinitely** against content that ended at month 6.
  - **`status = 'completed'` is unwritable and unreachable.** In `SubscriptionStatus` and required by the checkout prerequisite gate, but absent from the `subscriptions.status` CHECK (001:146) and never written → a client finishing CuarentaMás is permanently told *"No cumples los prerequisitos"* when buying Extra. (`trialing` has the same enum-vs-CHECK mismatch.)
- **Decided:** prerequisites move to the funnel (Aura's WordPress evaluation is the real gate) · rung order is declared via `ladder_next_variant_id`, not inferred from `level` · position is stored state, never derived from a count (a growing Avanzado catalog would otherwise retroactively reshuffle looping clients) · a `completed` client keeps account + payment history + progress history/photos + a continue-with-Extra CTA, but no training content.
- **⚠ L2c is security-sensitive** (new access tier + middleware) → route through `security-review`, not just `code-review`. If it grows unwieldy, the graduated tier is the clean seam to split out — it's the only part not touching billing.
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
| **D10** | Verify A9 cancellation end-to-end after demo refresh | S | Demo subs use fabricated `sub_seed_*` Stripe IDs → `cancelSubscription`/`reactivateSubscription` 404 in Stripe test mode ("No se pudo guardar. Intenta más tarde."). Not a code bug. After **L6 demo refresh**, cancel a **real test-checkout** sub → grace state → Reactivar → confirm survey row written/deleted. Tie to **L4 smoke**. |
| **D14** | `requireAdminPage()` missing on 5 admin pages | S | From L2a security review. Defense-in-depth only — **not exploitable**: `getRedirectPath` sends no-session and `role === 'client'` away from `/admin`, and the matcher covers it. But `app/admin/content/page.tsx` and the four `content/[programId]/series/**` pages rely on middleware alone, unlike the other seven admin pages. The systematic fix is a guard in `app/admin/layout.tsx` so it can't be forgotten per page — blocked on that layout being `"use client"` (it uses `usePathname`), so it needs splitting into a server wrapper + client nav. |
| **D15** | 4 main specs fail `openspec validate --specs --strict` | S | Found while archiving **L2a**. `admin-dashboard-kpis`, `admin-richtext-color`, `portal-exercise-display` and `portal-performance-display` have no `## Purpose` section, which the strict validator requires — they jump straight from the `#` title to `## Requirements`. Pre-existing (they predate L2a; `admin-dashboard-kpis` last touched in `8c6ff1f`), harmless at runtime, but every `--specs --strict` run reports `9 passed, 4 failed`, so a real regression in a spec would be easy to miss in the noise. Fix is one `## Purpose` paragraph each — cheap, and worth doing before **L8 production-checklist** so that gate starts from green. Note the archive command seeds `TBD - update Purpose after archive`; write a real one rather than leaving the placeholder. |
| **D11** | CSP for external scripts (Calendly `widget.js`) | S | ✅ Done (PR #12, `b915e1e`). Baseline CSP + hardening headers in `next.config.mjs` `headers()`: whitelists the app's external origins (Calendly, Google Fonts, YouTube, Supabase Storage, Stripe), blocks the rest, `frame-ancestors 'none'`. **Residual:** `script-src`/`style-src` keep `'unsafe-inline'` (App Router inline hydration + inline style props) → **nonce-based CSP deferred to L8**. |

---

## Suggested Sequence

1. **Quick batch:** `A2` · `A3` · `A10` · `A11` — low risk, highly visible, first to exercise the CI gate.
2. **Mediums:** `A1` · `A5` · `A8` · `A9` · `A12` (`A5` before `A4`).
3. **Projects:** `A6+A7` (Calendly booking) → `A4`.
4. **In parallel (depends on Aura):** `L1` pricing · `L5` WhatsApp · `L3` onboarding questions.
5. **Next up — `L2c`** (`l2-rolling-billing-extra`). `L2a` and `L2b` ✅ done 2026-07-28.
6. **Launch close-out:** `L4` · `L6` · `L7` → `L8` production-checklist. (`L10` ✅ done.)
