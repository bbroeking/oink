// The Pen's pure state — what each pig's medallion and card are about, given
// the roster and the errand state. No React, so the send/revert, the board
// cap and the card's one action are unit-testable facts.
import type { ErrandRow, ErrandTuning } from "@/constants/errands";
import type { ErrandState } from "@/utils/errands";
import type { PigRoster, RosterPig } from "@/utils/pigRoster";
import type { PigId } from "@/utils/pigs";

/** The medallion's look on the fence row. */
export type MedallionState = "home" | "out" | "back" | "resting" | "locked";

/** The one action the card offers. */
export type PigCardAction =
	| { kind: "join" } // non-member: Join Slop Club — {pig} moves in
	| { kind: "recruit" } // member, companion slot open
	| { kind: "choice_locked" } // member, companion slot taken by another pig
	| { kind: "send" } // sendable: Send {pig} to look for…
	| { kind: "out"; row: ErrandRow } // out looking: the errand line + Call home
	| { kind: "back"; row: ErrandRow } // on the board: See what it found
	| { kind: "used_today" } // back tomorrow
	| { kind: "board_full" } // resting until you look
	| { kind: "resting" } // a lapsed member's companion
	| { kind: "none" }; // the errand is off: the card is the roster's

export interface PigCardState {
	pig: RosterPig;
	medallion: MedallionState;
	/** The job segment's value; `out` is a readout. */
	job: "home" | "pen" | "out";
	/** Whether the segment may be changed (owned, awake, not out). */
	jobEditable: boolean;
	action: PigCardAction;
	outRow: ErrandRow | null;
	backRow: ErrandRow | null;
}

export function outRowFor(state: ErrandState, pig: PigId): ErrandRow | null {
	return state.out.find((r) => r.pig_id === pig) ?? null;
}

export function backRowFor(state: ErrandState, pig: PigId): ErrandRow | null {
	return state.board.find((r) => r.pig_id === pig) ?? null;
}

export function boardIsFull(state: ErrandState, tuning: ErrandTuning): boolean {
	return state.board.length >= tuning.boardCap;
}

export function pigCardState(
	roster: PigRoster,
	errands: ErrandState,
	tuning: ErrandTuning,
	pigId: PigId,
): PigCardState {
	const pig = roster.pigs.find((p) => p.id === pigId) ?? {
		id: pigId,
		name: pigId,
		coat: "",
		owned: pigId === "rosie",
		selected: false,
		recruitable: false,
	};
	const outRow = outRowFor(errands, pigId);
	const backRow = backRowFor(errands, pigId);
	const isCompanion = pigId !== "rosie";
	const resting = pig.owned && isCompanion && !roster.isMember;
	const active = roster.activePigId === pigId;

	let medallion: MedallionState = "home";
	if (!pig.owned) medallion = "locked";
	else if (resting) medallion = "resting";
	else if (outRow) medallion = "out";
	else if (backRow) medallion = "back";

	const job: PigCardState["job"] = outRow ? "out" : active ? "home" : "pen";
	const jobEditable = pig.owned && !resting && !outRow;

	let action: PigCardAction;
	if (!pig.owned) {
		action = !roster.isMember ? { kind: "join" } : pig.recruitable ? { kind: "recruit" } : { kind: "choice_locked" };
	} else if (resting) {
		action = { kind: "resting" };
	} else if (!errands.enabled) {
		action = { kind: "none" };
	} else if (outRow) {
		action = { kind: "out", row: outRow };
	} else if (backRow) {
		action = { kind: "back", row: backRow };
	} else if (errands.today[pigId]) {
		action = { kind: "used_today" };
	} else if (boardIsFull(errands, tuning)) {
		action = { kind: "board_full" };
	} else {
		action = { kind: "send" };
	}

	return { pig, medallion, job, jobEditable, action, outRow, backRow };
}

/** The paddock note's hand line. */
export function paddockNote(
	roster: PigRoster,
	errands: ErrandState,
	previewName: string | null,
): string {
	const out = errands.out.map((r) => r.pig_id);
	const home = roster.pigs.filter((p) => p.owned && !out.includes(p.id)).map((p) => p.name);
	if (out.length > 0) {
		const outNames = out.map((id) => roster.pigs.find((p) => p.id === id)?.name ?? id);
		const who = outNames.length === 1 ? outNames[0] : outNames.join(" and ");
		return outNames.length === 1 ? `${who} is out looking` : `${who} are out looking`;
	}
	if (errands.board.length > 0) {
		return errands.board.length === 1 ? "one on the board" : `${errands.board.length} on the board`;
	}
	const companion = roster.pigs.find((p) => p.owned && p.id !== "rosie");
	if (companion) return `${companion.name} lives here with Rosie`;
	if (previewName) return `previewing ${previewName}`;
	return home.length ? `${home.join(" and ")} at home` : "the Pen";
}

/** The pigs that may go on an errand right now, for the ticket's picker. */
export function sendablePigs(roster: PigRoster, errands: ErrandState, tuning: ErrandTuning): PigId[] {
	return roster.pigs
		.filter((p) => pigCardState(roster, errands, tuning, p.id).action.kind === "send")
		.map((p) => p.id);
}
