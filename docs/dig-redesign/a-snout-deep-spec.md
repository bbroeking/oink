# Snout Deep — the Truffle Patch as a press-your-luck dig (spec)

> **Status:** proposed 2026-09-13 (design canvas: *Truffle Patch Redesign*,
> direction A). One of three equal-depth iterations on the shipped patch;
> siblings: `b-one-patch-four-snouts-spec.md`, `c-sniff-and-dig-spec.md`.
> Nothing here is built. Companion diagnosis lives on the canvas's first board.

## The sentence

**"Dig as deep as you dare — tie off the pouch before he wakes."**

## Shape

- **Opening.** The patch is three layers: **topsoil · mud · the root**. The
  Great Hungerer sleeps at its edge (snoring). Topsoil is safe.
- **The one new decision.** At any moment: **Tie it off** (bank everything
  loose, dig over) or **keep digging / Dig deeper** (better finds below; a
  lighter sleeper). Everything found is *loose* until tied. There is exactly
  one tie per dig.
- **Pressure.** Every action rolls against the layer's wake odds. His face is
  the meter: snoring → stirring → one eye open. He does one thing, once: he
  wakes, and whatever is loose is his.
- **End.** Tie (banked) · wake (loose lost, floor paid) · pack up at 45 actions
  (the hard cap; treated as a tie).
- **Duration.** 12–30 actions, 40–90 s. Topsoil ≈ 10 rubs, mud ≈ 8, root ≈ 5.

## Rules

- **Geometry.** 3 layers × 6×5 tiles, every tile depth 1. Reuses
  `PATCH_COLS/PATCH_ROWS`; new `PATCH_LAYERS = 3`.
- **Layout.** `generateLayeredBoard(seed, uniqueId)` — new in `utils/rooting.ts`.
  Consumes the same first four parity draws as `generateBoard` (L orientation,
  domino orientation, shimmer present, junk kind) so `rooting_finds(seed)` is
  unchanged; every later draw is layout. Placement by layer: topsoil = domino
  truffle, junk, 3 stones; mud = L truffle, shimmer (if drawn), 2 stones; root =
  relic (server-rolled, 2 in 5), 1 stone. A layer is drawn on demand when entered.
- **Actions.** Rub (tap/brush): `applySplash(layers, idx, "rub")` unchanged —
  clears the tile, half-clears 4 neighbours. Shove (hold 400 ms):
  `applySplash(..., "shove")` unchanged — clears the tile and 4 neighbours.
  No stir cost. Cost is noise:
  | layer | rub wakes | shove wakes |
  | --- | --- | --- |
  | topsoil | 0 | 1 in 12 |
  | mud | 1 in 20 | 1 in 6 |
  | the root | 1 in 8 | 1 in 3 |
- **Wake roll.** Deterministic: `wakeStream = new Minstd((seed * 7919) % 2147483647)`;
  the k-th action draws `nextInt(120)` and wakes when the draw is below the
  layer/kind threshold (0 · 10 · 6 · 20 · 15 · 40 in 120ths). Client and server
  replay the same stream; the client cannot pick a lucky roll.
- **Dig deeper.** Available once the current layer's truffle is uncovered, or
  anytime after 6 actions in the layer. Enters the next layer; finds left
  behind are *missed* (carry-eligible, as today).
- **Loose vs banked.** Uncovered finds are loose. Tie → all loose become
  banked (`p_finds`). Wake → loose are not credited; the best loose
  (unique > truffle) goes to `user_patch_carry` at gild 1 (or bumps), via the
  existing `p_missed` path — he re-buries it, gilded, next Feeding.
- **Floor on a wake.** `+20 Pass XP` is paid, the dig counts as submitted
  (Sounder Bonus eligibility for crewmates, stage-reward participation), and
  `credited_finds = 0`. Nothing already banked in a prior dig is touched.
- **End of auto-finish.** `afterReveal`'s *both truffles → finish()* is
  deleted. Only tie / wake / 45-action cap end a dig.
- **Reused untouched:** `Minstd`, `applySplash`, `clusterRevealed`,
  `clusterTouched`, `clusterAnchor`, `clusterBox`, `partiallyRevealedFinds`,
  `gildedSilhouetteDepth`, `feedingPhaseView`, `windowIndex`.
- **Changed:** `generateBoard` gains a layered sibling; `stirCost`,
  `nextStreak`/`QUIET_STREAK_LEN`, `warmthWhisper` retire from this mode;
  `simulateGreedyClear` gains a `simulateSnoutDeep(seed, policy)` for tuning.

## Sounder

- **Before.** Feeding card lists who has dug and at what layer they tied
  ("Jen · tied at the mud").
- **During.** Co-op depth becomes a heavier sleeper: a crewmate having dug this
  Feeding halves the *root's* rub odds (1 in 8 → 1 in 16) — same slot as
  today's `prior_cnt ≥ 1` bonus, no bigger.
- **After.** Sounder Bonus rule unchanged: a tied dig that minted a truffle
  gets +1 when another member submitted this Feeding, either order; the
  earlier member is paid back. A woken dig counts as submitted for the
  crewmate's bonus but earns none itself (no truffle minted).
- No new social act. The share card (`digShareData`) gains the layer tied at.

## Economy

- **Per outcome.** Tie at topsoil: `+1 GT` if the domino was found (≈ 90 %).
  Tie at mud: `+2 GT` (`'dig'` + new `'dig_deep'`). Tie at the root: `+3 GT`
  (+ `'dig_root'`), plus the relic if uncovered. Wake: `0 GT`, `+20 XP`, best
  loose carried gilded. Sounder Bonus / blessing +1 each as today. Junk and
  shimmer credit finds only. `+20 Pass XP` on every submitted dig, as today.
- **Back of envelope (today).** One `'dig'` mint when ≥ 1 cluster is claimed;
  realistic play claims one in ≈ 85 % of digs → **≈ 0.85 GT + 20 XP**, ≈ 3
  credited finds.
- **Snout Deep.** Tie at topsoil: 0.9 × 1 = **0.9 GT**. Push and tie at mud:
  survival ≈ (19/20)^8 ≈ 0.66 → 0.66 × 2 = **1.3 GT**, 0.34 × 0. Push to the
  root and tie: ≈ 0.66 × (7/8)^5 ≈ 0.34 → 0.34 × 3 = **1.0 GT** + 0.34 × 0.4
  relic. Expected value stays within ±0.4 GT of today; variance is the design.
  Shoves compress time and roughly double the wake odds — the fast line is the
  risky line.
- **Closed-economy check.** Every mint is server-side through `mint_truffles`
  (999-cap, ledgered) with a reason; `'dig_deep'`/`'dig_root'` are new reasons
  in the same ledger. No currency on a wake; a wake never debits anyone. Race
  credit (`race_digs.finds`) counts banked finds only, so a woken pig adds
  zero and drags nothing.

## Surfaces

- **Entry.** Barn button's shovel face → `useFeedingCta.start()` → the dig
  modal. Practice digs stay solo and mint nothing.
- **Dig screen (top → bottom).** Corners only, patch ≥ 60 %:
  1. Top-left: back chip + sign — kicker `the truffle patch · Feeding`, title
     `closes in 2h 10m`. Top-right: the Hungerer, 120 pt, with a tag under him:
     `snoring` / `stirring` / `one eye open`.
  2. Layer strip: three chips `topsoil · stones, small truffles` /
     `mud · fat truffles, shimmer` / `the root · relics`; done = sage,
     now = sun, below = cream.
  3. The patch: 6×5 grid, 358 × 430 pt (tiles 55 × 82) on the clearing scene,
     ≈ 60 % of the screen.
  4. Whisper (one paper strip): `topsoil. one rub a tile, or hold for a shove.
     he sleeps through this.` · `the mud. fatter down here — and he sleeps
     lighter.` · `the root. something odd, one rub away. one rub in eight
     wakes him now.`
  5. Pouch (left) with two wells: `loose · his if he wakes` / `tied · yours for
     keeps`. Footer: `Tie it off` (sage, check) · `Dig deeper` / `Pack up`.
- **Decision sheet** (layer cleared): kicker `layer one is clear`, title `a
  truffle and his old boot, loose in the pouch.`, choices `Tie it off · +1
  Golden Truffle · +20 Pass XP · done` / `Dig deeper · the mud · he stirs at
  one rub in twenty`.
- **Pressure.** No sheet — his face and the whisper. At `one eye open` the
  patch wears a rose rim; the footer's `Tie it off` grows to primary.
- **Payoff.** Tie: `Tied off at the root` + `+3 Golden Truffles` + `+20 Pass
  XP` + ledger. Wake: tag `HE WOKE.`, Rosie surprised, ledger: `a truffle and a
  shimmer, loose — he snatched them back` / `something odd — still down there,
  gilded next Feeding` / `+20 Pass XP — your dig still counts for the herd`,
  and a hand line `pushed past the mud and lost the two. next time — tie it at
  the mud?` (The canvas comp A4 draws a `tied · yours for keeps` well holding
  a topsoil truffle; under this spec's one-tie rule that well is empty on a
  wake — the comp predates the rule.)
- **Season tab.** Feeding card line per member: `tied at the mud` / `he woke` /
  `not yet`; the Hunger meter unchanged.

## Server sketch

- **Migration** `20260915000000_snout_deep.sql`, flag `dig_snout_deep_on()`
  default false.
- `war_rootings += layer_tied smallint, woke boolean, action_log text[]`.
- `open_rooting()` unchanged in shape; returns `mode: 'snout_deep'` when on.
- `submit_rooting(p_finds, p_actions, p_missed)` → new
  `submit_rooting_deep(p_finds text[], p_actions text[], p_missed text[])`:
  `p_actions` is the ordered log (`'r1:14'`, `'s2:7'` = kind, layer, tile;
  cap 45). The server replays the wake stream; the first waking index
  truncates the log; finds claimed after it are `bad_finds`; a wake forces
  `p_finds = {}` and routes `p_missed` through the existing carry code. Mints
  `'dig'` + `'dig_deep'`/`'dig_root'` by `layer_tied`. Carries the 20260799
  body verbatim otherwise (the carry-latest-def footgun applies).
- **Fairness.** Wake stream keyed to the row's seed; one row per
  `(user_id, window_index)` PK as today; idempotent re-submit returns the
  stored receipt (`20260913010000` durable receipts).
- **Untouched:** `utils/digSession.ts` entirely — session, dug-window stamp,
  practice lockout, mirror key, reconcile debounce.

## Client sketch

| file | change | size |
| --- | --- | --- |
| `utils/rooting.ts` | `generateLayeredBoard`, `wakeThreshold`, `WakeStream`, `simulateSnoutDeep` | M |
| `constants/dig.ts` | `PATCH_LAYERS`, wake table, `SNOUT_DEEP_ACTION_CAP 45` | S |
| `components/mudwar/TrufflePatch.tsx` | layer state, loose/tied pouch, tie/deeper/wake flow, action log; delete auto-finish + free-rub/streak | L |
| `components/mudwar/LivingMudSurface.tsx` | depth-1 tiles, layer swap crossfade, rose rim | S |
| `components/mudwar/LivingMudScene.tsx` | two-well pouch | S |
| `components/mudwar/LivingMudReceipt.tsx` | tie / wake receipts | M |
| `hooks/useRooting.ts` | submit `text[]` actions; `layerTied`, `woke` in `RootingOutcome` | M |
| `utils/digShare.ts` | layer in the share grid | S |
| new `components/mudwar/LayerStrip.tsx`, `TieSheet.tsx` | | S |
| `utils/digSession.ts`, `utils/feedingClock.ts`, `useFeedingCta.tsx` | untouched | — |

Survives: kernel, reducer, feeding clock, Skia surface, share, progress
save/restore (add `layer` + `actionLog` to the snapshot).

## Charter check

1. **Pillar.** Contend (a stake the herd's race pays for) and Collect (the
   root is the only home of relics). Connect is served only as today — a
   sentence and a heavier sleeper.
2. **One sentence.** Holds. Two verbs it already has, one new verb (tie).
3. **Fair by construction.** Seed-keyed wake stream replayed server-side; the
   client submits a log, not a result.
4. **Losing warm.** The nearest edge of any direction: a wake takes loose
   finds. Mitigations by construction: topsoil cannot wake on a rub; XP and
   participation are paid; the best loose returns gilded; nothing banked in
   any earlier dig is ever touched; the receipt's last line is advice, not
   blame.
5. **Pipeline.** No new art. Two reasons in the mint ledger.
6. **Taste.** Which pillar — Contend. Would a designer who knows this game
   make this choice — the Hungerer finally *does* something, and it is the one
   thing his fiction promised.

## Risks & open questions

- **"Nothing is ever taken."** A wake takes unbanked finds. Is "unbanked" a
  distinction the founder accepts, or does the charter read every uncovered
  find as earned? If the latter, this direction fails the lens.
- **Variance frustration.** A 1-in-8 root rub will wake some players on the
  first action. Tuning must be simulated (`simulateSnoutDeep`) before flag-on;
  target ≥ 60 % of root pushes surviving five actions.
- **Second cluster pays nothing today** (one `'dig'` mint per dig). Depth
  reasons fix that here; they also raise the faucet by up to +2 GT per dig
  for root ties. Cap check against the 999 ceiling and the Exchange prices.
- **Carry holds one item.** A wake with two loose finds carries the best;
  the other is simply gone. Accept, or widen the slot to two.
- **Party of one.** Degrades cleanly — it is a solo game with a co-op
  sleeper bonus it never gets. No shame state; no board change.
- **Reduce Motion.** Layer swaps crossfade; the wake beat is a single frame.
- Open: does `Dig deeper` need the 6-action gate, or is "anytime" simpler?

## Order of work

1. **Sim + kernel** — `generateLayeredBoard`, wake stream, `simulateSnoutDeep`,
   thresholds locked. Tests. No UI.
2. **Server** — migration, `submit_rooting_deep`, flag off. Local Docker
   harness validation; founder "go" before push.
3. **Client behind `DIG_SNOUT_DEEP`** — TrufflePatch layered flow, pouch
   wells, tie sheet, receipts; practice mode first.
4. **Flag on for the dev crew**, one Feeding of telemetry (tie layer, wake
   rate), then all.
