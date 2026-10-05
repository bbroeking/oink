// An emote sticker popping over the pig that sent it (useRoom().emotes: the
// latest emote per seat, stamped on the table's clock). It springs in, hangs
// for a toast's dwell and lets go; a newer emote from the same pig replaces
// it. Under Reduce Motion it simply appears and disappears. Never a
// replacement for words: the sticker carries its label for a screen reader.

import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Image, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Sticker } from "@/components/ui";
import { MOTION_SPRING, RADII } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import type { EmoteMark } from "@/hooks/useMultiplayer";
import { EMOTE_ART, EMOTE_LABEL } from "./emoteArt";
import { EMOTE_HOLD_MS, EMOTE_POP } from "./layout";

// The sticker leans like it was slapped on; its art fills most of the disc.
const POP_TILT = 6;
const ART_FRAC = 0.8;

export function EmotePop({
	mark,
	now,
	who,
	style,
	testID,
}: {
	mark: EmoteMark | undefined;
	/** The table's clock (RoomSource.now). */
	now: () => number;
	/** Who sent it, for the announcement ("Bandit", "You"). */
	who: string;
	style?: StyleProp<ViewStyle>;
	testID?: string;
}) {
	const { reduceMotion } = useMotionPolicy();
	// Which emote is up: set when a new mark arrives (adjusted during render),
	// cleared by the dwell timer below. A mark already there when the pig
	// mounts is old news, like a revision's cues: it does not pop.
	const markKey = mark ? `${mark.emote}:${mark.at}` : null;
	const [shown, setShown] = useState<{ key: string; mark: EmoteMark } | null>(null);
	const [seenKey, setSeenKey] = useState<string | null>(markKey);
	if (markKey !== seenKey) {
		setSeenKey(markKey);
		setShown(mark && markKey ? { key: markKey, mark } : null);
	}
	const [pop] = useState(() => new Animated.Value(1));

	const shownKey = shown?.key ?? null;
	const shownAt = shown?.mark.at ?? 0;
	const shownEmote = shown?.mark.emote ?? null;
	useEffect(() => {
		if (!shownKey || !shownEmote) return;
		const left = EMOTE_HOLD_MS - Math.max(0, now() - shownAt);
		if (left <= 0) {
			const late = setTimeout(() => setShown((cur) => (cur?.key === shownKey ? null : cur)), 0);
			return () => clearTimeout(late);
		}
		AccessibilityInfo.announceForAccessibility(`${who}: ${EMOTE_LABEL[shownEmote]}`);
		let run: Animated.CompositeAnimation | null = null;
		if (reduceMotion) {
			pop.setValue(1);
		} else {
			pop.setValue(0);
			run = Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...MOTION_SPRING.overshoot });
			run.start();
		}
		const timer = setTimeout(() => setShown((cur) => (cur?.key === shownKey ? null : cur)), left);
		return () => {
			run?.stop();
			clearTimeout(timer);
		};
	}, [shownKey, shownAt, shownEmote, now, who, reduceMotion, pop]);

	if (!shown) return null;
	return (
		<Animated.View
			pointerEvents="none"
			style={[
				styles.wrap,
				style,
				{
					opacity: reduceMotion ? 1 : pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
					transform: [{ scale: reduceMotion ? 1 : pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate: `${POP_TILT}deg` }],
				},
			]}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			testID={testID}
		>
			<Sticker color="paper" radius={RADII.pill} shadow="sm" rotate={0} style={styles.sticker}>
				<Image source={EMOTE_ART[shown.mark.emote]} resizeMode="contain" style={styles.art} />
			</Sticker>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	wrap: { position: "absolute" },
	sticker: {
		width: EMOTE_POP,
		height: EMOTE_POP,
		alignItems: "center",
		justifyContent: "center",
	},
	art: { width: EMOTE_POP * ART_FRAC, height: EMOTE_POP * ART_FRAC },
});
