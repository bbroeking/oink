// The Closet — "dress up Rosie". A by-category wardrobe on top of the multi-slot
// model (constants/slots.ts): a live pig preview wearing every equipped slot, a
// row of tappable slot chips (filled show a × to remove; tapping scrolls to that
// slot's items), and 3-up grids of OWNED items per category. Tap an item to wear
// it — it shows on the pig right away. Design: claude.ai/design handoff.
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
import { HAT_IMAGES, HatRow, PIG_CANVAS, RARITY_COLORS } from "@/constants/hats";
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

	return (
		<ScrollView
			ref={scrollRef}
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<View style={styles.header}>
				<View>
					<Text style={styles.kicker}>dress up rosie</Text>
					<Text style={styles.title}>Closet</Text>
				</View>
				<View style={styles.coinPill}>
					<SnoutCoin size={16} />
					<Text style={styles.coinText}>{counter.toLocaleString()}</Text>
				</View>
			</View>

			{/* Live pig preview wearing every slot */}
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

				{/* Slot chips — tap to jump to that slot's items; × to remove. */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.slotRow}
				>
					{SLOT_ORDER.map((s) => {
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
										hitSlop={6}
									>
										<Text style={styles.slotRemoveText}>×</Text>
									</Pressable>
								) : null}
								<View style={styles.slotThumb}>
									{src ? (
										<Image source={src} style={styles.slotThumbImg} resizeMode="contain" />
									) : it?.emoji ? (
										<Text style={styles.slotEmoji}>{it.emoji}</Text>
									) : (
										<Text style={styles.slotPlus}>+</Text>
									)}
								</View>
								<Text style={styles.slotLabel}>{SLOT_LABEL[s].toUpperCase()}</Text>
							</Pressable>
						);
					})}
				</ScrollView>
			</View>

			<View style={styles.hint}>
				<Text style={styles.hintText}>
					★ Tap any item to wear it — it shows on Rosie right away.
				</Text>
			</View>

			{/* By-category 3-up grids of owned items */}
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
							<Text style={styles.sectionCount}>{items.length} OWNED</Text>
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
										{active && (
											<View style={styles.check}>
												<Text style={styles.checkText}>✓</Text>
											</View>
										)}
										<View
											style={[
												styles.itemThumb,
												{ backgroundColor: rarityTint(item.rarity) },
											]}
										>
											{src ? (
												<Image source={src} style={styles.itemThumbImg} resizeMode="contain" />
											) : (
												<Text style={styles.itemEmoji}>{item.emoji ?? "?"}</Text>
											)}
										</View>
										<Text style={styles.itemName} numberOfLines={1}>
											{item.name}
										</Text>
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

// Soft pastel tint behind each item, by rarity.
function rarityTint(rarity: string | undefined): string {
	switch (rarity) {
		case "legendary": return WHIMSY.sun;
		case "epic": return WHIMSY.lilac;
		case "rare": return WHIMSY.sky;
		case "uncommon": return WHIMSY.sage;
		default: return WHIMSY.cream2;
	}
}

const COLS = 3;
const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { paddingHorizontal: 14, paddingTop: 6 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 10,
	},
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		letterSpacing: 1.2,
		color: WHIMSY.accent,
		textTransform: "lowercase",
	},
	title: { fontFamily: FONTS.whimsy, fontSize: 32, color: WHIMSY.ink },
	coinPill: {
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
	coinText: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink },
	previewCard: {
		backgroundColor: WHIMSY.peach,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 20,
		paddingTop: 8,
		paddingBottom: 12,
		alignItems: "center",
	},
	previewStageWrap: {
		width: 200,
		height: 200,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	slotRow: { gap: 10, paddingHorizontal: 12, paddingTop: 4 },
	slotChip: {
		width: 74,
		alignItems: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingVertical: 8,
		position: "relative",
	},
	slotThumb: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	slotThumbImg: { width: 44, height: 44 },
	slotEmoji: { fontSize: 30 },
	slotPlus: { fontSize: 30, color: WHIMSY.mute },
	slotLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		marginTop: 2,
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
	slotRemoveText: { fontSize: 16, color: WHIMSY.ink },
	hint: {
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderStyle: "dashed",
		borderRadius: 14,
		paddingVertical: 10,
		paddingHorizontal: 14,
		marginVertical: 12,
	},
	hintText: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.ink },
	section: { marginBottom: 18 },
	sectionHead: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	sectionTitle: { fontFamily: FONTS.whimsy, fontSize: 24, color: WHIMSY.ink },
	sectionCount: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.mute,
		letterSpacing: 1,
	},
	grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
	itemCard: {
		width: `${100 / COLS - 4}%`,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 16,
		padding: 6,
		position: "relative",
	},
	itemCardActive: { borderColor: WHIMSY.lilacDeep, borderWidth: 3 },
	itemThumb: {
		width: "100%",
		aspectRatio: 1,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 6,
		overflow: "hidden",
	},
	itemThumbImg: { width: "80%", height: "80%" },
	itemEmoji: { fontSize: 40 },
	itemName: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	check: {
		position: "absolute",
		top: 6,
		right: 6,
		zIndex: 3,
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: WHIMSY.lilacDeep,
		alignItems: "center",
		justifyContent: "center",
	},
	checkText: { color: WHIMSY.paper, fontSize: 14, fontWeight: "700" },
});
