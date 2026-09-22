# Backlog — Aura Maristany

Living list of **pending** work. **Each item has a stable ID** to launch it directly into the OpenSpec loop.

```
/opsx:propose "D36 — with check on admin policies"   # when scope is already clear
/opsx:explore "L9 — admin UI for prices"   # when it still needs defining
```

**When closing an item:** `/opsx:archive` → **delete its row and section here**.
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
| **L8** | Pre-launch verification | M | At the end |
| **L9** | Admin UI for plans/prices? | L | Decision pending |
| **A13** | Automated-message builder (own triggers) | L | Nice-to-have, does NOT block launch |
| **D1–D38** | Deferred / technical debt | — | See below |

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

### L8 · Pre-launch verification — `M` · at the end
The full pass before opening to real clients. Runs **once**, not per PR — CI is the per-PR gate. Pre-conditions: launch-milestone changes archived · CI green on `main` · deployed to Production · production env vars set in Vercel.

Classify every finding: **BLOCKER** (must not launch) · **WARNING** (fix before or shortly after) · **NOTE** (post-launch). Finish with an explicit `READY TO LAUNCH: YES/NO`.

**1 · Environment, config, dependencies**
- All 11+ env vars from `CLAUDE.md` → "Environment variables" set in Vercel Production — **not just locally**; `DEV_DATE` **absent**.
- No `.env`/`.env.local` committed; **`npm audit` clean of high/critical** (unfixable transitive advisories documented as NOTES, never silently ignored); `package-lock.json` in sync with `package.json`.
- gitleaks green **and a full-history scan run at least once** — the per-PR scan only sees new commits.

**2 · CI gate actually enforced on `main`**
```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api repos/$REPO/branches/main/protection -H "Accept: application/vnd.github+json" --jq '.required_status_checks'
```
Must return the CI check name, not `null`. Confirm the workflow covers every command in `CLAUDE.md` → CI, and that a green run exists on the current `main` commit.

**3 · Performance + accessibility baseline**
- Lighthouse on the critical flow: Performance ≥75 · Accessibility ≥90 · Best Practices ≥90 · SEO ≥80. Below threshold = WARNING; Performance <50 = BLOCKER. Record the numbers as the regression baseline.
- Verify against the real UI, not just the score: keyboard reachable + visible focus + logical order, no traps · labels on icon-only controls · **contrast measured against the actual track** (see `docs/adr/0005`) · form errors announced, not color-only · tap targets ≥44px (the documented `kg | lb` 32px exception aside).

**4 · Error tracking** — currently **none**. Decide deliberately: wire something up, or accept as a WARNING that production failures stay invisible until Aura reports them. If wired: trigger a test error, confirm it lands, set a spike alert.

**5 · Database** — every migration applied to Production **explicitly** (never assumed to auto-run on deploy), and a Supabase backup taken **before** launch.

**6 · Security basics** — HTTPS enforced · auth required on every route holding client data · no admin/debug route publicly reachable · no verbose errors or stack traces to the client (rule 6) · rate limiting on the auth endpoints · CORS not `*`.
- **Carried over from D11:** tighten the baseline CSP to a **nonce-based** `script-src`/`style-src` (today both keep `'unsafe-inline'`).

**7 · Domain and routing** — `app.auramaristany.com` resolves · SSL valid and not expiring within 30 days · `www`/non-`www` behave · 404 and 500 render real pages, not blank screens or Next defaults.

**8 · Smoke test in Production** (human step) — the full client flow end-to-end **with a real account, not a seed one**, and confirm the emails in that flow actually send. Overlaps `L4`; this is the post-cleanup repeat on live config.

**9 · Operational readiness** — the rollback path is understood, uptime alerting exists, and the deploy process is written in `CLAUDE.md` rather than only in your head.

- Skipped by capability, noted here so nobody re-derives it: no PWA/offline/installable, no native wrapper → no manifest, service-worker, store-metadata or on-device checks.

### L9 · Admin UI for plans/prices? — `L` · decision pending
Decide whether to build a UI to manage variants/prices or keep the script + SQL approach.

---

## A · Aura's Requests

### A13 · Automated-message builder (own triggers) — `L` · nice-to-have, does NOT block launch
Let Aura **create** automated messages, not just edit the two shipped ones.
- **Why it's a separate change:** in A4 the DB row is only the *copy* — the **trigger is code** (`lib/admin/notice-rules.ts`). A newly created row would have no rule to fire it and would silently never send. Real create/delete requires Aura to author the **trigger** (window opens / N days inactive / N days before renewal / day N of the period) + a per-trigger dedupe strategy + preview & test-send.
- **Blast radius:** this hands Aura the ability to schedule mail to every client with no code review — needs its own guardrails.
- **Signal to build it:** L2's follow-on (notify the client when she crosses a ladder rung) is the third-rule signal this was waiting for. Also wait until the two hardcoded A4 rules have run in production.

---

## D · Deferred / Technical Debt

### Everything else

| ID | Item | Size | Note |
|----|------|:----:|------|
| **D36** | `for all using (is_admin())` without `with check` on four non-content tables | XS | `profiles_admin_insert_update_delete`, `invoices_admin_write`, `subscription_events_admin_only`, `message_recipients_admin_write` (001). Left out of `atomic-series-create-rls-checks`, which fixed the nine content-table policies in migration 022. Functionally equivalent (Postgres falls back to `using`), but against rule 3 / D20. Money and identity surface, so it ships on its own. Same fix as 022: `alter policy … with check (is_admin())`, which leaves `using` untouched. |
| **D37** | Portal "today" is UTC | S | Every portal date — the header (`weekdayLabel()`) and the day's content — is computed on the server clock, which is UTC on Vercel, and no date label sets a `timeZone`. So the portal's day rolls over at 18:00 Mexico time: an evening client sees tomorrow's header and tomorrow's content. `admin-portal-debt-batch` made the seven headers agree with each other, not with Mexico. A platform-wide decision, not a header fix: the specs mandate UTC day math, so the header alone must not move to `America/Mexico_City` while the content stays UTC. |
| **D38** | Text-on-tint contrast outside the status badges | S | `admin-portal-debt-batch` brought every status badge to ≥4.5:1 through `BADGE_TONE`; these are the same failure on other surfaces, measured on white. **Buttons and counters:** white on `--lavanda` is 3.06:1 (`.pill.active`, the portal nav and message counters). **Link chip:** "Pilares del mes" in `SeriesAccordion` (`--lavanda-dark` on `--lavanda-soft`) 3.92:1. **Badge-shaped chips left out of the batch because their files were not in its plan:** `--lavanda-dark` on `--lavanda-tint` is 4.19:1 on the portal card's program chip (`SubscriptionCard`), the workout-focus chip on Hoy (`TodayView`) and on a history day (`HistoryDayView`), and "Compartida en N" (`SeriesAccordion`); the habit counter on Desempeño (`PerformanceTab`) is 3.63:1 and uses a raw hex (`#3a8c60`, D23). The chips need only `...BADGE_TONE.lavender` / `.success`; the buttons and counters need a decision on `--lavanda` itself. Also: icon tiles on tinted squares. |
| **D4** | 250-photo cap not race-safe | S | Acceptable for single-user. |
| **D5** | `getSentMessages` loads all `message_recipients` | S | Scaling concern; fine for now. |
| **D1** | Admin notes on the day's log | M | Deferred from Phase 3. |
| **D3** | Zapier on-subscribe | M | Deferred from Phase 4. |

---

## Suggested Sequence

1. **In parallel, waiting on Aura:** `L1` pricing · `L3` onboarding questions · `L5` WhatsApp · `L7` (needs Aura's list).
2. **Launch close-out, in order:** `L4` smoke → `L6` demo cleanup → `L11` turn the A4 rules on (one at a time) → `L8` pre-launch verification.
3. **After launch, on demand:** `L9` prices UI decision · `A13` message builder (wait for Aura's third-rule request).
