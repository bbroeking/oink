// The Closet — "dress up Rosie". The refined single-screen fitting room from the
// claude.ai/design handoff (Closet.html → ClosetFinal): a cream fitting-room
// card with a live pig preview and a row of equip-slot chips
// that map 1:1 to the browse sections below (only slots you actually own items in
// show — no mystery empty slots, no horizontal scroll), then left-aligned
// by-category grids of owned items. Tap an item to wear it; tap a slot's ✕ to take
// it off. Tiles carry a rarity stripe + tinted swatch and a clear lilac "ON" state.
// A title chip under the pig + a TitlesSection at the bottom make the Closet the
// canonical place to equip titles (the Shop's Titles tab stays for buying).
import { useCallback, useMemo, useRef, useState } from "react";
import {
	View,
	Text,
	Pressable,
	Image,
	FlatList,
	StyleSheet,
	useWindowDimensions
} from "react-native";
import * as Haptics from "expo-haptics";
import { PigStage } from "./ui/PigStage";
import { TitlesSection } from "./TitlesSection";
import { EmptyState } from "./ui/EmptyState";
import {
	HAT_IMAGES,
	HAT_THUMBNAILS_128,
	HAT_THUMBNAILS_256,
	HatRow,
	PIG_CANVAS
} from "@/constants/hats";
import { categoryIcon } from "@/constants/emojiArt";
import type { TitleRow } from "@/constants/title_types";
import {
	SLOT_ORDER,
	SLOT_LABEL,
	columnsForSlot,
	slotForCategory,
	type EquipSlotKey
} from "@/constants/slots";
import {
	FONTS,
	STICKER_SHADOW,
	SHADOW_SM,
	WHIMSY,
	RADII,
	SPACE,
	TYPE,
	RARITY_BG_SOLID,
	RARITY_STRIPE
} from "@/constants/theme";
import { Icon } from "./ui/Icon";
import { IconButton } from "./ui/IconButton";
import { Glyph } from "./ui/Glyph";

// Explicit tile geometry. Yoga (this RN vintage) refuses to treat
// aspectRatio-derived heights as definite when resolving children — both
// %-sizes AND absolute insets fall back to the child's intrinsic px size,
// so big art cropped through every workaround. Measured numbers end it:
// COLS columns inside the content padding (16*2) with the grid's 10pt gaps.
interface Props {
	ownedItems: HatRow[];
	allItems: HatRow[];
	activeIds: Record<string, string | null>;
	onEquip: (id: string | null, category: string | null | undefined) => void;
	onPreview: (item: HatRow) => void;
	isEquipped: (id: string, category: string | null | undefined) => boolean;
	// Titles wiring — state lives in shop.tsx (same source the Titles tab
	// reads); this view just renders TitlesSection + the preview chip.
	userId: string | null;
	activeTitleId: string | null;
	onTitleChange: (next: string | null) => void;
	// Kept in the public component contract while the Shop owns membership
	// state; the Closet itself has no member-only controls.
	isVip?: boolean;
	prestigeOnly?: boolean;
	onClearPrestigeFilter?: () => void;
}

// Owned items hidden from the closet until art ships (orphans with no
// HAT_IMAGES entry render a wrong category fallback — e.g. tiny_umbrella shows
// the wand). Server-side these are also pulled from the shop + unequipped
// (20260684). Remove an id here once its real art lands in the art pass.
const HIDDEN_CLOSET_IDS = new Set<string>([
	// The 2026-07-06 art-backlog pass shipped art for all 11 hidden 20260632
	// items (mushroom_cap … library_nook) — removed here. What remains are the
	// deleted capes/necklaces (never re-seeded).
	"bell_collar",
	"bone_necklace",
	"charm_necklace",
	"choker",
	"diamond_pendant",
	"emerald_pendant",
	"ermine_cape",
	"fur_cape",
	"gas_mask",
	"gold_chain",
	"hero_cape",
	"leather_cape",
	"locket",
	"magician_cape",
	"neckwarmer",
	"pearl_necklace",
	"ribbon_choker",
	"royal_cape",
	"short_cape",
	"silk_cape",
	"star_cape",
	"vampire_cape"
]);

// Category sections, in order, with player-facing headings.
const CAT_ORDER = [
	"hat",
	"bow",
	"glasses",
	"mask",
	"scarf",
	"necklace",
	"held",
	"aura",
	"background",
	"tickle_particle"
];
const CAT_LABEL: Record<string, string> = {
	hat: "Hats",
	bow: "Bows",
	glasses: "Glasses",
	mask: "Masks",
	scarf: "Scarves",
	necklace: "Necklaces",
	held: "Held",
	aura: "Auras",
	background: "BG",
	tickle_particle: "Tickle Effects"
};

// Per-rarity swatch fill + stripe — the light panel (RARITY_BG_SOLID) and the
// saturated marker (RARITY_STRIPE) from the shared rarity tokens (theme.ts).
const fill = (r: string | undefined) => RARITY_BG_SOLID[r ?? "common"] ?? RARITY_BG_SOLID.common;
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
	background: WHIMSY.cream2
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

type ClosetListRow =
	| {
			kind: "section";
			key: string;
			category: string;
			ownedCount: number;
			missingCount: number;
	  }
	| { kind: "items"; key: string; category: string; items: HatRow[] };

type ClosetFilter = "all" | "owned" | "unowned" | "member" | "non-member";

const CLOSET_FILTERS: { value: ClosetFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "owned", label: "Owned" },
	{ value: "unowned", label: "Unowned" },
	{ value: "member", label: "Member" },
	{ value: "non-member", label: "Non-member" },
];

export function ClosetView({
	ownedItems,
	allItems,
	activeIds,
	onEquip,
	onPreview,
	isEquipped,
	userId,
	activeTitleId,
	onTitleChange,
	isVip = false,
	prestigeOnly = false,
	onClearPrestigeFilter,
}: Props) {
	const { width: windowWidth } = useWindowDimensions();
	const tileWidth = Math.floor((windowWidth - SPACE.lg * 2 - 20) / 3);
	const thumbArt = Math.max(44, tileWidth - 24);
	const listRef = useRef<FlatList<ClosetListRow>>(null);
	// Owned title rows, fed back by TitlesSection's load — the preview
	// chip resolves the active title's display name from here.
	const [ownedTitles, setOwnedTitles] = useState<TitleRow[]>([]);
	// Living mood surface: track the live sprite frame so equipped items ride
	// along with the breathing pig (same wiring as SwipeElement).
	const [pigFrameIdx, setPigFrameIdx] = useState(0);
	const [filter, setFilter] = useState<ClosetFilter>("all");
	const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
		() => new Set(),
	);
	const handleTitlesLoaded = useCallback((rows: TitleRow[]) => {
		setOwnedTitles(rows);
	}, []);
	const toggleCategory = useCallback((category: string) => {
		setCollapsedCategories((current) => {
			const next = new Set(current);
			if (next.has(category)) next.delete(category);
			else next.add(category);
			return next;
		});
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

	// Display name on the preview chip: resolved name, "…" while the owned
	// rows are still loading, or the pick prompt when nothing is equipped.
	const activeTitleName = activeTitleId
		? (ownedTitles.find((t) => t.id === activeTitleId)?.name ?? "…")
		: null;

	const ownedIds = useMemo(
		() => new Set(ownedItems.map((item) => item.id)),
		[ownedItems],
	);
	// The merged Closet owns the whole collectible catalog. Flags, retired
	// orphans, and members items whose art has not landed stay hidden.
	const closetItems = useMemo(
		() =>
			allItems.filter(
				(i) =>
					i.category !== "flag" &&
					!HIDDEN_CLOSET_IDS.has(i.id) &&
					(!i.members_only ||
						!!HAT_IMAGES[i.id] ||
						!!HAT_THUMBNAILS_256[i.id])
			),
		[allItems],
	);
	const visibleItems = useMemo(
		() =>
			closetItems.filter((item) => {
				const owned = ownedIds.has(item.id);
				if (prestigeOnly) return owned && !!item.prestige_exclusive;
				if (filter === "owned") return owned;
				if (filter === "unowned") return !owned;
				if (filter === "member") return !!item.members_only;
				if (filter === "non-member") return !item.members_only;
				return true;
			}),
		[closetItems, filter, ownedIds, prestigeOnly],
	);
	const ownedClosetItems = useMemo(
		() =>
			ownedItems.filter(
				(item) =>
					item.category !== "flag" &&
					!HIDDEN_CLOSET_IDS.has(item.id),
			),
		[ownedItems],
	);
	const groups = useMemo(() => {
		const next: Record<string, HatRow[]> = {};
		visibleItems.forEach((i) => {
			const c = i.category ?? "hat";
			(next[c] ??= []).push(i);
		});
		return next;
	}, [visibleItems]);
	const { closetRows, categoryIndex } = useMemo(() => {
		const rows: ClosetListRow[] = [];
		const indices: Record<string, number> = {};
		CAT_ORDER.forEach((category) => {
			const items = groups[category];
			if (!items?.length) return;
			indices[category] = rows.length;
			rows.push({
				kind: "section",
				key: `section-${category}`,
				category,
				ownedCount: items.filter((item) => ownedIds.has(item.id)).length,
				missingCount: items.filter((item) => !ownedIds.has(item.id)).length,
			});
			for (let index = 0; index < items.length; index += 3) {
				rows.push({
					kind: "items",
					key: `items-${category}-${index}`,
					category,
					items: items.slice(index, index + 3)
				});
			}
		});
		return { closetRows: rows, categoryIndex: indices };
	}, [groups, ownedIds]);

	const scrollToCategory = useCallback(
		(slotKey: EquipSlotKey) => {
			const category = CAT_ORDER.find(
				(candidate) => slotForCategory(candidate) === slotKey && categoryIndex[candidate] != null
			);
			if (category != null) {
				setCollapsedCategories((current) => {
					if (!current.has(category)) return current;
					const next = new Set(current);
					next.delete(category);
					return next;
				});
				listRef.current?.scrollToIndex({
					index: categoryIndex[category],
					animated: true,
					viewOffset: 8
				});
			}
		},
		[categoryIndex]
	);

	const scrollToTitles = useCallback(() => {
		listRef.current?.scrollToEnd({ animated: true });
	}, []);

	// Slot chips map 1:1 to the sections below: show a chip only for a slot you
	// own items in (so there's a section to fill it) or are currently wearing (so
	// you can always take it off). Kills the "mystery empty slots" + the sideways
	// scroll — they wrap to fit instead.
	const slotsWithContent = new Set<EquipSlotKey>();
	ownedClosetItems.forEach((i) =>
		slotsWithContent.add(slotForCategory(i.category)),
	);
	SLOT_ORDER.forEach((s) => {
		if (columnsForSlot(s).some((c) => activeIds[c])) slotsWithContent.add(s);
	});
	const visibleSlots = SLOT_ORDER.filter((s) => slotsWithContent.has(s));

	// Paper-doll arrangement: every equip slot is a chip split into two columns
	// that flank Rosie left + right.
	// Retired flags never enter visibleOwned, but keep this compatibility filter
	// until the legacy flag slot is removed from the shared slot schema.
	const flankSlots = visibleSlots.filter((s) => s !== "flag");

	// The equipped background, rendered as the scene inside the preview window —
	// a scoped version of the Barn's full-page background so you can preview it
	// here. HAT_IMAGES keys animated backgrounds to their frame-1 thumbnail, so
	// this resolves both static and animated ids (they animate live on the Barn).
	const bgId = activeIds["active_background_id"] ?? null;
	const bgPreviewSrc = bgId ? (HAT_IMAGES[bgId] ?? null) : null;
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
		const src = equippedId ? (HAT_THUMBNAILS_128[equippedId] ?? HAT_IMAGES[equippedId]) : null;
		const thumbSrc = src ?? (it ? categoryIcon(it.category) : null);
		return (
			<Pressable
				key={s}
				onPress={() => scrollToCategory(s)}
				style={({ pressed }) => [styles.slotChip, pressed && { opacity: 0.7 }]}
			>
				{equippedId && it ? (
					<IconButton
						name="x"
						label={`Remove ${it.name}`}
						onPress={() => onEquip(null, it.category)}
						variant="paper"
						iconSize={10}
						visualSize={20}
						strokeWidth={2.6}
						style={styles.slotRemove}
					/>
				) : null}
				<View style={[styles.slotThumb, { backgroundColor: SLOT_TINT[s] ?? WHIMSY.cream2 }]}>
					{thumbSrc ? (
						<Image source={thumbSrc} style={styles.slotThumbImg} resizeMode="contain" />
					) : (
						<Text style={styles.slotPlus}>+</Text>
					)}
				</View>
				<Text
					style={styles.slotLabel}
					numberOfLines={2}
				>
					{s === "background" ? "BG" : SLOT_LABEL[s]}
				</Text>
			</Pressable>
		);
	};

	return (
		<FlatList
			ref={listRef}
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
			data={closetRows}
			keyExtractor={(row) => row.key}
			initialNumToRender={10}
			maxToRenderPerBatch={6}
			windowSize={7}
			removeClippedSubviews
			onScrollToIndexFailed={({ index, averageItemLength }) => {
				listRef.current?.scrollToOffset({
					offset: Math.max(0, averageItemLength * index),
					animated: true
				});
			}}
			ListHeaderComponent={
				<>
					{prestigeOnly && (
						<View style={styles.prestigeFilter}>
							<View style={styles.prestigeFilterCopy}>
								<Glyph name="crown" size={18} />
								<Text style={styles.prestigeFilterText}>
									prestige gear earned from your Wallows
								</Text>
							</View>
							<Pressable
								onPress={onClearPrestigeFilter}
								disabled={!onClearPrestigeFilter}
								style={({ pressed }) => [
									styles.clearPrestigeFilter,
									pressed && { opacity: 0.65 },
								]}
								accessibilityRole="button"
								accessibilityLabel="Show all Closet items"
							>
								<Text style={styles.clearPrestigeFilterText}>Show all</Text>
							</Pressable>
						</View>
					)}
			{/* Paper-doll fitting room: Rosie centred, equip slots flank her,
			    then her nameplate. */}
			<View style={styles.previewCard}>
				<View style={styles.paperDoll}>
					<View style={styles.slotCol}>{leftSlots.map((s) => renderSlot(s))}</View>
					{/* Scene window: the equipped background fills a rounded window with
					    Rosie composited in front and a margin of scene around her so the
					    hat and aura read. Clipped (overflow hidden) — the aura's
					    baked radial falloff keeps that clip soft, no hard box. */}
					<View style={styles.pigWindow}>
						{bgPreviewSrc && (
									<Image source={bgPreviewSrc} style={styles.pigWindowBg} resizeMode="cover" />
						)}
						<View style={styles.pigVisualBox}>
							<View style={[styles.pigScaler, { transform: [{ scale }] }]}>
								<PigStage
									pigFrameIdx={pigFrameIdx}
									onPigFrame={setPigFrameIdx}
									equipped={slot("active_hat_id")}
									equippedGlasses={slot("active_glasses_id")}
									equippedMask={slot("active_mask_id")}
									equippedNeck={slot("active_neck_id")}
									equippedAura={slot("active_aura_id")}
									equippedHeld={slot("active_held_id")}
								/>
							</View>
						</View>
					</View>
					<View style={styles.slotCol}>{rightSlots.map((s) => renderSlot(s))}</View>
				</View>

				{/* Title chip — the pig's nameplate; tapping scrolls to Titles. */}
				{userId != null && (
							<Pressable
								onPress={scrollToTitles}
								style={({ pressed }) => [styles.titleChip, pressed && { opacity: 0.7 }]}
							>
						<Text style={styles.titleChipKicker}>title</Text>
						<Text
							style={[
								styles.titleChipName,
										activeTitleName == null && styles.titleChipNameEmpty
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
						★ Owned items dress Rosie. Unowned items open a preview.
					</Text>
				</View>
				{!prestigeOnly && (
					<FlatList
						horizontal
						data={CLOSET_FILTERS}
						keyExtractor={(item) => item.value}
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.filterRow}
						renderItem={({ item }) => {
							const selected = filter === item.value;
							return (
								<Pressable
									onPress={() => setFilter(item.value)}
									style={[
										styles.filterChip,
										selected && styles.filterChipSelected,
									]}
									accessibilityRole="radio"
									accessibilityState={{ selected }}
								>
									<Text
										style={[
											styles.filterChipText,
											selected && styles.filterChipTextSelected,
										]}
									>
										{item.label}
									</Text>
								</Pressable>
							);
						}}
					/>
				)}
					</>
				}
			renderItem={({ item: row }) => {
				if (row.kind === "section") {
					const collapsed = collapsedCategories.has(row.category);
					return (
						<Pressable
							onPress={() => toggleCategory(row.category)}
							style={({ pressed }) => [
								styles.sectionHead,
								pressed && { opacity: 0.7 },
							]}
							accessibilityRole="button"
							accessibilityState={{ expanded: !collapsed }}
							accessibilityLabel={`${CAT_LABEL[row.category] ?? row.category}, ${row.ownedCount} owned, ${row.missingCount} missing`}
						>
							<Text style={styles.sectionTitle}>{CAT_LABEL[row.category] ?? row.category}</Text>
							<View style={styles.sectionMeta}>
								<Text style={styles.sectionCount}>
									{row.ownedCount} owned · {row.missingCount} missing
								</Text>
								<Icon
									name="chevronDown"
									size={20}
									color={WHIMSY.ink}
									style={collapsed ? styles.sectionChevronCollapsed : undefined}
								/>
							</View>
						</Pressable>
					);
				}

				if (collapsedCategories.has(row.category)) return null;

				return (
					<View style={styles.gridRow}>
						{row.items.map((item) => {
							const active = isEquipped(item.id, item.category);
							const owned = ownedIds.has(item.id);
							const src = HAT_THUMBNAILS_256[item.id] ?? HAT_IMAGES[item.id];
							const thumbSrc = src ?? categoryIcon(item.category);
								return (
									<Pressable
										key={item.id}
										onPress={() => {
											Haptics.selectionAsync().catch(() => {});
											if (owned) onEquip(active ? null : item.id, item.category);
											else onPreview(item);
										}}
										style={({ pressed }) => [
										styles.itemCard,
										{ width: tileWidth },
										owned ? styles.itemCardOwned : styles.itemCardUnowned,
										active && styles.itemCardActive,
										pressed && { opacity: 0.7 }
									]}
									accessibilityRole="button"
									accessibilityLabel={`${item.name}, ${active ? "wearing" : owned ? "owned" : "not owned"}`}
									accessibilityHint={
										owned
											? active
												? "Removes this item from your pig"
												: "Equips this item on your pig"
											: item.members_only && !isVip
												? "Opens a preview; Slop Club membership is required"
												: "Opens a preview of this item"
									}
								>
										<View style={[styles.itemStripe, { backgroundColor: stripe(item.rarity) }]} />
									<View
										style={[
											styles.itemThumb,
											{
												width: tileWidth - 4,
											height: tileWidth - 4,
											backgroundColor: fill(item.rarity)
										},
										!owned && styles.itemThumbUnowned,
									]}
								>
									{thumbSrc ? (
										<Image
											source={thumbSrc}
											style={[
												{ width: thumbArt, height: thumbArt },
												!owned && styles.itemArtUnowned,
											]}
											resizeMode="contain"
										/>
												) : (
													<Glyph name="sparkle" size={40} style={{ opacity: 0.85 }} />
										)}
											{active && (
												<View style={styles.check}>
													<Icon name="check" size={11} color={WHIMSY.paper} strokeWidth={2.8} />
											</View>
										)}
										{!active && (
											<View
												style={[
													styles.ownershipBadge,
													owned
														? styles.ownershipBadgeOwned
														: styles.ownershipBadgeMissing,
												]}
											>
												<Icon
													name={owned ? "check" : "lock"}
													size={12}
													color={WHIMSY.ink}
													strokeWidth={2.6}
												/>
											</View>
										)}
									</View>
									<View
										style={[
											styles.itemFoot,
											!owned && styles.itemFootUnowned,
											active && styles.itemFootActive,
										]}
									>
										<Text
											style={[styles.itemName, !owned && styles.itemNameUnowned]}
											numberOfLines={1}
										>
											{item.name}
										</Text>
										<Text
											style={[
												styles.itemStatus,
												owned
													? styles.itemStatusOwned
													: styles.itemStatusUnowned,
											]}
										>
											{active
												? "Wearing"
												: owned
													? "Owned"
													: "Not owned"}
										</Text>
										</View>
									</Pressable>
								);
							})}
						</View>
				);
					}}
			ListEmptyComponent={
				<EmptyState
					glyph="search"
					title="No items match this filter"
					sub="Try another Closet filter."
				/>
			}
			ListFooterComponent={
				<>
					{userId != null && (
						<View style={styles.section}>
					<TitlesSection
						userId={userId}
						activeTitleId={activeTitleId}
						onChange={onTitleChange}
						onTitlesLoaded={handleTitlesLoaded}
					/>
				</View>
			)}
			<View style={{ height: 80 }} />
				</>
			}
		/>
	);
}

const styles = StyleSheet.create({
	prestigeFilter: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		marginBottom: SPACE.md,
		paddingLeft: SPACE.md,
		paddingRight: SPACE.xs,
		paddingVertical: SPACE.xs,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun
	},
	prestigeFilterCopy: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
	},
	prestigeFilterText: { ...TYPE.bodySm, flex: 1, color: WHIMSY.ink },
	clearPrestigeFilter: {
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: SPACE.md,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.paper,
	},
	clearPrestigeFilterText: { ...TYPE.label, color: WHIMSY.ink },
	root: { flex: 1 },
	content: { paddingHorizontal: SPACE.lg, paddingTop: 6 },
	previewCard: {
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		padding: 14,
		alignItems: "center",
		gap: SPACE.sm,
		...STICKER_SHADOW
	},
	// Paper-doll: flex columns flank Rosie so she stays centred no matter how many
	// slots each side has.
	paperDoll: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "stretch"
	},
	slotCol: {
		flex: 1,
		gap: SPACE.sm,
		alignItems: "center",
		justifyContent: "center"
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
		paddingBottom: 8
	},
	// Explicit numeric size (NOT inset:0 / percentage) — an inset-sized Image
	// hits RN's indefinite-size fallback and renders a centered intrinsic band
	// (see PageBackground's note). Cover-fills the window edge to edge.
	pigWindowBg: {
		position: "absolute",
		top: 0,
		left: 0,
		width: PIG_WINDOW_W,
		height: PIG_WINDOW_H
	},
	// The pig's displayed footprint. overflow:"visible" lets a tall hat spill up
	// into the window's headroom; pigWindow does the final clip at its edge.
	pigVisualBox: {
		width: PIG_PREVIEW,
		height: PIG_PREVIEW,
		overflow: "visible"
	},
	// Centers the 300² PigStage within the visual box; the scale transform
	// (passed inline) then fits it.
	pigScaler: {
		position: "absolute",
		left: (PIG_PREVIEW - PIG_CANVAS) / 2,
		top: (PIG_PREVIEW - PIG_CANVAS) / 2
	},
	slotChip: {
		width: 64,
		alignItems: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingVertical: 6,
		position: "relative",
		...SHADOW_SM
	},
	slotThumb: {
		width: 40,
		height: 40,
		borderRadius: RADII.sm,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden"
	},
	// Explicit pt size (not %) — see itemThumbImg for why.
	slotThumbImg: { width: 30, height: 30 },
	slotPlus: { fontSize: 22, color: WHIMSY.mute },
	slotLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 0.6,
		color: WHIMSY.mute,
		textTransform: "uppercase",
		marginTop: 4
	},
	// A small paper badge pinned to the chip's top-right corner. A bare ✕ over
	// the thumbnail art read as a stray mark colliding with the tile; the filled
	// badge + ink border makes it an intentional "remove" affordance sitting on
	// the corner. hitSlop (on the Pressable) keeps the tap target generous.
	slotRemove: {
		position: "absolute",
		top: -10,
		right: -10,
		zIndex: 3,
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
		borderRadius: RADII.md,
		paddingVertical: 5,
		paddingHorizontal: 16
	},
	titleChipKicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 0.6,
		color: WHIMSY.mute,
		textTransform: "uppercase"
	},
	titleChipName: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
		marginTop: 1
	},
	titleChipNameEmpty: { color: WHIMSY.mute },
	hint: {
		borderWidth: 1.5,
		borderColor: WHIMSY.mute,
		borderStyle: "dashed",
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream,
		paddingVertical: 9,
		paddingHorizontal: 14,
		marginVertical: SPACE.md
	},
	hintText: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.ink },
	filterRow: {
		gap: SPACE.sm,
		paddingBottom: SPACE.md,
	},
	filterChip: {
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: SPACE.md,
		borderRadius: RADII.pill,
		borderWidth: 1.5,
		borderColor: WHIMSY.muteSoft,
		backgroundColor: WHIMSY.paper,
	},
	filterChipSelected: {
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
	},
	filterChipText: { ...TYPE.label, color: WHIMSY.mute },
	filterChipTextSelected: { color: WHIMSY.ink },
	section: { marginBottom: 18 },
	sectionHead: {
		minHeight: 48,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		marginTop: SPACE.sm,
		marginBottom: SPACE.sm,
		paddingHorizontal: SPACE.xs,
	},
	sectionTitle: { fontFamily: FONTS.whimsy, fontSize: 20, color: WHIMSY.ink },
	sectionMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	sectionCount: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		letterSpacing: 0.6,
		textTransform: "uppercase"
	},
	sectionChevronCollapsed: { transform: [{ rotate: "-90deg" }] },
	gridRow: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 10
	},
	itemCard: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		overflow: "hidden",
		...SHADOW_SM
	},
	itemCardOwned: {
		borderColor: WHIMSY.ink,
	},
	itemCardUnowned: {
		borderColor: WHIMSY.muteSoft,
		shadowOpacity: 0.35,
	},
	itemCardActive: { borderColor: WHIMSY.lilacDeep },
	itemStripe: { height: 4, width: "100%" },
	itemThumb: {
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		position: "relative"
	},
	itemThumbUnowned: {
		backgroundColor: WHIMSY.cream2,
	},
	itemArtUnowned: {
		opacity: 0.42,
	},
	// NUMERIC absolute insets only. %-insets hit the same Yoga quirk as
	// %-sizes here (the aspectRatio-derived parent height isn't a definite
	// basis at resolve time), so the Image reverted to intrinsic px size
	// (1024² legendary art, 752×1584 backgrounds) and the overflow:hidden
	// backstop CROPPED it — giant zoomed art in every tile. Fixed-point
	// insets always resolve; resizeMode="contain" does the fitting.
	itemFoot: {
		borderTopWidth: 2,
		borderTopColor: WHIMSY.ink,
		paddingVertical: 6,
		paddingHorizontal: 8,
		backgroundColor: WHIMSY.paper
	},
	itemFootUnowned: {
		borderTopColor: WHIMSY.muteSoft,
		backgroundColor: WHIMSY.cream2,
	},
	itemFootActive: { backgroundColor: WHIMSY.lilac },
	itemName: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
		textAlign: "center"
	},
	itemNameUnowned: {
		color: WHIMSY.mute,
	},
	itemStatus: {
		...TYPE.label,
		textAlign: "center",
		marginTop: 2,
	},
	itemStatusOwned: {
		color: WHIMSY.ink,
	},
	itemStatusUnowned: {
		color: WHIMSY.mute,
	},
	ownershipBadge: {
		position: "absolute",
		top: 6,
		right: 6,
		zIndex: 3,
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	ownershipBadgeOwned: {
		backgroundColor: WHIMSY.sage,
	},
	ownershipBadgeMissing: {
		backgroundColor: WHIMSY.cream2,
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
		justifyContent: "center"
	}
});
