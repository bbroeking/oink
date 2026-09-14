// useRitualPresentation folds the player's live effects into ONE presentation.
// The contract it must keep:
//   • an empty effects list is the frozen REST_PRESENTATION (identity, so a
//     consumer can bail with `=== REST_PRESENTATION`);
//   • unknown kinds (a legacy row still expiring after the weekday migration)
//     are ignored rather than crashing the Barn;
//   • the day's blessing and curse merge into one recipe;
//   • `reduceMotion` rides along so a surface can freeze without reaching for
//     the motion policy itself.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { REST_PRESENTATION } from "@/constants/ritualFx";
import { WHIMSY } from "@/constants/theme";
import {
	useRitualPresentation,
	useRitualPresentationFor,
	type RitualPresentationView,
} from "@/hooks/useRitualPresentation";

// The provider is the only thing the hook needs from the effects layer, and the
// real one owns a fetch + a realtime subscription. Stub the context reader.
const effects: { kind: string }[] = [];
jest.mock("@/hooks/ActiveEffectsProvider", () => ({
	useActiveEffectsContext: () => ({ effects }),
}));

function capture(
	hook: () => RitualPresentationView,
	reduceMotion = false,
): RitualPresentationView {
	let seen!: RitualPresentationView;
	function Probe() {
		seen = hook();
		return <Text>probe</Text>;
	}
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(
			<MotionPolicyProvider reduceMotion={reduceMotion}>
				<Probe />
			</MotionPolicyProvider>,
		);
	});
	act(() => r.unmount());
	return seen;
}

describe("useRitualPresentation", () => {
	beforeEach(() => {
		effects.length = 0;
	});

	test("no active effects → the shared rest presentation", () => {
		const p = capture(useRitualPresentation);
		expect(p.atRest).toBe(true);
		expect(p.kinds).toEqual([]);
		expect(p.scene).toEqual({});
		expect(p.pig).toEqual({});
	});

	test("merges the provider's effects into one presentation", () => {
		// Friday: the Barn is amber AND the pig is bacon-striped at once.
		effects.push({ kind: "golden_hour" }, { kind: "bacon_bits" });
		const p = capture(useRitualPresentation);
		expect(p.atRest).toBe(false);
		expect(p.kinds).toEqual(["golden_hour", "bacon_bits"]);
		expect(p.scene.tint).toBe(WHIMSY.sun);
		expect(p.pig.glow).toBe(WHIMSY.sun);
		expect(p.pig.skin).toBe("bacon");
	});

	test("a legacy kind still expiring is ignored, not fatal", () => {
		effects.push({ kind: "mud_wrap" }, { kind: "topsy_turvy" });
		const p = capture(useRitualPresentation);
		expect(p.kinds).toEqual(["topsy_turvy"]);
		expect(p.pig.flip).toBe(true);
	});

	test("only legacy kinds still reads as rest", () => {
		effects.push({ kind: "mud_wrap" }, { kind: "sun_beam" });
		expect(capture(useRitualPresentation).atRest).toBe(true);
	});

	test("reduceMotion rides along on the return", () => {
		effects.push({ kind: "cloud_nine" });
		expect(capture(useRitualPresentation, true).reduceMotion).toBe(true);
		expect(capture(useRitualPresentation, false).reduceMotion).toBe(false);
	});

	test("REST_PRESENTATION is the identity the hook returns at rest", () => {
		const p = capture(useRitualPresentation);
		expect(p.kinds).toBe(REST_PRESENTATION.kinds);
	});
});

describe("useRitualPresentationFor", () => {
	test("folds a known kind list without the provider", () => {
		const p = capture(() => useRitualPresentationFor(["hiccups"]));
		expect(p.pig.hop).toEqual({ every: 4000, height: 8 });
		expect(p.atRest).toBe(false);
	});

	test("an empty list is rest", () => {
		expect(capture(() => useRitualPresentationFor([])).atRest).toBe(true);
	});

	test("first wins for a field two recipes both set", () => {
		// Two scene washes: the first kind's tint is the one that lands.
		const p = capture(() =>
			useRitualPresentationFor(["pickle_brine", "old_timey"]),
		);
		expect(p.scene.tint).toBe(WHIMSY.sage);
		expect(p.scene.grain).toBe(true);
	});
});
