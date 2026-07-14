// The quiet Barn fallback to the once-per-session SounderLaunchModal: a small
// sticker-chip banner inviting a crewless player to join a Sounder. Shown on the
// home screen ONLY when the Great Hunger season is live for this user AND they
// have no crew — it vanishes the instant they join. Where the modal is the
// launch beat, this chip is the persistent-but-calm nudge that fills the quiet
// without nagging (no loops, no counts; one tap routes to the join surface).
//
// Crew state is a one-shot crew_state RPC on focus, deliberately NOT useCrew():
// that hook subscribes realtime (invites + roster) which is far too heavy to
// mount on the Barn just to answer "does this player have a crew?". This mirrors
// the crew check the launch nudge already does in app/_layout.tsx.
import { useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useSounderPath } from "@/hooks/useSounderPath";
import { WHIMSY, FONTS, SPACE, PAGE_PAD, SHADOW_SM, RADII, TYPE } from "@/constants/theme";
import { Icon } from "./ui/Icon";

const HUNGERER = require("../assets/images/hunger/great_hungerer_chip.png");

export function BarnSounderChip() {
	// Same effective gate the Season tab + Sounder segment + launch nudge use:
	// the world_boss flag (or DEV), NOT the standalone coop_dig flag which never
	// flipped. Loading/failure reads false, so the chip never flashes pre-confirm.
	const coopDig = useFeatureFlag("world_boss") || __DEV__;

	// The chip's line now reflects the current onboarding STEP (not always "join").
	// The path hook does the crew read (and derives the step), so the chip keeps
	// its crewless-only visibility: it renders for the crewless steps (taste / join)
	// and retires the instant the player joins a crew — the derived step goes to
	// first_dig / done, both of which this chip hides for.
	const { step } = useSounderPath(coopDig);
	// Session-only dismiss (the "×"). No AsyncStorage on purpose — this is the
	// quiet in-session fallback, so re-showing next launch is correct.
	const [dismissed, setDismissed] = useState(false);

	// Show only for the two crewless funnel steps; hide while resolving (null),
	// at hook (the tale owns that beat), and once crewed (first_dig / done).
	const showFor = step === "taste" || step === "join";
	if (!coopDig || dismissed || !showFor) return null;

	// taste routes to the season tab (where the practice dig lives); join keeps the
	// Sounder-segment destination the chip has always used.
	const taste = step === "taste";
	const line = taste
		? "try a dig — no herd needed ›"
		: "the dig needs a herd — join a Sounder ›";
	const dest = taste ? "/(tabs)/season" : "/(tabs)/friends?seg=sounder";

	return (
		<View style={styles.slot}>
			<Pressable
				onPress={() => {
					Haptics.selectionAsync().catch(() => {});
					router.push(dest);
				}}
				style={({ pressed }) => [styles.chip, pressed && { opacity: 0.92 }]}
				accessibilityRole="button"
				accessibilityLabel={taste ? "Try a dig" : "Join a Sounder"}
			>
				<Image source={HUNGERER} style={styles.chipArt} resizeMode="contain" />
				<View style={styles.chipText}>
					<Text style={styles.kicker}>THE GREAT HUNGER</Text>
					<Text style={styles.line}>{line}</Text>
				</View>
			</Pressable>
			<Pressable
				onPress={() => setDismissed(true)}
				hitSlop={10}
				style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
				accessibilityRole="button"
				accessibilityLabel="Dismiss"
			>
				<Icon name="x" size={13} color={WHIMSY.barkMute} strokeWidth={2.5} />
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	// In-flow band, matching the stat cluster's horizontal gutters. No absolute
	// positioning — it rides the flex column above the pig, so it can never cover
	// Rosie or eat her taps (no pointerEvents footgun).
	slot: {
		paddingHorizontal: PAGE_PAD,
		marginBottom: SPACE.sm,
		zIndex: 2,
	},
	// One sanctioned dark surface — the Great Hunger storyteller voice on bark,
	// same trio the Sounder war panels use. Hand-drawn tilt + hard sticker shadow.
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: WHIMSY.bark,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingVertical: SPACE.sm,
		paddingLeft: SPACE.sm,
		// Asymmetric right pad clears the absolutely-positioned close button
		// (right:6 + width:22) — load-bearing, kept off the SPACE scale.
		paddingRight: 30,
		transform: [{ rotate: "-0.8deg" }],
		...SHADOW_SM,
	},
	chipArt: { width: 34, height: 34 },
	chipText: { flex: 1, minWidth: 0 },
	kicker: {
		...TYPE.kicker,
		// Tracked-caps storyteller kicker on bark — sun on dark, tighter size +
		// wider tracking than the base role, so those two stay overridden.
		fontSize: 11,
		letterSpacing: 1.4,
		color: WHIMSY.sun,
		marginBottom: 1,
	},
	line: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.barkText,
		lineHeight: 17,
	},
	close: {
		position: "absolute",
		top: 4,
		right: 6,
		width: 22,
		height: 22,
		alignItems: "center",
		justifyContent: "center",
	},
});
