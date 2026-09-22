# Tasks

## 1. Enforcement test first

- [x] 1.1 Add `__tests__/admin-page-guards.test.ts`: glob `app/admin/**/page.tsx`, assert each contains `requireAdminPage(` unless exempt; exemption list = `app/admin/page.tsx` only, asserted to contain `redirect(`. Run `npm run test:run -- admin-page-guards` and confirm it FAILS naming exactly the five content pages.

## 2. Page guards

- [x] 2.1 Add `await requireAdminPage()` as the first statement of `app/admin/content/page.tsx` and the four pages under `content/[programId]/series/[seriesId]/` (`days/[dayId]`, `days/new`, `pillars`, `pillars/[pillarKey]`); confirm 1.1 now passes.

## 3. Layout split

- [x] 3.1 Check Next 14 App Router docs via context7 for layout behavior on soft navigation and `redirect()` in an async layout; correct design.md Decision 2 if it disagrees.
- [x] 3.2 Move `NAV_ITEMS`, `usePathname` and the nav links into `"use client"` `components/admin/AdminSidebarNav.tsx`, markup and styles unchanged.
- [x] 3.3 Make `app/admin/layout.tsx` an async Server Component that `await requireAdminPage()` then renders the shell with `AdminSidebarNav` and `LogoutButton`; verify `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all pass.

## 4. Runtime verification (non-destructive, existing data)

- [x] 4.1 On the Preview URL, log in as the demo admin: open Dashboard, Clientes, Contenido and one existing day editor; confirm the sidebar renders and the highlighted item follows navigation.
- [x] 4.2 Log in as a seeded demo client and request `/admin/content` and an existing deep `/admin/content/.../days/<dayId>` URL directly; confirm redirect to the portal and no admin markup in the response.

## 5. Review and handoff

- [x] 5.1 Run `/security-review` (auth surface); address or dismiss each finding with a reason in the PR body.
- [x] 5.2 Open PR `fix(admin): guard admin layout server-side and every admin page` from `task/admin-layout-guard-split`; body states silent-defect surface: **none touched** (no enum/status union, money/people aggregation, cancellation state, migration, RLS or DB CHECK).
