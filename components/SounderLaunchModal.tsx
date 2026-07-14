// "The Great Hunger is here — join a Sounder!" launch nudge. Shown (via the
// popup queue) on launch when the co-op-dig season is live (the `coop_dig`
// server flag) and the player has no crew, re-surfacing at most once/day until
// they create or join one. The primary CTA routes to the Friends → Sounder tab
// where the join/create form lives. Gated by the caller in app/_layout.tsx.
import { useEffect, useRef } from "react";
import { View, Text, Image, Pressable, Modal, Animated, StyleSheet, Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { HAT_IMAGES } from "@/constants/hats";
import { Icon } from "./ui/Icon";
import { Glyph } from "./ui/Glyph";
import { Button } from "./ui/Button";
import { Sticker } from "./ui/Sticker";
import { RACE_TRUFFLE_TABLE, STIR_BUDGET } from "@/constants/dig";
import { WHIMSY, FONTS, RADII, SPACE, TYPE, MODAL_BACKDROP_BG } from "@/constants/theme";
import type { SounderStep } from "@/hooks/useSounderPath";

// The full-Sounder depth gain — TrufflePatch's coop budget (STIR_BUDGET * 1.25)
// is a quarter deeper than solo. The pitch says "digs {N}% deeper" (a felt
// benefit, no "stirs" unit to learn); this derives that percent from the real
// budget so the copy can't drift.
const COOP_DEPTH_GAIN_PCT = Math.round(
	((Math.round(STIR_BUDGET * 1.25) - STIR_BUDGET) / STIR_BUDGET) * 100
);

const HUNGERER = require("../assets/images/hunger/great_hungerer_chip.png");

// Fixed card width (never wider than the screen minus gutters) — avoids the
// alignSelf:"stretch"/maxWidth edge case that clipped wrapped lines on the right.
const CARD_W = Math.min(340, Dimensions.get("window").width - 48);

interface Props {
	visible: boolean;
	onCreate: () => void;
	onDismiss: () => void;
	/**
	 * The current onboarding step — drives the body CTA so the once-per-session
	 * modal reflects the player's real next move (try a dig / join / first dig)
	 * instead of always saying "Join a Sounder". Omitted → the join CTA (the
	 * modal's original behavior).
	 */
	step?: SounderStep | null;
}

// The primary CTA label per step. taste → the toy before the ask; join → the
// social ask; first_dig → close the loop. hook/done/null fall back to "Join a
// Sounder" (the modal only shows to crewless players in practice).
function ctaLabel(step: Props["step"]): string {
	switch (step) {
		case "taste":
			return "Try a dig";
		case "first_dig":
			return "Dig your first feeding";
		default:
			return "Join a Sounder";
	}
}

export function SounderLaunchModal({ visible, onCreate, onDismiss, step }: Props) {
	const anim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!visible) return;
		anim.setValue(0);
		Animated.spring(anim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
	}, [visible, anim]);

	if (!visible) return null;

	const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

	return (
		<Modal visible transparent animationType="none" onRequestClose={onDismiss}>
			<View style={styles.backdrop}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
				<Animated.View style={[styles.animWrap, { opacity: anim, transform: [{ scale }] }]}>
					<Sticker color="paper" rotate={-0.8} radius={RADII.xxl} style={styles.card}>
					<Pressable
						onPress={onDismiss}
						hitSlop={10}
						style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
						accessibilityLabel="Close"
					>
						<Icon name="x" size={18} color={WHIMSY.mute} strokeWidth={2.5} />
					</Pressable>
					{/* The debut art: the Great Hungerer looming, a golden truffle
					    pried loose toward the herd. */}
					<View style={styles.heroScene}>
						<Animated.Image
							source={HUNGERER}
							style={[
								styles.hero,
								{ transform: [
									{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
									{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "0deg"] }) },
								] },
							]}
							resizeMode="contain"
						/>
						<Animated.Image
							source={HAT_IMAGES.golden_truffle}
							style={[
								styles.heroSplat,
								{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.2, 1] }) }] },
							]}
							resizeMode="contain"
						/>
					</View>
					<Text style={styles.kicker}>NEW · THE GREAT HUNGER</Text>
					<Text style={styles.title}>The Great Hunger is here!</Text>
					<Text style={styles.body}>
						Join a <Text style={styles.bodyStrong}>Sounder</Text> and dig at the
						Hungerer's feedings — the truffles are yours to keep.
					</Text>
					{/* The three concrete benefits — the same Glyph-row grammar
					    SounderBenefits (the crewless join door) uses, so the launch
					    nudge and the in-tab pitch read as one voice. Numbers derive
					    from the dig constants + RACE_TRUFFLE_TABLE. */}
					<View style={styles.benefits}>
						{[
							`dig deeper together — a full Sounder digs ${COOP_DEPTH_GAIN_PCT}% deeper`,
							"herd milestones pay everyone — titles + snout purses",
							`weekly dig-off pays Golden Truffles — ${RACE_TRUFFLE_TABLE[1]} each for 1st`,
						].map((line) => (
							<View key={line} style={styles.benefitRow}>
								<Glyph name="gem" size={16} />
								<Text style={styles.benefit}>{line}</Text>
							</View>
						))}
					</View>

					<View style={styles.primaryWrap}>
						<Button size="md" variant="primary" full onPress={onCreate}>
							{ctaLabel(step)}
						</Button>
					</View>
					<Pressable
						onPress={onDismiss}
						hitSlop={8}
						style={({ pressed }) => [styles.later, pressed && { opacity: 0.6 }]}
					>
						<Text style={styles.laterText}>Maybe later</Text>
					</Pressable>
					</Sticker>
				</Animated.View>
			</View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const styles = StyleSheet.create({
	backdrop: { flex: 1, backgroundColor: MODAL_BACKDROP_BG, alignItems: "center", justifyContent: "center", padding: SPACE.xl + 4 },
	// The animated layer carries ONLY opacity+scale+width — no fill/border/shadow,
	// which iOS renders as detached offset artifacts under a transform. The inner
	// `Sticker` draws the fill + ink border + hard shadow (the paper-craft card),
	// so they stay perfectly aligned inside the transformed wrapper.
	animWrap: { width: CARD_W },
	card: {
		width: "100%",
		padding: SPACE.xl - 2,
		alignItems: "center",
	},
	closeBtn: {
		position: "absolute",
		top: 10,
		right: 12,
		width: 30,
		height: 30,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 3,
	},
	heroScene: { width: 110, height: 92, alignItems: "center", justifyContent: "center", marginBottom: SPACE.sm },
	hero: { width: 84, height: 84 },
	heroSplat: { position: "absolute", right: 6, bottom: 8, width: 38, height: 38 },
	kicker: { ...TYPE.kicker, letterSpacing: 1.2, color: WHIMSY.accent, marginBottom: 2 },
	title: { ...TYPE.pageTitle, color: INK, textAlign: "center", marginBottom: SPACE.sm + 2 },
	body: { ...TYPE.hand, fontSize: 16, lineHeight: 22, color: WHIMSY.mute, textAlign: "center", marginBottom: SPACE.md },
	bodyStrong: { ...TYPE.body, fontFamily: FONTS.bodyExtra, color: INK },
	// The three concrete benefit lines — gem-glyph rows, matching SounderBenefits.
	benefits: { alignSelf: "stretch", gap: SPACE.xs, marginBottom: SPACE.lg + 2 },
	benefitRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	benefit: { flex: 1, ...TYPE.bodySm, fontFamily: FONTS.bodyExtra, color: INK },

	// The primary CTA is the shared Button primitive now; this wrap just stretches
	// it to the card width.
	primaryWrap: { alignSelf: "stretch" },
	later: { paddingVertical: SPACE.md, marginTop: SPACE.xs },
	laterText: { ...TYPE.hand, fontSize: 15, color: WHIMSY.mute },
});
