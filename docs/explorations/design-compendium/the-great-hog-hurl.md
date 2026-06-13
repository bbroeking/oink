# The Great Hog Hurl
> Strap Rosie to the Slop-Rocket, pick your launch, and see how far a pig can fly — one glorious hurl a day.

**Tier:** Mini-game · **Effort:** M · **Mode:** async shared-seed daily leaderboard + pari-mutuel pot (cheat tier (b)→(a)) · **Depends on:** `daily_shop()` date-seed (shipped), `grant_tickles()`/`settle_tickles()` over-cap faucet (shipped, `20260580000000_settle_tickles.sql`), the `bury_truffle`/`dig_truffle` depleting-pot + `truffle_digs` PK-ledger pattern (shipped, `20260610000000_truffle_shared_pot.sql`), the `counter->counter` snout transfer idiom, INLINE `system_announcements` INSERT, the `one_ritual_per_day` unique-index cooldown idiom (`20260534000000`), and a `user_hats`-style ownership table (`20260501210000`). The co-op/duel/pick'em spawns assume `distance()` exists but are NOT prerequisites.

## The fantasy
You are a backyard rocket engineer who has, with great affection and zero ethics, bolted a slop-fueled rocket to a pig. Every morning you get exactly one shot to fling Rosie across the seeded sky of the day — read the gusts, time the pre-charge, place your snort-boosts, and watch her arc toward the horizon. Between hurls you sink snouts into the **Slop-Rocket** upgrade tree, the numbers-go-up treadmill that makes tomorrow's launch reach farther. It is the cozy launcher fantasy: the daily ritual is small, the dopamine of "I went FARTHER than yesterday" is the hook, and the leaderboard is the bragging wall.

## Player loop
- **Daily (the hurl):** Once per UTC day a shared seed (derived exactly like `daily_shop()`: `abs(hashtext('hoghurl' || current_date))`) fixes today's launch conditions for everyone — ramp angle bands, a gust profile, and a bounce-pad map. The player pays a fixed snout buy-in, then assembles a small **discrete choice vector**: launch angle (1-of-8), pre-charge timing (1-of-3: early/perfect/late), and the placement of up to 3 "snort-boost" pads on a 1-of-N track grid. They submit ONLY that vector. The server computes `distance(seed, choices, tiers)` and records it. First hurl of the day awards `grant_season_xp(+5)` (the established first-of-day idiom).
- **Resolve (lazy, at lock):** When the daily round's `lock_at` passes (next UTC midnight), the next player to touch the round triggers a lazy settle (no cron — same lazy-resolve pattern the Oracle/drives use). Distances are ranked; the pari-mutuel pot is split among the top ~25% of hurlers (`counter->counter`, no mint). Everyone who hurled but missed the cut gets a small `grant_tickles` consolation (banded by percentile). A settle notification is INLINE-inserted into `system_announcements`.
- **Between hurls (the treadmill):** Spend snouts on **Slop-Rocket Upgrade tiers** — server-owned, capped stat ladders (ramp power, gust resistance, bounce elasticity, extra snort-boost slot). This is the meta-progression sink; higher tiers raise the closed-form distance ceiling, so the daily "go farther" feeling compounds across weeks.
- **Weekly/seasonal stakes:** The leaderboard resets are daily, but cumulative best-distance and total-pot-winnings feed the season. Once `distance()` exists it spawns three cheap recombinations (see *How it composes*): a co-op **Slop-Slide** distance bar, a 1v1 **Hurl-Off** async duel, and a **Call-the-Hurl** pick'em.

## Mechanics
- **The seed.** `v_seed := abs(hashtext('hoghurl' || current_date))` inside a `SECURITY DEFINER` RPC. From `v_seed` the server derives (all server-side, never sent raw): ramp-angle band offsets, a gust vector array (8 segments, signed), and a bounce-pad map (positions + elasticity). The same `current_date::text` seed idiom as `daily_shop()` — re-derivable, identical for all players, never trusted from the client.
- **The choice vector (the ONLY client input).** A small JSONB: `{ "angle": 0..7, "charge": 0..2, "boosts": [int, ...] }` where `boosts` is ≤ (3 + bonus-slot-tier) distinct track indices in `0..N-1`. Anything out of range → rejected (`invalid_vector`). No trajectory, no per-frame data, no client-computed distance ever crosses the wire.
- **`distance()` is a pure CLOSED-FORM server function — NEVER a replayed bounce chain.** This is the load-bearing cheat decision (tier b→a). The server does NOT step-simulate a bounce physics loop (that is the fragile tier-(c) input-replay the exploration doc explicitly forbids — "the fragile bounce-chain is never replayed"). Instead `distance(seed, choices, tiers)` evaluates a deterministic closed-form expression: base launch from `angle`×`charge`-multiplier, plus the dot product of the boost placements against the seeded bounce-pad gains, minus the gust-resistance-adjusted gust drag, all scaled by the upgrade-tier coefficients and clamped to a per-`(seed, tier)` ceiling. Pure arithmetic, one pass, no iteration over a bounce trajectory. The client may animate a pretty bounce for feel, but it is cosmetic — the number is the server's.
- **Scoring + payout.** After `lock_at`, rank distances DESC, tiebreak by earliest `hurled_at`. Pari-mutuel pot = `SUM(buy_in)` of all entrants. Top quartile splits the pot proportionally to a placement weight (1st gets the largest slice; ties split evenly), paid `counter->counter` with `floor()` (dust stays in the conserved economy). Non-winners get `grant_tickles` consolation banded ~`{ top50%: 15, top75%: 8, rest: 3 }` — a rounding error vs the home loop, over-cap-safe.
- **Caps / cooldown.** Exactly one hurl per UTC day enforced by a **unique `(user_id, hurl_date)` index** (the `one_ritual_per_day` idiom). Buy-in is a fixed snout cost (suggested 20, mirroring `bury_truffle`'s `cost := 20`). Upgrade tiers are clamped on purchase (`LEAST(tier+1, max_tier)` — the blessing-cap clamp idiom from `20260614000000`), so no tier can exceed its server-defined ceiling.
- **Edge cases.** No hurl before lock → no payout, no consolation (must have entered). Double-tap / two-device race on the hurl → caught by the unique index (`already_hurled`, no charge — claim-slot-then-charge ordering, exactly like the hardened `bury_truffle` in `20260594000000`). Buy-in atomic `UPDATE ... WHERE counter >= cost RETURNING` so a too-poor player is rejected cleanly (`too_poor`). Settle is idempotent: an atomic `UPDATE rounds SET settled_at = now() WHERE settled_at IS NULL RETURNING` guards against double-payout (the `dig_truffle` `FOR UPDATE` race generalized). Empty round (1 entrant) → that entrant reclaims their own buy-in (no-op transfer), economy conserved.

## Schema sketch
Clones the depleting-pot + per-actor-ledger shape of Buried Truffle, the date-seed of `daily_shop()`, and the `user_hats` ownership shape for upgrades.

```
-- Daily round: one row per UTC day. Holds the pot + lazy-settle guard.
-- (Clones the truffles "active pot, lazily resolved" shape.)
CREATE TABLE public.hog_hurl_rounds (
  hurl_date   date        PRIMARY KEY DEFAULT current_date,
  pot         int         NOT NULL DEFAULT 0,   -- accumulated buy-ins (counter->counter escrow conceptually)
  lock_at     timestamptz NOT NULL,             -- next UTC midnight
  settled_at  timestamptz,                      -- NULL until lazy-settled (idempotency guard)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Per-hurler ledger: ONE hurl per player per day (unique index = one_ritual_per_day idiom).
-- distance is the SERVER's number; client_vector kept only for audit/anti-abuse.
CREATE TABLE public.hog_hurls (
  hurl_date   date        NOT NULL REFERENCES public.hog_hurl_rounds(hurl_date) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  distance    int         NOT NULL,             -- server-computed distance()
  client_vector jsonb     NOT NULL,             -- {angle,charge,boosts} for audit
  buy_in      int         NOT NULL,
  payout      int         NOT NULL DEFAULT 0,   -- set at settle
  hurled_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hurl_date, user_id)              -- == one hurl/day, race-safe
);
ALTER TABLE public.hog_hurls ENABLE ROW LEVEL SECURITY;
-- read-own; all writes via SECURITY DEFINER RPCs (the truffle_digs RLS pattern)

-- Server-owned upgrade tiers (clones user_hats ownership; clamped on buy).
CREATE TABLE public.hog_rocket_upgrades (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ramp_tier   int         NOT NULL DEFAULT 0,
  gust_tier   int         NOT NULL DEFAULT 0,
  bounce_tier int         NOT NULL DEFAULT 0,
  slot_tier   int         NOT NULL DEFAULT 0,   -- extra snort-boost slots
  PRIMARY KEY (user_id)
);
```

RPC signatures (all `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE ... TO authenticated` except `distance`/settle internals):

- `hog_hurl_conditions() -> jsonb` — STABLE; returns today's seeded display data (ramp bands, gust profile, bounce-pad map) + the caller's current upgrade tiers + whether they've hurled today + `lock_at` countdown. Read-only board fetch. *Clones `daily_shop()` + `shop_resets_in_seconds()`.*
- `distance(p_seed bigint, p_choices jsonb, p_ramp int, p_gust int, p_bounce int, p_slot int) -> int` — IMMUTABLE, NOT granted to clients (internal). The pure closed-form. *No shipped clone — this is the new primitive; everything downstream inherits it.*
- `submit_hurl(p_choices jsonb) -> jsonb` — validates vector range, claims the `(hurl_date,user_id)` slot FIRST (catch `unique_violation` → `already_hurled`), THEN charges buy-in atomically (`UPDATE profiles SET counter = counter - cost WHERE counter >= cost RETURNING`; undo slot on `too_poor`), computes `distance()` server-side, records it, bumps `pot`, awards first-of-day `grant_season_xp(+5)`. Returns `{ok, distance, balance, lock_at}`. *Clones the hardened `bury_truffle` claim-then-charge ordering.*
- `settle_hog_hurl(p_date date DEFAULT current_date) -> jsonb` — lazy, idempotent (`UPDATE ... SET settled_at = now() WHERE settled_at IS NULL RETURNING` guard). Ranks distances, splits pot to top quartile `counter->counter`, `grant_tickles` consolation to the rest, INLINE-inserts a `system_announcements` settle notify per payee. Triggered opportunistically when a player loads conditions after `lock_at`. *Clones the lazy-resolve + `dig_truffle` `FOR UPDATE` no-double-payout race.*
- `buy_rocket_upgrade(p_track text) -> jsonb` — debits snouts, bumps the named tier with `LEAST(tier+1, max_tier)` clamp. Returns `{ok, track, new_tier, balance}`. *Clones the blessing-cap clamp idiom + snout sink.*
- `hog_hurl_leaderboard(limit_n int DEFAULT 50) -> TABLE(username text, distance int, payout int)` — STABLE; today's ranked board (and/or all-time best). *Clones the `wasted_tickles_leaderboard` SQL shape.*

## Economy
- **Snout sinks (deflationary):** the daily buy-in (escrowed into a zero-sum pari-mutuel pot, redistributed `counter->counter` so `SUM(counter)` is conserved modulo `floor()` dust) AND the Slop-Rocket upgrade purchases (snouts debited, NOT minted anywhere — a pure sink, the numbers-go-up treadmill). Upgrades are the deeper sink: they never pay out snouts, only raise the closed-form distance ceiling.
- **Tickle faucet (bounded, over-cap-safe):** the consolation `grant_tickles` (banded ~3–15) is the ONLY mint, and it routes through `grant_tickles`/`settle_tickles` — the only over-cap-safe faucet — so it preserves over-cap balances and banks wasted tickles. Because this is among the first real over-cap faucets, it MUST ship alongside the `GREATEST(...)` display-debt fix to `home_stats` + `admin_tickle_overview` (the `settle_tickles` header flags this; if the Daily Riddle already shipped it, this rides on it).
- **Why it can't inflate:** the pot is a closed-loop transfer (zero-sum). Upgrades are a one-way snout drain. The faucet is a bounded daily trickle (a rounding error vs the core tickling loop). No tradable hard currency is introduced; snouts move as a `counter` transfer, never created. The upgrade treadmill specifically absorbs the snout surplus that pari-mutuel winners accumulate, closing the loop.

## Anti-abuse / cheat model
- **Cheat tier (b)→(a): server owns the answer.** Conditions are date-seeded and re-derived server-side from `abs(hashtext('hoghurl'||current_date))`; the client submits only a tiny discrete choice vector; `distance()` is a pure server function. There is nothing the client computes that the server trusts.
- **The bounce chain is NEVER replayed** — `distance()` is closed-form, not a step-integrated trajectory, so the fragile tier-(c) input-log replay surface (memory-edit / spoofed-bounce cheats) is structurally absent. The server computes the ceiling for `(seed, tier)` directly.
- **Vector validation:** out-of-range angle/charge/boost indices, duplicate boost slots, or more boosts than `3 + slot_tier` are rejected. The recorded `client_vector` is audit-only; the distance is recomputed, never read from the client.
- **Upgrade tiers are server-owned** (in `hog_rocket_upgrades`, written only by `buy_rocket_upgrade`), clamped on every buy — a client cannot claim a tier it didn't pay for, and `distance()` reads tiers from the table, not the request.
- **One hurl/day** via the `(hurl_date, user_id)` PK/unique index; double-tap and two-device races resolve to `already_hurled` with no charge (claim-slot-before-charge ordering).
- **Settle is idempotent and race-safe** (`settled_at IS NULL` atomic guard + `FOR UPDATE` pot lock), so a flurry of post-lock loads can't double-pay the pot.
- **No collusion surface:** there is no voting, no peer scoring, no shared mutable state a ring can game — distance is a private function of (public seed, private vector, private paid-for tiers). The only "advantage" is buying more upgrades, which is a sanctioned snout sink.

## Feel
- **Earned mastery + slow time:** the upgrade treadmill makes "I went farther than yesterday" a real, compounding arc across weeks; you cannot rush it (one hurl/day), which is the cozy guardrail — a single small ritual, not a grind.
- **Persistent-world FOMO:** the daily seed expires; miss a day and that exact sky is gone forever, and the pot settles whether you logged in or not.
- **Quirky charm:** a pig on a slop-rocket is peak TTP tone — the animation is pure delight, the consolation framing ("Rosie bounced off a hay bale and you still got 8 tickles") keeps losing cozy, not punishing.
- **Belonging + emergent drama (post-spawn):** once the Hurl-Off duel and Call-the-Hurl pick'em exist, the leaderboard becomes a Sounder-scoped bragging wall and the daily "who flew farthest" becomes a shared story.
- **Cozy guardrail:** no leaderboard shaming, no streak-pressure beyond the existing first-of-day XP; the worst daily outcome is a small tickle consolation and a funny bounce, never a loss that stings.

## How it composes
- **Schism Front meta-frame:** the Hurl is an isolated competitive loop today, but per the Front synthesis (`docs/explorations/2026-06-08-longterm-living-game.md`) any mode can gain season-scale consequence by tipping the Tide at the `shift_alignment` chokepoint. Cleanest wiring: a daily Hurl winner injects a small one-time Tide bonus to their alignment side (the same "your style victory tilts the schism" hook the Pageant uses), so flinging a pig far becomes a contribution to the cosmic tug-of-war. The Call-the-Hurl pick'em can also gain front-resolvable questions ("does anyone clear the seeded ceiling this week?").
- **Spawns three cheap recombinations once `distance()` exists** (the reason this mode is worth building):
  - **Co-op Slop-Slide bar** — a weekly shared-goal distance bar (trough/`item_drives` shape): every hurl's distance adds to a Sounder-wide total that unlocks a cosmetic at a threshold.
  - **Hurl-Off async duel** — two friends hurl the SAME match-salted seed, server settles farthest-wins, snout pot escrowed (the Acorn Arc duel plumbing, reusing `distance()` instead of an arc sim).
  - **Call-the-Hurl pick'em** — a Snout Oracle card on the daily Hurl ("will the top distance beat X?"), pari-mutuel, cheat-proof tier (a).
- **Reuses the Mud Putt harness:** if the shared-seed daily high-score (Mud Putt) ships first, the Hurl inherits its seed + submit-tiny-input + server-recompute scaffolding directly.

## MVP
The smallest shippable seed is the **solo daily Hurl with a 2-axis vector and no pot** — prove `distance()` and the daily ritual before adding the economy:
- **One migration** (`>= 20260624000000_hog_hurl.sql`): the three tables, `hog_hurl_conditions()`, `distance()` (closed-form), `submit_hurl()` (charge buy-in, record distance, first-of-day XP, `grant_tickles` flat consolation, INLINE settle notify), and `hog_hurl_leaderboard()`. Defer the pari-mutuel pot split and `buy_rocket_upgrade` to v1.1 — ship `distance()` reading hardcoded tier-0 coefficients first.
- **One component** (`components/HogHurlCard.tsx`): the angle/charge picker, a "HURL!" button, the cosmetic bounce animation, and the leaderboard readout — built on the existing card/modal patterns.
- **First over-cap faucet caveat:** ship the `GREATEST(...)` display-debt fix to `home_stats` + `admin_tickle_overview` in this migration if it hasn't already shipped on an earlier faucet.

## Risks & open questions
- **Closed-form vs. felt skill (the central design tension):** a pure closed-form `distance()` is cheat-proof but risks feeling like the choices don't matter / are solvable. Mitigation: make the seeded gust + bounce-pad map genuinely reward reading the conditions, and tune coefficients so there's a non-obvious optimum each day. Open question: how much does the optimal vector vary day-to-day — if it's always "angle 4, charge perfect, boost the three highest pads," it's solved and dead.
- **Solo-dev content cadence:** the daily seed is free (no cron, no authored content), which is the whole appeal. The risk is the upgrade tree needing balance passes and the three spawned modes (duel/co-op/pick'em) each being their own build. Keep the MVP to solo-Hurl-only and let `distance()` prove out before committing to the recombinations.
- **Animation cost:** the bounce animation is cosmetic and load-bearing for delight — but if it's expensive to build, the mode loses its charm. Open question: can a cheap parameterized arc + a couple of bounce sprites carry the feel, or does this need real animation work?
- **Pot thinness at low DAU:** a pari-mutuel pot among few daily hurlers is a small, sometimes-degenerate prize. The consolation `grant_tickles` floor matters more than the pot early; revisit pot split weights once entrant counts are known.
- **Upgrade-tree inflation of distances:** as everyone tiers up, leaderboard distances inflate and the absolute numbers lose meaning. Consider normalizing the leaderboard by tier, or resetting the visible "ceiling" each season alongside the alignment reset.
- **Interaction with the over-cap faucet:** confirm the `GREATEST(...)` fix has actually shipped before this faucet goes live, or over-cap hurlers will see a wrong (clamped) balance on the home screen.