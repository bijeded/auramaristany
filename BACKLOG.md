# Backlog — Aura Maristany

Living list of **pending** work. **Each item has a stable ID** to launch it directly into the OpenSpec loop.

```
/opsx:propose "D2 — transactional block saves"   # when scope is already clear
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
| **D1–D32** | Deferred / technical debt | — | See below |

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
| **D22** | `paused`/`incomplete` have no client-list pill | XS | The three statuses the DB accepts beyond the six the UI modelled match no filter pill, so such a client is visible only with no filter applied. Nothing mis-buckets them (verified: positive `!==` guards, and the cohort branch gates on `status === "active"` first). Worth a `Pausada` pill only if Aura starts pausing subscriptions routinely. |
| **D30** | No test asserts a rendered options list matches its source constant | S | RULE CANDIDATE from the PR #49 review. Rule 8's second half — "an options list rendered by a component comes entirely from one exported constant" — is the rule with **no automated enforcement**: `tsc` and lint both pass on a hand-written `<option>` beside a mapped list, which is exactly how the cancel modal offered "Prefiero no decir" for months (D19). PR #49 added a `<select>` built from `STATUS_FILTERS` plus one legitimate `""` sentinel; nothing but a smoke step stops a future edit from adding an eighth literal option. The blocker is that **this repo has no component render tests at all** — Testing Library + jsdom are installed and only `use-progress-form.test.ts` uses the hook renderer — so the first one is real scope, which is why #49 left it out. Proposed rule once the harness exists: *a component rendering an options list from an exported constant gets one render test asserting the option set equals that constant plus its declared sentinels.* Natural first targets: `ClientsTable`'s status select and the cancellation-reason list. |
| **D31** | `PaymentsTable` still filters with the old pill row | XS | PR #49 replaced the client list's seven status pills with a `<select>` and deliberately did not touch `components/admin/PaymentsTable.tsx`, so the two admin list screens now filter with **different controls**. Not a defect — `PaymentsTable` has only four payment-status filters and does not wrap — but it is a visible inconsistency between two adjacent screens. ⚠ Its `STATUS_FILTERS` is a **separate local constant** of a different shape (`{key, label}[]`, payment statuses), not the client-list one — do not try to share them. Decide deliberately: converge on the select, or accept the difference because four pills genuinely fit on one line. |
| **D32** | `types.ts` says `cancellation_surveys.created_at` is not nullable; the DB says it is | XS | From the PR #51 review. Migration 011 declares `created_at timestamptz default now()` with **no `not null`**, but `lib/supabase/types.ts` types it as `string`. A default is not a constraint: an insert passing an explicit `null` stores one. Nothing is broken today — the only reader that orders by it (`getClientDetail`'s survey lookup) already passes `nullsFirst: false` precisely because the column is nullable, so a dateless row cannot win the "most recent" tie-break. But the type and the schema disagree, and the type is the one that is wrong, so the next reader will trust it. Two ways out, and they are not equivalent: widen the type to `string \| null` (cheap, honest), **or** add a migration setting `not null` and make the type true (better, but it is a schema change and must be verified against the real DB per review rule 11). ⚠ Do not "fix" it by deleting the `nullsFirst: false` — that flag is correct under either resolution and is what keeps the tie-break meaningful. |
| **D33** | The font tokens are defined twice and can drift | XS | From the `button-font-head-at-root` change. `app/globals.css:63-64` defines `--font-head: 'Oswald'` / `--font-body: 'Hind'`, and `tailwind.config.ts:67` **re-declares the same stacks as literals** (`head: ["Oswald", "system-ui", "sans-serif"]`). So the `font-head` utility and `var(--font-head)` are two independent copies of one decision — change the custom property and every `className="font-head"` in the repo keeps the old face, silently. Same copied-table shape as review rule 8, applied to design tokens. Fix: point the Tailwind config at the custom properties (`head: ["var(--font-head)"]`) so there is one definition. ⚠ Verify by eye after — nothing in `tsc`, lint, the tests or the build resolves a font, which is exactly why the duplication survived this long. |
| **D8** | Visually review `trialing` "Prueba" badge | XS | Badge added but unverified — no trialing sub in demo data. Check when one exists. |
| **D29** | The `kg \| lb` toggle is hand-duplicated in two files | XS | From the `thin-weight-unit-toggle` review (PR #47). The same control is written twice — `UnitToggle` in `components/portal/blocks/ExerciseListBlock.tsx:38` (inline `style`) and an unnamed inline copy in `components/portal/PerformanceTab.tsx:95` (Tailwind `px-3 py-1` + `style`). They have **already drifted**: only the first carries `transition: "all 0.15s ease"`, so the pressed state animates on `/portal/today` and snaps on Desempeño. Dimensions still match, so nothing is broken today. ⚠ The `portal-performance-display` spec now asserts the two copies must stay dimensionally identical — that sentence is a **defect report, not a fix**: same duplicated-table failure class as review rule 8, applied to JSX styling instead of enum tables. Fix: one exported `WeightUnitToggle` consumed by both, then delete the assertion from the spec. |
| **D12** | `todayLabel()` duplicated in 3 portal pages | XS | Byte-identical in `app/portal/messages/page.tsx`, `messages/[id]/page.tsx`, `settings/page.tsx` (`/pilares` builds the same label inline via `weekdayLabel`). Extract next time one of them is touched. |
| **D4** | 250-photo cap not race-safe | S | Acceptable for single-user. |
| **D5** | `getSentMessages` loads all `message_recipients` | S | Scaling concern; fine for now. |
| **D1** | Admin notes on the day's log | M | Deferred from Phase 3. |
| **D3** | Zapier on-subscribe | M | Deferred from Phase 4. |
| **D21** | Should a CI check catch unused `lib/` exports? | S | Open question from D18. Four instances project-wide is not yet evidence of a systemic leak. ⚠ The example this item was built on has expired: `cancellationReasonLabel` **now has a caller** (the "Razones de cancelación" card, PR #42), so it is no longer the counter-example that made an opt-out annotation look mandatory. That weakens the objection but does not settle the question — re-count the remaining instances before designing anything, and note that the export was uncalled for two changes and correct to keep both times, which is the real argument for an annotation. Revisit if a later sweep finds more; the sweep is a one-liner in D18's PRs. |

---

## Suggested Sequence

1. **Now — transactionality, as one change:** `D2` + `D13` + `D16` — one Postgres RPC pattern closes all three.
2. **In parallel, waiting on Aura:** `L1` pricing · `L3` onboarding questions · `L5` WhatsApp · `L7` (needs Aura's list).
3. **Launch close-out, in order:** `L4` smoke → `L6` demo cleanup → `L11` turn the A4 rules on (one at a time) → `L8` pre-launch verification.
4. **After launch, on demand:** `L9` prices UI decision · `A13` message builder (wait for Aura's third-rule request).
