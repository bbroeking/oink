// Pure-logic tests for the global-race helpers (utils/race): the score label,
// the cycle math (weekly Monday 00:00 UTC anchor, 7-day cycle, key format), the
// pinned-row standings selectors (weekly + cumulative season), and the defensive
// jsonb parser. The server owns the authoritative shape (migration 20260719000000);
// these are mirrors.

// utils/race imports the rpc → supabase chain (AsyncStorage native module); stub
// it the same way the milestoneProgress / hungerMeter tests do — these tests
// only touch the pure helpers + parsers.
jest.mock("../utils/supabase", () => ({ supabase: { rpc: jest.fn() } }));
jest.mock("../utils/log", () => ({
	log: { error: jest.fn(), warn: jest.fn() },
}));

import {
	RaceStandings,
	SeasonStanding,
	allSeasonRows,
	allWeeklyRows,
	cycleEndWeekday,
	formatRaceCountdown,
	parseRaceCrewDetail,
	parseRaceHistory,
	parseRaceStandings,
	perSnoutLabel,
	pinNeeded,
	raceCycle,
	raceSpoilsForRank,
	standingsRows,
	standingsRowsSeason,
} from "../utils/race";

// A UTC timestamp for a given Y-M-D H (month is 1-based here for readability).
const utc = (y: number, m: number, d: number, h = 0) =>
	Date.UTC(y, m - 1, d, h, 0, 0, 0);

describe("perSnoutLabel", () => {
	it("prints whole numbers without a decimal", () => {
		expect(perSnoutLabel(8)).toBe("8");
		expect(perSnoutLabel(0)).toBe("0");
	});
	it("keeps one decimal place, rounding", () => {
		expect(perSnoutLabel(8.5)).toBe("8.5");
		expect(perSnoutLabel(8.33)).toBe("8.3");
		expect(perSnoutLabel(8.37)).toBe("8.4");
	});
	it("floors negatives and junk to 0", () => {
		expect(perSnoutLabel(-3)).toBe("0");
		expect(perSnoutLabel(NaN)).toBe("0");
		expect(perSnoutLabel(Infinity)).toBe("0");
	});
});

describe("raceSpoilsForRank — projected weekly payout", () => {
	const prizes = parseRaceStandings({}).prizes;

	it("uses the jackpot-scale tickle ladder without inflating Golden Truffles", () => {
		expect(raceSpoilsForRank(prizes, 1, 8)).toEqual({
			tickles: 500,
			truffles: 6,
		});
		expect(raceSpoilsForRank(prizes, 2, 8)).toEqual({
			tickles: 300,
			truffles: 5,
		});
		expect(raceSpoilsForRank(prizes, 3, 8)).toEqual({
			tickles: 200,
			truffles: 4,
		});
	});

	it("distinguishes the top half from the rest of the field", () => {
		expect(raceSpoilsForRank(prizes, 4, 8)).toEqual({
			tickles: 100,
			truffles: 3,
		});
		expect(raceSpoilsForRank(prizes, 5, 8)).toEqual({
			tickles: 50,
			truffles: 2,
		});
	});
});

describe("raceCycle", () => {
	// 2026-07-06 is a MONDAY; 2026-07-13 is the next MONDAY.
	it("a Monday start opens a 7-day race that ends the next Monday", () => {
		const c = raceCycle(utc(2026, 7, 6, 10)); // Mon 10:00 UTC
		expect(c.key).toBe("20260706");
		expect(c.startsAtMs).toBe(utc(2026, 7, 6));
		expect(c.endsAtMs).toBe(utc(2026, 7, 13)); // Mon 00:00
		expect((c.endsAtMs - c.startsAtMs) / 86_400_000).toBe(7);
	});
	it("exactly at the Monday bell belongs to the new cycle", () => {
		const c = raceCycle(utc(2026, 7, 6, 0));
		expect(c.key).toBe("20260706");
		expect(c.endsAtMs).toBe(utc(2026, 7, 13));
	});
	it("every mid-week day resolves back to the Monday anchor", () => {
		expect(raceCycle(utc(2026, 7, 7, 12)).key).toBe("20260706"); // Tue
		expect(raceCycle(utc(2026, 7, 8, 23)).key).toBe("20260706"); // Wed 23:00
		expect(raceCycle(utc(2026, 7, 9, 1)).key).toBe("20260706"); // Thu
		expect(raceCycle(utc(2026, 7, 10, 6)).key).toBe("20260706"); // Fri
		expect(raceCycle(utc(2026, 7, 11, 6)).key).toBe("20260706"); // Sat
		expect(raceCycle(utc(2026, 7, 12, 23)).key).toBe("20260706"); // Sun 23:00
	});
	it("keeps a zero-padded YYYYMMDD key across a month boundary", () => {
		// 2026-02-02 is a Monday; ends the next Monday 2026-02-09.
		const c = raceCycle(utc(2026, 2, 3, 5)); // Tue 2026-02-03
		expect(c.key).toBe("20260202");
		expect(c.endsAtMs).toBe(utc(2026, 2, 9));
	});
});

describe("cycleEndWeekday", () => {
	it("always names Monday now that cycles are weekly", () => {
		expect(cycleEndWeekday(utc(2026, 7, 13))).toBe("Monday");
		expect(cycleEndWeekday(utc(2026, 7, 20))).toBe("Monday");
	});
});

describe("formatRaceCountdown", () => {
	const now = 1_000_000_000_000;
	it("shows whole hours while more than an hour remains", () => {
		expect(formatRaceCountdown(now + 7 * 3600_000, now)).toBe("7h");
		expect(formatRaceCountdown(now + 23 * 3600_000 + 59 * 60_000, now)).toBe(
			"23h",
		);
	});
	it("drops to minutes under an hour", () => {
		expect(formatRaceCountdown(now + 45 * 60_000, now)).toBe("45m");
		expect(formatRaceCountdown(now + 30_000, now)).toBe("1m");
	});
	it("reads the bell as 'any moment' at/after the end", () => {
		expect(formatRaceCountdown(now, now)).toBe("any moment");
		expect(formatRaceCountdown(now - 5000, now)).toBe("any moment");
	});
	it("accepts ISO strings and returns '' for null/garbage", () => {
		expect(
			formatRaceCountdown(new Date(now + 3600_000).toISOString(), now),
		).toBe("1h");
		expect(formatRaceCountdown(null, now)).toBe("");
		expect(formatRaceCountdown("not-a-date", now)).toBe("");
	});
});

// ── Standings fixtures ────────────────────────────────────────────────────────
const rankedRow = (
	rank: number,
	crew_id: string,
	name: string,
	avg: number,
) => ({
	rank,
	crew_id,
	name,
	avg,
	diggers: 3,
	total_finds: rank * 10,
	roster_size: 4,
});
const unrankedRow = (crew_id: string, name: string, avg: number) => ({
	crew_id,
	name,
	avg,
	diggers: 1,
	total_finds: 4,
	roster_size: 3,
});

function buildStandings(over: Partial<RaceStandings> = {}): RaceStandings {
	return parseRaceStandings({
		cycle: { key: "20260706", starts_at: "", ends_at: "" },
		ranked: [
			rankedRow(1, "c1", "Alpha", 9),
			rankedRow(2, "c2", "Bravo", 8),
			rankedRow(3, "c3", "Charlie", 7),
			rankedRow(4, "c4", "Delta", 6),
			rankedRow(5, "c5", "Echo", 5),
			rankedRow(6, "c6", "Foxtrot", 4),
			rankedRow(7, "c7", "Golf", 3),
		],
		unranked: [
			unrankedRow("u1", "Quiet Herd", 2),
			unrankedRow("u2", "Lone Snout", 1),
		],
		mine: null,
		last: null,
		...over,
	});
}

describe("standingsRows — the pinned-row selector", () => {
	it("crewless: top `visible` ranked rows, none highlighted, no pin", () => {
		const v = standingsRows(buildStandings(), null, 5);
		expect(v.rows).toHaveLength(5);
		expect(v.rows.every((r) => r.kind === "ranked" && !r.highlighted)).toBe(
			true,
		);
		expect(v.rows.some((r) => r.kind === "separator")).toBe(false);
		// Unranked still surfaced (grayed section), never highlighted for crewless.
		expect(v.unranked).toHaveLength(2);
		expect(
			v.unranked.every((r) => r.kind === "unranked" && !r.highlighted),
		).toBe(true);
	});

	it("my crew ranked WITHIN the top: highlighted in place, no separator", () => {
		const v = standingsRows(buildStandings(), "c2", 5);
		expect(v.rows).toHaveLength(5);
		const mine = v.rows.find((r) => r.kind === "ranked" && r.crew_id === "c2");
		expect(mine && mine.kind === "ranked" && mine.highlighted).toBe(true);
		expect(v.rows.some((r) => r.kind === "separator")).toBe(false);
	});

	it("my crew ranked BELOW the top: separator + pinned true-rank row appended", () => {
		const v = standingsRows(
			buildStandings({
				mine: { crew_id: "c7", rank: 7, avg: 3, diggers: 3, total_finds: 70 },
			}),
			"c7",
			5,
		);
		// 5 visible + separator + pinned mine = 7 items.
		expect(v.rows).toHaveLength(7);
		expect(v.rows[5].kind).toBe("separator");
		const pin = v.rows[6];
		expect(pin.kind === "ranked" && pin.rank).toBe(7);
		expect(pin.kind === "ranked" && pin.crew_id).toBe("c7");
		expect(pin.kind === "ranked" && pin.highlighted).toBe(true);
		expect(pin.kind === "ranked" && pin.name).toBe("Golf");
	});

	it("pins from `mine` when my ranked row was truncated out of the array", () => {
		const s = buildStandings({
			ranked: [rankedRow(1, "c1", "Alpha", 9), rankedRow(2, "c2", "Bravo", 8)],
			mine: { crew_id: "cX", rank: 14, avg: 2.5, diggers: 2, total_finds: 20 },
		} as Partial<RaceStandings>);
		const v = standingsRows(s, "cX", 5);
		const sepIdx = v.rows.findIndex((r) => r.kind === "separator");
		expect(sepIdx).toBeGreaterThanOrEqual(0);
		const pin = v.rows[sepIdx + 1];
		expect(pin.kind === "ranked" && pin.rank).toBe(14);
		expect(pin.kind === "ranked" && pin.highlighted).toBe(true);
		expect(pin.kind === "ranked" && pin.name).toBe("Your Sounder");
	});

	it("my crew UNRANKED (sub-quorum): highlighted in the grayed section, no pin", () => {
		const v = standingsRows(
			buildStandings({
				mine: { crew_id: "u2", rank: null, avg: 1, diggers: 1, total_finds: 4 },
			}),
			"u2",
			5,
		);
		expect(v.rows.some((r) => r.kind === "separator")).toBe(false);
		expect(v.rows.every((r) => !(r.kind === "ranked" && r.highlighted))).toBe(
			true,
		);
		const mineUnranked = v.unranked.find(
			(r) => r.kind === "unranked" && r.crew_id === "u2",
		);
		expect(
			mineUnranked &&
				mineUnranked.kind === "unranked" &&
				mineUnranked.highlighted,
		).toBe(true);
	});

	it("fewer ranked than `visible`: shows them all, no separator", () => {
		const s = buildStandings({
			ranked: [rankedRow(1, "c1", "Solo", 5)],
		} as Partial<RaceStandings>);
		const v = standingsRows(s, "c9", 5);
		expect(v.rows).toHaveLength(1);
		expect(v.rows.some((r) => r.kind === "separator")).toBe(false);
	});

	it("handles ties (equal avg, distinct server ranks) without reordering", () => {
		const s = buildStandings({
			ranked: [
				rankedRow(1, "c1", "Alpha", 7),
				rankedRow(2, "c2", "Bravo", 7), // tie on avg, rank breaks it
				rankedRow(3, "c3", "Charlie", 7),
			],
		} as Partial<RaceStandings>);
		const v = standingsRows(s, null, 5);
		expect(v.rows.map((r) => (r.kind === "ranked" ? r.rank : -1))).toEqual([
			1, 2, 3,
		]);
	});
});

// ── Season board fixtures ──────────────────────────────────────────────────────
const seasonRow = (
	rank: number,
	crew_id: string,
	name: string,
	total_finds: number,
): SeasonStanding => ({
	rank,
	crew_id,
	name,
	total_finds,
	diggers: 3,
	roster_size: 4,
});

const SEASON: SeasonStanding[] = [
	seasonRow(1, "c1", "Alpha", 900),
	seasonRow(2, "c2", "Bravo", 800),
	seasonRow(3, "c3", "Charlie", 700),
	seasonRow(4, "c4", "Delta", 600),
	seasonRow(5, "c5", "Echo", 500),
	seasonRow(6, "c6", "Foxtrot", 400),
	seasonRow(7, "c7", "Golf", 300),
];

describe("standingsRowsSeason — the cumulative board selector", () => {
	it("crewless: top `visible` rows, none highlighted, no separator", () => {
		const rows = standingsRowsSeason(SEASON, null, null, 5);
		expect(rows).toHaveLength(5);
		expect(rows.every((r) => r.kind === "ranked" && !r.highlighted)).toBe(true);
		expect(rows.some((r) => r.kind === "separator")).toBe(false);
	});

	it("my crew WITHIN the top: highlighted in place, no separator", () => {
		const rows = standingsRowsSeason(
			SEASON,
			{ rank: 2, total_finds: 800 },
			"c2",
			5,
		);
		expect(rows).toHaveLength(5);
		const mine = rows.find((r) => r.kind === "ranked" && r.crew_id === "c2");
		expect(mine && mine.kind === "ranked" && mine.highlighted).toBe(true);
		expect(rows.some((r) => r.kind === "separator")).toBe(false);
	});

	it("my crew BELOW the top: separator + pinned true-rank row appended", () => {
		const rows = standingsRowsSeason(
			SEASON,
			{ rank: 7, total_finds: 300 },
			"c7",
			5,
		);
		expect(rows).toHaveLength(7); // 5 visible + separator + pinned
		expect(rows[5].kind).toBe("separator");
		const pin = rows[6];
		expect(pin.kind === "ranked" && pin.rank).toBe(7);
		expect(pin.kind === "ranked" && pin.crew_id).toBe("c7");
		expect(pin.kind === "ranked" && pin.highlighted).toBe(true);
		expect(pin.kind === "ranked" && pin.name).toBe("Golf");
	});

	it("pins from `mineSeason` when my row was truncated out of the array", () => {
		const rows = standingsRowsSeason(
			SEASON,
			{ rank: 21, total_finds: 42 },
			"cX",
			5,
		);
		const sepIdx = rows.findIndex((r) => r.kind === "separator");
		expect(sepIdx).toBeGreaterThanOrEqual(0);
		const pin = rows[sepIdx + 1];
		expect(pin.kind === "ranked" && pin.rank).toBe(21);
		expect(pin.kind === "ranked" && pin.total_finds).toBe(42);
		expect(pin.kind === "ranked" && pin.highlighted).toBe(true);
		expect(pin.kind === "ranked" && pin.name).toBe("Your Sounder");
	});

	it("no pin when my crew has no season line yet (mineSeason null)", () => {
		const rows = standingsRowsSeason(SEASON, null, "cX", 5);
		expect(rows).toHaveLength(5);
		expect(rows.some((r) => r.kind === "separator")).toBe(false);
	});

	it("fewer rows than `visible`: shows them all, no separator", () => {
		const rows = standingsRowsSeason(
			[seasonRow(1, "c1", "Solo", 5)],
			null,
			"c9",
			5,
		);
		expect(rows).toHaveLength(1);
		expect(rows.some((r) => r.kind === "separator")).toBe(false);
	});
});

// ── The full-field selectors — every row, flat, mine flagged ───────────────────
describe("allSeasonRows — the full cumulative field", () => {
	it("maps every season row in order as ranked, no separators", () => {
		const rows = allSeasonRows(SEASON, null);
		expect(rows).toHaveLength(SEASON.length);
		expect(rows.every((r) => r.kind === "ranked")).toBe(true);
		expect(rows.some((r) => r.kind === "separator")).toBe(false);
		expect(rows.map((r) => (r.kind === "ranked" ? r.crew_id : ""))).toEqual(
			SEASON.map((s) => s.crew_id),
		);
	});

	it("flags only my crew highlighted", () => {
		const rows = allSeasonRows(SEASON, "c4");
		const mine = rows.filter((r) => r.kind === "ranked" && r.highlighted);
		expect(mine).toHaveLength(1);
		expect(mine[0].kind === "ranked" && mine[0].crew_id).toBe("c4");
	});

	it("highlights nothing when crewless", () => {
		const rows = allSeasonRows(SEASON, null);
		expect(rows.some((r) => r.kind === "ranked" && r.highlighted)).toBe(false);
	});

	it("empty input → []", () => {
		expect(allSeasonRows([], "c1")).toEqual([]);
	});
});

describe("allWeeklyRows — the full weekly field", () => {
	it("all ranked in order, then all unranked, mine flagged", () => {
		const rows = allWeeklyRows(buildStandings(), "c2");
		// 7 ranked + 2 unranked in the fixture.
		expect(rows).toHaveLength(9);
		expect(rows.slice(0, 7).every((r) => r.kind === "ranked")).toBe(true);
		expect(rows.slice(7).every((r) => r.kind === "unranked")).toBe(true);
		expect(rows.some((r) => r.kind === "separator")).toBe(false);
		const mine = rows.filter((r) => r.kind !== "separator" && r.highlighted);
		expect(mine).toHaveLength(1);
		expect(mine[0].kind !== "separator" && mine[0].crew_id).toBe("c2");
	});

	it("flags an unranked crew when it's mine", () => {
		const rows = allWeeklyRows(buildStandings(), "u2");
		const mine = rows.filter((r) => r.kind !== "separator" && r.highlighted);
		expect(mine).toHaveLength(1);
		expect(mine[0].kind).toBe("unranked");
		expect(mine[0].kind !== "separator" && mine[0].crew_id).toBe("u2");
	});

	it("highlights nothing when crewless", () => {
		const rows = allWeeklyRows(buildStandings(), null);
		expect(rows.some((r) => r.kind !== "separator" && r.highlighted)).toBe(
			false,
		);
	});

	it("empty input → []", () => {
		const empty = buildStandings({
			ranked: [],
			unranked: [],
		} as Partial<RaceStandings>);
		expect(allWeeklyRows(empty, "c1")).toEqual([]);
	});
});

describe("pinNeeded — the sticky my-Sounder pin rule", () => {
	const rows = allSeasonRows(SEASON, "c4"); // my crew is c4 (rank 4)

	it("no pin when crewless", () => {
		expect(pinNeeded(allSeasonRows(SEASON, null), 25, null)).toBe(false);
	});

	it("no pin when my row is within the revealed slice (highlight in place)", () => {
		// c4 is at index 3 — a first page of 25 reveals it.
		expect(pinNeeded(rows, 25, "c4")).toBe(false);
	});

	it("pins when paging hasn't reached my row yet", () => {
		// Only 3 rows shown; c4 sits at index 3 (rank 4) → still out of sight.
		expect(pinNeeded(rows, 3, "c4")).toBe(true);
	});

	it("reveals exactly my row at the slice boundary → no pin", () => {
		// shown=4 reveals indices 0..3, so c4 (index 3) is just in sight.
		expect(pinNeeded(rows, 4, "c4")).toBe(false);
		expect(pinNeeded(rows, 3, "c4")).toBe(true);
	});

	it("pins when my crew has no row in the field at all (crewless-but-id / sub-quorum)", () => {
		// myCrewId set but absent from the rows → nothing to highlight → pin.
		expect(pinNeeded(rows, 999, "cX")).toBe(true);
	});

	it("ignores separator rows when scanning the slice", () => {
		const withSep = [
			{ kind: "separator" as const },
			{ kind: "ranked" as const, crew_id: "c4" },
		];
		expect(pinNeeded(withSep, 2, "c4")).toBe(false);
		// Separator counts toward `shown` but never satisfies the match itself.
		expect(pinNeeded(withSep, 1, "c4")).toBe(true);
	});

	it("weekly: pins an unranked (sub-quorum) crew until its grayed row is revealed", () => {
		const weekly = allWeeklyRows(buildStandings(), "u2"); // 7 ranked + [u1,u2]
		// u2 is the last row (index 8) — a short slice leaves it out of sight.
		expect(pinNeeded(weekly, 5, "u2")).toBe(true);
		expect(pinNeeded(weekly, 9, "u2")).toBe(false);
	});
});

describe("parseRaceStandings — defensive jsonb", () => {
	it("normalizes an empty/absent payload", () => {
		const s = parseRaceStandings({});
		expect(s.season).toEqual([]);
		expect(s.mineSeason).toBeNull();
		expect(s.ranked).toEqual([]);
		expect(s.unranked).toEqual([]);
		expect(s.mine).toBeNull();
		expect(s.last).toBeNull();
		expect(s.cycle).toEqual({ key: "", starts_at: "", ends_at: "" });
	});

	it("parses the cumulative season board + my season line", () => {
		const s = parseRaceStandings({
			season: [
				{
					rank: "1",
					crew_id: "c1",
					name: "Alpha",
					total_finds: "900",
					diggers: "3",
					roster_size: "4",
				},
				{
					rank: 2,
					crew_id: "c2",
					total_finds: 800,
					diggers: 2,
					roster_size: 3,
				},
			],
			mine_season: { rank: "2", total_finds: "800" },
		});
		expect(s.season[0]).toEqual({
			rank: 1,
			crew_id: "c1",
			name: "Alpha",
			total_finds: 900,
			diggers: 3,
			roster_size: 4,
		});
		expect(s.season[1].name).toBe("a Sounder");
		expect(s.mineSeason).toEqual({ rank: 2, total_finds: 800 });
	});

	it("drops an empty mine_season (no rank, no finds)", () => {
		expect(
			parseRaceStandings({ mine_season: { rank: 0, total_finds: 0 } })
				.mineSeason,
		).toBeNull();
		expect(parseRaceStandings({ mine_season: null }).mineSeason).toBeNull();
	});
	it("coerces loose numeric fields + fills name defaults", () => {
		const s = parseRaceStandings({
			cycle: { key: "20260706", starts_at: "a", ends_at: "b" },
			ranked: [
				{
					rank: "2",
					crew_id: "c1",
					avg: "8.5",
					diggers: "3",
					total_finds: "24",
					roster_size: "4",
				},
			],
			unranked: [{ crew_id: "u1" }],
			mine: { crew_id: "c1", rank: "2", avg: 8.5, diggers: 3, total_finds: 24 },
			last: {
				cycle_key: "20260702",
				rank: 3,
				of: 12,
				truffles_paid: 4,
				cosmetic_hat_id: "mud_derby_bg",
			},
		});
		expect(s.ranked[0]).toEqual({
			rank: 2,
			crew_id: "c1",
			name: "a Sounder",
			avg: 8.5,
			diggers: 3,
			total_finds: 24,
			roster_size: 4,
		});
		expect(s.unranked[0].name).toBe("a Sounder");
		expect(s.mine).toEqual({
			crew_id: "c1",
			rank: 2,
			avg: 8.5,
			diggers: 3,
			total_finds: 24,
		});
		expect(s.last).toEqual({
			cycle_key: "20260702",
			rank: 3,
			of: 12,
			truffles_paid: 4,
			tickles_paid: 0,
			cosmetic_hat_id: "mud_derby_bg",
		});
	});
	it("treats a null/zero `mine.rank` as unranked (rank null)", () => {
		const s = parseRaceStandings({
			mine: { crew_id: "c1", rank: null, avg: 1, diggers: 1, total_finds: 2 },
		});
		expect(s.mine && s.mine.rank).toBeNull();
	});
	it("drops a `mine` with no crew_id and a `last` with no cycle_key", () => {
		expect(parseRaceStandings({ mine: { rank: 3 } }).mine).toBeNull();
		expect(parseRaceStandings({ last: { rank: 3, of: 12 } }).last).toBeNull();
	});
	it("defaults a missing cosmetic to null", () => {
		const s = parseRaceStandings({
			last: { cycle_key: "20260702", rank: 1, of: 8, truffles_paid: 6 },
		});
		expect(s.last && s.last.cosmetic_hat_id).toBeNull();
	});
});

describe("parseRaceHistory — settled weekly tables", () => {
	it("parses newest-first weekly rows and keeps sub-quorum Sounders visible", () => {
		const weeks = parseRaceHistory([
			{
				cycle: {
					key: "20260713",
					starts_at: "2026-07-13T00:00:00Z",
					ends_at: "2026-07-20T00:00:00Z",
				},
				ranked: [rankedRow(1, "c1", "Alpha", 9)],
				unranked: [unrankedRow("u1", "Lone Snout", 3)],
			},
		]);
		expect(weeks).toHaveLength(1);
		expect(weeks[0].cycle.key).toBe("20260713");
		expect(weeks[0].ranked[0].name).toBe("Alpha");
		expect(weeks[0].unranked[0].name).toBe("Lone Snout");
	});

	it("drops malformed weeks and safely defaults missing row arrays", () => {
		expect(parseRaceHistory(null)).toEqual([]);
		expect(
			parseRaceHistory([{ cycle: {} }, { cycle: { key: "20260706" } }]),
		).toEqual([
			{
				cycle: { key: "20260706", starts_at: "", ends_at: "" },
				ranked: [],
				unranked: [],
			},
		]);
	});
});

describe("parseRaceCrewDetail — the per-crew member ledger", () => {
	it("parses a crew with its ordered member lines", () => {
		const d = parseRaceCrewDetail({
			cycle_key: "20260706",
			crew_id: "c1",
			name: "Alpha",
			members: [
				{ user_id: "u1", username: "Rosie", finds: "12", season_finds: "40" },
				{ user_id: "u2", username: "Pib", finds: 5, season_finds: 22 },
			],
		});
		expect(d).toEqual({
			cycle_key: "20260706",
			crew_id: "c1",
			name: "Alpha",
			members: [
				{
					user_id: "u1",
					username: "Rosie",
					departed: false,
					finds: 12,
					season_finds: 40,
				},
				{
					user_id: "u2",
					username: "Pib",
					departed: false,
					finds: 5,
					season_finds: 22,
				},
			],
		});
	});

	it("drops member entries with no user_id", () => {
		const d = parseRaceCrewDetail({
			crew_id: "c1",
			members: [
				{ username: "ghost", finds: 3, season_finds: 3 },
				{ user_id: "u2", username: "Pib", finds: 5, season_finds: 22 },
			],
		});
		expect(d?.members).toHaveLength(1);
		expect(d?.members[0].user_id).toBe("u2");
	});

	it("defaults a missing username to 'a pig' and non-negs the counts", () => {
		const d = parseRaceCrewDetail({
			crew_id: "c1",
			members: [{ user_id: "u1", finds: -4 }],
		});
		expect(d?.members[0]).toEqual({
			user_id: "u1",
			username: "a pig",
			departed: false,
			finds: 0,
			season_finds: 0,
		});
	});

	it("defaults a missing name/cycle_key and an absent members array", () => {
		const d = parseRaceCrewDetail({ crew_id: "c1" });
		expect(d).toEqual({
			cycle_key: "",
			crew_id: "c1",
			name: "a Sounder",
			members: [],
		});
	});

	it("returns null for an unknown crew (no crew_id), null, or garbage", () => {
		expect(parseRaceCrewDetail({ members: [] })).toBeNull();
		expect(parseRaceCrewDetail(null)).toBeNull();
		expect(parseRaceCrewDetail(undefined)).toBeNull();
		expect(parseRaceCrewDetail("nope")).toBeNull();
		expect(parseRaceCrewDetail(42)).toBeNull();
	});
});
