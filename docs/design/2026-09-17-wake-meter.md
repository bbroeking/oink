# The wake meter — Snout Deep's sleep as a bar you can read (design + sim)

> **Status:** draft for iteration, 2026-09-17. Not ruled on. The mechanic is
> proposed, the numbers are simulated, nothing in the kernel or the server
> is changed. Sim: `scripts/sim/wakeMeter.sim.test.ts` (`WAKE_METER_SIM=1
> npx jest scripts/sim/wakeMeter.sim.test.ts`). Companion rulings: taste log
> 2026-09-16 (percent per action, meter set aside); `SKILL.md` 2026-09-17
> (3) "the wake meter — open".

## 1. The complaint

A first-week player, on the new dig:

> "there's no progress bar on the guy waking up so it's just random luck?"

They are right on the facts. Every rub, shove and priced sniff is its own
draw against the layer's threshold (`act()` in `utils/snoutDeep.ts`:
`draw < threshold`); nothing carries from one action to the next. The
2026-09-16 percent display ("8% he wakes") tells the truth about the *next*
action, but a truth about the next action is not a position in the dig.
Under this rule the "Tie it off" decision has no state to read — the
player's only lever is their own appetite. That is what "random luck"
means: the game never tells them how far they are from the edge because,
under the rule, there is no edge.

Press-your-luck games that feel *fair* show worsening odds the player can
see: Incan Gold's hazard cards pile up on the table; Deep Sea Adventure's
air meter counts down in the open. The tension comes from a visible
quantity moving toward a boundary the player half-knows. Snout Deep has
the boundary (he wakes) and the moves (loud verbs on deep layers), but no
visible quantity.

## 2. The mechanic (B2)

**Attention accumulates. He wakes when it reaches his sleep depth.**

- Every action adds its **loudness** to a meter. Loudness is exactly the
  number the wake table already carries, in the same 120ths: topsoil rub 1,
  shove 10; mud sniff 3, rub 6, shove 20; root sniff 7, rub 15, shove 40.
  The sniff budget stays as it is (past five sniffs a board, each sniff is
  +1 louder). Co-op halves the root's sniff and rub as today. **No table
  changes** — the tuning that exists transfers, because under both rules
  the *expected* loudness to wake him is the same 120.
- His **sleep depth `T`** is drawn once per board (see §4 for per-board vs
  per-dig) uniformly from a bounded range `[lo, hi]`. He wakes on the action
  that carries attention to `T` or past it.
- The player sees the meter, the range, and the loudness of each verb. They
  do not see `T`. So: below `lo` is **certain sleep** (every action there is
  free of risk, and reads that way); between `lo` and `hi` is **the band**,
  where he could wake on any action and the hazard rises visibly as the
  fill approaches `hi`; at `hi` he wakes for certain.

The chance the next action wakes him, inside the band, is
`loudness / (hi − attention)` — 15/60 = 25% for a root rub on entering a
50–110 band, 50% at 80, certain at 95. That is the rising hazard the player
asked to be able to see, and it comes from the rule, not from a display
formula.

What it changes about *play* (the real point): tie-off becomes an informed
decision. A player at the mud with the meter at 40/110 knows the next rub
is free; at 60 they know they are gambling and roughly how much. A player
can *plan* a root run: "four sniffs cost 28, that leaves me one safe rub."
The nose matters more, not less, because a sniff's loudness is a price on
information the meter makes legible.

## 3. What the player sees

- **The meter** sits with his face (the `Hungerer` badge on the patch; the
  face already steps `snoring → stirring → oneeye` on sniff attention). The
  bar fills left to right; the band `[lo, hi]` is painted as a darker
  stretch at the right end; the fill's tip is where attention is. His face
  is the meter's own legend: `snoring` under `lo`, `stirring` in the band's
  first half, `oneeye` in its second. The tag under him keeps the hand
  voice: *sound asleep* · *stirring* · *one eye open*.
- **The verb cards** wear their loudness as a slice of the bar — a small
  segment the same height as the meter, `+1` / `+6` / `+15` wide — instead
  of a percent. Bigger is louder, one denominator, no inversion (the
  2026-09-16 taste rule holds). The sniff card still counts its free
  sniffs while the budget holds.
- **The whisper** speaks the meter: *"he sleeps through the first 50 or so.
  past that, every action is a roll — and the fuller the bar, the worse the
  roll."* On entering the band: *"he could wake on any of these now."*
- **The woke receipt** names the position, not a fraction: *"pushed the
  root on a rub at 84 — this was the one."*

Nothing is hidden that the rule does not hide. The only unknown is where in
the band `T` sits, and the band is drawn.

## 4. Per board or per dig?

Two scopes were simulated.

- **Per dig (carry):** one nap, the meter runs from topsoil to the root.
  Loudness is so low above the root (topsoil ≈ 10 for a full board, the mud
  ≈ 60) that with any `lo ≥ 70` **the mud never wakes him** and the root is
  entered with the meter already two-thirds full — the whole game becomes a
  short fuse at the root. Lower ranges (`50–190`) bring the mud back (6%)
  but make a careful player skip the root entirely (12% reach it).
- **Per board (reset on descent):** the meter and `T` reset when the dig
  goes deeper — the same shape as the sniff budget's per-board rule
  (2026-09-17) and the *Dig deeper · reset* card. Each layer is its own
  round; the deeper board fills faster because its verbs are louder, so
  escalation is visible without a bigger bar. Topsoil (max ≈ 15 of loudness
  in a whole board) can never reach a `lo` of 50 — **the tutorial layer is
  truly safe**, which the roll rule never gave us (9–12% of digs today wake
  him in topsoil, on a 1-in-120 rub).

Recommendation: **per board**.

## 5. The numbers

2,000 seeds, the sim's bots. `nose greedy` is today's nose bot and ignores
the meter; `bold` ties when the next action would cross the band's middle;
`careful` never enters the band. `gtNoRoot` is GT with the root tie's
`'dig_root'` bonus set to 0 (the lever spec §4 names). `tiedAt` counts
digs that ended by choice at topsoil / mud / root.

**Today (A · roll)**

| policy | finds | truffles | gt | woke | wokeTop | wokeMud | wokeRoot | reachedRoot | rootSurvive5 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| blind | 2.23 | 1.27 | 1.34 | 93% | 12% | 34% | 47% | 54% | 52% |
| nose greedy | 2.87 | 1.46 | 1.74 | 71% | 9% | 30% | 32% | 61% | 70% |
| nose, ties at the mud | 3.10 | 1.46 | 1.46 | 39% | 9% | 30% | 0% | 0% | — |

**B2, per board, `T ∈ [50, 110]`** (recommended)

| policy | finds | truffles | gt | gtNoRoot | woke | wokeTop | wokeMud | wokeRoot | reachedRoot | rootSurvive5 | tiedAt |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| blind | 2.46 | 1.60 | 1.60 | 1.60 | 100% | 0% | 23% | 77% | 77% | 56% | 0/0/0 |
| nose greedy | 3.52 | 1.86 | 2.26 | 1.86 | 59% | 0% | 7% | 52% | 93% | 100% | 0/0/814 |
| nose bold | 3.79 | 1.86 | 2.51 | 1.86 | 34% | 0% | 7% | 27% | 93% | 100% | 0/0/1312 |
| nose careful | 3.80 | 1.51 | 2.08 | 1.51 | 0% | 0% | 0% | 0% | 57% | 100% | 0/858/1142 |
| nose, ties at the mud | 4.03 | 1.86 | 1.86 | 1.86 | 7% | 0% | 7% | 0% | 0% | — | 0/1854/0 |

**B2, per board, `T ∈ [40, 80]`** (tighter — closer to today's wake rate)

| policy | finds | truffles | gt | gtNoRoot | woke | wokeTop | wokeMud | wokeRoot | reachedRoot | rootSurvive5 | tiedAt |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| nose greedy | 2.80 | 1.64 | 1.87 | 1.64 | 77% | 0% | 30% | 47% | 70% | 94% | 0/0/457 |
| nose bold | 3.16 | 1.62 | 2.07 | 1.62 | 51% | 0% | 27% | 24% | 68% | 94% | 0/87/894 |
| nose careful | 3.24 | 1.03 | 1.12 | 1.03 | 0% | 0% | 0% | 0% | 9% | 100% | 0/1812/188 |

(The full grid — four carry ranges, three per-board ranges, five bots —
is what the sim prints.)

### Reading it

1. **The meter rewards reading it.** Under today's rule the only way to
   wake him less is to dig less. Under B2 the bold bot — same nose, same
   digging, one rule for when to stop — wakes him 34% of the time against
   the greedy bot's 59%, and *keeps more* (3.79 finds vs 3.52). The careful
   bot never wakes him and still averages 3.8 finds. The decision the
   player asked for exists, and it pays.
2. **Topsoil becomes safe, the mud stays a choice, the root is the gamble.**
   0% topsoil wakes under every B2 setting; the mud wakes the greedy bot 7%
   (`50–110`) to 30% (`40–80`); the root is where digs end. That is the
   three-act arc the spec wanted (learn / decide / gamble) and the roll
   rule blurred.
3. **The GT faucet opens unless `'dig_root'` goes to 0.** A careful player
   at `50–110` ties at the root in 57% of digs, mostly *immediately* on
   arrival — the descent is silent, the root tie pays `'dig_root'` for the
   mud's truffle, so the bonus becomes a free +1 for walking downstairs.
   With `'dig_root'` at 0, GT/dig for an informed player is 1.51–1.86
   against today's 1.74: **the economy holds without re-pricing the
   Exchange.** Spec §4 already reserved this lever. Recommendation: `0`.
4. **Range picks the wake rate.** `50–110` gives a greedy player today's
   feel at the root (52% vs 32% root wakes, but 0% topsoil and 7% mud
   against today's 9% and 30%; overall 59% vs 71%). `40–80` is harsher and
   drives the careful player out of the root (9% reach it), which is the
   wrong lesson for the layer with the collection things. Ship `50–110`
   as the tuning row's default and move it from the server.
5. **Fully deterministic (`120–120`) is a puzzle, not a game** — everyone
   ties at 119, no one wakes him. The band *is* the tension; it should be
   roughly half the bar.

## 6. What changes, where

Small on both sides; the risk is parity, and there is already a parity
test to extend.

- **Kernel** (`utils/snoutDeep.ts`, `act()`): `attention` and `sleepDepth`
  on the state; `attention += threshold`; `woke = attention >= sleepDepth`;
  both reset in `descend()`. `T` per board from a dedicated draw on the
  seed's wake stream (the first draw when the board is entered), so replay
  from `initialState` reproduces it. `nextThreshold` becomes the card's
  loudness unchanged.
- **Server** (`_submit_rooting_deep_core`, carry-latest-def from the
  20260917130000 body): the replay loop keeps a running `attention` per
  layer and draws `T` the same way; the wake branch compares instead of
  rolling. `_snout_deep_wake_threshold` is untouched (it is now the
  loudness). One tuning row, `app_settings.snout_deep_wake_meter =
  {lo: 50, hi: 110}`, with the compiled fallback in `constants/dig.ts` per
  the server-config rule; `'dig_root'` → 0 in the mint reasons (or its own
  tuning value).
- **Parity:** `__tests__/snoutDeepServerParity.test.ts` pins `lo`/`hi`,
  the draw's position in the stream, and the per-board reset;
  `scripts/db-harness/9x_snout_deep_wake_meter_smoke.sql` replays a log
  that crosses `T` on a known action.
- **Patch UI:** the meter with his face; verb cards wear loudness slices;
  whispers and the woke receipt as §3. `SnoutDeepPatch.tsx`,
  `Hungerer.tsx`, `snoutDeep.ts` copy.
- **Rollout:** an open dig at push time replays under the new rule on
  submit — push in the Eastern gap, as 20260917130000 did. A client on
  the roll rule against a meter server disagrees on the wake for one
  build; gate the client behind a config flag (`snout_deep_wake_meter`)
  so old clients keep rolling until they update, and the server applies
  whichever rule the row the dig was opened under names. Cheaper: accept
  one build of skew, as 191→192 did.

## 7. Open for iteration

- **Per board is the recommendation; is it the story?** "He settles again
  as you go deeper" needs one line of lore (the deeper mud muffles you;
  the reset is the descent's quiet). If that reads false, carry with a
  low `lo` is the fallback and the root becomes the whole game.
- **Should the band narrow as the dig goes on?** A per-board `T` drawn
  fresh each layer means a lucky mud says nothing about the root. Fine
  for fairness; worth a beat of copy so a player does not read the root's
  early wake as the mud's leftover.
- **Loudness on the cards as a slice or a number?** The slice is the honest
  form (it is the same unit as the bar); a number (`+15`) is easier to
  read at a glance. Draw both on the patch before ruling.
- **Does the sniff budget still earn its keep?** Under the meter, a sniff
  is already a visible cost past topsoil (+3 / +7). The +1-per-extra-sniff
  step is a second, subtler escalation on the same bar; it may be
  simplified to a flat loudness once the meter carries the message.
- **`'dig_root'` at 0** — ruled here by the sim; confirm against the
  Exchange's prices before the migration.
