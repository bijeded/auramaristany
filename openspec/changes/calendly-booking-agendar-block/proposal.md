## Why

Clients need to book their biweekly 1:1 video calls (Zoom/Meet) with Aura from inside the portal, gated to active subscribers. The original plan (WordPress + TheBooking, app sends an HMAC signed link) is dead: **TheBooking is abandoned/unsupported**. We switch to **Calendly** (free tier, embedded widget). Because the embed now lives on our own same-origin route, the cross-domain HMAC machinery is no longer needed — eligibility is re-derived server-side like every other portal gate. This also merges the former A6 (booking bridge) and A7 ("Agendar" block) into one feature: the block *is* the booking CTA.

## What Changes

- New `/portal/booking` route: a server-gated page embedding the Calendly widget. Gate = `getUser()` + `subscriptionGrantsAccess()` + booking eligibility (today's plan exposes an "Agendar" block) + no active future call. Prefills the invitee email.
- New **`agendar` block type** in the content editor — Aura places it on program_days to open a booking window (e.g. the same block on 3 consecutive days = a 3-day window). Cadence is content-driven; there is **no rolling-window date math**.
- The `agendar` block renders its **state from a bookings ledger**: an active link when the client has no future call, or a disabled "Tu llamada es el {fecha}" once they've booked — so booking on day 1 auto-disables it on the remaining window days.
- New `bookings` table (migration 012) + RLS: owner can select their own rows; writes happen via the webhook (service-role).
- New `/api/webhooks/calendly` route: verifies the Calendly webhook signature, idempotently upserts on `invitee.created` / `invitee.canceled`. Rule enforced app-side: **one future, non-canceled call at a time**. Middleware `matcher` must exclude it (inline literal).
- **BREAKING vs. original A6 plan:** WordPress/TheBooking and the HMAC signed-link (`BOOKING_SIGNING_SECRET`) are **removed from scope**. New env vars: `NEXT_PUBLIC_CALENDLY_URL`, `CALENDLY_WEBHOOK_SIGNING_KEY`.

## Capabilities

### New Capabilities
- `portal-booking`: How a client books a 1:1 video call from the portal — the `/portal/booking` gate (active subscription + eligibility + one-future-call dedup), the Calendly embed, and the inbound webhook that maintains the bookings ledger.
- `admin-agendar-block`: The `agendar` content block type — creating/validating it in the editor, and how it renders in the portal (active vs. disabled state driven by the client's booking status).

### Modified Capabilities
<!-- None: the block system, subscription-access gate, and webhook patterns are reused, but no existing spec's requirements change. -->

## Impact

- **New code:** `app/portal/booking/` (server gate + embed), `app/api/webhooks/calendly/route.ts`, an `agendar` block editor in `components/admin/blocks/` + palette wiring, portal render in `components/portal/blocks/BlockView.tsx`, booking queries/helpers in `lib/content/` (pure eligibility/dedup helpers with tests + server-only queries), `lib/admin/content-validation.ts` (add `agendar` to `BLOCK_TYPES` + zod).
- **Migration:** 012 `bookings` table + RLS (owner-select; service-role write).
- **Middleware:** `matcher` must exclude `api/webhooks/calendly` (inline literal — Next doesn't analyze referenced constants).
- **Env:** add `NEXT_PUBLIC_CALENDLY_URL`, `CALENDLY_WEBHOOK_SIGNING_KEY` (`.env.example` + Vercel). Remove any `BOOKING_SIGNING_SECRET` intent.
- **External dependency (Aura, deploy-time only):** a Calendly account — create the event type with Zoom/Meet attached, register the webhook subscription, obtain the signing key. Not required to build/unit-test against the contract; required for the E2E smoke. Track like L1 (Stripe live) / L3 (onboarding questions).
- **Reused, unchanged:** `lib/content/subscription-access.ts` (`subscriptionGrantsAccess`), the Stripe-webhook signature-verify + idempotent-upsert pattern, the block system, and the portal's "past/future days aren't navigable" content model (which is what makes content-driven cadence safe).
