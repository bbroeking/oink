// "The Great Hunger is here — join a Sounder!" launch nudge. Shown (via the
// popup queue) on launch when the co-op-dig season is live (the `coop_dig`
// server flag) and the player has no crew, re-surfacing at most once/day until
// they create or join one. The primary CTA routes to the Friends → Sounder tab
// where the join/create form lives. Gated by the caller in app/_layout.tsx.
import { useEffect, useRef } from "react";
import { View, Text, Image, Pressable, Modal, Animated, StyleSheet, Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { HAT_IMAGES } from "@/constants/hats";
import { WHIMSY, FONTS, SHADOW_SM } from "@/constants/theme";

const HUNGERER = require("../assets/images/hunger/great_hungerer_chip.png");

// Fixed card width (never wider than the screen minus gutters) — avoids the
// alignSelf:"stretch"/maxWidth edge case that clipped wrapped lines on the right.
const CARD_W = Math.min(340, Dimensions.get("window").width - 48);

interface Props {
	visible: boolean;
	onCreate: () => void;
	onDismiss: () => void;
}

export function SounderLaunchModal({ visible, onCreate, onDismiss }: Props) {
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
					<View style={styles.card}>
					<Pressable
						onPress={onDismiss}
						hitSlop={10}
						style={styles.closeBtn}
						accessibilityLabel="Close"
					>
						<Text style={styles.closeText}>✕</Text>
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
						Hungerer's feedings. The <Text style={styles.bodyStrong}>truffles are
						yours</Text> — and every find starves him a little more.
					</Text>

					<Pressable
						onPress={onCreate}
						style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
					>
						<Text style={styles.primaryText}>Join a Sounder</Text>
					</Pressable>
					<Pressable onPress={onDismiss} hitSlop={8} style={styles.later}>
						<Text style={styles.laterText}>Maybe later</Text>
					</Pressable>
					</View>
				</Animated.View>
			</View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const styles = StyleSheet.create({
	backdrop: { flex: 1, backgroundColor: "rgba(20,16,28,0.55)", alignItems: "center", justifyContent: "center", padding: 28 },
	// The animated layer carries ONLY opacity+scale+width — no fill/border/shadow,
	// which iOS renders as detached offset artifacts under a transform. The static
	// inner `card` draws the fill + border so they stay perfectly aligned.
	animWrap: { width: CARD_W },
	card: {
		width: "100%",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 22,
		padding: 22,
		alignItems: "center",
		...SHADOW_SM,
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
	closeText: { fontFamily: FONTS.whimsy, fontSize: 20, color: WHIMSY.mute },
	heroScene: { width: 110, height: 92, alignItems: "center", justifyContent: "center", marginBottom: 8 },
	hero: { width: 84, height: 84 },
	heroSplat: { position: "absolute", right: 6, bottom: 8, width: 38, height: 38 },
	kicker: { fontFamily: FONTS.hand, fontSize: 13, letterSpacing: 1.2, color: WHIMSY.accent, marginBottom: 2 },
	title: { fontFamily: FONTS.whimsy, fontSize: 26, color: INK, textAlign: "center", marginBottom: 10 },
	body: { fontFamily: FONTS.hand, fontSize: 16, lineHeight: 22, color: WHIMSY.mute, textAlign: "center", marginBottom: 18 },
	bodyStrong: { fontFamily: FONTS.bodyExtra, fontSize: 15, color: INK },

	primary: {
		alignSelf: "stretch",
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingVertical: 13,
		alignItems: "center",
		...SHADOW_SM,
	},
	primaryText: { fontFamily: FONTS.whimsy, fontSize: 17, color: INK },
	later: { paddingVertical: 12, marginTop: 4 },
	laterText: { fontFamily: FONTS.hand, fontSize: 15, color: WHIMSY.mute },
});
