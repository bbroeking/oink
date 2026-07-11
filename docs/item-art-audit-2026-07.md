# Item-art audit — 2026-07

Definitive cross-reference of every cosmetic ever seeded into `public.hats`
against the client art + placement registries. Supersedes the ad-hoc list in
`docs/art-pass-todo.md` (which was stale on the deleted cape/necklace rows).

## Method (re-runnable)

1. Parse every `INSERT INTO public.hats … VALUES` block across
   `supabase/migrations/*.sql` (column-aware: handles the `emoji`/`image_path`/
   `members_only` column variants and `NULL` emoji). First-seen row wins →
   **273 distinct item ids**.
2. Replay the catalog deletes: `DELETE … WHERE category='necklace'` (20260531),
   `DELETE … WHERE category='cape'` (20260532), `gas_mask` (20260652),
   `neckwarmer` (20260655). Rows seeded *before* their category delete with no
   later re-insert are **removed** (the 20260547 cost UPDATEs + the 20260685
   hide are no-ops against already-deleted rows — this is where art-pass-todo
   was wrong).
3. Cross-reference each surviving id against the unified art registry
   `HAT_IMAGES` (`constants/hats.ts` base map **+** `MEMBERS_IMAGES`
   `constants/membersImages.generated.ts` **+** `flag_<slug>` from
   `constants/worldCupFlags.ts`) and per-item placement
   (`constants/hat_rel.generated.ts` + `membersRel.generated.ts`; the legacy
   `hat_overlays.generated.ts` is **empty** — RelSpec migration is complete).
4. Full-canvas categories (`aura`, `background`, `tickle_particle`) and
   off-pig `flag`s need no per-item RelSpec — they place by category / render
   outside `PigStage`, so placement is N/A for them.

## Counts

| Class | Count |
|---|---|
| **OK** (art + placement) | **240** |
| **art-missing** | **11** |
| **placement-missing** | **0** |
| **removed** (deleted from table) | **22** |
| **Total distinct ids** | **273** |

Per-category:

| Category | OK | art-missing | removed |
|---|---|---|---|
| aura | 27 | 1 | – |
| background | 31 | 2 | – |
| bow | 20 | 2 | – |
| cape | – | – | 10 |
| flag | 39 | – | – |
| glasses | 20 | 1 | – |
| hat | 43 | 2 | – |
| held | 27 | 2 | – |
| mask | 10 | – | 1 |
| neck | 1 | – | – |
| necklace | 1 | – | 10 |
| scarf | 9 | – | 1 |
| tickle_particle | 12 | 1 | – |

## The 11 art-missing items

All 11 were seeded in one batch — `20260632000000_daily_shop_expand.sql` — and
were then blanket-hidden (`cost = 0`, unequipped) by
`20260685000000_hide_orphan_cosmetics.sql`. **None is currently obtainable**:
`daily_shop()` only draws `cost > 0`, and none is granted by any pass / beta /
war / mystery-box / S1-flip / Jul-13 (judgement-day) lane. They are the art-pass
backlog — art + a restored cost re-enters each into daily-shop rotation.

| id | category | rarity | cost | notes |
|---|---|---|---|---|
| `library_nook` | background | epic | 1200 | full-scene bg — "rainy-day light, a chair that knows you" |
| `pumpkin_patch` | background | rare | 650 | full-scene bg — "one pumpkin suspiciously pig-shaped" |
| `moth_waltz` | aura | rare | 750 | full-canvas aura — "soft wings circle you like a porch light" |
| `particle_bubble` | tickle_particle | uncommon | 300 | tap-effect glyph; **blocks the bubble tap FX** per the seed comment |
| `firefly_lantern` | held | rare | 600 | paper lantern, three fireflies |
| `tiny_umbrella` | held | common | 150 | pulled early (20260684); `HIDDEN_CLOSET_IDS` in ClosetView |
| `mushroom_cap` | hat | uncommon | 240 | toadstool cap |
| `paper_boat` | hat | common | 120 | folded-newspaper boat hat |
| `jam_jar_lenses` | glasses | uncommon | 260 | bottle-bottom round specs |
| `bumblebee_bow` | bow | uncommon | 280 | black-and-yellow bow |
| `acorn_bow` | bow | common | 130 | acorn tied with a twig |

Generation brief: **`docs/openai-missing-items-icons.md`**.

## Removed (22 — deleted from `public.hats`, need no art)

Deleted wholesale and never re-seeded; excluded from the art backlog unless a
future season regenerates them.

- **Capes (10):** `ermine_cape` `fur_cape` `hero_cape` `leather_cape`
  `magician_cape` `royal_cape` `short_cape` `silk_cape` `star_cape`
  `vampire_cape`
- **Necklaces (10):** `bell_collar` `bone_necklace` `charm_necklace` `choker`
  `diamond_pendant` `emerald_pendant` `gold_chain` `locket` `pearl_necklace`
  `ribbon_choker`
- **Other (2):** `gas_mask` (mask) · `neckwarmer` (scarf)

`beta_founder_ribbon` (necklace, 20260704) and `prize_sash` (neck, 20260650)
were seeded *after* the necklace delete, both have art → **OK**.

## Non-hat surfaces — clean

- **Backgrounds:** 33 items, all image-keyed in `HAT_IMAGES` (require paths
  into `assets/images/backgrounds/`), except the 2 art-missing above. Animated
  bgs (`northern_lights`, `cosmic_drift_bg`, `frostlight_dome_bg`) resolve their
  frame loop via `constants/animatedBackgrounds.ts` — all frames present.
- **Auras:** 28 items render as static PNGs (`*_aura.png`); all present except
  `moth_waltz`. The `constants/cosmeticFx.ts` `COSMETIC_FX` recipes are an
  *additional* animated float/glow/shimmer overlay for Slop Club items
  (`membersFx.generated.ts`, 76 keys) — not required for a base aura to render.
- **Tickle particles:** 13 items, all present except `particle_bubble`.
- **Pig skins:** none exist as `public.hats` rows (no `pig_skin` category items
  seeded; the reward_type exists in the pass but grants none today).
- **Orphaned assets (file, no DB item):** none. All non-item PNGs are
  intentional minigame sprites (`goblin_*`, `mud_splat*` — SlopToss) or animated
  frame variants.

## `first_light` aura — planned, does not exist

Referenced only as a planned **procedural** aura in
`docs/openai-founder-gear-icons.md` (post-processing step 3: "procedural recipe
in `cosmeticFx.ts` — pre-Hunger golden valley motes"). **No DB row, no
`HAT_IMAGES` key, no `cosmeticFx` recipe** anywhere in the tree. It is a
`cosmeticFx.ts` recipe to *write*, not a sprite to generate — deliberately
excluded from the icon brief. Track separately if it's still wanted.

## Full table (273 rows)

<!-- generated; class-sorted (non-OK first), then category, then id -->

| id | category | rarity | cost | class | art | obtainable | seed |
|---|---|---|---|---|---|---|---|
| `moth_waltz` | aura | rare | 750 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `library_nook` | background | epic | 1200 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `pumpkin_patch` | background | rare | 650 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `acorn_bow` | bow | common | 130 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `bumblebee_bow` | bow | uncommon | 280 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `jam_jar_lenses` | glasses | uncommon | 260 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `mushroom_cap` | hat | uncommon | 240 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `paper_boat` | hat | common | 120 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `firefly_lantern` | held | rare | 600 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `tiny_umbrella` | held | common | 150 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `particle_bubble` | tickle_particle | uncommon | 300 | **art-missing** | N | no (hidden cost=0) | 20260632000000 |
| `ermine_cape` | cape | epic | 4500 | **removed** | N | no (deleted) | 20260502030000 |
| `fur_cape` | cape | uncommon | 480 | **removed** | N | no (deleted) | 20260502030000 |
| `hero_cape` | cape | epic | 1500 | **removed** | N | no (deleted) | 20260502030000 |
| `leather_cape` | cape | uncommon | 320 | **removed** | N | no (deleted) | 20260502030000 |
| `magician_cape` | cape | rare | 700 | **removed** | N | no (deleted) | 20260502030000 |
| `royal_cape` | cape | epic | 2200 | **removed** | N | no (deleted) | 20260502030000 |
| `short_cape` | cape | uncommon | 220 | **removed** | N | no (deleted) | 20260502030000 |
| `silk_cape` | cape | uncommon | 380 | **removed** | N | no (deleted) | 20260502030000 |
| `star_cape` | cape | legendary | 6500 | **removed** | N | no (deleted) | 20260502030000 |
| `vampire_cape` | cape | rare | 1100 | **removed** | N | no (deleted) | 20260502030000 |
| `gas_mask` | mask | rare | 1100 | **removed** | N | no (deleted) | 20260502030000 |
| `bell_collar` | necklace | common | 75 | **removed** | N | no (deleted) | 20260502030000 |
| `bone_necklace` | necklace | common | 180 | **removed** | N | no (deleted) | 20260502030000 |
| `charm_necklace` | necklace | uncommon | 220 | **removed** | N | no (deleted) | 20260502030000 |
| `choker` | necklace | common | 110 | **removed** | N | no (deleted) | 20260502030000 |
| `diamond_pendant` | necklace | epic | 4000 | **removed** | N | no (deleted) | 20260502030000 |
| `emerald_pendant` | necklace | epic | 3500 | **removed** | N | no (deleted) | 20260502030000 |
| `gold_chain` | necklace | rare | 600 | **removed** | N | no (deleted) | 20260502030000 |
| `locket` | necklace | uncommon | 320 | **removed** | N | no (deleted) | 20260502030000 |
| `pearl_necklace` | necklace | uncommon | 280 | **removed** | N | no (deleted) | 20260502030000 |
| `ribbon_choker` | necklace | common | 60 | **removed** | N | no (deleted) | 20260502030000 |
| `neckwarmer` | scarf | common | 85 | **removed** | N | no (deleted) | 20260502030000 |
| `aurora_veil_aura` | aura | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `butterfly_garden_aura` | aura | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `candleglow_aura` | aura | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `confetti_aura` | aura | epic | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `drip_glaze_aura` | aura | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `electric_aura` | aura | rare | 1400 | **OK** | Y | shop/grant | 20260502030000 |
| `fire_aura` | aura | rare | 1300 | **OK** | Y | shop/grant | 20260502030000 |
| `firefly_aura` | aura | rare | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `gallant_valor_aura` | aura | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `gold_aura` | aura | epic | 1500 | **OK** | Y | shop/grant | 20260502030000 |
| `golden_bog_aura` | aura | epic | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `heirloom_mire_aura` | aura | legendary | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `holy_aura` | aura | epic | 2400 | **OK** | Y | shop/grant | 20260502030000 |
| `ice_aura` | aura | rare | 1300 | **OK** | Y | shop/grant | 20260502030000 |
| `island_sunglow_aura` | aura | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `majesty_gold_aura` | aura | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `mud_splatter_aura` | aura | common | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `nebula_aura` | aura | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `northern_lights` | aura | legendary | 3500 | **OK** | Y | shop/grant | 20260632000000 |
| `petal_aura` | aura | rare | 900 | **OK** | Y | shop/grant | 20260502030000 |
| `pink_glow` | aura | rare | 500 | **OK** | Y | shop/grant | 20260502030000 |
| `rainbow_aura` | aura | legendary | 5000 | **OK** | Y | shop/grant | 20260502030000 |
| `shadow_aura` | aura | epic | 2200 | **OK** | Y | shop/grant | 20260502030000 |
| `slop_club_gilded_seal_aura` | aura | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `sparkle_aura` | aura | rare | 700 | **OK** | Y | shop/grant | 20260502030000 |
| `sprinkle_glaze_aura` | aura | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `swamp_bubble_aura` | aura | uncommon | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `beach_island` | background | rare | 900 | **OK** | Y | shop/grant | 20260502030000 |
| `bog_dusk_bg` | background | epic | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `candyland` | background | rare | 1200 | **OK** | Y | shop/grant | 20260502030000 |
| `castle_courtyard_dawn_bg` | background | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `confection_counter_bg` | background | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `cosmic_drift_bg` | background | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `cottage_garden_bg` | background | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `desert_dunes` | background | rare | 650 | **OK** | Y | shop/grant | 20260502030000 |
| `festival_night_bg` | background | legendary | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `forest_grove` | background | rare | 500 | **OK** | Y | shop/grant | 20260502030000 |
| `frostlight_dome_bg` | background | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `golden_mire_bg` | background | legendary | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `homestead_barn` | background | common | 0 | **OK** | Y | shop/grant | 20260515010000 |
| `jungle` | background | rare | 750 | **OK** | Y | shop/grant | 20260502030000 |
| `luau_lagoon_bg` | background | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `moonlit_ballroom_bg` | background | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `mountain_top` | background | rare | 850 | **OK** | Y | shop/grant | 20260502030000 |
| `mud_derby_bg` | background | rare | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `mud_pit_bg` | background | common | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `reed_marsh_bg` | background | uncommon | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `slop_club_lounge_bg` | background | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `snowy_farm` | background | rare | 700 | **OK** | Y | shop/grant | 20260502030000 |
| `soccer_field_day` | background | rare | 600 | **OK** | Y | shop/grant | 20260585000000 |
| `soccer_field_night` | background | rare | 600 | **OK** | Y | shop/grant | 20260585000000 |
| `soccer_podium` | background | rare | 600 | **OK** | Y | shop/grant | 20260585000000 |
| `soccer_street` | background | rare | 600 | **OK** | Y | shop/grant | 20260585000000 |
| `spa_wallow_bg` | background | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `space_station` | background | epic | 2500 | **OK** | Y | shop/grant | 20260502030000 |
| `sunset_farm` | background | rare | 600 | **OK** | Y | shop/grant | 20260502030000 |
| `throne_room_bg` | background | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `underwater` | background | rare | 1100 | **OK** | Y | shop/grant | 20260502030000 |
| `archery_bow` | bow | rare | 1400 | **OK** | Y | shop/grant | 20260502030000 |
| `black_bow_tie` | bow | uncommon | 250 | **OK** | Y | shop/grant | 20260502030000 |
| `caramel_drip_bow` | bow | common | 1200 | **OK** | Y | Slop Club | 20260690000000 |
| `cherry_pop_bow` | bow | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `gift_bow` | bow | common | 110 | **OK** | Y | shop/grant | 20260502030000 |
| `hair_bow` | bow | common | 65 | **OK** | Y | shop/grant | 20260502030000 |
| `heraldic_crest_bow` | bow | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `pink_bow` | bow | common | 40 | **OK** | Y | shop/grant | 20260502030000 |
| `plumeria_lei_bow` | bow | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `polka_bow` | bow | common | 95 | **OK** | Y | shop/grant | 20260502030000 |
| `rainbow_bow` | bow | rare | 1100 | **OK** | Y | shop/grant | 20260502030000 |
| `ribbon_bow` | bow | common | 90 | **OK** | Y | shop/grant | 20260502030000 |
| `rosebud_bow` | bow | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `royal_velvet_bow` | bow | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `silk_bow` | bow | uncommon | 320 | **OK** | Y | shop/grant | 20260502030000 |
| `slop_club_seal_bow` | bow | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `snow_crystal_bow` | bow | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `stardust_bow` | bow | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `velvet_bow` | bow | uncommon | 280 | **OK** | Y | shop/grant | 20260502030000 |
| `velvet_jewel_bow` | bow | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `flag_algeria` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_argentina` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_australia` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_austria` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_belgium` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_brazil` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_canada` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_colombia` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_croatia` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_curacao` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_czechia` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_ecuador` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_egypt` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_england` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_france` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_germany` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_ghana` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_haiti` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_iraq` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_japan` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_jordan` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_mexico` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_morocco` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_netherlands` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_norway` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_panama` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_paraguay` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_portugal` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_qatar` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_scotland` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_senegal` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_spain` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_sweden` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_switzerland` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_tunisia` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_turkiye` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_uruguay` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_usa` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `flag_uzbekistan` | flag | rare | 300 | **OK** | Y | shop/grant | 20260569000000 |
| `aviator_sunglasses` | glasses | uncommon | 200 | **OK** | Y | shop/grant | 20260502030000 |
| `cocoa_sheen_specs` | glasses | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `coconut_shell_shades` | glasses | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `frost_spectacles` | glasses | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `galaxy_shades` | glasses | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `heart_sunglasses` | glasses | uncommon | 220 | **OK** | Y | shop/grant | 20260502030000 |
| `knight_visor_specs` | glasses | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `lollipop_specs` | glasses | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `monocle` | glasses | rare | 1200 | **OK** | Y | shop/grant | 20260502030000 |
| `nerd_glasses` | glasses | common | 75 | **OK** | Y | shop/grant | 20260502030000 |
| `opera_lorgnette` | glasses | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `petal_specs` | glasses | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `pixel_glasses` | glasses | uncommon | 350 | **OK** | Y | shop/grant | 20260502030000 |
| `round_glasses` | glasses | common | 80 | **OK** | Y | shop/grant | 20260502030000 |
| `royal_pince_nez` | glasses | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `safety_goggles` | glasses | common | 60 | **OK** | Y | shop/grant | 20260502030000 |
| `slop_club_monocle_crest` | glasses | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `swim_goggles` | glasses | common | 90 | **OK** | Y | shop/grant | 20260502030000 |
| `three_d_glasses` | glasses | common | 120 | **OK** | Y | shop/grant | 20260502030000 |
| `vr_headset` | glasses | epic | 1800 | **OK** | Y | shop/grant | 20260502030000 |
| `astronaut` | hat | epic | 0 | **OK** | Y | shop/grant | 20260544000000 |
| `aurora_glow_hood` | hat | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `beanie` | hat | common | 60 | **OK** | Y | shop/grant | 20260502030000 |
| `bog_helmet` | hat | rare | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `bunny_ears` | hat | rare | 0 | **OK** | Y | shop/grant | 20260544000000 |
| `candlelit_circlet` | hat | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `cat_ears` | hat | rare | 0 | **OK** | Y | shop/grant | 20260544000000 |
| `chef_toque` | hat | uncommon | 180 | **OK** | Y | shop/grant | 20260502030000 |
| `cowboy` | hat | - | 50 | **OK** | Y | shop/grant | 20260501210000 |
| `crescent_moon_cap` | hat | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `crown` | hat | epic | 8000 | **OK** | Y | shop/grant | 20260502030000 |
| `daisy_flower_crown` | hat | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `devil_horns` | hat | epic | 0 | **OK** | Y | shop/grant | 20260544000000 |
| `ermine_coronet` | hat | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `frost_monarch_crown` | hat | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `frosted_cupcake_crown` | hat | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `ganache_truffle_crown` | hat | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `halo` | hat | rare | 1200 | **OK** | Y | shop/grant | 20260502030000 |
| `hibiscus_sun_crown` | hat | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `leaf_crown` | hat | epic | 0 | **OK** | Y | shop/grant | 20260544000000 |
| `masquerade_plume_hat` | hat | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `messenger` | hat | - | 0 | **OK** | Y | shop/grant | 20260566000000 |
| `muddy_cap` | hat | common | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `party` | hat | - | 25 | **OK** | Y | shop/grant | 20260501210000 |
| `pineapple_tiki_hat` | hat | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `pirate_tricorn` | hat | uncommon | 350 | **OK** | Y | shop/grant | 20260502030000 |
| `reed_hat` | hat | uncommon | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `ringed_planet_hat` | hat | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `rosette_cap` | hat | rare | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `silver_plume_helm` | hat | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `slop_bucket_hat` | hat | uncommon | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `slop_club_laurel_cap` | hat | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `slop_club_signet_crown` | hat | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `slop_club_signet_visor` | hat | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `slop_pail_topper` | hat | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `sovereign_jewel_crown` | hat | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `squire_feather_cap` | hat | common | 1200 | **OK** | Y | Slop Club | 20260690000000 |
| `swamp_crown` | hat | epic | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `tophat` | hat | - | 200 | **OK** | Y | shop/grant | 20260501210000 |
| `viking_helmet` | hat | rare | 600 | **OK** | Y | shop/grant | 20260502030000 |
| `watering_can_hat` | hat | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `whipped_swirl_cap` | hat | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `wizard` | hat | - | 100 | **OK** | Y | shop/grant | 20260501210000 |
| `balloon` | held | common | 45 | **OK** | Y | shop/grant | 20260502030000 |
| `coffee_mug` | held | common | 50 | **OK** | Y | shop/grant | 20260502030000 |
| `comet_wand` | held | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `controller` | held | uncommon | 350 | **OK** | Y | shop/grant | 20260502030000 |
| `corn_on_the_cob` | held | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `crew_pennant` | held | rare | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `feathered_fan` | held | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `festival_pennant` | held | epic | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `flowers` | held | common | 180 | **OK** | Y | shop/grant | 20260502030000 |
| `garden_trowel_held` | held | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `golden_truffle` | held | rare | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `ice_cream` | held | common | 65 | **OK** | Y | shop/grant | 20260502030000 |
| `icicle_scepter` | held | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `magic_wand` | held | rare | 800 | **OK** | Y | shop/grant | 20260502030000 |
| `magnifier` | held | common | 130 | **OK** | Y | shop/grant | 20260502030000 |
| `mud_pie` | held | uncommon | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `mud_shovel` | held | common | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `pencil` | held | common | 30 | **OK** | Y | shop/grant | 20260502030000 |
| `pineapple_paradise_cup` | held | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `pizza_slice` | held | common | 80 | **OK** | Y | shop/grant | 20260502030000 |
| `round_buckler_held` | held | rare | 3000 | **OK** | Y | Slop Club | 20260690000000 |
| `royal_scepter` | held | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `slop_bucket` | held | common | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `slop_club_membership_card` | held | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `soccer_ball` | held | uncommon | 250 | **OK** | Y | shop/grant | 20260589000000 |
| `toy_sword` | held | uncommon | 250 | **OK** | Y | shop/grant | 20260502030000 |
| `truffle_medal_held` | held | epic | 4200 | **OK** | Y | Slop Club | 20260690000000 |
| `carnival_mask` | mask | uncommon | 320 | **OK** | Y | shop/grant | 20260502030000 |
| `cat_mask` | mask | uncommon | 240 | **OK** | Y | shop/grant | 20260502030000 |
| `domino` | mask | common | 120 | **OK** | Y | shop/grant | 20260502030000 |
| `hero_mask` | mask | uncommon | 360 | **OK** | Y | shop/grant | 20260502030000 |
| `masquerade` | mask | uncommon | 380 | **OK** | Y | shop/grant | 20260502030000 |
| `midnight_eye_mask` | mask | legendary | 5500 | **OK** | Y | Slop Club | 20260690000000 |
| `robber_mask` | mask | uncommon | 200 | **OK** | Y | shop/grant | 20260502030000 |
| `skull_mask` | mask | epic | 1600 | **OK** | Y | shop/grant | 20260502030000 |
| `sleep_mask` | mask | common | 50 | **OK** | Y | shop/grant | 20260502030000 |
| `venice_mask` | mask | epic | 1800 | **OK** | Y | shop/grant | 20260502030000 |
| `prize_sash` | neck | rare | 0 | **OK** | Y | shop/grant | 20260650000000 |
| `beta_founder_ribbon` | necklace | legendary | 0 | **OK** | Y | shop/grant | 20260704400000 |
| `ascot` | scarf | uncommon | 480 | **OK** | Y | shop/grant | 20260502030000 |
| `bandana_red` | scarf | common | 55 | **OK** | Y | shop/grant | 20260502030000 |
| `cape_scarf` | scarf | uncommon | 220 | **OK** | Y | shop/grant | 20260502030000 |
| `knit_scarf` | scarf | common | 70 | **OK** | Y | shop/grant | 20260502030000 |
| `rainbow_scarf` | scarf | rare | 1200 | **OK** | Y | shop/grant | 20260502030000 |
| `silk_scarf` | scarf | uncommon | 350 | **OK** | Y | shop/grant | 20260502030000 |
| `striped_scarf` | scarf | common | 95 | **OK** | Y | shop/grant | 20260502030000 |
| `summer_kerchief` | scarf | common | 60 | **OK** | Y | shop/grant | 20260502030000 |
| `winter_scarf` | scarf | common | 120 | **OK** | Y | shop/grant | 20260502030000 |
| `crown_spark_particle` | tickle_particle | common | 1200 | **OK** | Y | Slop Club | 20260690000000 |
| `particle_clover` | tickle_particle | rare | 500 | **OK** | Y | shop/grant | 20260549000000 |
| `particle_halo` | tickle_particle | rare | 700 | **OK** | Y | shop/grant | 20260549000000 |
| `particle_heart` | tickle_particle | common | 100 | **OK** | Y | shop/grant | 20260549000000 |
| `particle_music_note` | tickle_particle | uncommon | 320 | **OK** | Y | shop/grant | 20260549000000 |
| `particle_rainbow` | tickle_particle | epic | 1000 | **OK** | Y | shop/grant | 20260549000000 |
| `particle_snout` | tickle_particle | uncommon | 250 | **OK** | Y | shop/grant | 20260549000000 |
| `particle_sparkle` | tickle_particle | common | 150 | **OK** | Y | shop/grant | 20260549000000 |
| `particle_star` | tickle_particle | uncommon | 300 | **OK** | Y | shop/grant | 20260549000000 |
| `snowglint_particle` | tickle_particle | common | 1200 | **OK** | Y | Slop Club | 20260690000000 |
| `stardust_sparkle_particle` | tickle_particle | uncommon | 2000 | **OK** | Y | Slop Club | 20260690000000 |
| `sugar_sprinkle_particle` | tickle_particle | common | 1200 | **OK** | Y | Slop Club | 20260690000000 |
