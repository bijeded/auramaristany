# Design

## Context

`app/admin/layout.tsx` is `"use client"` only because the sidebar calls `usePathname()` to highlight the active item. A client component cannot `await requireAdminPage()`, so the layout cannot guard today. Nine of fifteen admin pages call `requireAdminPage()`; five content pages and the redirect-only `app/admin/page.tsx` do not.

## Goals / Non-Goals

**Goals:** a server guard at the layout; every data-rendering page guarded; a test that keeps it that way.

**Non-Goals:** changing what the guard decides or where it redirects; restructuring routes (e.g. a route group).

## Decisions

1. **Server layout + client nav.** `app/admin/layout.tsx` becomes an async Server Component: `await requireAdminPage()`, then render the shell (`<div>` / `<aside>` / `<main>`, logo, `LogoutButton`) around a new `"use client"` `components/admin/AdminSidebarNav.tsx` holding `NAV_ITEMS`, `usePathname` and the links. *Alternative:* keep the whole aside client-side — rejected; no difference in guard power and only the nav needs hydration.

2. **Keep page-level guards and add them to the five missing pages.** App Router layouts are preserved across soft navigation and render in parallel with the page, so a layout guard neither re-runs on every in-admin navigation nor is ordered before the page's data fetch. The layout guard is a net; the page guard is the gate. Middleware still runs on every request. *Alternative:* layout guard only (the backlog's framing) — rejected for that reason. Confirm this behavior against current Next 14 docs (context7) during apply; if the docs contradict it, the page guards stay (harmless) and this rationale gets corrected.

3. **Enforcement test by source scan.** A Vitest test globs `app/admin/**/page.tsx` and asserts each file contains `requireAdminPage(`, except an explicit exemption list holding only `app/admin/page.tsx`, which is itself asserted to contain `redirect(`. Same approach as `middleware-matcher.test.ts` (source as the single truth). *Alternative:* render tests — no harness exists (D30); out of scope.

## Risks / Trade-offs

- [Layout and page each call `requireAdmin()` → two `getUser()` + profile lookups per request] → negligible at one-admin scale; accepted for defense in depth.
- [A comment containing `requireAdminPage(` satisfies the source scan] → accepted; it catches omission, the realistic failure, and the diff is reviewed.
- [`redirect()` from an async layout] → supported by Next; runtime smoke (task 4.2) confirms a client is redirected.

## Migration Plan

None. Rollback is reverting the PR.
