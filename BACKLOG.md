# Backlog — Aura Maristany

Living list of **pending** work. **Each item has a stable ID** to launch it directly into the OpenSpec loop.

```
/opsx:propose "D19 — exit survey reason"   # when scope is already clear
/opsx:explore "L9 — admin UI for prices"   # when it still needs defining
```

**When closing an item:** `/opsx:archive` → **delete its row and section here** → re-index codebase-memory in `fast` mode.
Closed work is not summarized here — the durable record is `openspec/changes/archive/`, `docs/adr/*.md`, and the review rules in `CLAUDE.md`.

**Size:** `S` ≈ hours · `M` ≈ ~1 day · `L` ≈ several days.

---

## Index

| ID | Item | Size | Status |
|----|------|:----:|--------|
| **L4** | E2E smoke test with Aura | S | Pending |
| **L6** | Demo data cleanup | S | Pending |
| **L7** | Minor demo fixes | S | Needs detailing |
| **L1** | Stripe LIVE + real prices | M | Blocked (Aura's pricing) |
| **L3** | Onboarding question set | S | Blocked (Aura defines them) |
| **L5** | Real WhatsApp | S | Blocked (Aura's number) |
| **L11** | Turn the A4 automated rules on | S | Blocked (L6 + Aura's content) |
| **L8** | production-checklist | M | At the end |
| **L9** | Admin UI for plans/prices? | L | Decision pending |
| **A13** | Automated-message builder (own triggers) | L | Nice-to-have, does NOT block launch |
| **A8** | Color and background in the text editor | M | Pending |
| **D1–D26** | Deferred / technical debt | — | See below |

---

## L · Before Opening to Real Clients

### L4 · E2E smoke test with Aura — `S`
Admin/demo client login + real registration → email confirmation → onboarding → test checkout (`4242 4242 4242 4242`) → webhook creates sub → portal.

### L6 · Demo data cleanup — `S`
Delete only client data (profiles/subs/invoices/photos), keeping admin and the catalog. Base: `scripts/seed-demo.ts` (already additive and secret-free). **Gates L11.**

### L7 · Minor demo fixes — `S` · needs detailing
UI tweaks found during browser verification; never itemized. **First step: list them out.**

### L1 · Stripe LIVE + real prices — `M` · blocked
Create 10 Products/Prices in live mode (`scripts/seed-stripe.ts` in live mode) → update `stripe_price_id`/`price_mxn` in `program_variants` → flip keys to `sk_live`/`pk_live` in Vercel → register **live webhook** + new `STRIPE_WEBHOOK_SECRET`.
**Blocked:** Aura's prices are still missing.

### L3 · Onboarding question set — `S` · blocked
Aura loads her real questions from `/admin/onboarding-settings`. Currently there are 3 test seed questions left (migration 002).

### L5 · Real WhatsApp — `S` · blocked
Replace `NEXT_PUBLIC_AURA_WHATSAPP` (currently `525512620404`, a test number) with the real number.

### L11 · Turn the A4 automated rules on — `S` · blocked
A4 shipped with both rules `is_active = false`. Enabling them is a deliberate, one-at-a-time step, **not** a leftover chore — each one starts mailing every matching client the next morning.
- **`inactivity_nudge`** — blocked on **L6**. A dry run on 2026-07-27 matched **17 of 18** demo clients, and every demo address is `@test.aura.mx`, a domain that does not resolve. Enabling before the cleanup means ~17 hard bounces in one batch from the freshly-verified sender.
- **`booking_reminder`** — blocked on Aura placing `agendar` runs in **W1 and W3**. With no runs in the grid it never fires, so this one is safe but pointless until she does.
- **How:** re-run `GET /api/cron/automated-messages?dryRun=1` with the `CRON_SECRET` bearer token first and read the counts, then
  `update automated_messages set is_active = true where rule = '<rule>';` (or the Activar button in `/admin/automated-messages`).
- **Carries A4's task 9.3**, the one smoke that could not run pre-launch: the send path is unit-tested and dry-run-verified but has never delivered a real message. On the first enabled rule, confirm a client receives the in-app message **and** the email, then re-run the cron the next day and confirm **nothing** is re-sent (the `automated_notices` dedupe).

### L8 · production-checklist — `M` · at the end
Run the `production-checklist` skill before opening to real clients (includes the `npm audit` vulnerability gate).
- **Carried over from D11:** tighten the baseline CSP to a **nonce-based** `script-src`/`style-src` (today both keep `'unsafe-inline'`).
- **Wants D15 closed first** so `openspec validate --specs --strict` starts from green.

### L9 · Admin UI for plans/prices? — `L` · decision pending
Decide whether to build a UI to manage variants/prices or keep the script + SQL approach.

---

## A · Aura's Requests

### A8 · Color and background in the text editor — `M`
Text color and background for the Text block (Tiptap).
- **Touches:** MIT deps `@tiptap/extension-text-style` + `@tiptap/extension-color` + `@tiptap/extension-highlight` · text block editor in `components/admin/blocks/`.
- **⚠ Gotcha:** `lib/admin/sanitize-html.ts` **strips styles** unless the whitelist is extended (`allowedStyles` with `color` / `background-color`). Without this, the color is lost on save and looks like a "bug".
- **Still to decide:** palette limited to brand tokens (recommended) vs. free-form picker.

### A13 · Automated-message builder (own triggers) — `L` · nice-to-have, does NOT block launch
Let Aura **create** automated messages, not just edit the two shipped ones.
- **Why it's a separate change:** in A4 the DB row is only the *copy* — the **trigger is code** (`lib/admin/notice-rules.ts`). A newly created row would have no rule to fire it and would silently never send. Real create/delete requires Aura to author the **trigger** (window opens / N days inactive / N days before renewal / day N of the period) + a per-trigger dedupe strategy + preview & test-send.
- **Blast radius:** this hands Aura the ability to schedule mail to every client with no code review — needs its own guardrails.
- **Signal to build it:** L2's follow-on (notify the client when she crosses a ladder rung) is the third-rule signal this was waiting for. Also wait until the two hardcoded A4 rules have run in production.

---

## D · Deferred / Technical Debt

### Transactionality — close together
These three are one root cause (no single-statement transaction) and should be closed as one change, not a fourth hand-rolled compensation.

| ID | Item | Size | Note |
|----|------|:----:|------|
| **D2** | `saveBlocks`/`savePillarBlocks` transactionality | M | Non-atomic delete-then-insert → possible partial state. |
| **D13** | `updateSeries` mapping reconciliation is not atomic | M | From L2a. `variant_series_map` is reconciled by delete-then-insert; the compensating re-insert is best-effort — if the *restore* fails or the process dies mid-way, the series is mapped to **zero** variants: no position in any curriculum, renders nowhere, unrecoverable from the UI. **Second path, same cause:** metadata (`title`/`description`/`published`) is written *after* the mapping succeeds, so the reverse failure leaves the month moved with a stale title under a generic error. Real fix: one Postgres RPC doing delete+insert in a single transaction. Second-best: surface unmapped series in the editor. |
| **D16** | `invoice.paid` records the invoice and advances the pointer in two statements | M | From L2b PR2 (security review). The idempotency gate is "was this invoice newly recorded", so the invoice row is written *first*. A crash between the two permanently loses that month's advance. **Not a regression** — the ordering is deliberate: the reverse order risks a *double* advance, which skips a month of workouts and is indistinguishable from normal progress afterwards, whereas a lost advance is inspectable state a human can correct. |

### Everything else

| ID | Item | Size | Note |
|----|------|:----:|------|
| **D15** | 3 main specs fail `openspec validate --specs --strict` | S | `admin-richtext-color`, `portal-exercise-display`, `portal-performance-display` have no `## Purpose`, which the strict validator requires. Pre-existing, harmless at runtime, but the noise (`15 passed, 3 failed`) would hide a real spec regression. One paragraph each. **Do it before L8** so that gate starts green. ⚠ The archive command seeds `TBD - update Purpose after archive` — write a real one. (`admin-dashboard-kpis` was fixed during the D17 archive.) |
| **D14** | `requireAdminPage()` missing on 5 admin pages | S | From L2a security review. Defense-in-depth only — **not exploitable**: `getRedirectPath` sends no-session and `role === 'client'` away from `/admin`, and the matcher covers it. But `app/admin/content/page.tsx` and the four `content/[programId]/series/**` pages rely on middleware alone, unlike the other seven. Systematic fix is a guard in `app/admin/layout.tsx` — blocked on that layout being `"use client"` (it uses `usePathname`), so it needs splitting into a server wrapper + client nav. |
| **D24** | Client-list filter is write-only after the first render | S | From the D17 review, deliberately deferred. `initialStatus` seeds `useState`, so `?status=` is read **once**: a soft navigation between two `?status=` URLs that keeps `ClientsTable` mounted ignores the new value, and clicking a pill leaves the URL stale — the filter is linkable in neither direction. Fix is to drive `estado` from `useSearchParams` + `router.replace`, which changes the **four pre-existing pills** too — hence its own change. |
| **D27** | Demo subscriptions carry synthetic Stripe ids, so no Stripe-touching flow can be smoke-tested | S | `seed-demo.ts` writes `sub_seed_NNN` / `cus_seed_NNN`, which do not exist in Stripe — `GET /v1/subscriptions/sub_seed_002` → `No such subscription`. So **cancel and reactivate cannot be exercised on demo data at all**: `cancelSubscription` calls Stripe first, the call 404s, and the client sees the generic error. Correct behaviour (Stripe is the source of truth, so no survey row is written for a cancellation that did not happen) but it means every smoke card for those flows is unrunnable, and the only workaround is registering a fresh client through real test-mode checkout each time. ⚠ This is the trap `CLAUDE.md` → Skills already warns about ("a card has asked for a Stripe subscription that didn't exist") and it has now been sprung twice; **D8** is the same shape from the other side (no `trialing` sub exists to look at). Fix: create real test-mode subscriptions in the seed for a handful of clients, or add a documented "make me a cancellable client" script. |
| **D26** | `CANCELABLE_STATUSES` duplicates `ELIGIBLE_STATUSES` | XS | `lib/portal/settingsActions.ts` declares its own `["active","trialing","past_due"]` alongside the identical list in `lib/portal/cancellation.ts` — a **genuine** duplication, same question ("may she cancel?"). ⚠ *Unlike* `ACCESS_STATES` and `BILLING_STATUSES`, which answer **different** questions with a coincidentally identical list — those must NOT be merged. |
| **D20** | `onboarding_questions_admin_write` has no `with check` | XS | From D18's security review. `for all using (is_admin())` with no `with check`, contrary to the RLS rule in `CLAUDE.md`. Functionally equivalent for `update` (Postgres falls back to `using`), but D18 made that policy the sole guard for a new callable entry point (`reorder_onboarding_questions`). New migration — **never edit 001**. |
| **D27** | Two bar fills still fail the WCAG contrast floor | XS | From the `dashboard-revenue-by-variant` review. `components/admin/RevenueBarChart.tsx:25` (bar fill) and `components/portal/PerformanceChart.tsx:63` (line + dot stroke) hard-code `#9982f4`, which is **2.81:1 against the `--gris-claro` track** — under the 3:1 WCAG 1.4.11 floor for graphical objects. It passed inspection for months because against *white* it reads 3.06:1, and "lavender on white" is how anyone describes those cards. The dashboard variant cards were fixed (moved to `--lavanda-dark`, 4.22:1); these two were left alone because that change's scope named them must-not-touch. Rule now recorded in `docs/adr/0005-bar-fill-contrast-measured-against-the-track.md`: **measure the fill against its track, not the card.** ⚠ `components/admin/blocks/TextBlockEditor.tsx:17` also holds `#9982f4` but is a colour-picker swatch whose value is stored as content — a literal is arguably correct there; decide, don't convert reflexively. |
| **D23** | Three raw `#9a7b1f` copies remain | XS | `--ambar`/`--ambar-tint` now exist in `globals.css`; the D17 copies were converted, three pre-existing ones remain in `lib/admin/payment-status.ts`, `components/portal/settings/SubscriptionCard.tsx`, `components/admin/ClientDetailTabs.tsx`. Same shape as the `--exito` finding: **the token system was missing the token**, not the callers being careless. |
| **D25** | Filter pills carry no `aria-pressed` | XS | Each pill is a plain `<button>` whose active state is CSS-only, so a screen reader gets no signal. Pre-existing across programs + status pills. One attribute: `aria-pressed={estado === f}`. |
| **D22** | `paused`/`incomplete` have no client-list pill | XS | The three statuses the DB accepts beyond the six the UI modelled match no filter pill, so such a client is visible only with no filter applied. Nothing mis-buckets them (verified: positive `!==` guards, and the cohort branch gates on `status === "active"` first). Worth a `Pausada` pill only if Aura starts pausing subscriptions routinely. |
| **D8** | Visually review `trialing` "Prueba" badge | XS | Badge added but unverified — no trialing sub in demo data. Check when one exists. |
| **D12** | `todayLabel()` duplicated in 3 portal pages | XS | Byte-identical in `app/portal/messages/page.tsx`, `messages/[id]/page.tsx`, `settings/page.tsx` (`/pilares` builds the same label inline via `weekdayLabel`). Extract next time one of them is touched. |
| **D6** | Typo in `.env.example` | XS | `noreply@auramristany.com` → `no-reply@auramaristany.com`. |
| **D4** | 250-photo cap not race-safe | S | Acceptable for single-user. |
| **D5** | `getSentMessages` loads all `message_recipients` | S | Scaling concern; fine for now. |
| **D1** | Admin notes on the day's log | M | Deferred from Phase 3. |
| **D3** | Zapier on-subscribe | M | Deferred from Phase 4. |
| **D21** | Should a CI check catch unused `lib/` exports? | S | Open question from D18. Four instances project-wide is not yet evidence of a systemic leak. ⚠ The example this item was built on has expired: `cancellationReasonLabel` **now has a caller** (the "Razones de cancelación" card, PR #42), so it is no longer the counter-example that made an opt-out annotation look mandatory. That weakens the objection but does not settle the question — re-count the remaining instances before designing anything, and note that the export was uncalled for two changes and correct to keep both times, which is the real argument for an annotation. Revisit if a later sweep finds more; the sweep is a one-liner in D18's PRs. |

---

## Suggested Sequence

1. **Now — unblocked cleanup, cheapest first:** `D6` · `D19` · `D20` · `D23` · `D25` · `D27` (all XS, batchable into one or two changes) → `D15` (needed before `L8`). `D23` + `D27` are the same shape (a raw hex where a token belongs) and share a natural batch, but note they are **not** the same defect: `D23` is cosmetic duplication, `D27` is an accessibility failure.
2. **Then — the two real S/M debts:** `D24` (client-list filter linkability) · `D14` (admin layout guard split).
3. **Transactionality, as one change:** `D2` + `D13` + `D16` — one Postgres RPC pattern closes all three.
4. **In parallel, waiting on Aura:** `L1` pricing · `L3` onboarding questions · `L5` WhatsApp · `L7` (needs Aura's list).
5. **Launch close-out, in order:** `L4` smoke → `L6` demo cleanup → `L11` turn the A4 rules on (one at a time) → `L8` production-checklist.
6. **After launch, on demand:** `A8` editor colors · `L9` prices UI decision · `A13` message builder (wait for Aura's third-rule request).
