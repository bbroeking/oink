import {
	BOARDED_DAYS,
	DAY_MS,
	HOUR_MS,
	closedLabel,
	daysLeft,
	leavingLabel,
	shelfPhase,
} from "@/utils/shelfCountdown";

const NOW = Date.UTC(2026, 9, 31, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

describe("shelfPhase", () => {
	it("treats a shelf with no dates as dark, never open", () => {
		expect(shelfPhase({ opensAt: null, closesAt: null }, NOW)).toBe("upcoming");
		expect(shelfPhase({ opensAt: iso(NOW - DAY_MS), closesAt: null }, NOW)).toBe("upcoming");
		expect(shelfPhase({ opensAt: null, closesAt: iso(NOW + DAY_MS) }, NOW)).toBe("upcoming");
	});

	it("walks upcoming, open, boarded, gone", () => {
		const w = { opensAt: iso(NOW), closesAt: iso(NOW + 6 * DAY_MS) };
		expect(shelfPhase(w, NOW - 1)).toBe("upcoming");
		expect(shelfPhase(w, NOW)).toBe("open");
		expect(shelfPhase(w, NOW + 6 * DAY_MS - 1)).toBe("open");
		expect(shelfPhase(w, NOW + 6 * DAY_MS)).toBe("boarded");
		expect(shelfPhase(w, NOW + (6 + BOARDED_DAYS) * DAY_MS - 1)).toBe("boarded");
		expect(shelfPhase(w, NOW + (6 + BOARDED_DAYS) * DAY_MS)).toBe("gone");
	});
});

describe("leavingLabel", () => {
	it("counts whole days up", () => {
		expect(leavingLabel(iso(NOW + 6 * DAY_MS), NOW)).toBe("leaving in 6 days");
		expect(leavingLabel(iso(NOW + 5 * DAY_MS + HOUR_MS), NOW)).toBe("leaving in 6 days");
		expect(leavingLabel(iso(NOW + DAY_MS), NOW)).toBe("leaving in 1 day");
		expect(daysLeft(iso(NOW + 5 * DAY_MS + HOUR_MS), NOW)).toBe(6);
	});

	it("switches to hours on the last day and says so at the very end", () => {
		expect(leavingLabel(iso(NOW + 5 * HOUR_MS), NOW)).toBe("leaving in 5h");
		expect(leavingLabel(iso(NOW + 4.2 * HOUR_MS), NOW)).toBe("leaving in 5h");
		expect(leavingLabel(iso(NOW + 20 * 60_000), NOW)).toBe("leaving in under an hour");
	});

	it("is null once closed, and speaks the buy confirm's verb", () => {
		expect(leavingLabel(iso(NOW), NOW)).toBeNull();
		expect(leavingLabel(null, NOW)).toBeNull();
		expect(daysLeft(iso(NOW - 1), NOW)).toBe(0);
		expect(leavingLabel(iso(NOW + 6 * DAY_MS), NOW, "leaves")).toBe("leaves in 6 days");
	});

	it("never writes an em dash", () => {
		for (const ms of [20 * 60_000, 5 * HOUR_MS, 3 * DAY_MS]) {
			expect(leavingLabel(iso(NOW + ms), NOW)).not.toMatch(/—/);
		}
	});
});

describe("closedLabel", () => {
	it("names the last open day and the shelf's promise", () => {
		// Local midnight Nov 10 closes the stall at the end of Nov 9.
		const closes = new Date(2026, 10, 10, 0, 0, 0).getTime();
		expect(closedLabel(iso(closes), "back next October")).toBe(
			"closed Nov 9 · back next October",
		);
	});

	it("falls back to a generic promise and survives a missing date", () => {
		const closes = new Date(2026, 10, 9, 18, 0, 0).getTime();
		expect(closedLabel(iso(closes), undefined)).toBe("closed Nov 9 · back next year");
		expect(closedLabel(null, "  ")).toBe("packed up · back next year");
	});
});
