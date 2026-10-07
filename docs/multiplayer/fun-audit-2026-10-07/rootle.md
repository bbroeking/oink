# Rootle: fun audit (Codex, 2026-10-07)

> Written by Codex (`gpt-6-astra`) from the rules, the board UI, and strategy simulations through the real engine. Numbers measure rules and bot behaviour, not human enjoyment. Simulation scripts are local-only, under `artifacts/fun-audit-2026-10-07/codex-sims/rootle/`; run them from `artifacts/fun-audit-2026-10-07/` (see the [summary](README.md)).

**Verdict: 5/10 — a real push-your-luck climax buried under waiting, misleading finish-line advice, and an incompatible by-post clock. FIX.**

**What a new player learns, in five lines**

1. Tap **Rootle** to roll for truffles.
2. Rolling 2–6 puts that many truffles in your basket.
3. The Hungerer eats your basket.
4. **Trot home** to keep the basket in your barn.
5. The first pig home with 50 starts everyone else’s last turn; the biggest barn wins.

That is what the [actual how-to conveys](../../../components/play/games/rootle/copy.ts:216). It omits that the Hungerer is **face 1**, busting ends your turn, banking requires a successful first roll, **50 or more** qualifies, and tied barns share the win. “Trot home any time” also contradicts the initially disabled button.

**The core moment**

“I can bank these 18—or risk them because your barn is catching mine.”

That works. A large basket disappearing, or the final challenger overtaking the leader, creates a clear moment for an emote. The presentation supports it: the basket splats, the losing pig looks sad, and the others gasp. See [reactions.ts:31](../../../components/play/games/rootle/reactions.ts:31) and [Haul.tsx:71](../../../components/play/games/rootle/Haul.tsx:71).

The question is whether people stay interested between those moments. Simulations cannot establish laughter or enjoyment; nobody was playtested for this audit.

**Measured behavior**

Baseline: **10,000 shipped-bot games per seat count**, through the real engine. Each decision consumes 40% of its window: eight seconds for a first roll, four seconds thereafter. Times exclude matchmaking and countdown. Ninety seeded games also matched the faster simulation against both the engine and `playOut`.

| Metric | 2 players | 3 players | 4 players |
|---|---:|---:|---:|
| Actions per game, mean | 42.2 | 57.7 | 72.9 |
| Turns per player, mean | 5.35 | 4.77 | 4.46 |
| Live minutes, mean | **3.53** | **4.80** | **6.05** |
| Live minutes, 90th percentile | 4.87 | 6.40 | 7.80 |
| Games exceeding five minutes | 8.2% | 36.8% | **76.4%** |
| Waiting per player | 1.76 min / 50% | 3.20 min / 67% | **4.54 min / 75%** |
| Longest individual wait, 90th percentile | 36 sec | 64 sec | **92 sec** |
| Waiting after your final action, mean | 10.8 sec | 22.2 sec | 33.7 sec |
| First-roll actions with no alternative | 25.3% | 24.8% | 24.5% |
| Win rate by seat, first → last | 53.4 / 46.6% | 36.0 / 33.1 / 30.9% | 28.3 / 24.7 / 23.9 / 23.2% |
| Draw rate | 0% | 0% | 0% |
| Unique midpoint leader eventually loses | 35.0% | 53.3% | 64.6% |
| Pig triggering the last round loses | 30.8% | 51.9% | **64.2%** |

Midpoint means halfway through modeled elapsed time, using **banked scores**. Tied midpoint leaders were excluded: denominators were **9,113 / 9,005 / 8,966**. Zero bot draws follows from their policy of always chasing strictly above the leader; the rules permit draws.

No active turn is mathematically hopeless: unlimited successful rolls can recover any deficit. But compulsory first rolls offer no choice, and players who have finished their last turn cannot act again. Those are distinct from ordinary waiting.

**How many choices actually matter?**

A binary button pair is not automatically an interesting decision.

| Per-player decision measure | 2 players | 3 players | 4 players |
|---|---:|---:|---:|
| Legal roll-versus-hold choices, baseline | 15.8 | 14.5 | 13.8 |
| Detectably different win value, estimated | 5.7 | 5.8 | 5.9 |
| Win-value gap confidently above five percentage points | 2.9 | 2.9 | 3.4 |

The estimates use **384 sampled decision states per seat count**, with **512 continuations per action**, following the shipped bot afterward: **1,179,648 continuations**. These are conservative detection counts; unresolved differences are **not** proof of equal value.

A separate two-player dynamic program, assuming optimal future self-play against the shipped bot, found **15.5 non-equivalent decisions per player**, including **5.55 with a win-value gap above five points**, across **1,000 source games**. About **24%** differed by at most one point. Continuation policy matters, so these are different measurements—not interchangeable estimates.

**Strategy results**

Six alternatives were tested against the shipped bot. Entries are win credit, dividing shared wins among their winners. Seats were balanced.

| Challenger strategy | Against one bot | Against two bots | Against three bots |
|---|---:|---:|---:|
| Naive: bank after one roll | 2.24% | 0.10% | 0.01% |
| Random: coin-flip roll/hold | 14.31% | 4.28% | 1.91% |
| Cautious: bank at 8 | 43.38% | 27.08% | 18.85% |
| Greedy: bank at 20 | 50.90% | 33.43% | 25.50% |
| Reckless: bank at 35 | 47.50% | 31.68% | 24.98% |
| Computed best response to bot | **57.69%** | — | — |
| Equal-strength reference | 50% | 33.33% | 25% |

**N = 4,000 per cell**, except best response versus bot: **20,000**. Cautious/greedy/reckless understand the target and final chase; naive/random do not. Approximate sampling uncertainty near 50% is ±1.6 points at 4,000 games and ±0.7 at 20,000.

There is **no demonstrated universally dominant strategy or winning exploit**. Banking around 20 is a strong shortcut; score-aware play adds a meaningful but moderate edge. Reasonable players remain competitive. An uninformed “always keep something” beginner gets demolished.

One nuisance exploit exists: roll normally but let every intended bank time out. Accepted rolls reset missed-deadline counts. Across **2,000 games**, this added **13.4 seconds per game**, never accumulated more than one miss, and caused no forfeits. It offers delay, not a demonstrated scoring advantage. See [engine.ts:257](../../../multiplayer/engine.ts:257).

**Problems ranked by impact**

1. **Four-player pacing fails the stated session target.**  
   Six minutes average, 76% over five minutes, and 4½ minutes waiting per player is too much for this amount of interaction. The exploration promised roughly four to five minutes at four seats; the implemented [20/10-second clocks](../../../multiplayer/games/rootle/rules.ts:43) do not support that under the requested decision-speed assumption.

2. **By-post play does not support one move a day.**  
   Rootle gives **12 hours to begin**, then **60 seconds per decision**; two missed deadlines can remove a player. See [rules.ts:45](../../../multiplayer/games/rootle/rules.ts:45) and [engine.ts:78](../../../multiplayer/engine.ts:78).

   Controlled attendance model: both players visit once daily at fixed times; the opponent’s first visit is uniformly distributed over 24 hours. Visits last three minutes.

   | Attendance and clock | N | Normal completion | Forfeit | No contest |
   |---|---:|---:|---:|---:|
   | One action/visit, current 12h hand-off | 1,000 | **0%** | 16.0% | 84.0% |
   | Whole turn/visit, current 12h hand-off | 1,000 | **0.7%** | 84.7% | 14.6% |
   | Whole turn/visit, 36h hand-off | 1,000 | **100%** | 0% | 0% |

   These are scenario results, not forecasts of human retention. They demonstrate that the current clocks punish the intended attendance pattern.

3. **The UI encourages a strategically bad finish.**  
   The [status line says “Trot home now to reach 50”](../../../components/play/games/rootle/copy.ts:70), and the [bot always does](../../../multiplayer/games/rootle/rules.ts:289).

   At **45–45 with eight in your basket**, the computed win values against the bot are **38.3% banking versus 72.0% rolling**, with optimal continuation. Independent **20,000-run branches** measured **38.0% versus 72.4%**. Finishing first can give away the game; the interface should expose that dilemma.

4. **Seat order is measurably unfair.**  
   Equal bots win **53.4% versus 46.6%** in two-player games. Four-player seat one wins **28.3%**, versus **23.2%** for seat four. Setup always starts seat zero, and the last-round rule grants every opponent another turn ([rules.ts:213](../../../multiplayer/games/rootle/rules.ts:213), [rules.ts:168](../../../multiplayer/games/rootle/rules.ts:168)). Queue seating flips the first pair but does not shuffle the entire gathered party ([matchmaker.ts:258](../../../server/src/matchmaker.ts:258)).

5. **Interaction is mostly watching and reacting.**  
   Your score changes my risk calculation, but neither player changes the other’s available actions or dice distribution. That is sufficient for a short social dice game; it struggles to justify 92-second waits. The opponent matters most near the finish, while much of the middle is threshold execution.

6. **The instructions omit facts needed to understand the risk.**  
   The how-to hides the one-in-six bust probability and shared-win rule. Small-screen fitting can remove history rows and shrink the die to 48 points; text scaling caps at 1.3×. These are inspection findings, not confirmed clipping bugs. See [copy.ts:216](../../../components/play/games/rootle/copy.ts:216) and [layout.ts:159](../../../components/play/games/rootle/layout.ts:159).

**Fun diagnosis**

| Lens | Assessment |
|---|---|
| Meaningful choices | Present, especially when racing another barn; many intermediate choices are easy or low-impact. |
| Readable tension | Strong basket risk and final chase. The finish-line prompt obscures the best strategic dilemma. |
| Interaction | Indirect score pressure; little to do during opponents’ turns. |
| Emote-worthy moment | Yes: a large bust or last-turn steal. Baseline games average roughly **1–2 busts losing at least 15**. |
| Luck versus skill | Sensible strategies remain close enough for strangers; naive safety play is severely punished. |
| Session length | Two-player live fits. Four-player live and daily by-post currently fail. |
| Phone readability | Stable controls, named barns and persistent outcomes are good. Compact layouts and large text need actual device testing. |
| Pig theme | Mechanically a reskin of Pig. Semantically useful: rooting, Hungerer, basket and barn make risk concrete. Cosmetics provide identity; these truffles are not collection rewards. |

This serves **Contend**, and potentially **Connect** if spectators react to one another. **Collect** is chiefly the players’ pig identities. The charter explicitly permits these temporary head-to-head tables and forbids economic stakes; there is no need to invent a reward faucet to rescue engagement ([SKILL.md:56](../../../SKILL.md:56)).

**Concrete changes**

| Change | Expected effect | Confirmation |
|---|---|---|
| Keep target **50**. Test **12s hand-off / 6s mid-turn** at three and four seats; retain current two-player clocks initially. | Same strategic game, shorter waits. At the same 40% response assumption, baseline means scale to **2.88 / 3.63 minutes**; four-player p90 becomes **4.68 minutes**. | Human test: fewer than 2% accidental timeouts, understandable outcomes, most matches under five minutes. |
| Increase async hand-off **12h → 36h**. Describe it accurately as one **whole turn** per visit. | In the daily-attendance model, all 1,000 games finish; mean duration **4.95 days**. | Test notification → completed-turn behavior with once-daily participants. |
| If one **action** daily is a firm requirement, use an async-only committed basket target: choose the risk once, server rolls until that target or a bust. | Makes a turn one submitted move. Requires rules/UI work, not merely clock tuning. | Simulate threshold choices and final-chase behavior before exposing this pace. |
| Replace finish advice with **“Bank 53 and start everyone else’s last turn”**. Show opponents’ banked scores beside it. | Makes banking a consequential choice rather than an instruction. | Players can explain why continuing past 50 might help; replay the 45–45/basket-eight scenario. |
| Show **“Hungerer: 1 in 6. Only this basket is at risk.”** Add “50 or more,” first-roll restriction and shared wins to the how-to. | Removes avoidable novice misunderstanding. | After reading once, players correctly predict bust, bank and tie outcomes. |
| Shuffle the **entire** live table before starting; rotate first position on rematches. Separately prototype an equal-turn final lap. | Shuffling distributes the advantage; equal turns may reduce it. These are different fixes. | Large equal-policy simulation targeting under two percentage points of positional spread; recheck comeback rate. |
| Give last-round onset a persistent visible sentence and preserve the final bust/bank beat before results cover it. | Makes the climax easier to follow and react to. | Observe whether spectators name the outcome and spontaneously emote without prompting. |

The clocks and target are currently **compiled constants**, not existing remote tuning knobs. To make experiments server-driven, snapshot effective settings at match creation and have all copy read those settings. Do not change running matches or leave “50” hardcoded in their instructions.

**15-minute playtest: 2–4 real people**

- **0–2 minutes:** Use separate phones, including the smallest supported screen. Explain no strategy. Let players read only the actual how-to. With four people, use one four-player table.
- **2–9 minutes:** Play uncoached. Record mistaken taps, first-roll confusion, pauses near 50, attention during other turns, spontaneous reactions and whether anyone understands the last round incorrectly. Mark when the match crosses five minutes.
- **9–12 minutes:** After a completed game, stay silent for 30 seconds. Leave rematch available. Observe whether players choose another game without encouragement; if they do, rotate the starter. If the first match is still running, record that instead.
- **12–15 minutes:** Ask exactly three questions:
  1. “Which decision felt hardest, and what were you weighing?”
  2. “What did another player do that changed your next decision?”
  3. “When did you most want to react—and when did you stop paying attention?”

**The one fun metric:** voluntary rematch acceptance by **losers**, without prompting or rewards. A provisional target is at least **50% across repeated sessions**. One small session is directional evidence, not validation.

**Scripts and rerun**

All authored files and results are under [codex-sims/rootle/](../../../artifacts/fun-audit-2026-10-07/codex-sims/rootle/README.md):

- `audit.ts` — baseline, strategy tournament and tuning.
- `clocks.ts` — daily attendance and timeout stalling.
- `decisions.ts` — sampled roll/hold win values.
- `strategy.ts` — computed best-response tournament.
- `verify-optimal.ts` — independent branch checks and solver-cap sensitivity.
- `lib.ts`, `optimal.ts` — shared harness and solver.

Run each entry point as requested, for example:

```sh
server/node_modules/.bin/tsx codex-sims/rootle/audit.ts
```

The CLI’s startup socket was blocked in this sandbox. Successful runs used the same installed runtime through Node:

```sh
TSX_DISABLE_CACHE=1 node --import ./server/node_modules/tsx/dist/loader.mjs codex-sims/rootle/audit.ts
```

Substitute the other entry-point filenames to reproduce their JSON reports. Production files were not edited; no network or commits were used.