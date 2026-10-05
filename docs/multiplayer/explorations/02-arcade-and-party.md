# Arcade and party games as light multiplayer for Tickle the Pig

Exploration 02 · 2026-10-04 · design only, nothing built. Lens: arcade, Flash-portal and party games, and the simultaneous-choice family they share a spine with. Companion to [Five ways to play together](../../explorations/2026-10-01-matchmade-play/concepts.md), the [ranked matchmaking spec](../../explorations/2026-10-01-matchmade-play/ranked-matchmaking-spec.md) and the [demo plan](../../explorations/2026-10-01-matchmade-play/demo-plan.md); the earlier [MiniClip canon](../../explorations/2026-06-08-miniclip-pig-adaptations.md) assumed no game server, and its "deferred: needs realtime" table is where this doc starts.

Charter posture, stated once. `SKILL.md`'s lens killed the 1-v-1 duel and names the Sounder as the competitive unit. The founder re-opened head-to-head play with random matchmaking and friend invites for this feature (2026-10-02, again 2026-10-04). This doc treats head-to-head as allowed and designs to the clause that still binds: **losing feels warm**. Nothing earned is lost, no public zero, no sad sprite for a loss, draws are real results, leaving is "Head home" and never "Forfeit". No game here touches the economy: no stakes, no tickles, snouts, truffles, Happiness or Streak, and membership never changes play. Rating and leaderboard remain the ranked spec's business; every game below produces a `result()` it can settle.

## 1. What survives mobile latency and strangers

The server is authoritative over WebSockets at 80 to 300 ms RTT with 1 to 3 s stalls. That kills every game where the winner is whoever acted 100 ms sooner: paddles, reflex grabs, mash-tapping tug, quick-draw. What survives is any game where **the decision is a sealed choice inside a generous window, or a turn**, and the server reveals the result on its own beat. Four shapes cover the whole arcade and party canon:

1. **The sealed beat.** All active seats commit a small discrete choice inside an 8 to 10 s window; the window closes early the moment everyone is in, so a quick pair never waits for the clock; the server reveals everything at once and plays a 2 to 3 s beat. A 3 s stall costs nothing because the server waits a further 1.5 s of late grace before applying a fallback, and the fallback is a **seeded random legal move**, never a fixed one, so a stalled pig never hands its rival a known answer. Rock-paper-scissors, sealed bids, blind grabs, lockstep snake all live here.
2. **The turn.** One seat owes one decision with a 20 s (live) or 12 h (async) deadline; the server resolves it with a pure shared function; everyone replays the same deterministic outcome. Artillery, hot-potato passes, bingo marks.
3. **The band, pass/fail only.** When a game truly needs "tap when the bell rings", the server announces the bell time ahead, the client renders it on its clock-offset estimate, and the server accepts a tap that lands inside a 1,200 ms band plus that seat's measured RTT plus 1,500 ms stall slack. **Timing is never ranked inside the band**: in is in. A cheat can only ever be "in", which is what every honest player is too, so ties inside the band are broken by a sealed choice, never by speed.
4. **The envelope.** Any sealed-beat game can be played as one sealed envelope per player holding every decision of the match, resolved when the second envelope arrives and replayed as a 15 to 30 s reel. This is how random matchmaking never finds nobody in a beta of tens of daily players: a stranger who queues when no one is live leaves an envelope; the next stranger answers it; both get a push. After 24 h a plainly labelled Practice Pig answers it, unrated.

Strangers need the game itself to carry the social charge, since there is no chat: two pigs on one ground line facing each other (`PigStage facing`, the Visit's `face` turn), visible "thinking" and "locked" states, one shared set of six preset emote stickers reused across every game (existing glyphs: `heart`, `party`, `handshake`, `dizzy`, `zzz`, `sparkles`; warm or silly, no taunt), and an ending both pigs share (`wave` from both, never `sad`). The result card leads with what happened ("Clover's big splat on the last toss"), then the score, then one tap to **Find another pig** or **Head home**.

Feasibility scale used below: 5 = one pure rules module under ~300 lines and the existing sticker and PigStage primitives; 3 = a new renderer (grid, field) or a deterministic sim; 1 = free-form input, UGC moderation, or physics the phone must predict.

## 2. Candidates

### 2.1 Mud Volley · Wind-up (ranked 1)
- **Source:** rock-paper-scissors, penalty-kick guessing; the prior doc's Mud Volley with new rules.
- **One sentence:** Everyone sees where your pig winds up; follow through for a big splat, flick it elsewhere for a small one, and a clean catch is a point for the catcher.
- **Seats:** 2. **Pace:** live (~45 to 70 s) and envelope. **Luck/skill:** 40/60: a mixed-strategy read of one stranger's honesty across three attacks.
- **Lag:** sealed beat, 9 s window with early close, seeded-random fallback, 2.6 s reveal.
- **Hidden info:** the current toss and catch until reveal; nothing else.
- **Stranger fun:** the wind-up is a public bluff about one specific person; "is this pig honest?" is a question you can only ask a human.
- **Pillar:** Connect (a face across a puddle; an invite is a text message). Collect only through an optional match-only stamp later.
- **Warm loss:** a splat is a joke on the body, both pigs end muddy, a catch gives the defender its own win moment, draws stand.
- **New art:** mud ball, bucket, big splat, small splat, wind-up arc, lane post (6).
- **Feasibility:** 5. **Main risk:** three attacks may be too few to read a stranger; measured by whether winners' follow-through rates differ from losers'.

### 2.2 Supper Scrum (ranked 2)
- **Source:** sealed-bid auctions and the Blotto family ("For Sale", tug-of-war scored by rounds); the tug-of-war candidate is this game's 2-seat, equal-dishes special case and is folded in.
- **One sentence:** Six dishes come out one at a time; each time, secretly decide how hard to shove; the hardest shover eats it, but you have only nine shoves for the whole supper.
- **Seats:** 2 to 4. **Pace:** live (~40 to 70 s) and envelope. **Luck/skill:** 25/75: budgeting against a public menu and public remaining oomph.
- **Lag:** sealed beat, 9 s window, a missing shove is 0 (never spends oomph), spill on ties.
- **Hidden info:** this dish's shoves until reveal. The menu and everyone's remaining oomph are public.
- **Stranger fun:** three or four pigs at one table, a tie knocks the dish into the next one and the stakes grow; greed is visible and funny.
- **Pillar:** Connect (a party of four pigs; the natural "invite two friends" game). Collect: dish glyphs could become a scrapbook later.
- **Warm loss:** nobody is eliminated, everyone usually eats something, a spilled last dish goes to the chickens and the table laughs together.
- **New art:** six dish bowls, oomph chip, spill splash (8).
- **Feasibility:** 5. **Main risk:** the last dish is often arithmetic (whoever has the most left wins it), which can read as bookkeeping; mitigated by the spill carry and the 4-point Slop of the Day being seeded anywhere in the order.

### 2.3 Acorn Arc (ranked 3)
- **Source:** turn-based artillery (the arc-lob genre; Bowman and Raft Wars on the old portals).
- **One sentence:** Lob acorns over the hedge at your rival's hay fort; the wind shifts every turn, and your last splotch shows you how far off you were.
- **Seats:** 2. **Pace:** live (20 s turns, ~3 min) and async (12 h turns, play-by-push). **Luck/skill:** 20/80: wind is public before you aim; correction is the skill.
- **Lag:** pure turn; the shot is one message `(angle, power)`; the server and both phones run the same closed-form sim.
- **Hidden info:** future wind only.
- **Stranger fun:** watching someone else's acorn bonk the hedge is the whole genre; async means a stranger can be a three-day pen pal with no words.
- **Pillar:** Connect (the one async-native game: a rendezvous at human intervals, which is the charter's own rhythm).
- **Warm loss:** a fort with acorns stuck in it is a trophy, not a wound; both pigs wave over the hedge.
- **New art:** hay bale, hedge, windsock, sling, mud splotch (5; `dig/acorn.png` and `dig/boom.png` reused).
- **Feasibility:** 3: the aim pad and a deterministic sim with a trig table. **Main risk:** aiming on a 358 pt field feels cramped; the dotted first fifth of the arc and a numeric readout carry it.

### 2.4 Mud Trails (ranked 4)
- **Source:** light-cycle and snake arenas (the Tank Trouble / Slither cluster the old canon deferred).
- **One sentence:** Every beat each pig picks a way to trot; your mud trail blocks everyone; the pig that trots the most tiles wins.
- **Seats:** 2 to 4. **Pace:** live only (14 to 20 beats × ~6 s). **Luck/skill:** 15/85: space control.
- **Lag:** lockstep sealed moves, 6 s window, fallback = continue straight, else the first legal turn clockwise; two pigs choosing one tile both bounce (`surprise`) and nobody claims it.
- **Hidden info:** this beat's directions until reveal.
- **Stranger fun:** cutting someone off is wordless banter; a 7×7 grid of 51 pt tiles reads at a glance.
- **Pillar:** Connect. **Warm loss:** no elimination: a boxed-in pig sits (`sit`) and keeps its tiles; the game ends when everyone sits or the beats run out.
- **New art:** trail tile in four scarf colours, bounce puff, four arrow chips (6; `arrowLeft/Right` exist).
- **Feasibility:** 4 (a grid renderer; pig heads on tiles via `pigface`, full pigs on a roster below). **Main risk:** live-only in a tiny population; no envelope form exists for a 20-beat game, so it waits for a population that can fill it.

### 2.5 Windfall Scramble (ranked 5)
- **Source:** grab-the-pile and musical chairs, re-made as a blind pick ("Hick Hack" style).
- **One sentence:** Five apples fall; every pig secretly lunges for one; a pig alone gets its apple, and two pigs on one apple bonk and get mud.
- **Seats:** 2 to 4. **Pace:** live (4 rounds, ~35 s) and envelope. **Luck/skill:** 55/45.
- **Lag:** sealed beat, 7 s window, seeded-random fallback.
- **Hidden info:** this round's picks until reveal.
- **Stranger fun:** the big apple is a magnet and everyone knows it; reading greed in four people is a party.
- **Pillar:** Connect. **Warm loss:** a bonk is a `surprise` beat, never a sad one; scores stay close.
- **New art:** apple sizes 1 to 3 (3; `dig/apple.png` as the base).
- **Feasibility:** 5. **Main risk:** too shallow next to Supper Scrum, which uses the identical N-seat sealed beat with a budget; ships as a second rules module on the Scrum screen if a lighter party game is wanted.

### 2.6 Pass the Hot Acorn (ranked 6)
- **Source:** hot potato / bomb-pass.
- **One sentence:** The acorn is getting hot; pass it to any pig in six seconds; whoever holds it when it pops gets the mud.
- **Seats:** 3 to 4. **Pace:** live (3 rounds, ~60 s). **Luck/skill:** 85/15.
- **Lag:** a turn with a 6 s deadline; the pop count (4 to 10 passes) is seeded at setup and resolves only on a pass or deadline, never mid-flight; fallback = a seeded pass to a random other pig.
- **Hidden info:** the pop count; a public "getting hot" state after the fourth pass.
- **Stranger fun:** targeting someone is the only expressive act, and passing it back is a running joke.
- **Pillar:** Connect, thinly. **Warm loss:** mud, then the next round; least mud wins, ties draw.
- **New art:** acorn heat states ×3, pop (4).
- **Feasibility:** 5. **Main risk:** no decision has information behind it, so it is luck with a social surface; fine as a filler beside Scrum, not a lead.

### 2.7 Snort and Stomp (ranked 7)
- **Source:** sequence-memory toys.
- **One sentence:** Watch the dance, then repeat it; the phrase grows by one each round, and the pig that repeats the longest phrase wins.
- **Seats:** 2 to 4. **Pace:** live (~90 s) and envelope. **Luck/skill:** 10/90 (memory).
- **Lag:** order, not timing: the whole repeat is one action of up to 9 gesture ids inside a 12 s window; the server checks the sequence, never the cadence. A rhythm variant would need the pass/fail band and adds nothing.
- **Hidden info:** none (the sequence is public after each reveal).
- **Stranger fun:** low: parallel struggle rather than interaction. The prior doc's Tickle Duet, where humans author the phrase, is the better use of this input.
- **Pillar:** Connect weakly. **Warm loss:** everyone danced; the longest run is shown for both.
- **New art:** four gesture chips (4).
- **Feasibility:** 5. **Main risk:** it is a solo game with a spectator.

### 2.8 Puddle Sumo (ranked 8)
- **Source:** sumo / push games, re-made as a stance triangle.
- **One sentence:** Each beat pick Push, Brace or Sidestep; Brace beats Push, Sidestep beats Brace, Push beats Sidestep, and the loser slides a step toward the puddle.
- **Seats:** 2. **Pace:** live and envelope. **Luck/skill:** 60/40.
- **Lag:** sealed beat. **Hidden info:** stances until reveal.
- **Stranger fun:** fine, but it is bare rock-paper-scissors with a track; Mud Volley's wind-up gives the same family a public tell and asymmetric payoffs, which is the depth this lacks.
- **Pillar:** Connect. **Warm loss:** the puddle is a splash, both pigs end wet.
- **New art:** three stance chips, a puddle (4). **Feasibility:** 5. **Main risk:** redundant with Volley; folded.

### 2.9 Quick Draw at the Gate (ranked 9)
- **Source:** reaction duels.
- **One sentence:** When the gate bell rings, tap; tap on a fake bell and you have jumped the gate.
- **Seats:** 2 to 4. **Pace:** live (5 rounds, ~60 s). **Luck/skill:** 50/50 (inhibition, not speed).
- **Lag:** the pass/fail band (1,200 ms + RTT + 1,500 ms); fakes are different glyphs 2 to 8 s before the bell; a false start loses the round, in-band taps all score, nobody is ranked inside the band.
- **Hidden info:** the bell time and which cues are fakes.
- **Stranger fun:** moderate tension, no interaction between players at all.
- **Pillar:** none convincingly. **Warm loss:** jumping the gate is a `surprise`, not a shame.
- **New art:** bell, two fake cues, gate (4). **Feasibility:** 4 (needs the clock-offset estimator). **Main risk:** redesigned to survive lag, it has no winner most rounds; it exists in this table to show what the band can and cannot rescue.

### 2.10 Barn Bingo (ranked 10)
- **Source:** bingo.
- **One sentence:** Mark the glyph the caller shows; the first full row wins.
- **Seats:** 2 to 4. **Pace:** live (~2 min) or async over a day. **Luck/skill:** 100/0.
- **Lag:** the server knows every card and the call order, so "first to call bingo" is decided by the draw index, never by a tap race; a mark inside the 8 s window counts.
- **Hidden info:** others' cards (cosmetic only).
- **Stranger fun:** low; it is a shared waiting room.
- **Pillar:** Connect as a Sounder-wide daily card maybe, not as matchmade play. **Warm loss:** nothing to lose.
- **New art:** none (uses existing glyphs as the symbol set). **Feasibility:** 5. **Main risk:** boring with a stranger, and long.

### 2.11 Hedge Quiz (ranked 11)
- **Source:** trivia.
- **One sentence:** Six questions about the hedge and the herd; pick an answer before the sun sets; most right wins.
- **Seats:** 2 to 4. **Pace:** live (~90 s) and envelope. **Luck/skill:** 30/70 (knowledge).
- **Lag:** sealed beat with a 10 s window; a correct answer inside the window scores the same whenever it lands.
- **Hidden info:** answers until reveal.
- **Stranger fun:** moderate.
- **Pillar:** Collect if the questions are the game's own world (Field Guide and Burrow Book knowledge), which is cute, but every question is content the art-and-copy pipeline must feed (lens 5).
- **Warm loss:** a wrong answer teaches the fact.
- **New art:** none beyond question illustrations, which is the problem. **Feasibility:** 4. **Main risk:** a content treadmill.

### 2.12 Doodle Pig (ranked 12)
- **Source:** quick-draw drawing and guessing.
- **One sentence:** Draw the word in twelve strokes; your partner picks it from four.
- **Seats:** 2. **Pace:** live or async. **Luck/skill:** 20/80.
- **Lag:** a turn; strokes upload as one action.
- **Hidden info:** the word.
- **Stranger fun:** high in principle.
- **Pillar:** Connect. **Warm loss:** fine.
- **New art:** a prompt deck. **Feasibility:** 2. **Main risk:** free-form drawings are user content shown to strangers with no moderation path; friend-invite only, which contradicts the random-matchmaking ask. Deferred.

## 3. Ranked comparison

| # | Game | Source | Seats | Pace | Lag strategy | Luck/skill | Stranger fun | Warm loss | Feas. | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Mud Volley · Wind-up | RPS / penalty guessing | 2 | live + envelope | sealed beat, random fallback | 40/60 | high: a public bluff about one person | yes | 5 | ship first |
| 2 | Supper Scrum | sealed-bid / Blotto | 2–4 | live + envelope | sealed beat, 0 fallback, spill carry | 25/75 | high: four greedy pigs | yes | 5 | ship second |
| 3 | Acorn Arc | turn artillery | 2 | live + async turns | pure turn, shared closed-form sim | 20/80 | high: bonks and pen-pal pacing | yes | 3 | ship third |
| 4 | Mud Trails | light-cycle / snake | 2–4 | live only | lockstep sealed moves | 15/85 | high | yes (sit, no elimination) | 4 | when the population can fill it |
| 5 | Windfall Scramble | grab-the-pile | 2–4 | live + envelope | sealed beat | 55/45 | high | yes | 5 | optional module on the Scrum screen |
| 6 | Pass the Hot Acorn | hot potato | 3–4 | live | 6 s turns, seeded pop | 85/15 | medium | yes | 5 | filler |
| 7 | Snort and Stomp | sequence memory | 2–4 | live + envelope | order not timing | 10/90 | low | yes | 5 | Duet does this better |
| 8 | Puddle Sumo | sumo / push | 2 | live + envelope | sealed beat | 60/40 | medium | yes | 5 | folded into Volley |
| 9 | Quick Draw at the Gate | reaction duel | 2–4 | live | pass/fail band | 50/50 | low | yes | 4 | shows the band's limit |
| 10 | Barn Bingo | bingo | 2–4 | live / daily | draw-index wins | 100/0 | low | yes | 5 | not matchmade play |
| 11 | Hedge Quiz | trivia | 2–4 | live + envelope | sealed beat | 30/70 | medium | yes | 4 | content treadmill |
| 12 | Doodle Pig | quick-draw drawing | 2 | live / async | turn | 20/80 | high | yes | 2 | UGC with strangers; deferred |

## 4. The top three, specified against the interface

Host contract shared by all three (the brief's `GameDefinition<S, A, V>`): the server holds `state`; after every change it sends each seat `view(state, seat)` plus the events; it arms one timer at `state.deadlineAt + LATE_GRACE_MS` and on expiry calls `onTimeout` for every seat still in `activeSeats`; it runs `tick` at 4 Hz for the definitions that declare one; a non-null `result` ends the match and hands the settlement to the ranked spec. Clocks are server milliseconds; every view carries `serverNow` so the phone renders countdowns from an offset, never from its own clock. `rng` is the seeded server RNG and nothing derived from a seed reaches a client before it is public. Presence (`here` / `away` after 5 s without a 2 s heartbeat / `gone` after 20 s) is a host concern and is **shown only between beats, never inside a commit window**, so a stalled pig's fallback can never be aimed at.

### 4.1 Mud Volley · Wind-up

**Rules.** Six exchanges; seats alternate attacker, the first attacker seeded. At the start of each exchange the server deals the attacker a public **wind-up lane** `W ∈ {L, M, R}` (all six are dealt at setup from the seed and revealed one per exchange). Both seats then commit a lane inside one window: the attacker a toss lane `a`, the defender a catch lane `d`. Resolution:

| Result | Condition | Attacker | Defender |
|---|---|---|---|
| Big splat (follow-through) | `a = W` and `d ≠ a` | +2 | 0 |
| Small splat (the flick) | `a ≠ W` and `d ≠ a` | +1 | 0 |
| Clean catch | `d = a` | 0 | +1 |

Higher score after six exchanges wins; equal is a draw and stays a draw. The payoffs are tuned so neither honesty nor the flick dominates: at equilibrium the attacker follows through about one time in four and the defender covers the wind-up about half the time, and the attacker nets 0.5 a toss. Scores run 0 to 9; a typical match ends 4–3 or 3–3. The skill is the read: a stranger who follows through two thirds of the time is caught by covering the wind-up; one who never does is caught on the flick lanes.

**Timing (live).**

| Constant | ms | Note |
|---|---|---|
| `WINDUP_MS` | 800 | the attacker pig swings toward `W`; cards enable at the end of it |
| `COMMIT_MS` | 9,000 | from exchange start; the sun arc the player sees |
| `LATE_GRACE_MS` | 1,500 | the host waits this long past the deadline before `onTimeout`; a stalled commit inside it still counts |
| `SETTLE_MS` | 400 | after the second lock, so the lock animation lands before the reveal |
| `REVEAL_MS` | 2,600 | 1,400 arc + 1,200 splat or catch reaction |
| `EXCHANGES` | 6 | worst case ≈ 79 s, typical 40 to 55 s |
| `EMOTE_MIN_GAP_MS` | 2,000 | per seat |

Early close: the moment both lanes are in, the host resolves (after `SETTLE_MS`) without waiting for the clock.

**Seat-count variants.** Two seats only. A 2v2 "doubles" where a team's attacker and catcher are different pigs is possible later but makes the one sentence two.

**Envelope pace.** `setup(…, pace: 'async')` sets `mode: 'envelope'`. All six wind-ups are public at setup. Each seat submits one action holding its three toss lanes (for its own three wind-ups) and three catch lanes (against the rival's three); the match resolves on the second envelope and the client plays a 15.6 s reel (six reveals), skippable. Deadline 24 h; a missing envelope after 24 h is answered by the Practice Pig and the match is unrated. The queue uses this to never come up empty: no live rival after 12 s offers "Leave a toss for the next pig" beside "Practice".

**State.**

```ts
type Lane = 'L' | 'M' | 'R';
type Outcome = 'splat2' | 'splat1' | 'catch' | 'dozed';
interface VolleyRow { ex: number; attacker: 0|1; windup: Lane; toss: Lane; catchLane: Lane; outcome: Outcome; fallback: [boolean, boolean] }
interface VolleyState {
  mode: 'live' | 'envelope';
  firstAttacker: 0|1;
  windups: Lane[];                 // 6, seeded at setup; live view reveals windups[0..exchange]
  exchange: number;                // 0..5; 6 when done
  phase: 'commit' | 'reveal' | 'done';
  commits: [Lane|null, Lane|null]; // live: this exchange; stripped from the rival's view
  envelopes: [ { tosses: Lane[]; catches: Lane[] } | null, … | null ];
  deadlineAt: number; revealUntil: number | null;
  score: [number, number];
  history: VolleyRow[];
  dozed: number;                   // consecutive both-missing exchanges
  lastEmoteAt: [number, number];
}
type VolleyAction =
  | { type: 'lane'; lane: Lane }
  | { type: 'envelope'; tosses: Lane[]; catches: Lane[] }
  | { type: 'emote'; id: 0|1|2|3|4|5 };
```

`attackerOf(ex) = (firstAttacker + ex) % 2`. `activeSeats`: live commit phase → seats with `commits[seat] === null`; reveal → `[]`; envelope → seats with no envelope; done → `[]`.

**`apply`.**
- `lane`: rejects unless `mode = 'live'`, `phase = 'commit'`, the seat is active and the lane parses. A second `lane` from the same seat with the same lane is an idempotent `ok` (retries are free); with a different lane it is `already_locked`: sealed is sealed. The first lock emits `locked(seat)`. The second lock resolves: compute the row, add the score, push history, `phase = 'reveal'`, `revealUntil = now + SETTLE_MS + REVEAL_MS`, `dozed = 0`; events `locked`, then `reveal{windup, toss, catchLane, outcome, attacker}`.
- `envelope`: rejects unless `mode = 'envelope'` and the seat has none; validates exactly three lanes in each list. When both are in, resolves all six rows in order and ends with `phase = 'done'`; events: six `reveal`s and `final`.
- `emote`: any phase but `done`; rejects if `now - lastEmoteAt[seat] < EMOTE_MIN_GAP_MS`; the event is broadcast, nothing else changes.

**`onTimeout(s, seat)`.** Live: the missing seat's lane becomes a **seeded uniform random lane** (fiction: "the pig lobbed it anyhow" / "the pig hopped somewhere"), flagged `fallback[seat] = true`, and the exchange resolves as above. If both seats are missing the exchange is recorded as `dozed` with no score, `dozed += 1`, and at `dozed = 2` the match ends as a technical no contest ("both pigs dozed off"). Envelope: the whole envelope becomes seeded random lanes and the match is marked unrated.

**`tick`** (4 Hz). In `reveal` when `now ≥ revealUntil`: advance `exchange`; if `exchange = 6` → `phase = 'done'` with `final`; else `phase = 'commit'`, `commits = [null, null]`, `deadlineAt = now + COMMIT_MS`, event `windup{ex, attacker, lane}`.

**`view(s, seat)`.** Returns `you`, `attacker`, `exchange`, `phase`, the current `windup` (live) or all six (envelope), `yourLane` (your own commit), `rivalLocked: boolean` (never the lane), `deadlineAt`, `serverNow`, `score`, the full `history` (public after each reveal), `lastReveal`, and the rival's presence only when `phase ≠ 'commit'`. Future wind-ups are stripped in live mode.

**`result(s)`.** Null until `phase = 'done'`; then `win` with the higher seat, or `draw`; `summary` is the match's loudest row ("A clean catch on the last toss"). Two `dozed` exchanges in a row → the host's no-contest path (the ranked spec's row).

**Practice bot (never peeks).** `bot(v, seat, rng)` sees only its view. Attacking: follow through on `v.windup` with probability `p`, else flick to each off lane with `(1 − p)/2`. Defending: cover `v.windup` with probability `q`, else each off lane `(1 − q)/2`. Personalities as `(p, q)`: **Honest Hank** (2/3, 1/2) for the first practice match so a newcomer learns that covering the wind-up catches honest pigs; **Even Edna** (1/4, 1/2), the equilibrium; **Slippery Sal** (1/10, 2/5). The host calls `bot` 1,500 to 4,000 ms after the wind-up so the pig looks like it is thinking. The bot's choice is sealed like a human's.

**UI events to animate.** `windup(lane)`: the attacker pig turns (`face`) and swings a mud bucket toward the lane post, 800 ms. `locked(seat)`: that pig's card stamps "locked", the rival sees only a sealed-envelope sticker. `reveal`: the ball arcs along the toss lane (1,400 ms); `splat2` is a big splash and `surprise` on the defender; `splat1` a small splash and a `bounce` shrug; `catch` the defender hops into the lane, the bucket catches, `happy` 1,200 ms. `score`: the numeral ticks on its sticker. `final`: both pigs `wave`; the winner gets one `happy` loop first. `dozed`: both pigs `tired` for one beat. `emote(seat, id)`: a 44 pt sticker rises from that pig and pops. Under Reduce Motion the arc is a dotted line that fills and every reaction is a frame swap.

**Edge cases.**
- Simultaneous commits: arrival order; the second resolves; both responses carry the new view, so a client never needs to guess which it was.
- A stalled client whose lane arrives inside `LATE_GRACE_MS` counts normally; after it, `late` is returned with the authoritative view, and the player's card shows the lobbed-anyhow lane with the line "The pig lobbed it anyhow."
- Disconnect mid-beat: the match keeps running on fallbacks during `away`; at `gone` (20 s) after at least one resolved exchange the present pig wins "Round ended early" (the ranked spec's abandonment row); before any resolved exchange, no contest. A rejoining pig gets the full view and the reel of anything it missed.
- A player who re-sends `lane` on reconnect gets the idempotent `ok`.
- Emote floods are refused silently by the gap rule; the client greys the tray for 2 s.
- The envelope pool matches two strangers whose protocol and rules versions agree; a stale binary's envelope is answered by Practice Pig rather than left hanging.

**ASCII layout (390 pt portrait, 16 pt gutters).**

```
 0 ┌──────────────────────────────────────────────┐
   │ ‹ Head home        MUD VOLLEY        toss 3/6 │  PageHeader crown: kicker + whimsy title
44 ├──────────────────────────────────────────────┤
   │  [Clover · 2]                      [You · 3]  │  two score Stickers, numerals (progress, not feeling)
   │                                              │
   │   Clover                              Rosie  │  pasture scene 220 pt; pigs on one ground line,
   │  (face, mirrored)   ⌒ wind-up       (face)   │  facing each other; the wind-up arc hangs over lane L
   │    ┆L┆          ┆M┆          ┆R┆              │  three painted lane posts in the mud between them
   │  ~~~~~~~~~~~~~ mud puddle ~~~~~~~~~~~~~~~    │
296├──────────────────────────────────────────────┤
   │  Clover winds up LEFT. Follow through,        │  one PatrickHand line: the whole rule, in context
   │  or flick it?                                 │
340├──────────────────────────────────────────────┤
   │  ┌─────────┐  ┌─────────┐  ┌─────────┐        │  three lane cards 106×120, 12 pt gaps, tilt ±1°
   │  │  LEFT   │  │ MIDDLE  │  │  RIGHT  │        │  attacker: the wind-up card reads "big splat · 2",
   │  │ splat 2 │  │ splat 1 │  │ splat 1 │        │  the others "splat 1"; defender: all read "catch · 1"
   │  └─────────┘  └─────────┘  └─────────┘        │  tap = select (card lifts), then Lock
476├──────────────────────────────────────────────┤
   │   ◠ sun arc 9 s        [   Lock it in   ]     │  primary Button 52 pt; the arc drains left to right
540├──────────────────────────────────────────────┤
   │  [heart] [party] [gg] [whoa] [zzz] [sparkle]  │  six 44 pt sticker buttons, existing glyphs
600└──────────────────────────────────────────────┘  (to 844: paper; the result card slides up over it)
```

**New glyphs (256 px stickers, thick ink outline, cel shade, two sparkles, subject ~88% of the box).**
- `volley/mudball.png`: a round ball of dark mud with one glossy highlight, mid-flight drips.
- `volley/bucket.png`: a dented tin pail, handle up, a little mud on the rim.
- `volley/splat_big.png`: a wide brown splat with four fat drops flying.
- `volley/splat_small.png`: a tidy three-drop splat.
- `volley/windup_arc.png`: a chunky curved motion arc with an arrowhead, ink only, for the wind-up.
- `volley/lane_post.png`: a short weathered fence post with a hand-painted lane letter.

### 4.2 Supper Scrum

**Rules.** Two to four pigs sit at a table. The **menu** is six dishes dealt in a seeded order and shown in full from the start: Acorn Mash 1 · Clover Salad 1 · Apple Crumble 2 · Honey Oats 2 · Berry Pie 3 · Slop of the Day 4 (13 helpings in all). Every pig has **9 oomph**. Each dish is one sealed beat: every pig secretly shoves 0, 1, 2 or 3 oomph (never more than it has left). The single highest shove eats the dish and keeps its helpings; a shove is spent whether or not it wins. If two or more pigs tie for the highest shove, the dish **spills** and its helpings carry onto the next dish; a spill on the sixth dish goes to the chickens. Most helpings after six dishes wins; equal is a draw. Remaining oomph is public (the pig's puff tag), so the endgame is a deduction and the opening is a bluff.

Why it has depth: 9 oomph cannot cover six dishes at 3, so every pig concedes dishes, and the public menu lets you plan to concede the ones others will fight over. A spill raises the stakes of the next dish exactly when the fighters have less left, which is what gives a third pig its moment. With four seats, ties at the top are common and the carry makes the table rowdy.

**Timing (live).** `COMMIT_MS` 9,000 with early close when every active seat is in; `LATE_GRACE_MS` 1,500; `SETTLE_MS` 400; `REVEAL_MS` 2,400 (shoves slam 1,000 + eat or spill 1,400); six dishes, worst case ≈ 77 s, typical 40 s. `EMOTE_MIN_GAP_MS` 2,000.

**Seat-count variants.** 2 seats: identical rules; the menu's 4-point dish decides more, so it is seeded never-first. 3 and 4 seats: identical rules. Oomph stays 9 at every count; the menu stays six dishes. A friend table (invites) and a stranger table use the same module; a short table fills with Practice Pigs only when the host says so, plainly labelled.

**Envelope pace.** Each seat submits six shoves summing to at most 9 in one envelope; the server resolves all six dishes with the same spill rule and plays a 15 s reel. The envelope loses the sequential read, which is stated on the entry card ("sealed supper: you shove for all six dishes at once"). Deadline 24 h; a missing envelope is answered by Practice Pig, unrated.

**State.**

```ts
type Shove = 0 | 1 | 2 | 3;
interface Dish { id: 'mash'|'clover'|'crumble'|'oats'|'pie'|'slop'; helpings: 1|2|3|4 }
interface ScrumRow { dish: number; shoves: (Shove|null)[]; winner: number | null; helpings: number; spilled: boolean; fallback: boolean[] }
interface ScrumState {
  mode: 'live' | 'envelope';
  seats: number;                     // 2..4
  menu: Dish[];                      // 6, seeded order
  dish: number;                      // 0..5; 6 when done
  phase: 'commit' | 'reveal' | 'done';
  carry: number;                     // spilled helpings riding onto this dish
  oomph: number[];                   // public, per seat
  shoves: (Shove|null)[];            // this dish; stripped from others' views
  envelopes: (Shove[] | null)[];
  deadlineAt: number; revealUntil: number | null;
  helpings: number[];                // score per seat
  missed: number[];                  // consecutive timeouts per seat
  history: ScrumRow[];
  lastEmoteAt: number[];
}
type ScrumAction =
  | { type: 'shove'; amount: Shove }
  | { type: 'envelope'; shoves: Shove[] }
  | { type: 'emote'; id: 0|1|2|3|4|5 };
```

`activeSeats`: commit → seats with `shoves[seat] === null` and `missed[seat] < 3` (a pig that has wandered off owes nothing); reveal → `[]`; envelope → seats without one.

**`apply`.**
- `shove`: rejects unless live, `phase = 'commit'`, the seat is active, `amount ≤ oomph[seat]`. Same amount re-sent → idempotent `ok`; a different amount → `already_locked`. Emits `locked(seat)` (the table shows "N of 4 locked"; in a 2-seat game that is the rival, which is accepted). When every active seat is in: `resolve()`.
- `resolve()`: `top = max(shoves)`; `winners = seats with shove = top`; spend every shove (`oomph[i] -= shoves[i]`); if `winners.length = 1` → `helpings[w] += menu[dish].helpings + carry`, `carry = 0`, event `eat{seat, dish, helpings}`; else → `carry += menu[dish].helpings`, event `spill{dish, carry}` (on the sixth dish `chickens{helpings}` and `carry = 0`). All-zero shoves tie at 0 and spill ("nobody moved; it went cold"). Then `phase = 'reveal'`, `revealUntil = now + SETTLE_MS + REVEAL_MS`.
- `envelope`: six shoves, each `≤ 3`, sum `≤ 9`; when all seats are in, resolves six dishes in order.
- `emote`: as in Volley.

**`onTimeout(s, seat)`.** The missing shove becomes **0** ("still chewing"), `fallback = true`, `missed[seat] += 1`; no oomph is spent, so lag can never waste a budget, and 0 is the weakest shove, so a stall can never be aimed at either. At `missed = 3` the pig is marked wandered off (`sit`, its tag reads "wandered off"), owes nothing further, keeps its helpings, and the supper continues for the others: a 4-seat game never dies because one phone did. In a 2-seat game a wandered-off rival ends the match early under the ranked spec's abandonment row.

**`tick`** (4 Hz). Reveal → next dish: `dish += 1`; if `dish = 6` or fewer than two pigs remain active → `done`; else `phase = 'commit'`, `shoves = nulls`, `deadlineAt = now + COMMIT_MS`, event `dish{index, helpings, carry}`.

**`view(s, seat)`.** Everything public (menu, dish index, carry, every pig's oomph, helpings, history) plus `yourShove`, `lockedCount` (and in 2-seat games `rivalLocked`), `deadlineAt`, `serverNow`. Others' current shoves are stripped. Presence is attached only between beats.

**`result(s)`.** Null until done; `win` for the unique highest helpings, else `draw` among the tied; `scores = helpings`; `summary` is the biggest eat or the funniest spill ("Three pigs tied on the Pie and the chickens ate it").

**Practice bot (never peeks).** From its own view: value-proportional budgeting over the dishes it has not seen yet, `plan[i] = round(9 × value[i] / Σ value)` with `value` = helpings plus any carry, each clamped to `min(3, oomph)`; then a seeded nudge of ±1 with probability 0.3. Personalities: **Greedy Gus** puts 3 on the Slop and 3 on the Pie and 1-1-1 elsewhere; **Nibbler Nell** goes 2-2-2-1-1-1 in menu order; **Even Edna** the proportional plan. The bot never sees a pending human shove because its view does not contain one.

**UI events.** `dish`: the chalkboard lifts the dish, the bowl slides to the table centre, carried helpings ride in as "+N" tags. `locked`: that pig's puff tag stamps. `reveal`: every pig slams its shove chips down together (1,000 ms), then `eat` (the winner's bowl slides to it, `happy`, the others `bounce`) or `spill` (the bowl tips, splash glyph, everyone `surprise`). `chickens`: a line of chicken glyphs trots off with the bowl; no new sprite needed beyond a sticker. `final`: `wave` all round. Oomph puffs shrink as they spend.

**Edge cases.** All seats commit in one tick: resolve once (the last lock resolves, earlier ones only stamp). Stall inside the grace: counts. A pig re-sending the same shove: idempotent. Two wandered-off pigs at a 4-table: the two left keep playing. All-zero tie on the last dish: chickens. Envelope sums over 9: rejected with `over_budget` before anything is stored. A pig with 0 oomph left: its only chip is 0 and it locks automatically at the beat's start (no empty wait).

**ASCII layout (390 pt).**

```
 0 ┌──────────────────────────────────────────────┐
   │ ‹ Head home        SUPPER SCRUM     dish 3/6  │  PageHeader
44 ├──────────────────────────────────────────────┤
   │ MENU  mash·1  clover·1 [CRUMBLE·2 +1] oats·2  │  chalkboard strip: six dish chips in order, the current
   │                        pie·3   slop·4         │  one lifted, a carried spill shown as "+1" on it
96 ├──────────────────────────────────────────────┤
   │        Gus                     Nell           │  table scene 230 pt: a round plank table, 2–4 pigs on
   │      (face)       [bowl]      (face,mirrored) │  `face` turns toward it; each pig wears its oomph puff
   │       oomph 5                   oomph 2       │  as a tag (public, a number: budget, not feeling)
   │   You (face)                 Hank (face)      │  2 seats: the two pigs face each other across the bowl
   │    oomph 6                     oomph 3        │
330├──────────────────────────────────────────────┤
   │  Apple Crumble, two helpings and a spilled    │  one hand-type line naming the dish and the stakes
   │  one. How hard do you shove?                  │
374├──────────────────────────────────────────────┤
   │   ( 0 )     ( 1 )     ( 2 )     ( 3 )         │  four 72 pt paper chips; chips above your remaining
   │   stay      nudge     shove     heave         │  oomph are greyed; tap = select
470├──────────────────────────────────────────────┤
   │   ◠ sun arc 9 s        [   Lock it in   ]     │  primary Button
540├──────────────────────────────────────────────┤
   │  [heart] [party] [gg] [whoa] [zzz] [sparkle]  │  shared emote tray
600└──────────────────────────────────────────────┘
```

**New glyphs.**
- `scrum/bowl_mash.png`: a wooden bowl of pale acorn mash with one acorn on top.
- `scrum/bowl_clover.png`: a bowl heaped with clover, one four-leaf standing up.
- `scrum/bowl_crumble.png`: a pie dish of apple crumble, one red apple slice showing.
- `scrum/bowl_oats.png`: a bowl of oats with a honey drizzle and a honeycomb chip.
- `scrum/bowl_pie.png`: a berry pie with a lattice top and purple juice bubbling.
- `scrum/bowl_slop.png`: a big steaming bucket of glorious slop with a ladle, the hero dish.
- `scrum/oomph_chip.png`: a round paper chip with a hoofprint; the number is drawn in code.
- `scrum/spill.png`: a tipped bowl with a wide splash and three flying peas.

### 4.3 Acorn Arc

**Rules.** Two pigs, one each side of a hedge, each defending a **hay fort of three bales**. Field units run 0 to 100 left to right; the thrower stands at `x = 10` on its own side (seat 1 sees the field mirrored), the hedge is at `x = 50` with height 6, the rival's bales stand at `x = 74, 81, 88`, each 6 wide. Pigs alternate turns, five acorns each. A turn is one shot: **angle** 15° to 85° in whole degrees and **power** 1 to 20 in whole steps. The **wind** for the current turn is public before you aim (a windsock), an integer from −3 to +3 dealt per turn from the seed; future winds are hidden. The acorn flies a closed-form arc; if it is below the hedge top when it crosses `x = 50` it **bonks** and drops at the hedge foot; otherwise it lands, and a standing bale within 3 units of the landing point is knocked down and stays down. The landing point leaves a **mud splotch** that stays on the field until that pig's next shot, so correction is the skill. First to knock all three bales wins; otherwise the most bales after five acorns each; equal is a draw ("the forts stand").

**The sim (one pure function, server and both phones).** `v = power × 1.6`, `g = 9.8`, wind acceleration `aw = wind × 0.4`, start `(10, 0)`, `sin`/`cos` read from a **71-entry table of fixed six-decimal constants** for 15° to 85° so no engine's `Math.sin` can disagree. Flight time `T = 2 v sinθ / g`; landing `x = 10 + v cosθ T + ½ aw T²`, clamped to `[0, 100]`; hedge check: solve `½ aw t² + v cosθ t − 40 = 0` for the first positive `t` (`Math.sqrt` is correctly rounded by IEEE 754, so it is deterministic), and bonk if `v sinθ t − ½ g t² < 6`. A landing at or behind `x = 50` on your own side is a **dud** (your own fort can never be hit). Reference numbers: at 45° a power of 16 lands on the near bale and 17 on the far one in still air, 18 sails over; a +3 wind drifts a 4 s flight about 9 units, a bale and a half; a 20° shot at power 20 bonks. The client animates the same formula at 60 fps (the arc is `x(t), y(t)` from the same constants), so what you watch is what the server ruled.

**Timing.**

| Constant | live | async |
|---|---|---|
| `TURN_MS` | 20,000 | 43,200,000 (12 h) |
| `LATE_GRACE_MS` | 1,500 | 0 (the sweep is coarse) |
| `FLIGHT_MS` | 2,800 (scaled to `T`, min 1,600) | same, played on open |
| `REACT_MS` | 1,200 | same |
| acorns each | 5 | 5 |
| typical match | 2.5 to 3.5 min | 1 to 3 days |

**Seat-count variants.** Two seats. A 2v2 (alternate throwers on a team, shared fort) is a later variant with the same sim.

**Async pace.** The natural one. Each turn sends a push to the pig that owes a shot ("Clover's acorn is in the air. Your turn."); opening the app plays every shot since you last looked as a reel (the view carries `lastSeenShot` per seat), then hands you the sling. A 12 h timeout lobs the pig's **last shot settings** again (or 45° · 15 if it has none), so the match never stalls; two consecutive timeouts mark the pig trotted off and end it under the abandonment row. An async rival can be a random stranger: the queue pairs the oldest waiting acorn with the newest.

**State.**

```ts
interface Shot { seat: 0|1; angle: number; power: number; wind: number; landing: number; hit: number | null; bonk: boolean; dud: boolean; fallback: boolean }
interface ArcState {
  pace: 'live' | 'async';
  turn: 0|1;                         // who owes a shot
  shotsLeft: [number, number];       // 5, 5
  bales: [boolean[], boolean[]];     // standing bales per fort, index 0..2
  winds: number[];                   // 10, seeded; view reveals winds[shotIndex] only
  shotIndex: number;                 // 0..9
  phase: 'aim' | 'flight' | 'done';
  deadlineAt: number; flightUntil: number | null;
  lastSettings: [ {angle:number; power:number} | null, … ];
  missed: [number, number];
  shots: Shot[];
  lastEmoteAt: [number, number];
}
type ArcAction =
  | { type: 'shot'; angle: number; power: number }
  | { type: 'emote'; id: 0|1|2|3|4|5 };
```

`activeSeats`: aim → `[turn]`; flight or done → `[]`.

**`apply`.**
- `shot`: rejects unless `phase = 'aim'` and `seat = turn`; `parseAction` enforces integers in range, so an out-of-range aim is `bad_aim`. Runs the sim with `winds[shotIndex]`, writes the `Shot`, knocks a bale if hit, stores `lastSettings[seat]`, `missed[seat] = 0`, `phase = 'flight'`, `flightUntil = now + FLIGHT_MS + REACT_MS`. Events: `fly{seat, angle, power, wind}` (the client animates from the formula), then one of `hit{bale}`, `bonk`, `dud`, `miss{landing}`. A repeat of the same `shot` during flight is an idempotent `ok`.
- `emote`: as before.

**`onTimeout(s, seat)`.** Fires `lastSettings[seat]` or `45° · 15`, flagged `fallback`, `missed[seat] += 1`; at 2 the pig is trotted off and `phase = 'done'` with the other seat the winner (abandonment row; no contest if no human shot was ever taken).

**`tick`** (4 Hz). Flight → `shotIndex += 1`, `shotsLeft[turn] -= 1`; if a fort is empty or both `shotsLeft` are 0 → `done`; else `turn = 1 − turn`, `phase = 'aim'`, `deadlineAt = now + TURN_MS`, event `yourTurn{seat, wind: winds[shotIndex]}`.

**`view(s, seat)`.** Field geometry (mirrored for seat 1 by the client, not the server), both forts, `turn`, `shotsLeft`, `wind` for the current shot only, every past `Shot` (public), your `lastSettings`, the rival's **last splotch** (public: it is on the field), `deadlineAt`, `serverNow`, `lastSeenShot` for the catch-up reel. Future winds are stripped.

**`result(s)`.** `win` for the pig whose rival's fort is empty, else the most bales knocked, else `draw`; `scores` = bales knocked; `summary` is the deciding shot ("A 62° lob in a crosswind took the last bale").

**Practice bot (never peeks).** From its own view: target the nearest standing bale; scan power 1 to 20 at angles 35° to 60° with the current wind through the same pure sim and keep the `(angle, power)` whose landing is closest to the target; then add seeded noise, **Rookie Rosie** ±2 power and ±4°, **Steady Pepper** ±1 power and ±2°, **Dead-eye Biscuit** none. It sees only the current wind, like a player, and takes 2 to 5 s to "aim".

**UI events.** `yourTurn`: the windsock flips to the new wind, the sling glows, the sun arc starts. `fly`: the acorn leaves the sling along the formula's path, with a short dotted trail. `bonk`: `boom` glyph at the hedge, the thrower `surprise`. `hit`: the bale tumbles (two-frame sticker), the thrower `happy`, the defender a `bounce` of indignation, never `sad`. `miss`: the splotch stamps where it landed and stays. `dud`: the acorn rolls back to the thrower's trotters, both pigs `bounce`. `final`: `wave` over the hedge from both; the winner's fort gets a little bunting sticker for the result card only. Reduce Motion: the arc draws as a dotted path and the acorn appears at the end.

**Edge cases.** A shot arriving after the live deadline but inside the grace counts; after it the fallback has flown and the client is told `late` with the view. Two `shot`s in one turn: the second is `not_your_turn` (or idempotent if identical). Disconnect during flight: nothing is owed until `yourTurn`, and the 20 s grace runs from then. The async sweep runs every minute, so a 12 h deadline is honoured within 60 s. A client whose build lacks the trig table version in `rulesVersion` cannot be matched (version pairing is the ranked spec's). Field mirroring is a client transform; every number on the wire is in seat-0 field units.

**ASCII layout (390 pt).**

```
 0 ┌──────────────────────────────────────────────┐
   │ ‹ Head home         ACORN ARC       acorn 2/5 │  PageHeader
44 ├──────────────────────────────────────────────┤
   │  windsock →→ 2             [You 1 · Clover 0] │  this turn's wind (public) · bales knocked, as tags
84 │                                              │
   │                                              │  field 358×216: your pig bottom-left with the sling,
   │  Rosie             hedge         ▒▒ ▒▒ ▒▒    │  the hedge mid-field, the rival's three bales right,
   │  (sling)            ||           Clover(face) │  the rival pig behind them; your last splotch stays
   │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   │  on the grass
300├──────────────────────────────────────────────┤
   │  Your acorn. Pull back to aim.                │  hand-type line; for the rival's turn: "Clover is aiming"
344├──────────────────────────────────────────────┤
   │                                              │  aim pad 358×200: drag from the acorn; distance = power,
   │        · · · ·                                │  direction = angle; the FIRST FIFTH of the arc is dotted,
   │    ○──────────┘                               │  never the landing (the genre's skill gate)
   │        48° · power 12                         │  numeric readout in hand type, so a correction is a number
   │                                              │
560├──────────────────────────────────────────────┤
   │   ◠ sun arc 20 s        [    Let fly    ]     │  primary Button; release-to-fire is NOT used (mis-flicks)
620├──────────────────────────────────────────────┤
   │  [heart] [party] [gg] [whoa] [zzz] [sparkle]  │  shared emote tray
680└──────────────────────────────────────────────┘
```

**New glyphs.**
- `arc/bale.png`: a round hay bale with twine, standing; a second frame `bale_down.png` tumbled with loose straw.
- `arc/hedge.png`: a chunky green hedge block with a few leaves and one robin, tileable twice.
- `arc/windsock.png`: a striped windsock on a pole; the client scales and flips it for strength and side.
- `arc/sling.png`: a forked stick with a rubber loop and a leather pad, pig-sized.
- `arc/splotch.png`: a flat brown mud splotch with one grass tuft, drawn to sit on the ground line.
- Reused: `dig/acorn.png` (the projectile), `dig/boom.png` (the bonk).

## 5. Recommendation

Ship **Mud Volley · Wind-up** first, with the envelope pool on day one. It is the smallest rules module in this doc, it already has concept boards and a demo plan, it answers the founder's actual ask (head-to-head, random stranger or invited friend) in a 45 second session, and the wind-up fixes the one thing the prior spec worried about: one-use cards forced the last move and read as bookkeeping, while a public tell with asymmetric payoffs keeps every lane open every exchange and makes the rival the thing you are reading. The envelope form is what makes random matchmaking honest in a beta of tens: "Find a rival" always produces a game, live when someone is there, a sealed toss waiting for the next stranger when not, and Practice Pig only after a day, labelled.

Then **Supper Scrum**, because it is the same sealed beat with N seats and an integer instead of a lane: the server, the queue, the reveal choreography and the emote tray carry over untouched, and it is the first thing a player can invite two friends into. Then **Acorn Arc**, which brings the turn-based lane, the deterministic sim and push-paced async play, and is the one game here whose rhythm already matches the charter's "rendezvous over grind".

Hold Mud Trails for a population that can fill a live four-seat grid; fold Sumo into Volley and Scramble into Scrum's screen; leave Hot Acorn, bingo, quiz and the drawing game off the roadmap. Measure the depth claims before any ladder UI: in Volley, winners' follow-through rates should differ from losers' and from 25%; in Scrum, the pig that eats the Slop should win less than two thirds of the time. If either claim fails, change the rules, not the rating formula.
