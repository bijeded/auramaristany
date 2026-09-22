# Design

## Context

`CLIENT_FACING_REASONS` (`lib/portal/cancellation.ts`) is the single source for both the modal's radios (`CANCELLATION_REASON_OPTIONS`) and the server action's `z.enum`. The full value set lives in `CancellationReason` (`lib/supabase/types.ts`) and the DB `CHECK` from migration 019.

## Goals / Non-Goals

**Goals:** drop the radio; keep skip → `prefiero_no_decir`.
**Non-Goals:** DB, union, labels, admin, dashboard.

## Decisions

- **Remove the value from `CLIENT_FACING_REASONS`, not filter it in the component.** Filtering in JSX would reintroduce a second hand-maintained list (rule 8 / D19). Consequence: zod rejects an explicit `prefiero_no_decir`. Accepted — the server is the only writer of that value now, which matches the spec. Alternative (keep it in zod via a separate list) rejected: a second list for one value.
- `REASON_LABELS` and `reasonRequiresDetail` keep `prefiero_no_decir` — existing and skip-created rows still need a label, and must never require detail.

## Risks / Trade-offs

- A client with a stale bundle open that still shows the radio would get a generic error on that pick. Demo-only traffic; retrying reloads nothing but they can skip instead. Accepted.
