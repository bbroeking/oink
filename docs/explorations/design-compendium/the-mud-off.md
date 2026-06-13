# The Mud-Off (Teams)
> Pick a side — Hilltoppers or Valleyfolk — and roll your whole pen into one filthy, glorious turf war. Tickle hard, toss snouts in the pit, and let the muddiest, busiest faction win.

**Tier:** Core mode · **Effort:** L (clone-heavy) · **Mode:** Async batch-settled, bi-weekly fixed-cycle (no realtime) · **Depends on:** ships the `profiles.faction` column itself (clone of `choose_allegiance`, `supabase/migrations/20260585000000_world_cup_allegiance.sql`); otherwise standalone — passive contribution rides the already-shipped `tickles_earned` monotonic counter, so it needs no new tap-path write.

## The fantasy
You are not a lone pig grinding your own bank anymore — you've thrown in with a tribe. Every tickle you tap and every snout you toss into the pit is a shovelful of mud heaped onto your faction's pile, and across the next two weeks you watch your side's standing slosh up and down against the rivals on the hill (or down in the valley). It's the cozy version of a turf war: low-stakes, loyalty-flavored, and the kind of thing you check on with your morning coffee to see whether the Valleyfolk pulled ahead overnight.

## Player loop
- **Once per cycle:** open the Mud-Off card, pick **Hilltoppers** or **Valleyfolk**, lock it in for the cycle (free re-pick when the next cycle opens).
- **Daily (the nest of the loop):** tickle Rosie as you already do for the home loop. Every tickle increments `profiles.tickles_earned`; the Mud-Off lazily snapshots your `base_earned` the first time you interact this cycle, so all earning *after* that snapshot becomes your **muck** with zero extra taps. Check the standings card to see your side's per-pen average vs the rivals' and your own named contribution row.
- **Optional, any day:** toss snouts into your faction's **pit** to convert spend into a capped muck boost — a deliberate investment that nudges the average but can't buy the win.
- **Bi-weekly settle (the stakes):** at the 14-day UTC boundary a single cron tick resolves the Mud-Off. The winning faction's active members split the combined pit pro-rata to their muck and unlock a dated faction cosmetic; **every** participant on both sides claims the personal effort ladder. Then the cycle re-opens, bases re-snapshot, and faction choice frees up again.

## Mechanics

**Cadence.** Fixed **14-day** cycles on a UTC boundary, advanced by one `pg_cron` tick cloned from `cron.schedule('judgement-day-season-1', …)` (`20260579000000_judgement_day_cron.sql`). Faction choice is **lock-once within a cycle**, free re-pick at each new cycle; the lock carries a `faction_cycle_id` so last cycle's pick never leaks into the new one. `season_base` re-snapshots lazily per cycle.

**Contribution (HYBRID, one combined unit).**
- `tickle_muck = GREATEST(0, profiles.tickles_earned - season_base)` — 1 tickle = 1 muck. The base is a lazy per-`(cycle, user)` snapshot taken at first interaction (`COALESCE(base, tickles_earned)` so a missing base = 0 contrib, never a mid-cycle recompute). This reuses the verified bounty/Trough live-delta no-drift pattern — **no per-tap ledger**.
- `donation_muck = floor(donated_snouts / 5)`, capped at `DONATION_MUCK_CAP = 200` (= 1000 snouts/member/cycle). `SNOUT_PER_MUCK = 5` is deliberately worse than Trough rates so donating *boosts*, never *buys*.
- `combined_muck = tickle_muck + donation_muck`. One unit, so standings never show two competing bars.

**Win metric — active-this-cycle per-capita average with a quorum floor (the sim's R5).**
```
avg_per_active = (SUM(combined_muck) / COUNT(members WHERE combined_muck > 0))
                 IF active_members >= QUORUM, ELSE 0  (below quorum = ineligible)
winner = argmax(avg_per_active)
```
- **The denominator is `COUNT(combined_muck > 0)`** — active this cycle, not all-time members, not `profiles.last_active_date` (session-writable, would let a logged-in zero-contributor inflate the denominator).
- `QUORUM = 8` ships as a named SQL constant with a one-line override path; watch the first 2–3 settlements and tune to live base.
- **`is_test` excluded from BOTH numerator and denominator** (the demo/admin accounts must not skew either side).

**Caps & cooldowns.** Donation muck capped at 200/member/cycle; overflow snouts clamped **before** the debit so a player is never charged for muck that won't count. One faction lock per cycle.

**Prize structure (3 layers; effort > placement by design).**
1. **Winning-faction dated cosmetic** via `user_hats ON CONFLICT DO NOTHING`, gated on `combined_muck > 0` (cost 0, non-purchasable).
2. **Pari-mutuel pit split:** the combined pit (`pit_hill + pit_valley`) pays out to winning active members proportional to each winner's `combined_muck`. Proportional split makes alt-padding pay near-nothing.
3. **Personal effort ladder (BOTH sides, the PRIMARY reward):** banded `grant_tickles` by personal muck — **5 / 15 / 30** tickles — once per cycle, PK-idempotent, paid to every participant regardless of side.

**Edge cases.**
- **Both factions below quorum:** no winner; the pit **refunds pro-rata to donors** (clone `resolve_expired_drives` refund logic); the cosmetic rolls to next cycle; everyone still claims the ladder.
- **Tiebreak chain:** `avg_per_active DESC → active_members DESC (anti-cabal) → total_muck DESC → earliest faction-join`. On a true dead-heat, grant the cosmetic AND split the pit to **both** sides (rare shared victory) rather than coin-flipping.
- **season_base correctness:** snapshot lazily with `COALESCE(base, tickles_earned)`; never recompute mid-cycle.
- **Cross-cycle decay:** re-snapshot each cycle = no permanent incumbent. The standings bar MUST read "this cycle" loudly so loyalty isn't mistaken for an all-time ladder.

## Schema sketch
Migration prefix must sort **after** `20260623000000` (i.e. `>= 20260624000000`) to avoid a `schema_migrations.version` PK collision.

```sql
-- Faction column — clone of choose_allegiance's lock-once skeleton (20260585000000)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS faction           text CHECK (faction IN ('hilltoppers','valleyfolk')),
  ADD COLUMN IF NOT EXISTS faction_cycle_id  bigint,
  ADD COLUMN IF NOT EXISTS faction_chosen_at timestamptz;

CREATE TABLE public.mud_off_cycles (        -- clones item_drives lifecycle + judgement-day cron tick
  id bigserial PRIMARY KEY,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settling','settled')),
  winning_faction text,               -- null + settled = no winner (both <Q) or dead-heat shared win
  pit_hill bigint NOT NULL DEFAULT 0, pit_valley bigint NOT NULL DEFAULT 0,
  settled_at timestamptz);

CREATE TABLE public.mud_off_base (          -- lazy season_base snapshot (Trough live-delta shape)
  cycle_id bigint NOT NULL REFERENCES public.mud_off_cycles(id) ON DELETE CASCADE,
  user_id  uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_earned bigint NOT NULL,
  PRIMARY KEY (cycle_id, user_id));

CREATE TABLE public.mud_off_donations (     -- item_drive_donations shape; cap enforced at write
  cycle_id bigint NOT NULL REFERENCES public.mud_off_cycles(id) ON DELETE CASCADE,
  user_id  uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snouts_donated int NOT NULL DEFAULT 0,
  donation_muck  int NOT NULL DEFAULT 0,    -- floor(snouts/5), capped 200
  PRIMARY KEY (cycle_id, user_id));

CREATE TABLE public.mud_off_claims (        -- idempotent ladder + cosmetic claim (item_drives claim shape)
  cycle_id bigint NOT NULL REFERENCES public.mud_off_cycles(id) ON DELETE CASCADE,
  user_id  uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muck int NOT NULL, faction text NOT NULL, won boolean NOT NULL,
  tickles_paid int NOT NULL DEFAULT 0, snouts_paid int NOT NULL DEFAULT 0,
  cosmetic_id text, claimed_at timestamptz NOT NULL DEFAULT now(), seen_at timestamptz,
  PRIMARY KEY (cycle_id, user_id));         -- INSERT … ON CONFLICT DO NOTHING; IF NOT FOUND -> already_claimed

-- Named SQL constants in RPC bodies: DONATION_MUCK_CAP=200, SNOUT_PER_MUCK=5, QUORUM=8, LADDER 5/15/30.

-- The settlement / standings CTE (the sim's exact shape):
WITH muck AS (
  SELECT p.id, p.faction,
         GREATEST(0, p.tickles_earned - COALESCE(b.base_earned, p.tickles_earned))
           + COALESCE(d.donation_muck, 0) AS contrib
  FROM profiles p
  LEFT JOIN mud_off_base b      ON b.user_id=p.id AND b.cycle_id=:cur
  LEFT JOIN mud_off_donations d ON d.user_id=p.id AND d.cycle_id=:cur
  WHERE p.faction IS NOT NULL AND p.faction_cycle_id=:cur AND COALESCE(p.is_test,false)=false)
SELECT faction,
       SUM(contrib)                                  AS total_muck,
       COUNT(*) FILTER (WHERE contrib > 0)            AS active_members,   -- THE DENOMINATOR
       CASE WHEN COUNT(*) FILTER (WHERE contrib > 0) >= :quorum
            THEN SUM(contrib)::numeric / NULLIF(COUNT(*) FILTER (WHERE contrib>0),0)
            ELSE 0 END                                AS avg_per_active    -- 0 => below quorum => ineligible
FROM muck GROUP BY faction
ORDER BY avg_per_active DESC, active_members DESC, total_muck DESC;
```

**RPCs** (all SECURITY DEFINER; clone-source noted):
- `choose_faction(p_faction text) -> jsonb` — clones `choose_allegiance(p_flag_id)`: validate, lock-guard on `faction_cycle_id = current cycle`, set `faction / faction_cycle_id / faction_chosen_at`. Returns `{ok, error?, faction}`.
- `donate_to_pit(p_snouts int) -> jsonb` — clones the `bury_truffle` atomic-debit idiom (`UPDATE profiles SET counter = counter - cost WHERE id = caller AND counter >= cost RETURNING counter`); clamp overflow to `DONATION_MUCK_CAP` *before* debit; upsert `mud_off_donations` and bump `pit_{faction}`. Returns `{ok, error?, donation_muck, pit_total}`.
- `mud_off_standings() -> jsonb` (read) — the CTE above + caller's own muck + pit totals + named top-contributor rows (TroughSection style).
- `resolve_mud_off(p_cycle_id bigint) -> void` — `pg_cron` tick (clone judgement-day). Computes winner, splits pit `counter -> counter`, writes `mud_off_claims`, **INLINE `INSERT INTO public.system_announcements`** per recipient (never `send_system_announcement()`). Lazy-callable fallback from the read path (clone `resolve_expired_drives` `FOR UPDATE SKIP LOCKED`).
- `claim_mud_off_reward() -> jsonb` — idempotent claim from `mud_off_claims`; `grant_tickles` the ladder band, `user_hats ON CONFLICT DO NOTHING` for the cosmetic; INLINE announcement.

## Economy
- **Snout sinks/flows:** donations are a `counter -> counter` **pari-mutuel pit** (clone `item_drives` escrow/refund) — redistributed to winners proportional to muck, never burned and **never minted**. The atomic debit idiom is the verified `bury_truffle` pattern (`20260594000000`). Both-below-quorum → pro-rata refund (clone `resolve_expired_drives`).
- **Tickle faucet:** only the bounded effort ladder (`grant_tickles`, the only over-cap-safe faucet, server-only). Max **30 tickles/player/~2 weeks** — a rounding error against the daily home loop's mint, gated by real grind, and paid to everyone so it doubles as engagement reward.
- **Display-debt fix:** if the Mud-Off ladder is the **first over-cap `grant_tickles` faucet to ship**, it MUST bundle the `GREATEST(item_count, LEAST(cap, item_count+regen))` fix into `home_stats` + `admin_tickle_overview` (per `20260580000000_settle_tickles.sql` header). If the Oracle/Riddle shipped first, this mode inherits the corrected display.
- **Cosmetic rewards:** dated, non-purchasable faction cosmetic (recolorable Hilltopper/Valleyfolk pair) via `user_hats ON CONFLICT DO NOTHING` + a dated title. No cash path, no inflation surface.
- **Why it can't inflate:** snouts only ever move as transfers (pit redistribution / refund); the only minted currency is a hard-bounded ≤30-tickle ladder banking overflow into `tickles_wasted_total`.

## Anti-abuse / cheat model
- **Per-capita is the structural anti-collusion lever (sim-verified).** Zero-muck alts *dilute* the average (hurt the attacker, scenario 4a); even alts grinding to ~8 muck still drag the average *down* (4b). The attack only pays if alts exceed the faction average — which costs real capped grind/snouts per alt and is economically self-limiting. This is **collusion-tier** resistance by construction, not by detection.
- **Quorum floor closes the ghost-town + whale hole** (scenario 2): a 1-whale dead faction with a 900 average is ineligible below Q=8. Per-capita-alone (R2) failed exactly this; the quorum `COUNT(*) FILTER` is the minimal patch that takes the scorecard to 5/5.
- **`DONATION_MUCK_CAP = 200` is the load-bearing anti-whale lever** — the boost sweep showed one 600-muck donation flips an even matchup, so snout-sourced muck must be capped per member per cycle, else the average reflects one wallet, not participation.
- **`is_test` excluded both sides** so demo/admin accounts skew neither numerator nor denominator.
- **Active signal is the monotonic `tickles_earned` delta, not `last_active_date`** — a session-writable, date-coarse column would let a logged-in zero-contributor inflate the denominator.
- **Residual (accepted as a feature):** the join-the-smallest meta (scenario 5) is a size self-balancer; its only risk (a snowballing elite squad) is contained by the quorum + donation cap. v2 adds a periodic above-average-alt anomaly query.

## Feel
- **Belonging + emergent drama** (evoke-online-game-feel): a fixed two-faction identity you wear for two weeks turns the solo daily grind into a tribe you root for; the standings card is the persistent-world scoreboard you check obsessively.
- **Persistent-world FOMO:** the bi-weekly boundary and the visible rival average create a soft "we could still pull ahead overnight" pull without any realtime pressure.
- **Identity expression:** the dated faction cosmetic + title is a worn badge of which side you bled mud for, and which cycles you won.
- **Anti-loafing belonging guardrail:** named Sounder-level contribution rows (TroughSection style) let a player *see their own name on the pile* — the cozy version of "I carried my pen," never a shame-board.
- **Cozy tone guardrail:** it's a *mud-off*, not a war — flavor is filthy-fun, the effort ladder pays losers too, and copy on loss stays warm ("The Valleyfolk wallowed deeper this fortnight — but your pen still earned you {tickles}").

## How it composes
This is the **direct seed of the Schism Front's Generous/Greedy armies.** The faction column, lock-once picker, per-capita+quorum settlement, pari-mutuel pit, and effort ladder are all reusable as-is; later the two factions get re-skinned/re-anchored onto the existing **Greedy ◄──► Giver alignment axis** (`shift_alignment`), promoting the currently-private alignment into a public team identity — the Schism Front meta-frame. It also hands **Sounder Showdown** its prerequisite: Showdown is a thin L recombination that consumes this faction column + the Pageant's style model and reuses the *same* per-capita-average anti-dilution math (the doc's recommended build order: Mud-Off ships the faction column at step 3, Showdown recombines at step 4). The named-contributor rows reuse the Trough/TroughSection presentation already shipped for `item_drives`.

## MVP
The doc's MVP→v2 cut line:
- **One migration (`>= 20260624000000`)**: the faction columns + the 4 tables + the 5 RPCs (`choose_faction`, `donate_to_pit`, `mud_off_standings`, `resolve_mud_off`, `claim_mud_off_reward`) + the `GREATEST` display-debt fix on `home_stats`/`admin_tickle_overview` (if this is the first over-cap faucet) + one `pg_cron` tick.
- **One component**: a `MudOff` card showing faction headcount + per-pen average + caller's own muck + pit totals, plus a launch-modal verdict on settle.
- **Constants**: Q=8, 5:1 cap-200, ladder 5/15/30, one recolorable cosmetic pair + dated title.
- **v2:** faction + Sounder NAMED top-contributor rows (the biggest anti-loafing polish, non-blocking), the "you haven't tossed in the pit" nudge, richer pull-modal, admin Q/cap config row, the above-average-alt anomaly query, optional presence flourish.
- **Defer indefinitely:** a third faction, mid-cycle switching, wasted-tickle → muck conversion.

## Risks & open questions
- **Per-capita is harder to explain than a total.** The standings UI must NOT render a shared SUM bar (a loafer must not look like dead weight, and a big lazy pen must not look like it's winning). Render the **average** as the headline gauge and the personal muck separately; copy must teach "average, not size" up front.
- **Solo-dev content cadence:** a bi-weekly cosmetic is the real recurring cost. The doc's lean is a *fixed recoloring set + dated title* (not unique art per cycle) to keep live-ops sustainable — confirm before committing to per-cycle unique art.
- **Quorum is the single tuning knob.** Q=8 is a starting guess against an unknown live base; the first 2–3 settlements must be watched, and a low-population early period could leave *both* sides below quorum (handled by the refund path, but it feels like a non-event — frame it gently).
- **First-faucet display-debt ownership:** whichever of Mud-Off / Oracle / Riddle ships first owns the `GREATEST` fix; if build order slips, make sure exactly one migration carries it and the others don't double-patch.

Questions for you:
1. Is the `profiles.faction` column committed to ship *with* the Mud-Off, or as a standalone earlier ship? (The doc's lean is yes-ship-it-with-Mud-Off; the brief says LOCKED but the column exists only in the exploration doc, never in a migration.)
2. Cosmetic art budget per cycle — fixed recoloring set + dated title (lean), or unique art per cycle?
3. Keep the snout→muck rate at 5:1 cap-200, or tune (3:1 / 10:1) before launch?

Source doc: `/Users/bbroeking/projects/oink/docs/explorations/2026-06-08-pinned-design-teams-pageant-minigames.md` (§2.1, §4). Verified primitives: `choose_allegiance` (`supabase/migrations/20260585000000_world_cup_allegiance.sql`), `bury_truffle` atomic debit (`20260594000000_bury_truffle_atomic.sql`), `grant_tickles` + GREATEST display-debt note (`20260580000000_settle_tickles.sql`), `resolve_expired_drives` + `item_drive_donations` (`20260583000000_item_drives_resolve.sql`, `20260582000000_item_drives.sql`), inline-announcement fix (`20260619000000_fix_donate_to_drive_announcement.sql`), judgement-day cron (`20260579000000_judgement_day_cron.sql`), `daily_shop` hashtext seed (`20260584000000_daily_shop_exclude_free.sql`), `grant_season_xp` (`20260613000000_xp_for_social_actions.sql`), `components/TroughSection.tsx`.