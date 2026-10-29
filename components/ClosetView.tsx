// The Closet — "dress up Rosie". The refined single-screen fitting room from the
// claude.ai/design handoff (Closet.html → ClosetFinal): a cream fitting-room
// card with a live pig preview and a row of equip-slot chips
// that map 1:1 to the browse sections below (only slots you actually own items in
// show — no mystery empty slots, no horizontal scroll), then left-aligned
// by-category grids of owned items. Tap an item to wear it; tap a slot's ✕ to take
// it off. Tiles carry a rarity stripe + tinted swatch and a clear lilac "ON" state.
// A title chip under the pig opens the Titles picker — the Closet is where a
// title is worn (titles are earned, never sold). The old Titles footer at the
// bottom of the catalog went with it (the shop-IA pass, 2026-09-17).
//
// Rebuilt on the design system (2026-09-11, wave 3 · area D): every surface is a
// `Sticker`, every capsule a `Chip`, every category crown a `SectionHeader`, and
// every string a text role. The living pig surface keeps its frame-sync per the
// 2026-07-16 ruling.
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	View,
	Image,
	FlatList,
	StyleSheet,
	useWindowDimensions,
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
} from "react-native";
import * as Haptics from "expo-haptics";
import type { PigId } from "@/utils/pigs";
import {
	Button,
	EmptyState,
	Glyph,
	Icon,
	IconButton,
	PigStage,
	SectionHeader,
	SegmentedControl,
	Sticker,
	T,
	Tag,
} from "./ui";
import { TitlesPickerSheet } from "./TitlesPickerSheet";
import { useTitles } from "@/hooks/useTitles";
import {
	HAT_IMAGES,
	HAT_THUMBNAILS_128,
	HAT_THUMBNAILS_256,
	HatRow,
	PIG_CANVAS
} from "@/constants/hats";
import { categoryIcon } from "@/constants/emojiArt";
import { cosmeticAccessibility } from "@/utils/cosmetics";
import { cardBadge, cardTag, cardTagFace } from "@/utils/shopShelves";
import { isCostumeCategory, isKnownCostumeId, pigCanWearCostume } from "@/utils/costumeFit";
import {
	COSTUME_FITS_ROSIE_TAG,
	costumeOnLine,
	isCoveredByCostume,
} from "@/utils/costumeCopy";
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
	CHROME_TYPE_CAP,
	OPACITY,
	WHIMSY,
	RADII,
	SHADOW_SM,
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
	// Titles wiring — the equipped id lives in shop.tsx (the same source the
	// profile read fills); this view owns the nameplate chip and the picker
	// behind it.
	userId: string | null;
	activeTitleId: string | null;
	onTitleChange: (next: string | null) => void;
	// Kept in the public component contract while the Shop owns membership
	// state; the Closet itself has no member-only controls.
	isVip?: boolean;
	// What a catalog tile needs to wear the SHELF's tag (the one card grammar,
	// 2026-09-17): which items are on a shelf today, and what is in the pocket
	// to pay with.
	buyableIds?: ReadonlySet<string>;
	counter?: number;
	// The store, rendered INSIDE this list's header — between the fitting room
	// and the closet's own body (the hero fitting room, 2026-09-17). The Shop
	// tab has one scroller now; this is it. When present the header also grows
	// the "Your closet" crown.
	storeContent?: ReactNode;
	// Fires when the fitting room scrolls off the top (and back on). The store
	// rests the hero pig on this.
	onFoldChange?: (folded: boolean) => void;
	// How much of the top of this list something else is sitting on.
	// `scrollToCloset` lands the crown just under it. (The folded strip that
	// sat there retired 2026-09-18.)
	closetScrollInset?: number;
	// The catalog rows of what the pig is wearing, hidden categories included
	// (useShopCatalog's `wornItems`). The slots name and take off a worn item
	// from these when `allItems` (the shoppable catalog) does not carry it.
	wornItems?: HatRow[];
	// The page's own scroll listener — the crown's `useScrollEdge().onScroll`,
	// so the fitting room slides under the crown's drawn edge instead of being
	// cut by an invisible one. Composed with the fold. (polish pass, 2026-10-04)
	onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/** What the store drives from outside: one scroll, one destination. */
export interface ClosetViewHandle {
	/** Scroll this list to the "Your closet" crown. */
	scrollToCloset: () => void;
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

// The category a profiles column clears through — so a worn item the catalog
// cannot name (a retired id) can still be taken off its slot. equipCosmetic
// routes by category, and each of these resolves back to its own column.
const COLUMN_CATEGORY: Record<string, string> = {
	active_hat_id: "hat",
	active_bow_id: "bow",
	active_glasses_id: "glasses",
	active_mask_id: "mask",
	active_neck_id: "necklace",
	active_held_id: "held",
	active_aura_id: "aura",
	active_background_id: "background",
	active_tickle_particle_id: "tickle_particle",
	active_costume_id: "costume",
};

// Category sections, in order, with player-facing headings.
const CAT_ORDER = [
	// Halloween 2026 full costumes lead while the season is on: wearing one
	// hides the rest of the outfit (utils/costumeFit.ts).
	"costume",
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
	costume: "Costumes",
	hat: "Hats",
	bow: "Bows",
	glasses: "Glasses",
	mask: "Masks",
	scarf: "Scarves",
	necklace: "Necklaces",
	held: "Held",
	aura: "Auras",
	// Was the two-letter dev shorthand for background; a background is the
	// scenery behind the pig, and the slot chip above calls it a Scene.
	// (polish pass, 2026-10-04)
	background: "Scenes",
	tickle_particle: "Tickle Effects"
};

// Per-rarity swatch fill + stripe — the light panel (RARITY_BG_SOLID) and the
// saturated marker (RARITY_STRIPE) from the shared rarity tokens (theme.ts).
const fill = (r: string | undefined) => RARITY_BG_SOLID[r ?? "common"] ?? RARITY_BG_SOLID.common;
const stripe = (r: string | undefined) => RARITY_STRIPE[r ?? "common"] ?? RARITY_STRIPE.common;

// Paper-doll: a signature WHIMSY tint per equip slot, painted behind the slot's
// item/category icon so the slots flanking Rosie read as a colourful dress-up tray.
const SLOT_TINT: Record<string, string> = {
	costume: WHIMSY.lilac,
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
// read). PIG_WINDOW_W is its widest; the window is the paper doll's ONE
// yielding child. The old comment budgeted an SE inner width of SCREEN_W − 60
// (315pt), but the card spends 64 (the list's 16 a side, the Sticker's 2pt
// border and 14pt pad a side): 311pt left two flex columns 63.5pt each for a
// 64pt chip plus its 2pt shadow, so the chips sat on the window's edges
// (117-se-shop, polish pass 2026-10-04). The columns now state their width and
// the window gives: 311 − 2 × 66 − 2 × 8 = 163pt on an SE, never less than
// the pig it frames.
const PIG_WINDOW_W = 184;
const PIG_WINDOW_H = 210;
const SLOT_CHIP_W = 64;
/** A slot column: the chip plus the hard shadow it throws to the right. */
const SLOT_COL_W = SLOT_CHIP_W + SHADOW_SM.shadowOffset.width;
// The "remove" badge rides the slot chip's corner, half off the edge.
const SLOT_REMOVE_INSET = -10;
const SLOT_REMOVE_ICON = 10;
const SLOT_REMOVE_VISUAL = 20;
const SLOT_THUMB_ART = 30;
const TITLE_CHIP_MAX_W = 240;
// Three tiles per row; the gutter is both the gap and the row rhythm.
const TILE_GAP = 10;
/**
 * How many lines a tile's name may take. The name speaks in `label` (Nunito
 * ExtraBold 12, the fence row's and the ticket's tile voice), not the
 * Caprasimo card title: measured across the 217 closet items in a 3-up tile,
 * Caprasimo needed three lines for 42 names at default size on an SE and could
 * not fit "Masquerade", "Magnifying" or "Champions'" on a line at all, so it
 * truncated ("Squire Fea…"). In `label`, with the foot's inset at SPACE.xs,
 * every name fits in three lines with no word broken, at 1.0x and at the
 * CHROME_TYPE_CAP ceiling, on the SE and the 17 Pro. (polish pass, 2026-10-04)
 */
const TILE_NAME_LINES = 3;
/** The title chip's name may wrap once rather than end in "…". */
const TITLE_CHIP_LINES = 2;
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
// The list's own top inset. Named because the imperative scroll has to add it
// back: `onLayout` inside `ListHeaderComponent` measures from the header's
// wrapper, which starts one content-padding down.
const CONTENT_TOP = SPACE.sm;
/** One frame at 60fps — the fold reads the offset, it does not animate on it. */
const SCROLL_THROTTLE = 16;
/**
 * The fold's hysteresis band: it takes this much scrolling back UP to unfold
 * again, so a one-pixel rubber-band wobble at the seam can never flicker the
 * store's folded strip in and out.
 */
const FOLD_BAND = SPACE.xl;

type ClosetListRow =
	| {
			kind: "section";
			key: string;
			category: string;
			ownedCount: number;
			/** Every design in this category, owned or not — the crown reads "4 of 21". */
			totalCount: number;
	  }
	| { kind: "items"; key: string; category: string; items: HatRow[] };

// The catalog opens on what is YOURS (the shop-IA pass, 2026-09-17): "Your
// closet" used to crown 127 items behind five chips, so the number on the sign
// and the contents of the section disagreed. Three segments now, Owned first —
// the closet IS the Owned segment.
type ClosetFilter = "owned" | "all" | "member";

const CLOSET_FILTER_LABEL: Record<ClosetFilter, string> = {
	owned: "Owned",
	all: "All",
	member: "Members",
};
const CLOSET_FILTER_ORDER: ClosetFilter[] = ["owned", "all", "member"];
/** What the crown's right slot says about the segment you are standing in. */
const CLOSET_FILTER_CROWN: Record<ClosetFilter, (n: number) => string> = {
	owned: (n) => `${n} owned`,
	all: (n) => `${n} in all`,
	member: (n) => `${n} for members`,
};

export const ClosetView = forwardRef<ClosetViewHandle, Props>(function ClosetView(
	{
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
		buyableIds,
		counter = 0,
		storeContent,
		closetScrollInset = 0,
		onFoldChange,
		wornItems,
		onScroll,
	}: Props,
	ref,
) {
	const { width: windowWidth } = useWindowDimensions();
	const tileWidth = Math.floor((windowWidth - SPACE.lg * 2 - TILE_GAP * 2) / 3);
	const thumbArt = Math.max(TILE_ART_MIN, tileWidth - TILE_ART_INSET);
	const listRef = useRef<FlatList<ClosetListRow>>(null);
	// The one titles read: the nameplate chip resolves the worn title's name
	// from it, and the picker it opens lists from the same rows.
	const titles = useTitles(userId);
	const [titlesOpen, setTitlesOpen] = useState(false);
	// Living mood surface: track the live sprite frame so equipped items ride
	// along with the breathing pig (same wiring as SwipeElement).
	const [pigFrameIdx, setPigFrameIdx] = useState(0);
	const [filter, setFilter] = useState<ClosetFilter>("owned");
	const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
		() => new Set(),
	);
	const toggleCategory = useCallback((category: string) => {
		setCollapsedCategories((current) => {
			const next = new Set(current);
			if (next.has(category)) next.delete(category);
			else next.add(category);
			return next;
		});
	}, []);

	// The shoppable catalog first, then the worn rows it leaves out (a hidden
	// category), so a slot can always name what the pig has on.
	const byId = useRef<Map<string, HatRow>>(new Map());
	byId.current = new Map(
		[...(wornItems ?? []), ...allItems].map((i) => [i.id, i]),
	);
	// The window's measured width: it yields on a narrow phone, and the scene
	// behind the pig must cover the window it actually got.
	const [pigWindowW, setPigWindowW] = useState(PIG_WINDOW_W);

	// Build a PigStage slot ({id, category, emoji}) from a profiles column.
	const slot = (column: string) => {
		const id = activeIds[column];
		if (!id) return null;
		const it = byId.current.get(id);
		return { id, category: it?.category ?? null, emoji: it?.emoji ?? null };
	};

	const scale = PIG_PREVIEW / PIG_CANVAS;

	// A worn full costume (canvas direction A, 2026-10-29) covers every worn
	// slot: those chips fall asleep with an "under" tag, and a hand line under
	// Rosie names what waits. Only on a pig the costume fits (v1: Rosie).
	const costumeCanFit = pigCanWearCostume(pigId);
	const wornCostumeId = activeIds["active_costume_id"] ?? null;
	const costumeOn = costumeCanFit && isKnownCostumeId(wornCostumeId);
	const costumeName = costumeOn && wornCostumeId
		? (byId.current.get(wornCostumeId)?.name ?? null)
		: null;

	// Display name on the preview chip: resolved name, "…" while the owned
	// rows are still loading, or the pick prompt when nothing is equipped.
	const activeTitleName = activeTitleId
		? (titles.owned.find((t) => t.id === activeTitleId)?.name ?? "…")
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
				if (filter === "owned") return owned;
				if (filter === "member") return !!item.members_only;
				return true;
			}),
		[closetItems, filter, ownedIds],
	);
	// Each segment wears its own count, so the word and the number in the crown
	// can never disagree with the tiles underneath them.
	const filterCounts = useMemo<Record<ClosetFilter, number>>(
		() => ({
			owned: closetItems.filter((item) => ownedIds.has(item.id)).length,
			all: closetItems.length,
			member: closetItems.filter((item) => !!item.members_only).length,
		}),
		[closetItems, ownedIds],
	);
	const filterOptions = useMemo(
		() =>
			CLOSET_FILTER_ORDER.map((value) => ({
				value,
				label: `${CLOSET_FILTER_LABEL[value]} · ${filterCounts[value].toLocaleString()}`,
				accessibilityLabel: `${CLOSET_FILTER_LABEL[value]}, ${filterCounts[value]} items`,
				accessibilityHint: "Filters the catalog",
			})),
		[filterCounts],
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
	const categoryTotals = useMemo(() => {
		const next: Record<string, { owned: number; total: number }> = {};
		for (const item of closetItems) {
			const c = item.category ?? "hat";
			const row = (next[c] ??= { owned: 0, total: 0 });
			row.total += 1;
			if (ownedIds.has(item.id)) row.owned += 1;
		}
		return next;
	}, [closetItems, ownedIds]);
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
				// Counted against the whole category, not the segment's slice: under
				// Owned every tile is owned, and "4 owned · 0 missing" said nothing.
				ownedCount: categoryTotals[category]?.owned ?? 0,
				totalCount: categoryTotals[category]?.total ?? 0,
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
	}, [groups, categoryTotals]);

	// A slot chip jumps to its section. Under a filter that hides every item of
	// that slot (the Members segment and a bow, say) the chip used to do
	// nothing at all; it now opens the whole rack and lands there once the rows
	// have rebuilt. (polish pass, 2026-10-04)
	const pendingCategory = useRef<string | null>(null);
	const landOnCategory = useCallback(
		(category: string) => {
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
		},
		[categoryIndex]
	);
	const scrollToCategory = useCallback(
		(slotKey: EquipSlotKey) => {
			const category = CAT_ORDER.find(
				(candidate) => slotForCategory(candidate) === slotKey && categoryIndex[candidate] != null
			);
			if (category != null) {
				landOnCategory(category);
				return;
			}
			const anywhere = CAT_ORDER.find(
				(candidate) =>
					slotForCategory(candidate) === slotKey &&
					(categoryTotals[candidate]?.total ?? 0) > 0
			);
			if (anywhere != null && filter !== "all") {
				pendingCategory.current = anywhere;
				setFilter("all");
			}
		},
		[categoryIndex, categoryTotals, filter, landOnCategory]
	);
	useEffect(() => {
		const category = pendingCategory.current;
		if (category == null || categoryIndex[category] == null) return;
		pendingCategory.current = null;
		requestAnimationFrame(() => landOnCategory(category));
	}, [categoryIndex, landOnCategory]);

	/** Back to the top of the one scroll — the shelves, from the bare rack. */
	const scrollToTop = useCallback(() => {
		listRef.current?.scrollToOffset({ offset: 0, animated: true });
	}, []);

	// ── The one scroll's two measurements (the hero fitting room, 2026-09-17)
	// The fitting room's height decides when the folded strip appears; the
	// closet crown's offset is where "Closet" scrolls to. Both are measured off
	// blocks inside `ListHeaderComponent`, so both add the content's top inset.
	const fittingRoomH = useRef(0);
	const closetAnchorY = useRef(0);
	const folded = useRef(false);
	// A scroll asked for before the crown has laid out (a deep link landing on
	// a cold list) waits for the measurement rather than scrolling to nowhere.
	const closetPending = useRef(false);

	const scrollToClosetOffset = useCallback(() => {
		listRef.current?.scrollToOffset({
			offset: Math.max(
				0,
				CONTENT_TOP + closetAnchorY.current - closetScrollInset,
			),
			animated: true,
		});
	}, [closetScrollInset]);
	const scrollToCloset = useCallback(() => {
		if (closetAnchorY.current > 0) scrollToClosetOffset();
		else closetPending.current = true;
	}, [scrollToClosetOffset]);
	useImperativeHandle(ref, () => ({ scrollToCloset }), [scrollToCloset]);

	const handleFittingRoomLayout = useCallback((e: LayoutChangeEvent) => {
		fittingRoomH.current = e.nativeEvent.layout.height;
	}, []);
	const handleClosetAnchorLayout = useCallback(
		(e: LayoutChangeEvent) => {
			closetAnchorY.current = e.nativeEvent.layout.y;
			if (closetPending.current && closetAnchorY.current > 0) {
				closetPending.current = false;
				requestAnimationFrame(scrollToClosetOffset);
			}
		},
		[scrollToClosetOffset],
	);
	const handleScroll = useCallback(
		(e: NativeSyntheticEvent<NativeScrollEvent>) => {
			const y = e.nativeEvent.contentOffset.y;
			onScroll?.(e);
			if (onFoldChange && fittingRoomH.current > 0) {
				const foldAt = CONTENT_TOP + fittingRoomH.current;
				// A band, not a line: a one-pixel rubber-band wobble at the seam
				// must not flicker the strip in and out.
				const next = folded.current ? y > foldAt - FOLD_BAND : y >= foldAt;
				if (next !== folded.current) {
					folded.current = next;
					onFoldChange(next);
				}
			}
		},
		[onFoldChange, onScroll],
	);

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
	// that section, ✕ takes it off. What the chip SAYS follows what it DRAWS:
	// a slot holding an item the shoppable catalog leaves out (a hidden-category
	// scarf) used to draw the bandana, announce "Neck slot, empty" and offer no
	// ✕ (055-shop-top). The name now comes from the worn rows as well, and the
	// ✕ clears the slot's own column even for an id nothing can name.
	const renderSlot = (s: EquipSlotKey) => {
		const equippedColumn =
			columnsForSlot(s).find((c) => activeIds[c]) ?? null;
		const equippedId = equippedColumn ? activeIds[equippedColumn] : null;
		const it = equippedId ? byId.current.get(equippedId) : null;
		const src = equippedId ? (HAT_THUMBNAILS_128[equippedId] ?? HAT_IMAGES[equippedId]) : null;
		const thumbSrc = src ?? (it ? categoryIcon(it.category) : null);
		const slotName = SLOT_LABEL[s];
		const removeCategory =
			it?.category ?? (equippedColumn ? COLUMN_CATEGORY[equippedColumn] : null);
		// Only a slot with a section somewhere in the rack is a door to it; the
		// legacy scarf's Neck slot has none, so it is a plain label there.
		const jumpable = CAT_ORDER.some(
			(category) =>
				slotForCategory(category) === s &&
				(categoryTotals[category]?.total ?? 0) > 0,
		);
		const asleep = costumeOn && isCoveredByCostume(s);
		const under = asleep && !!equippedId;
		const wearing = equippedId
			? `${slotName} slot, wearing ${it?.name ?? "something"}${under ? `, tucked under ${costumeName ?? "the costume"}` : ""}`
			: `${slotName} slot, empty`;
		// The ✕ is the chip's SIBLING, drawn over its corner: nested inside the
		// pressable chip it was part of one VoiceOver element (an accessible
		// Pressable is a leaf on iOS), so a screen-reader player could hear the
		// slot but never reach its ✕. (polish pass, 2026-10-04)
		return (
			<View key={s} style={styles.slotWrap}>
			<Sticker
				color={asleep ? "cream2" : "paper"}
				rotate={0}
				radius={RADII.lg}
				shadow={asleep ? "none" : "sm"}
				onPress={jumpable ? () => scrollToCategory(s) : undefined}
				accessibilityRole={jumpable ? "button" : "text"}
				accessibilityLabel={wearing}
				accessibilityHint={
					jumpable ? "Scrolls down to the items for this slot" : undefined
				}
				style={styles.slotChip}
			>
				<View
					style={[
						styles.slotThumb,
						{ backgroundColor: asleep ? WHIMSY.cream2 : (SLOT_TINT[s] ?? WHIMSY.cream2) },
					]}
				>
					{thumbSrc ? (
						<Image
							source={thumbSrc}
							style={[styles.slotThumbImg, asleep && styles.slotThumbImgAsleep]}
							resizeMode="contain"
						/>
					) : (
						<Icon name="plus" size={ART_SIZE.glyphSm} color={UI_COLORS.uiMuted} />
					)}
				</View>
				{/* One line, always, at a stated ceiling: the chip cannot grow
				    sideways, so past it the label stops growing instead of
				    breaking mid-word ("HEL/D", 106-dyntype-ax-large-shop). Every
				    label is measured to fit the chip at CHROME_TYPE_CAP
				    (constants/slots.ts), so the two columns stay level. */}
				<T
					role="kickerPillSm"
					tone="secondary"
					align="center"
					numberOfLines={1}
					maxFontSizeMultiplier={CHROME_TYPE_CAP}
					style={styles.slotLabel}
				>
					{slotName}
				</T>
				{under ? (
					<Tag
						label="under"
						tone="lilac"
						flat
						maxFontSizeMultiplier={CHROME_TYPE_CAP}
						style={styles.slotUnder}
					/>
				) : null}
			</Sticker>
				{equippedId && removeCategory ? (
					<IconButton
						name="x"
						label={it ? `Take off ${it.name}` : `Take off the ${slotName.toLowerCase()} item`}
						onPress={() => onEquip(null, removeCategory)}
						variant="paper"
						iconSize={SLOT_REMOVE_ICON}
						visualSize={SLOT_REMOVE_VISUAL}
						strokeWidth={SLOT_REMOVE_STROKE}
						style={styles.slotRemove}
					/>
				) : null}
			</View>
		);
	};


	return (
		<>
		<FlatList
			ref={listRef}
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
			onScroll={onFoldChange || onScroll ? handleScroll : undefined}
			scrollEventThrottle={SCROLL_THROTTLE}
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
				<View>
					<View onLayout={handleFittingRoomLayout}>
			{/* Paper-doll fitting room: Rosie centred, equip slots flank her,
			    then her nameplate. In the store this is the page's hero, and it
			    folds to a strip once it scrolls off (2026-09-17). */}
			<Sticker color="cream" rotate={0} radius={RADII.xl} pad style={styles.previewCard}>
				<View style={styles.paperDoll}>
					<View style={styles.slotCol}>{leftSlots.map((s) => renderSlot(s))}</View>
					{/* Scene window: the equipped background fills a rounded window with
					    Rosie composited in front and a margin of scene around her so the
					    hat and aura read. Clipped (overflow hidden) — the aura's
					    baked radial falloff keeps that clip soft, no hard box. */}
					<View
						style={styles.pigWindow}
						onLayout={(e: LayoutChangeEvent) =>
							setPigWindowW(e.nativeEvent.layout.width)
						}
					>
						{bgPreviewSrc && (
									<Image
										source={bgPreviewSrc}
										style={[styles.pigWindowBg, { width: pigWindowW }]}
										resizeMode="cover"
									/>
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
									equippedCostume={slot("active_costume_id")}
								/>
							</View>
						</View>
					</View>
					<View style={styles.slotCol}>{rightSlots.map((s) => renderSlot(s))}</View>
				</View>

				{costumeOn && costumeName ? (
					<T role="hand" tone="secondary" align="center" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
						{costumeOnLine(costumeName, activeIds)}
					</T>
				) : null}

				{/* Title chip — the pig's nameplate; tapping scrolls to Titles. */}
				{userId != null && (
							<Sticker
								color="paper"
								rotate={0}
								radius={RADII.md}
								shadow="none"
								onPress={() => setTitlesOpen(true)}
								accessibilityLabel={
									activeTitleName
										? `Title: ${activeTitleName}`
										: "No title chosen"
								}
								accessibilityHint="Opens your titles"
								style={styles.titleChip}
							>
						<T
							role="kickerPillSm"
							tone="secondary"
							maxFontSizeMultiplier={CHROME_TYPE_CAP}
						>
							title
						</T>
						{/* A title is a name: it wraps once before it ever ends in
						    "…". Every title fits one line at default size (the
						    widest, "Leopard-Hearted Friend", is 187pt of the
						    chip's 204pt) and wraps once at the chrome ceiling. */}
						<T
							role="cardTitleSm"
							tone={activeTitleName == null ? "secondary" : "primary"}
							align="center"
							numberOfLines={TITLE_CHIP_LINES}
							maxFontSizeMultiplier={CHROME_TYPE_CAP}
							style={styles.titleChipName}
						>
							{activeTitleName ?? "No title · tap to pick"}
						</T>
					</Sticker>
				)}
			</Sticker>
					</View>

					{/* The store — the doorway, the shelves, the members' shelf and
					    the counter on their own wall — between the fitting room
					    above and the closet catalog below (2026-09-17). */}
					{storeContent ? (
						<View style={styles.storeBleed}>{storeContent}</View>
					) : null}

					<View onLayout={handleClosetAnchorLayout}>
						{storeContent ? (
							<SectionHeader
								kicker="the whole rack"
								title="Everything"
								right={CLOSET_FILTER_CROWN[filter](filterCounts[filter])}
							/>
						) : null}
						<SegmentedControl
							options={filterOptions}
							value={filter}
							onChange={setFilter}
							label="Catalog filter"
							layout="row"
							style={styles.filterRow}
						/>
					</View>
				</View>
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
							accessibilityLabel={`${CAT_LABEL[row.category] ?? row.category}, ${row.ownedCount} of ${row.totalCount} owned`}
							accessibilityHint={
								collapsed ? "Opens this category" : "Collapses this category"
							}
							style={styles.sectionHead}
						>
							<SectionHeader
								title={CAT_LABEL[row.category] ?? row.category}
								right={
									<>
										<T role="kickerPillSm" tone="secondary">{row.ownedCount} of {row.totalCount}</T>
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
							const isCostume = isCostumeCategory(item.category);
							// v1 costumes fit Rosie only: on another pig the tile
							// greys and says so, and a tap previews instead of wearing.
							const costumeElsewhere = isCostume && !costumeCanFit;
							const src = HAT_THUMBNAILS_256[item.id] ?? HAT_IMAGES[item.id];
							const thumbSrc = src ?? categoryIcon(item.category);
							// The tile wears the shelf's tag and the shelf's badge — the same
							// Wizard Hat upstairs and down (utils/shopShelves, 2026-09-17).
							const cardState = {
								owned,
								active,
								inDrop: !!buyableIds?.has(item.id),
								canAfford: counter >= item.cost,
								locked: !!item.members_only && !isVip,
							};
							const face = cardTagFace(cardTag(item, cardState));
							const badge = cardBadge(cardState);
							// The shop's one spoken grammar for a cosmetic: name,
							// rarity, whose it is and, while it is for sale, its
							// price; the hint says what the tap does and why it
							// can't buy yet. The tile used to say only "not owned"
							// over a price tag it never read out.
							const a11y = cosmeticAccessibility(
								{ name: item.name, rarity: item.rarity, cost: item.cost },
								{
									owned,
									active,
									locked: cardState.locked,
									canAfford: cardState.canAfford,
									buyable: cardState.inDrop,
									action: owned ? "equip" : "preview",
								},
							);
								return (
									<Sticker
										key={item.id}
										color="paper"
										rotate={0}
										radius={RADII.lg}
										shadow="sm"
										onPress={() => {
											Haptics.selectionAsync().catch(() => {});
											if (costumeElsewhere) onPreview(item);
											else if (owned) onEquip(active ? null : item.id, item.category);
											else onPreview(item);
										}}
										style={[
										styles.itemCard,
										{ width: tileWidth },
										owned ? styles.itemCardOwned : styles.itemCardUnowned,
										active && styles.itemCardActive,
									]}
									accessibilityState={a11y.accessibilityState}
									accessibilityLabel={a11y.accessibilityLabel}
									accessibilityHint={a11y.accessibilityHint}
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
												(!owned || costumeElsewhere) && styles.itemArtUnowned,
											]}
											resizeMode="contain"
										/>
												) : (
													<Glyph name="sparkle" size={ART_SIZE.glyph} style={styles.artFallback} />
										)}
											{isCostume ? (
												<Tag
													label={costumeElsewhere ? COSTUME_FITS_ROSIE_TAG : "costume"}
													tone={costumeElsewhere ? "muted" : "lilac"}
													flat
													maxFontSizeMultiplier={CHROME_TYPE_CAP}
													style={styles.costumeCorner}
												/>
											) : null}
											{active && (
												<View style={styles.check}>
													<Icon name="check" size={CHECK_ICON} color={WHIMSY.paper} strokeWidth={CHECK_STROKE} />
											</View>
										)}
										{/* The lock means MEMBERS and only that; an item you have
										    simply not bought yet wears no badge at all. */}
										{!active && badge && (
											<View
												style={[
													styles.ownershipBadge,
													badge === "check"
														? styles.ownershipBadgeOwned
														: styles.ownershipBadgeLocked,
												]}
											>
												<Icon
													name={badge}
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
										{/* The name is a label here (TILE_NAME_LINES): it wraps,
										    it never ends in "…", and the row's tiles stretch to
										    one height so every tag sits on the same line. */}
										<T
											role="label"
											tone={owned ? "primary" : "secondary"}
											align="center"
											numberOfLines={TILE_NAME_LINES}
											maxFontSizeMultiplier={CHROME_TYPE_CAP}
										>
											{item.name}
										</T>
										<Tag
											tone={face.tone}
											icon={face.icon}
											coin={face.coin}
											label={face.label}
											maxFontSizeMultiplier={CHROME_TYPE_CAP}
											style={styles.itemTag}
										/>
										</View>
									</Sticker>
								);
							})}
						</View>
				);
					}}
			ListEmptyComponent={
				filter === "owned" ? (
					// Nothing yours yet: the rack is bare, and the only useful door
					// out of it is back up to what is on the shelves today.
					<EmptyState
						glyph="star"
						title="Nothing on the rack yet"
						sub="Buy something from today's drop and it hangs here."
						action={
							<Button
								variant="handLink"
								size="sm"
								onPress={scrollToTop}
								accessibilityLabel="Today's drop"
								accessibilityHint="Scrolls back up to the shelves"
							>
								Today&apos;s drop ›
							</Button>
						}
					/>
				) : (
					<EmptyState
						glyph="search"
						title="No items match this filter"
						sub="Try another part of the catalog."
						action={
							filter === "all" ? undefined : (
								<Button
									variant="handLink"
									size="sm"
									onPress={() => setFilter("all")}
									accessibilityLabel="Show every item"
									accessibilityHint="Clears the catalog filter"
								>
									Show every item ›
								</Button>
							)
						}
					/>
				)
			}
			ListFooterComponent={<View style={styles.tabSpacer} />}
		/>
		{/* The nameplate's picker — one sheet over the page, instead of the
		    ~3,000pt jump to a Titles footer (2026-09-17). */}
		<TitlesPickerSheet
			open={titlesOpen}
			onClose={() => setTitlesOpen(false)}
			titles={titles}
			activeTitleId={activeTitleId}
			onChange={onTitleChange}
		/>
		</>
	);
});

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { paddingHorizontal: SPACE.lg, paddingTop: CONTENT_TOP },
	// The store's wall runs edge to edge: it bleeds back out through the list's
	// own gutter so the plank grain reaches both screen edges, while the fitting
	// room above it and the closet below it keep the page's cream margins.
	storeBleed: {
		marginHorizontal: -SPACE.lg,
		marginTop: SPACE.md,
		marginBottom: SPACE.lg,
	},
	previewCard: {
		alignItems: "center",
		gap: SPACE.sm,
	},
	// Paper-doll: two slot columns of stated width flank Rosie, and the window
	// between them is the one child that yields (see PIG_WINDOW_W). The row's
	// gap is the least air a chip's shadow ever gets from the window.
	paperDoll: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		alignSelf: "stretch",
		gap: SPACE.sm,
	},
	slotCol: {
		width: SLOT_COL_W,
		gap: SPACE.sm,
		alignItems: "flex-start",
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
		// Yields on a narrow phone, never below the pig it frames.
		flexShrink: 1,
		minWidth: PIG_PREVIEW,
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
	// (see PageBackground's note). Cover-fills the window edge to edge; the
	// width is the window's measured one (it yields), passed inline.
	pigWindowBg: {
		position: "absolute",
		top: 0,
		left: 0,
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
	// The chip and its ✕ share this box, so the ✕'s corner inset is the
	// chip's corner.
	slotWrap: {
		width: SLOT_CHIP_W,
		position: "relative",
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
	// Covered by a worn costume: the chip goes to sleep on cream2, flat, its
	// art faded, and an "under" tag hangs off its foot (canvas direction A).
	slotThumbImgAsleep: { opacity: OPACITY.ghost },
	slotUnder: {
		position: "absolute",
		bottom: -SPACE.sm,
		alignSelf: "center",
		transform: [{ rotate: "-4deg" }],
	},
	// The tile's corner tag for a costume ("costume", or "fits Rosie" on a pig
	// the art is not fitted to).
	costumeCorner: {
		position: "absolute",
		top: SPACE.xs,
		left: SPACE.xs,
	},
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
		marginTop: 1,
		flexShrink: 1,
	},
	filterRow: {
		marginBottom: SPACE.md,
	},
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
	// A row's tiles stretch to its tallest (gridRow aligns by stretch), and
	// the foot takes the extra so a two-line name never lifts its tag.
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
		flexGrow: 1,
		justifyContent: "space-between",
		borderTopWidth: BORDER.ink,
		borderTopColor: UI_COLORS.border,
		paddingVertical: SPACE.xs,
		// SPACE.xs, not SPACE.sm: the 8pt a name gets back is what lets every
		// closet name fit TILE_NAME_LINES on a 375pt phone.
		paddingHorizontal: SPACE.xs,
		backgroundColor: WHIMSY.paper
	},
	itemFootUnowned: {
		borderTopColor: UI_COLORS.uiMuted,
		backgroundColor: WHIMSY.cream2,
	},
	itemFootActive: { backgroundColor: WHIMSY.lilac },
	// The foot's tag spans the tile, so a price, "Wear" and "Wearing" all share
	// one footprint and the grid never reflows between states.
	itemTag: {
		alignSelf: "stretch",
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
	// The gold lock: members only, and you are not a member yet.
	ownershipBadgeLocked: {
		backgroundColor: WHIMSY.slopGold,
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
