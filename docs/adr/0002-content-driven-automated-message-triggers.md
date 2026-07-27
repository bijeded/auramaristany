# 0002. Automated message triggers are content-driven, not day-numbered

Status: Accepted · Date: 2026-07-27

## Context

A4 asked for a booking reminder "on day 14 and day 28" of the billing period, plus a
nudge after 10 quiet days. The day-number framing is not expressible against the
content model we have:

- `program_days` is keyed `unique (series_id, week_number, day_of_week)` — a 4×7 grid,
  not a list of numbered days.
- `getCurrentDayKey` walks that grid from each client's own `current_period_start`,
  so the *same* cell is a different day-number, and a different calendar date, for
  every client. Aura authors one grid for everyone.
- A period is a billing month (28–31 days), so a fixed "day 14" would drift against
  week 3 anyway.

Encoding "day 14" would have meant a second, parallel notion of time that Aura cannot
see in the editor and that would silently disagree with the content she places.

## Decision

**The `agendar` block placement in the content grid is the trigger.** The booking
reminder fires on the first day a client's current cell exposes an `agendar` block
when the previous day's cell did not — resolved per client against their own
`current_period_start`. Aura moves the reminder by moving the block; no code or
config changes.

Two supporting decisions follow from it:

1. **Dedupe lives in a dedicated `automated_notices` ledger**, keyed
   `unique (profile_id, rule, period_key)`, never in message history — `purge-messages`
   hard-deletes messages after 180 days, so a history-based check would quietly begin
   re-sending. The ledger row is written *before* the send, so an interrupted run
   costs a missed message rather than a duplicate. `period_key` is week-scoped for the
   booking reminder (`period_start:Wn`) and streak-anchored on `last_activity_date`
   for the inactivity nudge.
2. **Copy is data, not code.** Subject and body live in `automated_messages`, one row
   per rule, edited by Aura at `/admin/automated-messages`, with an `is_active` flag
   that doubles as the kill switch. The row set is fixed: creating a row would produce
   a message with no trigger, so the screen offers no create or delete.

## Alternatives considered

- **Day-number triggers** (`months_elapsed` + day offset): rejected above — invisible
  to the editor, drifts against variable-length periods, and contradicts the grid.
- **A dedicated "send reminder on this day" toggle in the day editor**: a second
  authoring surface for something the `agendar` block already expresses, and one more
  thing for Aura to keep in sync.
- **Dedupe from `messages` history**: rejected — retention deletes the evidence.
- **Hardcoded copy in the repo**: rejected — every wording tweak becomes a deploy.

## Consequences

- Aura must place `agendar` runs in **week 1 and week 3** to approximate the
  twice-a-month cadence she asked for. The admin screen says so explicitly, because
  the mapping from her mental model to the grid is the one thing this design does not
  make self-evident.
- Grid-relative day math must special-case the first day of a period: "yesterday's
  cell" does not exist before `current_period_start`, and treating it as a cell that
  *has* no `agendar` block is what makes a run starting on day 1 fire on day 1. This
  cost a review cycle; it is the same family of bug as EDGE-3.
- Week-scoped `period_key` means an `agendar` run straddling two grid weeks counts as
  two windows, and two separate runs inside one week count as one. Accepted: it
  eliminates the double-send at a period boundary, and neither residual matches how
  Aura actually places the blocks.
- Rules can be switched off from the admin screen without a deploy, which is how both
  shipped: `is_active = false` until the demo data is cleaned up (L6) and Aura has
  placed her runs.
