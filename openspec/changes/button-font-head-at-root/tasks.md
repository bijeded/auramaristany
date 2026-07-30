## 1. Establish the default

- [x] 1.1 Add `font-head` to the `buttonVariants` base string in `components/ui/button.tsx:8`, beside the existing `text-sm font-medium`. Use the Tailwind utility, not a literal font stack.
- [x] 1.2 Add a `button { font-family: var(--font-head); }` rule to `app/globals.css`, placed next to the existing `body` (line 94) and `h1..h4` (line 100) rules and written unlayered to match the file's idiom.
- [x] 1.3 Add a unit test asserting `buttonVariants()` includes `font-head`. Pin its purpose in a comment: it protects the declaration from accidental deletion and proves nothing about rendering, because jsdom has no line boxes.

## 2. Remove the redundant declarations

- [x] 2.1 Remove `font-head font-medium` from `components/auth/LoginForm.tsx:93`, keeping `w-full`. Both classes are now redundant — `font-medium` always was.
- [x] 2.2 Remove `font-head font-medium` from `components/portal/settings/PasswordForm.tsx:49` and `components/portal/settings/AccountForm.tsx:52`.
- [x] 2.3 Remove `font-head` from `app/(marketing)/checkout/[variantSlug]/CheckoutButton.tsx:42`, **keeping** `uppercase tracking-wider` — that styling is out of scope and must not change.
- [x] 2.4 Remove the inline `fontFamily: "var(--font-head)"` from the `H4` toolbar button in `components/admin/blocks/TextBlockEditor.tsx:191`, keeping its `fontSize` and `fontWeight`.
- [x] 2.5 Re-grep the repo for `font-head` on a button and for inline `fontFamily` on a button, to confirm no redundant declaration was missed. Enumerate by shape, not by one spelling — check both the class and the inline-style forms (review rule 21).
- [x] 2.6 **Found by 2.5** — remove the redundant `font-head` from the buttons 2.1–2.4 missed: `components/auth/RegisterForm.tsx:202`, `components/auth/ResetPasswordForm.tsx:82`, `components/portal/settings/CancelSubscriptionSection.tsx:67` (`Reactivar mi plan`), `components/portal/PillarsView.tsx:42`, `components/admin/PillarEditorForm.tsx:45`, `components/admin/DayEditorForm.tsx:55`, `app/onboarding/questionnaire/QuestionnaireForm.tsx:136`. Keep each one's other classes (`uppercase tracking-wider`, layout, colors).
- [x] 2.7 **Found by 2.5** — do NOT remove `font-head` from the link-styled CTAs: `components/portal/settings/GraduatedCard.tsx:33` (`<Link>`), `app/portal/sin-suscripcion/page.tsx:26` (`<a>`), and both `<a>` CTAs on `app/(marketing)/checkout/[variantSlug]/page.tsx:86,93`. A `button` element selector does not reach an anchor, so there the declaration is load-bearing. Same for the non-button elements that carry `font-head` (headings, badges, `DayEditorForm.tsx:72` which is an `<input>`).

## 3. Confirm the reported buttons need no per-file edit

- [x] 3.1 Verify `components/auth/LogoutButton.tsx:19` is now correct with no change to that file, and confirm the same component renders in **both** `/portal/settings` and the `/admin` sidebar.
- [x] 3.2 Verify `components/portal/settings/CancelSubscriptionSection.tsx:87` (`Cancelar mi plan`) and `:153` (the modal's confirm) are correct with no change to that file.
- [x] 3.3 If either still needs a local edit, stop — that means the default did not actually land, and patching the call site would recreate the bug the change exists to remove.

## 4. Resolve the two open questions by eye

- [x] 4.1 On a Preview URL at ~375px, view a lavender primary button and a white secondary button and decide whether the base weight stays `font-medium`. **Verdict: stays `font-medium` (500)** — reads as medium, not bold, in Oswald on both surfaces. No change needed.
- [x] 4.2 Walk the 31 buttons that declare `font-body`. **Verdict: all stay in Hind** — none flip to Oswald. Reason recorded centrally in the spec (dense admin controls at 12–13.5px, where a condensed face reads worst; all admin-facing, no client-facing button takes the exception) rather than repeated at 31 call sites.
- [x] 4.3 Check the longest labels for overflow. **No clipping found** — Oswald is narrower than Hind, so no label grew past its button.

## 5. Visual verification

- [x] 5.1 Confirm the three reported buttons match `Ingresar` at 375px. **Confirmed** — Aura's reported defect is resolved.
- [x] 5.2 Sweep the unreported admin screens for regressions. **Clean** — no clipped, wrapped or overflowing labels from the font swap.
- [x] 5.3 Confirm tap targets remain ≥44px, `kg | lb` unchanged. **Confirmed.**
- [x] 5.4 Write the smoke card for the above. Every step must be possible with existing demo data and non-destructive.

## 6. Ship

- [x] 6.1 Run `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build`. Note in the PR that all four pass in either state — none of them lay out text, so they are not evidence the change works.
- [x] 6.2 Obtain a `code-review` verdict. No `security-review` expected: no database, auth, RLS, Stripe, webhook, cron or email surface is touched — state that explicitly rather than implying a verdict exists.
- [x] 6.3 Open the PR with the before/after screenshots at 375px, the confirmed weight from 4.1, and the `font-body` decisions from 4.2.
- [x] 6.4 Add a backlog row for the deferred token duplication: `tailwind.config.ts:67` hard-codes the `Oswald`/`Hind` stacks instead of referencing `var(--font-head)` / `var(--font-body)`, so the tokens live in two places and can drift.
