# Smoke card — button-font-head-at-root

**Viewport: 375px wide** (DevTools → iPhone SE / "Responsive" at 375). This is the whole point of the card — nothing in `tsc`, lint, the 723 tests or the build lays out text, so this pass is the only real evidence the change works.

**What "correct" looks like:** Oswald is the **condensed, narrow** face used by every heading in the product (`Mi cuenta`, `Dashboard`, `Mensajes`). Hind is the **wider, rounder** face used by body copy. Every button label should now read in the narrow heading face.

All steps are read-only except where marked. **Nothing here deletes or charges anything.**

---

## A. The three reported buttons (task 5.1)

Log in as the demo client (`12345678`).

- [ ] **A1** — `/auth/login`, before logging in. Look at `Ingresar`. This is the reference: it looked right before the change and must look identical after.
- [ ] **A2** — `/portal/settings`. `Cerrar sesión` and `Cancelar mi plan` now match `Ingresar`. ⚠️ These are the two Aura reported — the whole change is judged here.
- [ ] **A3** — Same screen, scroll up: `Guardar cambios` (Mi cuenta) and `Guardar contraseña`. These had `font-head` hand-written before and must be **unchanged** — if either shifted, the base weight differs from what the call site used.
- [ ] **A4** — Log out via that button, then log in as admin (`hola@auramaristany.com` / `09876543`). `Cerrar sesión` in the `/admin` sidebar matches. Same component as A2 — confirms the fix landed once, not twice.

## B. The weight decision (task 4.1) — **needs your call**

Oswald renders heavier than Hind at the same numeric weight, and these sit on saturated lavender.

- [ ] **B1** — On `/portal/settings`, compare the **lavender** `Cerrar sesión` against the **white** `Cancelar mi plan`.
- [ ] **B2** — Verdict: does `font-medium` (500) read as *medium*, or as **bold**? If bold, say so — the fix is one declaration in `components/ui/button.tsx:8`, and it changes every button at once.

## C. Label overflow (task 4.3) — the silent failure

`buttonVariants` sets `whitespace-nowrap`, so a label too wide **overflows or clips rather than wrapping**. Oswald is narrower than Hind so this is unlikely, but it fails invisibly.

- [ ] **C1** — `Cancelar mi plan` (`/portal/settings`) — full label visible, nothing clipped at the button edge.
- [ ] **C2** — `Reactivar mi plan` — only visible on a client with a cancellation scheduled. **Skip if no such client exists in demo data** rather than creating one.
- [ ] **C3** — `Exportar CSV` and `Anterior` / `Siguiente` on `/admin/clients`.
- [ ] **C4** — `Continuar al pago` on a checkout page (`/checkout/<variant>`). **Do not complete a payment** — just look at the button.

## D. The `font-body` opt-outs (task 4.2) — **needs your call**

31 dense admin controls declare `font-body` and therefore still render in **Hind**. They keep it by cascade, which today is a default, not a decision. Confirm each still reads better in Hind than it would in Oswald at 12–13px.

- [ ] **D1** — `/admin/clients`: `Exportar CSV`, and the `Anterior` / `Siguiente` pagination.
- [ ] **D2** — `/admin/payments`: same pagination pair.
- [ ] **D3** — `/admin/onboarding-settings`: the `Cancelar` / `Guardar` pair in the question editor modal.
- [ ] **D4** — Any content block editor toolbar (`/admin/content/…` → edit a day → a text block): the `H4` button. It previously forced Oswald inline and now inherits it — confirm it still looks like a heading-preview button.
- [ ] **D5** — Verdict: any of these that should flip to Oswald? Or do they all stay Hind, with the reason written down?

## E. Admin regression sweep (task 5.2) — the unrequested changes

These screens change appearance without anyone having asked. This is where the risk introduced by the root fix lives.

- [ ] **E1** — `/admin/dashboard` — buttons and `Ver todos →` links.
- [ ] **E2** — `/admin/clients` → open a client → the 6 tabs. Check tab controls and any action buttons.
- [ ] **E3** — `/admin/content/<program>` — `Nueva serie`, the `⋯` menus on series rows, `Guardar` in the day editor.
- [ ] **E4** — `/admin/messages` — `Nuevo mensaje` and the send button.
- [ ] **E5** — Any modal confirm/cancel pair (e.g. the series delete dialog). **Open it and close it with Cancelar — do not confirm a delete.**

## F. Tap targets (task 5.3)

- [ ] **F1** — Buttons still ≥48px, tap targets ≥44px. Font family does not affect box height, so this is a confirmation, not a risk.
- [ ] **F2** — The `kg | lb` toggle (`/portal/today` → an exercise) is still 32px by documented exception, and **unchanged** by this work.

---

## Report back

For B2 and D5 I need an actual verdict — those are the two open questions the change deliberately left for the eye. For everything else, "all clean" or a screenshot of what's wrong is enough.
