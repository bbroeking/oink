// Snout Says on the match screen: the board, the how-to, the clue bubble
// floated over each Nose's pig, a status line under each pig, the pigs'
// reactions, the clock's visible window, and the result sheet's ledger.
// Rules: multiplayer/games/snout_says/rules.ts; what each piece does:
// ./README.md beside the rules.
import type { SnoutSaysView } from "@/multiplayer/games/snout_says/rules";
import type { GameUI } from "../../types";
import { REVEAL_MS, SnoutSaysBoard } from "./Board";
import { SnoutSaysSeatBubble } from "./ClueBubble";
import { snoutSaysClock } from "./clock";
import { snoutSaysReactions } from "./reactions";
import { SnoutSaysResultDetail } from "./ResultDetail";

export const snoutSaysUi: GameUI<SnoutSaysView> = {
	id: "snout_says",
	Board: SnoutSaysBoard,
	howTo: {
		sentence: "Show me one picture that reminds you of it, and I'll guess which one you mean.",
		steps: [
			"One pig guesses from nine pictures. Every other pig is a Nose and knows the answer.",
			"Each Nose shows one picture that reminds them of it. Two Noses who show the same one cancel out.",
			"Two taps to guess: right first is 2, right second is 1. The whole table shares the total.",
		],
	},
	seatStrip: "pigs",
	// The board fits the height it is given and pins the taps that answer a
	// turn (the spread, the tray and Show this one) at its foot.
	fillsHeight: true,
	// The bubble over the pig carries the seal and the clue; the line under
	// it only says what the bubble cannot: who guesses, and who is still
	// thinking. Never a picture before the clue beat closes; never a zero.
	seatStatus: (view, seat, room) => {
		// A table that ended mid-round (a pig left) is over too.
		if (view.phase === "over" || room.phase === "ended") return null;
		if (seat === view.guesser) return view.phase === "guess" ? "guessing" : "guesser";
		if (view.said) return null;
		return view.noses.find((n) => n.seat === seat)?.status === "thinking" ? "thinking" : null;
	},
	seatBubble: SnoutSaysSeatBubble,
	reactions: snoutSaysReactions,
	clock: snoutSaysClock,
	// The last round's reveal plays before the result sheet.
	resultDelayMs: REVEAL_MS,
	ResultDetail: SnoutSaysResultDetail,
};
