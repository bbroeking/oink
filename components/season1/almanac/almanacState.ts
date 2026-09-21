// The Almanac's pure state — which of the three verb tabs is selected first,
// which ones wear the act-now sun, and the one nowrap value each cell prints.
// No React, no fetch: every function is a plain map over facts the screen
// already holds, so the strip's logic is a unit test rather than a reading of
// three JSX props (the same seam `utils/seasonHero.ts` cut for the one-hero
// rule). See docs/design/season-almanac-2026-09-16/SPEC.md and, for the
// rewrite that retired the Herd and Race cells,
// docs/design/2026-09-21-season-page-rewrite.md §1.
//
// The Draw cell's two readings live with the panel that prints them
// (`DrawPanel.drawCellValue` / `drawCellTodo`) so a cell and its panel can
// never disagree about what the drum is doing.

import { drawCellTodo, drawCellValue } from "./DrawPanel";
import type { HeroSurface } from "@/utils/seasonHero";
import type { PassTrack, TierRow, TierState } from "@/utils/seasonPass";
import type { MondayDrawState } from "@/utils/mondayDraw";

export type AlmanacTab = "feed" | "draw" | "pass";

export const ALMANAC_TABS: readonly AlmanacTab[] = ["feed", "draw", "pass"];

/** The cozy label each cell wears — the code stays technical, the screen cozy. */
export const ALMANAC_TAB_LABEL: Record<AlmanacTab, string> = {
	feed: "Feed",
	draw: "Draw",
	pass: "Pass",
};

/** Everything the strip needs to print its three values and pick its golds. */
export interface AlmanacFacts {
	phaseOpen: boolean;
	dugThisWindow: boolean;
	/** The feeding clock's own number — closes-in while open, opens-in while guarded. */
	countdown: string;
	/** The drum, or null before the first read lands. */
	draw: MondayDrawState | null;
	currentTier: number;
	readyTierCount: number;
}

/**
 * Feed: the phase's own countdown (opens-in while guarded, closes-in while
 * open — the hero says which), `Dug` once this feeding is taken. The sun fill,
 * not a verb, is what says "dig now".
 */
export function feedCellValue(f: Pick<AlmanacFacts, "dugThisWindow" | "countdown">): string {
	if (f.dugThisWindow) return "Dug";
	return f.countdown;
}

/** Pass: `2 ready` when a claim waits, else `Tier 4`. */
export function passCellValue(f: Pick<AlmanacFacts, "currentTier" | "readyTierCount">): string {
	if (f.readyTierCount > 0) return `${f.readyTierCount} ready`;
	return `Tier ${f.currentTier}`;
}

export function almanacValues(f: AlmanacFacts): Record<AlmanacTab, string> {
	return {
		feed: feedCellValue(f),
		draw: drawCellValue(f.draw),
		pass: passCellValue(f),
	};
}

/**
 * Which cells wear the sun. Gold means act-now and nothing else: Feed while
 * the feeding is open and untaken, Draw while a purse is drawable and undrawn,
 * Pass while a claim is ready. Several may be gold at once — the strip is a row
 * of doors, not the one-hero surface; the one-hero rule decides which opens
 * FIRST (`almanacInitialTab`).
 */
export function almanacTodo(f: AlmanacFacts): Record<AlmanacTab, boolean> {
	return {
		feed: f.phaseOpen && !f.dugThisWindow,
		draw: drawCellTodo(f.draw),
		pass: f.readyTierCount > 0,
	};
}

/** The one-hero rule picks the tab that opens first: dig → Feed, claim → Pass, draw → Draw, browse → Feed. */
export function almanacInitialTab(hero: HeroSurface): AlmanacTab {
	switch (hero) {
		case "feeding":
			return "feed";
		case "claim":
			return "pass";
		case "draw":
			return "draw";
		case "hunger":
			return "feed";
	}
}

// ── The title row ────────────────────────────────────────────────────────────

/** `day N of 60` — one-based, clamped into the season's span. */
export function seasonDay(startsAt: string, endsAt: string, nowMs: number = Date.now()): { day: number; total: number } {
	const DAY = 86_400_000;
	const start = new Date(startsAt).getTime();
	const end = new Date(endsAt).getTime();
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
		return { day: 1, total: 1 };
	}
	const total = Math.max(1, Math.round((end - start) / DAY));
	const day = Math.floor((nowMs - start) / DAY) + 1;
	return { day: Math.min(total, Math.max(1, day)), total };
}

// ── The pass ladder ──────────────────────────────────────────────────────────

/** XP still to earn before the NEXT tier (0 once the pass is full). */
export function xpToNextTier(xp: number, xpPerTier: number, currentTier: number, totalTiers: number): number {
	if (currentTier >= totalTiers) return 0;
	const per = Math.max(1, xpPerTier);
	return Math.max(0, currentTier * per - xp);
}

export interface LadderEntry {
	tier: number;
	state: TierState;
	reward: TierRow;
	/** XP still to earn for a locked tier (0 otherwise). */
	xpAway: number;
}

/**
 * The three rows the Pass panel shows: the ready tiers in climbing order (the
 * lowest first, at most three — the door below says "see all"), then the next
 * locked tiers to fill, then — when the pass is quiet — the most recent
 * claimed tier so the ladder still reads as a ladder.
 */
export function passLadderWindow(
	tiersByNumber: Record<number, { free?: TierRow; premium?: TierRow }>,
	track: PassTrack,
	claimedSet: Set<string>,
	currentTier: number,
	xp: number,
	xpPerTier: number,
	rows = 3
): LadderEntry[] {
	const per = Math.max(1, xpPerTier);
	const tiers = Object.keys(tiersByNumber)
		.map(Number)
		.filter((t) => !!tiersByNumber[t]?.[track])
		.sort((a, b) => a - b);
	const entry = (t: number): LadderEntry => {
		const reward = tiersByNumber[t][track]!;
		const claimed = claimedSet.has(`${t}:${track}`);
		const state: TierState = claimed ? "claimed" : t <= currentTier ? "ready" : "locked";
		const xpAway = state === "locked" ? Math.max(0, (t - 1) * per - xp) : 0;
		return { tier: t, state, reward, xpAway };
	};
	const ready = tiers.filter((t) => !claimedSet.has(`${t}:${track}`) && t <= currentTier);
	const locked = tiers.filter((t) => t > currentTier);
	const claimed = tiers.filter((t) => claimedSet.has(`${t}:${track}`));

	const out: number[] = ready.slice(0, rows);
	// A quiet pass leads with the last rung climbed, so the ladder still reads
	// as a ladder rather than three locked doors.
	if (out.length === 0 && claimed.length > 0) out.push(claimed[claimed.length - 1]);
	for (const t of locked) {
		if (out.length >= rows) break;
		out.push(t);
	}
	for (const t of [...claimed].reverse()) {
		if (out.length >= rows) break;
		out.unshift(t);
	}
	return out.sort((a, b) => a - b).map(entry);
}

/** Barn furnishings still to earn on a track — the tail of "See all 26 tiers · 8 more for the Barn". */
export function barnRewardsAhead(
	tiersByNumber: Record<number, { free?: TierRow; premium?: TierRow }>,
	track: PassTrack,
	claimedSet: Set<string>
): number {
	return Object.keys(tiersByNumber)
		.map(Number)
		.filter((t) => tiersByNumber[t]?.[track]?.reward_type === "habitat")
		.filter((t) => !claimedSet.has(`${t}:${track}`)).length;
}
