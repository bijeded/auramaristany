# Tasks — a8-editor-color-background

## 1. Setup

- [ ] 1.1 Branch `feature/a8-editor-color` from `main`; install `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-highlight`, `@tiptap/extension-underline` (^3.26)

## 2. Sanitizer (TDD first — the security surface)

- [ ] 2.1 RED: extend `__tests__/sanitize-html.test.ts` — hex color/background survive on span/mark; hostile styles (`position`, `url()`, `expression()`), non-hex values, and other tags stripped; `u` and `data-color` preserved
- [ ] 2.2 GREEN: extend `lib/admin/sanitize-html.ts` (`span`/`mark`/`u` tags, `style` + `data-color` attrs, anchored `#rrggbb` `allowedStyles`)

## 3. Editor toolbar

- [ ] 3.1 Add extensions to `components/admin/blocks/TextBlockEditor.tsx` (TextStyle, Color, Highlight multicolor, Underline) + underline button
- [ ] 3.2 Text-color dropdown: swatches `#1a1a1a`(auto)/`#6b6b6b`/`#7a63d4`/`#9982f4`/`#e05c5c`/`#3a9468` + custom hex field (regex-validated, warning copy); click-outside pattern from DayCellMenu
- [ ] 3.3 Background dropdown: `#eddbd8`/`#f6ecea`/`#efeafe`/`#b4b3a4`/`#f5f5f5` + "sin fondo" + custom hex
- [ ] 3.4 Verify saved block re-opens with colors intact (Tiptap round-trip) and portal render (mark inline style wins over UA default; add scoped reset only if needed)

## 4. Verification & PR

- [ ] 4.1 Full gate: tsc · lint · test:run · build
- [ ] 4.2 Browser smoke: color+background+underline through save → portal
- [ ] 4.3 PR via github-pr — frontend + sanitizer ⇒ human review; **security-review subagent required** (input-parsing surface)

## Parallelization

Sequential: 2.x (sanitizer) → 3.x (editor) → 4.x. Group 2 and 3 could parallelize (different files) but sanitizer-first de-risks the editor work.
