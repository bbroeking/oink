# Mud Putt (Daily Pin)
> Every pig putts the same mud green today — sink Rosie's ball in the fewest swings and top your Sounder's leaderboard before the green washes away at midnight.

**Tier:** Mini-game · **Effort:** L · **Mode:** shared-seed daily leaderboard (async, server-authoritative re-sim) · **Depends on:** nothing hard-blocking — standalone, but ideally ships *after* Snout Oracle + Slopword have proven the entry/faucet/notify spine. Reuses shipped primitives only.

## The fantasy
You're a pig lining up a putt on today's one-and-only mud green. The whole Sounder is squinting at the *same* slope, the *same* gusty wind, the *same* pin — so a clean two-stroke sink isn't luck, it's a read you nailed that your friends didn't. It's the cozy daily-ritual itch of Wordle (one shared board, one shot at glory, resets at midnight) wearing mini-golf's "ohhh, so close" drama. No timer pressure, no opponent to react to — just you, the green, and the quiet satisfaction of a perfect line.

## Player loop
**Daily (the core action):**
1. Open the Mud Putt card (on the Barn/play surface). It shows today's seeded green — pin position, slope arrows, wind flag, and **par** — plus a live `shop_resets_in_seconds()`-style countdown to the next green.
2. Pay the entry: a small **SNOUT** sink (`profiles.counter`, default **5 snouts**), debited atomically the same way `bury_truffle()` charges. One ranked round per UTC day.
3. Take up to **4 swings**. Each swing is a drag-to-aim + power gesture; the client runs a *local preview* sim so the ball rolls on screen (juice/feel only — the number it produces is thrown away).
4. The ball either sinks or you run out of swings. The client submits **only the ordered list of `(angle, power)` scalars** it actually used (≤4 pairs) — never the resulting stroke count or ball positions.
5. Server re-runs the deterministic putt integrator on the *same seeded green*, derives the true stroke count (or "didn't sink → par+penalty"), writes the score, and pays a **tickle faucet** placement reward.
6. The leaderboard (Sounder-scoped + global) shows fewest strokes, tiebroken by earliest submit time. An emoji result line ("⛳️ Mud Putt — 🐽⛳️ in 2 (–1)") drops into the feed so friends can compare.

**Weekly / seasonal nesting:**
- A rolling **7-day "Pin Streak"**: playing the daily round on N consecutive days feeds the existing `streak`/Devotion loyalty axis (first-of-day round calls `grant_season_xp(caller, 5)`, same +5-XP-first-of-day idiom as the social RPCs).
- **Course of the Week** flavor: the 7 seeded greens of a UTC week share a cosmetic biome theme (pasture → beach → forest, reusing the background catalog), giving a soft "did you play all 7?" completion pull without new content cost.
- No season-defining stakes of its own — Mud Putt is a *daily-ritual + flex* mode, not a finale driver. It composes upward (see How it composes) rather than carrying meta-weight.

## Mechanics

**The green (server-seeded, identical for everyone):**
- `seed := abs(hashtext('mudputt' || current_date::text))` — the exact `daily_shop()` idiom, salted with a mode tag so it doesn't collide with the shop's seed.
- From `seed`, deterministic helpers derive: pin `(px, py)`, tee `(tx, ty)`, **slope vector** `(sx, sy)` (a constant acceleration on the green, magnitude bucketed to ~3 tiers), **wind** (small lateral acceleration, off most days), **par** (2 or 3), and 0–2 **bumpers/sand patches** (axis-aligned rects). All bounded to a fixed table of "fair" ranges so no day is unsolvable.
- A **known best-possible-strokes floor** is computed server-side per green (cheapest: brute-force a coarse grid of `(angle,power)` first-shots through the integrator at seed-gen time, cache the minimum into the day row). Any submission claiming fewer strokes than the floor is rejected as impossible.

**The putt integrator (the shared truth):**
- Pure, deterministic, fixed-timestep (e.g. `dt = 1/60`, hard cap **600 steps** per shot). Per step: `v += (slope + wind) * dt`; `pos += v * dt`; apply linear+rolling **friction** `v *= 0.985`; reflect off course walls and bumpers; stop when `|v| < epsilon` or steps exhausted.
- A shot **sinks** if the ball passes within `pin_radius` of the pin during its roll.
- Implemented **once** in plpgsql (or a SQL-callable helper) and mirrored byte-faithfully in TS for the client preview. The TS preview is cosmetic; the plpgsql pass is authoritative.
- **Inputs are bounded scalars, not an input log**: `angle ∈ [0, 360)` (clamped/rejected outside), `power ∈ [0, 1]` (rejected outside). Each shot is one stable forward pass — there is no per-frame client input to replay, which is exactly what keeps this tier (b) and not the fragile tier (c).

**Scoring:**
- `strokes` = number of `(angle,power)` pairs the server simulated until the ball sank.
- If the ball never sinks within 4 swings: `strokes := par + 2` (a "picked up" penalty score) so a whiffed round still ranks but always below anyone who sank.
- Leaderboard sort: `strokes ASC, submitted_at ASC` (earliest submit wins ties — rewards playing, not waiting).
- `relative := strokes - par` for the cozy "–1 / E / +1" display.

**Caps / cooldowns / edges:**
- **One ranked round per UTC day**, enforced by a unique index `(user_id, putt_date)` on the rounds table (the `one_ritual_per_day` idiom). A second submit returns `already_played`.
- Entry charged **before** simulation; if the client submits 0 pairs or malformed scalars, reject with `bad_input` and **refund the entry** (don't strand the snouts).
- Submitting >4 pairs → reject `too_many_swings` (refund). Out-of-range scalar → reject `bad_input` (refund).
- Server-claimed strokes < day's `best_floor` → reject `impossible` (refund + flag for anomaly review).
- Mid-day green is immutable; if a player has the card open across UTC midnight, the client re-fetches and the stale local round is discarded before submit (server rejects a submit whose `putt_date` ≠ current UTC date).

## Schema sketch
Clones the `daily_shop()` seed idiom + the `bury_truffle()` snout-sink + the `grant_tickles()` faucet + the `wasted_tickles_leaderboard()` read shape. New migration filename must sort **after** `20260623000000` — e.g. `20260624000000_mud_putt.sql`.

```
-- One immutable row per UTC day: the seed + the precomputed fairness floor.
-- Lazily inserted on first play of the day (no cron), exactly like daily_lucky_state.
CREATE TABLE public.mud_putt_days (
  putt_date    date PRIMARY KEY,          -- UTC date
  seed         bigint NOT NULL,           -- abs(hashtext('mudputt'||putt_date))
  par          smallint NOT NULL,
  best_floor   smallint NOT NULL,         -- min achievable strokes (anti-cheat clamp)
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One ranked round per player per day. swings stored for audit/replay-display only.
CREATE TABLE public.mud_putt_rounds (
  id           bigserial PRIMARY KEY,
  putt_date    date NOT NULL REFERENCES public.mud_putt_days(putt_date),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strokes      smallint NOT NULL,         -- server-derived, authoritative
  swings       jsonb NOT NULL,            -- the ≤4 (angle,power) pairs the client sent
  reward       int NOT NULL DEFAULT 0,    -- tickles granted
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mud_putt_one_per_day ON public.mud_putt_rounds (user_id, putt_date);

ALTER TABLE public.mud_putt_days   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mud_putt_rounds ENABLE ROW LEVEL SECURITY;
-- Read-only to clients (so the leaderboard + "you've played" render); writes go
-- only through SECURITY DEFINER RPCs (the truffles RLS pattern).
CREATE POLICY mud_putt_days_read   ON public.mud_putt_days   FOR SELECT TO authenticated USING (true);
CREATE POLICY mud_putt_rounds_read ON public.mud_putt_rounds FOR SELECT TO authenticated USING (true);
```

**RPCs** (all `SECURITY DEFINER SET search_path TO 'public'`, returning `jsonb {ok,...}` like `bury_truffle`):

```
mud_putt_today()                          -> jsonb   -- lazily upsert today's day row; return
                                                     -- {seed, par, reset_in_seconds, played:boolean, my_strokes?}.
                                                     -- Clones daily_shop() seed + shop_resets_in_seconds().

submit_mud_putt(p_swings jsonb)           -> jsonb   -- the whole loop, ONE transaction:
                                                     --   1. auth + already-played guard (unique index)
                                                     --   2. validate ≤4 pairs, scalars in range  (else bad_input + no charge)
                                                     --   3. charge entry: UPDATE profiles SET counter=counter-5
                                                     --        WHERE id=caller AND counter>=5 RETURNING (bury_truffle charge)
                                                     --   4. re-run integrator on (seed) over the pairs -> true strokes
                                                     --   5. reject if strokes < best_floor (impossible) -> refund
                                                     --   6. INSERT round; reward := payout(strokes,par); grant_tickles(caller,reward)
                                                     --   7. first-of-day? grant_season_xp(caller, 5)
                                                     --   8. INLINE INSERT into system_announcements (feed drop) -- NEVER send_system_announcement
                                                     --   RETURN {ok, strokes, par, reward, rank?}

mud_putt_leaderboard(p_scope text DEFAULT 'global', limit_n int DEFAULT 50)
                                          -> TABLE(username text, strokes smallint, submitted_at timestamptz)
                                                     -- p_scope 'global' | 'sounder' (friends via getFriendIds/are_friends()).
                                                     -- ORDER BY strokes ASC, submitted_at ASC. wasted_tickles_leaderboard() shape.

-- Internal helper (not granted to clients): the deterministic integrator.
mud_putt_simulate(p_seed bigint, p_swings jsonb) -> smallint   -- pure, returns strokes.
```

Client: a typed wrapper file `utils/mudPutt.ts` around `rpc<T>()` (the `utils/activeEffects.ts` / `utils/friendships.ts` deepening pattern), and one `components/MudPuttCard.tsx` (green canvas + drag-aim + countdown + leaderboard sheet). The local preview integrator lives in `utils/mudPuttSim.ts`, unit-tested against fixed seeds and kept byte-faithful to the plpgsql `mud_putt_simulate`.

## Economy
- **Snout sink:** the **5-snout entry** per round leaves the closed economy via `profiles.counter` debit — pure sink, never minted, identical mechanics to `bury_truffle()`'s 20-snout charge. With one round/day this is a gentle, predictable daily drain that helps offset faucets elsewhere.
- **Tickle faucet (placement reward):** payout is a small, **bounded function of strokes vs par**, granted through `grant_tickles()` (the only over-cap-safe faucet). Suggested table: sink in 1 → **5 tickles**, in 2 → **3**, par → **2**, over par → **1**, whiffed → **0**. Capped so a perfect day pays ≤5 — a cozy nudge, not a grind income. Because this is the kind of small daily faucet flagged in the `settle_tickles` header, the **first display surfaces** (`home_stats`, `admin_tickle_overview`) must ship the `GREATEST(item_count, LEAST(cap, …))` over-cap fix here if Slopword hasn't already paid that debt.
- **Cosmetic rewards (no inflation):** a weekly/seasonal **"Hole-in-Two" cosmetic** — e.g. a Mud Putt visor hat or a Barn pennant for a 1-stroke sink, or a 7-day Pin Streak — minted as `user_hats` ownership rows, not currency. Cosmetics are the durable reward; tickles are the trickle.
- **Why it can't inflate:** snouts only ever *move* `counter→counter` or get *debited* (entry sink); they're never minted by this mode. Tickles are minted only via `grant_tickles()` with a hard per-round cap (≤5) gated by the one-round-per-day unique index, so the maximum daily faucet per player is fixed and tiny. Cosmetics are non-fungible ownership rows with no resale path.

## Anti-abuse / cheat model
**Cheat tier (b) shared-seed, hardened toward (a) server-owns-answer.**
- **The server owns the green and the math.** The board is `seed`-derived identically for everyone; the client never sends a score, only ≤4 bounded `(angle,power)` scalars. The authoritative stroke count comes from the server re-running `mud_putt_simulate` — the client's number is discarded. A cheater editing memory to "say 1 stroke" changes nothing; only legal scalars that *actually* sink in the server's sim count.
- **Not input-replay (avoids fragile tier c).** Each shot is a *single bounded scalar pair* fed through *one* stable forward integration with a hard step cap — there's no per-frame input stream to desync or exploit. Determinism is over a handful of doubles, not a long replay log.
- **Plausibility floor.** Each day caches a `best_floor` (cheapest achievable strokes via a coarse grid search at seed-gen time). Submissions claiming `strokes < best_floor` are impossible and rejected + flagged.
- **One round/day** via the `(user_id, putt_date)` unique index (`one_ritual_per_day` idiom) — no farming the faucet by replaying.
- **Charge-then-validate ordering** mirrors `bury_truffle`'s hardening: the unique-index guard and entry charge happen atomically in one transaction; malformed/impossible submits refund cleanly with no double-charge, no stranded snouts, no 500.
- **No collusion/vote surface:** there's no PvP payout, no voting, no opponent — the leaderboard is read-only flex. The only economic output is the capped solo faucet + the conserved snout sink, so there's nothing to game by colluding.
- **Float determinism caveat:** the plpgsql and TS integrators must agree on rounding. Mitigation: integrators operate on integer/fixed-point coordinates internally (scale by 1000) and the *client preview never decides the score* — only the server pass does — so any tiny drift is purely cosmetic, never a scoring discrepancy.

## Feel
- **Earned mastery (primary):** the same shared green every day means a good score is *demonstrably* skill — reading the slope and wind that beat your friends. Repeat play teaches the integrator's feel; the "I finally two-putted the windy beach hole" moment is pure RuneScape-grind-paid-off.
- **Belonging / hangout:** Sounder-scoped leaderboard + the emoji result line in the feed turn it into the Wordle water-cooler — async bragging, not live competition. "Jen sank it in 1?! how" is the hook.
- **Slow time / persistent-world FOMO:** one green, gone at UTC midnight, never repeats — the cozy-pressure of a daily ritual you don't want to miss, but with zero twitch stress.
- **Quirky charm:** mud, a pig in a tiny visor, a slope made of hoof-churned muck, "you picked up your ball (+2)" — pig-flavored mini-golf is inherently silly-cozy.
- **Cozy guardrail:** no countdown clock *within* a round, no loss of progress, no PvP sting — the worst outcome is a +2 and a 0-tickle day. The stakes are bragging and a 1–5 tickle trickle, never punishment.

## How it composes
- **Schism Front meta-frame:** Mud Putt is one of the cozy daily "skill greens" the Front can dress up — e.g. a week's greens themed to a faction's biome, or a Front event where the *aggregate* Sounder stroke-average nudges a shared bar. It stays alignment-neutral by default (a hangout, not a battlefield), which is the right texture variety alongside the more pointed pick'em/duel modes.
- **The harness it establishes:** Mud Putt is explicitly the **seed + submit-tiny-input + server-re-sim** reference implementation. Once `mud_putt_simulate` + the day-row/round-row pattern exist, **Slop Lob** (one daily arc, one forward-sim), **Sky-Sow Landing** (daily precision lander, server caps at seed optimum), and **The Great Hog Hurl** (`distance(seed, choices)`) all clone the same three pieces — day table, round table with unique-per-day index, and a pure server integrator returning a scalar score. **Acorn Arc** (async duel) later salts the same seed idiom per-match and reuses the integrator for closest-to-pin settlement.
- **Feeds the faucet ecosystem:** shares `grant_tickles()`, `grant_season_xp()` first-of-day, the Sounder leaderboard scoping, and the INLINE-announcement feed drop with Slopword and Snout Oracle — so the play surface accumulates a coherent "daily things to do" rail rather than one-off modes.

## MVP
Smallest shippable seed — **one migration, three RPCs, one component**:
1. **Migration `20260624000000_mud_putt.sql`:** the two tables + RLS, `mud_putt_simulate` (the integrator), `mud_putt_today`, `submit_mud_putt`, `mud_putt_leaderboard`. Start with the *simplest fair green*: slope only (no wind, no bumpers), par 2, and a coarse-grid `best_floor`. This alone proves the full seed→submit→re-sim→faucet→leaderboard spine.
2. **`utils/mudPuttSim.ts` + `utils/mudPutt.ts`:** the byte-faithful TS preview integrator (unit-tested vs fixed seeds) and typed `rpc<T>()` wrappers.
3. **`components/MudPuttCard.tsx`:** green canvas, drag-aim+power, local roll preview, submit, and a leaderboard bottom sheet with a global/Sounder toggle.
Defer wind, bumpers, biome themes, the Hole-in-Two cosmetic, and the Pin Streak weekly until the core loop is fun. Ship it free-entry first (drop the 5-snout sink) to validate feel, then add the sink.

## Risks & open questions
- **Float determinism is the real cost.** Keeping the plpgsql and TS integrators in lockstep is the L-effort core. Mitigation (integer/fixed-point internals + server-only scoring) makes drift cosmetic, but it needs a shared fixed-seed test vector both sides assert against — budget real time here.
- **Content cadence (solo-dev):** a procedurally-seeded green is *infinite* content for free (the whole point), but the *fairness* of each day rides on the `best_floor` brute-force and the bounded range table. A badly-bounded range could ship an unfun/unsolvable day. Open question: how coarse can the grid search be before `best_floor` is wrong?
- **Tuning the fun:** is 4 swings + par 2–3 the right difficulty for a cozy daily? Too easy → everyone ties at par and the leaderboard is flat; too hard → frustrating. Needs playtest iteration on the range table.
- **Leaderboard ties:** earliest-submit tiebreak rewards timezone-luck (UTC-midnight players). Acceptable for a flex board, but worth watching if it feels unfair to friend groups across timezones.
- **Open question — entry sink vs free ritual:** Slopword is free (it's the viral hook); does charging 5 snouts for Mud Putt suppress the daily-ritual habit we want? Lean: ship free, add the sink only if the faucet needs a counterweight.
- **Open question — does it need PvP at all?** The spec keeps it solo-flex on purpose; if the Sounder leaderboard feels lonely, the upgrade path is Acorn Arc (the async duel), *not* bolting live competition onto this (which would break the cheat model and the cozy guardrail).