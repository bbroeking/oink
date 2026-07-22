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
	type LayoutChangeEvent,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../utils/supabase";
import { rpc } from "@/utils/rpc";
import { useShopCatalog } from "@/hooks/useShopCatalog";
import { equipCosmetic } from "@/utils/cosmetics";
import { formatCountdownHM } from "@/utils/duration";
import { presentPaywall, OFFERING_IDS } from "../../utils/iap";
import { Button, SectionHeader } from "../../components/ui";
import { EmptyState, LoadingBeat } from "../../components/ui/EmptyState";
import { SnoutCoin } from "../../components/ui/SnoutCoin";
import { ClosetView } from "../../components/ClosetView";
import { TroughSection } from "../../components/TroughSection";
import {
	HAT_IMAGES,
	HatRow,
	RARITY_COLORS,
} from "@/constants/hats";
import { columnForCategory } from "@/constants/slots";
import { categoryIcon } from "@/constants/emojiArt";
import { Icon } from "@/components/ui/Icon";
import { Glyph, IconText, type GlyphName } from "@/components/ui/Glyph";
import { AnimatedCosmetic } from "@/components/ui/AnimatedCosmetic";
import { cosmeticFxFor } from "@/constants/cosmeticFx";
import { type ListRow, buildBrowseRows } from "@/constants/shopRows";
import { COLORS, FONTS, KICKER_PILL, WHIMSY, STICKER_SHADOW, SHADOW_SM, SPACE, RADII, PAGE_PAD, TAB_SAFE, TYPE, RARITY_BG_SOLID, RARITY_STRIPE } from "@/constants/theme";
import { ItemPreviewModal } from "../../components/ItemPreviewModal";
import { showPurchaseToast } from "../../components/PurchaseToast";
import {
	BuyCelebration,
	type BuyCelebrationHandle,
} from "../../components/ui/BuyCelebration";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

const deniedSound = require("../../assets/sounds/denied.mp3");
const equipSound = require("../../assets/sounds/equip.mp3");

const RARITY_RANK: Record<string, number> = {
	common: 1,
	uncommon: 2,
	rare: 3,
	epic: 4,
	legendary: 5,
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
	flag: "Flags",
	tickle_particle: "Tickle Particles",
};

// Per-category filter-chip icon, so the Collectibles filter rail reads at a
// glance instead of text-only. Keys mirror CATEGORY_LABELS (flag is excluded
// from the catalog, so it needs no chip icon).
const CATEGORY_GLYPH: Record<string, GlyphName> = {
	hat: "tophat",
	glasses: "glasses",
	bow: "bow",
	scarf: "scarf",
	mask: "mask",
	necklace: "beads",
	cape: "superhero",
	held: "wand",
	aura: "sparkle",
	background: "scene",
	tickle_particle: "party",
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

function HatThumb({
	item,
	size,
	fill,
}: {
	item: HatRow;
	size?: number;
	fill?: boolean;
}) {
	// fill mode: MEASURE the box, then render the Image at an explicit
	// numeric size. Absolute-inset sizing (the previous fix) still hit the
	// Yoga intrinsic-size quirk inside the mosaic's aspectRatio cells
	// (sixth sighting) — bows/hats rendered at native px and cropped.
	const [box, setBox] = useState<{ w: number; h: number } | null>(null);
	const hatSrc = HAT_IMAGES[item.id];
	// No item art → fall back to the category icon (real art). Auras +
	// necklaces have no category art (categoryIcon null) → neutral glyph.
	const catIcon = !hatSrc ? categoryIcon(item.category) : null;
	const src = hatSrc ?? catIcon;
	// Members-only / legendary items with an animation recipe render live
	// (float + glow + shimmer + sparkles) instead of a flat Image.
	const fx = hatSrc ? cosmeticFxFor(item.id) : undefined;
	if (!fill) {
		const sz = { width: size ?? 100, height: size ?? 100 };
		if (fx && hatSrc)
			return <AnimatedCosmetic source={hatSrc} fx={fx} size={size ?? 100} />;
		if (src) return <Image source={src} style={sz} resizeMode="contain" />;
		return (
			<Text style={{ fontSize: (size ?? 100) * 0.55, color: WHIMSY.mute }}>
				✦
			</Text>
		);
	}
	// Backgrounds + auras are edge-to-edge art — cover the whole box.
	// Everything else contain-fits a centered square with breathing room.
	const fullBleed = item.category === "background" || item.category === "aura";
	const side = box ? Math.max(0, Math.min(box.w, box.h) - 12) : 0;
	return (
		<View
			style={styles.thumbFillBox}
			onLayout={(e: LayoutChangeEvent) => {
				const { width, height } = e.nativeEvent.layout;
				setBox({ w: width, h: height });
			}}
		>
			{box && fx && hatSrc && !fullBleed ? (
				<AnimatedCosmetic source={hatSrc} fx={fx} size={side} />
			) : box && src ? (
				<Image
					source={src}
					style={
						fullBleed
							? { width: box.w, height: box.h }
							: { width: side, height: side }
					}
					resizeMode={fullBleed ? "cover" : "contain"}
				/>
			) : !src && box ? (
				<Text style={{ fontSize: Math.min(box.w, box.h) * 0.5, color: WHIMSY.mute }}>
					✦
				</Text>
			) : null}
		</View>
	);
}

// ── Shop redesign (Claude Design handoff, Shop Layout.html) ─────────
// Less text, more readable: rarity is a COLOR DOT + one legend (no word
// pills), the image is the hero on a rarity-tinted panel, and the price
// chip carries the buy-state (gold = affordable, muted + lock = not yet,
// "✓ OWNED" tag = owned). No per-card buttons — tapping opens the
// preview/buy sheet. Uniform 2-col grid replaces the bento mosaic.
function RarityLegend() {
	return (
		<View style={shopCardStyles.legend}>
			{(["common", "uncommon", "rare", "epic", "legendary"] as const).map(
				(r) => (
					<View key={r} style={shopCardStyles.legendItem}>
						<View
							style={[
								shopCardStyles.legendDot,
								{ backgroundColor: RARITY_STRIPE[r] },
							]}
						/>
						<Text style={shopCardStyles.legendLabel}>{r}</Text>
					</View>
				)
			)}
		</View>
	);
}

function ShopCard({
	item,
	owned,
	active,
	canAfford,
	index,
	locked,
	membersOnly,
	onPress,
	onCenter,
}: {
	item: HatRow;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	// Position in the grid — drives the alternating ±0.5° sticker tilt.
	index: number;
	// Members-only item + caller isn't a Slop Club member → the ribbon wears
	// its lock glyph (it's still a gate, not just identity).
	locked?: boolean;
	// Members-only item, regardless of VIP status. Drives the MEMBERS ribbon —
	// which stays for members too (it's Slop Club identity, not a lock).
	membersOnly?: boolean;
	onPress: () => void;
	// Reports the card's window-space center (the buy celebration anchor).
	onCenter?: (x: number, y: number) => void;
}) {
	const rarity = item.rarity ?? "common";
	const ref = useRef<View>(null);
	return (
		<Pressable
			ref={ref}
			onPress={onPress}
			onLayout={() => {
				ref.current?.measureInWindow?.((x, y, w, h) =>
					onCenter?.(x + w / 2, y + h / 2)
				);
			}}
			style={[
				shopCardStyles.card,
				{ transform: [{ rotate: index % 2 === 0 ? "-0.5deg" : "0.5deg" }] },
				// Locked members-only card (non-VIP) reads dimmer — same opacity
				// lane the can't-afford price chip uses, so the whole grid speaks
				// one "muted = gated" language.
				locked && shopCardStyles.cardLocked,
			]}
		>
			<View
				style={[
					shopCardStyles.thumb,
					{ backgroundColor: RARITY_BG_SOLID[rarity] },
				]}
			>
				<View
					style={[
						shopCardStyles.rdot,
						{ backgroundColor: RARITY_STRIPE[rarity] },
					]}
				/>
				{owned ? (
					<View style={shopCardStyles.ownedBadge}>
						<Icon name="check" size={14} color={WHIMSY.ink} strokeWidth={2.6} />
					</View>
				) : membersOnly ? (
					// MEMBERS corner ribbon — Slop Club gold, ink border, sticker
					// shadow. Wears a lock glyph only when the item is still gated
					// (non-VIP); for members it stays as identity, no lock.
					<View style={shopCardStyles.membersRibbon}>
						{locked && <Glyph name="lock" size={11} />}
						<Text style={shopCardStyles.membersRibbonText}>MEMBERS</Text>
					</View>
				) : null}
				<HatThumb item={item} fill />
			</View>
			<View style={shopCardStyles.foot}>
				<Text numberOfLines={1} style={shopCardStyles.nm}>
					{item.name}
				</Text>
				{owned ? (
					<View style={shopCardStyles.ownedTagRow}>
						<Icon name="check" size={12} color={COLORS.successText} strokeWidth={2.6} />
						<Text style={shopCardStyles.ownedTagLabel}>
							{active ? "WEARING" : "OWNED"}
						</Text>
					</View>
				) : item.cost <= 0 ? (
					<Text style={[shopCardStyles.ownedTag, { color: WHIMSY.mute }]}>
						SEASON PASS
					</Text>
				) : (
					<View
						style={[
							shopCardStyles.chip,
							canAfford ? shopCardStyles.chipBuy : shopCardStyles.chipLocked,
						]}
					>
						<SnoutCoin size={14} />
						<Text
							style={[
								shopCardStyles.chipText,
								!canAfford && { color: WHIMSY.mute },
							]}
						>
							{item.cost.toLocaleString()}
						</Text>
						{!canAfford && <Icon name="lock" size={12} color={WHIMSY.mute} />}
					</View>
				)}
			</View>
		</Pressable>
	);
}

const shopCardStyles = StyleSheet.create({
	legend: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		// Tight chip-to-chip gaps so the five rarities flow across 1–2 lines
		// instead of stacking one-per-row.
		columnGap: SPACE.sm,
		rowGap: SPACE.sm,
		// Flush with the grid: the parent scroll content already insets
		// PAGE-grid's 12, so the legend carries no extra horizontal pad.
		paddingHorizontal: 0,
		paddingBottom: SPACE.md,
	},
	legendItem: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	legendDot: {
		width: 11,
		height: 11,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
	},
	legendLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	card: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		overflow: "hidden",
		...STICKER_SHADOW,
	},
	// aspectRatio is safe on VIEWS — HatThumb measures inside, so the
	// image itself still gets explicit numerics (the Yoga-quirk cure).
	thumb: {
		aspectRatio: 1.18,
		borderBottomWidth: 2,
		borderColor: WHIMSY.ink,
		position: "relative",
	},
	// Corner badges share a single 8px inset (UI audit).
	rdot: {
		position: "absolute",
		top: SPACE.sm,
		left: SPACE.sm,
		width: 14,
		height: 14,
		borderRadius: 7,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		zIndex: 2,
		...STICKER_SHADOW,
	},
	ownedBadge: {
		position: "absolute",
		top: SPACE.sm,
		right: SPACE.sm,
		width: 26,
		height: 26,
		borderRadius: 13,
		backgroundColor: WHIMSY.sage,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 2,
		...STICKER_SHADOW,
	},
	// MEMBERS corner ribbon — Slop Club gold chip in the same corner the owned
	// check occupies, with the signature ink border + sticker shadow. Reads as
	// "Slop Club" at a glance where the old small round lock was ambiguous. A
	// lock glyph rides ahead of the label only while the item is still gated.
	membersRibbon: {
		position: "absolute",
		top: SPACE.sm,
		right: SPACE.sm,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		backgroundColor: WHIMSY.slopGold,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs,
		zIndex: 2,
		...SHADOW_SM,
	},
	membersRibbonText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: WHIMSY.ink,
	},
	// Locked members-only card — the muted "gated" lane shared with chipLocked.
	cardLocked: { opacity: 0.85 },
	// Symmetric 12px foot padding (UI audit) — was H11/T9/B11.
	foot: { padding: SPACE.md, gap: SPACE.sm },
	nm: { fontFamily: FONTS.displaySemi, fontSize: 15, color: WHIMSY.ink },
	chip: {
		// Full-width pill button (the price IS the action) — was a small
		// left-aligned chip; now stretches the card footer and centers content.
		alignSelf: "stretch",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingVertical: 8,
		paddingHorizontal: 12,
		...SHADOW_SM,
	},
	chipBuy: { backgroundColor: WHIMSY.sun },
	// Locked (can't-afford) reads as locked beyond color: muted cream
	// fill + faded ink border + a lock glyph + muted text + reduced
	// opacity. Same size as the buy chip so the grid doesn't reflow.
	chipLocked: {
		backgroundColor: WHIMSY.cream,
		borderColor: WHIMSY.muteSoft,
		opacity: 0.85,
	},
	chipText: { fontFamily: FONTS.display, fontSize: 15, color: WHIMSY.ink },
	ownedTag: {
		// Full-width + centered so OWNED / SEASON PASS share the price
		// button's footprint (uniform card footer, no left-aligned outlier).
		alignSelf: "stretch",
		textAlign: "center",
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		letterSpacing: 0.5,
		textTransform: "uppercase",
		color: COLORS.successText,
		paddingVertical: 8,
	},
	// Owned footer as an Icon-check + label pair, centered on the same
	// footprint as the SEASON PASS text (the check replaces the raw ✓).
	ownedTagRow: {
		alignSelf: "stretch",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		paddingVertical: 8,
	},
	ownedTagLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		letterSpacing: 0.5,
		textTransform: "uppercase",
		color: COLORS.successText,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		// Card-to-card 12 (UI audit). Mirrored in the dailyTileW formula —
		// keep the two in sync (numeric-width Yoga discipline).
		gap: SPACE.md,
		paddingBottom: SPACE.sm,
	},
});

export default function ShopScreen() {
	// Catalog data lifecycle (fetch + derived state + reset countdown) lives in
	// useShopCatalog; the screen owns only rendering, modals, and the purchase /
	// equip flows. Optimistic setters (setCounter/setOwned/patchActiveIds/
	// setActiveTitleId) let a buy or equip reflect before the refetch lands.
	const {
		loading,
		daily,
		allItems,
		owned,
		activeIds,
		counter,
		isVip,
		userId,
		activeTitleId,
		resetsIn,
		ownedItems,
		dailyIds,
		refresh,
		setCounter,
		setOwned,
		setActiveTitleId,
		patchActiveIds,
	} = useShopCatalog();
	const isEquipped = (id: string, category: string | null | undefined) => {
		return activeIds[columnForCategory(category)] === id;
	};
	const [busyId, setBusyId] = useState<string | null>(null);
	const [previewItem, setPreviewItem] = useState<HatRow | null>(null);
	const [view, setView] = useState<"daily" | "browse" | "wardrobe" | "trough">("daily");
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	// Collapse state for the two Collectibles bands (members shown first).
	const [collapsed, setCollapsed] = useState<{ members: boolean; everyone: boolean }>(
		{ members: false, everyone: false }
	);
	// Trough segment emptiness — TroughSection renders null when there are no
	// open/funded drives, so it reports its empty status up here (no new fetch;
	// it's derived from the my_drives load it already runs) and the segment
	// shows a cozy empty state instead of a blank body.
	const [troughEmpty, setTroughEmpty] = useState<boolean>(false);

	// Deep-link target: navigation from elsewhere (e.g. the battle-pass
	// reward dialog) can pass `?view=wardrobe` to jump straight there.
	// We consume the param once on focus, then clear it from the URL so
	// switching tabs/back doesn't keep re-snapping the view.
	const params = useLocalSearchParams<{ view?: string }>();
	useEffect(() => {
		if (
			params.view === "wardrobe" || params.view === "browse" ||
			params.view === "daily" || params.view === "trough"
		) {
			setView(params.view);
			router.setParams({ view: undefined });
		}
	}, [params.view]);
	// Title EQUIP UI renders inside ClosetView (the Closet view). Titles are
	// earned-only now (see 20260677) — there is no shop buy path. activeTitleId
	// + userId are sourced from the profile by useShopCatalog; the Closet reads
	// them (and pushes title changes back through setActiveTitleId).

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

	// Join Slop Club from the members band header — the SAME RevenueCat offering
	// components/Account.tsx and the season premium unlock present. is_vip flips
	// server-side via the webhook; re-running the catalog fetch re-reads the
	// profile, which unlocks the members band + drops the ribbon locks.
	const handleJoinSlopClub = useCallback(async () => {
		const result = await presentPaywall(OFFERING_IDS.slopClub);
		if (result.ok) await refresh();
	}, [refresh]);

	const handleBuy = async (hat: HatRow) => {
		if (busyId) return;
		if (!daily.some((d) => d.id === hat.id)) {
			Alert.alert("Today only", "This item is only available in today's shop.");
			return;
		}
		setBusyId(hat.id);
		const r = await rpc<{
			ok: boolean;
			reason?: string;
			need?: number;
			have?: number;
			remaining?: number;
		}>("buy_hat", {
			target_hat_id: hat.id,
		});
		setBusyId(null);
		if (!r) {
			showPurchaseToast({ type: "fail", title: "Couldn't buy", text: "Try again." });
			return;
		}
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
			if (r.reason === "not_for_sale") {
				// Season-pass + referral-milestone hats have cost=0 in
				// the catalog; buy_hat rejects them. The shop card +
				// preview modal both gate against this client-side
				// now, so this path only fires on a stale UI state.
				showPurchaseToast({
					type: "fail",
					title: "Earned, not sold",
					text: "Unlock this from the Season Pass or a referral milestone.",
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
		// Buy succeeded — snap the balance chip IMMEDIATELY (buy_hat
		// returns the post-spend counter as `remaining`); the refresh()
		// below still reconciles owned/daily, but the spend must never wait
		// on that round trip to show.
		setCounter((c) => r.remaining ?? Math.max(0, c - hat.cost));
		setOwned((prev) => new Set(prev).add(hat.id));
		// Show the success toast with the cost chip.
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
		refresh();
	};

	// Equip a cosmetic (or unequip when itemId is null). The routing +
	// face-slot exclusivity rule and the profiles write live in
	// utils/cosmetics (equipCosmetic); the screen keeps the equip haptic +
	// SFX and patches activeIds optimistically from the returned column patch
	// (same ordering as before: write, then patch).
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
		const update = await equipCosmetic(user.id, itemId, category);
		patchActiveIds(update);
	};

	// Redesigned Today grid: numeric 2-col tile width (12px scroll padding
	// ×2, SPACE.md gap — never %-size grid children; Yoga-quirk discipline).
	// The gap constant MUST equal shopCardStyles.grid.gap.
	const { width: shopScreenW } = useWindowDimensions();
	const dailyTileW = Math.floor((shopScreenW - 12 * 2 - SPACE.md) / 2);

	const browseItems = useMemo(() => {
		// Flags are allegiance picks (Barn flag -> dialog), not shop goods —
		// keep them out of the catalog. allItems stays intact so the Closet
		// still sees owned flags.
		// Members-only items are seeded ahead of their art (the catalog row
		// lands before the PNG); hide any that don't yet have real art so the
		// Members band never shows a category-fallback placeholder.
		const shoppable = allItems.filter(
			(i) =>
				i.category !== "flag" &&
				(!i.members_only || !!HAT_IMAGES[i.id])
		);
		if (!categoryFilter) return shoppable;
		return shoppable.filter((i) => i.category === categoryFilter);
	}, [allItems, categoryFilter]);

	const browseRows = useMemo<ListRow[]>(
		() => buildBrowseRows(browseItems, collapsed, isVip),
		[browseItems, collapsed, isVip]
	);

	const wardrobeRows = useMemo(
		() => buildRowsByCategory(ownedItems),
		[ownedItems]
	);

	const categories = useMemo(() => {
		const set = new Set<string>();
		// Flags are excluded from the catalog (browseItems drops them), so don't
		// offer a "Flags" filter chip that would resolve to an empty grid.
		allItems.forEach((i) => {
			if (i.category && i.category !== "flag") set.add(i.category);
		});
		return Array.from(set).sort((a, b) => {
			const ai = CATEGORY_DISPLAY_ORDER.indexOf(a);
			const bi = CATEGORY_DISPLAY_ORDER.indexOf(b);
			return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
		});
	}, [allItems]);

	const renderListRow = (wardrobeMode: boolean) => ({ item }: { item: ListRow }) => {
		if (item.type === "section") {
			const members = item.band === "members";
			return (
				<Pressable
					onPress={() =>
						setCollapsed((c) => ({ ...c, [item.band]: !c[item.band] }))
					}
					style={[
						styles.bandHeader,
						members ? styles.bandHeaderMembers : styles.bandHeaderEveryone,
					]}
				>
					{members && (
						<Glyph name={item.locked ? "lock" : "crown"} size={18} />
					)}
					<View style={{ flex: 1 }}>
						<Text
							style={[
								styles.bandTitle,
								members && { color: WHIMSY.ink },
							]}
						>
							{item.title.toUpperCase()}
						</Text>
						{item.subtitle ? (
							<Text style={styles.bandSubtitle}>{item.subtitle}</Text>
						) : null}
					</View>
					{members && item.locked ? (
						<Button
							variant="gold"
							size="sm"
							onPress={handleJoinSlopClub}
							style={styles.bandJoinCta}
						>
							Join Slop Club
						</Button>
					) : null}
					<Text style={styles.bandChevron}>{item.collapsed ? "▸" : "▾"}</Text>
				</Pressable>
			);
		}
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
					<View style={[styles.sectionRule, { backgroundColor: WHIMSY.muteSoft }]} />
				</View>
			);
		}
		const [a, b] = item.items;
		// Same redesigned card as Today — color dot + tinted panel + price
		// chip; tap opens the preview sheet. Tilt alternates per row slot.
		const rowIdx = Number(item.key.split("-").pop() ?? 0);
		return (
			<View style={styles.rowWrap}>
				<View style={styles.rowSlot}>
					<ShopCard
						item={a}
						index={rowIdx}
						owned={owned.has(a.id)}
						active={isEquipped(a.id, a.category)}
						canAfford={counter >= a.cost}
						locked={!isVip && !!a.members_only}
						membersOnly={!!a.members_only}
						onPress={() => setPreviewItem(a)}
					/>
				</View>
				<View style={styles.rowSlot}>
					{b ? (
						<ShopCard
							item={b}
							index={rowIdx + 1}
							owned={owned.has(b.id)}
							active={isEquipped(b.id, b.category)}
							canAfford={counter >= b.cost}
							locked={!isVip && !!b.members_only}
							membersOnly={!!b.members_only}
							onPress={() => setPreviewItem(b)}
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
					{/* Kicker pulls the eye to a category band; balance chip
					    sits on the right with the snout coin so the player
					    always sees what they can spend. */}
					<View style={{ flex: 1 }}>
						<Text style={styles.kicker}>★ your closet</Text>
						<Text style={styles.title}>Shop</Text>
					</View>
					{/* Golden Ticket entry — a compact chip-chrome icon in the
					    header (ink border + paper face + SHADOW_SM, matching the
					    header-adjacent chips). Routes to the scan-code screen
					    (camera + manual entry). Was a footer text row; promoted
					    to the top so redeeming a launch-party gift is findable. */}
					<Pressable
						onPress={() => router.push("/scan-code")}
						hitSlop={12}
						accessibilityRole="button"
						accessibilityLabel="Redeem a Golden Ticket"
						style={({ pressed }) => [
							styles.ticketBtn,
							pressed && { opacity: 0.7 },
						]}
					>
						<Glyph name="gift" size={20} />
					</Pressable>
					<View style={styles.balance}>
						<SnoutCoin size={20} />
						<Text style={styles.balanceText}>{counter.toLocaleString()}</Text>
					</View>
				</View>

				<View style={styles.viewToggle}>
					{(["daily", "browse", "wardrobe", "trough"] as const).map((v) => {
						const active = v === view;
						const label =
							v === "daily" ? "Today"
								: v === "browse" ? "Collectibles"
								: v === "wardrobe" ? "Closet"
								: "Trough";
						return (
							<Pressable
								key={v}
								onPress={() => setView(v)}
								style={({ pressed }) => [
									styles.viewToggleBtn,
									active && styles.viewToggleBtnActive,
									pressed && { opacity: 0.7 },
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
					// 4×4 day-rotated mosaic. Scrolls vertically — the mosaic
					// is taller than the available space on smaller phones.
					<ScrollView
						key="daily"
						style={styles.dailyScroll}
						contentContainerStyle={styles.dailyScrollContent}
						showsVerticalScrollIndicator={false}
					>
						<SectionHeader
							kicker="today's drop"
							title="Today's Drop"
							right={`resets in ${formatCountdownHM(resetsIn)}`}
						/>
						<RarityLegend />
						{daily.length === 0 ? (
							loading ? (
								// Still fetching today's drop — a loading shop must
								// never read as sold-out. Show the cozy loading beat
								// until the fetch completes and the result is
								// genuinely empty.
								<LoadingBeat glyph="tophat" label="stocking the shelves" />
							) : (
								<EmptyState
									glyph="zzz"
									title="All sold out for today"
									sub="A fresh drop arrives at sunrise."
								/>
							)
						) : (
							<>
								{/* Uniform 2-col grid of all 8 daily items — bento mosaic
								    + featured hero retired per the redesign handoff.
								    Numeric widths (Yoga-quirk discipline). */}
								<View style={shopCardStyles.grid}>
									{daily.map((item, i) => (
										<View key={item.id} style={{ width: dailyTileW }}>
											<ShopCard
												item={item}
												index={i}
												owned={owned.has(item.id)}
												active={isEquipped(item.id, item.category)}
												canAfford={counter >= item.cost}
												onPress={() => setPreviewItem(item)}
												onCenter={(x, y) =>
													tileCenters.current.set(item.id, { x, y })
												}
											/>
										</View>
									))}
								</View>
							</>
						)}
					</ScrollView>
				) : view === "browse" ? (
					<FlatList
						key="browse"
						data={browseRows}
						// wardrobeMode=true hides the Buy / "Today only"
						// button on un-owned items in Browse. Browse is a
						// catalog view, not a shopping surface — purchases
						// happen on the Today's Drop screen + on the
						// Preview modal (tap a card → Buy if in today's
						// drop). The Wear / Take off buttons still show
						// for items you OWN. Branch checks owned/active
						// first, so this gating only affects un-owned.
						renderItem={renderListRow(true)}
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
									<IconText
										left={<Glyph name="sparkles" size={14} />}
										gap={5}
									>
										<Text
											style={[
												styles.chipText,
												!categoryFilter && styles.chipTextActive,
											]}
										>
											All
										</Text>
									</IconText>
								</Pressable>
								{categories.map((c) => {
									const active = categoryFilter === c;
									const glyph = CATEGORY_GLYPH[c];
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
											<IconText
												left={
													glyph ? (
														<Glyph name={glyph} size={14} />
													) : undefined
												}
												gap={5}
											>
												<Text
													style={[
														styles.chipText,
														active && styles.chipTextActive,
													]}
												>
													{CATEGORY_LABELS[c] ?? c}
												</Text>
											</IconText>
										</Pressable>
									);
								})}
							</ScrollView>
						}
						ListEmptyComponent={
							<EmptyState glyph="search" title="Nothing in this band yet" />
						}
					/>
				) : view === "wardrobe" ? (
					<ClosetView
						ownedItems={ownedItems}
						allItems={allItems}
						activeIds={activeIds}
						counter={counter}
						onEquip={handleEquip}
						isEquipped={isEquipped}
						userId={userId}
						activeTitleId={activeTitleId}
						onTitleChange={setActiveTitleId}
						isVip={isVip}
					/>
				) : (
					// Trough segment — friend-funded item drives get their own
					// folder so players reach them in one tap, no scrolling past
					// the daily grid. TroughSection loads its own data (my_drives)
					// and renders null when there are no open/funded drives, so
					// this segment shows the cozy empty state in that case.
					<ScrollView
						key="trough"
						style={styles.dailyScroll}
						contentContainerStyle={styles.dailyScrollContent}
						showsVerticalScrollIndicator={false}
					>
						{/* TroughSection brings its own "Group drives" header +
						    explainer and renders null when there are no drives —
						    so the empty state stands alone in that case. */}
						{troughEmpty && (
							<EmptyState
								glyph="pigface"
								title="No drives running yet"
								sub="Open a Trough on any shop item, and your Sounder chips in snouts to help you land it."
							/>
						)}
						<TroughSection
							onBalance={(b) => setCounter(b)}
							onEmptyChange={setTroughEmpty}
						/>
					</ScrollView>
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
				onTroughOpened={(spent, newBalance) =>
					// Seed left the account server-side — reflect it in the
					// header chip NOW, not on the next focus refetch.
					setCounter((c) => newBalance ?? Math.max(0, c - spent))
				}
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
		paddingHorizontal: PAGE_PAD,
		// TODO(ui-audit): SafeAreaView inset + 8 (deferred — device QA)
		paddingTop: Platform.OS === "ios" ? 8 : 20,
		paddingBottom: SPACE.sm,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	kicker: { ...KICKER_PILL, marginBottom: SPACE.xs },
	title: { fontSize: 32, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	// Golden Ticket chip — square paper-face icon button next to the
	// balance pocket. Ink border + SHADOW_SM chrome so it reads as a
	// tappable chip, not a floating glyph.
	ticketBtn: {
		width: 40,
		height: 40,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
		marginRight: SPACE.sm,
		...SHADOW_SM,
	},
	// Snouts pocket — tilted sun sticker (matches the redesign's
	// "snouts pocket" pattern: makes the balance feel like a chip
	// you keep, not a system bar).
	balance: {
		backgroundColor: WHIMSY.sun,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		...STICKER_SHADOW,
		transform: [{ rotate: "2deg" }],
	},
	balanceText: {
		...TYPE.numeral,
		color: WHIMSY.ink,
	},
	viewToggle: {
		flexDirection: "row",
		marginHorizontal: PAGE_PAD,
		marginTop: SPACE.sm,
		marginBottom: SPACE.sm,
		backgroundColor: WHIMSY.paper,
		borderRadius: RADII.xxl,
		padding: SPACE.xs,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
	},
	viewToggleBtn: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: RADII.xl,
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
	chipsRow: {
		// Flush with the grid: the FlatList content already insets the
		// shared 12, so the chip rail carries no extra horizontal pad.
		paddingHorizontal: 0,
		// Breathing room between the Today/Collectibles/Closet toggle and the
		// category filter rail (was cramped — both used SPACE.sm).
		paddingTop: SPACE.md,
		paddingBottom: SPACE.md,
		gap: SPACE.sm,
	},
	chip: {
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: RADII.lg,
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
	grid: { paddingHorizontal: 12, paddingBottom: TAB_SAFE },
	// Today tab — scrolling container holding the 4×4 mosaic.
	// The mosaic itself is fixed-height; the surrounding scroll lets the
	// content breathe on smaller devices.
	dailyScroll: { flex: 1 },
	dailyScrollContent: {
		paddingHorizontal: 12,
		paddingTop: SPACE.xs,
		paddingBottom: TAB_SAFE,
	},
	rowWrap: {
		flexDirection: "row",
		// Card-to-card 12 (UI audit).
		gap: SPACE.md,
		marginBottom: SPACE.md,
	},
	rowSlot: {
		flex: 1,
	},
	// NOTE(ui-audit, deferred): this per-rarity in-band strip (colored dot +
	// rarity name + rule) is NOT a clean swap onto <SectionHeader> — that
	// primitive renders a kicker pill + whimsy title + full rule with no
	// leading rarity dot, so unifying would drop the rarity-color semantics
	// and change the visual weight. Pieces are token-ized in place instead;
	// the full unify onto SectionHeader stays deferred.
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm + 2,
		paddingHorizontal: SPACE.xs + 2,
		paddingTop: SPACE.md + 2,
		paddingBottom: SPACE.sm + 2,
	},
	sectionDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	sectionHeaderText: {
		...TYPE.cardTitle,
		fontSize: 14,
		lineHeight: 16,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
	sectionRule: {
		flex: 1,
		height: 1.5,
		borderRadius: 1,
	},
	// Collapsible band banner (members / everyone) — a tappable sticker bar.
	bandHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 12,
		paddingVertical: 12,
		marginTop: 14,
		marginBottom: 4,
		borderRadius: RADII.lg,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
	},
	// Subtle Slop Club gold wash behind the members header row — the identity
	// tint, not an ad. Token-derived (WHIMSY.slopBand) so it can't drift.
	bandHeaderMembers: { backgroundColor: WHIMSY.slopBand },
	bandHeaderEveryone: { backgroundColor: WHIMSY.paper },
	// "Join Slop Club" CTA nested in the members band header (non-VIP only).
	bandJoinCta: { marginRight: SPACE.xs },
	bandTitle: {
		...TYPE.cardTitle,
		fontSize: 15,
		lineHeight: 18,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
	bandSubtitle: {
		...TYPE.kickerPill,
		letterSpacing: 0.3,
		textTransform: "none",
		color: WHIMSY.mute,
		marginTop: 1,
	},
	bandChevron: {
		...TYPE.numeral,
		color: WHIMSY.ink,
		fontFamily: FONTS.bodyExtra,
	},
	// Measuring container for HatThumb's fill mode — the VIEW takes the
	// insets (views resolve them fine; it's Images that fall back to
	// intrinsic px), the Image inside gets measured numerics.
	thumbFillBox: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
});
