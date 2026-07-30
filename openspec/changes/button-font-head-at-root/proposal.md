## Why

Aura reported that `Cerrar sesión` and `Cancelar mi plan` in `/portal/settings`, and `Cerrar sesión` in the `/admin` sidebar, do not use the same font as the `Ingresar` button on `/auth/login`. They are right, but the report understates the problem: those three buttons are not the exception — **the login button is**. Nothing in the design system decides button typography, so buttons fall through to the body font (Hind) unless a developer remembers to hand-write `font-head` on that specific element. Roughly seven buttons in the whole codebase remembered.

The result is a design system with no source of truth for its most-used control. Every new button is a coin flip, and the defect is invisible to `tsc`, lint, the tests and the build — none of them lay out text — so it can only ever be caught by eye, one screenshot at a time, which is exactly how it reached Aura.

## What Changes

- **Button typography is decided in one place.** The heading font (Oswald) becomes the default for every `<button>` — set on the `buttonVariants` base for shadcn `<Button>`, and via a base-layer `button` rule in `app/globals.css` so plain `<button>` elements are covered too. A button no longer needs to opt *in* to looking like a button.
- **The hand-added `font-head` classes are removed** from the ~7 buttons that carry them, since the base now provides it. Leaving them would preserve the copy-the-class pattern that caused this.
- **Body-font buttons become an explicit, documented opt-out.** 31 raw `<button>` elements already carry an explicit `font-body` class (small dense admin controls: pagination, "Exportar CSV", editor toolbars). A Tailwind utility class outranks a base-layer element selector, so these keep Hind automatically. They are re-framed from "unmarked default" to "deliberate exception that states why", and each is confirmed by eye rather than assumed correct.
- **The `font-medium` on the login button is dropped as redundant** — `buttonVariants` already sets `font-medium`, so that class was never what made `Ingresar` look right. Only `font-head` was. Preserving it in a fix would encode a false explanation of the bug.
- **BREAKING (visual only):** this restyles buttons across the admin and the portal that were not individually reported, including primary CTAs, modal confirm/cancel pairs, and icon-plus-label controls. No behavior, route, or data change.

## Capabilities

### New Capabilities
- `button-typography`: which font family and weight a button renders in, where that decision lives, and how a button opts out of the default — covering shadcn `<Button>` and plain `<button>` alike, in the portal, the admin, and the marketing checkout.

### Modified Capabilities

None. No existing spec states a requirement about button typography — that absence is the defect this change fixes. `long-text-wrapping` is the closest neighbour (it governs how authored free text wraps) but its requirements are untouched: this change alters font family, not wrapping.

## Impact

**Code**
- `components/ui/button.tsx` — `buttonVariants` base string gains the heading font.
- `app/globals.css` — base-layer `button` rule, beside the existing `body` and `h1..h4` font rules (lines 94–101).
- Buttons that hand-add `font-head`, which becomes redundant: `components/auth/LoginForm.tsx:93`, `components/portal/settings/PasswordForm.tsx:49`, `components/portal/settings/AccountForm.tsx:52`, `app/(marketing)/checkout/[variantSlug]/CheckoutButton.tsx:42`, and the `H4` toolbar button in `components/admin/blocks/TextBlockEditor.tsx:191` (inline `fontFamily`, not a class).
- The three reported buttons, which need no per-file edit once the base is fixed: `components/auth/LogoutButton.tsx:19` (rendered in **both** `/portal/settings` and the `/admin` sidebar), `components/portal/settings/CancelSubscriptionSection.tsx:87` and `:153`.

**Surface, enumerated by content shape rather than by one class spelling** (CLAUDE.md review rule 21): 93 raw `<button>` elements plus 10 shadcn `<Button>` usages across `components/` and `app/`. Of the raw ones, 31 declare `font-body`, 5 declare `font-head`, and **~57 declare nothing at all** — that silent majority is the actual blast radius.

**Not affected:** no database, migration, auth, RLS, Stripe, webhook, cron or email surface. No `security-review` expected. Tap targets are unchanged, including the documented 32px `kg | lb` exception, which stays out of scope.

**Verification:** CI cannot see this class of defect — jsdom has no line boxes. The change needs a by-eye smoke pass at ~375px comparing `/auth/login`, `/portal/settings` and the `/admin` sidebar, plus a sweep of the admin screens whose buttons change without having been reported.

**Follow-on risk noted, not fixed here:** `tailwind.config.ts:67` hard-codes the `Oswald`/`Hind` stacks instead of referencing `var(--font-head)` / `var(--font-body)`, so the tokens exist in two places and can drift. Out of scope; flag for the backlog.
