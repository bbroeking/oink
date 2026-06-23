// "Mud Wars are here — start a Sounder!" launch nudge. Shown (via the popup
// queue) on launch when the feature is live (MUD_FIGHTS_VISIBLE) and the player
// has no crew, re-surfacing at most once/day until they create or join one. The
// primary CTA routes to the Friends → Sounder tab where the crew-create form
// lives. Gated by the caller in app/_layout.tsx.
import { useEffect, useRef } from "react";
import { View, Text, Image, Pressable, Modal, Animated, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { HAT_IMAGES } from "@/constants/hats";
import { WHIMSY, FONTS, SHADOW_SM } from "@/constants/theme";

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
				<Animated.View style={[styles.card, { opacity: anim, transform: [{ scale }] }]}>
					{/* The debut art shows the Slop Toss combat: a warboss charges in, a splat lands. */}
					<View style={styles.heroScene}>
						<Animated.Image
							source={HAT_IMAGES.goblin_warboss}
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
							source={HAT_IMAGES.mud_splat}
							style={[
								styles.heroSplat,
								{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.2, 1] }) }] },
							]}
							resizeMode="contain"
						/>
					</View>
					<Text style={styles.kicker}>NEW · MUD WARS</Text>
					<Text style={styles.title}>Mud Wars are here!</Text>
					<Text style={styles.body}>
						Rally a <Text style={styles.bodyStrong}>Sounder</Text> — a crew of up to 5 — and
						sling mud in 5-day wars. Winners split the pot in snouts, score a regen buff, and
						earn <Text style={styles.bodyStrong}>war-only cosmetics</Text>.
					</Text>

					<Pressable
						onPress={onCreate}
						style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
					>
						<Text style={styles.primaryText}>Create a Sounder</Text>
					</Pressable>
					<Pressable onPress={onDismiss} hitSlop={8} style={styles.later}>
						<Text style={styles.laterText}>Maybe later</Text>
					</Pressable>
				</Animated.View>
			</View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const styles = StyleSheet.create({
	backdrop: { flex: 1, backgroundColor: "rgba(20,16,28,0.55)", alignItems: "center", justifyContent: "center", padding: 28 },
	card: {
		width: "100%",
		maxWidth: 360,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 22,
		padding: 22,
		alignItems: "center",
		...SHADOW_SM,
	},
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
