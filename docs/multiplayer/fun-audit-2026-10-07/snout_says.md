# Snout Says: fun audit (Codex, 2026-10-07)

> Written by Codex (`gpt-6-astra`) from the rules, the board UI, and strategy simulations through the real engine. Numbers measure rules and bot behaviour, not human enjoyment. Simulation scripts are local-only, under `artifacts/fun-audit-2026-10-07/codex-sims/snout_says/`; run them from `artifacts/fun-audit-2026-10-07/` (see the [summary](README.md)).

**Verdict: 5/10 — FIX.** There is a worthwhile social guessing game here, but cancellation rewards remembering “discarded” clues, the live clock rushes comprehension, and by-post play punishes daily visitors.

**The game, as the in-app how-to explains it**

1. One pig guesses the answer from nine pictures.
2. Everyone else is a Nose who knows the answer.
3. Each Nose shows a picture that reminds them of it.
4. Matching clue pictures cancel.
5. Guess correctly on the first tap for two points, or the second for one; everyone shares the total.

The how-to omits the separate twelve-picture clue tray, irreversible submissions, role rotation, round count, and the three eliminated answers when every clue cancels. “Two taps” also obscures that each tap immediately submits a guess. These are material first-game surprises. [index.tsx:17](../../../components/play/games/snout_says/index.tsx:17)

**The core moment**

“You picked *that* to mean *this*—now I understand.” That is a real reason to react, laugh, or remember another player. The clue bubbles belong to identifiable pigs, and the answer reveal makes the association readable.

Interaction is genuine: your clue changes my guess. However, rounds are otherwise independent; there is little developing tension beyond the current answer and shared score. At two players, the entire cancellation layer disappears.

Connect is the strongest pillar. Collect contributes familiar objects as a shared vocabulary. The pig presentation helps recognition and social attribution, but the underlying rules remain a portable picture-association game.

**Simulation evidence**

The main experiment ran **63,000 live games**: 3,000 per strategy and seat count, using the actual definition and room engine. Strategies receive only their own views. Additional probes tested decisions, cancellation, daily schedules, and proposed fixes.

These measure policy performance, **not human enjoyment**. Bots share the author’s hidden association tags; strangers will not. At 3,000 games, success rates have a worst-case approximate 95% sampling margin of ±1.8 percentage points.

Each cell below is **mean points out of 12 / team success rate**. Success means reaching six points.

| Strategy | 2 players | 3 players | 4 players |
|---|---:|---:|---:|
| Shipped bot | 6.51 / 68.9% | 5.40 / 47.7% | 5.20 / 43.5% |
| Naive: first available picture | 2.02 / 2.9% | 3.03 / 10.2% | 3.00 / 9.5% |
| Random | 2.03 / 2.9% | 2.13 / 3.8% | 2.06 / 3.2% |
| Greedy: strongest target association | 7.08 / 77.5% | 4.20 / 26.2% | 4.34 / 28.5% |
| Cautious: distinguish the target; coordinate distinct clues | 8.68 / 95.0% | 9.53 / 98.9% | 9.49 / 98.8% |
| Exploit: deliberately duplicate, then remember cancelled clue | 7.02 / 75.6% | 8.40 / 93.2% | 8.37 / 93.3% |
| Artificial prearranged picture code | 10.85 / 99.87% | 10.96 / 99.97% | 10.99 / 99.97% |

The cautious group uses an agreed allocation of clue ranks. The code strategy encodes the answer’s position using the public picture catalog. Neither represents uncoordinated newcomers. **No universally dominant strategy was established**; the code is the strongest tested, while cancellation abuse beats ordinary play without being optimal.

Live timing assumes simultaneous Noses each use 40% of their window, each guess uses 40%, and every reveal lasts its full three seconds. Queueing and countdown are excluded.

| Shipped-bot metric | 2 players | 3 players | 4 players |
|---|---:|---:|---:|
| Games | 3,000 | 3,000 | 3,000 |
| Accepted actions/game | 15.46 | 21.97 | 28.11 |
| Minutes/game | 1.33 | 1.36 | 1.37 |
| Waiting on others/player | 30.9 s | 34.6 s | 36.3 s |
| Additional shared reveal time | 18 s | 18 s | 18 s |
| Actions after team success became certain/impossible | 19.0% | 17.4% | 16.5% |
| Guesser rounds by seat, live | 3, 3 | 2, 2, 2 | 2, 2, 1, 1 |
| Recover from below midpoint pace | 35.6% of 984 | 19.0% of 1,393 | 18.8% of 1,509 |
| Above midpoint pace, ultimately fall short | 6.7% of 1,406 | 15.2% of 989 | 17.9% of 896 |

“Below pace” means fewer than three points after three rounds; “above” means more than three. There is **no opposing leader**, so competitive comeback rate is inapplicable. Recorded draws were **0%**; completed results are cooperative, not competitive ties.

Dead actions above cannot change binary success, but **can still improve the score and result band**. Waiting is mechanical inactivity, not demonstrated boredom.

For meaningful decisions, a separate **300-game sample per seat count** integrated the shipped bots’ clue probabilities:

| Decisions/player/game | 2 players | 3 players | 4 players |
|---|---:|---:|---:|
| Verified EV-changing clue decisions | 3.00 | 4.00 | 4.50 |
| Estimated total including informed guesses | 7.74 | 5.88 | 6.50 |

Every sampled clue decision had options with different expected scores. The additional guess count uses differing association scores as a proxy, not an exact human or Bayesian valuation. Meaningful choice exists; the problem is what the rules reward.

**Problems, ranked by impact**

1. **Cancellation does not remove information—and grants compensation for information you still have.** The guesser receives cancelled picture identities, sees them before they tear away, and gets three wrong answers removed if nothing survives. In **20,000 paired rounds**, remembering the same clue increased expected points from **1.170 without cancellation to 1.393 with cancellation and fog: +19.0%**. It improved 45.6% of rounds and worsened none. Forgetting the clue, as the shipped bot does, yields only **0.500**.

   This is a broken incentive, not merely an advanced strategy. The ordinary three-player bot loses every clue in **38.9% of rounds**; greedy clue-givers do so in **57.6%**. Agreement becomes either punishment or a bonus depending on whether the guesser notices the animation. [rules.ts:264](../../../multiplayer/games/snout_says/rules.ts:264), [ClueBubble.tsx:96](../../../components/play/games/snout_says/ClueBubble.tsx:96)

2. **By post does not support one move a day reliably.** Windows expire after twelve hours; two consecutive missed obligations can remove a player. With independently phased, reliable daily visitors taking one action per visit:

   | Players | Schedules tested | Games completing normally | Current guessing rotation |
   |---|---:|---:|---|
   | 2 | 3,000 | 17.9% | 2, 1 |
   | 3 | 3,000 | 62.2% | 1, 1, 1 |
   | 4 | 3,000 | 78.4% | 1, 1, 1, **0** |

   Normal completion does not imply successful guessing. Worse, the fourth player never gets the central role in a completed four-player postal game. [rules.ts:30](../../../multiplayer/games/snout_says/rules.ts:30), [engine.ts:78](../../../multiplayer/engine.ts:78)

3. **The live game buys brevity by squeezing comprehension.** A Nose may inspect nine answer candidates and twelve clue pictures in ten seconds. Compact layouts remove instructions and other-player status; picture labels can disappear when they do not fit. The payoff then passes in three seconds. Pinning actions and providing accessible labels are good implementation choices, but they do not establish that newcomers can read the game comfortably.

   All tested strategy means were approximately **1.1–1.5 minutes**, below the requested 2–5 minutes. The original exploration actually targeted approximately 100 seconds, so this mismatch began in the design brief. [layout.ts:338](../../../components/play/games/snout_says/layout.ts:338), [PictureTile.tsx:147](../../../components/play/games/snout_says/PictureTile.tsx:147), [exploration:150](../../../docs/multiplayer/explorations/03-cooperative-and-asymmetric.md:150)

4. **Participation and the match-level goal are uneven.** At four players, the first two seats guess twice and the others once. There is no individual winning advantage—everyone shares the result—but there is a clear spotlight advantage. Meanwhile, six points constitutes success internally without the how-to stating that goal. The visible experience is mostly six separate puzzles followed by a grade. [rules.ts:377](../../../multiplayer/games/snout_says/rules.ts:377), [rules.ts:517](../../../multiplayer/games/snout_says/rules.ts:517)

**Concrete changes**

- **Merge duplicate clues into one surviving clue.** Keep a shared “same thought!” reaction. Give the free sniff only when nobody submitted any clue. This preserves the social agreement moment and removes the memory exploit. Separate **3,000-game tests per variant/seat count** raised three-player bot success from **48.4% to 82.5%**, and four-player success from **42.3% to 84.9%**. Confirm with people that agreement feels satisfying without making every answer obvious.

- **Use 20 seconds for clues, 15 seconds per guess, and five-second reveals. Set live rounds to 8/6/8 for 2/3/4 players.** Everyone gets equal guessing turns. With merged duplicates, simulated means were **3.00 / 2.21 / 2.93 minutes**, respectively, across 3,000 games each. Test whether players explain clue-to-answer connections before the reveal disappears and submit without rushed mistakes.

- **Use 36-hour postal windows and one full role rotation: 2/3/4 rounds.** All **3,000 daily schedules per seat count** completed without timeouts under this model. The cost is duration: approximately **3.7 / 6.2 / 8.5 days**, respectively. Present this honestly as a game unfolding over days; validate actual daily return behaviour before promising a shorter cadence.

- **Make the action and goal explicit.** Use copy such as: “Choose a clue from your tray. Show locks it in. Each guess tap is final.” For merged duplicates: “Matching clues become one.” Keep names visible on selectable pictures and show the selected clue’s full name above the confirmation button. Display “Together: 5 of 8 needed,” then a stretch target after success. Confirm comprehension through unaided first play, accidental-tap counts, and whether players notice reaching the goal.

These are **not existing remote tuning switches**. Snout’s numbers are compiled into shared rules, and the client clock reads those constants. For subsequent experiments, snapshot tuning into each room and have the client and Practice consume it. The initial rules change requires versioning and coordinated deployment. [rules.ts:29](../../../multiplayer/games/snout_says/rules.ts:29), [clock.ts:10](../../../components/play/games/snout_says/clock.ts:10)

**15-minute playtest: 2–4 people**

- **0–2 minutes:** Separate phones, actual in-app how-to, no extra rules lecture. Keep choices silent; allow emotes and conversation after reveals. Record the screens with consent.
- **2–5:** First match. Watch tray/spread confusion, accidental guesses, deadline pressure, and whether anyone understands cancellation without help.
- **5–8:** Second match. Watch whether associations improve, players anticipate one another, and reactions express understanding rather than confusion. Note who gets the memorable moments.
- **8–11:** Say the required games are finished. Leave rematch available and stay silent. Observe whether players independently propose and start another game.
- **11–15:** Ask: “Which moment would you retell, if any?” “When did your choice feel consequential, and when was it guesswork?” “What did matching clues do, and how did that feel?”

**The one fun metric:** unprompted mutual rematch rate—the proportion of tables that voluntarily start another match after the required play ends. For a small follow-up, use **four of six independent tables** as a provisional reason to keep investing, not proof of broad appeal.

**Scripts and rerunning**

- [audit.ts](../../../artifacts/fun-audit-2026-10-07/codex-sims/snout_says/audit.ts): strategies, timing, decisions, cancellation, seat placement, and engine sanity checks.
- [proposals.ts](../../../artifacts/fun-audit-2026-10-07/codex-sims/snout_says/proposals.ts): simulated rule/timing variants and daily schedules.
- [README.md](../../../artifacts/fun-audit-2026-10-07/codex-sims/snout_says/README.md): methodology and limitations. Full results are saved alongside it.

```sh
server/node_modules/.bin/tsx codex-sims/snout_says/audit.ts
server/node_modules/.bin/tsx codex-sims/snout_says/proposals.ts
```

The sandbox rejected the CLI’s IPC socket. Successful runs used the same installed TypeScript loader:

```sh
TSX_DISABLE_CACHE=1 node --import ./server/node_modules/tsx/dist/loader.mjs codex-sims/snout_says/audit.ts
TSX_DISABLE_CACHE=1 node --import ./server/node_modules/tsx/dist/loader.mjs codex-sims/snout_says/proposals.ts
```

The 300 `playOut` sanity games finished with zero illegal moves or secrecy-marker failures. No production files were edited; no network or commits were used.