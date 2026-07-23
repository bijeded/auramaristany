# Proposal — a8-editor-color-background

## Why

Aura asked for text color and background highlighting in the admin Text block editor (BACKLOG A8) to make program content more expressive. Today `TextBlockEditor` is StarterKit-only and `sanitizeRichText` strips every style — color must be added end-to-end (editor UI + sanitizer whitelist) or it silently vanishes on save.

## What Changes

- **Tiptap extensions (MIT):** add `@tiptap/extension-text-style` + `@tiptap/extension-color` (text color) and `@tiptap/extension-highlight` (multicolor backgrounds) to `TextBlockEditor`; also add an **underline** button (`u` tag already whitelisted).
- **Toolbar:** two swatch dropdowns — text color (6 brand swatches, contrast-validated) and background (5 swatches + "sin fondo") — each with a **custom hex input** (`#rrggbb`).
  - Text: `#1a1a1a` (auto) · `#6b6b6b` · `#7a63d4` · `#9982f4` · `#e05c5c` · `#3a9468`
  - Background: `#eddbd8` · `#f6ecea` · `#efeafe` · `#b4b3a4` · `#f5f5f5` · sin fondo
- **Sanitizer:** extend `lib/admin/sanitize-html.ts` to allow `span`/`mark` with a `style` attribute restricted via `allowedStyles` to `color` and `background-color` matching a strict `#rrggbb` regex (custom colors make enumeration impossible; anchored regex keeps CSS-injection surface zero). Allow `u`.
- **Portal:** no render change needed (`TextBlock` injects sanitized HTML); verify `mark` default styling doesn't fight the inline background.

## Capabilities

### New Capabilities
- `admin-richtext-color`: text color, background highlight, and underline in the admin Text block editor, with brand swatches + custom hex, preserved through sanitization and rendered in the portal.

### Modified Capabilities

_None (no existing spec covers the editor)._

## Impact

- **Deps:** +3 MIT Tiptap packages (same ^3.26 line as the pinned core).
- **Modified:** `components/admin/blocks/TextBlockEditor.tsx` · `lib/admin/sanitize-html.ts` (+ its tests — pure, TDD).
- **Untouched:** `content-validation.ts` zod shape (html string unchanged), portal `TextBlock`, other block editors, DB.
- **Security:** sanitizer is an input-parsing surface → security-review (Step 4.5) will run.
