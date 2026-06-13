# Snout Oracle
> Read the entrails of the barn: stake your snouts on what's about to happen, and split the losers' pot with every pig who saw it coming.

**Tier:** Core mode · **Effort:** M · **Mode:** Async pari-mutuel prediction (server owns the answer; lock-then-resolve) · **Depends on:** Shipped primitives only — `bury_truffle` atomic debit, `item_drives` escrow/refund, `daily_shop()` date-seed, `dig_truffle` `FOR UPDATE` depletion, `grant_tickles`, INLINE `system_announcements`. Front-resolvable catalog rows additionally need the Schism Front (`profiles.faction`) once it ships, but ship **disabled** until then — the mode is fully standalone on day one.

## The fantasy
You are the barn's soothsayer. Twice a day a question hangs in the air — *will the Givers out-bless the Greedy before sundown? will more truffles get dug than yesterday?* — and you put your snouts where your snout is. When the bell rings and the oracle speaks, the pigs who read the omens right carve up the pot the wrong-guessers left behind. It is gambling stripped of the house: no snout is ever minted or burned by the oracle, only **moved** from the wrong to the right. The feeling is *cunning rewarded* — you didn't grind harder, you saw clearer.

## Player loop
**The daily action (≈10 seconds):**
1. Open the **Snout Oracle** card (lives on the Barn home, near the Trough/Truffle social row). It shows the current round: a prompt, 2–4 options, a live pot, a countdown to `lock_at`, and per-option stake tallies ("the herd is leaning 70% Givers").
2. Pick one option and confirm a **fixed buy-in** (default 20 snouts, mirroring the truffle/drive stake size). Snouts are debited atomically; your pick is locked into the round ledger. One pick per round — that PK row *is* your cooldown.
3. Watch the herd's lean shift as others bet (a read-only tally, refreshed on focus — no realtime authority).
4. After `lock_at` the round is sealed. The next time anyone opens the Oracle (or a cron tick fires), the server **resolves** it from data it already holds and the round flips to `resolved` with an `outcome`.
5. Come back, tap **Claim**. If you were right you bank your stake back plus your pro-rata cut of the losers' pot; the result drops a personal line into your feed. If you were wrong, the card says so warmly ("The omens favored the Greedy today — better reading tomorrow") and your stake is gone to the winners.

**Cadence nesting:** rounds run on a **~6h cadence** (4 rounds/UTC-day) with a `lock_at` partway through each window so there's always a live round and a recently-resolved one to claim. Rounds are minted deterministically from the date-seed (no cron to *open*). The day's slate is a light **ritual** — like the daily shop refresh — and over a Season the running tally of correct calls becomes a quiet identity stat ("Oracle accuracy 61%") that later layers (titles, a Seer ribbon) can hang off without changing the core.

## Mechanics

**Round lifecycle:** `open → (lock_at passes) → resolved | voided`.
- **Open:** accepts picks while `now() < lock_at`. A pick after lock is rejected (`locked`) — this is the *only* live attack surface and it dies to one timestamp check.
- **Resolve (lazy + cron):** the first caller after `lock_at` triggers `resolve_oracle_round` (or a `pg_cron` tick — optional polish). Resolution computes `outcome` from a `CASE` on the round's `resolver_key` against tables the server already owns. Resolution is wrapped in `FOR UPDATE SKIP LOCKED` so concurrent callers can't double-resolve (clone of `resolve_expired_drives`).
- **Void:** admin kill-switch (`void_oracle_round`) or auto-void if a resolver can't compute a clean answer (e.g. a tie on a "which side leads" question with no tiebreak) → full refund of every stake, `counter -> counter` back to each picker.

**Pari-mutuel payout math (zero-sum, the load-bearing invariant):**
After `outcome` is set, with `S_w` = total stake on the winning option and `S_l` = total stake on losing options:
- If **no one** picked the winning option **OR** there are **no losers** (everyone agreed): **refund all** — every stake returns `counter -> counter`. Never strand snouts on a degenerate round.
- Otherwise each winner `i` with stake `s_i` is owed:
  `payout_i = s_i + floor(S_l * s_i / S_w)`
  i.e. your stake back **plus** your proportional cut of the entire loser pot.
- **Floor() dust** (the few snouts lost to integer rounding across winners) is **burned** (left in the void), making the round very slightly deflationary — never inflationary. `SUM(counter)` across all participants is conserved minus dust.

**Buy-in:** fixed per round (`BUY_IN = 20` snouts, named SQL constant). A flat buy-in keeps the pool math a clean headcount-weighted split and makes the "herd lean %" honest. (Variable stake is a v2 fork; the schema already stores `stake` per pick so it's a one-line relaxation.)

**Cooldown / idempotency:** `oracle_picks PK(round_id, player_id)`. A second bet on the same round hits the PK → `already_bet`, **no charge** (mirrors `already_buried` / `already_dug`). Claim is idempotent via the nullable `claimed_at` — claiming twice returns `already_claimed`, no double-pay.

**Caps:** at most one open round per `resolver_key` family at a time (so the slate never shows three near-identical "which side leads" questions). The date-seed picks a small slate (2 concurrent rounds) from the **enabled** catalog, salted by the round window index so the 00:00 and 06:00 rounds differ.

**Edge cases:**
- *Resolver indeterminate* (e.g. exact tie, source table empty) → void + refund.
- *Player bets, then the round voids* → refund their exact stake.
- *Player never claims* → snouts sit owed indefinitely (the ledger row is the source of truth); a v2 cron can auto-sweep stale claims, but lazy claim is the MVP.
- *`is_test` accounts* are excluded from any resolver that reads aggregate player state (alignment lead, truffles dug), exactly as the Mud-Off CTE excludes them — so a test account can't move a real outcome.

### The question catalog (`resolver_key`s)
Every round is a row in `oracle_question_catalog` tagged with a `resolver_key` enum + `param jsonb`. `resolve_oracle_round` is a `CASE` on `resolver_key`. **A question is legal iff its answer is a deterministic function of rows the server already holds by `lock_at`.** New questions are *data rows, not code* — curation without heavy ops. Catalog families:

**Phase 1 — self-resolvable today (ship enabled):**
| `resolver_key` | Prompt shape | Resolves from | Options |
|---|---|---|---|
| `seeded_coin` | "Will Rosie snort heads or tails at dusk?" | `abs(hashtext('oracle_coin' \|\| round_id::text))` parity — pure seed, **always available**, the guaranteed-filler round | heads / tails |
| `alignment_lead` | "Which way does the herd tilt by lock?" | sign of `SUM(alignment) FILTER (is_test=false)` at resolve | Greedy / Giver |
| `blessings_vs_curses` | "More blessings or more curses cast today?" | count of today's blessing vs curse rows (the ritual ledger) | blessings / curses / tie→void |
| `truffles_dug_vs_yesterday` | "More truffles dug today than yesterday?" | `COUNT(truffle_digs)` today vs the prior UTC day | more / fewer-or-equal |
| `trough_funded_today` | "Will any Trough boil over before lock?" | `EXISTS (item_drives WHERE status='funded' AND ...)` | yes / no |
| `lucky_counter_cross` | "Will the global snout counter cross {N} by lock?" | `SUM(profiles.counter)` vs `param.threshold` | yes / no |
| `daily_shop_rarity` | "Will today's shop hold a {rarity}+ item?" | re-derive `daily_shop()` rarities (deterministic) | yes / no |
| `visits_milestone` | "Will today's barn-visit count beat {N}?" | `COUNT(barn_visits today)` vs threshold | yes / no |

**Phase 2 — Schism Front-resolvable (catalog rows present but `enabled=false` until the faction column ships):**
| `resolver_key` | Prompt shape | Resolves from | Options |
|---|---|---|---|
| `front_daily_lead` | "Which faction polishes ahead by lock — Hilltoppers or Valleyfolk?" | the Mud-Off `avg_per_active` per faction at resolve (the §2.1 standings CTE) | hilltoppers / valleyfolk / tie→void |
| `front_cycle_winner` | "Who takes this Mud-Off cycle?" | `mud_off_cycles.winning_faction` after `resolve_mud_off` | hilltoppers / valleyfolk |
| `front_quorum_met` | "Will both pens hit quorum this cycle?" | `COUNT(*) FILTER(contrib>0) >= QUORUM` both sides | yes / no |

The Phase-2 rows let the Oracle become a **deflationary spectator sink** on the Schism Front: you bet snouts on the team war you may not even be grinding, and the catalog "lights up" the day the faction column lands — zero new Oracle code, just `UPDATE oracle_question_catalog SET enabled=true WHERE resolver_key LIKE 'front_%'`.

## Schema sketch
Migration prefix must sort **after** `20260623000000` → use `20260624000000_snout_oracle.sql`.

```sql
-- Catalog of question TEMPLATES (data, not code). Clones nothing — new table.
CREATE TABLE public.oracle_question_catalog (
  id           bigserial PRIMARY KEY,
  prompt       text   NOT NULL,
  options      text[] NOT NULL CHECK (array_length(options,1) BETWEEN 2 AND 4),
  resolver_key text   NOT NULL,                  -- the CASE branch in resolve
  param        jsonb  NOT NULL DEFAULT '{}',     -- thresholds, etc.
  enabled      boolean NOT NULL DEFAULT true,     -- front_* rows ship false
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- A live round, minted from the date-seed off the catalog.
CREATE TABLE public.oracle_rounds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id   bigint REFERENCES public.oracle_question_catalog(id),
  prompt       text   NOT NULL,
  options      text[] NOT NULL,
  resolver_key text   NOT NULL,
  param        jsonb  NOT NULL DEFAULT '{}',
  opens_at     timestamptz NOT NULL DEFAULT now(),
  lock_at      timestamptz NOT NULL,             -- bets close here
  resolved_at  timestamptz,
  outcome      int,                              -- index into options[]
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','resolved','voided'))
);
CREATE INDEX oracle_rounds_open ON public.oracle_rounds (status, lock_at);

-- One pick per (round, player). This PK IS the cooldown + the idempotent claim.
-- Clones the truffle_digs one-action ledger shape.
CREATE TABLE public.oracle_picks (
  round_id   uuid NOT NULL REFERENCES public.oracle_rounds(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pick       int  NOT NULL,                      -- index into round.options[]
  stake      int  NOT NULL CHECK (stake > 0),
  payout     int,                                -- null until resolved
  claimed_at timestamptz,                        -- null until claimed
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, player_id)              -- second bet -> already_bet
);

-- Constants in RPC bodies: BUY_IN=20, SLATE_SIZE=2, ROUND_HOURS=6.
```

**RPCs** (all `SECURITY DEFINER SET search_path TO 'public'`, returning `jsonb {ok, ...}` like every shipped RPC):

```
place_oracle_bet(p_round_id uuid, p_pick int) -> jsonb
  -- clones bury_truffle: INSERT the pick row FIRST (catch unique_violation ->
  --   'already_bet', no charge), validate lock_at > now() and pick in range,
  --   THEN debit counter via `UPDATE profiles SET counter=counter-BUY_IN
  --   WHERE id=caller AND counter>=BUY_IN RETURNING counter`; if too_poor,
  --   DELETE the pick row and return 'too_poor'.

resolve_oracle_round(p_round_id uuid) -> jsonb
  -- clones resolve_expired_drives: SELECT ... FOR UPDATE SKIP LOCKED guarded
  --   on status='open' AND lock_at<=now(); compute outcome via CASE on
  --   resolver_key; set payout per pari-mutuel math; if no winners/no losers
  --   OR indeterminate -> refund all + status='voided'; else status='resolved'.
  --   Refunds/payouts are deferred to claim (only sets payout col here), so
  --   resolve stays cheap and lazy-callable. is_test excluded from aggregate
  --   resolvers.

claim_oracle_payout(p_round_id uuid) -> jsonb
  -- idempotent on claimed_at: if already claimed -> 'already_claimed'; else
  --   UPDATE profiles SET counter=counter+payout WHERE id=caller (counter ->
  --   counter, the loser pot is the source); set claimed_at; INLINE
  --   INSERT INTO system_announcements (user_id, kind, title, body, data)
  --   with kind='oracle_result' (NEVER send_system_announcement).

oracle_status() -> jsonb
  -- STABLE read: lazily mints the date-seeded slate if missing, lazily resolves
  --   any past-lock open round, then returns current open round(s) (prompt,
  --   options, lock_at, live pot, per-option stake tally, caller's pick) +
  --   caller's claimable resolved rounds (outcome, payout). Clones my_drives.

void_oracle_round(p_round_id uuid) -> jsonb   -- admin/test kill-switch, refunds all.
```

**Round minting** is a STABLE helper inside `oracle_status` (no cron to open): pick `SLATE_SIZE` rows from `oracle_question_catalog WHERE enabled` ordered by `abs(hashtext(id::text || current_date::text || window_index::text))`, where `window_index = floor(extract(epoch from now())/ (ROUND_HOURS*3600))`. Same date-seed idiom as `daily_shop()`, salted per window so the 4 daily rounds differ.

## Economy
- **Snout sink/source: none net.** The Oracle is a pure `counter -> counter` redistribution — the only source of any winner's payout is the losers' stakes. `SUM(profiles.counter)` is **conserved per round minus floor() dust**, which is burned (mildly deflationary). It cannot inflate the closed economy because it never calls `grant_tickles` and never mints `counter`. This is the cheapest cheat-proof, economically-inert loop in the build — exactly why the pinned design makes it the keystone/Phase 1.
- **Tickle faucet: deliberately none in the MVP settle path.** Keeping `grant_tickles` out of the Oracle is what guarantees `SUM(counter)` conservation and zero inflation. (A tiny *participation* `grant_tickles` consolation — e.g. 1–2 tickles for placing a pick, once/UTC-day — is an explicit v2 fork. If added, **that** migration must ship the `GREATEST(...)` display-debt fix to `home_stats` + `admin_tickle_overview` per the `settle_tickles` header, since it'd be a faucet. The MVP intentionally avoids that surface.)
- **Cosmetic rewards:** none in MVP (the pot *is* the reward). v2: a non-purchasable **Seer's Eye** ribbon granted via `user_hats ON CONFLICT DO NOTHING` once a player crosses N correct calls in a season — a status cosmetic, never sold, zero mint.
- **Why it can't inflate:** every snout paid out came from a snout staked and lost in the same round. There is no faucet in the loop. The buy-in keeps a floor under round liquidity; dust burn keeps it net-deflationary.

## Anti-abuse / cheat model
**Cheat tier (a): server owns the answer.** This is the strongest tier in the MiniClip-adaptation cheat hierarchy and the reason the Oracle is cheat-proof *by construction*:
- **No client computation of the outcome exists.** The answer is a function of server tables computed *inside* `resolve_oracle_round` strictly *after* `lock_at`. There is nothing on the client to fake, mod, or replay. A modded client can submit a pick — but a pick is just a guess.
- **Late-entry attack (the only one) dies to `lock_at > now()`** checked server-side in `place_oracle_bet`. You cannot bet after the window closes, so you can never bet *knowing* the answer.
- **Self-resolving the outcome via your own play** is bounded: aggregate resolvers (`alignment_lead`, `truffles_dug_vs_yesterday`, etc.) sum over the whole herd with `is_test=false` excluded, so a single account (or a test account) can't swing them. Per-option *threshold* params are chosen above any individual's reach.
- **Collusion / vote-gaming: not applicable.** Unlike the Pageant (peer voting, tier-d trust surface) or team modes (per-capita collusion), pari-mutuel has **no vote and no shared score to game** — a syndicate all betting the right option simply splits a smaller pot among more of themselves (they fund their own payout). There's no exploit, only redistribution.
- **Farming / alts:** alts must each pay the buy-in from real (transfer-only, non-mintable) snouts to participate, and winning an alt's stake back from your other alt is a wash minus dust — strictly *negative* EV. `is_test` excluded from resolvers and from any leaderboard.
- **Double-resolve / double-claim:** `FOR UPDATE SKIP LOCKED` on resolve + nullable `claimed_at` on claim. Concurrency-safe like the shipped truffle/drive RPCs.
- **Degenerate rounds** (no winner / no loser / tie) auto-void and refund — the server never keeps stranded snouts, removing any "the house ate my bet" trust break.

## Feel
Against the evoke-online-game-feel lenses, keeping the cozy guardrail (warm copy on losses, no doom):
- **Emergent drama** — the live herd-lean tally turns each round into a quiet crowd-read; a contrarian win against an 80% herd is a genuine story ("everyone called Givers and the Greedy snuck it").
- **Earned mastery** — over a season your accuracy stat is real skill at reading the barn's state, not grind. Mastery here is *insight*, which the rest of TTP (a care game) otherwise never rewards.
- **Persistent-world FOMO** — a round you didn't enter resolves whether you showed up or not; the ~6h cadence makes "check the oracle" a low-stakes habit without daily-login coercion (you can skip rounds freely).
- **Quirky charm** — "reading the entrails of the barn," Rosie snorting heads-or-tails, omen flavor text. The `seeded_coin` filler is pure whimsy.
- **Belonging / hangout** — once Phase-2 lights up, betting on the Schism Front lets non-grinders *participate in the team war as spectators-with-stakes*, a bleacher's seat at the Mud-Off.
- **Identity** (light, v2) — the Seer's Eye ribbon and accuracy stat. Cozy guardrail: losing copy is gentle ("better reading tomorrow"), never punitive; there's no leaderboard of losers.

## How it composes
- **Schism Front meta-frame:** the Oracle is the Front's **spectator betting layer**. The pinned build order ships the faction column with the Mud-Off (L); the day it lands, the Phase-2 `front_*` catalog rows flip `enabled=true` and the Oracle becomes the way the whole herd — including players who never picked a faction — has skin in the team war. `front_cycle_winner` reads `mud_off_cycles.winning_faction`; `front_daily_lead` reads the exact §2.1 per-capita standings CTE. The Oracle thus *amplifies* Front drama without adding Front mechanics.
- **Spine reuse, downstream supply:** the Oracle proves the **entry-fee → pari-mutuel pool → lazy-resolve → idempotent-claim → `counter -> counter` transfer** spine that the Pageant, Mud-Off pit, and any future async duel all reuse. It is explicitly the keystone that de-risks every later mode.
- **Other mini-games:** the Daily Riddle (v1.1) layers the *tickle faucet* + share-grid virality the Oracle deliberately omits; together they cover both economy halves (Oracle = snout redistribution, Riddle = bounded tickle mint). A future "call the Hurl/Showdown" pick'em is just new `resolver_key` rows on this same table — recombination, not new code.
- **Home loop framing:** the Oracle card sits in the Barn's social row beside the Trough and Truffle, reinforcing those as "the things you do for/with the herd between tickles."

## MVP
**One migration (`20260624000000_snout_oracle.sql`) + one component (`components/OracleCard.tsx`) + one `utils/oracle.ts` typed wrapper around `rpc<T>()`.**

The migration ships:
1. The 4 tables (`oracle_question_catalog`, `oracle_rounds`, `oracle_picks` — `puzzle_*` tables are out of scope, they belong to the Riddle).
2. ~8 Phase-1 catalog rows enabled + ~3 Phase-2 `front_*` rows seeded `enabled=false`.
3. The 4 core RPCs + `void_oracle_round`, with `resolve_oracle_round`'s `CASE` covering only the Phase-1 resolver_keys (the `front_*` branches stubbed to void-if-source-missing so they're inert until the faction column exists).
4. The lazy slate-mint + lazy-resolve inside `oracle_status` (no `pg_cron`).
5. INLINE `system_announcements` (`kind='oracle_result'`) in `claim_oracle_payout`. **No `grant_tickles` anywhere** — so this migration touches zero tickle display surfaces and carries no display-debt fix.

`OracleCard` renders: current round (prompt, options, countdown, pot, herd-lean tally), a confirm-buy-in tap, and a claim affordance for resolved rounds, all driven by `oracle_status()` on focus. This single seed exercises the entire keystone spine, is cheat-proof, and is economically inert — the smallest thing that proves the most.

## Risks & open questions
- **Liquidity on a small base (solo-dev reality):** with few players a round can have 1–2 pickers and the "no losers → refund all" / "no winners → refund all" branch fires constantly, making early Oracle feel like nothing happens. Mitigation: the refund branch is *correct, not a bug* (never strand snouts); but the felt loop needs a quorum of bettors. Open question: do we want a **seed pot** (the barn tops up a tiny house stake to make small rounds pay) — which would technically mint a few snouts and break the pure-zero-sum invariant? Lean **no** for MVP; revisit if rounds feel dead.
- **Cadence content cost:** ~6h cadence = 4 rounds/day, all auto-minted from the catalog, so *zero* per-round authoring once the catalog exists — but the **catalog itself** is the solo-dev content tax. ~8 good Phase-1 questions is enough to start; keeping them feeling fresh (not the same coin-flip every window) needs ~20–30 templates eventually. The `param` thresholds (`lucky_counter_cross`, `visits_milestone`) need tuning to the live base or they're always-yes/always-no and boring.
- **Resolver correctness is the whole game:** a `resolver_key` that's subtly non-deterministic, or reads a row not yet settled by `lock_at`, silently produces a wrong "answer" with real snouts on the line — a trust break far worse than a normal bug. Every resolver needs a unit test asserting determinism and a hand-checked golden round before its catalog row is enabled.
- **Cadence vs the daily-ritual habit:** 4 rounds/day may be too many to track on a cozy game; 1–2/day might read better. Cadence is a one-constant change (`ROUND_HOURS`) — but it's a genuine taste fork (the pinned doc lists "Oracle cadence" as an open fork, leaning 6h).
- **Phase-2 dependency timing:** the `front_*` rows are dead weight until the faction column ships (after the Pageant in the build order). If the faction column slips, the Oracle stays Phase-1-only indefinitely — fine, it's standalone, but the "spectator layer on the Front" payoff is gated on that prerequisite landing.
- **Variable stake vs flat buy-in:** flat keeps the pool math and herd-lean honest; variable stake is more expressive but lets a whale's wallet dominate a small pot. Schema supports both (`stake` column); MVP locks flat. Open fork.