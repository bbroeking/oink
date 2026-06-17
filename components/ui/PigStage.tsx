// PigStage — the layered 300×300 pig render used by both the Barn
// (inside SwipeElement) and the shop preview modal. Single source
// of truth for how Rosie + her equipped items compose: anchor-rel
// positioning (HAT_REL → resolveAnchor), z-order (aura behind,
// pig, cape-or-behind item, hat-or-in-front, held), and the
// optional dev-tool rel overrides.
//
// Lifted out of SwipeElement so the preview no longer duplicates
// the positioning math. Anchor re-tuning via /item-anchor flows
// through both surfaces from one component.

import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { categoryIcon } from "../../constants/emojiArt";
import {
	HAT_IMAGES,
	HAT_OVERLAYS,
	HAT_REL,
	CATEGORY_OVERLAYS,
	CATEGORY_ANCHORS,
	CATEGORY_PERANIM_SHIFTS,
	DEFAULT_HAT_OVERLAY,
	Z_BEHIND_PIG,
	PIG_CANVAS,
	frameDelta,
	resolveAnchor,
} from "../../constants/hats";
import type {
	PigAnimationKey,
	HatOverlay,
	AnchorName,
	RelSpec,
} from "../../constants/hat_overlay_types";
import { ITEM_PREBAKED, isPrebaked } from "../../constants/prebaked";
import { SpritePig, PigAnimation } from "./SpritePig";

// Canonical "one equipped cosmetic slot" shape. This is both PigStage's
// render contract AND the data shape every producer hands it: useHomeStats
// (Stats.activeHat etc.), BarnVisitModal's join projection, ClosetView's
// slot() builder, and the shop preview modals all build/flow this exact
// {id, category, emoji} row. Re-used as EquipSlot (useHomeStats) and Slot
// (BarnVisitModal) so the shape is declared once. Keys are required;
// values are nullable (category/emoji absent on a freshly-built slot read
// back as null, never undefined).
export interface EquippedItem {
	id: string;
	category: string | null;
	emoji: string | null;
}

export interface PigStageProps {
	// Pig animation state. Defaults to "idle" — preview mode wants this;
	// SwipeElement passes whatever it's currently animating to.
	pigAnimation?: PigAnimation;
	// Current sprite frame index. SwipeElement tracks this for per-
	// frame anchor delta math; preview can leave it at 0.
	pigFrameIdx?: number;
	// Callbacks forwarded to SpritePig — SwipeElement uses these for
	// frame tracking + jump-complete handling.
	onPigFrame?: (idx: number) => void;
	onPigComplete?: () => void;

	// Equipment slots. `equipped` is the Head slot (hat / bow); glasses, mask,
	// and neck are now their own anchor-based slots and render together.
	equipped?: EquippedItem | null;       // head (hat / bow)
	equippedGlasses?: EquippedItem | null; // eyes
	equippedMask?: EquippedItem | null;    // face
	equippedNeck?: EquippedItem | null;    // neck (scarf / necklace)
	equippedAura?: EquippedItem | null;
	equippedHeld?: EquippedItem | null;
	equippedFlag?: EquippedItem | null;   // country flag — corner sticker

	// Dev-only: overrides written by the /item-anchor tool. Pass an
	// empty map (or omit) in non-dev contexts.
	relOverrides?: Record<string, RelSpec>;

	// Suppress accessory rendering (used by SwipeElement during the
	// random-reaction beats where the pig hides what it's holding).
	hideAccessory?: boolean;
}

// Compute the per-frame, per-anchor overlay for one equipped item.
// Pulled verbatim from SwipeElement so the math stays identical.
export function resolveSlot(
	slot: EquippedItem | null | undefined,
	pigAnim: PigAnimation,
	pigFrameIdx: number,
	relOverrides: Record<string, RelSpec> = {},
): {
	itemId: string;
	category: string | null;
	emoji: string | null;
	imageSrc: number | null;
	prebaked: Partial<Record<PigAnimation, string[]>> | null;
	overlay: HatOverlay | null;
} | null {
	if (!slot) return null;
	const itemId = slot.id;
	const category = slot.category ?? null;
	const emoji = slot.emoji ?? null;
	const prebaked = isPrebaked(itemId) ? ITEM_PREBAKED[itemId] : null;
	const imageSrc = HAT_IMAGES[itemId] ?? null;

	// Anchor-RELATIVE placement (the new model). If the item has a
	// rel spec, size + position it so its pivot point lands on the
	// resolved pig anchor for the current frame.
	const relSpec = relOverrides[itemId] || HAT_REL[itemId];
	const isFullCanvasCat = category === "background" || category === "aura";
	if (relSpec && imageSrc && !isFullCanvasCat) {
		const anchorName: AnchorName =
			relSpec.anchor ??
			(category ? CATEGORY_ANCHORS[category] : undefined) ??
			"head";
		const a = resolveAnchor(
			pigAnim as PigAnimationKey,
			pigFrameIdx,
			anchorName,
		);
		const src = Image.resolveAssetSource(imageSrc);
		const aspect = src && src.width ? src.height / src.width : 1;
		const w = relSpec.widthFrac * PIG_CANVAS;
		const h = w * aspect;
		const overlay: HatOverlay = {
			left: a.x - relSpec.pivot.x * w,
			bottom: PIG_CANVAS - (a.y - relSpec.pivot.y * h) - h,
			width: w,
			height: h,
			anchor: anchorName,
			behind: relSpec.behind,
		};
		return { itemId, category, emoji, imageSrc, prebaked: null, overlay };
	}

	// Legacy absolute-overlay path — only items not yet tuned in the
	// /item-anchor tool fall back here.
	const rawBase = prebaked
		? null
		: isFullCanvasCat
			? (category && CATEGORY_OVERLAYS[category]) || DEFAULT_HAT_OVERLAY
			: HAT_OVERLAYS[itemId] ||
				(category && CATEGORY_OVERLAYS[category]) ||
				DEFAULT_HAT_OVERLAY;

	const baseOverlay = rawBase
		? {
				...rawBase,
				...(rawBase.perAnim?.[pigAnim as PigAnimationKey] ?? {}),
			}
		: null;

	const isFullCanvas = category === "background" || category === "aura";
	const delta = isFullCanvas
		? { dx: 0, dy: 0 }
		: frameDelta(
				pigAnim as PigAnimationKey,
				pigFrameIdx,
				category,
				baseOverlay?.anchor,
			);
	const catShift =
		(category &&
			CATEGORY_PERANIM_SHIFTS[category]?.[pigAnim as PigAnimationKey]) ||
		null;
	const overlay = baseOverlay
		? isFullCanvas
			? baseOverlay
			: {
					...baseOverlay,
					left: baseOverlay.left + delta.dx + (catShift?.dx ?? 0),
					bottom:
						baseOverlay.bottom - delta.dy - (catShift?.dy ?? 0),
				}
		: null;
	return { itemId, category, emoji, imageSrc, prebaked, overlay };
}

// One overlay box — item art, then the category art placeholder, then
// a neutral print glyph. The no-art path never renders a raw emoji.
function ItemOverlay({
	overlay,
	imageSrc,
	category = null,
	zIndex = 5,
}: {
	overlay: HatOverlay;
	imageSrc: number | null;
	category?: string | null;
	zIndex?: number;
}) {
	const { rotate, ...box } = overlay;
	// No item PNG → fall back to the category icon art (auras/necklaces
	// have none → categoryIcon null → the neutral glyph below).
	const placeholderSrc = imageSrc ?? categoryIcon(category);
	return (
		<View
			style={[
				styles.overlayBox,
				box,
				{ zIndex },
				rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null,
			]}
		>
			{placeholderSrc ? (
				<Image
					source={placeholderSrc}
					style={styles.fillImage}
					resizeMode="contain"
				/>
			) : (
				<Text
					style={[
						styles.emojiPlaceholder,
						{
							fontSize:
								Math.min(overlay.width, overlay.height) * 0.7,
						},
					]}
				>
					✦
				</Text>
			)}
		</View>
	);
}

// The layered render. Z-order (back to front):
//   1 = aura slot (behind)
//   3 = pig + cape-or-behind-flagged main item
//   5 = pig sprite
//   10 = main slot in front
//   11 = held slot in front of main
//
// Backgrounds are intentionally NOT rendered here — they live as
// the full-page ImageBackground at the top of the Barn screen
// (rendering them inside the pig card creates a "ghost tile"
// behind the pig).
export function PigStage({
	pigAnimation = "idle",
	pigFrameIdx = 0,
	onPigFrame,
	onPigComplete,
	equipped,
	equippedGlasses,
	equippedMask,
	equippedNeck,
	equippedAura,
	equippedHeld,
	equippedFlag,
	relOverrides = {},
	hideAccessory = false,
}: PigStageProps) {
	const main = resolveSlot(equipped, pigAnimation, pigFrameIdx, relOverrides);
	const glassesSlot = resolveSlot(equippedGlasses, pigAnimation, pigFrameIdx, relOverrides);
	const maskSlot = resolveSlot(equippedMask, pigAnimation, pigFrameIdx, relOverrides);
	const neckSlot = resolveSlot(equippedNeck, pigAnimation, pigFrameIdx, relOverrides);
	const auraSlot = resolveSlot(equippedAura, pigAnimation, pigFrameIdx, relOverrides);
	const heldSlot = resolveSlot(equippedHeld, pigAnimation, pigFrameIdx, relOverrides);
	const flagSlot = resolveSlot(equippedFlag, pigAnimation, pigFrameIdx, relOverrides);

	const mainOverlay = main?.overlay ?? null;
	const mainCategory = main?.category ?? null;
	const mainIsBehind =
		mainOverlay?.behind ??
		(mainCategory ? !!Z_BEHIND_PIG[mainCategory] : false);
	const showMainOverlay = mainOverlay && !hideAccessory;

	return (
		<View style={styles.stage}>
			{auraSlot?.overlay && (
				<ItemOverlay
					overlay={auraSlot.overlay}
					imageSrc={auraSlot.imageSrc}
					category={auraSlot.category}
					zIndex={2}
				/>
			)}
			{showMainOverlay && mainIsBehind && (
				<ItemOverlay
					overlay={mainOverlay}
					imageSrc={main?.imageSrc ?? null}
					category={mainCategory}
					zIndex={3}
				/>
			)}
			<View style={[styles.pigWrap, { zIndex: 5 }]}>
				<SpritePig
					animation={pigAnimation}
					size={PIG_CANVAS}
					onFrame={onPigFrame}
					onComplete={onPigComplete}
					customFrames={main?.prebaked ?? undefined}
				/>
			</View>
			{showMainOverlay && !mainIsBehind && (
				<ItemOverlay
					overlay={mainOverlay}
					imageSrc={main?.imageSrc ?? null}
					category={mainCategory}
					zIndex={10}
				/>
			)}
			{neckSlot?.overlay && !hideAccessory && (
				<ItemOverlay
					overlay={neckSlot.overlay}
					imageSrc={neckSlot.imageSrc}
					category={neckSlot.category}
					zIndex={8}
				/>
			)}
			{maskSlot?.overlay && !hideAccessory && (
				<ItemOverlay
					overlay={maskSlot.overlay}
					imageSrc={maskSlot.imageSrc}
					category={maskSlot.category}
					zIndex={9}
				/>
			)}
			{glassesSlot?.overlay && !hideAccessory && (
				<ItemOverlay
					overlay={glassesSlot.overlay}
					imageSrc={glassesSlot.imageSrc}
					category={glassesSlot.category}
					zIndex={10}
				/>
			)}
			{heldSlot?.overlay && !hideAccessory && (
				<ItemOverlay
					overlay={heldSlot.overlay}
					imageSrc={heldSlot.imageSrc}
					category={heldSlot.category}
					zIndex={11}
				/>
			)}
			{flagSlot?.overlay && !hideAccessory && (
				<ItemOverlay
					overlay={flagSlot.overlay}
					imageSrc={flagSlot.imageSrc}
					category={flagSlot.category}
					zIndex={12}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	stage: {
		width: PIG_CANVAS,
		height: PIG_CANVAS,
		position: "relative",
	},
	pigWrap: {
		position: "absolute",
		left: 0,
		top: 0,
		width: PIG_CANVAS,
		height: PIG_CANVAS,
	},
	overlayBox: {
		position: "absolute",
		alignItems: "center",
		justifyContent: "center",
	},
	fillImage: {
		width: "100%",
		height: "100%",
	},
	emojiPlaceholder: {
		textAlign: "center",
	},
});
