# Exploration 03: cooperative and asymmetric play for two to four pigs

2026-10-04. Design only: no code, no migration, no economy. Successor to `docs/explorations/2026-10-01-matchmade-play/` (Tickle Duet, Truffle Trail, Picnic Relay, Pig Pageant); it keeps that work's transport lessons and revises its four co-op concepts rather than repeating them. Target: short, light sessions with a random stranger or an invited friend, played through the authoritative TypeScript game server (`GameDefinition<S, A, V>`, seeded server RNG, per-seat `view`), rendered with `PigStage` and the paper-craft primitives.

**Charter frame.** Every candidate here serves **Connect** first (a stranger becomes a pig you played with; a friend gets a reason to be pinged) and **Collect** through the game's own objects as vocabulary (finds, dig marks, truffles). None touches **Contend** and none touches the economy: no tickles, snouts, truffles, Happiness, Streak or membership effect. A match is a thing two pigs did together, and the only thing it leaves is a shared line on a result sheet (a keepsake stamp can follow later, once per first completion, outside these rules). The Feeding's Truffle Patch stays personal; the boards below are *hedge patches*, match-only.

---

## 1. What makes co-op work with a silent stranger

Co-op with a stranger fails in three familiar ways: one player does all the thinking while the other presses the button; the only way to coordinate is to talk, so without chat the game is two solo games side by side; and when it goes wrong, someone is obviously to blame. The games below are built against those three failures with four rules, which every candidate in this file inherits.

1. **Every signal is a move.** The only way to tell your partner anything is to do something the rules recognize, on a board both can see: a paw print on a tile, a picture held up, the moment you choose to play a card. Hanabi's hints are moves, not chat, and that is what makes a silent table work. The signal vocabulary is deliberately small and pictographic so a stranger reads it the first time, and the six emotes exist only for feeling, never for instruction.
2. **Each seat holds something the other lacks, and the game needs the intersection.** The Nose knows where; the Trotters chooses how loud. The Guesser has the grid; the Noses have the answer and one picture to say it with. If one seat could do the whole job alone, the other seat is decoration, and a stranger feels it immediately.
3. **A missing move resolves to the kindest legal move.** Timeouts never end a session or score against the pair. A sleeping digger follows the paw print; an absent clue-giver simply adds no clue, and if nobody clued, the board gets a little easier; the lowest truffle rolls in on its own. The game keeps its shape with one person present, and the result sheet never says who was late.
4. **Nothing is ever subtracted by a partner's mistake alone.** Scores add. Where the fiction takes something (the Hungerer wakes), it follows a decision both pigs made together (both tapped *Dig deeper*) and the sheet says *he* took it, not who woke him. No seat is ever named in a miss, a stir or a wake. A weak partner lowers a number; they never make a session a bad time.

A fifth rule is the charter's: **one sentence.** Each game below opens with the sentence a player would say to explain it, and anything that would need a second sentence was cut.

### The shared frame (inherited by every candidate)

- **Emotes (six, all feeling, none instruction).** `heart` (thanks), `sparkles` (nice one), `party` (we did it), `zzz` (no rush), `dizzy` (oops, said about yourself), `eyes` (hmm, thinking). The first five exist as glyphs today (the Lounge ships `heart · sparkles · coffee · party · zzz`; `coffee` retires here, `dizzy` and `eyes` are existing glyphs). There is deliberately no "hurry", no "no", no "wrong": the vocabulary cannot be used to scold. An emote is a universal action `{ kind: 'emote', emote }`, legal in every phase, rate-limited to one per two seconds per seat, and only ever produces an event.
- **Beats, deadlines and timeouts.** Every state carries `phase` and `deadlineAt`. `activeSeats(s)` is the set of seats still expected to act in the current beat; the server calls `onTimeout(s, seat)` for each of them when `deadlineAt` passes. Live beats are 4 to 10 seconds; async beats are 12 hours. Reconnect grace is 20 seconds live, during which the defaults carry the seat.
- **Absence.** A seat that misses three consecutive beats is *resting*: its defaults keep playing for it and its turn-rotating roles are skipped until it acts again. If every seat is resting for two beats, the match ends warmly with the tally so far (`'left'`), captioned *We'll finish this one another time.* No bot ever takes a human seat (the prior spec's rule stands); the practice partner is a labeled local bot from the start of a practice match.
- **Result.** `result(s)` returns `{ kind: 'coop', winners: everySeat, scores: [shared, shared, ...], summary }`, where `summary` is the warm line chosen by outcome band. Every band reads as something the pair did, not as a grade.
- **Views.** Hidden boards, seeds, other seats' private knowledge and uncommitted choices never leave the server. `view(s, seat)` is the only projection a client receives; a private fact (your scent count, your hand) rides in your view, never in a broadcast event.
- **Entry.** One *Play together* door, a random queue per game (stranger), an invite link with a push (friend), the 12-second practice offer from the prior spec. Nothing in these rules depends on which door was used.

---

## 2. Candidates

Feasibility is 1 (hard) to 5 (a week of work on the shared spine). "New art" counts painted 256 px sticker glyphs through the Codex ImageGen lane; sprites and existing glyphs are free.

### 2.1 Two Noses

- **Lineage.** TTP's own Snout Deep dig, made two-pig; the asymmetry is Hanabi's (you know what your partner cannot see) and Keep Talking's (one knows, one acts), on the live dig's scent, kernel and deterministic attention meter. **Revises Truffle Trail**: the Sniffer-marks-a-tile, Digger-taps-it design made the Digger a button-presser (the demo plan said so). Here nobody is "the digger": each pig sniffs its *own* side of one patch and digs the *other's*, so both do both jobs every turn, the knowledge is private and the marks are pictographic.
- **Pitch.** *Sniff your side, dig mine, and tie it off before he wakes.*
- **Seats.** 2. **Pace.** Live. **Length.** About 90 seconds (two layers of five turns).
- **Communication.** Three marks placed on your own side for your partner to read: a paw (dig here), an arrow (the truffle runs this way), a cross (nothing here). Scent numbers are private; marks are public. Plus the six emotes.
- **Why both matter.** The live sim already measured it: a nose finds 2.73 things per dig to blind play's 2.26 and survives deeper far more often, so a side with no marks is a worse dig; and a side with no digger is never dug. By rule a pig cannot dig where its own nose is or sniff across the patch.
- **Weak or absent partner.** No marks for you: you dig blind, which is the dig you already know. No digs from them: the timeout rubs your freshest paw print for them, so your marks are still followed, just quietly. The sheet reads *You dug for two.*
- **Pillars.** Connect (two noses in one patch); Collect (the dig's finds as the shared tally). Zero economy.
- **New art.** 4: paw mark, cross mark, arrow mark, title sticker. Everything else is the live dig's.
- **Feasibility.** 3. **Main risk.** Simultaneous beats at 4 seconds may feel rushed on a 300 ms link; the fallback is a 5-second beat and six turns.

### 2.2 Snout Says

- **Lineage.** *Just One* (everyone gives one clue; identical clues cancel) crossed with *Codenames Duet* (a grid, one target), with pictures instead of words. The clue is a picture that *reminds you of* the target, chosen from a tray that never contains the answer.
- **Pitch.** *Show me one picture that reminds you of it, and I'll guess which one you mean.*
- **Seats.** 2 to 4. **Pace.** Live and async. **Length.** About 100 seconds live (six rounds); two or three days async (three rounds, 12-hour beats).
- **Communication.** The clue picture is the whole channel. With three or four seats, the cancel rule adds a second, silent layer: don't both pick the obvious one.
- **Why both matter.** Without the Nose there is no clue; without the Guesser's two taps there is no interpretation. Nobody can play both roles in one round.
- **Weak or absent partner.** A missing clue adds nothing; if no clue survives, the server dims three wrong tiles so the round still plays. A missing guess leaves the round *in the mud* (zero) with no name on it. A resting seat is skipped as Guesser.
- **Pillars.** Connect (a stranger's associations are the game); Collect (the catalog of finds and dig things becomes a language; 27 pictures the player already collects).
- **New art.** 0 required (one optional title sticker).
- **Feasibility.** 5. **Main risk.** Twenty-seven pictures may go stale over many sessions; the deck grows with every find and dig thing the game adds, and the kind-tray rule protects strangers from a round with nothing to say.

### 2.3 Hush Hush

- **Lineage.** *The Mind*: lay numbered cards in ascending order across all hands with no communication but timing. Here the cards are truffles and the sleeper is the Great Hungerer: a wrong-order play is a *stir*.
- **Pitch.** *Lay your truffles smallest first, no talking, and don't wake him.*
- **Seats.** 2 to 4. **Pace.** Live. **Length.** 60 to 120 seconds (four levels, a 150-second cap).
- **Communication.** Time, and nothing else. A shared *sniff* token (everyone discards their lowest card face up) is the one hint, and it needs everyone's paw.
- **Why every seat matters.** Every pig holds cards; a level cannot clear without each pig's plays, and a pig's restraint matters as much as its plays.
- **Weak or absent partner.** A slammer causes stirs, which are counted and never fatal (no lives: he only ever stirs). A sleeper's lowest card rolls in on its own after twelve quiet seconds, correct by construction. A stir is the pair's: too fast *and* too slow.
- **Pillars.** Connect (the shared breath before a play is the game); the Hungerer gives Contend's boss a cozy cameo without touching Contend.
- **New art.** 3: truffle card, sniff token, truffle pile. The Hungerer's four painted states exist.
- **Feasibility.** 4. **Main risk.** Standoffs (nobody wants to play first) and the small-number feel; the 300 ms unordered window and the auto-roll are the answers, and the sim should confirm levels 3 and 4 are clearable at phone latency.

### 2.4 Snort & Add

- **Lineage.** **Revises Tickle Duet.** The prior design (six exchanges of two-gesture phrases) had four possible phrases and a flagged repetition risk. Here the phrase *grows*: you repeat your partner's phrase and add one gesture; three gestures (tickle, boop, pat) map to three pig reactions (`jump`, `surprise`, `happy`).
- **Pitch.** *Copy my tickle and add one; I'll copy yours and add one; how long can our giggle get?*
- **Seats.** 2. **Pace.** Live. **Length.** 75 seconds.
- **Communication.** The phrase itself, performed by the pigs. Plus emotes.
- **Why both matter.** Each turn is half memory (theirs) and half authorship (yours); neither pig can grow the phrase alone.
- **Weak or absent partner.** A miss is a hiccup and the phrase restarts at one; the score is the longest phrase reached, so a stranger who forgets at three still leaves a *longest giggle: 3*. A timeout performs the phrase correctly without the addition (the phrase holds, nobody is named).
- **Pillars.** Connect (the defining verb made reciprocal). Collect: none.
- **New art.** 0. **Feasibility.** 5. **Main risk.** A memory game's ceiling with a stranger: a partner who always misses at two caps the fun.

### 2.5 Pass the Patch

- **Lineage.** Relay/handoff, async. One hedge patch, one layer per pig, hours apart, by push: *Jen tied topsoil. The mud is yours.* Built on the live dig's reducer and rules (scent, five free sniffs, the meter, the pouch), one layer each.
- **Pitch.** *I dig the top, you dig the mud, and whoever's next gets the root.*
- **Seats.** 2 to 3. **Pace.** Async (12-hour layers). **Length.** One layer of real play per pig (40 to 90 seconds), a day or two for the chain.
- **Communication.** The handoff gift: unused sniffs carry down to the next pig (tie topsoil with three sniffs unspent and the mud opens with eight), and one paw print may be left on the next layer's board as a hunch.
- **Why each matters.** Each layer is its own board and its own meter, and deeper layers are worth more; the chain's tally is the sum.
- **Weak or absent partner.** Each layer banks its own finds on handoff, so a wake downstairs never costs the pig upstairs anything (the live loose-pouch stake is deliberately *not* carried across pigs: that would be blame by construction). A pig who never opens their layer in 12 hours leaves it *in the mud* and the chain moves on.
- **Pillars.** Connect (a push with a specific pig's name on it); Collect.
- **New art.** 1 (handoff ticket sticker). **Feasibility.** 3 (the dig reducer exists; the by-push plumbing and a three-seat chain are the work). **Main risk.** With tens of daily players, chains stall; expiry handles it but a stalled chain is a flat feeling.

### 2.6 Hand Me Down

- **Lineage.** Hanabi's principle applied to the Swap: you see every other pig's bag and wish, never your own. Each round every pig hands one of its own (unseen) slots to a pig; the only hint is an arrow another pig draws on your bag (*your slot 2 to Pip*).
- **Pitch.** *Hand your friend the find they're wishing for; they'll hand you yours.*
- **Seats.** 3 to 4. **Pace.** Live and async. **Length.** Three rounds, about 60 seconds live.
- **Communication.** One arrow per round drawn on someone else's bag; the handoff itself.
- **Why each matters.** Nobody can see what they hold or want; every delivery depends on someone else's arrow, and receiving your wish is the moment you learn what it was.
- **Weak or absent partner.** No arrow for you: give blind (one in three is useful). Timeout: the server hands the slot another pig pointed at, if any, else holds.
- **Pillars.** Connect (the gift spine); Collect (finds as the pieces). Mints nothing.
- **New art.** 1 (arrow). **Feasibility.** 4. **Main risk.** Thin decisions: once the arrows are in, play is "do what the arrow says"; it is a warm ritual more than a puzzle.

### 2.7 Dress Me

- **Lineage.** Keep Talking, as dress-up. **Revises Pig Pageant** from a social showcase into a two-seat co-op: the Stylist sees the theme (one of six), the Model sees a loaner trunk of eight pieces on their own pig; each round the Model tries one piece (both see it on the pig) and the Stylist answers warm or cold; three pieces in six rounds.
- **Pitch.** *I know the theme and you have the trunk; dress your pig from my hints.*
- **Seats.** 2. **Pace.** Live. **Length.** 90 seconds.
- **Communication.** Warm/cold (`sparkles` / `eyes` as the two answers, since the game gives them meaning), and the try-on itself.
- **Why both matter.** The Stylist cannot touch the trunk; the Model cannot see the theme.
- **Weak or absent partner.** No answer reads as cold; a timeout try-on keeps the current outfit. The sheet names the theme and awards a rosette line (*Dressed for a rainy day. The bow was inspired.*), never a count of misses.
- **Pillars.** Collect (cosmetics on a shared stage) and Connect. Loaner pieces are match-only and equal for everyone (membership never buys an input).
- **New art.** 6 theme stickers (several exist: sun, cloud, party, star, crown). **Feasibility.** 2 (loaner trunk UI, temporary cosmetics on `PigStage`, theme tags). **Main risk.** "Right" is subjective; theme tags make it objective but arbitrary.

### 2.8 Slop Kitchen

- **Lineage.** Relay/handoff. **Revises Picnic Relay** so both roles hold information: the Mixer sees a two-ingredient recipe, the Picker sees the pantry *and which four of eight ingredients are ripe this turn*; a request for an unripe thing forces a substitution of the same kind (apple for berries), and the Mixer decides whether it works.
- **Pitch.** *Ask for what you need; I'll pass what's ripe; we'll see what we cooked.*
- **Seats.** 2. **Pace.** Live. **Length.** 90 seconds, three dishes, roles swap after the first.
- **Communication.** The request picture; the pass; one send-back per dish.
- **Why both matter.** Recipe vs. ripeness: neither pig can finish a dish alone.
- **Weak or absent partner.** One pending item, one send-back, a funny bowl of slop at worst; a timeout passes the closest ripe match.
- **Pillars.** Connect. **New art.** 8 ingredients plus a bowl (over budget). **Feasibility.** 3. **Main risk.** Still close to one pig following instructions; the substitution is the only real decision.

### 2.9 Tickle Together

- **Lineage.** Sync game with a boss: all pigs tap within the same 400 ms window to make a *double tickle* that calms him; lone taps do nothing.
- **Pitch.** *Tickle him at the same moment as me and he settles.*
- **Seats.** 2 to 4. **Pace.** Live. **Length.** 45 seconds.
- **Communication.** A visible count-in and the taps.
- **Why each matters.** Only synchronized taps count.
- **Weak or absent partner.** Nothing counts, so nothing is lost; the result is how many doubles landed.
- **Pillars.** Connect. **New art.** 0. **Feasibility.** 3 (clock offset estimation per client). **Main risk.** Shallow after the first minute, and an early tap is visibly someone's.

### 2.10 Hush Now

- **Lineage.** Keep Talking, literal: the Watcher sees the Hungerer's meter and face, the Digger sees the mud and digs blind to the danger; the Watcher's signals are *hush* and *go*.
- **Pitch.** *You watch him, I dig; tell me when to stop.*
- **Seats.** 2. **Pace.** Live. **Length.** 60 seconds.
- **Why it is here.** To record why it loses to Two Noses: splitting the *danger* between seats makes every wake the Watcher's fault by construction, and the Watcher has nothing to do most beats. The shared danger must be visible to both; only the *opportunity* should be split. **Feasibility.** 3. **New art.** 0.

---

## 3. Ranked comparison

Rank is build order. "Sloppy partner" is what the session degrades into when one seat plays badly or not at all.

| # | Game | Lineage | Seats | Pace | Length | Sloppy partner degrades to | Pillars | New art | Feas. | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Snout Says** | Just One / Codenames Duet, pictures | 2 to 4 | live + async | ~100 s / 2 to 3 days | a harder guess, never a bad one | Connect, Collect | 0 | 5 | **Ship first.** Fills at any population, zero art, strangers can't ruin it. |
| 2 | **Two Noses** | Snout Deep, two-pig; Hanabi + Keep Talking | 2 | live | ~90 s | the solo dig you already know | Connect, Collect | 4 | 3 | **The flagship.** The most TTP thing on the list; second build. |
| 3 | **Hush Hush** | The Mind | 2 to 4 | live | 60 to 120 s | a slower level with more stirs | Connect | 3 | 4 | Third. The sync game the brief asked for; needs a latency sim first. |
| 4 | Snort & Add | Tickle Duet revised | 2 | live | 75 s | a short giggle | Connect | 0 | 5 | Cheap and charming; ceiling is low. Keep as the "feel" prototype. |
| 5 | Pass the Patch | relay dig by push | 2 to 3 | async | a day or two | a stalled chain that expires kindly | Connect, Collect | 1 | 3 | The natural second async game once the live dig reducer is lifted into the module. |
| 6 | Hand Me Down | Hanabi principle on the Swap | 3 to 4 | live + async | ~60 s | blind gifts | Connect, Collect | 1 | 4 | Warm ritual, thin game. Revisit if 3+ seats fill. |
| 7 | Dress Me | Keep Talking dress-up; Pageant revised | 2 | live | 90 s | a cold trunk | Collect, Connect | 6 | 2 | Good idea, heavy build; after a cosmetics loaner system exists. |
| 8 | Slop Kitchen | Picnic Relay revised | 2 | live | 90 s | slop | Connect | 9 | 3 | Over the art budget; the substitution is the only decision. |
| 9 | Tickle Together | sync boss taps | 2 to 4 | live | 45 s | nothing lands | Connect | 0 | 3 | Shallow; timing over the network. |
| 10 | Hush Now | Keep Talking literal | 2 | live | 60 s | the Watcher's fault | Connect | 0 | 3 | Ruled out: blame by construction. |

---

## 4. The top three, specified

Conventions used in all three: `Seat = number`; `rng.int(n)` is a uniform integer in `[0, n)`; `now` is server milliseconds; every `apply` returns `{ ok: false, error }` with the error codes listed under *Validation*; `GameEvent` is `{ kind, ...fields }` and is public, so nothing private rides on it.

### 4.1 Two Noses

**The sentence.** *Sniff your side, dig mine, and tie it off before he wakes.*

#### Rules

- **The patch.** One hedge patch of 6 columns by 5 rows, two layers (**topsoil**, **the mud**), every tile 2 deep. Seat 0's **nose side** is columns 0 to 2; seat 1's is columns 3 to 5. A pig may **sniff** and **mark** only on its own nose side and may **dig** only on the other side. Each pig's screen is mirrored so its own side is always on the left, the partner's on the right, and the two pigs face each other above the patch (the Visit's `face` turn: you on the left looking right, the partner on the right mirrored).
- **Layout (server, from the seed).** Per side per layer: one **domino truffle** (2 tiles, horizontal or vertical, inside the side), two **things** (1 tile each, drawn from the layer's deck: topsoil `boom · pouch · apple · boot · horseshoe · cap`; the mud `shimmer · acorn · tea · scroll`), and stones (two in topsoil, one in the mud). Finds never overlap. Stones are inert and never count for scent.
- **Scent.** `scentAt(tile)` is the number of find tiles in the 3 by 3 around the tile, itself included, across the whole patch (the seam does not stop a nose). Stones never count. The number never lies. A sniff is **free and silent**: a nose across the patch never wakes him (the co-op gift, and the one rule that differs from the solo dig).
- **The kernel.** The live `applySplash`: **rub** takes 1 from the tile and ½ from its four neighbours; **shove** takes 2 and 1; floored at 0. A cluster whose tiles all reach 0 is **revealed**. A tile at depth 1 or less shows a **silhouette**: *something* or *a stone*, never which thing.
- **The meter.** Every dig adds its **loudness** to a visible meter: topsoil rub 3, shove 9; the mud rub 6, shove 18; *wait* 0; sniff 0. His **sleep depth** is drawn once per layer, uniformly in the visible band **60 to 120**, and hidden. A turn's two digs land, then the meter is compared: at or past the depth, **he wakes**. The meter resets on descent and a new depth is drawn (the live game's "board" scope).
- **A layer is five turns; a turn is two beats.**
  - **Noses (4 s).** Each pig may sniff one unsniffed tile on its own side (the count appears only on that pig's screen) and may place one mark on its own side, or remove one. Both optional. The beat always runs its full four seconds.
  - **Trotters (4 s).** Each pig submits one action on the partner's side: `rub`, `shove` or `wait`. The beat resolves when both have submitted or at the deadline: both digs land (seat 0's then seat 1's, for the kernel), reveals fire, the loudness sum is added, the wake check runs.
- **Marks** are the signal vocabulary, placed on your own side for your partner: **paw** (dig here), **arrow** with a direction (the truffle runs this way from here), **cross** (nothing here). A side holds at most three marks; a fourth replaces the oldest. Marks clear on descent.
- **Between layers: the Deeper beat (5 s).** Offered after topsoil's fifth turn **only if at least one truffle was revealed** (the live rule: you cannot dig deeper until the board's truffle is found). Each pig taps *Tie it off* or *Dig deeper*. **Both** deeper descends; anything else ties. After the mud's fifth turn the dig ties.
- **The pouch (match-only).** A revealed truffle is **loose** until its layer ends (a tie banks it; a descent banks it: bank on descent). A revealed thing is loose until the **final tie**; descent carries it down. **A wake takes everything loose**: the current layer's truffles and every loose thing. Banked stays banked. Kept = banked truffles + banked things.
- **End.** Tie (after the mud, or after topsoil without a double *deeper*), wake, or `'left'` (everyone resting).

#### Roles and swaps

There are no role swaps because there are no fixed roles: every pig is the Nose for its side and the Trotters for the other, in every turn. This is the change from Truffle Trail. Nobody waits through a layer for their turn to matter.

#### Scoring and the sheet

Shared score = kept finds (truffles and things). The sheet is the live dig's tally grammar (kicker, title, one hand line, the finds as ledger rows, a foot) with no tickle column: rows land one by one, truffles on a sun disc, things on their layer's disc, a taken thing on a rose disc reading *his*.

| Outcome | Kicker | Title | Hand line |
| --- | --- | --- | --- |
| Tied after the mud, nothing taken | *two noses · tied at the mud* | *Two noses, N finds.* | *he never stirred.* |
| Tied after topsoil | *two noses · tied at topsoil* | *Two noses, N finds.* | *a quiet dig. the mud can wait.* |
| Woke | *two noses · he woke at the mud* | *He woke. Still worth it.* | *the truffles were tied. the pouch was his.* (or *nothing was loose for him to take.*) |
| One pig dug the whole time | as above | as above | *you dug for two.* |
| Left | *two noses* | *We'll finish this one another time.* | *N finds so far.* |

`result(s)` is `null` until `ended`; then `{ kind: 'coop', winners: [0, 1], scores: [kept, kept], summary: title + ' ' + handLine }`.

#### State

```ts
type Layer = 0 | 1;                                  // topsoil · the mud
type Phase = 'noses' | 'trotters' | 'deeper' | 'over';
type Verb = 'rub' | 'shove' | 'wait';
type MarkKind = 'paw' | 'arrow' | 'cross';
type Dir = 'n' | 'e' | 's' | 'w';
type ThingKind = 'boom' | 'pouch' | 'apple' | 'boot' | 'horseshoe' | 'cap'
               | 'shimmer' | 'acorn' | 'tea' | 'scroll';
type FindKind = 'truffle' | ThingKind | 'stone';

interface Find { id: string; kind: FindKind; tiles: number[]; side: Seat }
interface Mark { tile: number; kind: MarkKind; dir?: Dir; by: Seat; turn: number }
interface DigIntent { verb: Verb; tile: number | null }   // tile null for 'wait'

interface TwoNosesState {
  rulesVersion: 1;
  phase: Phase; deadlineAt: number;
  layer: Layer; turn: number;                        // 1..5
  // hidden from every client
  layouts: [Find[], Find[]];                         // per layer, from the seed
  sleepDepth: number;                                // this layer's, in BAND
  // public board, current layer
  depths: number[];                                  // 30 tiles, 2..0
  revealed: string[];                                // find ids at depth 0 this layer
  marks: Mark[];
  attention: number;
  // private per seat
  scent: [Record<number, number>, Record<number, number>];
  // beat bookkeeping
  sniffed: [boolean, boolean]; marked: [boolean, boolean];
  dig: [DigIntent | null, DigIntent | null];
  vote: [boolean | null, boolean | null];            // deeper?
  idleBeats: [number, number];
  lastEmoteAt: [number, number];
  // pouch
  looseTruffles: string[]; looseThings: string[];
  bankedTruffles: string[]; bankedThings: string[];
  taken: string[];
  ended: null | { reason: 'tie' | 'wake' | 'left'; layer: Layer; turn: number };
}
```

#### Actions

```ts
type TwoNosesAction =
  | { kind: 'sniff'; tile: number }                  // noses beat, own side
  | { kind: 'mark'; tile: number; mark: MarkKind; dir?: Dir }
  | { kind: 'unmark'; tile: number }
  | { kind: 'dig'; verb: 'rub' | 'shove'; tile: number }   // trotters beat, other side
  | { kind: 'wait' }
  | { kind: 'vote'; deeper: boolean }                // deeper beat
  | { kind: 'emote'; emote: EmoteId };
```

`parseAction` accepts only these shapes with integer tiles in `[0, 30)`; anything else is `null`.

#### Validation (error codes)

- `wrong_phase`: the action does not belong to the current beat.
- `wrong_side`: a sniff or mark off your nose side; a dig on your own side.
- `already_sniffed` (this tile, this layer), `sniffed_this_beat`, `marked_this_beat`.
- `arrow_needs_dir`; `dir_off_board` (an arrow pointing off the patch).
- `no_mark_here` for `unmark`.
- `tile_cleared`: a dig on a tile already at depth 0 (the live no-op rule becomes a refusal here so the client never spends a beat on nothing).
- `already_dug`: a second dig this beat.
- `already_voted`.
- `emote_too_soon` (under two seconds).
- `ended`.

#### Timeouts

- **Noses deadline** (always reached): nothing to default; the beat becomes `trotters`, `deadlineAt += 4000`.
- **Trotters deadline, seat missing:** if the partner's side holds a paw mark whose tile is not cleared, default to `rub` on the **freshest** such paw; else `wait`. Then resolve the beat. Async pace is not offered for this game.
- **Deeper deadline, seat missing:** vote `false` (tie). The cautious choice is never wrong.
- **Resting:** `idleBeats[seat]` increments on each defaulted beat and resets on any action. Both seats at 2 or more: `ended = { reason: 'left' }`.

#### What `view(s, seat)` shows

- Public: `phase`, `deadlineAt`, `layer`, `turn`, `depths`, `silhouettes` (derived: for each tile at depth 1 or less, `'find' | 'stone' | null`, kind hidden), `revealed` as `{ id, kind, tiles }`, `marks`, `attention`, `band: [60, 120]`, `hungerer: 'snoring' | 'stirring' | 'awake'` (snoring in topsoil, stirring in the mud, awake on a wake), pouch counts (`looseTruffles`, `looseThings`, `banked`), `deeperOffered`, `ended`.
- Private: `myScent` (only this seat's counts), `mySniffedThisBeat`, `myMarkedThisBeat`, `myDig` (my own pending intent), `myVote`.
- About the partner: `partnerActed: boolean` for the current beat, never what they did until the beat resolves; never their scent; never their pending dig or vote.
- Never: `layouts`, `sleepDepth`, the seed.
- The view is **mirrored**: `mySide` is reported and the client draws its own side on the left. Tile indices stay canonical.

#### The practice partner (never peeks)

The bot is given its own view and nothing else.

- **Noses.** Sniff: the unsniffed tile on its side with the most unknown neighbours, preferring the middle column of its side (col 1 of 3) and the middle rows; if any known count is 2 or more, prefer an unsniffed neighbour of the highest count. Mark: if two adjacent sniffed tiles both read 2 or more, paw the higher and arrow from it toward the other; else paw the highest count if it is 1 or more; cross any 0 once. Never more than one mark per beat.
- **Trotters.** If the partner's side has an undug paw: dig it, `shove` when `attention + 2 * shoveLoudness < 60`, else `rub`. Else if a `'find'` silhouette is showing on that side: rub it. Else rub the most central undug tile. `wait` when `attention + 2 * rubLoudness >= 60` and a truffle is already loose this layer.
- **Deeper.** Vote deeper when both topsoil truffles were revealed and `attention` never crossed 45 during topsoil; else tie.
- **Emotes.** `sparkles` on any reveal by the human's dig; `dizzy` on a wake; nothing else.

#### Events to animate

`beat {phase, deadlineAt}` (the screen shifts between the nose bar and the trotters bar) · `sniffed {seat, tile}` (a scent disc appears on the sniffer's own screen only, with the number; the partner sees the pig's nose dip) · `marked {mark}` / `unmarked {tile}` (a sticker drops onto the tile with the sticker tilt) · `dug {seat, verb, tile}` (mud flies; rub is a brush, shove is a thump) · `revealed {find}` (the live `FindReveal` sticker: *a Clockwork Acorn, loose*) · `attention {value}` (the meter fills; his face lifts a step when within 15 of the band's low end) · `woke {turn}` (the one-frame wake, the rose ring, both pigs `surprise`) · `descended {layer}` (layer strip advances, scent discs and marks fade, the pouch slides down) · `tied {layer}` (both pigs `happy`, the tally) · `left` · `emote {seat, emote}` (a bubble over that pig, 1.8 s, as the Lounge draws it).

#### Tuning (placeholders, served by the game server's config with these compiled fallbacks)

| Knob | Value |
| --- | --- |
| Noses beat · Trotters beat · Deeper beat | 4 s · 4 s · 5 s |
| Turns per layer · layers | 5 · 2 |
| Loudness topsoil (rub · shove) · mud (rub · shove) | 3 · 9 · 6 · 18 |
| Sleep-depth band | 60 to 120, uniform, per layer |
| Marks per side | 3 |
| Finds per side per layer | 1 domino truffle · 2 things · 2 stones (topsoil) / 1 stone (mud) |
| Resting threshold · both-resting end | 3 beats · 2 beats |
| Emote rate | 1 per 2 s |

Sanity: five turns of two rubs each is 30 loudness in topsoil (never wakes) and 60 in the mud (may wake at the band's floor); five turns of two shoves is 90 (likely wakes) and 180 (certainly). All-shove is a gamble, all-rub is nearly safe, and the mud makes even quiet digging a decision. A domino needs two exactly placed shoves or three rubs; a side gets five digs, so a side with good marks clears its truffle and one thing, a side without marks usually clears one or the other.

#### Edge cases

- **Both pigs dig the same tile in one beat** (impossible: each digs the other's side; the sides are disjoint). **A shove's splash crosses the seam**: fine, the kernel is one board; a reveal on the partner's side from your splash is still their side's find.
- **A reveal lands on the waking turn**: it lands, then it is taken with the pouch (the live rule: the waking action lands first).
- **Deeper offered, one pig resting**: the resting seat defaults to tie; the active pig's deeper vote is shown as *you were ready* on the sheet, with no partner line.
- **A pig sniffs a tile the partner has half-cleared**: allowed; scent is about neighbours, not depth.
- **Reconnect mid-beat**: the view carries `deadlineAt` and the pending state; the client redraws, and a dig submitted before the drop is still the seat's dig (`already_dug` on a resend, which the client treats as success).
- **Arrow pointing across the seam**: allowed; it means "toward your side", which is a real hint about a truffle near the seam.
- **Reduce Motion**: the wake is one frame, the layer swap a crossfade, marks drop without the tilt spring.

#### Layout (390 pt portrait)

Noses beat, your side on the left (mirrored per seat; `P` paw, `X` cross, `>` arrow, numerals your scent, `#` mud, `=` half-cleared showing a silhouette, `.` cleared, `T` truffle, `*` thing, `o` stone):

```
+----------------------------------------------+
| < leave        TWO NOSES . topsoil . turn 2/5 |  PageHeader kicker
|                                              |
|   [you, face ->]   (he's snoring)  [<- Pip]  |  two PigStage at 96pt, Hungerer 72pt
|                  |======-----|  60 ... 120   |  attention meter with the band
+----------------------------------------------+
| NOSES . sniff your side, leave a mark   0:03 |  beat strip (sun)
|                                              |
|   your nose          |      Pip's nose       |
|  +----+----+----+   ||   +----+----+----+    |
|  | 2  | #  | #  |   ||   | #  | P  | #  |    |  52x52pt tiles, 6 x 5
|  +----+----+----+   ||   +----+----+----+    |
|  | #  | 3  | =  |   ||   | .  | *  | #  |    |  (* = Pip's revealed thing)
|  +----+----+----+   ||   +----+----+----+    |
|  | X  | #  | #  |   ||   | #  | >  | #  |    |
|  +----+----+----+   ||   +----+----+----+    |
|  | #  | #  | o  |   ||   | #  | #  | #  |    |
|  +----+----+----+   ||   +----+----+----+    |
|  | #  | #  | #  |   ||   | #  | #  | #  |    |
|  +----+----+----+   ||   +----+----+----+    |
|                                              |
| pouch: 1 loose . 0 tied   [heart][spark][zzz]|  pouch line + 3 of 6 emotes (more on hold)
|                                              |
|  [ SNIFF ]  [ PAW ]  [ ARROW ]  [ CROSS ]    |  verb bar, 4 x 80pt, 56pt tall, selected on sun
+----------------------------------------------+
```

Trotters beat, same screen; the beat strip turns and the verb bar changes:

```
| TROTTERS . dig Pip's side               0:04 |  beat strip (rust kicker on sun)
|   ... same patch; Pip's side is the live one |
|   your side dims to 60% while you dig        |
|                                              |
|  [ RUB . quiet ]  [ SHOVE . loud ]  [ WAIT ] |  3 x 110pt, 56pt tall
+----------------------------------------------+
```

Deeper beat: the patch dims, one `Sticker` rises over it with the pouch (*1 truffle tied · 2 things loose*) and two buttons: *Tie it off · keep 3* (gold, primary) and *Dig deeper · carry 2* (cream). The partner's choice is never shown before the beat ends.

#### New glyphs (painted 256 px stickers, one prompt line each, house style: thick warm dark-brown ink outline, chunky rounded shape, soft cel shading, painterly highlight, two tiny four-point golden sparkles, subject about 88% of the box, flat magenta #FF00FF background, no text)

- `mark_paw`: a single muddy pig trotter print pressed into soft brown mud, two toes, seen from above.
- `mark_arrow`: a short bent hazel twig lashed into an arrow, pointing right, with a wisp of scent curling along it.
- `mark_cross`: two crossed dry twigs over a bare patch of soil.
- `two_noses`: two pink pig snouts touching tip to tip in profile, a tiny heart of mud between them (the title sticker).

Reused: `assets/images/hunger/great_hungerer_{snoring,stirring,awake}.png` through `components/mudwar/Hungerer.tsx`; dig marks `assets/images/glyphs/dig/*`; the truffle `glyphs/receipt/truffle.png`; the live tile surface and `FindReveal`; emotes from `glyphs/`.

---

### 4.2 Snout Says

**The sentence.** *Show me one picture that reminds you of it, and I'll guess which one you mean.*

#### Rules

- **The deck.** 27 pictures the player already collects: the 12 finds (`river_pebble · blue_feather · clover · snail_shell · brass_button · wool_tuft · red_berries · pinecone · old_key · honeycomb · marble · tin_whistle`) and the 15 dig things (`acorn · apple · bag · boom · boot · bow · cap · charm · furnishing · horseshoe · pouch · relic · scroll · shimmer · tea`).
- **Kinship (rules data, inside the module).** Every picture carries two to four tags from `animal · plant · water · sky · food · sweet · metal · glass · wood · old · shiny · soft · round · sound · lucky · tool · warm · home`. `kinship(a, b)` is the size of the tag intersection. Tags are never shown to players; they deal a kind tray and drive the bot.
- **A session is six rounds live, three async.** The **Guesser** for round *r* is seat `r mod seats`; everyone else is a **Nose**. With two seats, the roles simply alternate.
- **Deal (server).** `spread`: 9 pictures. `target`: one of them. `tray`: 12 pictures from the remaining 18, dealt **kind**: at least three tray pictures share a tag with the target (redeal the tray until true; the deck guarantees it is always possible).
- **Clue beat (10 s live · 12 h async).** Each Nose secretly picks exactly one tray picture. At the deadline or when every Nose has picked: pictures chosen by two or more Noses **cancel** and are removed (the Just One rule); the survivors are revealed to everyone, each beside its Nose's pig. With one Nose nothing can cancel. If **no clue survives**, the server dims three wrong spread tiles (a *free sniff*) before the guess.
- **Guess beat (10 s live · 12 h async).** The Guesser taps a spread tile. Right first tap: **2** (*a nose that knew*). Wrong: the tile dims for everyone and the Guesser taps again. Right second tap: **1** (*nearly*). Wrong again: **0** (*that one got away*). A dimmed tile cannot be tapped.
- **Reveal beat (3 s live · skipped async).** The target is ringed; the clue pigs react (`happy` on 2, `jump` on 1, `surprise` and a giggle on 0: a goofy hiccup, never `sad`). Emotes are open through the beat.
- **End.** After the last round, or `'left'`.

#### Roles and swaps

Guesser rotates every round by seat order. A **resting** seat (three missed beats) is skipped as Guesser until it acts; its rounds pass to the next seat so nobody waits on an absent pig twice.

#### Scoring and the sheet

Shared score out of `2 * rounds` (12 live, 6 async). The sheet lists each round as a ledger row: target picture, the surviving clue(s), and the outcome word (*knew · nearly · got away · in the mud*). No seat is named on any row.

| Band (of 12) | Title | Hand line |
| --- | --- | --- |
| 10 to 12 | *One language, no words.* | *N of 12. snout says: again?* |
| 6 to 9 | *Most of them landed.* | *N of 12. the misses were the funny part.* |
| 1 to 5 | *A few landed.* | *N of 12. snouts are hard to read.* |
| 0 | *Nothing landed, nothing lost.* | *0 of 12. that was a strange tray.* |
| left | *We'll finish this one another time.* | *N so far.* |

`result(s)`: `{ kind: 'coop', winners: allSeats, scores: allSeats.map(() => total), summary }`.

#### State

```ts
type Phase = 'clue' | 'guess' | 'reveal' | 'over';
type PictureId = string;                           // 'blue_feather' | 'acorn' | ...

interface Round {
  guesser: Seat;
  spread: PictureId[];                             // 9
  target: PictureId;                               // hidden from the guesser until reveal
  tray: PictureId[];                               // 12, kind-dealt
  picks: Record<Seat, PictureId>;                  // hidden until the clue beat ends
  clues: PictureId[];                              // survivors, public after the clue beat
  dimmed: PictureId[];                             // wrong guesses + free-sniff dims
  guesses: PictureId[];                            // 0..2
  score: 0 | 1 | 2 | null;
}

interface SnoutSaysState {
  rulesVersion: 1;
  seats: number; pace: 'live' | 'async';
  phase: Phase; deadlineAt: number;
  round: number; rounds: Round[];                  // rounds[round] is current
  idleBeats: number[]; lastEmoteAt: number[];
  ended: null | { reason: 'done' | 'left' };
}
```

#### Actions

```ts
type SnoutSaysAction =
  | { kind: 'clue'; picture: PictureId }           // a Nose, clue beat
  | { kind: 'guess'; picture: PictureId }          // the Guesser, guess beat
  | { kind: 'emote'; emote: EmoteId };
```

#### Validation

- `wrong_phase`; `not_a_nose` (the Guesser clueing); `not_the_guesser`.
- `not_in_tray`; `already_clued` (one pick per Nose; picks are final, a resend of the same picture is idempotent success).
- `not_in_spread`; `tile_dimmed`; `already_guessed` (a resend of the same picture is idempotent success).
- `emote_too_soon`; `ended`.

#### Timeouts

- **Clue deadline:** Noses without a pick contribute nothing. Resolve cancels; if `clues` is empty, dim three wrong tiles chosen by `rng` (the target is never dimmed). Phase to `guess`.
- **Guess deadline:** if no guess was made, the round scores 0 and the row reads *in the mud*; if one wrong guess was made, it scores 0 and reads *got away*. Phase to `reveal` (live) or straight to the next round (async).
- **Reveal deadline:** next round, or `done`.
- **Async pushes:** on entering `clue`, every Nose: *{Guesser}'s pig is guessing. Leave a clue.* On entering `guess`: *Your clues are in.* On `done`: everyone: *Snout Says: N of 6.* A seat that misses its 12-hour window simply contributes nothing and the game advances; nobody is pushed about anyone else's lateness.

#### What `view(s, seat)` shows

- Everyone: `phase`, `deadlineAt`, `round`, `rounds` count, the running total, past rounds (target, clues, outcome), `spread`, `dimmed`, `guesses` so far, pig identities per seat, `clues` once the clue beat has ended, and for each Nose only `hasPicked: boolean` before that.
- A **Nose** also sees: `target` (ringed in the spread), `tray`, `myPick`.
- The **Guesser** never sees: `target` (until reveal), `tray`, any `picks`.
- Nobody sees another Nose's pick before the cancel rule runs.
- Tags are not in the state at all; they are module data.

#### The practice partner (never peeks)

- **Practice Nose** (the human is guessing): sees the target and the tray as any Nose does; picks among the tray pictures ranked by `kinship(pic, target)`, the best with probability 0.7, the second-best otherwise (so two practice Noses sometimes cancel, which is the real game's comedy). Ties by `rng`.
- **Practice Guesser** (the human is a Nose): sees the surviving clues and the spread; taps the spread picture with the highest summed kinship to the clues; on a miss, the next best. With no clue, taps at random among undimmed tiles.
- Neither sees the other's hidden fields; the Guesser bot never sees the target.

#### Events to animate

`beat {phase}` · `picked {seat}` (that Nose's pig nods; no picture) · `cluesRevealed {clues, cancelled: number}` (survivors slide into a `WishBubble` over the Noses' pigs; cancelled clues appear for a beat and tear away with a giggle so the Noses see what they both thought of) · `freeSniff {dimmed}` (three tiles fog over) · `guessed {picture, correct}` (a wrong tile dims with a soft thud; the right tile rings in sun and the target's find glyph bounces) · `roundScored {score}` · `done` · `emote`.

#### Tuning

| Knob | Live | Async |
| --- | --- | --- |
| Rounds | 6 | 3 |
| Clue beat · guess beat · reveal beat | 10 s · 10 s · 3 s | 12 h · 12 h · none |
| Spread · tray · kind minimum | 9 · 12 · 3 shared-tag tray pictures | same |
| Score per round | 2 / 1 / 0 | same |
| Resting threshold | 3 beats | 2 windows |

#### Edge cases

- **Two seats and the only Nose rests:** every round of the other pig's guessing runs on the free sniff (two tries among six tiles); the game stays playable and the sheet says *strange tray*, never *your partner*.
- **All Noses pick the same picture (3 to 4 seats):** everything cancels; the free sniff fires; the cancelled picture is shown tearing away so the table laughs at itself.
- **A clue picture is also in the spread:** impossible by construction (the tray is dealt from the 18 pictures not in the spread).
- **Resend after reconnect:** same picture is idempotent success; a different picture is `already_clued` / `already_guessed`.
- **Async seat leaves the game:** their rounds are skipped; if only one seat remains, `left`.
- **A 4-seat live game with two resting seats:** rounds rotate among the two active seats; a round needs one Nose and one Guesser, so the game stays whole.

#### Layout (390 pt portrait)

The Guesser:

```
+----------------------------------------------+
| < leave            SNOUT SAYS . round 3 of 6 |
|                                              |
|   [Pip, face ->] [Clover, face ->]  (clues)  |  Nose pigs at 72pt, left
|      ( apple )      ( --- )                  |  WishBubble over each: a clue, or tearing away
|                                   [you, sit] |  your pig, face_sit, right, 96pt
+----------------------------------------------+
|  which one reminds them of an apple?         |  hand line (PatrickHand)
|                                              |
|   +--------+ +--------+ +--------+           |
|   | pebble | | berries| | key    |           |  3 x 3 spread, 100pt tiles
|   +--------+ +--------+ +--------+           |  a dimmed tile at 40%
|   +--------+ +--------+ +--------+           |
|   | honey  | | whistle| | clover |           |
|   +--------+ +--------+ +--------+           |
|   +--------+ +--------+ +--------+           |
|   | marble | | wool   | | feather|           |
|   +--------+ +--------+ +--------+           |
|                                              |
|  two guesses  (o)(o)                   0:07  |  guess pips + clock
|  7 of 12 so far        [heart][spark][dizzy] |
+----------------------------------------------+
```

A Nose:

```
+----------------------------------------------+
| < leave            SNOUT SAYS . round 3 of 6 |
|   [Rosie guessing, face <-]   [you] [Clover] |
+----------------------------------------------+
|  the answer is the honeycomb. pick one        |  hand line
|  picture that reminds you of it.             |
|   +--+ +--+ +--+        3 x 3 spread, 56pt,   |
|   |  | |  | |  |        target ringed in sun  |
|   +--+ +--+ +--+                              |
|   +--+ +--+ +--+                              |
|   |  | |()| |  |                              |
|   +--+ +--+ +--+                              |
|   +--+ +--+ +--+                              |
|   |  | |  | |  |                              |
|   +--+ +--+ +--+                              |
|                                              |
|  +------+ +------+ +------+ +------+          |
|  |apple | |acorn | | tea  | |  bow |          |  tray, 3 rows x 4, 80pt tiles
|  +------+ +------+ +------+ +------+          |
|  |boot  | |scroll| |shimmr| | cap  |          |
|  +------+ +------+ +------+ +------+          |
|  |charm | |relic | |pouch | | bag  |          |
|  +------+ +------+ +------+ +------+          |
|                                              |
|  [ SHOW THIS ONE ]   Clover has picked  0:06 |  one gold button; the partner's state, not pick
+----------------------------------------------+
```

#### New glyphs

None required. Optional: `snout_says`, a pink pig snout in profile with a small cream paper speech bubble holding a tiny acorn (the title sticker). Reused: `glyphs/finds/*`, `glyphs/dig/*`, `components/visit/WishBubble.tsx`, emotes.

---

### 4.3 Hush Hush

**The sentence.** *Lay your truffles smallest first, no talking, and don't wake him.*

#### Rules

- **The deck.** Truffle cards numbered **1 to 50**, a fresh shuffle every level. Numerals are language-free (the dig already writes scent as hand numerals).
- **Levels.** Four. Level *L* deals *L* cards to every pig. Clearing level 4 ends the session. A **150-second cap** ends the session wherever it stands.
- **Paws down.** Each level opens with a 5-second ready beat: every pig taps its paw print; a missing pig is auto-ready at the deadline.
- **Open play.** During a level any pig may **play** at any time; a play is always that pig's **lowest** card (the UI offers only the lowest). The server orders plays by receipt. A card is **correct** if no pig still holds a lower card. Plays that arrive within **300 ms** of each other are **unordered**: they are sorted ascending and judged as a sorted group, so near-simultaneous plays never stir him by latency alone.
- **A stir.** A card played while a lower card is still in some hand: **he stirs** (face to `stirring` for two seconds, then back), every held card lower than the played card **tumbles** out of all hands face up onto the pile's edge, and play continues. Stirs are counted. **There are no lives**: he only ever stirs, never wakes; a level always completes.
- **The pile.** Shows the top card's numeral and a count. Tumbled cards sit beside it, public.
- **Sniff.** The table starts with one **sniff token** and gains one on clearing level 2 (two held at most). Any pig may **propose** a sniff; it passes if every other *responsive* seat taps agree within 4 seconds (a seat that has not acted in 20 seconds counts as agreeing); then every pig discards its lowest card face up, public, and the token is spent. Not unanimous: the proposal lapses, the token stays.
- **Quiet.** After 12 seconds with no play, he snores a visible beat (a prompt, no penalty). After **25 seconds** with no play, the **lowest card in play rolls in on its own**: correct by construction, no stir. The pile shows a little mud trail; no pig is pointed at.
- **A level clears** when all hands are empty. Clean (no stir) earns a full shared giggle (`party` bubble over everyone, both pigs `jump`); with stirs it earns a quieter one (`happy`).
- **End.** Level 4 cleared, the 150-second cap (the remaining cards roll in in order: *he slept through the rest*), or `'left'`.

#### Roles and swaps

No roles: every pig is a player with a hand. The only asymmetry is what each pig knows (its own hand) and the only choice is *when*.

#### Scoring and the sheet

Shared score: levels cleared (0 to 4); stirs are the second number. Rows: one per level with its card count and *clean* or *N stirs*.

| Outcome | Title | Hand line |
| --- | --- | --- |
| 4 levels, 0 stirs | *Four levels in silence.* | *he never knew we were there.* |
| 4 levels, stirs | *Four levels.* | *he stirred N times and slept on.* |
| Cap reached | *N levels before the clock.* | *he slept through the rest.* |
| Left | *We'll finish this one another time.* | *N levels so far.* |

`result(s)`: `{ kind: 'coop', winners: allSeats, scores: allSeats.map(() => levelsCleared), summary }`.

#### State

```ts
type Phase = 'ready' | 'play' | 'over';

interface SniffProposal { by: Seat; at: number; agreed: Seat[] }

interface HushHushState {
  rulesVersion: 1;
  seats: number;
  phase: Phase; deadlineAt: number;                // ready deadline; in play: the quiet clock
  startedAt: number; capAt: number;                // session cap
  level: 1 | 2 | 3 | 4; levelsCleared: number;
  hands: number[][];                               // per seat, sorted ascending; private
  pile: number[];                                  // played, ascending by rule
  tumbled: number[];                               // public
  stirs: number; stirsThisLevel: number;
  tokens: number; proposal: SniffProposal | null;
  ready: boolean[];
  lastPlayAt: number; lastActionAt: number[];
  pendingGroup: Array<{ seat: Seat; card: number; at: number }>;   // the 300 ms window
  lastEmoteAt: number[];
  ended: null | { reason: 'done' | 'cap' | 'left' };
}
```

#### Actions

```ts
type HushHushAction =
  | { kind: 'ready' }
  | { kind: 'play' }                               // always your lowest card
  | { kind: 'proposeSniff' }
  | { kind: 'agreeSniff' }
  | { kind: 'emote'; emote: EmoteId };
```

#### Validation

- `wrong_phase`; `already_ready`.
- `empty_hand` (nothing to play); `too_fast` (two plays from one seat inside the 300 ms window; the second is dropped as idempotent).
- `no_token`; `proposal_open` (a second proposal while one is live); `no_proposal`; `already_agreed`; `own_proposal` (the proposer is counted as agreeing).
- `emote_too_soon`; `ended`.

#### Resolution of a play

`apply` appends `{ seat, card, at: now }` to `pendingGroup` and sets a 300 ms resolve. The server resolves the group (through `onTimeout` on a virtual timer, or on the first action after 300 ms) by sorting the group's cards ascending and judging them in order: each card is correct if it exceeds every card still held by anyone after removing the group's cards from their hands; otherwise it stirs and the lower held cards tumble. Two cards in one group can both be correct even if they arrived "backwards".

#### Timeouts

- **Ready deadline:** missing seats auto-ready; phase to `play`, `lastPlayAt = now`.
- **Quiet 12 s** (`deadlineAt`): emit `snore`; next deadline at 25 s.
- **Quiet 25 s:** the lowest held card is played by the server (`rolledIn`), correct by construction; `lastPlayAt = now`.
- **Sniff proposal 4 s:** lapses unless every responsive seat agreed.
- **Cap:** remaining cards roll in ascending; `ended = { reason: 'cap' }`.
- Async pace is not offered.

#### What `view(s, seat)` shows

- Everyone: `phase`, `deadlineAt`, `level`, `levelsCleared`, `pile` top and count, `tumbled`, `stirs`, `tokens`, `proposal` (who proposed, who has agreed), `ready`, per-seat **card counts** (never values), the session clock, `hungerer: 'snoring' | 'stirring'`.
- Only this seat: `myHand` (values), `myLowest`.
- Never: another seat's values, the deck order.

#### The practice partner (never peeks)

The bot holds a hand and sees the pile top; nothing else. It plays its lowest card after `delay = clamp((lowest - pileTop) * 450 ms, 400 ms, 11 s)` plus up to 300 ms of jitter, restarting the timer whenever the pile changes (The Mind's own heuristic: the gap is the wait). It agrees to a sniff when its lowest card is more than 15 above the pile top; it proposes one when its lowest is more than 25 above and a token is held. It taps ready immediately. `dizzy` after a stir that tumbled one of its cards; `party` on a clean level.

#### Events to animate

`ready {seat}` (a paw print lands) · `levelStart {level, cardsEach}` (cards deal face-down to the other pigs, face-up to you) · `played {seat, card}` (the card arcs onto the pile; the player's pig does a small `wave`) · `group {cards}` (two cards arrive together and settle sorted) · `stir {card, tumbled}` (his face to `stirring`, the lower cards flip and tumble to the pile's edge; nobody's pig reacts, the mound shakes) · `snore` (a `zzz` wisp, the prompt) · `rolledIn {card}` (a truffle rolls in along a mud trail; no pig moves) · `sniffProposed {seat}` / `sniffAgreed {seat}` / `sniffed {cards}` / `sniffLapsed` · `levelClear {clean}` (`party` or `happy`) · `cap` · `emote`.

#### Tuning

| Knob | Value |
| --- | --- |
| Deck · levels · cards per pig | 1 to 50 · 4 · = level |
| Unordered window | 300 ms |
| Ready beat · snore prompt · auto-roll | 5 s · 12 s · 25 s |
| Sniff tokens | 1 at start, +1 after level 2, max 2 |
| Sniff agree window · responsive threshold | 4 s · acted within 20 s |
| Session cap | 150 s |
| Bot delay per pip · floor · ceiling | 450 ms · 400 ms · 11 s |

Sanity (sim to confirm before build): at 450 ms per pip a gap of 20 waits 9 seconds, under the 12-second prompt and the 25-second roll; four pigs at level 4 hold 16 of 50 cards, an average gap near 3, so a clean level 4 is possible but demands the shared breath the game is about.

#### Edge cases

- **Two pigs hold adjacent numbers and play "backwards" inside 300 ms:** the group sorts; both correct; no stir.
- **A play arrives 320 ms after a lower card's play, and the lower card was correct:** the later card is judged alone; correct if nothing lower is held.
- **A stir tumbles a card that was about to be played** (in flight): the in-flight play finds an empty slot and is dropped as idempotent (`empty_hand` is not shown; the client already saw the card tumble).
- **A pig leaves with cards in hand:** its cards roll in on the quiet timer (25 s each) or at the cap; the game never stalls on it.
- **Sniff proposed while a group is pending:** the group resolves first, then the proposal opens.
- **Reconnect:** the view carries the hand and the pile; a replayed `play` is `too_fast` or `empty_hand` as appropriate and treated as success.
- **Reduce Motion:** cards slide without the arc, the stir is a one-frame face change, the tumble is a fade.

#### Layout (390 pt portrait, 3 seats shown)

```
+----------------------------------------------+
| < leave            HUSH HUSH . level 2 of 4  |
|                                              |
|      [Pip]  3 cards        [Clover] 2 cards  |  other pigs at 72pt, face turned in,
|                                              |  card-count pips under each (no values)
|              (the Hungerer, snoring)         |  96pt painted state
|              +--------+                      |
|              |  truffle|  pile: 4            |  top card 120pt, hand numeral
|              |   17    |  ~ 9 ~ 12 ~         |  tumbled cards small beside it
|              +--------+                      |
|   he stirred once                [sniff x1]  |  stirs line (left) + token (right)
+----------------------------------------------+
|                                              |
|   your truffles                              |
|       +------+ +------+                      |  your hand, fanned, 96pt cards
|       |  23  | |  41  |                      |  the lowest is lifted and lit
|       +------+ +------+                      |
|                                              |
|  [        LAY THE 23        ]      1:02 left |  one gold button; session clock
|  [heart] [sparkles] [zzz]                     |  3 emotes shown, 3 behind a long press
+----------------------------------------------+
```

A sniff proposal replaces the button row with *Pip asks for a sniff · [agree]* for four seconds; on pass, everyone's lowest card flips face-up on the pile's edge.

#### New glyphs

- `truffle_card`: a cream paper playing card with a soft hand-cut edge, a single dark muddy truffle painted in its lower half, and clean cream space above for a numeral.
- `sniff_token`: a round pink pig snout seen straight on, two dark nostrils, a thin curl of grey scent rising from it.
- `truffle_pile`: a small heap of five muddy truffles on a patch of brown soil, the top one catching light.

Reused: `assets/images/hunger/great_hungerer_{snoring,stirring}.png`; `glyphs/zzz.png` for the snore; emotes; `PigStage` `face`, `wave`, `jump`, `happy`.

---

## 5. Recommendation

**Ship Snout Says first, start Two Noses' four glyphs the same week, and run Hush Hush through a latency sim before committing to it.**

Snout Says is the right first game for the population we actually have. It seats two to four, it plays live or by push, and a random queue of tens of daily players fills it where a two-seat live game would mostly offer Practice Pig. It needs no new art because the finds and dig things the player already collects *are* the pieces, which is Collect speaking for itself. It is the purest proof of the brief's hard problem: with a stranger, no chat, the whole conversation is one picture, and a sloppy partner only ever makes the guess harder, never the session worse. It exercises the entire spine (seats, beats, per-seat views that hide the target from one seat and the picks from the others, timeout defaults, a result sheet, the async push path) with the least surface, and every later game inherits that spine.

Two Noses is the better game and the one the app will be known for, because it is the dig the player already knows made into two pigs sniffing across one patch. It is second only because it needs four glyphs, a mirrored board, simultaneous beats and a sim pass on the loudness table, and because a two-seat live-only game is the one most exposed to the queue being empty tonight. Build it as the second game, on the spine Snout Says proved, and treat the 4-second beats as the one number to playtest first.

Hush Hush is the honest third: it is the sync game the brief asked for, it scales to four, and the Hungerer makes it ours. Its risk is not design but physics: the 300 ms unordered window and the 25-second auto-roll have to be felt on two phones at 300 ms before anyone paints a truffle card.

What not to build from this list: Hush Now (the only candidate that is blame by construction) and Tickle Together (shallow after a minute). Dress Me and Slop Kitchen wait on art budgets and a loaner-cosmetics system that do not exist yet; Pass the Patch and Hand Me Down are the async second wave once the dig reducer has been lifted into a pure module and three-seat queues are seen to fill.
