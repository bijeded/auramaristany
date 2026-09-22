# Design

## Context

See proposal.md (Why) for the batch. Three facts shape the approach:

- **Badges.** Every badge colour pair is written inline as a `{bg, color}` literal at each badge site. The success tint is a raw `rgba(76,175,125,.14)` with no token, a gap in the token system that D23 already forbids. `ClientDetailTabs.PAY_STATUS` is a value-for-value copy of `lib/admin/payment-status.ts` under a different key name (`label` vs `text`).
- **Measured contrast on white.** Success 2.40, danger 3.20, warning 3.70, lavender 3.92, neutral 4.89. `--exito-text` exists but reaches only 4.43 on the success tint.
- **Headers.**
  - Three header sites are in `"use client"` components (`TodayView`, `ProgressView`, `PillarsView`/`MessagesList` via props) and `WeekView` is a server component.
  - `ProgressView` calls `new Date()` itself during render. It is server-rendered on UTC and hydrated in the browser's zone, so the text can differ between the two passes in the evening window. That is a latent hydration mismatch today.
  - `weekdayLabel(iso?)` in `lib/admin/date-helpers.ts` already produces the exact format and already reads the real clock when called with no argument.

## Goals / Non-Goals

**Goals:**
- One source for badge colours.
- A test that ties the 4.5:1 floor to the real tokens.
- One header-date path with no clock reads in client components.
- A pure, exhaustive test that every DB status is reachable by a filter.

**Non-Goals:**
- Moving `weekdayLabel` out of `lib/admin/`. It is already shared with the portal; relocating it is churn.
- A generic `<Badge>` component. Each site keeps its markup; only the colour source changes.
- Unifying the subscription-status label maps of admin and portal. Their wording differs on purpose.

## Decisions

### 1. Badge tones: one constant, backed by tokens

- `lib/ui/badge-tones.ts` exports `BADGE_TONE` with five tones: `success`, `lavender`, `danger`, `warning`, `neutral`. Each is `{ bg, color }` holding only `var(--token)` references.
- Every badge map listed in the spec (`status-badge-contrast`) replaces its literal pair with `BADGE_TONE.<tone>`. That includes the spread `AMBAR` constant in `clients-helpers.ts`, which becomes `BADGE_TONE.warning`. The tone each status maps to is unchanged: the portal card keeps `trialing` green, and admin keeps it lavender.
- **Single source of truth.** Tone → token lives in `BADGE_TONE`, and token → value lives in `app/globals.css :root`.

*Alternative considered: a `<Badge tone>` component.* It would unify markup too, but it touches every call site's JSX for no contrast benefit. Rejected for scope.

### 2. Tokens: add text shades, keep base colours

- **Add** `--exito-tint`, with the same value as today's raw rgba, so the success tint stops being a hand-written colour.
- **Add** `--lavanda-text`, `--error-text` and `--ambar-text`.
- **Darken** `--exito-text` until it passes on `--exito-tint`. Its four existing users are graduation accents, and a darker green keeps the meaning the dashboard spec reserves green for.
- **Neutral** already passes with `--gris-texto` on `--gris-claro`.
- **Base tokens are not edited.** `--exito`, `--error`, `--ambar` and `--lavanda` also colour icons, fills and charts, which have a 3:1 non-text floor and would shift everywhere.
- **Choosing values.** Each new text shade keeps its base hue and is darkened until the test in decision 3 passes with margin (target ≥ 4.7:1, so a rounding tweak doesn't flap). The exact hex is picked during apply, and the test is the judge.

### 3. The contrast test reads `globals.css`, not a copy

- A pure helper, `lib/ui/contrast.ts`, provides:
  - `contrastRatio(fg, bg)` (WCAG 2.x relative luminance)
  - `compositeOverWhite(color)` for `rgba()` tints
- `__tests__/badge-contrast.test.ts` then:
  - reads `app/globals.css`
  - resolves the `:root` custom properties
  - resolves each `BADGE_TONE` entry's `var()` pair against them
  - asserts ≥ 4.5 per tone, naming the tone on failure
- The helper is test-first, against known WCAG pairs such as black/white = 21 and #767676 on white ≈ 4.54.

*Alternative considered: hard-coding the hex pairs in the test.* That checks a copy that drifts from the tokens the moment someone edits `globals.css`, which is exactly the edit the test exists to catch. Rejected.

### 4. Payment status: one map, one lookup

Four sites render a payment-status badge:
- `PaymentsTable`
- the dashboard
- `ClientDetailTabs`
- the portal's `PaymentHistory`

They disagree on the fallback for a status with no entry:
- `PaymentsTable` and the dashboard fall back to `open`, which labels an unknown invoice "Pendiente". That is a wrong claim, not merely an ugly one.
- `PaymentHistory` falls back to `void`.
- `ClientDetailTabs` keeps its own copy, `PAY_STATUS`, and falls back to the raw value.

The fix:
- `lib/admin/payment-status.ts` gains `paymentStatusBadge(status)`. It returns the entry, or the raw value in the neutral tone, the same rule `statusBadge()` already uses for subscriptions.
- All four sites call it.
- `PAY_STATUS` is deleted, and so are the three `?? STATUS_LABEL.x` fallbacks.
- The lookup is pure, so it is test-first: known statuses map to their label and tone, an unknown one maps to itself in neutral.

The portal `SubscriptionCard` fallback (to `canceled`) is left as is. A client without portal access never reaches that card, and its wording is client-facing.

### 5. Filters: status-only options, exhaustiveness checked by `tsc`

- `StatusFilter` gains four literals; `STATUS_FILTERS` appends `"En prueba"`, `"Pausadas"`, `"Incompletas"` and `"Expiradas"` after `"Sin actividad"`. The select and `parseStatusFilter` pick them up with no component change: rule 8, one exported constant.
- In `filterClients`, each new option is a single status-equality guard, the same shape as "Activas" and "Canceladas".
- **Exhaustiveness test.** The "every accepted status is reachable" test builds its status list as `const ALL = { active: true, trialing: true, … } satisfies Record<SubscriptionStatus, true>`. `tsc` then fails the test file if the DB union (from `types.ts`) gains a value, before any row can go missing. For each status it builds an active-recently row and asserts that some entry of `STATUS_FILTERS` returns it.

*Alternative considered: deriving the status-only options from a `{label → status}` map.* Neater, but the union literal type would then come from a second structure, and the existing cohort and activity options can't be expressed that way. Rejected: two shapes for one list.

### 6. Header date: computed in the page, passed as a prop

- Each of the seven portal pages computes `weekdayLabel()` in its server component and passes it as `dateLabel`.
- `TodayView`, `ProgressView` and `WeekView` gain a `dateLabel` prop and call no clock. `PillarsView` and `MessagesList` already take one.
- The five `todayLabel()` functions are deleted. `/today` stops reading `content?.effectiveDate` for the header, and `/pilares` stops going through `serverToday()`.
- The page is a server component, so the string is fixed at render time and hydration reuses it. That fixes `ProgressView`'s latent mismatch as a side effect.
- `weekdayLabel()` with no argument already reads `new Date()`. Its test gains a fake-timer case that pins the no-arg output to the system time, plus a case asserting `DEV_DATE` is ignored.

*Alternative considered: calling `weekdayLabel()` inside each view.* Simpler diff, but it puts clock reads in client components: the mismatch the second requirement of `portal-header-date` forbids. Rejected.

### 7. First component render test (D30)

- `__tests__/clients-table-status-select.test.tsx` renders `ClientsTable` with Testing Library, using `vi.mock("next/navigation")` for `useRouter`, `usePathname` and `useSearchParams`, one or two rows, and a fixed `now`.
- It asserts the status `<select>`'s option values equal `["", ...STATUS_FILTERS]` in order.
- It is the repo's first `.tsx` component test. Vitest's default include already matches `.test.tsx`, and jsdom and jest-dom are already in `vitest.setup.ts`, so no config change is expected. If one proves necessary, it lands in the same task.

## Risks / Trade-offs

- **[Visible restyle Aura will notice]** Badge text darkens on six screens. → It is called out as a visible change in the proposal and PR body, and checked by eye in the smoke steps.
- **[Darkening `--exito-text` shifts its existing uses]** → Only four uses, all graduation accents; the smoke steps include the dashboard.
- **[Parsing CSS in a test is brittle]** → The parser handles only `--name: value;` lines inside `:root`, which is the file's current shape. A token the test cannot resolve fails loudly by name instead of passing silently.
- **[The header date stays UTC on the server]** → Accepted and logged as D37. The header now at least agrees across all seven pages.
- **[`TodayView`'s header no longer follows `DEV_DATE` in local dev]** → This is the user's explicit decision. Content still follows `DEV_DATE`; only the header shows the real date.
