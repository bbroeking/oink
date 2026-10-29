// The Ghost Sheep Trader's pure rules (utils/trader + constants/trader): the
// price rule, the status narrowing, the stay clock, and the copy — the parts a
// screen needs synchronously and the wire shape the server answers.
import { SATCHEL_FINDS } from "@/constants/satchel";
import { TRADER_TUNING, nextRarity, traderHandPay, traderPairBonus, traderPrice } from "@/constants/trader";
import {
	NO_TRADER,
	TRADER_LEAVE_COPY,
	bagGroups,
	findPlural,
	maxHand,
	priceFor,
	priceHand,
	toTraderStatus,
	tradeUpPick,
	traderArrivalCopy,
	traderFanLine,
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
			unpaired: [],
			tradeUps: {},
		});
		// A server that never heard of sets: no pairs, no trade-ups, whatever
		// the compiled fallback says (the sheet must not promise an unpaid bonus).
		expect(s.tuning).toEqual({
			prices: { common: 3, uncommon: 8, rare: 20 },
			wantMultiplier: 2,
			findsPerVisit: 6,
			pairMultiplier: 1,
			tradeUp: false,
			tradeUpCount: 3,
		});
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

	it("names the new deal when sets are on, and the fan line says pairs", () => {
		const sets = setsStatus();
		expect(traderGreeting(sets)).toBe(
			"Finds for tickles. Bring me a pair and I pay half again. Three alike and I will trade you up.",
		);
		expect(traderFanLine(sets, 340)).toBe("the Ghost Sheep · pairs today · 5h 40m left");
		expect(traderFanLine(status(), 340)).toBe("the Ghost Sheep · 5h 40m left");
		expect(traderFanLine(setsStatus({ finds_left: 0 }), 340)).toBe("the Ghost Sheep has had enough");
		expect(traderArrivalCopy(sets)).toEqual({
			title: "The Ghost Sheep is at the hedge",
			sub: "Today he fancies pairs. Three alike, he trades up.",
		});
		expect(traderArrivalCopy(status()).title).toBe("A hooded stranger is at the hedge");
		expect(TRADER_LEAVE_COPY.title).toBe("The Ghost Sheep wandered off");
	});

	it("refuses in character", () => {
		expect(traderRefusalCopy("not_enough")).toBe("Three alike, little pig. Count again.");
		expect(traderRefusalCopy("no_trade_up")).toBe("Nothing sits above that one.");
		expect(traderRefusalCopy("not_here")).toBe("He's already wandered off.");
		expect(traderRefusalCopy("had_enough")).toBe("He's taken all he'll take this visit.");
		expect(traderRefusalCopy("not_in_bag")).toBe("That one isn't in your bag any more.");
		expect(traderRefusalCopy("whatever")).toBe("He shook his head. Try again.");
	});
});

// ── Sets and trade-ups (20261029210000) ─────────────────────────────────────

function setsStatus(visit: Record<string, unknown> = {}) {
	return toTraderStatus({
		ok: true,
		present: true,
		now: T0,
		visit: {
			id: 8,
			day: "2026-05-01",
			arrives_at: ARRIVES,
			leaves_at: LEAVES,
			want_find_id: "blue_feather",
			sold: 0,
			tickles: 0,
			finds_left: 9,
			unpaired: [],
			trade_ups: { common: "marble", uncommon: "tin_whistle" },
			...visit,
		},
		prices: { common: 3, uncommon: 8, rare: 20 },
		want_multiplier: 2,
		finds_per_visit: 9,
		pair_multiplier: 1.5,
		trade_up: true,
		trade_up_count: 3,
		met: false,
		sales: 0,
	});
}

describe("the pair rule", () => {
	it("pays half again on the two, floored like the server", () => {
		expect(traderPairBonus(3, 3, 1.5)).toBe(3);
		expect(traderPairBonus(6, 6, 1.5)).toBe(6);
		expect(traderPairBonus(3, 3, 1.25)).toBe(1);
		expect(traderPairBonus(3, 3, 1)).toBe(0);
	});

	it("replays a hand sale by sale: a pair, a third that opens a new one, one already unpaired", () => {
		expect(traderHandPay(3, 1, 1.5, false)).toEqual({ each: [3], total: 3 });
		expect(traderHandPay(3, 2, 1.5, false)).toEqual({ each: [3, 6], total: 9 });
		expect(traderHandPay(3, 3, 1.5, false)).toEqual({ each: [3, 6, 3], total: 12 });
		// One went earlier this visit: this single completes it.
		expect(traderHandPay(3, 1, 1.5, true)).toEqual({ each: [6], total: 6 });
		expect(traderHandPay(16, 2, 1.5, false).total).toBe(48);
		// No pairs on the server: plain singles.
		expect(traderHandPay(3, 2, 1, false)).toEqual({ each: [3, 3], total: 6 });
	});

	it("names the rarity one up, and nothing above rare", () => {
		expect(nextRarity("common")).toBe("uncommon");
		expect(nextRarity("uncommon")).toBe("rare");
		expect(nextRarity("rare")).toBeNull();
	});
});

describe("toTraderStatus, sets on", () => {
	it("reads the pair / trade-up tuning, the unpaired finds, and his picks", () => {
		const s = setsStatus({ unpaired: ["river_pebble", "moon_rock"] });
		expect(s.tuning.pairMultiplier).toBe(1.5);
		expect(s.tuning.tradeUp).toBe(true);
		expect(s.tuning.tradeUpCount).toBe(3);
		expect(s.tuning.findsPerVisit).toBe(9);
		// An id this build cannot name is dropped.
		expect(s.visit?.unpaired).toEqual(["river_pebble"]);
		expect(s.visit?.tradeUps).toEqual({ common: "marble", uncommon: "tin_whistle" });
	});

	it("drops a rare key and an unknown pick", () => {
		const s = setsStatus({ trade_ups: { common: "moon_rock", uncommon: "tin_whistle", rare: "marble" } });
		expect(s.visit?.tradeUps).toEqual({ uncommon: "tin_whistle" });
	});
});

describe("hands", () => {
	it("prices a single, a pair, a single that completes an earlier pair, and the fancied pair", () => {
		const s = setsStatus();
		expect(priceHand("river_pebble", 1, s)).toMatchObject({ kind: "sell", total: 3, pair: false });
		expect(priceHand("river_pebble", 2, s)).toMatchObject({ kind: "sell", total: 9, pair: true, each: [3, 6] });
		expect(priceHand("blue_feather", 2, s)).toMatchObject({ kind: "sell", total: 18 });
		const open = setsStatus({ unpaired: ["river_pebble"] });
		expect(priceHand("river_pebble", 1, open)).toMatchObject({ kind: "sell", total: 6, pair: true, openPair: true });
	});

	it("three alike is a trade-up to his pick; rare stays a sale", () => {
		const s = setsStatus();
		expect(priceHand("river_pebble", 3, s)).toEqual({ kind: "tradeUp", findId: "river_pebble", count: 3, pickId: "marble" });
		expect(priceHand("old_key", 3, s)).toMatchObject({ kind: "tradeUp", pickId: "tin_whistle" });
		expect(tradeUpPick("tin_whistle", s)).toBeNull();
		expect(priceHand("tin_whistle", 2, s)).toMatchObject({ kind: "sell", total: 60 });
	});

	it("caps a hand by the bag, the visit, and what the server allows", () => {
		const s = setsStatus();
		expect(maxHand("river_pebble", 5, s)).toBe(3);
		expect(maxHand("river_pebble", 2, s)).toBe(2);
		expect(maxHand("river_pebble", 1, s)).toBe(1);
		// Rare: a pair at most.
		expect(maxHand("tin_whistle", 4, s)).toBe(2);
		// Two left this visit: no room for three.
		expect(maxHand("river_pebble", 5, setsStatus({ finds_left: 2 }))).toBe(2);
		expect(maxHand("river_pebble", 5, setsStatus({ finds_left: 0 }))).toBe(0);
		// A server without sets: one at a time, as before.
		expect(maxHand("river_pebble", 5, status())).toBe(1);
		expect(tradeUpPick("river_pebble", status())).toBeNull();
	});

	it("groups the bag one tile per find, a friend's find spent last", () => {
		const groups = bagGroups([
			{ id: 1, find_id: "river_pebble", source: "gift" },
			{ id: 2, find_id: "clover", source: "dig" },
			{ id: 3, find_id: "river_pebble", source: "dig" },
			{ id: 4, find_id: "river_pebble" },
		]);
		expect(groups.map((g) => g.findId)).toEqual(["river_pebble", "clover"]);
		expect(groups[0].items.map((i) => i.id)).toEqual([3, 4, 1]);
	});

	it("says a find in the plural", () => {
		expect(findPlural("river_pebble")).toBe("river pebbles");
		expect(findPlural("wool_tuft")).toBe("tufts of wool");
		expect(findPlural("clover")).toBe("four-leaf clovers");
	});
});
