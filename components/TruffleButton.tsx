// The truffle control on your OWN barn — ONE always-visible shovel button pinned
// in the upper-left. Tap to bury a truffle (when nothing's down) or to manage /
// dig it back up (when one is buried, shown with a snout-count badge). Replaces
// the old bottom-corner shovel + the easy-to-miss dirt mound at the pig's feet.
import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Shovel } from "./ui/Shovel";
import { SnoutCoin } from "./ui/SnoutCoin";
import { WHIMSY, FONTS, SHADOW_SM, RADII } from "@/constants/theme";

interface Props {
	buried: boolean;
	remaining?: number; // snout-count badge when buried
	onPress: () => void;
}

export function TruffleButton({ buried, remaining, onPress }: Props) {
	const pulse = useRef(new Animated.Value(0)).current;
	const wig = useRef(new Animated.Value(0)).current;

	// Gentle attract pulse only when there's nothing buried yet (invites a bury).
	useEffect(() => {
		if (buried) return;
		const loop = Animated.loop(
			Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true })
		);
		loop.start();
		return () => loop.stop();
	}, [buried, pulse]);

	const press = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		wig.setValue(0);
		Animated.sequence([
			Animated.timing(wig, { toValue: 1, duration: 80, useNativeDriver: true }),
			Animated.timing(wig, { toValue: -1, duration: 80, useNativeDriver: true }),
			Animated.spring(wig, { toValue: 0, friction: 4, tension: 140, useNativeDriver: true }),
		]).start();
		onPress();
	};

	const rotate = wig.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-13deg", "0deg", "11deg"] });

	return (
		<Pressable onPress={press} hitSlop={12} style={styles.btn} accessibilityLabel={buried ? "Manage your buried truffle" : "Bury a truffle"}>
			{!buried && (
				<Animated.View
					pointerEvents="none"
					style={[
						styles.pulse,
						{
							opacity: pulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 0.14, 0] }),
							transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.7] }) }],
						},
					]}
				/>
			)}
			<Animated.View style={{ transform: [{ rotate }] }}>
				<Shovel size={30} />
			</Animated.View>
			{buried && (
				<View style={styles.badge}>
					<SnoutCoin size={11} />
					<Text style={styles.badgeText}>{remaining ?? 0}</Text>
				</View>
			)}
		</Pressable>
	);
}

const INK = WHIMSY.ink;
const SIZE = 46;
const styles = StyleSheet.create({
	btn: {
		width: SIZE,
		height: SIZE,
		borderRadius: RADII.lg,
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: INK,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	pulse: { position: "absolute", width: SIZE + 8, height: SIZE + 8, borderRadius: RADII.lg, borderWidth: 3, borderColor: WHIMSY.sun },
	// Snout-count badge tucked on the bottom-right when a truffle is buried.
	badge: {
		position: "absolute",
		right: -8,
		bottom: -8,
		flexDirection: "row",
		alignItems: "center",
		gap: 2,
		paddingHorizontal: 5,
		paddingVertical: 1,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
	},
	badgeText: { fontFamily: FONTS.whimsy, fontSize: 11, color: INK },
});
