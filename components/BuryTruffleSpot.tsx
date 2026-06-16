// The "bury a truffle" affordance on your OWN barn — an unlabeled planted shovel
// by the pig's feet with a gentle attract pulse, mirroring the dig spot you tap
// when visiting another barn. Shown only when nothing is buried; tapping it opens
// the Bury dialogue. (Once a truffle is down, BuriedMound takes over this spot.)
// The control used to be an always-on inline band that was unreadable on busy
// backgrounds — now it's just this icon + a modal.
import { useEffect, useRef } from "react";
import { View, Pressable, Animated, Easing, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Shovel } from "./ui/Shovel";
import { Glyph } from "./ui/Glyph";
import { WHIMSY } from "@/constants/theme";

interface Props {
	visible: boolean;
	onPress: () => void;
}

export function BuryTruffleSpot({ visible, onPress }: Props) {
	const bob = useRef(new Animated.Value(0)).current;
	const pulse = useRef(new Animated.Value(0)).current;
	const wig = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!visible) return;
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
				Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
			])
		);
		const pulseLoop = Animated.loop(
			Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true })
		);
		loop.start();
		pulseLoop.start();
		return () => {
			loop.stop();
			pulseLoop.stop();
		};
	}, [visible, bob, pulse]);

	if (!visible) return null;

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

	const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
	const rotate = wig.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-22deg", "-10deg", "4deg"] });

	return (
		<Pressable onPress={press} hitSlop={20} style={styles.spot}>
			<Animated.View
				pointerEvents="none"
				style={[
					styles.pulse,
					{
						opacity: pulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.45, 0.12, 0] }),
						transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.7] }) }],
					},
				]}
			/>
			<Glyph name="sparkle" size={15} style={styles.sparkle} />
			<Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
				<Shovel size={44} />
			</Animated.View>
			<View style={styles.mound} />
		</Pressable>
	);
}

const INK = WHIMSY.ink;
const styles = StyleSheet.create({
	// In the open ground to the RIGHT of the pig (balances the bottom-left flag),
	// clear of the tab bar AND of Rosie's swipe/tickle area — a shovel placed over
	// the pig sprite gets its taps eaten by the SwipeElement gesture handler.
	spot: { position: "absolute", bottom: 32, left: "73%", alignItems: "center", zIndex: 5 },
	pulse: { position: "absolute", top: 4, width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: WHIMSY.sun },
	sparkle: { position: "absolute", top: -8, left: "62%", zIndex: 2 },
	mound: { width: 46, height: 13, borderRadius: 999, backgroundColor: "#8a5a36", borderWidth: 2, borderColor: INK, marginTop: -9 },
});
