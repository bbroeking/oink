// How the pigs in the seat strip answer a Fence the Pen revision
// (GameUI.reactions). The board stays the board; this only says which pig
// does what, read straight off the revision's events and the room:
//   • a pig that keeps a pen and owes another fence jumps (and stays happy
//     for a beat); keeping one without an extra move is a plain happy;
//   • a sweep (two or more pens in one revision) makes the others gasp;
//   • a pig whose turn ran out on the clock looks tired, never sad;
//   • at the end the winners are happy and everyone else waves: losing at
//     this table is a good-game wave, not a slump.
// A pig who left the table never reacts.

import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { GameEvent, Seat } from "@/multiplayer/types";
import type { FenceView } from "@/multiplayer/games/fence_the_pen/rules";
import type { SeatReaction } from "../../types";

/** Pens kept in one revision that make the rest of the table gasp. */
const SWEEP = 2;

const isSeat = (v: unknown): v is Seat => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function fenceReactions(events: GameEvent[], room: RoomSnapshot<FenceView>): Partial<Record<Seat, SeatReaction>> {
	const here = room.seats.filter((s) => !s.gone).map((s) => s.seat);
	const kept = new Map<Seat, number>();
	const again = new Set<Seat>();
	const tired = new Set<Seat>();
	let ended = false;
	for (const e of events) {
		if (e.type === "end") ended = true;
		else if (!isSeat(e.seat)) continue;
		else if (e.type === "pen") kept.set(e.seat, (kept.get(e.seat) ?? 0) + 1);
		else if (e.type === "again") again.add(e.seat);
		else if (e.type === "timeout") tired.add(e.seat);
	}

	const out: Partial<Record<Seat, SeatReaction>> = {};
	if (ended) {
		const winners = topSeats(room, here);
		for (const s of here) out[s] = winners.includes(s) ? { kind: "happy", mood: "happy" } : { kind: "wave" };
		return out;
	}
	let sweep = false;
	for (const [s, n] of kept) {
		if (!here.includes(s) || tired.has(s)) continue;
		out[s] = again.has(s) ? { kind: "jump", mood: "happy" } : { kind: "happy", mood: "happy" };
		if (n >= SWEEP) sweep = true;
	}
	if (sweep) {
		for (const s of here) if (!out[s] && !tired.has(s)) out[s] = { kind: "surprise" };
	}
	for (const s of tired) if (here.includes(s)) out[s] = { mood: "tired" };
	return out;
}

/** Who finished on top: the room's own result when it has one (the engine
 *  has already set aside any pig who left), else the most pens on the view. */
function topSeats(room: RoomSnapshot<FenceView>, here: Seat[]): Seat[] {
	const result = room.result;
	if (result && (result.kind === "win" || result.kind === "draw")) return result.winners.length > 0 ? result.winners : here;
	const scores = room.view?.scores;
	if (!scores) return [];
	const best = Math.max(...here.map((s) => scores[s] ?? 0));
	return here.filter((s) => (scores[s] ?? 0) === best);
}
