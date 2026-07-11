# Dig-off spoils visibility — spec

**Problem.** The weekly Sounder race already pays out every Monday (Golden
Truffles by rank + a podium cosmetic, via the `race-sweep` cron), but the reward
is **invisible before it settles**. A player only learns they won *after* the
fact (push + announcement). The board never shows the pot, the rank→payout
ladder, or how close you are to moving up — so there's no reason to dig *today*.

**Goal.** Make the reward the player already earns actually motivate digging, by
surfacing it on the dig-off board *while it's still winnable*. **UI only — no
migration.** All data is already client-side.

**Location.** `components/season1/RaceSection.tsx`, inside `StandingsCard`'s
weekly block (the dashed-rule area under the standings rows).

**Data sources (all present, no server change):**
- `RACE_TRUFFLE_TABLE` (`constants/dig.ts`) — the pot: `1→6, 2→5, 3→4, topHalf→3, ranked→2`.
- `state.ranked` (`RankedStanding[]`) — weekly ranked crews (`rank`, `avg`, `diggers`, `total_finds`).
- `state.mine` (`MyStanding`) — my weekly `rank`/`avg`/`diggers`/`total_finds`.
- `state.cycle.ends_at` → the settles-Monday countdown (already computed as `countdown`).
- `HAT_IMAGES['golden_truffle']` — the truffle icon (already imported; no emoji, per house rule).

---

## Piece 1 — "This week's spoils" strip

A compact strip at the top of the weekly block showing the pot, so the reward is
visible before Monday. Static from `RACE_TRUFFLE_TABLE` — renders whenever a race
is live (i.e. always during a cycle; also shows in the cold-start/empty board so
a first player sees what's at stake).

Layout (kicker + one prize line):
```
★ this week's spoils
[🟡truffle] 6 · 5 · 4 to the podium + a prize hat · 2–3 for the field
```
- Small `golden_truffle` image as the truffle mark.
- Podium amounts from `RACE_TRUFFLE_TABLE[1..3]`; field range from `topHalf`/`ranked`.
- Hand/mute styling consistent with the existing weekly line.

## Piece 2 — Your placement + the gap

Enhance the existing weekly line so a ranked crew sees *how to move up*, not just
where it sits. Weekly rank is by `avg` (finds per digging snout), so "finds to
pass" is derived, not a raw subtraction:

- **Ranked, not 1st:** `you're {ordinal(rank)} of {N} — {X} more finds to pass {ordinal(rank-1)}`
  where the crew directly above is `state.ranked.find(r => r.rank === mine.rank - 1)`
  and `X = max(1, floor(above.avg * mine.diggers - mine.total_finds) + 1)`
  (finds that lift your avg past theirs; approximate if digger counts differ —
  directionally correct and actionable).
- **Ranked, 1st:** `you're 1st — hold the lead`.
- **Sub-quorum / no dig:** unchanged (existing nudges).
- Countdown stays appended: `… · settles Monday`.

---

## Build order (one by one)

1. **Piece 1** — spoils strip. Build → `tsc` → review (optionally screenshot).
2. **Piece 2** — placement + gap. Build → `tsc` → review.

Each piece is self-contained; Piece 1 ships value alone even if Piece 2 waits.
