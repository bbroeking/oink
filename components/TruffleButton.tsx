// The truffle control on your OWN barn — ONE always-visible shovel button pinned
// in the upper-left. Tap to bury a truffle (when nothing's down) or to manage /
// dig it back up (when one is buried, shown with a snout-count badge). Replaces
// the old bottom-corner shovel + the easy-to-miss dirt mound at the pig's feet.
import { useEffect, useRef } from "react";
import { View, Pressable, Animated, Easing, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Shovel } from "./ui/Shovel";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Label } from "./ui/Text";
import {
	WHIMSY,
	SHADOW_SM,
	RADII,
	BORDER,
	SPACE,
	PRESSED,
} from "@/constants/theme";
import {
	startDecorativeLoop,
	useMotionPolicy,
} from "@/hooks/useMotionPolicy";

interface Props {
	buried: boolean;
	remaining?: number; // snout-count badge when buried
	onPress: () => void;
	disabled?: boolean;
	accessibilityLabel?: string;
	accessibilityHint?: string;
}

// The two states this one control carries, spoken. A control that leads to a
// snout stake says so on its own face, and its hint names what opening it
// does — the C-03 quartet (role · label · hint · state). A caller that
// overrides the label (the visiting flow digs instead of burying) supplies its
// own hint, so the default one never contradicts a borrowed label.
const SPOKEN = {
	buried: {
		label: "Manage your buried truffle",
		hint: "Opens the buried-truffle sheet, where you can add snouts or dig it back up.",
	},
	empty: {
		label: "Bury a truffle",
		hint: "Opens the bury sheet, where you choose how many snouts to stake.",
	},
} as const;

export function TruffleButton({
	buried,
	remaining,
	onPress,
	disabled = false,
	accessibilityLabel,
	accessibilityHint,
}: Props) {
	const pulse = useRef(new Animated.Value(0)).current;
	const wig = useRef(new Animated.Value(0)).current;
	const motionPolicy = useMotionPolicy();

	// Gentle attract pulse only when there's nothing buried yet (invites a bury).
	useEffect(() => {
		if (buried) {
			pulse.setValue(0);
			return;
		}
		const loop = Animated.loop(
			Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true })
		);
		return startDecorativeLoop({
			policy: motionPolicy,
			animation: loop,
			rest: () => pulse.setValue(0),
		});
	}, [buried, motionPolicy, pulse]);

	const press = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		if (motionPolicy.reduceMotion) {
			onPress();
			return;
		}
		wig.setValue(0);
		Animated.sequence([
			Animated.timing(wig, { toValue: 1, duration: 80, useNativeDriver: true }),
			Animated.timing(wig, { toValue: -1, duration: 80, useNativeDriver: true }),
			Animated.spring(wig, { toValue: 0, friction: 4, tension: 140, useNativeDriver: true }),
		]).start();
		onPress();
	};

	const rotate = wig.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-13deg", "0deg", "11deg"] });
	const spoken = buried ? SPOKEN.buried : SPOKEN.empty;

	return (
		<Pressable
			onPress={press}
			disabled={disabled}
			hitSlop={SPACE.md}
			style={({ pressed }) => [styles.btn, pressed && !disabled && PRESSED]}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? spoken.label}
			accessibilityHint={
				accessibilityHint ?? (accessibilityLabel ? undefined : spoken.hint)
			}
			accessibilityValue={
				buried
					? {
							text: `${remaining ?? 0} ${
								(remaining ?? 0) === 1 ? "snout" : "snouts"
							} left`,
						}
					: undefined
			}
			accessibilityState={{ disabled }}
		>
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
					<SnoutCoin size={BADGE_COIN} />
					<Label>{remaining ?? 0}</Label>
				</View>
			)}
		</Pressable>
	);
}

const INK = WHIMSY.ink;
// Drawing geometry, not spacing: the shovel button's own square, the attract
// halo that rings it, the coin riding its badge, and how far the badge hangs
// off the corner. Named here so no style line carries a bare number.
const SIZE = 46;
const PULSE_SIZE = 54;
const BADGE_COIN = 11;
const BADGE_OVERHANG = -8;
const styles = StyleSheet.create({
	btn: {
		width: SIZE,
		height: SIZE,
		borderRadius: RADII.lg,
		backgroundColor: WHIMSY.cream,
		borderWidth: BORDER.ink,
		borderColor: INK,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	pulse: {
		position: "absolute",
		width: PULSE_SIZE,
		height: PULSE_SIZE,
		borderRadius: RADII.lg,
		borderWidth: BORDER.heavy,
		borderColor: WHIMSY.sun,
	},
	// Snout-count badge tucked on the bottom-right when a truffle is buried.
	badge: {
		position: "absolute",
		right: BADGE_OVERHANG,
		bottom: BADGE_OVERHANG,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xxs,
		paddingHorizontal: SPACE.xs,
		paddingVertical: 1,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.sun,
		borderWidth: BORDER.ink,
		borderColor: INK,
	},
});
