// The window the match screen's clock draws (GameUI.clock). Live, the
// server folds the board's 3 s reveal into the next clue beat's deadline,
// and gives the Guesser back reveal time a fast table did not spend; either
// way the window a pig can act in is the LAST clue (or guess) beat's worth
// of the deadline, so the clock never runs down while the reveal plays.
// By post there is no padding: the room deadline is the window.
import type { RoomSnapshot } from "@/multiplayer/protocol";
import { SNOUT_SAYS_TUNING, type SnoutSaysView } from "@/multiplayer/games/snout_says/rules";

export function snoutSaysClock(view: SnoutSaysView, room: RoomSnapshot<SnoutSaysView>): { opensAt: number; closesAt: number } | null {
	if (view.pace !== "live" || view.phase === "over" || room.deadline === null) return null;
	const beat = view.phase === "clue" ? SNOUT_SAYS_TUNING.clueMs.live : SNOUT_SAYS_TUNING.guessMs.live;
	return { opensAt: room.deadline - beat, closesAt: room.deadline };
}
