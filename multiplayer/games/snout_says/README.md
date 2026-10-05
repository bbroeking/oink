# Snout Says

*Show me one picture that reminds you of it, and I'll guess which one you mean.*

A cooperative picture-clue game for two to four pigs, live or by post. Lineage: *Just One* (everyone clues, identical clues cancel) crossed with *Codenames Duet* (a grid, one target), in pictures the player already collects. Spec: `docs/multiplayer/explorations/03-cooperative-and-asymmetric.md` §2.2 and §4.2, with the lead's amendments (below, under Deviations).

| File | What it is |
| --- | --- |
| `rules.ts` | The `GameDefinition` (`snout_says`): state, deal, beats, view, secrecy, result, practice pigs. Pure TS, relative imports, JSON-only state, `ctx.rng` for every draw. |
| `deck.ts` | The 27 pictures and their kinship tags (rules data; never in state or a view). |
| `components/play/games/snout_says/` | The board (`snoutSaysUi`): `Board.tsx`, `ClueBubble.tsx` (the seat bubble), `PictureTile.tsx`, `Reveal.tsx`, `ResultDetail.tsx`, `reactions.ts`, `clock.ts`, `pictures.ts` (names + copy). |
| `__tests__/multiplayer/snout_says.test.ts` | Rules suite. |
| `__tests__/multiplayer/snout_saysBoard.test.tsx` | Board render suite. |

## Rules

A game is **6 rounds live, 3 by post**. In round *r* one pig is the **Guesser** (seat 0 first, then the next pig still at the table in seat order); every other pig at the table is a **Nose**.

**The deal.** Nine pictures make the **spread**; one of them is the **answer**. Each Nose's **tray** is twelve pictures dealt from the eighteen not in the spread, so the tray never holds the answer or any spread picture. The tray is **kind**: at least three tray pictures share a kinship tag with the answer.

**Clue beat** (10 s live, 12 h by post). Each Nose secretly picks exactly one tray picture. Picks are final. When every Nose has answered (or the clock runs out), pictures two or more Noses picked **cancel** (the Just One rule); the survivors go up beside their Noses. A missing clue adds nothing. With one Nose nothing can cancel. If **no clue survives**, three wrong spread tiles fog over (the **free sniff**; the answer is never fogged).

**Guess beat** (10 s live, 12 h by post). The Guesser taps a spread tile. Right first tap: **2** (*knew*). Wrong: that tile dims for everyone and the Guesser taps again. Right second tap: **1** (*nearly*). Wrong again: **0** (*got away*). No tap before the clock: **0** (*in the mud*). Dimmed and fogged tiles cannot be tapped.

**Scoring.** One shared total out of 2 per round (12 live, 6 by post). `result()` is `{ kind: "coop", winners: every seat, scores: the total for every seat, success: total >= rounds, summary: "7 of 12" }`. The warm band line lives on the board, not in `summary`.

**No reveal beat on the server.** A scored round is kept as the view's `lastRound`; the next round opens at once (or the game ends). Live, the next clue beat's deadline is padded by the board's reveal time (3 s + 10 s).

## Tuning (`SNOUT_SAYS_TUNING`)

| Knob | Live | By post |
| --- | --- | --- |
| Rounds | 6 | 3 |
| Clue beat | 10 s (13 s after a scored round: the 3 s reveal pad) | 12 h |
| Guess beat | 10 s, plus any reveal time the table left unspent (see Deviations) | 12 h |
| Reveal (board) | 3 s; `resultDelayMs` holds the result sheet for the last one | none on the clock (the board still plays it when it watches it happen) |
| Spread · tray · kind minimum | 9 · 12 · 3 | same |
| Free sniff | 3 tiles | same |
| Points | 2 / 1 / 0 | same |
| Redeal bound | 16 spreads × 16 trays, then the constructive deal | same |
| Practice Nose | best kinship with p 0.7, else second best | same |
| `decisionMs` fallback | 10 s | 12 h |

Every number is part of `rulesVersion: 1`; changing one is a version bump.

## The deck

Twelve Satchel finds and fifteen Snout Deep dig things, drawn with the glyphs they already wear (no new art). Tags come from `animal · plant · water · sky · food · sweet · metal · glass · wood · old · shiny · soft · round · sound · lucky · tool · warm · home`; `kinship(a, b)` is the size of the tag intersection. Find names are the Satchel's own (`constants/satchel.ts`); dig things are named for what their glyph shows (the dig's "furnishing" glyph is a lantern, so here it is the barn lantern). "Kin" is how many other pictures share at least one tag (the deck test pins a floor of 5, which is what makes the constructive deal always possible).

| Id | Kind | Glyph | Name (sentences) | Short (tiles) | Tags | Kin |
| --- | --- | --- | --- | --- | --- | --- |
| `river_pebble` | find | `findRiverPebble` | river pebble | pebble | water · round · old | 15 |
| `blue_feather` | find | `findBlueFeather` | blue feather | feather | animal · sky · soft | 7 |
| `clover` | find | `findClover` | four-leaf clover | clover | plant · lucky | 9 |
| `snail_shell` | find | `findSnailShell` | snail shell | shell | animal · round · home | 15 |
| `brass_button` | find | `findBrassButton` | brass button | button | metal · round · shiny | 15 |
| `wool_tuft` | find | `findWoolTuft` | tuft of wool | wool | animal · soft · warm | 11 |
| `red_berries` | find | `findRedBerries` | red berries | berries | plant · food · sweet · round | 13 |
| `pinecone` | find | `findPinecone` | pinecone | pinecone | plant · wood | 5 |
| `old_key` | find | `findOldKey` | old key | key | metal · old · home · tool | 13 |
| `honeycomb` | find | `findHoneycomb` | honeycomb chip | honeycomb | animal · food · sweet | 8 |
| `marble` | find | `findMarble` | glass marble | marble | glass · round · shiny | 11 |
| `tin_whistle` | find | `findTinWhistle` | tin whistle | whistle | metal · sound · tool | 8 |
| `acorn` | dig | `digAcorn` | clockwork acorn | acorn | plant · food · wood · metal | 12 |
| `apple` | dig | `digApple` | apple | apple | plant · food · sweet · round | 13 |
| `bag` | dig | `digBag` | satchel | satchel | soft · tool · old | 13 |
| `boom` | dig | `digBoom` | tickle boom | boom | sound · round · warm | 13 |
| `boot` | dig | `digBoot` | old boot | boot | old · warm · water | 11 |
| `bow` | dig | `digBow` | pink bow | bow | soft · sweet | 7 |
| `cap` | dig | `digCap` | bottle cap | bottle cap | metal · round · old | 16 |
| `charm` | dig | `digCharm` | heart charm | charm | lucky · shiny · glass | 8 |
| `furnishing` | dig | `digFurnishing` | barn lantern | lantern | home · warm · metal · old | 15 |
| `horseshoe` | dig | `digHorseshoe` | horseshoe | horseshoe | metal · lucky · animal · old | 19 |
| `pouch` | dig | `digPouch` | snout pouch | pouch | soft · lucky | 9 |
| `relic` | dig | `digRelic` | snout stone | snout stone | old · round · lucky | 18 |
| `scroll` | dig | `digScroll` | scroll | scroll | old · wood | 10 |
| `shimmer` | dig | `digShimmer` | shimmer crystal | crystal | glass · shiny · lucky | 8 |
| `tea` | dig | `digTea` | flask of warm tea | tea | water · warm · glass · home | 10 |

Measured on 200,000 random deals, 93% of first trays are already kind and 0.6% of spreads leave fewer than three kin outside the spread (the case that needs a spread redeal); 16 × 16 redeals make the constructive fallback a formality, and it is tested on its own.

## Deviations from the spec, and why

1. **No server reveal phase** (lead). `phase` is `clue | guess | over`; the scored round rides in the view as `lastRound` and the clock pads the next live clue beat by 3 s. By post there is no padding.
2. **The Guesser gets unspent reveal time back** (addition). If every Nose answers inside the 3 s reveal (practice pigs answer in 0.7 to 1.6 s), the guess beat would open while the Guesser's board is still playing the reveal. The round stores `revealUntil` (server time) and, when the clue beat closes early, `guessPadMs` = the reveal time still to play; the first guess deadline adds it. A wrong first tap spends it.
3. **The engine owns emotes, idling and departures** (lead). Dropped from state: `idleBeats`, `lastEmoteAt`, the emote action, `ended.left`. The "left" band comes from the room result's `reason: "ended_early"`.
4. **Rotation skips pigs that have left** (`ctx.present`), and a pig that has left is not dealt in as a Nose in later rounds. A pig who is merely idle is not skipped: the engine marks a pig gone after 3 missed live deadlines (2 by post), and from then on it is skipped. A round with no Nose at the table plays straight on the free sniff.
5. **The redeal redeals the spread when it must.** The spec says redeal the tray until it is kind; a tray cannot be kind when the spread swallowed all but two of the answer's kin, so the deal redeals the spread in that case. Bounded (16 × 16), then a constructive deal (seat three kin in the tray first) that cannot fail.
6. **A resent wrong guess is `illegal_move`, not an idempotent `ok`.** Through the engine, any `ok` from a Guesser who still owes a guess re-arms the clock (the actor still owes a decision), so an idempotent `ok` would let a Guesser stretch the beat forever by resending. The board treats it as harmless: the view already shows the tap. A resent clue stays an idempotent `ok` (lead), but over the wire it never reaches `apply`: a Nose that has picked is no longer active, so the engine answers `not_your_turn` first.
7. **Error codes collapse to the contract's four**: `not_your_turn` (wrong beat or role), `illegal_move` (off the tray, off the spread, a dimmed or fogged tile, a different resend), `game_over`. Actions use `type` (the registry's convention, `actionType`), not the spec's `kind`.
8. **Secrecy markers.** `secretsOf` lists, for every seat, a per-round canary (`seal:N`, never copied into any view); for the Guesser, `"nose":{"target":…`, the exact tray array and `"target":"<answer>"`; for every seat during the clue beat, the picks array and each other Nose's pick as `"myPick":…`. Scored rounds are public records that name their answer `target` (the lead's `lastRound` shape), so the bare `"target":"x"` marker is left out in the one case it is ambiguous: when x was also an earlier round's answer. A leak would be systematic and the other rounds still catch it.
9. **Async pushes** ("{Guesser}'s pig is guessing. Leave a clue.") are not the rules module's job; the `beat` events (`{ phase, round, guesser }`) carry what a push needs.
10. **Pig reactions** (spec: happy on 2, jump on 1, surprise and a giggle on 0) come through `GameUI.reactions` for the seat strip: a pick nods (`jump`), two Noses who tore giggle (`surprise`), a scored round moves the whole table together (`happy` · `jump` · `surprise`, never `sad`, no mood).
11. **The clock shows the visible window** (`GameUI.clock`). Live deadlines fold the 3 s reveal (and the Guesser's returned pad) in, so the match screen's clock draws `{ opensAt: deadline - beat, closesAt: deadline }` and never runs down while the reveal plays. By post it falls back to the room deadline.
12. **By post with four pigs**, three rounds means the fourth pig never guesses. That is the spec's round count; flagged for the lead.

## The board (per role)

> **Fit (2026-10-04, after the simulator pass).** The board sets `GameUI.fillsHeight` and follows `components/play/games/fit.ts`: the Guesser's spread and the Nose's tray with Show this one are pinned in full; spread tiles plan from width and height (96×96 pt on an iPhone 17 Pro down to 96×44 on an SE) and the Nose's tray runs 6×2 at about 54 pt (49 on an SE). On an SE the Nose drops its how-to line and the other Noses' line; at SE accessibility-large the Guesser's clue line keeps one line. Clue bubbles ride `GameUI.seatBubble` over each Nose's pig.


`seatStrip: "pigs"`: the match screen draws the pigs; the board draws everything under them. Local state is presentation only (the tray picture before it is sent, the tile tapped while the table answers, which scored round has been revealed).

- **Clue bubbles over the pigs (`seatBubble`).** The seat strip floats one over each Nose's own pig, so the signal sits on the pig it belongs to; the board keeps no clue row. The visit's thought-bubble grammar (`WishBubble`), two tail dots stepping down to the pig. States: nothing while a Nose thinks; a sealed "picked" (a check, never the picture) once it picks; then the picture that landed (drops in on the settle spring) or, for a picture two Noses both showed, the picture for a beat, torn off with a tilt and a fade, leaving a dashed "great minds" that giggles in on the overshoot spring. Nothing over the Guesser. A new state remounts the bubble so its entrance plays.
- **Guesser, clue beat.** One hand line ("Clover is picking a picture for one of these."), the spread on paper tiles, not tappable yet, two guess pips and the running total.
- **Guesser, guess beat.** The hand line reads the clue ("which one reminds Clover of an apple?", "an apple and a barn lantern. which one do they mean?", or "nothing landed, so three tiles fogged over."). One tap is one guess (a wrong first tap only dims a tile, so there is nothing to confirm): the tile lifts to sun while the table answers and nothing else takes a tap until the next revision. A wrong tile lands with Rosie's squash and dims to `OPACITY.dim`; fogged tiles wear the never-carried grammar (cream, dashed, silhouette). Pips say "two guesses" / "one guess left".
- **Nose, clue beat.** The answer ringed in sun on a small spread beside "the answer: the honeycomb chip. show a picture that reminds you of it. Rosie guesses." The twelve-picture tray four across; a tap lifts a picture to sun (a tap again puts it back); the gold **Show this one** commits (final). Then the button's slot becomes a sage "you showed the apple. it's final." of the same height, and the other Noses read "Pip has picked · Bun is still thinking", never their pictures.
- **Nose, guess beat.** "Rosie is guessing. your apple landed." (or "tore away: great minds."), the full spread with the answer ringed and the Guesser's taps dimming as they land.
- **Reveal.** When this board watches a round get scored, it plays a 3 s card before the next beat (the server's pad): a recap of what was said, with no seat named (the clues that landed drop in; a picture two Noses shared tears away), a small spread with the answer popping in sun (wrong taps dimmed, fog still on), the outcome word in display type (*knew · nearly · got away · in the mud*) with its hand line, and "7 of 12 so far". It pops in on the dialog recipe; a tap moves on. A board that mounts mid-game never replays an old reveal.
- **Ended.** The last round's card (settled, or playing if it just happened) and the band card: *One language, no words.* (10 to 12 of 12) · *Most of them landed.* (6 to 9) · *A few landed.* (1 to 5) · *Nothing landed, nothing lost.* (0) · *We'll finish this one another time.* (a table that lost a pig). By post the six scale to the same fractions.
- **Seat status lines.** Only what the bubble cannot say: "guesser" / "guessing" under the Guesser, "thinking" under a Nose still choosing, nothing once the seal or the clue is up. Never a picture before the clue beat closes, never a zero.
- **Result detail.** The band line and a ledger row per round: the answer's glyph and name, what landed ("clue: apple · bow", "great minds: acorn tore away", "nothing landed: three tiles fogged") and the outcome as a tag. No seat is named.
- **Craft.** Tokens only; `T` roles; every pressable is a `Sticker` labelled with the picture's name; tiles are 78 to 96 pt (44 pt floor), tiles, bubbles and labels cap Dynamic Type at `CHROME_TYPE_CAP` (1.3); widths fit 339 to 366 pt of board (375 to 402 pt phones). Every animation checks both the board's `reduceMotion` and `useMotionPolicy`: under Reduce Motion nothing travels, the reveal cross-fades in, and torn bubbles are simply torn.

## Test coverage

`npx jest --ci __tests__/multiplayer/snout_says` (73 tests: 45 rules, 28 board).

Rules (`snout_says.test.ts`):
- **Deck**: 12 + 15 unique ids; 2 to 4 tags each, from the list, no repeats; every picture has at least 5 kin; kinship is symmetric.
- **Deal**: 2,000 seeded deals and 500 constructive deals hold every invariant (spread of 9 unique, answer in the spread, tray of 12 unique, tray disjoint from spread, at least 3 kind); so does every round dealt in 20 real tables.
- **Setup**: 6 rounds live, 3 by post; seat 0 guesses first; JSON round-trip.
- **Clue beat**: tray-only picks; the Guesser cannot clue; picks are final (same resend `ok` and unchanged, a different one `illegal_move`); the cancel rule at three pigs (a pair cancels, two different both land) and four pigs (a pair cancels and the odd one lands; all three alike cancel); one Nose never cancels; the free sniff fogs exactly three non-answer spread tiles.
- **Guess beat**: 2 / 1 / 0 with knew / nearly / got away; a wrong tap dims for every seat; dimmed, fogged and off-spread tiles (and a resent wrong tap) are refused; the scored round becomes `lastRound` and the next round opens with the next Guesser and a `revealUntil`.
- **Rotation**: 0,1 / 0,1,2 / 0,1,2,3 by seat order; by post 0,1,2; a pig who left is skipped as Guesser and as Nose; a departed Nose's pick resolves through the engine and play goes on; a round with no Nose left plays on the free sniff.
- **Timeouts and the clock**: a clue beat nobody answered closes on the free sniff; one with some picks closes with them; a missed guess is in the mud, or got away after a wrong tap; a seat that owes nothing is unchanged; through the engine: 10 s first clue beat, shared deadline kept when the first Nose picks, 10 s guess beat, 13 s next clue beat; the reveal pad returned to the Guesser and spent by a wrong tap; 12 h by post with no padding; a table run purely on the clock finishes (every resolved round in the mud, then the engine's idle no contest).
- **Secrecy**: the Guesser's view has no `nose`, no target, tray or pick; a Nose never sees another Nose's pick before the beat closes, and sees every pick after; the markers catch five deliberately leaky views (the round spread in, the nose block, the tray, the picks, another Nose's pick); a whole fuzzed table has no leak and no seed in any snapshot.
- **Determinism and shape**: the same seed replays the same room byte for byte; state and every view are plain JSON at every revision; the result shape and success threshold (live and by post); `parseAction` accepts only the two well-formed actions.
- **Practice pigs**: over 4,000 seeds the Nose shows its unique best picture 66 to 74% of the time and always from its tray; the Guesser takes the spread picture closest to the clues, never a dimmed one, and picks at random among open tiles on a free sniff; neither acts when it owes nothing.
- **Whole tables**: `fuzz(snout_says, 200, { timeoutRate: 0.1 })` live and by post across 2 to 4 seats (600 tables each): 0 unfinished, 0 illegal, 0 leaks; 40 tables where a pig walks away finish cleanly.

Board (`snout_saysBoard.test.tsx`), on real rule states: the Guesser waits through the clue beat (no clue row on the board, no tile takes a tap, no picture leaks), reads the clue and guesses with one tap (and nothing else takes a tap until the next revision), sees dims and fog that take no tap, and takes nothing while pending or off turn; a Nose sees the answer, picks from the tray (selected state), sends the clue with Show this one, then sees the pick as final with only the others' statuses; the guess beat shows the answer ringed; the reveal plays on a scored round, hands back after 3 s, skips on a tap, never replays on a mid-game mount, and survives full motion; the ended board shows the band (and the left-early band); the ledger lists every round naming no seat; prompts, bands, outcome lines and seat status lines; the seat-strip reactions (a nod, a giggle, the table together, a departed pig left out, junk events ignored); the seat bubble (a seal while hidden, "You have picked" over your own pig, each landed clue over its own Nose, a shared picture torn away, nothing over the Guesser, a thinking Nose or a finished table, full motion runs); the clock window through the engine (the first beat, the shared deadline, the reveal-padded next clue beat, the Guesser's returned pad; null by post, when over, or untimed); and `resultDelayMs`.
