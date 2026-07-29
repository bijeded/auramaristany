## Context

A scan of every `export function` / `export const` under `lib/` for production callers returned four with none:

```
subscriptionGrantsPortalShell   lib/content/subscription-access.ts
isDayAccessible                 lib/content/access.ts
reindexOrder                    lib/admin/onboarding-helpers.ts
cancellationReasonLabel         lib/portal/cancellation.ts
```

They look alike from the outside and are not alike at all. Sorting them is most of this design:

| Helper | Species | Disposition |
|---|---|---|
| `subscriptionGrantsPortalShell` | redundant by construction | remove |
| `isDayAccessible` | orphaned by a superseded model | remove |
| `reindexOrder` | **bypassed** — logic duplicated inline | give it its home |
| `cancellationReasonLabel` | early — its reader is a planned change | keep, documented |

`subscriptionGrantsPortalShell` has no caller because the design removed the need for one. All three shell readers — `middleware.ts:64`, `app/portal/layout.tsx:30`, `lib/portal/account-queries.ts:137` — push the set into SQL:

```
.in("status", PORTAL_SHELL_STATES)   ← el filtro ocurre en la base
        │
        ▼
todas las filas que llegan a memoria YA son shell
        │
        ▼
subscriptionGrantsPortalShell(row.status)  →  siempre true
```

`reindexOrder` is the opposite: it has a caller-shaped hole. `reorderQuestions` re-derives index→`sort_order` in a loop, so the ordering rule lives in two places and the tested one is not the one that runs.

## Goals / Non-Goals

**Goals:**
- Every remaining exported helper in `lib/` has a production caller, or a written reason why not.
- The onboarding ordering rule has exactly one home, and it is the tested one.
- A failed reorder leaves the previous order intact.
- The graduated/paying separation is described in the spec by whatever actually enforces it.

**Non-Goals:**
- Touching `ACCESS_STATES` or any content-serving path. The strict predicate keeps its exact meaning and its byte-identical definition.
- Building the admin view over `cancellation_surveys` (its own later change), or changing anything about how surveys are written (that is D19).
- A lint rule or CI gate for unused exports. Worth considering once we know whether this recurs; four instances across the whole project is not yet evidence of a systemic leak.
- Reworking `reorderQuestions`' authorization, error surface or the drag-and-drop UI.

## Decisions

### 1. Remove the redundant predicate rather than find it a caller

**Alternatives considered.** (a) Call it from `derivePortalTier` — but `derivePortalTier` is already the union of `subscriptionGrantsAccess` and `subscriptionIsGraduated`, so routing through a third predicate that means "either of those" adds an indirection that computes nothing new. (b) Drop the `.in(...)` filters and check in memory instead — strictly worse: it fetches `canceled` and `unpaid` rows in order to discard them, and moves a boundary decision out of the query that RLS and the index already serve well.

Removing it is the only option that leaves one way to ask the question. The set and `derivePortalTier` stay; only the always-true wrapper goes.

### 2. Reword the spec requirement instead of preserving a symbol to satisfy it

`portal-graduated-access` says a "separately named predicate" decides shell access. Read literally, that sentence is what keeps a redundant function alive. Read for intent, it protects one thing: **`ACCESS_STATES` must never be widened to include `completed`**, because that would serve training content to non-paying clients through nine call sites at once.

That protection is unchanged and remains testable. The requirement is reworded to name the separation and its enforcement (a separate state set, applied where rows are selected) rather than a particular function. Deleting an exported symbol a requirement leans on is a spec change, so it ships as a MODIFIED delta in this change — not as a silent removal.

### 3. `reindexOrder` computes; the RPC applies

The obvious atomic write is a single `UPDATE ... FROM unnest(ids) WITH ORDINALITY`, which is one statement and needs no helper — and would therefore bypass `reindexOrder` again, by a different route. That defeats the point of the task.

So the split is deliberate:

```
reindexOrder(orderedIds)  →  [{id, sort_order}]  →  jsonb  →  UPDATE ... FROM jsonb_array_elements
   decisión (TS, testeada)                                      aplicación (SQL, atómica)
```

A plain `upsert` was rejected on inspection: `onboarding_questions.question_text` and `question_type` are `NOT NULL`, so an upsert of `{id, sort_order}` fails on the insert half. Fetching whole rows to upsert them back would read and rewrite columns this operation has no business touching, and would race with a concurrent edit.

The function is `SECURITY INVOKER` (the default). `requireAdmin()` returns an RLS-aware client, so the existing admin write policy governs the update exactly as it governs the current loop. A `SECURITY DEFINER` function would bypass RLS and would need its own `is_admin()` check — an unnecessary new privileged path for an operation that already has a correct one.

### 4. Keep `cancellationReasonLabel`, and say so in the file

The other three are resolved by removal or wiring; this one is resolved by a comment. It renders a reason for a human, and the only thing that renders reasons to humans — an admin view of `cancellation_surveys` — is a planned separate change. Deleting it means rewriting it. Without a note, the next sweep reaches the same conclusion this one did and deletes it.

## Risks / Trade-offs

- **Removing an export could break something the scan missed** → The scan covered `app/`, `components/`, `lib/`, `hooks/` and `middleware.ts`; `tsc --noEmit` and the build catch any residual import. Both symbols are internal to this repo — no published API surface.
- **The new RPC is the first `.rpc()` call in an admin action** → It is one statement with no privilege escalation, and its authorization is the policy already in force. Verified by smoke rather than by inspection alone: reorder in `/admin/onboarding-settings`, reload, confirm the order persisted.
- **Rewording a shipped requirement could weaken it** → The reworded text must still forbid widening `ACCESS_STATES`, and the existing scenarios ("Content paths use the strict check", "Paying clients are unaffected") are kept verbatim so the guarantee is unchanged in substance.
- **A migration for what is partly a cleanup change** → Accepted knowingly: the alternative that avoids it (keep the loop, just call the helper) leaves the half-renumbered failure mode in place, which is the more expensive thing to carry.
- **`reindexOrder` is 0-based; the current loop is also 0-based** → Behaviour must not shift. Pinned by asserting the first element lands on `sort_order = 0` and by reading the order back after the smoke.

## Migration Plan

One migration (`018_reorder_onboarding_questions.sql`) creating the function. Additive: it introduces no table, column or constraint change, and the previous code path keeps working until the action is switched over, so migration and deploy are not order-sensitive.

Rollback is `drop function reorder_onboarding_questions(jsonb);` plus reverting the action. Per project convention the migration is written to be applied once; `create or replace function` is safe to re-run, so no guard is needed beyond that.

## Open Questions

- Should a CI check for unused `lib/` exports follow? Deferring until we see whether this recurs — a rule that fires on `cancellationReasonLabel` would need an opt-out annotation, which is its own small design.
- `reorderQuestions` returns a generic error string on failure. With the write now atomic, the UI could reasonably tell the admin "el orden no se guardó, sigue como estaba". Out of scope here; noted for whoever next touches that screen.
