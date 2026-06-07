// The buried-truffle mound that sits by the pig's feet on the Barn home screen
// when you have an active truffle. Persistent (a glowing dirt mound + a peeking
// truffle), tappable to "check on" it, and exposes playBury() — a juicy little
// dig animation (mound pops in, dirt bursts, a shovel flicks, snout-coins fly).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View, Text, Pressable, Animated, Easing, StyleSheet } from "react-native";
import { Shovel } from "./ui/Shovel";
import { SnoutCoin } from "./ui/SnoutCoin";
import { glyphSource } from "./ui/Glyph";
import { WHIMSY, FONTS } from "@/constants/theme";

export interface BuriedMoundHandle {
	playBury: () => void;
}

interface Props {
	visible: boolean;
	onPress: () => void;
}

interface Particle {
	id: number;
	anim: Animated.Value;
	dx: number;
	rise: number;
	coin: boolean;
}

export const BuriedMound = forwardRef<BuriedMoundHandle, Props>(function BuriedMound(
	{ visible, onPress },
	ref
) {
	// Mound presence: 1 when shown. playBury() pops it 0 → 1.
	const pop = useRef(new Animated.Value(visible ? 1 : 0)).current;
	const glow = useRef(new Animated.Value(0)).current;
	const shovel = useRef(new Animated.Value(0)).current; // dig flick + fade
	const [parts, setParts] = useState<Particle[]>([]);
	const nextId = useRef(0);
	const [digging, setDigging] = useState(false);

	useEffect(() => {
		Animated.timing(pop, {
			toValue: visible ? 1 : 0,
			duration: visible ? 260 : 160,
			easing: Easing.out(Easing.back(2)),
			useNativeDriver: true,
		}).start();
	}, [visible, pop]);

	// Gentle ✦ glow pulse while a truffle is buried.
	useEffect(() => {
		if (!visible) return;
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
				Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [visible, glow]);

	useImperativeHandle(ref, () => ({
		playBury() {
			setDigging(true);
			// Mound pops in from nothing.
			pop.setValue(0);
			Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
			// Shovel flick (dig down, lift, fade).
			shovel.setValue(0);
			Animated.timing(shovel, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(
				() => setDigging(false)
			);
			// Dirt + snout-coin burst.
			const burst: Particle[] = [];
			for (let i = 0; i < 9; i++) {
				const id = nextId.current++;
				const anim = new Animated.Value(0);
				const coin = i % 3 === 0; // a few snouts among the dirt
				burst.push({ id, anim, dx: Math.random() * 90 - 45, rise: 46 + Math.random() * 34, coin });
				Animated.timing(anim, {
					toValue: 1,
					duration: 760 + Math.random() * 260,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				}).start(() => setParts((p) => p.filter((x) => x.id !== id)));
			}
			setParts((p) => [...p, ...burst]);
		},
	}));

	if (!visible && parts.length === 0) return null;

	return (
		<View pointerEvents="box-none" style={styles.anchor}>
			{/* burst particles (dirt clods + snout coins) */}
			{parts.map((p) => (
				<Animated.View
					key={p.id}
					pointerEvents="none"
					style={[
						styles.particle,
						{
							opacity: p.anim.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
							transform: [
								{ translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
								{
									translateY: p.anim.interpolate({
										inputRange: [0, 0.4, 1],
										outputRange: [0, -p.rise, 6],
									}),
								},
								{ scale: p.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1, 0.85] }) },
								{ rotate: p.anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", p.dx > 0 ? "90deg" : "-90deg"] }) },
							],
						},
					]}
				>
					{p.coin ? <SnoutCoin size={16} /> : <View style={styles.dirtClod} />}
				</Animated.View>
			))}

			{/* the shovel that does the digging during playBury */}
			{digging && (
				<Animated.View
					pointerEvents="none"
					style={[
						styles.shovel,
						{
							opacity: shovel.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
							transform: [
								{ translateY: shovel.interpolate({ inputRange: [0, 0.45, 1], outputRange: [-6, 8, -4] }) },
								{ rotate: shovel.interpolate({ inputRange: [0, 0.45, 1], outputRange: ["-18deg", "6deg", "-14deg"] }) },
							],
						},
					]}
				>
					<Shovel size={46} />
				</Animated.View>
			)}

			{/* the persistent mound — tap to check on it */}
			<Pressable onPress={onPress} hitSlop={14}>
				<Animated.View style={{ transform: [{ scale: pop }], opacity: pop }}>
					<Animated.Image
						source={glyphSource("sparkle")}
						resizeMode="contain"
						style={[
							styles.sparkle,
							{
								opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
								transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
							},
						]}
					/>
					<View style={styles.mound}>
						<View style={styles.truffleNub} />
					</View>
				</Animated.View>
			</Pressable>
		</View>
	);
});

const INK = WHIMSY.ink;
const styles = StyleSheet.create({
	// Anchored near the pig's feet, a touch right of center.
	anchor: { position: "absolute", bottom: 2, left: "54%", alignItems: "center" },
	mound: {
		width: 60,
		height: 26,
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
		backgroundColor: "#8a5a36",
		borderWidth: 2,
		borderColor: INK,
		alignItems: "center",
		justifyContent: "flex-start",
		overflow: "hidden",
	},
	truffleNub: {
		marginTop: 4,
		width: 18,
		height: 13,
		borderRadius: 9,
		backgroundColor: "#4a3326",
		borderWidth: 1.5,
		borderColor: INK,
	},
	sparkle: { position: "absolute", top: -18, left: "50%", marginLeft: -8, width: 16, height: 16, zIndex: 2 },
	shovel: { position: "absolute", bottom: 18, left: -6, zIndex: 3 },
	particle: { position: "absolute", bottom: 14, left: 22, zIndex: 4 },
	dirtClod: { width: 9, height: 9, borderRadius: 3, backgroundColor: "#6f4626", borderWidth: 1, borderColor: INK },
});
