import { useCallback, useEffect, useRef, useState } from "react";
import {
	View,
	StyleSheet,
	Image,
	Platform,
	SafeAreaView,
	Alert,
	Text,
	Pressable,
	ScrollView,
	useWindowDimensions,
	type LayoutChangeEvent
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../utils/supabase";
import { rpc } from "@/utils/rpc";
import { useShopCatalog } from "@/hooks/useShopCatalog";
import { useTroughDrives } from "@/hooks/useTroughDrives";
import { usePigRoster } from "@/hooks/usePigRoster";
import { equipCosmetic } from "@/utils/cosmetics";
import { formatCountdownHM } from "@/utils/duration";
import { IAP_ENABLED, presentPaywall, OFFERING_IDS } from "../../utils/iap";
import { joinSlopClubAndRecruit } from "@/utils/joinSlopClub";
import { recruitPig } from "@/utils/pigRoster";
import { pigDefinition, type PigId } from "@/utils/pigs";
import { Button, SectionHeader } from "../../components/ui";
import { EmptyState, LoadingBeat } from "../../components/ui/EmptyState";
import { SnoutCoin } from "../../components/ui/SnoutCoin";
import { ClosetView } from "../../components/ClosetView";
import { TroughSection } from "../../components/TroughSection";
import { PigPenView } from "../../components/PigPenView";
import { HAT_IMAGES, HAT_THUMBNAILS_256, HatRow } from "@/constants/hats";
import { columnForCategory } from "@/constants/slots";
import { categoryIcon } from "@/constants/emojiArt";
import { Icon } from "@/components/ui/Icon";
import { Glyph } from "@/components/ui/Glyph";
import { AnimatedCosmetic } from "@/components/ui/AnimatedCosmetic";
import { cosmeticFxFor } from "@/constants/cosmeticFx";
import {
	COLORS,
	FONTS,
	KICKER_PILL,
	WHIMSY,
	STICKER_SHADOW,
	SHADOW_SM,
	SPACE,
	RADII,
	PAGE_PAD,
	TAB_SAFE,
	TYPE,
	RARITY_BG_SOLID,
	RARITY_STRIPE
} from "@/constants/theme";
import { ItemPreviewModal } from "../../components/ItemPreviewModal";
import { showPurchaseToast } from "../../components/PurchaseToast";
import { BuyCelebration, type BuyCelebrationHandle } from "../../components/ui/BuyCelebration";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

const deniedSound = require("../../assets/sounds/denied.mp3");
const equipSound = require("../../assets/sounds/equip.mp3");

function HatThumb({ item, size, fill }: { item: HatRow; size?: number; fill?: boolean }) {
	// fill mode: MEASURE the box, then render the Image at an explicit
	// numeric size. Absolute-inset sizing (the previous fix) still hit the
	// Yoga intrinsic-size quirk inside the mosaic's aspectRatio cells
	// (sixth sighting) — bows/hats rendered at native px and cropped.
	const [box, setBox] = useState<{ w: number; h: number } | null>(null);
	const hatSrc = HAT_THUMBNAILS_256[item.id] ?? HAT_IMAGES[item.id];
	// No item art → fall back to the category icon (real art). Auras +
	// necklaces have no category art (categoryIcon null) → neutral glyph.
	const catIcon = !hatSrc ? categoryIcon(item.category) : null;
	const src = hatSrc ?? catIcon;
	// Members-only / legendary items with an animation recipe render live
	// (float + glow + shimmer + sparkles) instead of a flat Image.
	const fx = hatSrc ? cosmeticFxFor(item.id) : undefined;
	if (!fill) {
		const sz = { width: size ?? 100, height: size ?? 100 };
		if (fx && hatSrc) return <AnimatedCosmetic source={hatSrc} fx={fx} size={size ?? 100} />;
		if (src) return <Image source={src} style={sz} resizeMode="contain" />;
		return <Text style={{ fontSize: (size ?? 100) * 0.55, color: WHIMSY.mute }}>✦</Text>;
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
					style={fullBleed ? { width: box.w, height: box.h } : { width: side, height: side }}
					resizeMode={fullBleed ? "cover" : "contain"}
				/>
			) : !src && box ? (
				<Text style={{ fontSize: Math.min(box.w, box.h) * 0.5, color: WHIMSY.mute }}>✦</Text>
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
			{(["common", "uncommon", "rare", "epic", "legendary"] as const).map((r) => (
					<View key={r} style={shopCardStyles.legendItem}>
					<View style={[shopCardStyles.legendDot, { backgroundColor: RARITY_STRIPE[r] }]} />
						<Text style={shopCardStyles.legendLabel}>{r}</Text>
					</View>
			))}
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
	onCenter
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
				ref.current?.measureInWindow?.((x, y, w, h) => onCenter?.(x + w / 2, y + h / 2));
			}}
			style={[
				shopCardStyles.card,
				{ transform: [{ rotate: index % 2 === 0 ? "-0.5deg" : "0.5deg" }] },
				// Locked members-only card (non-VIP) reads dimmer — same opacity
				// lane the can't-afford price chip uses, so the whole grid speaks
				// one "muted = gated" language.
				locked && shopCardStyles.cardLocked
			]}
		>
			<View style={[shopCardStyles.thumb, { backgroundColor: RARITY_BG_SOLID[rarity] }]}>
				<View style={[shopCardStyles.rdot, { backgroundColor: RARITY_STRIPE[rarity] }]} />
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
						<Text style={shopCardStyles.ownedTagLabel}>{active ? "WEARING" : "OWNED"}</Text>
					</View>
				) : item.cost <= 0 ? (
					<Text style={[shopCardStyles.ownedTag, { color: WHIMSY.mute }]}>SEASON PASS</Text>
				) : (
					<View
						style={[
							shopCardStyles.chip,
							canAfford ? shopCardStyles.chipBuy : shopCardStyles.chipLocked
						]}
					>
						<SnoutCoin size={14} />
						<Text style={[shopCardStyles.chipText, !canAfford && { color: WHIMSY.mute }]}>
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
		paddingBottom: SPACE.md
	},
	legendItem: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	legendDot: {
		width: 11,
		height: 11,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW
	},
	legendLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		textTransform: "uppercase",
		letterSpacing: 0.5
	},
	card: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		overflow: "hidden",
		...STICKER_SHADOW
	},
	// aspectRatio is safe on VIEWS — HatThumb measures inside, so the
	// image itself still gets explicit numerics (the Yoga-quirk cure).
	thumb: {
		aspectRatio: 1.18,
		borderBottomWidth: 2,
		borderColor: WHIMSY.ink,
		position: "relative"
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
		...STICKER_SHADOW
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
		...STICKER_SHADOW
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
		...SHADOW_SM
	},
	membersRibbonText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: WHIMSY.ink
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
		...SHADOW_SM
	},
	chipBuy: { backgroundColor: WHIMSY.sun },
	// Locked (can't-afford) reads as locked beyond color: muted cream
	// fill + faded ink border + a lock glyph + muted text + reduced
	// opacity. Same size as the buy chip so the grid doesn't reflow.
	chipLocked: {
		backgroundColor: WHIMSY.cream,
		borderColor: WHIMSY.muteSoft,
		opacity: 0.85
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
		paddingVertical: 8
	},
	// Owned footer as an Icon-check + label pair, centered on the same
	// footprint as the SEASON PASS text (the check replaces the raw ✓).
	ownedTagRow: {
		alignSelf: "stretch",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		paddingVertical: 8
	},
	ownedTagLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		letterSpacing: 0.5,
		textTransform: "uppercase",
		color: COLORS.successText
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		// Card-to-card 12 (UI audit). Mirrored in the dailyTileW formula —
		// keep the two in sync (numeric-width Yoga discipline).
		gap: SPACE.md,
		paddingBottom: SPACE.sm
	}
});

export default function ShopScreen() {
	// Catalog data lifecycle (fetch + derived state + reset countdown) lives in
	// useShopCatalog; the screen owns only rendering, modals, and the purchase /
	// equip flows. Optimistic setters (setCounter/setOwned/patchActiveIds/
	// setActiveTitleId) let a buy or equip reflect before the refetch lands.
	const {
		loading,
		error,
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
		patchActiveIds
	} = useShopCatalog();
	const hasCatalogData = daily.length > 0 || allItems.length > 0 || owned.size > 0;
	const isEquipped = (id: string, category: string | null | undefined) => {
		return activeIds[columnForCategory(category)] === id;
	};
	const [busyId, setBusyId] = useState<string | null>(null);
	const [previewItem, setPreviewItem] = useState<HatRow | null>(null);
	const [view, setView] = useState<"daily" | "wardrobe" | "pen">("daily");
	const [prestigeOnly, setPrestigeOnly] = useState(false);
	const [troughOpen, setTroughOpen] = useState(false);
	const troughSummary = useTroughDrives();
	const pigRoster = usePigRoster();
	const refreshPigRoster = pigRoster.refresh;

	// Deep-link target: navigation from elsewhere (e.g. the battle-pass
	// reward dialog) can pass `?view=wardrobe` to jump straight there.
	// We consume the param once on focus, then clear it from the URL so
	// switching tabs/back doesn't keep re-snapping the view.
	const params = useLocalSearchParams<{
		view?: string;
		filter?: string;
		trough?: string;
	}>();
	useEffect(() => {
		if (params.view === "trough") {
			// Compatibility for old links: Trough is now an accordion, not a
			// Shop destination. Open it in place and leave the player in Today.
			setView("daily");
			setPrestigeOnly(false);
			setTroughOpen(true);
			router.setParams({ view: undefined, filter: undefined });
		} else if (params.view === "browse") {
			// Compatibility for old links: Collectibles now lives inside Closet.
			setView("wardrobe");
			setPrestigeOnly(false);
			router.setParams({ view: undefined, filter: undefined });
		} else if (
			params.view === "wardrobe" ||
			params.view === "daily" ||
			params.view === "pen"
		) {
			setView(params.view);
			setPrestigeOnly(
				params.view === "wardrobe" && params.filter === "prestige",
			);
			router.setParams({ view: undefined, filter: undefined });
		}
	}, [params.filter, params.view]);
	useEffect(() => {
		if (params.trough === "open") {
			setTroughOpen(true);
			router.setParams({ trough: undefined });
		}
	}, [params.trough]);
	useEffect(() => {
		if (troughSummary.count === 0) setTroughOpen(false);
	}, [troughSummary.count]);
	// Title EQUIP UI renders inside ClosetView (the Closet view). Titles are
	// earned-only now (see 20260677) — there is no shop buy path. activeTitleId
	// + userId are sourced from the profile by useShopCatalog; the Closet reads
	// them (and pushes title changes back through setActiveTitleId).

	// Imperative handle for the on-screen "ka-ching" particle burst.
	// Fired from handleBuy on the tile that was just purchased.
	const celebrationRef = useRef<BuyCelebrationHandle>(null);
	const tileCenters = useRef<Map<string, { x: number; y: number }>>(new Map());
	// Pre-loaded SFX players. expo-audio caches the decoded buffer so
	// .play() after seekTo(0) is effectively instant on subsequent fires.
	const deniedPlayer = useAudioPlayer(deniedSound);
	const equipPlayer = useAudioPlayer(equipSound);

	// Join Slop Club from the members band header — the SAME RevenueCat offering
	// components/Account.tsx and the season premium unlock present. is_vip flips
	// server-side via the webhook; re-running the catalog fetch re-reads the
	// profile, which unlocks the members band + drops the ribbon locks.
	const handleJoinSlopClub = useCallback(
		async (pigId?: PigId) => {
			if (!pigId) {
				if (!IAP_ENABLED) {
					Alert.alert(
						"Slop Club isn’t enabled in this build",
						"Open a store-enabled build to join the Slop Club."
					);
					return;
				}
				const paywall = await presentPaywall(OFFERING_IDS.slopClub);
				if (paywall.ok) {
					await Promise.all([refresh(), refreshPigRoster()]);
					showPurchaseToast({
						type: "success",
						title: "Welcome to the Slop Club!",
						text: "Choose Rosie’s friend in the Pen."
					});
				} else if (paywall.reason !== "cancelled") {
					Alert.alert(
						"Couldn’t open the Slop Club",
						paywall.reason === "no_offering"
							? "The storefront isn’t available right now. Please try again soon."
							: "Please try again."
					);
				}
				return;
			}

			const outcome = await joinSlopClubAndRecruit(pigId, {
				iapEnabled: IAP_ENABLED,
				presentPaywall: () => presentPaywall(OFFERING_IDS.slopClub),
				recruit: recruitPig
			});

			if (outcome.kind === "cancelled") return;
			if (outcome.kind === "unavailable") {
				Alert.alert(
					"Slop Club isn’t enabled in this build",
					"Open a store-enabled build to join and recruit this pig."
				);
				return;
			}
			if (outcome.kind === "paywall_error") {
				Alert.alert(
					"Couldn’t open the Slop Club",
					outcome.reason === "no_offering"
						? "The storefront isn’t available right now. Please try again soon."
						: "Please try again."
				);
				return;
			}

			await Promise.all([refresh(), refreshPigRoster()]);
			if (outcome.kind === "joined") {
				const pig = pigDefinition(outcome.pigId);
				showPurchaseToast({
					type: "success",
					title: `${pig.name} joined the Pen!`,
					text: "Your Slop Club membership is active."
				});
				return;
			}

			Alert.alert(
				"Membership active",
				outcome.reason === "membership_syncing"
					? "Your membership is still syncing. Try Recruit again in a moment."
					: "The membership worked, but this pig couldn’t join yet. Try Recruit again."
			);
		},
		[refresh, refreshPigRoster]
	);

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
			target_hat_id: hat.id
		});
		setBusyId(null);
		if (!r) {
			showPurchaseToast({
				type: "fail",
				title: "Couldn't buy",
				text: "Try again."
			});
			return;
		}
		if (!r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
			try {
				deniedPlayer.seekTo(0);
				deniedPlayer.play();
			} catch {}
			if (r.reason === "insufficient") {
				showPurchaseToast({
					type: "fail",
					title: "Not enough snouts",
					text: `You need ${(r.need ?? 0) - (r.have ?? 0)} more.`
				});
				return;
			}
			if (r.reason === "already_owned") {
				showPurchaseToast({
					type: "fail",
					title: "Already yours",
					text: "You already own this one."
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
					text: "Unlock this from the Season Pass or a referral milestone."
				});
				return;
			}
			showPurchaseToast({
				type: "fail",
				title: "Couldn't buy",
				text: r.reason ?? "Something went wrong."
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
			cost: hat.cost
		});
		// Fire the on-screen ka-ching celebration anchored at the tile
		// the user tapped. Tile center is recorded in tileCenters by
		// renderCell's onLayout; if missing (race / unmount), the burst
		// shows at a sensible mid-screen fallback.
		const center = tileCenters.current.get(hat.id);
		celebrationRef.current?.fire({
			x: center?.x ?? 200,
			y: center?.y ?? 400,
			tier: hat.rarity === "epic" || hat.rarity === "legendary" ? "premium" : "common"
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
	const handleEquip = async (itemId: string | null, category: string | null | undefined) => {
		const {
			data: { user }
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
						style={({ pressed }) => [styles.ticketBtn, pressed && { opacity: 0.7 }]}
					>
						<Glyph name="gift" size={20} />
					</Pressable>
					<View style={styles.balance}>
						<SnoutCoin size={20} />
						<Text style={styles.balanceText}>{counter.toLocaleString()}</Text>
					</View>
				</View>

				{troughSummary.count > 0 ? (
					<View style={styles.troughAccordion}>
						<Pressable
							onPress={() => setTroughOpen((open) => !open)}
							style={({ pressed }) => [styles.troughAccordionHeader, pressed && { opacity: 0.82 }]}
							accessibilityRole="button"
							accessibilityState={{ expanded: troughOpen }}
							accessibilityLabel={`The Trough, ${
								troughSummary.activeCount > 0
									? `${troughSummary.activeCount} active`
									: `${troughSummary.claimable.length} updates`
							}`}
						>
							<View style={styles.troughAccordionTitleRow}>
								<Glyph name="pigface" size={20} />
								<Text style={styles.troughAccordionTitle}>The Trough</Text>
							</View>
							<View style={styles.troughAccordionMeta}>
								<View style={styles.troughAccordionBadge}>
									<Text style={styles.troughAccordionBadgeText}>
										{troughSummary.activeCount > 0
											? `${troughSummary.activeCount} active`
											: `${troughSummary.claimable.length} ${
													troughSummary.claimable.length === 1 ? "update" : "updates"
												}`}
									</Text>
								</View>
								<Icon
									name="chevronDown"
									size={20}
									color={WHIMSY.ink}
									style={troughOpen ? styles.troughChevronOpen : undefined}
								/>
							</View>
						</Pressable>
						{troughOpen ? (
							<View style={styles.troughAccordionBody}>
								<TroughSection data={troughSummary} onBalance={(balance) => setCounter(balance)} />
							</View>
						) : null}
					</View>
				) : null}

				<View style={styles.viewToggle}>
					{(["daily", "wardrobe", "pen"] as const).map((v) => {
						const active = v === view;
						const label =
							v === "daily"
								? "Today"
								: v === "wardrobe"
										? "Closet"
										: "Pen";
						return (
							<Pressable
								key={v}
								onPress={() => {
									setView(v);
									setPrestigeOnly(false);
								}}
								style={({ pressed }) => [
									styles.viewToggleBtn,
									active && styles.viewToggleBtnActive,
									pressed && { opacity: 0.7 }
									]}
								>
								<Text style={[styles.viewToggleText, active && styles.viewToggleTextActive]}>
									{label}
									{v === "wardrobe" && owned.size > 0 ? ` · ${owned.size}` : ""}
								</Text>
							</Pressable>
						);
					})}
				</View>

				{error ? (
					<View
						style={styles.catalogError}
						accessibilityRole="alert"
						accessibilityLiveRegion="polite"
					>
						<View style={{ flex: 1, minWidth: 0 }}>
							<Text style={styles.catalogErrorTitle}>Shop unavailable</Text>
							<Text style={styles.catalogErrorBody}>{error}</Text>
						</View>
						<Button
							variant="ghost"
							size="sm"
							onPress={() => void refresh()}
							accessibilityHint="Tries to load the shop again"
						>
							Try again
						</Button>
					</View>
				) : null}

				{error && !hasCatalogData ? null : view === "daily" ? (
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
												onCenter={(x, y) => tileCenters.current.set(item.id, { x, y })}
											/>
										</View>
									))}
								</View>
							</>
						)}
					</ScrollView>
				) : view === "wardrobe" ? (
					<ClosetView
						ownedItems={ownedItems}
						allItems={allItems}
						activeIds={activeIds}
						onEquip={handleEquip}
						onPreview={setPreviewItem}
						isEquipped={isEquipped}
						userId={userId}
						activeTitleId={activeTitleId}
						onTitleChange={setActiveTitleId}
						isVip={isVip}
						prestigeOnly={prestigeOnly}
						onClearPrestigeFilter={() => setPrestigeOnly(false)}
					/>
				) : (
					<PigPenView
						roster={pigRoster.roster}
						loading={pigRoster.loading}
						busyPigId={pigRoster.busyPigId}
						onJoinSlopClub={handleJoinSlopClub}
						onRecruit={pigRoster.recruit}
						onActivate={pigRoster.activate}
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
		alignItems: "center"
	},
	kicker: { ...KICKER_PILL, marginBottom: SPACE.xs },
	title: { ...TYPE.display, color: WHIMSY.ink },
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
		...SHADOW_SM
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
		transform: [{ rotate: "2deg" }]
	},
	balanceText: {
		...TYPE.numeral,
		color: WHIMSY.ink
	},
	viewToggle: {
		flexDirection: "row",
		marginHorizontal: PAGE_PAD,
		marginTop: SPACE.md,
		marginBottom: SPACE.sm,
		backgroundColor: WHIMSY.paper,
		borderRadius: RADII.xxl,
		padding: SPACE.xs,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW
	},
	catalogError: {
		marginHorizontal: PAGE_PAD,
		marginBottom: SPACE.md,
		padding: SPACE.md,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		backgroundColor: COLORS.paper2,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md
	},
	catalogErrorTitle: {
		...TYPE.cardTitle,
		fontSize: 16,
		color: WHIMSY.ink
	},
	catalogErrorBody: {
		...TYPE.hand,
		marginTop: 2,
		color: WHIMSY.mute
	},
	viewToggleBtn: {
		flex: 1,
		minHeight: 44,
		justifyContent: "center",
		paddingVertical: SPACE.sm,
		borderRadius: RADII.xl,
		alignItems: "center"
	},
	troughAccordion: {
		marginHorizontal: PAGE_PAD,
		marginTop: SPACE.sm
	},
	troughAccordionHeader: {
		minHeight: 52,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: SPACE.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.sage,
		...SHADOW_SM
	},
	troughAccordionTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm
	},
	troughAccordionTitle: {
		...TYPE.cardTitle,
		color: WHIMSY.ink
	},
	troughAccordionMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm
	},
	troughAccordionBadge: {
		minHeight: 28,
		justifyContent: "center",
		paddingHorizontal: SPACE.sm,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.paper
	},
	troughAccordionBadgeText: {
		...TYPE.label,
		color: WHIMSY.ink
	},
	troughChevronOpen: { transform: [{ rotate: "180deg" }] },
	troughAccordionBody: {
		marginTop: SPACE.sm,
		padding: SPACE.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream
	},
	viewToggleBtnActive: {
		backgroundColor: WHIMSY.rose,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink
	},
	viewToggleText: {
		...TYPE.label,
		color: WHIMSY.mute,
		textAlign: "center"
	},
	viewToggleTextActive: {
		fontFamily: FONTS.bodyBlack,
		color: WHIMSY.ink
	},
	// Today tab — scrolling container holding the 4×4 mosaic.
	// The mosaic itself is fixed-height; the surrounding scroll lets the
	// content breathe on smaller devices.
	dailyScroll: { flex: 1 },
	dailyScrollContent: {
		paddingHorizontal: 12,
		paddingTop: SPACE.xs,
		paddingBottom: TAB_SAFE
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
		overflow: "hidden"
	}
});
