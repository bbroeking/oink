# Rootle

The dice game Pig, with truffles. Rules module: `rules.ts` (pure TS, relative imports, JSON-only state). Board: `components/play/games/rootle/`. Spec: `docs/multiplayer/explorations/01-classic-board-games.md` §4.1, as amended by the lead's review.

## The rules in four lines

1. On your turn, **rootle** (roll the die). A 2 to 6 drops that many truffles in your basket; roll again if you like.
2. Roll the **Hungerer** (the one) and he eats everything in the basket. Your turn is over.
3. **Trot home** any time after your first roll: the basket empties into your barn, and the next pig rootles.
4. When a pig trots home with **50 or more**, every other pig gets **one last turn**. Then the biggest barn wins; equal barns share the win.

## Tuning

Every number lives in `ROOTLE_TUNING` (`rules.ts`) unless it says otherwise.

| Knob | Value | Note |
|------|-------|------|
| `target` | 50 | the same at every seat count; about 6 to 8 turns a pig |
| `faces` | 6 | face 1 is the Hungerer; 2 to 6 pay their pips; rolled as `1 + ctx.rng.int(6)` |
| live deadline | 20 s at a hand-off, 10 s mid-turn | `deadlineMs`; a hand-off is a turn with no roll yet |
| async deadline | 12 h at a hand-off, 60 s mid-turn | once a pig has rolled, the rest of its turn is one sitting |
| `decisionMs` | live 20 s, async 12 h | the hand-off values; `deadlineMs` refines them per state |
| `logLength` | last 12 turns | the board's strip and a reconnect |
| practice pig | holds at 20, give or take 2 | a uniform 18 to 22 per decision, from the rng it is handed |
| missed turns before a pig is taken off | 3 live, 2 async | the room engine's `maxMissedInARow`, not this module |
| emote cooldown | server `timing.emoteCooldownMs` | the server and the match screen, not this module |

## Deviations from the spec, and why

1. **No `resign`, `emote`, `status` or `missed`** (the lead's amendment). The room engine owns leaving, forfeits, missed-turn counting, the idle no-contest, emotes and rematches. The module reads `ctx.present` for one thing: to hand the die past a pig who has left, and to leave such a pig out of the last round's `owed` list. Three consequences of that ownership, all engine policy:
   - every missed deadline counts toward the engine's limit, including a mid-turn timeout that trots the pig home (the spec said a mid-turn hold "does not count as a miss"), and the limit is 3 in a row live, 2 async (the spec said 2 for both);
   - "if every other seat has left, the remaining pig wins at once, *the others trotted off*" is the engine's `forfeit` result, with an empty summary;
   - departed pigs are dropped from the winners by the engine, not by `result()`; when that trims or re-picks the winners, the engine clears the summary and the client composes the line from `scores`.
2. **A pig that leaves on its own turn loses its basket.** The engine resolves that turn through `onTimeout` with `present[seat] === false`; the basket is lost (the spec's resign rule), the turn is logged as a pass, and the event is `pass { seat, left: true }`. Banking it could have set off the last round with a leader who is no longer at the table. A pig still at the table whose clock runs out mid-turn trots home with what it rolled, as specified.
3. **State shape.** `rolls` is `faces.length`: the faces rolled so far this turn are kept, so the die shows the right face after a reconnect. A log entry is `{ seat, faces, banked, end }` with `end: "hold" | "bust" | "pass"` and `banked: 0` for a bust (the spec had `banked: null`), and passes are logged too, so the strip can say "dozed off". `status` and `missed` are gone (deviation 1).
4. **`hold` before the first roll is `illegal_move`.** The shared `GameErrorCode` has no `roll_first`; the board locks Trot home the same way, so a player never sees the error.
5. **No `turn` event at setup.** `setup()` returns state only; the engine emits `start`, and the board reads the first turn from the view.
6. **Result.** `winners` is every seat on the top barn, with `kind: "draw"` when there are several: a shared win, and the winners say who shared it (the lead made this the contract: a draw's `winners` are the seats sharing the top place). The summary is name-free, for the client to put names to: `trotted home with 54 to 47 to 31` is the top barn, then the others biggest first (the spec listed seat order, which means nothing once the names are gone), a barn with nothing in it is left out (nobody wears a zero), and a draw reads `shared the win at 52 to 31`.
7. **The practice pig's last turn.** On a last turn, beating the best barn comes before "finishes when it can": the spec's order would hold at 50 and lose to a leader on 61. The pig reads only its view, which carries no presence, so the best barn it chases can belong to a pig who has left.
8. **`deadlineMs` returns `null` once the game is over** (no seat owes anything then).
9. **Left to the room, by design:** two `roll`s racing one deadline (the server refuses the stale one by `rev`), the reconnect (the view plus the log is the whole story), and the emote cooldown.

## What the board shows

The match screen's seat strip stands the pigs on their ground line; `rootleUi.seatStatus` writes the line under each: `31 in the barn`, the active pig `rolling…` then `rolling · 14 in the basket` (`last turn · …` in the last round), `trotted off · 12 in the barn` for a pig who left, and nothing at all instead of a zero. `rootleUi.reactions` makes those pigs answer each revision: the roller jumps on a 2 to 6; on a bust the roller turns sad and every other pig at the table gasps (surprise); a trot home makes the roller happy; a missed turn makes it tired; at the end the winners are happy and everyone else waves (a pig that busts on the final turn stays sad and waves). A pig who has left answers nothing, so its last pass is never shown as a nap. Under the strip, top to bottom: the fence rail, the die, the haul (basket, arrow, barn), the turn strip, the status line and the thumb zone. Nothing on the board changes height as the game moves: the turn strip is a fixed three-line ledger (blank dashed lines wait to be filled, newest turn on top) and the thumb zone keeps a Button's height when the Buttons are not there, so your controls sit in the same place every turn.

| Phase | Board |
|-------|-------|
| your turn, before the first roll | the die rests on the last face rolled at the table (a dashed "no rolls yet" tray before the first roll of the game); your basket `empty`, your barn in your seat fill and captioned `your barn` (a barn always names its pig in words too, never by hue alone); status `Your turn`; **Rootle** live, **Trot home** locked (hint: roll at least once first) |
| your turn, mid-turn | the basket turns sun with its count; the status names the consequence (`Trot home now to reach 50`, else `Your turn · roll again or trot home`); Trot home reads `Trot home with 14` to VoiceOver. A tap wobbles the die at once and shuts input until the next revision lands or the server refuses |
| their turn | their basket and barn (`Clover's barn`); status `Clover is rootling…`; no controls, but the thumb zone keeps its height and says where you stand (`you're next`, `you rootle after Biscuit`) |
| a roll | the tray tumbles (a spin that eases onto the face, a squash, three faces flicking by, never the Hungerer), and VoiceOver hears `Clover rolled 4. 14 in the basket.` |
| a bust | the die lands on the Hungerer, the tray turns rose and thuds; the busted pig's basket turns rose, the boom sticker splats over it and it shakes, showing what he ate struck through (`he ate it`), for a beat; then the board moves to the next pig |
| a trot home | the basket's number slides along the arrow into the barn (`trotted home`), which pops on its new total, for a beat |
| the last round | the rail lights sun and the die wears a `last turn` tape; status `Your last turn · 52 to beat`, `Trot home now to lead with 53` or `Clover's last turn…`; thumb zone `you set the mark at 52`, `your last turn is next`, `your last turn comes after Clover` or `your last turn is done` |
| ended | no controls; status `The barns are counted`; the haul shows the biggest barn under its pig's name, and `all home`; the result sheet adds the turn strip as `how it ended` (`ResultDetail`) |

Reduce Motion (the match screen's flag or the system's): no spin, flicks, wobble, splat travel, slide or pop; new faces cross-fade. The beats still hold, so the table still reads what happened. Every word is capped at 1.3x Dynamic Type (`BOARD_TYPE_CAP`), and the board fits 375 to 402 pt phones through the `width` prop (the die tray is 132 pt, or 40% of a narrower board).

## Tests

`npx jest --ci __tests__/multiplayer/rootle`

- `rootle.test.ts` (53 tests): the definition and the registry; setup at 2, 3 and 4 seats; every face off `ctx.rng` and the bust; trot home only after a roll; turn order and wrapping; out of turn, game over and `parseAction` refusals; inputs never mutated (deep-frozen); the last round (owed in order, the same-turn 50, the leader never goes again, a second pig past 50 restarts nothing, the bigger barn wins, equal barns share); every timeout default (an untouched turn passes, a rolled turn trots home, a timed-out trot home can start the last round), and the timed-out seat never owes again, checked at every revision of 40 real games; pigs who leave (skipped in the order and the last round, a mid-turn basket lost, and through the real engine: the basket lost on a walk-out, never crowned, the forfeit); `deadlineMs` and the engine arming it at both paces; the view is the state; the 12-turn log; plain JSON at every revision; the summary; the practice pig (hand-off, 18 to 22, finishing, the last turn, nothing to do); the board helpers; replay from a fixed seed; and `fuzz(rootle, 200, { timeoutRate: 0.1 })` at live and async (600 tables each: 0 unfinished, 0 illegal practice moves, 0 leaks), plus tables with a pig leaving mid-game and a check that every event type is one the board knows.
- `rootleBoard.test.tsx` (34 tests): your turn at the hand-off and mid-turn, sending `roll` and `hold`, input shut until the next revision, reopened on a refusal, shut while pending; their turn; a bust (the splat, the eaten count, the landing on the Hungerer, the beat ending, the strip row and its spoken label, the announcement); a trot home carried into the barn; the strip holding three ledger lines from the first turn to the last; a board that mounts mid-game replays nothing; the last round from three seats' points of view; the ended state and a forfeit; Reduce Motion; three widths; no em dash and no emoji in any state; `seatStatus`; the copy, the cues parser, the flick faces and the result sheet's detail; and `reactions`: each mapping (jump, sad plus surprise, happy, tired, the end's happy and wave, a shared win, the room's word on a winner who left, nothing for a pig who left or a revision with no moment), checked again over every revision of 24 real tables.
