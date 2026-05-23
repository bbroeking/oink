import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	View,
	StyleSheet,
	FlatList,
	Image,
	Platform,
	SafeAreaView,
	Alert,
	Text,
	Pressable,
	ScrollView,
	useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../utils/supabase";
import { Button } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";
import { SnoutCoin } from "../../components/ui/SnoutCoin";
import { TitlesSection } from "../../components/TitlesSection";
import {
	HAT_IMAGES,
	HatRow,
	RARITY_COLORS,
	CATEGORY_EMOJI,
	HIDDEN_CATEGORIES,
} from "@/constants/hats";
import { categoryIcon, PIG } from "@/constants/emojiArt";
import { COLORS, FONTS, SHADOWS, WHIMSY, STICKER_SHADOW } from "@/constants/theme";
import { ItemPreviewModal } from "../../components/ItemPreviewModal";
import { showPurchaseToast } from "../../components/PurchaseToast";
import { RarityFx } from "../../components/ui/RarityFx";
import {
	BuyCelebration,
	type BuyCelebrationHandle,
} from "../../components/ui/BuyCelebration";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

const deniedSound = require("../../assets/sounds/denied.mp3");
const equipSound = require("../../assets/sounds/equip.mp3");

const RARITY_GRADIENT: Record<string, [string, string]> = {
	common: ["#FAF7F3", "#EFEAE3"],
	uncommon: ["#E8F5E0", "#CFE8C0"],
	rare: ["#E0EBFF", "#B7CFFA"],
	epic: ["#EFE9FF", "#CFC4FF"],
	legendary: ["#FFF3D0", "#FFD96B"],
};

const RARITY_RANK: Record<string, number> = {
	common: 1,
	uncommon: 2,
	rare: 3,
	epic: 4,
	legendary: 5,
};

const RARITY_ORDER: Array<HatRow["rarity"] & string> = [
	"legendary",
	"epic",
	"rare",
	"uncommon",
	"common",
];

const RARITY_LABELS: Record<string, string> = {
	common: "Common",
	uncommon: "Uncommon",
	rare: "Rare",
	epic: "Epic",
	legendary: "Legendary",
};

const CATEGORY_LABELS: Record<string, string> = {
	hat: "Hats",
	glasses: "Glasses",
	bow: "Bows",
	scarf: "Scarves",
	mask: "Masks",
	cape: "Capes",
	necklace: "Necklaces",
	aura: "Auras",
	held: "Held",
	background: "Backgrounds",
};

const CATEGORY_DISPLAY_ORDER = [
	"hat",
	"glasses",
	"bow",
	"scarf",
	"mask",
	"necklace",
	"cape",
	"held",
	"aura",
	"background",
];

type ListRow =
	| { type: "header"; key: string; title: string; rarity?: string }
	| { type: "row"; key: string; items: HatRow[] };

function buildRowsByRarity(items: HatRow[]): ListRow[] {
	const groups: Record<string, HatRow[]> = {};
	for (const i of items) {
		const r = i.rarity ?? "common";
		(groups[r] ??= []).push(i);
	}
	const rows: ListRow[] = [];
	for (const r of RARITY_ORDER) {
		const arr = groups[r];
		if (!arr?.length) continue;
		rows.push({
			type: "header",
			key: `h-${r}`,
			title: RARITY_LABELS[r],
			rarity: r,
		});
		for (let i = 0; i < arr.length; i += 2) {
			rows.push({
				type: "row",
				key: `r-${r}-${i}`,
				items: arr.slice(i, i + 2),
			});
		}
	}
	return rows;
}

function buildRowsByCategory(items: HatRow[]): ListRow[] {
	const groups: Record<string, HatRow[]> = {};
	for (const i of items) {
		const c = i.category ?? "hat";
		(groups[c] ??= []).push(i);
	}
	const rows: ListRow[] = [];
	const seen = new Set<string>();
	const order = [
		...CATEGORY_DISPLAY_ORDER.filter((c) => groups[c]?.length),
		...Object.keys(groups).filter(
			(c) => !CATEGORY_DISPLAY_ORDER.includes(c) && groups[c]?.length
		),
	];
	for (const c of order) {
		if (seen.has(c)) continue;
		seen.add(c);
		const arr = groups[c];
		// Inside a category, sort by rarity descending then cost descending
		arr.sort((a, b) => {
			const dr =
				(RARITY_RANK[b.rarity ?? "common"] ?? 0) -
				(RARITY_RANK[a.rarity ?? "common"] ?? 0);
			if (dr !== 0) return dr;
			return b.cost - a.cost;
		});
		rows.push({
			type: "header",
			key: `h-${c}`,
			title: CATEGORY_LABELS[c] ?? c,
		});
		for (let i = 0; i < arr.length; i += 2) {
			rows.push({
				type: "row",
				key: `r-${c}-${i}`,
				items: arr.slice(i, i + 2),
			});
		}
	}
	return rows;
}

function formatCountdown(secs: number): string {
	const h = Math.floor(secs / 3600);
	const m = Math.floor((secs % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

function HatThumb({
	item,
	size,
	fill,
}: {
	item: HatRow;
	size?: number;
	fill?: boolean;
}) {
	const hatSrc = HAT_IMAGES[item.id];
	const baseStyle = fill
		? ({ flex: 1, width: "100%" as const, height: "100%" as const })
		: ({ width: size ?? 100, height: size ?? 100 });
	if (hatSrc) {
		return (
			<Image source={hatSrc} style={baseStyle} resizeMode="contain" />
		);
	}
	// No item art + no per-item emoji → fall back to the category
	// icon (real art), then to the category emoji glyph.
	const catIcon = item.emoji ? null : categoryIcon(item.category);
	if (catIcon) {
		return <Image source={catIcon} style={baseStyle} resizeMode="contain" />;
	}
	return (
		<Text style={{ fontSize: (size ?? 100) * 0.55 }}>
			{item.emoji ?? CATEGORY_EMOJI[item.category ?? "hat"] ?? "?"}
		</Text>
	);
}

type CellShape = "square" | "tall" | "wide";

function ItemCard({
	item,
	owned,
	active,
	canAfford,
	busy,
	wardrobeMode,
	buyable = true,
	cellShape = "square",
	onBuy,
	onEquip,
	onUnequip,
	onPreview,
}: {
	item: HatRow;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	busy: boolean;
	wardrobeMode?: boolean;
	buyable?: boolean;
	// "wide" = cell wider than tall (e.g. 4×1, 4×2) — flip to horizontal
	// layout (image left, body right) so neither half is starved.
	// "tall" or "square" = vertical stack (image top, body bottom).
	cellShape?: CellShape;
	onBuy: () => void;
	onEquip: () => void;
	onUnequip: () => void;
	onPreview?: () => void;
}) {
	const rarity = item.rarity ?? "common";
	const rarityColor = RARITY_COLORS[rarity];
	const isPremium = rarity === "epic" || rarity === "legendary";
	const horizontal = cellShape === "wide";

	const thumb = (
		<RarityFx
			rarity={rarity}
			style={[
				styles.cardThumbWrap,
				horizontal && styles.cardThumbWrapHoriz,
			]}
		>
			<LinearGradient
				colors={RARITY_GRADIENT[rarity]}
				style={styles.cardThumb}
			>
				<HatThumb item={item} fill />
				<View
					style={[
						styles.rarityBadge,
						{ backgroundColor: rarityColor },
					]}
				>
					<Text style={styles.rarityText}>{rarity.toUpperCase()}</Text>
				</View>
			</LinearGradient>
		</RarityFx>
	);

	const body = (
		<View style={[styles.cardBody, horizontal && styles.cardBodyHoriz]}>
			<Text
				style={[styles.cardName, horizontal && styles.cardNameHoriz]}
				numberOfLines={horizontal ? 2 : 1}
			>
				{item.name}
			</Text>
			<View style={styles.priceRow}>
				{owned ? (
					<Text
						style={[
							styles.cardOwnedTag,
							active && { color: COLORS.successText },
						]}
					>
						{active ? "✓ WEARING" : "OWNED"}
					</Text>
				) : (
					<>
						<SnoutCoin size={14} />
						<Text style={styles.cardPrice}>
							{item.cost.toLocaleString()}
						</Text>
					</>
				)}
			</View>
			{active ? (
				<Button size="sm" variant="ghost" full onPress={onUnequip}>
					Take off
				</Button>
			) : owned ? (
				<Button size="sm" variant="primary" full onPress={onEquip}>
					Wear
				</Button>
			) : wardrobeMode ? null : !buyable ? (
				<Button size="sm" variant="locked" full disabled>
					Today only
				</Button>
			) : !canAfford ? (
				<Button size="sm" variant="locked" full disabled>
					Not enough
				</Button>
			) : (
				<Button
					size="sm"
					variant="primary"
					full
					onPress={onBuy}
					disabled={busy}
				>
					Buy
				</Button>
			)}
		</View>
	);

	return (
		<Pressable
			onPress={onPreview}
			style={[
				styles.card,
				horizontal && styles.cardHoriz,
				{
					borderColor: rarityColor,
					shadowColor: isPremium ? rarityColor : "#000",
					shadowOpacity: isPremium ? 0.4 : 0.06,
					shadowRadius: isPremium ? 14 : 6,
					shadowOffset: { width: 0, height: isPremium ? 6 : 2 },
					elevation: isPremium ? 6 : 2,
				},
			]}
		>
			{thumb}
			{body}
		</Pressable>
	);
}

function FeaturedCard({
	item,
	owned,
	active,
	canAfford,
	busy,
	onBuy,
	onEquip,
	onUnequip,
}: {
	item: HatRow;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	busy: boolean;
	onBuy: () => void;
	onEquip: () => void;
	onUnequip: () => void;
}) {
	const rarity = item.rarity ?? "common";
	const rarityColor = RARITY_COLORS[rarity];
	return (
		<View
			style={[
				styles.featured,
				{
					borderColor: rarityColor,
					shadowColor: rarityColor,
				},
			]}
		>
			<LinearGradient
				colors={RARITY_GRADIENT[rarity]}
				style={styles.featuredBg}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
			/>
			<View style={styles.featuredRow}>
				<View style={styles.featuredThumbWrap}>
					<HatThumb item={item} size={110} />
				</View>
				<View style={styles.featuredText}>
					<View
						style={[
							styles.rarityBadge,
							{
								position: "relative",
								top: 0,
								right: 0,
								alignSelf: "flex-start",
								backgroundColor: rarityColor,
								marginBottom: 6,
							},
						]}
					>
						<Text style={styles.rarityText}>
							{rarity.toUpperCase()}
						</Text>
					</View>
					<Text style={styles.featuredName} numberOfLines={1}>
						{item.name}
					</Text>
					{item.description && (
						<Text style={styles.featuredDesc} numberOfLines={2}>
							{item.description}
						</Text>
					)}
					<View style={styles.featuredCtaRow}>
						{!owned && (
							<View style={styles.featuredPriceWrap}>
								<SnoutCoin size={16} />
								<Text style={styles.featuredPrice}>
									{item.cost.toLocaleString()}
								</Text>
							</View>
						)}
						{active ? (
							<Button size="sm" variant="ghost" onPress={onUnequip}>
								Take off
							</Button>
						) : owned ? (
							<Button size="sm" variant="primary" onPress={onEquip}>
								Wear
							</Button>
						) : !canAfford ? (
							<Button size="sm" variant="locked" disabled>
								Not enough
							</Button>
						) : (
							<Button
								size="sm"
								variant={
									rarity === "legendary" ? "gold" : "primary"
								}
								onPress={onBuy}
								disabled={busy}
							>
								Buy now
							</Button>
						)}
					</View>
				</View>
			</View>
		</View>
	);
}

// ── Bento daily-shop layout ─────────────────────────────────────
//
// Three goals:
//   1. ZERO EMPTY CELLS — adaptive templates per item count.
//   2. ROTATION — for 8-item days, pick one of 4 templates by date
//      so the shop feels different day-to-day.
//   3. TILE TAP TARGETS — tap anywhere on a tile opens the preview;
//      the price pill is the only buy-action target (long press also
//      acceptable). Owned/equipped state replaces the pill.
//
// Template spec: each cell is {c, r, w, h} in 3-column grid units.
// Renderer places cells with absolute positioning so spans work
// without manual flex-fu.

// Daily layout: 5 items in a 2 + 1 + 2 stack.
//   row 0: two half-width squares side by side
//   row 1: ONE full-width wide banner — PREMIUM of the day,
//          horizontal ItemCard layout (icon left, buy right)
//   row 2: two more half-width squares side by side
// The premium slot is filled by the day's rarest item (ties broken
// by daily_shop's deterministic hash). With < 5 items available,
// trailing squares drop; the premium row stays as long as there's
// at least one item.
type SlotShape = "square" | "premium";

// Compact card variant for small 1×1 tiles. Image dominates; the
// bottom strip is either a price+buy pill or owned/equipped state.
// Whole-tile tap → preview; pill tap → buy/equip/unequip.
function CompactItemCard({
	item,
	owned,
	active,
	canAfford,
	busy,
	onBuy,
	onEquip,
	onUnequip,
	onPreview,
}: {
	item: HatRow;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	busy: boolean;
	onBuy: () => void;
	onEquip: () => void;
	onUnequip: () => void;
	onPreview: () => void;
}) {
	const rarity = item.rarity ?? "common";
	const rarityColor = RARITY_COLORS[rarity];

	const pillAction = active
		? onUnequip
		: owned
			? onEquip
			: canAfford && !busy
				? onBuy
				: undefined;
	const pillContent = active ? (
		<Text style={compactStyles.pillTextOwned}>✓ Wearing</Text>
	) : owned ? (
		<Text style={compactStyles.pillTextOwned}>Wear</Text>
	) : !canAfford ? (
		<>
			<SnoutCoin size={12} />
			<Text style={compactStyles.pillTextDisabled}>
				{item.cost.toLocaleString()}
			</Text>
		</>
	) : (
		<>
			<SnoutCoin size={12} />
			<Text style={compactStyles.pillText}>
				{item.cost.toLocaleString()}
			</Text>
		</>
	);

	return (
		<Pressable
			onPress={onPreview}
			style={[compactStyles.card, { borderColor: rarityColor }]}
		>
			<RarityFx rarity={rarity} style={compactStyles.thumbWrap}>
				<LinearGradient
					colors={RARITY_GRADIENT[rarity]}
					style={compactStyles.thumb}
				>
					<HatThumb item={item} size={56} />
					<View
						style={[
							compactStyles.rarityBadge,
							{ backgroundColor: rarityColor },
						]}
					>
						<Text style={compactStyles.rarityText}>
							{rarity[0].toUpperCase()}
						</Text>
					</View>
				</LinearGradient>
			</RarityFx>
			<Pressable
				onPress={pillAction}
				disabled={!pillAction}
				style={[
					compactStyles.pill,
					active && compactStyles.pillActive,
					owned && !active && compactStyles.pillOwned,
					!owned && !canAfford && compactStyles.pillDisabled,
				]}
			>
				{pillContent}
			</Pressable>
		</Pressable>
	);
}

// Layout: 2 tiles / wide premium banner / 2 tiles, expanding to fill
// the available vertical space (no scroll). The top + bottom rows
// each take flex: 1 of the remaining height after the fixed-height
// premium banner; each pair of tiles within a row splits the width
// 50/50. Tiles end up roughly card-shaped (taller than wide) on most
// phones — not strict squares, but well-proportioned for the new
// art style.
function BentoDailyGrid({
	items,
	featured,
	owned,
	isEquipped,
	counter,
	busyId,
	onBuy,
	onEquip,
	onUnequip,
	onPreview,
	tileCenters,
}: {
	items: HatRow[];
	featured: HatRow | null;
	owned: Set<string>;
	isEquipped: (id: string, cat: string | null | undefined) => boolean;
	counter: number;
	busyId: string | null;
	onBuy: (h: HatRow) => void;
	onEquip: (id: string, cat: string | null | undefined) => void;
	onUnequip: (cat: string | null | undefined) => void;
	onPreview: (h: HatRow) => void;
	tileCenters?: React.MutableRefObject<Map<string, { x: number; y: number }>>;
}) {
	const { width: screenW } = useWindowDimensions();
	const HORIZ_PADDING = 12;
	const GAP = 12;
	const innerW = screenW - HORIZ_PADDING * 2;
	const PREMIUM_H = Math.round(innerW * 0.32); // ~3:1 horizontal banner

	// Premium = day's rarest item. Ties broken by daily_shop's
	// deterministic order (the upstream `featured` resolver already
	// picked one).
	const premium = featured ?? items[0] ?? null;
	const squares = items.filter((i) => i.id !== premium?.id).slice(0, 4);
	const topSquares = squares.slice(0, 2);
	const bottomSquares = squares.slice(2, 4);

	const captureCenter = (itemId: string) => (e: {
		target: unknown;
	}) => {
		if (!tileCenters) return;
		const targetRef = e.target as {
			measureInWindow?: (
				cb: (x: number, y: number, w: number, h: number) => void
			) => void;
		};
		targetRef.measureInWindow?.((x, y, w, h) => {
			tileCenters.current.set(itemId, {
				x: x + w / 2,
				y: y + h / 2,
			});
		});
	};

	const renderTile = (item: HatRow) => (
		<View
			key={item.id}
			style={{ flex: 1 }}
			onLayout={captureCenter(item.id)}
		>
			<ItemCard
				item={item}
				owned={owned.has(item.id)}
				active={isEquipped(item.id, item.category)}
				canAfford={counter >= item.cost}
				busy={busyId === item.id}
				cellShape="square"
				onBuy={() => onBuy(item)}
				onEquip={() => onEquip(item.id, item.category)}
				onUnequip={() => onUnequip(item.category)}
				onPreview={() => onPreview(item)}
			/>
		</View>
	);

	return (
		<View style={{ flex: 1, gap: GAP }}>
			{topSquares.length > 0 && (
				<View
					style={{ flex: 1, flexDirection: "row", gap: GAP }}
				>
					{topSquares.map(renderTile)}
				</View>
			)}
			{premium && (
				<View
					style={{ width: innerW, height: PREMIUM_H }}
					onLayout={captureCenter(premium.id)}
				>
					<ItemCard
						item={premium}
						owned={owned.has(premium.id)}
						active={isEquipped(premium.id, premium.category)}
						canAfford={counter >= premium.cost}
						busy={busyId === premium.id}
						cellShape="wide"
						onBuy={() => onBuy(premium)}
						onEquip={() => onEquip(premium.id, premium.category)}
						onUnequip={() => onUnequip(premium.category)}
						onPreview={() => onPreview(premium)}
					/>
				</View>
			)}
			{bottomSquares.length > 0 && (
				<View
					style={{ flex: 1, flexDirection: "row", gap: GAP }}
				>
					{bottomSquares.map(renderTile)}
				</View>
			)}
		</View>
	);
}

const compactStyles = StyleSheet.create({
	card: {
		flex: 1,
		borderRadius: 14,
		borderWidth: 2,
		backgroundColor: COLORS.paper,
		overflow: "hidden",
	},
	thumbWrap: {
		flex: 1,
	},
	thumb: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	rarityBadge: {
		position: "absolute",
		top: 4,
		left: 4,
		width: 14,
		height: 14,
		borderRadius: 7,
		alignItems: "center",
		justifyContent: "center",
	},
	rarityText: {
		color: "#fff",
		fontFamily: FONTS.bodyBlack,
		fontSize: 8,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 6,
		paddingHorizontal: 8,
		gap: 4,
		backgroundColor: COLORS.ink,
		borderTopWidth: 1,
		borderTopColor: COLORS.border,
	},
	pillActive: {
		backgroundColor: COLORS.success,
	},
	pillOwned: {
		backgroundColor: COLORS.purple,
	},
	pillDisabled: {
		backgroundColor: COLORS.paper2,
	},
	pillText: {
		color: "#fff",
		fontFamily: FONTS.bodyBlack,
		fontSize: 13,
	},
	pillTextOwned: {
		color: "#fff",
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 0.5,
	},
	pillTextDisabled: {
		color: COLORS.ink3,
		fontFamily: FONTS.bodyBlack,
		fontSize: 13,
	},
});

// Single-row title card for the Titles shop tab. Text-based (no
// image) since titles attach to the user's display name. Rarity
// drives the border color, owned / not-affordable adjust the CTA.
function ShopTitleRow({
	title,
	canAfford,
	busy,
	onBuy,
}: {
	title: {
		id: string;
		name: string;
		placement: "pre" | "post";
		description: string | null;
		cost: number;
		rarity: string;
		owned: boolean;
	};
	canAfford: boolean;
	busy: boolean;
	onBuy: () => void;
}) {
	const rarityColor = RARITY_COLORS[title.rarity] ?? WHIMSY.ink;
	return (
		<View
			style={[
				shopTitleStyles.row,
				{ borderLeftColor: rarityColor },
			]}
		>
			<View style={shopTitleStyles.left}>
				<Text style={shopTitleStyles.kicker}>
					{title.placement === "post" ? "after your name" : "before your name"}
				</Text>
				<Text style={shopTitleStyles.name}>{title.name}</Text>
				{title.description && (
					<Text style={shopTitleStyles.desc}>{title.description}</Text>
				)}
			</View>
			<View style={shopTitleStyles.right}>
				{title.owned ? (
					<View style={shopTitleStyles.ownedTag}>
						<Text style={shopTitleStyles.ownedTagText}>Owned</Text>
					</View>
				) : (
					<Pressable
						onPress={onBuy}
						disabled={busy || !canAfford}
						style={({ pressed }) => [
							shopTitleStyles.buyBtn,
							!canAfford && shopTitleStyles.buyBtnDisabled,
							pressed && { opacity: 0.7 },
						]}
					>
						<SnoutCoin size={16} />
						<Text style={shopTitleStyles.buyBtnText}>
							{busy ? "…" : title.cost.toLocaleString()}
						</Text>
					</Pressable>
				)}
			</View>
		</View>
	);
}

const shopTitleStyles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 14,
		paddingHorizontal: 14,
		backgroundColor: "white",
		borderRadius: 12,
		borderLeftWidth: 5,
		marginBottom: 10,
		...SHADOWS.card,
	},
	left: { flex: 1, minWidth: 0 },
	right: { marginLeft: 8 },
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		marginBottom: 4,
	},
	name: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		lineHeight: 24,
	},
	desc: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 4,
	},
	buyBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
		backgroundColor: WHIMSY.lilac,
	},
	buyBtnDisabled: {
		opacity: 0.45,
	},
	buyBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	ownedTag: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 10,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1,
		borderColor: COLORS.border,
	},
	ownedTagText: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		letterSpacing: 0.8,
	},
});

export default function ShopScreen() {
	const [daily, setDaily] = useState<HatRow[]>([]);
	const [allItems, setAllItems] = useState<HatRow[]>([]);
	const [owned, setOwned] = useState<Set<string>>(new Set());
	// Multi-slot equipment: hat, aura, and background each have their own
	// column on profiles. Equipping an aura clears the aura slot only,
	// leaving any hat/background equipped intact. See migration
	// 20260514000000_aura_background_slots.sql for the schema.
	const [activeIds, setActiveIds] = useState<{
		hat: string | null;
		aura: string | null;
		background: string | null;
		held: string | null;
	}>({ hat: null, aura: null, background: null, held: null });
	const isEquipped = (id: string, category: string | null | undefined) => {
		if (category === "aura") return activeIds.aura === id;
		if (category === "background") return activeIds.background === id;
		if (category === "held") return activeIds.held === id;
		return activeIds.hat === id;
	};
	const [counter, setCounter] = useState<number>(0);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [previewItem, setPreviewItem] = useState<HatRow | null>(null);
	const [resetsIn, setResetsIn] = useState<number>(0);
	const [view, setView] = useState<"daily" | "browse" | "titles" | "wardrobe">("daily");
	// Title catalog for the new Titles tab. Refreshed alongside the
	// shop fetch + after any buy_title RPC so the owned/cost rows stay
	// in sync with the user's balance.
	type ShopTitle = {
		id: string;
		name: string;
		placement: "pre" | "post";
		description: string | null;
		cost: number;
		rarity: string;
		owned: boolean;
	};
	const [titles, setTitles] = useState<ShopTitle[]>([]);
	const [titleBusyId, setTitleBusyId] = useState<string | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

	// Deep-link target: navigation from elsewhere (e.g. the battle-pass
	// reward dialog) can pass `?view=wardrobe` to jump straight there.
	// We consume the param once on focus, then clear it from the URL so
	// switching tabs/back doesn't keep re-snapping the view.
	const params = useLocalSearchParams<{ view?: string }>();
	useEffect(() => {
		if (
			params.view === "wardrobe" || params.view === "browse" ||
			params.view === "daily" || params.view === "titles"
		) {
			setView(params.view);
			router.setParams({ view: undefined });
		}
	}, [params.view]);
	// Titles UI lives in the wardrobe view. activeTitleId is sourced from
	// profiles.active_title_id (added in the 20260511 migration). userId
	// is captured separately so TitlesSection can load owned titles.
	const [userId, setUserId] = useState<string | null>(null);
	const [activeTitleId, setActiveTitleId] = useState<string | null>(null);

	// Imperative handle for the on-screen "ka-ching" particle burst.
	// Fired from handleBuy on the tile that was just purchased.
	const celebrationRef = useRef<BuyCelebrationHandle>(null);
	const tileCenters = useRef<Map<string, { x: number; y: number }>>(
		new Map()
	);
	// Pre-loaded SFX players. expo-audio caches the decoded buffer so
	// .play() after seekTo(0) is effectively instant on subsequent fires.
	const deniedPlayer = useAudioPlayer(deniedSound);
	const equipPlayer = useAudioPlayer(equipSound);

	const load = useCallback(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;

		const [dailyRes, allRes, ownedRes, profRes, resetsRes, titlesRes] = await Promise.all([
			supabase.rpc("daily_shop"),
			supabase
				.from("hats")
				.select("id, name, cost, display_order, emoji, image_path, category, rarity, description")
				.order("display_order"),
			supabase.from("user_hats").select("hat_id").eq("user_id", user.id),
			// active_title_id depends on the 20260511 migration. If the
			// column isn't deployed yet the select errors — retry without
			// it so the shop still loads.
			supabase
				.from("profiles")
				.select("counter, active_hat_id, active_aura_id, active_background_id, active_held_id, active_title_id")
				.eq("id", user.id)
				.single()
				.then(async (res) => {
					if (res.error) {
						return supabase
							.from("profiles")
							.select("counter, active_hat_id, active_aura_id, active_background_id, active_held_id")
							.eq("id", user.id)
							.single();
					}
					return res;
				}),
			supabase.rpc("shop_resets_in_seconds"),
			// shop_titles depends on the 20260519010000 migration; 404s
			// when the migration hasn't been pushed yet, in which case
			// we just leave the titles list empty.
			supabase.rpc("shop_titles"),
		]);
		const filterPlaceable = (rows: HatRow[]) =>
			rows.filter(
				(r) => !r.category || !HIDDEN_CATEGORIES.has(r.category)
			);
		setDaily(filterPlaceable((dailyRes.data as HatRow[]) ?? []));
		setAllItems(filterPlaceable((allRes.data as HatRow[]) ?? []));
		setOwned(
			new Set(
				((ownedRes.data ?? []) as { hat_id: string }[]).map((r) => r.hat_id)
			)
		);
		setCounter(profRes.data?.counter ?? 0);
		setActiveIds({
			hat: profRes.data?.active_hat_id ?? null,
			aura: profRes.data?.active_aura_id ?? null,
			background: profRes.data?.active_background_id ?? null,
			held:
				(profRes.data as { active_held_id?: string | null } | null)
					?.active_held_id ?? null,
		});
		setActiveTitleId(
			(profRes.data as { active_title_id?: string | null } | null)
				?.active_title_id ?? null
		);
		setUserId(user.id);
		setResetsIn((resetsRes.data as number) ?? 0);
		setTitles(((titlesRes?.data as ShopTitle[] | null) ?? []));
	}, []);

	// Spend snouts to grant a title. On success, optimistically flip
	// `owned` + decrement balance so the UI doesn't wait for re-fetch.
	const handleBuyTitle = useCallback(async (t: ShopTitle) => {
		if (titleBusyId) return;
		if (t.owned) return;
		if (counter < t.cost) {
			try {
				deniedPlayer.seekTo(0);
				deniedPlayer.play();
			} catch {}
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
				() => {}
			);
			Alert.alert("Not enough snouts", `Needs ${t.cost}, you have ${counter}.`);
			return;
		}
		setTitleBusyId(t.id);
		const { data, error } = await supabase.rpc("buy_title", {
			target_title_id: t.id,
		});
		setTitleBusyId(null);
		const r = data as { ok?: boolean; reason?: string; new_balance?: number } | null;
		if (error || !r?.ok) {
			Alert.alert(
				"Couldn't buy",
				r?.reason === "insufficient_funds"
					? "Not enough snouts."
					: r?.reason === "already_owned"
						? "You already own this title."
						: "Try again."
			);
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		try {
			equipPlayer.seekTo(0);
			equipPlayer.play();
		} catch {}
		setCounter(r.new_balance ?? counter - t.cost);
		setTitles((prev) =>
			prev.map((x) => (x.id === t.id ? { ...x, owned: true } : x))
		);
	}, [counter, deniedPlayer, equipPlayer, titleBusyId]);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	useEffect(() => {
		if (resetsIn <= 0) return;
		const t = setInterval(() => setResetsIn((s) => Math.max(0, s - 1)), 1000);
		return () => clearInterval(t);
	}, [resetsIn]);

	const handleBuy = async (hat: HatRow) => {
		if (busyId) return;
		if (!daily.some((d) => d.id === hat.id)) {
			Alert.alert("Today only", "This item is only available in today's shop.");
			return;
		}
		setBusyId(hat.id);
		const { data, error } = await supabase.rpc("buy_hat", {
			target_hat_id: hat.id,
		});
		setBusyId(null);
		if (error) {
			showPurchaseToast({ type: "fail", title: "Couldn't buy", text: "Try again." });
			return;
		}
		const r = data as {
			ok: boolean;
			reason?: string;
			need?: number;
			have?: number;
		};
		if (!r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
				() => {}
			);
			try {
				deniedPlayer.seekTo(0);
				deniedPlayer.play();
			} catch {}
			if (r.reason === "insufficient") {
				showPurchaseToast({
					type: "fail",
					title: "Not enough snouts",
					text: `You need ${(r.need ?? 0) - (r.have ?? 0)} more.`,
				});
				return;
			}
			if (r.reason === "already_owned") {
				showPurchaseToast({
					type: "fail",
					title: "Already yours",
					text: "You already own this one.",
				});
				return;
			}
			showPurchaseToast({
				type: "fail",
				title: "Couldn't buy",
				text: r.reason ?? "Something went wrong.",
			});
			return;
		}
		// Buy succeeded — show the success toast with the cost chip.
		showPurchaseToast({
			type: "success",
			title: `${hat.name} · Bought`,
			text: "Added to your closet.",
			cost: hat.cost,
		});
		// Fire the on-screen ka-ching celebration anchored at the tile
		// the user tapped. Tile center is recorded in tileCenters by
		// renderCell's onLayout; if missing (race / unmount), the burst
		// shows at a sensible mid-screen fallback.
		const center = tileCenters.current.get(hat.id);
		celebrationRef.current?.fire({
			x: center?.x ?? 200,
			y: center?.y ?? 400,
			tier:
				hat.rarity === "epic" || hat.rarity === "legendary"
					? "premium"
					: "common",
		});
		// BuyCelebration already plays the success haptic + sound; skip
		// the duplicate Haptics.notificationAsync below to avoid stacking
		// two haptics on top of each other.
		load();
	};

	// Equip routes by category: aura → active_aura_id, background →
	// active_background_id, held → active_held_id, everything else →
	// active_hat_id. Passing `null` for itemId unequips just the
	// matching slot, leaving the other columns intact.
	const handleEquip = async (
		itemId: string | null,
		category: string | null | undefined
	) => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;
		Haptics.selectionAsync().catch(() => {});
		try {
			equipPlayer.seekTo(0);
			equipPlayer.play();
		} catch {}
		const column =
			category === "aura"
				? "active_aura_id"
				: category === "background"
					? "active_background_id"
					: category === "held"
						? "active_held_id"
						: "active_hat_id";
		await supabase
			.from("profiles")
			.update({ [column]: itemId })
			.eq("id", user.id);
		setActiveIds((prev) => {
			const next = { ...prev };
			if (category === "aura") next.aura = itemId;
			else if (category === "background") next.background = itemId;
			else if (category === "held") next.held = itemId;
			else next.hat = itemId;
			return next;
		});
	};

	// Featured = highest-rarity item in today's shop
	const featured = useMemo(() => {
		if (!daily.length) return null;
		return [...daily].sort(
			(a, b) =>
				(RARITY_RANK[b.rarity ?? "common"] ?? 0) -
				(RARITY_RANK[a.rarity ?? "common"] ?? 0)
		)[0];
	}, [daily]);

	const dailyRest = useMemo(
		() => (featured ? daily.filter((d) => d.id !== featured.id) : daily),
		[daily, featured]
	);

	const dailyIds = useMemo(() => new Set(daily.map((d) => d.id)), [daily]);

	const browseItems = useMemo(() => {
		if (!categoryFilter) return allItems;
		return allItems.filter((i) => i.category === categoryFilter);
	}, [allItems, categoryFilter]);

	const browseRows = useMemo(() => buildRowsByRarity(browseItems), [browseItems]);

	const ownedItems = useMemo(
		() => allItems.filter((i) => owned.has(i.id)),
		[allItems, owned]
	);

	const wardrobeRows = useMemo(
		() => buildRowsByCategory(ownedItems),
		[ownedItems]
	);

	const categories = useMemo(() => {
		const set = new Set<string>();
		allItems.forEach((i) => i.category && set.add(i.category));
		return Array.from(set).sort((a, b) => {
			const ai = CATEGORY_DISPLAY_ORDER.indexOf(a);
			const bi = CATEGORY_DISPLAY_ORDER.indexOf(b);
			return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
		});
	}, [allItems]);

	const renderItem = ({ item }: { item: HatRow }) => (
		<ItemCard
			item={item}
			owned={owned.has(item.id)}
			active={isEquipped(item.id, item.category)}
			canAfford={counter >= item.cost}
			busy={busyId === item.id}
			onBuy={() => handleBuy(item)}
			onEquip={() => handleEquip(item.id, item.category)}
			onUnequip={() => handleEquip(null, item.category)}
			onPreview={() => setPreviewItem(item)}
		/>
	);

	const renderListRow = (wardrobeMode: boolean) => ({ item }: { item: ListRow }) => {
		if (item.type === "header") {
			const rarity = item.rarity;
			const accent = rarity ? RARITY_COLORS[rarity] : COLORS.ink4;
			return (
				<View style={styles.sectionHeader}>
					<View style={[styles.sectionDot, { backgroundColor: accent }]} />
					<Text
						style={[
							styles.sectionHeaderText,
							rarity && { color: accent },
						]}
					>
						{item.title.toUpperCase()}
					</Text>
					<View style={[styles.sectionRule, { backgroundColor: accent + "33" }]} />
				</View>
			);
		}
		const [a, b] = item.items;
		return (
			<View style={styles.rowWrap}>
				<View style={styles.rowSlot}>
					<ItemCard
						item={a}
						owned={owned.has(a.id)}
						active={isEquipped(a.id, a.category)}
						canAfford={counter >= a.cost}
						busy={busyId === a.id}
						wardrobeMode={wardrobeMode}
						buyable={false}
						onBuy={() => handleBuy(a)}
						onEquip={() => handleEquip(a.id, a.category)}
						onUnequip={() => handleEquip(null, a.category)}
						onPreview={() => setPreviewItem(a)}
					/>
				</View>
				<View style={styles.rowSlot}>
					{b ? (
						<ItemCard
							item={b}
							owned={owned.has(b.id)}
							active={isEquipped(b.id, b.category)}
							canAfford={counter >= b.cost}
							busy={busyId === b.id}
							wardrobeMode={wardrobeMode}
							buyable={false}
							onBuy={() => handleBuy(b)}
							onEquip={() => handleEquip(b.id, b.category)}
							onUnequip={() => handleEquip(null, b.category)}
							onPreview={() => setPreviewItem(b)}
						/>
					) : null}
				</View>
			</View>
		);
	};

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.header}>
					{/* Redesign Phase 6 — kicker pulls the eye to a category
					    band; balance chip sits on the right with the snout
					    coin so the player always sees what they can spend. */}
					<View style={{ flex: 1 }}>
						<Text style={styles.kicker}>★ the shop</Text>
						<Text style={styles.title}>Wardrobe</Text>
					</View>
					<View style={styles.balance}>
						<SnoutCoin size={20} />
						<Text style={styles.balanceText}>{counter.toLocaleString()}</Text>
					</View>
				</View>

				<View style={styles.viewToggle}>
					{(["daily", "browse", "titles", "wardrobe"] as const).map((v) => {
						const active = v === view;
						const label =
							v === "daily" ? "Today"
								: v === "browse" ? "Browse"
								: v === "titles" ? "Titles"
								: "Wardrobe";
						return (
							<Pressable
								key={v}
								onPress={() => setView(v)}
								style={[
									styles.viewToggleBtn,
									active && styles.viewToggleBtnActive,
								]}
							>
								<Text
									style={[
										styles.viewToggleText,
										active && styles.viewToggleTextActive,
									]}
								>
									{label}
									{v === "wardrobe" && owned.size > 0 ? ` · ${owned.size}` : ""}
								</Text>
							</Pressable>
						);
					})}
				</View>

				{view === "daily" ? (
					// Daily view fills the available height — no scroll.
					// The bento expands inside this flex container so the
					// 2+1+2 stack fits exactly on screen.
					<View key="daily" style={[styles.grid, styles.dailyView]}>
						<View style={styles.countdownStrip}>
							<Icon name="bell" size={14} color={COLORS.pinkDeep} strokeWidth={2} />
							<Text style={styles.countdownText}>
								New shop in {formatCountdown(resetsIn)}
							</Text>
						</View>
						{daily.length === 0 ? (
							<Text style={styles.empty}>
								Empty shop. Come back tomorrow.
							</Text>
						) : (
							<BentoDailyGrid
								items={daily}
								featured={featured}
								owned={owned}
								isEquipped={isEquipped}
								counter={counter}
								busyId={busyId}
								onBuy={handleBuy}
								onEquip={handleEquip}
								onUnequip={(category) => handleEquip(null, category)}
								onPreview={setPreviewItem}
								tileCenters={tileCenters}
							/>
						)}
					</View>
				) : view === "browse" ? (
					<FlatList
						key="browse"
						data={browseRows}
						renderItem={renderListRow(false)}
						keyExtractor={(r) => r.key}
						contentContainerStyle={styles.grid}
						ListHeaderComponent={
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={styles.chipsRow}
							>
								<Pressable
									onPress={() => setCategoryFilter(null)}
									style={[
										styles.chip,
										!categoryFilter && styles.chipActive,
									]}
								>
									<Text
										style={[
											styles.chipText,
											!categoryFilter && styles.chipTextActive,
										]}
									>
										All
									</Text>
								</Pressable>
								{categories.map((c) => {
									const active = categoryFilter === c;
									return (
										<Pressable
											key={c}
											onPress={() =>
												setCategoryFilter(active ? null : c)
											}
											style={[
												styles.chip,
												active && styles.chipActive,
											]}
										>
											<Text
												style={[
													styles.chipText,
													active && styles.chipTextActive,
												]}
											>
												{CATEGORY_LABELS[c] ?? c}
											</Text>
										</Pressable>
									);
								})}
							</ScrollView>
						}
						ListEmptyComponent={
							<Text style={styles.empty}>Nothing here.</Text>
						}
					/>
				) : view === "titles" ? (
					<FlatList
						key="titles"
						data={titles}
						keyExtractor={(t) => t.id}
						contentContainerStyle={styles.grid}
						ListHeaderComponent={
							<View style={styles.wardrobeIntro}>
								<Text style={styles.wardrobeIntroTitle}>Titles</Text>
								<Text style={styles.wardrobeIntroSub}>
									Buy a title to attach to your name. Equip in Wardrobe.
								</Text>
							</View>
						}
						ListEmptyComponent={
							<Text style={styles.empty}>No titles available.</Text>
						}
						renderItem={({ item: t }) => (
							<ShopTitleRow
								title={t}
								canAfford={counter >= t.cost}
								busy={titleBusyId === t.id}
								onBuy={() => handleBuyTitle(t)}
							/>
						)}
					/>
				) : (
					<FlatList
						key="wardrobe"
						data={wardrobeRows}
						renderItem={renderListRow(true)}
						keyExtractor={(r) => r.key}
						contentContainerStyle={styles.grid}
						ListHeaderComponent={
							<View>
								{ownedItems.length > 0 ? (
									<View style={styles.wardrobeIntro}>
										<Text style={styles.wardrobeIntroTitle}>
											Your closet
										</Text>
										<Text style={styles.wardrobeIntroSub}>
											Tap an item to dress your pig.
											{(activeIds.hat || activeIds.aura || activeIds.background || activeIds.held)
												? ""
												: " Nothing equipped right now."}
										</Text>
									</View>
								) : null}
								{userId && (
									<View style={styles.wardrobeTitles}>
										<TitlesSection
											userId={userId}
											activeTitleId={activeTitleId}
											onChange={setActiveTitleId}
										/>
									</View>
								)}
							</View>
						}
						ListEmptyComponent={
							<View style={styles.wardrobeEmpty}>
								<Image source={PIG} style={styles.wardrobeEmptyImg} />
								<Text style={styles.wardrobeEmptyTitle}>
									Your closet is bare
								</Text>
								<Text style={styles.wardrobeEmptySub}>
									Buy items in Today or Browse to dress up your pig.
								</Text>
								<View style={{ marginTop: 14 }}>
									<Button
										size="sm"
										variant="primary"
										onPress={() => setView("daily")}
									>
										Visit shop
									</Button>
								</View>
							</View>
						}
					/>
				)}
			</SafeAreaView>

			<ItemPreviewModal
				item={previewItem}
				owned={previewItem ? owned.has(previewItem.id) : false}
				active={previewItem ? isEquipped(previewItem.id, previewItem.category) : false}
				canAfford={previewItem ? counter >= previewItem.cost : false}
				balance={counter}
				busy={previewItem ? busyId === previewItem.id : false}
				buyable={previewItem ? dailyIds.has(previewItem.id) : true}
				onClose={() => setPreviewItem(null)}
				onBuy={() => {
					if (previewItem) {
						handleBuy(previewItem);
					}
				}}
				onEquip={() => {
					if (previewItem) {
						handleEquip(previewItem.id, previewItem.category);
						setPreviewItem(null);
					}
				}}
				onUnequip={() => {
					if (previewItem) {
						handleEquip(null, previewItem.category);
						setPreviewItem(null);
					}
				}}
			/>
			{/* On-screen ka-ching sparkle burst overlay. Rendered at root
			    so it sits above every other view (tabs, modals are below
			    the absolute fill order). Fired imperatively from handleBuy. */}
			<BuyCelebration ref={celebrationRef} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safeArea: { flex: 1 },
	header: {
		paddingHorizontal: 18,
		paddingTop: Platform.OS === "ios" ? 8 : 20,
		paddingBottom: 8,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		letterSpacing: 1.6,
		textTransform: "uppercase",
		marginBottom: 2,
	},
	title: { fontSize: 32, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	balance: {
		backgroundColor: WHIMSY.paper,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		...STICKER_SHADOW,
		transform: [{ rotate: "1.5deg" }],
	},
	balanceText: {
		fontSize: 17,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	viewToggle: {
		flexDirection: "row",
		marginHorizontal: 18,
		marginTop: 8,
		marginBottom: 8,
		backgroundColor: WHIMSY.paper,
		borderRadius: 22,
		padding: 4,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
	},
	viewToggleBtn: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: 18,
		alignItems: "center",
	},
	viewToggleBtnActive: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	viewToggleText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	viewToggleTextActive: {
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	countdownStrip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 18,
		paddingBottom: 10,
	},
	countdownText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		letterSpacing: 0.4,
	},
	sectionLabel: {
		fontSize: 14,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		letterSpacing: 0.4,
		paddingHorizontal: 18,
		paddingTop: 14,
		paddingBottom: 8,
	},
	chipsRow: {
		paddingHorizontal: 14,
		paddingBottom: 10,
		gap: 8,
	},
	chip: {
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 14,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	chipActive: {
		backgroundColor: WHIMSY.sun,
		borderColor: WHIMSY.ink,
	},
	chipText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	chipTextActive: {
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	grid: { paddingHorizontal: 12, paddingBottom: 100 },
	// Daily tab fills the remaining height between the header and the
	// tab bar — no scroll, the bento tiles flex to fit.
	dailyView: { flex: 1, paddingBottom: 24, gap: 12 },
	columnWrap: { gap: 10 },
	rowWrap: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 12,
	},
	rowSlot: {
		flex: 1,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 6,
		paddingTop: 14,
		paddingBottom: 10,
	},
	sectionDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	sectionHeaderText: {
		fontSize: 14,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
	sectionRule: {
		flex: 1,
		height: 1.5,
		borderRadius: 1,
	},
	card: {
		flex: 1,
		backgroundColor: WHIMSY.paper,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
		...STICKER_SHADOW,
	},
	// Wide cells (e.g. 4×1 row strip): flip to row layout so the
	// image gets a square area on the left and the body stacks on
	// the right. Without this, a short-but-wide cell compresses both
	// thumb and body so neither is readable.
	cardHoriz: {
		flexDirection: "row",
	},
	cardThumbWrap: {
		flex: 1,
	},
	cardThumbWrapHoriz: {
		// Match height in row mode so the image is a square (height
		// is the constraint here, since width is given by flex).
		aspectRatio: 1,
		flex: 0,
	},
	cardThumb: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},
	cardBody: {
		padding: 10,
	},
	cardBodyHoriz: {
		flex: 1,
		justifyContent: "center",
	},
	cardName: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 4,
	},
	cardNameHoriz: {
		textAlign: "left",
	},
	priceRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		marginBottom: 8,
		minHeight: 18,
	},
	cardPrice: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	cardOwnedTag: {
		fontSize: 11,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		letterSpacing: 0.5,
	},
	rarityBadge: {
		position: "absolute",
		top: 8,
		right: 8,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
	},
	rarityText: {
		fontSize: 8,
		fontFamily: FONTS.bodyExtra,
		color: "#fff",
		letterSpacing: 0.5,
	},
	featured: {
		marginHorizontal: 14,
		marginBottom: 16,
		borderRadius: 22,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		overflow: "hidden",
		...STICKER_SHADOW,
		transform: [{ rotate: "-1deg" }],
	},
	featuredBg: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0.5,
	},
	featuredRow: {
		flexDirection: "row",
		alignItems: "center",
		padding: 14,
	},
	featuredThumbWrap: {
		width: 130,
		height: 130,
		borderRadius: 18,
		backgroundColor: "rgba(255,255,255,0.7)",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 14,
	},
	featuredText: {
		flex: 1,
		minWidth: 0,
	},
	featuredName: {
		fontSize: 20,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		lineHeight: 22,
	},
	featuredDesc: {
		fontSize: 14,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		marginTop: 2,
		lineHeight: 17,
	},
	featuredCtaRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: 10,
		gap: 8,
	},
	featuredPriceWrap: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
	},
	featuredPrice: {
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		color: WHIMSY.ink,
	},
	empty: {
		textAlign: "center",
		padding: 40,
		color: WHIMSY.mute,
		fontFamily: FONTS.hand,
		fontSize: 15,
	},
	wardrobeIntro: {
		paddingHorizontal: 6,
		paddingTop: 6,
		paddingBottom: 4,
	},
	wardrobeTitles: {
		paddingHorizontal: 6,
		marginBottom: 8,
	},
	wardrobeIntroTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
	},
	wardrobeIntroSub: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	wardrobeEmpty: {
		alignItems: "center",
		paddingVertical: 60,
		paddingHorizontal: 24,
	},
	wardrobeEmptyImg: {
		width: 68,
		height: 68,
		resizeMode: "contain",
		marginBottom: 14,
	},
	wardrobeEmptyTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		marginBottom: 6,
	},
	wardrobeEmptySub: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		lineHeight: 18,
	},
});
