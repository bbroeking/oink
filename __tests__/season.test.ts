// Season 0 schedule + the release-notes drip. These pin the
// contract that a "what's new" card never surfaces before the
// feature it announces.

import {
	featureUnlocked,
	seasonWeek,
	seasonActive,
	SEASON_0_UNLOCKS,
} from "../utils/season";
import { currentRelease, RELEASE_NOTES } from "../constants/release_notes";
import {
	HERO_SURFACES,
	PRIMARY_ACTIONS,
	seasonHeroSurface,
	seasonPrimaryAction,
} from "../utils/seasonHero";

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
		for (const f of Object.keys(SEASON_0_UNLOCKS) as (keyof typeof SEASON_0_UNLOCKS)[]) {
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
		expect(seasonWeek(at(SEASON_0_UNLOCKS.blessings))).toBe(3);
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

// ── The one-hero rule (C-26) ────────────────────────────────────────────────
// At most one surface per screen wears the full sun highlight (design-system
// spec §3.4). The Season page stacks several decision surfaces, so the
// derivation lives in ONE place and every surface takes `hero` as a prop.
// Rewritten 2026-09-21 with the page (docs/design/2026-09-21-season-page-rewrite.md
// §1): the Sounder join door left the page, and Monday's drum took its rung —
// dig > claim > draw > browse. These pin both halves: the precedence, and the
// invariant that every state elects exactly one surface — never zero, never two.
describe("the season tab's one hero", () => {
	const state = (
		digAvailable: boolean,
		readyTierCount: number,
		drawReady: boolean,
	) => seasonPrimaryAction({ digAvailable, readyTierCount, drawReady });

	test("an open, untaken dig outranks everything else", () => {
		expect(state(true, 3, true)).toBe("dig");
		expect(state(true, 0, true)).toBe("dig");
	});

	test("a ready reward wins once the patch is closed or already dug", () => {
		expect(state(false, 1, true)).toBe("claim");
		expect(state(false, 1, false)).toBe("claim");
	});

	test("an undrawn Monday purse is the next thing to do", () => {
		expect(state(false, 0, true)).toBe("draw");
	});

	test("nothing to do lands on browse", () => {
		expect(state(false, 0, false)).toBe("browse");
	});

	test("the drum never outranks the dig or a claim, and never shouts on its own once drawn", () => {
		// A drawn (or ball-less) week is not an act-now — the page falls through
		// to the season's own story rather than inventing urgency.
		expect(state(false, 0, false)).toBe("browse");
		expect(seasonHeroSurface(state(false, 0, false))).toBe("hunger");
	});

	test("every primary action elects exactly one hero surface", () => {
		const elected = PRIMARY_ACTIONS.map(seasonHeroSurface);
		for (const action of PRIMARY_ACTIONS) {
			const hero = seasonHeroSurface(action);
			// Exactly one surface is the hero, and it is a real surface.
			expect(HERO_SURFACES).toContain(hero);
			expect(HERO_SURFACES.filter((s) => s === hero)).toHaveLength(1);
		}
		// …and across the four states no surface is elected twice, so no card can
		// be reached by two different "you are the hero" paths.
		expect(new Set(elected).size).toBe(PRIMARY_ACTIONS.length);
	});

	test("the four states cover every hero surface", () => {
		expect(PRIMARY_ACTIONS.map(seasonHeroSurface).sort()).toEqual(
			[...HERO_SURFACES].sort(),
		);
	});
});
