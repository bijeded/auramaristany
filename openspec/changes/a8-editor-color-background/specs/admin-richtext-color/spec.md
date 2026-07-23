# admin-richtext-color

## ADDED Requirements

### Requirement: Text color and background highlight in the Text block editor
The admin Text block editor SHALL offer a text-color control (6 brand swatches + "auto") and a background control (5 brand swatches + "sin fondo"), each with a custom hex input accepting only `#rrggbb` values. Applied colors MUST be emitted as inline `color` / `background-color` styles.

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
`sanitizeRichText` SHALL allow `span` and `mark` tags with a `style` attribute restricted to `color` and `background-color` whose values match `#rrggbb` exactly; every other style, tag, or value MUST be stripped.

#### Scenario: Valid colors survive
- **WHEN** HTML with `<span style="color: #9982f4">` and `<mark style="background-color: #eddbd8">` is sanitized
- **THEN** both styles are preserved

#### Scenario: Hostile or non-hex styles are stripped
- **WHEN** HTML containing `style="position:fixed"`, `background-color: url(...)`, `color: expression(...)`, or `color: red` is sanitized
- **THEN** none of those declarations survive

#### Scenario: Round-trip through save and re-edit
- **WHEN** a colored block is saved and reopened in the editor
- **THEN** the colors load intact (mark keeps `data-color`) and the portal renders them
