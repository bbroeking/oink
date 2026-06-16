// "War Spoils" — a rewards-display sheet for Mud Wars: the 25 war-exclusive
// cosmetics you can win, grouped by rarity, with owned items lit + a ✓ and
// unearned ones dimmed. Win a mud war (resolve_war → grant_war_spoils trigger,
// 20260660) to earn a random unowned one. Catalog comes from the hats table
// (keyed by WAR_SPOILS_IDS so it works whether or not the war_exclusive column
// is deployed); owned state from user_hats.
import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, Modal, Animated, Easing, StyleSheet, ScrollView, Dimensions } from "react-native";
import { supabase } from "@/utils/supabase";
import { HAT_IMAGES, RARITY_COLORS, type Rarity } from "@/constants/hats";
import { WAR_SPOILS_IDS } from "@/constants/mudFights";
import { WHIMSY, FONTS, SHADOW_SM } from "@/constants/theme";

interface SpoilRow {
	id: string;
	name: string;
	rarity: Rarity;
	owned: boolean;
}

const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

interface Props {
	open: boolean;
	onClose: () => void;
}

export function WarSpoilsSheet({ open, onClose }: Props) {
	const screenH = useRef(Dimensions.get("window").height).current;
	const anim = useRef(new Animated.Value(0)).current;
	const [rows, setRows] = useState<SpoilRow[] | null>(null);

	useEffect(() => {
		if (!open) return;
		anim.setValue(0);
		Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

		let cancelled = false;
		(async () => {
			const ids = WAR_SPOILS_IDS as unknown as string[];
			const { data: auth } = await supabase.auth.getUser();
			const uid = auth.user?.id;
			const [catRes, ownedRes] = await Promise.all([
				supabase.from("hats").select("id, name, rarity").in("id", ids),
				uid ? supabase.from("user_hats").select("hat_id").eq("user_id", uid) : Promise.resolve({ data: [] as { hat_id: string }[] }),
			]);
			if (cancelled) return;
			const ownedSet = new Set((ownedRes.data ?? []).map((r) => r.hat_id));
			const cat = (catRes.data ?? []) as { id: string; name: string; rarity: Rarity }[];
			const ordered = cat
				.map((c) => ({ id: c.id, name: c.name, rarity: c.rarity, owned: ownedSet.has(c.id) }))
				.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
			setRows(ordered);
		})();
		return () => {
			cancelled = true;
		};
	}, [open, anim]);

	if (!open) return null;

	const ownedCount = rows ? rows.filter((r) => r.owned).length : 0;
	const total = rows ? rows.length : WAR_SPOILS_IDS.length;
	const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [screenH, 0] });

	return (
		<Modal visible transparent animationType="none" onRequestClose={onClose}>
			<Animated.View style={[styles.backdrop, { opacity: anim }]}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
			</Animated.View>
			<Animated.View pointerEvents="box-none" style={[styles.sheetWrap, { transform: [{ translateY }] }]}>
				<View style={styles.sheet}>
					<View style={styles.grabber} />
					<Text style={styles.kicker}>WAR SPOILS</Text>
					<Text style={styles.title}>What you can win</Text>
					<Text style={styles.sub}>
						Win a mud war and a contributing crew-mate earns a random war-exclusive cosmetic.
						{"  "}
						<Text style={styles.count}>{ownedCount}/{total} earned</Text>
					</Text>

					<ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
						{rows === null ? (
							<Text style={styles.loading}>Loading rewards…</Text>
						) : (
							rows.map((r) => {
								const color = RARITY_COLORS[r.rarity] ?? WHIMSY.muteSoft;
								const img = HAT_IMAGES[r.id];
								return (
									<View key={r.id} style={[styles.tile, { borderColor: color }, !r.owned && styles.tileLocked]}>
										<View style={[styles.thumbWrap, { backgroundColor: color + "22" }]}>
											{img ? (
												<Image source={img} style={[styles.thumb, !r.owned && styles.thumbLocked]} resizeMode="contain" />
											) : null}
											{r.owned ? (
												<View style={[styles.check, { backgroundColor: color }]}>
													<Text style={styles.checkMark}>✓</Text>
												</View>
											) : (
												<Text style={styles.lock}>🔒</Text>
											)}
										</View>
										<Text style={styles.name} numberOfLines={1}>{r.name}</Text>
										<Text style={[styles.rarity, { color }]}>{r.rarity}</Text>
									</View>
								);
							})
						)}
					</ScrollView>

					<Pressable onPress={onClose} style={styles.doneBtn}>
						<Text style={styles.doneText}>Done</Text>
					</Pressable>
				</View>
			</Animated.View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const SCREEN_H = Dimensions.get("window").height;
const GAP = 10;
const styles = StyleSheet.create({
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,16,28,0.5)" },
	sheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 28 },
	sheet: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 22,
		padding: 18,
		paddingTop: 10,
		maxHeight: SCREEN_H * 0.85,
		...SHADOW_SM,
	},
	grabber: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: WHIMSY.muteSoft, marginBottom: 12 },
	kicker: { fontFamily: FONTS.hand, fontSize: 13, letterSpacing: 1.2, color: WHIMSY.accent, marginBottom: 2 },
	title: { fontFamily: FONTS.whimsy, fontSize: 24, color: INK },
	sub: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute, marginTop: 6, marginBottom: 12 },
	count: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: INK },

	scroll: { flexGrow: 0 },
	grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, justifyContent: "space-between" },
	loading: { fontFamily: FONTS.hand, fontSize: 15, color: WHIMSY.mute, padding: 20 },

	tile: {
		width: "31%",
		borderWidth: 2,
		borderRadius: 14,
		paddingBottom: 6,
		backgroundColor: WHIMSY.cream,
		overflow: "hidden",
	},
	tileLocked: { borderColor: WHIMSY.muteSoft },
	thumbWrap: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
	thumb: { width: "78%", height: "78%" },
	thumbLocked: { opacity: 0.32 },
	check: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: INK, alignItems: "center", justifyContent: "center" },
	checkMark: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: INK },
	lock: { position: "absolute", top: 4, right: 5, fontSize: 13, opacity: 0.6 },
	name: { fontFamily: FONTS.bodyExtra, fontSize: 11, color: INK, textAlign: "center", marginTop: 4, paddingHorizontal: 3 },
	rarity: { fontFamily: FONTS.hand, fontSize: 11, textAlign: "center", textTransform: "capitalize" },

	doneBtn: {
		marginTop: 14,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: "center",
		...SHADOW_SM,
	},
	doneText: { fontFamily: FONTS.whimsy, fontSize: 16, color: INK },
});
