// Static mapping for require() — RN bundler needs literal paths.
import { MEMBERS_IMAGES } from "./membersImages.generated";

export const HAT_IMAGES: Record<string, number> = {
	wizard: require("../assets/images/hats/wizard.png"),
	cowboy: require("../assets/images/hats/cowboy.png"),
	tophat: require("../assets/images/hats/tophat.png"),
	party: require("../assets/images/hats/party.png"),
	monocle: require("../assets/images/hats/monocle.png"),
	// Batch 1 — generated 2026-05-06 via Strategy A v3
	beanie: require("../assets/images/hats/beanie.png"),
	halo: require("../assets/images/hats/halo.png"),
	viking_helmet: require("../assets/images/hats/viking_helmet.png"),
	pirate_tricorn: require("../assets/images/hats/pirate_tricorn.png"),
	chef_toque: require("../assets/images/hats/chef_toque.png"),
	aviator_sunglasses: require("../assets/images/hats/aviator_sunglasses.png"),
	vr_headset: require("../assets/images/hats/vr_headset.png"),
	three_d_glasses: require("../assets/images/hats/three_d_glasses.png"),
	nerd_glasses: require("../assets/images/hats/nerd_glasses.png"),
	round_glasses: require("../assets/images/hats/round_glasses.png"),
	// Batch 2 v6 — pig-style sharper prompts, generated 2026-05-06
	pink_bow: require("../assets/images/hats/pink_bow.png"),
	ribbon_bow: require("../assets/images/hats/ribbon_bow.png"),
	hair_bow: require("../assets/images/hats/hair_bow.png"),
	gift_bow: require("../assets/images/hats/gift_bow.png"),
	polka_bow: require("../assets/images/hats/polka_bow.png"),
	sleep_mask: require("../assets/images/hats/sleep_mask.png"),
	domino: require("../assets/images/hats/domino.png"),
	hero_mask: require("../assets/images/hats/hero_mask.png"),
	cat_mask: require("../assets/images/hats/cat_mask.png"),
	masquerade: require("../assets/images/hats/masquerade.png"),
	// Batch 3 partial — scarves
	knit_scarf: require("../assets/images/hats/knit_scarf.png"),
	silk_scarf: require("../assets/images/hats/silk_scarf.png"),
	bandana_red: require("../assets/images/hats/bandana_red.png"),
	// Batch 3b — scarves
	cape_scarf: require("../assets/images/hats/cape_scarf.png"),
	striped_scarf: require("../assets/images/hats/striped_scarf.png"),
	winter_scarf: require("../assets/images/hats/winter_scarf.png"),
	summer_kerchief: require("../assets/images/hats/summer_kerchief.png"),
	ascot: require("../assets/images/hats/ascot.png"),
	rainbow_scarf: require("../assets/images/hats/rainbow_scarf.png"),
	// Capes — REMOVED 2026-05-22. Like necklaces, the cape art never
	// sat right on the pig (capes wrap the body — front-only art looks
	// broken when the pig leans). TODO: regenerate the cape set with
	// art tuned to the pig, then re-add the 10 items here, to
	// hat_rel.generated (via tools/placement_studio), the assets/images/hats/
	// PNGs, and the `hats` shop-catalog rows. The `cape` category
	// scaffold (CATEGORY_ANCHORS / PIVOTS / OVERLAYS / EMOJI /
	// Z_BEHIND_PIG) is kept below.
	// Batch 4 — held items
	magic_wand: require("../assets/images/hats/magic_wand.png"),
	toy_sword: require("../assets/images/hats/toy_sword.png"),
	controller: require("../assets/images/hats/controller.png"),
	// Soccer ball is now an ordinary held cosmetic; the retired allegiance
	// feature no longer owns it.
	soccer_ball: require("../assets/images/hats/soccer_ball.png"),
	// Batch 5 — necklaces: REMOVED 2026-05-22. The necklace art never
	// sat right on the pig (it didn't read as "around the neck").
	// TODO: regenerate the necklace set with art tuned to the pig's
	// neck anatomy, then re-add the 10 items here, to hat_rel.generated
	// (via tools/placement_studio), the assets/images/hats/ PNGs, and the
	// `hats` shop-catalog rows. The `necklace` category scaffold
	// (CATEGORY_ANCHORS / PIVOTS / OVERLAYS / EMOJI) is kept below.
	// Batch 6 — held + bows
	pencil: require("../assets/images/hats/pencil.png"),
	magnifier: require("../assets/images/hats/magnifier.png"),
	balloon: require("../assets/images/hats/balloon.png"),
	flowers: require("../assets/images/hats/flowers.png"),
	ice_cream: require("../assets/images/hats/ice_cream.png"),
	pizza_slice: require("../assets/images/hats/pizza_slice.png"),
	coffee_mug: require("../assets/images/hats/coffee_mug.png"),
	black_bow_tie: require("../assets/images/hats/black_bow_tie.png"),
	archery_bow: require("../assets/images/hats/archery_bow.png"),
	silk_bow: require("../assets/images/hats/silk_bow.png"),
	// Batch 7 — bows, masks, glasses
	velvet_bow: require("../assets/images/hats/velvet_bow.png"),
	rainbow_bow: require("../assets/images/hats/rainbow_bow.png"),
	robber_mask: require("../assets/images/hats/robber_mask.png"),
	carnival_mask: require("../assets/images/hats/carnival_mask.png"),
	venice_mask: require("../assets/images/hats/venice_mask.png"),
	skull_mask: require("../assets/images/hats/skull_mask.png"),
	swim_goggles: require("../assets/images/hats/swim_goggles.png"),
	heart_sunglasses: require("../assets/images/hats/heart_sunglasses.png"),
	pixel_glasses: require("../assets/images/hats/pixel_glasses.png"),
	// Batch 8 — auras
	pink_glow: require("../assets/images/hats/pink_glow.png"),
	gold_aura: require("../assets/images/hats/gold_aura.png"),
	rainbow_aura: require("../assets/images/hats/rainbow_aura.png"),
	fire_aura: require("../assets/images/hats/fire_aura.png"),
	ice_aura: require("../assets/images/hats/ice_aura.png"),
	electric_aura: require("../assets/images/hats/electric_aura.png"),
	shadow_aura: require("../assets/images/hats/shadow_aura.png"),
	holy_aura: require("../assets/images/hats/holy_aura.png"),
	sparkle_aura: require("../assets/images/hats/sparkle_aura.png"),
	petal_aura: require("../assets/images/hats/petal_aura.png"),
	// Batch 9 — backgrounds (full canvas, opaque)
	// Backgrounds live in their own folder so it's clear they're a
	// distinct category — fullscreen pages, not pig accessories.
	// HAT_IMAGES still keys them by item id like everything else;
	// just the require() path differs.
	homestead_barn: require("../assets/images/backgrounds/homestead_barn.jpg"),
	sunset_farm: require("../assets/images/backgrounds/sunset_farm.png"),
	snowy_farm: require("../assets/images/backgrounds/snowy_farm.png"),
	beach_island: require("../assets/images/backgrounds/beach_island.png"),
	space_station: require("../assets/images/backgrounds/space_station.png"),
	candyland: require("../assets/images/backgrounds/candyland.png"),
	forest_grove: require("../assets/images/backgrounds/forest_grove.png"),
	jungle: require("../assets/images/backgrounds/jungle.png"),
	underwater: require("../assets/images/backgrounds/underwater.png"),
	desert_dunes: require("../assets/images/backgrounds/desert_dunes.png"),
	mountain_top: require("../assets/images/backgrounds/mountain_top.png"),
	// Soccer backdrops remain ordinary cosmetics after the allegiance feature.
	soccer_field_day: require("../assets/images/backgrounds/soccer_field_day.png"),
	soccer_street: require("../assets/images/backgrounds/soccer_street.png"),
	soccer_podium: require("../assets/images/backgrounds/soccer_podium.png"),
	soccer_field_night: require("../assets/images/backgrounds/soccer_field_night.png"),
	// Stragglers
	crown: require("../assets/images/hats/crown.png"),
	safety_goggles: require("../assets/images/hats/safety_goggles.png"),
	// Mud War (Season 1) — generated 2026-06-14 via docs/openai-mud-war-items.md,
	// sliced by scripts/slice_mudwar.py. Items in hats/, backgrounds in
	// backgrounds/. The festival accessories were re-keyed from Strip 5's baked
	// transparency checkerboard via a luminance+saturation key; `confetti_aura`
	// also had its night-scene bleed cut by slice_mudwar.night_cut (dynamic
	// dark-column boundary) so all 4 festival pieces ship.
	muddy_cap: require("../assets/images/hats/muddy_cap.png"),
	slop_bucket_hat: require("../assets/images/hats/slop_bucket_hat.png"),
	reed_hat: require("../assets/images/hats/reed_hat.png"),
	bog_helmet: require("../assets/images/hats/bog_helmet.png"),
	swamp_crown: require("../assets/images/hats/swamp_crown.png"),
	slop_bucket: require("../assets/images/hats/slop_bucket.png"),
	mud_shovel: require("../assets/images/hats/mud_shovel.png"),
	mud_pie: require("../assets/images/hats/mud_pie.png"),
	// Wallow prestige ladder — one grant-only wearable per rank.
	wallow_rookie_cap: require("../assets/images/hats/wallow_rookie_cap.png"),
	wallow_bronze_specs: require("../assets/images/hats/wallow_bronze_specs.png"),
	wallow_marsh_crown: require("../assets/images/hats/wallow_marsh_crown.png"),
	wallow_gilded_bow: require("../assets/images/hats/wallow_gilded_bow.png"),
	wallow_golden_trowel: require("../assets/images/hats/wallow_golden_trowel.png"),
	wallow_sovereign_crown: require("../assets/images/hats/wallow_sovereign_crown.png"),
	// Legacy tournament trophy remains usable by players who earned it.
	golden_hog_cup: require("../assets/images/hats/golden_hog_cup.png"),
	golden_truffle: require("../assets/images/hats/golden_truffle.png"),
	crew_pennant: require("../assets/images/hats/crew_pennant.png"),
	mud_splatter_aura: require("../assets/images/hats/mud_splatter_aura.png"),
	swamp_bubble_aura: require("../assets/images/hats/swamp_bubble_aura.png"),
	firefly_aura: require("../assets/images/hats/firefly_aura.png"),
	golden_bog_aura: require("../assets/images/hats/golden_bog_aura.png"),
	heirloom_mire_aura: require("../assets/images/hats/heirloom_mire_aura.png"),
	mud_pit_bg: require("../assets/images/backgrounds/mud_pit_bg.png"),
	reed_marsh_bg: require("../assets/images/backgrounds/reed_marsh_bg.png"),
	mud_derby_bg: require("../assets/images/backgrounds/mud_derby_bg.png"),
	bog_dusk_bg: require("../assets/images/backgrounds/bog_dusk_bg.png"),
	golden_mire_bg: require("../assets/images/backgrounds/golden_mire_bg.png"),
	festival_night_bg: require("../assets/images/backgrounds/festival_night_bg.png"),
	// Animated background: frame 1 is the static shop-card thumbnail; the live
	// frame loop lives in constants/animatedBackgrounds.ts.
	northern_lights: require("../assets/images/backgrounds/northern_lights_1.png"),
	rosette_cap: require("../assets/images/hats/rosette_cap.png"),
	prize_sash: require("../assets/images/hats/prize_sash.png"),
	// Beta founder reward — legendary 'neck' rosette pendant (seeded in
	// supabase migration 20260704400000_beta_rewards.sql).
	beta_founder_ribbon: require("../assets/images/hats/beta_founder_ribbon.png"),
	festival_pennant: require("../assets/images/hats/festival_pennant.png"),
	confetti_aura: require("../assets/images/hats/confetti_aura.png"),
	// Tickle particles — equipable cosmetic that swaps the ♥/✦
	// text glyphs floating above the pig on each tap. Catalog rows
	// live in public.hats with category 'tickle_particle' (see
	// migration 20260549000000_tickle_particles).
	particle_heart:      require("../assets/images/tickle-particles/heart.png"),
	particle_star:       require("../assets/images/tickle-particles/star.png"),
	particle_sparkle:    require("../assets/images/tickle-particles/sparkle.png"),
	particle_snout:      require("../assets/images/tickle-particles/snout.png"),
	particle_clover:     require("../assets/images/tickle-particles/clover.png"),
	particle_halo:       require("../assets/images/tickle-particles/halo.png"),
	particle_rainbow:    require("../assets/images/tickle-particles/rainbow.png"),
	particle_music_note: require("../assets/images/tickle-particles/music-note.png"),
	// Batch 10 — missing-artwork drop, generated 2026-05-26 via ChatGPT
	// with the openai-missing-artwork.md prompts. Five season-pass tier
	// rewards (bunny_ears/leaf_crown/devil_horns/cat_ears/astronaut)
	// plus the referral-milestone messenger hat. Necklaces + capes
	// were intentionally dropped — they don't fit the 2D-front pig
	// silhouette cleanly.
	astronaut:    require("../assets/images/hats/astronaut.png"),
	bunny_ears:   require("../assets/images/hats/bunny_ears.png"),
	cat_ears:     require("../assets/images/hats/cat_ears.png"),
	devil_horns:  require("../assets/images/hats/devil_horns.png"),
	leaf_crown:   require("../assets/images/hats/leaf_crown.png"),
	messenger:    require("../assets/images/hats/messenger.png"),
	// Art-backlog pass — generated 2026-07-06 via ChatGPT with
	// docs/openai-missing-items-icons.md, sliced by scripts/slice_missing_items.py.
	// Restores all 11 of the 20260632 daily-shop-expand items hidden by 20260685.
	mushroom_cap:    require("../assets/images/hats/mushroom_cap.png"),
	paper_boat:      require("../assets/images/hats/paper_boat.png"),
	jam_jar_lenses:  require("../assets/images/hats/jam_jar_lenses.png"),
	acorn_bow:       require("../assets/images/hats/acorn_bow.png"),
	bumblebee_bow:   require("../assets/images/hats/bumblebee_bow.png"),
	firefly_lantern: require("../assets/images/hats/firefly_lantern.png"),
	tiny_umbrella:   require("../assets/images/hats/tiny_umbrella.png"),
	moth_waltz:      require("../assets/images/hats/moth_waltz.png"),
	particle_bubble: require("../assets/images/tickle-particles/bubble.png"),
	pumpkin_patch:   require("../assets/images/backgrounds/pumpkin_patch.png"),
	library_nook:    require("../assets/images/backgrounds/library_nook.png"),
	// Release Party Crown — legendary grant-only hat, gifted via a Golden Ticket
	// redemption at the launch party (never sold). Seeded server-side in
	// supabase migration 20260733000000_release_party_crown.sql.
	// ⚠️ ANCHOR GATE: needs one placement pass in tools/placement_studio
	// (http://127.0.0.1:8124/) before it sits right on Rosie's head.
	release_party_crown: require("../assets/images/hats/release_party_crown.png"),
	// Ticket Taker's Cap — rare grant-only hat for general Golden-Ticket
	// giveaways (street QR, creator drops). Seeded in migration 20260734.
	// ⚠️ ANCHOR GATE: placement pass needed (same as the crown). Art ships
	// from build 108 — grants redeemed on 107 show the fallback plate until
	// the update lands.
	ticket_takers_cap: require("../assets/images/hats/ticket_takers_cap.png"),
	// Season 1 finale reward — the Hungerer's Crown, taken as a trophy when the
	// herd starves him to Famished. Grant-only (cost 0), fired by the admin via
	// grant_season1_finale(). Seeded in migration
	// 20260739100000_season1_finale_reward.sql. Placement tuned in
	// hat_rel.generated (pivot y 0.9, widthFrac 0.54).
	hungerers_crown: require("../assets/images/hats/hungerers_crown.png")
};

// Browse surfaces never display these held-item masters above a few dozen
// points, but the source art is 1024². Keep masters for PigStage/preview
// composition and decode these explicit tiers in chips and catalog grids.
export const HAT_THUMBNAILS_128: Partial<Record<string, number>> = {
	magic_wand: require("../assets/images/hats/thumbs/128/magic_wand.png"),
	toy_sword: require("../assets/images/hats/thumbs/128/toy_sword.png"),
	controller: require("../assets/images/hats/thumbs/128/controller.png"),
	pencil: require("../assets/images/hats/thumbs/128/pencil.png"),
	magnifier: require("../assets/images/hats/thumbs/128/magnifier.png"),
	balloon: require("../assets/images/hats/thumbs/128/balloon.png"),
	flowers: require("../assets/images/hats/thumbs/128/flowers.png"),
	ice_cream: require("../assets/images/hats/thumbs/128/ice_cream.png"),
	pizza_slice: require("../assets/images/hats/thumbs/128/pizza_slice.png"),
	coffee_mug: require("../assets/images/hats/thumbs/128/coffee_mug.png")
};

export const HAT_THUMBNAILS_256: Partial<Record<string, number>> = {
	magic_wand: require("../assets/images/hats/thumbs/256/magic_wand.png"),
	toy_sword: require("../assets/images/hats/thumbs/256/toy_sword.png"),
	controller: require("../assets/images/hats/thumbs/256/controller.png"),
	pencil: require("../assets/images/hats/thumbs/256/pencil.png"),
	magnifier: require("../assets/images/hats/thumbs/256/magnifier.png"),
	balloon: require("../assets/images/hats/thumbs/256/balloon.png"),
	flowers: require("../assets/images/hats/thumbs/256/flowers.png"),
	ice_cream: require("../assets/images/hats/thumbs/256/ice_cream.png"),
	pizza_slice: require("../assets/images/hats/thumbs/256/pizza_slice.png"),
	coffee_mug: require("../assets/images/hats/thumbs/256/coffee_mug.png")
};

// Slop Club members-only art — AUTO-WIRED from constants/membersImages.generated
// (require() for every members item whose PNG has landed). Generated by
// scripts/gen_members_catalog.js so each art batch wires itself. Assigned after
// the base map so a members id can't collide with a base id (catalog is
// collision-checked).
Object.assign(HAT_IMAGES, MEMBERS_IMAGES);

// Per-hat overlay positioning on the 300x300 pig card.
// Anchored from the bottom so each hat's bottom edge sits on the pig's head.
// `HatOverlay` lives in its own module to break the import cycle with the
// auto-generated overlays file; re-export here so consumers can keep
// importing it from "constants/hats".
export type { HatOverlay, AnchorName, Anchor, RelSpec } from "./hat_overlay_types";
import type { HatOverlay, AnchorName, Anchor, RelSpec } from "./hat_overlay_types";

// The anchor coordinate space — all REST_ANCHORS / PIG_FRAME_ANCHORS
// values are in this 300×300 box. Anchor-relative placement divides by
// it to get fractions; the live render multiplies by the actual pig
// size. Keep in sync with SpritePig's `size` in SwipeElement.
export const PIG_CANVAS = 300;

// Per-item anchor-RELATIVE placement specs (see RelSpec). An item with
// an entry here is positioned the relative way; items without fall into
// their category's preset box (CATEGORY_OVERLAYS). The data is auto-written
// by tools/placement_studio — drag an attach point and it persists into
// hat_rel.generated.ts, which Metro hot-reloads.
import { HAT_REL_DATA } from "./hat_rel.generated";
import { MEMBERS_REL_DATA } from "./membersRel.generated";
// Members items get category-default anchor placement; any hand-tuned entry in
// hat_rel.generated (via tools/placement_studio) overrides it.
export const HAT_REL: Record<string, RelSpec> = {
	...MEMBERS_REL_DATA,
	...HAT_REL_DATA
};

// Per-category z-order: items rendered BEHIND the pig vs IN FRONT.
// Backgrounds, auras, and capes sit behind. Everything else in front.
export const Z_BEHIND_PIG: Record<string, boolean> = {
	background: true,
	aura: true,
	cape: true
};

// Categories temporarily hidden from shop + wardrobe because they wrap
// around the pig (scarf, cape) and need either two-layer art (back+front)
// or skeletal rigging to look right. Placement-friendly categories are
// still shown. Re-enable per-category once placement is solved.
// scarf + cape: front-only art looks broken when the pig leans.
// necklace: didn't read as "around the neck" given how the pig art
// covers the chest area — removed product-side rather than try to
// rescue the placement.
export const HIDDEN_CATEGORIES = new Set<string>(["scarf", "cape", "necklace"]);

// PigAnimationKey moved to hat_overlay_types.ts so HatOverlay.perAnim
// can reference it without forming a circular import. Re-export so
// existing callers don't break.
export type { PigAnimationKey } from "./hat_overlay_types";
import type { PigAnimationKey } from "./hat_overlay_types";

// Anchors describe named points on the pig (head crown, eye line, hand, etc.)
// at every frame of every animation. Items declare which anchor they attach
// to (via category default or per-item override). At render time, the item
// is shifted by the anchor's delta from its rest position — so hats track
// the head, glasses track the eyes, held items track the hand, all from
// the same per-frame data.
//
// Anchor coordinates are in 300×300 card space, y measured from the TOP.
// Everything below references "rest" — the position of each anchor in
// `idle` frame 0. Other frames define their anchors as absolute positions;
// SwipeElement subtracts the rest anchor to get a delta and applies it to
// the item's existing `bottom`/`left`.

// Measured against the new ChatGPT Rosie sprite (idle_1 → 351×257 source,
// rendered at 300×220 inside the 300×300 card via resizeMode=contain).
// Re-measure with scripts/measure_pig_anatomy.py if the sprite art changes.
// Auto-rigged from idle_1.png — re-run `python3 scripts/auto_rig.py`
// after replacing sprites. Centerline anchors snapped to x=150 (pig
// is symmetric front-facing; per-pose pixel-centroid drift is noise).
// REST anchors = canonical idle frame 0 anatomy. Items declare their
// base position relative to these; every other frame's delta from rest
// shifts the item to follow. Keep these in sync with
// PIG_FRAME_ANCHORS.idle[0] — if you re-tune idle in the editor, copy
// frame 0's values here as well so the rest baseline tracks the art.
//
// `eyes` and `feet` are VIRTUAL midpoints computed at lookup time
// (resolveAnchor) from their L/R pair; the values here only matter as
// fallback when neither L nor R is overridden in a frame.
const REST_ANCHORS: Record<AnchorName, Anchor> = {
	head: { x: 154, y: 16 },
	eye_l: { x: 111, y: 109 },
	eye_r: { x: 208, y: 109 },
	eyes: { x: 160, y: 109 }, // midpoint of eye_l/eye_r (virtual)
	snout: { x: 160, y: 137 },
	mouth: { x: 163, y: 161 },
	neck: { x: 155, y: 213 },
	body: { x: 151, y: 245 },
	hand_l: { x: 113, y: 281 },
	hand_r: { x: 198, y: 281 },
	leg_l: { x: 64, y: 275 },
	leg_r: { x: 107, y: 265 },
	feet: { x: 86, y: 270 }, // midpoint of leg_l/leg_r (virtual)
};

// Per-animation per-frame anchor positions. Only define what changes from
// REST_ANCHORS — anchors not listed in a frame inherit from rest. Numbers
// are tuned by inspection of the current Rosie sprite sheet.
// Auto-rigged via scripts/auto_rig.py. We detect FEET y per frame and
// emit a uniform shiftAll(dy) for the whole frame instead of per-anchor
// centroids — much more robust against detector noise. Stable
// animations (no vertical movement) are recorded as {} (rest).
//
// Notable rest-relative shifts:
//   sad: pig is more compact when slumped, ~7px shorter overall
//   wave: pig is taller when standing on hind legs, ~40px lifted
// ANCHOR_EDITOR_START — content between these sentinels is managed by
// tools/anchor-editor's Save button. Hand edits are OK but will be
// overwritten on the next save. Do not move or rename the sentinels.
// A head that TILTS stays where it is: on idle's tilt frame (frame 5) the
// `head` anchor is the rest head offset rotated about the eye midpoint by
// the eye-line angle, not a fresh point picked off the art. The hat takes
// its lean from the eye line (`resolveWearablePose`), so a head anchor that
// wanders off sideways reads as the hat sliding off, never as a tilt.
// (2026-09-17)
export const PIG_FRAME_ANCHORS: Record<
	PigAnimationKey,
	Partial<Record<AnchorName, Anchor>>[]
> = {
	idle: [
		{ head: { x: 154, y: 16 }, eye_l: { x: 111, y: 109 }, eye_r: { x: 208, y: 109 }, snout: { x: 160, y: 137 }, mouth: { x: 163, y: 161 }, neck: { x: 155, y: 213 }, body: { x: 151, y: 245 }, hand_l: { x: 113, y: 281 }, hand_r: { x: 198, y: 281 }, leg_l: { x: 64, y: 275 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 154, y: 19 }, eye_l: { x: 114, y: 112 }, eye_r: { x: 210, y: 112 }, snout: { x: 164, y: 140 }, mouth: { x: 168, y: 165 }, neck: { x: 156, y: 215 }, body: { x: 150, y: 246 }, hand_l: { x: 114, y: 281 }, hand_r: { x: 198, y: 281 }, leg_l: { x: 64, y: 275 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 154, y: 19 }, eye_l: { x: 116, y: 113 }, eye_r: { x: 211, y: 112 }, snout: { x: 165, y: 141 }, mouth: { x: 167, y: 165 }, neck: { x: 157, y: 215 }, body: { x: 150, y: 246 }, hand_l: { x: 115, y: 281 }, hand_r: { x: 201, y: 281 }, leg_l: { x: 66, y: 275 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 154, y: 19 }, eye_l: { x: 116, y: 112 }, eye_r: { x: 211, y: 112 }, snout: { x: 166, y: 140 }, mouth: { x: 168, y: 165 }, neck: { x: 157, y: 213 }, body: { x: 150, y: 244 }, hand_l: { x: 115, y: 281 }, hand_r: { x: 200, y: 281 }, leg_l: { x: 64, y: 271 }, leg_r: { x: 64, y: 258 } },
		{ head: { x: 153, y: 18 }, eye_l: { x: 109, y: 114 }, eye_r: { x: 215, y: 114 }, snout: { x: 164, y: 142 }, mouth: { x: 166, y: 167 }, neck: { x: 156, y: 215 }, body: { x: 150, y: 246 }, hand_l: { x: 111, y: 281 }, hand_r: { x: 196, y: 281 }, leg_l: { x: 62, y: 275 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 146, y: 20 }, eye_l: { x: 117, y: 118 }, eye_r: { x: 212, y: 105 }, snout: { x: 170, y: 138 }, mouth: { x: 176, y: 161 }, neck: { x: 157, y: 214 }, body: { x: 150, y: 245 }, hand_l: { x: 120, y: 281 }, hand_r: { x: 205, y: 281 }, leg_l: { x: 71, y: 275 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 152, y: 19 }, eye_l: { x: 108, y: 116 }, eye_r: { x: 204, y: 116 }, snout: { x: 157, y: 141 }, mouth: { x: 160, y: 165 }, neck: { x: 153, y: 215 }, body: { x: 150, y: 246 }, hand_l: { x: 115, y: 281 }, hand_r: { x: 200, y: 281 }, leg_l: { x: 66, y: 275 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 153, y: 22 }, eye_l: { x: 108, y: 116 }, eye_r: { x: 205, y: 116 }, snout: { x: 159, y: 144 }, mouth: { x: 161, y: 168 }, neck: { x: 153, y: 216 }, body: { x: 150, y: 247 }, hand_l: { x: 113, y: 281 }, hand_r: { x: 199, y: 281 }, leg_l: { x: 64, y: 275 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 152, y: 16 }, eye_l: { x: 109, y: 111 }, eye_r: { x: 207, y: 110 }, snout: { x: 160, y: 139 }, mouth: { x: 162, y: 163 }, neck: { x: 154, y: 214 }, body: { x: 150, y: 245 }, hand_l: { x: 118, y: 280 }, hand_r: { x: 204, y: 280 }, leg_l: { x: 70, y: 274 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 150, y: 14 }, eye_l: { x: 112, y: 111 }, eye_r: { x: 208, y: 106 }, snout: { x: 162, y: 137 }, mouth: { x: 165, y: 161 }, neck: { x: 155, y: 211 }, body: { x: 150, y: 242 }, hand_l: { x: 116, y: 280 }, hand_r: { x: 202, y: 269 }, leg_l: { x: 69, y: 274 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 153, y: 16 }, eye_l: { x: 114, y: 112 }, eye_r: { x: 210, y: 110 }, snout: { x: 164, y: 139 }, mouth: { x: 166, y: 163 }, neck: { x: 156, y: 214 }, body: { x: 150, y: 245 }, hand_l: { x: 114, y: 280 }, hand_r: { x: 199, y: 280 }, leg_l: { x: 66, y: 274 }, leg_r: { x: 107, y: 265 } },
		{ head: { x: 152, y: 16 }, eye_l: { x: 114, y: 111 }, eye_r: { x: 209, y: 110 }, snout: { x: 164, y: 139 }, mouth: { x: 167, y: 163 }, neck: { x: 156, y: 214 }, body: { x: 150, y: 245 }, hand_l: { x: 116, y: 280 }, hand_r: { x: 202, y: 280 }, leg_l: { x: 68, y: 274 }, leg_r: { x: 107, y: 265 } },
	],
	walk: [
		{ head: { x: 157, y: 16 }, eye_l: { x: 131, y: 110 }, eye_r: { x: 224, y: 110 }, snout: { x: 182, y: 123 }, mouth: { x: 177, y: 158 }, neck: { x: 164, y: 202 }, body: { x: 150, y: 235 }, hand_l: { x: 130, y: 280 }, hand_r: { x: 232, y: 270 }, leg_l: { x: 27, y: 263 }, leg_r: { x: 112, y: 251 } },
		{ head: { x: 155, y: 20 }, eye_l: { x: 128, y: 114 }, eye_r: { x: 220, y: 116 }, snout: { x: 190, y: 156 }, mouth: { x: 185, y: 173 }, neck: { x: 162, y: 223 }, body: { x: 149, y: 251 }, hand_l: { x: 111, y: 280 }, hand_r: { x: 162, y: 279 }, leg_l: { x: 55, y: 275 }, leg_r: { x: 128, y: 278 } },
		{ head: { x: 158, y: 16 }, eye_l: { x: 134, y: 110 }, eye_r: { x: 226, y: 110 }, snout: { x: 185, y: 152 }, mouth: { x: 196, y: 169 }, neck: { x: 165, y: 213 }, body: { x: 150, y: 239 }, hand_l: { x: 129, y: 280 }, hand_r: { x: 236, y: 267 }, leg_l: { x: 28, y: 267 }, leg_r: { x: 129, y: 240 } },
		{ head: { x: 156, y: 23 }, eye_l: { x: 130, y: 116 }, eye_r: { x: 220, y: 118 }, snout: { x: 188, y: 156 }, mouth: { x: 180, y: 174 }, neck: { x: 162, y: 224 }, body: { x: 148, y: 252 }, hand_l: { x: 106, y: 282 }, hand_r: { x: 163, y: 280 }, leg_l: { x: 56, y: 276 }, leg_r: { x: 125, y: 279 } },
	],
	jump: [
		{ head: { x: 128, y: 116 }, eye_l: { x: 134, y: 193 }, eye_r: { x: 211, y: 196 }, snout: { x: 174, y: 220 }, mouth: { x: 174, y: 240 }, neck: { x: 161, y: 253 }, body: { x: 150, y: 266 }, hand_l: { x: 121, y: 281 }, hand_r: { x: 215, y: 278 }, leg_l: { x: 65, y: 278 }, leg_r: { x: 158, y: 280 } },
		{ head: { x: 159, y: 20 }, eye_l: { x: 130, y: 102 }, eye_r: { x: 214, y: 102 }, snout: { x: 175, y: 127 }, mouth: { x: 177, y: 148 }, neck: { x: 162, y: 207 }, body: { x: 151, y: 241 }, hand_l: { x: 116, y: 280 }, hand_r: { x: 160, y: 280 }, leg_l: { x: 88, y: 272 }, leg_r: { x: 113, y: 259 } },
		{ head: { x: 120, y: 61 }, eye_l: { x: 129, y: 139 }, eye_r: { x: 213, y: 142 }, snout: { x: 174, y: 166 }, mouth: { x: 174, y: 187 }, neck: { x: 162, y: 222 }, body: { x: 152, y: 246 }, hand_l: { x: 135, y: 260 }, hand_r: { x: 200, y: 254 }, leg_l: { x: 95, y: 281 }, leg_r: { x: 158, y: 279 } },
		{ head: { x: 164, y: 112 }, eye_l: { x: 133, y: 199 }, eye_r: { x: 213, y: 199 }, snout: { x: 176, y: 226 }, mouth: { x: 177, y: 246 }, neck: { x: 161, y: 254 }, body: { x: 149, y: 265 }, hand_l: { x: 111, y: 281 }, hand_r: { x: 260, y: 276 }, leg_l: { x: 37, y: 274 }, leg_r: { x: 220, y: 273 } },
	],
	happy: [
		{ head: { x: 152, y: 16 }, eye_l: { x: 122, y: 114 }, eye_r: { x: 215, y: 113 }, snout: { x: 172, y: 140 }, mouth: { x: 172, y: 163 }, neck: { x: 159, y: 214 }, body: { x: 150, y: 245 }, hand_l: { x: 117, y: 280 }, hand_r: { x: 192, y: 280 }, leg_l: { x: 72, y: 273 }, leg_r: { x: 121, y: 264 } },
		{ head: { x: 152, y: 16 }, eye_l: { x: 121, y: 111 }, eye_r: { x: 215, y: 111 }, snout: { x: 171, y: 140 }, mouth: { x: 173, y: 163 }, neck: { x: 158, y: 214 }, body: { x: 149, y: 245 }, hand_l: { x: 117, y: 280 }, hand_r: { x: 190, y: 279 }, leg_l: { x: 74, y: 273 }, leg_r: { x: 128, y: 266 } },
		{ head: { x: 151, y: 16 }, eye_l: { x: 120, y: 112 }, eye_r: { x: 214, y: 112 }, snout: { x: 169, y: 140 }, mouth: { x: 170, y: 164 }, neck: { x: 158, y: 214 }, body: { x: 150, y: 245 }, hand_l: { x: 116, y: 280 }, hand_r: { x: 189, y: 280 }, leg_l: { x: 72, y: 273 }, leg_r: { x: 120, y: 265 } },
		{ head: { x: 153, y: 16 }, eye_l: { x: 122, y: 116 }, eye_r: { x: 214, y: 115 }, snout: { x: 171, y: 140 }, mouth: { x: 173, y: 163 }, neck: { x: 159, y: 214 }, body: { x: 150, y: 245 }, hand_l: { x: 117, y: 281 }, hand_r: { x: 191, y: 279 }, leg_l: { x: 73, y: 273 }, leg_r: { x: 127, y: 264 } },
	],
	sad: [
		{ head: { x: 118, y: 16 }, eye_l: { x: 124, y: 143 }, eye_r: { x: 212, y: 141 }, snout: { x: 174, y: 165 }, mouth: { x: 174, y: 195 }, neck: { x: 159, y: 223 }, body: { x: 150, y: 247 }, hand_l: { x: 97, y: 275 }, hand_r: { x: 178, y: 272 }, leg_l: { x: 56, y: 268 }, leg_r: { x: 140, y: 266 } },
		{ head: { x: 124, y: 16 }, eye_l: { x: 124, y: 142 }, eye_r: { x: 211, y: 141 }, snout: { x: 172, y: 165 }, mouth: { x: 172, y: 195 }, neck: { x: 158, y: 223 }, body: { x: 149, y: 247 }, hand_l: { x: 97, y: 274 }, hand_r: { x: 177, y: 272 }, leg_l: { x: 57, y: 267 }, leg_r: { x: 139, y: 266 } },
		{ head: { x: 118, y: 19 }, eye_l: { x: 128, y: 142 }, eye_r: { x: 213, y: 141 }, snout: { x: 174, y: 165 }, mouth: { x: 174, y: 195 }, neck: { x: 160, y: 223 }, body: { x: 150, y: 247 }, hand_l: { x: 99, y: 274 }, hand_r: { x: 178, y: 272 }, leg_l: { x: 58, y: 267 }, leg_r: { x: 141, y: 266 } },
		{ head: { x: 124, y: 19 }, eye_l: { x: 126, y: 143 }, eye_r: { x: 213, y: 142 }, snout: { x: 173, y: 167 }, mouth: { x: 173, y: 197 }, neck: { x: 159, y: 224 }, body: { x: 149, y: 248 }, hand_l: { x: 96, y: 275 }, hand_r: { x: 178, y: 272 }, leg_l: { x: 55, y: 268 }, leg_r: { x: 139, y: 266 } },
	],
	tired: [
		{ head: { x: 192, y: 40 }, eye_l: { x: 122, y: 136 }, eye_r: { x: 221, y: 133 }, snout: { x: 186, y: 161 }, mouth: { x: 186, y: 191 }, neck: { x: 161, y: 223 }, body: { x: 150, y: 248 }, hand_l: { x: 147, y: 275 }, hand_r: { x: 239, y: 272 }, leg_l: { x: 31, y: 268 }, leg_r: { x: 126, y: 277 } },
		{ head: { x: 191, y: 43 }, eye_l: { x: 132, y: 134 }, eye_r: { x: 231, y: 132 }, snout: { x: 185, y: 154 }, mouth: { x: 188, y: 179 }, neck: { x: 165, y: 219 }, body: { x: 149, y: 247 }, hand_l: { x: 150, y: 275 }, hand_r: { x: 225, y: 276 }, leg_l: { x: 31, y: 264 }, leg_r: { x: 129, y: 277 } },
		{ head: { x: 190, y: 62 }, eye_l: { x: 127, y: 174 }, eye_r: { x: 237, y: 168 }, snout: { x: 193, y: 191 }, mouth: { x: 203, y: 209 }, neck: { x: 166, y: 236 }, body: { x: 149, y: 255 }, hand_l: { x: 117, y: 278 }, hand_r: { x: 231, y: 274 }, leg_l: { x: 24, y: 266 }, leg_r: { x: 137, y: 276 } },
		{ head: { x: 194, y: 89 }, eye_l: { x: 122, y: 186 }, eye_r: { x: 224, y: 185 }, snout: { x: 182, y: 211 }, mouth: { x: 182, y: 241 }, neck: { x: 160, y: 246 }, body: { x: 148, y: 261 }, hand_l: { x: 113, y: 279 }, hand_r: { x: 195, y: 279 }, leg_l: { x: 25, y: 272 }, leg_r: { x: 110, y: 271 } },
	],
	surprise: [
		{ head: { x: 154, y: 24 }, eye_l: { x: 120, y: 113 }, eye_r: { x: 203, y: 111 }, snout: { x: 165, y: 139 }, mouth: { x: 166, y: 164 }, neck: { x: 156, y: 208 }, body: { x: 151, y: 237 }, hand_l: { x: 123, y: 272 }, hand_r: { x: 187, y: 271 }, leg_l: { x: 84, y: 261 }, leg_r: { x: 131, y: 256 } },
		{ head: { x: 151, y: 23 }, eye_l: { x: 118, y: 108 }, eye_r: { x: 200, y: 107 }, snout: { x: 163, y: 134 }, mouth: { x: 164, y: 160 }, neck: { x: 154, y: 203 }, body: { x: 150, y: 232 }, hand_l: { x: 122, y: 268 }, hand_r: { x: 184, y: 268 }, leg_l: { x: 84, y: 258 }, leg_r: { x: 117, y: 246 } },
		{ head: { x: 148, y: 20 }, eye_l: { x: 115, y: 108 }, eye_r: { x: 198, y: 107 }, snout: { x: 160, y: 135 }, mouth: { x: 161, y: 161 }, neck: { x: 153, y: 205 }, body: { x: 150, y: 234 }, hand_l: { x: 115, y: 270 }, hand_r: { x: 181, y: 270 }, leg_l: { x: 76, y: 260 }, leg_r: { x: 117, y: 246 } },
		{ head: { x: 151, y: 14 }, eye_l: { x: 115, y: 109 }, eye_r: { x: 205, y: 109 }, snout: { x: 161, y: 136 }, mouth: { x: 164, y: 162 }, neck: { x: 155, y: 208 }, body: { x: 150, y: 238 }, hand_l: { x: 116, y: 277 }, hand_r: { x: 190, y: 275 }, leg_l: { x: 75, y: 268 }, leg_r: { x: 117, y: 246 } },
	],
	wave: [
		{ head: { x: 141, y: 28 }, eye_l: { x: 109, y: 118 }, eye_r: { x: 194, y: 115 }, snout: { x: 156, y: 139 }, mouth: { x: 155, y: 162 }, neck: { x: 151, y: 192 }, body: { x: 150, y: 214 }, hand_l: { x: 121, y: 278 }, hand_r: { x: 231, y: 118 }, leg_l: { x: 86, y: 270 }, leg_r: { x: 194, y: 275 } },
		{ head: { x: 134, y: 27 }, eye_l: { x: 106, y: 119 }, eye_r: { x: 194, y: 116 }, snout: { x: 154, y: 141 }, mouth: { x: 152, y: 166 }, neck: { x: 150, y: 196 }, body: { x: 150, y: 218 }, hand_l: { x: 82, y: 275 }, hand_r: { x: 257, y: 126 }, leg_l: { x: 112, y: 284 }, leg_r: { x: 174, y: 276 } },
		{ head: { x: 142, y: 26 }, eye_l: { x: 113, y: 117 }, eye_r: { x: 196, y: 112 }, snout: { x: 160, y: 138 }, mouth: { x: 159, y: 163 }, neck: { x: 152, y: 194 }, body: { x: 150, y: 217 }, hand_l: { x: 188, y: 275 }, hand_r: { x: 255, y: 126 }, leg_l: { x: 120, y: 279 }, leg_r: { x: 205, y: 276 } },
		{ head: { x: 136, y: 27 }, eye_l: { x: 108, y: 117 }, eye_r: { x: 191, y: 115 }, snout: { x: 152, y: 142 }, mouth: { x: 149, y: 167 }, neck: { x: 150, y: 195 }, body: { x: 150, y: 217 }, hand_l: { x: 104, y: 279 }, hand_r: { x: 229, y: 128 }, leg_l: { x: 73, y: 269 }, leg_r: { x: 175, y: 276 } },
	],
	face: [
		{ head: { x: 191, y: 21 }, eye_l: { x: 204, y: 112 }, eye_r: { x: 265, y: 101 }, snout: { x: 252, y: 144 }, mouth: { x: 267, y: 173 }, neck: { x: 192, y: 215 }, body: { x: 150, y: 244 }, hand_l: { x: 104, y: 265 }, hand_r: { x: 206, y: 272 }, leg_l: { x: 68, y: 274 }, leg_r: { x: 152, y: 280 } },
		{ head: { x: 190, y: 20 }, eye_l: { x: 204, y: 111 }, eye_r: { x: 265, y: 101 }, snout: { x: 252, y: 145 }, mouth: { x: 265, y: 174 }, neck: { x: 192, y: 215 }, body: { x: 150, y: 244 }, hand_l: { x: 104, y: 265 }, hand_r: { x: 207, y: 272 }, leg_l: { x: 68, y: 273 }, leg_r: { x: 153, y: 280 } },
		{ head: { x: 190, y: 22 }, eye_l: { x: 201, y: 110 }, eye_r: { x: 262, y: 100 }, snout: { x: 249, y: 144 }, mouth: { x: 267, y: 173 }, neck: { x: 191, y: 215 }, body: { x: 150, y: 245 }, hand_l: { x: 104, y: 266 }, hand_r: { x: 207, y: 273 }, leg_l: { x: 69, y: 274 }, leg_r: { x: 153, y: 281 } },
		{ head: { x: 190, y: 21 }, eye_l: { x: 202, y: 111 }, eye_r: { x: 264, y: 101 }, snout: { x: 248, y: 146 }, mouth: { x: 263, y: 175 }, neck: { x: 192, y: 216 }, body: { x: 150, y: 245 }, hand_l: { x: 103, y: 265 }, hand_r: { x: 206, y: 272 }, leg_l: { x: 68, y: 274 }, leg_r: { x: 153, y: 280 } },
	],
	face_sit: [
		{ head: { x: 153, y: 31 }, eye_l: { x: 200, y: 125 }, eye_r: { x: 257, y: 115 }, snout: { x: 241, y: 160 }, mouth: { x: 239, y: 189 }, neck: { x: 189, y: 223 }, body: { x: 150, y: 249 }, hand_l: { x: 170, y: 280 }, hand_r: { x: 222, y: 263 }, leg_l: { x: 90, y: 285 }, leg_r: { x: 194, y: 270 } },
		{ head: { x: 153, y: 30 }, eye_l: { x: 201, y: 124 }, eye_r: { x: 258, y: 115 }, snout: { x: 245, y: 159 }, mouth: { x: 240, y: 187 }, neck: { x: 190, y: 222 }, body: { x: 151, y: 249 }, hand_l: { x: 170, y: 279 }, hand_r: { x: 223, y: 262 }, leg_l: { x: 90, y: 285 }, leg_r: { x: 194, y: 270 } },
		{ head: { x: 153, y: 31 }, eye_l: { x: 196, y: 124 }, eye_r: { x: 257, y: 116 }, snout: { x: 246, y: 157 }, mouth: { x: 240, y: 187 }, neck: { x: 188, y: 221 }, body: { x: 150, y: 248 }, hand_l: { x: 170, y: 280 }, hand_r: { x: 222, y: 262 }, leg_l: { x: 90, y: 285 }, leg_r: { x: 194, y: 270 } },
		{ head: { x: 152, y: 30 }, eye_l: { x: 200, y: 124 }, eye_r: { x: 257, y: 115 }, snout: { x: 244, y: 158 }, mouth: { x: 239, y: 188 }, neck: { x: 189, y: 222 }, body: { x: 150, y: 248 }, hand_l: { x: 167, y: 278 }, hand_r: { x: 222, y: 261 }, leg_l: { x: 90, y: 285 }, leg_r: { x: 193, y: 270 } },
	],
};
// ANCHOR_EDITOR_END

// Resolve an anchor's position at a given (animation, frame), falling back
// to the rest position if the frame doesn't override it. Exported for the
// renderer.
//
// `eyes` and `feet` are virtual: compute midpoint of their L/R pair so
// items targeting the symmetric anchor track both sides correctly when
// the underlying L/R anchors drift apart per pose.
export function resolveAnchor(anim: PigAnimationKey, frameIdx: number, name: AnchorName): Anchor {
	if (name === "eyes") {
		const l = resolveAnchor(anim, frameIdx, "eye_l");
		const r = resolveAnchor(anim, frameIdx, "eye_r");
		return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
	}
	if (name === "feet") {
		const l = resolveAnchor(anim, frameIdx, "leg_l");
		const r = resolveAnchor(anim, frameIdx, "leg_r");
		return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
	}
	const frames = PIG_FRAME_ANCHORS[anim];
	const frame = frames?.[Math.min(frameIdx, (frames?.length ?? 1) - 1)] ?? {};
	return frame[name] ?? REST_ANCHORS[name];
}

export interface WearablePose {
	rotate: number;
	scale: number;
}

const FACE_RIG_ANCHORS = new Set<AnchorName>([
	"head",
	"eye_l",
	"eye_r",
	"eyes",
	"snout",
	"mouth",
	"neck"
]);

// An eye-line item on a turned head sits back from the eye midpoint. `eyes` is
// the midpoint of the near eye and the foreshortened far eye; an item pivoted
// at its own centre lands there with its bridge over the FAR eye — a side
// sprite's near lens is the wider half, a flat front pair simply hangs its
// front lens past the snout. Shifting toward the back of the head (drawn
// space: the pig looks right, so minus x) puts the bridge over the nose.
// Angle-audit ruling, 2026-09-15.
export const TURNED_EYE_SHIFT = 16;

// Head/face wearables inherit Rosie's authored face angle and apparent scale.
// The item-specific RelSpec still owns art size and pivot; this pose transform
// only makes that tuned item sit on the moving anatomy instead of translating
// like a rigid sticker. Body, hand, aura, and background slots stay unchanged.
export function resolveWearablePose(
	anim: PigAnimationKey,
	frameIdx: number,
	anchor: AnchorName
): WearablePose {
	if (!FACE_RIG_ANCHORS.has(anchor)) {
		return { rotate: 0, scale: 1 };
	}
	const restLeft = resolveAnchor("idle", 0, "eye_l");
	const restRight = resolveAnchor("idle", 0, "eye_r");
	const currentLeft = resolveAnchor(anim, frameIdx, "eye_l");
	const currentRight = resolveAnchor(anim, frameIdx, "eye_r");

	const restDx = restRight.x - restLeft.x;
	const restDy = restRight.y - restLeft.y;
	const currentDx = currentRight.x - currentLeft.x;
	const currentDy = currentRight.y - currentLeft.y;
	const restDistance = Math.hypot(restDx, restDy);
	const currentDistance = Math.hypot(currentDx, currentDy);
	const restAngle = Math.atan2(restDy, restDx);
	const currentAngle = Math.atan2(currentDy, currentDx);
	const rawDegrees = ((currentAngle - restAngle) * 180) / Math.PI;
	const rotate = ((rawDegrees + 180) % 360) - 180;
	// On the three-quarter turn the eyes close up because the head TURNED,
	// not because it shrank: only what sits on the eye line (glasses, a mask)
	// foreshortens with them; a hat or a scarf keeps its size and just takes
	// the tilt. (2026-09-15)
	const turned = anim === "face" || anim === "face_sit";
	const eyeBound = anchor === "eyes" || anchor === "eye_l" || anchor === "eye_r";
	const scale =
		turned && !eyeBound
			? 1
			: Math.max(0.72, Math.min(1.18, currentDistance / restDistance));
	return { rotate, scale };
}

// Default anchor per category. Items can override via HatOverlay.anchor.
export const CATEGORY_ANCHORS: Record<string, AnchorName> = {
	hat: "head",
	bow: "head",
	glasses: "eyes",
	mask: "eyes",
	scarf: "neck",
	necklace: "neck",
	cape: "body",
	held: "hand_r",
	aura: "body",
	background: "body"
};

// Per-category, per-animation positional shift applied AFTER the
// anchor delta. Use this when an entire category needs to slide a few
// pixels in a specific animation that the anchor system can't model
// well (e.g., glasses need to droop on the snout when the pig is sad,
// because the eye line itself doesn't fully capture the slumped pose).
//
// dx / dy are SCREEN-AXIS: dy > 0 means "move down on screen". They're
// applied as: left += dx, bottom -= dy (since bottom is from-bottom).
export const CATEGORY_PERANIM_SHIFTS: Partial<
	Record<string, Partial<Record<PigAnimationKey, { dx?: number; dy?: number }>>>
> = {
	// Empty for now — the sad-glasses droop is handled by per-frame
	// eye_l/eye_r anchors in PIG_FRAME_ANCHORS. Add an entry here only
	// when an entire category needs a blanket nudge that the anchor
	// system can't model (e.g. depth-based scaling per pose).
};

// Compute the delta (in card pixels) between the current anchor and its rest
// position, for the given category/item. Returns {dx, dy} in screen-axis
// coordinates (positive y = down, negative y = up). Items not bound to any
// anchor get {0, 0}.
export function frameDelta(
	anim: PigAnimationKey,
	frameIdx: number,
	category: string | null,
	itemAnchor?: AnchorName
): { dx: number; dy: number } {
	const name = itemAnchor ?? (category ? CATEGORY_ANCHORS[category] : undefined);
	if (!name) return { dx: 0, dy: 0 };
	const cur = resolveAnchor(anim, frameIdx, name);
	const rest = REST_ANCHORS[name];
	return { dx: cur.x - rest.x, dy: cur.y - rest.y };
}

export const DEFAULT_HAT_OVERLAY: HatOverlay = {
	bottom: 245,
	left: 88,
	width: 125,
	height: 125
};

// Position presets per category, on the 300x300 pig card.
// Anchored to the current Rosie sprite — head crown sits around y≈35
// from the top, eyes y≈110, snout y≈150, mouth y≈180, neck y≈210.
// Center x ≈ 150. Items are sized to feel proportional (~⅓ of the
// pig's width for accessories, full body width for cape/aura).
export const CATEGORY_OVERLAYS: Record<string, HatOverlay> = {
	hat:        { bottom: 245, left: 88,  width: 125, height: 125 },
	glasses:    { bottom: 179, left: 95,  width: 110, height: 50  },
	bow:        { bottom: 255, left: 120, width: 60,  height: 50  },
	scarf:      { bottom: 70,  left: 70,  width: 160, height: 70  },
	mask:       { bottom: 145, left: 111, width: 130, height: 95  },
	necklace:   { bottom: 30,  left: 115, width: 110, height: 50  },
	cape:       { bottom: 25,  left: 35,  width: 230, height: 195 },
	held:       { bottom: 34,  left: 235, width: 80,  height: 76  },
	// Aura sits in a WIDER area around the pig — the glow box is bigger than the
	// 300 card and centered, so the halo radiates well past the pig body. PigStage
	// renders it UNCLIPPED (auraLayer, overflow visible); the radial alpha falloff
	// baked into the art (scripts/soften_aura_edges.py) is what keeps the overflow
	// faint on neighbours. Background stays exactly the 300 canvas (opaque page).
	aura:       { bottom: -105, left: -105, width: 510, height: 510 },
	background: { bottom: 0,   left: 0,   width: 300, height: 300 },
};

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface HatRow {
	id: string;
	name: string;
	cost: number;
	display_order: number;
	emoji: string | null;
	image_path: string | null;
	category?: string;
	rarity?: Rarity;
	description?: string | null;
	// True for battle-pass tier rewards — earned only, never sold. Server
	// (daily_shop/buy_hat) is the source of truth; the client also hides them
	// from Browse. Optional so pre-20260675 servers (no column) still parse.
	pass_exclusive?: boolean;
	// Granted by Wallow rank, never sold. Used by the Closet's prestige filter.
	prestige_exclusive?: boolean;
	// True for Slop Club members-only cosmetics (20260688). Server gates the
	// buy; the client groups them into the shop's collapsible Members section
	// and shows a lock on the card for non-members. Optional so pre-migration
	// servers (no column) still parse.
	members_only?: boolean;
}

// RARITY_COLORS lived here as a compatibility shim over theme.ts's
// RARITY_BADGE. Its last two callers (app/scan-code.tsx, TruffleExchangeSheet)
// now read `RARITY_BADGE[rarity].ink` directly, so the alias is gone: one
// validated fill/ink pair per rarity, in the token file. [D-02, E30]
// (2026-09-11)
