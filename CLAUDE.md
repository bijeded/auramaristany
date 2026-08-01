# Aura Maristany — Web Platform

Holistic health coaching for women 40+. Sells, delivers, and manages training/nutrition/wellness programs as **recurring monthly subscriptions**. The app lives on a subdomain (`app.auramaristany.com`); the marketing site is a separate, independent WordPress that is NOT touched.

- **Status:** Phases 0–5 complete on `main`; **Phase 6 (Polish + Launch) in progress**. Deployed as a **live DEMO** (Stripe in **test mode**, no real charges) for Aura's feedback before production launch.
**Sources of truth — three, each with one job:**

| File | Job |
|---|---|
| **`CLAUDE.md`** (this file) | **how** we work — conventions, review rules, workflow |
| **`openspec/specs/`** | **what** the system does today |
| **`docs/adr/`** | **why** the hard decisions went the way they did |

`openspec/config.yaml` is the one other file carrying process: the per-artifact rules and apply/archive guidance OpenSpec injects while generating a change. It points here instead of restating this file — **the rule and its reasoning live here; the trigger lives there.** History, not authority: `openspec/changes/archive/` and `docs/superpowers/` (which holds the frozen `SPEC.md`).

> **Docs language:** this file, `docs/adr/`, and `openspec/` are **English**. The **product UI and anything written for Aura are Mexican Spanish** (see Conventions → UI language).

---



## Platform

- **Targets:** web-app (Next.js App Router, SSR + Server Components)
- **Native wrapper:** none · **Offline:** no · **Installable:** no
- **Hosting:** Vercel (git-connected) · **DB/Auth/Storage:** Supabase Cloud

---



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


---



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

---



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

---



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
- **Prototype domain rules (honored):** 1 video per exercise; per-set logging (reps + weight, N rows = N sets); **never** body metrics (progress photos OK); exercises in cards; black logo on light backgrounds; buttons ≥48px / tap targets ≥44px; skeletons (no spinners).
  - ⚠ **One documented exception:** the `kg | lb` weight-unit toggle is 32px tall by explicit decision (visually too heavy at 44px next to the compact "Mi registro" header). Scoped to that one control — see `portal-exercise-display` / `portal-performance-display`. Every other tap target keeps the floor above.
- **Colors come from tokens in** `app/globals.css`, never hand-written hex. If the token is missing, add it — a raw hex in a component means the token system had a gap (D23). Check contrast: 4.5:1 normal text, 3:1 large.
- ⚠ **The prototype is the original; the domain evolved.** Where the prototype and the code differ on **logic** (e.g. "Mes·Semana" not "Día X de 180"; 4×7 grid not 6×30; Desempeño with no stat cards; no day-type selector), **the shipped code wins, with `openspec/specs/*` as the written authority**. The prototype wins on **look & feel** (tokens, components, tone).

---



## Conventions

- **UI language: neutral Mexican Spanish** — **'cliente', never 'clienta'**. Applies to every user-facing string, email, and error message, plus anything written for Aura. Dates capitalized in JS (`charAt(0).toUpperCase()`), not `text-transform`.
- **Data architecture:** **pure** functions (helpers, TDD) kept separate from server-only **queries** (`*-queries.ts`, `import 'server-only'`). Helpers have tests; queries don't.
- **Server Components by default;** `"use client"` only where interactivity is needed. Mutations via **server actions** (`lib/**/*Actions.ts`) or route handlers in `app/api/`.
- **Tests:** Vitest, AAA pattern. Keep it green. New pure logic → test.
- **Migrations:** sequentially numbered SQL in `supabase/migrations/`. **Never edit an applied migration** — add a new one. Supabase Management API: send SQL on **ONE single line** (the pipeline eats newlines → `--` comments out the rest).
- **Migrations are run-once; guard only what can plausibly re-execute.** Plain `create table` is correct — don't blanket-add `if not exists`. But seed `insert`s take `on conflict … do nothing` (a repeated apply must not fail on the PK, and must never overwrite content Aura has since edited), and policies use `drop policy if exists` first. **Corollary: never re-run a whole migration file as a smoke check** — it fails on `create table` (42P07), which is a no-op, not a defect (migration 014).
- **Types:** `lib/supabase/types.ts` is maintained **by hand** (include `Relationships: []` per table). Avoid unjustified `as any`/`as unknown as` — only the unavoidable ones from JOINs/SDK, marked `// keep:`. ⚠ A `// keep:` cast justified as "narrower than the DB" is a defect with a comment on it (see review rule 10).
- **Commits:** Conventional Commits (`type(scope): description`). End with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
  ⚠ `git user.email` **must** be `francisco.venegas.velasco@gmail.com` (GitHub account `bijeded`) or **Vercel blocks** Git auto-deploy.

---



## Framework-specific review rules (Next.js App Router + Supabase + Stripe)

Each rule is one imperative plus the failure it prevents. The full reasoning lives in the linked ADR or PR — follow the pointer before overriding a rule.

**Secrets and identity**

1. **Never expose** `SUPABASE_SERVICE_ROLE_KEY` **or the Stripe secret to the client.** Secrets only in server-only modules.
2. **Identity always from** `getUser()` **on the server** — never trust an ID sent by the client. (INP-4 / EDGE-5)
3. **RLS is the security boundary.** RLS-aware client by default; service-role only when essential **and** behind `requireAdmin()`/`requireAdminPage()` (`lib/admin/auth.ts`). `for all` policies need an explicit `with check` (D20).
4. **Validate all input server-side with zod**; sanitize Tiptap HTML with `sanitize-html` on save (`lib/admin/content-validation.ts`, `sanitize-html.ts`). ⚠ Use the `uuidLike` regex, never `z.string().uuid()` — the catalog's hand-seeded ids carry no RFC 4122 nibbles, so `.uuid()` rejects every real id (L2a).
5. **Never pass a third-party or user string into** `ilike`**/**`like` **unescaped** — `%` and `_` are wildcards, and `_` is legal in an email → cross-account matching. Use `.eq` on a normalized column, or `escapeLikePattern()`. (Calendly webhook)
6. **Raw Postgres errors →** `logAndGeneric` (server log + generic client message); never leak details.

**Database and types**
7. **Migrate an enum and its DB** `CHECK` **in the same change.** A new app-level value without the matching `CHECK` migration fails the insert — and because `saveBlocks`/`savePillarBlocks` delete-then-insert (D2), the delete lands first → **data loss on save**. (`agendar` block)
8. **A status/enum union is never narrower than the DB** `CHECK`**.** Derive it from `types.ts` with an alias, never recopy; type every map indexed by that field as `Record<string, …>` **with a fallback**; two maps of the same field are one copied table — unify them. A 9-value `CHECK` against a 6-value union blanked the **entire** clients list on one `paused` row, and hid a logic bug that made `incomplete_expired` clients undeletable. Neither `tsc` nor lint sees it, and the case cannot be tested until the type is widened. (PR #33)
   **And an options list rendered by a component comes entirely from one exported constant** — a hand-written extra `<option>`/radio beside a mapped list is the same copied table in JSX, and it lets the UI offer a value the DB `CHECK` cannot store. The cancel modal offered "Prefiero no decir" for months while the server quietly rewrote it to `otro`. (D19)
9. **When a migration adds an FK to a table that is already embedded anywhere, disambiguate every existing embed in the same change** — `program_variants!program_variant_id(...)`. Two FKs to one target make PostgREST return an **error, not rows**, so readers checking only `!data` degrade silently: the portal served rest days to everyone for three PRs. (L2b → hotfix #21)
10. **Never populate** `Database["public"]["Functions"]` **in** `types.ts` — call Postgres functions with a local `// keep:` cast **on the client, never on the method**. Populating `Functions` switches embed resolution to the hand-maintained `Relationships: []`, failing `tsc` on *every* join in the repo; and detaching `supabase.rpc` into a variable loses its receiver → a runtime 500 that compiles and passes tests (an arrow-function fake never checks `this`). (D18)
11. **A column or function created in the same change does not merge until its migration is applied and verified against the real database**, and the PR says when. Nothing in `tsc`, lint, the tests (they mock the client) or the build talks to the DB — this is the shared root of rules 7, 9 and 10. (D18)
12. **An** `!inner` **join is never the RLS gate.** Removing `program_series!inner` silently removed the publication gate. Filter `published` explicitly; never rely on a join's RLS side effect to enforce a rule. (L2a)

**Domain invariants**
13. **A lifecycle state spread across columns gets exactly one derivation.** "Is this subscription ending?" lives in `status` + `completed_at` + `cancel_at_period_end` — call `deriveCancellationState`, never re-derive. **Precedence matters: read** `cancel_at_period_end` **only after completion**, since a graduating client carries it too. Five readers each derived it differently and each was wrong about a different case. (ADR 0003, ADR 0004)
14. **Money figures exclude subscriptions that won't be charged again; people figures include them.** A new KPI declares which side it is on before it is written — picking wrong is invisible to every test, since the row-set is identical either way. (ADR 0004)
15. **Portal access only via** `lib/content/subscription-access.ts` (`active`/`trialing`/`past_due`); never duplicate the logic.
16. **Webhooks are idempotent** (upsert `onConflict`), and **the outward call goes before the idempotency gate** — in the reverse order a retry finds the record already written, skips the external effect, and the failure is permanent and silent. `months_elapsed` is incremented by `invoice.paid`, never computed from dates. (L2c)
17. **Grid-relative day math special-cases the first day of a period.** A date before `current_period_start` has **no cell**; resolving it against the grid wraps to a week-4 cell of the previous period. Invisible for 5 of 7 start weekdays. (A4, PR #14)

**Rendering and hygiene**
18. **Plain-text columns rendered by React need** `sanitizePlainTextBody`**, not** `sanitizePlainText` — React escapes a second time, so a stored `&amp;` reaches the user literally. **Invariant:** such a column may hold HTML-shaped text, so it must reach only escaping sinks (React text, React Email `<Text>`) — never `dangerouslySetInnerHTML` or a raw HTML email body. Pinned in `__tests__/email-send.test.ts`. (A4, PR #15)
19. **Middleware** `matcher` **excludes** `api/webhooks` **and** `api/cron` **as an inline literal** — Next doesn't analyze a referenced constant.
20. **Retiring or renaming an exported symbol updates every** `docs/adr/*.md` **that names it, in the same change.** An ADR is what a future reader consults before the code, so a stale one outlives the symbol. Neither `tsc` nor lint reads Markdown. (D18)
21. **Enumerate surfaces for a rendering defect by the shape of the content, not by one property spelling.** "Every place that renders authored free text" is the real surface list; `whiteSpace: "pre-line"` is one way to grep for it. The long-word-wrap audit grepped `pre-line` and never `pre-wrap`, so it missed the client's own day notes — the identical bug, on the identical screen, found only by the code review. **Corollary: name the author, not just the writer.** The same spec said "text authored by Aura" and would have excluded day notes *by definition*, since the client writes those. ⚠ And `overflow-wrap` is inert on a **flex child**: `min-width: auto` refuses to shrink below content width, so the property needs `minWidth: 0` beside it (`MessagesAdmin` subject `<h2>`; the message-list preview is correct today for exactly this reason). Nothing in `tsc`, lint, the tests or the build lays out text — jsdom has no line boxes — so a CSS defect is caught only by eye at ~375px. (PR #54)

---



## Do not modify

- **Any migration in** `supabase/migrations/` — they are all applied. Add the next number, never edit an existing file (don't trust a range written here; check the directory).
- `design-handoff-aura/` and `referencias/` — reference material, not app code.
- **Stripe `apiVersion` `2026-05-27.dahlia`** — don't change without verifying the SDK.
- `.env.local` and any secrets — gitignored.
- Generated: `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`.

---



## Workflow (OpenSpec for the what · Opus for the how)

```
/opsx:propose  →  /opsx:apply  →  /opsx:archive
```

**OpenSpec owns the *what*** — proposal, delta specs, task list. **The *how* is Opus's judgment, governed by this file.** There is no orchestrator skill: the discipline below is the process, so a rule that isn't written here isn't enforced anywhere.

- Non-trivial features: `/opsx:explore` first, then `/opsx:propose`.
- `/opsx:apply` works the task list. ⚠ It has **no built-in review or runtime step** — those are the two sections below, and they are not optional just because `apply` reports the tasks done.
- Close with `/opsx:archive`. **Say yes to the delta-spec sync it offers** — archive does not merge the deltas into `openspec/specs/` on its own, and once the change folder is gone nothing is left to notice they never landed.
- **Discuss before implementing**; separate data from presentation; respect the agreed scope.
- **New pure logic arrives test-first** — failing test, then the code, then refactor. Helpers get tests; queries don't (see Conventions). Keep the suite green.
- **Bugs are reproduced before they're fixed:** a test that fails for the stated reason first, so the fix is proven rather than assumed.
- ⚠ `main` **= Production for the demo Aura sees.** All work on a branch → Preview URL → PR → green CI → merge. **Never push to** `main` **directly, including docs**; don't break the demo.

> **Don't use the `superpowers:*` flow** as a process. `docs/superpowers/` is history, not an active flow.



## Review

⚠ **There is currently no independent reviewer.** The `code-reviewer`/`security-reviewer` subagents were retired 2026-08-01; a replacement step is being designed. Until it exists:

- **A PR states plainly that no independent review ran.** Never phrase self-review so it reads like a verdict, and never imply one exists for a docs-only diff.
- **Self-review is the weak kind and the record says so** — rule 8 (PR #33, the union that blanked the clients list), rule 21 (PR #54, the `pre-wrap` surface an audit missed, found *only* in review), and two defects in D17. All were green on `tsc`, lint, tests and build. Assume that class of defect is now escaping.
- **So compensate where it lands hardest:** any diff touching a sensitive surface (auth, RLS, service-role, webhooks, money, migrations) or with fan-out (cron, email, backfill) gets a deliberate second pass in a fresh context — not a re-read in the same one — before merge.



## Verification

**Green CI is not verification.** Every CI command reads only the repo (see CI below), so a change touching the DB, Stripe, email or the cron is unverified until it has been exercised for real — this is the shared root of review rules 7, 9 and 11. Anything with fan-out (cron, email, backfill) is verified at runtime before merge, never on tests alone.

**Smoke checks** carry what a human must click. Every step must be **possible with the data that actually exists** and **non-destructive** — one card asked for a Stripe subscription that didn't exist, another told the reader to delete a client for real. ⚠ Demo subscriptions carry synthetic Stripe ids (`sub_seed_*`), so no Stripe-touching flow — cancel, reactivate — can be exercised on seeded data at all.

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

⚠ **Every CI command reads only the repo.** The database, Stripe, Vercel config and real data are outside the gate — which is why rules 7–11 exist and why runtime verification is a separate step.

---



## Deploy

- **Vercel** git-connected: push to `main` → **Production** (`app.auramaristany.com`); branches → **Preview URLs**.
- Repo: `github.com/bijeded/auramaristany` (private) → Vercel `project-a24no`.
- **Stripe TEST** during the demo. At launch (`L1`): flip to `sk_live`/`pk_live` + real prices + live webhook + secret; real WhatsApp; demo data cleanup; Preview env vars.

