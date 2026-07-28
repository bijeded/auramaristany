# Aura Maristany — Web Platform

Holistic health coaching for women 40+. Sells, delivers, and manages training/nutrition/wellness programs as **recurring monthly subscriptions**. The app lives on a subdomain (`app.auramaristany.com`); the marketing site is a separate, independent WordPress that is NOT touched.

- **Status:** Phases 0–5 complete on `main`; **Phase 6 (Polish + Launch) in progress**. Deployed as a **live DEMO** (Stripe in **test mode**, no real charges) for Aura's feedback before production launch.
- **Active backlog:** **`BACKLOG.md`** — pending work with **stable IDs** (`A*` Aura feedback · `L*` launch · `D*` deferred) ready for `/opsx:propose "A2 — …"`. Update it when archiving a change.
- **Technical SPEC:** `SPEC.md` · **Detailed handoff:** `handoff.md` · **History by sub-block:** `docs/superpowers/` (specs/plans/audits/context — historical).

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

**Green baseline (2026-07-27):** tsc PASS · lint clean · **450/450 tests** · build OK.

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
supabase/migrations/  001–014 (applied)
scripts/        seed-stripe.ts, seed-demo.ts, backfill-first-invoices.ts (tsx)
__tests__/      Vitest (AAA)
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
- ⚠ **The prototype is the original; the domain evolved.** Where the prototype and `SPEC.md`/code differ on **logic** (e.g. "Mes·Semana" not "Día X de 180"; 4×7 grid not 6×30; Desempeño with no stat cards; no day-type selector), **`SPEC.md` + the shipped code wins**. The prototype wins on **look & feel** (tokens, components, tone).

---

## Conventions

- **UI language:** neutral Mexican Spanish — **'cliente', never 'clienta'**. Dates capitalized in JS (`charAt(0).toUpperCase()`), not `text-transform`.
- **Data architecture:** **pure** functions (helpers, TDD) kept separate from server-only **queries** (`*-queries.ts`, `import 'server-only'`). Helpers have tests; queries don't.
- **Server Components by default;** `"use client"` only where interactivity is needed. Mutations via **server actions** (`lib/**/*Actions.ts`) or route handlers in `app/api/`.
- **Tests:** Vitest, AAA pattern. Keep it green. New pure logic → test.
- **Migrations:** sequentially numbered SQL in `supabase/migrations/`. **Never edit an already-applied migration** — add a new one. Supabase Management API: send SQL on **ONE single line** (the pipeline eats newlines → `--` comments out everything after it).
- **Migrations are run-once; guard only what can plausibly re-execute.** Plain `create table` is correct — do **not** blanket-add `if not exists`. But any statement that could legitimately run a second time needs its guard: **seed `insert`s take `on conflict … do nothing`** (a repeated apply must not fail on the PK, and must never overwrite content the admin has since edited), and policies use `drop policy if exists` before `create policy`. Corollary for verification steps: **never ask for a whole migration file to be re-run** as a smoke check — it will fail on `create table` (42P07), which is a no-op, not a defect (lesson from migration 014).
- **Types:** `lib/supabase/types.ts` is maintained **by hand** (include `Relationships: []` per table). Avoid unjustified `as any`/`as unknown as` (only the unavoidable ones from JOINs/SDK, marked `// keep:`).
- **Commits:** Conventional Commits (`type(scope): description`). End with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  ⚠ `git user.email` **must** be `francisco.venegas.velasco@gmail.com` (GitHub account `bijeded`) or **Vercel blocks** Git auto-deploy.

---

## Framework-specific review rules (Next.js App Router + Supabase + Stripe)

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` or the Stripe secret to the client. Secrets only in server-only modules.
- **Identity always from `getUser()` on the server** — never trust IDs sent by the client (lesson from INP-4/EDGE-5).
- **RLS is the security boundary.** RLS-aware client by default; service-role only when essential **and** behind `requireAdmin()`/`requireAdminPage()` (`lib/admin/auth.ts`). RLS with explicit `with check` on `for all` policies.
- **Validate all input server-side with zod**; sanitize Tiptap HTML with `sanitize-html` on save (`lib/admin/content-validation.ts`, `sanitize-html.ts`).
- **Idempotent webhooks** (upsert `onConflict`). `months_elapsed` is the immutable arbiter of access — it's incremented by `invoice.paid`, never computed from dates.
- **Portal access** via `lib/content/subscription-access.ts` (`active`/`trialing`/`past_due`); don't duplicate the logic.
- **Middleware `matcher`** must exclude `api/webhooks` and `api/cron` (inline literal — Next doesn't analyze a referenced constant).
- Raw Postgres errors → `logAndGeneric` (server-side log + generic message to the client); don't leak details.
- **Enum/union values mirrored by a DB `CHECK` constraint must be migrated together.** Adding an app-level value (e.g. a new `block_type` in `content-validation.ts`/`BlockListEditor.tsx`) without a matching migration to the `CHECK` constraint (`program_day_blocks_block_type_check`, last set in 004→013) fails the insert; because `saveBlocks`/`savePillarBlocks` delete-then-insert (non-atomic, D2), the delete lands first → **data loss on save**. Ship the migration in the same change (lesson from the `agendar` block).
- **A second FK to the same table breaks every existing embed of it.** PostgREST resolves `subscriptions(program_variants(...))` by *relationship*, not by column; the moment a table has two FKs to the same target (migration 016 added `subscriptions.content_variant_id` next to `program_variant_id`), every embed — including `!inner` ones — fails with `Could not embed because more than one relationship was found`. The query returns an **error, not rows**, so readers that only check `!data` degrade silently: the portal renders a rest day, the webhook logs "subscription not found" and returns 200, and Stripe never retries. Nothing in `tsc`, lint, the unit tests or the build catches it — the tests mock the client and the build never talks to the DB. **When a migration adds an FK to a table that is already embedded anywhere, disambiguate every existing embed in the same change** with the column hint (`program_variants!program_variant_id(...)`, `program_variants!program_variant_id!inner(...)`) and verify each select against the real database. (Lesson from L2b PR2, caught by the §8 smoke after it had already shipped to production.)
- **Never pass third-party/user strings into `ilike`/`like` unescaped.** `%` and `_` are LIKE wildcards (and `_` is a valid email char) → wildcard-injection / cross-account matching. Use `.eq` on a normalized column, or `escapeLikePattern()` (lesson from the Calendly webhook email→profile mapping).
- **Grid-relative day math must special-case the first day of a period.** `getCurrentDayKey` resolves a `(week, weekday)` cell from `current_period_start`, so any rule comparing today's cell against *yesterday's* has to treat a date before `current_period_start` as "no cell" — resolving it against the grid wraps to a week-4 cell from the previous period and produces a wrong answer at exactly the boundary. Same family as the EDGE-3 `getUTCDay` lesson: the bug is invisible for 5 of 7 start weekdays and only appears for the other 2 (lesson from the A4 booking reminder, PR #14).
- **Plain-text columns rendered by React need `sanitizePlainTextBody`, not `sanitizePlainText`.** `sanitizePlainText` escapes `&`, `<`, `>`, `"`, `'` into entities; if the value is later rendered as a React text child (`white-space: pre-line`) React escapes it *again*, so a stored `&amp;` reaches the user as literal `&amp;`. `sanitizePlainTextBody` decodes once (with `&amp;` last, so `&amp;lt;` stays `&lt;`). **Invariant:** a column sanitized that way can hold HTML-shaped text, so it must never reach `dangerouslySetInnerHTML` or a raw HTML email body — only escaping sinks (React text, React Email `<Text>`). Pinned by a test in `__tests__/email-send.test.ts` (lesson from A4 PR #15).

---

## Do not modify

- **Already-applied migrations** `supabase/migrations/001–010` — add a new one, never edit.
- **`design-handoff-aura/`** and **`referencias/`** — reference material, not app code.
- **Stripe `apiVersion` `2026-05-27.dahlia`** — don't change without verifying the SDK.
- **`.env.local`** and any secrets — gitignored.
- Generated: `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`.

---

## Workflow (OpenSpec + global dev-loop)

This project uses **OpenSpec** + the global dev-loop skills. Flow per change:

```
/opsx:propose  →  task-execution  →  /opsx:sync + openspec validate  →  /opsx:archive
```

- For non-trivial features: optional `user-stories` first, then `/opsx:propose` (or `/opsx:explore`).
- `task-execution` orchestrates the implementation: `tdd` → `code-review` (subagent) → `security-review` (conditional) → `github-pr`. (Native OpenSpec alternative: `/opsx:apply`.)
- Reconcile specs with `/opsx:sync`; validate a change with `openspec validate`; close with `/opsx:archive`. (OpenSpec v1.5, `core` profile: `/opsx:verify` doesn't exist.)
- Bugs: `bug-fix` (reproduce-first; hotfix variant).
- **Discuss before implementing**; separate data from presentation; respect the agreed scope.
- ⚠ **`main` = Production for the demo Aura sees.** WIP always on a branch → Preview URL. Don't commit features directly to `main` without agreement; don't break the demo.

> **Don't use the `superpowers:*` flow** (brainstorming, writing-plans, subagent-driven-development, executing-plans, etc.) as a process — it was replaced by OpenSpec + the global loop. The `docs/superpowers/` directory remains as history, not as an active flow.

## Implementation mode

Execute OpenSpec tasks with the `task-execution` loop. Feature branches (`feature/...`), CI-gated PR, merge to `main` after review + green CI.

## Model routing

| Step | Model |
|------|--------|
| Default implementation | Sonnet |
| Architecture · spec/plan · security-review | Opus |
| Mechanical (renames, boilerplate, formatting) | Haiku |
| Code-review (subagent) | Sonnet (Opus if security-sensitive) |

## Skills

- `task-execution`, `tdd`, `code-review`, `github-pr` (global — dev loop)
- `security-review` (global — conditional subagent for sensitive changes)
- `bug-fix` (global — reproduce-first defects, with hotfix variant)
- `user-stories` (global — elicitation with a human-review gate before `/opsx:propose`)
- `handoff` (global — generates HANDOFF.md to continue in another chat)
- `production-checklist` (global — pre-launch verification, before opening to real clients)
- OpenSpec `/opsx:*` (propose/explore/apply/sync/archive) + `openspec validate`

## MCPs / tools

- **Codebase-memory:** indexed (see "Codebase memory"). Prefer graph tools (`search_graph`, `trace_path`, `get_architecture`, `detect_changes`) over grep for "who calls X / impact / dead code". (Durable decisions → `docs/adr/*.md`, not the graph's `manage_adr`.)
- **Playwright MCP:** ask before using (token-heavy).
- Don't add MCPs/skills/agents beyond those listed unless explicitly requested.

## Codebase memory

Project indexed in codebase-memory (`Users-franciscovenegas-Desktop-Cowork-Aura`). Re-index after archiving a change so the snapshot doesn't drift; `detect_changes()` reads the live working diff without re-indexing.

⚠ Gotcha, learned the hard way:
- **`fast` mode excludes more than `full`:** it also drops `docs/`, `__tests__/`, `scripts/` and `supabase/migrations/`. Use `full` when you need test or script coverage for impact analysis.

We do **not** use the codebase-memory ADR feature (`manage_adr`). Durable architectural decisions live in `docs/adr/*.md` only.

---

## CI

CI runs on every PR to `main` (`.github/workflows/ci.yml`), in order, failing the PR if any command exits with a non-zero code:

```
npm ci  →  npx tsc --noEmit  →  npm run lint  →  npm run test:run  →  npm run build
```

Also: **gitleaks** (secret scan, **blocking**, early) and **npm audit** (dependencies, non-blocking = early warning). The vulnerability gate for launch is `production-checklist`.

---

## Deploy

- **Vercel** git-connected: push to `main` → **Production** (`app.auramaristany.com`); branches → **Preview URLs**.
- Repo: `github.com/bijeded/auramaristany` (private) → Vercel `project-a24no`.
- **Stripe TEST** during the demo. At launch: flip to `sk_live`/`pk_live` + real prices + live webhook + secret; real WhatsApp; demo data cleanup; Preview env vars.
