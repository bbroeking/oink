// Mud Volley's words. Every line the board says is a pure function of the
// view, so the board stays a drawing and the copy is testable on its own.
// House voice: the hand line states the whole rule in context; numbers are
// points (progress), never feelings; a loss is a joke on the body, never a
// shame; no em dash anywhere a pig can read.

import {
	VOLLEY_PAYOFF,
	envelopeSlots,
	lanePoints,
	type Lane,
	type VolleyRole,
	type VolleyRow,
	type VolleyView,
} from "@/multiplayer/games/mud_volley/rules";
import type { Seat } from "@/multiplayer/types";

export const LANE_WORD: Record<Lane, string> = { L: "left", M: "middle", R: "right" };
export const LANE_TITLE: Record<Lane, string> = { L: "Left", M: "Middle", R: "Right" };

/** Which painted piece a payoff wears. */
export type VolleyMark = "splatBig" | "splatSmall" | "bucket";

export interface LanePayoff {
	points: number;
	/** The card's line: "big splat · 2". */
	label: string;
	/** The ticket stub's caption: "big splat". */
	caption: string;
	mark: VolleyMark;
}

/** What a lane card pays the pig picking it, if it lands. */
export function lanePayoff(role: VolleyRole, lane: Lane, windup: Lane): LanePayoff {
	const points = lanePoints(role, lane, windup);
	if (role === "catch") return { points, label: `catch · ${points}`, caption: "catch", mark: "bucket" };
	if (points === VOLLEY_PAYOFF.bigSplat) return { points, label: `big splat · ${points}`, caption: "big splat", mark: "splatBig" };
	return { points, label: `splat · ${points}`, caption: "splat", mark: "splatSmall" };
}

/** The painted piece that lands for an outcome. */
export function outcomeMark(row: VolleyRow): VolleyMark {
	return row.outcome === "catch" ? "bucket" : row.outcome === "splat2" ? "splatBig" : "splatSmall";
}

/** The one hand line for an open live toss: the whole rule, in context. */
export function promptLine(view: VolleyView, rival: string): string {
	if (view.role === null || view.windup === null) return "";
	const way = LANE_WORD[view.windup];
	if (view.yourLane !== null) {
		return view.role === "toss" ? `Your toss is sealed. ${rival} is picking a catch.` : `Your catch is set. ${rival} is picking a toss.`;
	}
	return view.role === "toss"
		? `You're winding up ${way}. Follow through, or flick it?`
		: `${rival}'s winding up ${way}. Where will you catch?`;
}

/** What just happened, from your side of the puddle. The scorer is always
 *  the one the line praises; your own clock-thrown lane is owned up to. */
export function revealLine(row: VolleyRow, you: Seat, rival: string): string {
	const youTossed = row.attacker === you;
	const way = LANE_WORD[row.toss];
	let line: string;
	if (row.outcome === "splat2") {
		line = youTossed ? `Big splat! You followed through. +${row.points} to you.` : `${rival} followed through. Big splat, +${row.points} to ${rival}.`;
	} else if (row.outcome === "splat1") {
		line = youTossed ? `Splat! You flicked it ${way}. +${row.points} to you.` : `${rival} flicked it ${way}. Splat, +${row.points} to ${rival}.`;
	} else {
		line = youTossed ? `${rival} was waiting ${way}. Caught! +${row.points} to ${rival}.` : `Clean catch on the ${way}! +${row.points} to you.`;
	}
	if (row.fallback[you]) line += youTossed ? " Your pig lobbed it anyhow." : " Your pig hopped somewhere.";
	return line;
}

/** The last line of a live match, under the result sheet. */
export function finalLine(view: VolleyView, rival: string): string {
	const mine = view.score[view.you] ?? 0;
	const theirs = view.score[view.rival] ?? 0;
	if (mine === theirs) return `A draw, ${mine} to ${theirs}. Both pigs go home muddy.`;
	return mine > theirs ? `You take it, ${mine} to ${theirs}. Both pigs go home muddy.` : `${rival} takes it, ${theirs} to ${mine}. Both pigs go home muddy.`;
}

/** "toss 3 of 6", while a toss is open. */
export function tossCounter(view: VolleyView): string {
	return `toss ${Math.min(view.exchange + 1, view.exchanges)} of ${view.exchanges}`;
}

// ── The envelope ─────────────────────────────────────────────────────────────

/** One decision in the sealed form: your three tosses first (against your
 *  own wind-ups), then your three catches (against theirs). */
export interface EnvelopeStep {
	role: VolleyRole;
	/** 0..2 within its role. */
	index: number;
	/** The toss it decides. */
	ex: number;
	windup: Lane;
}

export function envelopeSteps(view: VolleyView): EnvelopeStep[] {
	const windups = view.windups ?? [];
	const { tossExchanges, catchExchanges } = envelopeSlots(view.firstAttacker, view.you);
	return [
		...tossExchanges.map((ex, index) => ({ role: "toss" as const, index, ex, windup: windups[ex] })),
		...catchExchanges.map((ex, index) => ({ role: "catch" as const, index, ex, windup: windups[ex] })),
	].filter((step): step is EnvelopeStep => step.windup !== undefined);
}

export function envelopeStepLine(step: EnvelopeStep): string {
	const way = LANE_WORD[step.windup];
	return step.role === "toss"
		? `Toss ${step.index + 1} of 3. You wind up ${way}. Follow through, or flick it?`
		: `Catch ${step.index + 1} of 3. They wind up ${way}. Where will you catch?`;
}

/** The review row's slot label: "T1" for a toss, "C1" for a catch. */
export function envelopeSlotLabel(step: EnvelopeStep): string {
	return `${step.role === "toss" ? "T" : "C"}${step.index + 1}`;
}

export const ENVELOPE_WAITING = "Your toss is sealed. We'll tell you when a pig opens it.";

// ── Status and the ledger ────────────────────────────────────────────────────

/** The seat strip's line under each pig: the rival's visible thinking and
 *  locked states, and your own lock. Never a zero shamed in public. */
export function seatLine(view: VolleyView, seat: Seat): string | null {
	if (view.phase === "done") return null;
	const mine = seat === view.you;
	if (view.mode === "envelope") {
		const sealed = mine ? view.yourEnvelope !== null : view.rivalLocked;
		return sealed ? "sealed" : null;
	}
	const locked = mine ? view.yourLane !== null : view.rivalLocked;
	return locked ? "locked in" : mine ? null : "thinking";
}

/** A table the room closed before six tosses (a pig headed home, or both
 *  dozed off). The result sheet says why; the board only stops asking. */
export const TABLE_CLOSED = "The table's packed up. Both pigs head home.";

/** One ledger line, its scorer the subject: "You followed through". */
export function ledgerLine(row: VolleyRow, you: Seat, rival: string): string {
	const who = (seat: Seat) => (seat === you ? "You" : rival);
	const way = LANE_WORD[row.toss];
	if (row.outcome === "splat2") return `${row.ex + 1}. ${who(row.attacker)} followed through`;
	if (row.outcome === "splat1") return `${row.ex + 1}. ${who(row.attacker)} flicked it ${way}`;
	return `${row.ex + 1}. ${who(row.scorer)} caught it ${way}`;
}
