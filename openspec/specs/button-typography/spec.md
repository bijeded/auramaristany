# button-typography Specification

## Purpose
Which font family and weight a button renders in, where that decision lives, and how a button opts out — across the portal, the admin, and the marketing checkout, for shadcn `<Button>` and plain `<button>` alike.

The rule in one line: **a button written with no font class is already correct.** The default lives in exactly two declarations (the `buttonVariants` base and the `button` rule in `app/globals.css`), never at the call site. Before this existed, buttons inherited the body font and looked right only where an author remembered to write `font-head` — 7 of ~103 did, and Aura reported three of the rest.

Two boundaries a reader will need. The element rule reaches `button` only, so a `<Link>`/`<a>` dressed as a button decides its own font at the call site — enumerate that population by **styling, not by which font class it already carries**. And nothing in `tsc`, lint, the tests or the build resolves a font, so a change here is verified by eye at ~375px or it is not verified.
## Requirements
### Requirement: Buttons render in the heading font by default

Every button in the product — the shadcn `<Button>` component and any plain `<button>` element, in the portal, in the admin, and on the marketing checkout — SHALL render its label in the heading font (`--font-head`, Oswald) without the author naming the font at the call site.

The default SHALL be carried by the design system in exactly two places: the `buttonVariants` base for `<Button>`, and a base-layer `button` rule in `app/globals.css` for plain `<button>`. A button that names `font-head` at its call site is redundant, and the redundant declarations SHALL be removed so that no call site appears to be the reason a button looks correct.

The font SHALL be referenced through the token (the `font-head` Tailwind utility or `var(--font-head)`), never as a hard-coded font stack.

#### Scenario: The reported buttons match the login button
- **WHEN** a client opens `/portal/settings` and compares `Cerrar sesión` and `Cancelar mi plan` against the `Ingresar` button on `/auth/login`
- **THEN** all three render in Oswald
- **AND** no visible font difference remains between them

#### Scenario: The same button component in the admin
- **WHEN** an admin views the `Cerrar sesión` button in the `/admin` sidebar
- **THEN** it renders in Oswald, from the same single decision that styles the portal button — the component is shared, so it is not fixed twice

#### Scenario: A button that declares no font
- **WHEN** any of the ~57 plain `<button>` elements that declare no font family is rendered
- **THEN** it renders in Oswald rather than inheriting Hind from `body`

#### Scenario: A new button written after this change
- **WHEN** a developer adds a `<button>` or `<Button>` and writes no font class at all
- **THEN** it renders in Oswald
- **AND** the developer does not need to know the rule for the button to be correct

#### Scenario: The token is not duplicated
- **WHEN** the button default is read in `components/ui/button.tsx` or `app/globals.css`
- **THEN** it resolves through `--font-head` / the `font-head` utility
- **AND** no literal `Oswald` font stack is introduced at either site

### Requirement: A body-font button is an explicit, stated exception

A button MAY render in the body font (`--font-body`, Hind) only by declaring `font-body` explicitly at its call site. Such a button is an exception to the design system, not an unmarked default, and the reason SHALL be stated so a later reader can tell a deliberate choice from a forgotten one.

The default SHALL be expressed at a specificity that an explicit `font-body` utility class overrides, so that opting out requires no `!important` and no ordering trick.

#### Scenario: An existing dense admin control keeps the body font
- **WHEN** an admin views a control that already declares `font-body` — a pagination `Anterior` / `Siguiente` pair, `Exportar CSV`, or a rich-text editor toolbar button
- **THEN** it still renders in Hind after this change, because the utility class outranks the base-layer default

#### Scenario: Opting out needs no override hack
- **WHEN** `font-body` is placed on a button alongside the new default
- **THEN** the body font wins on ordinary cascade specificity
- **AND** neither `!important` nor a source-order dependency is required

#### Scenario: A body-font button states its reason
- **WHEN** a reviewer reads a button that declares `font-body`
- **THEN** the reason it departs from the default is recorded at that site or in this spec
- **AND** an undeclared button is unambiguously a default, not a silent exception

**Recorded reason for the current exceptions.** The 31 buttons that declare `font-body` are dense admin controls rendered at 12–13.5px: table pagination (`Anterior` / `Siguiente` on the clients and payments lists), `Exportar CSV`, the rich-text editor toolbars, and the modal `Cancelar` / `Guardar` pairs in the onboarding editor. Oswald is a condensed face and is hardest to read at exactly those sizes, so they stay in Hind. This was reviewed button by button at 375px during this change and confirmed deliberate — it is a decision, not an oversight.

Every one of these is **admin-facing**, and that is the line: a control an admin uses dozens of times a day at 13px optimizes for legibility, while a client-facing call to action optimizes for matching the buttons beside it. No client-facing button or CTA takes this exception.

### Requirement: A link styled as a button keeps its font declared at the call site

Several calls to action are `<Link>` or `<a>` elements styled to look like buttons. The base-layer default is scoped to the `button` element and therefore SHALL NOT reach any of them: an anchor's font is decided **only** by its own class.

The population is defined by **styling, not by which class it already carries** — every `<Link>`/`<a>` that is dressed as a button, regardless of whether it currently says `font-head` or `font-body`. Enumerating it as "the anchors that carry `font-head`" is the review-rule-21 error one level out, and it hid five link CTAs on the first pass.

Two groups, both SHALL be kept correct:

- **Already declaring `font-head`** — the graduated-client CTA, the `sin-suscripcion` CTA, and the two checkout CTAs. These SHALL keep the declaration. Removing it as "redundant" would silently return them to the body font, reintroducing on the marketing and checkout path exactly the defect this change removes elsewhere.
- **Client-facing CTAs that declared `font-body`** — `Agendar mi llamada` (`AgendarBlock`) and `Volver a Hoy` (`/portal/booking`), both full lavender primaries at `minHeight: 48`. These SHALL declare `font-head`. Before this change they matched the unmarked buttons beside them because both rendered in Hind; making buttons Oswald without moving these would **introduce** a mismatch on a client-facing screen — the same defect this change exists to remove.

Admin-facing link CTAs (`Enviar mensaje`, `Enviar WhatsApp`, `+ Nuevo mensaje`, the content-runway link) stay in `font-body`, under the same admin-density exception recorded above.

#### Scenario: A link CTA is not touched by the button default
- **WHEN** the `font-head` on a link-styled CTA is removed on the assumption that the base now covers it
- **THEN** that CTA renders in Hind, because it is not a `button` element
- **AND** it visibly mismatches the real buttons beside it

#### Scenario: Link CTAs still match real buttons after the change
- **WHEN** a client views the checkout CTAs and the `sin-suscripcion` CTA
- **THEN** they render in Oswald, from their own explicit declaration, matching the buttons elsewhere in the product

#### Scenario: A client-facing link CTA beside a real button
- **WHEN** a client views `Agendar mi llamada` on their day, or `Volver a Hoy` on the booking screen
- **THEN** it renders in Oswald, matching the buttons on the same screen
- **AND** it did not stay in Hind while the buttons around it changed

#### Scenario: The link-CTA population is enumerated by styling
- **WHEN** the set of button-styled anchors is derived
- **THEN** it includes every `<Link>`/`<a>` dressed as a button, whichever font class it currently carries
- **AND** it is not derived from the anchors that happen to already declare `font-head`

### Requirement: Button weight is decided once, with the font

The button's font weight SHALL be set by the same base declaration as its family, and SHALL NOT be restated at call sites. `buttonVariants` already sets `font-medium`; the `font-medium` written beside `font-head` on the login button is therefore inert and SHALL be removed rather than copied to other buttons, because keeping it records a false explanation of why that button looked right.

Because Oswald reads heavier than Hind at an identical numeric weight, the chosen weight SHALL be confirmed by eye against the pink and lavender surfaces before this change ships, and the resulting value recorded.

#### Scenario: Redundant weight class removed
- **WHEN** `font-medium` is removed from the login button's class list
- **THEN** the button's rendered weight is unchanged, since the base already supplies it

#### Scenario: Weight confirmed on the real surfaces
- **WHEN** the chosen weight is viewed on a lavender primary button and on a white secondary button
- **THEN** it reads as intended rather than as bold, and the confirmed value is recorded in the change

### Requirement: The change is verified by eye, not by CI

This is a rendering change that no automated gate in the repository can observe: `tsc`, lint, the Vitest suite (jsdom has no line boxes) and the build all pass whether or not the fonts are correct. Verification SHALL therefore include a manual visual pass at a ~375px viewport before merge.

The pass SHALL cover the reported screens and, separately, the screens whose buttons change without having been reported — the admin — since those carry the regression risk this change introduces.

#### Scenario: Reported screens compared side by side
- **WHEN** the reviewer opens `/auth/login`, `/portal/settings` and the `/admin` sidebar at ~375px
- **THEN** every button label renders in Oswald, and the three reported buttons are indistinguishable in font from `Ingresar`

#### Scenario: Unreported admin screens swept for regressions
- **WHEN** the reviewer walks the admin screens whose buttons change without having been reported
- **THEN** no label wraps, clips, or overflows its button as a result of the font swap
- **AND** every tap target remains at least 44px tall, the documented 32px `kg | lb` toggle excepted

