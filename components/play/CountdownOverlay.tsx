// The beat before a table starts (phase "starting"): "Found a pig!" or
// "Everyone's here", and 3-2-1 counted from the snapshot's startsAt on the
// table's own clock, while the pigs in the strip above turn to face each
// other. A layer over the board area that never takes a touch (the build-99
// lesson): the emote tray under it keeps working, so a pig can wave hello.

import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import { Sticker, T } from "@/components/ui";
import { CHROME_TYPE_CAP, MOTION_SPRING, SPACE, TILT } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { useServerClock, type RoomSource } from "@/hooks/useMultiplayer";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import { countdownHeadline } from "./playCopy";

// The count redraws often enough to land each number on its second.
const COUNT_TICK_MS = 100;
// A number arrives a little large and settles.
const ARRIVE_FROM = 1.35;

export function CountdownOverlay({ room, source, practice }: { room: RoomSnapshot; source: RoomSource; practice: boolean }) {
	const { reduceMotion } = useMotionPolicy();
	const now = useServerClock(COUNT_TICK_MS, source);
	const left = room.startsAt !== null ? Math.max(0, room.startsAt - now) : 0;
	const count = Math.max(1, Math.ceil(left / 1000));
	const headline = countdownHeadline(room, practice);

	useEffect(() => {
		AccessibilityInfo.announceForAccessibility(headline);
	}, [headline]);

	const [pop] = useState(() => new Animated.Value(1));
	useEffect(() => {
		if (reduceMotion) {
			pop.setValue(1);
			return;
		}
		pop.setValue(ARRIVE_FROM);
		const run = Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...MOTION_SPRING.overshoot });
		run.start();
		return () => run.stop();
	}, [count, reduceMotion, pop]);

	return (
		<View pointerEvents="none" style={styles.layer} testID="countdown-overlay">
			<Sticker color="sun" rotate={TILT.dialog} pad style={styles.card}>
				<T role="sectionTitle" align="center" maxFontSizeMultiplier={CHROME_TYPE_CAP} testID="countdown-headline">
					{headline}
				</T>
				<Animated.View style={{ transform: [{ scale: pop }] }}>
					<T role="hero" align="center" maxFontSizeMultiplier={CHROME_TYPE_CAP} testID="countdown-number">
						{String(count)}
					</T>
				</Animated.View>
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	layer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
	card: { alignItems: "center", gap: SPACE.xs, paddingHorizontal: SPACE.xl },
});
