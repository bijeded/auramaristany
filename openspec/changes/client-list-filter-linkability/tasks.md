# Tasks

## 1. Pure helpers (test-first)

- [x] 1.1 Write failing tests in `__tests__/clients-helpers.test.ts` for `parseProgramFilter(raw, programs)`: valid name → name; unknown, empty, `undefined` → "Todas"; array → first element. Verify `npm run test:run` fails on the missing export.
- [x] 1.2 Implement `parseProgramFilter` in `lib/admin/clients-helpers.ts`; verify 1.1 passes.
- [x] 1.3 Write failing tests for `buildClientFilterQuery({ status, program }, current)`: sets both keys; `null` status and "Todas" delete their keys; unrelated params preserved; accented/spaced values round-trip through `parseStatusFilter`/`parseProgramFilter`. Verify they fail.
- [x] 1.4 Implement `buildClientFilterQuery`; verify 1.3 passes.

## 2. Component and page

- [x] 2.1 Check Next 14.2 docs (context7) for `useSearchParams`, `router.replace` options and the Suspense requirement; note the finding in the PR body.
- [x] 2.2 In `components/admin/ClientsTable.tsx`, derive `estado` and `prog` from `useSearchParams` via the two parsers; route the select, pills and "Limpiar filtros" through `router.replace` + `buildClientFilterQuery`; remove the `initialStatus` prop; keep the page-1 reset on filter change (design §5). Verify `npx tsc --noEmit` and `npm run lint` clean.
- [x] 2.3 In `app/admin/clients/page.tsx`, drop the `searchParams` parsing and `initialStatus`. Verify `tsc` clean.
- [x] 2.4 Grep `docs/adr/` and `openspec/specs/` for `initialStatus` (rule 20) and update any hit; verify the grep returns nothing stale.

## 3. Verification

- [x] 3.1 Run `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`; all green.
- [ ] 3.2 Read-only manual smoke on the Preview URL with seeded data: select "Activas" → URL has `status=Activas`; click a program pill → URL gains `program=`; choose "Todos los estados" → `status` removed, `program` kept; copy URL into a new tab → same filters shown; dashboard "Terminan (próx. 7 días)" → cohort preselected; browser Back/Forward between two filtered client-list URLs → select follows; `?program=NoExiste` → "Todas" pressed; three filter changes then Back → leaves the client list; filter row still renders at ~375px.

## 4. PR handoff

- [ ] 4.1 Open PR from `task/client-list-filter-linkability` titled `fix(admin): make client-list filters linkable (D24)`. Body: no sensitive surface (no `/security-review`); silent-defect flag — touches the status-filter parsing/options path (enum-union surface, rule 8), though `STATUS_FILTERS` and the union are unchanged; no money/people aggregation, cancellation state, migration, RLS or DB `CHECK`. Squash-merge on green CI.
