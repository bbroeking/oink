// The weekday ritual rotation (2026-09-14). The index is the ISO weekday of
// the UTC date — Mon=1 … Sun=7 — so these tests pin real calendar days: the
// rotation MUST agree with the SQL daily_blessing_kind / daily_curse_kind,
// which index the same arrays by EXTRACT(ISODOW FROM now() AT TIME ZONE 'UTC').
//
// The week of 2026-09-14 is a Monday-to-Sunday run, so it doubles as the
// seven-distinct-kinds sweep and as the named-day assertions.

import {
	isoWeekdayUTC,
	dailyBlessingKind,
	dailyCurseKind,
	dailyRitual,
	BLESSING_ROTATION,
	CURSE_ROTATION,
	BLESSING_META,
	CURSE_META,
	LEGACY_RITUAL_META,
	castBlurb,
} from "../utils/rituals";

// Monday 2026-09-14 through Sunday 2026-09-20.
const WEEK = [
	"2026-09-14",
	"2026-09-15",
	"2026-09-16",
	"2026-09-17",
	"2026-09-18",
	"2026-09-19",
	"2026-09-20",
] as const;

const at = (day: string, time = "T00:00:00Z") => new Date(`${day}${time}`);

describe("isoWeekdayUTC", () => {
	test("Monday is 1 and Sunday is 7", () => {
		expect(isoWeekdayUTC(at("2026-09-14"))).toBe(1);
		expect(isoWeekdayUTC(at("2026-09-20"))).toBe(7);
	});

	test("runs 1..7 across a Monday-first week", () => {
		expect(WEEK.map((d) => isoWeekdayUTC(at(d)))).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	test("reads the UTC date, not the local one", () => {
		// 23:59Z on Sunday is still Sunday however the runner's zone leans.
		expect(isoWeekdayUTC(at("2026-09-20", "T23:59:00Z"))).toBe(7);
		expect(isoWeekdayUTC(at("2026-09-21", "T00:00:00Z"))).toBe(1);
	});
});

describe("rotation tables", () => {
	test("each is seven long, Monday first", () => {
		expect(BLESSING_ROTATION).toHaveLength(7);
		expect(CURSE_ROTATION).toHaveLength(7);
		expect(BLESSING_ROTATION[0]).toBe("cloud_nine");
		expect(CURSE_ROTATION[0]).toBe("pickle_brine");
		expect(BLESSING_ROTATION[6]).toBe("sunday_best");
		expect(CURSE_ROTATION[6]).toBe("old_timey");
	});

	test("no kind repeats within a rotation", () => {
		expect(new Set(BLESSING_ROTATION).size).toBe(7);
		expect(new Set(CURSE_ROTATION).size).toBe(7);
	});
});

describe("dailyBlessingKind", () => {
	test("Monday 2026-09-14 is Cloud Nine", () => {
		expect(dailyBlessingKind(at("2026-09-14"))).toBe("cloud_nine");
	});

	test("Sunday 2026-09-20 is Sunday Best (the index-7 wrap)", () => {
		expect(dailyBlessingKind(at("2026-09-20"))).toBe("sunday_best");
	});

	test("seven consecutive UTC days hit seven distinct kinds", () => {
		const kinds = WEEK.map((d) => dailyBlessingKind(at(d)));
		expect(new Set(kinds).size).toBe(7);
		expect(kinds).toEqual(BLESSING_ROTATION);
	});

	test("the same weekday next week is the same kind", () => {
		expect(dailyBlessingKind(at("2026-09-21"))).toBe(
			dailyBlessingKind(at("2026-09-14"))
		);
	});

	test("always returns a kind present in BLESSING_META", () => {
		for (let d = 1; d <= 28; d++) {
			const k = dailyBlessingKind(
				at(`2026-01-${String(d).padStart(2, "0")}`)
			);
			expect(BLESSING_META[k]).toBeDefined();
		}
	});
});

describe("dailyCurseKind", () => {
	test("Monday 2026-09-14 is Pickle Brine", () => {
		expect(dailyCurseKind(at("2026-09-14"))).toBe("pickle_brine");
	});

	test("Sunday 2026-09-20 is Old-Timey Pig", () => {
		expect(dailyCurseKind(at("2026-09-20"))).toBe("old_timey");
	});

	test("seven consecutive UTC days hit seven distinct kinds", () => {
		const kinds = WEEK.map((d) => dailyCurseKind(at(d)));
		expect(new Set(kinds).size).toBe(7);
		expect(kinds).toEqual(CURSE_ROTATION);
	});

	test("uses the same weekday index as blessings (parallel rotation)", () => {
		const d = at("2026-03-18"); // a Wednesday
		const idx = isoWeekdayUTC(d) - 1;
		expect(dailyCurseKind(d)).toBe(CURSE_ROTATION[idx]);
		expect(dailyBlessingKind(d)).toBe(BLESSING_ROTATION[idx]);
	});

	test("always returns a kind present in CURSE_META", () => {
		for (let d = 1; d <= 28; d++) {
			const k = dailyCurseKind(at(`2026-02-${String(d).padStart(2, "0")}`));
			expect(CURSE_META[k]).toBeDefined();
		}
	});
});

describe("dailyRitual", () => {
	test("bless mode returns blessing kind + its metadata", () => {
		const d = at("2026-09-18"); // Friday
		const r = dailyRitual("bless", d);
		expect(r.kind).toBe("golden_hour");
		expect(r.name).toBe("Golden Hour");
		expect(r.icon).toBeTruthy();
		expect(r.blurb).toBeTruthy();
	});

	test("curse mode returns curse kind + its metadata", () => {
		const d = at("2026-09-18"); // Friday — "Bacon Friday"
		const r = dailyRitual("curse", d);
		expect(r.kind).toBe("bacon_bits");
		expect(r.name).toBe("Bacon Bits");
	});
});

describe("LEGACY_RITUAL_META", () => {
	test("keeps the retired S0 + S1 kinds nameable", () => {
		for (const kind of [
			"warm_tea",
			"sun_beam",
			"halo_kiss",
			"bountiful_snouts",
			"mud_wrap",
			"glimmer_truffle",
			"snoot_boop",
			"trough_bounty",
			"sluggish_snout",
			"phantom_itch",
			"goblin_whisper",
			"coin_pinch",
		]) {
			expect(LEGACY_RITUAL_META[kind]?.name).toBeTruthy();
			expect(LEGACY_RITUAL_META[kind]?.icon).toBeTruthy();
		}
	});

	test("no retired kind leaks back into a rotation", () => {
		for (const kind of Object.keys(LEGACY_RITUAL_META)) {
			expect(BLESSING_ROTATION).not.toContain(kind);
			expect(CURSE_ROTATION).not.toContain(kind);
		}
	});
});

describe("castBlurb", () => {
	// A blurb speaks to the wearer; the Friends list speaks to the caster about
	// a friend. Only the pig's owner changes hands.
	test("turns the wearer's pig into the friend's, keeping case", () => {
		expect(castBlurb("Your pig floats an inch off the mud on a tiny cloud.")).toBe(
			"Their pig floats an inch off the mud on a tiny cloud."
		);
		expect(castBlurb("Soap bubbles drift up around your pig.")).toBe(
			"Soap bubbles drift up around their pig."
		);
		expect(castBlurb("A butterfly rides on your pig's head all day.")).toBe(
			"A butterfly rides on their pig's head all day."
		);
	});

	test("leaves a blurb with no owner alone", () => {
		expect(castBlurb("Every tickle pops confetti.")).toBe("Every tickle pops confetti.");
		expect(castBlurb("The Barn dims to dusk and fireflies wander.")).toBe(
			"The Barn dims to dusk and fireflies wander."
		);
	});

	test("no weekday blurb still addresses the wearer once turned", () => {
		// The rotations only: the system-granted glows (Chorus, Winner's) never
		// pass through a ritual door, so they keep speaking to the wearer.
		for (const kind of BLESSING_ROTATION) {
			expect(castBlurb(BLESSING_META[kind].blurb)).not.toMatch(/\byour\b/i);
		}
		for (const kind of CURSE_ROTATION) {
			expect(castBlurb(CURSE_META[kind].blurb)).not.toMatch(/\byour\b/i);
		}
	});
});
