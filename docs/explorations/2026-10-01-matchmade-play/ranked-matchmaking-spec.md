# Random matchmaking, competitive play and a leaderboard

Revised 2026-10-02. **User requirement:** a leaderboard based on head-to-head wins/rating, alongside competitive and cooperative options. **Proposed default:** random matchmaking only, with practice excluded from ranking. The user said “maybe” about random-only, so this is a scope recommendation rather than a permanently approved restriction.

This replaces the first-mode/product scope of [the original Duet specification](matchmaking-spec.md). Its transactional reservations, exact channel cleanup, nonce replay and recovery patterns remain useful. This revision changes the first mode to **competitive Mud Volley**, adds server-settled results/rating, removes private room codes and direct rematches, and changes ranked disconnect adjudication.

Before implementing the production spine, use the [browser demo and playtest plan](demo-plan.md) to compare rules with real people. Controlled demo rooms and sample rankings are test tools, outside this production matching contract. The demo's alternative rules are experiments; this specification retains the proposed one-use hands until a playtest decision replaces them.

## 1. Product contract

| Candidate | Interaction | Ranking |
| --- | --- | --- |
| Mud Volley | Competitive 1v1, alternating attacker/defender | Individual season rating, with W/D/L |
| Tickle Duet | Cooperative call-and-response; roles alternate | Outside the competitive rating |
| Truffle Trail | Cooperative hidden-information hunt; roles swap | Outside competitive rating; a separate best-pair-run board is possible later |
| Picnic Relay | Cooperative with different Picker/Mixer jobs; swap jobs | Outside competitive rating |
| Pig Pageant | Social runway/audience turns | Outside competitive rating; positive match-only rosettes |

None is a one-way mode overall. A toss, signal, handoff or runway turn has a direction, then the participants exchange roles.

The first implementation should expose one rated queue and one leaderboard. Do not split a small population into five queues or combine cooperative completion totals with competitive skill rating. At later expansion the player selects a competitive or cooperative experience, then receives a random compatible human. First-release practice is local and plainly labeled.

Entry: **Find a rival · Leaderboard · Practice**. Result: **Win/Draw/Loss · rating before/after · placement progress or season rank · Find another pig**. There is no friend selector, code or same-person rematch allocation in this proposed scope.

No entry stake, currency award, paid strength or pig-specific competitive stats. Owned looks remain expression. These game gestures do not spend the Tickle bank or change Happiness/Streak.

## 2. Mud Volley: proposed first competitive rules

Three rounds contain **six 12-second exchanges** (~72 seconds). Seats alternate attack/defense; each pig attacks three times and defends three times.

Each pig starts with a toss hand and a catch hand, each containing Left, Middle and Right once. The Attacker secretly selects an unused toss card; the Defender secretly selects an unused catch card during the same generous server window. Both lock; the server reveals both together, spends the cards, and resolves:

- Same lane: catch, no attacking point.
- Different lane: attacker earns one Splat.
- Higher Splats after all six exchanges: win.
- Equal Splats: draw; no arbitrary speed tiebreak.

The player's remaining cards and the rival's already-spent cards are visible. The rival's uncommitted/current choice is hidden. For the prototype, commits are accepted in each slot's [0,9) server-second window; reveal and pig animation occupy the remainder. Early simultaneous commitment can reveal sooner without advancing the fixed next-slot start.

This constrained-card game is a **skill-depth hypothesis**. Unlimited three-lane guessing would make ratings heavily reflect chance. Test whether managing spent cards and reading choices changes decisions across repeat games before committing to a ladder. The server or rating algorithm cannot turn a shallow guess into meaningful mastery.

The ball arc performs the accepted outcome. No authoritative continuous physics or reflex timing is required.

### Missed commits

A submitted card is immutable, even if its player leaves. If only one pig commits by the deadline, that pig wins the exchange: a missing defender concedes an attacking Splat, while a missing attacker earns none. The absent pig's card is spent by a fixed server rule (first remaining lane in Left/Middle/Right order), so the remaining-hand invariant stays intact. Both missing: no point; both hands consume their deterministic fallback card, then reconcile connection grace.

A missed commitment cannot erase the match or improve a likely loser's result. A fallback card is not a bot opponent and never produces a new human action receipt. A normally completed match needs at least one accepted commitment from each pig to count toward rating/placement; a match with neither participating is a no contest. A single nonparticipating pig against a participating, fresh rival receives an abandonment loss, rather than erasing the result.

## 3. Authority, secrecy and compatibility

Reuse Expo, Supabase Auth/Postgres/Realtime and PigStage. Authenticated RPCs validate commitments. Postgres owns accepted cards, spent hands, scores, deadlines, results and ratings; native rendering responds locally and then performs confirmed events.

Raw actions have no client SELECT. A role-specific snapshot returns the caller's own committed card and opponentCommitted before reveal; both lanes and the derived point become public only after resolution. No private lane is included in a shared Realtime event. The first commit stores hidden state; the second resolves/reveals under the same match-row lock. Unique (match_id,exchange_no,user_id) and nonce/digest receipts prevent replacement or duplicate points.

Channels use exact membership-scoped private topics. Broadcast informs clients; authorized snapshots recover gaps and state. RLS and grants cover exposed tables, and every mutation derives identity from auth.uid(). [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Private-channel authorization](https://supabase.com/docs/guides/realtime/authorization).

Pair only compatible protocol, mode, rules and ladder versions. Visual/runtime changes do not require splitting a ladder unless gameplay/scoring changes. Stamp the immutable server-selected period and eligibility policy when countdown is created, using the scheduled starts_at; final eligibility cannot be client-selected.

## 4. Random pairing and repeat opponents

Keep the original global short coordinator lock and one multiplayer_active_reservations row per user across queue/match/practice transition. Pair two eligible fresh users atomically, exclude blocks in both directions, create exactly two seats, and retain oldest-wait priority.

Start without hard rating bands while measuring concurrency. The opponent is randomly selected from the compatible fresh pool, with wait priority; after enough population exists, a widening rating preference can improve fairness. “Random” means players do not choose an opponent; it does not require ignoring wait time or compatibility.

Return to the pool through Find another pig. Prefer a different opponent if available. Reserve repeat-pair eligibility under the coordinator: proposed maximum **three rated meetings per unordered pair per UTC day**, including abandonments. Counts include pending allocated rated matches so concurrent joins cannot exceed the cap; ready-check aborts release the allowance.

A capped pair does not secretly play an unrated match. Continue searching; after the wait threshold offer clearly unranked practice. Pair caps and eligibility are server policy and shown before play. Use an indexed canonical pair_lo/pair_hi history.

Random-only reduces chosen-opponent boosting but cannot eliminate collusion in a tiny pool, alt accounts or automated clients. Bounds, hidden choices and transactional scores prevent forged outcomes; they do not prove a person tapped the device. Track distinct opponents, repeats and suspicious results; ranking has no valuable currency reward.

## 5. Rating and public leaderboard

Proposed versioned Elo-style rule: start each competitive period at **1000**, K=24:

```text
expected_A = 1 / (1 + 10^((rating_B - rating_A) / 400))
result_A   = 1 for win, 0.5 for draw, 0 for loss
delta_A    = round(24 * (result_A - expected_A))
delta_B    = -delta_A
```

Both changes use the two **pre-settlement ratings**, and one rounded delta is negated to preserve a zero-sum update. Equal 1000 ratings: a winner goes to 1012 and the loser to 988; a draw leaves them unchanged. Wins against stronger pigs gain more; losses against weaker pigs cost more. These parameters are game proposals, not adoption of chess tournament regulations. The result-versus-expected principle is used in [FIDE's rating rules](https://handbook.fide.com/chapter/B022024).

Use a **four-week competitive period** with server-configured UTC boundaries. Public ranking begins after five rated matches; before that, show the player's own rating and “3 of 5 placement games,” with no public position. This threshold and cadence need live population evidence. Keep archived period results, while the active ladder starts fresh; do not promise lifetime competitive standings.

Sort public rows by rating descending, then wins descending, then user UUID ascending for deterministic pagination. UI can show equal-rating players sharing a rank via DENSE_RANK on rating; the remaining fields only order tied rows. Return top 50, further keyset pages, and a separately computed viewer entry even when off-page. Match the existing hide_from_leaderboard preference: hidden users keep private rating/placement state but have no public row/rank.

Cooperative results do not change Elo or W/D/L. If a co-op board is chosen later, give it its own rules/period and rank a pair's best verified shared run; no casual run feeds the competitive ladder.

## 6. Durable result and settlement layer

Add to the original ticket/match/action/receipt tables:

| Table | Contract |
| --- | --- |
| multiplayer_periods | Immutable ladder/mode/rules/scoring versions and UTC open/close/settlement-grace boundaries |
| multiplayer_match_settlements | match_id PRIMARY KEY; completed/abandoned/no_contest classification, eligibility/reason, result digest and settlement version |
| multiplayer_results | PRIMARY KEY(match_id,user_id); server-derived outcome, Splats, opponent, period, source and eligibility |
| multiplayer_ratings | PRIMARY KEY(user_id,ladder_key,period_id); rating, rated games and W/D/L projection |
| multiplayer_rating_events | PRIMARY KEY(match_id,user_id); algorithm version, pre-rating, opponent pre-rating, delta and post-rating; immutable audit |
| multiplayer_pair_allowances | Canonical unordered pair/day, reserved/settled counts and match references; atomic cap enforcement |

Settlement is one transaction: lock match → seat rows in fixed order → rating rows in UUID order → associated result/receipt/reservation rows. Recheck a settlement receipt after locking; derive the outcome from accepted actions/immutable rules, insert both result/rating events, update both ratings, terminalize tickets and release both reservations atomically. Publish a canonical result notification after writes. No client submits score, win or rating delta.

Coordinator paths acquire the coordinator lock before the match and then follow the same subordinate order. A scorer never takes the coordinator after the match. Keep the lock order explicit in helpers; rating updates must finish before a new live reservation can be allocated.

Replay returns the existing immutable settlement and both rating events. A later moderation correction appends a linked void/compensation event, never edits the original event. Rank is derived from current eligible projections.

A period's match can finish for five minutes after its close if scheduled starts_at was before the boundary. Allocation must choose the next period if the scheduled countdown start crosses the boundary. Settlements after the grace are recorded as late/ineligible; they never move into the next period. A server sweep settles expired active matches promptly; it is a coarse settlement/cleanup job, not the 12-second animation clock.

## 7. Ranked disconnect and terminal policy

Use a proposed **20-second reconnect grace**, with earlier “coming back” hints. Server heartbeat/action requests track freshness; they cannot prove human participation. Reconcile an expired grace under the match lock before refreshing the returning pig's last_seen timestamp.

| Trigger | Result | Rating |
| --- | --- | --- |
| Ready/check/countdown cancellation before starts_at | No contest | No change |
| Normal six exchanges | Win/draw/loss from Splats | Update |
| Explicit Leave after starts_at | Leaving pig loses | Update |
| One pig exceeds grace while the other remains fresh | Missing pig loses; “Round ended early” | Update |
| Both pigs exceed grace, verified service incident, invariant failure | Technical no contest | No change |
| Block created before play | No contest | No change |
| Block created after play | Blocker treated as leaving for this match; deny future pairing/actions | Update unless a server-recorded moderation exception applies |

Blocking must not erase a losing match. If both block or otherwise leave, resolve by server event order under the match lock; a verified mutual outage takes the technical-no-contest path. Keep moderation correction possible because unsafe interactions and connectivity failures cannot be inferred perfectly from this protocol.

Unknown RPC outcomes recover using the original nonce and snapshot. Practice is offered only after confirmed queue cancellation, never fills a rated seat, and writes no competitive result.

This policy can count a genuine mobile connection failure as a loss. Treating every disconnect as no contest would instead permit rage-disconnects to preserve rating. The proposed grace and service-incident exception are explicit tradeoffs for the prototype.

## 8. RPC additions and verification

- submit_volley_choice(match,exchange,lane,nonce): accepted receipt or typed rejection, never leaked rival lane.
- match_snapshot(match): authorized pre/post-reveal projection, phase/deadlines and freshness.
- multiplayer_leaderboard(ladder,period,cursor,limit): bounded pages, metadata and viewer placement/rank.
- match_result(match): immutable settlement and both rating changes.
- Find another pig reuses public random join; no private-room/rematch RPC in this scope.

Retain the original concurrency/auth/cleanup/retry tests, then add:

1. Two simultaneous commits resolve once; all pre-reveal snapshots/events hide the other lane.
2. Spent-card reuse, wrong seat, nonce conflict, late input and forged score fail.
3. Deadline versus commit/leave/heartbeat races settle exactly once; quitting or blocking cannot erase a loss.
4. Elo delta sums to zero; finish replay never double-counts; the fifth rated match enables public placement.
5. Practice, co-op, QA/admin/test and capped pairs never update the ladder; allowance reservations hold under concurrent joins.
6. Period/countdown crossing and close-grace settlement use the intended period; old/new rules cannot mix.
7. Keyset pagination is stable on a closed period; tied rank and off-page/hidden viewer behavior are correct.
8. Two devices: ordinary completion, one-sided 8-second resume, 25-second abandonment, both-sided loss, server-incident no contest, unknown result/retry.

Track queue fill/wait, distinct opponents, repeat rate, placement completion, W/D/L distribution, abandoned/no-contest rate and rating changes. Validate the card game's skill depth separately from transport success.

This is documentation/concept art only. Implementing the new database and player system will require release followup enqueueing, quality gates and local security/concurrency tests. A database push still requires the user's explicit go.
