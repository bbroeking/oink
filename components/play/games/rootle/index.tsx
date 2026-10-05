// Rootle's board and how-to, for the match screen (components/play/types.ts).
// The rules live in multiplayer/games/rootle/rules.ts; the board only draws
// the view and sends `roll` / `hold`.

import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { Seat } from "@/multiplayer/types";
import type { RootleView } from "@/multiplayer/games/rootle/rules";
import type { GameUI } from "../../types";
import { RootleBoard } from "./Board";
import { ROOTLE_HOW_TO, seatLine, tableFacts } from "./copy";
import { rootleReactions } from "./reactions";
import { TurnStrip } from "./TurnStrip";

/** The result sheet's extra: the last turns, so a finish reads as a story. */
function RootleResultDetail({ view, room, you }: { view: RootleView; room: RoomSnapshot<RootleView>; you: Seat }) {
	const facts = tableFacts(view, room, you);
	return <TurnStrip log={view.log} names={facts.names} present={facts.present} title="how it ended" />;
}

export const rootleUi: GameUI<RootleView> = {
	id: "rootle",
	Board: RootleBoard,
	howTo: ROOTLE_HOW_TO,
	seatStatus: (view, seat, room) =>
		seatLine(view, seat, room.seats.some((s) => s.seat === seat && s.gone), room.phase === "ended"),
	ResultDetail: RootleResultDetail,
	reactions: rootleReactions,
	seatStrip: "pigs",
	// The board fits the height it is given and pins Rootle and Trot home at
	// its foot (./layout rootleFit).
	fillsHeight: true,
};
