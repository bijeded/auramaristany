## Why

The cancel modal already offers "Prefiero no decir", but the database has no such value, so `lib/portal/settingsActions.ts` stores it as `reason ?? "otro"`. Declining to answer and answering "Otro" become the same row, and there is no way to tell them apart afterwards.

That was a harmless rounding error while nothing read the table. It is not one any more: the "Razones de cancelación" card shipped in PR #42 and puts the "Otro" bar on Aura's dashboard, where it now silently mixes two populations — clients who gave a reason the list did not cover, and clients who chose not to give one. Those call for opposite responses, and the chart cannot distinguish them.

The modal is also the shape of the bug. "Prefiero no decir" is a hardcoded eighth radio at `CancelSubscriptionSection.tsx:172`, sitting outside `CANCELLATION_REASON_OPTIONS` and modelled as `reason === null` — a second list of options maintained by hand next to the real one.

## What Changes

- **New `prefiero_no_decir` value** in the `cancellation_surveys.reason` `CHECK` (migration 019) and in the `CancellationReason` union. The union and the `CHECK` move in the same change; neither is meaningful without the other.
- **The modal stops maintaining its own option.** The hardcoded eighth radio and the `reason === null` modelling are deleted; "Prefiero no decir" becomes the last entry of `CANCELLATION_REASON_OPTIONS`, so the radio list has exactly one source. It does not require a `detail`.
- **The skip path changes meaning.** `reason ?? "otro"` becomes `reason ?? "prefiero_no_decir"`. A client who confirms without choosing anything *did not say* — which is precisely what the new value records. **BREAKING** for the stored meaning of a skipped survey: rows written before this change say `otro`, rows after say `prefiero_no_decir`, and the two are not comparable.
- **No change to the dashboard charts.** `cancellationReasonLabel` is the single label source and the card renders whatever reasons exist, so the new bar appears on its own. The string fallback added in PR #42 means that even if the migration is applied before the code deploys, nothing renders blank.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `portal-subscription-management`: the exit survey gains a reason for declining to answer, and the "cancel while skipping the survey" scenario changes what it records — `prefiero_no_decir` instead of `otro`.

> Deliberately **not** modified: `admin-cancellation-analytics`. Its requirements already say labels come from `cancellationReasonLabel` and that reasons with no rows are absent, so a new enum value needs no spec change there. (That capability also does not exist in `openspec/specs/` yet — `dashboard-cancellation-charts` is merged but not archived — so a delta against it would have nothing to modify.)

## Impact

- **`supabase/migrations/019_*.sql`** — the `CHECK` constraint. Migration 011's insert policy (`reason <> 'pago_fallido'`) needs no change; the new value passes it unaltered.
- **`lib/supabase/types.ts`** — `CancellationReason` union.
- **`lib/portal/cancellation.ts`** — `REASON_LABELS` entry, `CANCELLATION_REASON_OPTIONS` order, and `reasonRequiresDetail` (which must *not* include the new value).
- **`lib/portal/settingsActions.ts`** — zod enum and the fallback.
- **`components/portal/settings/CancelSubscriptionSection.tsx`** — delete the hardcoded radio and the null modelling.
- **`__tests__/cancellation.test.ts`, `__tests__/settings-actions.test.ts`** — extended; both must stay green.

### The ordering is the risk

The migration must be **applied and verified against the real database before the app code merges** (rule 11). If the code ships first, the insert is rejected by the `CHECK` — and `cancelSubscription` deliberately swallows that error (`console.error`, the cancellation itself still succeeds, so no orphan row can exist for a cancellation that did not happen). The failure mode is therefore a **silently lost survey row** with nothing visible to the client, to Aura, or to CI. That is worse to detect than a crash, and it is why this change stays on the disciplined path with runtime verification.

### Historical rows cannot be corrected

Rows already stored as `otro` that meant "prefiero no decir" are indistinguishable — the information was destroyed at write time, and no backfill can recover it. The "Otro" bar on the dashboard stays contaminated for every pre-existing row; only cancellations after this change are clean. Aura should be told this rather than left to assume the chart self-corrects.
