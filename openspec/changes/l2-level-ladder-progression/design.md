## Context

Explored 2026-07-27 with Aura's requirements in hand. The hard part is not moving a client from one level to the next — it is doing so in a way that never shifts a live client's content when Aura publishes more, and that treats "entered at Intermedio" and "reached Intermedio" as the same state.

Three designs were worked through and two were discarded. Both discarded ones failed for the same underlying reason, which is worth recording because it is not obvious: **any position derived from a count is unstable when the count can grow, and Aura's Avanzado content grows by design.**

## Goals / Non-Goals

**Goals**
- A paying client always has content, at the right level, forever.
- A client evaluated into Intermedio or Avanzado gets that level's content from month 1.
- Publishing new content never changes what an existing client sees next.
- Rung length is whatever Aura authored, not a hardcoded 6.

**Non-Goals**
- Telling the client she crossed a rung (follow-on).
- Letting a client choose or change her own level in the portal — Aura evaluates, off-platform.
- Moving a client backwards, or skipping a rung.
- Per-client content scheduling.

## Decision 1 — Position is stored state, not arithmetic over `months_elapsed`

**Rejected: absolute series index with an entry offset.** `absolute_series = entry_offset + months_elapsed`, with the offset frozen at enrollment. This works only if every level's series are numbered continuously within one program (Principiante 1–6, Intermedio 7–12). Aura numbers each level from 1, and `l2-per-variant-content-model` makes ordering per-variant, so there is no program-wide axis to offset into.

**Rejected: rung from 6-month blocks, index by modulo.** `rung = floor((months_elapsed − 1) / 6)`, `index = ((months_elapsed − 1) mod 6) + 1`. Hardcodes six months per rung, which is false the moment Aura authors a seventh Intermedio series. And the top-rung loop divides by a count that grows:

```
Avanzado with 6 series (N=6), client at month 19 → position 7 → ((7−1) mod 6)+1 = series 1  ✓
Aura publishes a 7th series.  N=7
                  month 20 → position 8 → ((8−1) mod 7)+1 = series 1  ✗  (should be 2)
```

The client repeats series 1 twice because the divisor moved under her. Every looping client is reshuffled by an unrelated publish.

**Chosen: a pointer advanced one step per paid month.**

```
subscriptions
  program_variant_id   immutable — what she bought (Stripe price, billing identity)
  months_elapsed       immutable arbiter — billing and elapsed-time display
  content_variant_id   which rung she is on now
  content_ordinal      position within that rung
  content_loops        times wrapped at the top rung
```

Advance, once per newly-recorded paid invoice:

```
next = smallest mapped ordinal > content_ordinal      ← NOT content_ordinal + 1
├─ such an ordinal exists                        → content_ordinal = next
├─ else ladder_next_variant_id is set            → content_variant_id = next rung
│                                                  content_ordinal    = first mapped
└─ else                                          → content_ordinal    = first mapped
                                                   content_loops     += 1
```

**Successor is the next existing ordinal, never `+1`.** `unique(program_variant_id, ordinal)` prevents duplicate positions but not gaps, and a gap appears whenever a mapping is deleted from the middle of a curriculum (`1,2,4,5,6`). A literal `+1` test fails at 3 and falls through to the rung-advance branch, moving the client into the next level six months early — silent, and indistinguishable afterwards from correct progress. The same reasoning applies to the first ordinal of a rung, which is the smallest mapped ordinal rather than a hardcoded 1. See `l2-per-variant-content-model` design, Decision 3.

Every requirement falls out of this one rule:

| Requirement | Mechanism |
|---|---|
| Principiante → Intermedio → Avanzado | rung exhausted → follow `ladder_next_variant_id` |
| Enter directly at any level | initialise pointer to the purchased variant, ordinal 1 |
| Rungs are "6 months" but Avanzado grows | rung length read at advance time |
| Avanzado wraps to its first series | no next rung → wrap, `loops += 1` |
| New content reaches looping clients | a client at the last ordinal advances into the new one instead of wrapping |
| No retroactive shifts | position is never recomputed from a count |

The cost is mutable state advanced by a webhook — addressed in Decision 2.

## Decision 2 — Advancement is gated on the invoice being newly recorded

`handleInvoicePaid` reads `months_elapsed` and writes `+1` with no invoice-level guard. `recordInvoice` upserts idempotently on `stripe_invoice_id`, but its result does not gate the increment. Stripe redelivers `invoice.paid` on retries and replays, so a redelivery today silently advances a client's month counter twice.

That is tolerable while the only casualty is a display counter. It stops being tolerable when the content pointer rides the same event: a double-advance **skips a month of workouts**, leaves no trace, and cannot be distinguished afterwards from normal progress.

**Rule:** both `months_elapsed` and the content pointer advance only when `recordInvoice` inserted a genuinely new invoice row. A conflict on `stripe_invoice_id` means this event has already been accounted for — record nothing, advance nothing, return successfully.

This also repairs the existing `months_elapsed` defect, which is currently live and undetected.

## Decision 3 — `ladder_next_variant_id` is declared, not inferred

The rung order could be read off the `level` enum (`principiante` → `intermedio` → `avanzado`). It is declared as an explicit nullable self-reference on `program_variants` instead, for two reasons:

1. **CuarentaMás must not ladder.** It is fixed-term: its variants get `null` and complete instead of progressing. Inferring from `level` would make every program a ladder and require a second rule to suppress it.
2. **Extra and Strong & Fit have no `time_availability` axis today, but CuarentaMás does.** If Extra ever gains one, `intermedio → avanzado` becomes ambiguous (which time variant?) while an explicit link stays exact.

**Ordering constraint:** the fixed-term branch is evaluated **before** the wrap branch. A CuarentaMás client reaching the end of month 6 must stop, not loop back to month 1. Getting this backwards is silent and would bill a finished client indefinitely against repeated content.

**This guard belongs in *this* change, not in `l2-rolling-billing-extra`.** The wrap branch triggers on a null `ladder_next_variant_id`, which is precisely what CuarentaMás variants carry — so the ladder, shipped alone, would introduce looping for the one program that must never loop. Here the fixed-term subscription's pointer simply **freezes** at `duration_months`; the later change adds the `status` transition and the Stripe cancellation that stop the billing. Each change must be correct standing alone, since they ship separately.

## Decision 4 — The repeat is signposted persistently and quietly

Aura's requirement is that a top-rung client wraps to the first Avanzado series and is told she is caught up. A one-time interstitial is the wrong shape: it is seen once and then the client spends a month doing workouts she recognises with nothing on screen acknowledging it.

**Chosen:** while `content_loops > 0`, the day view carries a small persistent marker — `Repitiendo Mes 3` — in the same register as the existing progress label. Not a banner, not a modal, not an apology. The client is caught up, which is a good outcome, and the marker exists so that recognition reads as intentional rather than as a bug.

**Display, related:** a rolling client's progress label becomes rung-relative — `Avanzado · Mes 2` — rather than `Mes 14`. `SubscriptionCard` currently renders `Mes X de Y` from `months_elapsed` and `duration_months`, which has no denominator when `duration_months` is `null`.

## Decision 5 — One runway signal for Aura, covering both exhaustion shapes

Two situations look different and are the same problem:

- A top-rung client is within a month or two of wrapping.
- A client's **next** rung has no content authored — a Principiante finishing month 6 with no Intermedio series wraps back to Principiante 1, which is indistinguishable from a bug to both the client and Aura.

The second is worse and less visible. Both are "this client is about to run out of new content", so they fold into one admin signal rather than two.

This is the highest-value small piece in the change: without it, Aura learns that a client ran out of content from a complaint.

## Risks / Trade-offs

- **Mutable state on a webhook path.** Mitigated by Decision 2 and by the pointer being inspectable — a wrong value is visible and correctable by hand, unlike a wrong derivation.
- **Backfill correctness.** Existing subscriptions are backfilled from `program_variant_id` + `months_elapsed`. Every current client entered at their program's first rung, so the backfill is `content_variant_id = program_variant_id`, `content_ordinal = months_elapsed`. This is only true while that assumption holds — verify before applying.
- **`program_variant_id` and `content_variant_id` diverge** once a client crosses a rung. This is intended: the first is what she pays for, the second is what she is doing. Any read that means "her level" must be audited for which one it wants. `ClientDetailTabs` and the portal header are the known cases.
