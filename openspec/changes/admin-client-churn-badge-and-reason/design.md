## Context

`/admin/clients/[clientId]` renders `ClientDetailTabs`, whose Resumen tab prints a per-subscription block of label/value rows (start date, progress, loops, next-charge) built in `components/admin/ClientDetailTabs.tsx`. Nothing in that block names the subscription's status, and nothing reads `cancellation_surveys`.

Everything this change needs already exists:

- `statusBadge(status)` in `lib/admin/clients-helpers.ts` — the single presentation table for subscription status, already used by the clients list, already handling the fallback for a status the map does not know.
- `isChurned(status)` and `cancellationReasonLabel(reason)` in `lib/portal/cancellation.ts` — the mandated single derivation of "did this end in churn" and the single reason-label table, the latter already tolerant of a reason value the union has not caught up with.
- `cancellation_surveys` (migration 011, widened by 019), typed in `lib/supabase/types.ts`, with an admin-or-owner select policy.

So the change is a query extension plus presentation. The design work is entirely about **which rows count as cancelled**, which is the part of this domain that has repeatedly been got wrong.

## Goals / Non-Goals

**Goals:**

- Make a churned subscription unmistakable on the card Aura actually opens.
- Show the reason next to the person it belongs to, sourced from the existing survey table.
- Reuse the existing badge and label tables rather than growing a second copy of either.

**Non-Goals:**

- Any badge for `completed`, `completing`, or the grace window.
- Surfacing `source` (voluntary vs involuntary) as a separate marker.
- Any change to the clients list, the dashboard's cancellation analytics, the portal, or any Stripe path.
- Any migration or schema change.

## Decisions

### 1. Gate on `isChurned(status)`, not on `cancel_at_period_end`

`cancel_at_period_end = true` is true of three different populations: someone in the grace window, someone in her last paid month of a fixed-term programme, and someone who has graduated. Only the first is leaving. Gating on the flag would print "Cancelada" on every client who *finished* — the exact inversion ADR 0003 and ADR 0004 exist to prevent.

`deriveCancellationState` is the other candidate and is the wrong tool: it answers "what can this live subscription do now" and deliberately collapses a terminal `canceled` row to `none`. Asked for churn it would return nothing, silently. `isChurned` is the function whose documented job is "how did it end". Alternatives considered — a local `status === "canceled"` comparison — are rejected on rule 8 grounds: that is a copy that separates the day a second status counts as churn.

### 2. Reuse `statusBadge("canceled")` for the badge's label and colours

The clients list already renders exactly this badge, in grey, reading "Cancelada". A hand-written badge on the detail card would be a second presentation table for the same field — the copied table of rule 8, which has already blanked this very screen once. Take label, background and colour from `statusBadge`.

Consequence worth stating: this couples the detail badge to the list's wording, which is correct and intended. If the label changes, both move together.

### 3. Match survey rows on `subscription_id`, with `.in(...)` over already-loaded ids

`getClientDetail` already loads the subscription rows and their ids before it needs anything else. One further select — `cancellation_surveys` filtered by `.in("subscription_id", subIds)` — attributes each reason to exactly one subscription and, because `subscription_id` is nullable and set to null when a subscription is deleted, drops orphaned rows **by construction** rather than by a filter a later edit could remove.

Alternative rejected: matching on `profile_id`. It is the column that survives deletion, which is precisely why it is ambiguous — a client with two subscriptions would get one reason smeared across both.

If `subIds` is empty, skip the query entirely rather than issuing `.in(..., [])`.

Duplicate rows for one subscription are not expected but are not prevented by a constraint either; take the most recent by `created_at` and say so in code, rather than letting map-insertion order decide.

### 4. Read through the RLS-aware client, no service-role

`getClientDetail` already calls `requireAdmin()` and uses the RLS-aware client. Migration 011's `cancellation_surveys_select_own_or_admin` policy covers the admin read, so nothing here needs the service-role key (review rule 3). The new select goes through the same client as the rest of the function.

### 5. Reason presentation: label, optional detail, and a distinct empty state

The "Motivo" row is only rendered when the badge is. Text is `cancellationReasonLabel(reason)`; when `detail` is non-empty it is appended so Aura reads both what bucket the client chose and what she wrote. No survey row → `Sin motivo registrado`.

`prefiero_no_decir` deliberately stays distinct from that fallback: one is a client who answered "I'd rather not say", the other is a cancellation the system never surveyed (a Stripe-dashboard cancellation, or one predating migration 011). Collapsing them would lose a real answer.

`pago_fallido` needs no special casing — it is already a labelled reason, and decision 2's "same badge either way" means an involuntary exit simply reads with that reason.

## Risks / Trade-offs

- **A future reader re-derives churn from the columns** → The badge condition is a single call to `isChurned`; anything more elaborate on this card is the defect. Called out in the spec scenarios, which cover `completed`, `completing` and grace explicitly so a regression fails a test rather than a screenshot.
- **A survey row exists but its subscription was deleted** → It is silently invisible, and the churned subscription (if any remains) reads "Sin motivo registrado". Accepted: attributing it by `profile_id` would be a guess, and the aggregate on the dashboard still counts it.
- **`detail` is client-supplied free text rendered on an admin screen** → It reaches a React text node, which escapes. It must not reach `dangerouslySetInnerHTML` (review rule 18). The 200-character DB cap bounds the length.
- **Demo data cannot exercise this** → Seeded subscriptions carry synthetic Stripe ids (BACKLOG D28), so cancelling one through the product is not possible on the demo. Verification needs either a survey row inserted directly against a demo subscription or a real test-mode client taken through checkout and cancel. The smoke card must say which, and must not ask for a Stripe subscription that does not exist.
- **Widening the badge later** → If grace ever earns a badge, it comes from `deriveCancellationState`, not from loosening this condition. The two questions stay separate.

## Migration Plan

None. No schema change, no data backfill. Deploy is the ordinary branch → Preview → PR → merge path; rollback is a revert.

## Open Questions

- Placement of the badge within the block — beside the `{program} · {variant}` heading, or as its own row — is a visual call best made against the Preview URL. It does not change any decision above.
