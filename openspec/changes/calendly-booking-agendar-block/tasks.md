## 1. Data model & env

- [ ] 1.1 Write migration 012 (011 = A9 cancellation is already applied): `bookings` table (`id`, `profile_id` FK, `calendly_invitee_uri` unique for idempotency, `calendly_event_uri`, `scheduled_at timestamptz`, `status` (`active`/`canceled`), `created_at`) + RLS (owner `select`; no client insert/update — service-role only). Apply via Supabase Management API (single-line SQL).
- [ ] 1.2 Add `bookings` to `lib/supabase/types.ts` by hand (include `Relationships: []`).
- [ ] 1.3 Add `NEXT_PUBLIC_CALENDLY_URL` and `CALENDLY_WEBHOOK_SIGNING_KEY` to `.env.example` (placeholders) and document in Vercel env list.

## 2. Booking eligibility & dedup (pure helpers, TDD)

- [ ] 2.1 Pure helper `hasFutureCall(bookings, now)` → boolean (a future, non-canceled row exists). Tests (AAA), including boundary at `now`.
- [ ] 2.2 Pure helper `nextScheduledDate(bookings, now)` → the future call's date for the disabled-state copy. Tests.
- [ ] 2.3 Pure helper `dayHasAgendarBlock(blocks)` → booking-eligibility from today's blocks. Tests.

## 3. Bookings queries (server-only)

- [ ] 3.1 `lib/content/booking-queries.ts` (`import 'server-only'`): `getUserBookings(userId)` via RLS-aware client; `upsertBookingFromWebhook(...)` via service-role (onConflict `calendly_invitee_uri`); `markBookingCanceled(inviteeUri)`.

## 4. Calendly webhook

- [ ] 4.1 `app/api/webhooks/calendly/route.ts`: verify Calendly signature (`CALENDLY_WEBHOOK_SIGNING_KEY`) before processing; reject invalid/missing signature.
- [ ] 4.2 Handle `invitee.created`: map invitee email → `profiles.email` → `user_id`; idempotent upsert. Unmapped email → 200, no write.
- [ ] 4.3 Handle `invitee.canceled`: mark matching row canceled (idempotent).
- [ ] 4.4 Verify `api/webhooks/calendly` is already excluded by `middleware.ts` `matcher` (the existing literal excludes all of `api/webhooks`). Add a matcher test assertion; no matcher change expected.

## 5. Agendar block — editor side

- [ ] 5.1 Add `agendar` to `BLOCK_TYPES` + zod validation in `lib/admin/content-validation.ts` (empty/minimal content). Test the validate path.
- [ ] 5.2 `components/admin/blocks/AgendarBlockEditor.tsx` (minimal — no config beyond placement) + wire into the block palette.

## 6. Agendar block — portal render

- [ ] 6.1 `components/portal/blocks/AgendarBlock.tsx`: active CTA → `/portal/booking` when no future call; disabled "Tu llamada es el {fecha}" when a future call exists. Brand tokens, ≥44px tap target, warm MX-Spanish copy.
- [ ] 6.2 Wire `agendar` into `components/portal/blocks/BlockView.tsx`; pass the client's booking state down (fetched in the portal today page).

## 7. /portal/booking page

- [ ] 7.1 `app/portal/booking/page.tsx` server component: `getUser()` → `subscriptionGrantsAccess()` → redirect if not eligible.
- [ ] 7.2 Eligibility gate: today's published plan has an `agendar` block AND no future call → render embed; else show "no disponible ahora" message.
- [ ] 7.3 Render Calendly embed with prefilled `?email=` (client component; loads `NEXT_PUBLIC_CALENDLY_URL`). Skeleton while loading, no spinner.

## 8. Verification

- [ ] 8.1 `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all green.
- [ ] 8.2 Manual smoke on Preview: place `agendar` block on 3 days → eligible day shows CTA; simulate `invitee.created` webhook → block/gate flips to disabled on other days; `invitee.canceled` → eligible again; non-eligible day + direct URL refused; non-subscriber refused.
- [ ] 8.3 Document the deploy-time external dependency (Aura's Calendly account: event type + Zoom/Meet, webhook registration + signing key) in the change/handoff; tie E2E to L4 smoke.
