# Fence the Pen: fun audit (Codex, 2026-10-07)

> Written by Codex (`gpt-6-astra`) from the rules, the board UI, and strategy simulations through the real engine. Numbers measure rules and bot behaviour, not human enjoyment. Simulation scripts are local-only, under `artifacts/fun-audit-2026-10-07/codex-sims/fence_the_pen/`; run them from `artifacts/fun-audit-2026-10-07/` (see the [summary](README.md)).

**Verdict: 5/10 — FIX.** A good two-player chain-control game is buried inside a slow, unforgiving introduction and a badly skewed party format. Playtest a smaller scope before spending more on infrastructure.

**The core moment**

“I left you two pens so I could take the rest.” That is a real, satisfying reversal—and a reason to send an “oops” or “wow.”

One simulated position demonstrates it exactly: taking an available pen leads to an **11–5 loss** under optimal continuation; declining it leads to a **10–6 win**. The problem is teaching players to recognize that moment. The exploration calls the skill curve “shallow and legible”; the simulations challenge that assumption. (`docs/multiplayer/explorations/01-classic-board-games.md:20`; reproducible position in `probe-results.json`, seed `cross:0`, move 28.)

**The player’s five-line understanding**

1. Draw a fence between two neighboring posts.
2. Tap a gap to preview; tap that gap again to place it.
3. Complete a pen to claim its truffle.
4. Claim a pen and draw again.
5. When all fences are placed, most pens wins; equal top scores share the win.

The how-to omits the two-tap interaction—the footer supplies it. “Draw again” does not explicitly say **must**. It also leaves players to infer that only the **fourth side** determines ownership, regardless of fence colors, and that truffles are game pieces rather than inventory rewards. (`components/play/games/fence_the_pen/index.tsx:13`; `layout.ts:256`; `multiplayer/games/fence_the_pen/rules.ts:88`.)

**What I measured**

Over **100,000 simulated tables**, using the actual rules and bot, plus five alternatives:

- **Naive:** first available fence.
- **Random:** uniformly random fence.
- **Greedy:** take the most immediate pens; otherwise random.
- **Cautious:** greedy, then avoid giving away a pen; otherwise random.
- **Solver:** stock bot until 14 fences remain, then exact two-player minimax—including deliberate sacrifices.

These are strategy experiments, **not measurements of human enjoyment**. All 1,800 real-engine validation tables ended without illegal bot actions; 100 independently calculated endgames matched the solver.

| Live two-player matchup | N, equally split between seats | First strategy win / draw / loss | Mean pen margin |
|---|---:|---:|---:|
| Bot vs naive | 1,000 | 99.9% / 0.1% / 0% | +13.7 |
| Bot vs random | 1,000 | 100% / 0% / 0% | +14.6 |
| Bot vs greedy | 1,000 | 95.8% / 2.1% / 2.1% | +9.7 |
| Bot vs cautious | 1,000 | 76.8% / 8.7% / 14.5% | +5.1 |
| Solver vs bot | 1,000 | 75.5% / 8.7% / 15.8% | +3.5 |

There is **no demonstrated universally dominant strategy**. There is a substantial knowledge advantage, followed by another advantage from deeper endgame reasoning. Randomness comes from strategy tie-breaking; the game itself has no dice or hidden information.

Equal-stock-bot results:

| Mode / seats | N | Sole-win percentages, first seat → last | Draws | All scores zero halfway | Midpoint leader subsequently loses |
|---|---:|---|---:|---:|---:|
| Live / 2 | 2,000 | 63.5 / 32.6 | 4.0% | 97.5% | 35/50 — 70.0% |
| Live / 3 | 2,000 | 63.3 / 28.5 / 2.4 | 5.9% | 96.2% | 60/77 — 77.9% |
| Live / 4 | 2,000 | 60.4 / 30.2 / 2.8 / 0.2 | 6.5% | 96.2% | 72/76 — 94.7% |
| By post / 2 | 2,000 | 20.6 / 79.5 | 0% | 98.4% | 4/32 — 12.5% |
| By post / 3 | 2,000 | 75.7 / 17.9 / 0 | 6.5% | 98.8% | 21/24 — 87.5% |
| By post / 4 | 2,000 | 19.4 / 0 / 0 / 73.7 | 7.0% | 98.9% | 0/23 — 0% |

“Comeback” requires a unique midpoint score leader; finishing tied is not losing. The small denominators matter: most games have **no midpoint leader**, so these percentages do not establish a reliable comeback experience.

Seat effects are policy-dependent, not proven optimal-play advantages. For example, cautious two-player live self-play produces 46.1% first-seat wins, 38.6% second-seat wins and 15.3% draws across 1,000 games—considerably less skewed than the stock bot.

At **40% of the actual 20-second clock**, each fence takes eight seconds:

| Live seats | N | Fences / duration | Average waiting per player | P90 longest uninterrupted wait |
|---|---:|---|---|---|
| 2 | 2,000 | 40 / **5:20** | 2:40 — 50% | 1:20 |
| 3 | 2,000 | 40 / **5:20** | 3:33 — 67% | 1:52 |
| 4 | 2,000 | 40 / **5:20** | 4:00 — 75% | 2:16 |

These exclude matchmaking, the three-second countdown and network overhead. Waiting includes useful observation and planning; it is not automatically dead time.

For meaningful choices, I estimated each action’s expected final pen count under the table’s continuation strategy. Independent validation rollouts had to establish a material difference of at least half a pen. This conservatively detects choices; failure to detect a difference does not prove equivalence.

| Condition | Games / assessed decisions | Material choices per seat, in order | Result-dead fences per game |
|---|---|---|---:|
| Live, 2 bots | 32 / 1,280 | 16.3 / 12.1 | 2.3 |
| Live, 3 bots | 32 / 1,280 | 12.3 / 7.0 / 7.2 | ≥2.2 |
| Live, 4 bots | 32 / 1,280 | 10.0 / 5.7 / 3.7 / 5.7 | ≥1.7 |
| By post, 2 bots | 32 / 768 | 6.4 / 9.5 | 2.0 |
| Live, 2 greedy players | 32 / 1,280 | 9.8 / 8.8 | 2.7 |

“Result-dead” means the winner/draw cannot change regardless of subsequent choices. Two-player endgames were exhaustively checked; multiplayer uses a conservative score bound. Scores can still change. **Most play is not mathematically dead; its consequences are poorly signposted.**

**Problems, ranked by impact**

1. **Three- and four-player games reward seating and another player’s mistakes too heavily.** Equal bots produce the extreme seat splits above. With one greedy player and two bots, the bot immediately after the greedy player wins **69.8–97.1%**, depending on seating, across 2,000 games per arrangement. The interaction is strong, but often means “your mistake feeds the next person,” not an interesting contest involving everyone. Rotation and mandatory capture continuations cause this structure. (`multiplayer/games/fence_the_pen/rules.ts:72`, `:104`.)

2. **The advertised gentle skill curve is a knowledge cliff.** Merely collecting available pens loses 95.8% against Practice. Learning to avoid third sides helps, but cautious still loses 76.8%. A practiced stranger can turn a beginner’s game into a long demonstration. That threatens the charter’s “losing feels warm” lens even without economic stakes. The bot explicitly implements chain counting while excluding double-cross tactics. (`rules.ts:176`; `SKILL.md:27`.)

3. **The payoff arrives late, especially by post.** Safe bot play produces its first pen around fence **22.5**, roughly **three minutes** into live play. The score then changes in bursts. For two-player correspondence, fixed staggered daily visits yield **15.4 days** at one fence per player per day, or **7.6 days** if extra moves are completed immediately; the first pen arrives around **day 6.7**—2,000 games per model. Literal once-daily extra moves also sit exactly on the 24-hour deadline, making that estimate optimistic. (`rules.ts:19`, `:236`; `engine.ts:539`.)

4. **The UI celebrates individual captures better than the strategic reversal.** Preview, haptics, pig stamps and queued capture animations are good. But “sweep” reactions count pens within one revision: a long manually played chain usually arrives across many revisions, each starting that count again. Players may see repeated jumps without a clear “you just took six” moment. (`components/play/games/fence_the_pen/Board.tsx:118`; `reactions.ts:22`; `layout.ts:233`.) Phone readability also needs testing: the README already documents **38–41-point pitch with 44-point hit targets** on an SE at large accessibility sizes. (`multiplayer/games/fence_the_pen/README.md:36`.)

5. **The clock permits low-effort stalling.** Two timeouts followed by one accepted action repeatedly resets the consecutive-miss count. In 400 games this never forfeited and stretched average duration to **6.71 minutes**, versus 5.33 for manually choosing the default move. It won only 7.5%, so this is a pacing exploit, not a winning strategy. Always missing forfeited in all 400 controls. (`multiplayer/engine.ts:258`, `:288`; `rules.ts:275`.)

The pig presentation does useful emotional work: ownership stamps, truffles and warm reactions make a recognizable table. **Mechanically, it remains a reskin.** Pigs do not affect decisions. Connect and Contend have a credible foundation; Collect contributes familiar imagery rather than an actual collecting loop. That is acceptable under the charter’s temporary, no-stakes table amendment—it just cannot carry the fun by itself.

**Concrete changes**

| Change | Expected effect | Confirmation |
|---|---|---|
| Launch Fence as **two-player live only**, retaining 4×4. | Removes party kingmaking and reduces average waiting to 50%. | Mixed-experience pairs should still request rematches; measure experienced-vs-new completion and enjoyment separately. |
| Change live deadline **20 → 15 seconds**. | Models to **4:00**, within the target. A later 15-second normal / 10-second extra-move experiment models to 3:31. | Human median 2–5 minutes; fewer than 5% involuntary timeouts. Do not assume humans automatically become 25% faster. |
| Add a short interactive Practice lesson: claim the fourth side, then see how a third side gives the rival a pen. Offer an easier greedy Practice bot. | Makes the first loss explainable and gives beginners a reachable opponent. | After one lesson, players can predict who receives an offered pen and deliberately avoid one giveaway. |
| Rewrite copy: **“The fourth fence claims the pen—even if another pig drew the others. Claim a pen and you must fence again.”** Include two-tap instructions and “truffles count only in this game.” | Removes ownership, input and reward ambiguity. | First-time players explain ownership and complete their first placement without intervention. |
| Accumulate **“4 pens this turn”** across revisions; celebrate the completed run. Keep preview/confirm. | Makes the social payoff recognizable and worth reacting to. | Both players can identify the turning point; observe spontaneous emotes during a run. |
| Preserve non-overlapping gap selection on small screens; compact surrounding chrome before shrinking targets. | Reduces costly input errors. | SE-sized device at large text: 20 instructed placements with zero wrong-edge confirmations. |
| Keep by-post discovery off pending a separate daily-use test. If retained, explicitly request **one visit per turn**, completing extra moves together. | Sets honest expectations; avoids advertising a fortnight of single fences as quick daily play. | A week-long test measures return rate before the first capture and completion without reminders. |
| Trial a Fence-specific **four cumulative missed-deadline limit**. | Stops indefinite two-miss/reset stalling while allowing occasional misses. | Replay the exploit and disconnect cases; ensure ordinary reconnects do not feel punitive. |

**Do not blindly shrink live to 3×3.** It reaches 3:12 at the existing clock, but equal-bot two-player trials gave the second seat **82.3% wins** across 2,000 games.

These are mostly small server-rule changes, but **they are not existing remote tuning knobs**. Current remotely polled settings expose game availability; board size, seat limits, pace and Fence’s deadline are compiled. Make those values configurable and snapshot them per match before treating them as live tuning. UI and Practice changes need client coordination. (`server/src/settings.ts:63`; `rules.ts:21`, `:231`.)

**15-minute playtest, 2–4 people**

- **0:00–1:00:** Seat two people—or all four for the party stress test. Include a Dots and Boxes newcomer. Show only the existing how-to. Explain no strategy.
- **1:00–6:30:** Play one live match. Watch first-tap confusion, third-side giveaways, who notices chains, phone disengagement during waits, involuntary timeouts and spontaneous reactions.
- **6:30–7:00:** Leave the result screen visible. Stay silent for 15 seconds and record unsolicited rematch votes.
- **7:00–12:30:** If they rematch, rotate seats and observe whether they change strategy. If they decline, replay the turning position and ask them to describe what happened.
- **12:30–15:00:** Ask exactly three questions:
  1. “Which move changed the game, and why?”
  2. “When did you stop feeling able to influence it?”
  3. “Who would you voluntarily invite to play this again?”

**Primary fun metric:** unprompted rematch acceptance, particularly among losers. A useful provisional gate is **at least 60% across ten or more real tables**. One 15-minute session diagnoses problems; it cannot validate that threshold.

**Scripts and rerun**

All retained scripts, results and definitions are in [codex-sims/fence_the_pen/README.md](../../../artifacts/fun-audit-2026-10-07/codex-sims/fence_the_pen/README.md).

```sh
server/node_modules/.bin/tsx codex-sims/fence_the_pen/tournament.ts
server/node_modules/.bin/tsx codex-sims/fence_the_pen/probes.ts
server/node_modules/.bin/tsx codex-sims/fence_the_pen/decisions.ts
server/node_modules/.bin/tsx codex-sims/fence_the_pen/tuning.ts
```

`core.ts` contains the shared strategies and solver. The sandbox rejected the CLI’s IPC socket; successful runs used `node --import ./server/node_modules/tsx/dist/loader.mjs` in place of the CLI. No network or commits were used; no tracked source changed. I accidentally created temporary files at the repository root, then removed them; retained audit outputs are confined to the allowed directory.