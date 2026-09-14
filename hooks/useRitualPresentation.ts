// The one hook that turns "which rituals are on me right now" into "what the
// Barn and the pig look like". It reads the shared ActiveEffects state, folds
// every active kind through `mergeRitualFx`, and hands the merged recipe to
// the render surfaces (BarnOverlay's scene, PigStage's pig, the tap burst, the
// oink's pitch).
//
// Plan: docs/design/2026-09-14-weekday-rituals-plan.md
// Contract: constants/ritualFx.ts
//
// Two entry points:
//   • `useRitualPresentation()` — the signed-in player's own presentation.
//     Needs the ActiveEffectsProvider (the Barn is inside it).
//   • `useRitualPresentationFor(kinds)` — a pure memo for a surface that
//     already KNOWS the kinds (a list row, a profile sheet, a Barn visit's
//     `active_effects_of` read in phase 4). No provider, no fetch.
//
// Reduce Motion rides along on the return rather than being applied here: the
// recipe is the same either way, and each surface decides what "frozen" means
// for it (a float rests at 0, a particle field renders one still frame).

import { useMemo } from "react";
import {
	REST_PRESENTATION,
	mergeRitualFx,
	type RitualPresentation,
} from "@/constants/ritualFx";
import { useActiveEffectsContext } from "./ActiveEffectsProvider";
import { useMotionPolicy } from "./useMotionPolicy";

export interface RitualPresentationView extends RitualPresentation {
	// The accessibility preference, forwarded so a consumer can freeze without
	// reaching for the motion policy itself.
	reduceMotion: boolean;
	// True when nothing is active — `mergeRitualFx` returns the frozen
	// REST_PRESENTATION, so this is an identity check, not a deep one.
	atRest: boolean;
}

function view(
	presentation: RitualPresentation,
	reduceMotion: boolean,
): RitualPresentationView {
	return {
		...presentation,
		reduceMotion,
		atRest: presentation === REST_PRESENTATION,
	};
}

/**
 * Fold a known list of ritual kinds into one presentation. Pure aside from the
 * motion policy; unknown kinds (a legacy row still expiring) are ignored.
 */
export function useRitualPresentationFor(
	kinds: readonly string[],
): RitualPresentationView {
	const { reduceMotion } = useMotionPolicy();
	// A fresh array every render is the norm (`effects.map(...)`), so memoize on
	// the CONTENT, not the identity, or every fetch tick rebuilds the recipe.
	const key = kinds.join("|");
	return useMemo(
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `kinds`.
		() => view(mergeRitualFx(key === "" ? [] : key.split("|")), reduceMotion),
		[key, reduceMotion],
	);
}

/**
 * The signed-in player's merged ritual presentation, from the shared
 * ActiveEffects state. Must be called inside an `ActiveEffectsProvider`.
 */
export function useRitualPresentation(): RitualPresentationView {
	const { effects } = useActiveEffectsContext();
	const key = useMemo(() => effects.map((e) => e.kind).join("|"), [effects]);
	const { reduceMotion } = useMotionPolicy();
	return useMemo(
		() => view(mergeRitualFx(key === "" ? [] : key.split("|")), reduceMotion),
		[key, reduceMotion],
	);
}
