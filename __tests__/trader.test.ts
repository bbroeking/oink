// The Ghost Sheep Trader's pure rules (utils/trader + constants/trader): the
// price rule, the status narrowing, the stay clock, and the copy — the parts a
// screen needs synchronously and the wire shape the server answers.
import { SATCHEL_FINDS } from "@/constants/satchel";
import { TRADER_TUNING, traderPrice } from "@/constants/trader";
import {
	NO_TRADER,
	priceFor,
	toTraderStatus,
	traderGreeting,
	traderMinutesLeft,
	traderNextCheckMs,
	traderRefusalCopy,
	traderStayLine,
} from "@/utils/trader";

const T0 = "2026-05-01T12:00:00.000Z";
const ARRIVES = "2026-05-01T12:30:00.000Z";
const LEAVES = "2026-05-01T14:30:00.000Z";

function status(overrides: Record<string, unknown> = {}) {
	return toTraderStatus({
		ok: true,
		present: true,
		now: T0,
		visit: {
			id: 7,
			day: "2026-05-01",
			arrives_at: ARRIVES,
			leaves_at: LEAVES,
			want_find_id: "blue_feather",
			sold: 1,
			tickles: 3,
			finds_left: 5,
		},
		prices: { common: 3, uncommon: 8, rare: 20 },
		want_multiplier: 2,
		finds_per_visit: 6,
		met: true,
		sales: 4,
		...overrides,
	});
}

describe("traderPrice", () => {
	it("pays by rarity and doubles the fancied find", () => {
		const pebble = SATCHEL_FINDS.find((f) => f.id === "river_pebble")!;
		const key = SATCHEL_FINDS.find((f) => f.id === "old_key")!;
		const whistle = SATCHEL_FINDS.find((f) => f.id === "tin_whistle")!;
		expect(traderPrice(pebble, TRADER_TUNING, null)).toBe(3);
		expect(traderPrice(key, TRADER_TUNING, null)).toBe(8);
		expect(traderPrice(whistle, TRADER_TUNING, null)).toBe(20);
		expect(traderPrice(pebble, TRADER_TUNING, "river_pebble")).toBe(6);
		expect(traderPrice(key, TRADER_TUNING, "river_pebble")).toBe(8);
	});

	it("floors a fractional multiplier like the server", () => {
		const key = SATCHEL_FINDS.find((f) => f.id === "old_key")!;
		expect(traderPrice(key, { ...TRADER_TUNING, wantMultiplier: 1.5 }, "old_key")).toBe(12);
		// A multiplier under 1 never discounts the fancied find.
		expect(traderPrice(key, { ...TRADER_TUNING, wantMultiplier: 0.5 }, "old_key")).toBe(8);
	});
});

describe("toTraderStatus", () => {
	it("narrows the wire shape", () => {
		const s = status();
		expect(s.present).toBe(true);
		expect(s.visit).toEqual({
			id: 7,
			day: "2026-05-01",
			arrivesAt: ARRIVES,
			leavesAt: LEAVES,
			wantFindId: "blue_feather",
			sold: 1,
			tickles: 3,
			findsLeft: 5,
		});
		expect(s.tuning).toEqual({ prices: { common: 3, uncommon: 8, rare: 20 }, wantMultiplier: 2, findsPerVisit: 6 });
		expect(s.met).toBe(true);
		expect(s.sales).toBe(4);
	});

	it("hides an unknown want and falls back to the compiled tuning", () => {
		const s = status({ visit: { id: 1, arrives_at: ARRIVES, leaves_at: LEAVES, want_find_id: "moon_rock" }, prices: null });
		expect(s.visit?.wantFindId).toBeNull();
		expect(s.tuning.prices).toEqual(TRADER_TUNING.prices);
	});

	it("is not present without a visit, whatever the flag says", () => {
		expect(status({ visit: null }).present).toBe(false);
	});

	it("prices a bag row off the live status", () => {
		const s = status();
		expect(priceFor("blue_feather", s)).toBe(6);
		expect(priceFor("river_pebble", s)).toBe(3);
		expect(priceFor("tin_whistle", s)).toBe(20);
	});
});

describe("the stay clock", () => {
	const readAt = 1_000_000;

	it("counts down from the server's clock plus the time elapsed since the read", () => {
		const s = status();
		// leaves − now = 150 min at the read.
		expect(traderMinutesLeft(s, readAt, readAt)).toBe(150);
		expect(traderMinutesLeft(s, readAt, readAt + 60 * 60_000)).toBe(90);
		expect(traderMinutesLeft(s, readAt, readAt + 200 * 60_000)).toBe(0);
	});

	it("is 0 when he is not here", () => {
		expect(traderMinutesLeft(status({ present: false }), readAt, readAt)).toBe(0);
		expect(traderMinutesLeft(NO_TRADER, readAt, readAt)).toBe(0);
	});

	it("waits for his arrival when he is on his way, and his leaving when he is here", () => {
		const away = status({ present: false });
		expect(traderNextCheckMs(away, readAt, readAt)).toBe(30 * 60_000 + 1000);
		const here = status();
		expect(traderNextCheckMs(here, readAt, readAt)).toBe(150 * 60_000 + 1000);
		// Past the edge already: a short wait, never a negative one.
		expect(traderNextCheckMs(here, readAt, readAt + 200 * 60_000)).toBe(1000);
		expect(traderNextCheckMs(NO_TRADER, readAt, readAt)).toBeNull();
	});

	it("says the stay in the hand", () => {
		expect(traderStayLine(0)).toBe("packing up");
		expect(traderStayLine(3)).toBe("a few minutes left");
		expect(traderStayLine(45)).toBe("45m left");
		expect(traderStayLine(120)).toBe("2h left");
		expect(traderStayLine(130)).toBe("2h 10m left");
	});
});

describe("his voice", () => {
	it("names what he fancies, or that he has had enough", () => {
		expect(traderGreeting(status())).toContain("a blue feather");
		expect(traderGreeting(status({ visit: { id: 1, arrives_at: ARRIVES, leaves_at: LEAVES, finds_left: 0 } }))).toBe(
			"Enough for one visit, little pig.",
		);
		expect(traderGreeting(status({ visit: { id: 1, arrives_at: ARRIVES, leaves_at: LEAVES, finds_left: 2 } }))).toContain(
			"Finds for tickles",
		);
	});

	it("refuses in character", () => {
		expect(traderRefusalCopy("not_here")).toBe("He's already wandered off.");
		expect(traderRefusalCopy("had_enough")).toBe("He's taken all he'll take this visit.");
		expect(traderRefusalCopy("not_in_bag")).toBe("That one isn't in your bag any more.");
		expect(traderRefusalCopy("whatever")).toBe("He shook his head. Try again.");
	});
});
