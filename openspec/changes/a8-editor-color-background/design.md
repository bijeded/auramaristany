# Design — a8-editor-color-background

## Context

`TextBlockEditor.tsx` uses Tiptap 3 StarterKit only. Save path: server action → zod (`content-validation.ts`) → `sanitizeRichText()` (`lib/admin/sanitize-html.ts`) with a conservative whitelist (no `span`, `mark`, or `style`). Portal renders sanitized HTML. Decisions from exploration (confirmed): brand swatches (incl. `#eddbd8`, `#9982f4`, new `#b4b3a4`) **plus** custom hex input; `#eddbd8`/`#b4b3a4` live in the background set (1.3:1 / 2.1:1 as text — illegible); underline button added.

## Goals / Non-Goals

**Goals:**
- Text color + background highlight + underline in the Text block editor.
- Swatch dropdowns (validated palette above) + custom `#rrggbb` input each.
- Styles survive `sanitizeRichText` and render in the portal.

**Non-Goals:**
- No changes to other block editors, portal components, zod schema, or DB.
- No arbitrary CSS — only `color` and `background-color` in hex form survive.
- No named colors, `rgb()`, gradients, or CSS variables in saved HTML.

## Decisions

1. **Extensions:** `TextStyle` + `Color` (emits `<span style="color: #hex">`), `Highlight.configure({ multicolor: true })` (emits `<mark data-color style="background-color: #hex">`), `Underline` — all MIT, ^3.26.
2. **Sanitizer policy — strict regex, not enumeration:** custom hex makes enumerating values impossible, so:
   - `allowedTags`: + `span`, `mark`, `u`
   - `allowedAttributes`: `span: ["style"]`, `mark: ["style", "data-color"]`
   - `allowedStyles`: `{ "*": { color: [/^#[0-9a-f]{6}$/i], "background-color": [/^#[0-9a-f]{6}$/i] } }`
   Anchored regex ⇒ nothing but a lone 6-digit hex survives; `expression()`, `url()`, vars are impossible. TDD the sanitizer: kept styles, stripped hostile styles (`position`, `background:url(...)`, `expression`), stripped non-hex color values, `u` preserved.
3. **Custom hex input:** small text field in each dropdown, client-validated with the same regex before applying (`editor.chain().setColor(hex)`); invalid input disabled. Note in UI copy that contrast is the author's responsibility ("Revisa que se lea bien").
4. **Toolbar UX:** two dropdown buttons after the list buttons (`A` with color underbar, highlighter icon), swatches as 24px circles (36px tap area), "auto"/"sin fondo" as first option (unsetColor / unsetHighlight). Popover pattern: reuse the click-outside menu pattern from `DayCellMenu` (same as SeriesAccordion ⋯ menu).
5. **Portal `mark` reset:** browsers give `mark` a default yellow background; the inline `background-color` overrides it, but add a defensive `mark { background: transparent }` scoped to the portal text-block styles only if needed after verification (verify first — likely unnecessary since inline style wins).

## Risks / Trade-offs

- [Custom hex lets Aura pick illegible combos] → guided swatches first, warning copy in the custom field; accepted by product decision.
- [sanitize-html style parsing differences across versions] → the tests pin exact surviving output; CI catches regressions on dependency bumps.
- [`Highlight` emits `data-color` and `style` — stripping `data-color` would still render fine] → keep it whitelisted so editing round-trips (Tiptap re-reads its own HTML when re-editing a saved block).
- [Old content without spans] → unaffected; removing a swatch later degrades to plain text via sanitizer (graceful).
