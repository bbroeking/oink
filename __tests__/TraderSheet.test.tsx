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
import { toTraderStatus, type TraderSaleOutcome, type TraderStatus } from "@/utils/trader";
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
		// Fan it open from the "+".
		await act(async () => r.root.findByProps({ accessibilityLabel: "More" }).props.onPress());
		expect(r.root.findByProps({ accessibilityLabel: "Trader" })).toBeTruthy();
		expect(textOf(r.root)).toContain("the Ghost Sheep · 5h 59m left");

		await act(async () => {
			r.update(<BarnButton options={[barn]} armedKey="barn" onArm={jest.fn()} />);
		});
		expect(r.root.findAllByProps({ accessibilityLabel: "Trader" })).toHaveLength(0);
	});
});
