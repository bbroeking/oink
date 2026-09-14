// The Satchel's pure rules (utils/satchel) — the tuning sanitizer, the match,
// the row mark, the receipt line and the delivery line. Native-free: the rpc
// chain is lazily required only inside the async paths, which these never
// touch.
import { SATCHEL_TUNING } from "@/constants/satchel";
import {
	bagHasWishFor,
	deliveryLine,
	matchingItems,
	sanitizeSatchelTuning,
	satchelReceiptLine,
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

const wish = (find_id: SatchelItem["find_id"], fulfilled_by_me = false): FriendWish => ({
	target_id: "friend",
	find_id,
	wish_no: 4,
	expires_at: new Date(Date.now() + 3_600_000 * 5).toISOString(),
	fulfilled_by_me,
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
			cap: 1,
			findOdds: { none: 1, one: 0, two: SATCHEL_TUNING.findOdds.two },
			wishRerollHours: 24 * 14,
			tickles: 50,
			keepsakeThresholds: [10, 50],
		});
	});

	it("reads the seeded row exactly as the compiled fallback", () => {
		expect(
			sanitizeSatchelTuning({
				cap: 6,
				find_odds: { none: 0.3, one: 0.5, two: 0.2 },
				rarity_weights: { common: 70, uncommon: 25, rare: 5 },
				wish_reroll_hours: 48,
				tickles: 3,
				keepsake_thresholds: [10, 50, 100],
			}),
		).toEqual(SATCHEL_TUNING);
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

	it("leaves the line null on a pre-migration receipt", () => {
		expect(reconcileReceipt(receipt, { ticklesTotal: 4 }).satchelLine).toBeNull();
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
