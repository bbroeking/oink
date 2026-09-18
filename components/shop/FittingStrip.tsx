// The folded fitting room (the hero fitting room, 2026-09-17). The store leads
// with the Closet's paper-doll — Rosie centred, her slots flanking her — and
// once that hero scrolls off the top of the one scroll it FOLDS to this: the
// same pig at a fraction of the size and what she is wearing, in one line.
//
// It is a reminder, not a second fitting room: nothing is equipped from here
// (an owned coaster on the shelf below already wears in place), and it carries
// no door either — the Closet chip retired with the Closet sign when the
// catalog became the page's own "Everything" section (2026-09-17). It pins over
// the wall, so it is `pointerEvents="box-none"` — the shelves behind it stay
// tappable everywhere the strip itself is not.
import { useEffect, useRef, useState } from "react";
import {
	Animated,
	StyleSheet,
	View,
	type LayoutChangeEvent,
} from "react-native";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { PIG_CANVAS } from "@/constants/hats";
import type { PigId } from "@/utils/pigs";
import {
	BORDER,
	MOTION,
	PAGE_PAD,
	RADII,
	SPACE,
	UI_COLORS,
} from "@/constants/theme";
import { PigStage } from "../ui/PigStage";
import { Sticker } from "../ui/Sticker";
import { T } from "../ui/Text";

/** One PigStage slot, as the stage wants it. */
export type StageSlot = {
	id: string;
	category: string | null;
	emoji: string | null;
} | null;

// ── Drawing geometry ───────────────────────────────────────────────────────
/** Rosie's footprint in the strip — a thumbnail of the hero, not a stage. */
const STRIP_PIG = 44;
/** The window she stands in: a touch of headroom for a tall hat. */
const STRIP_WINDOW_W = 52;
const STRIP_WINDOW_H = 48;
/** How far the strip drops in from under the crown. */
const STRIP_RISE = SPACE.md;

export function FittingStrip({
	visible,
	pigId,
	slots,
	worn,
	slotCount,
	onMeasure,
}: {
	visible: boolean;
	pigId?: PigId;
	slots: {
		hat: StageSlot;
		bow: StageSlot;
		glasses: StageSlot;
		mask: StageSlot;
		neck: StageSlot;
		aura: StageSlot;
		held: StageSlot;
	};
	/** How many equip slots have something in them. */
	worn: number;
	/** How many there are to fill. */
	slotCount: number;
	/**
	 * The strip's bottom edge inside the scroll area. The store scrolls the
	 * "Your closet" crown to just under this, so a deep link never lands the
	 * player on a header the strip is sitting on top of.
	 */
	onMeasure?: (bottom: number) => void;
}) {
	// Reduce Motion: the strip is simply there, or simply not.
	const { reduceMotion } = useMotionPolicy();
	const t = useRef(new Animated.Value(visible ? 1 : 0)).current;
	// The strip is a living mood surface like the hero it folds from: the frame
	// is synced so an equipped hat rides the breathing pig (2026-07-16).
	const [pigFrameIdx, setPigFrameIdx] = useState(0);

	useEffect(() => {
		if (reduceMotion) {
			t.setValue(visible ? 1 : 0);
			return;
		}
		Animated.timing(t, {
			toValue: visible ? 1 : 0,
			duration: MOTION.fade,
			useNativeDriver: true,
		}).start();
	}, [reduceMotion, t, visible]);

	return (
		<Animated.View
			onLayout={(e: LayoutChangeEvent) =>
				onMeasure?.(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
			}
			pointerEvents={visible ? "box-none" : "none"}
			accessibilityElementsHidden={!visible}
			importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
			style={[
				styles.wrap,
				{
					opacity: t,
					transform: [
						{
							translateY: t.interpolate({
								inputRange: [0, 1],
								outputRange: [-STRIP_RISE, 0],
							}),
						},
					],
				},
			]}
		>
			<Sticker color="paper" rotate={0} radius={RADII.lg} style={styles.strip}>
				<View style={styles.window}>
					<View style={styles.pigBox}>
						<View
							style={[
								styles.pigScaler,
								{ transform: [{ scale: STRIP_PIG / PIG_CANVAS }] },
							]}
						>
							<PigStage
								active={visible}
								pigId={pigId}
								pigFrameIdx={pigFrameIdx}
								onPigFrame={setPigFrameIdx}
								equipped={slots.hat}
								equippedBow={slots.bow}
								equippedGlasses={slots.glasses}
								equippedMask={slots.mask}
								equippedNeck={slots.neck}
								equippedAura={slots.aura}
								equippedHeld={slots.held}
							/>
						</View>
					</View>
				</View>
				<T role="kicker" tone="accent" numberOfLines={1} style={styles.line}>
					wearing {worn} of {slotCount}
				</T>
			</Sticker>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	// Pinned over the top of the store's scroll, inside the page's gutter.
	wrap: {
		position: "absolute",
		top: SPACE.sm,
		left: PAGE_PAD,
		right: PAGE_PAD,
		zIndex: 3,
	},
	strip: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.sm,
	},
	// The word takes the rest of the row and yields first; the pig does not.
	line: { flex: 1, minWidth: 0 },
	window: {
		width: STRIP_WINDOW_W,
		height: STRIP_WINDOW_H,
		borderRadius: RADII.md,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surfaceStrong,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "flex-end",
	},
	pigBox: {
		width: STRIP_PIG,
		height: STRIP_PIG,
		overflow: "visible",
	},
	// Centres the 300² stage in the box; the scale transform then fits it.
	pigScaler: {
		position: "absolute",
		left: (STRIP_PIG - PIG_CANVAS) / 2,
		top: (STRIP_PIG - PIG_CANVAS) / 2,
	},
});
