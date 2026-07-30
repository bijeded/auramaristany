## MODIFIED Requirements

### Requirement: Bar fills meet the graphical-object contrast floor

Every bar fill on the dashboard's bar-list cards SHALL be a token defined in `app/globals.css` — never a hand-written hex — and SHALL reach at least 3:1 contrast against the `--gris-claro` track it sits on, per WCAG 1.4.11.

Contrast SHALL be measured against the **track**, not against the white card: the track is the adjacent color for the filled portion of the bar, and measuring against white is what let the previous fill pass inspection while failing in place. See `docs/adr/0005-bar-fill-contrast-measured-against-the-track.md`.

Cards displayed adjacently SHALL use different fills, so that stacked or side-by-side bar lists do not read as one continuous list. The dashboard now has four such cards in two pairs — the variant pair ("Clientes por variante", "Ingresos por variante") and the churn pair ("Cancelaciones por variante", "Razones de cancelación") — and the requirement applies to each new fill on the same terms as the original two.

The churn pair SHALL be filled in a hue that reads as attrition rather than achievement. Green is reserved: the dashboard already spends `--exito-text` on graduation, and a churn bar in the same family would contradict the very distinction `isChurned` exists to preserve.

#### Scenario: Clients bars
- **WHEN** the clients card renders
- **THEN** its bars are filled with `--lavanda-dark`, which clears 3:1 against `--gris-claro`

#### Scenario: Income bars
- **WHEN** the income card renders
- **THEN** its bars are filled with `--rosa-bar`, which clears 3:1 against `--gris-claro`

#### Scenario: Churn bars clear the floor
- **WHEN** either card of the churn pair renders
- **THEN** its bars are filled with a token that clears 3:1 measured against `--gris-claro`, verified before merge

#### Scenario: Adjacent cards are distinguishable
- **WHEN** the two churn cards render side by side
- **THEN** their fills differ from each other, and neither is filled in the green family reserved for graduation

#### Scenario: No raw hex remains
- **WHEN** the dashboard's bar components are inspected
- **THEN** no bar fill is expressed as a literal hex value
