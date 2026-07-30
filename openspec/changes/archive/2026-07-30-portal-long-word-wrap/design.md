## Context

A client reported that a URL inside a pillar content block escapes its card on mobile. The cause is not the card and not the block — it is that nothing in the codebase ever states a wrapping rule for authored text. The `.prose` rules in `app/globals.css:106-113` set line-height, headings, lists and margins but never touch word breaking, so the browser default `overflow-wrap: normal` applies: break at spaces only. A URL has no spaces, so it is laid out as one atomic box wider than its container.

The consequence is worse than a clipped line: an overflowing inline box widens the document's scroll width, so the entire portal pans sideways on that screen — the sticky bottom nav included.

Auditing the codebase for the same shape found five surfaces at risk and two that are already safe:

| Surface | File | State |
|---|---|---|
| Rich-text block (portal) | `components/portal/blocks/TextBlock.tsx` → `.prose` | at risk (the report) |
| Rich-text editor (admin) | `components/admin/blocks/TextBlockEditor.tsx` → `.prose` | at risk |
| Message body (portal) | `app/portal/messages/[id]/page.tsx` | at risk |
| Message subject `<h1>` (portal) | `app/portal/messages/[id]/page.tsx` | at risk |
| Sent-message body (admin) | `components/admin/MessagesAdmin.tsx` | at risk |
| Message body (email) | `lib/email/templates/NewMessageEmail.tsx` | at risk |
| Message list preview | `components/portal/MessagesList.tsx` | already safe |
| Admin client-card free text | `components/admin/ClientDetailTabs.tsx` | latent, out of scope |

The message list preview is worth naming explicitly: it is safe because it sets `whiteSpace: nowrap` + `textOverflow: ellipsis` on a flex child that carries `minWidth: 0`. That is the correct presentation for a one-line preview and must not be "fixed" into wrapping.

## Goals / Non-Goals

**Goals:**
- No authored text overflows its container or introduces horizontal page scroll, on any surface a client or Aura reads.
- Aura sees the same wrapping while composing as the client sees after publishing.
- Ordinary Spanish prose renders byte-identically to today.

**Non-Goals:**
- Changing how Aura writes links (bare URL vs. anchored text like "ver el estudio"). That is editorial guidance, worth a separate conversation, and does not belong in a CSS fix.
- Hardening admin client-card free text (onboarding answers, cancellation reason). Latent, desktop-first, and widening the diff would dilute the review.
- Any change to `sanitize-html`, the plain-text sanitizers, or what may be rendered where. Rule 18's invariant — `messages.body` reaches only escaping sinks — is untouched: this change adds a style property, never a new sink.

## Decisions

**1. `overflow-wrap: break-word`, not `anywhere` and not `word-break: break-all`.**

All three stop the overflow; they differ in cost.

- `word-break: break-all` breaks *every* word mid-letter, including ordinary prose. Rejected outright — it would disfigure the body copy on every content block.
- `overflow-wrap: anywhere` breaks at the current line's end, giving a tighter result with no ragged gap. But it also changes the element's **min-content width**, which flex and grid parents consult when sizing. On a live demo this is a class of reflow no test can see.
- `overflow-wrap: break-word` affects line breaking only, never sizing. Its one cost is cosmetic: the long token starts on a fresh line, which can leave a short gap above.

`break-word` wins on blast radius, and in the reported case it also reads better — the URL begins clean at the margin instead of dangling off the end of "en la siguiente dirección:".

**2. The `.prose` fix lives in `app/globals.css`, not as a Tailwind class on `TextBlock`.**

Both `TextBlock.tsx` and `TextBlockEditor.tsx` already delegate their typography to `.prose`. Putting the rule in the stylesheet fixes both with one edit and keeps one concern in one place; a `break-words` class on `TextBlock` would fix the portal and leave the admin editor showing Aura a layout her clients will not get. That divergence is the actual hazard here — it is how the bug reached production unnoticed in the first place.

**3. The plain-text surfaces take an inline property, matching their neighbours.**

`app/portal/messages/[id]/page.tsx`, `MessagesAdmin.tsx` and `NewMessageEmail.tsx` style everything with inline `style` objects and already set `whiteSpace: "pre-line"` on the exact elements in question. Adding `overflowWrap: "break-word"` beside it is the local idiom. Introducing a class for three call sites would be a new pattern for no gain.

**4. The email is in scope.**

The email is the first place a client sees a message body — before the portal. Excluding it would ship the identical defect to the highest-visibility surface and require a second change for one property. It is included, with the honest caveat recorded under Risks.

**5. No tests.**

Vitest runs on jsdom, which does not lay out text: it has no line boxes, no `overflow-wrap` support, and no scroll width. There is no assertion that can distinguish the broken state from the fixed one. Writing a test that merely asserts the string `"break-word"` appears in a style object would be a change-detector — it restates the diff, fails on any refactor, and would have caught nothing. This change is verified by eye, and the tasks say so.

## Risks / Trade-offs

- **A mail client strips or ignores the inline style → the email stays broken and CI reports nothing.** Mitigation: verify by sending a real message containing a long URL and reading it in Gmail mobile, the strictest common client. If it does not hold there, the fallback is a `<wbr>`-free approach — wrapping the body in a table cell with a fixed width — which is a bigger change and would be raised as a follow-up rather than smuggled into this one.
- **No automated regression guard.** Nothing prevents a future stylesheet refactor from dropping the `.prose` rule, and no test will fail. Mitigation: the rule carries a short comment naming the defect it prevents, following the precedent of the `.portal-richtext mark` note directly above it in the same file.
- **Cosmetic ragged gap.** Accepted, and preferred in the reported case (Decision 1).
- **Unknown third surfaces.** The audit covered every use of `.prose`, `whiteSpace: pre-line` and `dangerouslySetInnerHTML`. A surface that renders authored text some other way could exist. Mitigation: the 375px sweep in verification covers the portal's main screens, not just the two changed ones.

## Migration Plan

No migration, no data change, no environment variable. Branch → Preview URL → visual verification at 375px → PR with a `code-review` verdict → merge. Rollback is a revert of a CSS-only diff with no state implications.

`security-review` is not required: the diff touches no auth, RLS, service-role, input-validation, Stripe or webhook surface, and adds no rendering sink.

## Open Questions

- Should Aura be guided toward anchored link text ("ver el estudio") instead of bare URLs? Deliberately deferred — it is editorial, not technical, and this fix must hold regardless of the answer.
