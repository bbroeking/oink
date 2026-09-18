// The empty yard — what stands where the pig would when the greeter is out
// looking (R1): the PIG_STAGE-sized slot with a paper sticker that says who
// is out, when she is back and where to go. A tap on the sticker opens the
// Pen; a tap anywhere else in the yard wobbles the sticker (there is nobody
// to tickle). The visit screen draws the same sticker for the host's away
// pig, with its own line and no door.
import { useCallback, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { CardTitle, Hand, Sticker } from "@/components/ui";
import { PIG_CANVAS } from "@/constants/hats";
import { RADII, SPACE, TILT } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { backByLabel } from "@/utils/errands";
import { pigDefinition, type PigId } from "@/utils/pigs";

/** How far the sticker leans on a wobble, in degrees, and how long it takes. */
const WOBBLE_DEG = 3;

interface Props {
	pig: PigId;
	endsAt: string | null;
	/** The sticker's hand line; the default names the Pen. */
	line?: string;
	/** Where the sticker's tap goes; absent on a visit (no door). */
	onOpen?: () => void;
	/** The slot's side, PIG_STAGE on the Barn. */
	size?: number;
	testID?: string;
}

export function EmptyYard({ pig, endsAt, line, onOpen, size = PIG_CANVAS, testID = "empty-yard" }: Props) {
	const motion = useMotionPolicy();
	const wobble = useRef(new Animated.Value(0)).current;
	const name = pigDefinition(pig).name;
	const back = endsAt ? backByLabel(endsAt) : "back soon";

	const nudge = useCallback(() => {
		if (motion.reduceMotion) return;
		wobble.stopAnimation();
		wobble.setValue(0);
		Animated.sequence([
			Animated.timing(wobble, { toValue: 1, duration: MOTION_DURATION.feedback, useNativeDriver: true }),
			Animated.timing(wobble, { toValue: -1, duration: MOTION_DURATION.feedback, useNativeDriver: true }),
			Animated.timing(wobble, { toValue: 0.5, duration: MOTION_DURATION.feedback, useNativeDriver: true }),
			Animated.timing(wobble, { toValue: 0, duration: MOTION_DURATION.feedback, useNativeDriver: true }),
		]).start();
	}, [motion.reduceMotion, wobble]);

	const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: [`-${WOBBLE_DEG}deg`, `${WOBBLE_DEG}deg`] });

	return (
		<Pressable
			style={[styles.slot, { width: size, height: size }]}
			onPress={nudge}
			accessibilityRole="text"
			accessibilityLabel={`${name}'s out looking, ${back}`}
			testID={testID}
		>
			<Animated.View style={{ transform: [{ rotate }] }}>
				<Sticker
					color="paper"
					rotate={TILT.card}
					radius={RADII.md}
					shadow="sticker"
					onPress={onOpen}
					accessibilityRole={onOpen ? "button" : "text"}
					accessibilityLabel={`${name}'s out looking, ${back}`}
					accessibilityHint={onOpen ? "Opens the Pen" : undefined}
					style={styles.sticker}
					testID={`${testID}-sticker`}
				>
					<CardTitle align="center">{`${name}'s out looking`}</CardTitle>
					<Hand tone="secondary" align="center">
						{line ?? `${back} · tap to visit the Pen`}
					</Hand>
				</Sticker>
			</Animated.View>
			<View style={styles.ground} pointerEvents="none" />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	slot: { alignItems: "center", justifyContent: "center" },
	sticker: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, gap: SPACE.xxs, alignItems: "center" },
	ground: { position: "absolute", bottom: 0, left: 0, right: 0, height: SPACE.xl },
});
