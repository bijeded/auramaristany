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
| **A2** | Rest in minutes | S | Pending |
| **A3** | More visible exercise checkbox | S | Visual decision pending |
| **A10** | Bars in "Ingresos por programa" | S | Pending |
| **A11** | 5th stat card: expiring in 7 days | S | Pending |
| **A1** | kg / lb selector | M | Pending |
| **A5** | "Sin actividad" filter in Clients | M | Pending |
| **A8** | Color and background in the text editor | M | Palette decision pending |
| **A9** | Cancellation + exit survey | M | Pending |
| **A12** | 7-day calendar in the portal | M | Pending |
| **A6** | Booking system (WordPress) | L | Pending |
| **A7** | "Agendar" block in the editor | M | Blocked by A6 |
| **A4** | Automated messages | L | Do after A5 |
| **L1** | Stripe LIVE + real prices | M | Blocked (Aura's pricing) |
| **L2** | Extra → recurring monthly billing | L | Pending |
| **L3** | Onboarding question set | S | Blocked (Aura defines them) |
| **L4** | E2E smoke test with Aura | S | Pending |
| **L5** | Real WhatsApp | S | Blocked (Aura's number) |
| **L6** | Demo data cleanup | S | Pending |
| **L7** | Minor demo fixes | S | Needs detailing |
| **L8** | production-checklist | M | At the end |
| **L9** | Admin UI for plans/prices? | L | Decision pending |
| **L10** | Preview env vars in Vercel | S | Pending |
| **D1–D7** | Deferred / technical debt | — | See below |

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

### A5 · "Sin actividad" filter in Clients — `M`
New pill next to Activas/Vencidas/Canceladas: no `progress_logs` in 10 days.
- **Touches:** `lib/admin/clients-queries.ts` (`getClientsList` → add last activity, max `progress_logs.log_date`) · `lib/admin/clients-helpers.ts` (`filterClients`, `STATE_FILTERS`, pure + TDD) · `components/admin/ClientsTable.tsx`.
- **Watch out:** 🔗 **the "last activity" signal is reused by A4.** Build it here and keep it reusable.

### A8 · Color and background in the text editor — `M`
Text color and background for the Text block (Tiptap).
- **Touches:** MIT deps `@tiptap/extension-text-style` + `@tiptap/extension-color` + `@tiptap/extension-highlight` · text block editor in `components/admin/blocks/`.
- **⚠ Gotcha:** `lib/admin/sanitize-html.ts` **strips styles** unless the whitelist is extended (`allowedStyles` with `color` / `background-color`). Without this, the color is lost on save and looks like a "bug".
- **Still to decide:** palette limited to brand tokens (recommended) vs. free-form picker.

### A9 · Cancellation + exit survey — `M`
Cancel from the account + ask for a reason (radio buttons).
- **Decided:** **end of the already-paid period, no refunds.** Verified in `scripts/seed-stripe.ts`: all 10 prices are `recurring: { interval: "month" }` → everything is monthly billing (CuarentaMás = 6 monthly cycles, **not** an installment payment) → **no refund case exists**.
- **Touches:** `components/portal/settings/SubscriptionCard.tsx` + `lib/portal/settingsActions.ts` · `lib/webhooks/stripe-handlers.ts` (`customer.subscription.updated`) · storing the reason (new table or JSONB → **migration**).
- **Watch out:** `subscriptions.cancel_at_period_end` **already exists** and the webhook already handles it; today cancellation happens via Stripe's Customer Portal.

### A12 · 7-day calendar in the portal — `M`
New tab: titles of the next 7 days' activities, **not enterable**.
- **Decided:** 7-day window **cut off at the current period**. If it crosses into the next month, **do not** show those activities (not yet paid for).
- **Touches:** `components/portal/PortalNav.tsx` (4 → 5 tabs; review mobile layout) · new route in `app/portal/` · title reads backed by `lib/content/access.ts` / `lib/content/queries.ts`.
- **⚠ Watch out:** this brushes against the "sin acceso a días futuros" rule. It's respected because these are **titles only** with no navigation into the activity. Don't filter out unpublished content. Decide whether the window includes today.

### A6 · Booking system (WordPress) — `L`
Biweekly calls via Zoom/Meet.
- **Decided:** lives in **WordPress with TheBooking**; the app sends a **signed link** proving an active subscription. The rules (1 call / 15 days, ≥1 day's notice) are controlled by WordPress.
- **Touches:** endpoint that generates the signed link (HMAC + shared secret, **new env var**) · gate with `subscriptionGrantsAccess` (`lib/content/subscription-access.ts`) · WP-side configuration (outside the repo).
- **Watch out:** the link must expire and must not be reusable by third parties. Identity comes from `getUser()` on the server, never from the client.

### A7 · "Agendar" block in the editor — `M` · blocked by A6
New block type that links to the booking system.
- **Touches:** new `block_type` in `program_day_blocks` · palette and editor in `components/admin/blocks/` · zod in `lib/admin/content-validation.ts` · rendering in `components/portal/blocks/BlockView.tsx`.
- **Watch out:** if WP enforces the rules, the block is basically a CTA with a signed link (`S`); if the rules moved into the app, it grows.

### A4 · Automated messages — `L` · after A5
Automated triggers: day 12 → reminder to schedule a video call; 10 days with no progress → "¿todo bien?".
- **Decided:** the **billing reminder is NOT** implemented — Stripe sends it (Phase 4 decision).
- **Touches:** new cron(s) in `app/api/cron/` following the pattern of `purge-messages/route.ts` (Bearer `CRON_SECRET`) + `crons` in `vercel.json` · sending via `lib/admin/messageActions.ts` / `message_recipients` + `lib/email/send.ts`.
- **Watch out:** needs **dedupe** (don't resend the same notice) → persistent flag per client+rule. Reuses the last-activity signal from **A5**. The video-call notice depends on **A6**.

---

## L · Before Opening to Real Clients

### L1 · Stripe LIVE + real prices — `M` · blocked
Create 10 Products/Prices in live mode (`scripts/seed-stripe.ts` in live mode) → update `stripe_price_id`/`price_mxn` in `program_variants` → flip keys to `sk_live`/`pk_live` in Vercel → register **live webhook** + new `STRIPE_WEBHOOK_SECRET`.
**Blocked:** Aura's prices (P1) are still missing.

### L2 · Extra → recurring monthly billing — `L`
`programs.billing_model` for `cuarenta-mas-extra`: `fixed_term_monthly` → `rolling_monthly` (migration) + adjust access/`completed_at`/checkout.
- **Touches:** `lib/webhooks/stripe-handlers.ts` · `lib/admin/clients-helpers.ts` (`subscriptionProgressLabel`) · `lib/content/access.ts` · review Extra Avanzado prerequisites (today they depend on "Extra Intermedio completado").
- **Watch out:** today only the **label** was changed in admin; the underlying logic is still pending.

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

### L9 · Admin UI for plans/prices? — `L` · decision pending
Decide whether to build a UI to manage variants/prices or keep the script + SQL approach.

### L10 · Preview env vars in Vercel — `S`
Set the 11 vars for Preview (the CLI prompts for a branch interactively; do this when creating the 1st dev branch).

---

## D · Deferred / Technical Debt

| ID | Item | Size | Note |
|----|------|:----:|------|
| **D1** | Admin notes on the day's log | M | Deferred from Phase 3. |
| **D2** | `saveBlocks`/`savePillarBlocks` transactionality | M | Non-atomic save → possible partial state. Logged as out of scope for C+D. |
| **D3** | Zapier on-subscribe | M | Deferred from Phase 4. |
| **D4** | 250-photo cap not race-safe | S | Acceptable for single-user. |
| **D5** | `getSentMessages` loads all `message_recipients` | S | Scaling concern; fine for now. |
| **D6** | Typo in `.env.example` | S | `noreply@auramristany.com` → `no-reply@auramaristany.com`. |
| **D7** | Verify CI + gitleaks on the 1st PR | S | The `ci` gate has never been exercised. |

---

## Suggested Sequence

1. **Quick batch:** `A2` · `A3` · `A10` · `A11` — low risk, highly visible, first to exercise the CI gate.
2. **Mediums:** `A1` · `A5` · `A8` · `A9` · `A12` (`A5` before `A4`).
3. **Projects:** `A6` → `A7` → `A4`.
4. **In parallel (depends on Aura):** `L1` pricing · `L5` WhatsApp · `L3` onboarding questions.
5. **Launch close-out:** `L2` · `L4` · `L6` · `L7` · `L10` → `L8` production-checklist.
