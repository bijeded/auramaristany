## Context

`/admin/clients` renders `ClientsTable` (client component) from `getClientsList()` (server-only query). The pure `filterClients` helper applies query/program/status filters entirely in the browser and is **date-free**. The three status pills map 1:1 to `subscription.status`. A5 adds the first **time-relative** filter, and BACKLOG explicitly asks that the underlying "last activity" signal be built reusably here because A4 (automated nudges) will consume it. Demo scale is ~20 clients on a shared Supabase project; `progress_logs` is keyed by `profile_id`.

## Goals / Non-Goals

**Goals:**
- Add a "Sin actividad" pill scoped to active/trialing clients quiet for ≥10 days (never-logged counts as inactive).
- Expose a durable, reusable `last_activity_date` per client row.
- Keep the inactivity rule in a pure, tested helper driven by a **server-provided `now`** (DEV_DATE-aware), never the browser clock.

**Non-Goals:**
- No migration, no schema change, no new RLS (read-only over existing `progress_logs`).
- Not implementing A4's cron/dedupe — only the shared signal.
- No group-by RPC/materialized view (overkill at demo scale; noted as future scaling work).
- No combinable/multi-select filters — the pill stays in the existing exclusive group.

## Decisions

**1. Reusable signal = raw date, not a boolean.** `getClientsList` returns `last_activity_date: string | null` per row. Inactivity (threshold + reference date) is decided at the view layer so A4 can reuse the same raw date with its own threshold.

**2. Fetch via nested PostgREST embed.** Extend the existing `subscriptions → profiles` join with `profiles(..., progress_logs(log_date order by log_date desc limit 1))`. One round-trip; last-activity read directly from the embedded row. Reduced trivially in JS in `getClientsList`.

**3. `now` flows from the server.** `app/admin/clients/page.tsx` computes `now` (DEV_DATE-aware, matching the rest of the app) and passes it as a prop to `ClientsTable`, which hands it to `filterClients`. `filterClients` gains a `now: string` param; the new pure `isInactive(lastActivityDate, now, thresholdDays)` does the whole-day diff. Default threshold constant = 10.

**4. Pill is a 4th exclusive member.** Extend `StatusFilter` to include `"Sin actividad"` and add it to `STATE_FILTERS`. In `filterClients`, "Sin actividad" means `status ∈ {active, trialing} AND isInactive(row.last_activity_date, now, 10)`. Re-clicking clears it; "Limpiar filtros" resets it.

**5. Whole-day diff semantics.** Compare date-only (`YYYY-MM-DD`) values in UTC to avoid TZ drift, consistent with EDGE-3's `getUTCDay` lesson. `daysBetween(last, now) >= threshold` ⇒ inactive; boundary (exactly 10) is inactive per spec.

**6. `trialing` in scope.** `ClientListRow.status` is currently typed `active | past_due | canceled | unpaid` — no `trialing`. Subscription access already treats `trialing` as active (`subscription-access.ts`), so the query maps `trialing` subs into the list; the "Sin actividad" predicate keys on `active`/`trialing`. Confirm whether primary-subscription selection surfaces `trialing` rows; if the demo has none, the predicate still reads correctly.

## Risks / Trade-offs

- **Existing `filterClients` tests break** when the signature gains `now` — must update them (add a fixed `now`).
- **Embedded-resource `limit` behavior**: PostgREST applies `limit 1` per embedded parent, so each client yields at most one `progress_logs` row — verify the ordering (`order by log_date desc`) is respected on the embed; fall back to selecting all `log_date` and reducing max in JS if the embed limit misbehaves.
- **Type surface**: adding `trialing` to `SubStatus`/badges is a small ripple (badge map, CSV label). Keep it minimal and consistent with `subscription-access.ts`.
- Scaling: JS reduction is fine at ~20 clients; a group-by view is the future path if the client base grows (out of scope, noted).
