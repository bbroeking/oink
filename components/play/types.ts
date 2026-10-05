// The contract between the shared match screen and each game's board.
//
// The match screen (components/play/MatchScreen.tsx) owns everything every
// table has: the pigs on their ground line, names, whose turn it is, the clock,
// emotes, the countdown, the result sheet, rematch and leaving. A game owns
// only its board — the thing in the middle you look at and touch — plus a
// one-sentence how-to and an optional status line under each pig.
//
// A board is a pure function of the seat's `view` (what the server says this
// pig may see). It never computes rules, never decides legality and never
// applies an action locally: it calls `act(action)` and waits for the next
// view. Local feedback while an action is in flight (a pressed tile, a lifted
// card, a squash) is fine and expected — the world responds now — but the
// result always comes from the server's next revision.

import type { ComponentType } from "react";
import type { PigReactionKind } from "@/components/ui";
import type { GameEvent, GameId, Seat } from "@/multiplayer/types";
import type { ProtocolErrorCode, RoomSnapshot } from "@/multiplayer/protocol";

export type ActResult = { ok: true } | { ok: false; error: ProtocolErrorCode };

export interface BoardProps<V = unknown> {
	/** This seat's projection of the game state. */
	view: V;
	/** The whole table: seats (names, looks, presence), phase, deadline, rev. */
	room: RoomSnapshot<V>;
	/** The local player's seat. */
	you: Seat;
	/** True when `you` is in `room.activeSeats`. */
	yourTurn: boolean;
	/** Send an action for `you`. Resolves when the server answers; the new
	 *  view arrives separately. A refusal comes back as `{ ok: false }`. */
	act: (action: unknown) => Promise<ActResult>;
	/** True while one of `act`'s requests is in flight. Boards disable
	 *  repeat input while pending rather than queueing taps. */
	pending: boolean;
	/** Cues produced by the revision that made this view (empty when the
	 *  board mounts mid-game). Play each once; never depend on them. */
	events: GameEvent[];
	/** Honour the OS Reduce Motion setting (swap travel for a cross-fade). */
	reduceMotion: boolean;
	/** Width available to the board, in points (page padding already removed). */
	width: number;
	/** Height available to the board, in points, measured by the match screen
	 *  (between the seat strip/clock and the emote tray). Meaningful when the
	 *  game's `GameUI.fillsHeight` is set: the board is then drawn in a box of
	 *  exactly this height with NO outer scroll, so it must lay out to fit and
	 *  keep its primary actions (the cards, buttons or chips that answer your
	 *  turn) always visible at its bottom; only secondary content (a history,
	 *  a ledger) may scroll inside the board. Undefined before first layout. */
	height?: number;
	/** Server time now (epoch ms), from the client's measured clock offset.
	 *  Use it for any countdown or beat timing the board draws itself. The
	 *  match screen and Practice always pass it; optional so a render test
	 *  may omit it (fall back to Date.now()). */
	serverNow?: () => number;
	/** Practice table (a bot pig plays the other seats). Boards may soften
	 *  copy ("the practice pig") but must not change rules. */
	practice: boolean;
}

export interface HowTo {
	/** The charter's one sentence. */
	sentence: string;
	/** Two or three short steps for the pre-game card and the help sheet. */
	steps: string[];
}

/** How one seat's pig in the seat strip answers a revision: a one-shot
 *  reaction (a jump for a good roll, a surprise when a rival busts) and/or a
 *  resting mood held for a beat (sad after a bust, tired while napping). */
export interface SeatReaction {
	kind?: PigReactionKind;
	mood?: "happy" | "sad" | "tired";
}

export interface GameUI<V = unknown> {
	id: GameId;
	Board: ComponentType<BoardProps<V>>;
	howTo: HowTo;
	/** A short line under a seat's pig in the seat strip ("3 pens",
	 *  "rolling…", "locked in"). Null for nothing. Never a zero shamed in
	 *  public: return null rather than "0 pens". The result sheet reads it
	 *  too, so on an ended room (`room.phase === "ended"`, which a departure
	 *  can reach mid-turn, before the game's own view says it is over) it is
	 *  the final tally or null, never a live "rolling…" or "thinking". */
	seatStatus?: (view: V, seat: Seat, room: RoomSnapshot<V>) => string | null;
	/** Optional extra detail for the result sheet (e.g. the last reveal). */
	ResultDetail?: ComponentType<{ view: V; room: RoomSnapshot<V>; you: Seat }>;
	/** Optional: map a revision's events to pig reactions in the seat strip
	 *  (the board itself stays the board). Called once per revision; return {}
	 *  for none. Ignored under Reduce Motion except for moods. */
	reactions?: (events: GameEvent[], room: RoomSnapshot<V>) => Partial<Record<Seat, SeatReaction>>;
	/** Optional: a small bubble the seat strip floats over one seat's pig
	 *  (a clue picture, a "locked" seal). Rendered above each pig in the strip;
	 *  return null for none. Keeps per-seat signals on the pig they belong to
	 *  instead of in a second row on the board. */
	seatBubble?: ComponentType<{ view: V; seat: Seat; room: RoomSnapshot<V> }>;
	/** Optional: the decision window the match screen's clock should draw,
	 *  when it differs from the room deadline (a game that folds a reveal beat
	 *  and a late grace into its deadline shows only the visible window).
	 *  Return null to fall back to `room.deadline`. */
	clock?: (view: V, room: RoomSnapshot<V>) => { opensAt: number; closesAt: number } | null;
	/** Optional: how long (ms) the match screen holds the result sheet after
	 *  the table ends, so the board's last reveal plays first (a toss landing,
	 *  the final day's scene, a whole envelope reel). A number, or a function
	 *  of the final view when the length depends on how the table ended.
	 *  Default 0. Skipped under Reduce Motion. */
	resultDelayMs?: number | ((view: V, room: RoomSnapshot<V>) => number);
	/** The board fits the height it is given (`BoardProps.height`) and pins
	 *  its own primary actions, so the match screen draws it without an outer
	 *  scroll view. Every shipped board sets this: a turn's answer must never
	 *  sit below the fold, where a tap lands on the emote tray instead. */
	fillsHeight?: boolean;
	/** How the match screen draws the seats above the board. "pigs" (the
	 *  default): every seat's PigStage on one ground line with name and
	 *  status. "compact": portrait chips only, for boards that already stage
	 *  the pigs themselves (a pasture, a map). */
	seatStrip?: "pigs" | "compact";
}
