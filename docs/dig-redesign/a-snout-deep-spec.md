# Snout Deep — the Truffle Patch as a press-your-luck dig (spec)

> **Status:** proposed 2026-09-13 (design canvas: *Truffle Patch Redesign*,
> direction A). One of three equal-depth iterations on the shipped patch;
> siblings: `b-one-patch-four-snouts-spec.md`, `c-sniff-and-dig-spec.md`.
> Nothing here is built. Companion diagnosis lives on the canvas's first board.
> **Chosen 2026-09-13** over B and C. Amended the same day: the find table
> (Barn furnishings, booms, acorns), the food/things rule, the tickle
> catch-up, and the hidden practice dig.

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
- **Loose vs kept — he eats food, he can't eat things.** Uncovered *food*
  (truffle clusters, shimmer, apples) is loose until tied. Uncovered *things*
  (booms, acorns, tea, scrolls, keepsakes, furnishings, cosmetics, relics)
  are yours the moment they surface — no tie needed, no wake takes them.
  Tie → loose food becomes banked (`p_finds`). Wake → loose food is not
  credited; the best loose truffle goes to `user_patch_carry` at gild 1 (or
  bumps) via the existing `p_missed` path — he re-buries it, gilded, next
  Feeding. The stake of *Dig deeper* is therefore the Golden Truffles, never
  a thing the player would call taken (charter lens 4).
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
  loose truffle carried gilded, every *thing* found kept. Sounder Bonus /
  blessing +1 each as today. `+20 Pass XP` on every submitted dig, as today.
  Things (see **Finds**) pay on reveal through their own existing paths.
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

## Finds

What you can dig up, by layer. Every row is a Field Guide entry (silhouette
until met). Stones stay inert. **Food** is loose until tied; **things** are
kept on reveal.

| layer | find | kind | pays | odds / board | path |
| --- | --- | --- | --- | --- | --- |
| topsoil | domino truffle | food | +1 GT (`'dig'`), race find | 1 | `mint_truffles` |
| topsoil | **Tickle Boom** | thing | applied tickles: `3 + boom(H)` (see Catch-up) | 1 | auto-apply rule (`20260812010000`) — +N `tickles_earned`, +N snouts, bank untouched |
| topsoil | windfall apple | food | Rosie +8 happiness | 1 in 3 | `apply_happiness` |
| topsoil | snout pouch | thing | +15 snouts | 1 in 2 | `profiles.counter` |
| topsoil | his old boot · bent horseshoe · bottle cap | thing | a **shelf keepsake** (surface_decor) for the Barn; dupes +10 snouts | 1 (one of three) | `grant_habitat_item(uid, id, 'dig', uid:window)` |
| mud | L truffle | food | +1 GT (`'dig_deep'`), race find | 1 | `mint_truffles` |
| mud | shimmer pocket | food | +1 Mote (as today) | 1 in 2 | existing |
| mud | **Clockwork Acorn** | thing | one day of Auto-Tickler charge | 1 in 2 | Contraption Inventory (`20260829`) |
| mud | flask of warm tea | thing | `warm_tea` on yourself, 8 h (regen ×2) | 1 in 3 | `blessings` (self-sent, `source='dig'`) |
| mud | Pass XP scroll | thing | +40 Pass XP | 1 in 3 | season progress |
| the root | relic | thing | Burrow Book (as today); kept on reveal | 2 in 5 | existing |
| the root | **Unearthed furnishing** | thing | one Barn piece from the dig-only *Unearthed* collection; dupes +50 snouts; pity: guaranteed on the 4th root tie without one | 1 in 4 | `grant_habitat_item` |
| the root | a buried bow | thing | one of three dig-only worn cosmetics | 1 in 12 | hats grant (dig-exclusive, like the Burrow Book set piece) |
| the root | bless charm | thing | one blessing to send a friend, free | 1 in 3 | `blessings` on send |

- **Placement.** Each layer draws its rows after the parity draws; a board
  never holds more than 8 finds per layer; odds are server config
  (`app_settings.dig_finds`) with compiled fallbacks, never bare constants.
- **The *Unearthed* collection.** A new `habitat_collections` row, ~12
  `habitat_items` covering all six slots (Rusty Lantern · Buried Milk Can ·
  Old Boot Planter · Cracked Crock Vase · Rope-Handle Trunk · Root-Cellar
  Door wallpaper · Tin Bucket Chandelier · Fossil Fern Rug · …), `is_for_sale
  false`, `rarity 'rare'`. New art lane: 12 furnishing renders + 3 keepsakes.
- **Keepsakes.** Junk stops being nothing: the three junk objects are
  surface_decor items in a *Dug Up* shelf set (the wallow-keepsake grammar).
- **Why booms live in topsoil.** The catch-up is never at stake — a trailing
  player's dig always pays its share; pushing deeper is for the herd's race
  and the Barn, not to protect the handicap.

## Catch-up (the tickle handicap)

The board is lifetime `tickles_earned`. A trailing player catches up by
performing more tickles, so the dig *delivers* tickles and *winds* passive
progress, both scaled to the gap. Applied tickles are never bankable or
tradeable.

```
L       = active leader's tickles earned over the trailing 14 days ÷ 14   (pace/day; active = bank moved in 14 d)
L_full  = 24 + F·3                                                        (a flawless day: regen + base booms; F = Feedings/day, 3)
pace    = clamp(L / L_full, 0, 1)
D       = T_leader − T_you                                                (frozen at cycle start, or at join)
H_day   = min( k · pace · D / 28 , H_max )                                k = 0.75 · H_max = 3·L_full = 99
boom(H) = 0.6 · H_day / F                                                 (delivery — the topsoil Boom)
regen   = base / (1 + 0.4 · H_day / 24)   for the 8 h window after a submitted dig   (passive — "the dig winds it")
```

- **Cycle.** 28 days, cron at a fixed UTC boundary aligned to the pass
  period. `D` and `pace` freeze per cycle; the live board is untouched.
- **k = 0.75.** At equal full effort three-quarters of the gap closes in a
  cycle (full close ≈ 37 d). A leader at ≤ 75 % effort is caught within the
  four weeks: work harder than the leader to keep up, catch up if the leader
  is slow.
- **pace.** An inactive #1 sets no pace, so a dead total inflates nobody's
  boom; a slow leader lowers `H` but also earns less, so the trailer still
  gains. Self-limiting.
- **H_max.** Inflation and alt guard. Today (leader 15,694 · active median
  5,528): the four-week promise holds for gaps ≤ 3,700; the median closes at
  ≈ 99/day (≈ 3.5 months); a fresh account ≈ 5 months. Raising `H_max` to
  5·L_full puts the median at ≈ 2 months.
- **Passive needs the Auto-Tickler.** Faster regen on a 25-cap bank is
  wasted unless spent; the Auto-Tickler (spends above cap − 5, every tickle
  earned) is what makes the passive share real, and its charge is a mud find.
  Streak stays manual-only, as the glossary says.
- **Newcomer ramp.** `H` × 0.25 / 0.5 / 0.75 / 1 over the first 7 days.
- **Edge cases.** Ties: same gap, same `H`. Join mid-cycle: `D` from the
  current cycle's `T_leader`, ramped. A dig across the boundary uses the cycle
  it opened in (window-stamped, as `digSession` already does). Stop digging:
  no booms, no winding — `H` is an opportunity, not a transfer; next cycle
  recomputes up to the clamp. Leader stops: `pace` falls, `H` falls, and the
  gap closes by ordinary play. VIP / blessings / curses modify base regen
  only; a Sluggish Snout cannot halve a handicap.
- **Practice dig.** Behind `dig_practice_visible()` (admin/dev, default
  false) for testing; mints nothing, never winds. Uncrewed players keep the
  Season-tab door.

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
- **Reveal.** A *thing* surfaces with a full-width sticker the moment its
  tile clears — `a Tickle Boom · +19 tickles, yours` (sun) · `a Rusty Lantern
  · new for the Barn` (lilac, the Burrow Book grammar) · `a Clockwork Acorn ·
  a day of the Auto-Tickler` — and the pouch's `tied · yours for keeps` well
  takes it at once; food lands in `loose · his if he wakes`.
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
- **Payoff, things.** The receipt's ledger lists things above food: `a Rusty
  Lantern — in the Barn, unplaced` (tap → the Barn's Decorate with the New
  badge, the acquisition journal's presentation path) · `+19 tickles, applied
  — 1,190 behind the pack` · `an acorn — the Auto-Tickler is wound`.
- **Season tab.** Feeding card line per member: `tied at the mud` / `he woke` /
  `not yet`; the Hunger meter unchanged. The Rankings tab gains one honest
  line: `catch-up pays through the dig · cycle ends in 9 days`.

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
- **Finds + catch-up.** Same migration family: `tickle_cycles(cycle_id,
  starts_at, t_leader, leader_pace)`, `tickle_handicaps(user_id, cycle_id,
  deficit, h_per_day, joined_at)` + a 4-weekly cron; `submit_rooting_deep`
  applies the Boom through the auto-apply rule (`tickles_earned`, `counter`,
  `tickles_applied` on the receipt), writes `dig_wound_until = window end`
  on `user_items` (read by `_regen_secs_for_wallow_at` as one more factor),
  and routes each thing through its own path: `grant_habitat_item(uid, item,
  'dig', uid:window)`, the acorn to `user_contraptions`, tea/charm to
  `blessings`, the scroll to season progress, the pouch to `counter`. Every
  grant is keyed `(uid, window_index)` so a re-submit is a no-op. Find odds
  in `app_settings.dig_finds`. `dig_practice_visible()` default false.
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
| new `components/mudwar/LayerStrip.tsx`, `TieSheet.tsx`, `FindReveal.tsx` | | S / M |
| `hooks/useHomeStats.ts`, `components/TickleCoin.tsx` | catch-up line on the coin's ribbon while wound | S |
| `utils/fieldGuide.ts`, Field Guide entries | 9 new finds | S |
| art: 12 *Unearthed* furnishings, 3 keepsakes, 3 bows, boom/acorn/tea/scroll/apple/pouch/charm marks | ImageGen lane (`regen_studio`) | L |
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

- **"Losers keep everything they earned."** Resolved by the food/things
  rule: a wake takes loose *food* only; every thing is kept on reveal; the
  best loose truffle returns gilded. The remaining stake is Golden Truffles.
- **Catch-up inflation.** `H_max` and `pace` bound it; the applied-tickle
  path is non-tradeable; alts are ramped. Sim the current board through four
  cycles before flag-on.
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
4. **Finds** — `app_settings.dig_finds`, the *Unearthed* collection + keepsake
   art, grant wiring per path, Field Guide entries, `FindReveal`.
5. **Catch-up** — cycles/handicaps tables + cron, Boom via the auto-apply
   rule, the wound-regen factor, the coin's ribbon and the Rankings line.
   Sim on the live board; founder "go".
6. **Flag on for the dev crew** (practice dig visible to admins only), one
   Feeding of telemetry (tie layer, wake rate, boom sizes), then all.
