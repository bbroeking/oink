---
title: Streak & Garden
aliases: [streak, garden, devotion, current_streak]
tags: [system, regen, retention, barn, headless]
status: draft
sources:
  - doc: docs/streak.md
  - doc: docs/adr/0002-streak.md
  - doc: CONTEXT.md
  - code: hooks/useHomeStats.ts
last_compiled: 2026-06-13
---

# Streak & Garden

**Streak** is a player's consecutive-engagement state — the number of "personal days" they've tickled within a rolling 36h window — that multiplies tickle regen on an axis independent of happiness. The **Garden** is its UI: a 5-stage growing object in the Barn, shown as a visual with no number (`docs/streak.md`, `CONTEXT.md` lines 16–17).

## How it works

- **Credit window (rolling 36h).** On each self-tickle, the time since `last_streak_bump_at` decides the move: `< 24h` no-op (anti-spam), `24h–36h` `current_streak += 1`, `> 36h` hard-reset to 1. First-ever tickle (null bump) sets streak = 1 (`docs/streak.md` §Backend RPCs, `apply_streak_bump`).
- **Cap at day 30.** `streak_mod(streak)` is linear `1.00× → 0.75×` over days 1–30, capped beyond; `streak_mod(0)` is special-cased to `1.00×` so the silent rollout penalizes no one (`docs/streak.md` §Schema/§Migration phases, ADR-0002).
- **Independent composition.** Spec'd as a fourth multiplier inside `regen_secs_for(uid)`: `base × blessing × curse × happiness × streak`, floor 60s (`docs/streak.md` decision #9). This is the loyalty axis; [[happiness-and-mood]] is the social axis.
- **Garden = the readout.** 5 stages — Seedling (1–6), Sprout (7–13), Young (14–20), Mature (21–29), Full bloom (30+) — plus a ~3s wilt on break. Lives in the Barn ambient layer near Rosie, never overlapping her (`docs/streak.md` §Stage mapping/§UI surfaces).
- **No-number compensation.** A push warning at hour 24 (`current_streak >= 3`) carries the precision the hidden number cannot (`docs/streak.md` §Push warning, decision #6).

> **Current state (headless).** The multiplier is spec'd/ADR'd but **not yet in the repo**: no `streak_mod`/`current_streak`/`apply_streak_bump` in `supabase/migrations/`, and no Garden component. `hooks/useHomeStats.ts` exposes `regenSeconds` but no streak field. Treat this page as design intent until Phase 1 ships.

## Key files

- `docs/streak.md` — full spec: window logic, curve, schema, RPCs, 4-phase rollout.
- `docs/adr/0002-streak.md` — the decision record (why rolling 36h, hard reset, linear day-30, hidden number).
- `CONTEXT.md` (lines 16–17, 19) — canonical Streak + Garden domain definitions; Garden sits in the Barn Exterior ambient layer.
- `hooks/useHomeStats.ts` — Barn stats slice carrying `regenSeconds`/`regen_secs_for` output; where a future streak field/Garden stage would surface.

## Connects to

- [[regen]] — streak is the fourth multiplier on `regen_secs_for`; floor 60s.
- [[happiness-and-mood]] — the paired axis; deliberately independent (loyalty vs social) and both compound multiplicatively.
- [[core-loop-and-tickle-trade]] — streak credit piggybacks on the same self-tickle that bumps `last_active_date`.
- [[barn-and-habitat]] — the Garden lives in the Barn ambient layer; ADR-0003 habitat may later contest that real estate.
- [[barn-visiting]] — Phase 4 surfaces a host's Garden to visitors as a passive flex.
- [[notifications]] — the hour-24 push warning is load-bearing, not optional polish.

## Open questions / risks

- **Unbuilt (status: draft).** No migration, RPC, or Garden component exists yet — verify against `supabase/migrations/` before citing as shipped.
- **Player-facing name.** CONTEXT.md floats "Devotion" as the cozy label; not locked in code/UI.
- **Habitat collision.** ADR-0003 habitat decoration will claim Barn space; Garden must pick a corner it won't override, or migrate (`docs/streak.md` §Heads-up).
- **0.75× cap is a tuning knob** — flagged for audit after 2–4 weeks of live data (`docs/streak.md` §Heads-up).
