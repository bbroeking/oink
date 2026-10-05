// The animation cues a Rootle revision carries, read once off the room's
// `events` and typed. Events are presentation only: a dropped or malformed
// one is simply skipped, and the board still draws everything from the view.

import { useState } from "react";
import type { GameEvent, Seat } from "@/multiplayer/types";

export interface RollCue {
	seat: Seat;
	face: number;
	basket: number;
}

export interface BustCue {
	seat: Seat;
	lost: number;
}

export interface HoldCue {
	seat: Seat;
	banked: number;
	barn: number;
}

export interface RootleCues {
	/** The revision these cues belong to. */
	rev: number;
	roll: RollCue | null;
	bust: BustCue | null;
	hold: HoldCue | null;
	lastRound: { leader: Seat } | null;
	turn: { seat: Seat; last: boolean } | null;
	pass: { seat: Seat; left: boolean } | null;
	end: boolean;
}

const isNum = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function readCues(events: readonly GameEvent[], rev: number): RootleCues {
	const cues: RootleCues = { rev, roll: null, bust: null, hold: null, lastRound: null, turn: null, pass: null, end: false };
	for (const e of events) {
		switch (e.type) {
			case "roll":
				if (isNum(e.seat) && isNum(e.face) && isNum(e.basket)) cues.roll = { seat: e.seat, face: e.face, basket: e.basket };
				break;
			case "bust":
				if (isNum(e.seat) && isNum(e.lost)) cues.bust = { seat: e.seat, lost: e.lost };
				break;
			case "hold":
				if (isNum(e.seat) && isNum(e.banked) && isNum(e.barn)) cues.hold = { seat: e.seat, banked: e.banked, barn: e.barn };
				break;
			case "lastRound":
				if (isNum(e.leader)) cues.lastRound = { leader: e.leader };
				break;
			case "turn":
				if (isNum(e.seat)) cues.turn = { seat: e.seat, last: e.last === true };
				break;
			case "pass":
				if (isNum(e.seat)) cues.pass = { seat: e.seat, left: e.left === true };
				break;
			case "end":
				cues.end = true;
				break;
			default:
				break;
		}
	}
	return cues;
}

/**
 * The cues of the latest revision this board has SEEN arrive: null on the
 * mount render, so a board that mounts mid-game replays nothing. The object
 * keeps its identity until the next revision, so a child can key a one-shot
 * animation on `cues.roll` (or any part) and play it exactly once.
 */
export function useFreshCues(rev: number, events: readonly GameEvent[]): RootleCues | null {
	const [seen, setSeen] = useState<{ rev: number; cues: RootleCues | null }>({ rev, cues: null });
	if (seen.rev !== rev) {
		const next = { rev, cues: readCues(events, rev) };
		setSeen(next);
		return next.cues;
	}
	return seen.cues;
}
