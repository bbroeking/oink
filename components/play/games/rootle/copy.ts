// Every word the Rootle board says, as pure functions of the view and the
// table, so the board stays a renderer and the copy is testable on its own.
// House voice: the status line is the one capitalised sentence; everything
// else is the hand voice, lower case. No em dash anywhere (a full stop, a
// colon or " · " instead), no emoji, and never a bare zero in public.

import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { Seat } from "@/multiplayer/types";
import {
	ROOTLE_TUNING,
	rootle,
	rootleBestOther,
	rootleCanTrotHome,
	rootleTurnHaul,
	rootleUpNext,
	type RootleTurn,
	type RootleView,
} from "@/multiplayer/games/rootle/rules";
import type { RootleCues } from "./cues";

/** Your own seat's name on this board. */
export const YOU = "You";
/** An async chair nobody has taken yet. */
const OPEN_CHAIR = "a pig on the way";

/** What the copy needs to know about the table, beyond the view. */
export interface TableFacts {
	you: Seat;
	/** One name per seat; your own seat reads "You". */
	names: string[];
	/** False once that pig has left the table for good. */
	present: boolean[];
	/** False for an async chair still waiting for its pig. */
	filled: boolean[];
	/** The room has ended (played out, or a forfeit). */
	ended: boolean;
}

export function tableFacts(view: RootleView, room: RoomSnapshot<RootleView>, you: Seat): TableFacts {
	const info = (seat: Seat) => room.seats.find((s) => s.seat === seat) ?? null;
	const seats = Array.from({ length: view.seats }, (_, seat) => seat);
	return {
		you,
		names: seats.map((seat) => {
			if (seat === you) return YOU;
			const taken = info(seat);
			return taken ? taken.name.trim() || "a pig" : OPEN_CHAIR;
		}),
		present: seats.map((seat) => !info(seat)?.gone),
		filled: seats.map((seat) => info(seat) !== null),
		ended: room.phase === "ended" || view.over,
	};
}

// ── The board's lines ────────────────────────────────────────────────────────

/** The one hand-voice line over the controls: whose turn, and for your own
 *  turn what trotting home now would do. */
export function statusLine(view: RootleView, t: TableFacts): string {
	if (t.ended) return "The barns are counted";
	const seat = view.turn;
	if (seat === t.you) {
		const rolled = view.faces.length > 0;
		const total = view.barn[seat] + view.basket;
		if (view.lastRound) {
			const best = rootleBestOther(view, seat, t.present);
			if (total > best) return rolled ? `Trot home now to lead with ${total}` : "Your last turn · you're ahead";
			return `Your last turn · ${best} to beat`;
		}
		if (rolled && total >= view.target) return `Trot home now to reach ${view.target}`;
		return rolled ? "Your turn · roll again or trot home" : "Your turn";
	}
	if (!t.filled[seat]) return "Waiting for a pig to pull up a chair";
	const name = t.names[seat];
	return view.lastRound ? `${name}'s last turn…` : `${name} is rootling…`;
}

/** The widest line `statusLine` can say at this table, so the board reserves
 *  its slot once rather than jumping when a long name's turn comes round: the
 *  longest fixed line, or the longest name rootling. */
export function widestStatus(t: TableFacts): string {
	const lines = [
		"Your turn · roll again or trot home",
		"Waiting for a pig to pull up a chair",
		`Trot home now to lead with ${ROOTLE_TUNING.target * 2}`,
		...t.names.flatMap((name, seat) => (seat === t.you ? [] : [`${name} is rootling…`, `${name}'s last turn…`])),
	];
	return lines.reduce((widest, line) => (line.length > widest.length ? line : widest), "");
}

/** The quiet line in the thumb zone while it is someone else's turn: where
 *  you stand in the order. Null on your own turn and once the game is done. */
export function waitingLine(view: RootleView, t: TableFacts): string | null {
	if (t.ended || view.turn === t.you || !t.present[t.you]) return null;
	const order = rootleUpNext(view, t.present);
	const at = order.indexOf(t.you);
	const before = at > 0 ? t.names[order[at - 1]] : null;
	if (view.lastRound) {
		if (view.lastRound.leader === t.you) return `you set the mark at ${view.barn[t.you]}`;
		if (at === 0) return "your last turn is next";
		if (before) return `your last turn comes after ${before}`;
		return "your last turn is done";
	}
	if (at === 0) return "you're next";
	return before ? `you rootle after ${before}` : null;
}

/** The line under a pig in the seat strip. Its barn, or what it is doing on
 *  its turn; never a bare zero (null instead). */
export function seatLine(view: RootleView, seat: Seat, gone: boolean, ended = false): string | null {
	const barn = view.barn[seat] ?? 0;
	if (gone) return barn > 0 ? `trotted off · ${barn} in the barn` : "trotted off";
	// A table that ended mid-turn (the other pig left) keeps its view's turn,
	// so the result sheet would say "rolling…" under the winner.
	if (!view.over && !ended && seat === view.turn) {
		const doing = view.lastRound ? "last turn" : "rolling";
		return view.faces.length > 0 ? `${doing} · ${view.basket} in the basket` : `${doing}…`;
	}
	return barn > 0 ? `${barn} in the barn` : null;
}

// ── The turn strip ───────────────────────────────────────────────────────────

/** The faces a turn paid, joined: "4 · 6 · 3". The Hungerer that ended a
 *  bust is drawn, not written, so it is left out here. */
export function turnPips(turn: RootleTurn): string {
	return turn.faces.filter((face) => face !== ROOTLE_TUNING.hungerer).join(" · ");
}

export function turnOutcome(turn: RootleTurn, gone: boolean): string {
	if (turn.end === "hold") return `home with ${turn.banked}`;
	if (turn.end === "bust") {
		const haul = rootleTurnHaul(turn);
		return haul > 0 ? `Hungerer ate ${haul}` : "Hungerer, first roll";
	}
	// A pass with faces in it only happens when the pig left mid-turn.
	return gone || turn.faces.length > 0 ? "trotted off" : "dozed off";
}

/** One strip row, read aloud. */
export function turnSpoken(turn: RootleTurn, name: string, gone: boolean): string {
	const pips = turn.faces.filter((face) => face !== ROOTLE_TUNING.hungerer);
	const rolled = pips.length > 0 ? `rolled ${pips.join(", ")}` : null;
	if (turn.end === "hold") return `${name}, ${rolled ?? "rolled"}, home with ${turn.banked}`;
	if (turn.end === "bust") {
		return rolled ? `${name}, ${rolled}, then the Hungerer ate ${rootleTurnHaul(turn)}` : `${name}, the Hungerer on the first roll`;
	}
	return `${name}, ${turnOutcome(turn, gone)}`;
}

// ── The die and the haul, read aloud ─────────────────────────────────────────

/** "Your" for your own seat, "Clover's" for anyone else. */
export function ownerOf(name: string): string {
	return name === YOU ? "Your" : `${name}'s`;
}

export function dieSpoken(face: number | null): string {
	if (face === null) return "The die, not rolled yet";
	return face === ROOTLE_TUNING.hungerer ? "The die shows the Hungerer" : `The die shows ${face}`;
}

export function basketSpoken(owner: string, basket: number, eaten: boolean): string {
	if (eaten) return `${ownerOf(owner)} basket: the Hungerer ate ${basket}`;
	return basket > 0 ? `${ownerOf(owner)} basket: ${basket}` : `${ownerOf(owner)} basket: empty`;
}

export function barnSpoken(owner: string, barn: number, target: number): string {
	return barn > 0 ? `${ownerOf(owner)} barn: ${barn} of ${target}` : `${ownerOf(owner)} barn: nothing yet`;
}

// ── Controls ─────────────────────────────────────────────────────────────────

export const ROOTLE_HINT = "Rolls the die. A 2 to 6 goes in your basket. The Hungerer eats the basket and ends your turn.";

export function trotHomeLabel(view: RootleView, seat: Seat): string {
	return rootleCanTrotHome(view, seat) ? `Trot home with ${view.basket}` : "Trot home";
}

export function trotHomeHint(view: RootleView, seat: Seat): string {
	return rootleCanTrotHome(view, seat)
		? `Puts the ${view.basket} in your basket into your barn and ends your turn`
		: "Roll the die at least once first";
}

// ── Screen reader ────────────────────────────────────────────────────────────

/** What a revision did, said once for VoiceOver. Null when it did nothing a
 *  listener needs to hear. */
export function announcement(cues: RootleCues, view: RootleView, t: TableFacts): string | null {
	const who = (seat: Seat) => t.names[seat] ?? "A pig";
	const lines: string[] = [];
	if (cues.roll && cues.roll.face !== ROOTLE_TUNING.hungerer) {
		lines.push(`${who(cues.roll.seat)} rolled ${cues.roll.face}. ${cues.roll.basket} in the basket.`);
	}
	if (cues.bust) {
		lines.push(
			cues.bust.lost > 0
				? `${who(cues.bust.seat)} rolled the Hungerer. He ate ${cues.bust.lost}.`
				: `${who(cues.bust.seat)} rolled the Hungerer.`,
		);
	}
	if (cues.hold) lines.push(`${who(cues.hold.seat)} trotted home with ${cues.hold.banked}. ${cues.hold.barn} in the barn.`);
	if (cues.pass) lines.push(`${who(cues.pass.seat)} ${cues.pass.left ? "trotted off" : "dozed off"}.`);
	if (cues.lastRound) lines.push(`${who(cues.lastRound.leader)} reached ${view.target}. Everyone else gets one last turn.`);
	if (cues.turn) {
		const last = cues.turn.last ? "last turn" : "turn";
		lines.push(cues.turn.seat === t.you ? `Your ${last}.` : `${who(cues.turn.seat)}'s ${last}.`);
	}
	if (cues.end) lines.push("That's the game.");
	return lines.length > 0 ? lines.join(" ") : null;
}

// ── How to play ──────────────────────────────────────────────────────────────

export const ROOTLE_HOW_TO = {
	sentence: rootle.tagline,
	steps: [
		"Rootle to roll the die. A 2 to 6 drops that many truffles in your basket.",
		"Roll the Hungerer and he eats the basket. Trot home any time to keep it in your barn.",
		`The first pig home with ${ROOTLE_TUNING.target} starts the last round: everyone else gets one more turn, then the biggest barn wins.`,
	],
};
