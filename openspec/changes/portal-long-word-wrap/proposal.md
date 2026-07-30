## Why

On mobile, a long unbroken string pasted into free-text content — in the reported case a URL to a study on `pmc.ncbi.nlm.nih.gov` — is laid out as a single unbreakable box that escapes its card and the viewport, and widens the page's scroll width so the whole portal pans horizontally. The default `overflow-wrap: normal` only breaks at spaces, and a URL has none. Aura writes this content freely and cannot be expected to avoid pasting links, so the fix belongs in the rendering surfaces, not in editorial guidance.

## What Changes

- `.prose` in `app/globals.css` gains `overflow-wrap: break-word`. One rule covers both the client-facing rich-text block (`components/portal/blocks/TextBlock.tsx`) and the admin editor canvas (`components/admin/blocks/TextBlockEditor.tsx`), so what Aura composes wraps the same way it will ship.
- Four plain-text surfaces gain the same property inline, next to their existing `whiteSpace: "pre-line"` or heading styles:
  - portal message detail body and subject `<h1>` (`app/portal/messages/[id]/page.tsx`)
  - admin sent-message body (`components/admin/MessagesAdmin.tsx`)
  - `messages.body` in the notification email (`lib/email/templates/NewMessageEmail.tsx`)
- `break-word` is chosen over `anywhere`: both prevent the overflow, but `break-word` starts the long token on a fresh line instead of splitting it mid-sentence, which reads better after a phrase like "en la siguiente dirección:".

Explicitly **out of scope**:
- The message list preview (`components/portal/MessagesList.tsx`) already handles long text correctly via `whiteSpace: nowrap` + `textOverflow: ellipsis` on a `minWidth: 0` flex child.
- Admin client-card free text (onboarding answers, cancellation reason) — latent but unconstrained and desktop-first; not worth widening the diff.

No behavior, data, or copy changes. No migration.

## Capabilities

### New Capabilities
- `long-text-wrapping`: how user- and admin-authored free text must wrap when it contains an unbreakable token longer than its container, across the portal, the admin editor, and outgoing email.

### Modified Capabilities

<!-- None. No existing spec states a requirement about text wrapping. -->

## Impact

- **Code:** `app/globals.css`; `app/portal/messages/[id]/page.tsx`; `components/admin/MessagesAdmin.tsx`; `lib/email/templates/NewMessageEmail.tsx`. Two components inherit the `.prose` change without being edited (`TextBlock.tsx`, `TextBlockEditor.tsx`).
- **Tests:** none possible. This is pure CSS layout; Vitest + jsdom do not lay out text, so no automated test can observe the defect or the fix. The existing `__tests__/email-send.test.ts` invariant (rule 18: `messages.body` reaches only escaping sinks) is unaffected — this change adds a style property, not a new sink.
- **Verification:** visual, at a 375px-wide viewport on a Preview URL, plus one real email received and read in a mail client. Gmail mobile is the meaningful check: if a client strips the inline style the email stays broken and nothing in CI reports it.
- **Risk:** low. `overflow-wrap` affects only line breaking, not sizing or spacing (unlike `anywhere`, which changes min-content width). No API, DB, RLS, Stripe, or auth surface is touched.
