// The ritual presentation contract (weekday rituals, 2026-09-14).
//
// The load-bearing assertion is the CHANNEL RULE: a player can carry the
// day's blessing AND the day's curse at once, so each weekday's two recipes
// must never reach for the same visual channel. If someone re-tunes a recipe
// and Friday's amber wash starts fighting Friday's bacon stripes, this fails.

import {
	RITUAL_FX,
	REST_PRESENTATION,
	fxChannels,
	isRitualFxKind,
	mergeRitualFx,
} from "../constants/ritualFx";
import { BLESSING_ROTATION, CURSE_ROTATION } from "../utils/rituals";

// The rotations are typed by the CATALOG (BlessingKind carries the two
// system-granted kinds that have no recipe); `isRitualFxKind` is the bridge,
// and the "every rotation entry has a recipe" test below is what earns it.
const fxOf = (kind: string) => {
	if (!isRitualFxKind(kind)) throw new Error(`no recipe for ${kind}`);
	return RITUAL_FX[kind];
};

const DAY_NAMES = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
];

describe("mergeRitualFx", () => {
	test("nothing active is REST_PRESENTATION itself", () => {
		expect(mergeRitualFx([])).toBe(REST_PRESENTATION);
	});

	test("unknown legacy kinds are ignored", () => {
		expect(mergeRitualFx(["warm_tea", "sluggish_snout", "coin_pinch"])).toBe(
			REST_PRESENTATION
		);
		// A legacy row alongside a live one contributes nothing of its own.
		const merged = mergeRitualFx(["mud_wrap", "golden_hour"]);
		expect(merged.kinds).toEqual(["golden_hour"]);
	});

	test("a day's pair folds into one presentation", () => {
		// Friday: amber Barn AND a bacon-striped pig, at the same time.
		const merged = mergeRitualFx(["golden_hour", "bacon_bits"]);
		expect(merged.kinds).toEqual(["golden_hour", "bacon_bits"]);
		expect(merged.scene.tint).toBeTruthy();
		expect(merged.pig.skin).toBe("bacon");
		expect(merged.pig.glow).toBeTruthy();
	});
});

describe("the channel rule", () => {
	test.each(DAY_NAMES.map((name, i) => [name, i] as const))(
		"%s's blessing and curse touch disjoint channels",
		(_name, i) => {
			const blessing = fxChannels(fxOf(BLESSING_ROTATION[i]));
			const curse = fxChannels(fxOf(CURSE_ROTATION[i]));
			const overlap = blessing.filter((c) => curse.includes(c));
			expect(overlap).toEqual([]);
		}
	);

	test("every day's pair contributes at least one channel each", () => {
		for (let i = 0; i < 7; i++) {
			expect(fxChannels(fxOf(BLESSING_ROTATION[i])).length).toBeGreaterThan(0);
			expect(fxChannels(fxOf(CURSE_ROTATION[i])).length).toBeGreaterThan(0);
		}
	});
});

describe("catalog / recipe agreement", () => {
	test("every rotation entry has a recipe", () => {
		for (const kind of BLESSING_ROTATION) expect(isRitualFxKind(kind)).toBe(true);
		for (const kind of CURSE_ROTATION) expect(isRitualFxKind(kind)).toBe(true);
	});

	test("every recipe is in a rotation (no orphan recipes)", () => {
		const rotation = new Set<string>([...BLESSING_ROTATION, ...CURSE_ROTATION]);
		for (const kind of Object.keys(RITUAL_FX)) {
			expect(rotation.has(kind)).toBe(true);
		}
	});
});
