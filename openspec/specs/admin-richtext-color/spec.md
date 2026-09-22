# admin-richtext-color

## Purpose

The formatting controls Aura uses to style text in the admin Text block editor: text color, background highlight, and underline. It also covers the sanitizer rule that lets those styles survive saving. Only hex (or browser-normalized `rgb()`) `color` and `background-color` declarations are kept, so a styled block round-trips through save, re-edit and the portal, and no other inline style can get into stored content.

## Requirements

### Requirement: Text color and background highlight in the Text block editor
The admin Text block editor SHALL offer a text-color control (7 swatches incl. negro/blanco + "Automático") and a background control (8 swatches incl. negro/blanco/amarillo + "Sin fondo"), each with a custom hex input accepting only `#rrggbb` values. Applied colors MUST be emitted as inline `color` / `background-color` styles.

#### Scenario: Applying a swatch
- **WHEN** the admin selects text and taps the `#7a63d4` swatch
- **THEN** the selection renders in that color in the editor and the emitted HTML carries `color: #7a63d4`

#### Scenario: Custom hex
- **WHEN** the admin enters `#336699` in the custom field and applies it
- **THEN** the color is applied; an invalid value (e.g. `red`, `#12`) cannot be applied

#### Scenario: Removing color
- **WHEN** the admin chooses "auto" (text) or "sin fondo" (background)
- **THEN** the corresponding style is removed from the selection

### Requirement: Underline formatting
The Text block editor SHALL offer an underline toolbar button emitting the already-whitelisted `u` tag.

#### Scenario: Underlining text
- **WHEN** the admin applies underline to a selection
- **THEN** the saved HTML contains `<u>` around it and it renders underlined in the portal

### Requirement: Sanitization preserves only hex color styles
`sanitizeRichText` SHALL allow `span` and `mark` tags with a `style` attribute restricted to `color` and `background-color` whose values match `#rrggbb` or the browser-normalized `rgb(int,int,int)` form exactly (plus `inherit` for mark color); every other style, tag, or value MUST be stripped.

#### Scenario: Valid colors survive
- **WHEN** HTML with `<span style="color: #9982f4">` and `<mark style="background-color: #eddbd8">` is sanitized
- **THEN** both styles are preserved

#### Scenario: Hostile or non-hex styles are stripped
- **WHEN** HTML containing `style="position:fixed"`, `background-color: url(...)`, `color: expression(...)`, or `color: red` is sanitized
- **THEN** none of those declarations survive

#### Scenario: Round-trip through save and re-edit
- **WHEN** a colored block is saved and reopened in the editor
- **THEN** the colors load intact (mark keeps `data-color`) and the portal renders them
