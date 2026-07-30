## MODIFIED Requirements

### Requirement: Free text never overflows its container

Every surface that renders authored free text — whether written by Aura (rich-text content blocks, message subjects and bodies, an exercise's repetition value) or by a client (day notes) — in the portal, in the admin, and in outgoing email, SHALL wrap an unbreakable token that is wider than its container, so that no text escapes its container and no page gains horizontal scroll.

The system SHALL use `overflow-wrap: break-word` for this. It SHALL NOT use `word-break: break-all` (which breaks ordinary Spanish prose mid-word) and SHALL NOT rely on `overflow-wrap: anywhere` (which additionally changes min-content width and can reflow flex and grid parents).

Where such a surface is a flex child, it SHALL also carry `min-width: 0`, because a flex child's default `min-width: auto` refuses to shrink below its content width and makes `overflow-wrap` inert.

#### Scenario: URL in a rich-text content block on a narrow screen
- **WHEN** a client views a published content block whose text contains a URL longer than the card's inner width, on a 375px-wide viewport
- **THEN** the URL wraps onto the following line within the card
- **AND** no part of it renders outside the card
- **AND** the page's horizontal scroll width does not exceed the viewport width

#### Scenario: URL in a message body in the portal
- **WHEN** a client opens a message whose body contains a URL longer than the content column
- **THEN** the URL wraps within the column, and the page does not scroll horizontally

#### Scenario: Long subject line
- **WHEN** a client opens a message whose subject is a single token longer than the content column
- **THEN** the subject heading wraps within the column rather than overflowing

#### Scenario: URL in a client's own day notes
- **WHEN** a client opens a past day in their history whose notes contain a URL longer than the notes card
- **THEN** the URL wraps inside the card, and the page does not scroll horizontally

#### Scenario: Long subject in an element that is a flex child
- **WHEN** a long subject is rendered inside a flex row (the admin sent-message detail header)
- **THEN** it wraps rather than forcing the row wider — the element carries `min-width: 0` so it is allowed to shrink below its content width

#### Scenario: Long repetition text in the exercise target-volume pill
- **WHEN** an exercise's `reps` value is long enough that `<sets> series × <reps> repeticiones` exceeds the card's inner width, on a 375px-wide viewport
- **THEN** the pill wraps its text onto further lines inside the card rather than overflowing
- **AND** because the pill is a flex child of the badge row, it carries `min-width: 0` so it is allowed to shrink
- **AND** the page's horizontal scroll width does not exceed the viewport width

#### Scenario: URL in the message notification email
- **WHEN** a client receives the new-message email for a message whose body contains a long URL, and opens it in a mobile mail client
- **THEN** the URL wraps within the email body rather than forcing the message to scroll sideways

#### Scenario: Ordinary prose is unaffected
- **WHEN** any of these surfaces renders normal Spanish prose containing no token wider than its container
- **THEN** line breaking is unchanged from before this change — words break only at spaces
