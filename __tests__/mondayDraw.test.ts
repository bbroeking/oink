import {
	MONDAY_DRAW_TUNING,
	catchupMultiplier,
	oddsOneIn,
	parseMondayDrawState,
	parseMondayDrawTuning,
	tierForAmount,
	verdictFor,
	warmingLine,
} from "@/utils/mondayDraw";

const WEIGHTS = MONDAY_DRAW_TUNING.tiers;

describe("Monday draw — the catch-up curve", () => {
	it("is flat for the first two Mondays, then warms half a step per Monday, capped at 3", () => {
		expect(catchupMultiplier(0)).toBe(1);
		expect(catchupMultiplier(1)).toBe(1);
		expect(catchupMultiplier(2)).toBe(1.5);
		expect(catchupMultiplier(3)).toBe(2);
		expect(catchupMultiplier(4)).toBe(2.5);
		expect(catchupMultiplier(5)).toBe(3);
		expect(catchupMultiplier(6)).toBe(3);
		expect(catchupMultiplier(40)).toBe(3);
	});

	it("reads the curve from the server's catchup config", () => {
		const catchup = { afterMondays: 1, step: 1, cap: 2, bottomHalfStep: 1 };
		expect(catchupMultiplier(0, catchup)).toBe(1);
		expect(catchupMultiplier(1, catchup)).toBe(2);
		expect(catchupMultiplier(9, catchup)).toBe(2);
	});
});

describe("Monday draw — 1 in N", () => {
	it("mirrors the server: base odds are 1 in 8 for rare or better", () => {
		// 12 / 100 → 8.33 → 8
		expect(oddsOneIn(WEIGHTS, 1)).toBe(8);
	});

	it("warms with the multiplier and never goes past the cap's 1 in 3", () => {
		expect(oddsOneIn(WEIGHTS, 1.5)).toBe(6); // 18/106 → 5.9
		expect(oddsOneIn(WEIGHTS, 2)).toBe(5); // 24/112 → 4.7
		expect(oddsOneIn(WEIGHTS, 2.5)).toBe(4); // 30/118 → 3.9
		expect(oddsOneIn(WEIGHTS, 3)).toBe(3); // 36/124 → 3.4
		expect(oddsOneIn(WEIGHTS, catchupMultiplier(99))).toBe(3);
	});

	it("never drops below 1 in 1 and survives an all-cold table", () => {
		expect(oddsOneIn([{ tier: "rare", weight: 10 }], 1)).toBe(1);
		expect(oddsOneIn([{ tier: "common", weight: 10 }], 3)).toBe(Number.MAX_SAFE_INTEGER);
	});
});

describe("Monday draw — the words", () => {
	it("gives each tier its verdict", () => {
		expect(verdictFor("common")).toBe("A small purse.");
		expect(verdictFor("good")).toBe("A good purse.");
		expect(verdictFor("rare")).toBe("A rare purse!");
		expect(verdictFor("jackpot")).toBe("Jackpot.");
	});

	it("tells the streak as a promise — the spec's sentence", () => {
		expect(warmingLine(4, 3)).toBe(
			"Four Mondays without a rare, so next Monday's warmer: 1 in 3 for rare or better.",
		);
		expect(warmingLine(1, 8)).toBe(
			"One Monday without a rare, so next Monday's warmer: 1 in 8 for rare or better.",
		);
		expect(warmingLine(12, 3)).toBe(
			"12 Mondays without a rare, so next Monday's warmer: 1 in 3 for rare or better.",
		);
	});

	it("has a warm line for a fresh streak too — no loss to report", () => {
		expect(warmingLine(0, 8)).toBe(
			"Every Monday without a rare warms the next: 1 in 8 for rare or better.",
		);
		expect(warmingLine(-3, 8)).toBe(warmingLine(0, 8));
	});

	it("maps an amount back to its tier by the table", () => {
		expect(tierForAmount(60)).toBe("good");
		expect(tierForAmount(400)).toBe("jackpot");
		expect(tierForAmount(7)).toBeNull();
	});
});

describe("Monday draw — parsing the server", () => {
	const raw = {
		ok: true,
		week: "20260907",
		eligible: true,
		drawn: true,
		amount: 60,
		tier: "good",
		mondays_since_rare: 4,
		herd_bottom_half: false,
		next_rare_odds_one_in: 3,
		tiers: [
			{ tier: "common", amount: 25, weight: 50 },
			{ tier: "good", amount: 75, weight: 30 },
			{ tier: "rare", amount: 200, weight: 15 },
			{ tier: "jackpot", amount: 500, weight: 5 },
		],
		catchup: { after_mondays: 3, step: 1, cap: 4, bottom_half_step: 2 },
	};

	it("prefers the server's numbers over the compiled ones", () => {
		const s = parseMondayDrawState(raw);
		expect(s.week).toBe("20260907");
		expect(s.eligible).toBe(true);
		expect(s.drawn).toBe(true);
		expect(s.amount).toBe(60);
		expect(s.tier).toBe("good");
		expect(s.mondaysSinceRare).toBe(4);
		expect(s.nextRareOddsOneIn).toBe(3);
		expect(s.tuning.tiers.map((t) => t.amount)).toEqual([25, 75, 200, 500]);
		expect(s.tuning.catchup).toEqual({ afterMondays: 3, step: 1, cap: 4, bottomHalfStep: 2 });
	});

	it("falls back to the compiled tuning and derives the odds when the server is quiet", () => {
		const s = parseMondayDrawState({ eligible: true, drawn: false, mondays_since_rare: 4 });
		expect(s.tuning).toEqual(MONDAY_DRAW_TUNING);
		expect(s.amount).toBeNull();
		expect(s.tier).toBeNull();
		// 4 steps → ×2.5 → 1 in 4
		expect(s.nextRareOddsOneIn).toBe(4);
	});

	it("rejects a half table rather than drawing tiles for three tiers", () => {
		const t = parseMondayDrawTuning({ tiers: raw.tiers.slice(0, 3) });
		expect(t.tiers).toEqual(MONDAY_DRAW_TUNING.tiers);
	});

	it("ignores an unknown tier and a negative streak", () => {
		const s = parseMondayDrawState({ ...raw, tier: "mythic", mondays_since_rare: -2 });
		expect(s.tier).toBeNull();
		expect(s.mondaysSinceRare).toBe(0);
	});
});
