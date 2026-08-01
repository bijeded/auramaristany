# Aura Maristany — Web Platform

Holistic health coaching for women 40+. Sells, delivers, and manages training/nutrition/wellness programs as **recurring monthly subscriptions**. The app lives on a subdomain (`app.auramaristany.com`); the marketing site is a separate, independent WordPress that is NOT touched.

**Status:** Phases 0–5 complete on `main`; **Phase 6 (Polish + Launch) in progress**. Deployed as a **live DEMO** (Stripe in **test mode**, no real charges) for Aura's feedback before production launch.

**Sources of truth — three, each with one job:**

| File | Job |
|---|---|
| **`CLAUDE.md`** (this file) | **how** we work — conventions, review rules, verification, workflow |
| **`openspec/specs/`** | **what** the system does today |
| **`docs/adr/`** | **why** the hard decisions went the way they did |

`openspec/config.yaml` is the one other file carrying process, and the division is strict:

- **`config.yaml` shapes a plan** — it is injected while OpenSpec generates a proposal, specs, a design or a task list, and it stops mattering once the plan is approved.
- **`CLAUDE.md` shapes the code** — it governs everything from the first edit to the merge.

So a rule that changes what gets *specified* lives there; a rule that changes what gets *written* lives here. Where config names one of the numbered review rules, it carries the trigger only — **the rule and its reasoning live here.** The one deliberate exception is the four domain facts repeated in `config.yaml`'s `context:` block, duplicated because a spec is often drafted before this file is consulted; change them here first.

History, not authority: `openspec/changes/archive/` and `docs/superpowers/` (which holds the frozen `SPEC.md`).

> **Docs language:** this file, `docs/adr/`, and `openspec/` are **English**. The **product UI and anything written for Aura are Mexican Spanish** (see Conventions → UI language).

---

## Workflow (OpenSpec for the what · the assistant for the how)

```
/opsx:explore  →  /opsx:propose  →  [ plan review ]  →  /opsx:apply  →  /opsx:archive
```

**OpenSpec owns the *what*** — proposal, delta specs, task list. **The *how* is the assistant's judgment, governed by this file.** There is no orchestrator skill: the discipline written here is the process, so a rule that isn't in this file isn't enforced anywhere.

- **Non-trivial or unclear work starts with `/opsx:explore`** — no artifacts, no code, just enough investigation to make the proposal precise. Skip it when the scope is already obvious.
- **`/opsx:propose` produces the plan, and then work stops for review.** This is the single gate. The maintainer reads the proposal, the delta specs and the task list, and pushes back by editing them directly or asking for a revision.
- **After that approval, `/opsx:apply` runs to a merged PR without stopping again** — including diffs that touch frontend, auth, money or migrations. The obligations that used to be enforced by stopping are now enforced by the two sections below, and they are not optional just because `apply` reports every task done.
- **When implementation proves the plan wrong, update the artifacts** (`/opsx:update`) rather than letting the code and the spec drift. If the *intent* changed rather than the execution, that is a new change, not an update.
- **Close with `/opsx:archive`, and say yes to the delta-spec sync it offers** — archive does not merge the deltas into `openspec/specs/` on its own, and once the change folder is gone nothing is left to notice they never landed.
- ⚠ `main` **= Production for the demo Aura sees.** Branch → Preview URL → PR → green CI → squash merge; **never push to** `main` **directly, including docs.** Branch naming, commit format and the two-PR shape of an OpenSpec change are in Git & PR.

Scope discipline: the approved plan is the deliverable. Don't quietly narrow, widen or transform it — if it turns out to be wrong, say so and revise the artifacts in the open.

> **Don't use the `superpowers:*` flow** as a process. `docs/superpowers/` is history, not an active flow.

---

## Review

Two reviewers, and they are not interchangeable. The hand-written `code-reviewer`/`security-reviewer` subagents were retired 2026-08-01; these replace them.

**`/security-review` — the assistant runs it, unattended.** Any change whose proposal declared a **sensitive surface** (auth, RLS, service-role, webhooks, money, migrations) gets it before the PR is opened, without asking and without stopping. Findings are addressed or explicitly dismissed with a reason in the PR body.

**`/code-review` — the maintainer's, and only theirs.** It cannot be model-invoked, by design. The assistant never runs it and **never asks for it** — a standing request becomes a stop by habit, which is the thing this workflow is built to avoid. It is run at the maintainer's discretion when they want depth: before a PR, on a PR number, or when a smoke check surfaces something. It runs as a background subagent with its own context window, so it costs nothing but the wait.

**What the assistant owes instead of a request: a flag.** Every PR handoff states in one line whether the diff touched a **silent-defect surface** — enum or status unions, money vs. people aggregation, cancellation state, migrations, RLS, anything with a DB `CHECK`. That is the class self-review demonstrably misses: rule 8 (PR #33, the union that blanked the clients list), rule 21 (PR #54, the `pre-wrap` surface an audit missed, found *only* in review), two defects in D17 — all green on `tsc`, lint, tests and build, none of them the sort of thing a smoke check would raise. The flag exists so the decision to review is informed rather than intuitive. It is a statement, not a request for permission.

**A PR never phrases self-review as a verdict**, and never implies an independent review ran when none did.

Under the current workflow nothing stops between plan approval and merge, so `/security-review`, CI, and the maintainer's discretionary `/code-review` are the whole of what stands between a defect and the demo.

> `REVIEW.md` is deliberately absent. Only the GitHub App version of Code Review reads it; the local `/code-review` follows **this file**, which is why the numbered rules below are written to be read by a reviewer as much as by an author.

---

## Verification

**Green CI is not verification.** Every CI command reads only the repo (see CI below), so a change touching the DB, Stripe, email or the cron is unverified until it has been exercised for real — this is the shared root of review rules 7, 9 and 11. Anything with fan-out (cron, email, backfill) is verified at runtime before merge, never on tests alone.

**Smoke checks** carry what a human must click. Every step must be **possible with the data that actually exists** and **non-destructive** — one card asked for a Stripe subscription that didn't exist, another told the reader to delete a client for real. What the seeded demo data can and cannot be exercised against is a planning constraint and lives in `openspec/config.yaml` → `context:`.

---

## Git & PR

These are descriptions of what the repo already does, not new proposals — PRs #33–#61 follow them without exception. Match them.

**Branches** are `<type>/<kebab-slug>`, cut from an up-to-date `main`, one per PR, deleted on merge (the repo has no stale branches; keep it that way).

- `task/<change-id>` — implementing an OpenSpec change. The slug is the **change id exactly**, so the branch, the folder under `openspec/changes/`, and the archive branch all read as one unit.
- `fix/` · `feat/` · `docs/` · `chore/` — anything without an OpenSpec change behind it.
- `chore/archive-<change-id>` — the archive PR.

**Commits** are Conventional Commits (`type(scope): description`), subject in **English** (unified in #38; older Spanish subjects are history, don't imitate them). The scope is the surface — `portal`, `admin`, `ui`, `openspec`, `claude`, `backlog`. **No `Co-Authored-By:` trailer** — the trailer on commits before #61 is history, don't imitate it.

**PRs are squash-merged.** The squash subject is the PR title, so **the PR title is a Conventional Commit** — GitHub appends `(#NN)`. No merge commits: the `Merge: Fase 6 …` commits are from a retired flow. `main` is therefore linear, and one PR is one commit.

**An OpenSpec change ships as two PRs, in order:**

1. `task/<change-id>` — the implementation. Merges once CI is green.
2. `chore/archive-<change-id>` — `/opsx:archive` plus the delta-spec sync, cut *after* the first merged.

They are separate because a change cannot honestly be archived until it has shipped, and because it keeps the spec sync out of a diff that is being reviewed for behavior. Don't collapse them. Don't leave step 2 undone either — an unsynced archive leaves `openspec/specs/` describing a system that no longer exists.

**Merging:** the assistant opens the PR and squash-merges it on green CI, without stopping — that follows from the single gate at plan review. What must be true first: CI green, `/security-review` run if the proposal declared a sensitive surface, runtime verification done for anything CI cannot reach (see Verification), and the PR body carrying the silent-defect flag (see Review). A red CI run is never merged past and never rerun in hope; fix the cause.

⚠ **Never push to** `main` **directly, including docs.** `main` is the live demo. Every change goes branch → Preview URL → PR → green CI → squash merge.

**This one is enforced, not merely written.** `main` carries branch protection with `enforce_admins: true` (so the owner has no bypass), a required `ci` status check, `required_linear_history: true` (squash or rebase only — a merge commit is rejected), and force-push and deletion blocked. `.claude/settings.json` additionally denies the common `git push … main` forms at the tool layer. If a push to `main` is ever rejected, that is the control working — **don't route around it**; open a PR.

⚠ `git user.email` **must** be the address of the GitHub account linked to the Vercel project, or **Vercel blocks** Git auto-deploy.

---

## Platform

- **Targets:** web-app (Next.js App Router, SSR + Server Components)
- **Native wrapper:** none · **Offline:** no · **Installable:** no
- **Hosting:** Vercel (git-connected) · **DB/Auth/Storage:** Supabase Cloud

## Stack

| Layer               | Technology                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Framework           | Next.js 14.2 (App Router) + React 18 + TypeScript 5                                                 |
| DB + Auth + Storage | Supabase (PostgreSQL + RLS + Storage) — project `bgvxaagfnzvzamtxqbkg`                              |
| Payments            | Stripe (MXN subscriptions, 10 Prices). SDK `stripe` v22, `apiVersion` pinned to `2026-05-27.dahlia` |
| UI                  | shadcn/ui + Tailwind CSS 3 · Oswald/Hind · pink `#eddbd8` / lavender `#9982f4`                      |
| CMS Editor          | Tiptap 3 (MIT core)                                                                                 |
| Email               | Resend + React Email (`lib/email/`)                                                                 |
| Charts              | Recharts · **Drag & drop:** dnd-kit · **Validation:** zod · **Sanitization:** sanitize-html         |
| Tests               | Vitest 4 + Testing Library + jsdom                                                                  |
| Package manager     | **npm** (package-lock.json) · Node 20+                                                              |

## Key commands

```bash
npm install                 # install deps (local); npm ci in CI
npm run dev                 # dev server (localhost:3000)
npm run test:run            # run tests once (CI); npm test = watch
npm run lint                # next lint (ESLint)
npx tsc --noEmit            # typecheck
npm run build               # production build
```

> **Local checkout** needs webhook forwarding in another terminal:
> `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
> (the signing secret it prints must match `STRIPE_WEBHOOK_SECRET` in `.env.local`). Without this, `checkout.session.completed` never arrives and `/portal/activando` times out — not a bug.

**Green baseline (2026-07-30):** tsc PASS · lint clean · tests green · build OK.

## Project structure

```
app/            App Router routes — (marketing) · auth · onboarding · portal · admin · api
components/     UI — portal/*, admin/*, auth/*, ui/* (shadcn)
lib/            Logic — content/ (access, queries, history) · admin/ · portal/ · webhooks/ · cron/ · email/ · auth/ · supabase/
                ⚠ cron/ = service-role modules driven by a CRON_SECRET route, NOT by requireAdmin().
                  They take an id and write on its behalf, so they must never be imported from a
                  server action or an admin screen (a form-supplied id would become an arbitrary write).
hooks/          useProgressForm.ts (debounced autosave)
middleware.ts   Gate by role / subscription / onboarding
supabase/migrations/  numbered SQL, all applied (through 019)
scripts/        seed-stripe.ts, seed-demo.ts, backfill-first-invoices.ts (tsx)
__tests__/      Vitest (AAA)
docs/adr/       Durable architectural decisions (numbered; read the directory)
docs/superpowers/  Historical specs/plans/audits/context (reference)
design-handoff-aura/prototype/  Design JSX prototypes (reference)
```

## Environment variables

Local in `.env.local` (see `.env.example`). Production in Vercel (11 vars, Stripe **TEST** during the demo).

```
NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY (server-only)
STRIPE_SECRET_KEY · NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY · STRIPE_WEBHOOK_SECRET
RESEND_API_KEY (empty in dev → email no-op) · RESEND_FROM_EMAIL=no-reply@auramaristany.com
NEXT_PUBLIC_AURA_WHATSAPP · CRON_SECRET · NEXT_PUBLIC_APP_URL
AUTOMATED_MESSAGES_MAX_PER_RUN   # OPTIONAL, default 200 — fan-out cap for the A4 cron
NEXT_PUBLIC_CALENDLY_URL · CALENDLY_WEBHOOK_SIGNING_KEY (server-only; booking webhook)
DEV_DATE=YYYY-MM-DD   # DEV ONLY, gitignored, NEVER in Vercel
```

---

## Design

Visual source: `design-handoff-aura/` — hi-fi prototype (17 screens, build-less React) + `README.md` with **design tokens** and **client domain rules**. `prototype/aura/styles.css` = tokens (pink `#eddbd8`/lavender `#9982f4`, Oswald/Hind, radii, shadows); `components.jsx` = primitives; each `*-*.jsx` = one screen; `assets/logo.png` = logo.

- **Recreate** the UI with the project's libraries (shadcn/Tailwind/Recharts/dnd-kit) — **do not** copy the prototype's JSX (it uses in-browser Babel, not production code).
- **Copy:** warm, 1st person ("Mi progreso"), celebrates achievements, no jargon; **avoid "bienestar"**.
- **Colors come from tokens in** `app/globals.css`, never hand-written hex. If the token is missing, add it — a raw hex in a component means the token system had a gap (D23). Check contrast: 4.5:1 normal text, 3:1 large.
- **Black logo on light backgrounds; skeletons, never spinners.**

The prototype's **product** rules — video-per-exercise, per-set logging, no body metrics — are requirements rather than styling, so they live in `openspec/config.yaml` → `specs` rules, where a change honors them before any code exists. Same for the **precedence** between prototype and shipped code when the two disagree.

The **tap-target floors** (buttons ≥48px, tap targets ≥44px, and the one documented 32px exception) are in that file's `context:` block instead — the only block that also reaches `/opsx:apply`, because that rule has to be in hand when the button is written, not only when it is specified.

---

## Conventions

- **UI language: neutral Mexican Spanish** — **'cliente', never 'clienta'**. Applies to every user-facing string, email, and error message, plus anything written for Aura. Dates capitalized in JS (`charAt(0).toUpperCase()`), not `text-transform`.
- **Data architecture:** **pure** functions (helpers, TDD) kept separate from server-only **queries** (`*-queries.ts`, `import 'server-only'`). Helpers have tests; queries don't.
- **Server Components by default;** `"use client"` only where interactivity is needed. Mutations via **server actions** (`lib/**/*Actions.ts`) or route handlers in `app/api/`.
- **Tests:** Vitest, AAA pattern. Keep the suite green. **New pure logic arrives test-first** — failing test, then the code, then refactor. **Bugs are reproduced before they're fixed:** a test that fails for the stated reason first, so the fix is proven rather than assumed.
- **Migrations:** sequentially numbered SQL in `supabase/migrations/` (see Do not modify). Supabase Management API: send SQL on **ONE single line** (the pipeline eats newlines → `--` comments out the rest).
- **Migrations are run-once; guard only what can plausibly re-execute.** Plain `create table` is correct — don't blanket-add `if not exists`. But seed `insert`s take `on conflict … do nothing` (a repeated apply must not fail on the PK, and must never overwrite content Aura has since edited), and policies use `drop policy if exists` first. **Corollary: never re-run a whole migration file as a smoke check** — it fails on `create table` (42P07), which is a no-op, not a defect (migration 014).
- **Types:** `lib/supabase/types.ts` is maintained **by hand** (include `Relationships: []` per table). Avoid unjustified `as any`/`as unknown as` — only the unavoidable ones from JOINs/SDK, marked `// keep:`. ⚠ A `// keep:` cast justified as "narrower than the DB" is a defect with a comment on it (see review rule 10).
- **Separate data from presentation.**
- **Commits and branches:** see Git & PR.

---

## Framework-specific review rules (Next.js App Router + Supabase + Stripe)

Each rule is one imperative plus the failure it prevents, compressed. **The pointer at the end holds the full story — follow it before overriding a rule**, and don't infer that a short rule is a small one. A proposal names every rule it touches, by number.

**Secrets and identity**

1. **Never expose** `SUPABASE_SERVICE_ROLE_KEY` **or the Stripe secret to the client.** Secrets only in server-only modules.
2. **Identity always from** `getUser()` **on the server** — never trust an ID sent by the client. (INP-4 / EDGE-5)
3. **RLS is the security boundary.** RLS-aware client by default; service-role only when essential **and** behind `requireAdmin()`/`requireAdminPage()` (`lib/admin/auth.ts`). `for all` policies need an explicit `with check` (D20).
4. **Validate all input server-side with zod**; sanitize Tiptap HTML with `sanitize-html` on save (`lib/admin/content-validation.ts`, `sanitize-html.ts`). ⚠ Use the `uuidLike` regex, never `z.string().uuid()` — hand-seeded catalog ids carry no RFC 4122 nibbles, so `.uuid()` rejects every real id. (L2a)
5. **Never pass a third-party or user string into** `ilike`**/**`like` **unescaped** — `%` and `_` are wildcards and `_` is legal in an email → cross-account matching. Use `.eq` on a normalized column, or `escapeLikePattern()`. (Calendly webhook)
6. **Raw Postgres errors →** `logAndGeneric` (server log + generic client message); never leak details.

**Database and types**

7. **Migrate an enum and its DB** `CHECK` **in the same change.** Without the `CHECK`, the insert fails after `saveBlocks`/`savePillarBlocks` have already deleted (D2) → **data loss on save**. (`agendar` block)
8. **A status/enum union is never narrower than the DB** `CHECK`**.** Derive it from `types.ts`, never recopy; index maps as `Record<string, …>` **with a fallback**; unify two maps of the same field. A 6-value union against a 9-value `CHECK` blanked the entire clients list on one `paused` row, untestable until the type is widened. (PR #33) **And an options list comes entirely from one exported constant** — a hand-written extra `<option>` lets the UI offer a value the DB can't store. (D19)
9. **A migration adding an FK to an already-embedded table disambiguates every existing embed in the same change** — `program_variants!program_variant_id(...)`. Two FKs to one target make PostgREST return an **error, not rows**, so readers checking only `!data` degrade silently. (L2b → hotfix #21)
10. **Never populate** `Database["public"]["Functions"]` **in** `types.ts` — it switches embed resolution to the hand-maintained `Relationships: []` and fails `tsc` on *every* join. Call Postgres functions with a local `// keep:` cast **on the client, never on the method**: detaching `supabase.rpc` loses its receiver → a runtime 500 that compiles and passes tests. (D18)
11. **A column or function created in the same change does not merge until its migration is applied and verified against the real database**, and the PR says when. Nothing in CI talks to the DB — the shared root of rules 7, 9 and 10. (D18)
12. **An** `!inner` **join is never the RLS gate.** Filter `published` explicitly; removing `program_series!inner` silently removed the publication gate. (L2a)

**Domain invariants**

13. **A lifecycle state spread across columns gets exactly one derivation.** Call `deriveCancellationState` for "is this subscription ending?" (`status` + `completed_at` + `cancel_at_period_end`), never re-derive. **Read** `cancel_at_period_end` **only after completion** — a graduating client carries it too. (ADR 0003, ADR 0004)
14. **Money figures exclude subscriptions that won't be charged again; people figures include them.** A new KPI declares which side it is on before it is written — the row-set is identical either way, so no test catches it. (ADR 0004)
15. **Portal access only via** `lib/content/subscription-access.ts` (`active`/`trialing`/`past_due`); never duplicate the logic.
16. **Webhooks are idempotent** (upsert `onConflict`), and **the outward call goes before the idempotency gate** — reversed, a retry finds the record written, skips the external effect, and fails permanently and silently. `months_elapsed` is incremented by `invoice.paid`, never computed from dates. (L2c)
17. **Grid-relative day math special-cases the first day of a period.** A date before `current_period_start` has **no cell**; resolved against the grid it wraps to week 4 of the previous period. Invisible for 5 of 7 start weekdays. (A4, PR #14)

**Rendering and hygiene**

18. **Plain-text columns rendered by React need** `sanitizePlainTextBody`**, not** `sanitizePlainText` — React escapes a second time, so a stored `&amp;` reaches the user literally. **Invariant:** such a column may hold HTML-shaped text, so it reaches only escaping sinks (React text, React Email `<Text>`) — never `dangerouslySetInnerHTML` or a raw HTML email body. Pinned in `__tests__/email-send.test.ts`. (A4, PR #15)
19. **Middleware** `matcher` **excludes** `api/webhooks` **and** `api/cron` **as an inline literal** — Next doesn't analyze a referenced constant.
20. **Retiring or renaming an exported symbol updates every** `docs/adr/*.md` **that names it, in the same change.** A stale ADR outlives the symbol, and nothing in CI reads Markdown. (D18)
21. **Enumerate surfaces for a rendering defect by the shape of the content, not by one property spelling — and name the author, not just the writer.** The wrap audit grepped `pre-line` and never `pre-wrap`, and "text authored by Aura" excluded the client's own day notes by definition: same bug, same screen, found only in review. ⚠ `overflow-wrap` is inert on a **flex child** — `min-width: auto` won't shrink below content width, so it needs `minWidth: 0` beside it. Nothing in CI lays out text (jsdom has no line boxes), so this is caught only by eye at ~375px. (PR #54)

---

## Do not modify

- **Any migration in** `supabase/migrations/` — they are all applied. Add the next number, never edit an existing file (don't trust a range written here; check the directory).
- `design-handoff-aura/` and `referencias/` — reference material, not app code.
- **Stripe `apiVersion` `2026-05-27.dahlia`** — don't change without verifying the SDK.
- `.env.local` and any secrets — gitignored.
- Generated: `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`.

---

## MCPs / tools

- **Durable decisions →** `docs/adr/*.md`**.**
- **Playwright MCP:** ask before using (token-heavy).
- **Don't add MCPs, skills or subagents unless explicitly requested.** The global set was retired on purpose (2026-08-01); re-adding one quietly puts a second source of truth beside this file.

---

## CI

Runs on every PR to `main` (`.github/workflows/ci.yml`), failing the PR on any non-zero exit:

```
npm ci  →  npx tsc --noEmit  →  npm run lint  →  npm run test:run  →  npm run build
```

Also **gitleaks** (secret scan, **blocking**, early) and **npm audit** (non-blocking early warning; high/critical advisories are a blocker in the pre-launch verification pass, not on the PR).

⚠ **Every CI command reads only the repo.** The database, Stripe, Vercel config and real data are outside the gate — which is why rules 7–11 exist and why runtime verification is a separate step. CI runs on `pull_request` only, so nothing gates a direct push to `main` — which is why that rule is absolute rather than a precaution.

---

## Deploy

- **Vercel** git-connected: push to `main` → **Production** (`app.auramaristany.com`); branches → **Preview URLs**.
- Repo: `github.com/bijeded/auramaristany` (**public**) → Vercel `project-a24no`.
- **Stripe TEST** during the demo. At launch (`L1`): flip to `sk_live`/`pk_live` + real prices + live webhook + secret; real WhatsApp; demo data cleanup; Preview env vars.
