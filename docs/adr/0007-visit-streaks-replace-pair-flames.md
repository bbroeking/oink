# ADR 0007: Visit Streaks replace Pair Flames

- Status: accepted
- Date: 2026-08-29

## Decision

Each unordered pair of friends owns one Visit Streak. Either friend's first
qualifying Barn visit advances or preserves that shared streak. A reciprocal
visit during the same streak day does not award a second credit.

Visit Streaks inherit the flame stages, banked longest count, blame-free sleep,
and matching milestone-cosmetic direction previously assigned to Pair Flames.
They replace Pair Flames rather than coexist with them. Blessings, curses,
trades, and other pair actions do not advance the Visit Streak.

The first implementation uses the same rolling rhythm as the personal Streak:
credits are at least 24 hours apart, a qualifying visit within 36 hours extends
the run, and a later visit rekindles at one. The server owns pair ordering,
credit timing, and idempotency.

## Why

A visit-specific rule is legible from the place where the flame is shown. It
also gives either friend agency to keep a relationship warm, while one
unordered record prevents directional duplicates and same-day double credit.

## Consequences

- Friend rows show the live flame and explicit count.
- The longest count survives a sleeping flame.
- No UI identifies which pig failed to visit.
- Existing Pair Flame language and broad pair-action triggers are retired.
- Day-30/day-90 matching cosmetics remain an asset/content follow-up.
