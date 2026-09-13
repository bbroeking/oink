// The Season tab's one-hero rule, as a pure function. [C-26]
//
// Audit finding C-26: eleven decision surfaces stack in the season scroll, and
// on a "rewards ready" load six of them wore the sun-yellow full-card highlight
// at once — so nothing was the one thing. Wave 3 fixed it for the cards
// `season.tsx` draws itself; wave 4 carries it across the whole scroll by
// giving `HungerHero`, `FeedingAction`, `SounderHomeCard` and `SounderStepCard`
// a `hero` prop. No card decides its own loudness: the screen derives the
// primary action once, maps it to exactly ONE surface here, and hands that down.
//
// Living in utils (not in the route module) so the rule is testable without
// mounting a 2,500-line screen — and so the invariant "exactly one hero, in
// every state" is a test rather than a reading of four JSX props.

/**
 * What the tab is asking the player to do right now, in precedence order:
 * the dig (open now, not yet taken) > a claimable reward > finding a herd >
 * nothing urgent.
 */
export type PrimaryAction = "dig" | "claim" | "join" | "browse";

/**
 * The season scroll's four candidate hero surfaces.
 *   feeding — the Feeding card's dig CTA (or the funnel's `first_dig` step card,
 *             which draws that same CTA while onboarding runs)
 *   claim   — the pass track's "N rewards ready" claim bar
 *   sounder — the Sounder join door (framed by the step card pre-DONE)
 *   hunger  — the Great Hungerer banner: with nothing to do, the season's own
 *             story is the one thing worth looking at
 */
export type HeroSurface = "feeding" | "claim" | "sounder" | "hunger";

export const HERO_SURFACES: readonly HeroSurface[] = [
	"feeding",
	"claim",
	"sounder",
	"hunger",
];

export const PRIMARY_ACTIONS: readonly PrimaryAction[] = [
	"dig",
	"claim",
	"join",
	"browse",
];

/**
 * The one derivation. `digAvailable` is the shared feeding CTA's own truth
 * (in a crew · window open · not yet dug this feeding), so no surface can
 * disagree with the patch about whether it is open.
 */
export function seasonPrimaryAction({
	digAvailable,
	readyTierCount,
	inCrew,
}: {
	digAvailable: boolean;
	readyTierCount: number;
	inCrew: boolean;
}): PrimaryAction {
	if (digAvailable) return "dig";
	if (readyTierCount > 0) return "claim";
	if (!inCrew) return "join";
	return "browse";
}

/** The single surface allowed to wear the sun fill / gold Button. */
export function seasonHeroSurface(action: PrimaryAction): HeroSurface {
	switch (action) {
		case "dig":
			return "feeding";
		case "claim":
			return "claim";
		case "join":
			return "sounder";
		case "browse":
			return "hunger";
	}
}
