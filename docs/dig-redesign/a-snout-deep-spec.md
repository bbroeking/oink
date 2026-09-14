# Snout Deep — the Truffle Patch as a press-your-luck dig with a nose (spec)

> **Status:** chosen 2026-09-13 (direction A of *Truffle Patch Redesign*, with
> C's sniff verb folded in; the grill of the same day resolved every rule
> below). Siblings for reference: `b-one-patch-four-snouts-spec.md`,
> `c-sniff-and-dig-spec.md`. Screen flow: the *Snout Deep* canvas. This file is
> the build's source of truth; §7 is the reducer's contract.

## The sentence

**"Sniff to know, rub to take, dig as deep as you dare — tie off before he
wakes."**

## Shape

- **Opening.** The patch is three layers — **topsoil · mud · the root** — each
  6 × 5 tiles, every tile **2 deep**. You see one layer at a time. The Great
  Hungerer sleeps at the edge: *snoring* in topsoil, *stirring* in the mud,
  *one eye open* at the root. Topsoil is safe.
- **Three verbs, a ladder of quiet.** **Sniff** (know) · **Rub** (take a
  little) · **Shove** (take a lot, loudly). No stir budget; the cost of an
  action is noise — its chance of waking him.
- **The one decision.** At any moment: **Tie it off** (bank the layer's loose
  truffle, dig over) or **Dig deeper** (the next layer: fatter finds, rarer
  things, a lighter sleeper). Crossing a layer **banks everything loose** —
  each layer stakes only its own truffle.
- **Pressure.** Every action rolls once against the layer's wake odds. His
  face is the meter. He does one thing, once: he wakes and takes the loose
  truffle.
- **End.** Tie · wake · 45 actions (treated as a tie) · window close (treated
  as a tie, server-side).
- **Duration.** 12–30 actions, 40–90 s. A layer's truffle costs ≈ 4 rubs with
  a sniff, ≈ 8 without.

## 1. Rules

### 1.1 Geometry and layout

- `PATCH_COLS 6 × PATCH_ROWS 5`, `PATCH_LAYERS 3`, `TILE_DEPTH 2` (every tile).
- `generateLayeredBoard(seed, uniqueId)` — new in `utils/rooting.ts`. Consumes
  the same first four parity draws as `generateBoard` (L orientation, domino
  orientation, shimmer present, junk kind) so `rooting_finds(seed)` still names
  the base set; every later draw is layout. A layer is generated when entered
  but is fully determined by the seed (the server generates all three).
- **Placement by layer** (the find table, §2): topsoil = domino truffle, Boom,
  junk, 3 stones (+ pouch 1/2, apple 1/3); mud = L truffle, shimmer 1/2,
  acorn 1/2, tea 1/3, scroll 1/3, 2 stones; the root = relic 2/5, furnishing
  1/4, bow 1/12, charm 1/3, 1 stone. Odds are server config
  (`app_settings.dig_finds`) with compiled fallbacks in `constants/dig.ts`.
  Finds never overlap; a layer holds at most 8 finds.

### 1.2 Verbs and the kernel

The kernel is today's `applySplash`, unchanged, floored at 0:

| verb | input | the tile | 4 neighbours | moves mud | wake roll |
| --- | --- | --- | --- | --- | --- |
| **Sniff** | tap with Sniff selected | marks scent (§1.3) | — | no | mud and root |
| **Rub** | tap / brush | −1 | −½ | yes | yes |
| **Shove** | hold 400 ms | −2 | −1 | yes | yes |

- A **half-cleared tile** (depth ≤ 1) shows the silhouette of what is under it
  (`gildedSilhouetteDepth` as today, now at depth 1).
- On 2-deep tiles two adjacent **rubs** leave both at ½ (the second's
  half-splash only halves the first); a third rub finishes both, so a domino
  is 3 rubs and an L is 5. Two adjacent **shoves** clear a strip. Accepted:
  the sniff's value is skipping empty tiles, not the rubs.
- **No-ops.** Any verb on a cleared tile, a sniff on an already-sniffed tile,
  or an action on an out-of-bounds neighbour is a no-op: no action counted,
  no roll drawn, no log entry.
- Every non-no-op verb is **one action** (toward the 45 cap) and **one entry
  in the action log** (`s2:14` / `r2:14` / `h2:14` = sniff / rub / shove,
  layer 0–2, tile 0–29).
- **The waking action lands first, then rolls.** A thing revealed on the
  waking action is kept; a truffle uncovered on it goes straight to *missed*.

### 1.3 Scent

- `scentAt(layer, idx)` = the number of **find tiles** in the 3 × 3 around
  `idx` (itself included) **in the current layer**. Every find counts —
  truffle tiles, and every thing's tile. Stones never count. Buried,
  half-cleared and cleared tiles all count. Range 0–9; typical 0–3.
- A sniffed tile wears its number until the layer is left. Sniff once per
  tile per layer.
- Scent is exact. The number never lies.

### 1.4 The wake stream

- `wakeStream = new Minstd((seed × 7919) mod 2147483647)`; the k-th
  non-no-op action draws the k-th `nextInt(120)` and wakes him when the draw
  is below the threshold. Client and server replay the same stream.

| layer | sniff | rub | shove |
| --- | --- | --- | --- |
| topsoil | 0 (truly never) | 1 | 10 |
| mud | 3 | 6 | 20 |
| the root | 7 | 15 | 40 |

(in 120ths: topsoil rub 1 in 120 · shove 1 in 12 · mud sniff 1 in 40 · rub 1
in 20 · shove 1 in 6 · root sniff ≈ 1 in 17 · rub 1 in 8 · shove 1 in 3.)

- **Co-op.** When a crewmate has submitted this Feeding, the root's **sniff
  and rub** thresholds halve (7 → 4, 15 → 8; integer floor + 1). Shove is
  unchanged. Nothing else in the game changes with co-op.
- **Sniff and rub always cost a little.** Every sniff and every rub spends
  an action and takes a discovery roll; below topsoil their threshold is
  never 0 — a sniff is half a rub at every layer. The one 0 is the topsoil
  sniff: in topsoil a sniff truly never wakes him, so the nose is learned on
  the tutorial layer at the price of actions only. (Amended 2026-09-13 from
  "never in topsoil or the mud".)

### 1.5 Loose, banked, food, things

- **Food is truffles, only.** A layer's truffle cluster, once uncovered, is
  **loose** — his if he wakes — until it is banked.
- **Everything else is a thing** (Boom, shimmer, acorn, tea, scroll, apple,
  pouch, keepsake, furnishing, bow, charm, relic): yours the moment its last
  tile clears; paid on reveal through its own path; never at stake.
- **Banking happens three ways:** *Tie it off*; **crossing a layer** (*Dig
  deeper* banks the loose truffle first — bank on descent); the 45-action
  cap or a window close (treated as a tie).
- **Wake:** the *current layer's* loose truffle is not credited; it goes to
  `user_patch_carry` at gild 1 (or bumps) via the existing `p_missed` path —
  he re-buries it, gilded, next Feeding. Everything banked in earlier layers
  and every thing found is untouched. `+20 Pass XP` is paid; the dig counts
  as submitted.
- Topsoil cannot wake on a sniff; a topsoil rub is one in a hundred and
  twenty, so a topsoil-only dig is nearly, not perfectly, safe.

### 1.6 Dig deeper, tie, end

- **Dig deeper** is available at any time in topsoil and the mud — no gate.
  It banks the loose truffle, marks the layer's touched-but-uncollected
  clusters as *missed* (carry-eligible), abandons the untouched ones, and
  enters the next layer with the layer's scent marks cleared.
- **Tie it off** is available at any time. It banks the loose truffle and
  submits.
- **End conditions**, exactly: tie · wake · 45th action (= tie) · window
  close with the dig open (= tie, server-side; the client shows the stored
  receipt on reopen). Nothing else. `afterReveal`'s *both truffles → finish()*
  is deleted.
- **The Hungerer's face** is a function of the layer (snoring · stirring ·
  one eye open) and flips to *awake* on a wake. It is not a bar.

### 1.7 Modes

- **Crewed dig** — everything above; one per Feeding; mints Golden Truffles.
- **Uncrewed dig** — the same board and rules for a player with no Sounder.
  Pays every **thing** (Booms, acorns, tea, scrolls, apples, pouches,
  keepsakes, furnishings, bows, charms, relics), winds regen, pays +20 XP.
  **Mints no Golden Truffles, earns no Sounder Bonus, counts no race find.**
  The receipt carries *truffles are for herds — find yours ›* to the join
  path. This replaces the hidden practice dig; `dig_practice_visible()` is
  gone.
- **Reduce Motion** — layer swaps crossfade; the wake beat is one frame; no
  wobble on the face.

## 2. Finds

Every row is a Field Guide entry (silhouette until met). Stones are inert.
**Food** = truffles (loose until banked); **things** are kept on reveal.

| layer | find | kind | pays | odds / board | path |
| --- | --- | --- | --- | --- | --- |
| topsoil | domino truffle (2 tiles) | food | +1 GT (`'dig'`), race find | 1 | `mint_truffles` |
| topsoil | **Tickle Boom** | thing | applied tickles `3 + boom(H)` (§4) | 1 | auto-apply rule (`20260812010000`) |
| topsoil | snout pouch | thing | +15 snouts | 1 in 2 | `profiles.counter` |
| topsoil | windfall apple | thing | Rosie +8 happiness | 1 in 3 | `apply_happiness` |
| topsoil | his old boot · bent horseshoe · bottle cap | thing | a **shelf keepsake** (surface_decor); dupes +10 snouts | 1 (one of three) | `grant_habitat_item(uid, id, 'dig', uid:window)` |
| mud | L truffle (3 tiles) | food | +1 GT (`'dig_deep'`), race find | 1 | `mint_truffles` |
| mud | shimmer pocket | thing | +1 Mote | 1 in 2 | existing |
| mud | **Clockwork Acorn** | thing | one day of Auto-Tickler charge | 1 in 2 | Contraption Inventory (`20260829`) |
| mud | flask of warm tea | thing | `warm_tea` on yourself, 8 h | 1 in 3 | `blessings` (self, `source='dig'`) |
| mud | Pass XP scroll | thing | +40 Pass XP | 1 in 3 | season progress |
| the root | relic | thing | Burrow Book | 2 in 5 | existing |
| the root | **Unearthed furnishing** | thing | a dig-only Barn piece; dupes +50 snouts; pity on the 4th root tie without one | 1 in 4 | `grant_habitat_item` |
| the root | a buried bow | thing | one of three dig-only cosmetics | 1 in 12 | hats grant |
| the root | bless charm | thing | one free blessing to send | 1 in 3 | `blessings` on send |
| the root | (no truffle) | — | the root tie pays `'dig_root'` +1 GT when the mud truffle was banked | — | `mint_truffles` |

- **Why the Boom is in topsoil.** The catch-up is never at stake; pushing
  deeper is for the herd's race and the Barn, not to protect the handicap.
- **The *Unearthed* collection.** A new `habitat_collections` row, ~12
  `habitat_items` across all six slots, `is_for_sale false`, rarity `rare`.
  Ships in two halves (§11).
- **Race finds and the meter** count **truffles only** (things are yours, not
  the herd's). The Dig-Off ladder and `hunger_meter()` are untouched.

## 3. Sounder

- **Before.** Feeding card lists who has dug and the layer they tied at
  (*Jen · tied at the mud* / *woke at the root* / *not yet*).
- **During.** Co-op = the root's sniff and rub odds halve (§1.4). One lever.
- **After.** Sounder Bonus unchanged: a tied dig that minted a truffle gets
  +1 `'dig_echo'` when another member submitted this Feeding, either order;
  the earlier member is paid back. A woken dig counts as submitted for the
  crewmate's bonus but earns none itself. The share card gains the layer.
- No new social act in this pass; B's marker/nudge stay in B's spec.

## 4. Economy and the catch-up

- **Per outcome.** Tie at topsoil: +1 GT if the domino was found. Mud: +1 GT
  per layer's truffle banked (`'dig'` + `'dig_deep'`). Root: `'dig_root'` +1
  when the mud truffle was banked (the root has no truffle of its own), so a
  full run is **+3 GT**. Wake: the current layer's truffle lost (carried
  gilded); earlier layers' GT already minted; +20 XP. Sounder Bonus and
  `'blessed_dig'` +1 each as today. Uncrewed: 0 GT, everything else.
- **Back of envelope.** Today ≈ 0.85 GT/dig. Topsoil tie ≈ 0.9; push to mud
  and tie ≈ 0.66 survival × 2 + 0.34 × 1 (topsoil already banked) ≈ 1.66;
  push to root ≈ 0.34 × 3 + 0.32 × 2 + 0.34 × 1 ≈ 2.0 GT. **Sim (2,000
  seeds, priced sniff):** nose 3.87 finds · 1.76 GT · 69 % woke · 74 % of
  root pushes survive five actions; blind 3.79 · 1.34 · 93 % · 52 %; mud-tie
  EV 1.45. Bank-on-descent raises the faucet; the Exchange's prices (25–500
  GT) are re-checked in §11 step 6 and `'dig_root'` may drop to 0 if the sim
  says so.
- **Closed economy.** Every mint server-side via `mint_truffles` (999 cap,
  ledgered, reasons `'dig'` · `'dig_deep'` · `'dig_root'` · `'dig_echo'` ·
  `'blessed_dig'`); things through their own idempotent paths keyed
  `(uid, window_index)`. Nothing is taken: a wake takes an unbanked truffle
  that returns gilded.
- **The catch-up** (unchanged from the 2026-09-13 ruling):

```
L      = active leader's tickles earned over the trailing 14 days ÷ 14
L_full = 24 + F·3                          (F = Feedings/day, 3)
pace   = clamp(L / L_full, 0, 1)
D      = T_leader − T_you                  (frozen at cycle start / join)
H_day  = min(k · pace · D / 28, H_max)     k = 0.75 · H_max = 3·L_full = 99
boom(H)= 0.6 · H_day / F                   (delivery — the topsoil Boom)
regen  = base / (1 + 0.4 · H_day / 24)     for the 8 h after a submitted dig
```
  28-day cycles at a fixed UTC boundary; newcomer ramp ×0.25/0.5/0.75/1 over 7
  days; applied tickles are never bankable or tradeable; VIP/blessings/curses
  touch base regen only. The uncrewed dig pays the Boom and winds regen.

## 5. Surfaces

Screens as on the *Snout Deep* canvas (1–10). All copy in TTP voice; the
dialogs on the reveal family's Ledger sheet.

1. **Entry.** Barn button's shovel face while the patch is open →
   `useFeedingCta.start()` → the dig in place. Uncrewed players get the same
   face and the same dig.
2. **Dig screen, top → bottom** (patch ≥ 60 %): back chip + sign (*the truffle
   patch · Feeding* / *closes in 2h 10m*) with the Hungerer top-right and his
   tag (*snoring* · *stirring* · *one eye open* · *HE WOKE.*); the layer strip
   (done = sage · now = sun · below = cream); the patch (6 × 5, 55 × 52 pt
   tiles: buried mud · half-cleared with a silhouette · cleared with the
   find; scent as a paper disc with a hand numeral on the tile's corner; a
   rose rim on the patch at the root); the whisper strip; the pouch (*loose ·
   his if he wakes* / *tied · yours for keeps*); the footer (*Tie it off* ·
   *Dig deeper*; at the root *Tie it off · +N Golden Truffles* is the gold
   primary); the verb bar (*Sniff · Rub · Shove*, sub-labels *free · quiet ·
   loud* in topsoil, *quietest · quiet · loud* in the mud and at the root;
   the selected verb on sun; hold-to-shove works regardless).
3. **Reveal.** A thing surfaces with a full-width sticker the moment its tile
   clears (*a Tickle Boom · +19 tickles, yours*; *a Rusty Lantern · new for
   the Barn*; *a Clockwork Acorn · a day of the Auto-Tickler*) and lands in
   the *tied* well; a truffle lands in *loose*.
4. **Whispers** teach rules and say *that* something is near, never what:
   *topsoil. a sniff counts the finds touching a tile. a rub moves a little,
   a shove a lot. nothing quiet wakes him here.* · *a 3 beside a 1 — the truffle runs
   one way. follow the bigger number.* · *the mud. fatter down here — and he
   sleeps lighter. a sniff is the quiet way to know: one in forty stirs him.
   a rub, one in twenty.* · *one rub in twenty stirs him here. one sniff in
   forty. nothing here is free.* · *the root. a 1 on its own is usually a
   thing, not a truffle. one rub in eight wakes him now. one sniff in
   seventeen.*
5. **The decision** (layer-clear sheet, Ledger): kicker *layer one is clear*,
   title *A truffle, loose in the pouch.*, count *dig deeper banks it — the
   next layer stakes only its own*; rows *Tie it off · +1 Golden Truffle · +20
   Pass XP · done | safe* and *Dig deeper · the mud · fatter truffles, acorns,
   tea · he stirs at one rub in twenty | 1 in 20*; primary *Dig deeper*;
   secondary *tie it off instead ›*. The sheet is offered when a layer's
   truffle banks; both controls stay in the footer at all times.
6. **Pressure.** No sheet: his face, the tag, the whisper; at the root the
   rose rim and *Tie it off* as the primary.
7. **Payoff, tied** (Ledger receipt): title *Tied off at the root*, count
   *three layers · 23 actions · he slept through it*, one row per thing and a
   truffles row with the GT value, XP row; primary *Back to Barn*; secondary
   *share the dig ›*. Uncrewed: the truffles row reads *truffles are for herds
   — find yours ›* and is the secondary.
8. **Payoff, woke**: title *He woke.*, his face awake, a hand line naming the
   action (*pushed past the mud on a shove. one in six — this was the one.*),
   rows *the fat one · his — gilded next Feeding*, the things kept, XP;
   primary *Back to Barn*; hand line *next time — tie it at the mud?*
9. **Back on the Barn**: the button's face flips to the door; a yard note
   *dug this Feeding · tied at the root · next patch opens in 5h 50m*.
10. **Season tab.** Feeding card line per member: *tied at the mud* / *woke at
    the root* / *not yet*; Hunger meter unchanged; the Rankings tab's one
    catch-up line.

## 6. Server sketch

- **Migration** `20260916100000_snout_deep.sql`, flag `dig_snout_deep_on()`
  default false.
- `war_rootings += layer_tied smallint, woke boolean, action_log text[],
  uncrewed boolean`.
- `open_rooting()` returns `mode: 'snout_deep'`, the seed, `coop` (a
  crewmate submitted), `uncrewed`, and the find odds. Uncrewed players may
  open (today's crew gate becomes a `mode` flag on the row).
- `submit_rooting_deep(p_actions text[], p_layer_tied smallint, p_finds
  text[], p_missed text[])`: replays the wake stream over `p_actions`
  (no-ops are not in the log; the server rejects a log with an action on a
  cleared tile as `bad_log`); the first waking index truncates the log; finds
  claimed after it are `bad_finds`; a wake forces the current layer's truffle
  out of `p_finds` and into the carry path; mints by layers banked (`'dig'`,
  `'dig_deep'`, `'dig_root'`); routes things through their paths; `uncrewed`
  rows mint no GT and write no race find. Carries the `20260913010000`
  durable-receipt body (the carry-latest-def footgun applies).
- **Window close.** A cron at window end submits every open `snout_deep`
  row as a tie at its current layer from its last synced log (`sync_rooting`
  writes the log every 5 actions and on background).
- **Fairness.** Seed-keyed wake stream; one row per `(user_id,
  window_index)`; idempotent re-submit returns the stored receipt; the
  uncrewed flag is server-derived from crew membership at open, never
  client-sent.
- **Untouched:** `utils/digSession.ts` (session, dug-window stamp, mirror
  key, reconcile debounce — the practice lockout gate is removed with the
  practice dig), `utils/feedingClock.ts`, `useFeedingCta`.

## 7. Client sketch — the reducer's contract

The dig is a pure `(state, event) → state` machine in `utils/snoutDeep.ts`,
mirroring `utils/digSession.ts`'s idiom, so every rule above is a unit test
and the UI is a renderer.

```ts
// utils/snoutDeep.ts
export type Verb = "sniff" | "rub" | "shove";
export type Layer = 0 | 1 | 2;                       // topsoil · mud · the root
export type FindKind =
  | "truffle_d" | "truffle_l" | "boom" | "pouch" | "apple" | "junk"
  | "shimmer" | "acorn" | "tea" | "scroll"
  | "relic" | "furnishing" | "bow" | "charm" | "stone";

export interface Find { id: string; kind: FindKind; tiles: number[]; food: boolean }
export interface LayerBoard { depths: number[]; finds: Find[] }      // 30 depths, 2 → 0
export interface SnoutDeepBoard { seed: number; layers: [LayerBoard, LayerBoard, LayerBoard] }

export interface SnoutDeepState {
  board: SnoutDeepBoard;
  layer: Layer;
  depths: number[];                 // the current layer's live depths
  scent: (number | null)[];         // per tile, this layer
  actions: string[];                // the log: "s2:14" · "r2:14" · "h2:14"
  wakeIndex: number;                // draws consumed
  loose: string | null;             // the current layer's truffle id, if uncovered and unbanked
  banked: string[];                 // find ids banked (truffles) — across layers
  things: string[];                 // find ids revealed (things) — across layers
  missed: string[];                 // touched-but-uncollected cluster ids left behind
  layersTied: Layer[];              // layers whose truffle banked (for GT reasons)
  coop: boolean;
  uncrewed: boolean;
  ended: null | { reason: "tie" | "wake" | "cap" | "close"; layer: Layer; wokeOn?: string };
}

export type SnoutDeepEvent =
  | { type: "act"; verb: Verb; tile: number }        // no-ops return state unchanged
  | { type: "descend" }                              // Dig deeper
  | { type: "tie" }
  | { type: "close" };                               // window closed (server tie)

export function initialState(board: SnoutDeepBoard, opts: { coop: boolean; uncrewed: boolean }): SnoutDeepState;
export function reduce(state: SnoutDeepState, event: SnoutDeepEvent): SnoutDeepState;
export function scentAt(layer: LayerBoard, tile: number): number;
export function wakeThreshold(layer: Layer, verb: Verb, coop: boolean): number;   // in 120ths
export function isNoOp(state: SnoutDeepState, verb: Verb, tile: number): boolean;
export function revealed(state: SnoutDeepState): Find[];      // clusters fully at depth 0 this layer
export function receipt(state: SnoutDeepState): DigReceipt;   // what the payoff sheet renders
export function simulateSnoutDeep(seed: number, policy: Policy): SimResult;   // for tuning
```

| file | change | size |
| --- | --- | --- |
| `utils/rooting.ts` | `generateLayeredBoard`, `WakeStream` (Minstd over `seed × 7919`), `layerFindTable` | M |
| `utils/snoutDeep.ts` | the reducer above + `receipt` + `simulateSnoutDeep` | L |
| `constants/dig.ts` | `PATCH_LAYERS 3`, `TILE_DEPTH 2`, `SNOUT_DEEP_ACTION_CAP 45`, the wake table, `DIG_FINDS` fallback odds | S |
| `components/mudwar/SnoutDeepPatch.tsx` | the dig screen: header (Hungerer face + tag), `LayerStrip`, the tile grid (`Pressable` tiles for the web try-out; the Skia `LivingMudSurface` follows), whisper, pouch, footer, verb bar; `FindReveal` sticker | L |
| `components/mudwar/SnoutDeepSheets.tsx` | the decision sheet, the tied and woke receipts, on `RevealSheet`/`LedgerRow` (or the interim ledger markup until the primitive lands) | M |
| `components/mudwar/Hungerer.tsx` | the face (snoring · stirring · one eye open · awake), SVG, motion-policy aware | S |
| `components/mudwar/useFeedingCta.tsx` | opens `SnoutDeepPatch` when `mode === 'snout_deep'`; uncrewed lane | S |
| `hooks/useRooting.ts` | `submit_rooting_deep`, `sync_rooting` every 5 actions, restore from `{ layer, actions }` | M |
| `utils/digShare.ts` | the layer on the share grid | S |
| `app/snout-deep-preview.tsx` + `components/dev/screens/snout-deep-preview.tsx` | dev route: a full local dig on a fixed seed, no server (`?seed=` · `?coop=1` · `?uncrewed=1` · `?motion=reduced`); how the founder tries it on web | S |
| `utils/digSession.ts`, `utils/feedingClock.ts` | untouched (practice lockout removed) | — |

Survives: kernel (`applySplash`, cluster queries, `Minstd`), session reducer,
feeding clock, share, progress save/restore (snapshot = `{ layer, actions }`;
restore replays through `reduce`).

## 8. Tests

- `__tests__/snoutDeep.test.ts` — the reducer, one case per rule: sniff marks
  and never rolls in layers 0–1; root sniff rolls at 7 (4 co-op); no-ops
  change nothing and consume no draw; rub/shove apply the kernel and floor at
  0; a truffle uncovers → `loose`; descend banks `loose`, clears scent, marks
  missed; tie banks and ends; the 45th action ends as `cap`; a wake ends with
  `loose` in `missed` and things intact; things reveal into `things` on any
  layer and survive a wake; `close` ends as tie; scent counts every find and
  no stone; `wakeThreshold` table; a replay of `actions` from `initialState`
  reproduces the end state (determinism).
- `__tests__/generateLayeredBoard.test.ts` — parity with `rooting_finds(seed)`
  for the first four draws; per-layer placement matches the find table; no
  overlaps; ≤ 8 finds per layer; all three layers from one seed.
- `__tests__/snoutDeepSim.test.ts` — `simulateSnoutDeep` over 2,000 seeds:
  ≥ 60 % of root pushes survive five actions; mud-tie EV within ±0.4 GT of
  the §4 figure; a sniff-first policy beats a blind policy on finds.
- `__tests__/snoutDeepReceipt.test.ts` — the receipt's rows for tie / wake /
  uncrewed, including the GT reasons per layers tied.
- Existing: `barnDigEntry.test.ts` (entry via the Barn button), `digSession.*`
  unchanged, `motionPolicy.test.tsx` gains `Hungerer.tsx`.

## 9. Acceptance criteria

1. On the dev route, a full dig on a fixed seed plays end to end on the web
   target and the sim with no server: sniff, rub, shove, descend, tie, wake,
   cap, and the three sheets.
2. Topsoil sniffs never end a dig; over 1,000 seeded actions per layer the
   wake rates match the table within ± 1 % — topsoil rub 1/120, mud sniff
   3/120, root sniff 7/120 (4/120 with `coop`).
3. Descending banks the loose truffle: a wake in the mud never removes a
   topsoil truffle from `banked`.
4. Every thing revealed before a wake is in `things` after it.
5. Scent on any tile equals the count of find tiles in its 3 × 3, stones
   excluded; a `0` tile has no find in its 3 × 3.
6. Two adjacent rubs on buried tiles leave both at depth ½; a third rub on
   either clears both. Two adjacent shoves leave both at 0.
7. An action on a cleared tile changes nothing: same state object.
8. `receipt(state)` matches the canvas's rows for tie and woke.
9. Uncrewed: `receipt` carries no GT and the join line; `things` pay.
10. Replaying `state.actions` from `initialState` yields an equal state.
11. Reduce Motion: no wobble, one-frame wake.
12. Scorecard 0, `eslint --quiet` clean, jest green, `tsc` clean.

## 10. Edge cases

- **Kill mid-dig:** the snapshot is `{ layer, actions }`; restore replays.
  If the window closed meanwhile, the server has already tied the row; the
  client shows the stored receipt.
- **Descend with the truffle unfound:** allowed; the layer banks nothing;
  the Feeding card still reads the layer tied at.
- **Descend at the root:** not offered (there is no fourth layer); the
  footer shows *Tie it off* only.
- **Wake on the 45th action:** the wake wins (the roll happens before the
  cap check).
- **Co-op flips mid-dig** (a crewmate submits while you dig): thresholds
  update from the next action; the server replays with the co-op flag as of
  each action's server time — simpler: the client's `coop` at open is what
  the server uses (`coop_at_open` stored on the row). Chosen: at open.
- **Two clusters reveal on one shove:** both bank/reveal; one is the truffle
  (loose), the other a thing.
- **Boom size when `H = 0`:** 3 tickles; still applied on reveal.
- **Reduce Motion + a wake:** the face flips in one frame; the receipt
  crossfades.

## 11. Order of work

1. **Kernel + reducer + sim** — `generateLayeredBoard`, `WakeStream`,
   `utils/snoutDeep.ts`, the three test files; thresholds locked by the sim.
   No UI. (M)
2. **Client on the dev route** — `SnoutDeepPatch`, `Hungerer`, the sheets,
   `FindReveal`, `app/snout-deep-preview`. Plays fully offline. **This is the
   founder's try-out on the web target.** (L)
3. **Server** — migration, `submit_rooting_deep`, the close cron, `sync`; flag
   off; local Docker harness; founder "go" before push. (M)
4. **Wire the real entry** — `useFeedingCta` → `SnoutDeepPatch` when the flag
   is on; `useRooting` submit/sync/restore; uncrewed lane. (M)
5. **Finds** — grant wiring per path, `app_settings.dig_finds`, Field Guide
   entries, the first half of the *Unearthed* collection (6 pieces) + 3
   keepsakes. (M/L, art lane)
6. **Catch-up** — cycles/handicaps tables + cron, Boom via the auto-apply
   rule, wound regen; Exchange price check against the raised faucet. (M)
7. **Flag on for the dev crew**, one Feeding of telemetry (tie layer, wake
   rate by verb, sniff count), then all. Second half of *Unearthed*.

## 12. Decision log (2026-09-13)

- A over B and C; C's sniff verb folded in; tiles 2 deep so a rub half-clears.
- Bank on descent: each layer stakes only its own truffle.
- Sniff and rub always cost a little: topsoil sniff 0 (truly never) · rub 1;
  mud sniff 3 · rub 6; root sniff 7 · rub 15 (co-op 4 · 8). Amended
  2026-09-13 from "never in topsoil or mud".
- Scent counts every find tile; stones never.
- The whisper says *that* something is near and teaches rules; never names a thing.
- Kernel unchanged; actions on cleared tiles are no-ops (no action, no roll).
- Window close mid-dig: the server closes the dig as a tie.
- Truffles are the only food; everything else is a thing, kept on reveal.
- The uncrewed player digs: things, Booms and wound regen yes; GT, Sounder Bonus, race finds no. The hidden practice dig is gone.
- Dig deeper is available any time, no gate.
- Co-op halves the root's sniff and rub odds; that is the one co-op lever.
