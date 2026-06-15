---
title: Tickle Regen
aliases: [regen, regen_secs_for, tickle regen, regen rate]
tags: [system, economy, core-loop]
status: stable
sources:
  - sql: supabase/migrations/20260598000000_happiness.sql
  - sql: supabase/migrations/20260630000000_alignment_regen_linear.sql
  - sql: supabase/migrations/20260647000000_mud_fights.sql
  - sql: supabase/migrations/20260643000000_home_stats_regen_rate.sql
  - code: hooks/useHomeStats.ts
last_compiled: 2026-06-13
---

# Tickle Regen

How fast a pig's tickle counter refills one point. The server function `regen_secs_for(uid)` returns the per-tickle period in seconds; lower is faster.

## How it works

`regen_secs_for(uid)` multiplies a VIP-tiered base by a stack of buff/debuff factors, floors the result, and clamps it to a 60s minimum (`supabase/migrations/20260647000000_mud_fights.sql:195`):

- **Base**: VIP `1800`s, else `3600`s (1h) — VIP halves the base.
- **× warm_tea** (blessing): `0.5` if an uncleared, unexpired `warm_tea` blessing exists, else `1`. See [[blessings-curses-effects]].
- **× sluggish_snout** (curse): `2` (doubles the interval) if active, else `1`.
- **× alignment** (linear): `1 - clamp(alignment_score × 0.4, -10, +10)/100`. Goblins (≤ -25) slow to `1.1×`, Angels (≥ +25) speed to `0.9×`, smooth in between (`20260630000000_alignment_regen_linear.sql`). This replaced an earlier ±25 step function. See [[alignment]].
- **× happiness** (linear): `1.15 - (happiness_now(uid) - 20)/60 × 0.30` — `1.15×` at sad-20, `0.85×` at happy-80 (`20260598000000_happiness.sql:99`). `happiness_now` decays 1.5/hr, clamped to [20,80]. See [[happiness-and-mood]].
- **× war_winner_regen** (blessing): `0.85` for 72h after a Sounder Mud Fight win, else `1` (`20260647000000_mud_fights.sql:221`). See [[sounder-mud-fights]].
- **Floor**: `GREATEST(60, floor(...))` — never below 60s.

The rate reaches the client as `regen_seconds` via the `home_stats` RPC (`20260643000000_home_stats_regen_rate.sql:81`), consumed in `hooks/useHomeStats.ts` (`Stats.regenSeconds`).

## Key files

- `supabase/migrations/20260647000000_mud_fights.sql` — **current authoritative** `regen_secs_for` def (full stack incl. war_winner_regen).
- `supabase/migrations/20260630000000_alignment_regen_linear.sql` — introduced the linear alignment factor.
- `supabase/migrations/20260598000000_happiness.sql` — added happiness factor + `happiness_now`/`apply_happiness`.
- `supabase/migrations/20260643000000_home_stats_regen_rate.sql` — surfaces `regen_seconds` to the client.
- `hooks/useHomeStats.ts` — Barn-side consumer; turns `regen_seconds`/`next_regen_seconds` into the countdown.

## Connects to

- [[core-loop-and-tickle-trade]] — regen is the supply tap feeding the tickle/trade loop.
- [[blessings-curses-effects]] — warm_tea, sluggish_snout, and war_winner_regen are the buff/debuff factors.
- [[alignment]] — alignment_score drives the linear ±10% factor.
- [[happiness-and-mood]] — `happiness_now` is the symmetric 0.85×–1.15× factor.
- [[sounder-mud-fights]] — a win grants the 72h war_winner_regen blessing.
- [[architecture-seams]] — `regen_secs_for` is the single server-owned regen authority; client only displays it.

## Open questions / risks

- **Carry-latest-def footgun.** `regen_secs_for` is `CREATE OR REPLACE`d across several migrations. Each new def must be carried from the *latest* prior def, not an older one — 20260647 copies from 20260630 (linear alignment), and 20260630 from 20260598 (happiness). Re-creating from a stale base silently drops later factors (e.g. carrying from 20260598 would revert linear alignment). Any future migration touching regen must start from 20260647's body.
- The `60`s floor means a sufficiently stacked pig (VIP + warm_tea + Angel + happy + war win) bottoms out well under 60s of true compute; the buffs are effectively capped by the floor at extremes.
