// The Pop-up Stall's own page (canvas row B, 2026-10-29; SKILL.md "the
// seasonal shelf is a Pop-up Stall, and a set is data"). Pushed from the stall
// card at the top of the shop wall. The crown says how long the stall stays;
// the body is components/shop/StallPage; a tap opens the try-on sheet the
// whole store uses, wearing a lilac "leaving in N days" tag; Buy now asks
// first with a ConfirmDialog that names the price and the window.
//
// The page reads two things: the stall (useSeasonalShelf, seasonal_shelf())
// and the store's own catalog state (useShopCatalog: balance, closet, what she
// is wearing), so a buy or an equip here is the same buy or equip as the Shop
// tab's. buy_hat() is the gate: a new piece outside its window is refused
// with `not_in_window` (20261029220000).
import { useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import {
	BuyCelebration,
	Button,
	EmptyState,
	LoadingBeat,
	PageHeader,
	ScrollEdge,
	STACK_SCROLL_EDGES,
	StackPage,
	useScrollEdge,
	type BuyCelebrationHandle,
} from "@/components/ui";
import { ItemPreviewModal } from "@/components/ItemPreviewModal";
import { showPurchaseToast } from "@/components/PurchaseToast";
import { showToast } from "@/components/ui/Toast";
import { usePigRoster } from "@/hooks/usePigRoster";
import { costumeEquipRefusal, costumeTakeOffToast } from "@/utils/costumeCopy";
import { StallPage } from "@/components/shop/StallPage";
import { SnoutsPocket } from "@/components/shop/SnoutsPocket";
import { gridTileWidth } from "@/components/shop/ShopCard";
import { useSeasonalShelf, stallVisible } from "@/hooks/useSeasonalShelf";
import { markStallVisited } from "@/hooks/useStallOnboarding";
import { useShopCatalog } from "@/hooks/useShopCatalog";
import { columnForCategory } from "@/constants/slots";
import { CHROME_TYPE_CAP, PAGE_PAD } from "@/constants/theme";
import { equipCosmetic } from "@/utils/cosmetics";
import { rpc } from "@/utils/rpc";
import { cardTapAction } from "@/utils/shopShelves";
import { stallBuyCopy, type ShelfItem } from "@/utils/seasonalShelf";
import { closedLabel, leavingLabel } from "@/utils/shelfCountdown";

const deniedSound = require("../../assets/sounds/denied.mp3");
const equipSound = require("../../assets/sounds/equip.mp3");

/** Where the buy burst fires when the tile's measured centre is missing. */
const FALLBACK_BURST = { x: 200, y: 400 };

type BuyResult = {
	ok: boolean;
	reason?: string;
	need?: number;
	have?: number;
	remaining?: number;
};

/** A refused buy, in the store's words. */
function refusal(r: BuyResult): { title: string; text: string } {
	switch (r.reason) {
		case "insufficient":
			return {
				title: "Not enough snouts",
				text: `You need ${((r.need ?? 0) - (r.have ?? 0)).toLocaleString()} more.`,
			};
		case "already_owned":
			return { title: "Already yours", text: "You already own this one." };
		case "members_only":
			return { title: "Slop Club only", text: "Join the Slop Club to buy members' pieces." };
		case "not_in_window":
			return { title: "The stall has packed up", text: "This piece left with the stall." };
		default:
			return { title: "Couldn't buy", text: "Try again." };
	}
}

export default function StallScreen() {
	const params = useLocalSearchParams<{ key?: string }>();
	const stall = useSeasonalShelf();
	const catalog = useShopCatalog();
	const pigRoster = usePigRoster();
	const { owned, activeIds, counter, isVip, allItems } = catalog;
	const edge = useScrollEdge();
	const { width } = useWindowDimensions();
	const [previewItem, setPreviewItem] = useState<ShelfItem | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);
	const celebrationRef = useRef<BuyCelebrationHandle>(null);
	const tileCenters = useRef<Map<string, { x: number; y: number }>>(new Map());
	const deniedPlayer = useAudioPlayer(deniedSound);
	const equipPlayer = useAudioPlayer(equipSound);

	const shelf = stall.shelf && stall.shelf.key === params.key ? stall.shelf : null;
	const phase = shelf && stallVisible(stall.phase) ? stall.phase : null;
	const open = phase === "open";
	const ownedNow = (id: string) =>
		owned.has(id) || !!shelf?.items.some((i) => i.id === id && i.owned);
	const isEquipped = (id: string, category: string | null | undefined) =>
		ownedNow(id) && activeIds[columnForCategory(category)] === id;
	const equippedPreviewSlot = (column: "active_hat_id" | "active_bow_id") => {
		const id = activeIds[column];
		if (!id) return null;
		const row = allItems.find((c) => c.id === id);
		return { id, category: row?.category ?? null, emoji: row?.emoji ?? null };
	};
	const leaving = shelf ? leavingLabel(shelf.closesAt, stall.now) : null;
	const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/shop"));

	// The first step inside takes the Shop card's "new here?" tag down for
	// good (B1, once per set key).
	const visitKey = params.key ?? null;
	const visitUser = catalog.userId;
	useEffect(() => {
		if (visitKey && visitUser) void markStallVisited(visitKey, visitUser);
	}, [visitKey, visitUser]);

	const handleEquip = async (itemId: string | null, category: string | null | undefined) => {
		// Full costumes (Halloween 2026) fit Rosie only in v1, and taking one
		// off says what comes back out from underneath.
		const refusal = costumeEquipRefusal(category, itemId, pigRoster.roster.activePigId);
		if (refusal) {
			showToast({ tone: "info", title: refusal });
			return;
		}
		const offLine = costumeTakeOffToast(category, itemId, activeIds, (id) =>
			[...catalog.wornItems, ...allItems].find((row) => row.id === id)?.name,
		);
		Haptics.selectionAsync().catch(() => {});
		try {
			equipPlayer.seekTo(0);
			equipPlayer.play();
		} catch {}
		const update = await equipCosmetic(itemId, category);
		catalog.patchActiveIds(update);
		if (offLine && "active_costume_id" in update) showToast({ tone: "info", title: offLine });
	};

	const handleBuy = async (item: ShelfItem) => {
		if (busyId || !open) return;
		setBusyId(item.id);
		const r = await rpc<BuyResult>("buy_hat", { target_hat_id: item.id });
		setBusyId(null);
		if (!r || !r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
			try {
				deniedPlayer.seekTo(0);
				deniedPlayer.play();
			} catch {}
			showPurchaseToast({ type: "fail", ...(r ? refusal(r) : refusal({ ok: false })) });
			if (r?.reason === "not_in_window") void stall.refresh();
			return;
		}
		catalog.setCounter((c) => r.remaining ?? Math.max(0, c - item.cost));
		catalog.setOwned((prev) => new Set(prev).add(item.id));
		stall.markOwned(item.id);
		showPurchaseToast({
			type: "success",
			title: `${item.name} · Bought`,
			text: "Added to your closet for keeps.",
			cost: item.cost,
		});
		const center = tileCenters.current.get(item.id);
		celebrationRef.current?.fire({
			x: center?.x ?? FALLBACK_BURST.x,
			y: center?.y ?? FALLBACK_BURST.y,
			tier: item.rarity === "epic" || item.rarity === "legendary" ? "premium" : "common",
		});
		void catalog.refresh();
	};

	const tapItem = (item: ShelfItem) => {
		const tap = cardTapAction(item.id, {
			owned: ownedNow(item.id),
			active: isEquipped(item.id, item.category),
		});
		if (tap.kind === "equip") void handleEquip(tap.itemId, item.category);
		else setPreviewItem(item);
	};

	return (
		<StackPage edges={STACK_SCROLL_EDGES}>
			<PageHeader
				kicker={
					shelf
						? open
							? (leaving ?? "seasonal stall")
							: closedLabel(shelf.closesAt, shelf.theme.back_line)
						: "seasonal stall"
				}
				title={shelf?.title ?? "The stall"}
				backLabel="Shop"
				onBack={back}
				right={<SnoutsPocket balance={counter} />}
				maxFontSizeMultiplier={CHROME_TYPE_CAP}
			/>
			<ScrollEdge visible={edge.edgeVisible} />
			{shelf && phase ? (
				<StallPage
					shelf={shelf}
					items={stall.items}
					phase={phase}
					owned={owned}
					isEquipped={isEquipped}
					counter={counter}
					isVip={isVip}
					tileWidth={gridTileWidth(width, PAGE_PAD)}
					onPressItem={tapItem}
					onLongPressItem={setPreviewItem}
					onCenter={(id, x, y) => tileCenters.current.set(id, { x, y })}
					onScroll={edge.onScroll}
				/>
			) : stall.loading ? (
				<LoadingBeat label="opening the stall" />
			) : (
				<EmptyState
					glyph="signStore"
					title="No stall today"
					sub="When a seasonal stall opens, it hangs at the top of the shop."
					action={
						<Button
							variant="ghost"
							size="sm"
							onPress={back}
							accessibilityLabel="Back to the shop"
							accessibilityHint="Returns to the shop"
						>
							Back to the shop
						</Button>
					}
				/>
			)}
			<ItemPreviewModal
				item={previewItem}
				owned={previewItem ? ownedNow(previewItem.id) : false}
				active={previewItem ? isEquipped(previewItem.id, previewItem.category) : false}
				wornActiveIds={activeIds}
				viewerPigId={pigRoster.roster.activePigId}
				canAfford={previewItem ? counter >= previewItem.cost : false}
				balance={counter}
				busy={previewItem ? busyId === previewItem.id : false}
				buyable={open}
				// Troughs open only for today's drop (open_item_drive's
				// `not_in_shop`); the stall is its own shelf.
				troughable={false}
				locked={previewItem ? !!previewItem.members_only && !isVip : false}
				equippedHat={equippedPreviewSlot("active_hat_id")}
				equippedBow={equippedPreviewSlot("active_bow_id")}
				windowTag={open ? leaving : null}
				buyConfirm={
					previewItem && shelf
						? stallBuyCopy(previewItem, counter, shelf.closesAt, stall.now)
						: null
				}
				onClose={() => setPreviewItem(null)}
				onBuy={() => {
					if (previewItem) void handleBuy(previewItem);
				}}
				onEquip={() => {
					if (previewItem) {
						void handleEquip(previewItem.id, previewItem.category);
						setPreviewItem(null);
					}
				}}
				onUnequip={() => {
					if (previewItem) {
						void handleEquip(null, previewItem.category);
						setPreviewItem(null);
					}
				}}
			/>
			<BuyCelebration ref={celebrationRef} />
		</StackPage>
	);
}
