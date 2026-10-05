# 04 · Pig-native originals: ten games that only make sense here

Design exploration, 2026-10-04. Design only: no code, no migrations. Builds on `docs/explorations/2026-10-01-matchmade-play/` (Mud Volley, Tickle Duet, Truffle Trail, Picnic Relay, Pig Pageant, the ranked-matchmaking spec and the demo plan) and on `docs/explorations/2026-06-08-team-pageant-minigame-modes.md`; none of those concepts is repeated here, and the dress-up runway in particular is left to Pig Pageant. Charter frame: `SKILL.md`'s lens, with the founder's standing ask (2026-10-02, repeated 2026-10-04) that multiplayer include head-to-head play with random matchmaking and friend invites. Head-to-head is in for this feature; the Sounder stays the asynchronous crew, a match is a temporary table of two to four pigs, and losing has to stay warm.

## What "pig-native" means here

A reskin is a game whose rules survive removing the pig. Mud Volley is three lanes and a hidden pick; Picnic Relay is recipes; Tickle Duet is a phrase to copy. They are good transport-first concepts, and the pig is the costume. A pig-native game is built from verbs the player has already learned by playing Tickle the Pig, on objects they already own in fiction, so the first screen needs no tutorial and the result screen needs no legend.

- **Verbs the player already knows:** sniff (know, quietly) · rub (take a little) · shove (take a lot, loudly) · tie it off or dig deeper · visit and tickle · bless or curse · wish · swap or just give · send a pig out looking · come home.
- **Objects they already own:** the twelve Finds and their three rarities · stones (inert, "do not count") · the Satchel · the Great Hungerer, asleep at the edge, and his attention · the Ghost Sheep Trader's daily fancy · the Barn and its saved room · the pig's own equipped look.
- **Units and end states that are already words in the game:** a pouch's weight · "he took it" · "tickled out" · "muddy trotters" · "not this one" · "the herd's board".

Three tests for every candidate: (1) can a pig who has dug the Truffle Patch once, or visited one Barn, sit down and play without reading? (2) if you swap the pig for a cat, does the game break? (3) does the loss state have a TTP name that is funny rather than cruel?

House rules every candidate obeys (from the brief): Finds, tickles, snouts and truffles appear as **game pieces only**; a match never moves inventory, currency, Happiness, Streak, or anything membership touches. One pure TypeScript rules module per game runs on the authoritative server and is shared with the phone. Nothing is decided by reflexes. No free text with strangers; the six existing visit emotes (`assets/images/visit-emotes/`: snout_boop · confetti_oink · golden_wave · mud_bath · sleepy_pig · slop_thanks) are the whole vocabulary. The player's own pig, wearing what it wears, is the avatar; `PigStage` draws it (idle, happy, sad, tired, surprise, jump, wave, walk, the `face` and `face_sit` turn).

## The candidates

Card format: built from · the sentence · seats · pace · length · luck vs skill · hidden information · with a stranger / with a friend · pillar · losing · new art · feasibility (5 = cheapest) · main risk.

### 1. Who Woke Him

- **Built from:** the Snout Deep dig (sniff · rub · shove · tie it off), the Great Hungerer's deterministic attention meter and hidden sleep depth, the loose pouch, "he took it".
- **The sentence:** *Take turns at one patch while he sleeps; leave with your pouch before someone's shove wakes him.*
- **Seats:** 2 to 4. **Pace:** live (10 s turns; async possible but slow). **Length:** 2 to 4 minutes.
- **Luck vs skill:** 40/60. His sleep depth is a hidden draw, but every action's loudness is printed, the shared meter is public, your own sniffs are exact, and the two real decisions (shove to secure a half-dug find or rub quietly and risk a poach; stay or leave) are reads of the table.
- **Hidden info:** his sleep depth (server only); the scent numbers under your own nose prints (private); nothing else.
- **Stranger / friend:** with a stranger it is chicken with a sleeping ogre, no words needed; with a friend "you SHOVED, I was two rubs from the acorn" is a text message.
- **Pillar:** Contend (a race you steer, with an edge you can see) and Connect.
- **Losing:** he takes the loose pouches of everyone still at the patch, so a loss is shared and funny; the receipt names what you *found* before he woke, never a zero.
- **New art:** 2 glyphs (nose print, knotted pouch). The Hungerer's four faces, the patch tiles and every find glyph already exist.
- **Feasibility:** 4. The kernel is `applySplash` + the rules-2 meter; the UI is the existing patch board with seats around it.
- **Main risk:** poaching a half-dug tile may read as mean rather than tense; fallback rule (a nose-print claim) is specified in §Top 1.

### 2. Out Looking

- **Built from:** errands ("send a pig to look for one Find"), the four places the Finds come from, the Sounder's "share", the visit's tickle, "muddy trotters".
- **The sentence:** *Each day send your pig to one of four places; alone you take the pile, pigs who meet share and tickle.*
- **Seats:** 2 to 4. **Pace:** async (one decision a day, five days) or live (15 s rounds). **Length:** five pushes, or 2 minutes live.
- **Luck vs skill:** 30/70 in a four-pig table (anti-coordination with public piles and public history); nearer 50/50 with two pigs.
- **Hidden info:** this round's choices until the deadline; the order of each place's deck.
- **Stranger / friend:** strangers: a pure read of greed with no chat needed, and every round ends in a little scene; friends: "I knew you'd go to the Farmhouse" is the whole game.
- **Pillar:** Connect (the game is literally thinking about where another pig will go) and Contend.
- **Losing:** a pig that comes home light still came home; the only bad outcome is a sticker that says muddy trotters, which is the Pen's own warm phrase.
- **New art:** 5 glyphs (River · Hedge · Meadow · Farmhouse place stickers, a muddy-trotters sticker). Finds exist.
- **Feasibility:** 5. No board, no kernel: a simultaneous pick, a deadline and a reveal.
- **Main risk:** with two pigs it collapses toward matching pennies; the two-seat variant uses three places and four rounds, and the Farmhouse's built-in richness keeps the piles asymmetric.

### 3. Sniff Test

- **Built from:** the Satchel, the twelve Finds, stones from the mud, the sniff ("scent is exact; the number never lies"), "muddy trotters".
- **The sentence:** *Hand a pig something from your bag and say what it is; they take your word or give it the sniff test.*
- **Seats:** 3 to 4 (2 is legal, thinner). **Pace:** live (12 s decisions). **Length:** 3 to 5 minutes.
- **Luck vs skill:** 25/75. Hands start identical (three finds, two stones); the game is reading who lies and when.
- **Hidden info:** every hand, every satchel's contents, the tile in transit (only its current holder may peek). Public: troughs, hand and satchel counts, the claim chain.
- **Stranger / friend:** the classic stranger party game shape, with no words beyond a picker of thirteen names; with friends it is a running joke about who always says "tin whistle".
- **Pillar:** Connect (a table of faces reacting) and Collect (the Finds as the vocabulary).
- **Losing:** three stones face-up in your trough ends the game as muddy trotters; everyone's bag is still opened and every find in it is still named.
- **New art:** 2 glyphs (a dig stone tile, a wooden trough tray). The twelve find glyphs and the bag exist.
- **Feasibility:** 4 (rules are small; the pass-along chain and the peek need careful `view` work).
- **Main risk:** needs three live humans; at tens of daily players it fills only at rendezvous hours or by invite. Specified anyway because it is the strongest party design.

### 4. Same Patch

- **Built from:** the real Feeding rule ("members receive the same base layout but dig their own copy"), the full Snout Deep ruleset, hoofprints.
- **The sentence:** *We dig the same patch at different hours; the second snout sees the first one's hoofprints.*
- **Seats:** 2. **Pace:** async (each dig when you have a minute; a match is two boards, first snout alternating). **Length:** two 60-second digs, hours apart.
- **Luck vs skill:** 20/80, by construction: same seed, same finds, same hidden sleep depth for both pigs. The only variance is order, balanced by alternating.
- **Hidden info:** the opponent's scent numbers (private); his sleep depth. The first digger's hoofprints (disturbed tiles, half-dug silhouettes, where they tied or woke) are shown to the second: that is the fiction's "more digging time for later diggers" made literal.
- **Stranger / friend:** strangers: a fair benchmark with a face on it; friends: "you tied at 35? I went deeper" is the Monday text.
- **Pillar:** Contend (fair by construction) and Collect (the receipt is the story).
- **Losing:** you still dug; your tally stands; the comparison says "heavier" and "lighter", never "lost".
- **New art:** 1 glyph (hoofprint mark).
- **Feasibility:** 4 if Who Woke Him's kernel exists (it is the solo kernel with a replay overlay).
- **Main risk:** it is parallel solitaire; the opponent never reacts to you inside a board. Honest as a second async game, not as the first.

### 5. Not This One

- **Built from:** the Wish (a thought bubble over a pig), the Swap ("pays both pigs"), the owner's "Not this one", the twelve Finds in four shelves.
- **The sentence:** *Every pig is wishing for one Find; hand pigs things from the trove and watch how they react until you deliver it.*
- **Seats:** 2 to 4. **Pace:** live (15 s rounds) or async (one give a day). **Length:** six rounds, 2 minutes live.
- **Luck vs skill:** 35/65. Reactions are honest and public (jump = that's it; happy = right shelf; shrug = not this one), so the skill is remembering and racing.
- **Hidden info:** each pig's current wish.
- **Stranger / friend:** strangers: a cozy deduction race, everyone learns from everyone's reactions; friends: it rehearses the real visit loop (the wish bubble, the delivery).
- **Pillar:** Connect (the whole game is guessing what another pig wants) and Collect.
- **Losing:** every pig receives at least one delivery in six rounds by tuning (the wish rerolls on delivery); the loser is simply the pig who delivered fewer.
- **New art:** 4 shelf stickers (shared with Out Looking's places) + a thought-bubble frame.
- **Feasibility:** 5.
- **Main risk:** public reactions make it a race with frequent ties; delivering the same wish in the same round pays both deliverers to keep it warm, which flattens the standings.

### 6. Light Sleeper

- **Built from:** the same dig verbs and meter as Who Woke Him, the herd's board ("only a tied truffle is the herd's"), the Sounder Bonus ("participation can happen in either order").
- **The sentence:** *One patch, one sleeping ogre, one pouch between us: find every truffle and tie off together before he wakes.*
- **Seats:** 2 to 4. **Pace:** live. **Length:** 2 to 3 minutes.
- **Luck vs skill:** 40/60. Sniffs are public in this mode (the herd shares a nose), so the skill is spending loudness well as a group and knowing when any one pig should call the tie.
- **Hidden info:** his sleep depth only.
- **Stranger / friend:** strangers: a wordless co-op where the emotes become "here" and "leave now"; friends: the Feeding's fiction with everyone awake at once.
- **Pillar:** Contend as a herd, Connect.
- **Losing:** a `coop` result with a shared tally; "he took the lot" is one sentence about all of us, no seat is named.
- **New art:** none beyond Who Woke Him's.
- **Feasibility:** 4 (a `kind: 'cooperative'` sibling on the same kernel; any seat's tie ends the board for all).
- **Main risk:** one impatient pig can end everyone's board; mitigated by a two-tap tie (arm, then confirm) and a visible "N want to leave" count rather than a vote.

### 7. Whose Barn

- **Built from:** the saved room friends already see, the equipped look, the wish bubble, the visit.
- **The sentence:** *Four barns, no names: whose is whose?*
- **Seats:** 3 to 4 (friends or crewmates; strangers play the "match the pig to its barn" variant with entry consent stated on the door). **Pace:** async (one round per push) or one two-minute sitting. **Length:** three rounds.
- **Luck vs skill:** 50/50 with three pigs, 35/65 with four; the skill is having visited.
- **Hidden info:** which room and look belong to which seat until the reveal.
- **Stranger / friend:** friends: the game rewards exactly the people who visit each other and nudges the ones who don't; strangers: a taste-matching puzzle (a pig and its room share an owner's eye).
- **Pillar:** Connect first (it sends you back to your friends' barns), Collect (identity is the content).
- **Losing:** scoring pays both guessing right and *being recognised*, so a pig nobody guessed still gets the "add a lamp" nudge, not a zero.
- **New art:** 1 glyph (a question-mark door hanger). Everything else is the players' real assets.
- **Feasibility:** 5 for friends and crew; the stranger variant needs a consent line and the public-snapshot read.
- **Main risk:** shallow by design; it is a daily social quiz, not a game you master. A good third async title, not a first.

### 8. Ticklish Spot

- **Built from:** the visit tap, the tickle bounce, the host/guest facing pigs, the six emotes.
- **The sentence:** *My pig is ticklish somewhere; you have three taps to find it and I can only hint with stickers.*
- **Seats:** 2. **Pace:** live (20 s rounds). **Length:** six rounds, 90 seconds; roles swap every round.
- **Luck vs skill:** 45/55; the skill is building a sticker code with a person in a minute.
- **Hidden info:** the host's ticklish spot (one of five: ear · cheek · chin · belly · trotter), known to the host's owner only.
- **Stranger / friend:** strangers: inventing a shared code from six stickers is the charm; friends: the code persists between matches as an in-joke.
- **Pillar:** Connect; a cooperative `coop` result ("you two found 5 of 6").
- **Losing:** there is no loser; the sixth round's miss just means the pig stays ticklish.
- **New art:** 2 glyphs (five-spot overlay silhouette, a "hic" bubble for a near miss).
- **Feasibility:** 4 (needs tap-region hit boxes on `PigStage` and a near-miss reaction).
- **Main risk:** six stickers is a thin hint vocabulary; the fix is two stickers per hint, or a cold/warm pig reaction for the near miss (which turns it into Mastermind and loses the communication charm).

### 9. Swap Meet

- **Built from:** the Swap, the Options tray ("up to three finds a bag can spare"), the shelves, the Ghost Sheep Trader's fancy.
- **The sentence:** *Post one offer a round, take one offer a round, finish a shelf; the Trader shows up once and buys one thing dear.*
- **Seats:** 2 to 4. **Pace:** async (a round a day) or live (20 s rounds). **Length:** five rounds.
- **Luck vs skill:** 35/65.
- **Hidden info:** hands; offers and accepts are public at the reveal.
- **Stranger / friend:** strangers: structured offers need no words; friends: it is the Swap with stakes.
- **Pillar:** Collect (set completion is the score), Connect.
- **Losing:** every pig ends with a bag of named things; the tally reads shelves finished, pairs, and what the Trader paid.
- **New art:** none beyond the four shelf stickers and the Trader (exists).
- **Feasibility:** 3 (accept collisions, offer validity, a Trader round, more UI than it looks).
- **Main risk:** negotiation through a two-glyph picker can feel like a vending machine; the brief's "no chat" bites hardest here.

### 10. Who Cursed Me

- **Built from:** the weekday rituals (one blessing and one curse a day, worn visibly for hours), the Inbox's "bless back".
- **The sentence:** *Five nights, one cast a night on someone; in the morning everyone wears what landed. Who kept cursing you?*
- **Seats:** 4. **Pace:** live (15 s nights). **Length:** 3 minutes.
- **Luck vs skill:** 50/50.
- **Hidden info:** who cast what; the effects worn are public.
- **Stranger / friend:** strangers: a thin whodunnit; friends: it inverts the ritual's real charm, which is that a curse is a *signed* message from a friend.
- **Pillar:** Connect, weakly.
- **Losing:** no one loses anything but a guess; a pig under three raincloud curses is a funny sprite, not a shame state.
- **New art:** none (fourteen ritual stickers exist).
- **Feasibility:** 5.
- **Main risk:** the deduction surface is too small for a game and the hidden-caster premise fights the shipped fiction. Listed to show the ritual mind-game was weighed; not recommended.

## Ranked comparison

Rank weighs pig-nativeness and fun first, then fit to a population of tens of daily players, then build cost. "Fill" is how a table forms in that population.

| # | Game | Kind | Seats | Pace | Length | Luck/skill | Hidden info | Fill at tens of DAU | Pillar | Loss state | New glyphs | Feas. | Main risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Who Woke Him | competitive | 2–4 | live | 2–4 min | 40/60 | sleep depth, own scent | invite, rendezvous hours, practice pig | Contend · Connect | "he took the lot" (shared) | 2 | 4 | poaching reads as mean |
| 2 | Out Looking | competitive | 2–4 | async / live | 5 days or 2 min | 30/70 | this round's picks | async pool forms hourly, 2+ | Connect · Contend | muddy trotters | 5 | 5 | 2-seat matching pennies |
| 3 | Sniff Test | competitive, social | 3–4 | live | 3–5 min | 25/75 | hands, satchels, the tile | invite or rendezvous; needs 3 humans | Connect · Collect | muddy trotters (3 stones) | 2 | 4 | population |
| 4 | Same Patch | competitive | 2 | async | 2 digs, hours apart | 20/80 | own scent, sleep depth | async pool, any 2 | Contend · Collect | "lighter pouch" | 1 | 4 | parallel solitaire |
| 5 | Not This One | social, competitive | 2–4 | live / async | 2 min or 6 days | 35/65 | wishes | easy | Connect · Collect | fewer deliveries | 5 (shared) | 5 | tie-heavy race |
| 6 | Light Sleeper | cooperative | 2–4 | live | 2–3 min | 40/60 | sleep depth | invite, practice pig | Contend (herd) | shared, unnamed | 0 | 4 | one pig ends it |
| 7 | Whose Barn | social | 3–4 | async | 3 pushes | 50/50 | ownership | crew or friends | Connect · Collect | "add a lamp" | 1 | 5 | shallow |
| 8 | Ticklish Spot | cooperative | 2 | live | 90 s | 45/55 | the spot | any 2 | Connect | none | 2 | 4 | thin hint vocabulary |
| 9 | Swap Meet | competitive | 2–4 | async / live | 5 rounds | 35/65 | hands | async pool | Collect · Connect | a lighter bag | 0 (shared) | 3 | vending-machine feel |
| 10 | Who Cursed Me | social | 4 | live | 3 min | 50/50 | casters | needs 4 | Connect (weak) | a wrong guess | 0 | 5 | fights the fiction |

Three cover the mix the brief asked for: a live head-to-head that scales to a party (1), an async play-by-push that forms a table from whoever is around (2), and a stranger party game (3). Light Sleeper (6) is the cooperative sibling of (1) on the same kernel and should ship as its second mode, not as a separate build. Same Patch (4) is the cheap async follow-on once (1) exists.

## Top 1 · Who Woke Him (full specification)

**The sentence:** *Take turns at one patch while he sleeps; leave with your pouch before someone's shove wakes him.*

### Rules

1. **The patch.** One layer (the mud), 6 × 5 tiles, every tile 2 deep, exactly as the real Truffle Patch draws it. The Great Hungerer sleeps at the edge with his real meter under him. The server places, by seed: one **domino truffle** (2 tiles, weight 20), one **acorn** (15), one **snout pouch** (15), one **scroll** (12), one **shimmer** (10), one **flask of tea** (10), one **apple** (8), three **stones** (inert), and mud. Finds never overlap. Total weight on the board: 90.
2. **Seats and turns.** Two to four pigs sit around the board. Turn order is clockwise from a seeded first seat; a pig that has tied off is skipped. A turn is **one action** at three or four seats and **two actions** at two seats (the second may be the tie).
3. **The three verbs, with their real loudness.** **Sniff +3**: press your nose on an uncleared tile; you alone see its scent (the number of find tiles in the 3 × 3 around it, stones never counting; exact, taken once, never updated). Everyone sees your nose print. **Rub +6**: the tile −1, its four neighbours −½. **Shove +20**: the tile −2, neighbours −1. Depths floor at 0.
4. **One shared attention.** Every action adds its loudness to one public meter (120ths). His sleep depth `T` was drawn once at setup, uniformly in the band **[50, 110]**, and is hidden. He wakes on the action that carries attention to `T` or past it. Below 50 is certain sleep; the band is painted on the meter as a darker stretch so every pig can read the hazard the same way the real dig prints it.
5. **Finds surface to whoever finishes them.** A find tile at depth ≤ 1 shows its silhouette to everyone. When the last depth of a find's last tile clears, the find drops into the **loose pouch** of the pig whose action cleared it, even if another pig did the earlier rubbing. That is the game's knife: rub twice quietly and the next pig may finish your acorn with one rub, or shove once and secure it at +20 to everyone's meter.
6. **Tie it off.** At any moment, in turn or out of turn, a pig may tie off: its loose pouch becomes **banked** and it leaves the patch to sit at the fence (`face_sit`), free to emote, out of the rotation. Banked weight is safe for the rest of the match.
7. **He wakes.** Everything loose on the patch is his: every pig still digging loses its loose pouch. Banked pouches are untouched. The board ends.
8. **Other ends.** Every pig tied off · every find surfaced (the pigs still digging are tied off automatically; there is nothing left to take) · the 40th action (all remaining pigs tied off).
9. **Result.** Heaviest banked pouch wins. Equal weights share the win (`draw`). Everyone at zero is a draw with the summary *He took the lot. Nobody left with a pouch.*
10. **Emotes.** Any seat, any time, one per 4 seconds, never a turn.

**Seat variants.** 2 seats: two actions per turn (so a quiet rub-rub can finish a single-tile find inside one turn; the poach pressure comes from the truffle's two tiles and the second action's loudness). 3 and 4 seats: one action per turn; the band [50, 110] guarantees by construction that **every pig gets two certain-safe rubs** (8 × 6 = 48 < 50) before the band opens. Light Sleeper is this definition with `kind: 'cooperative'`, public scent, a shared pouch, and a two-tap tie that ends the board for all.

**Fallback rule, held in reserve:** `claimRule: 'noseprint'`. A tile you rubbed carries your mark until your next turn passes; another pig's rub or shove on it is refused with *Pepper's tile*. Switch it on only if playtests find poaching mean rather than tense; it removes the best decision in the game.

### State, actions, view

```ts
type Verb = 'sniff' | 'rub' | 'shove';
type FindKind = 'truffle' | 'acorn' | 'pouch' | 'scroll' | 'shimmer' | 'tea' | 'apple';
type Tile = { depth: 0 | 0.5 | 1 | 1.5 | 2; find: FindKind | 'stone' | null; findId: number | null };

interface WwhState {
  rulesVersion: 1;
  seats: number;
  tiles: Tile[];                           // 30, row-major 6 × 5
  finds: { id: number; kind: FindKind; tiles: number[]; weight: number; takenBy: number | null }[];
  sleepDepth: number;                      // SECRET: never leaves the server until the receipt
  attention: number;                       // public, 120ths
  band: { lo: number; hi: number };        // public tuning, stamped at setup
  loudness: Record<Verb, number>;          // { sniff: 3, rub: 6, shove: 20 }, stamped
  turnSeat: number;
  actionsLeftThisTurn: number;             // 1, or 2 at two seats
  actionCount: number;                     // toward the cap of 40
  pigs: {
    status: 'digging' | 'tied' | 'taken';  // taken = still digging when he woke
    loose: number[];                       // find ids
    banked: number[];
    scent: Record<number, number>;         // tile idx -> number, PRIVATE to this seat
  }[];
  prints: { idx: number; seat: number }[]; // nose prints, public (no numbers)
  phase: 'playing' | 'ended';
  endReason: 'woke' | 'allTied' | 'boardEmpty' | 'cap' | null;
  wokeBy: number | null;
  deadlineAt: number | null;               // server ms, for the active seat
  claimRule: 'none' | 'noseprint';
  lastRubbed: Record<number, number>;      // tile idx -> seat (only read under 'noseprint')
}

type WwhAction =
  | { t: 'sniff'; idx: number }
  | { t: 'rub'; idx: number }
  | { t: 'shove'; idx: number }
  | { t: 'tie' }
  | { t: 'emote'; id: 'snout_boop' | 'confetti_oink' | 'golden_wave' | 'mud_bath' | 'sleepy_pig' | 'slop_thanks' };

interface WwhView {
  me: number;
  tiles: { depth: Tile['depth']; silhouette: FindKind | 'stone' | null; print: number | null; myScent: number | null }[];
  attention: number; band: { lo: number; hi: number }; loudness: Record<Verb, number>;
  face: 'snoring' | 'stirring' | 'oneeye' | 'awake';   // derived: < lo, first half of band, second half, woke
  pigs: { status: WwhState['pigs'][number]['status']; loose: FindKind[]; looseWeight: number; banked: FindKind[]; bankedWeight: number }[];
  turnSeat: number; actionsLeft: number; deadlineAt: number | null; actionCount: number;
  phase: WwhState['phase']; endReason: WwhState['endReason']; wokeBy: number | null;
  sleepDepthRevealed: number | null;        // only when phase === 'ended'
}
```

`view(s, seat)` strips `sleepDepth` (until `ended`), every other seat's `scent`, and the `find`/`findId` of any tile whose depth is above 1 (a buried tile is a buried tile; the silhouette rule is the only leak and it is public by design). Loose pouches are public on purpose: a table of pigs can see who is carrying 35 and about to leave, and that is the chicken.

### Validation (`apply`)

- `emote`: any seat, any phase; refused only by the 4 s rate limit (server-side, not in the pure module).
- `tie`: seat must be `digging`; legal in or out of turn. Out of turn it takes effect immediately and the rotation skips the seat from then on.
- `sniff` · `rub` · `shove`: must be `turnSeat` with `actionsLeftThisTurn > 0`, `phase === 'playing'`, `idx` in 0..29, tile depth > 0. `sniff` additionally requires no prior print of this seat on the tile. Under `noseprint`, a rub/shove on a tile whose `lastRubbed` is another digging seat whose turn has not yet come round again is refused with `claimed`. A no-op is a refusal, never a spent turn (unlike the real dig's silent no-op: wasting a party turn on nothing is a bad night).
- Resolution order for a verb: apply the splash → surface any find whose tiles all reached 0 (to this seat's loose pouch) → add loudness → if `attention >= sleepDepth` then wake (status `taken` for every `digging` seat, their loose pouches to `takenBy = null`, `wokeBy = seat`, `phase = ended`) → else if every find is taken, end `boardEmpty` with auto-ties → else decrement `actionsLeftThisTurn`, advance the turn when it hits 0, and end on `cap` at the 40th action.

### Timeouts

- **Live:** 10 s per action, 15 s for the very first action of the match. On expiry the server applies `tie` for the seat: the gentlest legal move, it banks what the pig has and never adds loudness on an absent pig's behalf. A dropped socket extends the wait to the 20 s reconnect grace before the same default. A seat that never connects within 30 s of the start is tied off at weight 0 before the first action so the table is not held.
- **Async (if ever offered):** 8 h per action, same default. Not recommended: four pigs at one action each per push is a slow night.

### Practice pig (never peeks)

Reads only its own `WwhView`. (1) If it knows no scent and `attention + 3 < band.hi`, sniff the uncleared tile nearest the centre with the most uncleared neighbours. (2) Target: the uncleared tile with the best evidence, in order: a public silhouette at depth ≤ 1 (one rub takes it), then the highest own-scent 3 × 3, then adjacency to a half-splashed tile. (3) Verb: let `h(L) = L / (band.hi − max(attention, band.lo − 1))`, the same reading the real meter shows. Below `band.lo`: shove if the target still needs 2 depth and `attention + 20 < band.lo`, else rub. Inside the band: tie if `looseWeight ≥ 20 && h(6) > 0.25`; otherwise rub; never shove. (4) At two seats, run the policy again for the second action. (5) Emote `sleepy_pig` when it ties with 0, `confetti_oink` when it surfaces the truffle.

### UI events to animate

`turn` (seat, deadline: the pig chip breathes) · `sniffed` (nose print stamps; the number appears only on the sniffer's phone) · `splash` (tile crumbles, mud particles, Reduce Motion: one frame) · `silhouette` (the find's shape fades up under the last half-depth) · `surfaced` (the find names itself and its weight: *an acorn · 15*, flies to the pouch beside the pig) · `attention` (meter tip moves; his face steps snoring → stirring → one eye open at the band's halves; the tag reads *sound asleep · stirring · one eye open*) · `tied` (the pig `walk`s to the fence and `face_sit`s with a knotted pouch at its feet) · `woke` (awake face; every loose pouch tumbles toward him; digging pigs play `surprise`; tied pigs play `happy` at the fence) · `ended` (the tally: one row per pig, banked weight ticking up, then *he took:* rows for the taken) · `emote` (the sticker pops over the pig).

### Tuning

| knob | value | note |
| --- | --- | --- |
| band | [50, 110] of 120 | the live dig's own row; 8 safe rubs by construction |
| loudness | sniff 3 · rub 6 · shove 20 | the mud layer's table, unchanged |
| weights | truffle 20 · acorn 15 · pouch 15 · scroll 12 · shimmer 10 · tea 10 · apple 8 | the real dig's tickle values, read as *weight* |
| stones | 3 | inert; a sniff never counts them |
| action cap | 40 | then everyone ties |
| turn | 10 s (first 15 s); async 8 h | timeout = tie |
| actions per turn | 1 (3–4 seats) · 2 (2 seats) | |
| claimRule | 'none' | 'noseprint' in reserve |
| expected length | 12–18 actions · 2–4 min | sim before build: mean actions to wake with a rub-heavy mix is ≈ 14 |

### Edge cases

- Two single-tile finds cleared by one shove both go to the shover. A rub's half-splash that takes a neighbour from ½ to 0 surfaces that neighbour's find to the rubber: the action that cleared it is the owner.
- The waking action's own find lands loose first, then he takes it with the rest (the real dig's "lands first" rule, under a deterministic meter).
- A pig that ties out of turn mid-animation: the server accepts, the rotation skips it, the current turn is unaffected.
- All remaining pigs tie in the same second: `allTied`; result by banked weight.
- Pulling the plug banks you (timeout = tie). That is identical to tapping tie, so there is no exploit, only a dignified exit.
- Rating: two-seat tables can feed the head-to-head ladder as win/draw/loss by banked weight; three- and four-seat tables report placement only and feed nothing until the ladder has a multi-seat rule. The practice pig never fills a rated seat.

### Layout (390 pt portrait)

```
┌────────────────────────────────────────┐
│ ★ WHO WOKE HIM            Pepper's turn │  PageHeader plaque, turn name right
│ [face 64]  ▓▓▓▓▓▓▓▓░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒  │  his face + the meter; darker band at right
│  sound asleep                 48 / 110 │  the tag the real dig uses
├────────────────────────────────────────┤
│ (Rosie 27) (Pepper 15) (Bandit ✓ 22)   │  seat chips: pig head 44, loose weight; ✓ = tied
├────────────────────────────────────────┤
│  ░░ ░░ ░░ ▒▒ ░░ ░░                     │  6 × 5 tiles at 56 pt, 4 pt gaps = 356 × 296
│  ░░ [2] ░░ ░░ ◐  ░░                    │  [2] = your scent on your print; ◐ = silhouette
│  ░░ ░░ ▓▓ ░░ ░░ ░░                     │  other pigs' prints show the print, no number
│  ░░ ░░ ░░ ░░ ░░ ░░                     │
│  ░░ ░░ ░░ ░░ ░░ ░░                     │
├────────────────────────────────────────┤
│ [ Sniff  +3 ] [ Rub  +6 ] [ Shove +20 ]│  verb cards, 44 pt min, loudness in the numeral role
│ [        Tie it off · bank 27         ]│  gold Button; reads *Tie it off* at 0
│  emotes: long-press your own chip      │
└────────────────────────────────────────┘
```

Header ≈ 96, rail 56, board 312 with padding, verbs 112: ≈ 580 pt, no scroll on any supported phone. Tied pigs move from the rail to a fence strip above the verbs only when there is room (≥ 760 pt tall); otherwise the ✓ on the chip is the record.

### New glyphs (2)

House style suffix for every prompt: *256 px square sticker, thick ink outline, flat cel shading, two small sparkles, subject filling about 88% of the box, transparent background, painted in the same hand as `assets/images/glyphs/dig/bag.png`.*

- `glyphs/dig/noseprint.png`: a pig's snout pressed into dark mud, two nostril dents and a soft rim, seen straight down.
- `glyphs/dig/pouch_knot.png`: a small cream cloth pouch tied shut with twine, a little heavy, resting on the ground.

## Top 2 · Out Looking (full specification)

**The sentence:** *Each day send your pig to one of four places; alone you take the pile, pigs who meet share and tickle.*

### Rules

1. **The places.** Four, each the home of three of the twelve Finds: **the River** (river pebble · snail shell · glass marble) · **the Hedge** (blue feather · pinecone · red berries) · **the Meadow** (four-leaf clover · tuft of wool · honeycomb chip) · **the Farmhouse** (brass button · old key · tin whistle). Each place has its own seeded deck of nine tiles (three of each of its finds). Weights: common 1 · uncommon 2 · the tin whistle 3. The Farmhouse is richer by construction (button 1 · key 2 · whistle 3), so the obvious place is the contested one.
2. **Day 1 piles.** Seven finds are laid out across the places as 3 · 2 · 1 · 1, the sizes shuffled by seed, each pile drawn from its own deck. Piles are face-up and public, always.
3. **A round.** Every pig secretly picks one place (a pick may be changed until the deadline; the last one counts). At the deadline, or the moment every pig has picked (live), the server reveals and resolves:
   - **Alone** at a place with a pile: the pig takes the whole pile into its pouch.
   - **Two or more** at one place: they **share**: each takes one find (the oldest tile first, in a seat order that rotates each round), the rest stays. Each of them also gets **one tickle** (a heart; the game's tiebreaker and its little visit scene).
   - **An empty place:** muddy trotters. Nothing, and a sticker.
   - **Stayed home** (no pick by the deadline): nothing; the pig naps in the yard.
4. **The piles grow.** After resolution every place draws one tile from its own deck onto its pile, the emptied place included (so it restarts at one). Untouched places get fatter every round.
5. **Rounds.** Five at three or four seats, four at two seats.
6. **Result.** Heaviest pouch wins; ties break on tickles; still tied is a `draw`. The summary names every pig's haul: *Pepper brought home 9 · Rosie 7 · Bandit 6.*
7. **Emotes.** Any seat, any time, one per 4 seconds (async: one per round).

**Seat variants.** 2 seats: **three places** (the River, the Hedge, the Farmhouse: drop the Meadow), four rounds, day-1 piles 3 · 2 · 1. Two pigs over four places is matching pennies; three places with one rich one keeps a real read. 3 and 4 seats: four places, five rounds.

**Pace variants.** Live: 15 s picks, 6 s reveal scene, about two minutes. Async: a round closes at the earlier of every pig picking or **20 hours** after it opened; a match completes within five days whatever happens. Pushes carry the state: *Day 3 at the hedge: River 2 · Hedge 1 · Meadow 4 · Farmhouse 3. Where will Rosie look?* and *Rosie came home with a marble and a shell.*

**Table formation (async pool).** Pigs who tap *Find a table* are grouped at the next hour mark with whoever is waiting, two to four to a table, blocks respected both ways, friends-and-crew tables formed on invite with an open-seat option for random fill. A pig alone at the hour mark waits up to 24 h, then is offered a practice table, plainly labeled.

### State, actions, view

```ts
type FindId = 'river_pebble' | 'snail_shell' | 'marble' | 'blue_feather' | 'pinecone' | 'red_berries'
  | 'clover' | 'wool_tuft' | 'honeycomb' | 'brass_button' | 'old_key' | 'tin_whistle';
type PlaceId = 'river' | 'hedge' | 'meadow' | 'farmhouse';

interface OlState {
  rulesVersion: 1;
  seats: number;
  pace: 'live' | 'async';
  places: { id: PlaceId; pile: FindId[]; deck: FindId[] }[];   // deck order is SECRET
  round: number; rounds: number;                                 // 1-based; 4 or 5
  picks: (number | null)[];                                      // place index per seat, SECRET until resolve
  shareOrderOffset: number;                                      // rotates each round
  pouches: FindId[][];
  tickles: number[];
  history: { round: number; picks: (number | 'home')[]; outcomes: ('alone' | 'shared' | 'muddy' | 'home')[]; took: FindId[][] }[];
  deadlineAt: number;
  phase: 'picking' | 'ended';
}

type OlAction =
  | { t: 'go'; place: number }        // may repeat before the deadline; the last wins
  | { t: 'emote'; id: 'snout_boop' | 'confetti_oink' | 'golden_wave' | 'mud_bath' | 'sleepy_pig' | 'slop_thanks' };

interface OlView {
  me: number;
  places: { id: PlaceId; pile: FindId[]; pileWeight: number; deckLeft: number }[];
  round: number; rounds: number; deadlineAt: number;
  myPick: number | null;
  picked: boolean[];                    // who has picked this round (not where)
  pouches: FindId[][]; weights: number[]; tickles: number[];
  history: OlState['history'];          // every past round in full
  phase: OlState['phase'];
}
```

`view(s, seat)` hides every other seat's current `pick` (it shows only that they have picked) and every deck's order (only `deckLeft`). Everything else, including the full history of where each pig went and what it took, is public: the reads are the game.

### Validation (`apply`)

- `go`: `phase === 'picking'`, `place` in range for the table's place count. Overwrites the seat's pick. In live pace the server resolves the round the moment `picks` has no `null`; in async it waits for the deadline so a pig who picked early can still change its mind (and so nobody learns anything from the timing of the resolve).
- `emote`: always legal; rate-limited outside the pure module.
- Resolution (`resolveRound`, pure): group seats by pick → alone takes `pile` whole → groups of two or more each take `pile[0]`, `pile[1]`, … in seat order starting at `shareOrderOffset` and each gets `tickles += 1` → an empty pile is `muddy` → `null` picks are `home` → every place draws one from its deck (skip when the deck is empty) → `shareOrderOffset = (offset + 1) % seats` → `round += 1` or `phase = 'ended'`.

### Timeouts

- **Live:** a pig with no pick at 15 s **stays home**. The game never guesses a place for an absent pig: that would hand its rivals information the pig did not act on.
- **Async:** the same at the 20 h deadline. A pig that has stayed home two rounds running stops receiving round pushes for this match (no nagging); its remaining rounds resolve as `home` and the match still completes. The final result push goes to everyone.

### Practice pig (never peeks)

From its own `OlView` only. For each place `j`, estimate every other pig's probability of going there as `p_j ∝ pileWeight_j²` (greedy pigs go where it's fat), then score `E_j = P(alone at j) × pileWeight_j + (1 − P(alone)) × (weight of pile_j[0] + 0.5)` and pick the best, with 15% noise so it is not clockwork. It never reads another seat's pick or a deck's order; in async it picks within a seeded random delay so the `picked` flags do not leak its policy. Emote `mud_bath` after a share, `sleepy_pig` after muddy trotters.

### UI events to animate

`roundOpened` (piles refresh; the signpost swings to *Day N*) · `picked` (your pig `walk`s from the yard to the place and stands there with a *Looking…* tag; other pigs stay in the yard with a small check when they've picked) · `revealed` (every pig walks to its place at once) · `alone` (the pig plays `happy`; the pile's finds fly to its pouch one by one, each naming itself) · `shared` (two pigs `face` each other on the place's ground line; one heart floats between them; each takes one find) · `muddy` (the pig looks at an empty spot, plays `sad` for one beat, and a *muddy trotters* sticker lands) · `home` (the pig naps in the yard: `tired` with a zzz) · `grew` (one new tile drops onto each pile) · `ended` (the tally: one row per pig, weight ticking, then hearts).

### Tuning

| knob | value | note |
| --- | --- | --- |
| places | 4 (3 at two seats) | each with its own 9-tile deck |
| weights | common 1 · uncommon 2 · tin whistle 3 | rarity lives in Collect; here it is just weight |
| day-1 piles | 3 · 2 · 1 · 1 shuffled (3 · 2 · 1 at two seats) | asymmetry from the first pick |
| growth | +1 tile per place per round | the emptied place restarts at 1 |
| rounds | 5 (4 at two seats) | |
| share | one each, oldest first, rotating order; +1 tickle each | tickle = tiebreak |
| live pick | 15 s · reveal 6 s | |
| async deadline | 20 h or all picked | match ≤ 5 days |
| pool | hourly grouping, 2–4, 24 h max wait | then a labeled practice table |

### Edge cases

- Three pigs share a two-tile pile: the third gets nothing from the pile but still gets the tickle (it met friends).
- A deck runs dry (only possible in a 5-round, 4-seat match where a place is never touched): the pile simply stops growing; the view's `deckLeft` says so.
- A pig picks the same place every round: legal, visible in history, and the table punishes it by sharing with it.
- A seat leaves the match: it stays home from then on and remains on the tally with what it had. No seat is ever removed, so `seats` never changes mid-match.
- Two-seat tables can feed the head-to-head ladder (win/draw/loss by weight). Three- and four-seat tables report placement; recommend feeding the ladder only from two-seat tables until a placement rule exists.
- Async pushes must never reveal a result the pig hasn't opened: the reveal push says *Rosie came home* and the scene plays in the app.

### Layout (390 pt portrait)

```
┌────────────────────────────────────────┐
│ ★ OUT LOOKING                 Day 3 / 5 │  PageHeader plaque, round right
│                                        │
│   [River]            [Hedge]           │  place stickers 96 pt, diamond layout
│    ◦ ◦ ◦              ◦                │  pile = find glyphs 24 pt, up to 5 then +N
│    "3"                "1"              │  pile weight in the numeral role
│              (Rosie)                   │  your pig 120 pt in the yard, centre
│   [Meadow]           [Farmhouse]       │
│    ◦ ◦ ◦ ◦            ◦ ◦ ◦            │
│    "5"                "6"              │
│                                        │
├────────────────────────────────────────┤
│ (Rosie 7) (Pepper ✓ 9) (Bandit 6)      │  seat chips: pig head 44, pouch weight, ✓ = picked
├────────────────────────────────────────┤
│ Where will Rosie look?     picks close │
│ [ River ] [ Hedge ] [ Meadow ] [ Farm…]│  four 44 pt chips, or tap the place itself
│ [        Send her to the Farmhouse    ]│  gold Button repeats the choice; changeable
└────────────────────────────────────────┘
```

Tapping a place sticker and tapping its chip are the same action; the gold button restates the concrete choice (one source of truth, the Max-button rule). Reduce Motion: pigs appear at their places without the walk.

### New glyphs (5)

Same house suffix as above.

- `glyphs/places/river.png`: a bend of blue river over smooth grey stones, one reed, no pig.
- `glyphs/places/hedge.png`: a gap in a green hedge with a few red berries showing and a single blue feather caught in the twigs.
- `glyphs/places/meadow.png`: a tuft of clover and tall grass with one honeycomb-yellow flower, a wisp of wool on a stem.
- `glyphs/places/farmhouse.png`: a cream farmhouse door ajar with a brass knob and a key hanging on a nail beside it.
- `glyphs/muddy_trotters.png`: two pig trotters printed in wet brown mud, slightly crossed, nothing in them.

## Top 3 · Sniff Test (full specification)

**The sentence:** *Hand a pig something from your bag and say what it is; they take your word or give it the sniff test.*

### Rules

1. **The tiles.** Two of each of the twelve Finds (24) plus **three stones per seat** (9 at three seats, 12 at four). Stones are the dig's stones: inert, grey, worth less than nothing here.
2. **The deal, identical for everyone.** Each pig starts with **three finds and two stones** in hand, face-down to the table, face-up to its owner. The rest is shuffled into the **mud pile**.
3. **A pass.** The passer takes one tile from hand, hands it face-down to any other pig, and **names it**: one of the twelve finds, or *a stone*. The name is a sticker over the tile, so no words are needed.
4. **The holder answers**, without seeing the tile:
   - **Take it.** The tile goes into the holder's satchel, hidden. The holder sees what it was. It is what it is.
   - **Sniff it.** The tile is turned face-up for all and checked against the **last** name given. **Named truly:** the sniffer keeps it in the satchel (a find, or an honestly named stone, which is the price of doubting an honest pig), and the honest pig's bag gets heavier: the last claimant draws one from the mud pile. **Named falsely and it is a stone:** it goes face-up into the **last claimant's trough**. **Named falsely and it is a find:** the sniffer keeps it ("you called it, you keep it").
   - **Pass it along** (three or four seats only). The holder peeks, then hands it on to a pig that has not yet held it this round, with a name of its own. The new holder answers the same way; the chain is public.
5. **Refill.** After every resolution the original passer draws one tile from the mud pile (hands have no cap).
6. **Next passer** is the pig that made the final decision (the taker or the sniffer). A pig with an empty hand is skipped.
7. **The end.** The moment any trough shows **three stones**, that pig has muddy trotters and the table ends. Otherwise, when the mud pile is empty and nobody has a tile left to pass.
8. **Scoring.** Each pig's bag is its satchel plus its trough. **A find counts one for you, a stone one against you, a matched pair (two of the same find) one more.** Heaviest bag wins; equal is a `draw`. The muddy-trotters pig is scored like everyone else; its three stones already cost it three.
9. **Emotes.** Any seat, any time, one per 4 seconds.

**Seat variants.** 4 seats is the design target (two relays possible). 3 seats: one relay possible, the chain can fill the table, then the last holder must take or sniff. 2 seats: legal, no pass-along, a pure trust duel; thinner, offered only on invite.

### State, actions, view

```ts
type FindId = 'river_pebble' | 'snail_shell' | 'marble' | 'blue_feather' | 'pinecone' | 'red_berries'
  | 'clover' | 'wool_tuft' | 'honeycomb' | 'brass_button' | 'old_key' | 'tin_whistle';
type TileKind = FindId | 'stone';
type Claim = TileKind;
type Emote = 'snout_boop' | 'confetti_oink' | 'golden_wave' | 'mud_bath' | 'sleepy_pig' | 'slop_thanks';

interface StState {
  rulesVersion: 1;
  seats: number;
  mud: TileKind[];                                   // SECRET order
  hands: TileKind[][];                               // SECRET to each owner
  satchels: TileKind[][];                            // SECRET to each owner
  troughs: TileKind[][];                             // public (only stones ever land here)
  phase: 'pass' | 'respond' | 'ended';
  passer: number;                                    // whose pass this round began with
  transit: null | {
    kind: TileKind;                                  // SECRET except to peekers and the original passer
    holder: number;
    chain: { seat: number; claim: Claim }[];         // public; chain[0].seat === passer
    peeked: number[];                                // seats that chose 'along' and saw it
  };
  nextPasser: number | null;
  deadlineAt: number | null;
  endReason: 'muddyTrotters' | 'mudEmpty' | null;
  muddySeat: number | null;
}

type StAction =
  | { t: 'pass'; handIndex: number; to: number; claim: Claim }
  | { t: 'take' }
  | { t: 'sniff' }
  | { t: 'along'; to: number; claim: Claim }          // peek happens server-side as part of this action
  | { t: 'emote'; id: Emote };

interface StView {
  me: number;
  myHand: TileKind[]; mySatchel: TileKind[];
  handCounts: number[]; satchelCounts: number[]; troughs: TileKind[][]; mudLeft: number;
  phase: StState['phase']; passer: number; deadlineAt: number | null;
  transit: null | { holder: number; chain: StState['transit']['chain']; kind: TileKind | null };  // kind only if I passed it or peeked
  verified: { truths: number; lies: number }[];      // public tally from reveals, for reads
  endReason: StState['endReason']; muddySeat: number | null;
  bagsRevealed: TileKind[][] | null;                 // only when ended
}
```

`view(s, seat)` strips the mud pile's order, every other hand and satchel (counts only), and the transit tile's kind unless `seat === transit.chain[0].seat` or `seat ∈ transit.peeked`. Troughs are public because a stone in a trough is the game's one visible consequence. `peeked` itself is public knowledge (everyone saw the relay choose to pass it along), so it is fine to show the chain.

### Validation (`apply`)

- `pass`: `phase === 'pass'`, `seat === passer`, `handIndex` in range, `to !== seat`, `to` in range. Any of the thirteen names is legal, truthful or not. Moves the tile out of the hand into `transit`, `holder = to`, `chain = [{seat, claim}]`, phase `respond`.
- `take` · `sniff` · `along`: `phase === 'respond'`, `seat === transit.holder`.
  - `along`: `seats >= 3`, `to` not in `chain` and `to !== holder`. Appends `{holder, claim}` to the chain, adds `holder` to `peeked`, sets `holder = to`. A relay never draws.
  - `take`: tile to `satchels[holder]`; `nextPasser = holder`; original passer draws one if the mud pile has any; phase `pass`.
  - `sniff`: `last = chain[chain.length - 1]`; `truthful = last.claim === transit.kind`. Truthful: tile to `satchels[holder]`, and `hands[last.seat]` draws one. False and `kind === 'stone'`: tile to `troughs[last.seat]`. False and a find: tile to `satchels[holder]`. Then the original passer draws one; `nextPasser = holder`; check the troughs for a third stone (end `muddyTrotters`); else phase `pass`.
- Passer selection at phase `pass`: start at `nextPasser`, skip clockwise past empty hands; if every hand is empty, end `mudEmpty`.
- `emote`: always legal, rate-limited outside the module.

### Timeouts

- **Live:** 15 s to pass, 12 s to answer. A passer who lapses passes the **leftmost find in hand, truthfully named, to the next seat clockwise** (if the hand is all stones, the leftmost stone, truthfully named). The server never invents a lie for an absent pig. A holder who lapses **takes it**: trusting is the gentle default and never accuses anyone. A dropped socket gets the 20 s reconnect grace before either default. A pig that lapses three times running is marked napping; its turns resolve by the same defaults without waiting out the full timer (6 s), so three humans are never held hostage by one phone.
- **Async:** not offered. A four-seat chain is twenty-odd pushes; the brief's async lane belongs to Out Looking.

### Practice pig (never peeks)

From its own `StView`, which includes the public `verified` tallies. **Passing:** with a stone in hand, pass the stone to the seat with the fewest trough stones, naming a find the table has already seen verified true this match (else a random common); with no stones, pass the lowest-value find that is not half of a pair, truthfully 80% of the time and under a different common's name 20%. **Answering:** `pSniff = clamp(0.35 + 0.2·lies[claimant] − 0.1·truths[claimant], 0.1, 0.9)`; if the claim is *a stone* and a relay is legal, pass it along 70% of the time (naming after its legal peek: a find's true name 70% of the time, a stone as a random find always); otherwise relay 25% of the time, else sniff with `pSniff`, else take. It reads no hand, no satchel, and no transit kind before a legal peek. Emote `snout_boop` when it sniffs out a lie, `slop_thanks` when it takes.

### UI events to animate

`passed` (the tile slides face-down from the passer's pig to the holder's; the claim is a sticker of the named find's glyph in a speech bubble) · `peeked` (holder's phone only: the tile tilts to show its face) · `along` (the tile slides on; a new bubble) · `took` (the tile drops into the satchel; the taker's phone alone shows what it was with `happy` for a find and a flat shrug for a stone; the table sees only the bag count tick) · `sniffed` (a nose print stamps the tile; it flips face-up for everyone) · `verdictTrue` (the claimant's pig plays `happy`; a tile slides from the mud pile to its hand: "heavier bag") · `verdictFalse` (a stone thunks into the liar's trough with a small dust puff and the liar's pig plays `surprise`; a find flies to the sniffer's satchel) · `troughStone` (the trough's count 1 · 2 · 3 in the numeral role) · `muddyTrotters` (the sticker lands by the third stone; the table ends) · `ended` (every bag fans open; finds count up, stones count down, a matched pair rings).

### Tuning

| knob | value | note |
| --- | --- | --- |
| finds | 2 × 12 = 24 | pairs are possible but rare |
| stones | 3 per seat | 9 or 12 |
| deal | 3 finds + 2 stones each | identical hands by construction |
| mud pile | 4 seats: 12 finds + 4 stones · 3 seats: 15 + 3 · 2 seats: 18 + 2 | |
| honest draw | +1 to a vindicated claimant | the one reward for truth |
| muddy trotters | 3 stones in one trough | ends the table at once |
| scoring | find +1 · stone −1 · pair +1 | one sentence |
| timers | pass 15 s · answer 12 s · napping 6 s | timeout = honest forced pass / take |
| expected length | 18–26 passes · 3–5 min | |

### Edge cases

- The mud pile empties: no more draws; play continues until no pig can pass. A pig with an empty hand is skipped as passer but can still be a target.
- Three seats, two relays: the chain fills the table, so the last holder's `along` is refused with `nobodyLeft` and the buttons show only Take and Sniff.
- A third trough stone that lands from a false *stone* verdict ends the table mid-round; no next passer is chosen.
- The honest-stone sniff (a truthful *a stone* claim, doubted) puts a stone in the **sniffer's satchel**, not its trough: it counts against the score but never toward muddy trotters, because hidden stones are the taker's private regret and only exposed lies pile up in public.
- Two pigs napping at a four-seat table: the game still completes on defaults; the result is recorded as a casual table, never rated.
- Rating: a social game; report placement, feed no ladder.

### Layout (390 pt portrait)

```
┌────────────────────────────────────────┐
│ ★ SNIFF TEST               Pepper → you │  PageHeader plaque; the chain's last step
│ (Rosie ○○ ·5) (Pepper ○ ·4) (Bandit ·6) │  seat chips: pig head 44, trough stones ○, hand count
│                                        │
│   [Pepper's pig, facing right]   [you] │  two pigs on one ground line (the visit scene)
│              ┌──────────┐              │
│              │  tile,   │ "a tin       │  the tile in transit, face-down, 96 pt
│              │ face-down│  whistle"    │  claim bubble with the find glyph
│              └──────────┘              │
│   Pepper said tin whistle              │  chain line; relays append "· Bandit said old key"
├────────────────────────────────────────┤
│ [  Take it  ] [  Sniff it  ] [ Pass it along ] │  three 44 pt buttons; the third hides at two seats
├────────────────────────────────────────┤
│ your bag · 4 finds ◦◦◦◦  · trough ○○    │  your satchel face-up to you; stones as ○
│ hand: [pebble] [key] [stone] [stone] [feather] │  five 56 pt tiles; in the pass phase: tap a tile,
└────────────────────────────────────────┘   then a pig chip, then a name from a 13-glyph sheet
```

Pass phase replaces the three buttons with *Hand it over · "a tin whistle" · to Bandit* once a tile, a pig and a name are chosen (the button restates all three). Reduce Motion: tiles appear in place; the flip is a crossfade.

### New glyphs (2)

Same house suffix, with one exception noted.

- `glyphs/dig/stone.png`: a dull grey mud stone, rounded, a little dirt still on it; **no sparkles** (the one glyph in the family deliberately drawn without them: it is the thing that is worth nothing).
- `glyphs/trough_tray.png`: a short wooden feed trough seen from slightly above, empty, two plank ends, warm brown.

## Closing recommendation

**Ship Out Looking first, Who Woke Him second, Sniff Test when a party can form.**

Out Looking first, for four reasons that are all about the game as it actually is in October 2026, not the game at scale:

1. **It forms a table from whoever is around.** At tens of daily players, live random matchmaking will often find nobody; an hourly async pool of two to four pigs almost always finds someone, friends can be invited into the same table with open seats for strangers, and the match completes in five days whatever anyone does. It is the one design here that honours the founder's ask (head-to-head, random matchmaking, friend invites) without depending on two phones being awake at the same minute.
2. **The push is the game.** Every round's whole state fits in one notification and the decision is one tap. That is "rendezvous over grind" at its purest: the game calls at human intervals and never punishes the hours between.
3. **It proves the spine at the lowest cost.** No board kernel, five glyphs, a pure `resolveRound`, a seat view that hides one array. Seats, deadlines, per-seat projections, reconnect, pushes, the practice table and the result screen all get exercised before the first live game asks them to hold a 10-second turn.
4. **It is pig-native all the way down.** The verbs are the Pen's (send a pig out looking; it comes home with something or with muddy trotters), the places are where the Finds already come from, meeting another pig is a visit with a heart, and the richest place being the contested one is the Sounder's own lesson about sharing.

Who Woke Him is the flagship and should follow immediately: it is the most fun of the ten, it is the one a player who has dug once understands at a glance, and it reuses the real `applySplash` kernel, the real rules-2 meter and the Hungerer's four painted faces. Build it live-only with the practice pig, run Light Sleeper as its cooperative mode on the same kernel, and feed the head-to-head ladder only from two-seat tables until a placement rule exists. Same Patch then costs a replay overlay on the same kernel and gives the async lane a second, fairer-by-construction title.

Sniff Test is specified in full because it is the strongest party design in the set and the one strangers will remember, but it needs three live humans; schedule it behind a population signal (two-seat live fill above some share of attempts at rendezvous hours) or ship it invite-first for crews.

One shared door: **Play together** on the Friends tab, opening a full-screen route with the available tables (Out Looking · Who Woke Him · practice), an invite row that reads the friends list and the crew, and the result sheet every game shares (one row per pig, weight ticking in, the warm sentence, *Find another table*). Rankings, if and when they come, live on their own card, never on Rosie and never on the Barn.

Not recommended from this set: Who Cursed Me (the hidden caster fights the shipped fiction, where a curse is a signed message from a friend) and, as a first build, Swap Meet (the no-chat rule turns negotiation into a vending machine).

## Open questions for the founder

1. **Poaching in Who Woke Him:** keep the knife (anyone may finish a half-dug find) or ship the nose-print claim from day one? The spec keeps the knife and holds the claim in reserve.
2. **Rating from multi-seat tables:** feed the ladder only from two-seat tables (recommended) or define a placement rule now for three and four?
3. **Out Looking's async deadline:** 20 hours after a round opens, or a fixed local hour (the Trader's window and feedings already use the pig's zone)?
4. **Entry consent for Whose Barn with strangers:** acceptable to show a saved room to a table of strangers on an explicit opt-in, or keep it to friends and crew?
5. **Practice tables:** may a practice pig fill the third seat of a casual (unrated) Sniff Test when only two humans are waiting, plainly labeled, or is a bot never seated with humans?
6. **Names:** *Out Looking* reuses the Pen's job label on purpose; confirm that reads as a game title rather than a status, or rename to *Gone Looking*.
