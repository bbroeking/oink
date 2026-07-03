# Season 2 art manifest — Truffle Patch, Mud Wars UI, the Great Hungerer

The complete asset inventory for the Season-2 build, compiled from
`docs/wiki/outputs/memos/mudwar-dig-minigame-2026-07.md` (§4),
`mudwar-progress-views-2026-07.md`, `mudwar-hunger-arc-cadence-2026-07.md`,
`mudwar-rewards-spec-2026-07.md`, and `mudwar-scope-a-weathered-2026-07.md`
(Bog Weather). Paste-ready generation prompts live in
`docs/briefs/s2-art-chatgpt-briefs.md`.

**Sources legend** — `ChatGPT-new`: generate via the icon-gen Chrome flow ·
`recomposite`: derived from existing art by script/crop (no generation) ·
`recolor`: `scripts/recolor.py` over existing item art (free volume) ·
`procedural`: drawn in-code (no asset) · `exists`: already in the repo.

**Anchors** — `STICKER`: the cosmetic-item look (soft glossy hand-illustrated,
chunky, ink outline, white sticker border, transparent bg — match
`assets/images/hats/*`) · `STICKER/glyph`: its single-weight hand-inked variant
with no white border (match `assets/images/glyphs/*`) · `SCENE`: painterly
storybook (match `assets/images/backgrounds/*` + the storyboard work).

New art lands under a new `assets/images/mudwar/` subtree (`patch/`, `fort/`,
`weather/`, `boss/`, `intro/`, `exchange/`).

## P1 — Truffle Patch playable

| # | Asset | Target path | Format | Source | Anchor | Notes |
|---|---|---|---|---|---|---|
| 1 | Mud tile, deep layer | `assets/images/mudwar/patch/tile_deep.png` | 512² opaque square | ChatGPT-new (Sheet B) | STICKER/glyph, borderless | darkest tint = "3 layers left"; must read at 52 px |
| 2 | Mud tile, mid layer | `…/patch/tile_mid.png` | 512² opaque square | ChatGPT-new (Sheet B) | ″ | mid tint |
| 3 | Mud tile, thin layer | `…/patch/tile_thin.png` | 512² opaque square | ChatGPT-new (Sheet B) | ″ | lightest; silhouettes show through it — keep the center low-contrast |
| 4 | Truffle | `…/patch/truffle.png` | 512² transparent | ChatGPT-new (Sheet A) | STICKER | knobbly brown blob; silhouette-first, reads at 40 px |
| 5 | Golden truffle | `…/patch/truffle_golden.png` | 512² transparent | **try reuse** `assets/images/hats/golden_truffle.png`; Sheet A slot as fallback | STICKER | regen only if the hat sticker border reads wrong at 40 px |
| 6 | Stone | `…/patch/stone.png` | 512² transparent | ChatGPT-new (Sheet A) | STICKER | dull grey-brown lump — deliberately boring next to truffles |
| 7 | Old boot (cozy junk) | `…/patch/junk_boot.png` | 512² transparent | ChatGPT-new (Sheet A) | STICKER | the comedy beat ("his boot. why.") |
| 8 | Snack wrapper (cozy junk) | `…/patch/junk_wrapper.png` | 512² transparent | ChatGPT-new (Sheet A) | STICKER | crumpled, HIS size |
| 9 | Truffle pouch icon | `…/patch/pouch.png` | 512² transparent | ChatGPT-new (Sheet A) | STICKER | the Golden-Truffle currency chip, used app-wide |
| 10 | Trough prop | `…/patch/trough.png` | 512² transparent | ChatGPT-new (Sheet A) | STICKER | feeding-strip vignette composites boss sprite + trough in code |
| 11 | Gilded sparkle burst | `…/patch/gild_burst.png` | 512² transparent | ChatGPT-new (Sheet A) | STICKER | golden-echo moment; procedural fallback OK |
| 12 | Boss stir frames ×3 (calm/wary/alert) | `…/boss/stir_{calm,wary,alert}.png` | 512² transparent | recomposite | — | cut from `assets/concepts/great-hungerer/sprites/great_hunger_action_sheet_v2.png` (slurp → gloat → idle) |
| 13 | Shimmer / mote sparkle | — | — | procedural | — | tinted radial sparkles in-code; generate later only if flat |
| 14 | Dig flecks | — | — | procedural | — | tiny mud-tone ellipses |
| 15 | Find silhouettes | — | — | procedural | — | darkened alpha of the item sprite |
| 16 | "His Personal Stash" day-7 dressing | `…/patch/stash_frame.png` | 1024×512 | ChatGPT-new (optional, Batch 6) | SCENE | v1 can ship with a gilded tint instead |

## P2 — war progress surfaces

| # | Asset | Target path | Format | Source | Anchor | Notes |
|---|---|---|---|---|---|---|
| 17 | Fort stamps ×6 (lot→fence→wall→ramparts→gate→flag) | `assets/images/mudwar/fort/stamp_{1..6}.png` | 512² transparent | ChatGPT-new (Sheet C) | STICKER/glyph | hand-inked, stampable line drawings |
| 18 | Ledger knots ×4 (mine/theirs/no-one/pending) | — | — | procedural | — | extend the existing pip styling; optional hand-drawn sheet later |
| 19 | Rival hoard silhouette (distant) | `…/boss/hoard_far.png` | 768×512 transparent | recomposite | — | masked + desaturated from the hoard base (#21) |
| 20 | Bog Weather glyphs ×6 (deep_mud, loose_lids, songbird_gift, thick_fog, echo_verse, fair_skies) | `…/weather/{key}.png` | 512² transparent | ChatGPT-new (Sheet D) | STICKER/glyph | match the `glyphs/` ink look |

## P3 — the Great Hungerer, staged

| # | Asset | Target path | Format | Source | Anchor | Notes |
|---|---|---|---|---|---|---|
| 21 | Hoard mountain base | `assets/images/mudwar/boss/hoard_full.png` | 1024×768 transparent | ChatGPT-new (Batch 5) | SCENE | glowing truffle-and-tickle mountain; all shrink states derive from it |
| 22 | Boss stage vignettes ×6 (Gorged→Famished) | `…/boss/stage_{1..6}.png` | 768² transparent | recomposite | — | v2 sprite pack frames (gloat → idle → tired waddle) + aura shrink via `scripts/soften_aura_edges.py` + crown tilt per stage |
| 23 | Hoard shrink states ×5 | `…/boss/hoard_{80,60,40,20,05}.png` | derived | recomposite | — | mask/scale passes over #21 |
| 24 | Stage chip mini-icons ×6 | — | — | procedural | — | downscaled #22 |
| 25 | Valley color-return bands | — | full-bleed | recomposite | — | staged desaturation masks over `assets/images/backgrounds/golden_mire_bg.png` |
| 26 | Intro modal beat art ×5 | `…/intro/beat_{1..5}.png` | 9:16 crops | exists | — | crop/downscale storyboard shots 1, 2, 4, 6, 7 from `assets/concepts/great-hungerer/storyboard/` |

## P4 — Truffle Exchange + rewards

| # | Asset | Target path | Format | Source | Anchor | Notes |
|---|---|---|---|---|---|---|
| 27 | Exchange banner | `assets/images/mudwar/exchange/banner.png` | 1200×500 | ChatGPT-new (Batch 7) | SCENE | a market stall in the bog |
| 28 | Exchange shelf dressing | `…/exchange/shelf.png` | 1024×256 transparent | ChatGPT-new (Batch 7) | SCENE | rides the banner generation |
| 29 | Recolor SKUs ×16 | `assets/images/hats/…` | 512² transparent | recolor | — | 8 at Exchange open + 8 at week 4, from 6 base anchors (`scripts/recolor.py`, zero quota) |
| 30 | Stage commemoratives ×5 | `assets/images/hats/commem_stage{1..5}.png` | 512² transparent | ChatGPT-new (Sheet E) | STICKER | one per Hunger stage the server crosses |
| 31 | Famished finale exclusive | `assets/images/hats/famished_finale.png` | 512² transparent | ChatGPT-new (Sheet E) | STICKER | the season trophy |

## Batch counts + rate-limit plan

| Batch | Priority | Contents | ChatGPT images |
|---|---|---|---|
| Sheet A | P1 | truffle, stone, boot, wrapper, pouch, trough, gild burst (+golden truffle fallback) | 1 |
| Sheet B | P1 | mud tiles ×3 | 1 |
| Sheet C | P2 | fort stamps ×6 | 1 |
| Sheet D | P2 | weather glyphs ×6 | 1 |
| Batch 5 | P3 | hoard mountain base | 1 |
| Batch 6 | P1-opt | Personal Stash dressing | 1 |
| Batch 7 | P4 | Exchange banner + shelf | 1–2 |
| Sheet E | P4 | commemoratives ×5 + finale | 1 |
| | | **Total ChatGPT-new** | **8–9** |

By source: **ChatGPT-new 8–9 generations** (→ ~25 sliced sprites) ·
**recomposite ~20 files** from 4 script passes · **recolor 16 SKUs** ·
**procedural 5 asset classes** · **exists 5+** (intro beats, boss sprite pack,
golden-truffle item). Free-tier ChatGPT (3–5 images/day) clears P1+P2 in one
day, everything in ~2–3 days; Plus clears it in one sitting. P1 alone (2–3
images) makes the Patch fully playable with real art.
