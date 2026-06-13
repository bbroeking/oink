# Acorn Arc (Slingshot Standoff)
> Two pigs, one acorn slingshot, one windy seed — load up, let it fly whenever you like, and the barn settles who got closest to the bullseye.

**Tier:** Core mode · **Effort:** L · **Mode:** async head-to-head duel (Words-With-Friends pacing, commit-before-reveal) · **Depends on:** the solo shared-seed harness (Mud Putt — `#4` on the shortlist) shipping first; reuses its seed + submit-tiny-input + server-re-sim plumbing. Also depends on `are_friends()` / `utils/friendships.ts` (live), the truffle pot ledger (`truffles`/`truffle_digs`, live), and `daily_shop()`'s seed idiom (live).

## The fantasy
You are a barnyard sharpshooter at the slingshot line, squinting down an acorn at a target swinging in the wind. A friend in your Sounder has thrown down a snout wager on the exact same windy field, and you each get one honest shot — no live pressure, no twitch reflexes, just you, the arc, and your read of the gust. You load up whenever the mood strikes, let the acorn fly, and wait to find out whether your aim or theirs landed truer. It is the first time in TTP that two pigs go snout-to-snout for a pot, and it is settled by the barn, not by either bragging player.

## Player loop
**Daily action (the throw):** Open Acorn Arc from the Barn. You either *issue a challenge* to a Sounder friend or *answer one waiting for you*. Both sides shoot the **same per-match seeded field** (target position, wind vector, obstacle layout). On your turn you drag the slingshot — choosing one `(angle, power)` pair — watch your local preview arc, and **commit**. That commit is sealed: you cannot see the opponent's shot, and once committed you cannot re-throw. One throw per side, then your side `lock_at` is set.

**Weekly stakes:** Challenges accumulate like Words-With-Friends games — several open matches at once, each waiting on whoever's turn it is. A 72h per-side timeout keeps them from rotting. Your win/loss record and total snouts won feed a weekly **Standoff Ladder** scoped to your Sounder (clones the `wasted_tickles_leaderboard` SQL shape), so the casual throw nests into a friend-group rivalry that resets weekly.

**Seasonal stakes:** Acorn Arc is the first *Greedy-flavored* pot mode — it's framed inside the Schism Front meta as the Greedy faction's signature: taking snouts off another pig in a fair duel. Cumulative duel wins across the season can gate a seasonal cosmetic title ("Slingshot Champion") and feed Judgement Day standing, the same way trough/drive participation already does.

## Mechanics

**Challenge → escrow → throw → settle**, a four-state machine per match (`pending → both_committed → settled`, plus terminal `expired`):

1. **Issue.** Challenger picks a Sounder friend (must pass `are_friends()`) and a stake from a fixed ladder (`10 / 25 / 50` snouts — same order of magnitude as `bury_truffle`'s 20-snout treat). The challenger's stake is **escrowed immediately** (`counter -= stake`, the `bury_truffle` debit pattern). A per-match seed is salted at creation: `seed := abs(hashtext(match_id::text || created_at::text))` (the `daily_shop()` idiom, salted with the match id rather than `current_date` so each match is unique and unguessable before accept).
2. **Accept.** The challenged pig sees stake + field preview. On accept, **their** stake is escrowed too (atomic `UPDATE profiles SET counter = counter - stake WHERE id = me AND counter >= stake RETURNING` — refuse if too poor). Decline refunds the challenger's escrow. No-response within 72h auto-expires and refunds (terminal `expired`).
3. **Throw (commit-before-reveal).** Each side calls `commit_arc(match_id, angle, power)` exactly once. The RPC stores the scalars and stamps `<side>_lock_at = now()`. Inputs are **range-clamped server-side** (`angle ∈ [0°,90°]`, `power ∈ [0,100]`); out-of-range → reject. Neither side's scalars are readable by the other before both commit (RLS hides the opponent column until `settled`).
4. **Settle.** When the second commit lands, the **server** runs the deterministic arc integrator for *both* shots on the shared seed and scores each by miss-distance to the bullseye:
   - `score = max(0, 1000 - round(miss_px))` where `miss_px` is the closest approach of the simulated acorn path to the target center, in seeded field pixels.
   - **Lower miss wins the whole pot.** `payout = 2 * stake` to the winner (`counter += payout`, a `counter→counter` transfer — the two escrows fund it, nothing minted).
   - **Tie** (equal `score` after rounding): both stakes refunded.
   - Settlement is **atomic and idempotent**: `UPDATE matches SET status='settled', winner=... WHERE id=match_id AND status='both_committed' RETURNING` — the exact `dig_truffle` race guard, so a double-fired settle (both clients racing the second commit) can pay out only once.

**Sim determinism (the cheat-proof core):** the integrator is a fixed-step forward projectile sim with seeded constant wind — **bounded scalars in, one stable pass, no input-log replay** (tier-c is explicitly avoided, per the shortlist). The client preview uses the *identical* step function so what you see is what the server scores; the server simply ignores any client-claimed result and recomputes from the two committed scalars. A known best-possible `score` per seed exists (the field is solvable), so impossibly-perfect submissions are detectable.

**Timeout / forfeit:** if one side commits and the other lets their 72h lapse, the committer wins by forfeit (full pot). If *neither* commits, both refund.

**Caps:** max open matches per player = 10 (Words-With-Friends-style backlog cap); a player may hold at most one *pending challenge issued to the same opponent* at a time (partial unique index, the `truffles_one_active_per_host` idiom).

## Schema sketch

```sql
-- Clones the `truffles` pot-ledger shape (escrow on the row, settle via atomic UPDATE).
CREATE TABLE IF NOT EXISTS public.acorn_matches (
  id              bigserial PRIMARY KEY,
  challenger_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake           int  NOT NULL,
  seed            bigint NOT NULL,                 -- abs(hashtext(id||created_at)), salted daily_shop idiom
  status          text NOT NULL DEFAULT 'pending', -- pending|both_committed|settled|expired
  challenger_angle int, challenger_power int, challenger_lock_at timestamptz,
  opponent_angle   int, opponent_power   int, opponent_lock_at   timestamptz,
  challenger_score int, opponent_score   int,      -- filled at settle, server-computed
  winner_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = tie/refund
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  settled_at      timestamptz
);
-- At most one pending challenge per ordered (challenger,opponent) pair (truffles_one_active_per_host idiom).
CREATE UNIQUE INDEX acorn_one_pending_per_pair
  ON public.acorn_matches (challenger_id, opponent_id) WHERE status = 'pending';
-- RLS: a participant reads their own matches; the opponent's committed scalars are
-- masked by a view until status='settled' (commit-before-reveal).
```

RPCs (all `SECURITY DEFINER`, `GRANT EXECUTE ... TO authenticated`):

- `challenge_to_arc(p_opponent uuid, p_stake int) -> jsonb` — clones `bury_truffle` debit + `choose_allegiance` validate/lock guard. Checks `are_friends()`, stake ∈ ladder, escrows challenger stake, inserts match, salts seed, INLINEs a `system_announcements` row to the opponent ("🌰 A pig wants a Standoff!").
- `respond_to_arc(p_match bigint, p_accept boolean) -> jsonb` — escrows opponent stake on accept (atomic too-poor guard) or refunds challenger on decline. Returns the seeded field params for the preview.
- `commit_arc(p_match bigint, p_angle int, p_power int) -> jsonb` — range-clamps scalars, stores them, stamps the caller's `*_lock_at`. If this is the second commit, it transitions to `both_committed` and tail-calls `settle_arc`.
- `settle_arc(p_match bigint) -> jsonb` — runs the arc integrator for both sides, fills `*_score`, picks winner, pays `2*stake` (`counter→counter`) via the idempotent `UPDATE ... WHERE status='both_committed' RETURNING` (the `dig_truffle` guard), INLINEs result announcements to both. Internal (not granted to clients) so settlement can't be poked.
- `expire_arc_matches() -> int` — lazy sweep called opportunistically on read (no cron, mirroring the `daily_shop()` no-cron stance): any `pending`/half-committed match past `expires_at` refunds or forfeits.

Component: `components/AcornArc.tsx` (slingshot drag UI + match list) + `utils/acornArc.ts` typed wrappers (the organic per-feature wrapper pattern beside `utils/friendships.ts`).

## Economy
**Snout sink:** the entry stake escrows out of `profiles.counter` on issue and accept. **Faucet:** none — Acorn Arc mints nothing. The pot is purely the two escrowed stakes redistributed `counter→counter` (the conserved-transfer rule), so a duel is **zero-sum across the two players** modulo nothing (no `floor()` dust even, since `2*stake` is exact). A tie refunds both — also conservation-preserving. The only cosmetic reward is the seasonal "Slingshot Champion" title gated on cumulative wins (no currency, granted via the `user_hats`/title-unlock idiom). Because the closed `SUM(counter)` is invariant per settled match and nothing routes through `grant_tickles`, the mode **cannot inflate** the economy — it only moves snouts between two consenting pigs.

## Anti-abuse / cheat model
Tier **(b) for scoring + (a)-flavored settlement** (per the shortlist's classification).

- **No client-claimed outcome.** Each side commits only two clamped scalars; the server re-derives both arcs from the shared seed and decides the winner. The client number is discarded. This is the "server owns the answer" half.
- **Commit-before-reveal.** RLS/view masks the opponent's scalars until `settled`, so neither pig can shoot to beat a known shot. Each side has one throw, no re-throw.
- **No replay fragility.** Bounded scalars + one fixed-step pass (not a tier-c input log), with a known per-seed optimum that flags impossible submissions.
- **Collusion / pot-laundering** (the real risk for a head-to-head transfer): both stakes come *out of the same closed economy* and the winner is server-decided, so two colluding accounts can only shuffle snouts they already jointly hold — they cannot conjure any. A loss-dumping ring just relocates snouts between friends; no faucet is touched, so it's economically inert. Wins-gated cosmetics are protected by requiring `are_friends()` *and* distinct accounts; rapid same-pair farming is throttled by the one-pending-per-pair unique index and the 10-open-match cap. The `dig_truffle`-style idempotent settle blocks double-payout from a commit race.
- **Footgun guard:** every notify INLINEs the `system_announcements` INSERT — never `send_system_announcement` (admin-gated; would silently roll back the entire escrow/settle transaction for non-admins, exactly the `dig_truffle`/`donate_to_drive` bug class).

## Feel
- **Earned mastery + emergent drama** (evoke-online-game-feel): a head-to-head pot for snouts you earned is the highest-stakes social moment in the game; the windy seed rewards *reading* the field, not reflexes, so mastery is legible and bragging is real.
- **Belonging / hangout + persistent-world FOMO:** open matches sitting in your Sounder queue are an asynchronous "your move" pull — the Words-With-Friends ambient-presence feeling without any realtime requirement.
- **Slow time:** commit-before-reveal + 72h windows make a duel a multi-day simmer, not a twitch contest. **Cozy guardrail held:** it's acorns and slingshots between friends, the loser loses only snouts they chose to wager (never tickles, never happiness, never their pig), and the framing is playful sharpshooting — competitive but bloodless.

## How it composes
Acorn Arc is the **Greedy faction's banner mode** in the Schism Front meta-frame: where the Slop Cauldron and item drives are cooperative (Giver-coded), the Standoff is the sanctioned way to *take* snouts off a rival pig in a fair fight, so it sharpens the Greedy◄──►Giver alignment axis at the social layer. Mechanically it is the capstone of the seed ladder: it inherits Mud Putt's seed+submit+re-sim harness, reuses the truffle pot's escrow/atomic-settle ledger and the Snout Oracle's entry/pool/resolve/claim spine, and is scoped by the same `are_friends()` Sounder graph the trough/drive modes use. It also **builds the matchmaking + turn/commit state machine** that the deferred Trough Talk (Words-With-Friends board) would later need — Acorn Arc is the cheapest place to prove that plumbing.

## MVP
Smallest shippable seed: **one migration** (`>= 20260624000000`, after the latest `20260623000000`) creating `acorn_matches` + the four player-facing RPCs (`challenge_to_arc`, `respond_to_arc`, `commit_arc`, internal `settle_arc`) with a deliberately trivial sim first — a **1-D "closest-to-pin" arc**: ignore obstacles, score = `abs(landing_x - target_x)` from a closed-form projectile range `range = power² · sin(2·angle) · k`, no integrator yet. That alone exercises the full escrow → commit-before-reveal → atomic idempotent settle → `counter→counter` payout spine end-to-end. **One component** (`components/AcornArc.tsx`) renders a match list + a single slingshot slider. Lazy `expire_arc_matches()` on list read (no cron). The richer wind/obstacle integrator and the weekly Standoff Ladder layer on afterward without touching the state machine.

## Risks & open questions
- **State-machine novelty:** TTP has no turn/commit machine today; the four-state lifecycle + timeout sweep + commit-before-reveal RLS masking is genuinely new surface area (hence the L and the "after Mud Putt" gate). The lazy `expire` sweep is the riskiest seam — a match could sit half-committed if neither participant ever opens the app.
- **Sim parity:** the client preview integrator and the server scoring integrator must be byte-identical in result, or players feel cheated when the arc they saw scores differently. Closed-form (range equation) sidesteps this for MVP; a stepped integrator reintroduces the risk and wants a shared spec + golden-vector tests.
- **Solo-dev content cadence:** unlike the daily-seed modes, duels generate their own content (every match is fresh), so cadence cost is low *after* launch — but the **first build is the most code-heavy mode on the shortlist** (state machine + escrow + sim + new component + new ladder), competing for the same solo bandwidth as the simpler co-op/pick'em modes ahead of it on the ladder.
- **Liquidity:** duels need a willing opponent in your Sounder with snouts to wager; thin friend graphs may see few matches. Open question: allow an open "anyone in my Sounder can accept" challenge (a small matchmaking lobby) vs. strict 1:1 targeting — the former needs the escrow to survive multiple would-be accepters (first-accept-wins via the same atomic guard).
- **Open question:** does a forfeit win count toward the "Slingshot Champion" cosmetic, or only contested settles? (Forfeits-count invites no-show farming; contested-only is cleaner but punishes honest opponents who simply went quiet.)
- **Open question:** should stake ladders scale with the seasonal economy, or stay fixed at `10/25/50`? Fixed is safer for conservation reasoning; scaled keeps the mode relevant late-season when snout balances are larger.