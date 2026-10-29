// The Pop-up Stall's screens (canvas row B, 2026-10-29): the card on the wall
// in each phase, the stall page's New · Back · Yours tabs and its boarded
// haul, and the buy confirm on the try-on sheet.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("@/components/ui/PigStage", () => ({
	PigStage: () => null,
	resolveSlot: () => null,
}));
jest.mock("@/components/ui/PopupQueue", () => ({
	useUnmanagedModalHold: jest.fn(),
}));
jest.mock("@/components/PurchaseToast", () => ({ showPurchaseToast: jest.fn() }));

import { StallCardSlot } from "@/components/shop/StallCard";
import { StallPage } from "@/components/shop/StallPage";
import { ItemPreviewModal } from "@/components/ItemPreviewModal";
import { SegmentedControl } from "@/components/ui";
import type { SeasonalShelf, ShelfItem } from "@/utils/seasonalShelf";
import { stallBuyCopy } from "@/utils/seasonalShelf";
import { DAY_MS, HOUR_MS, shelfPhase } from "@/utils/shelfCountdown";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

const piece = (
	id: string,
	name: string,
	lane: ShelfItem["shelf_lane"],
	over: Partial<ShelfItem> = {},
): ShelfItem => ({
	id,
	name,
	cost: 600,
	display_order: 0,
	emoji: null,
	image_path: null,
	category: "hat",
	rarity: "rare",
	description: null,
	shelf_lane: lane,
	owned: false,
	...over,
});

const ITEMS: ShelfItem[] = [
	piece("moonbrew_witch_hat", "Moonbrew Witch Hat", "new", { cost: 1200, rarity: "epic" }),
	piece("moonpuff_wolf_ears", "Moonpuff Wolf Ears", "new"),
	piece("pumpkin_treat_pail", "Pumpkin Treat Pail", "new", { category: "held", owned: true }),
	piece("skull_mask", "Skull Mask", "returning", { category: "mask" }),
];

function shelfClosing(closesIn: number): SeasonalShelf {
	return {
		key: "halloween_2026",
		title: "Spooky Snouts",
		kicker: null,
		opensAt: new Date(NOW - 5 * DAY_MS).toISOString(),
		closesAt: new Date(NOW + closesIn).toISOString(),
		status: closesIn > 0 ? "open" : "boarded",
		backdropHatId: "lantern_porch_bg",
		theme: { back_line: "back next October" },
		serverNow: new Date(NOW).toISOString(),
		items: ITEMS,
	};
}

const wrap = (node: React.ReactElement) => (
	<SafeAreaProvider
		initialMetrics={{
			frame: { x: 0, y: 0, width: 390, height: 844 },
			insets: { top: 47, left: 0, right: 0, bottom: 34 },
		}}
	>
		{node}
	</SafeAreaProvider>
);

const text = (r: TestRenderer.ReactTestRenderer) =>
	r.root
		.findAllByType(Text)
		.map((n) => n.props.children)
		.flat(Infinity)
		.filter((c) => typeof c === "string" || typeof c === "number")
		.join(" ")
		.replace(/\s+/g, " ");

function renderCard(shelf: SeasonalShelf | null, ownedCount = 0) {
	const onPress = jest.fn();
	const phase = shelf ? shelfPhase(shelf, NOW) : null;
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(
			wrap(
				<StallCardSlot
					shelf={shelf}
					phase={phase}
					items={ITEMS}
					now={NOW}
					ownedCount={ownedCount}
					onPress={onPress}
				/>,
			),
		);
	});
	return { r, onPress };
}

describe("StallCard", () => {
	it("open: the stall's name, its pieces, the countdown and the way in", () => {
		const { r, onPress } = renderCard(shelfClosing(6 * DAY_MS));
		const t = text(r);
		expect(t).toContain("Spooky Snouts");
		expect(t).toContain("seasonal stall · four pieces");
		expect(t).toContain("leaving in 6 days");
		expect(t).toContain("Step in ›");
		const card = r.root.findByProps({ testID: "stall-card-open" });
		expect(card.props.accessibilityLabel).toBe(
			"Spooky Snouts stall, four pieces, leaving in 6 days",
		);
		act(() => card.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("closing: the last day counts in hours", () => {
		const { r } = renderCard(shelfClosing(5 * HOUR_MS));
		expect(text(r)).toContain("leaving in 5h");
	});

	it("boarded: the packed-up sign, the promise and the haul", () => {
		const { r } = renderCard(shelfClosing(-DAY_MS), 2);
		const t = text(r);
		expect(t).toContain("packed up");
		expect(t).toContain("back next October");
		expect(t).toContain("Your haul ›");
		expect(t).not.toContain("leaving in");
		expect(r.root.findByProps({ testID: "stall-card-boarded" }).props.accessibilityLabel).toBe(
			"Spooky Snouts stall, packed up. two in your haul",
		);
	});

	it("none: no shelf, a dark one, or past its boarded days renders nothing", () => {
		const cards = (r: TestRenderer.ReactTestRenderer) =>
			r.root.findAll(
				(n) => typeof n.props.testID === "string" && n.props.testID.startsWith("stall-card"),
			).length;
		expect(cards(renderCard(null).r)).toBe(0);
		expect(cards(renderCard(shelfClosing(-4 * DAY_MS)).r)).toBe(0);
		const dark = { ...shelfClosing(6 * DAY_MS), opensAt: null };
		expect(cards(renderCard(dark).r)).toBe(0);
		// The control: an open shelf does mount it.
		expect(cards(renderCard(shelfClosing(DAY_MS)).r)).toBeGreaterThan(0);
	});
});

function renderPage(
	phase: "open" | "boarded",
	owned = new Set<string>(["pumpkin_treat_pail"]),
	items: ShelfItem[] = ITEMS,
) {
	const onPressItem = jest.fn();
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(
			wrap(
				<StallPage
					shelf={shelfClosing(phase === "open" ? 6 * DAY_MS : -DAY_MS)}
					items={items}
					phase={phase}
					owned={owned}
					isEquipped={(id) => id === "pumpkin_treat_pail"}
					counter={1840}
					isVip={false}
					tileWidth={170}
					onPressItem={onPressItem}
					onLongPressItem={jest.fn()}
				/>,
			),
		);
	});
	return { r, onPressItem };
}

describe("StallPage", () => {
	it("opens on New with the three lanes counted", () => {
		const { r } = renderPage("open");
		const seg = r.root.findByType(SegmentedControl);
		expect(seg.props.options.map((o: { label: string }) => o.label)).toEqual([
			"New · 3",
			"Back · 1",
			"Yours · 1",
		]);
		const t = text(r);
		expect(t).toContain("Moonbrew Witch Hat");
		expect(t).toContain("Pumpkin Treat Pail");
		expect(t).not.toContain("Skull Mask");
		expect(t).toContain("tap a piece to see it on her");
	});

	it("Back shows the returning pieces, Yours what you own", () => {
		const { r } = renderPage("open");
		act(() => r.root.findByType(SegmentedControl).props.onChange("back"));
		let t = text(r);
		expect(t).toContain("Skull Mask");
		expect(t).not.toContain("Moonbrew Witch Hat");
		act(() => r.root.findByType(SegmentedControl).props.onChange("yours"));
		t = text(r);
		expect(t).toContain("Pumpkin Treat Pail");
		expect(t).toContain("Wearing");
		expect(t).not.toContain("Skull Mask");
	});

	it("an empty Yours says what the stall keeps", () => {
		const { r } = renderPage(
			"open",
			new Set(),
			ITEMS.map((i) => ({ ...i, owned: false })),
		);
		act(() => r.root.findByType(SegmentedControl).props.onChange("yours"));
		expect(text(r)).toContain("Nothing from the stall yet");
	});

	it("tapping a card hands the piece to the page", () => {
		const { r, onPressItem } = renderPage("open");
		const card = r.root.findAll(
			(n) =>
				typeof n.props.accessibilityLabel === "string" &&
				n.props.accessibilityLabel.startsWith("Moonbrew Witch Hat") &&
				typeof n.props.onPress === "function",
		)[0];
		act(() => card.props.onPress());
		expect(onPressItem).toHaveBeenCalledWith(expect.objectContaining({ id: "moonbrew_witch_hat" }));
	});

	it("boarded: the packed-up state and the haul, no tabs", () => {
		const { r } = renderPage("boarded");
		const t = text(r);
		expect(t).toContain("The stall has packed up");
		expect(t).toContain("One piece came home with you. The rest ride the cart till next October.");
		expect(t).toContain("Your haul");
		expect(t).toContain("1 of 4");
		expect(t).toContain("Pumpkin Treat Pail");
		expect(t).not.toContain("Moonbrew Witch Hat");
		expect(r.root.findAllByType(SegmentedControl)).toHaveLength(0);
	});
});

describe("the stall's buy confirm", () => {
	const item = ITEMS[0];
	function renderSheet(onBuy: jest.Mock, withConfirm: boolean) {
		let r!: TestRenderer.ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(
				wrap(
					<ItemPreviewModal
						item={item}
						owned={false}
						active={false}
						canAfford
						balance={1840}
						buyable
						troughable={false}
						windowTag="leaving in 6 days"
						buyConfirm={
							withConfirm
								? stallBuyCopy(item, 1840, new Date(NOW + 6 * DAY_MS).toISOString(), NOW)
								: null
						}
						onClose={jest.fn()}
						onBuy={onBuy}
						onEquip={jest.fn()}
						onUnequip={jest.fn()}
					/>,
				),
			);
		});
		return r;
	}
	const buyNow = (r: TestRenderer.ReactTestRenderer) =>
		r.root.findAll(
			(n) =>
				n.props.accessibilityLabel === "Buy Moonbrew Witch Hat for 1,200 snouts" &&
				typeof n.props.onPress === "function",
		)[0];

	it("the sheet wears the lilac window tag", () => {
		const r = renderSheet(jest.fn(), true);
		expect(text(r)).toContain("leaving in 6 days");
	});

	it("Buy now asks first, naming price and window; only the confirm buys", () => {
		const onBuy = jest.fn();
		const r = renderSheet(onBuy, true);
		act(() => buyNow(r).props.onPress());
		expect(onBuy).not.toHaveBeenCalled();
		const t = text(r);
		expect(t).toContain("1,200 snouts · leaves in 6 days");
		expect(t).toContain("Buy the Moonbrew Witch Hat?");
		expect(t).toContain("You will have 640 snouts left.");
		const confirm = r.root.findAll(
			(n) => n.props.accessibilityLabel === "Buy · 1,200" && typeof n.props.onPress === "function",
		)[0];
		act(() => confirm.props.onPress());
		expect(onBuy).toHaveBeenCalledTimes(1);
		expect(text(r)).not.toContain("Buy the Moonbrew Witch Hat?");
	});

	it("Not now closes the confirm without buying", () => {
		const onBuy = jest.fn();
		const r = renderSheet(onBuy, true);
		act(() => buyNow(r).props.onPress());
		const cancel = r.root.findAll(
			(n) => n.props.accessibilityLabel === "Not now" && typeof n.props.onPress === "function",
		)[0];
		act(() => cancel.props.onPress());
		expect(onBuy).not.toHaveBeenCalled();
		expect(text(r)).not.toContain("Buy the Moonbrew Witch Hat?");
	});

	it("without a confirm (the rest of the store) Buy now still buys in one tap", () => {
		const onBuy = jest.fn();
		const r = renderSheet(onBuy, false);
		act(() => buyNow(r).props.onPress());
		expect(onBuy).toHaveBeenCalledTimes(1);
	});
});
