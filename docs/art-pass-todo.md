# Art pass to-do — orphaned cosmetics (no art)

These shop/catalog items exist in `public.hats` but have **no `HAT_IMAGES` entry**, so
they render a generic/wrong category fallback (exactly the `tiny_umbrella → magic wand`
bug). Each needs a real PNG + three client wirings, like every working item:

```
HAT_IMAGES.<id>                 = require(".../hats/<id>.png")
hat_rel.generated.ts <id>       = { pivot, widthFrac, anchor, behind }   # on-pig placement
hat_overlays.generated.ts <id>  = { bottom, left, width, height }        # closet thumbnail
```

Audit method (re-runnable): diff catalog ids (`INSERT INTO public.hats`) against the
`HAT_IMAGES` keys in `constants/hats.ts`. Country `flag_*` items are NOT orphans — they
render via `WORLD_CUP_FLAG_IMAGES` (`constants/worldCupFlags.ts`) + `assets/images/hats/flags/`.

As of 2026-06-26: **134 art-keyed, 33 non-flag orphans.**

## Slop Club perk icons (bespoke, requested)
Three custom icons for the Slop Club card perks. Currently using stand-ins
(`TickleIcon`, `SnoutCoin`, `gift` Icon) — good enough to ship, swap when bespoke
art lands. `SlopPerk` already takes a `node` prop, so wiring is one line each:
`node={<Image source={require("@/assets/images/perks/<id>.png")} style={{width:18,height:18}} />}`.

Style for all three: **cute hand-drawn game sticker, thick dark-brown outline,
soft warm pastel fill, subtle cel shading, centered subject, transparent
background, square (512×512), no text** — match an existing TTP icon as the
reference (e.g. `assets/images/emoji/sun-beam.png` or `bountiful-snouts.png`).

- [x] `perks/bigger_bank.png` — "Bigger tickle bank": piggy bank brimming with hearts/coins. **DONE** (Midjourney v7, bg-removed, wired into `SlopPerk`).
- [x] `perks/stipend.png` — "Monthly snout stipend": gold coin stack with a pig-snout face + sparkles. **DONE**.
- [x] `perks/members_drops.png` — "Members-only drops": wrapped gift box with a gold star + bow. **DONE**.

> Done 2026-06-26: generated in Midjourney (driven via Cloud Chrome), backgrounds flood-filled out + cropped, saved at 256px, rendered standalone (no bordered well) in the Slop Club card.

## Hidden until art ships
- [ ] `tiny_umbrella` — "Tiny Umbrella" (held) — **pulled from shop + closet** (migration `20260684`, `HIDDEN_CLOSET_IDS` in `ClosetView.tsx`). Re-add a cost + remove from the hidden set once art lands.

## Orphans needing art (still live — showing fallback art)
Capes: `ermine_cape`, `fur_cape`, `hero_cape`, `leather_cape`, `magician_cape`, `royal_cape`, `short_cape`, `silk_cape`, `star_cape` (Star-Spangled), `vampire_cape`
Necklaces/chokers: `bell_collar`, `bone_necklace`, `charm_necklace`, `choker` (Velvet), `diamond_pendant`, `emerald_pendant`, `gold_chain`, `locket`, `neckwarmer`, `pearl_necklace`, `ribbon_choker`
Bows: `acorn_bow`, `bumblebee_bow`
Masks/glasses: `gas_mask`, `jam_jar_lenses`, `mushroom_cap`
Held: `firefly_lantern`, `paper_boat`
Backgrounds: `library_nook`, `pumpkin_patch`
Tickle particles: `moth_waltz`, `particle_bubble` (Bubble)

> Decision point for the art pass: generate art for these, OR hide the ones that are
> currently live + showing wrong fallbacks (same `cost=0` + `HIDDEN_CLOSET_IDS` treatment
> as `tiny_umbrella`) until their art is made.
