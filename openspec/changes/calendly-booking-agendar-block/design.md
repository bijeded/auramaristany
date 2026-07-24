## Context

Clients need to book biweekly 1:1 video calls from the portal, gated to active subscribers. The original design (WordPress + TheBooking + HMAC signed link, tracked as A6/A7) is invalid: TheBooking is abandoned. We move to Calendly's embedded widget hosted on our own `/portal/booking` route. Because the embed is same-origin under our Supabase session, the cross-domain HMAC signed-link is unnecessary — the trickiest part of the old A6 disappears. A6 (bridge) and A7 (block) collapse into one change: the `agendar` block *is* the CTA.

Reused primitives: `subscriptionGrantsAccess` (`lib/content/subscription-access.ts`), the block system (`content-validation.ts`, `BlockView.tsx`, `components/admin/blocks/`), the Stripe-webhook pattern (signature verify + idempotent `onConflict` upsert), and the portal content model where past/future days are not navigable (only today's published `program_day` renders blocks).

## Goals / Non-Goals

**Goals:**
- Active subscribers book a call from the portal via a Calendly embed.
- Cadence is controlled by Aura placing the `agendar` block on program days (a multi-day window = the block on N consecutive days); no rolling-window date math.
- Enforce "one future non-canceled call at a time" app-side, so booking on an earlier window day auto-disables the CTA on later days.
- Keep the security boundary in RLS + server-derived identity; no client-trusted IDs; no new signing secret.

**Non-Goals:**
- No WordPress/TheBooking; no HMAC signed link / `BOOKING_SIGNING_SECRET`.
- No Calendly OAuth or create/cancel API calls — the embed does scheduling; we only *listen* via webhook.
- No automated reminder message (the "book your call" nudge) — that is the A4 automated-messages feature; noted as a dependency, not built here.
- No programmatic deletion of Calendly-side data (free tier blocks the compliance/deletion endpoints); demo/GDPR cleanup is manual in the Calendly dashboard.

## Decisions

**1. Calendly embed on our own route, not a cross-domain redirect.**
`/portal/booking` is a server component that gates then renders the embed. Rationale: same-origin under our session means eligibility is re-derived server-side (`getUser()` + `subscriptionGrantsAccess()` + content eligibility) exactly like other portal gates — no token to sign, expire, or replay. Alternative (signed link to an external host) was the WordPress-era design; obsolete now.

**2. Cadence = content placement, not computation.**
The `agendar` block only renders on its own `program_day` (portal never renders past/future day blocks), so "the call is available today" is just "Aura put the block on today." A 3-day window = the block on 3 consecutive days. Alternative (compute "every 15 days" from an anchor) reintroduces timezone/boundary math and a floating-UI pattern; rejected.

**3. Dedup = ledger, rule "one future non-canceled call".**
A `bookings` table fed by the Calendly webhook. Eligibility check and block state both read the same predicate: "does this user have a future, non-canceled booking?" This defeats double-click booking (day-1 booking disables day-2/3 CTA) and cancel-then-rebook gaming (cancel → eligible again) without any 15-day window computation. Alternative (accept manual cleanup, no ledger) was considered and rejected — Aura wants automated dedup.

**4. Webhook-only Calendly integration (no API create/cancel, no OAuth).**
`/api/webhooks/calendly` verifies signature, idempotently upserts on `invitee.created`/`invitee.canceled`. Free tier supports GET/POST webhooks (only compliance/deletion endpoints are blocked). Rationale: minimal surface, $0, mirrors the Stripe handler we already trust.

**5. Identity mapping via prefilled email.**
Embed prefills `?email=<user email>`; webhook maps invitee email → `profiles.email` → `user_id`. If the invitee edits the email, the mapping misses and no row is written (ack success). Accepted risk for a real client with no incentive to do so. Optionally pass `user_id` as a hidden Calendly custom field/UTM for a stronger bind — deferred unless it proves necessary.

**6. RLS + service-role split.**
`bookings` RLS: owner may `select` their rows. Writes come only from the webhook via the service-role client (the client never writes bookings). Consistent with the project's RLS-as-boundary rule.

## Risks / Trade-offs

- [Invitee edits email in the embed → dedup/mapping bypassed] → Accept for now; document; consider a hidden `user_id` custom field if abused.
- [A booked call still in the future when the next window opens keeps the block disabled ("one upcoming call at a time")] → Stated behavior, arguably desirable at monthly cadence; surface it explicitly rather than treat as a bug.
- [Webhook missed/delayed → ledger lags reality] → Idempotent upsert tolerates redelivery; short-lived inconsistency at worst shows a stale CTA; Aura sees the true state in Calendly.
- [Free tier can't delete Calendly data programmatically] → Manual cleanup for L6 demo refresh and any GDPR request; note in launch checklist.
- [Calendly account not yet created] → Build and unit-test against the contract with placeholder env vars; the account is a deploy-time external dependency (like L1/L3), gating only the E2E smoke.

## Migration Plan

1. Migration 012: `bookings` table + RLS (owner-select; service-role write). Apply via Supabase Management API (single-line SQL).
2. Add env vars `NEXT_PUBLIC_CALENDLY_URL`, `CALENDLY_WEBHOOK_SIGNING_KEY` to `.env.example` and Vercel (placeholder in Preview until Aura's account exists).
3. Ship code behind a feature branch → Preview. The `agendar` block is inert until Aura places it, so merging to `main` does not disturb the live demo.
4. Deploy-time (Aura): create Calendly event type (Zoom/Meet attached), register the webhook, set real env values, run L4-style E2E smoke.
5. Rollback: the feature is additive; disable by removing the env URL (embed won't render) and not placing the block. Migration 012 is additive (new table), safe to leave.

## Open Questions

- Should `user_id` be passed as a Calendly custom field to harden identity binding, or is prefilled email sufficient for the demo? (Lean: email now, revisit if abused.)
- Exact `bookings` schema minimal columns: `id`, `profile_id`, `calendly_event_uri`/`invitee_uri` (for idempotency `onConflict`), `scheduled_at`, `status`, `created_at`. Confirm the Calendly payload field used as the idempotency key.
- Copy for the disabled and not-available states (Mexican Spanish, warm, first person) — finalize with Aura's tone.
