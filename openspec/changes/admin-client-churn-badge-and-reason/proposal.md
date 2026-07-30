## Why

The Resumen tab of a client's detail card (`/admin/clients/[clientId]`) shows the start date, progress and next charge, but **never shows the subscription's state**. A client who churned months ago reads exactly like an active one, and the reason she left — already captured in `cancellation_surveys` since migration 011 — is visible only in aggregate on the dashboard, never on the person it belongs to. Aura opens this card to decide whether to reach out; today it gives her no signal that there is nothing left to reach out about.

## What Changes

- The subscription block in the Resumen tab gains a **churn badge**, shown only when the subscription is terminal-cancelled (`isChurned(status)`, i.e. `status === "canceled"`).
- The same block gains a **"Motivo" row** with the human-readable cancellation reason, plus the client's free-text detail when the survey row carries one.
- When no survey row exists for a churned subscription, the row reads **"Sin motivo registrado"** rather than being omitted — the absence is itself information.
- `getClientDetail` extends its read with the matching `cancellation_surveys` rows.
- **No migration.** All columns and the admin-select RLS policy already exist (011, 019).

Explicitly out of scope, and deliberately so:

- **`completed` and `completing` subscriptions get no badge.** A client who finished her program carries `cancel_at_period_end = true` exactly like one who quit; labelling her "Cancelada" would turn Aura's best outcome into her worst-looking one (ADR 0003, ADR 0004, review rule 13).
- **The grace window gets no badge.** A client who cancelled but still has access stays visually normal until her period ends. Deliberate: the card stays quiet until the outcome is final.
- **`source` (`voluntary` / `involuntary`) is not surfaced.** A dunning-driven exit and a chosen one read identically; `pago_fallido` already reads as its own reason.

## Capabilities

### New Capabilities
- `admin-client-detail`: what the admin client detail card shows about a client's subscription state — specifically, when a churn badge appears and how the cancellation reason is presented.

### Modified Capabilities

_None._ `admin-cancellation-analytics` covers the dashboard-level aggregate and its requirements are unchanged; this change reuses its label helper without altering it.

## Impact

- `lib/admin/clients-queries.ts` — `getClientDetail` gains one read of `cancellation_surveys` keyed on the subscription ids it already loaded; `ClientSubscription` (or a sibling type) carries the reason.
- `components/admin/ClientDetailTabs.tsx` — Resumen tab renders the badge and the "Motivo" row.
- `lib/portal/cancellation.ts` — **read-only.** `cancellationReasonLabel()` and `isChurned()` are reused as-is; no second label table (review rule 8).
- `lib/supabase/types.ts` — already types `cancellation_surveys`; verify before assuming.
- No migration, no new dependency, no change to the portal or to any Stripe path.
