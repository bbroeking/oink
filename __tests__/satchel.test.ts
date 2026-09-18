// The Satchel's pure rules (utils/satchel) — the tuning sanitizer, the match,
// the row mark, the receipt line, the swap's copy and its nonce. Native-free:
// the rpc chain and the logger are lazily required only inside the paths these
// never touch (the one exception, `not_offered`, mocks the logger below).
jest.mock("@/utils/log", () => ({ log: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));
jest.mock("expo-router/react-navigation", () => ({
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- a mock factory loads React after Jest hoisting
	useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
}));
import { SATCHEL_TUNING } from "@/constants/satchel";
import {
	bagHasWishFor,
	cameFromAFriend,
	deliveryLine,
	matchingItems,
	newSwapNonce,
	sanitizeSatchelTuning,
	satchelReceiptCopy,
	satchelReceiptLine,
	satchelReceiptRoll,
	swapLine,
	swapRefusalCopy,
	fetchFriendWishes,
	toSatchelState,
	wishHoursLeft,
	wishOpenForMe,
	type FriendWish,
	type SatchelItem,
} from "@/utils/satchel";
import { reconcileReceipt, type DigReceipt } from "@/utils/snoutDeep";

const bag: SatchelItem[] = [
	{ id: 1, find_id: "river_pebble" },
	{ id: 2, find_id: "blue_feather" },
	{ id: 3, find_id: "river_pebble" },
];

const wish = (
	find_id: SatchelItem["find_id"],
	fulfilled_by_me = false,
	extra: Partial<FriendWish> = {},
): FriendWish => ({
	target_id: "friend",
	find_id,
	wish_no: 4,
	expires_at: new Date(Date.now() + 3_600_000 * 5).toISOString(),
	fulfilled_by_me,
	options: [],
	swapped_today: false,
	...extra,
});

describe("satchel tuning — server row → config, compiled fallback", () => {
	it("rejects a non-object and fills every field from a partial row", () => {
		expect(sanitizeSatchelTuning(null)).toBeNull();
		expect(sanitizeSatchelTuning("6")).toBeNull();
		const partial = sanitizeSatchelTuning({ cap: 8 });
		expect(partial).toEqual({ ...SATCHEL_TUNING, cap: 8 });
	});

	it("clamps out-of-range numbers and drops junk thresholds", () => {
		const t = sanitizeSatchelTuning({
			cap: 0,
			find_odds: { none: 2, one: -1, two: "x" },
			wish_reroll_hours: 9999,
			tickles: 999,
			keepsake_thresholds: [50, "ten", -3, 10.7, 0],
		});
		expect(t).toEqual({
			...SATCHEL_TUNING,
			cap: 1,
			findOdds: { none: 1, one: 0, two: SATCHEL_TUNING.findOdds.two },
			wishRerollHours: 24 * 14,
			tickles: 50,
			keepsakeThresholds: [10, 50],
		});
	});

	it("reads the seeded row exactly as the compiled fallback", () => {
		// The seeded row's cap is the unbounded sentinel since
		// 20260918090000_satchel_unbounded.sql.
		expect(
			sanitizeSatchelTuning({
				cap: 9999,
				find_odds: { none: 0.3, one: 0.5, two: 0.2 },
				rarity_weights: { common: 70, uncommon: 25, rare: 5 },
				wish_reroll_hours: 48,
				tickles: 3,
				keepsake_thresholds: [10, 50, 100],
				options: 3,
				paid_swaps_per_pair_per_day: 3,
				paid_swaps_per_pig_per_day: 10,
			}),
		).toEqual(SATCHEL_TUNING);
	});

	it("reads and clamps the swap numbers, and falls back per field", () => {
		const t = sanitizeSatchelTuning({
			options: 99,
			paid_swaps_per_pair_per_day: -4,
			paid_swaps_per_pig_per_day: 7.9,
		});
		expect(t?.options).toBe(6);
		expect(t?.paidSwapsPerPairPerDay).toBe(0);
		expect(t?.paidSwapsPerPigPerDay).toBe(7);
		const partial = sanitizeSatchelTuning({ cap: 6 });
		expect(partial?.options).toBe(SATCHEL_TUNING.options);
		expect(partial?.paidSwapsPerPairPerDay).toBe(SATCHEL_TUNING.paidSwapsPerPairPerDay);
		expect(partial?.paidSwapsPerPigPerDay).toBe(SATCHEL_TUNING.paidSwapsPerPigPerDay);
	});
});

describe("the match", () => {
	it("lists every bag item that fulfils the wish, in bag order", () => {
		expect(matchingItems(bag, wish("river_pebble")).map((i) => i.id)).toEqual([1, 3]);
		expect(matchingItems(bag, wish("tin_whistle"))).toEqual([]);
		expect(matchingItems(bag, null)).toEqual([]);
	});

	it("marks a friend row only when the bag holds the wish and it is still open", () => {
		expect(bagHasWishFor(bag, wish("blue_feather"))).toBe(true);
		expect(bagHasWishFor(bag, wish("blue_feather", true))).toBe(false);
		expect(bagHasWishFor(bag, wish("marble"))).toBe(false);
		expect(bagHasWishFor(bag, undefined)).toBe(false);
	});

	it("a wish is open unless this visitor already fulfilled it", () => {
		expect(wishOpenForMe(wish("clover"))).toBe(true);
		expect(wishOpenForMe(wish("clover", true))).toBe(false);
		expect(wishOpenForMe(null)).toBe(false);
	});

	it("the pair's one swap a day closes the wish and hides the row mark", () => {
		const spent = wish("blue_feather", false, { swapped_today: true });
		expect(wishOpenForMe(spent)).toBe(false);
		expect(bagHasWishFor(bag, spent)).toBe(false);
	});

	it("counts the hours before a wish rerolls, floored at zero", () => {
		expect(wishHoursLeft(wish("clover"))).toBe(5);
		expect(wishHoursLeft({ ...wish("clover"), expires_at: "2000-01-01T00:00:00Z" })).toBe(0);
		expect(wishHoursLeft(null)).toBe(0);
	});
});

describe("the lines", () => {
	it("says what the dig rolled into the bag", () => {
		expect(satchelReceiptLine({ found: ["river_pebble"], lost: [] })).toBe(
			"your Satchel got heavier: a river pebble.",
		);
		expect(satchelReceiptLine({ found: ["old_key", "red_berries"], lost: [] })).toBe(
			"your Satchel got heavier: an old key and some red berries.",
		);
	});

	it("says what stayed in the mud when the bag was full", () => {
		expect(satchelReceiptLine({ found: [], lost: ["pinecone"] })).toBe(
			"Satchel's full — a pinecone stayed in the mud.",
		);
		expect(satchelReceiptLine({ found: ["clover"], lost: ["marble"] })).toBe(
			"your Satchel got heavier: a four-leaf clover. Satchel's full — a glass marble stayed in the mud.",
		);
	});

	it("says nothing for an empty roll, an unknown id, or a pre-migration receipt", () => {
		expect(satchelReceiptLine(null)).toBeNull();
		expect(satchelReceiptLine({ found: [], lost: [] })).toBeNull();
		expect(satchelReceiptLine({ found: ["unicorn_horn"] })).toBeNull();
	});

	it("names the host's gain first, the tickles second — never 'you earned'", () => {
		expect(deliveryLine("Maple", "blue_feather", 3)).toBe(
			"Maple's pig got the blue feather it was hoping for — you both got 3 tickles.",
		);
		expect(deliveryLine("Maple", "blue_feather", 0)).toBe(
			"Maple's pig got the blue feather it was hoping for.",
		);
		expect(deliveryLine("Maple", "blue_feather", 3)).not.toMatch(/earn/);
	});
});

describe("the dig receipt carries the satchel line", () => {
	const receipt: DigReceipt = {
		kind: "tied",
		kicker: "k",
		title: "t",
		countLine: "c",
		rows: [],
		gt: [],
		xp: 20,
		ticklesTotal: 0,
		tickledBefore: null,
		tickledNow: null,
		primary: "Back",
	};

	it("fills the line from the server's satchel object and keeps it on a later reconcile", () => {
		const first = reconcileReceipt(receipt, { satchel: { found: ["honeycomb"], lost: [] } });
		expect(first.satchelLine).toBe("your Satchel got heavier: a chip of honeycomb.");
		const again = reconcileReceipt(first, { ticklesTotal: 4 });
		expect(again.satchelLine).toBe(first.satchelLine);
	});

	it("fills the drawn roll — finds, the turned-away, count and cap — and keeps it too", () => {
		const first = reconcileReceipt(receipt, {
			satchel: { found: ["honeycomb", "clover"], lost: ["marble"], count: 6, cap: 6 },
		});
		expect(first.satchel).toEqual({ found: ["honeycomb", "clover"], lost: ["marble"], count: 6, cap: 6 });
		const again = reconcileReceipt(first, { ticklesTotal: 4 });
		expect(again.satchel).toEqual(first.satchel);
	});

	it("leaves the line and the roll null on a pre-migration receipt", () => {
		const r = reconcileReceipt(receipt, { ticklesTotal: 4 });
		expect(r.satchelLine).toBeNull();
		expect(r.satchel).toBeNull();
	});
});

describe("the receipt's bag roll and its words", () => {
	it("parses the server object, dropping ids this build cannot draw and bad numbers", () => {
		expect(satchelReceiptRoll(null)).toBeNull();
		expect(satchelReceiptRoll({ found: [], lost: [] })).toBeNull();
		expect(satchelReceiptRoll({ found: ["unicorn_horn"] })).toBeNull();
		expect(satchelReceiptRoll({ found: ["river_pebble", "unicorn_horn"], count: 2.7, cap: "6" })).toEqual({
			found: ["river_pebble"],
			lost: [],
			count: 2,
			cap: null,
		});
	});

	it("says what went in and where the bag stands", () => {
		expect(
			satchelReceiptCopy({ found: ["river_pebble", "old_key"], lost: [], count: 3, cap: 6 }),
		).toEqual({ kicker: "into your satchel", line: "a river pebble and an old key · 3 of 6 finds" });
		expect(satchelReceiptCopy({ found: ["clover"], lost: [], count: null, cap: null })).toEqual({
			kicker: "into your satchel",
			line: "a four-leaf clover",
		});
	});

	it("says what the full bag turned away", () => {
		expect(satchelReceiptCopy({ found: [], lost: ["pinecone"], count: 6, cap: 6 })).toEqual({
			kicker: "the satchel's full",
			line: "a pinecone stayed in the mud · full — 6 finds",
		});
		expect(satchelReceiptCopy({ found: ["clover"], lost: ["marble"], count: 6, cap: 6 })).toEqual({
			kicker: "into your satchel",
			line: "a four-leaf clover · full now — a glass marble stayed in the mud",
		});
	});
});

describe("my_satchel → state", () => {
	it("drops ids this build cannot draw and defaults the rest", () => {
		const s = toSatchelState({
			cap: 6,
			items: [
				{ id: 9, find_id: "marble" },
				{ id: 10, find_id: "unicorn_horn" },
			],
			met: ["marble", "nope"],
			wish: { find_id: "old_key", wish_no: 2, expires_at: "2030-01-01T00:00:00Z" },
			shelf: [{ find_id: "clover", count: 2 }, { find_id: "clover", count: 0 }],
			deliveries: 12,
			keepsakes: [10, "x"],
		});
		expect(s.items).toEqual([{ id: 9, find_id: "marble" }]);
		expect(s.met).toEqual(["marble"]);
		expect(s.wish?.find_id).toBe("old_key");
		expect(s.shelf).toEqual([{ find_id: "clover", count: 2 }]);
		expect(s.deliveries).toBe(12);
		expect(s.keepsakes).toEqual([10]);
	});
});

describe("my_satchel → state, under the swaps migration", () => {
	it("reads swaps_given / swaps_received / paid_left_today and the bag's source", () => {
		const s = toSatchelState({
			cap: 6,
			items: [
				{ id: 1, find_id: "marble", source: "swap" },
				{ id: 2, find_id: "clover", source: "nonsense" },
			],
			met: [],
			wish: null,
			shelf: [],
			swaps_given: 7,
			swaps_received: 4,
			paid_left_today: 2,
			keepsakes: [],
		});
		expect(s.items).toEqual([
			{ id: 1, find_id: "marble", source: "swap" },
			{ id: 2, find_id: "clover" },
		]);
		expect(s.swapsGiven).toBe(7);
		expect(s.swapsReceived).toBe(4);
		expect(s.paidLeftToday).toBe(2);
		// The old name stays populated for one build.
		expect(s.deliveries).toBe(7);
	});

	it("falls back to a pre-swaps server's `deliveries`", () => {
		const s = toSatchelState({ cap: 6, items: [], met: [], deliveries: 12 });
		expect(s.swapsGiven).toBe(12);
		expect(s.deliveries).toBe(12);
		expect(s.swapsReceived).toBe(0);
		expect(s.paidLeftToday).toBeNull();
	});

	it("knows which finds came from a friend", () => {
		expect(cameFromAFriend("swap")).toBe(true);
		expect(cameFromAFriend("gift")).toBe(true);
		expect(cameFromAFriend("migrated_shelf")).toBe(true);
		expect(cameFromAFriend("dig")).toBe(false);
		expect(cameFromAFriend(undefined)).toBe(false);
	});
});

describe("the nonce", () => {
	it("is v4-shaped and never repeats", () => {
		const n = newSwapNonce();
		expect(n).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		const many = new Set(Array.from({ length: 200 }, () => newSwapNonce()));
		expect(many.size).toBe(200);
	});
});

describe("the swap's line", () => {
	it("names the host's gain first, then the take, then the tickles", () => {
		expect(swapLine("Maple", "blue_feather", "old_key", 3, true)).toBe(
			"Maple's pig got the blue feather it was hoping for; you took the old key. You both got 3 tickles.",
		);
	});

	it("a gift says it gave, and adds the generous tick", () => {
		expect(swapLine("Maple", "blue_feather", null, 3, true)).toBe(
			"Maple's pig got the blue feather it was hoping for; you gave it away. You both got 3 tickles, and a generous tick.",
		);
	});

	it("a pair past the daily paid cap is told plainly, never shown a zero", () => {
		expect(swapLine("Maple", "blue_feather", "old_key", 0, false)).toBe(
			"Maple's pig got the blue feather it was hoping for; you took the old key. (no tickles — you've swapped plenty today)",
		);
		expect(swapLine("Maple", "blue_feather", null, 0, false)).toContain(
			"(no tickles — you've swapped plenty today)",
		);
	});

	it("never says the giver earned anything", () => {
		expect(swapLine("Maple", "blue_feather", "old_key", 3, true)).not.toMatch(/earn/);
	});
});

describe("the swap's refusals", () => {
	const REASONS = [
		"not_authenticated",
		"bad_nonce",
		"invalid_host",
		"host_not_found",
		"not_friends",
		"blocked",
		"not_in_bag",
		"wish_changed",
		"already_today",
		"wrong_find",
		"not_offered",
		"option_gone",
		"host_bag_full",
	];

	it("every wire-contract reason has a title, and nothing shouts", () => {
		for (const reason of REASONS) {
			const copy = swapRefusalCopy(reason);
			expect(copy.title.length).toBeGreaterThan(0);
			expect(copy.title).not.toMatch(/[A-Z]{4,}/);
		}
	});

	it("says the named things the plan asks for", () => {
		expect(swapRefusalCopy("wish_changed").title).toBe("Their pig changed its mind");
		expect(swapRefusalCopy("already_today").title).toBe(
			"You two swapped today — come back tomorrow",
		);
		expect(swapRefusalCopy("option_gone", "Maple").title).toBe(
			"Maple's pig changed its mind about that one",
		);
		expect(swapRefusalCopy("option_gone").title).toBe("Their pig changed its mind about that one");
		expect(swapRefusalCopy("host_bag_full").title).toBe(
			"Their Satchel is full — try the swap instead",
		);
	});

	it("reports not_offered — the rule diverged, which is a bug, not a state", () => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- reading the mocked logger
		const { log } = require("@/utils/log");
		log.error.mockClear();
		swapRefusalCopy("not_offered");
		expect(log.error).toHaveBeenCalledWith(expect.stringContaining("not_offered"));
	});

	it("an unknown reason still lands somewhere warm", () => {
		expect(swapRefusalCopy("something_new").title).toBe(
			"That didn't land — try again in a moment.",
		);
	});
});

// ── the read path and the hook ──────────────────────────────────────────────
// Both are wired through the mocked rpc boundary, so this stays a pure suite.
describe("friend_wishes → the bubble's wish", () => {
	const rpc = jest.mocked(
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- the module is lazily required by design
		(require("@/utils/rpc") as typeof import("@/utils/rpc")).rpcAction,
	);

	it("parses the options and the daily gate, dropping ids this build can't draw", async () => {
		rpc.mockResolvedValue({
			ok: true,
			wishes: [
				{
					target_id: "friend",
					find_id: "clover",
					wish_no: 9,
					expires_at: "2030-01-01T00:00:00Z",
					fulfilled_by_me: false,
					options: ["old_key", "unicorn_horn", "marble"],
					swapped_today: true,
				},
			],
		} as never);
		const r = await fetchFriendWishes(["friend"]);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.wishes[0].options).toEqual(["old_key", "marble"]);
		expect(r.wishes[0].swapped_today).toBe(true);
	});

	it("a pre-swaps server answers no options and an open gate", async () => {
		rpc.mockResolvedValue({
			ok: true,
			wishes: [
				{
					target_id: "friend",
					find_id: "clover",
					wish_no: 9,
					expires_at: "2030-01-01T00:00:00Z",
					fulfilled_by_me: false,
				},
			],
		} as never);
		const r = await fetchFriendWishes(["friend"]);
		if (!r.ok) return;
		expect(r.wishes[0].options).toEqual([]);
		expect(r.wishes[0].swapped_today).toBe(false);
	});
});

describe("useSatchel — the bag a server answer installs", () => {
	const rpc = jest.mocked(
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- the module is lazily required by design
		(require("@/utils/rpc") as typeof import("@/utils/rpc")).rpcAction,
	);

	const drive = () => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- renderer-only harness
		const React = require("react") as typeof import("react");
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- renderer-only harness
		const TestRenderer = require("react-test-renderer") as typeof import("react-test-renderer");
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- the hook under test
		const { useSatchel } = require("@/hooks/useSatchel") as typeof import("@/hooks/useSatchel");
		let api: ReturnType<typeof useSatchel> | null = null;
		function Probe() {
			api = useSatchel();
			return null;
		}
		let tree: ReturnType<typeof TestRenderer.create>;
		TestRenderer.act(() => {
			tree = TestRenderer.create(React.createElement(Probe));
		});
		return {
			get api() {
				return api as ReturnType<typeof useSatchel>;
			},
			act: TestRenderer.act,
			unmount: () => TestRenderer.act(() => tree.unmount()),
		};
	};

	const BAG = {
		ok: true,
		cap: 6,
		items: [
			{ id: 1, find_id: "river_pebble" },
			{ id: 2, find_id: "blue_feather" },
			{ id: 3, find_id: "clover" },
		],
		met: [],
		wish: null,
		shelf: [],
		swaps_given: 0,
		swaps_received: 0,
		keepsakes: [],
	};

	beforeEach(() => rpc.mockReset());

	it("applyBag installs the server's whole bag rather than trimming by a count", async () => {
		rpc.mockResolvedValue(BAG as never);
		const h = drive();
		await h.act(async () => {});
		expect(h.api.state.items).toHaveLength(3);
		h.act(() => h.api.applyBag([{ id: 3, find_id: "clover", source: "swap" }]));
		expect(h.api.state.items).toEqual([{ id: 3, find_id: "clover", source: "swap" }]);
		h.unmount();
	});

	it("removeItem drops the find that left, not the last one", async () => {
		rpc.mockResolvedValue(BAG as never);
		const h = drive();
		await h.act(async () => {});
		h.act(() => h.api.removeItem(2));
		expect(h.api.state.items.map((i) => i.id)).toEqual([1, 3]);
		h.unmount();
	});

	it("a refused toss puts the find back WHERE IT WAS", async () => {
		rpc.mockResolvedValue(BAG as never);
		const h = drive();
		await h.act(async () => {});
		rpc.mockResolvedValue({ ok: false, reason: "network" } as never);
		await h.act(async () => {
			await h.api.toss(2);
		});
		expect(h.api.state.items.map((i) => i.id)).toEqual([1, 2, 3]);
		h.unmount();
	});
});

describe("an unbounded satchel (2026-09-18)", () => {
	const { SATCHEL_UNBOUNDED_CAP, isSatchelUnbounded } = require("@/constants/satchel");
	const { satchelStanding } = require("@/utils/satchel");

	it("the compiled fallback is unbounded and the sanitizer keeps a server row at the sentinel", () => {
		expect(isSatchelUnbounded(SATCHEL_TUNING.cap)).toBe(true);
		expect(sanitizeSatchelTuning({ cap: SATCHEL_UNBOUNDED_CAP })?.cap).toBe(SATCHEL_UNBOUNDED_CAP);
		expect(isSatchelUnbounded(6)).toBe(false);
		expect(isSatchelUnbounded(null)).toBe(true);
	});

	it("an unbounded bag only counts — never 'full', never 'of'", () => {
		expect(satchelStanding(4, SATCHEL_UNBOUNDED_CAP)).toBe("4 finds");
		expect(satchelStanding(1, null)).toBe("1 find");
		expect(satchelStanding(9, 6)).toBe("full — 9 finds");
		expect(satchelStanding(3, 6)).toBe("3 of 6 finds");
		expect(satchelStanding(null, 6)).toBeNull();
	});
});
