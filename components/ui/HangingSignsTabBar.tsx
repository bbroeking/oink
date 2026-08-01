// Custom React Navigation bottom tab bar — the design's "Option B
// Hanging Signs" treatment ported to React Native.
//
// Visual identity:
//   • Weathered wooden rail spans the full width (LinearGradient
//     wood plank + faint horizontal grain streaks).
//   • Each tab is a paper sign hanging from a short SVG chain
//     (two interlocked oval links) below the rail.
//   • Signs sway ±1.4° on a 5.5s sine loop with staggered phase
//     per tab — the row feels alive without ever feeling busy.
//   • Active tab gets:
//       - a per-tab color wash (rose / lilac / sun / peach / sage)
//       - a slower, smaller "breathe" rotation
//       - a soft golden halo behind the sign
//   • Tap → swing-in animation (over-rotate, settle) + chain tug
//     (squashy bounce) so the selection lands with weight.
//
// Drop-in for <Tabs tabBar={(p) => <HangingSignsTabBar {...p} />}>.

import React, { useEffect, useRef } from "react";
import {
	View,
	Text,
	Pressable,
	StyleSheet,
	Animated,
	Easing,
	Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Ellipse } from "react-native-svg";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Icon } from "./Icon";
import { WHIMSY, FONTS } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";

// Tab config keyed by the route name set in app/(tabs)/_layout.tsx.
// Owns the label + icon name + active color so the bar doesn't have
// to round-trip through React Navigation's descriptor options for
// what's effectively a stable 5-tuple.
const TAB_CONFIG: Record<
	string,
	{ label: string; icon: string; activeBg: string }
> = {
	index:    { label: "Barn",    icon: "tabBarn",    activeBg: WHIMSY.rose },
	friends:  { label: "Friends", icon: "tabFriends", activeBg: WHIMSY.lilac },
	season:   { label: "Season",  icon: "tabSeason",  activeBg: WHIMSY.sun },
	shop:     { label: "Shop",    icon: "tabShop",    activeBg: WHIMSY.peach },
	account:  { label: "Me",      icon: "tabMe",      activeBg: WHIMSY.sage },
};

// Wood-rail color stops. Pulled directly off the design's
// linear-gradient(180deg, #8d5a2c 0%, #74441e 100%).
const WOOD_TOP = "#8d5a2c";
const WOOD_BOT = "#74441e";
const WOOD_FRAME = "#8d5a2c"; // matches the sign's inner wood frame

const SWAY_DURATION_MS = 2750; // half-cycle; full loop = 5500ms
const BREATHE_DURATION_MS = 2100; // active tab's slower rhythm
const STAGGER_DELAYS_MS = [-300, -1600, -2700, -3900, -4700]; // matches CSS nth-child

interface TabBarExtras {
	// Optional per-route badge counts, keyed by the route name (same
	// keys as TAB_CONFIG). > 0 → red dot on the sign. Plumbed in from
	// app/(tabs)/_layout.tsx which polls the bounty_ready_count RPC.
	badges?: Record<string, number>;
}

export function HangingSignsTabBar({
	state,
	navigation,
	badges,
}: BottomTabBarProps & TabBarExtras) {
	const insets = useSafeAreaInsets();
	const { reduceMotion } = useMotionPolicy();
	return (
		<View>
			{/* Wood rail — top border + plank gradient + a faint
			    highlight strip and an underside shadow band so the
			    plank reads as 3D without a real shadow render. */}
			<LinearGradient
				colors={[WOOD_TOP, WOOD_BOT]}
				start={{ x: 0, y: 0 }}
				end={{ x: 0, y: 1 }}
				style={[
					styles.rail,
					{ paddingBottom: 14 + Math.max(insets.bottom, 0) },
				]}
			>
				{/* Thin top highlight — emulates the design's
				    rgba(255,255,255,0.22) → transparent strip. */}
				<View style={styles.railHighlight} />
				{/* Underside shadow band — sits under the row of signs. */}
				<View style={styles.railShadowBand} />

				{state.routes.map((route, i) => {
					const cfg = TAB_CONFIG[route.name];
					if (!cfg) return null;
					const focused = state.index === i;
					return (
						<HangingSign
							key={route.key}
							label={cfg.label}
							iconName={cfg.icon}
							activeBg={cfg.activeBg}
							focused={focused}
							swayDelay={STAGGER_DELAYS_MS[i] ?? 0}
							badge={badges?.[route.name] ?? 0}
							reduceMotion={reduceMotion}
							onPress={() => {
								const event = navigation.emit({
									type: "tabPress",
									target: route.key,
									canPreventDefault: true,
								});
								if (!focused && !event.defaultPrevented) {
									navigation.navigate(route.name, route.params);
								}
							}}
						/>
					);
				})}
			</LinearGradient>
		</View>
	);
}

// One hanging sign — owns its own sway loop + on-tap swing-in
// + chain tug. Pulled out so the per-tab Animated values stay
// scoped and the loops don't fight each other.
function HangingSign({
	label,
	iconName,
	activeBg,
	focused,
	swayDelay,
	badge,
	reduceMotion,
	onPress,
}: {
	label: string;
	iconName: string;
	activeBg: string;
	focused: boolean;
	swayDelay: number;
	badge: number;
	reduceMotion: boolean;
	onPress: () => void;
}) {
	// Continuous sway value, 0..1, mapped to -1.4° → 1.4° (or
	// -0.8° → 0.8° while focused via the breathe rhythm).
	const sway = useRef(new Animated.Value(0.5)).current;
	// One-shot swing-in fired on tap. 0 = at rest; 1 = the over-
	// rotated start of the swing-in arc.
	const swing = useRef(new Animated.Value(0)).current;
	// Chain tug — vertical squash + slight stretch on tap.
	const tug = useRef(new Animated.Value(0)).current;

	// Sway loop. Restarts when focus flips so the focused tab can
	// breathe slower; idle tabs sway on the longer rhythm.
	useEffect(() => {
		if (reduceMotion) {
			sway.stopAnimation();
			sway.setValue(0.5);
			return;
		}
		const half = focused ? BREATHE_DURATION_MS : SWAY_DURATION_MS;
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(sway, {
					toValue: 1,
					duration: half,
					easing: Easing.inOut(Easing.sin),
					useNativeDriver: true,
				}),
				Animated.timing(sway, {
					toValue: 0,
					duration: half,
					easing: Easing.inOut(Easing.sin),
					useNativeDriver: true,
				}),
			])
		);
		// Stagger the start so neighbouring signs aren't in phase.
		const delay = Math.max(0, -swayDelay);
		const t = setTimeout(() => loop.start(), delay);
		return () => {
			clearTimeout(t);
			loop.stop();
		};
	}, [focused, reduceMotion, sway, swayDelay]);

	const handlePress = () => {
		if (reduceMotion) {
			swing.stopAnimation();
			tug.stopAnimation();
			swing.setValue(1);
			tug.setValue(0);
			onPress();
			return;
		}
		// Sign swing-in: -10° → 6° → -3° → 1° → 0°, ~620ms total.
		// Modeled via a single Animated.Value 0..4 → 5 keyframe stops.
		swing.setValue(0);
		Animated.timing(swing, {
			toValue: 1,
			duration: 620,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
		// Chain tug: brief squash then settle. Runs in parallel.
		tug.setValue(0);
		Animated.sequence([
			Animated.timing(tug, {
				toValue: 1,
				duration: 220,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}),
			Animated.timing(tug, {
				toValue: 0,
				duration: 260,
				easing: Easing.in(Easing.cubic),
				useNativeDriver: true,
			}),
		]).start();
		onPress();
	};

	// Sway maps to the focused vs idle amplitude.
	const swayDeg = focused ? 0.8 : 1.4;
	const swayRotate = sway.interpolate({
		inputRange: [0, 1],
		outputRange: [`-${swayDeg}deg`, `${swayDeg}deg`],
	});
	// Multi-stop swing-in: rotate(-10 → 6 → -3 → 1 → 0).
	const swingRotate = swing.interpolate({
		inputRange: [0, 0.35, 0.6, 0.85, 1],
		outputRange: ["-10deg", "6deg", "-3deg", "1deg", "0deg"],
	});
	// Chain tug: scaleY squash + tiny translateY drop.
	const chainScaleY = tug.interpolate({
		inputRange: [0, 0.4, 1],
		outputRange: [1, 1.18, 1],
	});
	const chainTranslateY = tug.interpolate({
		inputRange: [0, 0.4, 1],
		outputRange: [0, 3, 0],
	});

	return (
		<Pressable
			onPress={handlePress}
			style={styles.col}
			accessibilityRole="tab"
			accessibilityLabel={
				badge > 0
					? `${label}, ${badge} ${badge === 1 ? "item" : "items"} ready`
					: label
			}
			accessibilityState={{ selected: focused }}
		>
			{/* Chain — two interlocked SVG ovals + a small top link
			    that anchors to the rail. */}
			<Animated.View
				style={[
					styles.chainWrap,
					{
						transform: [
							{ translateY: chainTranslateY },
							{ scaleY: chainScaleY },
						],
					},
				]}
			>
				<Svg width={14} height={22} viewBox="0 0 14 22">
					<Ellipse
						cx={7}
						cy={3}
						rx={3}
						ry={2.5}
						fill="none"
						stroke={WHIMSY.ink}
						strokeWidth={1.5}
					/>
					<Ellipse
						cx={7}
						cy={9.5}
						rx={3.5}
						ry={3.5}
						fill="none"
						stroke="#3a3026"
						strokeWidth={1.7}
					/>
					<Ellipse
						cx={7}
						cy={16}
						rx={3.5}
						ry={3.5}
						fill="none"
						stroke="#3a3026"
						strokeWidth={1.7}
					/>
				</Svg>
			</Animated.View>

			{/* Sign wrapper — owns both the ambient sway and the
			    on-tap swing-in. Driving rotation via two stacked
			    Animated transforms means each animation can run
			    independently without re-interpolating. */}
			<Animated.View
				style={[
					styles.signWrap,
					{
						transform: [
							{ rotate: swingRotate },
							{ rotate: swayRotate },
						],
					},
				]}
			>
				{/* Golden halo behind the active sign — soft glow via
				    a translucent yellow oval beneath the sign card. */}
				{focused && <View style={[styles.halo, { backgroundColor: "rgba(255,216,122,0.55)" }]} />}

				{/* Outer = wood frame (brown ring). The inner padded
				    View carries the active color so the wood ring
				    stays a constant brown around any tab state. */}
				<View
					style={[styles.sign, { opacity: focused ? 1 : 0.96 }]}
				>
					<View
						style={[
							styles.signInner,
							{ backgroundColor: focused ? activeBg : WHIMSY.paper },
						]}
					>
						{/* Nail studs at top corners — 4px dark brass
						    dots so the sign reads as nailed up. */}
						<View style={[styles.nail, { left: 4 }]} />
						<View style={[styles.nail, { right: 4 }]} />
						{/* Red badge dot — top-right. Number-bearing for
						    counts > 1; bare dot when count = 1 (keeps the
						    sign uncluttered at the common ready-only-one
						    case). */}
						{badge > 0 && (
							<View style={styles.badge}>
								{badge > 1 && (
									<Text style={styles.badgeText}>
										{badge > 9 ? "9+" : String(badge)}
									</Text>
								)}
							</View>
						)}
						<Icon
							name={iconName as React.ComponentProps<typeof Icon>["name"]}
							size={22}
							color={WHIMSY.ink}
							filled={focused}
							strokeWidth={2}
						/>
						<Text style={styles.lbl}>{label}</Text>
					</View>
				</View>
			</Animated.View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	rail: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-around",
		paddingHorizontal: 4,
		paddingTop: 4,
		borderTopWidth: 3,
		borderTopColor: WHIMSY.ink,
		position: "relative",
		// Slight elevation so the rail reads above the screen's
		// content area on Android. iOS gets it via shadow* props.
		...Platform.select({
			ios: {
				shadowColor: WHIMSY.ink,
				shadowOffset: { width: 0, height: -2 },
				shadowOpacity: 0.18,
				shadowRadius: 0,
			},
			android: {
				elevation: 8,
			},
		}),
	},
	// Top edge highlight strip — soft white line right below the
	// ink border. Picks the LinearGradient's top-of-plank read.
	railHighlight: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 2,
		backgroundColor: "rgba(255,255,255,0.22)",
	},
	// Faint shadow band where the signs hang from — keeps the rail
	// from feeling flat. Just under the row of signs.
	railShadowBand: {
		position: "absolute",
		top: 18,
		left: 0,
		right: 0,
		height: 10,
		backgroundColor: "rgba(0,0,0,0.10)",
	},
	col: {
		flex: 1,
		maxWidth: 80,
		alignItems: "center",
		paddingTop: 4,
	},
	chainWrap: {
		width: 14,
		height: 22,
		marginBottom: 1,
	},
	signWrap: {
		position: "relative",
	},
	halo: {
		position: "absolute",
		top: -10,
		left: -10,
		right: -10,
		bottom: -10,
		borderRadius: 18,
	},
	sign: {
		width: 64,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 4,
		// Hard ink drop shadow — same pattern as the other stickers.
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 3 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 3,
		// Wood-frame ring around the paper face — drawn as a 2px
		// brown border on the inner view (see signInner).
		backgroundColor: WOOD_FRAME,
		padding: 2,
	},
	signInner: {
		alignItems: "center",
		paddingVertical: 6,
		paddingHorizontal: 4,
		position: "relative",
	},
	nail: {
		position: "absolute",
		top: 3,
		width: 4,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#7a5223",
		borderWidth: 0.75,
		borderColor: WHIMSY.ink,
	},
	lbl: {
		fontFamily: FONTS.bodyExtra,
		fontWeight: "900",
		fontSize: 11,
		color: WHIMSY.ink,
		marginTop: 3,
		letterSpacing: 0.3,
	},
	// Red badge dot — hangs off the upper-right of the signInner.
	// Constant minimum size so the bare-dot (count=1) and the
	// number-bearing (count>1) variants both read at a glance.
	badge: {
		position: "absolute",
		top: -4,
		right: -4,
			minWidth: 18,
			height: 18,
		paddingHorizontal: 3,
			borderRadius: 9,
		backgroundColor: WHIMSY.accent,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	badgeText: {
		fontFamily: FONTS.bodyExtra,
			fontSize: 11,
		fontWeight: "900",
		color: WHIMSY.paper,
		letterSpacing: 0,
	},
});
