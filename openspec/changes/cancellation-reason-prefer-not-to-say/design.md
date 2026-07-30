## Context

`cancellation_surveys` (migration 011) constrains `reason` to seven values. The cancel modal offers eight options: the seven-minus-`pago_fallido` from `CANCELLATION_REASON_OPTIONS`, plus a hardcoded "Prefiero no decir" radio at `CancelSubscriptionSection.tsx:172` modelled as `reason === null`. `cancelSubscription` then writes `reason ?? "otro"`.

So the modal has always offered a choice the database cannot store, and the server has always quietly rewritten it. Nothing broke, because until PR #42 nothing read the column. That card now renders an "Otro" bar mixing two populations.

Constraints that shape this change:

- **Rule 7/8** — an app-level enum value without the matching `CHECK` migration fails the insert; the union and the `CHECK` are one change.
- **Rule 11** — nothing in `tsc`, lint, the tests (mocked client) or the build talks to the database. The migration is verified against the real database or it is not verified.
- **The insert error is swallowed on purpose.** `cancelSubscription` runs Stripe first and treats the survey as best-effort telemetry, so a failed insert cannot orphan a cancellation. Correct for its original purpose, and it converts a `CHECK` violation into silence.

## Goals / Non-Goals

**Goals:**

- `prefiero_no_decir` storable, selectable, and distinguishable from `otro`.
- One source for the modal's options.
- A skipped survey records "did not say" rather than "Otro".

**Non-Goals:**

- Backfilling historical rows — the information was destroyed at write time and cannot be recovered.
- Any change to the dashboard charts, to `pago_fallido`, or to reactivation's survey-deletion behaviour.
- Reworking the swallow-the-error decision in `cancelSubscription`. It is right for its purpose; the fix is to not ship a value the database rejects.

## Decisions

### D1 — Deploy order: migration first, verified, then code

The migration is applied and confirmed against the real database **before** the app code merges.

The asymmetry decides it. Migration first, code later: the `CHECK` accepts a value nothing writes yet — harmless. Code first, migration later: every client who declines to answer has their survey row silently discarded, and neither the client, nor Aura, nor CI sees anything.

The PR states when the migration was applied and what was checked, per rule 11.

*Rejected:* shipping both together and trusting deploy ordering. Vercel deploys on merge; a migration applied by hand is not part of that transaction.

### D2 — The skip default becomes `prefiero_no_decir`, not `otro`

Changing only the radio would leave the defect half-fixed: the client who selects nothing and clicks confirm is *also* declining to answer, and would still be filed as "Otro".

This is a **breaking change to stored meaning**, and it is why the proposal says so. Rows before and after this change are not comparable, and no migration can reconcile them.

*Rejected:* keeping `otro` as the fallback and treating the new value as opt-in only. It preserves the exact ambiguity the change exists to remove, in the commonest path through the modal.

### D3 — Delete the hardcoded radio rather than add a second entry

`CANCELLATION_REASON_OPTIONS` becomes the whole list, with `prefiero_no_decir` last — after `otro`, since "I'd rather not say" reads as the end of a list of reasons, not as one of them.

The hardcoded radio is rule 8's copied table expressed in JSX: a second list of options maintained by hand beside the real one. It is exactly how the modal came to offer an unstorable value, so leaving it in place while adding the enum would fix the symptom and keep the mechanism.

### D3b — "Prefiero no decir" stops being greyed out

The deleted radio carried `color: "var(--gris-texto)"`; options rendered from `CANCELLATION_REASON_OPTIONS` use the default text colour. So the option now looks like its peers instead of a de-emphasised escape hatch.

Deliberate, not a side effect. Greying out the one option whose selection you actually store misrepresents it: declining is a real recorded answer now, not a way of skipping. Contrast improves rather than degrades. Recorded here so the next reader does not restore the de-emphasis by reflex.

### D4 — `reasonRequiresDetail` excludes the new value

Asking a client who declined to answer to elaborate is a contradiction. `DETAIL_REASONS` stays `["encontre_otra_opcion", "otro"]`, and a test pins the exclusion so a future "make every reason expandable" pass has to argue with it.

### D5b — One declaration for the reason list

`CLIENT_FACING_REASONS` is the single source; `CANCELLATION_REASON_OPTIONS` and the server action's `z.enum` both derive from it.

Adding one value to this change originally required editing the list in three places — the options array, the zod schema, and the DB `CHECK` — with a fourth copy in `seed-demo.ts` that this change deletes. Three hand-maintained copies of one enum is the same defect as the hardcoded radio, one layer down, and it is where the next drift would have landed. The validator copy fails *closed* (zod rejects with a generic error) rather than silently, so it is less dangerous than the `CHECK` mismatch — but it would deny a client a reason the screen is actively offering her.

`pago_fallido` is now excluded by construction rather than by remembering to omit it: it is not in `CLIENT_FACING_REASONS`, so neither the modal offers it nor the schema accepts it.

### D5 — No spec delta for `admin-cancellation-analytics`

That capability's requirements are written to be **reason-agnostic**: labels come from `cancellationReasonLabel`, reasons with no rows are absent, and `pago_fallido` is named as included. A widened enum satisfies all three unchanged, so there is no requirement to modify — the chart gains a bar without the spec gaining a word.

(An earlier draft of this design justified the omission by saying the capability did not exist in `openspec/specs/` yet. It does — `dashboard-cancellation-charts` was archived and its deltas synced. The conclusion was right for the wrong reason.)

The chart is verified anyway during runtime verification: the new bar must appear once a cancellation uses it.

## Risks / Trade-offs

- **Code merges before the migration is applied** → the ordering is D1, stated in the PR, and confirmed in runtime verification before merge, not after.
- **The "Otro" bar stays contaminated for old rows** → unavoidable; recorded in the proposal and to be said plainly to Aura rather than left to look self-correcting.
- **Migration 011's insert policy could reject the new value** → checked: `with check (profile_id = auth.uid() and source = 'voluntary' and reason <> 'pago_fallido')` passes `prefiero_no_decir` unaltered. Verified against the real database as part of D1, not assumed.
- **A `CHECK` migration on a live table** → `cancellation_surveys` is small and the constraint only widens, so no existing row can violate it. Still applied and confirmed rather than assumed.
- **The union and the `CHECK` drift again later** → the new spec scenario names the failure mode (a silently dropped row), so the next reader meets it before the code.

## Migration Plan

1. Write migration 019 widening the `CHECK`. Single-line SQL through the Supabase Management API — the pipeline eats newlines and `--` comments out the rest.
2. Apply it and confirm: the constraint lists eight values, and an insert of `prefiero_no_decir` succeeds under a client session (then roll that probe back).
3. Only then merge the app code.

Rollback: the app change reverts cleanly; the widened `CHECK` can stay, since it constrains nothing that the reverted code writes.

## Open Questions

- Should "Prefiero no decir" sit last in the radio list or immediately after "Otro"? Taken as last; a UI judgement worth one look at the rendered modal.
- **The modal's default selection changes, and this was not intended when the change was scoped.** `reason === null` was both the initial state *and* the hardcoded radio's `checked` condition, so the modal opened with "Prefiero no decir" already selected. With that radio gone it opens with nothing selected. This reads as the better default for an optional survey — a pre-ticked answer is a nudge, and the confirm path records the same value anyway — but it is a behaviour change, not a styling one, and runtime verification 5.2 confirms it deliberately.
- Does Aura want the "Otro" bar annotated on the dashboard to say it includes pre-change declines? Deferred — it is a chart-copy decision, not part of this change, and it stops mattering as old rows age out.
