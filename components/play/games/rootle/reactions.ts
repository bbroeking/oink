// How the pigs in the seat strip answer a Rootle revision (GameUI.reactions):
//
//   a roll of 2 to 6   the roller jumps
//   a bust             the roller turns sad; every other pig at the table
//                      gasps (surprise)
//   a trot home        the roller is happy
//   a missed turn      the roller turns tired
//   the end            the winners are happy; everyone else waves
//
// Read through the same cue reader as the board, so a malformed event is
// skipped here too. In one revision the end comes last and wins the one-shot
// (a pig that busts on the final turn stays sad and waves); a mood is never
// overwritten by a one-shot. A pig who has left the table answers nothing:
// its last turn passes on its behalf, and that is not a nap.

import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { GameEvent, Seat } from "@/multiplayer/types";
import { ROOTLE_TUNING, rootle, type RootleView } from "@/multiplayer/games/rootle/rules";
import type { SeatReaction } from "../../types";
import { readCues } from "./cues";

export function rootleReactions(events: GameEvent[], room: RoomSnapshot<RootleView>): Partial<Record<Seat, SeatReaction>> {
	const cues = readCues(events, room.rev);
	const atTable = room.seats.filter((s) => !s.gone).map((s) => s.seat);
	const out: Partial<Record<Seat, SeatReaction>> = {};
	const react = (seat: Seat, reaction: SeatReaction) => {
		if (atTable.includes(seat)) out[seat] = { ...out[seat], ...reaction };
	};

	if (cues.roll && cues.roll.face !== ROOTLE_TUNING.hungerer) react(cues.roll.seat, { kind: "jump" });
	if (cues.bust) {
		react(cues.bust.seat, { mood: "sad" });
		for (const seat of atTable) if (seat !== cues.bust.seat) react(seat, { kind: "surprise" });
	}
	if (cues.hold) react(cues.hold.seat, { kind: "happy" });
	if (cues.pass && !cues.pass.left) react(cues.pass.seat, { mood: "tired" });
	if (cues.end) {
		// The room's result is the word on who won (it already leaves out a
		// pig who left); the view's own result is the fallback.
		const winners = room.result?.winners ?? (room.view ? (rootle.result(room.view)?.winners ?? []) : []);
		for (const seat of atTable) react(seat, { kind: winners.includes(seat) ? "happy" : "wave" });
	}
	return out;
}
