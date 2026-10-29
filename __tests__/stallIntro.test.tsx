// The Pop-up Stall's onboarding (Halloween onboarding canvas, 2026-10-29):
// direction A's one-time 3-card intro and B1's "new here?" tag. Pins the
// trigger (open + unseen shows once; seen, boarded or no stall never; a
// preview shelf shows), the cards' words from the payload, Step in landing on
// the stall, and the tag coming down after the first stall visit.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
	router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock("expo-router/react-navigation", () => ({
	useFocusEffect: (effect: () => void | (() => void)) =>
		require("react").useEffect(effect, [effect]),
}));
jest.mock("@/components/ui/PigStage", () => ({
	PigStage: () => null,
	resolveSlot: () => null,
}));

import { PopupQueueProvider, POPUP_HANDOFF_GAP_MS } from "@/components/ui/PopupQueue";
import { StallIntroModal } from "@/components/StallIntroModal";
import { StallCard } from "@/components/shop/StallCard";
import {
	markStallVisited,
	useStallIntro,
	useStallVisited,
} from "@/hooks/useStallOnboarding";
import { parseSeasonalShelf, type SeasonalShelf, type ShelfItem } from "@/utils/seasonalShelf";
import { DAY_MS, shelfPhase, type ShelfPhase } from "@/utils/shelfCountdown";
import {
	showNewHereTag,
	shouldShowStallIntro,
	stallIntroCards,
	stallIntroSeenKey,
	stallVisitedKey,
} from "@/utils/stallIntro";

const UID = "user-1";
// Oct 31 2026, inside the Halloween weekend shelf (Oct 30 to Nov 2 UTC).
const NOW = Date.UTC(2026, 9, 31, 15, 0, 0);

const piece = (id: string, name: string, over: Partial<ShelfItem> = {}): ShelfItem => ({
	id,
	name,
	cost: 600,
	display_order: 0,
	emoji: null,
	image_path: null,
	category: "hat",
	rarity: "rare",
	description: null,
	shelf_lane: "new",
	owned: false,
	...over,
});

const HATS = [
	piece("moonbrew_witch_hat", "Moonbrew Witch Hat"),
	piece("moonpuff_wolf_ears", "Moonpuff Wolf Ears"),
	piece("skull_mask", "Skull Mask", { category: "mask", shelf_lane: "returning" }),
];
const COSTUMES = [
	piece("halloween_2026_count_snout_costume", "Count Snout", { category: "costume" }),
	piece("halloween_2026_moonpuff_costume", "Moonpuff", { category: "costume" }),
];

function shelfOf(items: ShelfItem[], over: Partial<SeasonalShelf> = {}): SeasonalShelf {
	return {
		key: "halloween_2026",
		title: "Spooky Snouts",
		kicker: "moonlit mischief",
		opensAt: new Date(NOW - 2 * DAY_MS).toISOString(),
		closesAt: new Date(NOW + 6 * DAY_MS).toISOString(),
		status: "open",
		backdropHatId: "moonlit_graveyard_bg",
		theme: {},
		serverNow: new Date(NOW).toISOString(),
		items,
		...over,
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

const textOf = (r: TestRenderer.ReactTestRenderer) =>
	r.root
		.findAll((n) => (n.type as unknown) === "Text")
		.map((n) =>
			(Array.isArray(n.props.children) ? n.props.children : [n.props.children])
				.filter((c: unknown) => typeof c === "string")
				.join(""),
		)
		.join(" | ");

beforeEach(async () => {
	mockPush.mockClear();
	await AsyncStorage.clear();
});

// ── Trigger rule ────────────────────────────────────────────────────────────
describe("shouldShowStallIntro", () => {
	const shelf = shelfOf([...HATS, ...COSTUMES]);
	test("an open stall and an unset seen-key shows", () => {
		expect(shouldShowStallIntro({ shelf, phase: "open", userId: UID, seen: false })).toBe(true);
	});
	test("seen, boarded, no stall, signed out or a pending read never shows", () => {
		expect(shouldShowStallIntro({ shelf, phase: "open", userId: UID, seen: true })).toBe(false);
		expect(shouldShowStallIntro({ shelf, phase: "boarded", userId: UID, seen: false })).toBe(false);
		expect(shouldShowStallIntro({ shelf: null, phase: null, userId: UID, seen: false })).toBe(false);
		expect(shouldShowStallIntro({ shelf, phase: "open", userId: null, seen: false })).toBe(false);
		expect(shouldShowStallIntro({ shelf, phase: "open", userId: UID, seen: null })).toBe(false);
	});
	test("a preview shelf (seasonal_shelf() preview: true) reads as open and shows", () => {
		const now = Date.now();
		const parsed = parseSeasonalShelf({
			key: "halloween_2026",
			title: "Spooky Snouts",
			status: "open",
			preview: true,
			opens_at: new Date(now - DAY_MS).toISOString(),
			closes_at: new Date(now + 14 * DAY_MS).toISOString(),
			now: new Date(now).toISOString(),
			items: [],
		});
		expect(parsed).not.toBeNull();
		const phase = shelfPhase(parsed!, now);
		expect(phase).toBe("open");
		expect(shouldShowStallIntro({ shelf: parsed, phase, userId: UID, seen: false })).toBe(true);
	});
	test("keys are per set and per account", () => {
		expect(stallIntroSeenKey("halloween_2026", UID)).toBe("stall_intro_seen:halloween_2026:user-1");
		expect(stallVisitedKey("winter_2026", UID)).toBe("stall_visited:winter_2026:user-1");
	});
});

// ── The slot, end to end through the real PopupQueue ────────────────────────
type IntroApi = ReturnType<typeof useStallIntro>;

function IntroProbe({
	shelf,
	phase,
	onCommit,
}: {
	shelf: SeasonalShelf | null;
	phase: ShelfPhase | null;
	onCommit: (v: IntroApi) => void;
}) {
	const v = useStallIntro({ shelf, phase, userId: UID, focused: true });
	React.useLayoutEffect(() => {
		onCommit(v);
	});
	return null;
}

async function mountIntro(shelf: SeasonalShelf | null, phase: ShelfPhase | null) {
	let latest!: IntroApi;
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(
			<PopupQueueProvider>
				<IntroProbe shelf={shelf} phase={phase} onCommit={(v) => (latest = v)} />
			</PopupQueueProvider>,
		);
	});
	await act(async () => {});
	return {
		get api() {
			return latest;
		},
		unmount: () => act(() => r.unmount()),
	};
}

describe("useStallIntro", () => {
	const shelf = shelfOf([...HATS, ...COSTUMES]);
	const seenKey = stallIntroSeenKey(shelf.key, UID);

	test("open + unseen presents once, writes the seen-key on present, never again", async () => {
		jest.useFakeTimers();
		try {
			const first = await mountIntro(shelf, "open");
			expect(first.api.visible).toBe(true);
			await act(async () => {});
			expect(await AsyncStorage.getItem(seenKey)).not.toBeNull();
			await act(async () => first.api.finish("skip"));
			expect(first.api.visible).toBe(false);
			await act(async () => {
				jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS + 50);
			});
			expect(first.api.visible).toBe(false);
			expect(mockPush).not.toHaveBeenCalled();
			first.unmount();

			const again = await mountIntro(shelf, "open");
			expect(again.api.visible).toBe(false);
			again.unmount();
		} finally {
			jest.useRealTimers();
		}
	});

	test("a seen set never shows; a new set key gets its own intro", async () => {
		await AsyncStorage.setItem(seenKey, "1");
		const seen = await mountIntro(shelf, "open");
		expect(seen.api.visible).toBe(false);
		seen.unmount();

		const winter = await mountIntro(shelfOf(HATS, { key: "winter_2026", title: "Frosty Snouts" }), "open");
		expect(winter.api.visible).toBe(true);
		winter.unmount();
	});

	test("a boarded stall or no stall never shows", async () => {
		const boarded = await mountIntro(shelf, "boarded");
		expect(boarded.api.visible).toBe(false);
		boarded.unmount();
		const none = await mountIntro(null, null);
		expect(none.api.visible).toBe(false);
		none.unmount();
	});

	test("Step in lands on the stall's own route once the sheet has dismissed", async () => {
		jest.useFakeTimers();
		try {
			const m = await mountIntro(shelf, "open");
			expect(m.api.visible).toBe(true);
			await act(async () => m.api.finish("step_in"));
			expect(m.api.visible).toBe(false);
			expect(mockPush).not.toHaveBeenCalled();
			await act(async () => {
				jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS);
			});
			expect(mockPush).toHaveBeenCalledWith({
				pathname: "/stall/[key]",
				params: { key: "halloween_2026" },
			});
			expect(m.api.visible).toBe(false);
			m.unmount();
		} finally {
			jest.useRealTimers();
		}
	});
});

// ── The cards' words ────────────────────────────────────────────────────────
describe("stallIntroCards", () => {
	test("three cards from the payload: counts, title, the costume, three doors", () => {
		const cards = stallIntroCards(shelfOf([...HATS, ...COSTUMES]), [...HATS, ...COSTUMES], NOW);
		expect(cards.map((c) => c.id)).toEqual(["stall", "costumes", "where"]);
		const [stall, costumes, where] = cards;
		expect(stall.kicker).toBe("new in the shop · 1 of 3");
		expect(stall.id === "stall" && stall.body).toBe(
			"Spooky Snouts is pitched at the top of the Shop wall: three pieces and two full costumes, here for a short while.",
		);
		expect(costumes.id === "costumes" && costumes.costume.id).toBe("halloween_2026_moonpuff_costume");
		expect(costumes.id === "costumes" && costumes.caption).toBe("Rosie, then Rosie in Moonpuff");
		expect(costumes.id === "costumes" && costumes.hand).toContain('Friends see "in Moonpuff"');
		expect(where.kicker).toBe("three doors · 3 of 3");
		expect(where.id === "where" && where.doors.map((d) => d.id)).toEqual([
			"shop",
			"closet",
			"dailyDrop",
		]);
		expect(where.id === "where" && where.doors[2].line).toBe(
			"A Halloween shelf, Oct 30 to Nov 2. Then it rides off.",
		);
	});

	test("the daily-drop door shows only while the weekend shelf is current", () => {
		const items = [...HATS, ...COSTUMES];
		const doors = (now: number) => {
			const where = stallIntroCards(shelfOf(items), items, now).at(-1)!;
			return where.id === "where" ? where.doors.map((d) => d.id) : [];
		};
		expect(doors(Date.UTC(2026, 9, 29, 20))).toEqual(["shop", "closet"]);
		expect(doors(Date.UTC(2026, 9, 30, 0))).toContain("dailyDrop");
		expect(doors(Date.UTC(2026, 10, 2, 23, 59))).toContain("dailyDrop");
		expect(doors(Date.UTC(2026, 10, 3, 0))).toEqual(["shop", "closet"]);
	});

	test("no costumes: no costume card, no Closet door, the counts say two cards", () => {
		const cards = stallIntroCards(shelfOf(HATS, { key: "winter_2026", title: "Frosty Snouts" }), HATS, NOW);
		expect(cards.map((c) => c.id)).toEqual(["stall", "where"]);
		expect(cards[0].kicker).toBe("new in the shop · 1 of 2");
		expect(cards[0].id === "stall" && cards[0].body).toBe(
			"Frosty Snouts is pitched at the top of the Shop wall: three pieces, here for a short while.",
		);
		const where = cards[1];
		expect(where.kicker).toBe("one door · 2 of 2");
		expect(where.id === "where" && where.doors.map((d) => d.id)).toEqual(["shop"]);
	});

	test("the shelf theme overrides the compiled fallbacks", () => {
		const items = [...HATS, ...COSTUMES];
		const shelf = shelfOf(items, {
			theme: {
				intro_costume_id: "halloween_2026_count_snout_costume",
				weekend_shelf: {
					starts_at: "2026-10-31T00:00:00Z",
					ends_at: "2026-11-01T00:00:00Z",
					line: "One night only.",
				},
			} as SeasonalShelf["theme"],
		});
		const cards = stallIntroCards(shelf, items, NOW);
		expect(cards[1].id === "costumes" && cards[1].costume.name).toBe("Count Snout");
		const where = cards[2];
		expect(where.id === "where" && where.doors.at(-1)?.line).toBe("One night only.");
	});
});

// ── The sheet ───────────────────────────────────────────────────────────────
describe("StallIntroModal", () => {
	test("pages stall → costumes → where, and the last card's CTA is Step in", async () => {
		const onDone = jest.fn();
		const items = [...HATS, ...COSTUMES];
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(
				wrap(
					<StallIntroModal visible shelf={shelfOf(items)} items={items} now={NOW} onDone={onDone} />,
				),
			);
		});
		expect(r.root.findAllByProps({ testID: "stall-intro-card-stall" }).length).toBeGreaterThan(0);
		expect(textOf(r)).toContain("A stall popped up");
		expect(textOf(r)).toContain("leaving in 6 days");
		await act(async () => r.root.findAllByProps({ testID: "stall-intro-next" })[0].props.onPress());
		expect(textOf(r)).toContain("Full costumes");
		await act(async () => r.root.findAllByProps({ testID: "stall-intro-next" })[0].props.onPress());
		expect(textOf(r)).toContain("Where to look");
		expect(r.root.findAllByProps({ testID: "stall-intro-door-dailyDrop" }).length).toBeGreaterThan(0);
		await act(async () => r.root.findAllByProps({ testID: "stall-intro-step-in" })[0].props.onPress());
		expect(onDone).toHaveBeenCalledWith("step_in");
		act(() => r.unmount());
	});

	test("Skip ends it from the first card", async () => {
		const onDone = jest.fn();
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(
				wrap(<StallIntroModal visible shelf={shelfOf(HATS)} items={HATS} now={NOW} onDone={onDone} />),
			);
		});
		await act(async () => r.root.findAllByProps({ testID: "stall-intro-skip" })[0].props.onPress());
		expect(onDone).toHaveBeenCalledWith("skip");
		act(() => r.unmount());
	});
});

// ── The "new here?" tag ─────────────────────────────────────────────────────
function VisitedProbe({ onCommit }: { onCommit: (v: boolean | null) => void }) {
	const v = useStallVisited("halloween_2026", UID);
	React.useLayoutEffect(() => {
		onCommit(v);
	});
	return null;
}

describe("the new-here tag", () => {
	const items = [...HATS, ...COSTUMES];
	const card = (phase: "open" | "boarded", newHere: boolean) =>
		TestRenderer.create(
			<StallCard
				shelf={shelfOf(items)}
				items={items}
				phase={phase}
				now={NOW}
				ownedCount={0}
				newHere={newHere}
				onPress={() => {}}
			/>,
		);

	test("stands on an open card until the first stall visit", async () => {
		let visited: boolean | null = null;
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(<VisitedProbe onCommit={(v) => (visited = v)} />);
		});
		expect(visited).toBe(false);
		expect(showNewHereTag("open", visited)).toBe(true);
		const shown = card("open", showNewHereTag("open", visited));
		expect(shown.root.findAllByProps({ testID: "stall-card-new-here" }).length).toBeGreaterThan(0);
		expect(textOf(shown)).toContain("new here? ★");
		act(() => r.unmount());

		await markStallVisited("halloween_2026", UID);
		await act(async () => {
			r = TestRenderer.create(<VisitedProbe onCommit={(v) => (visited = v)} />);
		});
		expect(visited).toBe(true);
		expect(showNewHereTag("open", visited)).toBe(false);
		const gone = card("open", showNewHereTag("open", visited));
		expect(gone.root.findAllByProps({ testID: "stall-card-new-here" })).toHaveLength(0);
		act(() => r.unmount());
	});

	test("never on a boarded card or while the read is out", () => {
		expect(showNewHereTag("boarded", false)).toBe(false);
		expect(showNewHereTag("open", null)).toBe(false);
		const boarded = card("boarded", true);
		expect(boarded.root.findAllByProps({ testID: "stall-card-new-here" })).toHaveLength(0);
	});
});
