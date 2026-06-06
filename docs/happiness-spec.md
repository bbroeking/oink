# Happiness — implementation spec

Decision record: [ADR 0004](./adr/0004-happiness-self-driven.md). Glossary:
`CONTEXT.md` (Happiness, Mood, Visit). This is the buildable detail.

## Model

A pig's happiness is a number on **[20, 80]**, driven by the owner's tickling
consistency. Stored + computed lazily (the `last_increment` pattern the tickle
bank already uses), never shown as a number.

**Two columns on `profiles`:**
- `happiness numeric NOT NULL DEFAULT 60` (new pigs start ~60; existing backfill 50)
- `happiness_updated_at timestamptz NOT NULL DEFAULT now()`

Plus a small ledger for the per-window gain cap (see below):
- reuse `barn_visits` for friend-tickle counts where possible; for self-tickles,
  a lightweight `happiness_window_gain` (user_id, window_start, gained) or just
  derive the cap from `happiness_updated_at` deltas — pick the simpler at build.

### Lazy decay + gain

A single helper `apply_happiness(uid, raw_gain numeric)` does it all:
1. **Decay** since last touch: `elapsed_hours * DECAY` subtracted, clamped at 20.
   `DECAY ≈ 1.5 / hour` → ~16h of total neglect ≈ −24 (happy → sad).
2. **Window-capped gain:** add `raw_gain`, but cap total gain to ~**one band per
   ~4h window** so dumping a binge ≈ one band of progress, spreading = full value
   each window. Diminish gain as happiness nears 80 (hard to reach the top).
3. Clamp to [20, 80]; set `happiness`, `happiness_updated_at = now()`.

Called from:
- **`update_profile_and_item_count`** (tickling your own pig): `raw_gain = +1.0`.
- **`tickle_at_barn`** (you tickle a friend on a visit): your pig
  `apply_happiness(caller, +1.0)`; their pig `apply_happiness(target, +0.25)`.
- A read-only `happiness_now(uid)` for display that applies decay without a gain.

### Regen integration

Add one factor to `regen_secs_for(uid)`, alongside VIP / warm_tea / sluggish /
alignment: linear from happiness → multiplier.

```
h := happiness_now(uid)            -- 20..80, decayed to "now"
happiness_factor := 1.15 - (h - 20) / 60 * 0.30    -- 1.15× at 20 → 0.85× at 80
```

So sad ≈ 1.15× (15% slower), content ≈ 1.0×, happy ≈ 0.85× (15% faster).
Worst-case stack with `warm_tea` 0.5× = 0.42× — acceptable (not the 0.25× burst).

## Mood bands (display only — the sprite)

| Mood | happiness | idle animation |
|------|-----------|----------------|
| Sad | 20–37 | `sad` |
| Content | 38–62 | `idle` |
| Happy | 63–80 | `happy` |

- The mood animation is the **resting/default** idle — it only shows when the pig
  isn't already mid-animation (tickle bounce, lucky-pig, jump, etc.).
- **No number, no meter, no label.** The sprite is the entire readout.
- Surfaced everywhere Rosie renders: home Barn, **Visit screen (friends see your
  pig's mood — the social pull)**, Closet preview, item previews. One code path:
  `SpritePig`/`PigStage` pick the idle set from the viewed pig's `happiness_now`.
- `home_stats` returns `happiness` (the number, for the client to band → sprite);
  visiting fetches the *target's* `happiness_now` too.

## Visit = tap-session + tired-out

Replaces the single "Tickle their pig" button:
- The visit screen lets you **tap their pig repeatedly**. Each tap calls
  `tickle_at_barn` (host +3 tickles + happiness, you +1 tickle + happiness).
- After a **random 3–7 taps** (rolled at visit open), **both pigs play the new
  `tired` animation**, a dialogue pops — *"The pigs are tuckered out — come play
  another time!"* — and it **returns to the homepage**.
- The tiredness is the visit's hard cap; the per-window happiness cap still
  governs farming across many visits.
- Keep the existing per-target 1h cooldown + 5/day visit budget.

## New art

- **`tired` sprite set** — generate from idle Rosie via ChatGPT + Claude-in-Chrome
  (`icon-gen` skill). Add `tired` frames to `constants/hats.ts` PIG_FRAMES +
  `SpritePig`. Both the visitor's and host's pig use it on tired-out.

## Build order

1. Migration: `happiness` columns + backfill + `apply_happiness` +
   `happiness_now` + wire into `update_profile_and_item_count`,
   `tickle_at_barn`, `regen_secs_for`. `home_stats` returns happiness.
2. Client: `SpritePig`/`PigStage` pick idle set from happiness band; thread the
   number through `useHomeStats` + the visit fetch.
3. Generate + wire the `tired` sprite.
4. Rework the visit screen into a tap-session with the 3–7 tired-out + dialogue.

## Tunables (retune freely)

`DECAY=1.5/hr` · self gain `+1.0` · friend gain `+0.25` · window cap ≈ one
band / 4h · regen `0.85×–1.15×` · start 60 / backfill 50 · tired-out `rand(3,7)`.
