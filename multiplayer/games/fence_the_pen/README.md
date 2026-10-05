# Fence the Pen

Dots and Boxes (Lucas, 1889; public domain), in the yard. Rules module: `rules.ts` (pure TS, relative imports, JSON-only state, no randomness). The shared arithmetic: `geometry.ts`. Board: `components/play/games/fence_the_pen/`. Spec: `docs/multiplayer/explorations/01-classic-board-games.md` §4.2, as amended by the lead's review. `rulesVersion` 1.

## The rules in four lines

1. On your turn, **draw one fence** between two posts.
2. If your fence **closes a pen**, its truffle is yours and you **must draw again**.
3. When every fence is up, the most pens wins; equal pens share the win.
4. A missed turn draws the **default fence**: the lowest one that gives nothing away, else the lowest that takes a free pen, else the lowest open one; it keeps drawing while its defaults close pens.

## Tuning

| Knob | Value | Note |
|------|-------|------|
| seats | 2 to 4 | turn order is seat order; seat 0 (shuffled by the room) draws first |
| `BOARD_SIDE` | live 4×4 pens, async 3×3 | from `pace` in `setup`: 5×5 posts and 40 fences live (13 to 15 hand-offs each at two seats), 4×4 posts and 24 fences by post (about 8 each); the rules do not change |
| `decisionMs` | live 20 s, async 24 h | the same clock after an extra move: the room re-arms a fresh deadline whenever the mover owes another fence |
| practice pig | one ply, beginner chain sense | takes the fence that closes the most pens (lowest first); else a random safe fence; else the fence that hands the next pig the shortest run, ties by the rng it is handed |
| missed turns before a pig is taken off | 3 live, 2 async | the room engine's `maxMissedInARow`, not this module |

**Edge indexing** (`geometry.ts`, the one piece of arithmetic every side shares). For a `rows × cols` pen grid: horizontal `h(r, c)` is `r * cols + c` (there are `H = (rows + 1) * cols`); vertical `v(r, c)` is `H + r * (cols + 1) + c`; pen `(r, c)` is `r * cols + c` with sides `h(r, c)`, `h(r + 1, c)`, `v(r, c)`, `v(r, c + 1)`. State: `edges[i]` is 0 open or `seat + 1`; `pens[p]` is -1 open or the owner; `scores`, `fencesLeft`, `turn`, `last`, `over`. One action: `{ type: "fence", edge }`. Events: `fence {seat, edge}`, one `pen {seat, pen}` per closed pen, then `again {seat}`, `turn {seat}` or `end`.

## Deviations from the spec, and why

1. **No `resign`, `emote`, `status` or `missed`** (the lead's amendment). The room engine owns leaving, forfeits, missed-turn counting, the idle no-contest, emotes and rematches. Consequences, all engine policy: every missed deadline counts toward the limit (3 in a row live, 2 async; the spec said a second miss for both); "if the game ends with one pig at the table it wins, *the others trotted off*" is the engine's `forfeit` result, with an empty summary; departed pigs are dropped from the winners by the engine, which clears the summary when it had to re-pick. When the turn passes, a seat whose `ctx.present` is false (a pig who left) is skipped; an open async chair counts as present, so the turn waits on it (the room holds no clock there). A pig that leaves on its own turn has that turn resolved through `onTimeout`; its defaults may keep pens, which stay its own.
2. **`onTimeout` loops inside one call.** It draws the default fence and, while a default closes a pen, keeps drawing defaults until one closes nothing (or the yard is full), so the timed-out seat genuinely stops owing the decision (the engine requires it). The spec had the server re-run the default; a departed pig's turns come through the same path.
3. **"Safe" is read literally**: a fence is safe when it leaves no touching pen three-sided. A fence that closes a pen without leaving a neighbour three-sided is therefore safe, so the default takes a free pen when that is the lowest safe fence.
4. **Errors.** The spec's `taken` is `illegal_move` (the shared `GameErrorCode` has no `taken`); so is an edge that is off this yard (30 on a 3×3). `parseAction` accepts exactly `{ type: "fence", edge }` with an integer edge on the largest yard (0 to 39) and refuses any other key.
5. **No `deadlineMs`, and no `turn` event at setup.** `decisionMs` already gives 20 s and 24 h, and the engine re-arms after an extra move; `setup` returns state only (the engine emits `start`). Not re-sending the async push on an extra move is the server's business.
6. **Result.** `winners` is every seat on the top pen count, `kind: "draw"` when there are several (the lead's contract: a draw's winners are the seats sharing the top place). The summary is name-free and zero-free: `9 pens to 7`, `8 pens each`, `6 pens to 5 to 3`, and a shut-out reads `all 9 pens` (nobody wears a zero).
7. **The practice pig's chain sense** simulates the next pig's whole greedy run after each giveaway (both directions of a chain, and loops) rather than walking one direction from one pen. There is no `strength` knob: `bot(view, seat, rng)` has nowhere to take one.

## What the board shows

> **Fit (2026-10-04, after the simulator pass).** The board sets `GameUI.fillsHeight` and follows `components/play/games/fit.ts`: its root is exactly the `height` the match screen gives it, and the post pitch is planned from width and height together (about 79.5 pt on an iPhone 17 Pro, 53 pt on an SE; 41/38 pt at accessibility-large on an SE, where neighbouring tap zones overlap by a few points and the two-tap preview makes a near miss recoverable). Rails are drawn from an explicit `L.rail` square, turned 90° for vertical fences, and never take a touch (iOS had drawn each rail at its PNG's native 256 pt). Seat tints use a `color` blend at full strength over the pale wood.


The match screen's seat strip stands the pigs on their ground line (`seatStrip: "pigs"`); `seatStatus` writes `5 pens` / `1 pen` under a pig and nothing at all at zero. `reactions` makes those pigs answer each revision: a pig that keeps a pen and draws again jumps (and stays happy for a beat), a sweep of two or more pens in one revision makes the others gasp, a pig whose clock ran out looks tired (never sad), and at the end the winners are happy while everyone else waves. A pig who left reacts to nothing.

Under the strip: the fences-left count top right (`Numeral`), the yard, and one hand-voice line. The yard is a straight `cream2` sticker sized from `width` (posts at a 44 pt inset, so a rim gap's zone stays inside it). Open gaps are invisible 44 pt hit zones over a dotted guide; drawn rails are the painted `FENCE_ART.rail` (turned a quarter for a vertical fence) in its drawer's `SEAT_TINTS` fill, laid over the wood in the colour blend so the planks keep their light, grain and ink; a closed pen is the `penTruffle` patch with its owner's stamp in the top-left corner, the owner's pig (or the hat that stands in for it, as every small portrait in the app does) on a disc of their seat fill, so ownership is never hue alone.

| Phase | Board |
|-------|-------|
| your move | every gap live; the guides brighten; `tap a gap to preview, tap it again to draw` |
| preview | the first tap lays a dashed rail in your seat fill (dashed is the system's "not yet"); `tap the same gap again to draw it`; another gap moves it; nothing is sent |
| drawing | the same gap again sends `{ type: "fence", edge }`; the rail stands in place as a lighter ghost and input sleeps until the next revision; `drawing…` |
| refused | the ghost goes; one line says why (`that gap was just fenced · pick another`) for a toast's dwell |
| extra move | `you kept a pen · draw again` (read from the view, so it holds after a reconnect) |
| their move | gaps asleep and silent; the hint line keeps its height and stays empty |
| cues | a new rail slides in from its drawer's side of the strip; a closed pen's mud spreads, the truffle bounces (Rosie's press), then the stamp comes down; a `draw again` tape (`Clover draws again`) crosses the yard's top edge. One revision's fences and pens queue on their own beats, so a sweep reads as several pops; the revision a board mounts into replays nothing |
| reconnecting | the last fence another pig drew sits lifted on the small hard shadow, and the count's spoken label names it |
| ended | `every fence is up`; every pen stamped; no hint; a pig who left keeps its stamps, dimmed |
| ended early | the yard as it stood; no count, no hint |

Reduce Motion (the match screen's flag or the system's): every entrance is a cross-fade in place, with no travel, bounce or swell. Every word is capped at the chrome Dynamic Type ceiling (`CHROME_TYPE_CAP`, 1.3×). The yard fits 375 to 402 pt phones through `width`: a 4×4 pitch of 73 to 80 pt, every hit zone at least 44 × 44 pt. VoiceOver reads the yard row by row (a row's top fences, then each side fence followed by the pen after it): `Fence between post B2 and B3`, `Pen in row 2, column 3, 3 of 4 fences up` / `kept by Clover`; another pig's move is announced once (`Clover drew the fence between post B1 and B2. Clover kept 2 pens. Clover draws again.`).

**Art.** The painted pieces (2026-10-04): the rail is two pale planks across 89% of its square box (24% tall), drawn one pitch wide so its ends tuck under the posts; the post stands upright in 49% × 89% of a box 30% of a pitch; the truffle patch fills 90% of a box drawn at 80% of a pen. The seat tint was checked against the real rail on every `SEAT_TINTS` fill (`artifacts/fence-the-pen-tint-2026-10-04/`, a model of the board's own compositing): a multiply wash at 0.7 darkened the wood (L* 72 to 65) and left sky and sage a near match (ΔE 9.1), so the tint is the colour blend at full strength (`mixBlendMode: "color"`): the wood keeps its lightness (L* 71 to 73) and its ink outline, and the closest pair of seats sits ΔE 22.5 apart.

## Tests

`npx jest --ci __tests__/multiplayer/fence_the_pen`

- `fence_the_pen.test.ts` (34 tests): the edge indexing (counts, every index round-tripped, pen sides, a rim fence on one pen and an inside fence on two); setup at both paces with no rng consumed; plain-JSON state and the view as the state; one fence passing the turn; a closed pen and the mandatory extra move; the double close (two `pen`, one `again`); the last fence closing a pen and ending the game with no `again`; refusals (taken, off the yard, out of turn, over); `parseAction`; each tier of the default fence; the default's internal loop ending in a pass and running a free chain to the end; turn order skipping a pig who left (in seat order, wrapping), a pig leaving on its own turn (resolved by the default, then skipped) and an open async chair (the turn waits on it with no clock until a pig takes it); the twenty seconds re-armed after an extra move; the result and the zero-free summary; the practice pig (the double close first, safe fences, the shortest giveaway); replay from a fixed seed; and `fuzz(fence_the_pen, 200, { timeoutRate: 0.1 })` at live and async (600 tables each: 0 unfinished, 0 illegal practice moves, 0 leaks; scores always equal the pens on the board, the last fence always closes a pen, and every event is one the board knows), plus 50 three- and four-pig tables with a pig leaving mid-game.
- `fence_the_penBoard.test.tsx` (25 tests): your move (40 labelled gaps, 16 spoken pens, the count, the hint); the two-tap preview, moving it, drawing, the ghost and input asleep until the next revision; a refusal and its recovery; pending; the extra move; their move; a sweep's cues (the tape, the stamps, one announcement, nothing replayed on a re-render or on mount); the lifted last fence; Reduce Motion; a departed pig's pens; the ended yard; two phone widths (every zone at least 44 pt and inside the yard, no pen label under a zone); `seatStatus`; the words; the cue timeline; the slide direction; no em dash or emoji anywhere; and `reactions` (each mapping, a shared win, the no-result fallback, and every revision of 24 real tables: valid seats and kinds, nothing for a pig who left).
