# Technical Specification — Aura Maristany Web Platform

> ⚠ **FROZEN 2026-08-01 · HISTORICAL REFERENCE — NOT MAINTAINED.**
> This was the project's technical spec from June to August 2026. It is **not updated** and will drift. The live sources are **`openspec/specs/*`** (per-feature acceptance criteria), **`CLAUDE.md`** (stack, conventions, review rules), **`supabase/migrations/` + `lib/supabase/types.ts`** (schema), and the code itself. Read it for the domain narrative in one place — programs, billing, access, screen behavior — and verify anything you intend to act on.
> Content below was corrected against the code on the day it was frozen; the original 743-line version, including its Version 1.1–2.3 changelog and the hand-copied schema, is in git history.

**Scope of this file: the domain.** What the programs are, how billing and access work, and how the portal and admin behave. It does **not** restate things that have a live source elsewhere:

| Looking for | Read |
|---|---|
| Schema, columns, constraints | `supabase/migrations/*.sql` + `lib/supabase/types.ts` |
| Stack, env vars, conventions, review rules | `CLAUDE.md` |
| Per-feature acceptance criteria | `openspec/specs/*` |
| What changed and when | `openspec/changes/archive/` + git history |
| Colors, type, components | `design-handoff-aura/` + `app/globals.css` |

Where this file and the shipped code disagree, **the code wins** and this file is the bug.

---

## Overview

Web platform for Aura Maristany, a holistic health coach specializing in women 40+. Lets her sell, deliver, and manage training, nutrition, and wellness programs via recurring monthly subscriptions.

- **Marketing site (WordPress):** separate and independent — not touched by this app
- **Web app:** `app.auramaristany.com`
- **Language:** Spanish (Mexico) · **Currency:** MXN

---

## General Client Flow

```
Sitio WordPress
  └─ Cuestionario de nivel/perfil
       └─ Redirige a: https://app.auramaristany.com/checkout/[variantSlug]
            └─ Registro / Login en la app
                 └─ Stripe Checkout (pago)
                      └─ Cuestionario de onboarding (dentro de la app)
                           └─ /portal/today
```

**The client never freely chooses her variant.** The WordPress questionnaire determines the variant and redirects to the correct checkout URL. This matters: **the gate is the funnel, not the database.** Aura decides by judgment who is ready for which level and sends them to that checkout — which is why the Extra prerequisites were deleted in migration 017 (a DB rule that says "Extra comes after CuarentaMás" rejects exactly the clients she approved).

---

## Programs

### 1. CuarentaMás — fixed term, 6 monthly charges

| slug | Level | Time |
|-----|-------|--------|
| `cuarenta-mas-principiante-poco` | Principiante | < 45 min |
| `cuarenta-mas-principiante-suf` | Principiante | 45–80 min |
| `cuarenta-mas-intermedio-poco` | Intermedio | < 45 min |
| `cuarenta-mas-intermedio-suf` | Intermedio | 45–80 min |
| `cuarenta-mas-avanzado-suf` | Avanzado | 45–80 min |

- `billing_model = fixed_term_monthly`, `duration_months = 6`
- **Access:** the current month only (`months_elapsed`), and within it only up to today's cell. Past weeks and months stay open.
- **At month 6:** the subscription completes — see `deriveCancellationState` and the `portal-graduated-access` spec for what a graduated client keeps.

### 2. CuarentaMás Extra — open-ended monthly

| slug | Level |
|------|-------|
| `cuarenta-mas-extra-intermedio` | Intermedio |
| `cuarenta-mas-extra-avanzado` | Avanzado |

- `billing_model = rolling_monthly`, `duration_months = null` **(migration 017)**. It is sold as an open monthly subscription the client cancels when she wants — it is not a fixed term, and it does not end on its own.
- **No DB prerequisites.** Deleted in 017; the level decision lives in the funnel (see the flow above). `program_variant_prerequisites` still exists with AND/OR group logic and is still enforced at checkout — it simply has no rows for Extra.
- **Access:** the current month's series (`series_number = months_elapsed`), with the same week/day control. Previous months stay open; future ones don't.
- **Content:** a library of reusable monthly plans; the system assigns the month-N plan automatically.

### 3. Strong & Fit — open-ended monthly, cumulative

| slug | Level |
|------|-------|
| `strong-fit-principiante` | Principiante |
| `strong-fit-intermedio` | Intermedio |
| `strong-fit-avanzado` | Avanzado |

- `billing_model = rolling_monthly`, `duration_months = null`
- **Cumulative access:** month N = Series 1 through N visible. Only the most recent series uses week/day control; earlier ones are fully open.
- Aura can add new series at any time.

**Stripe Prices:** 5 (CuarentaMás) + 2 (Extra) + 3 (Strong & Fit) = **10**.

> Level progression between programs is a content rule, not a billing one — see the `content-ladder-progression` spec.

---

## Key field: `months_elapsed`

Stored in `subscriptions`. Incremented by 1 on each successful Stripe `invoice.paid` — **never computed from dates**. It arbitrates **which content the client sees**.

It does **not** arbitrate access to the portal: that is `active`/`trialing`/`past_due` via `lib/content/subscription-access.ts`. Two different questions, two different sources.

Content is organized by **weeks** within each month, not sequential days:

```
week_number  = floor((today - current_period_start).days / 7) + 1   -- 1..4
day_of_week  = name of the day in Spanish ('lunes'..'domingo')
```

| Program | Access logic |
|---------|-----------------|
| CuarentaMás | Current month = `months_elapsed`. Up to `(week_number, day_of_week)` inclusive; earlier weeks/days complete. |
| Extra | Single series: `series_number = months_elapsed`. Same week/day control. |
| Strong & Fit | `series_number <= months_elapsed`. Only the newest series uses week/day control. |

⚠ **A date before `current_period_start` has no cell.** Resolving one against the grid wraps to a week-4 cell of the *previous* period — invisible for 5 of 7 possible start weekdays. Grid-relative day math special-cases the first day of a period (review rule 17).

**History:** once a week or month has passed, its content stays permanently readable so the client can review any past day beside her log.

---

## Routes

```
/                                 ← root
/checkout/[variantSlug]           ← payment landing (from the WordPress quiz)

/auth/login · /auth/register       ← register = name + phone (country code, required) + email + password
/auth/callback · /auth/reset-password

/onboarding/questionnaire         ← guard: active subscription + onboarding_completed=false

/portal                           ← guard: active subscription + onboarding_completed=true
  /today                          ← day's content + integrated progress (one screen)
  /semana                         ← week calendar
  /pilares                        ← monthly pillars (CuarentaMás/Extra)
  /booking                        ← Calendly booking
  /history · /history/[logId]     ← "Mi Progreso": Desempeño + Fotos · past-day detail (read-only)
  /messages · /messages/[id]      ← Aura→client inbox (read-only) + WhatsApp to Aura
  /settings                       ← "Mi cuenta": profile, password, avatar, subscription, payments
  /activando                      ← post-payment polling; waits for the Stripe webhook
  /sin-suscripcion                ← landing with no active subscription

/admin                            ← guard: role='admin'
  /dashboard                      ← financial KPIs + charts
  /clients · /clients/[clientId]  ← list (filters, pagination, CSV) · client profile in tabs
  /payments                       ← full invoice listing
  /content                        ← program list
  /content/runway                 ← content runway
  /content/[programId]            ← series list (CRUD)
  /content/[programId]/series/[seriesId]/days/new · /days/[dayId]
  /content/[programId]/series/[seriesId]/pillars · /pillars/[pillarKey]
  /messages                       ← compose + sent history
  /automated-messages             ← the automated rules
  /onboarding-settings            ← questionnaire builder

/api
  /webhooks/stripe · /webhooks/calendly
  /subscriptions/create-checkout
  /admin/upload                              ← admin upload to public bucket 'content'
  /admin/clients/[clientId]                  ← DELETE client (guard + cascade)
  /admin/clients/[clientId]/photos/[photoId] ← DELETE client photo
  /portal/progress                           ← upsert the day's log (autosave)
  /portal/photos · /portal/photos/[id]       ← POST upload (private bucket 'progress') · DELETE own
  /portal/avatar                             ← POST avatar (public bucket 'avatars')
  /cron/purge-messages                       ← deletes messages >180 days old (Bearer CRON_SECRET)
  /cron/automated-messages                   ← the A4 fan-out (Bearer CRON_SECRET)
```

> Mutations that aren't listed above are **server actions** (`lib/**/*Actions.ts`), not route handlers — messaging, onboarding responses, settings, series CRUD, cancellation.

### Middleware order (`lib/middleware-utils.ts` → `getRedirectPath`)

Protected = `/portal`, `/admin`, `/onboarding`. The pathname is collapsed (`//` → `/`) **before** any rule runs — without that, `//portal/today` skips every rule below.

1. No session + protected route → `/auth/login`
2. Session but no `profiles` row (`role=null`) + protected route → `/auth/login`
3. Session + on `/auth/login|register` → their home (admin → `/admin/dashboard`, client → home). `/auth/callback` and `/auth/reset-password` are deliberately exempt.
4. Admin on `/portal` → `/admin/dashboard`
5. Client on `/admin` → their home
6. Client on `/portal`/`/onboarding`:
   - `/portal/sin-suscripcion` and `/portal/activando` always pass
   - **Graduated** (no active subscription but a completed one) → only the routes she keeps; anything else → the graduated home. Onboarding doesn't apply; she already did it.
   - No active subscription → `/portal/sin-suscripcion`
   - Active but `onboarding_completed=false` → `/onboarding/questionnaire`

A graduated client's nav is filtered by `href` against the same list the middleware enforces, so what's painted and what's allowed cannot drift apart.

---

## Day view with integrated progress (`/portal/today`)

One screen — no extra navigation to log progress. Header shows **"Mes N · Semana N"** (never "Día N de 180"), then the day's title and its `workout_focus` badge ("Enfoque": Tren Inferior, Protocolo Cardiovascular, …). There is no day-type selector — every day is physical activity, and rest days carry content.

```
content = program_days WHERE
  series_id   = current month's series (months_elapsed)
  week_number = floor((today - current_period_start).days / 7) + 1
  day_of_week = today's day name in Spanish
```

No row for that `(week_number, day_of_week)` → the **rest-day card**, not an error.

- Per-set logging: N rows = N sets, reps + weight per set, plus per-exercise notes and general notes
- Which fields appear per exercise comes from that exercise's `metrics` array
- Optional fields · debounced autosave · already-logged values are shown on return
- Never body metrics (weight/waist/hip are not requested; progress photos are fine)

## Mi Progreso (`/portal/history`)

Two tabs, **Desempeño** and **Fotos** — no third tab, no stat cards, no period selector.

**Desempeño** — Recharts charts of exercise metrics for the **current month** (`log_date >= current_period_start`), with an exercise selector and a metric toggle driven by that exercise's `metrics`. **Exercises are matched by normalized name, not by uuid**, so the same exercise connects across days even though Aura builds each day from scratch. Per-day aggregation: **weight = average of the sets, reps = sum**. Below, "Historial de ejercicios" lists days with a log, most recent first → `/portal/history/[logId]`.

**Fotos** — private Storage bucket (`progress`) served with **signed URLs (600s)**. 3-column grid, filter by month. Upload from file or camera with an optional comment; **client-side compression** to 1280px + JPEG; limits **5MB/file** and **250 photos** per client. Lightbox with navigation and owner delete.

**Day detail** (`/portal/history/[logId]`) — the same structure as `/portal/today` in **read-only** mode (`BlockView` with `loggedExercises`): logged reps and weights preloaded and not editable, ✓ where marked complete, general notes visible, the log's date in place of "HOY", no save button. The `logId` must belong to the authenticated client or it 404s.

---

## Admin

**Dashboard** (`/admin/dashboard`) — MRR (active subscriptions × `program_variants.price_mxn`, predictive, labeled "*Estimado"), active count, renewals due, `past_due` needing attention; revenue by month (12-month window, from `invoices.amount_paid` — actually collected, deliberately different from MRR), clients by variant, revenue by program, cancellation analytics, recent payments. ⚠ **Money figures exclude subscriptions that won't be charged again; people figures include them** — a new KPI declares which side it's on before it's written (ADR 0004).

**Payments** (`/admin/payments`) — full `invoices` listing ordered by date, status filter, pagination.

**Clients** (`/admin/clients`) — one row per client with the primary subscription picked, search, program and status filters, pagination, CSV export honoring active filters. Profile in tabs: Resumen (subscriptions, progress label by billing model, churn badge and reason), Onboarding, Progreso, Fotos (signed URLs, month filter, admin deletion), Pagos, Mensajes (+ WhatsApp when `phone` exists). Body metrics are never shown. **Delete client** guards on a non-canceled subscription (409, and it does **not** touch Stripe), removes Storage photos, then `auth.admin.deleteUser` → FK cascade.

**Content CMS** — Program → Series/Month → weekly grid → Day. Series CRUD from `/admin/content/[programId]`: create (month number, title, description, variants — at least one) and edit (+ Publicado); delete warns about cascade and clears `variant_series_map` first, since that FK has no `ON DELETE CASCADE`. Mapping variant↔series is `variant_series_map`.

The series view is a **4-week × 7-day grid** — never 6×30:

```
         Lun         Mar    Mié         Jue    Vie         Sáb    Dom
Sem 1  [T.Inf ✓]   [—]   [T.Sup ✓]   [—]   [Full ✓]   [—]    [—]
Sem 2  [T.Inf ✓]   [—]   [T.Sup ✓]   [—]   [Full ✓]   [—]    [—]
Sem 3  [T.Inf]     [—]   [T.Sup]     [—]   [Full]     [—]    [—]
Sem 4  [vacío]     [—]   [vacío]     [—]   [vacío]    [—]    [—]
```

Each cell shows the day's `workout_focus` or "—" for a rest day; color encodes published / draft / empty. Per-day and per-series Publicado/Borrador state. Extra and Strong & Fit get the same grid per series.

**Day editor** — draggable blocks (dnd-kit):

- **Text** — Tiptap: bold, italic, H2/H3/H4, ordered and unordered lists
- **YouTube** — paste URL → extract video_id → embed (one video per exercise)
- **PDF** / **Image** — upload to Storage (+ alt text)
- **Exercise list** — name, sets×reps, rest, notes, demo video, and which metrics the client logs
- **Cardio Zone 2 calculator** — fixed block; the client enters her age in the portal
- **Agendar** — booking block

**Messaging** — individual or broadcast filtered by program, sent history, email notification via Resend. **Automated messages** (`/admin/automated-messages`) edit the copy of code-defined rules in `lib/admin/notice-rules.ts`; creating a rule needs a trigger in code, so a hand-made row would never fire.

**Onboarding builder** (`/admin/onboarding-settings`) — create, edit, drag-reorder, and activate/deactivate questions across four types (free text, number, single choice, multiple choice). Deactivate only, never hard delete, so responses already stored in the jsonb are not orphaned.

---

## Stripe integration

| Event | Action |
|--------|--------|
| `checkout.session.completed` | Creates the `subscriptions` row (`months_elapsed=1`) **and records the first invoice** (expands `latest_invoice`), welcome email |
| `invoice.paid` | Records the invoice; on renewals increments `months_elapsed` and detects completion |
| `customer.subscription.updated` | Updates `status` and `cancel_at_period_end` |
| `customer.subscription.deleted` | Marks canceled |
| `invoice.payment_failed` | Sets `past_due`, notice email |

All events are logged to `subscription_events` for auditing.

⚠ **Stripe emits `invoice.paid` roughly a second before `checkout.session.completed`**, and the latter is the only creator of the subscription row — which is why the first invoice is recorded inside the checkout handler and `recordInvoice` is an idempotent upsert on `stripe_invoice_id`. The `subscription_create` branch of `invoice.paid` is a safety net, not the primary path.

⚠ **Handlers are idempotent, and the outward call goes before the idempotency gate.** Reversed, a retry finds the record already written, skips the external effect, and the failure is permanent and silent.

**Checkout** — `variantSlug` arrives in the URL from the WordPress quiz; the server validates prerequisites (where any exist) before creating the Checkout Session.

---

## Critical files

| File | Role |
|---------|-----|
| `lib/content/access.ts` | Access logic for the three programs, with day-level control |
| `lib/content/subscription-access.ts` | The **only** definition of "may she use the portal" |
| `lib/middleware-utils.ts` | Redirect rules by role, subscription, onboarding, graduation |
| `app/api/webhooks/stripe/route.ts` | Subscription lifecycle |
| `components/admin/DayEditor.tsx` | Aura's content editor |
| `components/portal/TodayView.tsx` | Day view with integrated progress |
