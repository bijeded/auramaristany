## Context

`app/globals.css` sets `font-family: var(--font-body)` on `body` (line 94) and `var(--font-head)` on `h1..h4` (line 100). Tailwind's preflight then sets `button { font-family: inherit }`, so every button inherits Hind from `body`. Nothing else in the system has an opinion, and `buttonVariants` in `components/ui/button.tsx:8` declares `text-sm font-medium` but no family.

So a button is Oswald only if its call site says so. Five raw `<button>` elements and a couple of `<Button>` usages do; 31 raw buttons explicitly say `font-body`; and roughly 57 say nothing and silently render Hind. Aura noticed three of them.

The constraint that shapes everything below: **no gate in this repository can see the defect.** `tsc`, lint, Vitest (jsdom has no line boxes) and `next build` all pass in either state. Correctness here is established by a person looking at a screen, so the design's job is to shrink the number of places a person has to look — from ~103 call sites down to two declarations.

## Goals / Non-Goals

**Goals:**
- One place decides button font family, and one place decides button weight.
- A button written with no font class is correct by default.
- Opting out to the body font stays possible, costs nothing exotic, and is legible as deliberate.
- The three reported buttons are fixed as a consequence of the rule, not as three edits.

**Non-Goals:**
- Redesigning button sizing, color, radius, or spacing. Family and weight only.
- Changing tap targets. The documented 32px `kg | lb` exception is untouched.
- Unifying the two token definitions (`app/globals.css` custom properties vs the hard-coded stacks in `tailwind.config.ts:67`). Real drift risk, separate change.
- Reconciling primary-CTA styling generally — `CheckoutButton` also carries `uppercase tracking-wider` that no other CTA has. Noted, not fixed here.
- Any database, auth, Stripe or email surface. There is none.

## Decisions

**1. Set the default in two declarations, not one.**

`buttonVariants` covers only the 10 shadcn `<Button>` usages; the 93 raw `<button>` elements are the larger share of the problem and never touch that component. A CSS element rule covers those. Neither alone is sufficient, so both ship together:

- `components/ui/button.tsx` — add `font-head` to the base string, beside the existing `text-sm font-medium`.
- `app/globals.css` — a `button { font-family: var(--font-head); }` rule placed next to the existing `body` and `h1..h4` rules.

*Alternative rejected:* the CSS rule alone. It would work today (the `<Button>` base names no family, so the element rule would apply), but it makes the shadcn component's typography an accident of not declaring anything — the next `buttonVariants` edit that adds a family silently reverts every `<Button>`. Declaring it in both places states the intent where each kind of button is defined.

*Alternative rejected:* a codemod adding `font-head` to all ~103 call sites. That fixes today's render and preserves tomorrow's bug — the 104th button is still a coin flip, which is the actual defect.

**2. Write the CSS rule unlayered, beside `body`, matching the file's existing idiom.**

`globals.css` does not wrap its element rules in `@layer base`; `body` and `h1..h4` are plain rules after `@tailwind utilities`. The new rule follows that convention rather than introducing a second pattern in the same file.

This is safe for the opt-out because **specificity, not source order, decides here**: `.font-body` is a class (0,1,0) and beats the `button` element selector (0,0,1) no matter which comes first in the output. The 31 existing `font-body` buttons therefore keep Hind with no edit and no `!important` — the property the spec requires of the opt-out. It also beats preflight's `button { font-family: inherit }`, which is the same specificity but earlier in the sheet.

**3. Weight: keep the base's existing `font-medium`, and delete the redundant copies.**

`buttonVariants` already sets `font-medium`. The `font-medium` on `LoginForm.tsx:93` was always inert — `font-head` alone is what made `Ingresar` look right. Carrying that class into a fix would encode a false explanation of the bug, so it is removed rather than propagated.

The base weight stays `font-medium` (500). **Confirmed by eye at 375px on the Preview** — Oswald at 500 reads as medium, not bold, on both the lavender primary and the white secondary. No change to the weight was needed; the concern that motivated the check did not materialize.

**4. Body-font buttons are kept and re-framed, not stripped.**

All 31 sit on small dense admin controls (pagination, `Exportar CSV`, editor toolbars) at 12–13.5px, where Oswald's narrow condensed forms are hardest to read and where none of Aura's feedback pointed. They keep Hind by cascade, and this change reclassifies them from "unmarked default" to "stated exception" — but each is still looked at during the smoke pass rather than assumed correct, because "it already had a class" is not evidence anyone chose it.

**5. Remove the redundant `font-head` declarations in the same change.**

`LoginForm.tsx:93`, `PasswordForm.tsx:49`, `AccountForm.tsx:52`, `CheckoutButton.tsx:42`, and the inline `fontFamily: "var(--font-head)"` on the `H4` toolbar button in `TextBlockEditor.tsx:191`. Leaving them is harmless at render time and harmful at read time: the next developer copies the class and the pattern survives the fix.

**6. Link-styled CTAs keep their explicit `font-head` (discovered during implementation).**

Task 2.5's re-grep found more redundant declarations than the task list enumerated — 7 real buttons rather than 5 — and, more importantly, a category the design had missed: four primary CTAs that are `<Link>` / `<a>` elements styled to look like buttons (`GraduatedCard.tsx:33`, `app/portal/sin-suscripcion/page.tsx:26`, and both CTAs on the checkout page). A `button` element selector does not reach an anchor, so their `font-head` is **load-bearing, not redundant**, and removing it would have quietly pushed the marketing and checkout path back into Hind.

The default deliberately stays scoped to `button` rather than growing to `button, a.some-cta-class`: anchors have no shared marker class here, and widening the selector to all `<a>` would restyle ordinary prose links. The honest boundary is that the design system's default covers buttons, and link CTAs declare their own font — recorded in the spec so the next reader does not "clean up" the declaration.

This is the same failure mode as review rule 21: the original enumeration came from grepping one spelling (`<Button` with a few lines of context) instead of asking what shape of thing renders as a button.

## Risks / Trade-offs

**A label that fit in Hind no longer fits in Oswald** → Oswald is condensed and generally *narrower* per character, so overflow is unlikely and clipping less likely still; but `buttonVariants` sets `whitespace-nowrap`, so a label that does grow will overflow rather than wrap, silently. The smoke pass explicitly checks the longest labels (`Reactivar mi plan`, `Cancelar mi plan`, `Exportar CSV`) at 375px.

**~57 buttons change appearance with no one having asked** → this is the accepted cost of the root fix, chosen deliberately. Mitigation is scope of inspection, not scope of change: the smoke card walks the admin screens separately from the reported ones, since the admin is where the unrequested regressions would be.

**Oswald at 12–13px in dense admin UI reads worse than Hind** → the 31 explicit `font-body` controls are exactly this population and keep Hind. If the smoke pass finds an *undeclared* small control that now reads badly, the fix is to add `font-body` plus a one-line reason — the opt-out the spec provides.

**A future `buttonVariants` edit adds a family and silently reverts every `<Button>`** → mitigated by decision 1 (the base names `font-head` explicitly, so an edit has to remove a visible declaration rather than fill a vacuum).

**No automated test can protect this** → accepted and stated rather than papered over with a jsdom assertion that would pass regardless. A unit test asserting `buttonVariants()` contains `font-head` is cheap and does pin decision 1 against accidental deletion; it proves nothing about rendering, and the tasks say so.

## Migration Plan

No data migration, no schema change, no deploy coordination. Branch → Preview URL → visual smoke at ~375px on the Preview → PR → green CI → merge. Rollback is reverting the commit; there is no persisted state to unwind.

## Open Questions

- ~~**Does the base weight stay `font-medium`?**~~ **Resolved:** yes. Confirmed on the Preview at 375px — 500 reads correctly in Oswald on the lavender and white surfaces.
- **Do any of the 31 `font-body` controls actually want Oswald?** Answered by the same pass. Any that flip get the class removed; any that stay get their reason written down.
