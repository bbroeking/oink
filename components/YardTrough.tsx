// An open sounder Trough is a THING IN THE YARD (SKILL.md 2026-09-16), so it
// shows as one: a small wooden trough beside the buried-truffle mound on
// Rosie's ground plane — the slop level as a notched track, the opener's pig
// peeking over the rim. Diegetic accessories are allowed for things in the
// yard, never for actions (taste-standard, 2026-09-13): chipping in lives in
// the Trough sheet; this is only the herd's leading Trough, standing there —
// a FRIEND's, never yours (founder, 2026-09-16): it invites a chip-in.
//
// COLLAPSED BY DEFAULT, like the mound. Tap the trough and a paper tag unfolds
// beside it with the count and the offer — "140 of 200 · chip in 25 ›" — and
// the tag is the way into the Trough sheet. Tap the trough again and the tag
// folds. Nothing here fires a sheet on the first tap. The tag sits to the
// right so the trough never leaves the ground line.
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Hand } from "./ui";
import { PigAvatar } from "./ui/PigAvatar";
import { ProgressTrack } from "./ui/ProgressTrack";
import type { TroughDrive } from "@/hooks/useTroughDrives";
import { isPigId } from "@/utils/pigs";
import { TROUGH_NOTCHES, troughRowTitle, troughYardOffer } from "@/utils/troughRows";
import {
	AVATAR_SIZE,
	BORDER,
	PRESSED,
	RADII,
	SHADOW_SM,
	SPACE,
	UI_COLORS,
	WHIMSY,
	WOOD,
} from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { POP_IN_SPRING } from "@/utils/motionRecipes";

// --- ART -------------------------------------------------------------------
// The trough's drawing, in points: the wood, the slop inside it, the pig
// peeking over the back rim.
const TROUGH_W = 72;
const TROUGH_H = 26;
const RIM_PIG = AVATAR_SIZE[0];
const RIM_PIG_LIFT = -(RIM_PIG * 0.55);
const TAG_TILT = "-2deg";
// How far the tag slides into place from the trough's side as it unfolds.
const TAG_SLIDE = -6;

interface Props {
	/** The herd's leading open Trough (utils/troughRows leadingTroughDrive). */
	drive: TroughDrive;
	/** The tag's tap: open the Trough sheet on this drive. */
	onPress: () => void;
}

/** "140 of 200" — the tag's first line. */
export function troughYardCount(d: Pick<TroughDrive, "raised" | "target">): string {
	return `${d.raised.toLocaleString()} of ${d.target.toLocaleString()}`;
}

export function YardTrough({ drive, onPress }: Props) {
	const motion = useMotionPolicy();
	const [shown, setShown] = useState(false);
	const unfold = useRef(new Animated.Value(0)).current;
	const title = troughRowTitle(drive);
	const count = troughYardCount(drive);
	const offer = troughYardOffer(drive);
	const pigId = isPigId(drive.opener_pig_id) ? drive.opener_pig_id : "rosie";

	useEffect(() => {
		const to = shown ? 1 : 0;
		(motion.reduceMotion || !shown
			? Animated.timing(unfold, {
					toValue: to,
					duration: motion.duration(MOTION_DURATION.state, MOTION_DURATION.crossfade),
					useNativeDriver: true,
				})
			: Animated.spring(unfold, {
					toValue: to,
					...POP_IN_SPRING,
					useNativeDriver: true,
				})
		).start();
	}, [shown, unfold, motion]);

	const toggle = () => {
		Haptics.selectionAsync().catch(() => {});
		setShown((s) => !s);
	};
	const open = () => {
		Haptics.selectionAsync().catch(() => {});
		onPress();
	};

	return (
		<View style={styles.spot} testID="yard-trough">
			<Pressable
				onPress={toggle}
				hitSlop={SPACE.sm}
				accessibilityRole="button"
				accessibilityLabel={`The Trough: ${title}`}
				accessibilityValue={{ text: `${count} snouts` }}
				accessibilityState={{ expanded: shown }}
				accessibilityHint={shown ? "Folds the tag away" : "Shows how the Trough is filling"}
				style={({ pressed }) => [styles.trough, pressed && styles.pressed]}
			>
				<View style={styles.rimPig} pointerEvents="none">
					<PigAvatar size={RIM_PIG} pigId={pigId} border={UI_COLORS.border} />
				</View>
				<LinearGradient colors={[WOOD.top, WOOD.bottom]} style={styles.wood} pointerEvents="none" />
				<View style={styles.slop} pointerEvents="none">
					<ProgressTrack
						value={drive.raised}
						max={drive.target}
						height="sm"
						notches={TROUGH_NOTCHES}
						accessibilityLabel={`${title} progress`}
					/>
				</View>
			</Pressable>
			{/* The tag is only in the tree while shown, so a folded trough never
			    holds an invisible tap target over the yard. */}
			{shown ? (
				<Animated.View
					style={{
						opacity: unfold,
						transform: [
							{ translateX: unfold.interpolate({ inputRange: [0, 1], outputRange: [TAG_SLIDE, 0] }) },
						],
					}}
				>
					<Pressable
						onPress={open}
						hitSlop={SPACE.xs}
						accessibilityRole="button"
						accessibilityLabel={`${title}, ${count} snouts`}
						accessibilityHint="Opens the Trough"
						style={({ pressed }) => [styles.tag, pressed && styles.pressed]}
						testID="yard-trough-tag"
					>
						<Hand numberOfLines={1}>{count}</Hand>
						<Hand tone="secondary" numberOfLines={1}>
							{offer}
						</Hand>
					</Pressable>
				</Animated.View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	// A row: the trough planted at the left, the tag hanging off its shoulder.
	spot: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: SPACE.sm,
	},
	pressed: {
		...PRESSED,
		elevation: 0,
	},
	// The wood: square shoulders, a rounded belly, the thin shadow. The pig's
	// head rises above the top edge, so the pressable keeps that headroom.
	trough: {
		width: TROUGH_W,
		height: TROUGH_H - RIM_PIG_LIFT,
		justifyContent: "flex-end",
	},
	wood: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: TROUGH_H,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		borderTopLeftRadius: RADII.sm,
		borderTopRightRadius: RADII.sm,
		borderBottomLeftRadius: RADII.lg,
		borderBottomRightRadius: RADII.lg,
		...SHADOW_SM,
	},
	slop: {
		paddingHorizontal: SPACE.xs,
		paddingBottom: SPACE.xs,
	},
	rimPig: {
		position: "absolute",
		right: SPACE.xs,
		top: 0,
		zIndex: 1,
	},
	// The paper tag — the mound's tag, word for word, so the yard's two things share one voice.
	tag: {
		alignItems: "flex-start",
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xxs,
		borderRadius: RADII.sm,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		transform: [{ rotate: TAG_TILT }],
		...SHADOW_SM,
	},
});
