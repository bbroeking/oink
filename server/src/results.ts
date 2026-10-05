// A finished table → play_results rows, and whether it moves hidden ratings.
// Pure, so the mapping (the thing the public wins board counts) is pinned by
// tests without a database.

import type { AnyGame, GameKind, Seat } from "../../multiplayer/types";
import type { RoomResult } from "../../multiplayer/protocol";
import type { EngineSeat, RoomState } from "../../multiplayer/engine";
import { periodOf, type Outcome, type ResultRow } from "./store/types";

/** One seat's line on the board. The engine (finalResult) has already taken
 *  departed pigs out of `winners`, so this never re-derives who won:
 *    no_contest            → no_contest (ended early, or the server's fault)
 *    a social game         → shared (nobody wins a social game)
 *    coop                  → coop_success when the table made it, else coop_short
 *    draw                  → draw for the seats sharing the top place (every
 *                            seat when `winners` is empty), loss for the rest
 *    win                   → win for the winners, loss for the rest */
export function outcomeFor(result: RoomResult, kind: GameKind, seat: Seat): Outcome {
	if (result.kind === "no_contest") return "no_contest";
	if (kind === "social") return "shared";
	if (result.kind === "coop" || kind === "cooperative") return result.success === true ? "coop_success" : "coop_short";
	if (result.kind === "draw") return result.winners.length === 0 || result.winners.includes(seat) ? "draw" : "loss";
	return result.winners.includes(seat) ? "win" : "loss";
}

/** One row per seated pig. Empty when the table never really happened (a
 *  lobby that closed, or an open seat nobody ever took). */
export function resultRows(state: RoomState, game: AnyGame, endedAt: number): ResultRow[] {
	const result = state.result;
	if (!result || state.game === null) return [];
	const seated = state.seats.flatMap((s, i) => (s ? [{ seat: i, occupant: s }] : []));
	if (seated.length < 2) return [];
	return seated.map(({ seat, occupant }) => {
		const score = result.scores[seat];
		return {
			matchId: state.roomId,
			userId: occupant.userId,
			game: state.gameId,
			seat,
			outcome: outcomeFor(result, game.kind, seat),
			score: typeof score === "number" && Number.isFinite(score) ? Math.round(score) : null,
			reason: result.reason,
			opponents: seated.filter((s) => s.seat !== seat).map((s) => s.occupant.userId),
			period: periodOf(endedAt),
			endedAt,
		};
	});
}

/** The two pigs and seat 0's score (1 win, 0.5 draw, 0 loss) when this table
 *  moves hidden ratings: competitive, exactly two seats, decided by play or
 *  by forfeit. Null otherwise. */
export function ratedPair(state: RoomState, game: AnyGame): { a: EngineSeat; b: EngineSeat; scoreA: number } | null {
	const result = state.result;
	if (game.kind !== "competitive" || !result || state.game === null) return null;
	if (result.reason !== "complete" && result.reason !== "forfeit") return null;
	if (result.kind !== "win" && result.kind !== "draw") return null;
	const [a, b] = state.seats;
	if (state.seats.length !== 2 || !a || !b) return null;
	if (result.kind === "draw") return { a, b, scoreA: 0.5 };
	const aWon = result.winners.includes(0);
	const bWon = result.winners.includes(1);
	return { a, b, scoreA: aWon === bWon ? 0.5 : aWon ? 1 : 0 };
}
