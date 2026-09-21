// The Season tab's one-hero rule, as a pure function. [C-26]
//
// Audit finding C-26: eleven decision surfaces stack in the season scroll, and
// on a "rewards ready" load six of them wore the sun-yellow full-card highlight
// at once — so nothing was the one thing. No card decides its own loudness: the
// screen derives the primary action once, maps it to exactly ONE surface here,
// and hands that down.
//
// Rewritten 2026-09-21 (docs/design/2026-09-21-season-page-rewrite.md §1): the
// herd race and the Sounder door leave the page, so the rule shrinks to three
// verbs and four surfaces — the dig, a ready claim, Monday's drum, the story.
// `inCrew` is no longer an input: nothing on this page asks a snout to belong
// to anything first.
//
// Living in utils (not in the route module) so the rule is testable without
// mounting a 2,500-line screen — and so the invariant "exactly one hero, in
// every state" is a test rather than a reading of four JSX props.

/**
 * What the tab is asking the player to do right now, in precedence order:
 * the dig (open now, not yet taken) > a claimable reward > an undrawn Monday
 * purse > nothing urgent.
 */
export type PrimaryAction = "dig" | "claim" | "draw" | "browse";

/**
 * The season page's four candidate hero surfaces.
 *   feeding — the Feed panel's dig CTA
 *   claim   — the Pass panel's ready rung / claim bar
 *   draw    — the Draw panel's "Draw your Monday purse"
 *   hunger  — the Great Hungerer's own story: with nothing to do, the season's
 *             arc is the one thing worth looking at
 */
export type HeroSurface = "feeding" | "claim" | "draw" | "hunger";

export const HERO_SURFACES: readonly HeroSurface[] = [
	"feeding",
	"claim",
	"draw",
	"hunger",
];

export const PRIMARY_ACTIONS: readonly PrimaryAction[] = [
	"dig",
	"claim",
	"draw",
	"browse",
];

/**
 * The one derivation. `digAvailable` is the shared feeding CTA's own truth
 * (window open · not yet dug this feeding), so no surface can disagree with the
 * patch about whether it is open. `drawReady` is the drum's own truth (a purse
 * exists for the ended week and has not been drawn).
 */
export function seasonPrimaryAction({
	digAvailable,
	readyTierCount,
	drawReady,
}: {
	digAvailable: boolean;
	readyTierCount: number;
	drawReady: boolean;
}): PrimaryAction {
	if (digAvailable) return "dig";
	if (readyTierCount > 0) return "claim";
	if (drawReady) return "draw";
	return "browse";
}

/** The single surface allowed to wear the sun fill / gold Button. */
export function seasonHeroSurface(action: PrimaryAction): HeroSurface {
	switch (action) {
		case "dig":
			return "feeding";
		case "claim":
			return "claim";
		case "draw":
			return "draw";
		case "browse":
			return "hunger";
	}
}
