# Proposal

## Why

Backlog D14. Five admin pages — `app/admin/content/page.tsx` and the four under `content/[programId]/series/[seriesId]/{days,pillars}/**` — render without `requireAdminPage()` and rely on middleware alone, unlike the other nine guarded pages. Not exploitable today (`getRedirectPath` bounces no-session and `role === 'client'` away from `/admin`), but a single matcher or middleware regression would expose admin content screens. The systematic fix, a guard in `app/admin/layout.tsx`, is blocked because that layout is `"use client"` (it needs `usePathname` for the active nav item).

## What Changes

- Split `app/admin/layout.tsx` into a **server** layout that calls `requireAdminPage()` before rendering, and a **client** nav component (sidebar links + active-item state) that it renders. Sidebar markup and styling are unchanged.
- Add `requireAdminPage()` to the five unguarded pages, so every admin page guards itself as the other nine do (a layout guard alone does not re-run on soft navigation — see design.md).
- Add a test that enumerates every `app/admin/**/page.tsx` and fails if one neither calls `requireAdminPage()` nor is the declared redirect-only exemption, so a new admin page cannot ship unguarded.
- `app/admin/page.tsx` (a bare `redirect("/admin/dashboard")`, no data) stays as is; it is the one declared exemption.

## Non-goals

- No change to middleware, `getRedirectPath`, the matcher, `requireAdmin()` / `requireAdminPage()` semantics, or their redirect target (`/portal/today`).
- No change to server actions — they already call `requireAdmin()`, and a layout never protects them.
- No visual or copy change to the admin sidebar.
- No RLS or migration change.

## Sensitive surface

**Yes — auth** (the admin access boundary). No fan-out. `/security-review` runs before the PR.

## Review rules touched

- **2** — identity from `getUser()` on the server: the layout guard goes through `requireAdmin()`, never a client-side check.
- **3** — service-role behind `requireAdminPage()`: this change makes that true for the five content pages.
- **20** — checked: no `docs/adr/*.md` names `AdminLayout`; nothing retired or renamed.

## Capabilities

### New Capabilities
- `admin-access-guard`: every admin screen enforces admin identity server-side, independently of middleware.

### Modified Capabilities
<!-- none -->

## Impact

- `app/admin/layout.tsx` (becomes a Server Component)
- New client component `components/admin/AdminSidebarNav.tsx`
- Five pages under `app/admin/content/**`
- New test `__tests__/admin-page-guards.test.ts`
