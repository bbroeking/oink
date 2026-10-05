# Mud Volley · Wind-up

`rules.ts` here is the pure rules module (shared by the play server, Practice and the tests); the board is `components/play/games/mud_volley/`. The spec is `docs/multiplayer/explorations/02-arcade-and-party.md` §2.1 and §4.1, amended by the lead's 2026-10-04 review. `rulesVersion` 1.

## The rules in four lines

1. Two pigs, six tosses. The tosser alternates, and the first tosser is dealt from the seed.
2. Every toss, the tosser is dealt a public **wind-up** lane (left, middle or right). All six are dealt at setup. A live table reveals each one when its toss opens; an envelope table shows all six from the start.
3. Both pigs then seal a lane at once: the tosser where the mudball goes, the catcher where the bucket goes.
4. Same lane: a clean catch, **1 to the catcher**. Otherwise a splat to the tosser: **2** if the toss was on the wind-up (the follow-through), **1** if not (the flick). The higher score after six tosses wins; equal is a draw and stays one (`winners` lists both seats, sharing the top place).

At equilibrium the tosser follows through one time in four (p = 1/4), the catcher covers the wind-up half the time (q = 1/2), and a toss is worth half a point to the tosser. Scores run 0 to 9, and a typical match ends 4 to 3 or 3 to 3.

## Timing and tuning

All in `VOLLEY_TIMING` / `VOLLEY_PAYOFF` / `EXCHANGES`. Any change bumps `rulesVersion`, because both sides run the same deadlines.

| Constant | Value | What it is |
|---|---|---|
| `windupMs` | 800 | the first toss's beat: the tosser swings, then the cards open |
| `settleMs` | 400 | after the second lock, so the lock stamp lands before the reveal |
| `revealMs` | 2,600 | `arcMs` 1,400 (the mudball's flight) + `reactMs` 1,200 (the splat or the catch) |
| `commitMs` | 9,000 | the visible window, `commitOpensAt` to `commitClosesAt` |
| `lateGraceMs` | 1,500 | past the visible window, before the seeded fallback lands |
| `envelopeMs` | 24 h | an envelope's deadline |
| `EXCHANGES` | 6 | three tosses and three catches each |
| payoff | 2 / 1 / 1 | big splat / splat / catch |

The engine arms **one shared deadline per toss**, returned by `deadlineMs`: `windupMs + commitMs + lateGraceMs` (11.3 s) on the first toss, `settleMs + revealMs + commitMs + lateGraceMs` (13.5 s) on every later one, counted from the step that opened the toss. The first lock never extends it (the engine's rearm rule); the second lock closes the toss at once (early close). A live match is about 45 to 70 s, worst case about 80 s.

Every live toss carries its visible window in server time, `commitOpensAt` to `commitClosesAt` (the deadline is `commitClosesAt + lateGraceMs`). The first toss's comes from the table's start (`SetupContext.now`, which the engine always passes: start + 800 ms); every later toss's from the step that resolved the one before (resolved + 3,000 ms). A setup called without a clock, as a unit test may, stamps none.

`decisionMs` (12 s live, 24 h async) is only a fallback; `deadlineMs` drives every decision.

## Deviations from the spec, and why

1. **No `tick`.** The step that resolves a toss also opens the next one (phase `commit`); the previous toss stays visible as `lastReveal`. The reveal beat and the late grace live inside the next toss's deadline, and the view carries the visible window (`commitOpensAt`, `commitClosesAt`) so a board can play the reveal first. (Lead's amendment.)
2. **The match screen's clock draws the visible window, not the deadline.** Because the deadline holds the reveal beat and the late grace, `mudVolleyUi.clock` hands the screen `commitOpensAt` to `commitClosesAt` for a live open toss (9 s), and null for the envelope and a finished table (the room deadline then stands).
3. **No `dozed`, emotes, presence or missed-turn counting.** The engine owns all of them. If both pigs miss a toss, both get seeded random lanes and the toss resolves; the engine calls a no contest after three such misses in a row, or a forfeit when only one pig keeps missing. The rules never read `ctx.present` (two seats: a departure ends the table as a forfeit before the rules see another step), and a test pins that they play the same whatever it says.
4. **`already_locked` is `illegal_move`.** `GameErrorCode` has no `already_locked`. The same lane again is an idempotent `ok` (same state, no events); a different lane is `illegal_move`, because sealed is sealed.
5. **The lane action may carry `ex`, the toss it is for.** A retry that arrives after its toss resolved is refused (`illegal_move`) instead of silently becoming the next toss's lane. Without `ex` the lane is for the open toss, as specified.
6. **Through a room, a locked pig's retry answers `not_your_turn`.** The engine refuses any seat outside `activeSeats` before the rules see the action, so the rules' idempotent `ok` is only reachable by direct callers. The lead's ruling: the client never blind-retries and hides `not_your_turn` when the latest view no longer lists the seat as active, so there is no engine change. The board treats it (with `illegal_move`, `stale` and `game_over`) as "the table moved on" and shows no toast.
7. **Envelope fallbacks are six seeded random lanes**, flagged `fallback` on every row for that seat. The Practice Pig answering after 24 h and the unrated marking are server concerns and are not here.
8. **View fields.** Added: `role` ("toss" / "catch"), `firstAttacker` (the envelope form needs it), and `beatMs` / `windowMs` as plain durations for any consumer without a clock (the board itself times from `serverNow`). Left out: `serverNow` (the match screen passes the table's clock as `BoardProps.serverNow`) and presence (the engine and the match screen own it). `score` is by seat, in seat order.
9. **Secrets carry markers.** Every sealed lane, envelope and wind-up holds a `seal` string in state that no view copies; `secretsOf` returns the rival's current seal and every future wind-up's (live) or the rival's envelope's (envelope), so a view that spreads the wrong object fails the fuzz. A meta-test proves a deliberately leaky view is caught.
10. **The summary's "loudest toss"** is the last toss that changed who was ahead, or levelled it: "a clean catch on the last toss", "a big splat on the first toss", "a sneaky flick on the fourth toss to level it". Name-free and lowercase; the ledger in the result sheet is where names go.
11. **Practice pig.** `bot` is Even Edna (p 1/4, q 1/2), reading only its own view. Honest Hank and Slippery Sal are exported as `volleyBot(VOLLEY_BOTS.honestHank)` and `volleyBot(VOLLEY_BOTS.slipperySal)` for a later personality pick.

## The board, phase by phase

> **Fit (2026-10-04, after the simulator pass).** The board sets `GameUI.fillsHeight` and follows `components/play/games/fit.ts`: the lane cards and Lock it in are pinned at the foot at full size and keep one height through picking and the reveal; the pasture scales from what is left (about 204 pt tall on an iPhone 17 Pro, 114 pt on an SE). The reveal tag is one word in the payoff line's slot ("you", "them", or "both" on a catch); screen-reader labels keep the full wording.


`components/play/games/mud_volley/`, `seatStrip: "compact"` (the pasture stages the pigs). The match screen owns the crown, the clock, the emote tray and the result sheet.

- **Every live toss.** Two score stickers in the seat tints with the toss counter between them, then the pasture: you on the left facing right, your rival on the right facing left (`PigStage facing`), three lane posts in the mud in front of them, the wind-up arc hung on the wind-up post (mirrored when the rival tosses), the tosser holding the mudball and the catcher the bucket, and a splat mark on a pig for every splat it has worn. Lanes read left, middle, right across the screen for both pigs, so "left" is the same post on both phones.
- **Tossing.** The hand line: "You're winding up left. Follow through, or flick it?" Three lane cards in post order: the wind-up card reads "big splat · 2" and wears a "wind-up" tag, the others "splat · 1". A tap lifts a card; the **Lock it in** ticket's stub shows its points.
- **Catching.** "Bandit's winding up left. Where will you catch?" All three cards read "catch · 1".
- **Locked.** Your card stamps "locked", the ticket reads "Locked in", and the line says who you are waiting on. Your rival sees a "sealed" sticker over your pig, never the lane.
- **The first toss.** The cards sleep through the wind-up ("Winding up" on the ticket) and wake at the toss's `commitOpensAt`.
- **Reveal.** The next toss is already open in the view, so the board plays the last one first and keeps the cards asleep: settle ("Both lanes are in. Here it comes!"), the mudball's arc to the toss lane with the rival's lane tagged on the cards, then the big splat, small splat or bucket catch with pig reactions (surprise on a big splat, a shrug-bounce on a flick, the catcher's happy on a catch), the score ticking on its sticker and the line saying what happened ("Big splat! You followed through. +2 to you."), announced to VoiceOver. Your own clock-thrown lane owns up: "Your pig lobbed it anyhow." Reduce Motion: nothing travels; the ball and the landing cross-fade in.
- **Beat timing.** Every boundary is server time, read through `BoardProps.serverNow` (Date.now when absent): the ball leaves at `lastReveal.at + 400`, lands at `+ 1,800`, and the cards wake at `commitOpensAt`, the instant the match screen's arc starts. A view that arrives late flies a shorter arc and wakes on time; one that arrives after its window opened skips the beat. Both phones wake their cards at the same server instant.
- **Ended.** The last toss stays on the cards, both pigs wave (the winner gets a happy loop first), and the line reads "You take it, 5 to 4. Both pigs go home muddy." `resultDelayMs` holds the result sheet for the board's last beat: 3,000 on a live table (the settle and the reveal, so it arrives as the pigs wave), the whole reel on an opened envelope (one 2,600 step per toss, 15,600 in all; 0 if the table closed before it opened). The result sheet's detail is the six tosses as a receipt.
- **Envelope form.** "Toss 1 of 3. You wind up left. Follow through, or flick it?", then the catches, on the same cards; a review row of all six picks (T1 to T3, C1 to C3; tap one to change it) and the **Seal the envelope** ticket. If the rival sealed first: "Bandit sealed theirs. Your turn." An unanswered chair is an empty spot in the pasture, not a guessed pig.
- **Envelope waiting.** "Your toss is sealed. We'll tell you when a pig opens it." and your six picks.
- **Envelope reel.** The six reveals replay (2.6 s each) whenever the finished match is opened, with **Skip to the end** and then **Watch it again**.

## Test coverage

`npx jest --ci __tests__/multiplayer/mud_volley`

- `mud_volley.test.ts` (39): the payoff table, directly and through `apply`; a draw naming both seats, through the room; alternating tossers from a seeded first tosser; six seeded wind-ups; the first toss's window stamped from the table's start (and none without a clock or in an envelope), and its deadline; early close opening the next toss in the same step; the engine's shared deadline (the first lock does not extend it) with the late grace inside; six tosses to a result; seeded uniform fallbacks (3,000 draws, each lane within 900 to 1,100), deterministic per rng, both-missing resolving and the engine's idle no contest; sealed is sealed (same lane `ok`, different lane and stale `ex` `illegal_move`, the engine's `not_your_turn` for a locked seat); envelope parsing, slot mapping, resolution of all six in order, idempotency, timeouts and the async open chair; secrecy by non-interference (a pig's view and cues are identical whatever its rival sealed, whatever the future wind-ups or the rival's envelope say), the markers, a leaky-view meta-test, and the snapshot; the rules ignoring `ctx.present`; determinism of whole matches with timeouts; the result, the summary line and `depthStats`; the practice pig (owes-only, Edna about 25% / 50%, Hank about 67%); `fuzz(mud_volley, 200, { timeoutRate: 0.15 })` live and async: 0 unfinished, 0 illegal, 0 leaks.
- `mud_volleyBoard.test.tsx` (19): attacking, defending, locked (and the rival's seal), a reveal played through its beat on a pinned fake clock, a clock-thrown lane (on the Date.now fallback), a late view waking its cards exactly at `commitOpensAt`, a view landing after its window skipping the beat, a server clock two seconds ahead of the phone (mutation-checked: it fails if the board reads the phone's clock), the first toss held through the wind-up, `resultDelayMs` ending on the board's last beat (live) and on the reel's last toss (envelope), `clock` (the visible window, null for the envelope and a finished table), the envelope form sealing all six, changing a pick from the review row, the waiting envelope, the reel with skip, the ended table, a table the room closed early, and the how-to, seat lines and ledger.

## The depth metric to watch in playtests

The design's main risk is that three tosses each are too few to read a stranger. Measure it before any ladder UI, from completed live matches (`result.reason === "complete"`), with `depthStats(history)`, which leaves clock-thrown lanes out:

- **Follow-through rate** per seat: `followThroughs / tosses`. Compare **winners against losers**, and **both against 25%**.
- **Cover rate** per seat: `covers / catches`, against 50%.

How to read it. If winners and losers follow through at the same rate and both sit near 25%, reading the wind-up is not what wins and the match is a coin flip in a costume. If losers follow through more (honest pigs get caught covering the wind-up) or much less (never-honest pigs get caught on the flick lanes) than winners, the read pays, which is the game working. Each pig tosses only three times a match, so pool across matches: about two hundred completed matches give roughly ±3.5% on a pooled rate and can tell a five-point gap between winners and losers. If the claim fails, change the rules (more tosses, a different payoff), not the rating formula.
