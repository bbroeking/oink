// The Closet — "dress up Rosie". The refined single-screen fitting room from the
// claude.ai/design handoff (Closet.html → ClosetFinal): a cream fitting-room
// card with a live pig preview and a row of equip-slot chips
// that map 1:1 to the browse sections below (only slots you actually own items in
// show — no mystery empty slots, no horizontal scroll), then left-aligned
// by-category grids of owned items. Tap an item to wear it; tap a slot's ✕ to take
// it off. Tiles carry a rarity stripe + tinted swatch and a clear lilac "ON" state.
// A title chip under the pig + a TitlesSection at the bottom make the Closet the
// canonical place to equip titles (the Shop's Titles tab stays for buying).
//
// Rebuilt on the design system (2026-09-11, wave 3 · area D): every surface is a
// `Sticker`, every capsule a `Chip`, every category crown a `SectionHeader`, and
// every string a text role. The living pig surface keeps its frame-sync per the
// 2026-07-16 ruling.
import { useCallback, useMemo, useRef, useState } from "react";
import {
	View,
	Image,
	FlatList,
	StyleSheet,
	useWindowDimensions
} from "react-native";
import * as Haptics from "expo-haptics";
import type { PigId } from "@/utils/pigs";
import {
	Button,
	Chip,
	EmptyState,
	Glyph,
	Icon,
	IconButton,
	PigStage,
	SectionHeader,
	Sticker,
	T,
} from "./ui";
import { TitlesSection } from "./TitlesSection";
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
	ART_SIZE,
	BORDER,
	OPACITY,
	WHIMSY,
	RADII,
	SPACE,
	TAB_SAFE,
	TAP_MIN,
	RARITY_BG_SOLID,
	RARITY_STRIPE,
	UI_COLORS,
} from "@/constants/theme";

// Explicit tile geometry. Yoga (this RN vintage) refuses to treat
// aspectRatio-derived heights as definite when resolving children — both
// %-sizes AND absolute insets fall back to the child's intrinsic px size,
// so big art cropped through every workaround. Measured numbers end it:
// COLS columns inside the content padding (16*2) with the grid's 10pt gaps.
interface Props {
	pigId?: PigId;
	active?: boolean;
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
	bow: WHIMSY.rose,
	face: WHIMSY.sky,
	neck: WHIMSY.rose,
	held: WHIMSY.sage,
	tickle: WHIMSY.lilac,
	aura: WHIMSY.peach,
	background: WHIMSY.cream2
};

// ── Drawing geometry ───────────────────────────────────────────────────────
// Measured boxes, not spacing steps: the paper-doll's slot chips, Rosie's
// scene window, the tile grid's gutter and the two corner badges. Named here so
// no style re-invents them (and so `SPACE` is never asked to mean "art size").
//
// Rosie's preview footprint in the paper-doll. Smaller than the old 200 so the
// equip-slot columns have room to flank her on both sides.
const PIG_PREVIEW = 150;
// The scene window behind Rosie is a touch wider + taller than she is so a
// margin of background shows all around her (room for the hat and aura to
// read). Capped so the flanking slot columns still clear a 64px chip on an SE
// (card inner width = SCREEN_W − 60; each column = (inner − PIG_WINDOW_W) / 2).
const PIG_WINDOW_W = 184;
const PIG_WINDOW_H = 210;
const SLOT_CHIP_W = 64;
// The "remove" badge rides the slot chip's corner, half off the edge.
const SLOT_REMOVE_INSET = -10;
const SLOT_REMOVE_ICON = 10;
const SLOT_REMOVE_VISUAL = 20;
const SLOT_THUMB_ART = 30;
const TITLE_CHIP_MAX_W = 240;
// Three tiles per row; the gutter is both the gap and the row rhythm.
const TILE_GAP = 10;
const TILE_INSET = 4;
const TILE_ART_INSET = 24;
const TILE_ART_MIN = 44;
// The rarity marker down the top edge of a tile. Borderless it measured
// 1.69–2.95:1 against its own panel, so it carries a hair of ink [D-02].
const STRIPE_H = 4;
const CHECK_BADGE = 22;
const BADGE_ICON = 12;
const CHECK_ICON = 11;
const BADGE_STROKE = 2.6;
const CHECK_STROKE = 2.8;
const SLOT_REMOVE_STROKE = 2.6;

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
	pigId = "rosie",
	active = true,
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
	const tileWidth = Math.floor((windowWidth - SPACE.lg * 2 - TILE_GAP * 2) / 3);
	const thumbArt = Math.max(TILE_ART_MIN, tileWidth - TILE_ART_INSET);
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
	// The merged Closet owns the whole collectible catalog. Retired orphans and
	// members items whose art has not landed stay hidden. Retired flag rows have
	// no registered artwork, so they fail the same asset-presence gate.
	const closetItems = useMemo(
		() =>
			allItems.filter(
				(i) =>
					!HIDDEN_CLOSET_IDS.has(i.id) &&
					(!i.members_only ||
						!!HAT_IMAGES[i.id] ||
						!!HAT_THUMBNAILS_256[i.id]) &&
					(!!HAT_IMAGES[i.id] || !!HAT_THUMBNAILS_256[i.id])
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
					!HIDDEN_CLOSET_IDS.has(item.id) &&
					(!!HAT_IMAGES[item.id] || !!HAT_THUMBNAILS_256[item.id]),
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
					viewOffset: SPACE.sm
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
	const flankSlots = visibleSlots;

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
		const slotName = s === "background" ? "BG" : SLOT_LABEL[s];
		return (
			<Sticker
				key={s}
				color="paper"
				rotate={0}
				radius={RADII.lg}
				shadow="sm"
				onPress={() => scrollToCategory(s)}
				accessibilityLabel={
					it ? `${slotName} slot, wearing ${it.name}` : `${slotName} slot, empty`
				}
				accessibilityHint="Jumps to this category in the Closet"
				style={styles.slotChip}
			>
				{equippedId && it ? (
					<IconButton
						name="x"
						label={`Remove ${it.name}`}
						onPress={() => onEquip(null, it.category)}
						variant="paper"
						iconSize={SLOT_REMOVE_ICON}
						visualSize={SLOT_REMOVE_VISUAL}
						strokeWidth={SLOT_REMOVE_STROKE}
						style={styles.slotRemove}
					/>
				) : null}
				<View style={[styles.slotThumb, { backgroundColor: SLOT_TINT[s] ?? WHIMSY.cream2 }]}>
					{thumbSrc ? (
						<Image source={thumbSrc} style={styles.slotThumbImg} resizeMode="contain" />
					) : (
						<Icon name="plus" size={ART_SIZE.glyphSm} color={UI_COLORS.uiMuted} />
					)}
				</View>
				<T
					role="kickerPillSm"
					tone="secondary"
					align="center"
					numberOfLines={2}
					style={styles.slotLabel}
				>
					{slotName}
				</T>
			</Sticker>
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
						<Sticker
							color="sun"
							rotate={0}
							radius={RADII.md}
							shadow="sm"
							style={styles.prestigeFilter}
						>
							<View style={styles.prestigeFilterCopy}>
								<Glyph name="crown" size={ART_SIZE.glyphSm} />
								<T role="bodySm" style={styles.prestigeFilterText}>
									prestige gear earned from your Wallows
								</T>
							</View>
							<Button
								variant="ghost"
								size="sm"
								onPress={() => onClearPrestigeFilter?.()}
								disabled={!onClearPrestigeFilter}
								accessibilityLabel="Show all Closet items"
								accessibilityHint="Clears the prestige-only filter"
							>
								Show all
							</Button>
						</Sticker>
					)}
			{/* Paper-doll fitting room: Rosie centred, equip slots flank her,
			    then her nameplate. */}
			<Sticker color="cream" rotate={0} radius={RADII.xl} pad style={styles.previewCard}>
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
									active={active}
									pigId={pigId}
									pigFrameIdx={pigFrameIdx}
									onPigFrame={setPigFrameIdx}
									equipped={slot("active_hat_id")}
									equippedBow={slot("active_bow_id")}
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
							<Sticker
								color="paper"
								rotate={0}
								radius={RADII.md}
								shadow="none"
								onPress={scrollToTitles}
								accessibilityLabel={
									activeTitleName
										? `Title: ${activeTitleName}`
										: "No title chosen"
								}
								accessibilityHint="Scrolls to your titles"
								style={styles.titleChip}
							>
						<T role="kickerPillSm" tone="secondary">title</T>
						<T
							role="cardTitleSm"
							tone={activeTitleName == null ? "secondary" : "primary"}
							numberOfLines={1}
							style={styles.titleChipName}
						>
							{activeTitleName ?? "No title — tap to pick"}
						</T>
					</Sticker>
				)}
			</Sticker>

				<Sticker
					color="cream"
					rotate={0}
					radius={RADII.md}
					border={BORDER.thin}
					borderStyle="dashed"
					shadow="none"
					style={styles.hint}
				>
					<T role="hand">
						★ Owned items dress Rosie. Unowned items open a preview.
					</T>
				</Sticker>
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
								<Chip
									label={item.label}
									tone={selected ? "sun" : "paper"}
									selected={selected}
									onPress={() => setFilter(item.value)}
									accessibilityLabel={`${item.label} items`}
									accessibilityHint="Filters the Closet catalog"
								/>
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
						<Sticker
							color="cream"
							rotate={0}
							border={0}
							shadow="none"
							onPress={() => toggleCategory(row.category)}
							accessibilityState={{ expanded: !collapsed }}
							accessibilityLabel={`${CAT_LABEL[row.category] ?? row.category}, ${row.ownedCount} owned, ${row.missingCount} missing`}
							accessibilityHint={
								collapsed ? "Opens this category" : "Collapses this category"
							}
							style={styles.sectionHead}
						>
							<SectionHeader
								title={CAT_LABEL[row.category] ?? row.category}
								right={
									<>
										<T role="kickerPillSm" tone="secondary">{row.ownedCount} owned · {row.missingCount} missing</T>
										<Icon
											name="chevronDown"
											size={ART_SIZE.glyphSm}
											color={WHIMSY.ink}
											style={collapsed ? styles.sectionChevronCollapsed : undefined}
										/>
									</>
								}
								style={styles.sectionHeader}
							/>
						</Sticker>
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
									<Sticker
										key={item.id}
										color="paper"
										rotate={0}
										radius={RADII.lg}
										shadow="sm"
										onPress={() => {
											Haptics.selectionAsync().catch(() => {});
											if (owned) onEquip(active ? null : item.id, item.category);
											else onPreview(item);
										}}
										style={[
										styles.itemCard,
										{ width: tileWidth },
										owned ? styles.itemCardOwned : styles.itemCardUnowned,
										active && styles.itemCardActive,
									]}
									accessibilityState={{ selected: active }}
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
												width: tileWidth - TILE_INSET,
											height: tileWidth - TILE_INSET,
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
													<Glyph name="sparkle" size={ART_SIZE.glyph} style={styles.artFallback} />
										)}
											{active && (
												<View style={styles.check}>
													<Icon name="check" size={CHECK_ICON} color={WHIMSY.paper} strokeWidth={CHECK_STROKE} />
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
													size={BADGE_ICON}
													color={WHIMSY.ink}
													strokeWidth={BADGE_STROKE}
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
										<T
											role="cardTitleSm"
											tone={owned ? "primary" : "secondary"}
											align="center"
											numberOfLines={1}
										>
											{item.name}
										</T>
										<T
											role="label"
											tone={owned ? "primary" : "secondary"}
											align="center"
											style={styles.itemStatus}
										>
											{active
												? "Wearing"
												: owned
													? "Owned"
													: "Not owned"}
										</T>
										</View>
									</Sticker>
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
					action={
						filter === "all" ? undefined : (
							<Button
								variant="handLink"
								size="sm"
								onPress={() => setFilter("all")}
								accessibilityLabel="Show every Closet item"
								accessibilityHint="Clears the Closet filter"
							>
								Show every item ›
							</Button>
						)
					}
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
			<View style={styles.tabSpacer} />
				</>
			}
		/>
	);
}

const styles = StyleSheet.create({
	prestigeFilter: {
		minHeight: TAP_MIN,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		marginBottom: SPACE.md,
		paddingLeft: SPACE.md,
		paddingRight: SPACE.xs,
		paddingVertical: SPACE.xs,
	},
	prestigeFilterCopy: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
	},
	prestigeFilterText: { flex: 1 },
	root: { flex: 1 },
	content: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm },
	previewCard: {
		alignItems: "center",
		gap: SPACE.sm,
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
		borderRadius: RADII.xl,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "flex-end",
		paddingBottom: SPACE.sm
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
		width: SLOT_CHIP_W,
		alignItems: "center",
		paddingVertical: SPACE.xs,
		position: "relative",
	},
	slotThumb: {
		width: ART_SIZE.glyph,
		height: ART_SIZE.glyph,
		borderRadius: RADII.sm,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden"
	},
	// Explicit pt size (not %) — see itemThumbImg for why.
	slotThumbImg: { width: SLOT_THUMB_ART, height: SLOT_THUMB_ART },
	slotLabel: {
		marginTop: SPACE.xs
	},
	// A small paper badge pinned to the chip's top-right corner. A bare ✕ over
	// the thumbnail art read as a stray mark colliding with the tile; the filled
	// badge + ink border makes it an intentional "remove" affordance sitting on
	// the corner. hitSlop (on the Pressable) keeps the tap target generous.
	slotRemove: {
		position: "absolute",
		top: SLOT_REMOVE_INSET,
		right: SLOT_REMOVE_INSET,
		zIndex: 3,
	},
	// Nameplate pill under the pig. minHeight 44 keeps it a full-size
	// tap target without hitSlop.
	titleChip: {
		marginTop: SPACE.xs,
		minHeight: TAP_MIN,
		maxWidth: TITLE_CHIP_MAX_W,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.lg
	},
	titleChipName: {
		marginTop: 1
	},
	hint: {
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.card,
		marginVertical: SPACE.md,
		borderColor: UI_COLORS.uiMuted,
	},
	filterRow: {
		gap: SPACE.sm,
		paddingBottom: SPACE.md,
	},
	section: { marginBottom: SPACE.lg },
	sectionHead: {
		minHeight: TAP_MIN,
		justifyContent: "center",
		marginTop: SPACE.sm,
		paddingHorizontal: SPACE.xs,
	},
	sectionHeader: { marginBottom: 0 },
	sectionChevronCollapsed: { transform: [{ rotate: "-90deg" }] },
	gridRow: {
		flexDirection: "row",
		gap: TILE_GAP,
		marginBottom: TILE_GAP
	},
	itemCard: {
		overflow: "hidden",
	},
	itemCardOwned: {
		borderColor: UI_COLORS.border,
	},
	itemCardUnowned: {
		borderColor: UI_COLORS.uiMuted,
	},
	itemCardActive: { borderColor: WHIMSY.lilacDeep },
	// The rarity marker. Borderless it failed 3:1 against its own panel, so it
	// closes with a hair of ink. [D-02] (2026-09-11)
	itemStripe: {
		height: STRIPE_H,
		width: "100%",
		borderBottomWidth: 1,
		borderBottomColor: UI_COLORS.border,
	},
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
		opacity: OPACITY.ghost,
	},
	artFallback: { opacity: OPACITY.pressed },
	// NUMERIC absolute insets only. %-insets hit the same Yoga quirk as
	// %-sizes here (the aspectRatio-derived parent height isn't a definite
	// basis at resolve time), so the Image reverted to intrinsic px size
	// (1024² legendary art, 752×1584 backgrounds) and the overflow:hidden
	// backstop CROPPED it — giant zoomed art in every tile. Fixed-point
	// insets always resolve; resizeMode="contain" does the fitting.
	itemFoot: {
		borderTopWidth: BORDER.ink,
		borderTopColor: UI_COLORS.border,
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		backgroundColor: WHIMSY.paper
	},
	itemFootUnowned: {
		borderTopColor: UI_COLORS.uiMuted,
		backgroundColor: WHIMSY.cream2,
	},
	itemFootActive: { backgroundColor: WHIMSY.lilac },
	itemStatus: {
		marginTop: SPACE.xxs,
	},
	ownershipBadge: {
		position: "absolute",
		top: SPACE.xs,
		right: SPACE.xs,
		zIndex: 3,
		width: ART_SIZE.glyphSm,
		height: ART_SIZE.glyphSm,
		borderRadius: ART_SIZE.glyphSm / 2,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
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
		top: SPACE.xs,
		right: SPACE.xs,
		zIndex: 3,
		width: CHECK_BADGE,
		height: CHECK_BADGE,
		borderRadius: CHECK_BADGE / 2,
		backgroundColor: WHIMSY.lilacDeep,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center"
	},
	tabSpacer: { height: TAB_SAFE }
});
