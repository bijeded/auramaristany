# Spec Delta

## Purpose

Keeps every status and label badge (a short label on a tinted pill, in admin or portal) legible. All badges share one set of colour tones, and every tone meets the 4.5:1 text-contrast floor.

## ADDED Requirements

### Requirement: Badge tones meet 4.5:1 text contrast

Every colour tone a badge can use SHALL give its label a contrast ratio of at least 4.5:1 against the badge background. The ratio SHALL be measured with the background composited over the white surface badges sit on. This SHALL hold for the five tones badges use today:
- success: active, completed, paid
- lavender: trialing on admin screens, the program chip, an active automated message, a question type
- danger: a failed payment, inactive
- warning: can still charge, pending
- neutral: ended, void

The floor SHALL be checked automatically from the colour tokens themselves, so a later token edit that breaks it fails the test suite rather than reaching the screen.

#### Scenario: The trial badge is legible
- **WHEN** a client's subscription is `trialing` and the admin views the client list
- **THEN** the "Prueba" badge's text has a contrast ratio of at least 4.5:1 against its background

#### Scenario: The success badge is legible
- **WHEN** a subscription is `active` or a payment is `paid`
- **THEN** its badge text has a contrast ratio of at least 4.5:1 against its background

#### Scenario: A token edit that breaks the floor is caught
- **WHEN** a badge text or tint token is changed so that any tone falls below 4.5:1
- **THEN** the automated test suite fails and names the tone

### Requirement: Every badge draws its colours from the shared tones

Every status or label badge listed below SHALL take its colours from the shared tones and SHALL NOT write its own colour pair:
- subscription status in the admin client list and client detail
- subscription status on the client's portal subscription card
- payment status in the payments table, the dashboard and the client detail
- payment status in the client's portal payment history
- the program chip on the client list
- the active/inactive chip of an automated message
- the question-type, required and inactive badges in the onboarding builder

Other chips of the same shape (the portal card's program chip, the workout-focus chip on Hoy and on a history day, the "Compartida en N" chip in the series list, and the habit counter on Desempeño) are not converted in this change; they are tracked as D38.

A given payment status SHALL render with the same label and tone on every screen that shows it. A payment status with no entry SHALL show its raw value in the neutral tone on every screen. It SHALL NOT borrow another status's label.

Badge labels SHALL NOT change. The portal card keeps its client-facing wording, which deliberately differs from the admin wording.

#### Scenario: One payment status looks the same everywhere
- **WHEN** a payment is `open` and the admin views it in the payments table, the dashboard and the client detail
- **THEN** all three show the same label "Pendiente" in the same tone

#### Scenario: Unknown payment status is shown as itself
- **WHEN** a payment has a status value with no entry, on any screen that shows payment status
- **THEN** its badge shows the raw value in the neutral tone, and never "Pendiente" or "Anulado"

#### Scenario: Labels are unchanged
- **WHEN** the client views a `past_due` subscription on the portal subscription card
- **THEN** the badge still reads "Pago pendiente", now in a tone that meets the contrast floor
