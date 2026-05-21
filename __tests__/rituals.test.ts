// Daily blessing/curse rotation logic. The rotation index is
// (dayOfYearUTC % 4). These tests pin specific UTC dates so a
// regression in the day-of-year math is caught — the rotation
// MUST agree with the SQL EXTRACT(DOY FROM ...) % 4.

import {
	dayOfYearUTC,
	dailyBlessingKind,
	dailyCurseKind,
	dailyRitual,
	BLESSING_ROTATION,
	CURSE_ROTATION,
	BLESSING_META,
	CURSE_META,
} from "../utils/rituals";

describe("dayOfYearUTC", () => {
	test("Jan 1 is day 1", () => {
		expect(dayOfYearUTC(new Date("2026-01-01T12:00:00Z"))).toBe(1);
	});

	test("Jan 4 is day 4", () => {
		expect(dayOfYearUTC(new Date("2026-01-04T00:00:00Z"))).toBe(4);
	});

	test("Feb 1 is day 32", () => {
		expect(dayOfYearUTC(new Date("2026-02-01T23:59:00Z"))).toBe(32);
	});

	test("Dec 31 (non-leap 2026) is day 365", () => {
		expect(dayOfYearUTC(new Date("2026-12-31T00:00:00Z"))).toBe(365);
	});
});

describe("dailyBlessingKind", () => {
	test("rotation index is dayOfYear % 4", () => {
		// Jan 1 → DOY 1 → index 1
		expect(dailyBlessingKind(new Date("2026-01-01T00:00:00Z"))).toBe(
			BLESSING_ROTATION[1]
		);
		// Jan 4 → DOY 4 → index 0
		expect(dailyBlessingKind(new Date("2026-01-04T00:00:00Z"))).toBe(
			BLESSING_ROTATION[0]
		);
	});

	test("four consecutive days hit four distinct kinds", () => {
		const kinds = [3, 4, 5, 6].map((d) =>
			dailyBlessingKind(new Date(`2026-01-0${d}T00:00:00Z`))
		);
		expect(new Set(kinds).size).toBe(4);
	});

	test("always returns a kind present in BLESSING_META", () => {
		for (let d = 1; d <= 28; d++) {
			const k = dailyBlessingKind(new Date(`2026-01-${String(d).padStart(2, "0")}T00:00:00Z`));
			expect(BLESSING_META[k]).toBeDefined();
		}
	});
});

describe("dailyCurseKind", () => {
	test("uses the same index as blessings (parallel rotation)", () => {
		const d = new Date("2026-03-15T00:00:00Z");
		const idx = dayOfYearUTC(d) % 4;
		expect(dailyCurseKind(d)).toBe(CURSE_ROTATION[idx]);
		expect(dailyBlessingKind(d)).toBe(BLESSING_ROTATION[idx]);
	});

	test("always returns a kind present in CURSE_META", () => {
		for (let d = 1; d <= 28; d++) {
			const k = dailyCurseKind(new Date(`2026-02-${String(d).padStart(2, "0")}T00:00:00Z`));
			expect(CURSE_META[k]).toBeDefined();
		}
	});
});

describe("dailyRitual", () => {
	test("bless mode returns blessing kind + its metadata", () => {
		const d = new Date("2026-01-01T00:00:00Z");
		const r = dailyRitual("bless", d);
		expect(r.kind).toBe(dailyBlessingKind(d));
		expect(r.name).toBe(BLESSING_META[r.kind as keyof typeof BLESSING_META].name);
		expect(r.emoji).toBeTruthy();
		expect(r.blurb).toBeTruthy();
	});

	test("curse mode returns curse kind + its metadata", () => {
		const d = new Date("2026-01-01T00:00:00Z");
		const r = dailyRitual("curse", d);
		expect(r.kind).toBe(dailyCurseKind(d));
		expect(r.name).toBe(CURSE_META[r.kind as keyof typeof CURSE_META].name);
	});
});
