// Visual explainer for the Generous ◄──► Greedy alignment system.
// Pure "how it works" card — no mechanics to configure, alignment is
// an identity (label + schism + leaderboard), so the explainer leans
// almost entirely on the spectrum visual. The closing stakes line is
// season-aware: S0 builds toward Judgement Day titles; S1 has no
// reckoning, so the stakes are the blessing/curse effects themselves.
//
// Tone borrowed wholesale from AlignmentSchismModal: paper Sticker
// card on a dim backdrop, Caprasimo headline, PatrickHand body, the
// three AlignmentEmblem arts (horns / scales / halo).
//
// BETA DRAFT — opened from the "how it works" tap on the Account
// screen's alignment story block. Wire-up is intentionally light so
// it's easy to move once the copy + layout are signed off.
import React, { useEffect, useRef } from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Pressable,
	Animated,
	Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Sticker } from "./ui/Sticker";
import { AlignmentEmblem } from "./ui/AlignmentEmblem";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
	RADII,
} from "@/constants/theme";
import { useUnmanagedModalHold } from "./ui/PopupQueue";

interface Props {
	onDismiss: () => void;
	/** Season 1 drops the Judgement Day framing — no reckoning is coming. */
	s1?: boolean;
}

// The three zones, left → right along the spectrum. range copy mirrors
// the ±25 breakpoints in utils/alignment.ts.
const ZONES = [
	{ emblem: "horns" as const, name: "Greedy", range: "−25 & below", tint: WHIMSY.goblin },
	{ emblem: "scales" as const, name: "Pilgrim", range: "the middle", tint: WHIMSY.cream2 },
	{ emblem: "halo" as const, name: "Generous", range: "+25 & above", tint: WHIMSY.angel },
];

export function AlignmentExplainerModal({ onDismiss, s1 = false }: Props) {
	// Unmanaged native Modal (direct-tap from the season tab, mounted only while
	// open): hold the queue for the component's whole lifetime so a foreground
	// poll can't present a queued popup over it — the #50152 wedge (issue #4).
	useUnmanagedModalHold(true);
	const scale = useRef(new Animated.Value(0)).current;
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Haptics.selectionAsync().catch(() => {});
		Animated.parallel([
			Animated.spring(scale, {
				toValue: 1,
				tension: 60,
				friction: 7,
				useNativeDriver: true,
			}),
			Animated.timing(opacity, {
				toValue: 1,
				duration: 250,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
		]).start();
	}, [scale, opacity]);

	return (
		<Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
			<View style={styles.backdrop}>
				<Animated.View
					style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}
				>
					<Sticker
						color="paper"
						rotate={-1.2}
						radius={RADII.xxl}
						border={3}
						style={[styles.card, STICKER_SHADOW]}
					>
						<Text style={styles.kicker}>★ how alignment works ★</Text>
						<Text style={styles.headline}>Every pig has a nature</Text>
						<Text style={styles.sub}>
							The way you trade shapes who you are.
						</Text>

						{/* The centerpiece: the labelled spectrum. */}
						<View style={styles.zonesRow}>
							{ZONES.map((z) => (
								<View key={z.name} style={styles.zoneCol}>
									<AlignmentEmblem kind={z.emblem} size={48} />
									<Text style={styles.zoneName}>{z.name}</Text>
									<Text style={styles.zoneRange}>{z.range}</Text>
								</View>
							))}
						</View>
						<View style={styles.spectrum}>
							{ZONES.map((z, i) => (
								<View
									key={z.name}
									style={[
										styles.segment,
										{ backgroundColor: z.tint },
										i === 0 && styles.segmentLeft,
										i === ZONES.length - 1 && styles.segmentRight,
									]}
								/>
							))}
						</View>
						<View style={styles.tickRow}>
							<Text style={styles.tick}>−25</Text>
							<Text style={styles.tick}>+25</Text>
						</View>

						{/* What moves you along it. */}
						<View style={styles.movesBlock}>
							<View style={styles.moveRow}>
								<Text style={[styles.moveArrow, { color: WHIMSY.angel }]}>▲</Text>
								<Text style={styles.moveText}>
									Give freely & bless your friends
								</Text>
							</View>
							<View style={styles.moveRow}>
								<Text style={[styles.moveArrow, { color: WHIMSY.goblin }]}>▼</Text>
								<Text style={styles.moveText}>
									Ask for tickles & pocket the gains
								</Text>
							</View>
						</View>

						<Text style={styles.stakes}>
							{s1
								? "The farther you lean, the stronger your blessings and curses grow. Your nature is yours to feed."
								: "When Judgement Day comes, the most Generous and the most Greedy earn titles no one can claim again."}
						</Text>

						<Pressable
							testID="alignment-explainer-dismiss"
							onPress={onDismiss}
							style={({ pressed }) => [
								styles.btn,
								pressed && { opacity: 0.75 },
							]}
						>
							<Text style={styles.btnText}>Got it</Text>
						</Pressable>
					</Sticker>
				</Animated.View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 28,
	},
	cardWrap: { width: "100%", maxWidth: 380 },
	card: { paddingHorizontal: 24, paddingVertical: 28, alignItems: "center" },
	kicker: { ...KICKER_TEXT, marginBottom: 12, textAlign: "center" },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 25,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 4,
	},
	sub: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.mute,
		textAlign: "center",
		marginBottom: 20,
	},
	zonesRow: {
		flexDirection: "row",
		width: "100%",
		marginBottom: 10,
	},
	zoneCol: { flex: 1, alignItems: "center", gap: 3 },
	zoneName: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	zoneRange: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		color: WHIMSY.mute,
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	spectrum: {
		flexDirection: "row",
		width: "100%",
		height: 16,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
	},
	segment: { flex: 1 },
	segmentLeft: {
		borderRightWidth: 1.5,
		borderRightColor: WHIMSY.ink,
	},
	segmentRight: {
		borderLeftWidth: 1.5,
		borderLeftColor: WHIMSY.ink,
	},
	tickRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		width: "66%",
		marginTop: 6,
		marginBottom: 20,
	},
	tick: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
	},
	movesBlock: {
		width: "100%",
		gap: 8,
		marginBottom: 18,
	},
	moveRow: { flexDirection: "row", alignItems: "center", gap: 10 },
	moveArrow: { fontSize: 14 },
	moveText: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.ink,
		flex: 1,
	},
	stakes: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		lineHeight: 20,
		color: WHIMSY.mute,
		textAlign: "center",
		marginBottom: 22,
	},
	btn: {
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
	},
	btnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 17,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
});
