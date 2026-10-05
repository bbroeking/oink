# Classic board and parlor games as light multiplayer

Exploration 01 · 2026-10-04 · design only, nothing here is built. Companion to the 2026-10-01 matchmade-play set (`docs/explorations/2026-10-01-matchmade-play/`), which supplies the queue, ready check, reconnect grace, forfeit table and the optional Elo ladder. This document does not repeat that spine; it asks which public-domain games are worth running on it.

Standing assumptions, stated once:

- **Head-to-head is allowed for this feature.** The charter's Contend pillar names the Sounder as the competitive unit and the lens once killed the 1-v-1 duel; the founder asked on 2026-10-02 and again today for multiplayer with random matchmaking and friend invites, including head-to-head. Every design below therefore treats a match as a *temporary* table of two to four pigs and keeps the charter's other clause intact: **losing still feels warm**. When one of these ships, the ruling belongs in `SKILL.md`'s decision log.
- **The economy is never touched.** No stakes, no tickles, snouts, truffles or Finds minted, no Happiness or Streak effect, membership changes nothing. A match ends on a result screen, nothing else.
- **The population is tens of daily players.** Live random matchmaking will often find nobody, so every candidate is judged first on whether it survives **async play-by-push** (turn deadlines of hours, a "your turn" push), and only second on how it feels live.
- **One pure TS rules module per game**, `GameDefinition<S, A, V>` as given in the brief, served by the authoritative Node/WebSocket server on Render; dice and shuffles live in the server's seeded `Rng`; `view` strips hidden information per seat; `onTimeout` is a deterministic default move, never a coin flip.

## 1. What makes a classic adapt well here

The games that survive this brief share six properties, and the ranking below is mostly a count of how many each one has.

1. **One sentence of rules, and the board teaches the rest.** "Draw a fence; close a pen and it is yours." "Roll for truffles; a one and he eats them." A stranger has no tutorial partner and no chat, so the rules must be legible from the first screenshot. This kills Nine Men's Morris (three phases) and Liar's Dice (bid grammar plus wilds) before anything else does.
2. **One tap is one turn, and every tap is a real decision.** A turn that is a single board tap survives a 300 ms stall, a reconnect, an eight-hour wait and a deterministic timeout default. But the tap must *matter*: a forced or obvious move every turn is a slideshow, not a game (Nim once you know the trick; the last six moves of a four-in-a-row).
3. **Few hand-offs.** Async play dies by hand-off count, not by rule complexity. A game that changes hands eight times finishes in a day at eight-hour deadlines; one that changes hands thirty times takes a week. The dice game Pig wins here because a *whole turn* (roll, roll, roll, hold) is one sitting; so does any game whose turn is a self-contained bundle.
4. **Scoring counts what you gathered, not what you destroyed.** Dots and Boxes, Mancala, Memory and the hidden-grid hunt all end with "you kept N"; checkers, Morris and Reversi end with "you lost pieces" or "you were flipped". The first kind lets a loser read a number they are proud of. The result screen for every candidate reads *what each pig gathered*, never *Defeat*, and a tie is a shared win.
5. **Some luck, or a very gentle skill curve.** A pure-skill game between a stranger who knows the trick and one who does not is cold by construction. Dice or hidden placement let the newer pig win a fair share and make the better pig's wins feel earned rather than inevitable. Pure-skill candidates are still worth shipping where the skill curve is shallow and legible (Dots and Boxes), and they are the natural home for the ladder if the ladder ships.
6. **Two to four seats, and the pig is the piece.** A four-seat table lets a random stranger, an invited friend and you sit together, which is the Connect version of head-to-head. Where a game is strictly two-seat (Mancala, Hex, Reversi, the hunt), it says so and takes the hit. The players' marks on every board are their own equipped pigs from `PigStage`, so what you collect shows up at the table.

Two more constraints shape every pick: **about eight new glyphs per game** (the twelve Finds, the dig marks, the truffle, the bag, the barn and the Hungerer's face already exist in `assets/images/glyphs/` and are reused wherever a token is needed), and **no trademarked names** (public-domain mechanics only, named in TTP's voice).

### The shared table

Everything here sits on one shell so each game is only a rules module and a board component:

- **Entry**: the `Play together` door on Friends from the prior exploration, then *Find a pig* (random queue), *Invite a friend* (link plus push, the one addition to the earlier scope) or *Practice* (local bot, plainly labelled). The queue carries `gameId` and `pace`; a player who finds nobody live within about twelve seconds is offered the same game async ("start it now, they'll play when they wake") or practice.
- **Async** matches are ordinary matches whose deadlines are hours; the server sends one "your turn" push per hand-off and one "the game is done" push. A player may hold up to three open async games.
- **At the table**: the seated pigs stand on one ground line at the top of the screen wearing their cosmetics; the active pig steps forward (`walk` one step, then `idle`); reactions use the existing families (`bounce` for a good roll, `sad` for a bust, `happy` for a kept pen, `surprise` when someone else does something dramatic, `tired` on a long wait). Board below, controls in the thumb zone, 44 pt targets.
- **Emotes**: six preset stickers, all existing glyphs (`heart`, `party`, `sparkles`, `dizzy`, `zzz`, `handshake`), 5 s cooldown, rendered as a speech bubble over the sender's pig. No text.
- **Result**: one sticker per pig with what it gathered, winners wear `party`, nobody wears a zero (a pig that gathered nothing shows its pig and its name only), draws say *shared*. Ended-early matches say *the game ended early* with no blame line.
- **Timeouts** follow one table (details per game below): live, a missed decision plays the game's deterministic default; async, a missed deadline plays the default and counts a miss; two consecutive misses resign the seat ("trotted off"). In a two-seat game a resignation ends it; in a three- or four-seat game the seat is skipped and its pens, barn or finds stay on the board.

## 2. Candidates

Each block: TTP name · source · one sentence · seats · pace · length · luck vs skill · hidden info · why it is fun with a stranger · pillar · warm loss? · new art · feasibility (1 to 5 on this stack) · main risk.

### 2.1 Fence the Pen

- **Source**: Dots and Boxes (Lucas, 1889; public domain).
- **One sentence**: *Draw a fence; close a pen and the truffle inside is yours, then draw again.*
- **Seats**: 2 to 4. **Pace**: live and async. **Length**: 4×4 pens (40 fences) ≈ 3 to 4 min live, 13 to 15 hand-offs each at two seats; the 3×3 async board (24 fences) ≈ 8 to 9 hand-offs each.
- **Luck vs skill**: no luck. Skill is shallow for the first ten games (do not draw the third side of a pen) and then deep (chain counting), which is exactly the slope a casual ladder wants.
- **Hidden info**: none.
- **With a stranger**: the moment of "if I draw here I hand you three pens" is legible to both pigs at once, and the gift of a long chain is a small drama every game has.
- **Pillar**: Contend (the ladder's natural game), Connect (a four-seat pen board with a friend and a stranger).
- **Warm loss?**: yes. Scoring is pens you filled; a 9 to 7 loss reads as "I kept seven". The extra-move rule gives the trailing pig late bursts.
- **New art**: 3 (fence rail, fence post, a filled pen with the truffle).
- **Feasibility**: 5. Forty integers of state, one action type, deterministic default move is trivial.
- **Main risk**: against an experienced player the chain parity decides the game before the end and the loss can feel pre-written. Mitigation: the 3×3 board for async and strangers' first games, plus the ladder matching by rating once there is a population.

### 2.2 Rootle

- **Source**: the dice game Pig (described by Scarne, 1945; public domain; no pig-shaped dice, no trademark).
- **One sentence**: *Roll for truffles as long as you dare; roll the Hungerer and he eats this turn's basket.*
- **Seats**: 2 to 4. **Pace**: live and async (the whole turn is one sitting, so async needs only about six to eight hand-offs per pig). **Length**: to 50 truffles ≈ 2 to 3 min live at two seats, 4 to 5 min at four.
- **Luck vs skill**: mostly luck, with a real decision on every roll (hold threshold, racing the leader, the last-round rule) and a legible optimal line a player discovers in a week.
- **Hidden info**: none (the server's die is the only secret).
- **With a stranger**: watching another pig push its luck is the whole game; a bust is the funniest thing that can happen to either of you, and the dice did it, not the stranger.
- **Pillar**: Contend (a race anyone can win), Connect (a four-seat table is a party; emotes land exactly on busts and holds).
- **Warm loss?**: by construction. Everything you trotted home with stays in your barn count; the die took the rest.
- **New art**: 6 (one die-face sheet; the one is the Hungerer's face, which already exists as `ogre`). Basket and barn reuse `dig/bag` and `barn`.
- **Feasibility**: 5. The smallest state of any candidate.
- **Main risk**: thin for a long-term rating (luck dominates), and a passive wait while another pig rolls (mitigated live by 10 s decision deadlines and the spectacle; irrelevant async).

### 2.3 Sniff Out

- **Source**: the hidden-grid search game family ("hunt the hidden thing" with warm/cold clues; public domain). Deliberately not the ships-and-salvos game: single-tile targets and a proximity clue.
- **One sentence**: *Hide three truffles in your patch; take turns sniffing the other pig's patch, warm means one is next door.*
- **Seats**: 2 (a 3 to 4 seat "sniff any patch" variant is possible later). **Pace**: live and async. **Length**: ≈ 8 to 10 sniffs each ≈ 2 to 3 min live; 16 to 20 hand-offs async (slow but each is one tap).
- **Luck vs skill**: half and half. Hiding is a choice (corners leak fewer warm tiles, clusters muddy the clue), sniffing is deduction from warm/cold.
- **Hidden info**: yes, the showcase for `view`: your own truffles and the other pig's sniff results on you; never their undug truffles.
- **With a stranger**: you each hold a secret, and every turn is a tiny mystery solved in public; the stranger's sniffs on your patch are a second show.
- **Pillar**: Contend, Collect (you dig truffles up).
- **Warm loss?**: yes. The result is truffles dug: 3 to 2 reads as close, and the equal-turns rule means nobody loses to the coin of who went first.
- **New art**: 3 (a covered mud tile, a warm steam puff, a dug hole). The truffle, a pebble for cold, and the nose reuse existing glyphs.
- **Feasibility**: 5. Sixteen tiles a side; the bot's constraint solver is 560 placements.
- **Main risk**: a clumsy hide (three truffles in one corner) can make a game very short; and the two-seat limit.

### 2.4 Sow the Troughs

- **Source**: Mancala / Kalah (6 pits, 4 seeds; public domain).
- **One sentence**: *Scoop a trough and sow the acorns one per trough; land in your barn and go again, land on empty and capture across.*
- **Seats**: 2. **Pace**: live and async. **Length**: 25 to 40 moves total ≈ 5 min live; 13 to 20 hand-offs each async.
- **Luck vs skill**: pure skill, medium curve; the extra-turn and capture rules are tactile and discoverable.
- **Hidden info**: none.
- **With a stranger**: sowing is a satisfying animation to watch and the capture sting is immediate and readable; comebacks are common.
- **Pillar**: Collect first (you are literally gathering acorns into your barn), then Contend.
- **Warm loss?**: yes. The score is acorns in your barn, 25 to 23 is a good game, and nothing you stored is ever taken.
- **New art**: 2 (a trough pit, a barn-store basket); the acorn exists.
- **Feasibility**: 4. Rules are small but the three clauses (go again, capture, end sweep) are each a bug farm, and 48 moving acorns want a staged animation.
- **Main risk**: three clauses is on the edge of "explain twice", it is strictly two-seat, and Kalah(6,4) is a known first-player win with perfect play (irrelevant at casual level; alternate the opener in rematches).

### 2.5 Pairs in the Hay

- **Source**: Memory / Concentration (public domain).
- **One sentence**: *Turn over two straws; a matching pair of Finds is yours, and you go again.*
- **Seats**: 2 to 4. **Pace**: live only (across hours memory becomes note-taking and the game stops being one). **Length**: 4×4 (8 pairs) ≈ 2 min at two seats; 4×5 (10 pairs) at three or four.
- **Luck vs skill**: luck early, memory late; a child can beat an adult, which is the right temperature for strangers.
- **Hidden info**: yes, for everyone equally: the face-down cards; `view` reveals only the flip history.
- **With a stranger**: every flip the other pig makes is information you get for free; "you just showed me the key" is the game's recurring joke.
- **Pillar**: Collect (the cards *are* the twelve Finds), Connect (a four-seat party game), Contend.
- **Warm loss?**: yes. "You found three pairs" is the result; nothing is lost.
- **New art**: 1 (a straw card back). All faces are the existing Find glyphs.
- **Feasibility**: 5. The bot needs an explicit forgetting rule so it never plays with a perfect memory.
- **Main risk**: live only, and in a population of tens that is a real cost; and four pigs plus twenty cards on a 390 pt screen is tight.

### 2.6 Truffle Tally

- **Source**: Yacht-style dice categories (Yacht, public domain since the 1930s; not the trademarked successors).
- **One sentence**: *Roll five dice up to three times and write the result into one empty row of your tally; fullest tally after eight rounds wins.*
- **Seats**: 2 to 4. **Pace**: async-perfect (every seat plays its round whenever it likes; `activeSeats` returns everyone who has not finished the current round) and live. **Length**: eight rounds ≈ 4 min live; eight hand-offs async, all simultaneous.
- **Luck vs skill**: high luck, medium skill (which row to spend a roll on, when to chase).
- **Hidden info**: none needed; optionally hide the other tallies until the end for a reveal.
- **With a stranger**: it is parallel solitaire with a shared ending, so it is the weakest "with" of the set; the reveal of the other tally is the social beat.
- **Pillar**: Collect (filling a sheet), Contend.
- **Warm loss?**: yes, "you filled seven of eight rows" and you keep your sheet.
- **New art**: 7 (six die faces, one tally sheet sticker).
- **Feasibility**: 4. The scoring table is trivial; the UI (five dice, keep toggles, eight rows, two to four tallies) is the densest of any candidate.
- **Main risk**: eight rows is already a second explanation, and nothing one pig does changes another pig's decision.

### 2.7 Muddy Patch

- **Source**: Reversi (1883; public domain mechanics; not the trademarked name).
- **One sentence**: *Lay a hoofprint so it flanks the other pig's prints and they turn to yours; most prints at the end wins.*
- **Seats**: 2. **Pace**: live and async. **Length**: the classic 8×8 is 30 hand-offs each (too long async); a 6×6 patch (≈ 16 each) is the proposal.
- **Luck vs skill**: pure skill, steep and opaque (corners and mobility are not visible to a new player).
- **Hidden info**: none.
- **With a stranger**: the big late swings keep a trailing pig hopeful to the last few moves; a 6×6 board swings even harder.
- **Pillar**: Contend.
- **Warm loss?**: middling. The score is squares you hold, but the *feeling* of the game is being flipped, and a pig watching twelve of its prints turn over is not warm.
- **New art**: 2 (a two-sided print tile: mud / clover). Seats are marked by pig face, not colour.
- **Feasibility**: 4. Flip logic is simple; the pass rule and no-legal-move end state need care.
- **Main risk**: the swing that makes it exciting is the same swing that makes losing cold; and it is two-seat.

### 2.8 Drop in the Trough

- **Source**: the gravity drop four-in-a-row game (the mechanic predates the 1974 trademark; we use the public-domain shape and none of the names).
- **One sentence**: *Drop an acorn into one of seven slots; four in a row wins.*
- **Seats**: 2. **Pace**: live and async. **Length**: ≈ 10 to 20 hand-offs each.
- **Luck vs skill**: pure skill, solved (first player wins with perfect play from the centre), with a very fast "oh I see it" curve.
- **Hidden info**: none.
- **With a stranger**: instantly understood by anyone, which is its only argument.
- **Pillar**: Contend.
- **Warm loss?**: no. Binary, nothing gathered, and losses to a seen-too-late diagonal feel like being tricked.
- **New art**: 1 (a slotted trough frame); acorn and pebble tokens exist.
- **Feasibility**: 5.
- **Main risk**: generic, binary and trademark-adjacent; it reads as "a board game app" rather than as TTP.

### 2.9 Hedgerow

- **Source**: Hex (Hein 1942 / Nash; public domain).
- **One sentence**: *Plant a hedge tile each turn; join your two sides of the field before the other pig joins theirs.*
- **Seats**: 2. **Pace**: live and async. **Length**: 7×7 ≈ 20 to 25 hand-offs each.
- **Luck vs skill**: pure skill, deep and elegant; no draws ever (a real virtue for a ladder).
- **Hidden info**: none.
- **With a stranger**: the end is usually a surprise to the loser, which is bad; the game's beauty is for people who already know it.
- **Pillar**: Contend.
- **Warm loss?**: no. Nothing is gathered and the loss arrives as a realisation.
- **New art**: 2 (two hedge tiles).
- **Feasibility**: 4 (hex grid rendering and the union-find win check are easy; the first-move advantage wants the swap rule, which is a second explanation).
- **Main risk**: abstract, long, cold.

### 2.10 Nine Pigs' Morris

- **Source**: Nine Men's Morris (public domain, medieval).
- **One sentence**: it does not have one. Place nine, then slide, then fly; three in a row removes one of theirs.
- **Seats**: 2. **Pace**: live and async. **Length**: 40 to 60 moves.
- **Luck vs skill**: pure skill, deep.
- **Hidden info**: none.
- **With a stranger**: removal of the other pig's pigs is the core verb, which is the opposite of the warmth clause.
- **Pillar**: Contend.
- **Warm loss?**: no. "He took my pigs."
- **New art**: 2.
- **Feasibility**: 3 (three phases and a removal sub-decision).
- **Main risk**: fails the one-sentence test outright. Listed for completeness.

### 2.11 Three Patches

- **Source**: Ultimate tic-tac-toe (public domain, 2000s).
- **One sentence**: *Mark a tile; the tile you pick sends the other pig to the matching patch.*
- **Seats**: 2. **Pace**: live and async. **Length**: 30 to 40 hand-offs each, too long for async.
- **Luck vs skill**: pure skill, medium.
- **Hidden info**: none.
- **With a stranger**: the send rule is a genuine novel decision and a shared "huh" moment.
- **Pillar**: Contend.
- **Warm loss?**: middling; nothing gathered but small patches won are visible.
- **New art**: 1 (a mud mark); pig faces for seats.
- **Feasibility**: 4.
- **Main risk**: the send rule is the second explanation, and the game is long.

### 2.12 Any Feathers?

- **Source**: Go Fish (public domain).
- **One sentence**: *Ask the other pig for a Find; if they have it, it is yours and you ask again, if not, draw from the hedge.*
- **Seats**: 2 to 4. **Pace**: live and async. **Length**: 48-card deck (twelve Finds × 4) ≈ 15 hand-offs each; a 24-card deck (six Finds) halves it.
- **Luck vs skill**: high luck, light memory.
- **Hidden info**: yes, hands; `view` strips the others' hands to counts.
- **With a stranger**: asking a stranger for a feather is a Connect gesture in itself, and the game names the Finds out loud every turn.
- **Pillar**: Collect (sets of Finds), Connect.
- **Warm loss?**: yes, sets you completed.
- **New art**: 1 (a card back); faces are the Finds.
- **Feasibility**: 4 (hand UI for up to twelve cards on a phone is the work).
- **Main risk**: slow, and asking is only interesting with memory, which async erodes.

### Considered and cut

- **Nim and its variants** (Pebble Pile): solved by a one-line trick, so whoever knows it wins every time; zero warmth.
- **Hogwash** (Liar's Dice): bidding grammar plus wilds is two explanations, elimination is cold, and a bluff without chat is a number.
- **Checkers-lite**: capture is the verb and the game is long.
- **Blokus-like tiling**: 21 piece shapes on a 390 pt board is a UI problem before it is a game.
- **Simple trick-taking card games**: hands of eight-plus cards are too dense for the phone, and trump rules are the second explanation.

## 3. Ranked comparison

Score columns are 1 to 5. *Async* is how well a game survives hour-long deadlines (hand-off count and whether a turn is self-contained). *Warm* is whether a loser reads a number they are proud of.

| # | Game | Source | Seats | Pace | Length (live) | Luck/skill | Hidden | Async | Warm | New art | Feas. | Verdict |
|---|------|--------|-------|------|---------------|------------|--------|-------|------|---------|-------|---------|
| 1 | **Rootle** | Pig (dice) | 2 to 4 | live + async | 2 to 5 min | luck 4 / skill 2 | no | 5 (a turn is one sitting) | 5 | 6 | 5 | **Top 3, ship first** |
| 2 | **Fence the Pen** | Dots and Boxes | 2 to 4 | live + async | 3 to 4 min | luck 0 / skill 4 | no | 3 (3×3 board for async) | 4 | 3 | 5 | **Top 3, the ladder game** |
| 3 | **Sniff Out** | hidden-grid hunt | 2 | live + async | 2 to 3 min | luck 3 / skill 3 | yes | 4 | 4 | 3 | 5 | **Top 3, the hidden-info game** |
| 4 | Sow the Troughs | Mancala / Kalah | 2 | live + async | 5 min | luck 0 / skill 3 | no | 3 | 5 | 2 | 4 | strong second wave; best Collect feel |
| 5 | Pairs in the Hay | Memory | 2 to 4 | live only | 2 min | luck 3 / skill 3 | yes (all) | 1 | 5 | 1 | 5 | second wave once live fill exists |
| 6 | Truffle Tally | Yacht-style | 2 to 4 | live + async | 4 min | luck 4 / skill 2 | optional | 5 (simultaneous) | 4 | 7 | 4 | async-perfect but solitary |
| 7 | Any Feathers? | Go Fish | 2 to 4 | live + async | 4 to 6 min | luck 4 / skill 1 | yes | 3 | 4 | 1 | 4 | Connect-flavoured, slow |
| 8 | Muddy Patch | Reversi 6×6 | 2 | live + async | 4 min | luck 0 / skill 4 | no | 3 | 2 | 2 | 4 | exciting, cold |
| 9 | Three Patches | Ultimate TTT | 2 | live + async | 5 min | luck 0 / skill 3 | no | 2 | 3 | 1 | 4 | novel, long, two explanations |
| 10 | Hedgerow | Hex 7×7 | 2 | live + async | 5 min | luck 0 / skill 5 | no | 3 | 1 | 2 | 4 | elegant, abstract, cold |
| 11 | Drop in the Trough | four-in-a-row | 2 | live + async | 3 min | luck 0 / skill 3 | no | 3 | 1 | 1 | 5 | generic and binary |
| 12 | Nine Pigs' Morris | Nine Men's Morris | 2 | live + async | 8 min | luck 0 / skill 5 | no | 2 | 1 | 2 | 3 | fails the one-sentence test |

The top three were chosen to be *different from each other*: a luck race with a party table (Rootle), a pure-skill drawing game with a ladder-shaped curve (Fence the Pen), and a hidden-information duel that exercises `view` (Sniff Out). Together they cover every part of the interface the server will need: multi-decision turns with a live sub-clock, extra-move turns, simultaneous phases, per-seat projection, and three different timeout defaults. Shipping any two of them proves the shell.

## 4. The top three, specified

Conventions shared by all three specs:

- Seats are `0..seats-1`; the server shuffles who sits where, so seat 0 is a random pig. Turn order is seat order.
- `status[seat]` is `'active' | 'left'`. A `left` seat is skipped forever; its board holdings stay. A two-seat game ends the moment one seat leaves.
- `missed[seat]` counts consecutive missed deadlines; it resets to 0 on any accepted action from that seat. The second consecutive miss sets `status = 'left'` (the player "trotted off"). This is the `onTimeout` forfeit path; it is the same live and async, only the deadlines differ.
- Every action union includes `{ type: 'resign' }` and `{ type: 'emote'; id: EmoteId }` where `EmoteId = 'heart' | 'party' | 'sparkles' | 'dizzy' | 'zzz' | 'handshake'`. An emote is accepted from any seated pig at any time (not only the active seat), is rate-limited by the server to one per 5 s per seat, changes no state and emits `{ type: 'emote', seat, id }`.
- `parseAction` accepts only a plain object with a string `type` from the union, integer fields in range, nothing else; anything unexpected returns `null` and the server answers `bad_action` without touching the match.
- **One small extension to the interface**: each definition exports `deadlineMs(s: S, pace: 'live' | 'async'): number` so a game can use a shorter clock inside a multi-decision turn (Rootle) than at a hand-off. Without it, the server uses the pace default (live 20 s, async 24 h).
- `result().summary` is written in TTP's voice and names what each pig gathered; the client never composes a result sentence of its own.

### 4.1 Rootle

*Source: the dice game Pig. One die, one basket, one barn.*

**Rules (as the player reads them)**

1. On your turn, **rootle** (roll the die). A 2 to 6 drops that many truffles in your basket; roll again if you like.
2. Roll the **Hungerer** (the one) and he eats everything in the basket. Your turn is over.
3. **Trot home** any time after your first roll: the basket empties into your barn, and the next pig rootles.
4. When a pig trots home with **50 or more**, every other pig gets **one last turn**. Then the biggest barn wins; equal barns share the win.

That is four lines, and lines 3 and 4 are the only decisions the game has: how greedy to be, and how to race.

**Seats**: 2 to 4, same rules; the target stays 50 at every seat count (a four-pig game is longer and that is the point of sitting four pigs down).

**Tuning**

| Knob | Value | Note |
|------|-------|------|
| `target` | 50 | ≈ 6 to 8 turns per pig; 100 (the classic) doubled the async hand-offs for no gain |
| `faces` | 6 | face 1 is the Hungerer; faces 2 to 6 pay their pips |
| live decision deadline | 10 s | roll or hold |
| live hand-off deadline | 20 s | the first roll of a turn gets a little longer (the player is watching the previous pig's turn end) |
| async hand-off deadline | 12 h | the push says "your turn to rootle" |
| async mid-turn deadline | 60 s | once a pig has rolled, the rest of its turn is one sitting |
| emote cooldown | 5 s | |
| `log` length | last 12 turns | enough for the UI's turn strip and a reconnect |

**State**

```ts
type RootleState = {
  v: 1;
  seats: number;                 // 2..4
  target: number;                // 50
  barn: number[];                // banked truffles per seat
  basket: number;                // this turn's unbanked truffles
  turn: number;                  // active seat
  rolls: number;                 // rolls taken this turn (0 = hand-off not yet acted on)
  lastRound: null | { leader: number; owed: number[] };  // seats still owed a last turn, in order
  status: Array<'active' | 'left'>;
  missed: number[];
  log: Array<{ seat: number; faces: number[]; banked: number | null }>;  // banked null = bust
  over: boolean;
};

type RootleAction =
  | { type: 'roll' }
  | { type: 'hold' }
  | { type: 'resign' }
  | { type: 'emote'; id: EmoteId };

type RootleView = RootleState;   // nothing is hidden; the die is the server's
```

**`setup({ seats, rng })`**: `barn` all 0, `basket 0`, `turn 0` (seats were already shuffled by the server), `rolls 0`, `lastRound null`, `status` all active, `missed` all 0, `log []`. Emits `{ type: 'turn', seat: 0, last: false }`.

**`activeSeats`**: `[s.turn]` unless `over`.

**`apply` and validation**

- `roll` from the active seat only (`not_your_turn` otherwise). `face = 1 + floor(rng() * 6)`.
  - face 1: `basket = 0`, push `{ seat, faces: [...], banked: null }` to the log, events `[{ type: 'roll', seat, face: 1, basket: 0 }, { type: 'bust', seat, lost }]`, then **advance**.
  - face 2 to 6: `basket += face`, `rolls += 1`, event `{ type: 'roll', seat, face, basket }`.
- `hold` from the active seat, only if `rolls >= 1` (`roll_first` otherwise; the UI greys the button the same way). `barn[seat] += basket`; log the turn; event `{ type: 'hold', seat, banked: basket, barn: barn[seat] }`. If `barn[seat] >= target` and `lastRound === null`: `lastRound = { leader: seat, owed: active seats after `seat` in seat order, wrapping, excluding seat }`, event `{ type: 'lastRound', leader: seat }`. Then **advance**.
- `resign`: `status[seat] = 'left'`, event `{ type: 'left', seat }`; if it was the active seat, basket is lost and the game advances; if fewer than two active seats remain, `over = true`.
- **advance**: `basket = 0`, `rolls = 0`. If `lastRound`: shift the next active seat off `owed`; if none remain, `over = true`, event `{ type: 'end' }`. Otherwise the next active seat in order. Event `{ type: 'turn', seat, last: lastRound !== null }`.
- A `left` seat is removed from `owed` when it leaves.

**`onTimeout(s, seat)`**

- `rolls === 0` (the pig never started its turn): the turn passes with nothing banked (an internal pass; it is not a `hold`), `missed[seat] += 1`, event `{ type: 'pass', seat }`; on the second consecutive miss the seat is `left`.
- `rolls >= 1` (mid-turn): play `hold`. This is the gentle default: an absent pig keeps what it rolled. It does not count as a miss (the pig acted this turn).
- Same policy live and async; only `deadlineMs` differs.

**`deadlineMs(s, pace)`**: live: `rolls === 0 ? 20_000 : 10_000`; async: `rolls === 0 ? 12 h : 60_000`.

**`view(s, seat)`**: identity. The only secret in Rootle is the next face, and that is never in the state.

**`result(s)`**: `null` until `over`. Then `winners` = active seats whose `barn` equals the maximum (several = `draw`), `scores = barn`, `kind = winners.length > 1 ? 'draw' : 'win'`. Summary: *"Clover trotted home with 54 · Rosie 47 · Biscuit 31"* (winner first, then seat order; a `left` seat is listed last as "trotted off with 12").

**`bot(v, seat, rng)`** (practice pig; reads only `v`)

```ts
if (v.rolls === 0) return { type: 'roll' };
const need = v.target - v.barn[seat];
if (v.basket >= need) return { type: 'hold' };             // finishes now
if (v.lastRound) {                                          // last turn: must beat the best barn
  const best = Math.max(...v.barn.filter((_, i) => i !== seat && v.status[i] === 'active'));
  return v.barn[seat] + v.basket > best ? { type: 'hold' } : { type: 'roll' };
}
const holdAt = 20 + Math.floor(rng() * 5) - 2;              // 18..22, so it is not a metronome
return v.basket >= holdAt ? { type: 'hold' } : { type: 'roll' };
```

Hold-at-20 is the well-known near-optimal line; the jitter keeps it from being predictable. Nothing to peek at.

**Events the UI animates**

| Event | Animation |
|-------|-----------|
| `turn {seat, last}` | the active pig steps forward (`walk` one beat, then `idle`); if `last`, a small *last turn* tape over its head |
| `roll {seat, face, basket}` | the die tumbles (a 400 ms sticker spin ending on the face), `+N` truffles hop from the die into the basket sticker, the roller plays `bounce` |
| `bust {seat, lost}` | the die lands on the Hungerer's face, the basket does a `dig/boom` splat and empties, the roller plays `sad`, every other pig plays `surprise` |
| `hold {seat, banked, barn}` | the basket slides to the barn sticker under the pig and the barn number counts up, the pig plays `happy` |
| `lastRound {leader}` | the fence rail lights, *everyone gets one last turn* line |
| `pass {seat}` | the pig plays `tired` and steps back |
| `left {seat}` | the pig walks off the ground line; its barn sticker stays, dimmed, captioned *trotted off* |
| `end` | result sheet |

**Edge cases**

- A pig may `hold` on the same turn it reaches 50 after a single roll; the last round starts normally.
- The leader never gets a second last turn; if two pigs both pass 50 in the last round the bigger barn wins, equal barns draw.
- If every other seat has `left`, the remaining pig wins immediately, summary *"the others trotted off"*.
- A reconnecting client re-renders from `view` and the last twelve `log` rows; mid-turn baskets are in state, nothing is lost.
- Two `roll`s racing one deadline: the server applies in arrival order under the match lock; the second is rejected as `stale` if the turn moved.
- `basket` can exceed `need` by a lot on the final roll; that is fine and fun.

**Screen (390 pt portrait)**

```
┌──────────────────────────────────────────┐
│ ‹ leave          ROOTLE        to 50     │  PageHeader crown: kicker + whimsy title
├──────────────────────────────────────────┤
│   [Rosie]    [Clover]   [Biscuit]        │  PigStage ×2..4 on one ground line, ~72pt tall,
│    you        rolling                    │  active pig a step forward; name tags (hand font)
│   ▣ 31        ▣ 44       ▣ 12            │  barn stickers: truffle glyph + count (numeral role)
│ ═════════════ fence rail ════════════════│  lights up during the last round
│                                          │
│                ┌────────┐                │
│                │  die   │  128pt sticker │  tumbles on roll; face 1 = Hungerer (ogre glyph)
│                │  face  │                │
│                └────────┘                │
│         [bag]  basket · 14               │  turn total; splats on a bust
│                                          │
│   last turns:  4 6 3 →13   2 1 →bust     │  the log strip, last 2–3 turns (bodySm)
│                                          │
│   "Clover is rootling…"  /  "Your turn"  │  one status line, hand font
│                                          │
├──────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐│
│ │     ROOTLE       │ │    TROT HOME     ││  two 56pt Buttons, thumb zone; Trot Home
│ └──────────────────┘ └──────────────────┘│  greyed until the first roll; both hidden
│  (heart)(party)(spark)(dizzy)(zzz)(shake)│  when it is not your turn → emote row only
└──────────────────────────────────────────┘
```

**New glyphs (6, one sheet)**

Generate one 3×2 sheet, magenta key, then slice:

1. `die_1` *(the Hungerer)*: a chunky cream wooden die face showing the Great Hungerer's grumpy round face in place of the single pip, painted storybook icon, thick warm brown ink outline, soft cel shade, two tiny gold sparkles, flat #FF00FF background.
2. `die_2`: the same cream wooden die face with two small dark truffles as pips.
3. `die_3`: the same die face with three truffle pips in a diagonal.
4. `die_4`: four truffle pips at the corners.
5. `die_5`: five truffle pips, quincunx.
6. `die_6`: six truffle pips in two columns.

Reused: `dig/bag` (basket), `barn` (barn total), `dig/boom` (bust splat), `receipt/truffle` (barn count pip), the six emote glyphs.

### 4.2 Fence the Pen

*Source: Dots and Boxes. Posts, rails, pens, and a truffle in every pen.*

**Rules (as the player reads them)**

1. On your turn, **draw one fence** between two posts.
2. If your fence **closes a pen**, the truffle inside is yours, and you **draw again**.
3. When every fence is drawn, the pig with the most pens wins. Equal pens share the win.

**Boards and seats**

| Pace / seats | Pens | Posts | Fences | Hand-offs (approx.) |
|--------------|------|-------|--------|---------------------|
| live, 2 seats | 4×4 | 5×5 | 40 | 13 to 15 each |
| live, 3 or 4 seats | 4×4 | 5×5 | 40 | 7 to 10 each |
| async, any seats | 3×3 | 4×4 | 24 | 8 to 9 each at 2 seats |

Nine pens at two seats cannot tie; sixteen can (8 to 8 = shared win). At three or four seats a tie among the top pens is a shared win. The board size is a `setup` argument derived from `pace`; the rules do not change.

**Tuning**

| Knob | Value |
|------|-------|
| live decision deadline | 20 s (the same after an extra move) |
| async deadline | 24 h per hand-off; an extra move after a closed pen gets a fresh 24 h but the push is not re-sent (the pig is already in the app) |
| emote cooldown | 5 s |

**Edge indexing** (the one piece of arithmetic client and server must share; it lives in the rules module and nowhere else). For a `rows × cols` pen grid:

- horizontal fences `h(r, c)`, `r ∈ 0..rows`, `c ∈ 0..cols-1`, index `r * cols + c`; there are `H = (rows + 1) * cols` of them;
- vertical fences `v(r, c)`, `r ∈ 0..rows-1`, `c ∈ 0..cols`, index `H + r * (cols + 1) + c`;
- pen `(r, c)` has sides `h(r, c)`, `h(r + 1, c)`, `v(r, c)`, `v(r, c + 1)` and index `r * cols + c`.

4×4 pens: 20 horizontal + 20 vertical = 40 fences, 16 pens. 3×3: 12 + 12 = 24 fences, 9 pens.

**State**

```ts
type FenceState = {
  v: 1;
  rows: number; cols: number;    // pens
  seats: number;
  edges: number[];               // length H + rows*(cols+1); 0 = open, else seat + 1 (who drew it)
  pens: number[];                // length rows*cols; -1 = open, else owning seat
  scores: number[];              // pens per seat (derived, kept for the UI)
  fencesLeft: number;
  turn: number;
  status: Array<'active' | 'left'>;
  missed: number[];
  last: null | { seat: number; edge: number; closed: number[] };  // for the reconnecting client
  over: boolean;
};

type FenceAction =
  | { type: 'fence'; edge: number }
  | { type: 'resign' }
  | { type: 'emote'; id: EmoteId };

type FenceView = FenceState;     // nothing hidden
```

**`setup({ seats, pace })`**: `rows = cols = pace === 'async' ? 3 : 4`; edges all 0; pens all -1; `turn 0`; `fencesLeft = edges.length`. No `rng` is consumed (seat shuffle happened in the lobby).

**`activeSeats`**: `[s.turn]` unless `over`.

**`apply` and validation**

- `fence` from the active seat only; `edge` must be an integer in `[0, edges.length)` and `edges[edge] === 0` (`taken` otherwise); game not `over`.
- Set `edges[edge] = seat + 1`, `fencesLeft -= 1`. Compute `closed` = the one or two pens touching this edge that now have four drawn sides. For each: `pens[p] = seat`, `scores[seat] += 1`.
- Events: `{ type: 'fence', seat, edge }`, then one `{ type: 'pen', seat, pen }` per closed pen.
- If `fencesLeft === 0`: `over = true`, `{ type: 'end' }`.
- Else if `closed.length > 0`: the same seat moves again, `{ type: 'again', seat }`. (Classic rule: the extra move is mandatory, which keeps the one sentence true. There is no "decline".)
- Else: `turn` = next active seat, `{ type: 'turn', seat }`.
- `resign`: `status[seat] = 'left'`, `{ type: 'left', seat }`; owned pens stay owned; if it was the active seat the turn advances; fewer than two active seats → `over`.

**`onTimeout(s, seat)`**: play the **deterministic default fence**, then `missed[seat] += 1` (second consecutive miss → `left`). The default fence is the lowest-index open edge that **does not give a pen away** (does not make any touching pen three-sided), or, if none exists, the lowest-index open edge that closes a pen (take what is free), or, failing both, the lowest-index open edge. If the default fence closes a pen the seat moves again; the server re-runs the default immediately (no new deadline) until the default fence closes nothing. Deterministic, legal, and never a forfeit on a single miss.

**`deadlineMs(s, pace)`**: `pace === 'live' ? 20_000 : 24 h`.

**`view(s, seat)`**: identity.

**`result(s)`**: `null` until `over`. `winners` = active (or all, if everyone left) seats with the maximum `scores`; `kind` by winner count; `scores = pens per seat`. Summary: *"Rosie kept 9 pens · Clover 7"*; a `left` seat is listed last as *"trotted off with 3"*.

**`bot(v, seat, rng)`** (practice pig; one-ply, never peeks because there is nothing to peek)

1. If any open edge closes a pen, draw the one that closes the most (two beats one); ties by lowest index.
2. Else collect the **safe** edges (those that make no pen three-sided). If any, pick one at random with `rng`.
3. Else every move gives something away. For each open edge count how many pens the next pig could take in a row by following the chain it opens (walk from the three-sided pen through its one open side into the neighbour, repeating while that neighbour would also become three-sided). Draw the edge with the smallest count; ties by `rng`.

Step 3 is the whole of "beginner chain sense" and makes the practice pig lose to a player who learns to count chains, which is the lesson the game teaches. No double-cross tactics in v1; a `strength` knob can skip step 3 (play a random giveaway) for an easier pig.

**Events the UI animates**

| Event | Animation |
|-------|-----------|
| `turn {seat}` | the active pig steps forward; the posts it could draw between glow faintly |
| `fence {seat, edge}` | a rail sticker slides in from the pig's side of the board (200 ms), tinted with that seat's rail colour token |
| `pen {seat, pen}` | the pen's mud fills, a truffle pops up in it (`bounce` on the truffle), the pig's tiny face stamps the corner, the pig plays `happy`; the score sticker under the pig counts up |
| `again {seat}` | a *draw again* tape flashes over the pig; no step-back |
| `left {seat}` | pig walks off; its pens keep its stamp, dimmed |
| `end` | result sheet |

Rails are tinted per seat for at-a-glance reading, but **ownership is always also a pig-face stamp** in the pen and a pig portrait beside the score, so the board survives colour-blindness without hue.

**Edge cases**

- A single fence may close two pens (the shared middle rail); both go to the mover, two `pen` events, one `again`.
- The last fence of the game always closes at least one pen; `end` fires and `again` does not.
- A fence that closes a pen when the only other open edges also close pens: the mover keeps drawing; the client queues the `again` beats so a four-pen sweep reads as four pops, not one.
- A `left` seat's turn is skipped; in a 3- or 4-seat game the board plays out among the rest. If the game ends with one active seat it wins; *"the others trotted off"*.
- Async at 3×3 with four seats is only six fences each; allowed, and short on purpose.
- Two `fence` actions racing a deadline: arrival order under the match lock; the loser gets `taken` or `not_your_turn`.

**Screen (390 pt portrait, 4×4 board)**

```
┌──────────────────────────────────────────┐
│ ‹ leave        FENCE THE PEN   12 left   │  fences left, numeral role
├──────────────────────────────────────────┤
│  [Rosie] 5    [Clover] 4   [Pip] 2       │  PigStage row, ~64pt; pens kept beside each pig
│    you         drawing                   │  (sticker with truffle glyph + count)
├──────────────────────────────────────────┤
│                                          │
│     o────o────o    o    o                │  5×5 posts on a 310pt square, 77pt pitch;
│     │ ▣  │                               │  drawn rails are stickers tinted per seat,
│     o────o    o────o────o                │  open edges are 44pt hit zones (invisible
│          │         │ ▣  │                │  until pressed, then a dashed preview);
│     o    o    o────o────o                │  ▣ = a closed pen: mud fill + truffle +
│                                          │  the owner's pig-face stamp in the corner
│     o    o────o    o    o                │
│                    │                     │
│     o    o    o    o    o                │
│                                          │
├──────────────────────────────────────────┤
│   tap a gap to preview · tap again to    │  one hand-font hint line (first 3 games only)
│   draw                                   │
│  (heart)(party)(spark)(dizzy)(zzz)(shake)│  emote row, 44pt
└──────────────────────────────────────────┘
```

Two-tap placement (preview, confirm) is deliberate: a 77 pt pitch means the gaps are easy to hit, but a misdraw in this game gives away a pen and there is no undo. The confirm is the same gap tapped again; tapping elsewhere moves the preview. Live, the preview does not stop the 20 s clock.

**New glyphs (3)**

1. `fence_rail`: a short horizontal weathered wooden fence rail, two planks with visible grain and a knot, painted storybook icon, thick warm brown ink outline, soft cel shade, two tiny gold sparkles, flat #FF00FF background, drawn to be tinted (neutral pale wood).
2. `fence_post`: a stubby round-topped wooden fence post seen head-on, same style.
3. `pen_truffle`: a square patch of dark mud with a plump truffle sitting in the middle and a few grass tufts at the edge, same style.

Reused: `pigface` and the seated pigs' own portraits for ownership stamps, `receipt/truffle` for score pips, the emote glyphs. The vertical rail is `fence_rail` rotated 90° at render time.

### 4.3 Sniff Out

*Source: the hidden-grid hunt with warm/cold clues. Two patches, three truffles each, one nose.*

**Rules (as the player reads them)**

1. **Hide three truffles** in your patch (any three squares).
2. Take turns **sniffing one square** of the other pig's patch. Dig up a truffle and it is yours. Otherwise the square says **warm** (a truffle is next door) or **cold**.
3. The first pig to dig up all three of the other's truffles wins. If you went first, the other pig gets one sniff to catch up; three each is a shared win.

**Seats**: 2 in v1. (A 3- or 4-seat variant, "sniff any pig's patch, most truffles dug when the patches are empty", is a clean extension of the same state and is noted, not designed.)

**Tuning**

| Knob | Value | Note |
|------|-------|------|
| patch | 4×4 | 16 squares; a 5×5 patch makes games 50 % longer for little gain |
| truffles | 3 | any three distinct squares; adjacency allowed (it muddies the clue, which is a legitimate hiding tactic) |
| warm radius | 1, eight neighbours | a square is **warm** if at least one *undug* truffle lies in its 3×3 neighbourhood |
| hide deadline | live 30 s · async 24 h | timeout hides for the pig with `rng` |
| sniff deadline | live 20 s · async 24 h | timeout plays the default sniff |
| emote cooldown | 5 s | |

Warm counts only **undug** truffles, so the clue decays honestly as truffles come out and a dug-up neighbour never keeps saying warm. Expected length with competent sniffing is 8 to 10 sniffs per pig.

**State**

```ts
type Tile = number;                      // 0..15, row-major

type SniffState = {
  v: 1;
  size: 4;
  truffles: 3;
  phase: 'hide' | 'sniff' | 'over';
  hidden: Array<Tile[] | null>;          // per seat: that seat's OWN truffle squares; null until locked
  autoHid: boolean[];                    // the server hid for this seat on timeout (shown to that seat only)
  sniffs: Array<Array<{ tile: Tile; result: 'truffle' | 'warm' | 'cold' }>>;
                                         // per seat: sniffs that seat MADE on the other patch
  dug: number[];                         // per seat: truffles that seat has dug up
  turn: number;                          // active seat in 'sniff'
  turnsTaken: number[];                  // sniffs made per seat (for the equal-turns rule)
  status: Array<'active' | 'left'>;
  missed: number[];
  over: boolean;
};

type SniffAction =
  | { type: 'hide'; tiles: Tile[] }      // exactly 3 distinct tiles in range
  | { type: 'sniff'; tile: Tile }
  | { type: 'resign' }
  | { type: 'emote'; id: EmoteId };

type SniffView = Omit<SniffState, 'hidden' | 'autoHid'> & {
  me: number;
  myTruffles: Tile[] | null;             // own hidden squares
  locked: boolean[];                     // per seat: has that seat hidden yet (never where)
  autoHid: boolean;                      // only the viewer's own flag
};
```

**`setup({ rng })`**: `phase 'hide'`, `hidden [null, null]`, `sniffs [[], []]`, `dug [0, 0]`, `turn 0`, `turnsTaken [0, 0]`. `rng` is consumed only by timeout hiding, so the match is reproducible from its action log plus the seed.

**`activeSeats`**: in `hide`, every active seat that has not locked (`hidden[seat] === null`), i.e. **simultaneous**; in `sniff`, `[turn]`; in `over`, `[]`.

**`apply` and validation**

- `hide`: phase must be `hide`, the seat must not have locked (`already_hidden`), `tiles` must be exactly three distinct integers in `[0, 16)` (`bad_tiles`). Set `hidden[seat]`, event `{ type: 'hidden', seat }` (no tiles in the event; the client already knows its own). When both are locked: `phase = 'sniff'`, `{ type: 'turn', seat: 0 }`.
- `sniff`: phase `sniff`, active seat only, `tile` an integer in range not already in `sniffs[seat]` (`sniffed`). Let `them = 1 - seat`, `theirs = hidden[them]`, `dugTiles = sniffs[seat].filter(r => r.result === 'truffle').map(r => r.tile)`.
  - `tile ∈ theirs`: result `truffle`, `dug[seat] += 1`, event `{ type: 'dug', seat, tile }`.
  - else `warm` if any tile in `theirs` not in `dugTiles` is within Chebyshev distance 1 of `tile`; else `cold`. Event `{ type: 'sniff', seat, tile, result }`.
  - Push to `sniffs[seat]`, `turnsTaken[seat] += 1`.
  - **End check**: if `dug[seat] === 3`: if `turnsTaken[seat] > turnsTaken[them]` and `dug[them] === 2` the other pig is owed one catch-up sniff: `turn = them`, `{ type: 'turn', seat: them, last: true }`; otherwise `over = true`, `{ type: 'end' }`. If this sniff *was* the catch-up sniff (the other pig already has 3): `over = true` whether it hit or missed. (Only a pig on 2 can catch up to a draw; a pig on 0 or 1 cannot and the game ends at once, which keeps the rule to one line without ever being unfair.)
  - Otherwise `turn = them`, `{ type: 'turn', seat: them, last: false }`.
- `resign`: `status[seat] = 'left'`, `over = true`, `{ type: 'left', seat }`.

**`onTimeout(s, seat)`**

- In `hide`: hide three distinct tiles with `rng`, set `autoHid[seat] = true`, `missed[seat] += 1`. The pig is told *"we hid them for you"* on return; the game proceeds.
- In `sniff`: play the **default sniff**: the lowest-index unsniffed tile adjacent to one of this seat's `warm` results whose neighbourhood still has no dug truffle, else the lowest-index unsniffed tile. `missed[seat] += 1`. Second consecutive miss → `left`, the other pig wins, *"the game ended early"*.
- Same live and async.

**`deadlineMs(s, pace)`**: live: `phase === 'hide' ? 30_000 : 20_000`; async: 24 h.

**`view(s, seat)`**: copy the state, drop `hidden` and `autoHid`, add `me = seat`, `myTruffles = hidden[seat]`, `locked = hidden.map(h => h !== null)`, `autoHid = autoHid[seat]`. The other pig's undug truffles never leave the server; their dug ones are already public through `sniffs[seat]`. This is the test that proves the server's projection path: a client that renders the opponent's truffles has a bug on the server, not a cheat on the phone.

**`result(s)`**: `null` until `over`. If a seat `left`, the other wins. Else `winners` = seats with `dug === 3` (two = draw), `scores = dug`. Summary: *"Rosie sniffed out all 3 · Clover found 2"*; a draw: *"both pigs sniffed out all 3"*.

**`bot(v, seat, rng)`** (practice pig; constraint solver over its own view only)

- In `hide`: pick a random corner, a random edge square not adjacent to it, and one random remaining square (a plausible human hide; corners leak fewer warm squares).
- In `sniff`: enumerate all C(16, 3) = 560 placements of the opponent's truffles; keep those consistent with every result in `v.sniffs[seat]` (a `truffle` tile is in the placement, a `warm` tile has an undug placement truffle within distance 1, a `cold` tile has none, no dug tile is counted). For each unsniffed tile, count consistent placements containing it; sniff the tile with the highest count, ties by `rng`. It never reads anything but its own sniff history, because `view` gives it nothing else; a `strength` knob can add a 25 % chance of a random unsniffed tile for an easier pig.

**Events the UI animates**

| Event | Animation |
|-------|-----------|
| `hidden {seat}` | that pig plays `happy` and a *hidden* tape appears under it; the other pig's patch stays covered |
| `turn {seat, last}` | the sniffing pig steps up to the big patch; if `last`, a *one last sniff* tape |
| `sniff {seat, tile, result: 'warm'}` | the pig's nose dips to the tile, a steam puff rises and stays as a marker, pig plays `surprise` |
| `sniff {seat, tile, result: 'cold'}` | nose dips, a pebble marker drops on the tile, a small shiver (`idle` with a 2° wobble) |
| `dug {seat, tile}` | mud flies (`dig/boom`), a truffle pops out of a hole and hops to the digger's basket, digger plays `bounce`; the owner plays `sad` for one beat, then `idle` |
| `left {seat}` | pig walks off |
| `end` | result sheet; the loser's remaining truffles are revealed on both patches (*so that's where they were*) |

**Edge cases**

- Both pigs hide the same squares: irrelevant, patches are separate.
- A truffle on a corner has three neighbours; a pig that hides all three in one corner cluster has made the game short for itself (one warm square gives most of it away). Legal, and a lesson.
- Opponent resigns during `hide`: `over`, the remaining pig wins, no truffle reveal.
- The catch-up sniff is **never** the leader's: a pig that reaches 3 on its k-th sniff when the other has already had k sniffs ends the game at once.
- The default sniff must be legal even when every warm-adjacent tile is already sniffed; the fallback (lowest unsniffed) guarantees it.
- A reconnecting client re-renders both patches from `view`; the only private thing on screen is its own three squares, which arrive with the view.
- Async: the "your turn" push says *"Clover sniffed your patch · warm"* without saying where (the where is on the board), so a notification never leaks more than the board already shows.

**Screen (390 pt portrait)**

```
┌──────────────────────────────────────────┐
│ ‹ leave          SNIFF OUT               │
├──────────────────────────────────────────┤
│  [Rosie]  ▣▣▢            ▣▢▢  [Clover]   │  two pigs face each other (face / face_sit),
│   you · sniffing          hidden         │  truffles dug as three pips each, filled or empty
├──────────────────────────────────────────┤
│        CLOVER'S PATCH (sniff here)       │  kicker
│   ┌─────┬─────┬─────┬─────┐              │
│   │ ~~  │     │  o  │     │   ~~ warm    │  4×4, 300pt square, 75pt cells (44pt+ targets);
│   ├─────┼─────┼─────┼─────┤   o  cold    │  covered mud tiles; markers stay where sniffed;
│   │     │ [T] │ ~~  │     │   [T] dug    │  a dug tile is an open hole with its truffle gone
│   ├─────┼─────┼─────┼─────┤              │
│   │     │     │     │  o  │              │
│   ├─────┼─────┼─────┼─────┤              │
│   │  o  │     │     │     │              │
│   └─────┴─────┴─────┴─────┘              │
│                                          │
│   YOUR PATCH · what Clover knows         │  kicker
│   ┌───┬───┬───┬───┐                      │  your own 4×4 at 40pt cells: your three
│   │ ✓ │   │   │ o │   ✓ your truffle     │  truffles shown, Clover's warm/cold/dug
│   ├───┼───┼───┼───┤                      │  markers over them (the second show)
│   │   │~~ │ ✓ │   │                      │
│   ├───┼───┼───┼───┤                      │
│   │   │   │   │ ✓ │                      │
│   └───┴───┴───┴───┘                      │
├──────────────────────────────────────────┤
│   "warm at the middle · your sniff"      │  one hand-font status line
│  (heart)(party)(spark)(dizzy)(zzz)(shake)│  emote row
└──────────────────────────────────────────┘
```

In the `hide` phase the big patch is **your own** patch at full size with three empty truffle slots above it; tapping a tile places a truffle, tapping it again lifts it, and a single **Hide them** button (56 pt) locks. On a sniff, a single tap sniffs (there is nothing to give away by a mis-tap except one turn, so no confirm). The small patch flips to the opponent's view of you once sniffing starts.

**New glyphs (3)**

1. `mud_tile`: a square covered mud tile seen from above, dark brown with a few lighter clods and one grass tuft, painted storybook icon, thick warm brown ink outline, soft cel shade, two tiny gold sparkles, flat #FF00FF background.
2. `warm_puff`: a small cream steam puff with three wavy wisps rising from it, same style, drawn to sit on top of `mud_tile`.
3. `dug_hole`: the same square tile with a round hole dug in the middle and a little mud heaped beside it, same style.

Reused: `finds/river_pebble` (cold marker), `receipt/truffle` (dug truffle and the pip row), `dig/boom` (mud fly), `pigface` on the patch headers, the emote glyphs.

### 4.4 Timeout policy, side by side

| | Rootle | Fence the Pen | Sniff Out |
|---|---|---|---|
| live decision | 10 s mid-turn · 20 s at hand-off | 20 s | 20 s sniff · 30 s hide |
| async decision | 12 h at hand-off · 60 s mid-turn | 24 h | 24 h |
| default move | mid-turn: hold · untouched turn: pass (a miss) | lowest safe fence, else lowest free pen, else lowest edge; extra moves re-run at once | lowest warm-adjacent unsniffed tile, else lowest unsniffed; hide: random three |
| second consecutive miss | seat leaves | seat leaves | seat leaves |
| what the others see | *trotted off*, barn kept and dimmed | pens kept and dimmed | *the game ended early* |

## 5. Recommendation

**Ship Rootle first.** Of the three it is the only one whose async game finishes in a handful of hand-offs, because a whole turn is one sitting: at twelve-hour deadlines a two-pig game is done in two or three days even if both pigs are asleep most of the time, and in two minutes if they are both awake. It seats two to four, so a random stranger, an invited friend and a practice pig can share one table, which is the Connect version of head-to-head this feature is for. Losing is warm by construction (the die did it, and the barn is yours), so it is the safest place to put the charter's "losing feels warm" clause under a real test with strangers. Its state is forty bytes, its rules module is an afternoon, and its six new glyphs are one ImageGen sheet. It will not carry a rating ladder on its own, and it does not need to: with a population of tens, the first thing to learn is whether anyone wants to sit down with a stranger at all, and Rootle answers that cheaply.

**Fence the Pen second**, as the game the ladder is for. It is the only candidate with a skill curve that is gentle for ten games and real after that, it needs three glyphs, and it reuses every piece of the shell Rootle builds (turn hand-offs, extra moves, the pig row, the result sheet). The 3×3 async board keeps it honest for play-by-push.

**Sniff Out third**, because it is the one that forces the server's per-seat projection to be right, and the shell should not be declared finished until a hidden-information game has run on it. It is also the candidate most clearly *about* truffles, mud and a nose, which is to say the one that reads most as ours.

Sow the Troughs is the strongest fourth and would be the pick if the founder wants a Collect-first table; Pairs in the Hay waits for live fill to exist.

Three things to settle before building, all founder calls, none of which change the specs above:

1. Whether this feature's head-to-head ruling is logged in `SKILL.md` as an amendment to the Contend pillar (a match is a temporary table, the Sounder stays the standing competitive unit), and in what words.
2. Whether a 4-seat random table should fill with strangers only, or stranger plus invited friend plus practice pig when the queue is thin (the specs assume the latter is allowed in casual, never in rated).
3. Whether the optional rating ladder from the 2026-10-02 spec attaches to Fence the Pen only, or to nothing yet.
