## 1. Rich text (`.prose`)

- [x] 1.1 Add `overflow-wrap: break-word` to the `.prose` rule in `app/globals.css` (alongside `line-height`, ~line 106), with a one-line comment naming the defect it prevents — same style as the `.portal-richtext mark` note below it
- [x] 1.2 Confirm no edit is needed in `components/portal/blocks/TextBlock.tsx` or `components/admin/blocks/TextBlockEditor.tsx` — both inherit `.prose`

## 2. Plain-text surfaces

- [x] 2.1 `app/portal/messages/[id]/page.tsx`: add `overflowWrap: "break-word"` to the message body `<p>` (beside its existing `whiteSpace: "pre-line"`)
- [x] 2.2 `app/portal/messages/[id]/page.tsx`: add the same to the subject `<h1>` style
- [x] 2.3 `components/admin/MessagesAdmin.tsx`: add the same to the sent-message detail body `<p>` (~line 258)
- [x] 2.4 `lib/email/templates/NewMessageEmail.tsx`: add the same to the body `<Text>` style (~line 25), leaving the existing rule-18 comment block intact

## 3. Confirm the out-of-scope surfaces are untouched

- [x] 3.1 Verify `components/portal/MessagesList.tsx` is unchanged — its `nowrap` + ellipsis preview is the intended presentation and must not start wrapping
- [x] 3.2 Verify `components/admin/ClientDetailTabs.tsx` is unchanged

## 4. Static gates

- [x] 4.1 `npx tsc --noEmit` passes
- [x] 4.2 `npm run lint` clean
- [x] 4.3 `npm run test:run` 719/719 green (52 files) — no test added or changed; the 704 figure in CLAUDE.md predates recent merges; jsdom cannot observe CSS layout (see design, Decision 5)
- [x] 4.4 `npm run build` succeeds

## 5. Visual verification (the real gate — nothing above can catch this defect)

- [x] 5.1 On the Preview URL at a 375px-wide viewport, open a pillar/content block containing a long URL: it wraps inside the card, and the page has no horizontal scroll
- [x] 5.2 In the admin rich-text editor, paste a long URL: it wraps inside the editor canvas, matching what the client sees
- [x] 5.3 Send a message whose body contains a long URL; open it at 375px in the portal: body wraps, no horizontal scroll
- [x] 5.4 Open the same message in the admin sent-messages detail: body wraps
- [~] 5.5 NOT VERIFIED — Gmail mobile check skipped by decision (Francisco, 2026-07-30): low impact, not worth blocking on. The inline `overflowWrap` ships regardless; if a mail client strips it the email body can still overflow. Re-check if a client ever reports it.
- [x] 5.6 Spot-check ordinary prose on `/portal/today`, `/portal/pilares` and a message with no long token: line breaking is unchanged

## 6. Ship

- [ ] 6.1 `code-review` verdict obtained (no `security-review`: no auth, RLS, service-role, validation, Stripe or webhook surface, and no new rendering sink)
- [ ] 6.2 Conventional Commit on a branch, PR opened, CI green, merge
- [ ] 6.3 `/opsx:sync` + `openspec validate`, then `/opsx:archive`
