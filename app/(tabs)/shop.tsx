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
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../utils/supabase";
import { rpc } from "@/utils/rpc";
import { formatHM } from "@/utils/time";
import { Button, SectionHeader } from "../../components/ui";
import { EmptyState } from "../../components/ui/EmptyState";
import { SnoutCoin } from "../../components/ui/SnoutCoin";
import { ClosetView } from "../../components/ClosetView";
import { TroughSection } from "../../components/TroughSection";
import {
	HAT_IMAGES,
	HatRow,
	RARITY_COLORS,
	HIDDEN_CATEGORIES,
} from "@/constants/hats";
import { SLOT_COLUMN, slotForCategory, columnForCategory } from "@/constants/slots";
import { categoryIcon } from "@/constants/emojiArt";
import { Icon } from "@/components/ui/Icon";
import { Glyph, IconText, type GlyphName } from "@/components/ui/Glyph";
import { AnimatedCosmetic } from "@/components/ui/AnimatedCosmetic";
import { cosmeticFxFor } from "@/constants/cosmeticFx";
import { type ListRow, buildBrowseRows } from "@/constants/shopRows";
import { COLORS, FONTS, KICKER_PILL, WHIMSY, STICKER_SHADOW, SHADOW_SM, SPACE, RADII, PAGE_PAD, TAB_SAFE } from "@/constants/theme";
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

function formatCountdown(secs: number): string {
	return formatHM(secs * 1000);
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
const SHOP_RARITY_DOT: Record<string, string> = {
	common: "#cdbfae",
	uncommon: "#7ba868",
	rare: "#5a8bc5",
	epic: "#a89bff",
	legendary: "#d4a437",
};
const SHOP_RARITY_TINT: Record<string, string> = {
	common: "#f4ebe0",
	uncommon: "#d9ead0",
	rare: "#cfe0ec",
	epic: "#e2daf6",
	legendary: "#ffe7ad",
};

function RarityLegend() {
	return (
		<View style={shopCardStyles.legend}>
			{(["common", "uncommon", "rare", "epic", "legendary"] as const).map(
				(r) => (
					<View key={r} style={shopCardStyles.legendItem}>
						<View
							style={[
								shopCardStyles.legendDot,
								{ backgroundColor: SHOP_RARITY_DOT[r] },
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
	onPress,
	onCenter,
}: {
	item: HatRow;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	// Position in the grid — drives the alternating ±0.5° sticker tilt.
	index: number;
	// Members-only item + caller isn't a Slop Club member → gold lock badge.
	locked?: boolean;
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
			]}
		>
			<View
				style={[
					shopCardStyles.thumb,
					{ backgroundColor: SHOP_RARITY_TINT[rarity] },
				]}
			>
				<View
					style={[
						shopCardStyles.rdot,
						{ backgroundColor: SHOP_RARITY_DOT[rarity] },
					]}
				/>
				{owned ? (
					<View style={shopCardStyles.ownedBadge}>
						<Text style={shopCardStyles.ownedBadgeText}>✓</Text>
					</View>
				) : locked ? (
					<View style={shopCardStyles.lockBadge}>
						<Glyph name="lock" size={14} />
					</View>
				) : null}
				<HatThumb item={item} fill />
			</View>
			<View style={shopCardStyles.foot}>
				<Text numberOfLines={1} style={shopCardStyles.nm}>
					{item.name}
				</Text>
				{owned ? (
					<Text style={shopCardStyles.ownedTag}>
						✓ {active ? "WEARING" : "OWNED"}
					</Text>
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
		columnGap: SPACE.md,
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
		fontSize: 10.5,
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
	ownedBadgeText: { fontSize: 14, fontFamily: FONTS.bodyExtra, color: WHIMSY.ink },
	// Gold members-only lock — same corner as the owned check, Slop Club hue.
	lockBadge: {
		position: "absolute",
		top: SPACE.sm,
		right: SPACE.sm,
		width: 26,
		height: 26,
		borderRadius: 13,
		backgroundColor: "#F5C44A",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 2,
		...STICKER_SHADOW,
	},
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
		borderColor: "rgba(42,31,21,.34)",
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
		color: "#5b8a4a",
		paddingVertical: 8,
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
	const [daily, setDaily] = useState<HatRow[]>([]);
	const [allItems, setAllItems] = useState<HatRow[]>([]);
	const [owned, setOwned] = useState<Set<string>>(new Set());
	// Multi-slot equipment: hat, aura, and background each have their own
	// column on profiles. Equipping an aura clears the aura slot only,
	// leaving any hat/background equipped intact. See migration
	// 20260514000000_aura_background_slots.sql for the schema.
	// Keyed by profiles column (active_hat_id, active_glasses_id, …).
	const [activeIds, setActiveIds] = useState<Record<string, string | null>>({});
	const isEquipped = (id: string, category: string | null | undefined) => {
		return activeIds[columnForCategory(category)] === id;
	};
	const [counter, setCounter] = useState<number>(0);
	// The current user's display name, used as the sample handle in
	// the TitleRow live-preview ("Halo Bearer <you>" / "<you> Drove
	// Captain"). Falls back to "you" if the fetch hasn't returned.
	const [myUsername, setMyUsername] = useState<string>("you");
	const [busyId, setBusyId] = useState<string | null>(null);
	const [previewItem, setPreviewItem] = useState<HatRow | null>(null);
	const [resetsIn, setResetsIn] = useState<number>(0);
	const [view, setView] = useState<"daily" | "browse" | "wardrobe">("daily");
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	// Slop Club membership — drives the lock badge + members section CTA in
	// the Collectibles catalog (the buy itself is server-gated by buy_hat).
	const [isVip, setIsVip] = useState<boolean>(false);
	// Collapse state for the two Collectibles bands (members shown first).
	const [collapsed, setCollapsed] = useState<{ members: boolean; everyone: boolean }>(
		{ members: false, everyone: false }
	);

	// Deep-link target: navigation from elsewhere (e.g. the battle-pass
	// reward dialog) can pass `?view=wardrobe` to jump straight there.
	// We consume the param once on focus, then clear it from the URL so
	// switching tabs/back doesn't keep re-snapping the view.
	const params = useLocalSearchParams<{ view?: string }>();
	useEffect(() => {
		if (
			params.view === "wardrobe" || params.view === "browse" ||
			params.view === "daily"
		) {
			setView(params.view);
			router.setParams({ view: undefined });
		}
	}, [params.view]);
	// Title EQUIP UI renders inside ClosetView (the Closet view). Titles are
	// earned-only now (see 20260677) — there is no shop buy path. activeTitleId
	// is sourced from profiles.active_title_id (20260511); userId is captured
	// separately so the Closet can load the player's owned titles.
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

		// Shape of the profiles row selected below. `active_title_id` is
		// optional because the fallback query (run when that column isn't
		// deployed yet) omits it.
		type ProfileRow = {
			username: string | null;
			counter: number | null;
			is_vip?: boolean | null;
			active_hat_id: string | null;
			active_glasses_id: string | null;
			active_mask_id: string | null;
			active_neck_id: string | null;
			active_aura_id: string | null;
			active_background_id: string | null;
			active_held_id: string | null;
			active_tickle_particle_id?: string | null;
			active_flag_id: string | null;
			active_title_id?: string | null;
		};
		const [dailyRes, allRes, ownedRes, profRes, resetsRes] = await Promise.all([
			rpc<HatRow[]>("daily_shop"),
			// pass_exclusive lands in 20260675. On a pre-migration server the
			// unknown column 400s the whole select — retry without it so Browse
			// still loads (server daily_shop/buy_hat gate pass items regardless;
			// the cost>0 filter hides them client-side until the column exists).
			supabase
				.from("hats")
				.select("id, name, cost, display_order, emoji, image_path, category, rarity, description, pass_exclusive, members_only")
				.order("display_order")
				.then(async (res) => {
					if (res.error) {
						return supabase
							.from("hats")
							.select("id, name, cost, display_order, emoji, image_path, category, rarity, description")
							.order("display_order");
					}
					return res;
				}),
			supabase.from("user_hats").select("hat_id").eq("user_id", user.id),
			// active_title_id depends on the 20260511 migration. If the
			// column isn't deployed yet the select errors — retry without
			// it so the shop still loads.
			supabase
				.from("profiles")
				.select("username, counter, is_vip, active_hat_id, active_glasses_id, active_mask_id, active_neck_id, active_aura_id, active_background_id, active_held_id, active_tickle_particle_id, active_flag_id, active_title_id")
				.eq("id", user.id)
				.single()
				.then(async (res) => {
					if (res.error) {
						return supabase
							.from("profiles")
							.select("username, counter, is_vip, active_hat_id, active_glasses_id, active_mask_id, active_neck_id, active_aura_id, active_background_id, active_held_id, active_tickle_particle_id, active_flag_id")
							.eq("id", user.id)
							.single();
					}
					return res;
				}),
			rpc<number>("shop_resets_in_seconds"),
		]);
		const filterPlaceable = (rows: HatRow[]) =>
			rows.filter(
				(r) => !r.category || !HIDDEN_CATEGORIES.has(r.category)
			);
		const ownedSet = new Set(
			((ownedRes.data ?? []) as { hat_id: string }[]).map((r) => r.hat_id)
		);
		setDaily(filterPlaceable(dailyRes ?? []));
		// Cost-0 items are season-pass exclusives — not for sale. Only surface
		// them if the player already OWNS them (claimed via the pass); otherwise
		// they leak into the browseable shop (which players noticed).
		setAllItems(
			filterPlaceable((allRes.data as HatRow[]) ?? []).filter(
				(r) => (r.cost > 0 && !r.pass_exclusive) || ownedSet.has(r.id)
			)
		);
		setOwned(ownedSet);
		const prof = (profRes.data as ProfileRow | null) ?? null;
		setCounter(prof?.counter ?? 0);
		setMyUsername(prof?.username ?? "you");
		setIsVip(!!prof?.is_vip);
		{
			const pr = prof ?? ({} as Partial<ProfileRow>);
			setActiveIds({
				active_hat_id: pr.active_hat_id ?? null,
				active_glasses_id: pr.active_glasses_id ?? null,
				active_mask_id: pr.active_mask_id ?? null,
				active_neck_id: pr.active_neck_id ?? null,
				active_aura_id: pr.active_aura_id ?? null,
				active_background_id: pr.active_background_id ?? null,
				active_held_id: pr.active_held_id ?? null,
				active_tickle_particle_id: pr.active_tickle_particle_id ?? null,
				active_flag_id: pr.active_flag_id ?? null,
			});
		}
		setActiveTitleId(prof?.active_title_id ?? null);
		setUserId(user.id);
		setResetsIn(resetsRes ?? 0);
	}, []);

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
		// returns the post-spend counter as `remaining`); load() below
		// still reconciles owned/daily, but the spend must never wait
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
		// Category-precise column (glasses + masks share the Face CHIP but
		// keep separate columns — columnForCategory routes correctly).
		const column = columnForCategory(category);
		const update: Record<string, string | null> = { [column]: itemId };
		// Face exclusivity: the merged chip shows one face item at a time,
		// so equipping glasses clears any mask and vice versa. Unequips
		// (itemId null) leave the sibling alone.
		if (itemId) {
			if (category === "glasses") update.active_mask_id = null;
			if (category === "mask") update.active_glasses_id = null;
		}
		await supabase.from("profiles").update(update).eq("id", user.id);
		setActiveIds((prev) => ({ ...prev, ...update }));
	};

	const dailyIds = useMemo(() => new Set(daily.map((d) => d.id)), [daily]);

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
					<View style={[styles.sectionRule, { backgroundColor: accent + "33" }]} />
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
					<View style={styles.balance}>
						<SnoutCoin size={20} />
						<Text style={styles.balanceText}>{counter.toLocaleString()}</Text>
					</View>
				</View>

				<View style={styles.viewToggle}>
					{(["daily", "browse", "wardrobe"] as const).map((v) => {
						const active = v === view;
						const label =
							v === "daily" ? "Today"
								: v === "browse" ? "Collectibles"
								: "Closet";
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
							right={`resets in ${formatCountdown(resetsIn)}`}
						/>
						<RarityLegend />
						{daily.length === 0 ? (
							<EmptyState
								glyph="zzz"
								title="All sold out for today"
								sub="A fresh drop arrives at sunrise."
							/>
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
								<TroughSection
									onBalance={(b) => setCounter(b)}
								/>
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
				) : (
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
		fontSize: 17,
		fontFamily: FONTS.whimsy,
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
	columnWrap: { gap: SPACE.md },
	rowWrap: {
		flexDirection: "row",
		// Card-to-card 12 (UI audit).
		gap: SPACE.md,
		marginBottom: SPACE.md,
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
	bandHeaderMembers: { backgroundColor: "#FFE7AD" },
	bandHeaderEveryone: { backgroundColor: WHIMSY.paper },
	bandTitle: {
		fontSize: 15,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
	bandSubtitle: {
		fontSize: 11,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	bandChevron: {
		fontSize: 16,
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
		// In row mode, give the thumb a portrait-ish 0.75 aspect
		// (narrower than tall) instead of a full square. That hands
		// ~25% more width to the body so the Wear/Buy button isn't
		// clipped to a single letter. Image still reads at this
		// shape because it's contain-fitted within the cell.
		aspectRatio: 0.75,
		flex: 0,
	},
	cardThumb: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
		overflow: "hidden",
	},
	cardBody: {
		// Tighter padding so the small 1×1 + 2×1 cells get more
		// content room without the visible card area growing.
		padding: 8,
	},
	cardBodyHoriz: {
		flex: 1,
		justifyContent: "center",
		paddingLeft: 6,
		paddingRight: 8,
	},
	cardName: {
		fontFamily: FONTS.whimsy,
		// Dropped from 15 → 13. Pairs with the 2-line wrap +
		// adjustsFontSizeToFit at the call site so "Sparkle Aura"
		// and "Homestead Barn" fit cleanly in 1×1 cells without
		// truncation.
		fontSize: 13,
		lineHeight: 15,
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
		marginBottom: 6,
		minHeight: 16,
	},
	// (wide cells) name is left-aligned — keep the price under it,
	// not floating centered in the column.
	priceRowHoriz: {
		justifyContent: "flex-start",
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
		// Top-left to match the redesign — leaves the top-right
		// quadrant free for the premium ✦ sparkle accent in hero
		// mosaic cells.
		position: "absolute",
		top: 8,
		left: 8,
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
		paddingVertical: 36,
		paddingHorizontal: 24,
	},
	wardrobeEmptyTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		marginTop: 12,
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
