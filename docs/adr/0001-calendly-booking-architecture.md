# 0001. Booking via a same-origin Calendly embed with a content-driven cadence

Status: Accepted · Date: 2026-07-24

## Context

Clients need to book biweekly 1:1 video calls (Zoom/Meet) from the portal, gated to active subscribers, with a cadence of roughly one call per 15 days and ≥1 day's notice. Three forces shaped the decision:

1. The originally-planned host, **WordPress + TheBooking**, is abandoned/unsupported.
2. No off-the-shelf scheduler (TheBooking or Calendly) enforces a **per-invitee rolling-window** limit natively, so the cadence rule must live somewhere we control.
3. The app already has a strong content model where **only today's published `program_day` renders blocks** (past/future days are not navigable), an RLS security boundary, and a Stripe-style signed-webhook pattern.

## Decision

- Book through a **Calendly embed hosted on our own `/portal/booking` route** (free tier, no OAuth). Because the embed is same-origin under our Supabase session, eligibility is **re-derived server-side** (`getUser()` + `subscriptionGrantsAccess()` + content check) — there is **no cross-domain HMAC signed link** (the original A6 design's core, now removed).
- **Cadence is content-driven, not computed.** The `agendar` block *is* the booking CTA; Aura places it on the `program_day`s where a window should open (e.g. three consecutive days = a 3-day window). No anchor date, no rolling-window math — the block only renders on its day.
- **Dedup is a ledger.** A `bookings` table, written **only** by the Calendly webhook under service-role (`invitee.created` upserts active; `invitee.canceled` is a terminal, update-only cancel), maintains the rule **"one future non-canceled call at a time."** The same predicate drives both the `/portal/booking` gate and the block's active/disabled state, so booking on an earlier window day auto-disables the CTA on later days.
- Invitee→profile mapping is by **prefilled email**, matched with LIKE metacharacters escaped (exact, case-insensitive).

## Alternatives considered

- **Build our own scheduler** — rejected: reimplements availability, timezones, Zoom/Meet link generation (itself a third-party integration), reminders, reschedule/cancel — weeks of work for a single-coach product.
- **WordPress + TheBooking + HMAC signed link** — the original A6/A7 plan; invalidated by TheBooking's abandonment.
- **Calendly API + OAuth + create/cancel calls** — heavier; unnecessary because the embed does the scheduling and an inbound webhook is enough to keep the ledger.
- **Computed "every 15 days" window (floating CTA)** — rejected: reintroduces the rolling-window/timezone math we escaped and adds a UI pattern foreign to the block system.
- **No ledger (manual dedup)** — rejected: Aura wanted automated "one call at a time".

## Consequences

- The cadence is only as correct as Aura's block placement (a deliberate, flexible trade — she builds plans monthly anyway).
- We accept a residual: an out-of-order redelivered `invitee.created` after a cancel could reactivate a row; in practice Calendly redelivers only the same event as a retry (before any cancel). Documented, low-risk.
- The invitee can edit the prefilled email in the embed, breaking the mapping (booking then isn't tied to the subscriber); accepted for a real client with no incentive to do so — a hidden `user_id` custom field is a future hardening.
- Calendly free tier cannot delete invitee data via API, so demo/GDPR cleanup of Calendly-side data is manual.
- New env vars: `NEXT_PUBLIC_CALENDLY_URL`, `CALENDLY_WEBHOOK_SIGNING_KEY`. A6 and A7 collapse into one feature.
