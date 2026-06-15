# OpenAI / ChatGPT — Mud War loot-box items (Batch 1)

> **Status (2026-06-14) — generated, sliced, wired (unpushed).** All 5 strips
> generated; raw strips in `assets/images/hats/_mudwar_raw/` (+ `_contact_sheet.png`).
> `scripts/slice_mudwar.py` sliced **21 clean items** → `assets/images/hats/<id>.png`
> (15 items) + `assets/images/backgrounds/<id>.png` (6 bgs), registered in
> `constants/hats.ts` `HAT_IMAGES`, with catalog rows in
> `supabase/migrations/20260650000000_mud_war_cosmetics.sql` (`cost=0` = not-for-sale,
> war-exclusive; **unpushed**). `tsc` + 247 jest green.
> **All 4 festival accessories now wired** (**25 items total**): `rosette_cap` /
> `prize_sash` / `festival_pennant` were recovered from Strip 5's baked checkerboard
> via a luminance+saturation key, and `confetti_aura` had its abutting night-bg scene
> cut by `slice_mudwar.night_cut` — a dynamic dark-column boundary (the confetti sits
> on bright white ~240, the scene is dark ~120) instead of the old fixed-fraction trim
> that leaked a ~42px sliver. It renders `resizeMode="contain"`, so the portrait ring
> (239×339) fits the 300×300 aura box without distortion. **Per-item overlays computed**
> — `compute_overlays.py` run via a throwaway `.venv-tools` numpy venv (gitignored),
> with the new items merged in so existing overlays are byte-for-byte unchanged. `tsc`
> + 247 jest green. **Only the DB push remains** — user-gated per the DB-push rule
> (stacks after `20260647`/`648`/`649`).

New war-exclusive cosmetics for the async Mud Wars loot boxes (see
`docs/wiki/outputs/memos/mudwar-war-spoils-items.md`). Same pipeline + house style
as `docs/openai-accessory-prompts.md` — flat storybook, 3px outline, transparent,
5-cell strips (1280×256, each cell 256×256), sliced to `assets/images/hats/<id>.png`
then `python3 scripts/compute_overlays.py` + a `public.hats` catalog row each.

**This is the FIRST batch (~20 items, 4 strips + a set).** Volume comes later from
*multipliers* (recolor each base in 6–10 mud-tones; new themed sets), not more unique
art — per the item-system research. Theme: **mud / swamp / bog / a friendly mud
DERBY** (cozy contest, not combat). Rarity tier noted per item:
Muddy (common) → Caked (uncommon) → Prize (rare) → Champion (epic) → Heirloom (legendary).

## Style anchor (paste once — same as the accessory brief)

```
I'm going to ask you to generate sprite-sheet images of cosmetic accessory items
for a 2D mobile game. NO characters, NO pigs, NO people — only the items.
Style: flat children's storybook illustration, bold ~3px black outline, soft
saturated colors, simple readable shapes, NO drop shadows / glow (unless the item
IS an aura), pure transparent background. Layout: a 5-cell horizontal strip,
1280×256, each cell 256×256, item centered, small consistent margin, no labels /
numbers / gridlines / separators. Confirm, then I'll send the first batch.
```

---

## Strip 1 — Mud Hats (5 items, front-facing paper-cutout, NO back-of-brim, NO head)

```
MUD-WAR HATS: a 5-cell strip. SAME rules as the accessory hats — flat 2D front
view, paper-cutout silhouette, NO back-of-brim, NO wrap-around band, NO head.
1. Muddy cap — a brown newsboy/flat cap splattered with wet mud flecks  [Muddy]
2. Slop-bucket hat — an overturned wooden slop bucket worn as a hat, a
   drip of mud over the brim  [Caked]
3. Reed conical hat — a woven swamp-reed cone hat, a few green reeds poking up [Caked]
4. Bog helmet — a dented iron derby helmet caked in dried mud, a tiny moss patch [Prize]
5. Swamp crown — a gold crown caked in dried mud with a glossy moss-and-toadstool
   accent, front half only (no wrap-around band)  [Champion]
Transparent background.
```

## Strip 2 — Mud Held items (5 items, side angle, designed to be held in a paw)

```
MUD-WAR HELD ITEMS: a 5-cell strip of objects held in a paw, side angle.
1. Slop bucket — a small wooden pail brimming with brown slop (ties to the
   Pass-the-Slop-Bucket mechanic)  [Muddy]
2. Mud shovel — a dirt-caked garden shovel (ties to the Truffle Hunt)  [Muddy]
3. Mud pie — a round wobbly mud pie on a little tin, a cherry on top  [Caked]
4. Golden truffle — a shiny prize truffle, faint sparkle marks  [Prize]
5. Crew pennant — a tiny triangular felt banner on a reed pole, a pig-snout
   emblem (the friendly-derby flag)  [Prize]
Transparent background.
```

## Strip 3 — Mud Auras (5 items, circular glow, no character inside)

```
MUD-WAR AURAS: a 5-cell strip of circular aura effects (glow allowed — these ARE
auras). Roughly circular, no character inside, transparent background.
1. Mud-splatter aura — brown mud flecks flung outward in a ring  [Muddy]
2. Swamp-bubble aura — green swamp bubbles rising/popping around a ring  [Caked]
3. Firefly aura — tiny warm glowing fireflies orbiting a ring  [Prize]
4. Golden-bog aura — radiant gold-flecked mud glow with soft light rays
   (Champion / animated apex later)  [Champion]
5. Heirloom mire aura — shimmering iridescent swamp mist with drifting petals
   and gold motes (Heirloom / evolving apex)  [Heirloom]
Transparent background.
```

## Strip 4 — Mud Backgrounds (5 items, full square scene, NOT transparent)

```
MUD-WAR BACKGROUNDS: a 5-cell strip of square 256×256 scenes, each cell fully
filled (NOT transparent). No characters.
1. Mud pit — a simple churned mud wallow under a clear sky  [Muddy]
2. Reed marsh — tall green reeds and still water, soft daylight  [Caked]
3. Mud Derby grounds — a festive mud arena with colorful bunting, hay bales and
   little flags (the friendly-contest vibe)  [Prize]
4. Bog at dusk — a misty swamp at golden sunset, fireflies  [Champion]
5. Golden Mire — a glowing prize-winning swamp, gilded reeds and warm light
   (Heirloom / animated apex later)  [Heirloom]
Each cell completely filled with its scene; no borders between cells.
```

## Set — "Swamp King" (completion-only capstone; spans strips above)

The Swamp King set is the first set-completion reward (War Spoils: finish the set
across wars → a set-exclusive animated effect you can't buy à la carte). Its members
are drawn from the strips above so they read as a matched suite:
- **Hat:** Swamp Crown (Strip 1 #5)
- **Held:** Crew Pennant (Strip 2 #5) — or a dedicated King's Scepter (reed + gold)
- **Aura:** Golden-bog aura (Strip 3 #4)
- **Background:** Golden Mire (Strip 4 #5)
Completion bonus: promote the aura to its animated Heirloom variant (Phase 2).

---

## After generation
Slice each strip → `assets/images/hats/<id>.png` (ids: `muddy_cap`, `slop_bucket_hat`,
`reed_hat`, `bog_helmet`, `swamp_crown`, `slop_bucket`, `mud_shovel`, `mud_pie`,
`golden_truffle`, `crew_pennant`, `mud_splatter_aura`, `swamp_bubble_aura`,
`firefly_aura`, `golden_bog_aura`, `heirloom_mire_aura`, `mud_pit_bg`, `reed_marsh_bg`,
`mud_derby_bg`, `bog_dusk_bg`, `golden_mire_bg`), then `compute_overlays.py`, then a
`public.hats` row each (`war_exclusive=true`, `war_season='s2_mud_derby'`, `rarity`,
`set_id` for the Swamp King members). Recolor-variant pass (each hat × 6–10 mud-tones)
is the cheap volume multiplier — detailed below.

---

## Full pool — generate anchors, multiply with recolors

> **Sending note (learned the hard way):** paste each strip into ChatGPT as a **SINGLE LINE**
> — newlines submit early and split the message. Re-assert "items only, NO pig, pure
> TRANSPARENT background (not white)" each time (ChatGPT's "Rosie" memory can bleed a
> white-background full-body pig into accessory prompts). Use a **dedicated fresh ChatGPT tab**
> so it can't collide with other work.

Two cost classes. **ChatGPT generates the base anchors** (Strips 1–5 = ~25 distinct items ≈
5 image-gens). **Recolors are a cheap editing pass** — hue-shift / palette-swap the base PNGs,
**NO new ChatGPT generation, no quota** — and that's where the *volume* comes from ("volume
from multipliers, not more art"). One clean session ≈ 25 anchors + ~34 recolors ≈ **~60 SKUs**,
repeating per season/set → hundreds over time. Reserve fresh generations for the **apex**
(Champion/Heirloom bespoke + animated) tiers where a recolor won't read as special.

## Strip 5 — "Mud Derby Festival" set (second themed set, ChatGPT-generated)

The celebratory set — reinforces the friendly-DERBY framing (not war). Prize→Champion tier;
completing the set animates the confetti aura (Phase 2). Send as one line:

```
MUD DERBY FESTIVAL — generate the 5-cell sprite strip now. Items only, NO pig, NO head; pure TRANSPARENT background (not white); flat 2D paper-cutout front view. The 5 items: (1) Rosette cap — a flat cap pinned with a big blue prize-rosette ribbon; (2) Prize sash — a winner's sash with a rosette, front-facing crescent only (no wrap-around); (3) Festival pennant — a pole strung with colorful triangular bunting flags, held from the side; (4) Confetti aura — a ring of colorful paper confetti mixed with little mud flecks; (5) Festival-night background — a 256x256 FILLED night scene of the derby grounds with strung paper lanterns, bunting, and a warm bonfire glow. No labels; transparent on items 1-4, filled scene on item 5.
```
ids: `rosette_cap`, `prize_sash`, `festival_pennant`, `confetti_aura`, `festival_night_bg`.

## Recolor variants — editing pass, NO new ChatGPT generations

Take the simple single-shape base PNGs and produce N hue-shifted variants via a palette-swap
pass (a small `scripts/recolor.py` over the base PNG, or an editor batch) — **not** new
generations. Each variant is its own `public.hats` row (`rarity` per tier), reading as a
distinct item without redrawing.

**Mud-tone palette (8):** Fresh Mud (warm brown) · Dried Clay (tan) · Bog Green · Peat Black ·
Swamp Teal · Ochre · Rust · Ash Grey. (+ Golden Mud for Prize-tier variants.)

| Base anchor | Recolor variants | Tier | → SKUs |
|---|---|---|---|
| `muddy_cap` | all 8 tones | Muddy (common) | 8 |
| `mud_splatter_aura` | 6 tones | Muddy/Caked | 6 |
| `slop_bucket` | 6 tones | Muddy | 6 |
| `reed_hat` | 5 tones | Caked | 5 |
| `swamp_bubble_aura` | 5 tones | Caked | 5 |
| `mud_pie` | 4 "flavors" (choc/berry/etc.) | Muddy | 4 |

≈ **34 recolor SKUs** from 6 base anchors, zero new generations. Naming: `<base_id>_<tone>`
(e.g. `muddy_cap_bog_green`). Small new tooling: a hue-shift script + a tones table.
