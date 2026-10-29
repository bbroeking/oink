// The Monday drum's pure rules (spec: docs/design/2026-09-21-season-page-rewrite.md §2).
// Best-of-N over the tier table: `1 − (1 − p)^n`, printed as "1 in N". No
// streak, no multiplier, no herd flag — those left the formula with the race.
import {
	MONDAY_DRAW_TUNING,
	ballsWord,
	leftoverSuffix,
	oddsLine,
	oddsOneIn,
	parseMondayDrawState,
	parseMondayDrawTuning,
	rarePerBall,
	tierForAmount,
	verdictFor,
} from "@/utils/mondayDraw";

describe("Monday drum — the per-ball chance", () => {
	it("is the rare + jackpot weight over the whole table", () => {
		// 10 + 2 over 100.
		expect(rarePerBall()).toBeCloseTo(0.12, 10);
	});

	it("reads the server's weights, not the compiled ones", () => {
		const tuning = parseMondayDrawTuning({
			tiers: [
				{ tier: "common", amount: 25, weight: 50 },
				{ tier: "good", amount: 75, weight: 30 },
				{ tier: "rare", amount: 200, weight: 15 },
				{ tier: "jackpot", amount: 500, weight: 5 },
			],
		});
		expect(rarePerBall(tuning)).toBeCloseTo(0.2, 10);
	});
});

describe("Monday drum — 1 in N", () => {
	it("mirrors the server at the placeholder weights", () => {
		// p = 0.12 → 1 − 0.88^n, rounded to the nearest whole N.
		expect(oddsOneIn(1)).toBe(8);
		expect(oddsOneIn(3)).toBe(3);
		expect(oddsOneIn(7)).toBe(2);
		expect(oddsOneIn(21)).toBe(1);
	});

	it("never quotes better than 1 in 1, and never worse with more balls", () => {
		let previous = Number.MAX_SAFE_INTEGER;
		for (let n = 1; n <= 30; n++) {
			const oneIn = oddsOneIn(n);
			expect(oneIn).toBeGreaterThanOrEqual(1);
			expect(oneIn).toBeLessThanOrEqual(previous);
			previous = oneIn;
		}
	});

	it("quotes a one-ball spin for an empty drum — the server's own clamp", () => {
		expect(oddsOneIn(0)).toBe(oddsOneIn(1));
		expect(oddsOneIn(-4)).toBe(oddsOneIn(1));
	});

	it("survives an all-cold table rather than dividing by zero", () => {
		const cold = { tiers: [{ tier: "common" as const, amount: 20, weight: 60 }] };
		expect(oddsOneIn(7, cold)).toBe(Number.MAX_SAFE_INTEGER);
	});

	it("matches the closed form the spec prints", () => {
		const p = 0.12;
		for (const n of [1, 2, 3, 5, 7, 14, 21]) {
			expect(oddsOneIn(n)).toBe(Math.max(1, Math.round(1 / (1 - Math.pow(1 - p, n)))));
		}
	});
});

describe("Monday drum — the words", () => {
	it("gives each tier its verdict", () => {
		expect(verdictFor("common")).toBe("A small purse.");
		expect(verdictFor("good")).toBe("A good purse.");
		expect(verdictFor("rare")).toBe("A rare purse!");
		expect(verdictFor("jackpot")).toBe("Jackpot.");
	});

	it("counts balls one way, everywhere", () => {
		expect(ballsWord(0)).toBe("0 balls");
		expect(ballsWord(1)).toBe("1 ball");
		expect(ballsWord(21)).toBe("21 balls");
	});

	it("prints the odds as 1 in N, never a percentage", () => {
		expect(oddsLine(2)).toBe("rare or better: 1 in 2");
		expect(oddsLine(8)).toBe("rare or better: 1 in 8");
		expect(oddsLine(0)).toBe("rare or better: 1 in 1");
	});

	it("maps an amount back to its tier by the table", () => {
		expect(tierForAmount(60)).toBe("good");
		expect(tierForAmount(400)).toBe("jackpot");
		expect(tierForAmount(7)).toBeNull();
	});
});

describe("Monday drum — parsing the drum server", () => {
	const raw = {
		ok: true,
		week: "20260914",
		week_starts_at: "2026-09-14T00:00:00Z",
		week_ends_at: "2026-09-21T00:00:00Z",
		eligible: true,
		drawn: true,
		amount: 60,
		tier: "good",
		balls: 7,
		cap: 21,
		rolls: ["common", "good", "common", "common", "good", "common", "common"],
		purse_odds_one_in: 2,
		running_week: "20260921",
		running_starts_at: "2026-09-21T00:00:00Z",
		running_ends_at: "2026-09-28T00:00:00Z",
		running_balls: 3,
		running_cap: 21,
		running_odds_one_in: 3,
		next_turn_at: "2026-09-28T00:00:00Z",
		tiers: [
			{ tier: "common", amount: 25, weight: 50 },
			{ tier: "good", amount: 75, weight: 30 },
			{ tier: "rare", amount: 200, weight: 15 },
			{ tier: "jackpot", amount: 500, weight: 5 },
		],
	};

	it("prefers the server's numbers over the compiled ones", () => {
		const s = parseMondayDrawState(raw);
		expect(s.week).toBe("20260914");
		expect(s.eligible).toBe(true);
		expect(s.drawn).toBe(true);
		expect(s.amount).toBe(60);
		expect(s.tier).toBe("good");
		expect(s.balls).toBe(7);
		expect(s.cap).toBe(21);
		expect(s.rolls).toHaveLength(7);
		expect(s.purseOddsOneIn).toBe(2);
		expect(s.runningWeek).toBe("20260921");
		expect(s.runningBalls).toBe(3);
		expect(s.runningCap).toBe(21);
		expect(s.runningOddsOneIn).toBe(3);
		expect(s.nextTurnAt).toBe("2026-09-28T00:00:00Z");
		expect(s.tuning.tiers.map((t) => t.amount)).toEqual([25, 75, 200, 500]);
	});

	it("derives the odds itself when the server sends balls but no odds", () => {
		const rest: Record<string, unknown> = { ...raw };
		delete rest.purse_odds_one_in;
		delete rest.running_odds_one_in;
		delete rest.tiers;
		const s = parseMondayDrawState(rest);
		expect(s.tuning).toEqual(MONDAY_DRAW_TUNING);
		// 7 balls → 1 in 2; 3 running balls → 1 in 3.
		expect(s.purseOddsOneIn).toBe(2);
		expect(s.runningOddsOneIn).toBe(3);
	});

	it("keeps an undrawn week's rolls null and a ball-less week's odds null", () => {
		const s = parseMondayDrawState({ ...raw, drawn: false, amount: null, tier: null, rolls: null });
		expect(s.rolls).toBeNull();
		const none = parseMondayDrawState({ ...raw, eligible: false, balls: 0, purse_odds_one_in: null });
		expect(none.balls).toBe(0);
		expect(none.purseOddsOneIn).toBeNull();
	});

	it("ignores an unknown tier, a junk roll and a negative count", () => {
		const s = parseMondayDrawState({ ...raw, tier: "mythic", rolls: ["good", "mythic", 7], balls: -3 });
		expect(s.tier).toBeNull();
		expect(s.rolls).toEqual(["good"]);
		expect(s.balls).toBe(0);
	});

	it("rejects a half table rather than drawing tiles for three tiers", () => {
		const t = parseMondayDrawTuning({ tiers: raw.tiers.slice(0, 3) });
		expect(t.tiers).toEqual(MONDAY_DRAW_TUNING.tiers);
	});

	it("falls back to the compiled tuning when the server is quiet", () => {
		const s = parseMondayDrawState({});
		expect(s.tuning).toEqual(MONDAY_DRAW_TUNING);
		expect(s.week).toBe("");
		expect(s.eligible).toBe(false);
		expect(s.balls).toBe(0);
		expect(s.cap).toBe(0);
		expect(s.runningBalls).toBe(0);
		expect(s.nextTurnAt).toBeNull();
	});
});

describe("Monday drum — a stale (pre-drum) server still renders", () => {
	// The old payload: a streak, a warming odds line, a catch-up curve, and no
	// ball counts at all. Ship-before-migration must not blank the sheet.
	const old = {
		ok: true,
		week: "20260907",
		eligible: true,
		drawn: true,
		amount: 60,
		tier: "good",
		mondays_since_rare: 4,
		herd_bottom_half: false,
		next_rare_odds_one_in: 3,
		tiers: MONDAY_DRAW_TUNING.tiers,
		catchup: { after_mondays: 2, step: 0.5, cap: 3, bottom_half_step: 1 },
	};

	it("maps what exists and says what it cannot know", () => {
		const s = parseMondayDrawState(old);
		expect(s.week).toBe("20260907");
		expect(s.eligible).toBe(true);
		expect(s.drawn).toBe(true);
		expect(s.amount).toBe(60);
		expect(s.tier).toBe("good");
		// An eligible week held at least one ball; the cap is unknown, so 0 —
		// which is the copy's cue to drop the "of N" rather than invent one.
		expect(s.balls).toBe(1);
		expect(s.cap).toBe(0);
		expect(s.runningBalls).toBe(0);
		expect(s.runningCap).toBe(0);
		expect(s.rolls).toBeNull();
		expect(s.nextTurnAt).toBeNull();
		// Derived from the balls it could infer, never from the old streak.
		expect(s.purseOddsOneIn).toBe(8);
		expect(s.runningOddsOneIn).toBe(8);
		expect(s.runningWeek).toBe("20260907");
	});

	it("keeps a ball-less old week ball-less", () => {
		const s = parseMondayDrawState({ ...old, eligible: false, drawn: false, amount: null, tier: null });
		expect(s.balls).toBe(0);
		expect(s.purseOddsOneIn).toBeNull();
	});

	it("carries no trace of the retired catch-up machinery", () => {
		const s = parseMondayDrawState(old) as unknown as Record<string, unknown>;
		expect(s.mondaysSinceRare).toBeUndefined();
		expect(s.herdBottomHalf).toBeUndefined();
		expect(s.nextRareOddsOneIn).toBeUndefined();
		expect((s.tuning as Record<string, unknown>).catchup).toBeUndefined();
	});
});

// Leftovers (Season 2, The Feast): a Monday that pays below rare leaves one
// ball in the next week's drum. The server sends it beside the dug balls
// (`leftover_balls` / `running_leftover_balls`, 0 or 1), never inside them,
// and its odds already count it.
describe("Monday drum — Leftovers", () => {
	const base = {
		week: "20261116",
		eligible: true,
		drawn: false,
		balls: 7,
		cap: 21,
		running_week: "20261123",
		running_balls: 3,
		running_cap: 21,
	};

	it("reads 0 when the server says nothing (Season 1, or an older server)", () => {
		const s = parseMondayDrawState(base);
		expect(s.leftoverBalls).toBe(0);
		expect(s.runningLeftoverBalls).toBe(0);
		// No server odds: the client derives them from the dug balls alone.
		expect(s.purseOddsOneIn).toBe(oddsOneIn(7));
		expect(s.runningOddsOneIn).toBe(oddsOneIn(3));
	});

	it("keeps the leftover beside the balls, never inside them", () => {
		const s = parseMondayDrawState({ ...base, leftover_balls: 1, running_leftover_balls: 1 });
		expect(s.balls).toBe(7);
		expect(s.runningBalls).toBe(3);
		expect(s.leftoverBalls).toBe(1);
		expect(s.runningLeftoverBalls).toBe(1);
	});

	it("derives the odds off the sum when the server sends no odds", () => {
		// 1 running ball alone is 1 in 8; with the leftover it is a two-ball spin.
		const s = parseMondayDrawState({
			...base,
			balls: 1,
			running_balls: 1,
			leftover_balls: 1,
			running_leftover_balls: 1,
		});
		expect(s.purseOddsOneIn).toBe(oddsOneIn(2));
		expect(s.runningOddsOneIn).toBe(oddsOneIn(2));
		expect(oddsOneIn(2)).toBeLessThan(oddsOneIn(1));
	});

	it("prefers the server's odds, which already count the leftover", () => {
		const s = parseMondayDrawState({
			...base,
			leftover_balls: 1,
			running_leftover_balls: 1,
			purse_odds_one_in: 2,
			running_odds_one_in: 3,
		});
		expect(s.purseOddsOneIn).toBe(2);
		expect(s.runningOddsOneIn).toBe(3);
	});

	it("caps the leftover at one ball and shrugs off junk", () => {
		expect(parseMondayDrawState({ ...base, leftover_balls: 4 }).leftoverBalls).toBe(1);
		expect(parseMondayDrawState({ ...base, leftover_balls: -1 }).leftoverBalls).toBe(0);
		expect(parseMondayDrawState({ ...base, leftover_balls: "1" }).leftoverBalls).toBe(0);
		expect(parseMondayDrawState({ ...base, running_leftover_balls: null }).runningLeftoverBalls).toBe(0);
	});

	it("names the leftover in one suffix, and only when there is one", () => {
		expect(leftoverSuffix(0)).toBe("");
		expect(leftoverSuffix(1)).toBe(" (+1 leftover)");
		expect(leftoverSuffix(Number.NaN)).toBe("");
	});
});
