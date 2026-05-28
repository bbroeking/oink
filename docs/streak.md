# Streak — Spec

A player's consecutive-engagement state that multiplies tickle regen rate on an axis independent of happiness. Tickling within 36 hours of the last streak credit extends it; a 36h gap hard-resets to 0. Players see a growing visual object (Garden) in the Barn — never a number.

Companion to ADR-0002 (`docs/adr/0002-streak.md`), which captures the rationale for the specific knobs chosen.

Related: ADR-0001 + `docs/pig-happiness.md`. Streak and happiness are independent multipliers on `regen_secs_for(uid)` — by design.

---

## Decisions (locked via grill-with-docs)

| # | Decision |
|---|---|
| 1 | **Streak-scope.** Counts consecutive "personal days" of activity, not session or daily. The Duolingo lever. |
| 2 | **Active = tickling at least once.** Reuses the existing `last_active_date` bump that already fires inside `update_profile_and_item_count`. Zero new instrumentation. |
| 3 | **Rolling 36-hour window.** Min 24h between credits (anti-spam); max 36h before break (built-in 12h buffer). |
| 4 | **Hard reset at 36h + push warning at hour 24.** No streak freezes, no soft decay. Cozy game compromise: the push warning compensates for the strictness. |
| 5 | **Linear curve, cap at day 30 = 0.75× regen.** Each streak day = ~0.86% faster. Solo-loyal player at floor offsets happiness penalty exactly. |
| 6 | **Growing visual object (Garden), no exposed number.** Honors the no-raw-numbers principle from ADR-0001. Push warning carries the precision the number would. |
| 7 | **Barn ambient layer.** Near Rosie, not overlapping. Visible every session. Distinct from happiness's mood overlay on Rosie herself. |
| 8 | **5 sprite stages.** Seedling (1–6) → Sprout (7–13) → Young (14–20) → Mature (21–29) → Full bloom (30+). Immediate reset to seedling on break with brief wilt animation (~3s). |
| 9 | **Independent multiplicative composition.** `regen = base × blessing_mod × curse_mod × happiness_mod × streak_mod`. Floor 60s. |
| 10 | **No retroactive grant.** Everyone starts at streak=0 on ship day. `distinct_active_days` counts lifetime, not consecutive — wrong semantics for backfill. |

---

## Stage mapping

| Streak days | Stage | Description |
|---|---|---|
| 0 | Empty plot | Nothing visible (or a bare patch of soil). |
| 1–6 | **Seedling** | Tiny sprout. "Something's beginning." |
| 7–13 | **Sprout** | Stalk emerged, leaves forming. Week 1 milestone visible. |
| 14–20 | **Young** | First visible bloom or fruit. |
| 21–29 | **Mature** | Plant in full leaf, almost there. |
| 30+ | **Full bloom** | The maxed-out visual. Player has earned the multiplier ceiling. |

The art metaphor (flower, bonsai, sunflower, vine, hay-bale stack, etc.) is **deferred to art-time** — the spec only fixes stage count and thresholds. Whatever metaphor lands should not collide with future habitat-building (#6) which will own the broader Barn-decoration surface.

---

## Reward economics

```
                       ┌────────────────────────────────────┐
                       │ Trigger: tickle at least once      │
                       │  (already fires last_active_date)  │
                       └──────────────┬─────────────────────┘
                                      ▼
              ┌────────────────────────────────────────────┐
              │ Δ since last_streak_bump_at                │
              │   < 24h  → no-op (already counted)         │
              │  24–36h  → streak += 1; bump_at := now()   │
              │   ≥ 36h  → streak = 1;  bump_at := now()   │
              │           (resets w/ wilt animation)       │
              └──────────────┬─────────────────────────────┘
                             ▼
                ┌──────────────────────────────┐
                │ Streak state                 │
                │   current_streak int ≥ 0     │
                │   last_streak_bump_at ts     │
                └──────────────┬───────────────┘
                               ▼
        ┌─────────────────────────────────────────────┐
        │ streak_mod(current_streak)                  │
        │   day 1   → 1.00× (no bonus yet)            │
        │   day 7   → ~0.95×                          │
        │   day 14  → ~0.89×                          │
        │   day 30+ → 0.75× (cap, 25% faster)         │
        └─────────────────────────────────────────────┘
```

**The headline scenarios.**

| Player profile | Mod composition | Effective | vs 3600s |
|---|---|---|---|
| New player day 1, no buffs | 1.00× | 3600s | 60 min |
| Solo at happiness floor (30), no streak | 1.13× | 4068s | 68 min — *the lonely penalty* |
| Solo at happiness floor, day 30 streak | 1.13 × 0.75 = **0.85×** | 3060s | 51 min — *loyalty offsets loneliness* |
| Social max happiness, day 30 streak | 0.70 × 0.75 = **0.525×** | 1890s | 32 min |
| All-buffs ceiling (warm_tea × max_happy × day_30) | 0.5 × 0.7 × 0.75 = **0.26×** | 940s | ~16 min — *the rare power state* |

Line 3 is the design payoff: solo-loyal players climb back to roughly neutral without needing friends. The streak is the loyalty axis; happiness is the social axis; both compound multiplicatively without forcing players to play one game style.

---

## Schema

```sql
ALTER TABLE public.profiles
    ADD COLUMN current_streak int NOT NULL DEFAULT 0,
    ADD COLUMN last_streak_bump_at timestamptz;
```

No `longest_streak` (no exposed number; no leaderboard surface). No retroactive grant (everyone starts at 0).

`last_streak_bump_at` is **nullable** — a fresh profile with `current_streak = 0` has no last-bump. The first tickle sets `current_streak = 1`, `last_streak_bump_at = now()`.

---

## Backend RPCs

### `apply_streak_bump(uid uuid)` — internal helper

Called from `update_profile_and_item_count` (the tickle handler) at the same point the `last_active_date` bump happens. Logic:

```sql
DECLARE
    cur_streak int;
    last_bump timestamptz;
    delta_seconds numeric;
BEGIN
    SELECT current_streak, last_streak_bump_at
        INTO cur_streak, last_bump
        FROM public.profiles WHERE id = uid;

    IF last_bump IS NULL THEN
        UPDATE public.profiles
            SET current_streak = 1,
                last_streak_bump_at = now()
            WHERE id = uid;
        RETURN;
    END IF;

    delta_seconds := EXTRACT(EPOCH FROM (now() - last_bump));

    IF delta_seconds < 86400 THEN
        -- < 24h: already counted this personal day, no-op
        RETURN;
    ELSIF delta_seconds <= 129600 THEN
        -- 24h–36h: extend streak
        UPDATE public.profiles
            SET current_streak = current_streak + 1,
                last_streak_bump_at = now()
            WHERE id = uid;
    ELSE
        -- > 36h: break, reset to 1
        UPDATE public.profiles
            SET current_streak = 1,
                last_streak_bump_at = now()
            WHERE id = uid;
        -- TODO: optional — emit a 'streak_broken' breadcrumb to telemetry
    END IF;
END;
```

Idempotent within the 24h cooldown window. Safe to call on every tickle.

### `regen_secs_for(uid)` extension

```sql
CREATE OR REPLACE FUNCTION public.streak_mod(streak int)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  -- Linear: streak=1 → 1.00, streak=30 → 0.75. Capped beyond 30.
  SELECT GREATEST(0.75, 1.00 - LEAST(streak - 1, 29) * (0.25 / 29));
$$;

-- In regen_secs_for(uid), add a fourth multiplier:
--   * streak_mod(profiles.current_streak)
-- The bump RPC keeps current_streak fresh; no decay-application needed
-- before reading (unlike happiness, streak only changes on bump events).
```

### Push warning at hour 24

A scheduled job (or each successful tickle re-checks) fires a push when a player's `last_streak_bump_at` is between 24h and 36h ago AND they have an active streak (`current_streak ≥ 3` — don't pester brand-new streakers).

Two implementation options:
- **(A) Cron-style:** Supabase cron job runs every hour, queries profiles where `last_streak_bump_at BETWEEN now() - interval '36 hours' AND now() - interval '24 hours' AND current_streak >= 3 AND streak_warning_sent_at < last_streak_bump_at`, sends pushes, marks `streak_warning_sent_at = now()`. Adds a column.
- **(B) Piggyback on existing daily jobs:** if there's already a daily cron (e.g. season roll-over, daily ritual reset), bundle the streak warning there.

Recommend **(A)** — most reliable, doesn't require auditing existing cron jobs. New column `streak_warning_sent_at timestamptz` on profiles.

Push copy (cozy, not threatening):
- Title: `Your pig is wondering where you are…`
- Body: `Tickle Rosie today to keep your garden growing.`
- Payload kind: `streak_warning`, screen: `barn`

---

## UI surfaces

### Barn — the Garden

- Positioned in the Barn ambient layer (same z-layer family as `sunBeam`, particle effects). Anchored beside Rosie, not over her. Picks one corner of the visible Barn frame and lives there.
- Stage swap is a discrete sprite change. No interpolation. Transitions can be a small +1 sparkle when the streak ticks up.
- Empty plot (streak=0) is **visible** but minimal — a bare patch of soil. So a streakless player sees "there's a thing here that should grow."

### Streak break wilt animation

- ~3-second animation: leaves droop / petals fall / the full-bloom state visibly collapses to seedling. Plays once on next Barn open after the break is detected.
- Followed by the seedling stage rendering normally. No tombstone, no lingering grief — TTP's tone is cozy, not punishing.
- A small toast can fire: `Your garden has reset. Time to begin again.` — optional, deferable.

### Push notifications

- 24h warning push, as above.
- No "you broke your streak" notification. The player learns by opening the Barn and seeing the wilt — the visual *is* the consequence.

### Account / Friends / anywhere else

- **No streak surface anywhere except the Barn.** The Garden is intentionally hidden behind the home-screen visit so it remains a discovery instead of a chore.
- Friends viewing your Barn via the Visit screen (#4) see your Garden alongside Rosie — same as your own view. This is a passive flex without an explicit comparison.

---

## Anti-spam + edge cases

- **24h cooldown** between streak credits is the primary anti-spam — can't grind streak by tickling repeatedly.
- **Self-tickle only** — your own `update_profile_and_item_count` calls. Friend visits/tickles via Visit screen (#4) bump *friend's* happiness, not your streak.
- **Time-travel resistance** — `last_streak_bump_at` is `now()` server-side; client cannot manipulate.
- **Profile deletion** — cascades naturally (column is on profiles).
- **VIP / no-VIP** — orthogonal. VIP gets a lower base regen (1800s vs 3600s); streak multiplies on top of that.

---

## Migration phases

### Phase 1 — Schema + multiplier (silent)

- Add columns `current_streak`, `last_streak_bump_at`, `streak_warning_sent_at`.
- Add `streak_mod(streak int)` function.
- Add `apply_streak_bump(uid)` helper.
- Hook into `update_profile_and_item_count` alongside the `last_active_date` bump.
- Extend `regen_secs_for(uid)` to multiply by `streak_mod(current_streak)`.

At rollout, all players have `current_streak = 0` → `streak_mod(0)` returns `max(0.75, 1.00 - (-1) * 0.0086) = 1.0086×` if we don't special-case zero. **Special-case**: `streak_mod(0) = 1.00` (no penalty, no boost). Players climb from there on their next tickle.

### Phase 2 — Garden visual

- Commission 5 sprites + 1 wilt animation frameset.
- Add `Garden` component, integrate into Barn ambient layer.
- Stage thresholds match the table above.

### Phase 3 — Push warning

- Add `streak_warning_sent_at` column.
- Cron job (hourly): query for at-risk streakers, send pushes, mark sent.
- Pushes route to Barn screen via existing notification handler.

### Phase 4 (later) — Friend-visibility on the Visit screen

- Visit screen (feature #4) renders the host's Garden alongside their pig. No additional logic; visual reuse.

---

## Tests

- **`__tests__/streak.test.ts`** — pure helper:
  - `streak_mod(streak)` boundary values: 0 → 1.00 (special case), 1 → 1.00, 7 → ~0.948, 14 → ~0.888, 30 → 0.75, 100 → 0.75.
  - Curve linearity check (slope between any two adjacent days is constant in the 1–30 range).
- **SQL (pgTAP or manual)**:
  - `apply_streak_bump` idempotency within 24h window.
  - 24–36h window correctly increments.
  - >36h correctly resets to 1.
  - `last_streak_bump_at IS NULL` initial-state path.
  - `current_streak` clamps semantics — should never go negative; should not have a max cap (`streak_mod` caps the multiplier, not the underlying number).
- **Manual / TestFlight**:
  - Confirm Sentry breadcrumb `[streak] bumped from N to N+1` fires once per credit.
  - Confirm Barn Garden swaps stage on first credit crossing a boundary.
  - Confirm push notification fires at hour 24 for an at-risk streaker (>= 3 days). Defer until Phase 3.

---

## Heads-up

- **The push warning is load-bearing.** Without it, the no-number display means players have no precise way to know "my streak breaks in 4 hours." Phase 3 is not optional polish — it's part of the system. Ship Phase 1+2 silently, then Phase 3 makes the design promise complete.
- **Garden art is the gating cost.** 5 sprite stages + 1 wilt sequence. The ChatGPT cosmetic pipeline used elsewhere applies; budget a session of art work. Defer naming the metaphor (flower? bonsai? hay?) to art-time — it should be picked alongside whatever else lands on the Barn between now and ship.
- **Habitat-building conflict.** Item #6 on the original notes (room/habitat decoration, Club-Penguin-style) will eventually claim broad Barn real-estate. Garden lives in a fixed ambient corner — pick a corner habitat features won't want to override. If habitat ships later and conflicts, Garden migrates; reserve the cost.
- **Tuning knob.** 0.75× cap is the starting point. Audit after 2–4 weeks of public-build data: are players reaching day 30? Does the all-buffs ceiling feel broken or balanced? Single function-body change to retune; no migration.
- **VIP composition is unchanged.** Streak multiplies on top of the VIP regen (1800s vs 3600s base). A VIP at day 30 + max happiness lands at `1800 × 0.7 × 0.75 = 945s` per tickle — ~16 min. Same compounding logic, same floor protection.
