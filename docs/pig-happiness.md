# Pig Happiness — Spec

A pig's medium-term care state that multiplies tickle regen rate. Friend-acts raise it; time decays it; curses don't touch it. Players see a qualitative mood (Thriving / Happy / Content / Lonely), not a number.

Companion to ADR-0001 (`docs/adr/0001-pig-happiness.md`), which captures the design rationale for the specific knobs chosen.

---

## Decisions (locked via grill-with-docs)

| # | Decision |
|---|---|
| 1 | **Decay-but-floored.** Happiness drops −10/day toward a floor of 30. Solo players settle there permanently; active social players climb toward 100. |
| 2 | **Felt magnitude.** Happiness 0 → 1.30× regen, 100 → 0.70× regen, floor (30) → 1.13×. Linear interpolation. |
| 3 | **Composition.** `final_regen = base × blessing_modifier × curse_modifier × happiness_modifier`. Each axis multiplies independently. |
| 4 | **Inputs (positive-only, no curse drain).** Friend visits (+5, 1/friend/day) · Friend tickles your pig (+1 each, capped 5/friend/day) · Friend blesses you (+10) · Your daily login (+3). |
| 5 | **Qualitative display.** Mood label + pig-posture variation. No exposed number anywhere. |
| 6 | **Visit gates happiness inputs.** "Visit" (feature #4) is the primary input lane — it has to ship simultaneously. Tickling someone else's pig requires you to visit them first. |

---

## Mood mapping

| Happiness range | Mood label | UI |
|---|---|---|
| 80–100 | **Thriving** | Sparkle particle aura + bouncier idle animation |
| 60–79 | **Happy** | Slight ambient particles + neutral idle |
| 40–59 | **Content** | Default pig idle (no extra effects) |
| 30–39 (at floor) | **Lonely** | Slumped ears + dimmed color overlay + slower idle |

Friends see your mood when they `Visit` you. That's the social hook — "Jen's pig looks Lonely → I should visit her."

---

## Reward economics

```
                    ┌─────────────────────────────────┐
                    │ Time decay: −10/day             │
                    │ Floor: 30                       │
                    └──────────────┬──────────────────┘
                                   ▼
              ┌──────────────────────────────────────────┐
              │ Inputs (positive-only)                   │
              │  Friend visit          +5  (1/fr/day)    │
              │  Friend tickle         +1  (5/fr/day max)│
              │  Friend blessing       +10               │
              │  Your daily login      +3                │
              └──────────────┬───────────────────────────┘
                             ▼
                ┌──────────────────────────────┐
                │ Happiness state              │
                │  0–100, default 50 on signup │
                └──────────────┬───────────────┘
                               ▼
       ┌────────────────────────────────────────────────┐
       │ regen_secs_for(uid) multiplier                 │
       │   h=100 → 0.70× (faster regen)                 │
       │   h=50  → 1.00× (neutral)                      │
       │   h=30  → 1.13× (small penalty, the floor)     │
       │   h=0   → 1.30× (impossible w/ floor; reserved │
       │                  for any future zero-state)    │
       └────────────────────────────────────────────────┘
```

**Solo player floor scenario.** No friends, daily login only (+3/day) → decays −7/day net → settles at 30 floor in ~3 weeks → permanently at 1.13× regen (13% slower). Bearable.

**Casual social player.** 3 friends visiting (+15) + 2 tickling (+5–10) + login (+3) = ~+25/day. Net +15/day → climbs to ~80 within a week → maintained at 1.13× × 0.78× ≈ 0.78× regen baseline (22% faster).

**Heavy social player.** 10+ friends, blessings flying around → easily +50/day → maxes at 100 → 0.70× regen (30% faster).

---

## Schema

```sql
-- New column on profiles
ALTER TABLE public.profiles
    ADD COLUMN happiness int NOT NULL DEFAULT 50,
    ADD COLUMN happiness_last_decay timestamptz NOT NULL DEFAULT now();
```

`happiness_last_decay` tracks the last time decay was applied, so we can compute current happiness lazily (no cron needed) by interpolating: `current = max(30, stored - 10 * days_since_last_decay)`.

Daily-decay cron-free model: decay is *applied* on every state-changing happiness call (visit, tickle, bless, login) and on `home_stats` read. Eventually consistent — between calls a pig might be "stale," but every observation snaps it to truth.

---

## Backend RPCs

### `apply_happiness_decay(uid uuid)` — internal helper

Catches stored happiness up to current time by applying −10/day floored at 30, updates `happiness_last_decay = now()`. Called by every state-changing RPC below.

### `bump_happiness(uid uuid, delta int)` — internal helper

Applies decay first, then adds `delta` (clamped to 0–100), writes back.

### Extensions to existing RPCs

| RPC | Change |
|---|---|
| `visit_friend(target_user_id uuid)` *(new — feature #4)* | One row per friend per day rate-limit; on success: `bump_happiness(target, +5)`. Returns the target's pig render data. |
| `tickle_friend_pig(target_user_id uuid)` *(new — feature #4)* | One per-friend-per-tickle rate-limit (cap 5/day); on success: `bump_happiness(target, +1)`. Increments visitor's `tickles_earned`. |
| `send_blessing` *(existing)* | Add `bump_happiness(target, +10)` to the success path. |
| `handle_new_user` *(existing trigger)* | No change — default 50 on signup is fine. |

### Login bump

Either a new `daily_login_bump()` RPC called on app launch, or piggyback on an existing first-load call. Both work; the latter avoids a new RPC.

### `regen_secs_for(uid)` extension

```sql
-- Existing: returns base * blessing_mod * curse_mod
-- Add:      * happiness_mod(happiness)

CREATE OR REPLACE FUNCTION public.happiness_mod(h int)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  -- Linear: h=100 → 0.70, h=0 → 1.30
  SELECT 1.30 - (h::numeric / 100) * 0.60;
$$;

-- In regen_secs_for(uid), wrap the existing return with:
--   * happiness_mod(profiles.happiness)
-- after applying decay so the stored value is current.
```

---

## UI surfaces

### Barn

- **Mood overlay on Rosie.** Lonely: slumped ears (could be done as a small sprite swap or a CSS-style transform). Thriving: sparkle particles in the ambient layer.
- **Hidden number.** No "78" or "Happiness" label anywhere on Barn — the visual change *is* the readout.

### Visit screen (feature #4)

- Friend's pig rendered with full cosmetics + their mood overlay.
- "Tickle their pig" button (capped 5/friend/day). Each tap increments their happiness +1 + counts toward your `tickles_earned`.
- "Visit registered" toast on entry (the +5 contribution to host's happiness is also fired here).

### Friends list

- Subtle mood indicator next to each friend's name? Optional. Risk: turns the friends list into a "rescue the sad pigs" guilt-trip surface. Recommend **no** — keep mood visible only via Visit, so visiting feels like *discovery*, not *triage*.

### Account screen

- No happiness display on your own Account either. You see your mood on the Barn (it's your pig's posture); a separate readout would lean toward number-grinding.

---

## Anti-spam + edge cases

- **Friend visit cap** — 1 per friend per UTC day (insert into `friend_visits` with unique key on `(visitor_id, target_id, visit_date)`).
- **Friend tickle cap** — 5 per friend per UTC day per direction (`friend_tickles` with daily counter).
- **Daily login bump** — track via `profiles.last_login_bump_date`; set to today on first foreground; +3 on first call where date differs.
- **Block** — blocked users can't visit or tickle. `are_blocked()` helper already exists.
- **Self-action** — can't visit or tickle yourself (server-side check).

---

## Migration phases

### Phase 1 — Schema + decay infra (silent)

- New columns + happiness_mod() function + apply_happiness_decay() helper.
- Hook decay into `regen_secs_for(uid)`. Multiplier active, but every player sits at default 50 (=1.00×) so no observable change until inputs fire.
- Mood label NOT rendered yet.

### Phase 2 — Inputs wired

- `send_blessing` adds bump.
- Daily login bump on app launch.
- (Visit + tickle inputs deferred to Phase 3 since visit is feature #4.)

### Phase 3 — Visit screen + tickle (feature #4) shipped alongside

- `visit_friend` + `tickle_friend_pig` RPCs.
- Visit screen UI in app.
- Mood overlay rendered on Barn + Visit screen.

Phase 1 + 2 can ship without #4 — they're just lightly active. Phase 3 unlocks the social loop fully.

---

## Tests

- `__tests__/happiness.test.ts` — pure helper:
  - `happiness_mod(h)` boundary values (0, 30, 50, 80, 100).
  - Decay math (5 days at -10 from 80 → 30; cannot go below floor).
  - Clamp on input (cannot bump above 100; +5 to a 100 pig stays at 100).
- SQL: pgTAP for `apply_happiness_decay` + `bump_happiness` idempotency + clamping. (Or hand-verified in TestFlight.)
- Manual: confirm Sentry breadcrumb `[happiness] bumped +N from {visit|tickle|blessing|login}` fires once per cause.

---

## Heads-up

- **Magnitude is a tuning knob.** 0.7×–1.30× is the starting point. After 2–4 weeks of public-build data, audit whether the spread is too wide / too narrow and adjust `happiness_mod` linearly. Single function change; no migration.
- **The mood overlay needs art.** "Slumped ears" and "sparkle particles" are concepts — turn into either Rive animation variants on the existing `RivePig` component, or static sprite overlays. Treat as part of Phase 3 art budget.
- **Cron-free decay is eventually consistent.** A pig untouched for 3 weeks has stored happiness=80 with last_decay 3 weeks ago. The next call to any RPC catches it up to 30. There's no inconsistency at observation time, but `SELECT happiness FROM profiles` directly will show stale values. Always go through `apply_happiness_decay` first if you need the current value.
- **No retroactive grant.** Players existing pre-launch start at default 50, same as new players. No "thank-you" boost for loyal users. (Could be added but feels random; skip unless launch metrics demand it.)
