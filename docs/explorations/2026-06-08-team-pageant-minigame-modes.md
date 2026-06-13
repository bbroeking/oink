# Tickle the Pig — New Modes Exploration: Teams, Pageant, Mini-Games (+ Hybrids)

> Decision-ready exploration for a solo dev on local builds. Scope: three proposed modes plus fused/branching ideas. Every option below is shippable on the current async-only Supabase stack — no game server, no mandatory live realtime.

## 0. The one insight that collapses the complexity

All three modes, and every hybrid, are the **same shape your codebase already runs**:

1. One **SECURITY DEFINER plpgsql RPC** is the sole authoritative writer.
2. Backing tables are **RLS read-only**; the client only `rpc()`/`rpcAction()` reads and renders a CTA.
3. Value moves as a **snout TRANSFER (counter -> counter)** or **`grant_tickles(uid,n)`** — **never a fresh mint**. Snouts are minted ONLY by the home tickle loop.
4. An **async signal** notifies: **INLINE `system_announcements` INSERT** (+ push), never `send_system_announcement()`.
5. A **board or bar** renders standings/progress.

This means new modes are mostly **recombination of existing primitives**, not new infrastructure.

### Verified against the repo
- `grant_tickles(uid,n)` exists in `supabase/migrations/20260580000000_settle_tickles.sql` — settles first, then adds `n` **without clamping to cap**, banks waste into `tickles_wasted_total`. The ONLY safe over-cap tickle grant; server-side only. The migration header (line ~20) flags a known intentional debt: **fix `home_stats`/`admin_tickle_overview` to `GREATEST(...)` clamp when the first over-cap grant ships** so players see their true banked balance.
- `choose_allegiance(p_flag_id)` in `20260585000000_world_cup_allegiance.sql` is the **lock-once picker skeleton**: validates the cosmetic, `already_chosen` guard, sets `allegiance_country` + `chosen_at`, grants+equips the cosmetic via `ON CONFLICT (user_id, hat_id) DO NOTHING`.
- The **`send_system_announcement` footgun is real**: it raises `admin_only` for non-admins and (because each RPC is one transaction) **silently rolls back the entire payout**. The `20260618000000_fix_dig_truffle_announcement.sql` migration exists specifically to revert to the inline INSERT. **Always inline.**

### Two design principles do most of the work
- **PER-CAPITA (average, not sum) scoring** makes team collusion *self-defeating* — adding an alt dilutes the average rather than inflating it — so you never have to police the friend graph.
- **SERVER-COMPUTED scoring** (re-read state inside the RPC; never trust a client number) makes pageants and mini-games **cheat-proof by construction**. Where the server can't compute the answer, **prediction/pick'em wagering** sidesteps the problem entirely.

---

## 1. IDEA 1 — TEAMS (a "drove" faction mode)

**Concept:** players belong to a *drove*, feed a shared mud-pit contribution bar through normal tickling, and compete for pig-themed cosmetics, with the win decided by **per-active-member average** so stacking friends/alts can't buy a victory.

There is **no team entity in the codebase today** — affiliation is a single `profiles.allegiance_country` column. The cheapest correct path clones the shipped lock-once allegiance pattern into a `profiles.drove` column and clones the bounty engine's deterministic-rotation + live-computed-progress + insert-then-check-claim + transfer-payout shape for settlement.

### Option A — The Great Mud-Off (chosen droves, per-capita win)  · effort **L**
Pick your drove (3-4 cozy persistent ones: Mudlarks, Truffle Hogs, Sunbathers, Night Rooters) via a one-time locked picker. Every home tickle feeds your drove's shared mud-pit; **progress is computed LIVE off `tickles_earned` deltas in the season window** (bounty pattern, no per-tap write to drift). Season settles on a `pg_cron` tick (Judgement Day precedent). The winner is the drove with the highest **average muck per ACTIVE member** (active = contributed ≥ threshold), not raw total. A **personal slop ladder** pays every participant tickles for their OWN effort regardless of placement; the winning drove gets a cosmetic-only flex. **Effort reward > placement reward by design.**

- **Reuses:** `choose_allegiance` -> `choose_drove`; bounties live-progress/claim engine; `alignment_leaderboard` two-sided UNION ALL; `AllegianceModal`/`AllegianceCard`; `app/_layout.tsx` popup-slot launch gate; `TroughSection.tsx` (bar + countdown + claim rail); `grant_tickles`; Judgement Day `pg_cron`; `useBuriedTruffle` status-hook pattern -> `useDrove`.
- **New work:** `profiles.drove` + `drove_chosen_at` + `drove_season_base_earned` snapshot; `drove_seasons` table; `drove_ladder_claims` (PK idempotency); `choose_drove()`, `drove_standings()`, `my_drove_status()`, `settle_drove_season()` (pg_cron), `claim_slop_ladder()`; `DroveModal`/`DroveCard`/`DrovePitBar`/`DroveStandings`; `utils/droves.ts`; drove badge on Leaderboard rows + UserSheet 'same drove' affordance.

**Schema sketch:**
```sql
ALTER TABLE profiles ADD COLUMN drove text REFERENCES hats(id) ON DELETE SET NULL,
                     ADD COLUMN drove_chosen_at timestamptz,
                     ADD COLUMN drove_season_base_earned bigint;
CREATE TABLE drove_seasons (id bigserial PK, starts_at timestamptz, ends_at timestamptz,
  status text CHECK(status IN('open','settling','settled')) DEFAULT 'open', winning_drove text);
CREATE TABLE drove_ladder_claims (user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  season_id bigint REFERENCES drove_seasons, tickles_paid int,
  claimed_at timestamptz DEFAULT now(), PRIMARY KEY(user_id, season_id));
-- choose_drove(): clone choose_allegiance — already_chosen guard, set drove+chosen_at,
--   equip+grant cosmetic ON CONFLICT DO NOTHING.
-- drove_standings(): SUM(tickles_earned - drove_season_base_earned) muck,
--   COUNT(*) FILTER(active) members, muck/members avg GROUP BY drove ORDER BY avg DESC.
-- settle_drove_season(): SECURITY DEFINER; lock season row FOR UPDATE; per-capita winner;
--   set winning_drove,status='settled'; INLINE system_announcements; grant winner cosmetic.
-- claim_slop_ladder(): INSERT drove_ladder_claims ON CONFLICT DO NOTHING; IF NOT FOUND ->
--   already_claimed; banded tickle reward from my season muck; PERFORM grant_tickles.
```

- **Anti-abuse:** per-active-member scoring is the core lever (an alt lowers the average). Contribution rides the rate-limited tickle bank (cap 25 / VIP 50 + regen) + explicit daily contribution cap. 'Active member' threshold excludes drive-by alts from both numerator and denominator. `choose_drove` is lock-once (no drove-hopping to the winning side). All payouts are `grant_tickles` or cosmetics — no minting.
- **Reward loop:** entry free; personal slop ladder banded tickles (e.g. 5/15/30 bronze/silver/gold) via `grant_tickles`, once per season (PK); winning drove gets exclusive seasonal cosmetic via `user_hats`. Season ~2-4 weeks.
- **Risks:** per-capita "snouts per pig" is harder to communicate than a raw bar (show BOTH the muck bar for effort AND the per-capita standings for the trophy); requires a correct per-player season-base snapshot or contribution double-counts/zeroes; net-new pg_cron live-ops surface; with only 3-4 droves some cliques co-locate (relies entirely on per-capita to defuse); locked pick can strand a player on a dead drove (mitigate: personal ladder pays regardless).

### Option B — The Big Wallow (single shared global goal)  · effort **M**  · **recommended Teams MVP**
No teams, no picker, **zero collusion surface**. The whole playerbase feeds ONE giant shared goal (e.g. "tickle 1,000,000 times this cycle"); progress computed live from a global `tickles_earned` delta. A single Big Wallow bar shows global progress + your named drop + your Sounder rollup. On goal-hit/cycle-end a `pg_cron` tick flips status; everyone who contributed claims a personal-effort tickle payout + a shared festival cosmetic.

- **Reuses:** bounties live-progress + UTC window; `TroughSection.tsx` almost verbatim (global scope); `grant_tickles`; Judgement Day cron; `useBuriedTruffle` shape -> `useWallow`; `user_hats` ON CONFLICT; `rpcAction`.
- **New work:** `wallow_cycles` (goal, window, status, `global_base_earned` snapshot); `wallow_claims` (PK idempotency); `wallow_user_base` (lazy per-player snapshot); `wallow_status()`, `claim_wallow_reward()`; pg_cron settle tick (pull-based, no per-user loop); `WallowBar`, `useWallow`, `utils/wallow.ts`.

**Schema sketch:**
```sql
CREATE TABLE wallow_cycles (id bigserial PK, goal bigint NOT NULL, starts_at timestamptz,
  ends_at timestamptz, status text CHECK(status IN('open','reached','closed')) DEFAULT 'open',
  global_base_earned bigint);
CREATE TABLE wallow_claims (user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  cycle_id bigint REFERENCES wallow_cycles, tickles_paid int,
  claimed_at timestamptz DEFAULT now(), PRIMARY KEY(user_id, cycle_id));
CREATE TABLE wallow_user_base (user_id uuid, cycle_id bigint, base_earned bigint,
  PRIMARY KEY(user_id,cycle_id)); -- lazy snapshot for 'my contribution this cycle'
-- claim_wallow_reward(): INSERT wallow_claims ON CONFLICT DO NOTHING; IF NOT FOUND ->
--   already_claimed; n := band(my_contribution); PERFORM grant_tickles; festival cosmetic if reached.
```

- **Anti-abuse:** no opponent to stack against -> no anti-collusion design needed at all. Contribution rides the rate-limited bank. Individual contribution surfaced (named drop + Sounder rollup) to suppress free-riding. Idempotent pull-based claim.
- **Reward loop:** entry free; banded tickle payout scaled to cycle contribution; festival cosmetic if herd hits goal. Cycle ~1-2 weeks, fresh goal each time.
- **Risks:** loses the my-drove-vs-yours rivalry (deliberate scope-down); big shared bars invite loafing if individual contribution isn't surfaced PROMINENTLY; goal-setting is content (too-high demotivates, too-low trivializes); risks feeling like a reskinned Trough.

### Option C — Mud Derby (short randomized 2-drove event, summed scoring)  · effort **M**
A 48-72h event auto-buckets opt-in players into one of 2 randomized droves (balance the smaller side, or hash of `auth.uid()`), with strong bolted-on identity (mascot/color/name). **Because assignment is random, SUMMED scoring is safe** (random buckets balance populations, clique-stacking is structurally impossible). Punchy FOMO cadence between Mud-Off seasons.

- **Reuses:** allegiance lock-once skeleton (server-decided assignment); alignment two-sided render; bounties live-progress + claim; `grant_tickles`; cron for bucketing + settlement; `TroughSection` UI; `app/_layout.tsx` to force the "you've been slung into the Mudlarks!" reveal; `accepted_friend_count()` counter pattern for balanced assignment.
- **New work:** `derby_events`, `derby_assignments` (PK, server-assigned, lock-once), `assign_derby_drove()` (balanced bucket — claim PK row BEFORE reading counts to avoid the race), `derby_standings()`, `claim_derby_reward()`, `settle_derby()`; `DerbyRevealModal` (non-choosable reveal), `DerbyBar`, `useDerby`.
- **Anti-abuse:** RANDOMIZED assignment is the most airtight anti-collusion lever — friends literally can't all land on one side, so summed scoring is safe. Lock-once per event (no re-roll). `base_earned` snapshot at join prevents pre-loading. Small participation reward + cosmetic -> alts pay a high grind cost for near-zero payoff.
- **Risks:** random assignment suppresses belonging (only acceptable for a SHORT event with strong identity); contradicts the chosen-allegiance precedent (tonal whiplash if not framed as special); binary is less expressive; small race window in balanced assignment (claim PK then read counts under the row lock).

### Teams verdict
**Sequence B -> A, with C as an optional interstitial.** B validates the entire shared-bar + personal-effort-ladder + grant_tickles + pg_cron-settlement + claim-idempotency plumbing with zero collusion surface and the lowest balance/communication risk — perfectly on-tone. A then reuses ALL of B's plumbing and adds only `choose_drove` + per-capita settlement. **A is the right answer to the collusion concern: keep CHOICE for identity (matches the locked-allegiance precedent and the friend-centric belonging TTP trades on) and use PER-ACTIVE-MEMBER scoring for the win** — strictly better than randomizing the primary mode. Reserve randomization for C as a short FOMO event where summed scoring is safe.

---

## 2. IDEA 2 — BEAUTY PAGEANT ("Rosie's Runway" / the Catwalk)

**Concept:** a Pokemon-Contest-style two-stage dress-up competition. Your pig's equipped cosmetics drive a deterministic **server-computed STYLE SCORE** (the "Conditions" half), and a hardened blind peer-VOTE plays the "audience," blended **~60% automated / ~40% votes** into a placement that pays snouts/tickles plus a non-purchasable **Ribbon** cosmetic.

### Grounding constraints (from the code)
- Every cosmetic is a row in `public.hats` keyed by text id, carrying category + a 5-tier rarity enum and **NO numeric style fields** (`HatRow` in `constants/hats.ts`). A player's whole look is **9 nullable FK columns on profiles** (`active_hat_id`..`active_flag_id`, `SLOT_COLUMN` in `constants/slots.ts`).
- **Equipping is a raw client UPDATE on profiles gated only by RLS — there is no equip RPC.** Therefore **all pageant scoring MUST be a SECURITY DEFINER RPC that re-reads `profiles` itself and never trusts a client-submitted look.**
- Leaderboard RPCs today expose only `active_hat_id` + `active_flag_id`, so a pageant needs a new **`public_pig_look(uid)`** RPC (modeled on `alignment_leaderboard`).
- **TTP inverts Pokemon's security rationale:** Pokemon weights the live round heavily (it's the skill test); TTP weights the AUTOMATED half heavily (~60/40) because here the **vote half is the gameable one**.
- `scarf` is in `HIDDEN_CATEGORIES` alongside dead `cape`/`necklace` — score only the **~6-7 live visible slots** (head/eyes/face/aura/held/background, + flag optionally), exclude neck.

All three options share ONE foundation: **a style-modifier data model on hats + a deterministic `style_score(look, theme)` RPC.** They differ only in the competitive shell.

### Option A — Async Daily Themed Catwalk  · effort **L**  · **recommended Pageant build**
A daily UTC window opens with one rotating THEME (one of 5 style axes), chosen deterministically like `daily_shop()`'s date-seed (all clients agree, no cron). `enter_catwalk()` (SECURITY DEFINER) re-reads the player's 9-slot look, snapshots it, and computes `style_score = full credit on-theme + 50% off-theme + small coherence bonus`, scaled by rarity potency, run through a **diminishing-returns cap** (the Sheen analog — anti-whale). Voters get a small fixed vote budget and see OTHER entries **blind** via `public_pig_look()` rendered through `PigStage` (no usernames). Votes are weighted by account standing; `friend_ids()` votes discounted/excluded. At close, a lazy resolver (`FOR UPDATE SKIP LOCKED`) normalizes both halves 0-1 within the cohort: `final = 0.60*styleNorm + 0.40*voteNorm`. Top placements get snout transfer + `grant_tickles` + a dated **Ribbon** cosmetic.

- **Reuses:** `SLOT_COLUMN`/`SLOT_FOR_CATEGORY`; `PigStage.tsx`; `daily_shop()` date-seed; UTC-window idiom; `grant_tickles` + inline announcements; `bury_truffle` `WHERE counter>=fee RETURNING` (optional entry fee); `resolve_expired_drives` lazy resolution; `friend_ids`; `rpcAction`/`useFocusEffect` status hook; `alignment_leaderboard` as the template for `public_pig_look`.
- **New work:** 5 nullable smallint style columns on `hats` (mirror in `HatRow`); `pageant_events`, `pageant_entries`, `pageant_votes`; `style_score()`, `enter_catwalk()`, `public_pig_look()`, `cast_catwalk_vote()`, `resolve_catwalk()`; Ribbon cosmetics (cost=0, granted not sold); `CatwalkScreen`, blind `VotingDeck`, `ResultsRecap`; **one-time content pass: tag ~80-90 live worn items with style vectors (LLM-assisted from names/emoji).**

**Schema sketch:**
```sql
ALTER TABLE hats ADD COLUMN style_cool smallint NOT NULL DEFAULT 0, ... style_tough smallint;
CREATE TABLE pageant_events(event_date date PRIMARY KEY,
  theme text CHECK(theme IN('cool','pretty','cute','clever','tough')),
  closes_at timestamptz, status text DEFAULT 'open');
CREATE TABLE pageant_entries(event_date date, user_id uuid, look jsonb, style_score int,
  vote_weight numeric DEFAULT 0, final_score numeric, placement int,
  PRIMARY KEY(event_date,user_id));
CREATE TABLE pageant_votes(event_date date, voter_id uuid, entry_user_id uuid, weight numeric,
  created_at timestamptz DEFAULT now(), PRIMARY KEY(event_date,voter_id,entry_user_id));
-- enter_catwalk(): SECURITY DEFINER; SELECT active_* FROM profiles WHERE id=auth.uid();
--   style = on-theme + 0.5*off-theme, *rarity_potency, capped; INSERT ON CONFLICT DO NOTHING.
-- cast_catwalk_vote(): check budget; reject self + (optionally) friend_ids;
--   weight = standing_weight(voter); INSERT ON CONFLICT DO NOTHING.
-- resolve_catwalk(): FOR UPDATE; normalize; final=0.6*s+0.4*v; rank; grant_tickles + snout
--   transfer top N; INLINE system_announcements; flip status.
```

- **Anti-abuse:** blind voting (no identity during the window) kills boost-my-friend targeting; small fixed vote budget; trust-WEIGHTED votes (streak/Devotion + age) so sockpuppets count fractionally; friend votes discounted/excluded; the 60/40 split caps any vote bloc at ~40% swing because the 60% style half is server-re-read (client cannot assert a fake look). Style itself is anti-whale via the cap + theme rotation. Deferred: offline collusion batch over `pageant_votes` + admin kill-switch.
- **Reward loop:** free entry v1 (small snout fee later as a sink); fixed daily prize table paid as snout TRANSFER / `grant_tickles`; participation tickle for entrants who also vote; dated non-purchasable Ribbons that feed back into future Style Scores (virtuous closet loop).
- **Risks:** voter critical-mass (mitigated — the 60% automated half guarantees a non-degenerate result at ~0 votes; fall back to pure style); content labor (tagging ~80-90 items; wrong tags make the meta feel arbitrary); two scoring systems to explain; several balance knobs to playtest; reward MUST stay a transfer/grant_tickles.

### Option B — Pokemon-Contest-Faithful Seasonal Circuit (5 themes × 4 ranks)  · effort **XL**
Same engine as A wrapped in a progression spine: 5 themes × 4 ranks (Normal -> Super -> Hyper -> Master). Place top-N in a rank to unlock the next IN THAT THEME (Gen-III gating). High ranks impose constraints reusing the rarity enum (e.g. "Master: ≥4 slots filled + ≥1 epic/legendary"). Coherence combos matter more at high ranks. Winning a rank grants that theme+rank's unique Ribbon; collecting all 20 is the meta-goal.

- **New work (beyond A):** `pageant_rank_progress` (append-only, insert-then-check on win); season/theme/rank rotation (mirror `activeBountyIndices`); 20 Ribbon cosmetics; rank entry-gate validation (min slots + min rarity from `RARITY_RANK`); coherence-combo bonus + hand-authored named sets; `LadderScreen` + Ribbon collection wall.
- **Anti-abuse:** inherits A's vote hardening; rank gates self-select smaller cleaner cohorts (but also thinner voter pools — watch this); keep the automated cap + coherence dominant so a cheap curated set beats a lazy expensive one (anti-p2w); repeat-loadout penalty.
- **Risks:** high-rank cohorts may be too thin for fair voting (Master nights near-solo); most content + balance surface area (20 Ribbons, curated sets, gates, rotation); a lot to explain to a cozy audience; rarity-gated top ranks risk feeling pay-to-win; **biggest build, highest risk of shipping something under-played relative to effort.**

### Option C — Pairwise "Snout or Snout?" Hot-or-Not (Elo)  · effort **M**
Leanest shell on the same style data model, swapping absolute-entry voting for **randomized BLIND PAIRWISE** (the anti-gaming research's top pick). Players opt their look into the day's pool. The voting UX is a this-or-that deck: `cast_pair_vote()` is handed two RANDOM blind entries (`PigStage` cards, no identity); the **server picks the pairing** (no fixed target to brigade) and updates a Bradley-Terry/Elo rating. Final = `0.60*styleNorm + 0.40*eloNorm`.

- **New work:** `pageant_pool` (PK, elo numeric DEFAULT 1500), `pageant_pairs`; `opt_in_pool()`, `next_pair()`, `cast_pair_vote()` (Elo under FOR UPDATE), `resolve_pool()`; `SwipeDeck`/`ThisOrThat` component.
- **Anti-abuse:** strongest of the three — pairwise has NO fixed target to brigade, entries blind, the SERVER chooses the pairing (can't farm match-ups for a friend), standing-weighted votes, friend pairings excluded, daily budget, 60% style floor caps Elo swing.
- **Risks:** reads more like a rating game than a runway fantasy; Elo cold-start/K-factor noisy on a small base; still needs enough voters to converge (60% floor mitigates); "good eye" consensus reward can be gamed by always-pick-the-rarer-pig (keep it tiny).

### Pageant verdict
**Build A.** It best matches the literal framing (dress up, items carry internal style modifiers, players ALSO vote, weighted-blend winner gets tickles/snouts/Ribbons) and is the natural superset: **B = A + an XL progression spine** (defer until the daily loop proves out and turnout is known); **C = A with pairwise voting swapped in** (keep in your back pocket as the **v2 voting upgrade** if absolute-entry voting shows brigading). **Ship A's shared foundation first** (style columns + `style_score` + `public_pig_look`) — it's reusable by B, C, AND the hybrids. **Crucially, the 60% automated floor means a thin-voter day still resolves fairly** (fall back to pure style at ~0 votes).

---

## 3. IDEA 3 — MINI-GAMES (pay snouts, win tickles, cooldown-gated)

**Bucket A:** async/AFK games on Supabase RPCs + the Buried-Truffle/Bounty/Trough templates, each server-authoritative for anti-cheat. **Bucket B:** a verdict on live Mario-Party-style realtime.

**Decisive anti-cheat principle from the research:** the server owns the seed and recomputes/validates the score — **never trust a client number for a meaningful payout** (Lucky Pig's client-roll is only tolerable because its upside is +1). So games rank on a spectrum: **prediction (cheat-proof by construction)** and **pickem/shared-seed-with-input-log** are the realistic builds; **full deterministic replay is deferred.**

### Option A1 — Snout Oracle (pari-mutuel pick'em)  · effort **S**  · **recommended Mini-Games MVP + overall prototype-first**
A round opens with a question the server alone knows/will-know the answer to (e.g. "Will the global snout counter cross X by lock?", "Which Sounder donates most to Troughs today?", "Heads/tails of tonight's seeded coin?"). Before `lock_at`, `place_oracle_bet()` debits snouts under FOR UPDATE into a per-(round,player) PK ledger. After lock, `resolve_oracle_round()` (lazy-callable from the read RPC, cron-safe with `FOR UPDATE SKIP LOCKED`) computes the true outcome from existing tables. Winners claim a **pari-mutuel** split of all losers' stakes (snout transfer or convert to tickles via `grant_tickles`). New round every few hours; winning re-funds your next wager.

- **Reuses:** `bury_truffle`/`open_item_drive` debit idiom; `resolve_expired_drives` lazy+cron-safe; `claim_drive_reward` nullable claim gate; UTC window; `rpcAction`; `TroughSection` donate/claim split UI + countdown; `useStipend` shape; inline announcements; `pg_cron` (optional).
- **New work:** `oracle_rounds`, `oracle_bets` (PK ledger); `place_oracle_bet()`, `resolve_oracle_round()`, `claim_oracle_payout()`, `oracle_status()`; `useOracle`, `OracleCard`.

**Schema sketch:**
```sql
CREATE TABLE oracle_rounds (id uuid pk, prompt text, options text[], opens_at timestamptz,
  lock_at timestamptz, resolved_at timestamptz, outcome int, status text default 'open');
CREATE TABLE oracle_bets (round_id uuid refs oracle_rounds, player_id uuid refs auth.users,
  pick int, stake int, payout int, claimed_at timestamptz, PRIMARY KEY(round_id,player_id));
-- place_oracle_bet: lock_at>now() check; UPDATE profiles SET counter=counter-stake
--   WHERE id=caller AND counter>=stake RETURNING; INSERT bet.
-- resolve_oracle_round: SELECT ... FOR UPDATE SKIP LOCKED WHERE lock_at<=now()
--   AND resolved_at IS NULL; compute outcome from existing tables; stamp.
-- claim_oracle_payout: row-lock FOR UPDATE; reject if claimed/unresolved/pick<>outcome;
--   pot = SUM(losing stakes); payout = floor(pot*my_stake/winners_total_stake);
--   counter += payout (or grant_tickles); stamp claimed_at; INLINE announcement.
```

- **Anti-abuse:** **cheat-proof BY CONSTRUCTION** — the server holds/computes the answer after lock, so the client can't compute it early. The ONLY attack vector is late entry — blocked by a hard `lock_at` check. Pari-mutuel is a pure zero-sum snout TRANSFER -> cannot inflate the economy. Sockpuppet collusion is harmless (zero-sum among bettors). Cooldown intrinsic (one bet/round, PK). Admin kill-switch: `status='voided'` refunds via the same path.
- **Reward loop:** stake snouts (chips 10/25/50); pari-mutuel pool split pro-rata, or convert to tickles at floor(snouts/2) like the Trough. New round every 3-6h.
- **Risks:** needs genuinely server-resolvable questions (must derive from existing tables or a server seed); single-winner pari-mutuel can feel swingy (refund all if zero correct pickers); round content pipeline (rotating VALUES pool or admin-authored); less "gameplay feel" than a dexterity game (leans on theme/social).

### Option A2 — Pig's Daily Riddle (Wordle model)  · effort **M**
Everyone gets the SAME board from a deterministic daily seed `= (now() AT TIME ZONE 'UTC')::date -> server RNG -> secret word` (pig/barn-themed list). `start_daily_puzzle()` debits a small snout fee once/day and returns ONLY the board shape, never the answer. Guesses are scored by `submit_daily_guess()` against the secret the server **recomputes from the seed** (client never receives it). `finalize_daily_puzzle()` grants tickles by guess-count band. Intrinsic 24h cooldown; optional paid retries as a snout sink.

- **Reuses:** daily UTC-date quota idiom; `grant_tickles`; `bury_truffle` debit; `BountyCard`/`BountyBoard` + `resetsIn()`; `rpcAction`; `utils/bounties.ts` deterministic-rotation client mirror; Sounder feed / `system_announcements` for shareable result; `useStipend`.
- **New work:** `daily_puzzles` ledger (PK player+date); `puzzle_words` table; `puzzle_seed(date)->word` SQL helper (md5-indexed, stable in SQL — avoid JS float RNG); `start_daily_puzzle()`, `submit_daily_guess()`, `finalize_daily_puzzle()`, `daily_puzzle_status()`; `useDailyPuzzle`, `DailyRiddle` board + share card.
- **Anti-abuse:** server OWNS the secret (never returned); board recomputed inside SECURITY DEFINER (no modded easier board); guess_count server-recorded; reward band server-computed; intrinsic PK cooldown; plausibility checks (reject >6 guesses, reject "solved" whose final guess ≠ recomputed secret). Admin voids a day by rotating the salt.
- **Reward loop:** small snout fee/day (or first free, retries cost snouts = sink); tickles by guess-count band; viral shareable result drives social re-engagement.
- **Risks:** daily content pipeline (curated wordlist long enough not to repeat); per-guess round-trip latency (mitigate with optimistic client scoring reconciled to server); modest snout sink unless paid retries; seed->word map must be locked (md5 stable; JS float RNG fragile).

### Option A3 — Async Duel (Snout Standoff)  · effort **L**
`open_duel()` debits an ante into escrow (one active duel per pair via partial unique index) and records the challenger's score on a shared seed (a simple, easily-validated mini — tap-count or seeded pick sequence, NOT a physics sim). The opponent gets a `system_announcements` poke; on open they play the SAME seed via `submit_duel_run()`. `settle_duel()` (FOR UPDATE) compares server-validated scores, pays the combined ante pot to the winner; ties refund. Stale duels auto-refund via a lazy resolver.

- **Reuses:** truffles one-active-per-host partial unique index -> one-active-per-pair; `truffle_digs` per-(thing,actor) PK -> per-duel run rows; `open_item_drive` escrow; `resolve_expired_drives` lazy refund; `tickle_trades` 2-player async + `are_friends()` + 24h pair cooldown; inline announcements; Inbox `postgres_changes` poke; `BuriedMound`/`BuriedTruffleSheet` UI vocabulary; `rpcAction`.
- **New work:** `duels` table (+ partial unique idx WHERE status='open'), `duel_runs` ledger; `open_duel()`, `submit_duel_run()`, `settle_duel()`, `resolve_expired_duels()`, `my_duels()`; `useDuels`, `DuelCard`/`DuelSheet`; push trigger + `app/_layout` deep-route case 'duel'.
- **Anti-abuse:** shared seed makes both runs comparable AND validatable (`settle_duel` re-derives the legal score ceiling, rejects impossible scores; `input_log` stored for audit). Pick a mini whose score the server can fully bound cheaply; defer any mini needing full float/RNG replay. Thrown-match collusion is **economically neutral** (zero-sum transfer between friends, mints nothing); add 24h pair cooldown + admin void + exclude from public ranking. Escrow-before-play means neither side can pull their ante after seeing the other's score.
- **Risks:** heaviest of the async set (challenge state machine open->answered->settled->expired); inherits score-validation cost (a bad mini forces deferred-tier full replay; JS RNG determinism fragile); thrown-match laundering toward one account (cap with cooldown + void + exclude from rankings); opponent may never answer (lazy expiry refund must be reliably callable from `my_duels()`).

### Option A4 — Shared-Seed High-Score Gauntlet  · effort **L**  · **DEFER**
Daily seed -> identical board for all. `enter_gauntlet()` debits a fee per attempt (first free, paid retries = sink). `submit_gauntlet_run()` records the score after the **server replays/plausibility-checks the input log** against the seed. Daily leaderboard top-N pays tickles by rank band at day-rollover.
- **Anti-abuse:** the heaviest in the set — full server REPLAY of the input log (never trusts the client number) + plausibility checks. Paid retries are snout sinks. Admin kill-switch + batch anomaly job.
- **Risks:** **deterministic replay is the single hardest thing in the whole idea**; JS RNG/float determinism across client + plpgsql is fragile and easy to get subtly wrong; pay-to-retry becomes a tickle faucet if retry cost < expected EV (needs a per-day attempt cap); leaderboard invites the most collusion pressure; highest build + maintenance cost — **do last, only after a deterministic replayable mini-sim is proven.**

### Bucket B — the realtime-multiplayer verdict: **NO (for now)**
True live sub-second authoritative multiplayer is NOT worth it on this stack:
- **RN/iOS suspends WebSockets on background** with no reliable background execution.
- **Supabase Realtime is poke-and-refetch only** in this app (no broadcast/presence in use, unauthoritative).
- There is **no game server**, and a dedicated one (Colyseus, ~$5-15/mo self-hosted on Fly.io/Railway) is a **standing ops tax** a solo local-build dev shouldn't take on — you'd still hand-build reconnection, disconnect-grace, and anti-cheat yourself. (The Hathora May-2026 shutdown is a warning against niche game hosts.)
- **The honest "Mario Party feel" is async-authoritative turns** (A3 duel is exactly this) **with an OPTIONAL Supabase Realtime presence/broadcast polish layer** (who's online, "opponent moved" nudge, lobby ready-check) added AFTER the async core works — best-effort flourish, never source of truth, with mandatory `removeChannel`-on-unmount and re-track-on-`AppState`-active.

### Mini-Games verdict
**Ship A1 (Snout Oracle) FIRST** — effort S, cheat-proof by construction, pari-mutuel keeps it a pure zero-sum transfer, reuses the lazy-resolver + claim + countdown templates almost verbatim. Then A2 (Daily Riddle) for genuine gameplay feel + a viral daily hook. A3 (Async Duel) is the realistic "Mario Party" substitute and the place to add optional Realtime presence polish. **A4 is deferred** until a deterministic replayable mini-sim exists.

---

## 4. HYBRIDS — fusing the three directions

The primaries don't have to ship as three separate modes. They share the same skeleton, so hybrids are mostly recombination. **The single highest-leverage hybrid recommendation is to build the Style Score data model once** (style-vector tags on hats) — Hybrids A, C, D, and E all consume it.

### Hybrid A — Sounder Showdown (team-vs-team pageant, per-capita Style Score)  · effort **L**  · **recommended hybrid**
Join a persistent faction (`choose_team`, cloned from `choose_allegiance`, 3-4 cozy pens). Each day a theme is date-seeded. Players "enter" by locking their current look (server reads the 9 slots — never a client payload). The faction's daily score = the **PER-ACTIVE-MEMBER AVERAGE** of its entrants' automated Style Scores, blended with participation rate so a small passionate pen beats a big lazy one. A team-partitioned two-sided board renders standings. Winning-pen entrants get `grant_tickles` + `grant_season_xp`; a personal effort ladder pays you for entering regardless of placement. **No peer voting at all -> zero vote-gaming surface.**

- **Reuses:** `choose_allegiance` -> `choose_team`; `AllegianceModal`/`AllegianceCard`; `app/_layout.tsx` launch gate; `alignment_leaderboard` two-sided board -> team-partitioned; `Leaderboard.tsx`; `SLOT_COLUMN`/`SLOT_FOR_CATEGORY`; `PigStage.tsx`; `grant_tickles`; `grant_season_xp` (`20260613000000_xp_for_social_actions.sql`); `daily_shop` date-seed.
- **New work:** `profiles.team`; `choose_team`; **hats style-vector columns (the shared dependency)**; `pageant_entries` (PK user+date); `enter_pageant` (snapshot + score server-side); `team_pageant_standings` (per-capita + participation blend); `resolve_pageant_day` (pg_cron); `utils/teams.ts`; `constants/styleAxes.ts`.

**Schema sketch:**
```sql
ALTER TABLE profiles ADD COLUMN team text CHECK (team IN ('clover','thistle','marigold','bramble'));
ALTER TABLE hats ADD COLUMN style_cool int DEFAULT 0, ADD style_pretty int DEFAULT 0,
  ADD style_cute int DEFAULT 0, ADD style_clever int DEFAULT 0, ADD style_tough int DEFAULT 0;
CREATE TABLE pageant_entries (user_id uuid, contest_date date, theme text, slots jsonb,
  style_score int, team text, PRIMARY KEY(user_id, contest_date));
-- enter_pageant(): SECURITY DEFINER; reads profiles.active_*_id; SUM matching style col
--   (+50% others); coherence + polish cap; INSERT ON CONFLICT DO UPDATE.
-- team_pageant_standings(p_date): AVG(style_score)*participation_factor per team,
--   ROW_NUMBER per team, UNION ALL like alignment_leaderboard.
-- resolve_pageant_day(): pg_cron daily; per-capita winner; grant_tickles + grant_season_xp;
--   INLINE system_announcements.
```

- **Anti-abuse:** per-capita (average not sum) -> stacking dilutes. Style Score server-computed from re-read slots -> no fake looks. Polish cap + diminishing returns (Sheen-cap anti-whale). One entry per `contest_date` (PK). Personal ladder > placement -> alt army buys almost nothing. Lock-once team membership -> no day-of pen-hopping. **No peer voting -> zero vote-gaming surface.**
- **Reward loop:** free (lock your look) or small snout grooming fee (sink); winning-pen entrants get modest tickles + season XP; personal ladder pays for N lifetime entries regardless of placement; winning pen gets an exclusive cosmetic at season end.
- **Risks:** the ~80-90 item style-tagging content pass; per-capita is harder to explain than a total (UI must make "average not sum" feel fair); small base -> thin pens (keep to 3-4; automated floor guarantees a non-degenerate result); new recurring live-ops surface to monitor.

### Hybrid B — Slop Raid (co-op faction contribution bar, multi-host Buried Truffle)  · effort **M**
Buried Truffle's pot mechanic scaled from one host to a whole faction. A weekly Slop Raid opens (per-faction, or global for v1). Members feed a shared pot with tiny daily actions they already do (each tickle/visit/blessing nudges the bar a fixed, daily-capped amount — a TRANSFER, not a mint). Progress shown at faction AND Sounder level (named friend contributions). On goal-cross or week-end, contributors claim a per-capita share + completion bonus. Unfilled pots refund lazily.

- **Reuses:** `truffle_shared_pot` (FOR UPDATE pot + bounded take); `item_drives` donate/fund/claim split + lazy refund; `TroughSection.tsx`; `BuriedMound`/`BuriedTruffleSheet`; `useBuriedTruffle`; `grant_tickles`; `visit_costs_tickles` daily-budget pattern; `profiles.team` (from Hybrid A); Judgement Day cron.
- **New work:** `slop_raids` (PK team+week), `raid_contributions` (PK raid+user); `contribute_to_raid`, `claim_raid_reward`, `resolve_raids` (pg_cron); faction bar + Sounder rail UI.
- **Anti-abuse:** contributions are transfers from `counter` (never minted) -> closed economy; per-player daily cap; per-capita share (alts split thinner); named Sounder rows (Ringelmann fix); unfunded pots refund.
- **Risks:** loafing if individual contribution isn't surfaced (ship the named Sounder rail); tuning stake + goal; per-faction needs the team column (global v1 avoids it but loses rivalry); keep the stake clearly separate from the primary snout mint to avoid confusing players. **Independent of the Style Score model — can ship anytime as the faction-bar plumbing validator** (this is essentially Teams Option B with a co-op pot skin).

### Hybrid C — Pig Pick'em (betting over pageant/event outcomes)  · effort **S**
Before a pageant day locks (Hybrid A) or any server-resolved event (alignment finale, fair) a market opens. Players spend snouts to predict the outcome; a hard `locks_at` closes the market before the result is knowable. After the event resolves (same pg_cron), correct predictors split a pari-mutuel pool as tickles; wrong picks forfeit stake. **The cheapest truly cheat-proof loop** — the server holds the answer, no peer-trust surface.

- **Reuses:** bounties insert-then-check claim; `item_drives` escrow/pool; `rpcAction` (market_locked/already_picked); `grant_tickles`; the pageant resolution (or alignment finale) as the event source; Judgement Day cron; `BountyCard.tsx` state-aware CTA.
- **New work:** `pick_markets`, `picks` (PK market+user); `place_pick`, `resolve_picks`, `claim_pick_reward`; `PickemCard`.
- **Anti-abuse:** server alone holds the outcome + hard submission-lock; no voting -> no collusion/Sybil for the prediction; pari-mutuel transfers (closed-loop); one pick per market (PK); optionally exclude betting on markets where you're an entrant.
- **Reward loop:** snouts staked; correct predictors split the pool as tickles; **wrong picks forfeit stake — a healthy deflationary sink** against the mint loop.
- **Risks:** needs an existing event to bet ON (best after Hybrid A or on the alignment finale; thin standalone); pari-mutuel math + lock timing must be exact; keep cozy/play-money framing (small snout stakes, tickle payouts); needs reliable scheduled resolution.

### Hybrid D — The County Fair (seasonal event bundling all three)  · effort **XL**  · **capstone, build last**
A pg_cron-scheduled, time-boxed seasonal event (3-7 days, like Judgement Day) opens a hub bundling the other hybrids as "stalls": the Runway (Hybrid A), Trough-Raising (Hybrid B), the Betting Tent (Hybrid C). Players earn Fair Tickets from any stall, filling a personal effort ladder AND a faction bar. At fair's end the cron resolves: top faction gets an exclusive cosmetic, everyone gets ticket-scaled participation rewards, a champion poster renders.
- **Reuses:** Judgement Day cron; `world_cup_event` scaffolding; Hybrids A+B+C as stalls; `Leaderboard.tsx` champion poster; `grant_season_xp`; `user_hats` ON CONFLICT; `app/_layout.tsx` popup-slot + finale-poll.
- **New work:** `county_fairs`, `fair_tickets`; `award_fair_ticket` helper (PERFORMed by each stall RPC); `resolve_fair` (pg_cron); Fair hub UI; fair cosmetics.
- **Anti-abuse:** inherits each stall's defenses; per-capita Fair Score; tickets from bounded actions; cosmetic flex not power; time-boxed window prevents indefinite farming.
- **Risks:** depends on A, B, C existing first; bundling three systems is a lot of UI + balance for a solo dev; seasonal cadence means long gaps unless paired with always-on lighter modes; cosmetic authoring + polished hub UI is significant.

### Hybrid E — Runway Duel (async 1v1 pageant challenge)  · effort **M**
On a shared daily theme, challenge a Sounder friend, staking snouts. Your locked look is snapshotted + scored server-side; the friend gets a push, locks their own look, matching the stake; the higher Style Score takes the tickle pot (tie splits). Pure async turn-based (the `tickle_trades` shape) — a row write per side, deterministic server-side resolution, no live connection, no peer-voting surface.
- **Reuses:** `trade_economy_flip` (`tickle_trades` 2-player async + pair cooldown); Hybrid A's Style Score scoring RPC; `UserSheet.tsx` ('Challenge to runway' affordance); `rpcAction`; `push_delivery` `send_push_to_user`; `are_blocked` (must consult); `grant_tickles`; `PigStage.tsx`.
- **New work:** `runway_duels` table; `challenge_runway`, `accept_runway`; `RunwayDuel` UI; 24h pair cooldown.
- **Anti-abuse:** both looks scored server-side from re-read slots; stakes are transfers paid out as tickles (closed-loop); 24h per-pair cooldown blocks thrown-match farming; friend-only + `are_blocked` consulted; deterministic comparison -> no peer-voting to game; a thrown match moves a small bounded pot between two consenting accounts and burns each side's cooldown.
- **Risks:** two colluding friends could swap wins to launder snouts->tickles (cooldown + small stake caps bound it; per-capita modes are safer for big stakes); depends on Hybrid A's scoring fn; async accept latency needs an expiry/refund path; friend-only scope limits audience.

### Hybrid verdict
**Sounder Showdown (A)** is the cleanest fusion of teams + pageant and resolves both of their hardest problems in one stroke: pageant pay-to-win/vote-gaming is killed by automated server-computed scoring (no peer voting at all), and team collusion is killed by per-capita averaging. It reuses the most already-shipped plumbing and is the **shared-dependency unlock** — the Style Score model it forces you to build is consumed by C, D, and E too. It is the most on-tone: cozy, friend-centric, no opponent sabotage, small passionate pen beats big lazy pen.

---

## 5. Cross-cutting foundations (build once, serve many)

1. **The entry-fee -> pool/escrow -> lazy-resolve -> idempotent-claim -> payout RPC chain.** Every mode is this pipeline. Idioms in-repo: debit via `UPDATE ... WHERE counter>=fee RETURNING` (bury_truffle/open_item_drive); lazy cron-safe resolve via `FOR UPDATE SKIP LOCKED` (resolve_expired_drives); idempotent claim via nullable `*_claimed_at` (claim_drive_reward) or insert-then-check-FOUND (claim_bounty). Standardize once.
2. **Two payout primitives:** `grant_tickles(uid,n)` (over-cap-safe, banks waste) for tickle prizes; counter->counter snout TRANSFER for snout prizes/pari-mutuel. **Pay down the GREATEST(...) display-debt** on the first over-cap grant.
3. **INLINE `system_announcements` INSERT** as the universal notify — never `send_system_announcement()` (admin-gated, silently rolls back payouts).
4. **A generic contest/event-window + entries substrate:** deterministic UTC window (current_week_start / daily_shop date-seed) + per-(period,player) PK ledger. Oracle rounds, pageant events, wallow cycles, drove seasons, daily puzzles, gauntlet days are all reskins.
5. **The lock-once picker:** choose_allegiance() skeleton + AllegianceModal/AllegianceCard + the app/_layout.tsx popup-slot launch gate -> any team/drove mode for free.
6. **The Style Score data model** (5 style-vector columns + style_score() + public_pig_look()). The most leveraged foundation: one content cost (tag ~80-90 items) unlocks solo pageant, team pageant, pick'em, and runway duel.
7. **The shared contribution-bar vocabulary:** TroughSection.tsx + truffle_shared_pot pot engine, with named Sounder-level rows (Ringelmann anti-loafing) — for Big Wallow, the drove mud-pit, and Slop Raid.
8. **Per-capita (average-not-sum) settlement** as a reusable function — the structural anti-collusion lever for every team mode.
9. **The anti-abuse trio for any leaderboard/friend-vs-friend mode from day one:** admin void/kill-switch (status='voided' refunds via the same path), a periodic batch anomaly query, and friend_ids() exclude/discount.

---

## 6. Recommended sequencing across all three ideas

**Phase 1 — Prove the plumbing (cheapest, safest).** Ship **Snout Oracle (A1, S)** — cheat-proof, economically inert, exercises the entire cross-cutting spine end to end and forces the GREATEST(...) display-debt fix. Optionally follow with **Daily Riddle (A2, M)** for gameplay feel + a viral daily hook.

**Phase 2 — Cozy team loop, then competitive.** Ship **Big Wallow (Teams B, M)** — lowest-risk team feature, validates live-computed progress, per-player base snapshot, pull-based claim, pg_cron settlement. Then layer **The Great Mud-Off (Teams A, L incremental)** — add only choose_drove + per-capita settlement. (Slop Raid / Hybrid B is the same faction-bar plumbing with a co-op-pot skin — a fine alternative Phase-2 win if you'd rather prove that before pageant content labor.)

**Phase 3 — Pay the pageant content tax once, harvest four modes.** Build the **Style Score model + style_score() + public_pig_look()** and ship a **SOLO daily pageant** first (validates the scoring fn with zero collusion/critical-mass risk via the 60% automated floor). Then **Sounder Showdown (Hybrid A, L)** — team-vs-team per-capita pageant, reusing the now-shipped team column + style model, dodging BOTH hard problems. **Pig Pick'em (Hybrid C, S)** then layers trivially over the pageant outcome, and **Runway Duel (Hybrid E, M)** reuses the exact scoring fn. The peer-vote **Async Daily Themed Catwalk (Pageant A)** is the alternative if you specifically want an audience-vote social layer; keep blind-vote / pairwise-Elo (Pageant C) as a v2 voting upgrade only if you want that layer and observe brigading.

**Defer indefinitely:** High-Score Gauntlet (A4 — deterministic replay is the hardest/most-fragile thing here + biggest faucet risk), the Pokemon-faithful seasonal ladder (Pageant B, XL, thin high-rank cohorts), and the County Fair capstone (Hybrid D, XL, depends on A+B+C). **Do NOT build live realtime** — async-authoritative turns + optional Realtime presence polish is the ceiling.

---

## 7. The single highest-leverage thing to prototype first

**The Snout Oracle (Mini-Games A1).** It is the minimum viable exercise of the cross-cutting spine every other mode depends on, at the lowest risk in the whole exploration: cheat-proof by construction (server owns the answer; the only attack — late entry — dies to a `lock_at` check), and economically inert (pari-mutuel is a pure zero-sum snout transfer that cannot inflate the closed economy no matter how it's gamed). At effort **S** it delivers the full pay-snouts/win-tickles/cooldown loop with the least new code, and forces you to pay down the known `GREATEST(...)` over-cap display debt on the first real `grant_tickles` payout — benefiting every mode shipped afterward. One small, safe build validates the foundation, the economy invariants, and the live-ops resolution cadence that Teams, Pageant, and every hybrid will lean on.

---

## 8. Open questions (consolidated)

**Teams**
- Drove count/theme: 3 or 4? (Fewer = clearer identity but more clique co-location; per-capita is the safety net either way.)
- Season length: 2 weeks (faster drama) or 4 weeks (content cadence)? Mud Derby: 48 or 72h?
- 'Active member' threshold for per-capita: minimum season contribution to count toward the denominator? (Too low -> alts pad; too high -> casuals excluded.)
- Daily contribution cap: hard cap (= daily tickle throughput) or diminishing returns?
- Payout bands (e.g. 5/15/30 bronze/silver/gold) — keep below pay-to-win; effort > placement.
- Drove pick: reset each season (strategic re-balance) or lock permanently (max belonging, but stuck on a dead drove)? Research leans 'no mid-season hopping'; cross-season re-pick is open.
- Confirm the GREATEST(...) display-debt fix ships with the first over-cap grant.

**Pageant**
- Realistic daily active count? (Decides cohort size and whether absolute-entry voting survives or you must start pairwise.)
- Entry fee: free (max turnout) vs small snout sink? (Recommend free v1.)
- Confirm scoring only the ~6-7 live visible slots, excluding the dead neck slot.
- Should rarity multiply style points (rewards spend) or be decoupled (cheap curated set can win)? (Recommend mild rarity potency + strong diminishing cap.)
- Ribbon mechanics: occupy a real worn slot (which?) and feed back into Style Score, or trophy-wall only?
- Account-standing weight source: confirm streak/Devotion + account-age fields, or approximate with tickles_earned / created_at?
- Theme cadence: daily (variety, more closet-use) vs weekly (calmer)?
- Expose full looks via public_pig_look only inside a pageant window, or always? (Privacy: currently only hat+flag are cross-player visible.)

**Mini-Games**
- A1 question sources: purely game-internal signals (global counter threshold, top-donating Sounder, seeded coin) or any external feed (adds a fetch dependency)?
- Currency direction per game: tickles (fits 'win tickles' + closed economy) vs snout transfers (pari-mutuel is naturally snout-denominated)? (A1 most natural snouts->snouts; A2 snouts-in->tickles-out.)
- Paid retries (a sink that drives 'keep playing' but risks a tickle faucet if mispriced) in A2/A4, or strictly one-per-cooldown?
- A1 round cadence: every few hours (needs pg_cron or aggressive lazy-resolve) or once daily?
- Public cross-Sounder leaderboard (A4) or scoped to your Sounder/friends to blunt collusion?
- Willing to add ONE pg_cron job for round open/resolve, or must everything stay lazy-resolved from read paths?

**Hybrids**
- How many factions/pens given a small active base — fewer (denser brackets) or accept thin days and lean on the automated floor?
- Team membership lock-once (has precedent + code) or season-resettable (brand-new capability, no pattern)?
- Is a snout sink desirable now? (Pick'em forfeits + duel loser stakes are deflationary counterweights to the mint loop.)
- LLM-assisted style-vector tagging (spot-checked) vs hand-authored (control over the meta)?
- Slop Raid: couple a small stake onto the core tickle loop (richer, risks muddying the mint) or keep raid contribution a separate explicit action?
- Pick'em / Runway Duel: friend-scoped, global, or both?
- Cosmetic budget: how many new catalog items + art per season for winner cosmetics?

---

## 9. Branching ideas (lower-priority sparks)

**Teams**
- **Sounder-as-sub-team:** a 'your Sounder vs the drove average' rail — small-group warmth inside the large faction, reusing the friends graph (no new membership table).
- **Mud-pit barn artifact:** a persistent tappable on-barn mud-pit (reuse BuriedMound vocabulary) that fills as the drove roots.
- **Redeem the dangling allegiance reward:** the World Cup allegiance modal promises a champion reward no code redeems — build the grade-against-champion settlement ONCE in settle_drove_season() to cover both.
- **Drove-buffed regen:** a small tickle-regen 'momentum' buff folded into regen_secs_for() (single source of truth).
- **Convert wasted tickles into muck:** let players burn tickles_wasted_total into the mud-pit, turning a dead overflow stat into a contribution axis.
- **Presence flourish:** an ephemeral Realtime BROADCAST 'X pigs from your drove are rooting now' counter on the pit bar (unauthoritative, additive).

**Pageant**
- **Pageant-themed daily_shop tie-in:** surface theme-matched items on the day their theme runs (reuses the date-seeded selector).
- **Sounder team pageants:** a sounder's best-3 looks vs another's, reusing friend_ids + the Trough split.
- **'Style your friend' gifting:** spend snouts to gift a theme-matched item before a pageant.
- **Wasted-tickle glam-up:** convert tickles_wasted_total into a one-event polish boost.
- **Judge persona of the day:** a date-seeded NPC judge with a style bias that tilts the on/off-theme weighting.
- **Runway pedestal barn artifact** (reuse BuriedMound) showing last placement + a 'check on it' sheet.
- **Bounty integration:** a 'place top-3 in a pageant' bounty code (utils/bounties.ts mirror, no new claim infra).

**Mini-Games**
- **Wager bounties:** Oracle predictions count toward a weekly bounty code ('place 5 correct omens this week').
- **Curse/blessing tie-in:** expose an active warm_tea/sluggish_snout ritual effect as a score buff/debuff via the reward band (reuse regen_secs_for() pattern).
- **Convert wasted tickles** into mini-game entry currency.
- **Soft-live polish path:** once A3 works, add Realtime PRESENCE ('opponents online') + BROADCAST ('your rival answered') — cheapest liveness, additive, bounded by RN backgrounding.
- **Seeded co-op Trough variant:** a Sounder collectively chips snouts at a shared seeded puzzle and splits a tickle pot on solve.
- **Spectator/parlay:** friends bet snouts on an A3 duel's outcome (pari-mutuel side pool reusing the A1 resolution engine).

**Hybrids**
- **Wasted-Tickle Carnival stall:** convert tickles_wasted_total into Fair Tickets / pick'em stakes.
- **Pen Patron pick'em:** bet that a SPECIFIC friend's look beats the daily theme average.
- **Happiness-weighted pageant bonus:** a pig in the Happy band gets a small Style Score multiplier — ties dressing up to consistent care.
- **Theme-combo coherence sets** (named outfits) granting a flat synergy bonus — the Contest Combination mechanic as authored content.
- **Streak/Devotion as the trust weight** for any peer-rating flourish (reuses a shipped loyalty signal as Sybil defense).
- **Habitat pageant:** a second axis judging the decorated Barn Interior (6 habitat slots) — same skeleton, different slot set.
- **Alignment-flavored fair stalls:** a Giver-vs-Greedy fair where existing alignment sides ARE the two teams — the lowest-effort path to a team event (no new team column at all).