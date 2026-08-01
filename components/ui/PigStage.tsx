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
import {
	View,
	Image,
	StyleSheet,
	Animated,
	Easing,
} from "react-native";
import { Glyph } from "./Glyph";
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
	resolveWearablePose,
} from "../../constants/hats";
import type {
	PigAnimationKey,
	HatOverlay,
	AnchorName,
	RelSpec,
} from "../../constants/hat_overlay_types";
import { ITEM_PREBAKED, isPrebaked } from "../../constants/prebaked";
import { PigRenderer, type PigRendererKind } from "./PigRenderer";
import type { PigAnimation } from "./pigRendererContract";
import {
	isRivePigPrototypeAnimation,
	resolveRivePigEquipment,
} from "./rivePigContract";
import type { PigId } from "@/utils/pigs";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { useRivePigRolloutEnabled } from "@/utils/rivePigRollout";

// Auras that ROTATE — radial rays / rings / sunbursts read well spinning. Every
// OTHER aura gently pulses (breathes) instead: a spinning flame or mist looks
// wrong, but a pulse suits any glow. See PigStage's aura-animation block.
const AURA_SPIN = new Set<string>([
	"gold_aura",
	"majesty_gold_aura",
	"holy_aura",
	"gallant_valor_aura",
	"rainbow_aura",
	"sparkle_aura",
	"island_sunglow_aura",
	"slop_club_gilded_seal_aura",
	"nebula_aura",
]);

type AssetResolver = (
	source: number,
) => { width?: number; height?: number } | null | undefined;

export function resolvePigStageAssetAspect(
	source: number,
	resolveAssetSource?: AssetResolver,
): number {
	if (!resolveAssetSource) return 1;

	try {
		const resolved = resolveAssetSource(source);
		if (!resolved?.width || !resolved.height) return 1;
		return resolved.height / resolved.width;
	} catch {
		return 1;
	}
}

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
	// Which pig is under the shared animation/equipment stack.
	pigId?: PigId;
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
	// Pin the sprite to `pigFrameIdx` (defaults to frame 0, the rest pose the
	// placement studio tunes anchors against) instead of letting SpritePig
	// auto-advance. The shop preview freezes so a pinned item never rides a
	// moving pig; living mood surfaces (Barn/Closet/Visit) leave this false and
	// sync pigFrameIdx via onPigFrame so the item tracks the breathing pig.
	pigFrozen?: boolean;

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

	// Dye Vat (member perk, client-only prototype). Map of itemId → tint hex.
	// A worn cosmetic whose id is in this map renders flat-tinted to the member
	// palette. Omit / empty in every ordinary context, so there's zero effect
	// on the default render.
	tints?: Record<string, string>;

	// Earned prestige power. Separate from the cosmetic aura slot: a Wallow aura
	// is gameplay standing and must remain visible regardless of what is equipped.
	// Rendering caps at five increasingly intense stages with the regen bonus.
	prestigeLevel?: number;
	// Dev prototype control for previewing the Slop Club Rosie wash in memory.
	// Ordinary callers omit this and keep the global skin-store behavior.
	skinTintOverride?: string | null;

	// Renderer decision-spike controls. Ordinary callers omit these and stay on
	// the raster renderer. A Rive source must be supplied explicitly.
	renderer?: PigRendererKind;
	riveSource?: number;
	onRiveReady?: () => void;
	onRiveError?: (error: Error) => void;
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
	// Backgrounds always own the full stage. Auras may use a RelSpec so each
	// aura can be sized/positioned in the Placement Studio; an untuned aura
	// still falls through to the legacy category-sized box below.
	const isFixedCanvasCat = category === "background";
	if (relSpec && imageSrc && !isFixedCanvasCat) {
		const anchorName: AnchorName =
			relSpec.anchor ??
			(category ? CATEGORY_ANCHORS[category] : undefined) ??
			"head";
		const a = resolveAnchor(
			pigAnim as PigAnimationKey,
			pigFrameIdx,
			anchorName,
		);
		const aspect = resolvePigStageAssetAspect(
			imageSrc,
			typeof Image.resolveAssetSource === "function"
				? Image.resolveAssetSource.bind(Image)
				: undefined,
		);
		const pose = resolveWearablePose(
			pigAnim as PigAnimationKey,
			pigFrameIdx,
			anchorName,
		);
		const w = relSpec.widthFrac * PIG_CANVAS * pose.scale;
		const h = w * aspect;
		// React Native rotates a View around its centre. Compensate the box
		// position so the item's authored pivot—not its centre—stays exactly on
		// the anatomy anchor after that rotation.
		const radians = (pose.rotate * Math.PI) / 180;
		const pivotX = relSpec.pivot.x * w;
		const pivotY = relSpec.pivot.y * h;
		const fromCenterX = pivotX - w / 2;
		const fromCenterY = pivotY - h / 2;
		const rotatedPivotX =
			w / 2 +
			fromCenterX * Math.cos(radians) -
			fromCenterY * Math.sin(radians);
		const rotatedPivotY =
			h / 2 +
			fromCenterX * Math.sin(radians) +
			fromCenterY * Math.cos(radians);
		const top = a.y - rotatedPivotY;
		const overlay: HatOverlay = {
			left: a.x - rotatedPivotX,
			bottom: PIG_CANVAS - top - h,
			width: w,
			height: h,
			anchor: anchorName,
			rotate: Math.abs(pose.rotate) > 0.05 ? pose.rotate : undefined,
			behind: relSpec.behind,
		};
		return { itemId, category, emoji, imageSrc, prebaked: null, overlay };
	}

	// Legacy absolute-overlay path — only items not yet tuned in the
	// /item-anchor tool fall back here.
	const rawBase = prebaked
		? null
		: category === "background" || category === "aura"
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
	spin,
	pulse,
	tint,
}: {
	overlay: HatOverlay;
	imageSrc: number | null;
	category?: string | null;
	zIndex?: number;
	// Aura animations: spin = "0deg".."360deg" rotation; pulse = a scale that
	// breathes out→in→out. An aura gets one or the other (chosen in PigStage).
	spin?: Animated.AnimatedInterpolation<string>;
	pulse?: Animated.AnimatedInterpolation<number>;
	// Dye Vat: a member palette hex. When set, flat-tints the sticker via RN's
	// Image tintColor (honest prototype — recolors the whole silhouette).
	tint?: string;
}) {
	const { rotate, ...box } = overlay;
	// No item PNG → fall back to the category icon art (auras/necklaces
	// have none → categoryIcon null → the neutral glyph below).
	const placeholderSrc = imageSrc ?? categoryIcon(category);
	const animTransform = [
		...(spin ? [{ rotate: spin }] : []),
		...(pulse ? [{ scale: pulse }] : []),
	];
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
				animTransform.length ? (
					<Animated.Image
						source={placeholderSrc}
						style={[styles.fillImage, tint ? { tintColor: tint } : null, { transform: animTransform }]}
						resizeMode="contain"
					/>
				) : (
					<Image
						source={placeholderSrc}
						style={[styles.fillImage, tint ? { tintColor: tint } : null]}
						resizeMode="contain"
					/>
				)
			) : (
				<Glyph
					name="sparkle"
					size={Math.min(overlay.width, overlay.height) * 0.7}
				/>
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
	pigId = "rosie",
	pigAnimation = "idle",
	pigFrameIdx = 0,
	onPigFrame,
	onPigComplete,
	pigFrozen = false,
	equipped,
	equippedGlasses,
	equippedMask,
	equippedNeck,
	equippedAura,
	equippedHeld,
	equippedFlag,
	relOverrides = {},
	hideAccessory = false,
	tints = {},
	prestigeLevel = 0,
	skinTintOverride,
	renderer = "raster",
	riveSource,
	onRiveReady,
	onRiveError,
}: PigStageProps) {
	const [riveFailed, setRiveFailed] = React.useState(false);
	const motionPolicy = useMotionPolicy();
	const rolloutEnabled = useRivePigRolloutEnabled();
	React.useEffect(() => {
		setRiveFailed(false);
	}, [renderer, riveSource]);
	// Regeneration power caps at rank two, but the earned aura keeps evolving
	// through five visual stages so later ranks still look more legendary.
	const prestigeVisualStage = Math.min(5, Math.max(0, Math.floor(prestigeLevel)));
	// Dye Vat: resolve a worn item's chosen member palette (or undefined). Auras,
	// backgrounds and flags are intentionally not dyeable.
	const tintFor = (id: string | undefined) => (id ? tints[id] : undefined);
	const main = resolveSlot(equipped, pigAnimation, pigFrameIdx, relOverrides);
	const glassesSlot = resolveSlot(equippedGlasses, pigAnimation, pigFrameIdx, relOverrides);
	const maskSlot = resolveSlot(equippedMask, pigAnimation, pigFrameIdx, relOverrides);
	const neckSlot = resolveSlot(equippedNeck, pigAnimation, pigFrameIdx, relOverrides);
	const auraSlot = resolveSlot(equippedAura, pigAnimation, pigFrameIdx, relOverrides);
	const heldSlot = resolveSlot(equippedHeld, pigAnimation, pigFrameIdx, relOverrides);
	const flagSlot = resolveSlot(equippedFlag, pigAnimation, pigFrameIdx, relOverrides);
	const equipment = {
		headId: equipped?.id,
		faceId: equippedGlasses?.id,
		heldId: equippedHeld?.id,
		maskId: equippedMask?.id,
		neckId: equippedNeck?.id,
	};
	const resolvedRiveEquipment = resolveRivePigEquipment(equipment);
	const riveActive =
		renderer === "rive" &&
		riveSource !== undefined &&
		rolloutEnabled &&
		!motionPolicy.reduceMotion &&
		isRivePigPrototypeAnimation(pigAnimation) &&
		resolvedRiveEquipment.supported &&
		main?.prebaked == null &&
		!pigFrozen &&
		skinTintOverride == null &&
		!riveFailed;

	const mainOverlay = main?.overlay ?? null;
	const mainCategory = main?.category ?? null;
	const mainIsBehind =
		mainOverlay?.behind ??
		(mainCategory ? !!Z_BEHIND_PIG[mainCategory] : false);
	const showMainOverlay =
		mainOverlay &&
		!hideAccessory &&
		!(riveActive && resolvedRiveEquipment.equipment.hat === 1);

	// Simple aura animations. Radial rays/rings/sunbursts (AURA_SPIN) rotate slowly
	// around Rosie; everything else — soft glows, elemental, particle clouds —
	// gently breathes out→in→out (a spinning flame/mist looks wrong). Native-driven
	// (cheap); the loops only run while an aura is equipped.
	const hasAura = !!auraSlot?.overlay || prestigeVisualStage > 0;
	const auraSpinRaw = React.useRef(new Animated.Value(0)).current;
	const auraPulseRaw = React.useRef(new Animated.Value(0)).current;
	React.useEffect(() => {
		if (!hasAura || !motionPolicy.allowDecorativeMotion) {
			auraSpinRaw.setValue(0);
			auraPulseRaw.setValue(0);
			return;
		}
		const spin = Animated.loop(
			Animated.timing(auraSpinRaw, {
				toValue: 1,
				duration: 12000,
				easing: Easing.linear,
				useNativeDriver: true,
			}),
		);
		const pulse = Animated.loop(
			Animated.sequence([
				Animated.timing(auraPulseRaw, {
					toValue: 1,
					duration: 1400,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(auraPulseRaw, {
					toValue: 0,
					duration: 1400,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
			]),
		);
		spin.start();
		pulse.start();
		return () => {
			spin.stop();
			pulse.stop();
		};
	}, [
		auraSpinRaw,
		auraPulseRaw,
		hasAura,
		motionPolicy.allowDecorativeMotion,
	]);
	const auraSpin = auraSpinRaw.interpolate({
		inputRange: [0, 1],
		outputRange: ["0deg", "360deg"],
	});
	// out (big) → in (small) → out — a gentle ±6% breathe.
	const auraPulse = auraPulseRaw.interpolate({
		inputRange: [0, 1],
		outputRange: [1.06, 0.94],
	});
	const auraSpins = !!auraSlot?.itemId && AURA_SPIN.has(auraSlot.itemId);

	return (
		<View style={styles.stage}>
			{prestigeVisualStage > 0 && (
				<View style={styles.prestigeAuraLayer} pointerEvents="none">
					<Animated.Image
						source={HAT_IMAGES.gold_aura}
						resizeMode="contain"
						style={[
							styles.prestigeAuraImage,
							{
								opacity: 0.18 + prestigeVisualStage * 0.1,
								transform: [
									{
										rotate:
											prestigeVisualStage >= 4 &&
											motionPolicy.allowDecorativeMotion
												? auraSpin
												: "0deg",
									},
									{ scale: Animated.multiply(auraPulse, 0.82 + prestigeVisualStage * 0.045) },
								],
							},
						]}
					/>
					{prestigeVisualStage >= 2 && (
						<Animated.Image
							source={HAT_IMAGES.fire_aura}
							resizeMode="contain"
							style={[
								styles.prestigeAuraImage,
								{
									opacity: 0.14 + (prestigeVisualStage - 1) * 0.1,
									transform: [
										{ scale: Animated.multiply(auraPulse, 0.78 + prestigeVisualStage * 0.05) },
									],
								},
							]}
						/>
					)}
				</View>
			)}
			{auraSlot?.overlay && (
				// Aura overflows the stage (no clip) so a pulsing halo can breathe
				// past the card edge without a hard box showing. The baked radial
				// falloff keeps the overflow faint. pointerEvents:none so the glow
				// never eats a tap.
				<View style={styles.auraLayer} pointerEvents="none">
					<ItemOverlay
						overlay={auraSlot.overlay}
						imageSrc={auraSlot.imageSrc}
						category={auraSlot.category}
						zIndex={2}
						spin={auraSpins ? auraSpin : undefined}
						pulse={auraSpins ? undefined : auraPulse}
					/>
				</View>
			)}
			{showMainOverlay && mainIsBehind && (
				<ItemOverlay
					overlay={mainOverlay}
					imageSrc={main?.imageSrc ?? null}
					category={mainCategory}
					zIndex={3}
					tint={tintFor(main?.itemId)}
				/>
			)}
			<View style={[styles.pigWrap, { zIndex: 5 }]}>
				<PigRenderer
					pigId={pigId}
					animation={pigAnimation}
					size={PIG_CANVAS}
					onFrame={onPigFrame}
					onComplete={onPigComplete}
					customFrames={main?.prebaked ?? undefined}
					frameIdx={pigFrozen ? pigFrameIdx : undefined}
					skinTintOverride={skinTintOverride}
					renderer={riveActive ? "rive" : "raster"}
					riveSource={riveSource}
					equipment={equipment}
					rolloutEnabled={rolloutEnabled}
					reduceMotion={motionPolicy.reduceMotion}
					onRendererReady={onRiveReady}
					onRendererError={(error) => {
						setRiveFailed(true);
						onRiveError?.(error);
					}}
				/>
			</View>
			{showMainOverlay && !mainIsBehind && (
				<ItemOverlay
					overlay={mainOverlay}
					imageSrc={main?.imageSrc ?? null}
					category={mainCategory}
					zIndex={10}
					tint={tintFor(main?.itemId)}
				/>
			)}
			{neckSlot?.overlay && !hideAccessory && (
				<ItemOverlay
					overlay={neckSlot.overlay}
					imageSrc={neckSlot.imageSrc}
					category={neckSlot.category}
					zIndex={8}
					tint={tintFor(neckSlot.itemId)}
				/>
			)}
			{maskSlot?.overlay && !hideAccessory && (
				<ItemOverlay
					overlay={maskSlot.overlay}
					imageSrc={maskSlot.imageSrc}
					category={maskSlot.category}
					zIndex={9}
					tint={tintFor(maskSlot.itemId)}
				/>
			)}
			{glassesSlot?.overlay &&
				!hideAccessory &&
				!(riveActive && resolvedRiveEquipment.equipment.face === 1) && (
				<ItemOverlay
					overlay={glassesSlot.overlay}
					imageSrc={glassesSlot.imageSrc}
					category={glassesSlot.category}
					zIndex={10}
					tint={tintFor(glassesSlot.itemId)}
				/>
			)}
			{heldSlot?.overlay &&
				!hideAccessory &&
				!(riveActive && resolvedRiveEquipment.equipment.held === 1) && (
				<ItemOverlay
					overlay={heldSlot.overlay}
					imageSrc={heldSlot.imageSrc}
					category={heldSlot.category}
					zIndex={11}
					tint={tintFor(heldSlot.itemId)}
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
	// Aura layer: NOT clipped — the halo overflows the stage so a pulsing aura can
	// breathe past the card without revealing a hard clip-box edge. It's the
	// radial alpha falloff baked into the aura art (scripts/soften_aura_edges.py)
	// that keeps the overflow faint instead of spilling a solid glow onto
	// neighbours. Sits behind the pig (zIndex 2).
	auraLayer: {
		position: "absolute",
		left: 0,
		top: 0,
		width: PIG_CANVAS,
		height: PIG_CANVAS,
		overflow: "visible",
		zIndex: 2,
	},
	prestigeAuraLayer: {
		position: "absolute",
		left: -15,
		top: -15,
		width: PIG_CANVAS + 30,
		height: PIG_CANVAS + 30,
		overflow: "visible",
		zIndex: 1,
	},
	prestigeAuraImage: {
		position: "absolute",
		left: 0,
		top: 0,
		width: "100%",
		height: "100%",
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
});
