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

**Mood is Rosie's idle state, full stop.** The current "show the sad sprite when the tickle bank is empty" behavior (`SwipeElement.tsx:93-94`) is removed — empty-bank is communicated by the heart counter, not by Rosie's face. Wherever Rosie renders (Barn Exterior, Barn Interior, Visit screen, item previews, modals), her resting animation is selected by current happiness mood. Tickle-tap reward animations, Lucky Pig jumps, and surprise frames still play on top transiently; mood is the *base* that the animation returns to.

| Happiness range | Mood label | Idle sprite set | Ambient layer |
|---|---|---|---|
| 80–100 | **Thriving** | `thriving_1..4` *(new — to be generated, see "Sprite work needed" below)* | Sparkle particle aura around Rosie |
| 60–79 | **Happy** | `happy_1..4` *(existing — currently only used as a tickle-reward animation)* | Slight ambient sparkles |
| 40–59 | **Content** | `idle_1..4` *(existing — today's default)* | None |
| 30–39 (at floor) | **Lonely** | `sad_1..4` *(existing — repurposed from the empty-bank trigger)* | Dimmed cool-gray color overlay |

Friends see your mood when they `Visit` you — same selector logic, same sprite set. That's the social hook ("Jen's pig looks Lonely → I should visit her").

### How a pig gets to happier states

Happiness starts at 50 (Content) on signup and decays −10/day toward a floor of 30 (Lonely). All inputs are positive — there are no negative ones. To climb toward Happy / Thriving:

| Source | Bump | Cap |
|---|---|---|
| Your daily login | +3 | Once per UTC day, free + automatic |
| Friend visits you | +5 | Once per friend per UTC day (their `Visit` action) |
| Friend tickles your pig | +1 each | Capped at 5/friend/day |
| Friend sends you a blessing | +10 | No daily cap; gated by their once-per-day ritual rule |

**Daily math by player profile:**

| Profile | Net Δ/day | Steady-state mood |
|---|---|---|
| Solo, login only | +3 − 10 = **−7** | Lonely (floors at 30 in ~3 weeks) |
| 1 active friend visiting + 1 tickle | +3 + 5 + 1 − 10 = **−1** | Drifts toward Lonely slowly |
| 1 active friend visiting + maxing 5 tickles | +3 + 5 + 5 − 10 = **+3** | Climbs to Happy (80) in ~10 days, Thriving in ~3 weeks |
| 3 active friends + occasional blessings | ~+30 daily | Thriving (100) within a week |

The path the player needs to internalize: **mood is a friendship signal**. Solo gameplay floors at Lonely; a single engaged friend is the difference between drifting down and climbing up; a small sounder of 3+ active friends maxes happiness comfortably. The Visit screen + tickle interactions (Phase 3) are the high-leverage levers.

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

### Barn (Exterior + Interior, both)

- **Mood drives Rosie's idle.** Every render path that shows Rosie reads current mood and selects the matching sprite set (see Mood mapping above). One selector, shared across `Barn.tsx`, `SwipeElement.tsx`, `PigStage.tsx` consumers (Visit screen, ItemPreviewModal, etc.).
- **Empty-bank decoupled from Rosie's face.** The `if (!canTickle) setPigAnim("sad")` branch in `SwipeElement.tsx:93-94` is removed. When the tickle bank is empty, the heart counter / regen UI carries that signal; Rosie's idle stays tied to mood. Tap-on-empty can still bounce a *transient* "denied" cue (the existing `deniedSound` + brief shake), but the base sprite does not switch.
- **Hidden number.** No "78" or "Happiness" label anywhere — the visual change *is* the readout.
- **Ambient layer per mood.** Thriving renders sparkle particles around Rosie (separate ambient layer, similar implementation to existing `sunBeam`). Lonely renders a subtle cool-gray color overlay on the pig sprite. Content + Happy carry no ambient effect — the sprite swap alone reads the difference.

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
- **Mood-as-idle requires a sprite generation pass before Phase 3 ships.** Existing sprite sets in `assets/images/sprites/rosie/` cover three of the four moods (`idle_1..4` for Content, `happy_1..4` for Happy, `sad_1..4` for Lonely — repurposed from the old empty-bank trigger). **The `thriving_1..4` sprite set does not exist yet and must be generated.** Sparkle ambient particles for Thriving + cool-gray overlay for Lonely are separate render layers (CSS-style transforms / particle code), not sprite work.
  - **TODO — kick off subagent for Rosie sprite generation.** Tasks: (1) generate `thriving_1..4` matching the existing 4-frame idle cadence and the Rosie style (same canvas size, anchor points, hat/cosmetic attachment points so PigStage's anchor math doesn't drift); (2) audit `sad_1..4` to confirm it reads as "lonely / slumped" rather than "rejected by app", and tweak if needed; (3) confirm `happy_1..4` reads as a sustainable *idle* loop (today it only plays briefly on Lucky Pig + 6-7 easter egg — when used as a steady mood state, an over-bouncy variant may feel jittery). Per [[feedback_module_naming]], keep filenames technical (`thriving_*`) — player-facing labels stay in UI.
- **Cron-free decay is eventually consistent.** A pig untouched for 3 weeks has stored happiness=80 with last_decay 3 weeks ago. The next call to any RPC catches it up to 30. There's no inconsistency at observation time, but `SELECT happiness FROM profiles` directly will show stale values. Always go through `apply_happiness_decay` first if you need the current value.
- **No retroactive grant.** Players existing pre-launch start at default 50, same as new players. No "thank-you" boost for loyal users. (Could be added but feels random; skip unless launch metrics demand it.)
