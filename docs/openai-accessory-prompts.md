# OpenAI / ChatGPT Accessory Sprite Prompts

100 cosmetic items organized by category. Generate **5 items per image** (2 batches per category = 20 generations total). Each image returns a 5-cell grid of items on a transparent background; you split into 5 individual PNGs.

## Workflow

1. Start a fresh ChatGPT conversation. **Do not reuse the pig conversation** — accessories are separate art and you don't want the model trying to add a pig to each one.
2. Paste the **Style anchor** prompt once at the top.
3. Paste **one category batch** at a time. Save the result.
4. After all categories are done, slice each grid into 5 PNGs and copy to `assets/images/hats/<id>.png`.
5. Run `python3 scripts/compute_overlays.py` to regenerate `constants/hat_overlays.generated.ts` (it will recompute bounding boxes from the new PNG sizes).
6. Hot-reload the app and check that items still sit on the pig correctly.

---

## Style anchor (paste once)

```
I'm going to ask you to generate sprite-sheet images of cosmetic
accessory items for a 2D mobile game. NO characters, NO pigs, NO
people — only the items themselves.

Style for every accessory image:
- Flat children's storybook illustration with bold ~3px black outline
- Soft saturated colors, clean palette per item
- Simple shapes, very readable at small sizes (this is a mobile game)
- No drop shadows, no glow effects (unless the item itself is an aura)
- Pure transparent background — nothing behind the item
- Centered in its cell with a small consistent margin

Default layout: a 5-cell horizontal strip, total image 1280×256
pixels. Each cell exactly 256×256 with the item centered. No labels,
no numbers, no gridlines, no separators between cells. Pure
transparent background.

Confirm you understand, then I'll send the first batch.
```

---

## Hats — Batch 1 of 2 (5 items, 1280×256, transparent)

```
HATS BATCH 1: a 5-cell strip with these hats, in this order:
1. Wizard hat — purple cone hat with stars and moons, slightly tilted
2. Cowboy hat — brown leather, curled brim
3. Top hat — black tall cylinder with band
4. Party hat — colorful conical with stripes and a pom on top
5. Beanie — pink knit hat with a pom on top
Each is just the hat, oriented as it would sit on a head. No head visible.
Transparent background.
```

## Hats — Batch 2 of 2

```
HATS BATCH 2: a 5-cell strip with these hats:
1. Chef toque — tall white pleated chef's hat
2. Crown — gold crown with red velvet inside and gem accents
3. Halo — golden glowing ring (depicted as a flat bright ring)
4. Viking helmet — silver metal helmet with two curved horns
5. Pirate tricorn — black three-cornered hat with skull-and-crossbones
Transparent background.
```

## Glasses — Batch 1 of 2

```
GLASSES BATCH 1: a 5-cell strip with these eyewear, oriented front-on
as if worn by a character:
1. Aviator sunglasses — gold frame, dark lenses
2. Heart sunglasses — pink heart-shaped lenses, white frame
3. Monocle — single circular lens with thin gold chain
4. Nerd glasses — round black thick frame, taped at center
5. Pixel glasses — chunky 8-bit pixelated black sunglasses
Transparent background.
```

## Glasses — Batch 2 of 2

```
GLASSES BATCH 2: a 5-cell strip with these eyewear:
1. Round glasses — thin gold frame, clear circular lenses
2. Safety goggles — yellow plastic with clear lens panel
3. Swim goggles — blue silicone with two round clear lenses
4. 3D glasses — red and blue paper lenses, classic style
5. VR headset — black wraparound headset
Transparent background.
```

## Bows (head/neck bow ties) — Batch 1 of 2

```
BOWS BATCH 1: a 5-cell strip of decorative bows, front-facing,
ribbon-style:
1. Black bow tie — small classic black bow tie
2. Gift bow — red shiny ribbon bow with multiple loops
3. Hair bow — blue checkered fabric bow
4. Pink bow — soft pink ribbon bow
5. Polka bow — white bow with red polka dots
Transparent background.
```

## Bows — Batch 2 of 2

```
BOWS BATCH 2: a 5-cell strip of decorative bows:
1. Rainbow bow — multicolored ribbon bow
2. Ribbon bow — long-tailed pink satin ribbon bow
3. Silk bow — luxurious cream-colored silk bow with sheen
4. Velvet bow — deep burgundy velvet bow
Plus one more: simple yellow gingham bow.
Transparent background.
```

## Scarves — Batch 1 of 2

```
SCARVES BATCH 1: a 5-cell strip of scarves drawn as if wrapped
around a neck (so the cell shows the front draped portion):
1. Ascot — silk red ascot tie tucked into shirt
2. Bandana red — red paisley bandana folded as neckwear
3. Cape scarf — long flowing scarf with cape-like edges
4. Knit scarf — chunky cable-knit beige scarf
5. Neck warmer — fuzzy dark gray tube scarf
Transparent background.
```

## Scarves — Batch 2 of 2

```
SCARVES BATCH 2: a 5-cell strip of scarves:
1. Rainbow scarf — multicolored striped scarf
2. Silk scarf — shimmery silver silk scarf with floral print
3. Striped scarf — black and white striped knit scarf
4. Summer kerchief — yellow polka-dot light kerchief
5. Winter scarf — heavy wool plaid red and green scarf
Transparent background.
```

## Masks — Batch 1 of 2

```
MASKS BATCH 1: a 5-cell strip of face masks, front-facing as worn:
1. Carnival mask — Venetian-style ornate gold mask with feathers
2. Cat mask — black cat-shaped mask with pointed ears
3. Domino — small black eye mask (tiny, covers just eyes)
4. Gas mask — military-style gas mask with twin filters
5. Hero mask — small superhero eye mask, blue
Transparent background.
```

## Masks — Batch 2 of 2

```
MASKS BATCH 2: a 5-cell strip of face masks:
1. Masquerade — elegant white mask with gold filigree
2. Robber mask — black bandit mask covering eyes and nose
3. Skull mask — white skull-shaped half-mask
4. Sleep mask — purple sleep eye mask with embroidered Z's
5. Venice mask — long-nosed plague-doctor / Venetian mask
Transparent background.
```

## Necklaces — Batch 1 of 2

```
NECKLACES BATCH 1: a 5-cell strip of neckwear, drawn as if worn
(curved chain visible at top, pendant centered below):
1. Bell collar — red collar with a gold bell
2. Bone necklace — primitive bone-shaped pendant on cord
3. Charm necklace — gold chain with small heart and star charms
4. Choker — black velvet choker
5. Diamond pendant — silver chain with sparkling diamond
Transparent background.
```

## Necklaces — Batch 2 of 2

```
NECKLACES BATCH 2: a 5-cell strip of neckwear:
1. Emerald pendant — gold chain with green emerald
2. Gold chain — thick gold rope chain
3. Locket — heart-shaped gold locket on fine chain
4. Pearl necklace — strand of white pearls
5. Ribbon choker — pink ribbon choker with cameo
Transparent background.
```

## Capes — Batch 1 of 2

```
CAPES BATCH 1: a 5-cell strip of capes, drawn as if billowing
behind a character (so the cape spreads outward in a roughly
trapezoid shape):
1. Ermine cape — white fur cape with black spots, royal
2. Fur cape — shaggy brown fur cape
3. Hero cape — bright red flowing superhero cape
4. Leather cape — dark brown leather cape with hood
5. Magician cape — black with red satin lining, flared
Transparent background.
```

## Capes — Batch 2 of 2

```
CAPES BATCH 2: a 5-cell strip of capes:
1. Royal cape — purple velvet cape with gold trim and ermine collar
2. Short cape — small shoulder cape, dark teal
3. Silk cape — flowing white silk cape
4. Star cape — navy blue cape covered in gold stars
5. Vampire cape — black cape with crimson interior, sharp collar
Transparent background.
```

## Held items — Batch 1 of 2

```
HELD ITEMS BATCH 1: a 5-cell strip of objects designed to be held
in a paw/hand, drawn from a side angle:
1. Archery bow — wooden recurve bow with arrow
2. Balloon — single red helium balloon with string
3. Coffee mug — white ceramic mug with steam
4. Game controller — black gamepad style controller
5. Bouquet of flowers — pastel mixed wildflowers wrapped
Transparent background.
```

## Held items — Batch 2 of 2

```
HELD ITEMS BATCH 2: a 5-cell strip of objects:
1. Ice cream cone — pink scoop on a cone
2. Magic wand — slim wand with star tip and sparkles
3. Magnifier — magnifying glass with brass handle
4. Pencil — yellow #2 pencil
5. Pizza slice — single triangular pizza slice with pepperoni
Transparent background.
```

## Auras — Batch 1 of 2

```
AURAS BATCH 1: a 5-cell strip of magical aura halos. Each aura is
a roughly circular glow effect (no character inside). Solid colored
energy with magical motion lines/sparkles, transparent background:
1. Electric aura — crackling blue lightning circle
2. Fire aura — orange flame ring
3. Gold aura — radiant gold rays
4. Holy aura — white-and-gold soft glow with light beams
5. Ice aura — pale blue frosty ring with snowflake particles
Transparent background.
```

## Auras — Batch 2 of 2

```
AURAS BATCH 2: a 5-cell strip of magical aura halos:
1. Petal aura — swirling pink cherry blossom petals
2. Pink glow — soft pink heart particles around a circle
3. Rainbow aura — concentric rainbow rings
4. Shadow aura — dark purple swirling smoke
5. Sparkle aura — golden glittering stars in a ring
Transparent background.
```

## Backgrounds — Batch 1 of 2

```
BACKGROUNDS BATCH 1: a 5-cell strip of square scene backgrounds.
Each cell shows a full landscape illustration filling the 256×256
cell. No characters. NOT transparent for backgrounds — fill the
square with the scene.
1. Beach island — tropical beach with palm tree
2. Candyland — pastel land of giant candy and lollipops
3. Desert dunes — sandy dunes under sunset sky
4. Forest grove — green woodland with mushrooms
5. Jungle — dense rainforest with vines
Each cell completely filled with its scene; cells separated by no border.
```

## Backgrounds — Batch 2 of 2

```
BACKGROUNDS BATCH 2: a 5-cell strip of square scene backgrounds:
1. Mountain top — snowy peak with clouds
2. Snowy farm — winter farm with red barn
3. Space station — inside view of space station with windows to stars
4. Sunset farm — golden-hour farm with silhouetted trees
5. Underwater — coral reef with fish
Each cell completely filled with its scene.
```

---

## After generation: slicing

For each strip image you save (e.g., `~/Downloads/hats-batch-1.png`), tell me which batch it is and I'll auto-slice it into 5 named PNGs and copy them into `assets/images/hats/`. The naming convention matches the existing files (e.g., `wizard.png`, `cowboy.png`, etc.).

---

## Realistic budget

- 20 batches × ~30s each in ChatGPT Plus = ~30 min of paste-and-wait
- Or via API: 20 calls × $0.07-0.17 = $2-4
- Slicing & copying handled in code automatically once you drop a strip

You'll likely want to redo a few batches that don't come out clean (transparent background hiccups, off-style items). Budget for ~25 generations total to get a clean set.
