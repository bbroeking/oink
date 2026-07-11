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
import { categoryIcon } from "@/constants/emojiArt";
import type { TitleRow } from "@/constants/title_types";
import {
	SLOT_ORDER,
	SLOT_LABEL,
	SLOT_COLUMN,
	columnsForSlot,
	slotForCategory,
	type EquipSlotKey,
} from "@/constants/slots";
import { FONTS, STICKER_SHADOW, WHIMSY } from "@/constants/theme";
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

// Owned items hidden from the closet until art ships (orphans with no
// HAT_IMAGES entry render a wrong category fallback — e.g. tiny_umbrella shows
// the wand). Server-side these are also pulled from the shop + unequipped
// (20260684). Remove an id here once its real art lands in the art pass.
const HIDDEN_CLOSET_IDS = new Set<string>([
	// The 2026-07-06 art-backlog pass shipped art for all 11 hidden 20260632
	// items (mushroom_cap … library_nook) — removed here. What remains are the
	// deleted capes/necklaces (never re-seeded).
	"bell_collar", "bone_necklace", "charm_necklace", "choker", "diamond_pendant",
	"emerald_pendant", "ermine_cape", "fur_cape", "gas_mask", "gold_chain",
	"hero_cape", "leather_cape", "locket", "magician_cape",
	"neckwarmer", "pearl_necklace", "ribbon_choker", "royal_cape", "short_cape",
	"silk_cape", "star_cape", "vampire_cape",
]);

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

// Paper-doll: a signature WHIMSY tint per equip slot, painted behind the slot's
// item/category icon so the slots flanking Rosie read as a colourful dress-up tray.
const SLOT_TINT: Record<string, string> = {
	head: WHIMSY.sun,
	face: WHIMSY.sky,
	neck: WHIMSY.rose,
	held: WHIMSY.sage,
	tickle: WHIMSY.lilac,
	aura: WHIMSY.peach,
	background: WHIMSY.cream2,
	flag: WHIMSY.sky,
};

// Rosie's preview footprint in the paper-doll. Smaller than the old 200 so the
// equip-slot columns have room to flank her on both sides.
const PIG_PREVIEW = 150;
// The scene window behind Rosie is a touch wider + taller than she is so a
// margin of background shows all around her (room for the hat, aura + flag to
// read). Capped so the flanking slot columns still clear a 64px chip on an SE
// (card inner width = SCREEN_W − 60; each column = (inner − PIG_WINDOW_W) / 2).
const PIG_WINDOW_W = 184;
const PIG_WINDOW_H = 210;

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

	const scale = PIG_PREVIEW / PIG_CANVAS;

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

	// Owned items grouped by category. Art-less orphans (HIDDEN_CLOSET_IDS) are
	// filtered out so they don't render a wrong fallback thumbnail.
	const visibleOwned = ownedItems.filter((i) => !HIDDEN_CLOSET_IDS.has(i.id));
	const groups: Record<string, HatRow[]> = {};
	visibleOwned.forEach((i) => {
		const c = i.category ?? "hat";
		(groups[c] ??= []).push(i);
	});

	// Slot chips map 1:1 to the sections below: show a chip only for a slot you
	// own items in (so there's a section to fill it) or are currently wearing (so
	// you can always take it off). Kills the "mystery empty slots" + the sideways
	// scroll — they wrap to fit instead.
	const slotsWithContent = new Set<EquipSlotKey>();
	visibleOwned.forEach((i) => slotsWithContent.add(slotForCategory(i.category)));
	SLOT_ORDER.forEach((s) => {
		if (columnsForSlot(s).some((c) => activeIds[c])) slotsWithContent.add(s);
	});
	const visibleSlots = SLOT_ORDER.filter((s) => slotsWithContent.has(s));

	// Paper-doll arrangement: every equip slot is a chip split into two columns
	// that flank Rosie left + right.
	// Flag is no longer a closet slot chip — the country flag is picked from the
	// Barn (home) bottom-left corner. Background takes its place in the flanking
	// set (no more wide tray beneath the pig); SLOT_ORDER runs …aura,
	// background, so with flag dropped, background lands in flag's old spot.
	const flankSlots = visibleSlots.filter((s) => s !== "flag");

	// The equipped background, rendered as the scene inside the preview window —
	// a scoped version of the Barn's full-page background so you can preview it
	// here. HAT_IMAGES keys animated backgrounds to their frame-1 thumbnail, so
	// this resolves both static and animated ids (they animate live on the Barn).
	const bgId = activeIds["active_background_id"] ?? null;
	const bgPreviewSrc = bgId ? HAT_IMAGES[bgId] ?? null : null;
	const splitAt = Math.ceil(flankSlots.length / 2);
	const leftSlots = flankSlots.slice(0, splitAt);
	const rightSlots = flankSlots.slice(splitAt);

	// One equip slot: tinted thumb (item art → category art → +), tap scrolls to
	// that section, ✕ takes it off.
	const renderSlot = (s: EquipSlotKey) => {
		const equippedId =
			columnsForSlot(s)
				.map((c) => activeIds[c])
				.find((v) => v) ?? null;
		const it = equippedId ? byId.current.get(equippedId) : null;
		const src = equippedId ? HAT_IMAGES[equippedId] : null;
		const thumbSrc = src ?? (it ? categoryIcon(it.category) : null);
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
						hitSlop={{ top: 6, right: 6, bottom: 18, left: 18 }}
					>
						<Text style={styles.slotRemoveText}>✕</Text>
					</Pressable>
				) : null}
				<View style={[styles.slotThumb, { backgroundColor: SLOT_TINT[s] ?? WHIMSY.cream2 }]}>
					{thumbSrc ? (
						<Image source={thumbSrc} style={styles.slotThumbImg} resizeMode="contain" />
					) : (
						<Text style={styles.slotPlus}>+</Text>
					)}
				</View>
				<Text style={styles.slotLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
					{SLOT_LABEL[s]}
				</Text>
			</Pressable>
		);
	};

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

			{/* Paper-doll fitting room: Rosie centred, equip slots flank her,
			    then her nameplate. */}
			<View style={styles.previewCard}>
				<View style={styles.paperDoll}>
					<View style={styles.slotCol}>{leftSlots.map((s) => renderSlot(s))}</View>
					{/* Scene window: the equipped background fills a rounded window with
					    Rosie composited in front and a margin of scene around her so the
					    hat, aura + flag all read. Clipped (overflow hidden) — the aura's
					    baked radial falloff keeps that clip soft, no hard box. */}
					<View style={styles.pigWindow}>
						{bgPreviewSrc && (
							<Image
								source={bgPreviewSrc}
								style={styles.pigWindowBg}
								resizeMode="cover"
							/>
						)}
						<View style={styles.pigVisualBox}>
							<View style={[styles.pigScaler, { transform: [{ scale }] }]}>
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
					</View>
					<View style={styles.slotCol}>{rightSlots.map((s) => renderSlot(s))}</View>
				</View>

				{/* Title chip — the pig's nameplate; tapping scrolls to Titles. */}
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
											{(() => {
												// Item art → category art (real PNG) → a
												// neutral print glyph. Never raw emoji.
												const catSrc = categoryIcon(item.category);
												const thumbSrc = src ?? catSrc;
												return thumbSrc ? (
													<Image source={thumbSrc} style={styles.itemThumbImg} resizeMode="contain" />
												) : (
													<Text style={styles.itemEmoji}>✦</Text>
												);
											})()}
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
		borderRadius: 18,
		padding: 14,
		alignItems: "center",
		gap: 10,
		...STICKER_SHADOW,
	},
	// Paper-doll: flex columns flank Rosie so she stays centred no matter how many
	// slots each side has.
	paperDoll: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "stretch",
	},
	slotCol: {
		flex: 1,
		gap: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	// Scene window behind Rosie: the equipped background clipped to a rounded
	// rect, sized a touch larger than the pig so a margin of scene shows all
	// around her. Rosie is pinned near the bottom (paddingBottom) with headroom
	// above for a tall hat; overflow:hidden does the final clip to the rounded
	// window (the aura's baked falloff keeps that clip soft).
	pigWindow: {
		width: PIG_WINDOW_W,
		height: PIG_WINDOW_H,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "flex-end",
		paddingBottom: 8,
	},
	// Explicit numeric size (NOT inset:0 / percentage) — an inset-sized Image
	// hits RN's indefinite-size fallback and renders a centered intrinsic band
	// (see PageBackground's note). Cover-fills the window edge to edge.
	pigWindowBg: {
		position: "absolute",
		top: 0,
		left: 0,
		width: PIG_WINDOW_W,
		height: PIG_WINDOW_H,
	},
	// The pig's displayed footprint. overflow:"visible" lets a tall hat spill up
	// into the window's headroom; pigWindow does the final clip at its edge.
	pigVisualBox: {
		width: PIG_PREVIEW,
		height: PIG_PREVIEW,
		overflow: "visible",
	},
	// Centers the 300² PigStage within the visual box; the scale transform
	// (passed inline) then fits it.
	pigScaler: {
		position: "absolute",
		left: (PIG_PREVIEW - PIG_CANVAS) / 2,
		top: (PIG_PREVIEW - PIG_CANVAS) / 2,
	},
	slotChip: {
		width: 64,
		alignItems: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingVertical: 6,
		position: "relative",
		...STICKER_SHADOW,
		shadowOffset: { width: 2, height: 2 },
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
	slotPlus: { fontSize: 22, color: WHIMSY.mute },
	slotLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 0.6,
		color: WHIMSY.mute,
		textTransform: "uppercase",
		marginTop: 4,
	},
	// A small paper badge pinned to the chip's top-right corner. A bare ✕ over
	// the thumbnail art read as a stray mark colliding with the tile; the filled
	// badge + ink border makes it an intentional "remove" affordance sitting on
	// the corner. hitSlop (on the Pressable) keeps the tap target generous.
	slotRemove: {
		position: "absolute",
		top: 2,
		right: 2,
		zIndex: 3,
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	slotRemoveText: {
		fontSize: 10,
		fontWeight: "900",
		color: WHIMSY.ink,
		lineHeight: 12,
	},
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
