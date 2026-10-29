// Dev preview for the Pop-up Stall (canvas row B, docs/design/claude-design/
// shop-2026-10-29/): the stall card and the stall page as fixture states, so
// the stall can be seen on the sim without a live window. Fake shelf, fake
// closet, a fake buy (no buy_hat call): nothing here reaches the server.
// Route: /stall-preview?state=<open|closing|boarded|none> (dev only).
// (2026-10-29)
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Hand, PageHeader } from "@/components/ui";
import { ItemPreviewModal } from "@/components/ItemPreviewModal";
import { StallCard } from "@/components/shop/StallCard";
import { StallPage } from "@/components/shop/StallPage";
import { SnoutsPocket } from "@/components/shop/SnoutsPocket";
import { gridTileWidth } from "@/components/shop/ShopCard";
import { PAGE_PAD, SPACE, WHIMSY } from "@/constants/theme";
import {
	drawableShelfItems,
	stallBuyCopy,
	type SeasonalShelf,
	type ShelfItem,
} from "@/utils/seasonalShelf";
import { closedLabel, DAY_MS, HOUR_MS, leavingLabel, shelfPhase } from "@/utils/shelfCountdown";

type State = "open" | "closing" | "boarded" | "none";
const STATES: State[] = ["open", "closing", "boarded", "none"];

const item = (
	id: string,
	name: string,
	cost: number,
	category: string,
	rarity: ShelfItem["rarity"],
	lane: ShelfItem["shelf_lane"],
	owned = false,
): ShelfItem => ({
	id,
	name,
	cost,
	category,
	rarity,
	display_order: 0,
	emoji: null,
	image_path: null,
	description: "A fixture piece for the stall preview.",
	shelf_lane: lane,
	owned,
});

const ITEMS: ShelfItem[] = [
	item("moonbrew_witch_hat", "Moonbrew Witch Hat", 1600, "hat", "epic", "new"),
	item("silly_sheet_ghost_hood", "Silly Sheet Ghost Hood", 3500, "hat", "legendary", "new"),
	item("pumpkin_treat_pail", "Pumpkin Treat Pail", 320, "held", "uncommon", "new", true),
	item("moonpuff_wolf_ears", "Moonpuff Wolf Ears", 600, "hat", "rare", "new"),
	item("stitched_bow", "Stitched Bow", 400, "bow", "rare", "new"),
	item("lantern_porch_bg", "Lantern Porch", 3000, "background", "legendary", "new"),
	item("skull_mask", "Skull Mask", 450, "mask", "rare", "returning", true),
	item("pumpkin_patch", "Pumpkin Patch", 900, "background", "epic", "returning"),
	item("firefly_lantern", "Firefly Lantern", 500, "held", "rare", "returning"),
	item("candyland", "Candy Land", 900, "background", "epic", "returning"),
];

function shelfFor(state: State, now: number): SeasonalShelf | null {
	if (state === "none") return null;
	const closes =
		state === "open" ? now + 6 * DAY_MS : state === "closing" ? now + 5 * HOUR_MS : now - DAY_MS;
	return {
		key: "halloween_2026",
		title: "Spooky Snouts",
		kicker: "moonlit mischief",
		opensAt: new Date(now - 4 * DAY_MS).toISOString(),
		closesAt: new Date(closes).toISOString(),
		status: state === "boarded" ? "boarded" : "open",
		backdropHatId: "lantern_porch_bg",
		theme: { back_line: "back next October", hero_item_id: "moonbrew_witch_hat" },
		serverNow: new Date(now).toISOString(),
		items: ITEMS,
	};
}

export default function StallPreview() {
	const params = useLocalSearchParams<{ state?: string }>();
	const initial = (STATES as string[]).includes(params.state ?? "") ? (params.state as State) : "open";
	const [state, setState] = useState<State>(initial);
	const [view, setView] = useState<"card" | "page">("card");
	const [now] = useState(() => Date.now());
	const [counter, setCounter] = useState(1840);
	const [owned, setOwned] = useState<Set<string>>(
		() => new Set(ITEMS.filter((i) => i.owned).map((i) => i.id)),
	);
	const [worn, setWorn] = useState<string | null>("skull_mask");
	const [preview, setPreview] = useState<ShelfItem | null>(null);
	const { width } = useWindowDimensions();
	const shelf = useMemo(() => shelfFor(state, now), [state, now]);
	const items = useMemo(() => (shelf ? drawableShelfItems(shelf.items) : []), [shelf]);
	const phase = shelf ? shelfPhase(shelf, now) : null;
	const visible = phase === "open" || phase === "boarded" ? phase : null;
	const isEquipped = (id: string) => worn === id;
	const tap = (i: ShelfItem) => {
		if (owned.has(i.id)) setWorn(worn === i.id ? null : i.id);
		else setPreview(i);
	};

	return (
		<View style={styles.page}>
			<PageHeader
				kicker={
					shelf && visible
						? visible === "open"
							? (leavingLabel(shelf.closesAt, now) ?? "")
							: closedLabel(shelf.closesAt, shelf.theme.back_line)
						: "dev preview"
				}
				title={view === "card" ? "Stall card" : (shelf?.title ?? "No stall")}
				backLabel="Back"
				onBack={() => (view === "page" ? setView("card") : router.back())}
				right={<SnoutsPocket balance={counter} />}
			/>
			<View style={styles.controls}>
				{STATES.map((s) => (
					<Button
						key={s}
						size="xs"
						variant={s === state ? "primary" : "ghost"}
						onPress={() => setState(s)}
						accessibilityLabel={`Show the ${s} stall`}
					>
						{s}
					</Button>
				))}
			</View>
			{view === "card" ? (
				<ScrollView contentContainerStyle={styles.cardWrap}>
					{shelf && visible ? (
						<StallCard
							shelf={shelf}
							items={items}
							phase={visible}
							now={now}
							ownedCount={items.filter((i) => owned.has(i.id)).length}
							onPress={() => setView("page")}
						/>
					) : (
						<Hand tone="secondary">No stall open: the shop renders no card.</Hand>
					)}
				</ScrollView>
			) : shelf && visible ? (
				<StallPage
					shelf={shelf}
					items={items}
					phase={visible}
					owned={owned}
					isEquipped={isEquipped}
					counter={counter}
					isVip={false}
					tileWidth={gridTileWidth(width, PAGE_PAD)}
					onPressItem={tap}
					onLongPressItem={setPreview}
				/>
			) : null}
			<ItemPreviewModal
				item={preview}
				owned={preview ? owned.has(preview.id) : false}
				active={preview ? isEquipped(preview.id) : false}
				canAfford={preview ? counter >= preview.cost : false}
				balance={counter}
				buyable={visible === "open"}
				troughable={false}
				windowTag={shelf && visible === "open" ? leavingLabel(shelf.closesAt, now) : null}
				buyConfirm={preview && shelf ? stallBuyCopy(preview, counter, shelf.closesAt, now) : null}
				onClose={() => setPreview(null)}
				onBuy={() => {
					if (!preview) return;
					setCounter((c) => c - preview.cost);
					setOwned((prev) => new Set(prev).add(preview.id));
				}}
				onEquip={() => {
					if (preview) setWorn(preview.id);
					setPreview(null);
				}}
				onUnequip={() => {
					setWorn(null);
					setPreview(null);
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: WHIMSY.cream, paddingTop: SPACE.xxl },
	controls: { flexDirection: "row", gap: SPACE.sm, paddingHorizontal: PAGE_PAD, paddingBottom: SPACE.md },
	cardWrap: { padding: PAGE_PAD, backgroundColor: WHIMSY.cream2 },
});
