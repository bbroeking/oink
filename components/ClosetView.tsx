// The Closet — "dress up Rosie". The refined single-screen fitting room from the
// claude.ai/design handoff (Closet.html → ClosetFinal): a centered header + coin,
// a cream fitting-room card with a live pig preview and a row of equip-slot chips
// that map 1:1 to the browse sections below (only slots you actually own items in
// show — no mystery empty slots, no horizontal scroll), then left-aligned
// by-category grids of owned items. Tap an item to wear it; tap a slot's ✕ to take
// it off. Tiles carry a rarity stripe + tinted swatch and a clear lilac "ON" state.
import { useCallback, useRef } from "react";
import {
	View,
	Text,
	Pressable,
	Image,
	ScrollView,
	StyleSheet,
	LayoutChangeEvent,
} from "react-native";
import * as Haptics from "expo-haptics";
import { PigStage } from "./ui/PigStage";
import { SnoutCoin } from "./ui/SnoutCoin";
import { HAT_IMAGES, HatRow, PIG_CANVAS } from "@/constants/hats";
import {
	SLOT_ORDER,
	SLOT_LABEL,
	SLOT_COLUMN,
	slotForCategory,
	type EquipSlotKey,
} from "@/constants/slots";
import { FONTS, WHIMSY } from "@/constants/theme";

interface Props {
	ownedItems: HatRow[];
	allItems: HatRow[];
	activeIds: Record<string, string | null>;
	counter: number;
	onEquip: (id: string | null, category: string | null | undefined) => void;
	isEquipped: (id: string, category: string | null | undefined) => boolean;
}

// Category sections, in order, with player-facing headings.
const CAT_ORDER = [
	"hat", "bow", "glasses", "mask", "scarf", "necklace",
	"held", "aura", "background", "flag", "tickle_particle",
];
const CAT_LABEL: Record<string, string> = {
	hat: "Hats", bow: "Bows", glasses: "Glasses", mask: "Masks",
	scarf: "Scarves", necklace: "Necklaces", held: "Held", aura: "Auras",
	background: "Backgrounds", flag: "Flags", tickle_particle: "Tickle Effects",
};

// Per-rarity swatch fill + stripe colors, carried over from the design (RBG/ROUT).
const RARITY_FILL: Record<string, string> = {
	common: "#f4ebe0", uncommon: "#d4e8d4", rare: "#c8dde9",
	epic: "#d6c8f0", legendary: "#ffd87a",
};
const RARITY_STRIPE: Record<string, string> = {
	common: WHIMSY.muteSoft, uncommon: "#7ba868", rare: "#5a8bc5",
	epic: WHIMSY.lilacDeep, legendary: "#c99b23",
};
const fill = (r: string | undefined) => RARITY_FILL[r ?? "common"] ?? RARITY_FILL.common;
const stripe = (r: string | undefined) => RARITY_STRIPE[r ?? "common"] ?? RARITY_STRIPE.common;

export function ClosetView({
	ownedItems,
	allItems,
	activeIds,
	counter,
	onEquip,
	isEquipped,
}: Props) {
	const scrollRef = useRef<ScrollView>(null);
	// Y position of each category section, for slot-chip → scroll-to.
	const sectionY = useRef<Record<string, number>>({});

	const byId = useRef<Map<string, HatRow>>(new Map());
	byId.current = new Map(allItems.map((i) => [i.id, i]));

	// Build a PigStage slot ({id, category, emoji}) from a profiles column.
	const slot = (column: string) => {
		const id = activeIds[column];
		if (!id) return null;
		const it = byId.current.get(id);
		return { id, category: it?.category ?? null, emoji: it?.emoji ?? null };
	};

	const scale = 200 / PIG_CANVAS;

	const scrollToCategory = useCallback((slotKey: EquipSlotKey) => {
		// Find the first category that maps to this slot and has a section.
		const cat = CAT_ORDER.find(
			(c) => slotForCategory(c) === slotKey && sectionY.current[c] != null
		);
		if (cat != null && sectionY.current[cat] != null) {
			scrollRef.current?.scrollTo({ y: sectionY.current[cat] - 8, animated: true });
		}
	}, []);

	// Owned items grouped by category.
	const groups: Record<string, HatRow[]> = {};
	ownedItems.forEach((i) => {
		const c = i.category ?? "hat";
		(groups[c] ??= []).push(i);
	});

	// Slot chips map 1:1 to the sections below: show a chip only for a slot you
	// own items in (so there's a section to fill it) or are currently wearing (so
	// you can always take it off). Kills the "mystery empty slots" + the sideways
	// scroll — they wrap to fit instead.
	const slotsWithContent = new Set<EquipSlotKey>();
	ownedItems.forEach((i) => slotsWithContent.add(slotForCategory(i.category)));
	SLOT_ORDER.forEach((s) => {
		if (activeIds[SLOT_COLUMN[s]]) slotsWithContent.add(s);
	});
	const visibleSlots = SLOT_ORDER.filter((s) => slotsWithContent.has(s));

	return (
		<ScrollView
			ref={scrollRef}
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			{/* Centered header; coin chip floats top-right. */}
			<View style={styles.header}>
				<Text style={styles.kicker}>dress up rosie</Text>
				<Text style={styles.title}>Closet</Text>
				<View style={styles.coinPill}>
					<SnoutCoin size={15} />
					<Text style={styles.coinText}>{counter.toLocaleString()}</Text>
				</View>
			</View>

			{/* Live fitting-room preview + equip-slot chips. */}
			<View style={styles.previewCard}>
				<View style={styles.previewStageWrap}>
					<View style={{ transform: [{ scale }] }}>
						<PigStage
							equipped={slot("active_hat_id")}
							equippedGlasses={slot("active_glasses_id")}
							equippedMask={slot("active_mask_id")}
							equippedNeck={slot("active_neck_id")}
							equippedAura={slot("active_aura_id")}
							equippedHeld={slot("active_held_id")}
							equippedFlag={slot("active_flag_id")}
						/>
					</View>
				</View>

				{visibleSlots.length > 0 && (
					<View style={styles.slotRow}>
						{visibleSlots.map((s) => {
							const column = SLOT_COLUMN[s];
							const equippedId = activeIds[column];
							const it = equippedId ? byId.current.get(equippedId) : null;
							const src = equippedId ? HAT_IMAGES[equippedId] : null;
							return (
								<Pressable
									key={s}
									onPress={() => scrollToCategory(s)}
									style={styles.slotChip}
								>
									{equippedId && it ? (
										<Pressable
											onPress={() => onEquip(null, it.category)}
											style={styles.slotRemove}
											hitSlop={8}
										>
											<Text style={styles.slotRemoveText}>✕</Text>
										</Pressable>
									) : null}
									<View
										style={[
											styles.slotThumb,
											{ backgroundColor: it ? fill(it.rarity) : WHIMSY.paper },
										]}
									>
										{src ? (
											<Image source={src} style={styles.slotThumbImg} resizeMode="contain" />
										) : it?.emoji ? (
											<Text style={styles.slotEmoji}>{it.emoji}</Text>
										) : (
											<Text style={styles.slotPlus}>+</Text>
										)}
									</View>
									<Text style={styles.slotLabel}>{SLOT_LABEL[s]}</Text>
								</Pressable>
							);
						})}
					</View>
				)}
			</View>

			<View style={styles.hint}>
				<Text style={styles.hintText}>
					★ Tap any item to wear it — it shows on Rosie right away.
				</Text>
			</View>

			{/* By-category 3-up grids of owned items. Headers left-aligned. */}
			{CAT_ORDER.filter((c) => groups[c]?.length).map((cat) => {
				const items = groups[cat];
				return (
					<View
						key={cat}
						onLayout={(e: LayoutChangeEvent) => {
							sectionY.current[cat] = e.nativeEvent.layout.y;
						}}
						style={styles.section}
					>
						<View style={styles.sectionHead}>
							<Text style={styles.sectionTitle}>{CAT_LABEL[cat] ?? cat}</Text>
							<Text style={styles.sectionCount}>{items.length} owned</Text>
						</View>
						<View style={styles.grid}>
							{items.map((item) => {
								const active = isEquipped(item.id, item.category);
								const src = HAT_IMAGES[item.id];
								return (
									<Pressable
										key={item.id}
										onPress={() => {
											Haptics.selectionAsync().catch(() => {});
											onEquip(active ? null : item.id, item.category);
										}}
										style={[styles.itemCard, active && styles.itemCardActive]}
									>
										<View style={[styles.itemStripe, { backgroundColor: stripe(item.rarity) }]} />
										<View style={[styles.itemThumb, { backgroundColor: fill(item.rarity) }]}>
											{src ? (
												<Image source={src} style={styles.itemThumbImg} resizeMode="contain" />
											) : (
												<Text style={styles.itemEmoji}>{item.emoji ?? "?"}</Text>
											)}
											{active && (
												<View style={styles.check}>
													<Text style={styles.checkText}>✓</Text>
												</View>
											)}
										</View>
										<View style={[styles.itemFoot, active && styles.itemFootActive]}>
											<Text style={styles.itemName} numberOfLines={1}>
												{item.name}
											</Text>
										</View>
									</Pressable>
								);
							})}
						</View>
					</View>
				);
			})}
			<View style={{ height: 80 }} />
		</ScrollView>
	);
}

const COLS = 3;
const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { paddingHorizontal: 16, paddingTop: 6 },
	header: {
		position: "relative",
		alignItems: "center",
		paddingTop: 10,
		paddingBottom: 12,
	},
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		letterSpacing: 1.2,
		color: WHIMSY.accent,
		textTransform: "lowercase",
	},
	title: { fontFamily: FONTS.whimsy, fontSize: 30, color: WHIMSY.ink, marginTop: 2 },
	coinPill: {
		position: "absolute",
		right: 0,
		top: 12,
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 11,
		paddingVertical: 5,
	},
	coinText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	previewCard: {
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 16,
		paddingTop: 8,
		paddingBottom: 12,
		paddingHorizontal: 12,
		alignItems: "center",
	},
	previewStageWrap: {
		width: 200,
		height: 200,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	slotRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
		marginTop: 8,
	},
	slotChip: {
		width: 72,
		alignItems: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 7,
		position: "relative",
	},
	slotThumb: {
		width: 40,
		height: 40,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	slotThumbImg: { width: "80%", height: "80%" },
	slotEmoji: { fontSize: 26 },
	slotPlus: { fontSize: 22, color: WHIMSY.mute },
	slotLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 0.6,
		color: WHIMSY.mute,
		textTransform: "uppercase",
		marginTop: 4,
	},
	slotRemove: {
		position: "absolute",
		top: 2,
		right: 4,
		zIndex: 2,
		width: 18,
		height: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	slotRemoveText: { fontSize: 12, fontWeight: "900", color: WHIMSY.ink },
	hint: {
		borderWidth: 1.5,
		borderColor: WHIMSY.mute,
		borderStyle: "dashed",
		borderRadius: 12,
		backgroundColor: WHIMSY.cream,
		paddingVertical: 9,
		paddingHorizontal: 14,
		marginVertical: 12,
	},
	hintText: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.ink },
	section: { marginBottom: 18 },
	sectionHead: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 8,
		marginBottom: 10,
	},
	sectionTitle: { fontFamily: FONTS.whimsy, fontSize: 20, color: WHIMSY.ink },
	sectionCount: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		letterSpacing: 0.6,
		textTransform: "uppercase",
	},
	grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
	itemCard: {
		width: `${100 / COLS - 4}%`,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		overflow: "hidden",
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	itemCardActive: { borderColor: WHIMSY.lilacDeep },
	itemStripe: { height: 4, width: "100%" },
	itemThumb: {
		width: "100%",
		aspectRatio: 1,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		position: "relative",
	},
	itemThumbImg: { width: "76%", height: "76%" },
	itemEmoji: { fontSize: 40 },
	itemFoot: {
		borderTopWidth: 2,
		borderTopColor: WHIMSY.ink,
		paddingVertical: 6,
		paddingHorizontal: 8,
		backgroundColor: WHIMSY.paper,
	},
	itemFootActive: { backgroundColor: WHIMSY.lilac },
	itemName: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	check: {
		position: "absolute",
		top: 6,
		right: 6,
		zIndex: 3,
		width: 22,
		height: 22,
		borderRadius: 11,
		backgroundColor: WHIMSY.lilacDeep,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	checkText: { color: WHIMSY.paper, fontSize: 11, fontWeight: "900" },
});
