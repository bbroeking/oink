// How the seat strip's pigs answer a Snout Says revision (GameUI.reactions).
// The board stays the board; this only makes the pigs above it feel it:
//   picked        that Nose nods (a jump), never saying what it picked
//   cluesRevealed two Noses who showed the same picture giggle (surprise)
//   roundScored   the whole table, together: knew → happy, nearly → jump,
//                 a 0 → surprise (a goofy hiccup, never sad: a miss belongs
//                 to the table, not to one pig)
// Later events in one revision win for a seat, so the last Nose to pick
// and tear in the same step giggles rather than nods. Events come off the
// wire, so every field is checked before it is trusted.
import type { GameEvent, Seat } from "@/multiplayer/types";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { SeatReaction } from "../../types";

function isSeat(value: unknown): value is Seat {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function snoutSaysReactions(events: readonly GameEvent[], room: RoomSnapshot<unknown>): Partial<Record<Seat, SeatReaction>> {
	const out: Partial<Record<Seat, SeatReaction>> = {};
	const atTable = room.seats.filter((s) => !s.gone).map((s) => s.seat);
	for (const e of events) {
		if (e.type === "picked" && isSeat(e.seat)) {
			out[e.seat] = { kind: "jump" };
		} else if (e.type === "cluesRevealed" && Array.isArray(e.said)) {
			for (const c of e.said as unknown[]) {
				const said = c as { seat?: unknown; cancelled?: unknown } | null;
				if (said && said.cancelled === true && isSeat(said.seat)) out[said.seat] = { kind: "surprise" };
			}
		} else if (e.type === "roundScored" && typeof e.score === "number") {
			const kind: SeatReaction["kind"] = e.score >= 2 ? "happy" : e.score === 1 ? "jump" : "surprise";
			for (const seat of atTable) out[seat] = { kind };
		}
	}
	return out;
}
