# Proposal

## Why

`createSeries` inserts the series, then its variant mappings, in two PostgREST calls that each commit, and compensates a failed mapping with a best-effort delete (backlog D34). If that delete also fails, the admin is left with a series mapped to **no variant**: invisible in every curriculum and not deletable from the editor, the exact state `atomic-content-saves` (migration 021) closed for updates. Separately, nine content-table policies are `for all using (is_admin())` with no `with check` (backlog D35, widened during explore). Postgres falls back to `using`, so they are functionally equivalent, but they break rule 3 / D20. Four of them are the only RLS guards on the 021 functions and on the new create function.

## What Changes

- New migration `022` that:
  - adds `create_series_with_mappings(p_program_id, p_title, p_description, p_mappings)`, which returns the new series id. It inserts `program_series` (always `published = false`), then its `variant_series_map` rows, in one transaction. Like 021 it is `SECURITY INVOKER`, has a fixed `search_path` and payload guards, and raises on an empty mapping array.
  - adds an explicit `with check (is_admin())` to nine admin write policies with `alter policy`. The `using` clause is not restated, so it cannot be mistyped:
    - **Guards of the atomic functions:** `program_series_admin_write`, `program_day_blocks_admin_write`, `pillar_blocks_admin_write` (`program_pillar_blocks`), `variant_series_map_admin_write`.
    - **Other content tables:** `program_days_admin_write`, `pillars_admin_write` (`program_series_pillars`), `programs_admin_write`, `program_variants_admin_write`, `program_variant_prerequisites_admin_write`.
- `createSeries` calls the function through the rule-10 `// keep:` client cast. zod, `uuidLike`, `variantsBelongToProgram` and `requireAdmin()` stay in TypeScript, before the call. The compensating delete is removed. A 23505 still maps to the inline position-taken message with `field: "ordinal"`.
- `BACKLOG.md`: add **D36** for the four non-content policies still missing `with check`. The D34 and D35 rows are deleted by the archive PR, following the backlog's own closing rule.

On success Aura sees no difference. On failure, an error now guarantees that no month was created.

**Non-goals**
- **The four non-content policies** (`profiles_admin_insert_update_delete`, `invoices_admin_write`, `subscription_events_admin_only`, `message_recipients_admin_write`). These are money and identity tables, logged as D36, not changed here.
- **D16** (`invoice.paid` two-statement advance): webhook/money surface, separate change.
- Changing what any policy allows. `using` is untouched, and `with check` is `is_admin()`, the expression `using` already holds for all nine.
- Moving validation (variant ownership, zod) into SQL.
- `deleteSeries`, `deleteDay`, `cloneDay` and other multi-step writes.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `admin-content-authoring`: the all-or-nothing requirement now also covers **creating** a month with its variant positions. A failed creation leaves no month behind.

The policy tightening changes no observable behavior, so it has no spec delta.

## Impact

- **Code:** `lib/admin/seriesActions.ts` (`createSeries`), `__tests__/series-actions.test.ts`, `BACKLOG.md`.
- **DB:** new migration `supabase/migrations/022_atomic_series_create_rls_checks.sql`. It needs a PostgREST schema reload after apply.
- **Sensitive surface: yes, migrations and RLS.** A new function runs as invoker under `is_admin()` policies, and nine policies are altered. `/security-review` runs before the PR. No webhooks, money, service-role or fan-out.
- **Review rules touched:**
  - 3: RLS boundary; invoker, not definer; `for all` gets an explicit `with check`.
  - 4: zod and `uuidLike` stay server-side, before the RPC.
  - 6: RPC errors go through `logAndGeneric`.
  - 10: `// keep:` cast on the client; `Functions` untouched.
  - 11: 022 applied and verified against the real DB before merge.
  - 20: grep `docs/adr/` for `createSeries`; none expected.
- **Silent-defect surface: yes.** A migration and RLS policies. A policy change that went wrong would compile, pass CI and silently change who can write. The only proof is `pg_policies` read before and after the apply.
