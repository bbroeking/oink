// Mud Volley's board, how-to and seat lines for the shared match screen
// (components/play/types.ts). The rules live in
// multiplayer/games/mud_volley/rules.ts; the pasture stages the pigs itself,
// so the seat strip above it is compact.

import type { GameUI } from "../../types";
import { mud_volley, type VolleyView } from "@/multiplayer/games/mud_volley/rules";
import { MudVolleyBoard } from "./Board";
import { seatLine } from "./copy";
import { MudVolleyResultDetail } from "./ResultDetail";
import { volleyClock, volleyResultDelay } from "./scene";

export const mudVolleyUi: GameUI<VolleyView> = {
	id: "mud_volley",
	Board: MudVolleyBoard,
	howTo: {
		sentence: mud_volley.tagline,
		steps: [
			"Both pigs can see which way the tosser winds up.",
			"Tossing: follow through for a big splat (2), or flick it another way for a splat (1).",
			"Catching: pick a lane. A clean catch is 1 for you.",
		],
	},
	// Nothing live once the table has ended, even mid-toss (a pig left).
	seatStatus: (view, seat, room) => (room.phase === "ended" ? null : seatLine(view, seat)),
	// The arc shows the 9 s a pig can act in, not the reveal or the grace.
	clock: (view) => volleyClock(view),
	// The result sheet waits for the board's last beat: the last toss landing
	// on a live table (3 s), the whole reel on an opened envelope (15.6 s).
	resultDelayMs: (view) => volleyResultDelay(view),
	ResultDetail: MudVolleyResultDetail,
	seatStrip: "compact",
	// The board fits the height it is given and pins its cards and ticket.
	fillsHeight: true,
};
