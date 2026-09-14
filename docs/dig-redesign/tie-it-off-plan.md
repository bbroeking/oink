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

## 2. The corrected storage strategy — SHIPPED 2026-09-14

**Only the loose pouch is at stake; the tie is the only thing that fills the
bank.** The founder's rule, verbatim (2026-09-14): *"A thing that is loose
stays loose until the player presses Tie it off. Descending to the next layer
does not bank it. The loose pouch rides down with the player and remains at
stake on every deeper layer; if he wakes at the root, everything loose from
topsoil, the mud and the root is lost together."* — "thing" means things,
not truffles: the truffle keeps banking on descent.

| find | on reveal | on descend | on tie | if he wakes first |
| --- | --- | --- | --- | --- |
| truffle (this layer) | loose | banked, +GT, +tickles | banked, +GT, +tickles | his — gilded next Feeding |
| Boom · acorn · tea · apple · pouch · shimmer · scroll · charm | **loose** (`looseThings[]`) | **carried down, still loose** | banked, tickles paid | **lost with the whole pouch — every layer's** |
| keepsake · relic · furnishing · bow (collection things) | **kept** (`things[]`) — a Barn piece is a Barn piece | kept | kept, tickles paid | kept; their tickles unpaid |
| stone | — | — | — | — |

- **Loose** = shown in the *loose* well beside the truffle (the whole
  carried pouch, all layers' worth), counted in the footer's *bank N* /
  *carry N*, counted nowhere else yet. **Banked** = written to `banked[]` —
  the truffle on `descend`/`tie`, the consumables on `tie` only — paid by
  `submit_rooting_deep` from that list only.
- Collection things stay kept on reveal because losing a once-in-a-season
  Barn piece to a dice roll is a rage-quit, not a gamble; their **tickles**
  still ride the tie so the tie always matters.
- A wake therefore costs: the layer's truffle, **every consumable found on
  every layer of the dig — the whole pouch**, and every tickle the pouch and
  the collection things would have paid. Earlier layers' truffles are untouched (bank on descent
  stays).

Server (`20260914090000_loose_pouch.sql`): `submit_rooting_deep` pays
tickles and records consumables from `p_finds` (the banked list) only, by
kind; `p_things` is the kept collection list (paid on a tie, `kept: true` at
0 on a wake); a woke dig's `p_missed` carries the lost consumables and the
server forces every consumable claimed on a wake into the lost pouch
(`lost: true`, 0) regardless of which list it arrived in. Client
(`utils/snoutDeep.ts`): reveals of consumable kinds go into `looseThings[]`
(the truffle keeps `loose`), `descend` leaves it alone, `tie`/`close`/`cap`
sweep it into `banked` after the truffle, a wake sweeps it into `missed`.

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

1. **Loose pouch** — DONE 2026-09-14 (`feat(dig): the loose pouch carries
   down`). Reducer: consumables to `looseThings[]`, carried through
   `descend`, swept into `banked` on `tie`/`cap`/`close`, into `missed` on a
   wake. `snoutDeep.test.ts`: a wake after a Boom reveal leaves `banked`
   without it and `missed` with it; a descend carries it; a wake in the mud
   loses topsoil's Boom and the mud's tea together. The preview needs no new
   params: the Boom sits in the *loose* well until Tie.
2. **Kept collection things** — DONE 2026-09-14. `things[]` keeps keepsake ·
   relic · furnishing · bow only. `receipt()` rows read *kept* with no
   tickles on a wake (`snoutDeepReceipt.test.ts`, `snoutDeepPatch.test.tsx`).
3. **Server** — DONE 2026-09-14, NOT pushed: `20260914090000_loose_pouch.sql`
   carries `_submit_rooting_deep_core`; pays from `p_finds` by kind, keeps
   `p_things` as the collection list, forces every consumable on a wake into
   the lost pouch. Harness `89_loose_pouch_smoke.sql`: a woke mud dig with a
   topsoil Boom in `p_missed` (or `p_finds`) pays 0 for it; a root tie with
   the same Boom in `p_finds` pays its topsoil value. Left for a follow-up:
   `sync_rooting` still syncs the truffles only, so a window-close tie pays
   no pouch.
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
7. **Tie it off / Dig deeper** — DONE 2026-09-14: the footer reads the stake
   live: *Tie it off · bank 3* / *Dig deeper · carry 3* (N = the loose
   truffle + the loose things; plain labels at 0). Both fit one line on a
   375pt phone at the sm button size up to N = 9 (measured against
   Nunito ExtraBold 13pt: 123pt of 129pt). *fresh sleep* waits on step 4.
8. **The tally** — DONE 2026-09-14: banked rows pay, lost rows read *his*
   (truffle) or *lost* (consumables) with no number, collection rows read
   *kept* on a wake; the foot sums only the paid rows.

## 5. UI instruction

The sleep meter is not a bar. **His face, the state tag under it and the
rose ring are the meter, and they live at the top-right of the dig, where
they are now.** Every band change ends with the state text there —
*snoring · stirring · one eye open · he woke* — so the last thing the eye
lands on after any action is the word at the top-right that says how close
he is.
