# 0005. A bar fill is measured against its track, not against the card

Status: Accepted · Date: 2026-07-29

## Context

The dashboard's "Clientes por variante" card drew its bars with a hand-written `#9982f4` —
the value of `--lavanda` — on a `--gris-claro` (`#f5f5f5`) track. That fill shipped and was
looked at repeatedly without anyone flagging it.

It fails WCAG 1.4.11, which asks for **3:1** between a graphical object and the colors
adjacent to it:

| | vs `#f5f5f5` track | vs white card |
|---|---|---|
| `--lavanda` `#9982f4` | **2.81 : 1** ✗ | 3.09 : 1 ~ |

The reason it passed inspection is the second column. Measured against the white card the
fill scrapes past 3:1, and "lavender on white" is how anyone describes the card when they
look at it. But the filled portion of a bar does not sit on the card — it sits **on the
track**, and that is the comparison the guideline is asking for. The near-miss in the
right-hand column is what made the real failure in the left-hand column invisible.

This is not a one-off. `--rosa` (`#eddbd8`), the brand pink, measures **1.22:1** against the
same track. It is a *background* color and is very good at that job; it cannot be a bar fill
at all. Reaching for a brand color and assuming it works as a fill is the same mistake in a
different hue, and at the time of writing `components/admin/RevenueBarChart.tsx` and
`components/portal/PerformanceChart.tsx` both still carry it.

## Decision

**Contrast for a filled graphical object is measured against the surface it is drawn on, not
against the page background.** For a bar in a track, that is the track.

Concretely, for this codebase:

- Bar fills, meter fills, progress fills and chart marks are tokens in `app/globals.css`.
  A literal hex in a component means the token system had a gap (D23).
- A token intended as a **fill** clears 3:1 against `--gris-claro`. A token intended as a
  **background** has no such obligation, and the two sets are not interchangeable.
- Fill tokens carry their measured ratio in a comment next to the definition, against the
  track, so the next reader inherits the number rather than re-deriving it.

`--rosa-bar` (`#b8746a`, 3.35:1) was added under this rule, and the clients bars moved to the
existing `--lavanda-dark` (`#7a63d4`, 4.29:1).

## Alternatives considered

- **Keep the brand `--rosa` and outline each bar** to reach contrast via the border instead of
  the fill. Technically viable, and it preserves the brand hue exactly. Rejected: it adds a
  border to every row of every bar list to rescue one color, and the result reads worse than
  a darker fill.
- **Darken the track instead of the fill**, buying contrast from the other side. Rejected:
  the track is `--gris-claro`, shared with several other surfaces, so this trades a local
  problem for a global one.
- **Treat the white-card measurement as sufficient**, since a bar is visually "on" a white
  card. Rejected — this is precisely the reasoning that let the defect ship, and it gets less
  defensible the fuller the bar is, since a full bar covers the track entirely.
- **Accept the brand pink as-is** and rely on the row label to carry the meaning. Rejected:
  the bar is the comparison. If only the number is readable, the chart is a table.

## Consequences

**The palette splits in two.** Fill tokens and background tokens are now separate sets with
different obligations, and a designer picking "the pink" has to know which set they are in.
`--rosa-bar` is a visibly different color from `--rosa` — closer to terracotta than to the
brand blush — so a chart is no longer guaranteed to match the brand swatch beside it. That
divergence is the accepted cost, and it should be explained to Aura rather than discovered.

**Two components are knowingly non-compliant** at the time of writing (`RevenueBarChart`,
`PerformanceChart`). This ADR states the rule; it does not retroactively fix them, and the
follow-up is recorded in the `dashboard-revenue-by-variant` change.

**The check is cheap but not automatic.** Nothing in `tsc`, ESLint, the tests or the build
computes a contrast ratio, so this rule is enforced by review and by the ratio comments on the
tokens — the same class of gap as review rules 7–11, and it fails the same silent way.
