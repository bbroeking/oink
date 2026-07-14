// TruffleCatalogSheet — a catalog of the 25 exchange-exclusive cosmetics,
// grouped by rarity, with owned items lit + a check and unearned ones dimmed.
// Earn them by digging Golden Truffles at the feedings and trading at the
// Truffle Exchange. Catalog comes from the hats table (keyed by
// EXCHANGE_ITEM_IDS); owned state from user_hats.
import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, Modal, Animated, Easing, StyleSheet, ScrollView, Dimensions } from "react-native";
import { supabase } from "@/utils/supabase";
import { Icon } from "@/components/ui/Icon";
import { HAT_IMAGES, RARITY_COLORS, type Rarity } from "@/constants/hats";
import { EXCHANGE_ITEM_IDS } from "@/constants/dig";
import { LoadingBeat } from "@/components/ui/EmptyState";
import { WHIMSY, FONTS, SHADOW_SM, MODAL_BACKDROP_BG, RADII, SPACE, TYPE, PAGE_PAD, RARITY_BG_SOLID } from "@/constants/theme";

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

export function TruffleCatalogSheet({ open, onClose }: Props) {
	const screenH = useRef(Dimensions.get("window").height).current;
	const anim = useRef(new Animated.Value(0)).current;
	const [rows, setRows] = useState<SpoilRow[] | null>(null);

	useEffect(() => {
		if (!open) return;
		anim.setValue(0);
		Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

		let cancelled = false;
		(async () => {
			const ids: string[] = [...EXCHANGE_ITEM_IDS];
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
	const total = rows ? rows.length : EXCHANGE_ITEM_IDS.length;
	const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [screenH, 0] });

	return (
		<Modal visible transparent animationType="none" onRequestClose={onClose}>
			<Animated.View style={[styles.backdrop, { opacity: anim }]}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
			</Animated.View>
			<Animated.View pointerEvents="box-none" style={[styles.sheetWrap, { transform: [{ translateY }] }]}>
				<View style={styles.sheet}>
					<View style={styles.grabber} />
					<Text style={styles.kicker}>EXCLUSIVES</Text>
					<Text style={styles.title}>What you can earn</Text>
					<Text style={styles.sub}>
						Dig at the feedings for Golden Truffles, then trade them for these exclusives at the Exchange.
						{"  "}
						<Text style={styles.count}>{ownedCount}/{total} earned</Text>
					</Text>

					<ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
						{rows === null ? (
							<LoadingBeat label="fetching the trophy case" glyph="sparkle" />
						) : (
							rows.map((r) => {
								const color = RARITY_COLORS[r.rarity] ?? WHIMSY.muteSoft;
								const fill = RARITY_BG_SOLID[r.rarity] ?? WHIMSY.cream;
								const img = HAT_IMAGES[r.id];
								return (
									<View key={r.id} style={[styles.tile, { borderColor: color }, !r.owned && styles.tileLocked]}>
										<View style={[styles.thumbWrap, { backgroundColor: fill }]}>
											{img ? (
												<Image source={img} style={[styles.thumb, !r.owned && styles.thumbLocked]} resizeMode="contain" />
											) : null}
											{r.owned ? (
												<View style={[styles.check, { backgroundColor: color }]}>
													<Icon name="check" size={13} color={INK} strokeWidth={2.4} />
												</View>
											) : (
												<View style={styles.lock}>
													<Icon name="lock" size={14} color={WHIMSY.mute} strokeWidth={1.8} />
												</View>
											)}
										</View>
										<Text style={styles.name} numberOfLines={1}>{r.name}</Text>
										<Text style={[styles.rarity, { color }]}>{r.rarity}</Text>
									</View>
								);
							})
						)}
					</ScrollView>

					<Pressable
						onPress={onClose}
						style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
					>
						<Text style={styles.doneText}>Done</Text>
					</Pressable>
				</View>
			</Animated.View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const SCREEN_H = Dimensions.get("window").height;
const GAP = SPACE.md;
const styles = StyleSheet.create({
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: MODAL_BACKDROP_BG },
	sheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACE.md + 2, paddingBottom: SPACE.xl + 4 },
	sheet: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.xxl,
		padding: PAGE_PAD,
		paddingTop: SPACE.md - 2,
		maxHeight: SCREEN_H * 0.85,
		...SHADOW_SM,
	},
	grabber: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: WHIMSY.muteSoft, marginBottom: SPACE.md },
	kicker: { ...TYPE.kicker, letterSpacing: 1.2, color: WHIMSY.accent, marginBottom: 2 },
	title: { ...TYPE.pageTitle, color: INK },
	sub: { ...TYPE.hand, color: WHIMSY.mute, marginTop: SPACE.xs + 2, marginBottom: SPACE.md },
	count: { ...TYPE.bodySm, fontFamily: FONTS.bodyExtra, color: INK },

	scroll: { flexGrow: 0 },
	grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, justifyContent: "space-between" },

	tile: {
		width: "31%",
		borderWidth: 2,
		borderRadius: RADII.lg,
		paddingBottom: SPACE.xs + 2,
		backgroundColor: WHIMSY.cream,
		overflow: "hidden",
	},
	tileLocked: { borderColor: WHIMSY.muteSoft },
	thumbWrap: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
	thumb: { width: "78%", height: "78%" },
	thumbLocked: { opacity: 0.32 },
	check: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: RADII.pill, borderWidth: 1.5, borderColor: INK, alignItems: "center", justifyContent: "center" },
	lock: { position: "absolute", top: 4, right: 5, opacity: 0.6 },
	name: { ...TYPE.kickerPill, fontSize: 11, letterSpacing: 0.2, textTransform: "none", color: INK, textAlign: "center", marginTop: SPACE.xs, paddingHorizontal: 3 },
	rarity: { ...TYPE.kicker, fontSize: 11, textAlign: "center", textTransform: "capitalize" },

	doneBtn: {
		marginTop: SPACE.lg - 2,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.lg,
		paddingVertical: SPACE.md,
		alignItems: "center",
		...SHADOW_SM,
	},
	doneText: { ...TYPE.numeral, color: INK },
});
