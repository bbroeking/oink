# Out Looking

Errands as a meeting game. Spec: `docs/multiplayer/explorations/04-pig-native-originals.md` (candidate 2 and Top 2), with the lead's amendments. Module: `rules.ts` (`out_looking`). Board: `components/play/games/out_looking/`.

## The rules in four lines

1. Each day every pig secretly sends itself to one place (three places at two seats, four at three or four). A pick is final.
2. Alone at a place, a pig takes the whole pile. Pigs who meet take one tile each, oldest first, in a line that rotates every day, and each gets a heart. Alone at a bare place is muddy trotters; no pick by the deadline is a nap at home.
3. Every night each place draws one tile from its own nine-tile deck onto its pile, except a place emptied that day: it rests a night and sits bare tomorrow (and nothing grows after the last day).
4. After the last day the heaviest pouch wins; more hearts break a tie; still level is a draw.

## The places

| Place | Finds (weight) | A set weighs |
| --- | --- | --- |
| River | river pebble 1 · snail shell 1 · glass marble 2 | 4 |
| Hedge | blue feather 1 · pinecone 1 · red berries 1 | 3 |
| Meadow (3–4 seats only) | four-leaf clover 1 · tuft of wool 1 · honeycomb chip 2 | 4 |
| Farmhouse | brass button 1 · old key 2 · tin whistle 3 | 6 |

Weight is the find's Satchel rarity (common 1 · uncommon 2 · rare 3, `constants/satchel.ts`). The catalog already makes the Farmhouse the richest place, which is the spec's own assignment, so no fallback was needed. `multiplayer/` stays self-contained (it ships to the Node server), so `FIND_WEIGHT` is a copy of the catalog's rarities; `out_looking.test.ts` pins it to the catalog so the two cannot drift.

## Tuning (`TUNING` in `rules.ts`)

| Knob | Value |
| --- | --- |
| Decks | 9 tiles per place (3 of each of its finds), seeded order, secret |
| Day-one piles | 3 · 2 · 1 at two seats, 3 · 2 · 1 · 1 at three or four, sizes shuffled by seed |
| Days | 4 at two seats, 5 at three or four |
| Growth | +1 tile per place per night; a place emptied that day (taken whole by a lone pig, or down to its last tile by pigs who met) rests a night and is bare the next day, then regrows; none after the last day; none from a dry deck (which cannot happen: at most 7 of 9 tiles are ever drawn) |
| Share | one tile each, oldest first; the line starts at a seeded seat and rotates daily; +1 heart each, tile or not |
| Live | 15 s to pick; a day that opens out of a reveal adds the 6 s reveal scene (`deadlineMs`) |
| Async | 20 h to pick |
| A day closes | the moment every seat has decided (live and async), or at the deadline |
| Practice pig | rivals go where it's fat (p ∝ pile weight²); score = P(alone) × pile + P(company) × (oldest tile + 0.5 for the heart); ±15% noise |

## State, view, secrets

- State: places (`pile` public, `deck` secret), `picks` (`null` deciding · a sealed `{ place, seal }` · `"home"`), `shareOffset`, `pouches`, `hearts`, `history`, `phase`. JSON only.
- View: piles with `pileWeight` and `deckLeft`, `myPick`, `picked` (who has decided, never where), `firstInLine`, pouches, weights, hearts and every resolved day in full (`picks`, `outcomes`, `took`, the `piles` the pigs found, what each place `grew`, and who headed the line). Where everyone went is the read.
- `secretsOf`: every rival's sealed pick (its `seal`) and every deck tile (its `tile` id). Both are marker strings carried in the state for exactly this purpose: a view that leaked either would contain them.
- Events: `picked {seat}` (never the place), `revealed {round}`, `grew {round}`. The board draws everything from the view; the events only say when.

## Deviations from the spec, and why

1. **Picks are final** (spec: changeable until the deadline). A repeated `go` to the same place is an idempotent `ok` in `apply`; another place is `illegal_move`. Over the wire the room refuses a seat that has already decided before the rules see it (`not_your_turn`); the client suppresses that on a re-send once the view shows the pick.
2. **A day closes the moment every seat has decided, async included** (spec: async waits out the 20 h so timing leaks nothing). A missing pick stays home; the game never guesses a place for an absent pig. An unfilled async chair has not decided, so the day waits for it (no clock until it is filled).
3. **Hearts, never tickles.** Tickles are the app's real currency; a game piece is a heart.
4. **No emotes, no per-seat status, no `deadlineAt`, `pace` or `rulesVersion` in the state.** The engine owns emotes, presence, the clock and missed-turn counting; a pig that leaves is resolved home by the engine through `onTimeout` and keeps its pouch on the tally.
5. **Async no-shows follow the engine's walked-away rule** (spec: after two homes a pig stops getting pushes and the match still completes). Two missed async deadlines in a row and the pig has left; at two seats that ends the table as a forfeit.
6. **An emptied pile rests a night** (the lead's ruling, 2026-10-04; spec: the emptied place restarts at one tile). As written, every place held at least one tile at every pick, so muddy trotters (the game's named loss) could never happen. Now the place that was cleaned out sits visibly bare for a day, and going there alone is a risk you can see and choose (two pigs who meet there still share a heart).
7. **No growth after the last day.** It changes no score, and a pile growing after the game is over would be a beat the board has to apologise for.
8. **The share line starts at a seeded seat and is public** (`firstInLine` in the view, per day in history). Seat order puts an invite's host first, which would otherwise hand the host day one's oldest tile; and who takes the oldest tile if pigs meet is a fair read.
9. **Pigs who meet at a bare place** (not covered by the spec) are `shared`: each gets the heart, nobody a tile, consistent with the third pig at a two-tile pile.
10. **Draws.** A tie on weight and hearts at the top is a `draw` whose `winners` are the tied seats (every seat, when the whole table is level); anyone below placed below. The summary is name-free: `9 to 7 to 6`, `9 to 9 to 2 · on hearts, 2 to 1`, `7 to 7 · level on hearts too`.
11. **The practice pig picks at once.** The spec's seeded delay (so async `picked` flags don't leak its policy) belongs to the practice harness, not the pure module. Two practice pigs at one table meet often (73–92% of picks in a 2,000-table simulation) because identical models chase the same fat pile; with a human at the table that predictability is the read. It never walks into a bare place while any pile has weight.

Why deviation 6: with nine-tile decks a place draws at most 3 (day one) + 4 (nights) = 7 tiles, so no deck runs dry (the spec's "only possible in a 5-round, 4-seat match where a place is never touched" is off by that arithmetic), and under the spec's growth rule no place was ever empty at a pick. Of the two fixes offered (an emptied place rests a night, or six-tile decks), the lead chose the rest night.

## The board, per phase

- **Picking.** A day signpost (`Day 3 of 5`), then a sage pasture: the places around a cream yard (corners for four, a triangle for three). Each place card carries its name, a heap of up to five finds (then `+N`), its sticker, and the pile weight on a `Numeral` tag pinned to the corner nearest the yard; a place resting after being emptied shows `bare today` where its heap would be (and says so to VoiceOver), so the gap reads as chosen, not broken. My pig stands big in the yard; the others wait small in a row, with a check once they have chosen (never where). The thumb zone asks `Where will Rosie look?` over one chip per place (a radio group; tapping a card is the same action), and a gold button restates the choice: `Send Rosie to the Farmhouse` (asleep as `Pick a place for Rosie` until one is chosen).
- **Sent.** My pig walks to the place with a `Looking…` tag and the card stays lifted. `Rosie is out looking at the Farmhouse.` over `Waiting on one more pig.` (live) or `We'll ping you when the round closes.` (async). The pig is out from the tap; if the server refuses, it walks home and the prompt says so.
- **Reveal** (5.6 s, inside the 6 s the live clock waits): everyone walks to their place, then **alone** (the pig beams; the pile hops into its pouch tile by tile, each naming itself, `a glass marble · 2`), **shared** (the pigs turn to face each other, one heart floats up between them, each takes one tile), **muddy trotters** (the pig slumps and the sticker lands where the pile should be), **home** (a nap in the yard with a zzz), then **grew** (one tile drops onto every pile but the ones emptied today), and everyone walks home. The thumb zone reads my day in two lines with a skip link, and VoiceOver announces it. The scene is drawn from the last history row and cued by `revealed`; an async pig coming back sees yesterday's scene until they pick; a live pig rejoining mid-day goes straight to picking.
- **Ended.** The last day's reveal (the result sheet waits for it: `resultDelayMs` is the scene's 5.6 s), then everyone home and happy over `That was the last day.` and my pouch. `ResultDetail` lists every pig heaviest first: portrait, name, hearts, the weight in the numeral role and the pouch drawn as its finds.
- **Seat line:** `pouch 7 · 2 hearts` (null rather than zeros). `seatStrip: "compact"`: the board stages the pigs itself.
- **Reduce Motion:** pigs appear at their places without the walk, sprites rest on their first frame, and finds, the heart, the sticker and the new tiles cross-fade in place.

## Tests

`npx jest --ci __tests__/multiplayer/out_looking` (50 tests):

- `out_looking.test.ts`: the deal (seat variants, nine-tile decks, seeded shuffles); weights pinned to the Satchel catalog and the Farmhouse richest; resolution (alone takes the pile; meeting pigs take one each in the rotating line with a heart each; a third pig at a two-tile pile still gets its heart; muddy trotters reached in play, at a place taken whole the day before, with pigs who meet there still sharing a heart; home); growth (+1 a night everywhere except a place emptied that day, whether by a lone pig or by pigs who met; a place emptied today is empty tomorrow and regrows the night after; a dry deck stops; nothing after the last day; in 60 played tables exactly the emptied places rest and no deck runs dry); final picks and malformed actions; a day closing early once everyone has decided, live and async, with the shared deadline standing; the deadline sending a missing pick home; the 15 s + 6 s live clock and 20 h async; a departed seat staying home, keeping its pouch and never crowned; tie-breaks and summaries; secrecy (a rival's pick never changes another seat's view, deck order never shown, markers that would catch a leaky view); determinism and tile conservation (pile + deck + pouches is nine per place at every revision); the practice pig; and `fuzz(out_looking, 200, { timeoutRate: 0.1 })` for live and async across 2–4 seats (0 unfinished, 0 illegal, 0 leaks), plus fuzzed walk-outs.
- `out_lookingBoard.test.tsx`: the yard fits 375–402 pt phones (cards inside the scene and apart, heaps inside their cards); meeting pigs face each other, a home pig sleeps in the yard, an emptied pile drops no tile and reads `bare` back at picking; leaving tiles keep their spots; render smoke tests for picking (the button restates and sends the choice), a refused pick, sent (the tag, one check, the async line), a reveal with a share (heart, outcome line, back to picking on day 2), a bare place and the muddy trotters it leads to, and ended with the result detail, seat lines and `resultDelayMs`.
