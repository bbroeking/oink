// Bottom-sheet recap of every blessing + curse currently on the
// caller. Opens from the BarnActiveEffectsStrip chip tap — the
// chip is a glance, this is the read.
//
// Layout mirrors the design's ActiveEffectsSheet (screens/barn.jsx
// in the handoff bundle): kicker + display title, BLESSINGS / CURSES
// sections separated by a per-curse inline Cleanse pill, and a
// hand-script footer about blessings clearing curses.
//
// Animation uses the same decoupled-backdrop+slide pattern as
// UserSheet — backdrop fades 0→1 while the sheet translates from
// off-screen → resting at the bottom, so the dim doesn't drag with
// the card.

import React, { useEffect, useRef, useState } from "react";
import {
	Modal,
	View,
	Text,
	Image,
	Pressable,
	StyleSheet,
	Animated,
	Easing,
	Dimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import { SnoutCoin } from "./ui/SnoutCoin";
import {
	BLESSING_META,
	CURSE_META,
	type BlessingKind,
	type CurseKind,
} from "../utils/rituals";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

interface Effect {
	source: "blessing" | "curse";
	kind: string;
	expires_at: string;
	sender_id: string | null;
	sender_username: string | null;
}

interface Props {
	open: boolean;
	onClose: () => void;
}

// "5m" / "2h 14m" / "expiring" — same shape the chip uses, scoped
// here so the sheet stays self-contained.
function shortLeft(iso: string): string {
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return "expiring";
	const mins = Math.round(ms / 60000);
	if (mins < 60) return `${mins}m`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m ? `${h}h ${m}m` : `${h}h`;
}

export function HoofprintsSheet({ open, onClose }: Props) {
	const [effects, setEffects] = useState<Effect[]>([]);
	const [busy, setBusy] = useState(false);

	// Sheet animation. Same pattern as the UserSheet fix: one
	// Animated.Value drives backdrop opacity AND sheet translateY
	// in lockstep, so the dim doesn't slide with the card.
	const screenH = useRef(Dimensions.get("window").height).current;
	const sheetAnim = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		if (!open) return;
		sheetAnim.setValue(0);
		Animated.timing(sheetAnim, {
			toValue: 1,
			duration: 320,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
	}, [open, sheetAnim]);

	// Re-pull the effects list whenever the sheet opens so the
	// recap is always current (not a stale snapshot from when the
	// strip last loaded).
	useEffect(() => {
		if (!open) return;
		supabase.rpc("my_active_effects").then(({ data }) => {
			const rows = (data as Effect[] | null) ?? [];
			rows.sort((a, b) => (a.source < b.source ? -1 : 1));
			setEffects(rows);
		});
	}, [open]);

	const cleanse = async () => {
		if (busy) return;
		setBusy(true);
		const { data } = await supabase.rpc("cleanse_curses");
		setBusy(false);
		const r = data as { ok?: boolean } | null;
		if (r?.ok) {
			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success
			).catch(() => {});
			// Optimistic local update: drop curse rows immediately so
			// the sheet reflects the cleanse before the realtime
			// channel re-pushes my_active_effects.
			setEffects((prev) => prev.filter((e) => e.source !== "curse"));
		}
	};

	if (!open) return null;

	const blessings = effects.filter((e) => e.source === "blessing");
	const curses = effects.filter((e) => e.source === "curse");
	const backdropOpacity = sheetAnim;
	const sheetTranslateY = sheetAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [screenH, 0],
	});

	return (
		<Modal visible transparent animationType="none" onRequestClose={onClose}>
			<Animated.View
				style={[styles.backdrop, { opacity: backdropOpacity }]}
			>
				<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
			</Animated.View>
			<Animated.View
				pointerEvents="box-none"
				style={[
					styles.sheetWrap,
					{ transform: [{ translateY: sheetTranslateY }] },
				]}
			>
				<Pressable onPress={() => {}}>
					<Sticker
						color="paper"
						rotate={-0.6}
						radius={22}
						style={[styles.sheet, STICKER_SHADOW]}
					>
						<View style={styles.grabber} />
						<Text style={styles.kicker}>★ left by the sounder</Text>
						<Text style={styles.title}>Hoofprints on you</Text>

						{effects.length === 0 && (
							<Text style={styles.emptyText}>
								Nothing on your snout right now.
							</Text>
						)}

						{blessings.length > 0 && (
							<>
								<Text style={[styles.sectionLabel, styles.sectionBless]}>
									BLESSINGS · +{blessings.length}
								</Text>
								<View style={{ gap: 8 }}>
									{blessings.map((e, i) => (
										<EffectCard key={`b-${i}`} effect={e} />
									))}
								</View>
							</>
						)}

						{curses.length > 0 && (
							<>
								<View style={styles.cursesHeaderRow}>
									<Text style={[styles.sectionLabel, styles.sectionCurse]}>
										CURSES · −{curses.length}
									</Text>
									<Pressable
										onPress={cleanse}
										disabled={busy}
										style={({ pressed }) => [
											styles.cleansePill,
											(pressed || busy) && { opacity: 0.7 },
										]}
									>
										<SnoutCoin size={13} />
										<Text style={styles.cleansePillText}>
											{busy ? "…" : "Cleanse · 5"}
										</Text>
									</Pressable>
								</View>
								<View style={{ gap: 8 }}>
									{curses.map((e, i) => (
										<EffectCard key={`c-${i}`} effect={e} />
									))}
								</View>
							</>
						)}

						<Text style={styles.footer}>
							★ a blessing received clears all active curses ★
						</Text>
					</Sticker>
				</Pressable>
			</Animated.View>
		</Modal>
	);
}

// One detail card. Blessing = lilac tint + paper icon well; curse =
// cream tint + ink icon well. Matches the design's EffectDetail
// shape from screens/barn.jsx.
function EffectCard({ effect }: { effect: Effect }) {
	const blessed = effect.source === "blessing";
	const meta = blessed
		? BLESSING_META[effect.kind as BlessingKind]
		: CURSE_META[effect.kind as CurseKind];
	const senderName =
		effect.sender_username ?? (blessed ? "a friend" : "someone");
	return (
		<Sticker
			color={blessed ? "lilac" : "cream"}
			rotate={0}
			radius={12}
			style={styles.card}
		>
			<View style={styles.cardRow}>
				<View
					style={[
						styles.iconWell,
						blessed ? styles.iconWellBless : styles.iconWellCurse,
					]}
				>
					{meta && (
						<Image
							source={meta.icon}
							style={styles.icon}
							resizeMode="contain"
						/>
					)}
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.cardName} numberOfLines={1}>
						{meta?.name ?? effect.kind}
					</Text>
					{meta?.blurb && (
						<Text style={styles.cardBlurb} numberOfLines={2}>
							{meta.blurb}
						</Text>
					)}
					<Text style={styles.cardFrom} numberOfLines={1}>
						from <Text style={styles.cardFromBold}>{senderName}</Text> ·{" "}
						{shortLeft(effect.expires_at)} left
					</Text>
				</View>
			</View>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: MODAL_BACKDROP_BG,
	},
	sheetWrap: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		padding: 14,
		paddingBottom: 28,
	},
	sheet: {
		padding: 18,
		paddingTop: 10,
	},
	grabber: {
		alignSelf: "center",
		width: 44,
		height: 4,
		borderRadius: 2,
		backgroundColor: WHIMSY.muteSoft,
		marginBottom: 12,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 4,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
		marginBottom: 16,
	},
	sectionLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 1.6,
		textTransform: "uppercase",
		marginBottom: 8,
	},
	sectionBless: {
		color: WHIMSY.lilacDeep,
	},
	sectionCurse: {
		color: WHIMSY.accent,
	},
	cursesHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: 16,
		marginBottom: 8,
	},
	cleansePill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	cleansePillText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.ink,
	},
	card: {
		padding: 12,
	},
	cardRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	iconWell: {
		width: 48,
		height: 48,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 1.5, height: 1.5 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	iconWellBless: {
		backgroundColor: WHIMSY.paper,
	},
	iconWellCurse: {
		backgroundColor: WHIMSY.ink,
	},
	icon: {
		width: 38,
		height: 38,
	},
	cardName: {
		fontFamily: FONTS.whimsy,
		fontSize: 17,
		color: WHIMSY.ink,
	},
	cardBlurb: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	cardFrom: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		marginTop: 6,
	},
	cardFromBold: {
		color: WHIMSY.ink,
		fontFamily: FONTS.bodyBlack,
	},
	emptyText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		paddingVertical: 18,
	},
	footer: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 18,
	},
});
