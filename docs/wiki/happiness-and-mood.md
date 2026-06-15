---
title: Happiness & Mood
aliases: [happiness, mood, pig-mood]
tags: [system, core-loop, economy, regen, social]
status: stable
sources:
  - code: utils/happiness.ts
  - doc: docs/happiness-spec.md
  - doc: CONTEXT.md
  - sql: supabase/migrations/20260598000000_happiness.sql
  - sql: supabase/migrations/20260599000000_happiness_wiring.sql
  - sql: supabase/migrations/20260612000000_happiness_rebalance.sql
  - sql: supabase/migrations/20260621000000_happiness_floor_50.sql
last_compiled: 2026-06-13
---

# Happiness & Mood

A pig's medium-term care state on a **[20, 80]** band, driven mainly by your own tickling consistency: it decays over time and rises when you tickle, and it multiplies tickle regen rate. **Mood** is its only visible readout — the pig's idle sprite (sad / content / happy), never a number.

## How it works

**Self-driven.** Tickling your own pig is the primary lever: a successful home tickle calls `apply_happiness(uid, +1.0)` (`supabase/migrations/20260599000000_happiness_wiring.sql:74`). Friend-acts count too but are **25% as effective** — when someone taps your pig at the barn, you gain `+1.0` (your engagement) and the host gains `+0.25` (`supabase/migrations/20260600000000_visit_tap_session.sql:56-57`). This supersedes the old friend-acts-only, floored-at-30 design (`docs/pig-happiness.md`, ADR 0001) — `docs/happiness-spec.md` + `CONTEXT.md:12` are canonical.

**Lazy decay + gain.** `apply_happiness` (`supabase/migrations/20260612000000_happiness_rebalance.sql:27`) first decays since last touch at **0.5/hr** (~3 days of neglect drops happy→sad), then adds gain capped per **~4h window** (cap 25), tapering to zero as happiness nears 80. Decay/gain are computed on every state-changing call and on read via `happiness_now()` — no cron. A one-time op floored every pig to 50 (`supabase/migrations/20260621000000_happiness_floor_50.sql`).

**Regen multiplier.** Happiness feeds `regen_secs_for(uid)` linearly: `1.15 - (h - 20)/60 * 0.30`, i.e. 1.15× (15% slower) at sad-20 → 1.0× at content-50 → 0.85× (15% faster) at happy-80 (`supabase/migrations/20260598000000_happiness.sql:98-99`).

**Mood = the idle sprite.** `moodAnimation(h)` maps three bands to three sprite sets — Sad `< 38`, Content `38–62` (`idle`), Happy `> 62` (`utils/happiness.ts:6-13`). No number, meter, or label anywhere; the resting idle is the entire readout, shown only when the pig isn't mid-animation. Friends see your mood on a visit — the social pull.

## Key files

- `utils/happiness.ts` — `moodAnimation()`: happiness number → idle sprite band (the client-side readout).
- `docs/happiness-spec.md` — canonical buildable spec (model, decay/gain, regen, mood table, visit tap-session).
- `supabase/migrations/20260598000000_happiness.sql` — columns, `apply_happiness`, `happiness_now`, regen factor.
- `supabase/migrations/20260599000000_happiness_wiring.sql` — wires self-tickle +1.0; `home_stats` returns happiness.
- `supabase/migrations/20260612000000_happiness_rebalance.sql` — shipped tuning (decay 0.5/hr, window cap 25).
- `supabase/migrations/20260621000000_happiness_floor_50.sql` — one-time floor of every pig to 50.

## Connects to

- [[regen]] — happiness is one multiplier in `regen_secs_for`; mood directly speeds/slows tickle refill.
- [[core-loop-and-tickle-trade]] — your own tickling is the main happiness input.
- [[barn-visiting]] — visit tap-sessions feed friend happiness (+0.25 host, +1.0 visitor) and reveal mood.
- [[barn-and-habitat]] — mood selects Rosie's resting idle wherever she renders in the barn.
- [[streak-and-garden]] — a parallel regen multiplier rewarding loyalty rather than social/care activity.
- [[blessings-curses-effects]] — a separate short-term regen axis; curses do not lower happiness.
- [[design-system]] — `SpritePig`/`PigStage` pick the idle frame set from the viewed pig's mood.

## Open questions / risks

- `docs/pig-happiness.md` (0–100, floor 30, friend-only inputs) is the **superseded** ADR-0001 design — kept for history but contradicts the shipped [20,80] self-driven model; risk of citing the wrong doc.
- The `tired` sprite + thriving/ambient layers described in the specs are partly aspirational; shipped mood is the three-band sad/content/happy set in `utils/happiness.ts`.
- Decay is eventually consistent: a direct `SELECT happiness FROM profiles` is stale until an RPC or `happiness_now()` catches it up.
