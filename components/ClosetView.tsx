// The Closet — "dress up Rosie". The refined single-screen fitting room from the
// claude.ai/design handoff (Closet.html → ClosetFinal): a centered header + coin,
// a cream fitting-room card with a live pig preview and a row of equip-slot chips
// that map 1:1 to the browse sections below (only slots you actually own items in
// show — no mystery empty slots, no horizontal scroll), then left-aligned
// by-category grids of owned items. Tap an item to wear it; tap a slot's ✕ to take
// it off. Tiles carry a rarity stripe + tinted swatch and a clear lilac "ON" state.
// A title chip under the pig + a TitlesSection at the bottom make the Closet the
// canonical place to equip titles (the Shop's Titles tab stays for buying).
import { useCallback, useRef, useState } from "react";
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
import { TitlesSection } from "./TitlesSection";
import { HAT_IMAGES, HatRow, PIG_CANVAS } from "@/constants/hats";
import type { TitleRow } from "@/constants/title_types";
import {
	SLOT_ORDER,
	SLOT_LABEL,
	SLOT_COLUMN,
	columnsForSlot,
	slotForCategory,
	type EquipSlotKey,
} from "@/constants/slots";
import { FONTS, WHIMSY } from "@/constants/theme";
import { Dimensions } from "react-native";

// Explicit tile geometry. Yoga (this RN vintage) refuses to treat
// aspectRatio-derived heights as definite when resolving children — both
// %-sizes AND absolute insets fall back to the child's intrinsic px size,
// so big art cropped through every workaround. Measured numbers end it:
// COLS columns inside the content padding (16*2) with the grid's 10pt gaps.
const SCREEN_W = Dimensions.get("window").width;
const TILE_W = Math.floor((SCREEN_W - 32 - 2 * 10) / 3);
const THUMB_ART = TILE_W - 24; // 12pt breathing room each side

interface Props {
	ownedItems: HatRow[];
	allItems: HatRow[];
	activeIds: Record<string, string | null>;
	counter: number;
	onEquip: (id: string | null, category: string | null | undefined) => void;
	isEquipped: (id: string, category: string | null | undefined) => boolean;
	// Titles wiring — state lives in shop.tsx (same source the Titles tab
	// reads); this view just renders TitlesSection + the preview chip.
	userId: string | null;
	activeTitleId: string | null;
	onTitleChange: (next: string | null) => void;
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
	userId,
	activeTitleId,
	onTitleChange,
}: Props) {
	const scrollRef = useRef<ScrollView>(null);
	// Y position of each category section, for slot-chip → scroll-to.
	// The titles section registers under "titles" (not a CAT_ORDER key).
	const sectionY = useRef<Record<string, number>>({});
	// Owned title rows, fed back by TitlesSection's load — the preview
	// chip resolves the active title's display name from here.
	const [ownedTitles, setOwnedTitles] = useState<TitleRow[]>([]);
	const handleTitlesLoaded = useCallback((rows: TitleRow[]) => {
		setOwnedTitles(rows);
	}, []);

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

	const scrollToTitles = useCallback(() => {
		if (sectionY.current.titles != null) {
			scrollRef.current?.scrollTo({ y: sectionY.current.titles - 8, animated: true });
		}
	}, []);

	// Display name on the preview chip: resolved name, "…" while the owned
	// rows are still loading, or the pick prompt when nothing is equipped.
	const activeTitleName = activeTitleId
		? ownedTitles.find((t) => t.id === activeTitleId)?.name ?? "…"
		: null;

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
		if (columnsForSlot(s).some((c) => activeIds[c])) slotsWithContent.add(s);
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

				{/* Title chip — the pig's nameplate. Tapping scrolls to the
				    Titles section below, same pattern as the slot chips. */}
				{userId != null && (
					<Pressable onPress={scrollToTitles} style={styles.titleChip}>
						<Text style={styles.titleChipKicker}>title</Text>
						<Text
							style={[
								styles.titleChipName,
								activeTitleName == null && styles.titleChipNameEmpty,
							]}
							numberOfLines={1}
						>
							{activeTitleName ?? "No title — tap to pick"}
						</Text>
					</Pressable>
				)}

				{visibleSlots.length > 0 && (
					<View style={styles.slotRow}>
						{visibleSlots.map((s) => {
							// Face reads mask ?? glasses (merged chip, two columns).
							const equippedId =
								columnsForSlot(s)
									.map((c) => activeIds[c])
									.find((v) => v) ?? null;
							const it = equippedId ? byId.current.get(equippedId) : null;
							const src = equippedId ? HAT_IMAGES[equippedId] : null;
							return (
								<Pressable
									key={s}
									onPress={() => scrollToCategory(s)}
									style={styles.slotChip}
								>
									{equippedId && it ? (
										// Asymmetric hitSlop grows the 24pt ✕ to a 44pt
										// square anchored on the chip's top-right corner
										// (hitSlop can't extend past the parent chip).
										<Pressable
											onPress={() => onEquip(null, it.category)}
											style={styles.slotRemove}
											hitSlop={{ top: 0, right: 0, bottom: 20, left: 20 }}
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

			{/* Titles — equip/unequip without leaving the Closet (the Shop's
			    Titles tab stays for buying; this is the canonical equip spot).
			    Inline in the scroll — no modal. */}
			{userId != null && (
				<View
					onLayout={(e: LayoutChangeEvent) => {
						sectionY.current.titles = e.nativeEvent.layout.y;
					}}
					style={styles.section}
				>
					<TitlesSection
						userId={userId}
						activeTitleId={activeTitleId}
						onChange={onTitleChange}
						onTitlesLoaded={handleTitlesLoaded}
					/>
				</View>
			)}
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
	// Explicit pt size (not %) — see itemThumbImg for why.
	slotThumbImg: { width: 30, height: 30 },
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
		top: 0,
		right: 0,
		zIndex: 2,
		width: 24,
		height: 24,
		alignItems: "center",
		justifyContent: "center",
	},
	slotRemoveText: { fontSize: 12, fontWeight: "900", color: WHIMSY.ink },
	// Nameplate pill under the pig. minHeight 44 keeps it a full-size
	// tap target without hitSlop.
	titleChip: {
		marginTop: 6,
		minHeight: 44,
		maxWidth: 240,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 5,
		paddingHorizontal: 16,
	},
	titleChipKicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		letterSpacing: 0.6,
		color: WHIMSY.mute,
		textTransform: "uppercase",
	},
	titleChipName: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
		marginTop: 1,
	},
	titleChipNameEmpty: { color: WHIMSY.mute },
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
		width: TILE_W,
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
		width: TILE_W - 4, // inside the 2pt borders
		height: TILE_W - 4,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		position: "relative",
	},
	// NUMERIC absolute insets only. %-insets hit the same Yoga quirk as
	// %-sizes here (the aspectRatio-derived parent height isn't a definite
	// basis at resolve time), so the Image reverted to intrinsic px size
	// (1024² legendary art, 752×1584 backgrounds) and the overflow:hidden
	// backstop CROPPED it — giant zoomed art in every tile. Fixed-point
	// insets always resolve; resizeMode="contain" does the fitting.
	itemThumbImg: {
		width: THUMB_ART,
		height: THUMB_ART,
	},
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
