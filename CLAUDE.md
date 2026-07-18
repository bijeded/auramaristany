# Aura Maristany — Plataforma Web

Coaching de salud integral para mujeres 40+. Vende, entrega y gestiona programas de entrenamiento/alimentación/bienestar como **suscripciones mensuales recurrentes**. La app vive en un subdominio (`app.auramaristany.com`); el sitio de marketing es un WordPress independiente que NO se toca.

- **Estado:** Fases 0–5 completas en `main`; **Fase 6 (Pulido + Launch) en curso**. Desplegado como **DEMO en línea** (Stripe en **test mode**, sin cobros reales) para feedback de Aura antes del lanzamiento productivo.
- **SPEC técnico:** `SPEC.md` · **Traspaso detallado:** `handoff.md` · **Historia por sub-bloque:** `docs/superpowers/` (specs/plans/audits/context — histórico).

---

## Platform

- **Targets:** web-app (Next.js App Router, SSR + Server Components)
- **Native wrapper:** none · **Offline:** no · **Installable:** no
- **Hosting:** Vercel (git-connected) · **DB/Auth/Storage:** Supabase Cloud

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14.2 (App Router) + React 18 + TypeScript 5 |
| DB + Auth + Storage | Supabase (PostgreSQL + RLS + Storage) — proyecto `bgvxaagfnzvzamtxqbkg` |
| Pagos | Stripe (suscripciones MXN, 10 Prices). SDK `stripe` v22, `apiVersion` fijada `2026-05-27.dahlia` |
| UI | shadcn/ui + Tailwind CSS 3 · Oswald/Hind · rosa `#eddbd8` / lavanda `#9982f4` |
| Editor CMS | Tiptap 3 (núcleo MIT) |
| Email | Resend + React Email (`lib/email/`) |
| Gráficas | Recharts · **Drag & drop:** dnd-kit · **Validación:** zod · **Sanitización:** sanitize-html |
| Tests | Vitest 4 + Testing Library + jsdom |
| Package manager | **npm** (package-lock.json) · Node 20+ |

---

## Key commands

```bash
npm install                 # instalar deps (local); npm ci en CI
npm run dev                 # dev server (localhost:3000)
npm run test:run            # correr tests una vez (CI); npm test = watch
npm run lint                # next lint (ESLint)
npx tsc --noEmit            # typecheck
npm run build               # build de producción
```

> **Checkout en local** necesita el reenvío de webhooks en otra terminal:
> `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
> (el signing secret que imprime debe coincidir con `STRIPE_WEBHOOK_SECRET` en `.env.local`). Sin esto, `checkout.session.completed` nunca llega y `/portal/activando` hace timeout — no es bug.

**Baseline verde (2026-07-18):** tsc PASS · lint limpio · **252/252 tests** · build OK.

---

## Project structure

```
app/            Rutas App Router — (marketing) · auth · onboarding · portal · admin · api
components/     UI — portal/*, admin/*, auth/*, ui/* (shadcn)
lib/            Lógica — content/ (access, queries, history) · admin/ · portal/ · webhooks/ · email/ · auth/ · supabase/
hooks/          useProgressForm.ts (auto-guardado con debounce)
middleware.ts   Gate por rol / suscripción / onboarding
supabase/migrations/  001–010 (aplicadas)
scripts/        seed-stripe.ts, seed-demo.ts, backfill-first-invoices.ts (tsx)
__tests__/      Vitest (AAA)
docs/superpowers/  Specs/plans/audits/context históricos (referencia)
design-handoff-aura/prototype/  Prototipos JSX de diseño (referencia)
```

---

## Environment variables

Local en `.env.local` (ver `.env.example`). Producción en Vercel (11 vars, Stripe **TEST** durante el demo).

```
NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY (server-only)
STRIPE_SECRET_KEY · NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY · STRIPE_WEBHOOK_SECRET
RESEND_API_KEY (vacía en dev → email no-op) · RESEND_FROM_EMAIL=no-reply@auramaristany.com
NEXT_PUBLIC_AURA_WHATSAPP · CRON_SECRET · NEXT_PUBLIC_APP_URL
DEV_DATE=YYYY-MM-DD   # SOLO dev, gitignored, NUNCA en Vercel
```

---

## Conventions

- **Idioma UI:** español neutro de México — **'cliente', nunca 'clienta'**. Fechas capitalizadas en JS (`charAt(0).toUpperCase()`), no `text-transform`.
- **Arquitectura de datos:** funciones **puras** (helpers, TDD) separadas de las **queries** server-only (`*-queries.ts`, `import 'server-only'`). Los helpers llevan tests; las queries no.
- **Server Components por defecto;** `"use client"` solo donde haga falta interactividad. Mutaciones vía **server actions** (`lib/**/*Actions.ts`) o route handlers en `app/api/`.
- **Tests:** Vitest, patrón AAA. Mantener verde. Nueva lógica pura → test.
- **Migraciones:** SQL numerado secuencial en `supabase/migrations/`. **Nunca editar una migración ya aplicada** — agregar una nueva. Management API de Supabase: enviar SQL en **UNA sola línea** (el pipeline come saltos de línea → los `--` autocomentan todo).
- **Tipos:** `lib/supabase/types.ts` se mantiene **a mano** (incluir `Relationships: []` por tabla). Evitar `as any`/`as unknown as` injustificados (solo los inevitables de JOINs/SDK, marcados `// keep:`).
- **Commits:** Conventional Commits (`type(scope): descripción`). Terminar con:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  ⚠ `git user.email` **debe** ser `francisco.venegas.velasco@gmail.com` (cuenta GitHub `bijeded`) o **Vercel bloquea** el auto-deploy de Git.

---

## Framework-specific review rules (Next.js App Router + Supabase + Stripe)

- **Nunca** exponer `SUPABASE_SERVICE_ROLE_KEY` ni el secreto de Stripe al cliente. Secretos solo en módulos server-only.
- **Identidad siempre de `getUser()` en el servidor** — nunca confiar en IDs que manda el cliente (lección INP-4/EDGE-5).
- **RLS es la frontera de seguridad.** Cliente RLS-aware por defecto; service-role solo cuando es imprescindible **y** detrás de `requireAdmin()`/`requireAdminPage()` (`lib/admin/auth.ts`). RLS con `with check` explícito en políticas `for all`.
- **Validar todo input server-side con zod**; sanitizar HTML de Tiptap con `sanitize-html` al guardar (`lib/admin/content-validation.ts`, `sanitize-html.ts`).
- **Webhooks idempotentes** (upsert `onConflict`). `months_elapsed` es el árbitro inmutable del acceso — se incrementa por `invoice.paid`, nunca se calcula desde fechas.
- **Acceso al portal** vía `lib/content/subscription-access.ts` (`active`/`trialing`/`past_due`); no duplicar la lógica.
- **Middleware `matcher`** debe excluir `api/webhooks` y `api/cron` (literal inline — Next no analiza una constante referenciada).
- Errores crudos de Postgres → `logAndGeneric` (log server-side + mensaje genérico al cliente); no filtrar detalles.

---

## Do not modify

- **Migraciones ya aplicadas** `supabase/migrations/001–010` — agregar una nueva, nunca editar.
- **`design-handoff-aura/`** y **`referencias/`** — material de referencia, no código de la app.
- **Stripe `apiVersion` `2026-05-27.dahlia`** — no cambiar sin verificar el SDK.
- **`.env.local`** y cualquier secreto — gitignored.
- Generados: `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`.

---

## Workflow (OpenSpec + global dev-loop)

Este proyecto usa **OpenSpec** + los skills globales del loop de desarrollo. Flujo por cambio:

```
/opsx:propose  →  task-execution  →  /opsx:sync + openspec validate  →  /opsx:archive
```

- Para features no triviales: opcional `user-stories` primero, luego `/opsx:propose` (o `/opsx:explore`).
- `task-execution` orquesta la implementación: `tdd` → `code-review` (subagente) → `security-review` (condicional) → `github-pr`. (Alternativa nativa de OpenSpec: `/opsx:apply`.)
- Reconciliar specs con `/opsx:sync`; validar un cambio con `openspec validate`; cerrar con `/opsx:archive`. (OpenSpec v1.5, profile `core`: no existe `/opsx:verify`.)
- Bugs: `bug-fix` (reproduce-first; variante hotfix).
- **Discutir antes de implementar**; separar datos de presentación; respetar el scope acordado.
- ⚠ **`main` = Producción del demo que ve Aura.** WIP siempre en rama → Preview URL. No commitear features directo a `main` sin acuerdo; no romper el demo.

> **No usar el flujo `superpowers:*`** (brainstorming, writing-plans, subagent-driven-development, executing-plans, etc.) como proceso — se reemplazó por OpenSpec + el loop global. El directorio `docs/superpowers/` queda como historia, no como flujo activo.

## Implementation mode

Ejecutar tareas de OpenSpec con el loop `task-execution`. Ramas por feature (`feature/...`), PR gated por CI, merge a `main` tras review + CI verde.

## Model routing

| Paso | Modelo |
|------|--------|
| Implementación por defecto | Sonnet |
| Arquitectura · spec/plan · security-review | Opus |
| Mecánico (renombres, boilerplate, formato) | Haiku |
| Code-review (subagente) | Sonnet (Opus si es sensible a seguridad) |

## Skills

- `task-execution`, `tdd`, `code-review`, `github-pr` (global — loop de desarrollo)
- `security-review` (global — subagente condicional en cambios sensibles)
- `bug-fix` (global — defectos reproduce-first, con variante hotfix)
- `user-stories` (global — elicitación con gate de revisión humana antes de `/opsx:propose`)
- `handoff` (global — genera HANDOFF.md para continuar en otro chat)
- `production-checklist` (global — verificación pre-lanzamiento, antes de abrir a clientes reales)
- OpenSpec `/opsx:*` (propose/explore/apply/sync/archive) + `openspec validate`

## MCPs / tools

- **Codebase-memory:** indexado (ver "Codebase memory"). Preferir tools de grafo (`search_graph`, `trace_path`, `get_architecture`, `detect_changes`) sobre grep para "quién llama a X / impacto / dead code". Decisiones arquitectónicas durables → ADR (`manage_adr`).
- **Playwright MCP:** preguntar antes de usar (pesado en tokens).
- No agregar MCPs/skills/agents fuera de los listados salvo que se pida explícitamente.

## Codebase memory

Proyecto indexado en codebase-memory (`Users-franciscovenegas-Desktop-Cowork-Aura`). Re-indexar en modo `fast` tras archivar un cambio para que el snapshot no derive.

---

## CI

CI corre en cada PR a `main` (`.github/workflows/ci.yml`), en orden, fallando el PR si algún comando sale con código ≠ 0:

```
npm ci  →  npx tsc --noEmit  →  npm run lint  →  npm run test:run  →  npm run build
```

Además: **gitleaks** (secret scan, **bloqueante**, temprano) y **npm audit** (dependencias, no-bloqueante = alerta temprana). El gate de vulnerabilidades para lanzar es `production-checklist`.

---

## Deploy

- **Vercel** git-connected: push a `main` → **Production** (`app.auramaristany.com`); ramas → **Preview URLs**.
- Repo: `github.com/bijeded/auramaristany` (privado) → Vercel `project-a24no`.
- **Stripe TEST** durante el demo. Al lanzar: flip a `sk_live`/`pk_live` + precios reales + webhook live + secret; WhatsApp real; limpieza de datos demo; env vars de Preview.
