// The Ghost Sheep Trader's sheet (components/trader/TraderSheet) and his row
// on the Barn button's fan:
//   • the sheet opens on his greeting and the day's want; every bag tile wears
//     what it pays him now, the fancied one doubled
//   • the footer is dead until a tile is picked, then names the find + price;
//     a pick toggles
//   • hand over → onSell(itemId); a sale draws the before → after tally and
//     the bag the caller installs is what shows
//   • a refusal reaches onRefused in his voice and nothing is tallied
//   • had enough: the bag dims, no hand-over button, the "enough" line
//   • an empty bag is the EmptyState that points at the Dig
//   • the fan row renders his mark and stay line, and only when present
//   • sets and trade-ups (2026-10-29, canvas boards A2 to A4): one tile per
//     find with a ×N badge; taps build a hand (one, a pair, three alike); the
//     pair's strip and ticket say +9 and hand over two ids; three alike asks
//     first (the confirm) and can step back; the receipt keeps one tally across
//     the open sheet and a lilac card for what came back; rare stops at a pair;
//     a sheet without the trade-up mutation stops at a pair too
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
jest.mock("@/hooks/useMotionPolicy", () => ({
	MOTION_DURATION: { feedback: 120, state: 220, modal: 300, celebration: 450, crossfade: 150 },
	startDecorativeLoop: () => () => {},
	useMotionPolicy: () => ({
		reduceMotion: true,
		allowDecorativeMotion: false,
		largeTransition: "crossfade",
		duration: (_standard: number, reduced = 150) => reduced,
	}),
}));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(async () => {}),
	selectionAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
	NotificationFeedbackType: { Success: "success", Error: "error" },
}));

import { TraderSheet } from "@/components/trader/TraderSheet";
import { Sticker } from "@/components/ui/Sticker";
import { BarnButton, type BarnFanOption } from "@/components/BarnButton";
import { toTraderStatus, type TraderSaleOutcome, type TraderStatus, type TraderTradeUpOutcome } from "@/utils/trader";
import type { SatchelItem } from "@/utils/satchel";

const METRICS = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const NOW = "2026-05-01T12:31:00.000Z";

const VISIT = {
	id: 7,
	day: "2026-05-01",
	arrives_at: "2026-05-01T12:30:00.000Z",
	leaves_at: "2026-05-01T18:30:00.000Z",
	want_find_id: "blue_feather",
	sold: 0,
	tickles: 0,
	finds_left: 6,
};

function status(over: { visit?: Record<string, unknown> } & Record<string, unknown> = {}): TraderStatus {
	const { visit, ...rest } = over;
	return toTraderStatus({
		ok: true,
		present: true,
		now: NOW,
		prices: { common: 3, uncommon: 8, rare: 20 },
		want_multiplier: 2,
		finds_per_visit: 6,
		met: false,
		sales: 0,
		...rest,
		visit: { ...VISIT, ...(visit ?? {}) },
	});
}

const BAG: SatchelItem[] = [
	{ id: 1, find_id: "river_pebble", source: "dig" },
	{ id: 2, find_id: "blue_feather", source: "dig" },
	{ id: 3, find_id: "old_key", source: "swap" },
];

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	const walk = (node: TestRenderer.ReactTestInstance | string) => {
		if (typeof node === "string") {
			out.push(node);
			return;
		}
		for (const child of node.children ?? []) walk(child);
	};
	walk(tree);
	return out.join("");
}

function hostCount(root: TestRenderer.ReactTestInstance, testID: string): number {
	return root.findAll((n) => n.props.testID === testID && typeof n.type === "string").length;
}

function mount(
	props: Partial<React.ComponentProps<typeof TraderSheet>> = {},
) {
	const all: React.ComponentProps<typeof TraderSheet> = {
		open: true,
		onClose: jest.fn(),
		status: status(),
		readAt: Date.parse(NOW),
		items: BAG,
		onSell: jest.fn(async () => ({ ok: false, reason: "unknown", arrivesAt: null, bag: null }) as TraderSaleOutcome),
		onRefused: jest.fn(),
		...props,
	};
	return (
		<SafeAreaProvider initialMetrics={METRICS}>
			<TraderSheet {...all} />
		</SafeAreaProvider>
	);
}

describe("TraderSheet", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(Date.parse(NOW));
	});
	afterEach(() => jest.useRealTimers());

	it("opens on his greeting, the day's want, and a price on every tile (the fancied one doubled)", async () => {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount());
		});
		const text = textOf(r.root);
		expect(text).toContain("Today I fancy a blue feather");
		expect(text).toContain("takes 6 more finds · 5h 59m left");
		expect(text).toContain("pays double");
		const tiles = r.root.findAllByType(Sticker).filter((n) => n.props.testID === "trader-offer");
		expect(tiles).toHaveLength(3);
		expect(text).toContain("+3");
		expect(text).toContain("+6");
		expect(text).toContain("+8");
		expect(tiles[1].props.accessibilityLabel).toBe("blue feather, 6 tickles, the one he fancies");
		expect(hostCount(r.root, "trader-sprite")).toBeGreaterThan(0);
	});

	it("the footer wakes on a pick, names the find and price, and a second tap un-picks", async () => {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount());
		});
		const sell = () => r.root.findByProps({ testID: "trader-sell" });
		expect(sell().props.disabled).toBe(true);
		expect(textOf(r.root)).toContain("Pick a find to hand over");
		const pebble = r.root.findAllByType(Sticker).filter((n) => n.props.testID === "trader-offer")[0];
		await act(async () => pebble.props.onPress());
		expect(sell().props.disabled).toBe(false);
		expect(textOf(r.root)).toContain("Hand it over");
		expect(textOf(r.root)).toContain("+3");
		expect(sell().props.accessibilityLabel).toBe("Hand over the river pebble for 3 tickles");
		await act(async () => pebble.props.onPress());
		expect(sell().props.disabled).toBe(true);
	});

	it("hands the picked find over and draws the tally from the receipt", async () => {
		const onSell = jest.fn(
			async (): Promise<TraderSaleOutcome> => ({
				ok: true,
				replay: false,
				findId: "river_pebble",
				tickles: 3,
				wasWant: false,
				pair: false,
				pairBonus: 0,
				before: 100,
				after: 103,
				findsLeft: 5,
				visitTickles: 3,
				bag: BAG.slice(1),
			}),
		);
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount({ onSell }));
		});
		const pebble = r.root.findAllByType(Sticker).filter((n) => n.props.testID === "trader-offer")[0];
		await act(async () => pebble.props.onPress());
		await act(async () => r.root.findByProps({ testID: "trader-sell" }).props.onPress());
		expect(onSell).toHaveBeenCalledWith(1);
		// The caller installs the answered bag; the tile is gone and the tally shows.
		await act(async () => {
			r.update(mount({ onSell, items: BAG.slice(1), status: status({ visit: { sold: 1, finds_left: 5 } }) }));
		});
		expect(hostCount(r.root, "trader-tally")).toBeGreaterThan(0);
		const text = textOf(r.root);
		expect(text).toContain("100");
		expect(text).toContain("103");
		expect(text).toContain("the river pebble went into his satchel · +3");
		expect(text).toContain("takes 5 more finds");
		expect(r.root.findAllByType(Sticker).filter((n) => n.props.testID === "trader-offer")).toHaveLength(2);
		// Two offers leave one place in the three-up row: a dashed slot squares it off.
		const empties = r.root.findAllByType(Sticker).filter((n) => n.props.testID === "trader-offer-empty");
		expect(empties).toHaveLength(1);
		expect(empties[0].props.borderStyle).toBe("dashed");
	});

	it("a refusal reaches the caller in his voice and tallies nothing", async () => {
		const onRefused = jest.fn();
		const onSell = jest.fn(async (): Promise<TraderSaleOutcome> => ({ ok: false, reason: "had_enough", arrivesAt: null, bag: null }));
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount({ onSell, onRefused }));
		});
		const pebble = r.root.findAllByType(Sticker).filter((n) => n.props.testID === "trader-offer")[0];
		await act(async () => pebble.props.onPress());
		await act(async () => r.root.findByProps({ testID: "trader-sell" }).props.onPress());
		expect(onRefused).toHaveBeenCalledWith("He's taken all he'll take this visit.");
		expect(hostCount(r.root, "trader-tally")).toBe(0);
	});

	it("had enough: the bag dims, no hand-over, the enough line", async () => {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount({ status: status({ visit: { sold: 6, finds_left: 0 } }) }));
		});
		expect(r.root.findAllByProps({ testID: "trader-sell" })).toHaveLength(0);
		const text = textOf(r.root);
		expect(text).toContain("Enough for one visit, little pig.");
		expect(text).toContain("had enough for today");
		expect(text).toContain("what's left stays yours");
		const pebble = r.root.findAllByType(Sticker).filter((n) => n.props.testID === "trader-offer")[0];
		expect(pebble.props.disabled).toBe(true);
	});

	it("an empty bag points at the Dig", async () => {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount({ items: [] }));
		});
		const text = textOf(r.root);
		expect(text).toContain("Nothing to trade");
		expect(text).toContain("Every Dig can turn up a find.");
		expect(r.root.findAllByProps({ testID: "trader-sell" })).toHaveLength(0);
	});
});

describe("the fan row", () => {
	const barn: BarnFanOption = {
		key: "barn",
		title: "Barn",
		label: "barn",
		mark: "door",
		onPress: jest.fn(),
		accessibilityLabel: "Your Barn",
	};
	const trader: BarnFanOption = {
		key: "trader",
		title: "Trader",
		sub: "the Ghost Sheep · 5h 59m left",
		label: "trader",
		mark: "trader",
		onPress: jest.fn(),
		accessibilityLabel: "The Ghost Sheep Trader",
	};

	it("renders his row with his mark when the caller lists him, and not otherwise", async () => {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(<BarnButton options={[barn, trader]} armedKey="barn" onArm={jest.fn()} />);
		});
		// Fan it open from the "+" — its own button since 2026-10-04 ("More
		// actions"), and a row's spoken name carries the line it draws.
		await act(async () => r.root.findByProps({ accessibilityLabel: "More actions" }).props.onPress());
		const row = "Trader, the Ghost Sheep · 5h 59m left";
		expect(r.root.findByProps({ accessibilityLabel: row })).toBeTruthy();
		expect(textOf(r.root)).toContain("the Ghost Sheep · 5h 59m left");

		await act(async () => {
			r.update(<BarnButton options={[barn]} armedKey="barn" onArm={jest.fn()} />);
		});
		expect(r.root.findAllByProps({ accessibilityLabel: row })).toHaveLength(0);
	});
});

describe("TraderSheet, sets and trade-ups", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(Date.parse(NOW));
	});
	afterEach(() => jest.useRealTimers());

	const SETS = {
		finds_per_visit: 9,
		pair_multiplier: 1.5,
		trade_up: true,
		trade_up_count: 3,
	};
	const setsStatus = (visit: Record<string, unknown> = {}) =>
		status({
			...SETS,
			visit: { finds_left: 9, unpaired: [], trade_ups: { common: "marble", uncommon: "tin_whistle" }, ...visit },
		});
	const PEBBLES: SatchelItem[] = [
		{ id: 11, find_id: "river_pebble", source: "gift" },
		{ id: 12, find_id: "river_pebble", source: "dig" },
		{ id: 13, find_id: "river_pebble", source: "dig" },
		{ id: 14, find_id: "clover", source: "dig" },
		{ id: 15, find_id: "clover", source: "dig" },
		{ id: 16, find_id: "tin_whistle", source: "dig" },
		{ id: 17, find_id: "tin_whistle", source: "dig" },
		{ id: 18, find_id: "tin_whistle", source: "dig" },
	];
	const offers = (r: TestRenderer.ReactTestRenderer) =>
		r.root.findAllByType(Sticker).filter((n) => n.props.testID === "trader-offer");
	const sale = (findId: "river_pebble", tickles: number, pair: boolean, before: number): TraderSaleOutcome => ({
		ok: true,
		replay: false,
		findId,
		tickles,
		wasWant: false,
		pair,
		pairBonus: pair ? tickles / 2 : 0,
		before,
		after: before + tickles,
		findsLeft: 7,
		visitTickles: 9,
		bag: [],
	});

	it("one tile per find with a ×N badge, and his new line", async () => {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount({ status: setsStatus(), items: PEBBLES, onTradeUp: jest.fn() }));
		});
		expect(offers(r)).toHaveLength(3);
		const text = textOf(r.root);
		expect(text).toContain("×3");
		expect(text).toContain("×2");
		expect(text).toContain("Bring me a pair and I pay half again. Three alike and I will trade you up.");
		expect(text).toContain("tap finds to make a hand");
		expect(text).toContain("takes 9 more finds");
		expect(offers(r)[0].props.accessibilityLabel).toBe("river pebble, 3 tickles, 3 in the bag");
	});

	it("two taps make a pair: the strip, the hint, +9 on the ticket, and two ids handed over", async () => {
		const onSell = jest
			.fn<Promise<TraderSaleOutcome>, [number]>()
			.mockResolvedValueOnce(sale("river_pebble", 3, false, 100))
			.mockResolvedValueOnce(sale("river_pebble", 6, true, 103));
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount({ status: setsStatus(), items: PEBBLES, onSell, onTradeUp: jest.fn() }));
		});
		await act(async () => offers(r)[0].props.onPress());
		expect(hostCount(r.root, "trader-hand")).toBe(0);
		await act(async () => offers(r)[0].props.onPress());
		const text = textOf(r.root);
		expect(text).toContain("a pair of river pebbles");
		expect(text).toContain("3 + 3, then half again: 9 tickles");
		expect(text).toContain("a pair · +9");
		expect(text).toContain("tap one more river pebble and he will trade all three for a glass marble");
		const sell = r.root.findByProps({ testID: "trader-sell" });
		expect(sell.props.stub).toBe("+9");
		expect(sell.props.label).toBe("Hand over the pair");
		await act(async () => sell.props.onPress());
		// Dug ones first: the friend's gift (11) stays.
		expect(onSell.mock.calls.map((c) => c[0])).toEqual([12, 13]);
		const after = textOf(r.root);
		expect(after).toContain("a pair of river pebbles went into his satchel · +9");
		expect(after).toContain("100");
		expect(after).toContain("109");
		expect(after).toContain("after");
	});

	it("a pair the bag cannot finish says hold one more", async () => {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(
				mount({ status: setsStatus(), items: PEBBLES.filter((i) => i.id !== 11), onTradeUp: jest.fn() }),
			);
		});
		await act(async () => offers(r)[0].props.onPress());
		await act(async () => offers(r)[0].props.onPress());
		expect(textOf(r.root)).toContain("hold one more river pebble and he will trade all three for a glass marble");
		// A third tap clears the hand (two is all the bag holds).
		await act(async () => offers(r)[0].props.onPress());
		expect(r.root.findByProps({ testID: "trader-sell" }).props.disabled).toBe(true);
	});

	it("three alike asks first, can step back, then trades up and draws what came back", async () => {
		const onTradeUp = jest.fn(
			async (): Promise<TraderTradeUpOutcome> => ({
				ok: true,
				replay: false,
				gaveFindId: "river_pebble",
				count: 3,
				gotFindId: "marble",
				gotItemId: 42,
				newToBag: true,
				findsLeft: 6,
				visitTickles: 0,
				bag: [],
			}),
		);
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount({ status: setsStatus(), items: PEBBLES, onTradeUp }));
		});
		for (let i = 0; i < 3; i++) await act(async () => offers(r)[0].props.onPress());
		const ticket = r.root.findByProps({ testID: "trader-sell" });
		expect(ticket.props.stub).toBe("3→1");
		expect(ticket.props.label).toBe("Trade three river pebbles for a glass marble");
		expect(textOf(r.root)).toContain("three alike · up");
		await act(async () => ticket.props.onPress());
		// A3: the confirm, before anything moves.
		expect(hostCount(r.root, "trader-trade-up")).toBeGreaterThan(0);
		let text = textOf(r.root);
		expect(text).toContain("Three river pebbles, little pig? Then a glass marble is yours. My pick of which. No take-backs.");
		expect(text).toContain("Rare has no trade-up: nothing sits above it.");
		expect(text).toContain("uncommon");
		expect(onTradeUp).not.toHaveBeenCalled();
		// Keep them: back to the bag, the hand still held.
		await act(async () => r.root.findByProps({ testID: "trader-trade-up-back" }).props.onPress());
		expect(hostCount(r.root, "trader-trade-up")).toBe(0);
		await act(async () => r.root.findByProps({ testID: "trader-sell" }).props.onPress());
		await act(async () => r.root.findByProps({ testID: "trader-trade-up-confirm" }).props.onPress());
		expect(onTradeUp).toHaveBeenCalledWith("river_pebble");
		// A4: the lilac card.
		expect(hostCount(r.root, "trader-came-back")).toBeGreaterThan(0);
		text = textOf(r.root);
		expect(text).toContain("a glass marble");
		expect(text).toContain("came back for three river pebbles · new to your bag");
		expect(hostCount(r.root, "trader-trade-up")).toBe(0);
	});

	it("the receipt keeps one tally across the open sheet", async () => {
		const onSell = jest
			.fn<Promise<TraderSaleOutcome>, [number]>()
			.mockResolvedValueOnce(sale("river_pebble", 3, false, 41))
			.mockResolvedValueOnce(sale("river_pebble", 6, true, 44));
		const onTradeUp = jest.fn(
			async (): Promise<TraderTradeUpOutcome> => ({
				ok: true,
				replay: false,
				gaveFindId: "clover",
				count: 3,
				gotFindId: "old_key",
				gotItemId: 43,
				newToBag: false,
				findsLeft: 4,
				visitTickles: 9,
				bag: [],
			}),
		);
		const bag = [...PEBBLES, { id: 19, find_id: "clover" as const, source: "dig" as const }];
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(
				mount({ status: setsStatus({ trade_ups: { common: "old_key" } }), items: bag, onSell, onTradeUp }),
			);
		});
		await act(async () => offers(r)[0].props.onPress());
		await act(async () => offers(r)[0].props.onPress());
		await act(async () => r.root.findByProps({ testID: "trader-sell" }).props.onPress());
		// The clovers: three alike.
		for (let i = 0; i < 3; i++) await act(async () => offers(r)[1].props.onPress());
		await act(async () => r.root.findByProps({ testID: "trader-sell" }).props.onPress());
		await act(async () => r.root.findByProps({ testID: "trader-trade-up-confirm" }).props.onPress());
		const tally = r.root.findAll((n) => n.props.testID === "trader-tally" && typeof n.type !== "string")[0];
		expect(tally.props.accessibilityLabel).toBe(
			"41 before, 50 tickled now. a pair of river pebbles went into his satchel · +9",
		);
		const text = textOf(r.root);
		expect(text).toContain("an old key");
		expect(text).toContain("came back for three four-leaf clovers");
		expect(text).not.toContain("new to your bag");
	});

	it("a pair cut short by a refusal tallies the one that went", async () => {
		const onRefused = jest.fn();
		const onSell = jest
			.fn<Promise<TraderSaleOutcome>, [number]>()
			.mockResolvedValueOnce(sale("river_pebble", 3, false, 100))
			.mockResolvedValueOnce({ ok: false, reason: "had_enough", arrivesAt: null, bag: null });
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount({ status: setsStatus(), items: PEBBLES, onSell, onRefused, onTradeUp: jest.fn() }));
		});
		await act(async () => offers(r)[0].props.onPress());
		await act(async () => offers(r)[0].props.onPress());
		await act(async () => r.root.findByProps({ testID: "trader-sell" }).props.onPress());
		expect(onRefused).toHaveBeenCalledWith("He's taken all he'll take this visit.");
		expect(textOf(r.root)).toContain("the river pebble went into his satchel · +3");
	});

	it("a single that completes an earlier pair says so and pays it", async () => {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(
				mount({ status: setsStatus({ unpaired: ["river_pebble"] }), items: PEBBLES, onTradeUp: jest.fn() }),
			);
		});
		expect(textOf(r.root)).toContain("makes a pair");
		await act(async () => offers(r)[0].props.onPress());
		expect(r.root.findByProps({ testID: "trader-sell" }).props.stub).toBe("+6");
		expect(textOf(r.root)).toContain("pairs with the one he took earlier: +6");
	});

	it("rare stops at a pair, and so does a sheet without the trade-up", async () => {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(mount({ status: setsStatus(), items: PEBBLES, onTradeUp: jest.fn() }));
		});
		const whistle = () => offers(r)[2];
		await act(async () => whistle().props.onPress());
		await act(async () => whistle().props.onPress());
		expect(r.root.findByProps({ testID: "trader-sell" }).props.stub).toBe("+60");
		expect(hostCount(r.root, "trader-hint")).toBe(0);
		await act(async () => whistle().props.onPress());
		expect(r.root.findByProps({ testID: "trader-sell" }).props.disabled).toBe(true);

		await act(async () => {
			r.update(mount({ status: setsStatus(), items: PEBBLES }));
		});
		for (let i = 0; i < 3; i++) await act(async () => offers(r)[0].props.onPress());
		expect(r.root.findByProps({ testID: "trader-sell" }).props.disabled).toBe(true);
	});
});
