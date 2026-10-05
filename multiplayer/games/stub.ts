// A placeholder game: every seat says "ready" once, in seat order, and the
// table draws. It exists only so the registry, the server catalog, the e2e
// harness and the screens work end to end while each real rules module is
// being written. A stub is marked by rulesVersion 0; nothing ships with one.

import type { GameDefinition, GameId, GameKind, Pace, Seat } from "../types";
import { actionType } from "../validate";

export interface StubState {
	ready: boolean[];
	turn: Seat;
}

export function stubGame(meta: {
	id: GameId;
	title: string;
	tagline: string;
	seats: { min: number; max: number };
	kind: GameKind;
	paces: Pace[];
}): GameDefinition<StubState, { type: "ready" }, StubState> {
	return {
		...meta,
		rulesVersion: 0,
		decisionMs: { live: 15_000, async: 12 * 3_600_000 },
		setup: ({ seats }) => ({ ready: Array.from({ length: seats }, () => false), turn: 0 }),
		activeSeats: (s) => (s.ready.every(Boolean) ? [] : [s.turn]),
		apply: (s, seat) => {
			if (seat !== s.turn) return { ok: false, error: "not_your_turn" };
			const ready = s.ready.map((r, i) => r || i === seat);
			return { ok: true, state: { ready, turn: Math.min(seat + 1, s.ready.length - 1) }, events: [{ type: "ready", seat }] };
		},
		onTimeout: (s, seat) => ({ state: { ready: s.ready.map((r, i) => r || i === seat), turn: Math.min(seat + 1, s.ready.length - 1) } }),
		view: (s) => s,
		result: (s) =>
			s.ready.every(Boolean)
				? meta.kind === "competitive"
					? { kind: "draw", winners: [], scores: s.ready.map(() => 0), summary: "everyone was ready" }
					: { kind: "coop", winners: s.ready.map((_, i) => i), scores: s.ready.map(() => 0), success: true, summary: "everyone was ready" }
				: null,
		bot: (v, seat) => (v.turn === seat && !v.ready[seat] ? { type: "ready" } : null),
		parseAction: (raw) => (actionType(raw, ["ready"] as const) ? { type: "ready" } : null),
	};
}
