# OpenAI / ChatGPT — Missing Catalog Artwork

26 catalog items shipped without sprite art and currently render as
emoji-glyph fallbacks (or generic category icons for the cost=0
season-pass hats). This doc holds the prompts to fill the gap.

Companion to `openai-accessory-prompts.md` — same style anchor, same
1280×256 / 5-cell strip workflow. Don't re-paste the style anchor if
you're continuing the same ChatGPT conversation that did the original
accessories; otherwise paste it once from that file before any batch
below.

## Workflow recap

1. New ChatGPT conversation. Paste the **style anchor** from
   `openai-accessory-prompts.md` once at the top.
2. Paste **one batch prompt** below. Save the result image.
3. Slice the 5-cell strip into 5 individual 256×256 PNGs named per the
   `id` column in the batch table.
4. Copy PNGs into `assets/images/hats/<id>.png`.
5. Add each new id to `constants/hats.ts` → `HAT_IMAGES` map, e.g.:
   ```ts
   leaf_crown: require("../assets/images/hats/leaf_crown.png"),
   ```
6. Run `python3 scripts/compute_overlays.py` so the auto-computed
   overlay bboxes pick up the new PNGs.
7. Hot-reload. Equip each on a test pig + check that it sits right.
   Necklaces + capes are new overlay categories; see the rendering
   notes per batch.

---

## Batch 1 — Season-Pass exclusive hats (5)

These ship as season-pass tier rewards (`claim_tier_reward`); they
are intentionally not buyable in the shop (cost=0, filtered out of
`daily_shop`). The migration that added them
(`20260544000000_season_pass_missing_hats.sql`) flagged the artwork
as TODO.

| id | name | rarity | description |
|---|---|---|---|
| `bunny_ears` | Bunny ears | rare | Spring-step ears — fluffy enough to twitch. |
| `leaf_crown` | Crown of leaves | epic | A wreath for hogs who tend the grove. |
| `devil_horns` | Devil horns | epic | Just a little mischief — no commitment. |
| `cat_ears` | Cat ears | rare | Snout aside, the resemblance is uncanny. |
| `astronaut` | Astronaut helmet | epic | Honk to depressurize. Tickle in zero-G. |

```
SEASON-PASS HATS: a 5-cell strip with these head pieces, in this
order. SAME rendering rules as the accessory prompts: flat 2D front
view, NO back-of-brim, NO wrap-around band, NO head/face/body —
paper-cutout silhouette only. Transparent background.

1. Bunny ears — a pair of upright fluffy white rabbit ears with soft
   pink interiors, joined at the bottom by a thin headband visible
   only as a small front arc (no wrap-around). Rendered as if mounted
   on a tiny invisible head.
2. Crown of leaves — a green laurel wreath of overlapping oak/laurel
   leaves with two ribbon tails trailing down at the back. Front-arc
   silhouette only (no full ring). Rich storybook greens, small
   golden acorns scattered along the rim.
3. Devil horns — two short curved red horns mounted on a thin black
   headband; horns rendered as solid 2D shapes with a black outline,
   slight gloss highlight on each. Front-arc headband only.
4. Cat ears — two triangular cat ears with pink inner fur, mounted on
   a thin headband (front arc only). Black tip on each ear. Softer
   and more pointed than the bunny ears.
5. Astronaut helmet — a round white space helmet with a large gold-
   tinted curved visor showing a subtle reflection, antennae stub on
   top. Front face of the helmet only (no back of dome). Small NASA-
   style red/blue patch on the side.
```

---

## Batch 2 — Necklaces 1 of 2 (5)

**New category: `necklace`.** Render each piece as a flat 2D ornament
with a hint of the chain/strap looping up at the top — but no neck,
no body. Treat them like the item is suspended on an invisible
display bust. The strap forms a soft inverted-U at the top, ends
hidden behind the centerpiece; the pendant/ornament hangs straight
down centered.

| id | name | rarity | description |
|---|---|---|---|
| `ribbon_choker` | Ribbon Choker | common | Cute and simple. |
| `bell_collar` | Bell Collar | common | *ding* |
| `bone_necklace` | Bone Necklace | common | Caveman pig. |
| `choker` | Velvet Choker | common | Edgy. |
| `charm_necklace` | Charm Necklace | uncommon | Lucky. |

```
NECKLACES BATCH 1: a 5-cell strip with these neck ornaments. RULES:
- Flat 2D front view. NO neck, NO body, NO head.
- Each piece rendered as suspended on an invisible display bust —
  the strap/chain forms a soft inverted-U at the top, ends hidden
  behind the centerpiece. Pendant or centerpiece hangs straight down.
- Bold ~3px black outline. Soft saturated colors. Pure transparent
  background. Centered in cell with small consistent margin.

1. Ribbon choker — a pink satin ribbon tied into a small bow at the
   front center; ribbon ends curl slightly. No pendant — just the
   ribbon worn close to where the neck would be.
2. Bell collar — a thick leather collar (warm brown) with a brass
   bell hanging from a small ring at the front center. Subtle silver
   highlight on the bell, tiny "ding" suggested by a 2-stroke arc.
3. Bone necklace — a chunky off-white bone (cartoon dog-bone shape)
   strung horizontally on a brown leather cord. Slightly weathered.
   Front-arc cord only.
4. Velvet choker — a wide black velvet band with a small silver
   D-ring centered at the front. Edgy minimal — no pendant. Suggest
   velvet texture with a soft sheen line.
5. Charm necklace — a thin gold chain with a green four-leaf clover
   charm hanging at the centerpiece. Tiny gold ring connects clover
   to chain. Optimistic / lucky vibe.
```

---

## Batch 3 — Necklaces 2 of 2 (5)

Same rendering rules as Batch 2.

| id | name | rarity | description |
|---|---|---|---|
| `pearl_necklace` | Pearl Necklace | uncommon | Classic. |
| `locket` | Locket | uncommon | A tiny secret inside. |
| `gold_chain` | Gold Chain | rare | Bling bling. |
| `emerald_pendant` | Emerald Pendant | epic | Forest green. |
| `diamond_pendant` | Diamond Pendant | epic | Sparkles. |

```
NECKLACES BATCH 2: a 5-cell strip. SAME rules as Batch 1 — no neck,
no body. Each piece on an invisible display bust, strap forming an
inverted-U with the centerpiece hanging.

1. Pearl necklace — a single strand of evenly-sized off-white pearls
   with subtle iridescent highlights. No central pendant — the
   pearls themselves are the piece. Forms a graceful curve.
2. Locket — a small oval gold locket with a tiny etched heart on its
   face, hanging from a thin gold chain. Suggest the lid by a faint
   centerline. Slight warm glow.
3. Gold chain — a thick gold rope chain (heavy chunky links) without
   a pendant. Hip-hop style. Each link clearly drawn with shading.
4. Emerald pendant — a large faceted emerald-cut green gem in a thin
   gold setting, hanging from a thin gold chain. Subtle internal
   facet lines + a sharp highlight on the top-left facet.
5. Diamond pendant — a large brilliant-cut diamond (clear with a
   blue/violet tint in the facets) in a delicate silver setting on
   a thin silver chain. Strong starburst sparkle on top corner.
```

---

## Batch 4 — Capes 1 of 2 (5)

**New category: `cape`.** Render each cape as a flat 2D fabric piece
hanging straight down — as if pinned at the top to an invisible
clothes hanger. Suggest the cape's drape with subtle vertical folds
and a slight V-curve at the bottom hem. NO body, NO shoulders, NO
head. The "neck" of the cape (the collar/tie band) shows at the
top center.

| id | name | rarity | description |
|---|---|---|---|
| `short_cape` | Short Cape | uncommon | Lil cape. |
| `leather_cape` | Leather Cape | uncommon | Tough. |
| `silk_cape` | Silk Cape | uncommon | Slick. |
| `fur_cape` | Fur Cape | uncommon | Toasty toasty. |
| `magician_cape` | Magician Cape | rare | Now you see me. |

```
CAPES BATCH 1: a 5-cell strip with these capes. RULES:
- Flat 2D front view. NO body, NO shoulders, NO head, NO neck.
- Each cape hangs as if pinned at the top center to an invisible
  hanger — collar/tie band visible at top center; fabric drapes
  vertically below with subtle fold lines + a soft V-curve at the
  bottom hem.
- Bold ~3px black outline around the cape silhouette. Pure
  transparent background. Centered in cell.

1. Short cape — a small red cape, kid-sized, with a yellow tie
   string across the top. Cheerful primary red. Slight bottom flare.
2. Leather cape — a brown weathered-leather cape with a thick collar
   stitched at the top center. Texture suggested by subtle horizontal
   scuff marks. Heavier drape than the others.
3. Silk cape — a glossy royal-purple silk cape with a soft sheen
   highlight running down the centerline. Tied at the top center
   with a thin gold cord. Light and flowing.
4. Fur cape — a creamy off-white fur cape with darker grey tips and
   visible fluffy texture along the edges. Wide collar suggesting
   warmth. Cozy.
5. Magician cape — a black satin cape with a deep red/crimson
   interior visible at the collar (suggested by a thin red band at
   the top inside the collar). Two thin gold tassels hang from the
   tie at top center.
```

---

## Batch 5 — Capes 2 of 2 (5)

Same rendering rules as Batch 4.

| id | name | rarity | description |
|---|---|---|---|
| `hero_cape` | Hero Cape | epic | Capes are cool. |
| `vampire_cape` | Vampire Cape | rare | Bleh! |
| `royal_cape` | Royal Cape | epic | For pig royalty. |
| `ermine_cape` | Ermine Cape | epic | Royal tier. |
| `star_cape` | Star-Spangled Cape | legendary | Patriotic pig. |

```
CAPES BATCH 2: a 5-cell strip. SAME rules as Batch 1 — no body,
hanger drape, collar at top center, V-curve hem.

1. Hero cape — a bright red superhero cape, longer than the short
   cape, with a slight flowing curve at the bottom hem suggesting
   wind. Clean and bold. No emblem.
2. Vampire cape — a tall black cape with a high pointed collar
   (rendered as twin spikes flanking the tie), deep blood-red
   interior peeking through at the collar. Slightly tattered hem.
3. Royal cape — a deep purple cape with gold trim running down both
   front edges. Wide white-fur collar across the top. Generous
   drape, suggesting heavy fabric.
4. Ermine cape — a luxurious cape of white fur with classic black
   ermine spots scattered across the surface (~8 black spots),
   collar fully fur. Pristine winter aristocracy.
5. Star-spangled cape — a deep navy-blue cape with a field of
   small white five-pointed stars dotted across it, and red and
   white horizontal stripes along the bottom hem. Brass-button
   collar at top center.
```

---

## Batch 6 — Referral + special hats (1)

`messenger` is the milestone hat granted on the inviter's 3rd
completed referral (see `20260566000000_referrals.sql`). Singular
batch since there's only one item; ChatGPT can return a 1-cell 256×256
image or you can pad with a placeholder in a 2-cell strip.

| id | name | rarity | description |
|---|---|---|---|
| `messenger` | Messenger Hat | rare | Earned by inviting friends — your messenger badge. |

```
MESSENGER HAT (1 cell, 256×256, transparent): a flat 2D front-view
hat. SAME rules as the accessory prompts — paper-cutout silhouette,
no head, no back of brim.

Messenger hat — a vintage soft-canvas messenger cap in warm tan or
slate-grey, short flat brim at front (front arc only). A small
embroidered envelope patch sits on the front of the crown (cream
envelope with a red wax seal dot). Postman/courier vibe — competent
and friendly. No head, no body.
```

---

## Verify after adding

After all 26 PNGs are in + registered in `HAT_IMAGES`, re-run the
catalog audit script to confirm zero remaining gaps:

```sh
python3 <<'EOF'
import re, os, glob
catalog = set()
for path in sorted(glob.glob("supabase/migrations/*.sql")):
    text = open(path).read()
    for m in re.finditer(r"INSERT\s+INTO\s+public\.hats\s+[^;]+;", text, re.IGNORECASE | re.DOTALL):
        for tm in re.finditer(r"\(\s*'([a-z_][a-z_0-9]*)'", m.group(0)):
            catalog.add(tm.group(1))
registered = set()
with open("constants/hats.ts") as f:
    in_map = False
    for line in f:
        if "HAT_IMAGES" in line and "{" in line: in_map = True; continue
        if in_map and line.strip().startswith("};"): break
        if in_map:
            m = re.match(r"\s*([a-z_][a-z_0-9]*):\s*require\(\"([^\"]+)\"\)", line)
            if m: registered.add(m.group(1))
missing = sorted(catalog - registered)
print(f"Missing: {len(missing)}")
for h in missing: print(f"  {h}")
EOF
```

Expected output once all artwork is in: `Missing: 0`.
