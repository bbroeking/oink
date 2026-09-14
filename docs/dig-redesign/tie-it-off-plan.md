# Snout Deep — why tie it off? (build/debug plan, 2026-09-14)

The design question this plan answers: **why should a player ever "tie it
off"?** Today the honest answer is "to end the dig" — and that is the bug.
Tie it off must be the *save*, and there must be something to lose by not
pressing it.

## 1. The mechanism, as it stands

Progress is saved in two unrelated ways, and the player can feel neither:

- **Truffles bank on descent or tie** (`descend` / `tie` in
  `utils/snoutDeep.ts`; `banked[]`). A loose truffle is the only thing at
  stake: he eats it if he wakes. This is the intended save point.
- **Things are kept the moment they surface** (`things[]` on reveal, spec
  §1.5 "kept on reveal"). Booms, acorns, tea, keepsakes, furnishings, relics,
  bows, charms — and since `fa36cb6` their **tickle value** — are all yours
  the instant the tile clears, tie or wake. Nothing about them depends on
  tying off.

So on a layer with its truffle already banked, *Tie it off* and *Dig deeper*
risk nothing but one truffle, and the tally at the end reads the same either
way. That is why tying feels pointless: it is.

## 2. The corrected storage strategy

**Only the loose pouch is at stake; the tie is the only thing that fills the
bank.**

| find | on reveal | on tie / descend | if he wakes first |
| --- | --- | --- | --- |
| truffle (this layer) | loose | banked, +GT, +tickles | his — gilded next Feeding |
| Boom · acorn · tea · apple · pouch · shimmer · scroll · charm | **loose** | banked, tickles paid | **lost with the layer** |
| keepsake · relic · furnishing · bow (collection things) | **kept** — a Barn piece is a Barn piece | tickles paid on tie | kept; their tickles lost |
| stone | — | — | — |

- **Loose** = shown in the *loose* well beside the truffle, counted nowhere
  yet. **Banked** = written to `banked[]` on `tie`/`descend`, paid by
  `submit_rooting_deep` from that list only.
- Collection things stay kept on reveal because losing a once-in-a-season
  Barn piece to a dice roll is a rage-quit, not a gamble; their **tickles**
  still ride the tie so the tie always matters.
- A wake therefore costs: the layer's truffle, every consumable found on
  that layer, and every tickle the layer would have paid. Earlier layers'
  banks are untouched (bank on descent stays).

Server: `submit_rooting_deep` pays tickles and grants consumables from
`p_finds` (the banked list) only; `p_things` becomes the kept collection
list; a woke dig's `p_missed` gains the lost consumables so the receipt can
name them. Client: `reduce` moves reveals of consumable kinds into `loose`
(a list, not the single truffle id), `descend`/`tie` sweep `loose` into
`banked`, `wake` sweeps it into `missed`.

## 3. Hunger awakening over time

Today he wakes on a hidden dice roll per action (`WAKE_TABLE`, 1-in-N). The
odds are honest but invisible, so a wake feels arbitrary and a tie feels
unmotivated. Make the awakening **visible and cumulative**:

- **A sleep meter, not a coin flip.** He starts each layer asleep at 100.
  Every action drains it by the verb's cost (topsoil: sniff 0 · rub 1 ·
  shove 10; mud 3 · 6 · 20; root 7 · 15 · 40 — the same numbers as the wake
  table, read as points out of 120 instead of odds). A small hidden jitter
  (±1 die) keeps the exact wake action unknowable; the trend is not.
- **Four faces on the meter**: snoring (100–60) · stirring (60–30) · one eye
  open (30–10) · awake (0). The face, the tag under it and the rose ring
  change at each band; the whisper names the band once (*he's stirring —
  quiet verbs now, or tie it off*).
- **Time drains it too.** The meter loses 1 point per 20 s the dig sits
  open on a layer, so a long idle at the root is a risk, not a free think.
  Backgrounding pauses the clock; the window closing still ties.
- **Descending resets the meter to full** (a fresh layer, a fresh sleep) —
  that is the *reward* for pressing Dig deeper with a full pouch, and the
  *cost* is that the deeper table drains faster.

Result: the player can see the moment to tie. Tie early and keep a small
pouch; push on a thin meter and risk the layer's whole pouch.

## 4. Build / debug plan

For each step: what to try · what to check · how to confirm.

1. **Loose pouch** — reducer: consumables to `loose[]`, sweep on
   `tie`/`descend`/`wake`. Check `snoutDeep.test.ts`: a wake after a Boom
   reveal leaves `banked` without it and `missed` with it; a descend banks
   it. Confirm in the preview: the Boom sits in the *loose* well until Tie.
2. **Kept collection things** — `things[]` keeps keepsake · relic ·
   furnishing · bow only. Check `receipt()` rows read *kept* with no tickles
   on a wake. Confirm: woke tally shows the keepsake row without a number.
3. **Server** — migration: `_submit_rooting_deep_core` pays from
   `p_finds`, grants consumables from `p_finds`, keeps `p_things` as
   collection grants. Harness `88_*` smoke: a woke mud dig with a loose Boom
   pays 0 for it. Confirm: `submit_rooting_deep` receipt `tickles[]` lists
   only banked finds.
4. **Sleep meter** — `WakeStream` becomes a drain with jitter; state gains
   `sleep` per layer; `descend` refills. Check the sim
   (`simulateSnoutDeep`, 2,000 seeds): wake rate per layer within ±3 pts of
   today's. Confirm: the dev strip prints `sleep 100→…` per action.
5. **The idle drain** — a 20 s tick in `SnoutDeepDig`, paused on
   background. Check: leaving the dig open 2 min at the root drops 6 points;
   backgrounding drops none. Confirm on device with the strip.
6. **Faces + whisper** — `hungererStateFor(sleep)` on bands; one whisper
   per band change. Check the 4 faces render at each band under Reduce
   Motion. Confirm: preview `?sleep=25` shows one eye open.
7. **Tie it off / Dig deeper** — the footer reads the stake: *Tie it off ·
   bank 3 things* / *Dig deeper · the mud, fresh sleep*. Confirm: both
   labels update live with the pouch.
8. **The tally** — banked rows pay, lost rows read *his* (truffle) or *lost*
   (consumables) with no number. Confirm on the woke path.

## 5. UI instruction

The sleep meter is not a bar. **His face, the state tag under it and the
rose ring are the meter, and they live at the top-right of the dig, where
they are now.** Every band change ends with the state text there —
*snoring · stirring · one eye open · he woke* — so the last thing the eye
lands on after any action is the word at the top-right that says how close
he is.
