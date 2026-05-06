# Shop Art Handoff

The shop seeds **100 cosmetic items** and **5** of them have PNG art today
(`wizard, cowboy, tophat, party, monocle`). The remaining **95** render the
unicode emoji as a placeholder both on the shop card and overlaid on the pig.

This doc is for handing the unpainted items to a designer. The 5 existing
`assets/images/hats/*.png` are the **style reference** — match silhouette
weight, line-work, and palette to those.

## Pipeline

1. **Canvas:** square PNG, transparent background, ~800×800 (so it
   downscales cleanly to the 86px shop thumb and the ~160px pig overlay).
   Not all categories are square — see per-category notes below.
2. **Anchor:** the bottom edge of the trimmed image is treated as the
   "rest" point on the pig. Match the trimmed-bottom convention shown by
   the existing 5 PNGs (see `constants/hats.ts:24-35`).
3. **File name:** `{id}.png` (the `id` column from the catalog migration,
   e.g. `crown.png`, `vr_headset.png`). Drop into
   `assets/images/hats/`.
4. **Code wire-up:** add the new file to the `HAT_IMAGES` map in
   `constants/hats.ts:2-8`. RN's bundler needs literal `require()` paths,
   so this list must be edited by hand whenever new art lands. (We can
   land all 95 in one commit once art is delivered.)
5. **Per-item overrides** (optional): if an item doesn't fit the category
   default box, add a `HAT_OVERLAYS[id]` entry tuned for that item — same
   schema as the existing hat overlays.

## Style direction

- **Reference:** Wizard / Cowboy / Top Hat / Party / Monocle PNGs — soft
  rounded silhouettes, light pencil/ink outline, painted fill, gentle
  drop shadow under the rim.
- **Palette:** the app uses `COLORS` in `constants/theme.ts` — pinks
  (`#E8A7B9`, `#FBE6EC`), warm paper (`#FAF7F3`), inks (`#1A1A1A`).
  Items can be any hue but should feel painterly, not flat icon.
- **Silhouette:** strong and readable at 86px. No tiny details that
  vanish at thumb size.
- **No baked drop shadow on the pig** — the card and the pig already
  have their own shadow stack; bake only the soft hat-internal shadow
  if needed.

## Per-category fit notes

Per-category default overlay box on the 300×300 pig card lives in
`constants/hats.ts:48-59`. The **bottom** value is "distance from card
bottom up to the trimmed-bottom edge of the art."

| Category   | Box (W×H) | Bottom | Anchor / framing |
|---|---|---|---|
| hat        | 160×160 | 215 | Brim sits on the head crown. Tall hats (wizard) extend up. |
| glasses    | 140×60  | 130 | Rests on the snout bridge, wraps over both eyes. |
| bow        | 80×60   | 220 | Sits centered on top of the head, between ears. |
| scarf      | 180×80  | 60  | Wraps the lower body / under the snout. |
| mask       | 160×110 | 110 | Eye-area mask, behind the snout. |
| necklace   | 140×60  | 70  | Sits on the chest below the snout. |
| cape       | 240×200 | 30  | Behind the pig — billows out below shoulder line. |
| held       | 80×80   | 50  | Off to one side near where a hoof would hold it. |
| aura       | 300×300 | 0   | Full-card overlay behind the pig. |
| background | 300×300 | 0   | Full-card replacement BG; should *contain* the pig safely in center. |

For full-bleed categories (aura, background) it's safe to deliver the
art at the same 300×300 logical canvas (or larger and we downscale).

---

## Items needing art (95)

Grouped by category, sorted by rarity (legendary → common). Each row:
**id** · name · rarity · current emoji (vibe ref) · description.

### Hats (6)
- `crown` · Royal Crown · **epic** · 👑 · Fit for a pig of pure pedigree.
- `halo` · Halo · **rare** · 😇 · Glowing ring of holy light.
- `viking_helmet` · Viking Helmet · **rare** · ⚔️ · With genuine non-historical horns.
- `pirate_tricorn` · Pirate Tricorn · **uncommon** · 🏴‍☠️ · Aye, matey.
- `chef_toque` · Chef Toque · **uncommon** · 👨‍🍳 · For the culinary swine.
- `beanie` · Beanie · **common** · 🧢 · A cozy knitted cap.

### Glasses (9)
- `vr_headset` · VR Headset · **epic** · 🥽 · In the meta-pen.
- `aviator_sunglasses` · Aviator Shades · **uncommon** · 🕶️ · Top gun pig.
- `heart_sunglasses` · Heart Sunglasses · **uncommon** · 😎 · Looking adorable.
- `pixel_glasses` · Pixel Shades · **uncommon** · 🕶️ · 8-bit cool.
- `round_glasses` · Round Glasses · **common** · 👓 · Owlish.
- `swim_goggles` · Swim Goggles · **common** · 🏊 · Splash-proof.
- `nerd_glasses` · Nerd Glasses · **common** · 🤓 · Ackshually...
- `three_d_glasses` · 3D Glasses · **common** · 🎬 · Whoa, depth!
- `safety_goggles` · Safety Goggles · **common** · 🥽 · Science!
> `monocle` already has art — match its inked-line style.

### Bows (10)
- `archery_bow` · Archery Bow · **rare** · 🏹 · Robin Hog.
- `rainbow_bow` · Rainbow Bow · **rare** · 🌈 · Lucky charm.
- `black_bow_tie` · Black Bow Tie · **uncommon** · 🎩 · Dapper.
- `silk_bow` · Silk Bow · **uncommon** · 🎀 · Smooth.
- `velvet_bow` · Velvet Bow · **uncommon** · 🎀 · Soft.
- `pink_bow` · Pink Bow · **common** · 🎀 · Classic pink ribbon.
- `ribbon_bow` · Ribbon Bow · **common** · 🎀 · Tied just right.
- `hair_bow` · Hair Bow · **common** · 🎀 · Cute.
- `gift_bow` · Gift Bow · **common** · 🎁 · You ARE the gift.
- `polka_bow` · Polka Dot Bow · **common** · 🎀 · Spotted.

### Scarves (10)
- `rainbow_scarf` · Rainbow Scarf · **rare** · 🌈 · Stretches over your snout.
- `silk_scarf` · Silk Scarf · **uncommon** · 🧣 · Fancy.
- `cape_scarf` · Cape Scarf · **uncommon** · 🧣 · Half scarf, half cape.
- `ascot` · Ascot · **uncommon** · 🎩 · Nobility.
- `knit_scarf` · Knit Scarf · **common** · 🧣 · Toasty.
- `bandana_red` · Red Bandana · **common** · 🦊 · Yeehaw.
- `striped_scarf` · Striped Scarf · **common** · 🧣 · Hogwarts vibes.
- `winter_scarf` · Winter Scarf · **common** · ☃️ · For cold farms.
- `summer_kerchief` · Summer Kerchief · **common** · 🌻 · Light & breezy.
- `neckwarmer` · Neckwarmer · **common** · 🧣 · Snug.

### Masks (10)
- `venice_mask` · Venetian Mask · **epic** · 🎭 · Carnevale.
- `skull_mask` · Skull Mask · **epic** · 💀 · Spoooky.
- `gas_mask` · Gas Mask · **rare** · 🥽 · Fallout pig.
- `masquerade` · Masquerade Mask · **uncommon** · 🎭 · Mysterious.
- `robber_mask` · Robber Mask · **uncommon** · 🥷 · Bag of tickles.
- `carnival_mask` · Carnival Mask · **uncommon** · 🎭 · Festive.
- `cat_mask` · Cat Mask · **uncommon** · 🐱 · Cat-pig hybrid.
- `hero_mask` · Hero Mask · **uncommon** · 🦸 · Pig of justice.
- `domino` · Domino Mask · **common** · 🦝 · Sneaky.
- `sleep_mask` · Sleep Mask · **common** · 😴 · Ten more minutes.

### Necklaces (10)
- `diamond_pendant` · Diamond Pendant · **epic** · 💎 · Sparkles.
- `emerald_pendant` · Emerald Pendant · **epic** · 💚 · Forest green.
- `gold_chain` · Gold Chain · **rare** · ⛓️ · Bling bling.
- `pearl_necklace` · Pearl Necklace · **uncommon** · 📿 · Classic.
- `locket` · Locket · **uncommon** · 💌 · A tiny secret inside.
- `charm_necklace` · Charm Necklace · **uncommon** · 🍀 · Lucky.
- `bone_necklace` · Bone Necklace · **common** · 🦴 · Caveman pig.
- `choker` · Velvet Choker · **common** · 🖤 · Edgy.
- `bell_collar` · Bell Collar · **common** · 🔔 · *ding*
- `ribbon_choker` · Ribbon Choker · **common** · 🎀 · Cute and simple.

### Capes (10)
- `star_cape` · Star-Spangled Cape · **legendary** · 🌟 · Patriotic pig.
- `royal_cape` · Royal Cape · **epic** · 🦹 · For pig royalty.
- `hero_cape` · Hero Cape · **epic** · 🦸 · Capes are cool.
- `ermine_cape` · Ermine Cape · **epic** · 🦊 · Royal tier.
- `vampire_cape` · Vampire Cape · **rare** · 🧛 · Bleh!
- `magician_cape` · Magician Cape · **rare** · 🎩 · Now you see me.
- `fur_cape` · Fur Cape · **uncommon** · 🐻 · Toasty toasty.
- `silk_cape` · Silk Cape · **uncommon** · 🧣 · Slick.
- `leather_cape` · Leather Cape · **uncommon** · 🧥 · Tough.
- `short_cape` · Short Cape · **uncommon** · 🦸 · Lil cape.

### Held (10)
- `magic_wand` · Magic Wand · **rare** · 🪄 · Bibbidi-bobbidi-pig.
- `toy_sword` · Toy Sword · **uncommon** · ⚔️ · En garde!
- `controller` · Game Controller · **uncommon** · 🎮 · Pro gamer.
- `flowers` · Flower Bouquet · **common** · 💐 · For someone special.
- `magnifier` · Magnifying Glass · **common** · 🔍 · Detective pig.
- `pizza_slice` · Pizza Slice · **common** · 🍕 · Cheesy.
- `ice_cream` · Ice Cream · **common** · 🍦 · Yum.
- `coffee_mug` · Coffee Mug · **common** · ☕ · Daily fuel.
- `balloon` · Balloon · **common** · 🎈 · Float away.
- `pencil` · Pencil · **common** · ✏️ · Pig of letters.

### Auras (10) — full-card overlay (300×300, transparent)
- `rainbow_aura` · Rainbow Aura · **legendary** · 🌈 · Pride pig.
- `gold_aura` · Gold Aura · **epic** · ✨ · Worth your weight in.
- `shadow_aura` · Shadow Aura · **epic** · 🌑 · Spooky.
- `holy_aura` · Holy Aura · **epic** · 🙏 · Sanctified swine.
- `pink_glow` · Pink Aura · **rare** · ✨ · Soft pink halo around you.
- `fire_aura` · Fire Aura · **rare** · 🔥 · You are on fire.
- `ice_aura` · Ice Aura · **rare** · ❄️ · Cool customer.
- `electric_aura` · Electric Aura · **rare** · ⚡ · Shocking.
- `sparkle_aura` · Sparkle Aura · **rare** · ✨ · Glittery.
- `petal_aura` · Petal Swirl · **rare** · 🌸 · Cherry blossom drift.

### Backgrounds (10) — full-card BG (300×300, opaque)
- `space_station` · Space Station · **epic** · 🚀 · Astronaut life.
- `candyland` · Candy Land · **rare** · 🍭 · Sweet.
- `sunset_farm` · Sunset Farm · **rare** · 🌅 · Golden hour.
- `snowy_farm` · Snowy Farm · **rare** · ❄️ · Winter wonderland.
- `beach_island` · Beach Island · **rare** · 🏝️ · Tropical pig.
- `forest_grove` · Forest Grove · **rare** · 🌲 · Peaceful.
- `jungle` · Jungle · **rare** · 🌴 · Wild.
- `underwater` · Coral Reef · **rare** · 🐠 · Glub glub.
- `desert_dunes` · Desert Dunes · **rare** · 🏜️ · Hot.
- `mountain_top` · Mountain Top · **rare** · ⛰️ · On top of the world.

---

## Suggested batch order

If sequencing the work matters, the highest-leverage batches are:

1. **Hats + Glasses + Bows + Masks** (35 items) — these are the
   most-touched on the pig in normal play.
2. **Necklaces + Held + Scarves** (30 items) — fill out the chest /
   hoof / neck zones.
3. **Capes** (10 items) — single category, behind-the-pig layer.
4. **Auras + Backgrounds** (20 items) — full-bleed flair, lower priority
   because the whole card swap reads even with placeholder.

## Acceptance checklist (for each delivered PNG)

- [ ] Filename matches `id` exactly.
- [ ] Transparent background.
- [ ] Trimmed of empty pixels (so the bottom edge is the visual anchor).
- [ ] Reads at 86px thumb (no critical detail < 4px after downscale).
- [ ] Visually consistent with wizard/cowboy/tophat/party/monocle.
- [ ] For full-bleed bg: pig at center is unobstructed and readable.
