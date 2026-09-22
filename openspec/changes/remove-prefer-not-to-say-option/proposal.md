# Proposal

## Why

The "Cancelar mi plan" exit survey is already optional: a client who confirms without choosing anything is recorded as `prefiero_no_decir`. An explicit "Prefiero no decir" radio duplicates that path and gives the client an easy way out of answering. Removing it keeps the list to real reasons.

## What Changes

- Remove "Prefiero no decir" from the cancel modal's radio list (drop `prefiero_no_decir` from `CLIENT_FACING_REASONS`, so `CANCELLATION_REASON_OPTIONS` loses it too).
- `cancelSubscription`'s zod enum is derived from the same constant, so an explicit `reason: "prefiero_no_decir"` is now rejected. Skipping the survey (no reason) still stores `prefiero_no_decir` — unchanged.
- The value stays everywhere else: `CancellationReason` union, DB `CHECK` (migration 019), `REASON_LABELS`, admin Motivo row, dashboard "Razones de cancelación" chart. Existing rows keep rendering "Prefiero no decir".

**Non-goals:** no migration, no change to the DB `CHECK` or the union, no rewrite of existing rows, no change to the skip-survey path, no admin/dashboard change, no new copy in the modal.

**Review rules touched:** 8 (options list from one exported constant; union must not narrow below the `CHECK` — it doesn't, only the client-facing subset shrinks). Rule 4 (zod validation of input) — the schema narrows by derivation.

**Sensitive surface:** none declared — no auth, RLS, service-role, webhook, money or migration change. The cancel server action is touched only through its derived enum. No fan-out.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `portal-subscription-management`: "Prefiero no decir" is no longer a selectable option; declining is expressed only by skipping the survey, which still records `prefiero_no_decir`.

## Impact

- `lib/portal/cancellation.ts` (`CLIENT_FACING_REASONS`, docblocks)
- `lib/portal/settingsActions.ts` (comment only; enum is derived)
- `components/portal/settings/CancelSubscriptionSection.tsx` (docblock only)
- `__tests__/cancellation.test.ts`, `__tests__/settings-actions.test.ts`
