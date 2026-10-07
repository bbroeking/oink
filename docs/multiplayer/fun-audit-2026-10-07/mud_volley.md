# Mud Volley: fun audit (Codex, 2026-10-07)

> Written by Codex (`gpt-6-astra`) from the rules, the board UI, and strategy simulations through the real engine. Numbers measure rules and bot behaviour, not human enjoyment. Simulation scripts are local-only, under `artifacts/fun-audit-2026-10-07/codex-sims/mud_volley/`; run them from `artifacts/fun-audit-2026-10-07/` (see the [summary](README.md)).

**Verdict: 4/10 — FIX.** The reveal has charm and genuine counterplay, but six tosses barely support reading a stranger, and by-post can award wins to players who never act.

**What the current how-to teaches, in five lines:**

1. Both pigs see which way the tosser winds up.
2. Toss that way for a big splat worth 2.
3. Flick another way for a small splat worth 1.
4. When catching, pick a lane.
5. A clean catch earns the catcher 1.

It omits simultaneous secret choices, the explicit same-lane catch condition, alternating roles, six-toss length, highest-score victory and draws. It also never explains that the game assigns the wind-up. A newcomer could reasonably think catching the advertised wind-up is the objective. [index.ts:16](../../../components/play/games/mud_volley/index.tsx:16)

**The core moment exists:** both lanes lock, the mudball flies, and the bucket either intercepts it or a pig gets splatted. A catch denying a possible two-point hit is worth an emote. The board delays the score until impact, reacts with the pigs and announces the outcome—good causal feedback. [Board.tsx:139](../../../components/play/games/mud_volley/Board.tsx:139)

The pig theme makes losing warmer through personalized pigs, accumulated mud and friendly reactions. Mechanically, this remains penalty guessing with pig art; removing the pigs changes no decisions. It serves **Connect** through presentation and **Contend** through temporary rivalry. **Collect** contributes avatar expression, not a game-specific collecting loop.

**Simulation evidence.** I ran 280,000 strategy-matchup games through the real engine, plus timing, async, timeout and tuning experiments. Policies only receive their own view. These measure rules and behavior, not human enjoyment. Near-50% rates with 10,000 samples have approximately ±1 percentage point sampling uncertainty.

| Current game metric | Result | Sample |
|---|---:|---:|
| Completed live length | 6 exchanges; 12 action steps | 10,000 Edna self-play |
| Live duration at 40% of each window | **43.4 seconds / 0.72 minutes** | Same |
| Equity-sensitive choices per player¹ | **3.87 of 6** | 120,000 decisions |
| Draw rate | **18.47%** | 10,000 |
| Seat 0 wins, excluding draws | **49.87%** | 8,153 decisive games |
| First tosser wins, excluding draws | **49.99%** | 8,153 decisive games |
| Midpoint leader subsequently loses² | **14.46%** | 1,323 / 9,147 leads |
| Matches containing decisions after winner is fixed | **39.34%** | 10,000 |
| Such dead decisions per player | **0.50** | 10,000 |
| Waiting for opponent after your lock, equal response times | **0 seconds** | Timing model |
| Waiting with response times independently spread over 20–60% of window | **3.58 seconds/player**; match **47.01 seconds** | 10,000 |
| By-post length | 2 submissions; **6 picks/player**, no intervening feedback | 10,000; 18.24% draws |

¹ A choice counts when its options differ by at least one percentage point in expected final **win + half-draw**, against known Edna with optimal continuation. This is a model-based agency measure, not demonstrated human skill. Counting any nonzero difference gives 5.41 choices/player. Immediate expected score margin is identical across all lanes against Edna.

² Midpoint means after exchange three. Tied midpoint scores are excluded; final draws remain in the denominator.

The timing includes countdown and final reveal, excludes matchmaking/network delays. Wind-up/reveals occupy 18.8 seconds, plus a three-second countdown; that presentation is not automatically wasted time. The live clock forfeits an always-idle opponent after three misses, at 38.3 seconds from game start; both idle produces no contest.

The six alternative strategies perform as follows against the shipped bot:

| Strategy | Behavior | Win | Draw | Loss |
|---|---|---:|---:|---:|
| Edna | Shipped bot | 40.72% | 18.47% | 40.81% |
| Naive | Always middle | 41.51% | 16.57% | 41.92% |
| Greedy | Always follow and cover wind-up | 40.44% | 16.26% | 43.30% |
| Cautious | Always flick; always cover wind-up | 30.88% | 37.89% | 31.23% |
| Random | Uniform random lanes | 42.92% | 15.96% | 41.12% |
| Adaptive | Learn public tendencies; maximize expected score margin | 41.37% | 13.62% | 45.01% |
| Exploit | Score-aware, exact response to known Edna | **56.20%** | **5.85%** | **37.95%** |

Each row has **10,000 games**, with unlike strategies spending 5,000 games in each seat. All 28 matchups are preserved in the results.

**Problems, ranked by impact:**

1. **By-post can manufacture competitive results without play.** With two occupied seats, an absent player won **4,164/10,000** matches against an active Edna player. When neither acted, **8,504/10,000** matches produced an ordinary winner; all 10,000 were rating-eligible. Missing envelopes become six random picks, resolving the match before missed-turn handling can intervene. The result mapper imposes no participation gate. This directly undermines earned accomplishment. These were pure simulations; no stored ratings changed. [rules.ts:530](../../../multiplayer/games/mud_volley/rules.ts:530), [engine.ts:282](../../../multiplayer/engine.ts:282), [results.ts:53](../../../server/src/results.ts:53).

2. **The stranger-reading premise is underfed.** Each player throws only three times: before their final catch, the defender has seen just two opposing throws. The wind-up is randomly assigned, so its direction conveys no chosen intention. Interaction comes from learning whether this person follows through—not from the wind-up itself. By-post removes even that learning opportunity by sealing everything before feedback. The claimed “40/60 luck/skill” split is unsupported. [rules.ts:47](../../../multiplayer/games/mud_volley/rules.ts:47), [rules.ts:477](../../../multiplayer/games/mud_volley/rules.ts:477), [exploration:25](../../../docs/multiplayer/explorations/02-arcade-and-party.md:25).

3. **The proposed depth metric would falsely validate randomness.** In uniform-random self-play, winners followed through **39.33%**, losers **28.73%**: a **10.61-point gap despite zero learning**. Sample: 10,000 games, 25,746 throws in each winner/loser group. Conditioning on victory selects successful two-point throws. The README explicitly treats this sort of separation as evidence that reads work; it is not. [README.md:75](../../../multiplayer/games/mud_volley/README.md:75).

4. **Too many endings lack tension.** In 39.34% of Edna matches, players still pick lanes after victory is mathematically settled. Meanwhile, naive/naive, greedy/greedy and cautious/cautious each draw **100%** of 10,000 matches. These are easy repetitive loops. There is no universally dominant strategy: cautious beats greedy **100%**, adaptive beats cautious **69.34%**, and cautious beats the Edna-specific exploit **93.71%**. Counterplay exists; the short format and predictable loops hide it. The rules always finish all six exchanges. [rules.ts:352](../../../multiplayer/games/mud_volley/rules.ts:352).

5. **Practice teaches a stationary distribution, not a readable person.** Edna is an equilibrium for single-toss score margin, not the whole match’s win objective. Exact analysis gives a score-aware opponent **59.60% match equity** against it. Calling that bot “the equilibrium” overstates the claim. This is exploitable risk management, not mind-reading. [rules.ts:83](../../../multiplayer/games/mud_volley/rules.ts:83).

6. **The action controls are better than the teaching and small-screen spectacle.** Pinned cards, stable labels and reduced-motion handling are strengths. But constrained layouts can hide the pasture entirely, removing the faces and physical payoff that make this more appealing than three buttons. The envelope review uses T1/C1 and L/M/R without showing each wind-up. These are source-based concerns requiring device observation, not confirmed clipping bugs. [layout.ts:242](../../../components/play/games/mud_volley/layout.ts:242), [EnvelopeBoard.tsx:130](../../../components/play/games/mud_volley/EnvelopeBoard.tsx:130).

**Concrete changes worth testing:**

- **Fix async participation first.** After 24 hours: both occupied players missing → no contest; one missing → explicit forfeit, never an invented envelope. Expected effect: nobody earns a win through automatic guesses. Confirm with the timeout simulation: zero absent-player wins, zero rated zero-action matches.

- **Test 24 live exchanges, keeping the 9-second window and 2/1/1 payoffs, with immediate completion once catching up is impossible.** This adds observations without adding another rule layer. The tuning sweep supports testing it:

  | Exchanges | Duration before early finish | Edna draw rate | Adaptive wins against random |
  |---|---:|---:|---:|
  | 6 | 0.72 min | 18.04% | 48.88% |
  | 18 | 2.04 min | 8.95% | 60.76% |
  | 24 | 2.70 min | 7.83% | 64.73% |

  Each cell uses **10,000 games for its matchup**. Removing already-decided suffixes from the 24-exchange sample implies **2.51 minutes** on average. However, 69.18% contain such a suffix, so increasing length alone worsens dead endings. Confirm both the early-finish rule in simulation and voluntary replay in people; longer repetition is not automatically more fun.

- **Expose usable memory.** Show the rival’s last three throws relative to their wind-ups, with clear follow-through/flick pictures. Preserve a readable impact scene on small phones. Expected effect: players can explain a read instead of remembering tiny animations. Confirm that later choices respond to prior behavior, and test on an SE-sized screen with enlarged text.

- **Replace the how-to with explicit consequences.** Suggested copy: “The wind-up marks the 2-point lane. Both pigs secretly lock a lane. Same lane: the catcher gets 1. Otherwise, the tosser gets 2 on the wind-up or 1 elsewhere. Swap jobs after every toss; highest score after six wins. Equal scores draw.” Use the configured count if length changes. Confirm first-time players can predict all three outcomes before playing.

- **Make Practice demonstrate counterplay.** Use the existing Honest Hank and Slippery Sal personalities as labeled practice opponents. Retain Edna as a mixed opponent, not a claim of perfect play. Confirm players recognize and exploit the different tendencies across repeated games.

- **Reconsider the envelope format separately.** Six guesses before any response cannot deliver the advertised person-reading loop. For “one move a day,” test one sealed lane per player per daily exchange, with the previous reveal/history retained. Confirm return rate and whether players remember their opponent; merely slowing the current envelope does not fix it.

These game parameters are **not currently server-driven tuning**: exchange count, payoff and decision timing are compiled constants. `welcome.timing` covers general room/network timing. Add an immutable per-room tuning snapshot consumed by rules, views and Practice before promising server-only experiments. Current game switches can disable a game, not tune this loop. [protocol.ts:37](../../../multiplayer/protocol.ts:37)

**15-minute playtest, 2–4 people:**

- **0–2 minutes:** Use existing test accounts/builds. Two people form one table; four form two tables; with three, rotate an observer. Let players read only the in-app instructions. Ask them to predict one catch and one missed catch.
- **2–6:** Play three matches against the same partner without coaching. Watch mistaken scoring expectations, attention during reveals, spontaneous emotes and whether anyone articulates a prediction.
- **6–9:** Secretly ask one player to follow and cover the wind-up consistently for two matches. Watch whether the other notices and changes. Then remove the instruction.
- **9–11:** Try one by-post envelope. Watch whether six picks feel like planning or arbitrary form-filling, and whether players can revise a specific catch.
- **11–13:** Offer an unprompted choice: another Mud Volley, another game, or stop. No reward for replaying.
- **13–15:** Ask: “What did you learn about the other player?” “Which reveal mattered most, and why?” “What made you choose another game, another match, or stopping?”

The deciding fun metric: **both players voluntarily choose another match after the initial two**. Predeclare a target of at least **60% across 20 independent pairs**; this small session is a pilot, not sufficient evidence by itself.

**Scripts and rerun:**

- [audit.ts](../../../artifacts/fun-audit-2026-10-07/codex-sims/mud_volley/audit.ts): strategies, tournament, decisions, clocks and `playOut` checks.
- [tuning.ts](../../../artifacts/fun-audit-2026-10-07/codex-sims/mud_volley/tuning.ts): generates local 6/12/18/24-exchange rule copies and compares them.
- [timeouts.ts](../../../artifacts/fun-audit-2026-10-07/codex-sims/mud_volley/timeouts.ts): occupied-seat async timeout/result probes.
- [README.md](../../../artifacts/fun-audit-2026-10-07/codex-sims/mud_volley/README.md): methodology, limitations and JSON output descriptions.

```sh
server/node_modules/.bin/tsx codex-sims/mud_volley/audit.ts
server/node_modules/.bin/tsx codex-sims/mud_volley/tuning.ts
server/node_modules/.bin/tsx codex-sims/mud_volley/timeouts.ts
```

The requested CLI hit an IPC restriction here. All three successfully ran using this equivalent installed-loader command, substituting each script name:

```sh
TSX_DISABLE_CACHE=1 node --import ./server/node_modules/tsx/dist/loader.mjs codex-sims/mud_volley/audit.ts
```

Only `codex-sims/mud_volley/` was written. No network, commits or production changes.