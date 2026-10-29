// The season's fiction, by season id (utils/seasonTheme.ts). Season 1 keeps
// the words it shipped with; Season 2 is The Feast; anything else reads as
// Season 1 so a season this binary has never heard of never blanks a surface.
// Spec: docs/explorations/2026-10-29-season-2/proposal.md §3.1 (1), §3.3.
import { SEASON_THEMES, seasonTheme, type SeasonTheme } from "@/utils/seasonTheme";
import {
	HUNGER_LEVEL_NAME,
	HUNGER_STAGES,
	HUNGER_STAGE_LINE,
} from "@/hooks/useHungerMeter";

jest.mock("@/utils/rpc", () => ({ rpc: jest.fn(async () => null) }));
jest.mock("expo-router/react-navigation", () => ({ useFocusEffect: () => {} }));

// Every player-readable string a theme can produce, functions sampled.
function stringsOf(t: SeasonTheme): string[] {
	return [
		t.title,
		t.seasonName,
		t.kicker(12, 56, t.levelNames.stuffed),
		t.meterSubject,
		...Object.values(t.levelNames),
		...Object.values(t.stageCopy),
		t.meterLine(56),
		...t.story.flatMap((b) => [b.kicker, b.line]),
		...t.guideSteps.flatMap((s) => [s.title, s.line]),
		t.ladderKicker,
		t.ladderHere,
		t.ladderFoot,
	];
}

const THEMES = Object.values(SEASON_THEMES);

describe("seasonTheme", () => {
	test("both season ids resolve to their own fiction", () => {
		expect(seasonTheme("snout_season_1").title).toBe("The Great Hunger");
		expect(seasonTheme("snout_season_1").id).toBe("snout_season_1");
		expect(seasonTheme("snout_season_2").title).toBe("The Feast");
		expect(seasonTheme("snout_season_2").id).toBe("snout_season_2");
	});

	test("an unknown, empty or missing id falls back to Season 1", () => {
		for (const id of ["snout_season_3", "", null, undefined, "season_0", "toString", "__proto__"]) {
			expect(seasonTheme(id).id).toBe("snout_season_1");
		}
	});

	test("every stage id has words in every theme (the old-binary contract)", () => {
		for (const t of THEMES) {
			for (const stage of HUNGER_STAGES) {
				expect(t.stageCopy[stage]?.trim().length).toBeGreaterThan(0);
				expect(t.levelNames[stage]?.trim().length).toBeGreaterThan(0);
			}
			// Exactly the six ids, nothing invented.
			expect(Object.keys(t.stageCopy).sort()).toEqual([...HUNGER_STAGES].sort());
			expect(Object.keys(t.levelNames).sort()).toEqual([...HUNGER_STAGES].sort());
		}
	});

	test("no em dash and no emoji in any theme string", () => {
		// Emoji-presentation characters; the kicker's typographic star (U+2605) is
		// the design's own ornament, not an emoji.
		const emoji = /\p{Emoji_Presentation}/u;
		for (const t of THEMES) {
			for (const s of stringsOf(t)) {
				expect(s).not.toContain("—");
				expect(s).not.toMatch(emoji);
			}
		}
	});

	test("Season 1 keeps the words it shipped with", () => {
		const s1 = seasonTheme("snout_season_1");
		expect(s1.kicker(12, 60, "Stuffed")).toBe("day 12 of 60 · the Hungerer is Stuffed");
		expect(s1.meterLine(60)).toBe(
			"Every truffle dug back starves him a little. The herd wants him Famished by day 60."
		);
		expect(s1.seasonName).toBe("The Season of the Hunger");
		expect(s1.guideSteps.map((s) => s.title)).toEqual([
			"Dig every feeding",
			"Draw on Monday",
			"Starve the Hungerer",
		]);
		expect(s1.story.map((b) => b.kicker)).toEqual([
			"the theft",
			"the sounders",
			"the dig",
			"the last feast",
		]);
		expect(s1.ladderFoot).toBe(
			"He ate the valley's tickles. Every truffle the herd digs up pries them back. Starve him from Gorged to Famished."
		);
		// The hook's names are Season 1's, so the surfaces that only speak the
		// Hunger (and old tests) read the same words.
		expect(HUNGER_STAGE_LINE).toBe(s1.stageCopy);
		expect(HUNGER_LEVEL_NAME).toBe(s1.levelNames);
		expect(s1.hasIntroCinematic).toBe(true);
	});

	test("The Feast: the Larder fills over the same stage ids, and the Hunger tale never plays", () => {
		const s2 = seasonTheme("snout_season_2");
		expect(s2.seasonName).toBe("The Season of the Feast");
		expect(s2.kicker(3, 56, s2.levelNames.gorged)).toBe("day 3 of 56 · the Larder is Bare");
		expect(s2.meterLine(56)).toContain("Larder");
		expect(s2.meterLine(56)).toContain("day 56");
		expect(s2.levelNames.famished).toBe("Bursting");
		expect(s2.hasIntroCinematic).toBe(false);
		// The guide names the Leftovers ball.
		expect(s2.guideSteps.map((s) => s.line).join(" ")).toContain("leftover");
		// Nothing in the Feast starves anyone.
		for (const s of stringsOf(s2)) expect(s).not.toMatch(/starve him|famished/i);
		expect(s2.heroArt).not.toBe(seasonTheme("snout_season_1").heroArt);
	});

	test("the Feast's stage words fit the meter's row (no longer than Famished)", () => {
		for (const name of Object.values(seasonTheme("snout_season_2").levelNames)) {
			expect(name.length).toBeLessThanOrEqual("Famished".length);
		}
	});
});
