// What the live board and the envelope board share: who is at the table,
// what each pig has worn so far, and how the pigs react to a toss. Pure
// functions of the view and the room, plus one small hook for the reaction
// choreography (a reaction may chain into a second one: the winner's happy
// loop, then a wave).

import { useCallback, useRef, useState } from "react";
import type { PigReaction, PigReactionKind } from "@/components/ui";
import type { PigLook, RoomSnapshot } from "@/multiplayer/protocol";
import type { Seat } from "@/multiplayer/types";
import { VOLLEY_TIMING, type VolleyRow, type VolleyView } from "@/multiplayer/games/mud_volley/rules";

/** Compact chrome caps Dynamic Type here (the visit's cap). */
export const VOLLEY_TYPE_CAP = 1.3;

/** Refusals that mean "the table already moved on": the next view says it
 *  all, so they get no toast. */
export const QUIET_ERRORS: ReadonlySet<string> = new Set(["illegal_move", "not_your_turn", "stale", "game_over"]);

/** An envelope can be waiting for a pig nobody has met yet. */
export const OPEN_CHAIR_NAME = "the next pig";

export function seatName(room: RoomSnapshot<VolleyView>, seat: Seat): string {
	return room.seats.find((s) => s.seat === seat)?.name ?? OPEN_CHAIR_NAME;
}

/** Null for an open chair: the pasture draws an empty spot, not a guess. */
export function seatLook(room: RoomSnapshot<VolleyView>, seat: Seat): PigLook | null {
	return room.seats.find((s) => s.seat === seat)?.look ?? null;
}

/** The window the match screen's clock draws (GameUI.clock): a live toss's
 *  visible commit window, never the room deadline, which also holds the
 *  reveal beat and the late grace. Null (the room deadline) for the
 *  envelope and for a finished table. */
export function volleyClock(view: VolleyView): { opensAt: number; closesAt: number } | null {
	if (view.mode !== "live" || view.phase !== "commit") return null;
	if (view.commitOpensAt === null || view.commitClosesAt === null) return null;
	return { opensAt: view.commitOpensAt, closesAt: view.commitClosesAt };
}

/** One toss of the envelope reel: the arc, then the splat or the catch. */
export const REEL_STEP_MS = VOLLEY_TIMING.revealMs;

/** How long the match screen holds the result sheet (GameUI.resultDelayMs):
 *  on a live table, the last toss's beat (the settle and the reveal); on an
 *  envelope, the whole reel, one step per resolved toss (none if the table
 *  closed before the envelopes were opened). */
export function volleyResultDelay(view: VolleyView): number {
	if (view.mode === "envelope") return view.history.length * REEL_STEP_MS;
	return VOLLEY_TIMING.settleMs + VOLLEY_TIMING.revealMs;
}

/** Points by seat over some rows (the reel's running score). */
export function scoreOf(rows: readonly VolleyRow[]): number[] {
	const out = [0, 0];
	for (const row of rows) out[row.scorer] += row.points;
	return out;
}

/** Splats each seat has worn: every splat lands on the catcher. */
export function mudOf(rows: readonly VolleyRow[]): number[] {
	const out = [0, 0];
	for (const row of rows) if (row.outcome !== "catch") out[1 - row.attacker]++;
	return out;
}

type ReactionPlan = Record<number, PigReactionKind[]>;

/** A splat is a joke on the body: the catcher is surprised by a big one and
 *  shrugs off a flick; a catch is the catcher's own moment. */
export function revealReactions(row: VolleyRow): ReactionPlan {
	const tosser = row.attacker;
	const catcher = 1 - row.attacker;
	if (row.outcome === "catch") return { [catcher]: ["happy"], [tosser]: ["surprise"] };
	if (row.outcome === "splat2") return { [catcher]: ["surprise"], [tosser]: ["happy"] };
	return { [catcher]: ["jump"], [tosser]: ["happy"] };
}

/** The end: both pigs wave; the winner gets one happy loop first. */
export function finalReactions(score: readonly number[]): ReactionPlan {
	if (score[0] === score[1]) return { 0: ["wave"], 1: ["wave"] };
	const winner = score[0] > score[1] ? 0 : 1;
	return { [winner]: ["happy", "wave"], [1 - winner]: ["wave"] };
}

export function useReactions() {
	const [reactions, setReactions] = useState<Record<number, PigReaction | null>>({});
	const nextId = useRef(1);
	const queued = useRef<Record<number, PigReactionKind | null>>({});

	const play = useCallback((plan: ReactionPlan) => {
		const out: Record<number, PigReaction | null> = {};
		for (const [key, kinds] of Object.entries(plan)) {
			const seat = Number(key);
			const [first, then] = kinds;
			queued.current[seat] = then ?? null;
			out[seat] = first ? { id: nextId.current++, kind: first } : null;
		}
		setReactions((r) => ({ ...r, ...out }));
	}, []);

	const done = useCallback((seat: Seat) => {
		const then = queued.current[seat] ?? null;
		queued.current[seat] = null;
		const reaction = then ? { id: nextId.current++, kind: then } : null;
		setReactions((r) => ({ ...r, [seat]: reaction }));
	}, []);

	return { reactions, play, done };
}
