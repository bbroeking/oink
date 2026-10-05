// Out Looking: the board, the how-to, the line under each seat and the result
// detail. Rules: multiplayer/games/out_looking/rules.ts (README beside it).
// The seat strip is compact because the board stages the pigs itself: they
// wait in the yard, walk out to the places, and meet there.

import type { GameUI } from "../../types";
import { out_looking, type OlView } from "@/multiplayer/games/out_looking/rules";
import { OutLookingBoard } from "./Board";
import { OutLookingResult } from "./ResultDetail";
import { BEAT_AT, seatStatusLine } from "./model";

export const outLookingUi: GameUI<OlView> = {
	id: "out_looking",
	Board: OutLookingBoard,
	howTo: {
		sentence: out_looking.tagline,
		steps: [
			"Every day, pick one place for your pig. Everyone picks at once, and a pick is final.",
			"Alone, your pig takes the whole pile. Pigs who meet take one find each and get a heart.",
			"Every pile grows by one each night, but a pile taken whole rests a night. The heaviest pouch after the last day wins; hearts break a tie.",
		],
	},
	seatStatus: (view, seat) => seatStatusLine(view.weights[seat] ?? 0, view.hearts[seat] ?? 0),
	ResultDetail: OutLookingResult,
	// The result sheet waits for the last day's reveal to play out.
	resultDelayMs: BEAT_AT.done,
	seatStrip: "compact",
	// The board fits the height it is given: the picks and the Send button are
	// pinned at its foot, and the yard scales into what is left (./layout.ts).
	fillsHeight: true,
};
