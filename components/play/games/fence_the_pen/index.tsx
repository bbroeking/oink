// Fence the Pen at the table: the board, the how-to, and the line under each
// pig in the seat strip. Rules: multiplayer/games/fence_the_pen (README.md
// there). The board itself is ./Board.tsx; its numbers are ./layout.ts.

import type { GameUI } from "../../types";
import { fence_the_pen, type FenceView } from "@/multiplayer/games/fence_the_pen/rules";
import { FenceBoard } from "./Board";
import { fenceReactions } from "./reactions";

export const fenceThePenUi: GameUI<FenceView> = {
	id: "fence_the_pen",
	Board: FenceBoard,
	howTo: {
		sentence: fence_the_pen.tagline,
		steps: [
			"On your turn, draw one fence between two posts.",
			"Close a pen and its truffle is yours. Then you draw again.",
			"When every fence is up, the most pens wins. Equal pens share it.",
		],
	},
	// "5 pens" under a pig; nothing at all until it has one (never "0 pens").
	seatStatus: (view, seat) => {
		const pens = view.scores[seat] ?? 0;
		return pens > 0 ? `${pens} ${pens === 1 ? "pen" : "pens"}` : null;
	},
	// The pigs above the yard answer each revision: a jump for a pen and an
	// extra move, a gasp at a sweep, tired after a missed turn, and at the end
	// the winners happy while everyone else waves.
	reactions: fenceReactions,
	seatStrip: "pigs",
	// The board fits the height it is given: the yard takes what the count
	// and the hint leave, so every gap (every move) is always on screen.
	fillsHeight: true,
};
