# Snout Drop (Truffle Plinko)
> Bury a pot of snouts, hand each friend ONE pig to drop down the peg board — the truffle they unearth at the bottom is their cut of your buried treasure.

**Tier:** Mini-game · **Effort:** M · **Mode:** Co-op pot (async, lazy-resolve, atomic share claim) · **Depends on:** nothing — standalone. Pure reuse of the shipped Buried Truffle stack (`bury_truffle`, `truffles`, `truffle_digs`, `dig_truffle`), `daily_shop()`'s date seed, `shift_alignment`, and the INLINE `system_announcements` notify pattern.

## The fantasy
You are the generous host who buried a *fat* pot of snouts and rigged a peg board over it, then invited the Sounder to come try their luck. Each friend is the hopeful gambler-pig holding a single trotter on the drop lever: pick a lane, let the pig tumble through the pegs, and watch where it lands. The cozy thrill is the bounce — you don't aim a trajectory, you commit to a column and *hope the pegs are kind* — and the social warmth is that the snouts you win came out of a friend's own buried stash, with a "your truffle was found!" note trotting back to them.

## Player loop
**As host (the burier):**
1. From your Barn, tap "Set out a Snout Drop" and stake a pot of `{10, 20, 50}` snouts (verbatim the `bury_truffle(p_amount)` choice set). This debits your `profiles.counter` and seeds the pot — exactly like burying a truffle, but the truffle is wearing a peg board.
2. Check on it anytime via the host status sheet: pot total, how much remains, and the list of friends who've dropped (the `truffle_status()` diggers list, re-skinned).
3. One active Snout Drop per host at a time (`truffles_one_active_per_host` partial unique index). When the pot empties, you can set out a fresh one.

**As guest (the dropper):**
1. Visit a friend's Barn. If they have an active Snout Drop, the peg board renders over the buried pot.
2. You get **ONE drop per board** (the `truffle_digs` PK `(truffle_id, digger_id)` enforces one-action-per-player). Choose a **drop column** `1..N` — that single integer is the *only* thing that crosses the wire.
3. The server runs `deterministic_bounce(seed, column)` to a payout bin, atomically claims `LEAST(bin_share, remaining)` of the host's pot, pays you `counter → counter`, and shows a lucky-pig burst-modal reveal for a fat bin.
4. The host gets a "your Snout Drop was found!" announcement and `+1` toward Giver alignment (`shift_alignment(host, +1)`), tied to a *real* friend's drop so it can't be self-farmed.

**Daily / weekly / seasonal nesting:** The board's bin layout is re-seeded each UTC day from `daily_shop()`'s `abs(hashtext(host_id || current_date))` idiom, so "today's board" is a shared shape every guest sees the same — a soft daily reason to revisit Barns before the pegs reshuffle. First drop of the UTC day grants `grant_season_xp(caller, 3)` (verbatim the `dig_truffle` first-dig-of-day rule), threading the mini-game into Season 1's Judgement Day climb. Across a week the host's generosity (pots set out, snouts paid out) reads as Giver-aligned momentum on the private alignment axis.

## Mechanics
**Inputs & resolution**
- Client sends exactly one integer: `p_column ∈ 1..N` (default **N = 7** lanes — the "six-seven" wink lands at 7). Anything out of range is rejected.
- `landing_slot := deterministic_bounce(seed, p_column)` is computed **entirely server-side**. No trajectory, no physics steps, no bounce log ever crosses the wire — only the chosen lane in, the resolved bin out. This is the tier-(b)-near-(a) property the seed brief demands.
- `deterministic_bounce` is a pure SQL function: for a board of `ROWS = 8` peg rows, walk `ROWS` deterministic left/right deflections derived from `hashtext(seed || ':' || p_column || ':' || row_index)`, sum the rightward steps, and map the resulting `0..ROWS` position to one of the bins. Because every input is a recorded scalar and the walk is a single forward pass (not a replayed input log), it is re-derivable and audit-safe — **never** tier-(c) replay.

**Bins & payout shares** (Sushi-Cat/Plinko payout curve, center-heavy)
- Bins carry a `share` fraction of *remaining* pot, mirroring `dig_truffle`'s `share constant numeric := 0.40`. Edge bins pay small, center bins pay the jackpot, so committing to a lane is a real (luck-gated) choice:

  | Bin position | Share of remaining | Flavor |
  |---|---|---|
  | far edges (2 bins) | 0.10 | "a nibble" |
  | mid (2 bins) | 0.25 | "a mouthful" |
  | inner (2 bins) | 0.40 | "a snoutful" |
  | dead center (1 bin) | 0.60 | jackpot — lucky-pig burst-modal |

- **Cap:** `v_take := LEAST(round(v_remaining * bin_share)::int, v_remaining)` with a `GREATEST(1, …)` floor so a non-empty pot always pays at least 1 (verbatim `dig_truffle`'s `GREATEST(1, round(v_remaining * share)::int)` then `LEAST(v_take, v_remaining)`). A drop can never over-draw the pot.
- **Floor-all rule:** if `v_remaining < 5` (the shipped `floor_all constant int := 5`), the next drop takes the rest and the board empties (`dug_at := now()`), freeing the host to set out a fresh one.

**Cooldowns / caps**
- One drop per guest per board: `truffle_digs` PK.
- One active board per host: `truffles_one_active_per_host`.
- Drops are gated by the *guest* relationship to the host — guests are friends visiting the Barn; reuse the existing visit-surface gate (no separate quota needed for MVP; the per-board PK already caps extraction per friend).
- Self-drop blocked: `IF p_host = caller_id THEN error 'self'` (verbatim).

**Edge cases**
- Concurrent droppers on the same board serialise on the row lock (`SELECT … FOR UPDATE` on the host's active truffle) — only one decrement at a time, no double-spend of the same remaining snouts.
- Drop on an emptied/absent board → `error 'none'` (verbatim).
- Second drop attempt → `error 'already_dug'` (verbatim PK check).
- Column out of `1..N` → `error 'bad_column'` (new, mirrors `bad_amount`).
- Notify is an **INLINE `INSERT INTO public.system_announcements`**, never `send_system_announcement` (admin-gated → silent rollback of the whole drop for non-admins — the exact footgun fixed in `20260618000000_fix_dig_truffle_announcement.sql`).

## Schema sketch
**Reuse the shipped `truffles` + `truffle_digs` tables as-is** — a Snout Drop *is* a buried truffle. Add only the discriminator + board seed.

```sql
-- clones: 20260592000000_buried_truffle.sql + 20260610000000_truffle_shared_pot.sql
ALTER TABLE public.truffles ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'truffle';
  -- 'truffle' (classic dig) | 'snout_drop' (peg board); existing rows default to 'truffle'
ALTER TABLE public.truffles ADD COLUMN IF NOT EXISTS board_seed text;  -- frozen daily seed at bury time
-- truffle_digs gains the resolved lane/bin for audit + the reveal animation:
ALTER TABLE public.truffle_digs ADD COLUMN IF NOT EXISTS drop_column int;
ALTER TABLE public.truffle_digs ADD COLUMN IF NOT EXISTS landing_slot int;
```

```sql
-- bury_snout_drop(p_amount int) -> jsonb   [clones bury_truffle(p_amount), sets kind, freezes board_seed]
--   stakes {10,20,50}, debits profiles.counter, inserts truffles(kind='snout_drop',
--   reward=remaining=p_amount, board_seed=abs(hashtext(host_id||current_date))::text)

-- deterministic_bounce(p_seed text, p_column int) -> int   [pure; IMMUTABLE; the peg-board oracle]
--   returns landing_slot in 0..ROWS via hashtext walk; no I/O

-- drop_snout(p_host uuid, p_column int) -> jsonb   [clones dig_truffle VERBATIM, swap share→bin_share]
--   FOR UPDATE lock on host's active snout_drop truffle; reject self / none / already_dug / bad_column;
--   landing := deterministic_bounce(board_seed, p_column); bin_share := share_for_bin(landing);
--   v_take := LEAST(GREATEST(1, round(remaining*bin_share)::int), remaining); floor_all<5 takes rest;
--   UPDATE truffles SET remaining, dug_by, dug_at(=now() if emptied);
--   INSERT truffle_digs(..., drop_column, landing_slot);
--   UPDATE profiles SET counter = counter + v_take (counter->counter transfer, never minted);
--   shift_alignment(p_host, 1);
--   INLINE INSERT INTO system_announcements(...);  -- NEVER send_system_announcement
--   IF first drop of UTC day THEN grant_season_xp(caller_id, 3);
--   RETURNS {ok, reward:v_take, remaining:v_left, column:p_column, landing_slot}

-- snout_drop_status() -> jsonb   [clones truffle_status(), filtered to kind='snout_drop']
--   host's own board: total, remaining, droppers[] (username, amount, drop_column, dug_at DESC)
```

Component: one `SnoutDropBoard.tsx` (the peg-board view + lane picker + reveal), typed wrappers `burySnoutDrop`, `dropSnout`, `snoutDropStatus` added to a `utils/snoutDrop.ts` (technical name per the module-naming preference — "Snout Drop" stays in UI copy). Migration filename **`>= 20260624000000`** to sort after `20260623000000`.

## Economy
- **Snout sink:** the host's stake (`{10,20,50}` debited from `profiles.counter` at bury) is the sink-side; while a board sits with remaining snouts those are locked out of circulation.
- **No minting — pure transfer:** every payout is `counter → counter` (host's buried pot → dropper's counter). The pot can only pay out what was staked; `LEAST(take, remaining)` guarantees `Σ payouts ≤ stake`. SNOUTS move as a counter, never minted, so the closed economy is **conserved minus `round()` dust** (rounding always rounds the *take* down via int truncation against a remaining cap, so dust strands harmlessly in an emptied-or-abandoned pot, never inflates).
- **Tickle faucet:** none directly — payouts are snouts, not tickles, so the regen bank is untouched and the `grant_tickles` faucet (and its `GREATEST(...)` display-debt fix) is not on this path. The only faucet-adjacent grant is `grant_season_xp(caller, 3)` on first daily drop, which is XP not currency.
- **Cosmetic rewards:** the jackpot center-bin triggers the existing lucky-pig burst-modal; a future "Golden Peg Board" Barn cosmetic could ride the hats catalog, but is out of MVP scope.
- **Why it can't inflate:** it is the Buried Truffle economy verbatim — a zero-sum redistribution of a pre-paid stake among friends. No code path adds snouts that weren't first debited from the host.

## Anti-abuse / cheat model
**Cheat tier (b) hardened toward (a)** — the brief's target.
- **Only input is one int.** The drop column `1..N` is the entire client surface. The landing bin is `deterministic_bounce(seed, column)` computed server-side in a SECURITY DEFINER RPC; a malicious client cannot fake a trajectory because no trajectory is transmitted or trusted. The most a cheater can do is choose a column — which is the legitimate game.
- **Board seed is server-frozen.** `board_seed` is the `daily_shop()` `abs(hashtext(host_id||current_date))` value captured at bury time, so the bin-share mapping is fixed and re-derivable; the client cannot influence which bins are jackpots.
- **Atomic, race-safe claim.** The `truffle_digs` PK `(truffle_id, digger_id)` makes "one drop per friend per board" a database invariant; the `SELECT … FOR UPDATE` row lock serialises concurrent droppers so two friends can't both claim the same remaining snouts. This is the `dig_truffle` race **verbatim**.
- **No self-farming / collusion ceiling.** Self-drop is rejected (`p_host = caller_id`). Because payouts are pure redistribution of the host's *own* staked snouts, a collusion ring (host + friend) can only move snouts the host already owned out of the host's pocket into the friend's — no net snouts are created, so there is nothing to farm. The `shift_alignment(+1)` is tied to a *real other player's* drop, matching the shipped anti-self-farm rationale in `buried_truffle.sql`.
- **Vote/grind resistance:** capped at one drop per friend per board and `floor_all<5` emptying; extraction is bounded by the stake, not by repetition.

## Feel
- **Earned mastery → subverted into luck (cozy variant):** unlike a skill leaderboard, mastery here is *reading the odds*, then surrendering to the bounce. The center-bin jackpot is rare and loud, the edge nibble is common and gentle — the curve teaches itself.
- **Persistent-world FOMO (soft):** the daily-reseeded board nudges "drop on Jen's board before the pegs reshuffle tonight," reusing the same date-rollover pull as the daily shop without any harsh timer.
- **Belonging / generosity loop:** the host *gives* the pot; the "your Snout Drop was found!" note + Giver alignment make hosting feel warm, not extractive — the same emotional payload as a found truffle, amplified by the spectacle of the drop.
- **Discovery-as-content:** finding a friend's board on a Barn visit is a small delight; the peg board renders only when a pot is live.
- **Cozy guardrail:** no PvP loss, no live timer pressure, no stakes the host didn't volunteer. The worst outcome for a guest is a small nibble; the worst for a host is generous overspend they opted into. Pig-flavored throughout (truffle pot, snouts tumbling, Rosie at the lever).

## How it composes
- **Within the Buried Truffle family:** Snout Drop is the third skin on one primitive (classic dig → shared pot → peg board), so the Barn-visit surface gains variety with near-zero new infra. A host could rotate between a plain buried truffle and a Snout Drop board day to day.
- **Schism Front / alignment meta:** every payout fires `shift_alignment(host, +1)` toward Giver, so a player who hosts generous Snout Drops drifts visibly Giver on the Greedy◄──►Giver axis that feeds Season 1's Judgement Day — the mini-game is a low-friction generosity tap into the season spine.
- **Against the shortlist:** it is mode **#3** in the pinned build order (co-op-pot, max truffle reuse) — it proves the "co-op pot beyond item-drives" shape that later modes (Sounder Stampede's partial-claim pool, Slop Cauldron's communal bar) generalise, while staying lighter than the shared-seed leaderboard harness (#4 Mud Putt).

## MVP
Smallest shippable seed — **one migration, one new component:**
1. **One migration** (`20260624000000_snout_drop.sql`): add the `kind`/`board_seed` columns + `truffle_digs.drop_column/landing_slot`; add the `IMMUTABLE deterministic_bounce(text,int)`; clone `bury_truffle(p_amount)` → `bury_snout_drop(p_amount)` and `dig_truffle(p_host)` → `drop_snout(p_host, p_column)` (the only real edit: `share` → `share_for_bin(landing)`); clone `truffle_status()` → `snout_drop_status()`. Inline the announcement INSERT.
2. **One component** (`components/SnoutDropBoard.tsx`): a static peg-board image with a 1..7 lane picker, a "drop" button calling `dropSnout`, and a result reveal reusing the lucky-pig burst-modal for the center bin. No animation engine required for v1 — the bounce can be a simple sprite-fall to the resolved bin (server-authoritative result, client just plays to it).

Defer to v1.1: animated peg-by-peg fall, host "Golden Peg Board" cosmetic, a daily drop-quota across all boards.

## Risks & open questions
- **Solo-dev content cadence:** the daily-reseeded board is nearly free (it rides `daily_shop()`'s seed), but a satisfying *animated* drop is real RN work — MVP must ship the static-result version or the feature will feel flat. Budget the animation as a separate v1.1 slice.
- **`deterministic_bounce` distribution:** a naïve hashtext walk may not produce a pleasingly center-heavy bell — needs a quick offline histogram check so the jackpot bin is genuinely rare and the curve feels Plinko-fair.
- **Discoverability:** Buried Truffle and Snout Drop now share one slot ("one active per host"). Open question — do they share the slot (host picks one) or get separate slots? MVP assumes **shared slot** (simplest; `kind` discriminator on the same `truffles` row), but that means a host can't run both at once.
- **`reward` semantics:** the shipped `dig_truffle` sets `dug_at` and `dug_by` on the last digger; with multi-drop boards `dug_by` only records the *emptying* dropper. Fine for status display, but confirm no downstream consumer treats `dug_by` as "the single winner."
- **Visit-gate coupling:** MVP assumes drops happen on the existing Barn-visit surface and inherit its friend-scoping. If Snout Drop should be reachable without spending a visit-tap budget, that decoupling is extra scope.

Questions for you:
1. Shared slot vs. separate slot for Buried Truffle and Snout Drop (the discoverability/`one-active-per-host` question above)?
2. Lane count — lock **N = 7** (the six-seven easter-egg wink), or a different board width?
3. Should a guest's drop cost anything (a small snout or tickle entry), or stay free like a classic dig? MVP assumes free.