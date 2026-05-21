// Season 1 schedule + the release-notes drip. These pin the
// contract that a "what's new" card never surfaces before the
// feature it announces.

import {
	featureUnlocked,
	seasonWeek,
	seasonActive,
	SEASON_1_UNLOCKS,
} from "../utils/season";
import { currentRelease, RELEASE_NOTES } from "../constants/release_notes";

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("featureUnlocked", () => {
	test("alignment is live at launch", () => {
		expect(featureUnlocked("alignment", at("2026-05-20"))).toBe(true);
	});

	test("blessings are NOT live at launch", () => {
		expect(featureUnlocked("blessings", at("2026-05-20"))).toBe(false);
	});

	test("blessings unlock on their date", () => {
		expect(featureUnlocked("blessings", at("2026-06-03"))).toBe(true);
	});

	test("curses are still locked the day before they unlock", () => {
		expect(featureUnlocked("curses", at("2026-06-09"))).toBe(false);
		expect(featureUnlocked("curses", at("2026-06-10"))).toBe(true);
	});

	test("finale is the last to unlock", () => {
		expect(featureUnlocked("finale", at("2026-07-07"))).toBe(false);
		expect(featureUnlocked("finale", at("2026-07-08"))).toBe(true);
	});

	test("every feature is eventually unlocked", () => {
		const farFuture = at("2027-01-01");
		for (const f of Object.keys(SEASON_1_UNLOCKS) as (keyof typeof SEASON_1_UNLOCKS)[]) {
			expect(featureUnlocked(f, farFuture)).toBe(true);
		}
	});
});

describe("seasonWeek", () => {
	test("launch day is week 1", () => {
		expect(seasonWeek(at("2026-05-20"))).toBe(1);
	});

	test("seven days in is week 2", () => {
		expect(seasonWeek(at("2026-05-27"))).toBe(2);
	});

	test("blessings unlock falls in week 3", () => {
		expect(seasonWeek(at(SEASON_1_UNLOCKS.blessings))).toBe(3);
	});

	test("clamps to 1 before the season starts", () => {
		expect(seasonWeek(at("2026-05-01"))).toBe(1);
	});
});

describe("seasonActive", () => {
	test("active during the season", () => {
		expect(seasonActive(at("2026-06-15"))).toBe(true);
	});
	test("inactive before + after", () => {
		expect(seasonActive(at("2026-05-01"))).toBe(false);
		expect(seasonActive(at("2026-08-01"))).toBe(false);
	});
});

describe("currentRelease — the drip", () => {
	test("at launch, the launch entry is current", () => {
		expect(currentRelease(at("2026-05-20")).version).toBe("1.4.0");
	});

	test("future season entries are NOT surfaced at launch", () => {
		const r = currentRelease(at("2026-05-20"));
		expect(r.version).not.toBe("1.5.0");
		expect(r.version).not.toBe("1.8.0");
	});

	test("the blessings entry surfaces on its date, not before", () => {
		expect(currentRelease(at("2026-06-02")).version).toBe("1.4.0");
		expect(currentRelease(at("2026-06-03")).version).toBe("1.5.0");
	});

	test("each entry becomes current in order as dates pass", () => {
		expect(currentRelease(at("2026-06-10")).version).toBe("1.6.0");
		expect(currentRelease(at("2026-06-24")).version).toBe("1.7.0");
		expect(currentRelease(at("2026-07-08")).version).toBe("1.8.0");
	});

	test("every release entry has an availableFrom date", () => {
		for (const r of RELEASE_NOTES) {
			expect(r.availableFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		}
	});

	test("release entries are ordered by availableFrom ascending", () => {
		for (let i = 1; i < RELEASE_NOTES.length; i++) {
			expect(
				RELEASE_NOTES[i].availableFrom >= RELEASE_NOTES[i - 1].availableFrom
			).toBe(true);
		}
	});
});
