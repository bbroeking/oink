# Out Looking: fun audit (Codex, 2026-10-07)

> Written by Codex (`gpt-6-astra`) from the rules, the board UI, and strategy simulations through the real engine. Numbers measure rules and bot behaviour, not human enjoyment. Simulation scripts are local-only, under `artifacts/fun-audit-2026-10-07/codex-sims/out_looking/`; run them from `artifacts/fun-audit-2026-10-07/` (see the [summary](README.md)).

**Verdict: 5/10 — a good “we both went there!” moment buried under opaque sharing, weak opposition, and too few decisions. FIX.**

**What a new player learns from the how-to**

1. Pick a place for your pig each day; everyone chooses together, and your choice is final.
2. Arrive alone and take the whole pile.
3. Meet another pig and each take one find plus a heart.
4. Piles grow overnight, except a pile taken whole rests for a night.
5. The heaviest pouch wins; hearts break a tie.

That explanation is misleading. Sharing gives **up to** one find: later pigs can receive nothing. The rotating allocation order is unexplained. “Four places” becomes three in two-player games. Find count and pouch weight are different. And hearts **cannot break a two-player tie**, because both pigs always earn them together. Sources: [how-to:15](<../../../components/play/games/out_looking/index.tsx:15>), [allocation:261](<../../../multiplayer/games/out_looking/rules.ts:261>).

**The core moment**

“I thought you would chase the Farmhouse, so I went to the Hedge—and you followed me.”

That is a real multiplayer moment. Your choice changes another player’s haul, and the reveal supplies something worth an emote: an unexpected meeting, or someone escaping with a huge pile. Facing pigs and the floating heart make the interaction readable and warm.

The problem is repetition: the game often produces compulsory crowding or unexplained empty hands before players have developed a useful read on each other.

**Simulation evidence**

I ran over 100,000 seeded tables through the actual rules and room engine, including six alternative strategies. These measure mechanics, not human enjoyment. “Varied” below means choosing proportionally to visible pile weight; it is a comparison policy, **not a model validated against humans**.

Win credit splits ties equally. Full definitions, uncertainty, seeds, and results are in the [simulation notes](<../../../artifacts/fun-audit-2026-10-07/codex-sims/out_looking/README.md>).

| Players | Days / action steps | Estimated live length | Waiting on others, per player | Reveal time |
|---|---:|---:|---:|---:|
| 2 | 4 / 8 | 0.84 min | 4.0 sec | 22.4 sec |
| 3 | 5 / 15 | 1.09 min | 7.5 sec | 28.0 sec |
| 4 | 5 / 20 | 1.12 min | 9.0 sec | 28.0 sec |

Clock model: simultaneous decisions independently taking 3–9 seconds, averaging six seconds—40% of the 15-second window—plus the actual 5.6-second reveals. Excludes matchmaking; add the normal three-second countdown. If everyone takes exactly six seconds, games last **46.4/58/58 seconds**. One player consistently answering at the deadline raises early players’ waiting to approximately **37/47/47 seconds**.

| Population | Players | Games | EV-sensitive choices/player | Draws | Midpoint leader loses |
|---|---:|---:|---:|---:|---:|
| Shipped bots | 2 | 4,000 | 3.42 / 4 | 13.4% | 16.8% of 3,137 leaders |
| Shipped bots | 3 | 4,000 | 4.62 / 5 | 8.1% | 26.3% of 3,482 |
| Shipped bots | 4 | 4,000 | 4.62 / 5 | 10.9% | 31.2% of 3,337 |
| Varied | 2 | 1,500 | 3.47 / 4 | 11.7% | 13.5% of 1,248 |
| Varied | 3 | 1,500 | 4.29 / 5 | 4.0% | 24.4% of 1,377 |
| Varied | 4 | 1,500 | 4.12 / 5 | 7.2% | 31.9% of 1,374 |

“EV-sensitive” means choices differ in expected immediate pouch weight; the final day instead uses expected win credit. **Choosing between an empty place and a full one counts**, so these figures overstate interesting dilemmas. This is not a solution of optimal whole-game strategy. Midpoint means after day two in duels, day three in party games; finishing tied first is not counted as losing.

Final-day exhaustive enumeration exposes dead decisions:

| Varied population; 1,500 games each | Player cannot win entering final day | Final choice cannot change any winner | Whole-game dead-decision lower bound |
|---|---:|---:|---:|
| 2 players | 17.1% | 35.9% | 9.0% |
| 3 players | 32.8% | 34.3% | 6.9% |
| 4 players | 39.5% | 28.9% | 5.8% |

These distinguish elimination from kingmaking. A player unable to win may still decide which rival wins. The last column is conservative: earlier dead positions were not exhaustively searched.

**Problems, ranked by impact**

1. **The interface hides information that determines who gets paid.**

   The rules expose `firstInLine`, but the UI uses sharing order only during the completed reveal. It never shows today’s order before selection. Complete public history also exists, but the board displays only the latest transient reveal. Players are denied both the current allocation rule and a persistent record of opponent behavior. [Public priority:193](<../../../multiplayer/games/out_looking/rules.ts:193>), [reveal ordering:449](<../../../components/play/games/out_looking/model.ts:449>), [latest-only history:91](<../../../components/play/games/out_looking/Board.tsx:91>).

   Randomizing priority prevents a structural host advantage. It does **not** remove the starting-position lottery:

   | Bot games; 4,000 per row | Win credit by fixed seat | Win credit by initial sharing rank |
   |---|---|---|
   | 2 players | 49.6 / 50.4% | 56.3 / 43.7% |
   | 3 players | 33.5 / 32.2 / 34.2% | 32.9 / 41.3 / 25.9% |
   | 4 players | 23.8 / 24.3 / 25.5 / 26.5% | **54.4 / 15.5 / 19.8 / 10.3%** |

   This is amplified by identical bots, but persists with varied four-player choices: initial-rank credit was **33.1 / 18.1 / 27.3 / 21.6%**.

2. **The rest-night rule manufactures obvious choices and unrewarding collisions.**

   In varied duels, **30.1% of rounds have only one nonempty place**. In varied four-player games, **32.9% of picks gain no weight**, and **40.2% of sharing outcomes leave that pig without a find**.

   A visibly empty location is usually a trap to avoid, not suspense. The README explicitly says the rest rule was added to make “muddy trotters” possible. That is presentation driving the rules at the expense of choices. [Rest rule:275](<../../../multiplayer/games/out_looking/rules.ts:275>), [documented rationale](<../../../multiplayer/games/out_looking/README.md>).

3. **Practice teaches a brittle puzzle about the bot.**

   The bot estimates competition from squared pile weights, assumes it receives the oldest tile when sharing, and ignores its queue position. Its small scoring noise frequently sends identical bots together. Four-bot tables share on **94.6% of picks**. [Bot:457](<../../../multiplayer/games/out_looking/rules.ts:457>).

   | Challenger strategy | Against 1 bot | Against 2 bots | Against 3 bots |
   |---|---:|---:|---:|
   | Naive: always Farmhouse | 2.6% | 7.0% | 9.2% |
   | Greedy: heaviest pile | **65.6%** | **78.6%** | **77.1%** |
   | Cautious: best guaranteed immediate weight | 70.0% | 86.3% | 82.8% |
   | Uniform random | 7.3% | 28.6% | 31.7% |
   | Weighted random | 34.4% | 62.8% | 63.9% |
   | Bot-aware expected-payoff exploit | **77.9%** | **90.5%** | **86.8%** |
   | Fair-share reference | 50% | 33.3% | 25% |

   Entries are win credit; **1,000 games per duel matchup**, balanced across seats, and **2,400 per party matchup**. The exploit’s outright win rates were 69.3%, 90.0%, and 86.5%.

   The exploit uses public state and no history. It also beat every other tested duel policy, receiving 61–99.7% credit. That establishes the strongest tested policy, **not a mathematically dominant strategy**. Strategy matters, but these opponents do not establish depth against people.

4. **The session is too short, and extending it exposes weak endings.**

   Four or five decisions cannot support much learning about strangers. The measured clock estimates are roughly half the minimum target. Meanwhile, the final winner set is already fixed before anyone chooses in **34.3%, 33.5%, and 27.9%** of varied two-, three-, and four-player games.

   The original exploration promised approximately two minutes; the implemented rounds and early resolution do not deliver that at ordinary response speeds. [Tuning:81](<../../../multiplayer/games/out_looking/rules.ts:81>), [exploration](<../../../docs/multiplayer/explorations/04-pig-native-originals.md:330>).

5. **“One move a day” conflicts with a 20-hour deadline.**

   Actual-engine traces with everyone checking at hours 0, 24, 48… caused **50% of duel picks and 40% of party picks to time out**. Days two and four resolved while everybody was away. This is deterministic scheduling incompatibility, not a predicted population dropout rate. Two consecutive missed async deadlines also trigger departure. [20-hour window:92](<../../../multiplayer/games/out_looking/rules.ts:92>), [departure threshold:78](<../../../multiplayer/engine.ts:78>).

6. **The phone presentation explains atmosphere better than scoring.**

   The pinned controls, tappable cards, and scaling layout are thoughtful. But an unlabeled weight numeral beside item glyphs invites confusion with item count, while sharing order is absent and history disappears. This is source inspection, not a device usability result. [Weight tag:212](<../../../components/play/games/out_looking/Scene.tsx:212>).

**What is worth keeping**

Interaction is genuine: choosing the same destination changes both payouts. Tension resolves in a visible arrival rather than an abstract score update. The pig theme does real work through familiar errands, Satchel finds, coming home, and affectionate meetings.

That supports **Connect** and warm losing. **Contend** needs clearer agency and fairness. **Collect** contributes familiar pieces, not persistent collection rewards; these matches intentionally do not affect inventory. This is compatible with the [charter’s legibility and warmth tests](<../../../SKILL.md:20>). There is no evidence supporting a precise luck-versus-skill percentage.

**Concrete changes**

| Change | Expected effect | Confirmation |
|---|---|---|
| Show the full rotating sharing order before selection; label the oldest find. | Players can predict crowded payouts. | Before revealing, ask players what each pig would receive. Target ≥80% correct. |
| Keep a compact previous-day receipt and expandable history. Label numerals “weight.” | Makes opponent reads and score changes inspectable. | Players can explain their last payout and cite a prior opponent choice without prompting. |
| Change copy to “up to one find”; replace “four places” with “a place”; omit the hearts tiebreak explanation in duels. | Removes false promises and a strategically inert explanation. | First-match comprehension checks; no facilitator correction. |
| Restore **one tile of growth at emptied places**. | More viable destinations; fewer empty-handed meetings. | Promising paired simulation below; playtest whether escaping the crowd becomes satisfying. |
| Change async deadline **20 → 30 hours**; retain four/five days. | Supports daily attendance with six hours of slack. | Already verified: all three daily traces produced zero missed picks, finishing at 72/96/96 hours. |
| Trial practice policy mix: **40% greedy, 40% cautious, 20% weighted random**, with correct allocation accounting. | Broader behavior and fewer compulsory bot clusters. | Rerun the tournament; reject if a memoryless challenger still wins overwhelmingly. This mix is proposed, not validated. |

Refill-only results, **1,500 paired-seed games per configuration and player count**:

| Players | Zero-weight picks: current → refill | Already-decided final: current → refill |
|---|---:|---:|
| 2 | 7.1% → **3.7%** | 36.1% → **41.6%** |
| 3 | 17.8% → **7.0%** | 31.4% → **25.0%** |
| 4 | 33.0% → **15.3%** | 27.1% → **21.8%** |

**Refill helps party games; it does not fix duel endings.**

For length, I tested eight days at two/four players, nine at three, immediate refill, and 18-tile decks. With a proposed 20-second pick window, projected duration reaches **2.0–2.3 minutes**, before countdown. But already-decided finals become **53.2% / 39.7% / 28.9%**. **Do not ship extra rounds merely to hit the clock target.** The duel needs an ending experiment before expansion.

These are not existing remote tuning switches: game tuning is compiled into shared rules. Prefer a versioned server configuration for future round/deadline/refill experiments, while keeping Practice consistent. Rule changes require a version bump under the [contract:148](<../../../multiplayer/types.ts:148>). Priority/history fixes require client work.

**15-minute playtest: 2–4 people**

- **0–2 minutes — Setup:** Use existing test access, one phone each, human opponents only. Let participants read the shipped how-to. Give no strategy advice.
- **2–5 minutes — First games:** Watch silently. Record mistaken payout expectations, reactions to reveals, and whether anyone consults the score before choosing.
- **5–8 minutes — Repeat:** Same opponents. Watch for a choice explicitly based on another person’s previous behavior. Distinguish that from simply taking the largest number.
- **8–11 minutes — Explain and replay:** Explain the actual sharing order and “up to one find” rule once. Observe whether better understanding produces anticipation or merely exposes unfairness.
- **11–13 minutes — Free choice:** Say the required play is finished. Leave time available without suggesting another match.
- **13–15 minutes — Ask:** “Which choice felt clever, and why?” “When did you believe you could no longer win?” “Which reveal would you send an emote about?”

**One fun metric:** unprompted human rematch uptake after required play ends. A provisional promising signal is a majority choosing another match—especially including someone who lost. One small group supplies a signal, not validation.

**Scripts and rerun**

- [audit.ts](<../../../artifacts/fun-audit-2026-10-07/codex-sims/out_looking/audit.ts>) — baseline, tournament, agency enumeration, tuning sweep.
- [lib.ts](<../../../artifacts/fun-audit-2026-10-07/codex-sims/out_looking/lib.ts>) — strategies, payoff calculations, actual-engine runner.
- [followups.ts](<../../../artifacts/fun-audit-2026-10-07/codex-sims/out_looking/followups.ts>) — paired refill experiments and daily scheduling.
- Raw outputs: [results.json](<../../../artifacts/fun-audit-2026-10-07/codex-sims/out_looking/results.json>), [followups.json](<../../../artifacts/fun-audit-2026-10-07/codex-sims/out_looking/followups.json>).

```sh
server/node_modules/.bin/tsx codex-sims/out_looking/audit.ts
server/node_modules/.bin/tsx codex-sims/out_looking/followups.ts
```

The sandbox rejected the CLI’s IPC socket. These equivalent commands completed successfully:

```sh
node --import ./server/node_modules/tsx/dist/loader.mjs codex-sims/out_looking/audit.ts
node --import ./server/node_modules/tsx/dist/loader.mjs codex-sims/out_looking/followups.ts
```

Validation included 1,400 payoff comparisons against real outcomes and 1,200 timeout smoke games, with zero unfinished tables, illegal bot moves, or marker leaks. Game source remains unchanged; all retained audit files are under `codex-sims/out_looking/`.