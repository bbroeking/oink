// A cosmetic's product shot — the one thumbnail every shop surface draws
// (a shelf coaster, a grid card, a counter figure's held thing). Lifted out of
// app/(tabs)/shop.tsx for the storefront (2026-09-16) so the shelves and the
// fallback grid draw the same art the same way.
import { useState } from "react";
import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { HAT_IMAGES, HAT_THUMBNAILS_256, type HatRow } from "@/constants/hats";
import { categoryIcon } from "@/constants/emojiArt";
import { cosmeticFxFor } from "@/constants/cosmeticFx";
import { ART_SIZE } from "@/constants/theme";
import { AnimatedCosmetic, Glyph } from "../ui";

/** Inset of the art inside a measured (fill-mode) box. */
const THUMB_INSET = 12;
/** The fraction of its box a fallback sparkle fills. */
const FALLBACK_ART_FRAC = 0.5;
/** The default box when a caller doesn't state one. */
const ART_THUMB = 100;

export function HatThumb({
	item,
	size,
	fill,
}: {
	item: HatRow;
	size?: number;
	fill?: boolean;
}) {
	// fill mode: MEASURE the box, then render the Image at an explicit
	// numeric size. Absolute-inset sizing (the previous fix) still hit the
	// Yoga intrinsic-size quirk inside the mosaic's aspectRatio cells
	// (sixth sighting) — bows/hats rendered at native px and cropped.
	const [box, setBox] = useState<{ w: number; h: number } | null>(null);
	const hatSrc = HAT_THUMBNAILS_256[item.id] ?? HAT_IMAGES[item.id];
	// No item art → fall back to the category icon (real art). Auras +
	// necklaces have no category art (categoryIcon null) → neutral glyph.
	const catIcon = !hatSrc ? categoryIcon(item.category) : null;
	const src = hatSrc ?? catIcon;
	// Members-only / legendary items with an animation recipe render live
	// (float + glow + shimmer + sparkles) instead of a flat Image.
	const fx = hatSrc ? cosmeticFxFor(item.id) : undefined;
	if (!fill) {
		const side = size ?? ART_THUMB;
		if (fx && hatSrc) return <AnimatedCosmetic source={hatSrc} fx={fx} size={side} />;
		if (src) return <Image source={src} style={{ width: side, height: side }} resizeMode="contain" />;
		// Missing art is a PLACEHOLDER, not a label — it renders as the hand-drawn
		// sparkle the Closet already uses for the same case. [D-19] (2026-09-11)
		return <Glyph name="sparkle" size={side * FALLBACK_ART_FRAC} />;
	}
	// Backgrounds + auras are edge-to-edge art — cover the whole box.
	// Everything else contain-fits a centered square with breathing room.
	const fullBleed = item.category === "background" || item.category === "aura";
	const side = box ? Math.max(0, Math.min(box.w, box.h) - THUMB_INSET) : 0;
	return (
		<View
			style={styles.thumbFillBox}
			onLayout={(e: LayoutChangeEvent) => {
				const { width, height } = e.nativeEvent.layout;
				setBox({ w: width, h: height });
			}}
		>
			{box && fx && hatSrc && !fullBleed ? (
				<AnimatedCosmetic source={hatSrc} fx={fx} size={side} />
			) : box && src ? (
				<Image
					source={src}
					style={
						fullBleed
							? { width: box.w, height: box.h }
							: { width: side, height: side }
					}
					resizeMode={fullBleed ? "cover" : "contain"}
				/>
			) : !src && box ? (
				<Glyph
					name="sparkle"
					size={Math.min(box.w, box.h) * FALLBACK_ART_FRAC}
				/>
			) : null}
		</View>
	);
}

/** True when the catalog has a real picture for this item (not a category fallback). */
export function hasItemArt(id: string): boolean {
	return !!HAT_IMAGES[id] || !!HAT_THUMBNAILS_256[id];
}

// The catalog thumbnail size the shelves and rows share.
export const ITEM_ART_THUMB = ART_SIZE.thumb;

const styles = StyleSheet.create({
	// Measuring container for fill mode — the VIEW takes the insets (views
	// resolve them fine; it's Images that fall back to intrinsic px), the
	// Image inside gets measured numerics.
	thumbFillBox: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
});
