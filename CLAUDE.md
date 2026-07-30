# Aura Maristany — Web Platform

Holistic health coaching for women 40+. Sells, delivers, and manages training/nutrition/wellness programs as **recurring monthly subscriptions**. The app lives on a subdomain (`app.auramaristany.com`); the marketing site is a separate, independent WordPress that is NOT touched.

- **Status:** Phases 0–5 complete on `main`; **Phase 6 (Polish + Launch) in progress**. Deployed as a **live DEMO** (Stripe in **test mode**, no real charges) for Aura's feedback before production launch.
- **Active backlog:** **`BACKLOG.md`** — pending work only, with **stable IDs** (`A*` Aura feedback · `L*` launch · `D*` deferred) ready for `/opsx:propose "D19 — …"`. On archiving a change, **delete its row** there.
- **Technical SPEC:** `SPEC.md` · **Durable decisions:** `docs/adr/*.md` · **History:** `openspec/changes/archive/` and `docs/superpowers/` (reference).

> **Docs language:** this file, `BACKLOG.md`, `docs/adr/`, and `openspec/` are **English**. The **product UI and anything written for Aura are Mexican Spanish** (see Conventions → UI language).

---

## Platform

- **Targets:** web-app (Next.js App Router, SSR + Server Components)
- **Native wrapper:** none · **Offline:** no · **Installable:** no
- **Hosting:** Vercel (git-connected) · **DB/Auth/Storage:** Supabase Cloud

---

## Stack

| Layer | Technology |
|------|-----------|
| Framework | Next.js 14.2 (App Router) + React 18 + TypeScript 5 |
| DB + Auth + Storage | Supabase (PostgreSQL + RLS + Storage) — project `bgvxaagfnzvzamtxqbkg` |
| Payments | Stripe (MXN subscriptions, 10 Prices). SDK `stripe` v22, `apiVersion` pinned to `2026-05-27.dahlia` |
| UI | shadcn/ui + Tailwind CSS 3 · Oswald/Hind · pink `#eddbd8` / lavender `#9982f4` |
| CMS Editor | Tiptap 3 (MIT core) |
| Email | Resend + React Email (`lib/email/`) |
| Charts | Recharts · **Drag & drop:** dnd-kit · **Validation:** zod · **Sanitization:** sanitize-html |
| Tests | Vitest 4 + Testing Library + jsdom |
| Package manager | **npm** (package-lock.json) · Node 20+ |

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

**Green baseline (2026-07-30):** tsc PASS · lint clean · **719/719 tests** (52 files) · build OK.

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
supabase/migrations/  001–018 (all applied)
scripts/        seed-stripe.ts, seed-demo.ts, backfill-first-invoices.ts (tsx)
__tests__/      Vitest (AAA)
docs/adr/       Durable architectural decisions (0001–0004)
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

Visual source: **`design-handoff-aura/`** — hi-fi prototype (17 screens, build-less React) + `README.md` with **design tokens** and **client domain rules**. `prototype/aura/styles.css` = tokens (pink `#eddbd8`/lavender `#9982f4`, Oswald/Hind, radii, shadows); `components.jsx` = primitives; each `*-*.jsx` = one screen; `assets/logo.png` = logo.

- **Recreate** the UI with the project's libraries (shadcn/Tailwind/Recharts/dnd-kit) — **do not** copy the prototype's JSX (it uses in-browser Babel, not production code).
- **Copy:** warm, 1st person ("Mi progreso"), celebrates achievements, no jargon; **avoid "bienestar"**.
- **Prototype domain rules (honored):** 1 video per exercise; per-set logging (reps + weight, N rows = N sets); **never** body metrics (progress photos OK); exercises in cards; black logo on light backgrounds; buttons ≥48px / tap targets ≥44px; skeletons (no spinners).
  - ⚠ **One documented exception:** the `kg | lb` weight-unit toggle is 32px tall by explicit decision (visually too heavy at 44px next to the compact "Mi registro" header). Scoped to that one control — see `portal-exercise-display` / `portal-performance-display`. Every other tap target keeps the floor above.
- **Colors come from tokens in `app/globals.css`**, never hand-written hex. If the token is missing, add it — a raw hex in a component means the token system had a gap (D23). Check contrast: 4.5:1 normal text, 3:1 large.
- ⚠ **The prototype is the original; the domain evolved.** Where the prototype and `SPEC.md`/code differ on **logic** (e.g. "Mes·Semana" not "Día X de 180"; 4×7 grid not 6×30; Desempeño with no stat cards; no day-type selector), **`SPEC.md` + the shipped code wins**. The prototype wins on **look & feel** (tokens, components, tone).

---

## Conventions

- **UI language: neutral Mexican Spanish** — **'cliente', never 'clienta'**. Applies to every user-facing string, email, and error message, plus anything written for Aura. Dates capitalized in JS (`charAt(0).toUpperCase()`), not `text-transform`.
- **Data architecture:** **pure** functions (helpers, TDD) kept separate from server-only **queries** (`*-queries.ts`, `import 'server-only'`). Helpers have tests; queries don't.
- **Server Components by default;** `"use client"` only where interactivity is needed. Mutations via **server actions** (`lib/**/*Actions.ts`) or route handlers in `app/api/`.
- **Tests:** Vitest, AAA pattern. Keep it green. New pure logic → test.
- **Migrations:** sequentially numbered SQL in `supabase/migrations/`. **Never edit an applied migration** — add a new one. Supabase Management API: send SQL on **ONE single line** (the pipeline eats newlines → `--` comments out the rest).
- **Migrations are run-once; guard only what can plausibly re-execute.** Plain `create table` is correct — don't blanket-add `if not exists`. But seed `insert`s take `on conflict … do nothing` (a repeated apply must not fail on the PK, and must never overwrite content Aura has since edited), and policies use `drop policy if exists` first. **Corollary: never re-run a whole migration file as a smoke check** — it fails on `create table` (42P07), which is a no-op, not a defect (migration 014).
- **Types:** `lib/supabase/types.ts` is maintained **by hand** (include `Relationships: []` per table). Avoid unjustified `as any`/`as unknown as` — only the unavoidable ones from JOINs/SDK, marked `// keep:`. ⚠ A `// keep:` cast justified as "narrower than the DB" is a defect with a comment on it (see review rule 10).
- **Commits:** Conventional Commits (`type(scope): description`). End with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  ⚠ `git user.email` **must** be `francisco.venegas.velasco@gmail.com` (GitHub account `bijeded`) or **Vercel blocks** Git auto-deploy.

---

## Framework-specific review rules (Next.js App Router + Supabase + Stripe)

Each rule is one imperative plus the failure it prevents. The full reasoning lives in the linked ADR or PR — follow the pointer before overriding a rule.

**Secrets and identity**
1. **Never expose `SUPABASE_SERVICE_ROLE_KEY` or the Stripe secret to the client.** Secrets only in server-only modules.
2. **Identity always from `getUser()` on the server** — never trust an ID sent by the client. (INP-4 / EDGE-5)
3. **RLS is the security boundary.** RLS-aware client by default; service-role only when essential **and** behind `requireAdmin()`/`requireAdminPage()` (`lib/admin/auth.ts`). `for all` policies need an explicit `with check` (D20).
4. **Validate all input server-side with zod**; sanitize Tiptap HTML with `sanitize-html` on save (`lib/admin/content-validation.ts`, `sanitize-html.ts`). ⚠ Use the `uuidLike` regex, never `z.string().uuid()` — the catalog's hand-seeded ids carry no RFC 4122 nibbles, so `.uuid()` rejects every real id (L2a).
5. **Never pass a third-party or user string into `ilike`/`like` unescaped** — `%` and `_` are wildcards, and `_` is legal in an email → cross-account matching. Use `.eq` on a normalized column, or `escapeLikePattern()`. (Calendly webhook)
6. **Raw Postgres errors → `logAndGeneric`** (server log + generic client message); never leak details.

**Database and types**
7. **Migrate an enum and its DB `CHECK` in the same change.** A new app-level value without the matching `CHECK` migration fails the insert — and because `saveBlocks`/`savePillarBlocks` delete-then-insert (D2), the delete lands first → **data loss on save**. (`agendar` block)
8. **A status/enum union is never narrower than the DB `CHECK`.** Derive it from `types.ts` with an alias, never recopy; type every map indexed by that field as `Record<string, …>` **with a fallback**; two maps of the same field are one copied table — unify them. A 9-value `CHECK` against a 6-value union blanked the **entire** clients list on one `paused` row, and hid a logic bug that made `incomplete_expired` clients undeletable. Neither `tsc` nor lint sees it, and the case cannot be tested until the type is widened. (PR #33)
   **And an options list rendered by a component comes entirely from one exported constant** — a hand-written extra `<option>`/radio beside a mapped list is the same copied table in JSX, and it lets the UI offer a value the DB `CHECK` cannot store. The cancel modal offered "Prefiero no decir" for months while the server quietly rewrote it to `otro`. (D19)
9. **When a migration adds an FK to a table that is already embedded anywhere, disambiguate every existing embed in the same change** — `program_variants!program_variant_id(...)`. Two FKs to one target make PostgREST return an **error, not rows**, so readers checking only `!data` degrade silently: the portal served rest days to everyone for three PRs. (L2b → hotfix #21)
10. **Never populate `Database["public"]["Functions"]` in `types.ts`** — call Postgres functions with a local `// keep:` cast **on the client, never on the method**. Populating `Functions` switches embed resolution to the hand-maintained `Relationships: []`, failing `tsc` on *every* join in the repo; and detaching `supabase.rpc` into a variable loses its receiver → a runtime 500 that compiles and passes tests (an arrow-function fake never checks `this`). (D18)
11. **A column or function created in the same change does not merge until its migration is applied and verified against the real database**, and the PR says when. Nothing in `tsc`, lint, the tests (they mock the client) or the build talks to the DB — this is the shared root of rules 7, 9 and 10. (D18)
12. **An `!inner` join is never the RLS gate.** Removing `program_series!inner` silently removed the publication gate. Filter `published` explicitly; never rely on a join's RLS side effect to enforce a rule. (L2a)

**Domain invariants**
13. **A lifecycle state spread across columns gets exactly one derivation.** "Is this subscription ending?" lives in `status` + `completed_at` + `cancel_at_period_end` — call `deriveCancellationState`, never re-derive. **Precedence matters: read `cancel_at_period_end` only after completion**, since a graduating client carries it too. Five readers each derived it differently and each was wrong about a different case. (ADR 0003, ADR 0004)
14. **Money figures exclude subscriptions that won't be charged again; people figures include them.** A new KPI declares which side it is on before it is written — picking wrong is invisible to every test, since the row-set is identical either way. (ADR 0004)
15. **Portal access only via `lib/content/subscription-access.ts`** (`active`/`trialing`/`past_due`); never duplicate the logic.
16. **Webhooks are idempotent** (upsert `onConflict`), and **the outward call goes before the idempotency gate** — in the reverse order a retry finds the record already written, skips the external effect, and the failure is permanent and silent. `months_elapsed` is incremented by `invoice.paid`, never computed from dates. (L2c)
17. **Grid-relative day math special-cases the first day of a period.** A date before `current_period_start` has **no cell**; resolving it against the grid wraps to a week-4 cell of the previous period. Invisible for 5 of 7 start weekdays. (A4, PR #14)

**Rendering and hygiene**
18. **Plain-text columns rendered by React need `sanitizePlainTextBody`, not `sanitizePlainText`** — React escapes a second time, so a stored `&amp;` reaches the user literally. **Invariant:** such a column may hold HTML-shaped text, so it must reach only escaping sinks (React text, React Email `<Text>`) — never `dangerouslySetInnerHTML` or a raw HTML email body. Pinned in `__tests__/email-send.test.ts`. (A4, PR #15)
19. **Middleware `matcher` excludes `api/webhooks` and `api/cron` as an inline literal** — Next doesn't analyze a referenced constant.
20. **Retiring or renaming an exported symbol updates every `docs/adr/*.md` that names it, in the same change.** An ADR is what a future reader consults before the code, so a stale one outlives the symbol. Neither `tsc` nor lint reads Markdown. (D18)
21. **Enumerate surfaces for a rendering defect by the shape of the content, not by one property spelling.** "Every place that renders authored free text" is the real surface list; `whiteSpace: "pre-line"` is one way to grep for it. The long-word-wrap audit grepped `pre-line` and never `pre-wrap`, so it missed the client's own day notes — the identical bug, on the identical screen, found only by the code review. **Corollary: name the author, not just the writer.** The same spec said "text authored by Aura" and would have excluded day notes *by definition*, since the client writes those. ⚠ And `overflow-wrap` is inert on a **flex child**: `min-width: auto` refuses to shrink below content width, so the property needs `minWidth: 0` beside it (`MessagesAdmin` subject `<h2>`; the message-list preview is correct today for exactly this reason). Nothing in `tsc`, lint, the tests or the build lays out text — jsdom has no line boxes — so a CSS defect is caught only by eye at ~375px. (PR #54)

---

## Do not modify

- **Any applied migration** (`supabase/migrations/001–018`) — add a new one, never edit.
- **`design-handoff-aura/`** and **`referencias/`** — reference material, not app code.
- **Stripe `apiVersion` `2026-05-27.dahlia`** — don't change without verifying the SDK.
- **`.env.local`** and any secrets — gitignored.
- Generated: `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`.

---

## Workflow (OpenSpec + global dev-loop)

```
/opsx:propose  →  task-execution  →  /opsx:sync + openspec validate  →  /opsx:archive
```

- Non-trivial features: `/opsx:explore` (or `user-stories`) first, then `/opsx:propose`.
- `task-execution` orchestrates: `tdd` → `code-review` (subagent) → `security-review` (conditional) → `github-pr`. (Native alternative: `/opsx:apply`.)
- Close with `/opsx:archive`, then delete the item's row in `BACKLOG.md`. (OpenSpec v1.5, `core` profile: `/opsx:verify` doesn't exist.)
- Bugs: `bug-fix` (reproduce-first; hotfix variant).
- **Discuss before implementing**; separate data from presentation; respect the agreed scope.
- **No PR without a `code-review` verdict** — and a `security-review` verdict too if the diff touches a sensitive surface. Docs-only diffs say so explicitly rather than implying a verdict exists.
- ⚠ **`main` = Production for the demo Aura sees.** All work on a branch → Preview URL → PR → green CI → merge. **Never push to `main` directly, including docs**; don't break the demo.

> **Don't use the `superpowers:*` flow** as a process — replaced by OpenSpec + the global loop. `docs/superpowers/` is history, not an active flow.

## Implementation mode

**Disciplined** (`task-execution`) is the default and has earned it — it caught two production-grade defects in D17 alone that fast mode would have shipped. Feature branches, CI-gated PR, merge after review + green CI. Fast mode (`/opsx:apply`) skips per-task TDD, per-task review, and **all runtime verification** — so any change with fan-out (cron, email, backfill) stays disciplined.

## Model routing

| Step | Model |
|------|--------|
| Default implementation | Sonnet |
| Architecture · spec/plan | Opus |
| Mechanical (renames, boilerplate, formatting) | Haiku |
| `code-reviewer` / `security-reviewer` subagents | **Opus** (pinned in the agent definitions) |

⚠ `CLAUDE_CODE_SUBAGENT_MODEL`, if set, silently overrides both reviewers' pinned Opus. Leave it unset.

## Skills

- `task-execution`, `tdd`, `code-review`, `github-pr` (global — dev loop)
- `security-review` (global — conditional subagent for sensitive changes)
- `bug-fix` (global — reproduce-first defects, with hotfix variant)
- `user-stories` (global — elicitation with a human-review gate before `/opsx:propose`)
- `production-checklist` (global — pre-launch verification, before opening to real clients)
- OpenSpec `/opsx:*` (propose/explore/apply/sync/archive) + `openspec validate`

**Smoke cards** (`task-execution` Step 5.5 Path B) carry the checks a human must click. Every step must be **possible** with the data that exists and **non-destructive** — a card has asked for a Stripe subscription that didn't exist, and another told the reader to delete a client for real.

## MCPs / tools

- **Codebase-memory:** prefer graph tools (`search_graph`, `trace_path`, `get_architecture`, `detect_changes`) over grep for "who calls X / impact / dead code" — grep matches substrings, the graph matches symbols (`sendReminder` greps into `sendReminderBatch`). Durable decisions → `docs/adr/*.md`, **not** `manage_adr`.
- **Playwright MCP:** ask before using (token-heavy).
- Don't add MCPs/skills/agents beyond those listed unless explicitly requested.

## Codebase memory

Project indexed as `Users-franciscovenegas-Desktop-Cowork-Aura`. Re-index in `fast` mode after archiving a change so the snapshot doesn't drift; `detect_changes()` reads the live working diff without re-indexing.

⚠ **`fast` mode excludes more than `full`:** it also drops `docs/`, `__tests__/`, `scripts/` and `supabase/migrations/`. Use `full` when impact analysis needs test, script, or migration coverage.

---

## CI

Runs on every PR to `main` (`.github/workflows/ci.yml`), failing the PR on any non-zero exit:

```
npm ci  →  npx tsc --noEmit  →  npm run lint  →  npm run test:run  →  npm run build
```

Also **gitleaks** (secret scan, **blocking**, early) and **npm audit** (non-blocking early warning; the launch gate is `production-checklist`).

⚠ **Every CI command reads only the repo.** The database, Stripe, Vercel config and real data are outside the gate — which is why rules 7–11 exist and why runtime verification is a separate step.

---

## Deploy

- **Vercel** git-connected: push to `main` → **Production** (`app.auramaristany.com`); branches → **Preview URLs**.
- Repo: `github.com/bijeded/auramaristany` (private) → Vercel `project-a24no`.
- **Stripe TEST** during the demo. At launch (`L1`): flip to `sk_live`/`pk_live` + real prices + live webhook + secret; real WhatsApp; demo data cleanup; Preview env vars.
