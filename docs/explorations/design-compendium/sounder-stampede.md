# Sounder Stampede
> The whole Sounder thunders toward the same pile of slop — sink your snout in before the barn snorts it dry.

**Tier:** Mini-game (recurring daily event) · **Effort:** M · **Mode:** Async date-seeded shared-pot race (no realtime) · **Depends on:** Buried Truffle primitives (`bury_truffle` / `truffle_digs` / `dig_truffle`), trough/`bounty_trough` shared-goal bar, `daily_shop()` date-seed pattern, `grant_tickles()` faucet, `profiles.counter` (SNOUTS). Standalone as a mode — reuses, does not modify, those systems.

## The fantasy
You are one pig in a stampeding Sounder, and there is a fresh pellet pile in the field that the *whole herd* can smell. Every lunge you take is a gamble: sink your snout in now and you get a fat mouthful, but if you wait the pile shrinks as everyone else gorges — and the looming Barn is also eating the pile out from under all of you. It's the Agar.io feeling — get big by getting there first, fear the thing bigger than you — rendered entirely in cozy async snorts, where "the barn" is a tireless server-owned eater you can never out-click in real time, only out-*plan*.

## Player loop
- **Daily:** Open the Stampede card on the home screen. See today's pellet pile (a shared-goal bar like the trough), how much is left, the **Barn Drain** ticking it down, and your personal **lunge quota** for the day.
- **Lunge:** Spend SNOUTS to lunge. Each lunge is one atomic claim against the shared pot — you get a bite whose size the server computes from how full the pile still is. Bigger pile = bigger bite. You can lunge up to your daily quota, then you're on cooldown.
- **Tension:** Between your sessions, *the barn keeps eating* (drain is computed from elapsed real time, not a cron — see Mechanics) and other pigs keep lunging. Come back and the pile is smaller. "Get there before the barn does."
- **Empty / end-of-day:** When the pile hits zero (drained or fully eaten) OR the UTC day rolls over, the round **settles**. Direct bites already paid out as you took them; a separate **pari-mutuel reserve** is split among everyone who lunged, weighted by their staked SNOUTS, rewarding people who showed up even on a pile that got eaten to nothing.
- **Weekly:** A 7-day **Stampede streak** (lunged at least once each UTC day) pays a Slop Club / battle-pass-adjacent cosmetic and bonus tickles. Misses reset the streak (same shape as Garden Devotion).
- **Seasonal:** Stampede participation feeds the **Schism Front** alignment meta — see *How it composes*. Total snout volume routed through the Stampede is a season-long leaderboard flavor stat ("Most Trampled Field").

## Mechanics

**One pile per UTC day, server-owned, reproducible.** On first lunge of a new UTC day the round is lazily created (no cron — the `daily_shop()` pattern). Pile size is deterministic from the date seed:

```
seed        = hashtext('stampede:' || current_date::text)
pile_total  = 5000 + (abs(seed) % 5000)          -- 5,000–9,999 pellets/day
barn_rate   = 30 + (abs(seed >> 8) % 41)         -- 30–70 pellets drained per real hour
```

So every player on a given day faces the *same* pile and the *same* barn appetite — reproducible and auditable from the date alone.

**Barn Drain (no realtime, no cron).** The pile is never mutated by a background job. Instead each round row stores `pellets_remaining` and `last_settled_at`. On *every* lunge RPC call we first lazily apply the drain that accrued since `last_settled_at`:

```
elapsed_hours = extract(epoch from now() - last_settled_at) / 3600.0
drained       = floor(barn_rate * elapsed_hours)
pellets_remaining = GREATEST(0, pellets_remaining - drained)
last_settled_at   = now()
```

This is the trick that gives Agar.io "the field is being eaten while you're away" tension with zero server loop — the drain is *computed on read*, charged to whoever touches the row next, under the same `FOR UPDATE` lock as the bite.

**Bite size, server-derived.** The player never sends a bite amount. Given the post-drain `pellets_remaining` and `pile_total`:

```
fullness   = pellets_remaining / pile_total        -- 0.0–1.0
bite       = CEIL( (0.04 + 0.06 * fullness) * pellets_remaining )
bite       = LEAST(bite, pellets_remaining)         -- never over-eat
```

A full pile yields ~10% per bite; a near-empty pile yields ~4% of a tiny remainder. This is the "get there before the barn does" gradient — early lungers eat fat, latecomers scrape. Bites are floored at 1 while `pellets_remaining > 0`.

**Lunge cost (SNOUT sink) + payout.** Each lunge costs a flat `LUNGE_COST = 25` SNOUTS, transferred counter→counter into the round's **escrow counter** (a holding profile, same model as `item_drives` escrow — never minted). The `bite` is *not* paid in SNOUTS; it's an entry in `stampede_lunges` that converts to reward at settle. Two reward channels:

1. **Direct share (80% of round escrow):** at settle, your share = `(your_total_bite / sum_all_bites) * 0.80 * round_escrow`. Eating more pile = bigger slice. Paid in SNOUTS via counter→counter transfer out of escrow.
2. **Pari-mutuel reserve (20% of round escrow):** split by *stake* not bite — `(your_lunges / total_lunges) * 0.20 * round_escrow`. This is the "showed up even on an empty pile" consolation, so a player who lunged into a barn-drained husk still recovers part of their stake. **Net effect: 100% of staked SNOUTS are redistributed among participants. Zero mint, zero burn-to-zero.** (A configurable `RAKE = 0` at launch; a future season could route a small rake to a sink like the trough goal.)

**Cooldown / quota (extraction cap).** `DAILY_LUNGE_QUOTA = 10` lunges per player per UTC day, tracked on `stampede_lunges` by count. Between lunges, a soft `LUNGE_COOLDOWN = 90s` (server-enforced via `last_lunge_at`) prevents one player machine-gunning the whole pile in two seconds and starving the herd — preserves the "race" feel asynchronously. Quota + cooldown together cap any one player's extraction.

**Win conditions / settle.** A round settles on the *next* RPC touch after either (a) `pellets_remaining = 0`, or (b) UTC date advanced past the round's date. Settlement is idempotent and lazy (no cron): the first lunge of day N+1 settles day N before opening day N+1. A nightly is *not* required, but a manual admin `settle_stampede(round_date)` exists for forcing closure. Settle pays all participants, marks `settled_at`, and is guarded so it can run exactly once (`WHERE settled_at IS NULL ... RETURNING`).

**Edge cases.**
- **Pile drained to 0 before anyone lunges much:** escrow may be tiny; pari-mutuel still splits whatever staked SNOUTS exist among the few who lunged. No negative balances.
- **Solo player day (likely, small playerbase):** you're racing only the barn. Direct + reserve both flow back to you minus rake (=0), so a solo day is roughly stake-neutral minus the thrill — intentional; the *barn* is the opponent, not other players.
- **Lunge when `pellets_remaining = 0` but not yet settled:** rejected (`pile_empty`), nudging a settle instead.
- **Insufficient SNOUTS:** rejected before any drain/lock (`insufficient_snouts`).
- **Concurrency:** the `SELECT ... FOR UPDATE` on the round row serializes drain+bite+decrement, exactly the `dig_truffle` depleting-pot guarantee.

## Schema sketch

**`stampede_rounds`** (clones the buried-truffle *pot* row + `daily_shop()` seed):
```
round_date        date PRIMARY KEY          -- one per UTC day
seed              bigint NOT NULL            -- hashtext('stampede:'||date)
pile_total        int   NOT NULL
barn_rate         int   NOT NULL             -- pellets drained / real hour
pellets_remaining int   NOT NULL
escrow_profile_id uuid  NOT NULL REFERENCES profiles(id)   -- holding counter, item_drives-style
last_settled_at   timestamptz NOT NULL DEFAULT now()       -- drain anchor
settled_at        timestamptz                              -- NULL until settled
created_at        timestamptz NOT NULL DEFAULT now()
```

**`stampede_lunges`** (clones `truffle_digs` PK ledger):
```
round_date    date NOT NULL REFERENCES stampede_rounds(round_date)
player_id     uuid NOT NULL REFERENCES profiles(id)
lunge_index   int  NOT NULL              -- 1..DAILY_LUNGE_QUOTA
bite          int  NOT NULL              -- server-computed pellets eaten
staked        int  NOT NULL DEFAULT 25   -- SNOUTS spent on this lunge
last_lunge_at timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (round_date, player_id, lunge_index)
```

**RPCs:**
- `lunge_stampede() -> jsonb` — clones `dig_truffle`. Lazily creates today's round, lazily settles any stale prior round, applies barn drain under `FOR UPDATE`, validates SNOUTS/quota/cooldown/empty, transfers `LUNGE_COST` counter→escrow, computes `bite`, inserts the ledger row, decrements `pellets_remaining`, returns `{bite, pellets_remaining, pile_total, fullness, lunges_used, quota, next_lunge_at}`. INLINE-inserts a `system_announcements` row for big-bite milestones (never `send_system_announcement` — admin-gated, silently rolls back).
- `get_stampede_today() -> jsonb` — read model for the card: applies *display-only* drain projection (does not mutate), returns pile state, your lunges_used / quota / cooldown remaining, and a live estimate of your projected payout. Mirrors how trough/home reads compute on the fly.
- `settle_stampede(p_round_date date) -> jsonb` — idempotent payout; `WHERE settled_at IS NULL ... RETURNING` guard. Computes both channels, transfers SNOUTS escrow→participants counter→counter, marks settled. Callable by the lazy path and by an admin.

**Component:** `components/StampedeCard.tsx` (home-screen card) reusing the trough's shared-goal bar; supporting `utils/stampede.ts` (technical name, per module-naming rule — not `utils/snoutRush.ts`).

## Economy
- **SNOUT sink:** every lunge stakes 25 SNOUTS into round escrow. With a quota of 10 lunges that's up to 250 SNOUTS/player/day pulled out of circulation until settle — a real daily SNOUT *velocity* sink even though it's redistributive.
- **Closed-economy safety:** SNOUTS are *never minted here.* Lunge cost is a counter→counter TRANSFER into the escrow holding profile (the `item_drives` escrow model); settle is counter→counter back out. Total SNOUTS conserved across the round to the pellet — the pile is *internal scoring units* (pellets), not currency, so the "pile" can never leak SNOUTS. RAKE=0 at launch keeps it perfectly conservative; any future rake would route to an existing sink (trough goal), still no mint.
- **Tickle faucet (the only over-cap-safe path):** weekly Stampede-streak reward grants tickles via `grant_tickles()` — and since a Stampede reward could be the first over-cap grant a given player hits, it must ship the `GREATEST(...)` display-debt fix to `home_stats` + `admin_tickle_overview` (the documented first-over-cap footgun).
- **Cosmetic rewards:** 7-day streak yields a Sounder-themed hat from the existing hats catalog (category/rarity/slots) — pure cosmetic, no economic pressure. Seasonal "Most Trampled Field" top-volume players get a profile badge (cosmetic).

## Anti-abuse / cheat model
- **Client never sends bite or pile state** — both are server-derived under `FOR UPDATE`. The classic Agar.io cheat (speed-hacking, fake mass) is structurally impossible: a tampered client can only call `lunge_stampede()`, which ignores all client input. **Cheat tier: trivially defeated — no client-trusted state.**
- **Quota + cooldown** cap extraction per identity; a script lunging in a loop hits `LUNGE_COOLDOWN` (90s) then `DAILY_LUNGE_QUOTA` (10) and stops. **Tier: rate-limited automation — bounded, not profitable** since bite-per-stake degrades as fullness drops.
- **Sock-puppet / collusion:** because payout is redistributive (100% back to participants pro-rata) and each lunge costs a fixed 25 SNOUTS, running N alts to "win" your own escrow is net-zero before friction and net-negative after any future rake — there's no minted prize to farm. **Tier: collusion-resistant by construction** (pari-mutuel has no house to drain). Friend-graph (Sounder) collusion to coordinate timing changes *who* eats but not the *conserved total*.
- **No vote-gaming surface** — there's nothing to vote on; outcome is pure stake + arrival order, both server-timestamped.
- **Settle idempotency** (`WHERE settled_at IS NULL ... RETURNING`) prevents double-payout from concurrent lazy-settle races — same single-RETURNING guard as `dig_truffle`'s claim.
- **Display-debt:** projected-payout in `get_stampede_today()` is advisory and recomputed; actual payout is authoritative at settle, so a stale client can't bank a phantom number.

## Feel
- **Persistent-world FOMO / slow time:** the barn eats whether or not you log in — the field visibly shrinks between sessions. That's the era's "the world moved without me" pull, cozily defanged because you lose opportunity, never owned SNOUTS (redistributive).
- **Earned mastery:** the skill is *timing* — reading fullness, judging whether to lunge now into a fat pile or hold (you can't hold; quota/cooldown force commitment) — a legible, learnable read.
- **Emergent drama:** "the herd got there first today" / "barn ate it all by noon" become Sounder chat moments without any realtime tech.
- **Cozy guardrail:** no one is *eliminated*, no one's snout balance can go to zero from playing (worst case stake-neutral), and the antagonist is a sleepy Barn, not other players. The Agar.io predation fantasy is reframed as friendly herd gluttony — Rosie-flavored, not cutthroat.

## How it composes
- **Schism Front meta-frame:** each lunge can carry a tiny `shift_alignment` nudge — gorging fast/big leans **Greedy**, holding to the pari-mutuel "showed up" reserve leans **Giver** — feeding the private Greedy↔Giver axis already in the spine. Stampede becomes a *daily alignment expression* surface, like the trough and drives.
- **Trough / item-drives:** literally reuses the shared-goal bar UI and the escrow-holding-profile pattern; a future rake could pour into the **trough** goal, chaining the two shared bars (Stampede overflow feeds the communal trough).
- **Sounder (friends):** "your Sounder's biggest bite today" surfaces friends' lunges; coordinated arrival is a social play.
- **Buried Truffle:** mechanically the sibling mode — Truffle is *you alone vs a buried pot*, Stampede is *the herd + the barn vs a shared pile*. Same atomic-claim engine, opposite social framing.
- **Battle pass / Slop Club:** weekly streak rewards slot into existing progression tracks.

## MVP
Smallest shippable seed = **one migration + one RPC + one card**, no settle automation, no streak, no alignment:
1. **Migration** (`>= 20260624000000_stampede_mvp.sql`): create `stampede_rounds` + `stampede_lunges`, a single shared escrow holding profile, and the `lunge_stampede()` RPC that does lazy-create + barn-drain + atomic bite + counter→escrow stake. Hardcode `pile_total`/`barn_rate` from the date seed, `LUNGE_COST=25`, `QUOTA=10`, `COOLDOWN=90s`. Pay **direct share only at a trivial lazy-settle** triggered on first next-day lunge (defer the 80/20 split — MVP pays 100% pro-rata by bite). INLINE any announcement.
2. **`get_stampede_today()`** read RPC for the card.
3. **`components/StampedeCard.tsx`** reusing the trough bar: pile remaining, barn rate, your lunges/quota, a Lunge button.

Ship that, watch one full UTC day of real lunges settle, *then* layer pari-mutuel reserve, streaks, alignment, and the trough-rake chain.

## Risks & open questions
- **Single-player days dominate a small playerbase:** with few daily actives, most rounds are "you vs the barn," which is stake-neutral and may feel pointless. Mitigation: tune `barn_rate` low and `pile_total` generous so a solo pig still gets a satisfying *bite size* even if payout is a wash; lean on the bite-juice for feel, not the payout.
- **Drain-on-read fairness:** whoever lunges first after a long gap "pays" the accrued drain (their bite is computed on an already-shrunk pile) while triggering the timestamp reset for everyone after. This is fair in expectation but could *feel* unlucky. Open question: surface a projected-drain readout in the card so the first-after-gap lunger sees why their bite shrank.
- **Cooldown vs async etiquette:** a 90s cooldown is fine within a session but means clearing your 10-lunge quota takes ~15 min of attention — is that too sticky for a cozy async game? Consider dropping cooldown and relying on quota alone.
- **Pari-mutuel comprehension:** "80% by bite, 20% by stake" is two-channel and hard to explain in a cozy card. Risk it confuses; MVP defers it (bite-only) for exactly this reason.
- **Settle reliability without cron:** lazy-settle means a day with *zero* next-day activity never settles until someone lunges. Acceptable (escrow just sits), but the admin `settle_stampede()` is the manual backstop. Open question: is a once-a-day client-triggered settle on app-open acceptable, or does that re-introduce a pseudo-cron we said we'd avoid?
- **Solo-dev content cadence:** the pile is procedurally seeded so it needs *zero* daily content authoring — this is the cheapest recurring mode to run. The only ongoing cost is the weekly cosmetic (one hat per streak tier) and seasonal badge art. Low cadence cost; main spend is the initial M-sized build of the atomic RPC + settle correctness.

**Questions for the user:**
1. Drop the 90s cooldown and rely on the 10-lunge quota alone (less sticky, more cozy), or keep it for race tension?
2. Is a client-triggered settle-on-app-open acceptable as the lazy-settle backstop, or must settle stay strictly piggybacked on the next lunge (no pseudo-cron)?
3. Should a future rake route to the **trough** shared goal (chaining the two bars), or stay at RAKE=0 permanently for a perfectly conservative economy?