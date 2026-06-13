# The Schism Front
> Every blessing, curse, and trade in the sounder pulls one cosmic tug-of-war between the Givers and the Goblins — and at Judgement Day the whole world tips into a Golden Age or a Reckoning.

**Tier:** Long-term · **Effort:** L (MVP is S–M) · **Mode:** async-authoritative, server-owns-answer; nightly + weekly `pg_cron`; seasonal via existing finale cron · **Depends on:** `shift_alignment()` (the alignment chokepoint, ~15 call sites) · `finalize_season()` + the judgement-day cron · `system_announcements` (INLINE INSERT) · `grant_tickles()` · `alignment_leaderboard()` (shape) · the Barn Exterior screen. Nothing else new is required.

## The fantasy
The fiction has always promised a cosmic schism — goblins vs angels, a Greedy◄──►Giver axis on every identity surface, a Judgement Day finale — but the *war* was never real: alignment is a private per-player number that sums to nothing. The Schism Front makes it real. You're not just a saint or a goblin in your own ledger; you're a soldier on a **front line the whole sounder is fighting**, where every kindness you cast and every pinch you take visibly tilts a shared world meter — the **Tide** — toward salvation or ruin. You wake up to news that a territory flipped overnight because of acts like yours, and you return at season's end to be on the right side of a history that gets written down forever.

## Player loop
- **The act (instant).** You do what you already do — send a blessing, lay a curse, fulfill a trade, dig a friend's truffle, visit a pig. Each of those already calls `shift_alignment(uid, ±delta)`. That same call now also nudges the world **Tide**: `+1` for the Givers, `−1` for the Goblins (trades move `±2`, the greedy-climb-out redemption case `+3`). You immediately see the tug-of-war bar on the Barn Exterior move and a readout: *"you've pushed +12 for the Givers this season."*
- **The morning (overnight, slow).** A nightly tick (`settle_schism_day()`, 00:30 UTC) reads the day's net Tide, flips any **territory** whose threshold was crossed, writes a dated history row, and INLINEs a personal *"the world shifted last night"* dispatch into `system_announcements` — surfaced in the existing While-Away modal. You log in to find the Mire fell to the Goblins, or the Givers held the Orchard.
- **The heartbeat (weekly).** Sunday noon UTC, `settle_schism_week()` writes the **Schism Tally**: the week's net movement, which side gained ground, the territory map's current holders, and one narrator dispatch (hand-written or templated). This is the only real appointment — the reason you come back.
- **The climax (seasonal).** At Judgement Day, the *existing* `finalize_season()` cron runs the per-player verdict exactly as today — and then calls `settle_schism_season()`, which reads the final Tide, picks the **world fate** (Golden Age / Reckoning / Knife's Edge), grants the winning side a dated cosmetic, banks the immutable outcome into the permanent **Hall of Schisms**, and resets the *score* (the Tide) to zero for the next season. **The score resets; the record never does.**

The nesting is the whole design: a daily act is an optional nudge (your normal play already contributes), the weekly Tally is the appointment, and only the slowest clock — the season — carries the real stakes. Missing days never punishes, because the Tide is a community total, not a personal streak.

## Mechanics

### The Tide (the singleton)
- One row, `world_tide` (`CHECK(id = 1)`), holding `net_today`, `net_week`, `net_season` (all `bigint`, signed: **positive = Generous, negative = Greedy**) and the current `season_key` (`'season_1'`, matching `finalize_season`'s default).
- **Accumulation hook** — the only hot-path edit. Inside `shift_alignment`, *after* the existing `profiles` UPDATE that already clamps the per-player score, add the SAME signed `delta`:
  ```sql
  UPDATE public.world_tide
     SET net_today  = net_today  + delta,
         net_season = net_season + delta,
         updated_at = now()
   WHERE id = 1;
  ```
  Wrapped in `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END;` so a Tide write can never roll back the per-player score that drives the rest of the game (same fire-and-forget discipline as the milestone push in `20260536000000_alignment_notifications.sql`). Note: the per-player score is clamped to `[-100, 100]` but the *delta passed in* is the true signed magnitude, so the Tide accumulates the real intent even when a player is pinned at an extreme.
- **Tide percentage (display).** The bar is centered: `pct_generous = 50 + clamp(round(net_season / SCALE * 50), -50, +50)`, where `SCALE` is a tuned constant (start `SCALE = 2000`, i.e. ±2000 net is a total wipe-out). Always shown as a tug-of-war, never a raw number, so a runaway lead reads as "the Givers are winning" not "+8,431."
- **Rubber-band (anti-death-spiral).** Reuse the existing redemption asymmetry already in `tickle_trades_alignment_shift` (greedy giver climbs out at `+3`, neutral at `+2`): the losing side's acts are naturally worth slightly more because more of its members are below zero and earning the climb-out bonus. No extra rubber-band code in the MVP; if a side runs away, lower `SCALE` so flips re-engage (a one-constant knob).

### Territories (Increment 2)
- `schism_territories`: 5 seed rows, each with a `threshold int` and a `holder` in `('generous','greedy','contested')`.
- **Seed ring** (themed to the existing angel/goblin fiction):
  | slug | name | threshold | seed holder |
  |---|---|---|---|
  | `orchard` | The Bountiful Orchard | `+1200` | generous |
  | `commons` | The Shared Commons | `+400` | generous |
  | `crossroads` | The Crossroads | `0` | contested |
  | `market` | The Grasping Market | `−400` | greedy |
  | `mire` | The Goblin Mire | `−1200` | greedy |
- **Flip rule (nightly).** `settle_schism_day()` reads `net_season`. A territory's holder is `generous` if `net_season >= threshold + HYSTERESIS`, `greedy` if `net_season <= threshold − HYSTERESIS`, else unchanged (sticky). `HYSTERESIS = 150` prevents nightly thrash around a threshold. Any holder change sets `flipped_at = now()`, is recorded in that day's `flips` jsonb, and triggers the dispatch.
- **Cooldown / cadence.** Flips resolve at most once per nightly tick. There is no way to rush a flip; you can only push the Tide and wait for the clock.

### The weekly Tally
- `settle_schism_week()` (Sunday 12:00 UTC) computes `net_week` (this week's delta = `net_season` snapshot diff, or summed from `schism_days`), determines `leading_side`, writes a `schism_weeks` row with the narrator `dispatch`, then **resets `net_today` to 0** (week boundary bookkeeping is in the day tick; the week tick only snapshots). It INLINEs a personal Tally dispatch to every recently-active player.

### Season resolution (Increment 3)
- `settle_schism_season(season_key)` is **called from inside `finalize_season()`**, in its own `BEGIN/EXCEPTION` block, AFTER the per-player ranking + reward loop but BEFORE (or just after) the `alignment_score` wipe — so a world-fate bug can never break the working per-player verdict.
- **Fate fork** from final `net_season`:
  | fate | condition | meaning |
  |---|---|---|
  | `golden_age` | `net_season >= +SCALE/2` (≥ +1000) | Givers held the line |
  | `reckoning` | `net_season <= −SCALE/2` (≤ −1000) | Goblins overran the world |
  | `knifes_edge` | otherwise | nobody decisively won |
- Banks one immutable row into `schism_seasons` (the **Hall of Schisms**): `fate`, `final_net`, `generous_territories`, `greedy_territories`, `resolved_at`. This table is **never reset**.
- Grants the dated cosmetic + consolation (see Economy), then resets `world_tide` (`net_today/week/season = 0`, advance `season_key`).

### Edge cases
- **Singleton contention.** At TTP's async scale a single-row `UPDATE ... WHERE id = 1` per `shift_alignment` is fine. Fallback if it ever bites: drop the hot-path UPDATE and instead `SUM(delta)` from a lightweight append-only `tide_events(delta, at)` log in the nightly tick (eventually-consistent; the bar lags by a day). Carry this as a one-flag switch.
- **Re-run safety.** `settle_schism_day/week/season` are idempotent per (`season_key`, key): the day/week rows have composite PKs and `ON CONFLICT DO NOTHING`; the season row is `schism_seasons` PK on `season_key`. A double-fire is a no-op, matching `finalize_season`'s idempotency.
- **No active players.** If `net_season` never moves off 0, fate is `knifes_edge` and every participant still gets a consolation title — loss/stalemate is a story, never a void.

## Schema sketch
Migration prefix **must sort after `20260623000000`** → use `20260624000000_schism_front.sql` (MVP) and `20260625000000…` for increments.

```sql
-- ── world_tide: the singleton the front reads. (no clone — new primitive,
-- but mirrors the daily_lucky_state single-row-counter idiom.)
CREATE TABLE public.world_tide (
  id         int PRIMARY KEY CHECK (id = 1),
  season_key text   NOT NULL DEFAULT 'season_1',
  net_today  bigint NOT NULL DEFAULT 0,
  net_week   bigint NOT NULL DEFAULT 0,
  net_season bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.world_tide (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── schism_seasons: the PERMANENT Hall of Schisms. Never reset. (clones the
-- season_finales "immutable dated outcome" pattern, but world-level not per-user.)
CREATE TABLE public.schism_seasons (
  season_key           text PRIMARY KEY,
  fate                 text NOT NULL CHECK (fate IN ('golden_age','reckoning','knifes_edge')),
  final_net            bigint NOT NULL,
  generous_territories int  NOT NULL DEFAULT 0,
  greedy_territories   int  NOT NULL DEFAULT 0,
  resolved_at          timestamptz NOT NULL DEFAULT now()
);

-- ── INCREMENT 2 ──
CREATE TABLE public.schism_territories (
  slug       text PRIMARY KEY,
  name       text NOT NULL,
  threshold  int  NOT NULL,
  holder     text NOT NULL CHECK (holder IN ('generous','greedy','contested')),
  flipped_at timestamptz
);  -- 5 seed rows (table above)

CREATE TABLE public.schism_days (
  season_key text  NOT NULL,
  day        date  NOT NULL,
  net_day    bigint NOT NULL,
  holders    jsonb NOT NULL DEFAULT '{}'::jsonb,
  flips      jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (season_key, day)
);
CREATE TABLE public.schism_weeks (
  season_key   text NOT NULL,
  week         int  NOT NULL,
  net_week     bigint NOT NULL,
  leading_side text NOT NULL CHECK (leading_side IN ('generous','greedy','tied')),
  dispatch     text,
  PRIMARY KEY (season_key, week)
);
```

**RPCs** (all `SET search_path TO 'public'`):

- `world_front_status() RETURNS jsonb` — STABLE, SECURITY DEFINER, **GRANT authenticated**. Returns `{ pct_generous, net_season, leading_side, my_contribution_season, my_battles, territories:[{slug,name,holder,flipped_at}], generous_contributors, greedy_contributors }`. Contributor counts clone the `alignment_leaderboard()` shape (count `alignment_score > 0` / `< 0`). `my_contribution` + `my_battles` come from a small per-player tally (see below). The caller-specific fields make the aggregate *legible* — the #1 risk mitigation.
- `settle_schism_day() RETURNS jsonb` — SECURITY DEFINER, **NOT granted to authenticated** (cron/service-role only). Reads `world_tide`, evaluates flips with hysteresis, writes the `schism_days` row, resets `net_today`, INLINEs the "world shifted last night" dispatch to recently-active users. Clones the nightly-tick discipline; no `send_system_announcement` (admin-gated footgun).
- `settle_schism_week() RETURNS jsonb` — SECURITY DEFINER, not granted. Snapshots `net_week`, picks `leading_side`, writes `schism_weeks` row + dispatch.
- `settle_schism_season(season_key text) RETURNS jsonb` — SECURITY DEFINER, not granted. Called from `finalize_season()`. Picks fate, banks `schism_seasons`, grants cosmetic + consolation, resets `world_tide`.

**Per-player contribution tally** (for legibility): add `alignment_pushed_season bigint NOT NULL DEFAULT 0` and `schism_battles_season int NOT NULL DEFAULT 0` to `profiles`, bumped in the same `shift_alignment` block (`alignment_pushed_season += delta`, `schism_battles_season += 1`). Reset to 0 inside `settle_schism_season`. This is what powers *"you've pushed +12 for the Givers."* Clones the `alignment_max_pos/neg` ratchet-column idiom already on `profiles`.

**Cron** (own migration, flagged `⚠️ REVIEW BEFORE PUSHING` like `20260579000000`):
```sql
SELECT cron.schedule('schism-night', '30 0 * * *', $$SELECT public.settle_schism_day()$$);
SELECT cron.schedule('schism-week',  '0 12 * * 0', $$SELECT public.settle_schism_week()$$);
```
`settle_schism_season()` rides the **existing** `judgement-day-season-1` cron via `finalize_season()` — no new seasonal job. Do NOT re-run `CREATE EXTENSION pg_cron` (the Supabase after-create hook errors `2BP01`, per `20260579000000`).

**Component (MVP):** `components/SchismFrontStrip.tsx` on the Barn Exterior — a centered Givers◄──►Goblins tug-of-war bar styled with the `WHIMSY` tokens + `FONTS.whimsy` ink-shadow chip language from `BarnActiveEffectsStrip.tsx`. Reads `world_front_status()` via the generic `rpc<T>()` in `utils/rpc.ts`, with a typed wrapper in a new `utils/schism.ts` (the "named typed wrapper per RPC grows alongside the feature" pattern). Increment 2 adds a 5-node territory ring; Increment 3 adds the Tally card + a Hall of Schisms scroll.

## Economy
- **Zero new currency mint, zero inflation surface by construction.** The front moves on **alignment deltas** — a reputation signal, not a currency. No SNOUTS are minted or transferred by the act of fighting the war; `profiles.counter` is untouched by `shift_alignment` and by all four settle RPCs.
- **Snout sink (later, optional).** When the Snout Oracle is wired in (see *How it composes*), bets on flips are a pari-mutuel `counter→counter` transfer — zero-sum, deflationary, never a faucet.
- **Tickle faucet (bounded, over-cap-safe).** A banded "you fought in the schism" consolation paid ONLY through `grant_tickles()` (the single over-cap-safe faucet from `20260580000000_settle_tickles.sql`) at season settle: ~`5 / 15 / 30` by `schism_battles_season` band. A rounding error against the home loop, and `grant_tickles` already settles + banks wasted-tickle debt first.
- **Display-debt fix (carry the footgun).** The MVP grant is plausibly the **first over-cap `grant_tickles` in production** at season-end scale, so this migration MUST also patch the inline-clamp display RPCs (`home_stats`, `admin_tickle_overview`) to use `GREATEST(item_count, LEAST(cap, item_count+regen))` so over-cap players see the true number — the deferred fix flagged in `20260580000000`.
- **Cosmetics ship once per season per side**, non-purchasable, via `INSERT ... ON CONFLICT DO NOTHING` into `titles` + `user_titles` (the `finalize_season` idiom; `source = 'season'`, already in the CHECK). Dated, recurring: a `Golden Age 2026` / `Reckoning Survivor 2026` title + recolor. **No tradable hard-currency market** — the front is a reputation war, not an economy, so it sidesteps the Neopets inflation trap entirely.

## Anti-abuse / cheat model
- **Cheat tier: server-owns-answer.** The Tide is derived purely from `shift_alignment` deltas, which are only ever produced by the *already server-validated* acts: `send_blessing`/`send_curse` (friend-gate + 1/day cap + `unique_violation` per-day guard), `tickle_trades` fulfillment (status-transition trigger), `dig_truffle`/visit (cooldowns + per-target ledgers). The client never tells the server how much to move the Tide. There is no vote, no client-submitted score, nothing to spoof.
- **No new farming surface.** The front adds zero new earnable act — it *reads* acts that already have their own caps and cooldowns. The daily blessing/curse cap (1 each) and the trade/visit/truffle cooldowns are the rate limiter; you cannot grind the war faster than you can grind the existing loop.
- **Collusion is the intended gameplay.** "Coordinate your friends to push the Tide" is the *feature* (BELONGING), not an exploit — it's cooperative, bounded by per-player caps, and self-balancing via the greedy climb-out asymmetry. There is no PvP reward to farm and no per-player leaderboard the war feeds, so there's no incentive to sockpuppet beyond the existing alignment-leaderboard's own anti-abuse posture (and `is_test`/hidden accounts are already excluded from ranking RPCs).
- **Settle RPCs are not client-callable** (no `GRANT ... TO authenticated`) — only cron/service-role, exactly like `finalize_season`. The season settle is wrapped so a forged or failed world-fate can't corrupt the per-player finale.

## Feel
- **Persistent-world FOMO** — territories flip overnight whether you logged in or not; you return to find the Mire fell. The world moved without you, and you wish you'd been there.
- **Belonging** — the two alignment sides stop being private labels and become *teams with a shared visible goal*. "We held the Orchard this week" is a sentence the sounder can say.
- **Slow time** — three nested clocks (instant nudge → nightly flip → weekly Tally → seasonal fate) that you *cannot rush*; the slow clock is the feature, the antidote to TTP's daily-chore creep.
- **Emergent drama** — a knife-edge season where one Sunday's Tally decides the Orchard becomes a story players self-organize around, with no authored event.
- **Wonder + discovery-as-content** — the weekly narrator dispatch frames the aggregate (including loss) as myth; the Hall of Schisms is a readable history you helped write.
- **Cozy-tone guardrail:** the dispatch voice stays playful/mythic, never vicious (avoid the r/place-2022 hostility trap). A schism of conscience, not a kill-feed. Even a Reckoning grants a dated *Reckoning Survivor* title — **loss is a story, not a punishment.**

## How it composes
The Schism Front is the **meta-frame**: it's the only system whose currency is *alignment itself*, and nearly every other mode already touches alignment. With zero re-architecture it gives each short mode a season-scale consequence:
- **Snout Oracle** → bets *on the war* (`resolver_key`s that read `world_tide`: "how many territories will the Givers hold Sunday?", "does the Mire fall this week?"). A pure pari-mutuel snout sink that resolves off server-owned state.
- **Pageant / Showdown** → a daily style win injects a one-time Tide bonus to the winner's side via a `shift_alignment`-style accumulation.
- **Mud-Off** → the cleanest fit: its two factions **ARE** the Generous/Greedy armies (no new faction column), so its per-capita settle tips the Tide directly. The front *absorbs* Mud-Off's plumbing instead of competing with it.
- **Mini-games / Daily Riddle** → a winning side earns Tide points through the same path; throwaway wins become faction contributions.
- **Devotion / Garden streak** → the daily-return engine that keeps players casting the acts that feed the Tide.

A single Oracle bet (daily) → nudges the Tide (instant) → a territory flips (nightly) → the Tally narrates it (weekly) → the fate banks it permanently (seasonal). Every short mode stops being a cosmetic vending machine and becomes a front in a war the whole sounder is fighting.

## MVP
Proves the "private number → living shared front" transform with **no mini-games, no map art, no territories** — one migration + one hook + one RPC + one component:
1. **One migration** (`20260624000000_schism_front.sql`): create `world_tide` (singleton) + `schism_seasons` (Hall of Schisms ledger); add `alignment_pushed_season` + `schism_battles_season` to `profiles`; rebuild `shift_alignment` from its live def (`20260581000000_alignment_teeth.sql` body + the milestone push from `20260536000000`) adding ONLY the wrapped Tide accumulation + the two per-player tally bumps; ship the `home_stats`/`admin_tickle_overview` `GREATEST(...)` display-debt fix.
2. **`world_front_status()`** returning season Tide %, leading side, and the caller's contribution-this-season + battles.
3. **One Barn-Exterior strip** (`SchismFrontStrip.tsx`): a Givers◄──►Goblins tug-of-war bar — *"The Schism: the world is 58% Generous"* + *"you've pushed +12 for the Givers"* — styled off `BarnActiveEffectsStrip`/`WHIMSY`.

That alone delivers PERSISTENT-WORLD FOMO + BELONGING with no cron and no art. **Increment 1:** nightly cron + the "world shifted last night" dispatch. **Increment 2:** the 5 territories + ring map + the weekly Tally (`settle_schism_week`). **Increment 3:** chain `settle_schism_season()` into `finalize_season()` for the fate + dated cosmetic + permanent Hall of Schisms. Mini-games bolt on **last**.

## Risks & open questions
- **Singleton contention** on `world_tide` if many casts hit concurrently. Mitigation: fine at TTP's async scale; keep the one-flag fallback ready (move accumulation into the nightly tick via an append-only event log).
- **Legibility** — an aggregate the player can't *feel* is inert. Always show "your side gained X / you've pushed +N" next to the global bar; the `my_contribution`/`my_battles` fields exist for exactly this.
- **Faction death-spiral** — a runaway side kills tension. Lean on the existing greedy-climb-out asymmetry as a soft rubber-band; tune `SCALE`/`HYSTERESIS` (knife-edge, Helldivers-style); pay the losing side a dated consolation every season.
- **Tone drift** — keep the dispatch mythic, not hostile; cozy guardrail is load-bearing.
- **Over-coupling Judgement Day** — the season settle is wrapped in its own `BEGIN/EXCEPTION` so a world-fate bug can never break the per-player finale or the alignment reset.
- **Solo-dev content cadence (the honest cost)** — the only recurring labor is *one hand-written narrator paragraph per week*, and even that is optional because ~30 reusable templates keyed to the Tide band cover it. No new content per season; only the dated cosmetic (a recolor + a year-stamped title) changes. This is the cheapest renewable-content footprint of any long-term concept considered.
- **Open questions:** (1) Ship as a pure systems layer first and add a serialized-narrator skin later, or commit to an authored arc now? (2) Confirm stakes shift to *weekly* (Sunday Tally) with daily acts staying optional — nothing new becomes daily-mandatory? (3) Start with a single global bar (MVP) and add the 5 territories only if the bar engages? (4) Commit to Mud-Off's factions *being* the Generous/Greedy armies so the front absorbs Mud-Off? (5) Confirm "reset the SCORE at Judgement Day, never the RECORD" — build the permanent Hall of Schisms + dated fate cosmetics?