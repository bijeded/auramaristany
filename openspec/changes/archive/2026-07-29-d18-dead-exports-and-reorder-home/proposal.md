## Why

A sweep of `lib/` found four exported, tested functions with no production caller. They are not one problem: one is redundant by construction, two are genuinely orphaned, and one — `reindexOrder` — is **bypassed**, because `reorderQuestions` re-derives the ordering inline instead of calling it. That last one is the same defect PR #24 fixed on the admin client list: a decision with a tested home, re-made untested somewhere else. Here it also carries a failure mode, since the inline version writes N sequential `UPDATE`s and returns on the first error, leaving the questionnaire half-renumbered.

An exported helper that nothing calls is not neutral: it sits beside a live one and reads as the right thing to use, which is how the next reader picks the wrong predicate.

## What Changes

- **Remove `subscriptionGrantsPortalShell`** (`lib/content/subscription-access.ts`) and its tests. It is redundant by construction: all three shell call sites push `PORTAL_SHELL_STATES` into SQL via `.in(...)`, so every row reaching memory is already a shell row and the predicate would always answer `true`. `ACCESS_STATES`, `GRADUATED_STATES`, `PORTAL_SHELL_STATES`, `subscriptionIsGraduated` and `derivePortalTier` all stay exactly as they are.
- **Remove `isDayAccessible`** (`lib/content/access.ts`) and its tests. It gates a day by "on or before the current position", which belongs to the superseded "Día X de 180" model; the portal serves one day via `getCurrentDayKey` and the week view via `UpcomingDayKey`. Nothing has needed it.
- **Give `reindexOrder` its single home.** `reorderQuestions` computes the new positions with `reindexOrder` and applies them in **one** statement through a new `SECURITY INVOKER` RPC, instead of a loop of updates. Fixes the partial-reorder failure mode in the same move.
- **Keep `cancellationReasonLabel` deliberately**, documented in place. It is not dead but early: it renders a cancellation reason for a human, and the admin view that will read `cancellation_surveys` is planned as its own later change. Removing it would only mean rewriting it.

Not breaking: no route, payload or stored value changes shape, and no client-visible copy changes.

## Capabilities

### New Capabilities
- `admin-onboarding-questions`: ordering integrity for the onboarding question builder — the admin's drag-and-drop order is persisted as a whole, and a failed save leaves the previous order intact rather than a partial renumbering.

### Modified Capabilities
- `portal-graduated-access`: the requirement "Graduated access is distinct from paying access" currently reads as though a separate named **predicate** must decide shell access. The separation it protects is real and stays; what enforces it is the separately named **state set** (`PORTAL_SHELL_STATES`, applied in the query) plus `derivePortalTier`. The requirement is reworded so the spec describes what actually guards the boundary, and no future reader re-adds a redundant predicate to satisfy the letter of it.

## Impact

- **Code:** `lib/content/subscription-access.ts`, `lib/content/access.ts`, `lib/admin/onboardingActions.ts`, `__tests__/subscription-access.test.ts`, `__tests__/content-access.test.ts`, `__tests__/onboarding-helpers.test.ts`.
- **Database:** one new migration adding a `reorder_onboarding_questions(jsonb)` function. `SECURITY INVOKER`, so RLS and the existing admin write policy govern it — no service-role path is introduced. No table, column or constraint changes.
- **Untouched:** `ACCESS_STATES` and every content-serving path; the graduated tier's behaviour; the portal UI; `cancellation_surveys` and everything that writes to it.
- **Risk:** low and mostly subtractive. The one behavioural change is the admin reorder write, which needs a smoke of the drag-and-drop in `/admin/onboarding-settings`.
