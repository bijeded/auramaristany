# Tasks

## 1. Tests first

- [x] 1.1 `__tests__/cancellation.test.ts`: change the options test to expect the six reasons ending in "otro" and assert `prefiero_no_decir` is absent; run it and see it fail
- [x] 1.2 `__tests__/settings-actions.test.ts`: replace "acepta 'prefiero_no_decir' elegido explícitamente" and "no guarda detalle junto a 'prefiero_no_decir'" with a test that an explicit `reason: "prefiero_no_decir"` is rejected with no Stripe call and no insert; keep the skip → `prefiero_no_decir` test; run and see it fail

## 2. Implementation

- [x] 2.1 Remove `"prefiero_no_decir"` from `CLIENT_FACING_REASONS`; update its docblock (skip is the only way to decline)
- [x] 2.2 Update the now-stale comments in `CancelSubscriptionSection.tsx` and `settingsActions.ts` that describe "Prefiero no decir" as a radio
- [x] 2.3 `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all green

## 3. Verification

- [ ] 3.1 Preview smoke (non-destructive): open `/portal/settings` as a seeded client, open "Cancelar mi plan", confirm six options and no "Prefiero no decir", close the modal without confirming

## 4. Handoff

- [ ] 4.1 Open PR `task/remove-prefer-not-to-say-option`; body states the silent-defect flag: **yes** — touches a client-facing enum subset and the cancel action's validation (DB `CHECK` and union unchanged)
