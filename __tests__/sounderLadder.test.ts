// Pure-logic tests for the Sounder League table + Spirit board ordering and
// the placard's fixture copy — extracted from app/clan-ladder.tsx and
// components/season1/LeaguePlacard.tsx into utils/mudWars.ts so the ranking
// contract (ribbons → wins → diff → name) and the fixture states are pinned.
//
// The Table sort MUST stay aligned with sounder_league_standings() in
// supabase/migrations/20260707000000_sounder_league.sql (server owns the
// authoritative order; this comparator only re-sorts the DEV-padded board).

jest.mock("../utils/supabase", () => ({ supabase: { rpc: jest.fn() } }));
jest.mock("../utils/log", () => ({ log: { error: jest.fn() } }));

import {
	leagueSort,
	spiritSort,
	padWithMocks,
	ordinal,
	leagueDaysLeft,
	leagueFixtureLine,
	type LeagueEntry,
	type SpiritEntry,
	type MyLeagueState,
} from "../utils/mudWars";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function league(over: Partial<LeagueEntry>): LeagueEntry {
	return {
		crew_id: over.crew_id ?? over.name ?? "c",
		name: "Crew",
		memberCount: 4,
		ribbons: 200,
		provisional: false,
		played: 4,
		wins: 2,
		losses: 2,
		diff: 0,
		members: [],
		...over,
	};
}

function spirit(over: Partial<SpiritEntry>): SpiritEntry {
	return {
		crew_id: over.crew_id ?? over.name ?? "c",
		name: "Crew",
		memberCount: 4,
		kindness: 0,
		activity: 0,
		spirit: 0,
		rating: null,
		wars: null,
		members: [],
		...over,
	};
}

// ── leagueSort — ribbons → wins → diff → name ────────────────────────────────

describe("leagueSort", () => {
	it("ranks by Prize Ribbons descending", () => {
		const rows = [
			league({ name: "Low", ribbons: 164 }),
			league({ name: "High", ribbons: 286 }),
			league({ name: "Mid", ribbons: 219 }),
		].sort(leagueSort);
		expect(rows.map((r) => r.name)).toEqual(["High", "Mid", "Low"]);
	});

	it("breaks a ribbon tie by wins, then mud diff, then name", () => {
		// Same ribbons → wins decides.
		const byWins = [
			league({ name: "Fewer", ribbons: 200, wins: 2 }),
			league({ name: "More", ribbons: 200, wins: 4 }),
		].sort(leagueSort);
		expect(byWins.map((r) => r.name)).toEqual(["More", "Fewer"]);

		// Same ribbons + wins → mud diff decides.
		const byDiff = [
			league({ name: "Worse", ribbons: 200, wins: 3, diff: -5 }),
			league({ name: "Better", ribbons: 200, wins: 3, diff: 9 }),
		].sort(leagueSort);
		expect(byDiff.map((r) => r.name)).toEqual(["Better", "Worse"]);

		// Fully tied → alphabetical, a stable last-resort key.
		const byName = [
			league({ name: "Bravo", ribbons: 200, wins: 3, diff: 4 }),
			league({ name: "Alpha", ribbons: 200, wins: 3, diff: 4 }),
		].sort(leagueSort);
		expect(byName.map((r) => r.name)).toEqual(["Alpha", "Bravo"]);
	});
});

// ── spiritSort — spirit → kindness ───────────────────────────────────────────

describe("spiritSort", () => {
	it("ranks by spirit descending, then kindness", () => {
		const rows = [
			spirit({ name: "B", spirit: 20, kindness: 10 }),
			spirit({ name: "A", spirit: 33, kindness: 42 }),
			spirit({ name: "TieHi", spirit: 20, kindness: 50 }),
		].sort(spiritSort);
		expect(rows.map((r) => r.name)).toEqual(["A", "TieHi", "B"]);
	});
});

// ── padWithMocks — DEV board padding ─────────────────────────────────────────

describe("padWithMocks", () => {
	const mocks = [
		league({ name: "Mud Maulers", ribbons: 286 }),
		league({ name: "Bog Standard", ribbons: 219 }),
	];

	it("appends mocks a sparse live board is missing, then sorts", () => {
		const live = [league({ name: "Live Crew", ribbons: 250 })];
		const out = padWithMocks(live, mocks, leagueSort);
		expect(out.map((r) => r.name)).toEqual([
			"Mud Maulers",
			"Live Crew",
			"Bog Standard",
		]);
	});

	it("never doubles a mock whose name a live crew already holds", () => {
		const live = [league({ name: "Mud Maulers", ribbons: 300 })];
		const out = padWithMocks(live, mocks, leagueSort);
		expect(out.filter((r) => r.name === "Mud Maulers")).toHaveLength(1);
		// The live crew (300) outranks the surviving mock.
		expect(out[0].name).toBe("Mud Maulers");
		expect(out[0].ribbons).toBe(300);
	});

	it("leaves an already-full live board untouched by the mocks", () => {
		const live = [
			league({ name: "Alpha", ribbons: 100 }),
			league({ name: "Beta", ribbons: 90 }),
		];
		const out = padWithMocks(live, [], leagueSort);
		expect(out.map((r) => r.name)).toEqual(["Alpha", "Beta"]);
	});
});

// ── ordinal ──────────────────────────────────────────────────────────────────

describe("ordinal", () => {
	it("suffixes 1/2/3 as st/nd/rd", () => {
		expect(ordinal(1)).toBe("1st");
		expect(ordinal(2)).toBe("2nd");
		expect(ordinal(3)).toBe("3rd");
		expect(ordinal(4)).toBe("4th");
	});
	it("uses th for the 11/12/13 exceptions", () => {
		expect(ordinal(11)).toBe("11th");
		expect(ordinal(12)).toBe("12th");
		expect(ordinal(13)).toBe("13th");
	});
	it("suffixes 21/22/23 by their last digit", () => {
		expect(ordinal(21)).toBe("21st");
		expect(ordinal(22)).toBe("22nd");
		expect(ordinal(23)).toBe("23rd");
	});
});

// ── leagueDaysLeft ───────────────────────────────────────────────────────────

describe("leagueDaysLeft", () => {
	const now = Date.UTC(2026, 6, 6, 12, 0, 0);
	const inDays = (n: number) => new Date(now + n * 86_400_000).toISOString();

	it("ceils to whole days remaining", () => {
		expect(leagueDaysLeft(inDays(2.4), now)).toBe(3);
		expect(leagueDaysLeft(inDays(0.5), now)).toBe(1);
	});
	it("floors a past-end term at zero (never negative)", () => {
		expect(leagueDaysLeft(inDays(-3), now)).toBe(0);
	});
});

// ── leagueFixtureLine — the placard's fixture status ─────────────────────────

describe("leagueFixtureLine", () => {
	const now = Date.UTC(2026, 6, 6, 12, 0, 0);
	const inDays = (n: number) => new Date(now + n * 86_400_000).toISOString();

	function fixtureState(
		fixture: MyLeagueState["fixture"],
		term: MyLeagueState["term"]
	): Pick<MyLeagueState, "fixture" | "term"> {
		return { fixture, term };
	}
	const term = { term_no: 3, starts_at: inDays(-2), ends_at: inDays(3) };
	const pending: MyLeagueState["fixture"] = {
		war_id: "w1",
		opponent: "Trough Loyalists",
		opponent_crew: "c2",
		is_bot: false,
		result: null,
		won: null,
	};

	it("live pairing reads the opponent + the term clock", () => {
		expect(leagueFixtureLine(fixtureState(pending, term), now)).toBe(
			"This term: vs Trough Loyalists · 3 days left"
		);
	});

	it("singularizes the last day of the term", () => {
		const oneLeft = { ...term, ends_at: inDays(0.5) };
		expect(leagueFixtureLine(fixtureState(pending, oneLeft), now)).toMatch(
			/· 1 day left$/
		);
	});

	it("names a nameless rival generically", () => {
		const anon = { ...pending, opponent: null };
		expect(leagueFixtureLine(fixtureState(anon, term), now)).toContain(
			"vs a rival Sounder"
		);
	});

	it("a settled win reads 'beat <rival>'", () => {
		const won = { ...pending, result: "a" as const, won: true };
		expect(leagueFixtureLine(fixtureState(won, term), now)).toBe(
			"This term: beat Trough Loyalists"
		);
	});

	it("a settled loss rallies toward next term", () => {
		const lost = { ...pending, result: "b" as const, won: false };
		expect(leagueFixtureLine(fixtureState(lost, term), now)).toMatch(
			/lost to Trough Loyalists — next term rallies soon$/
		);
	});

	it("no fixture reads the between-terms rest state", () => {
		expect(leagueFixtureLine(fixtureState(null, term), now)).toMatch(
			/No fixture this term/
		);
	});
});
