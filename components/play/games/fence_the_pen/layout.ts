// Fence the Pen's board, as numbers: where every post, rail, gap and pen sits
// in points, how tall the yard may be in the height the match screen gives
// the board, the order the revision's cues play in, and the words a screen
// reader hears. Pure functions of the view, the board's width and height and
// the text scale. No rules here: which fence is legal, what closes and who
// moves next all come from the server's view; this only turns fence indices
// (geometry.ts, the shared arithmetic) into places on the screen.

import { BORDER, SPACE, TAP_MIN } from "@/constants/theme";
import { MOTION_DURATION } from "@/hooks/useMotionPolicy";
import type { ProtocolErrorCode } from "@/multiplayer/protocol";
import type { GameEvent, Seat } from "@/multiplayer/types";
import { edgeAt, edgePosts, type EdgeAt, type Grid, type PostAt } from "@/multiplayer/games/fence_the_pen/geometry";
import { lineSlot, linesFor } from "../fit";

// --- ART -------------------------------------------------------------------
// The yard's drawing geometry. Everything inside the yard is a fraction of
// the post-to-post pitch, so the 4×4 live yard and the 3×3 postal yard are
// one drawing at two scales. Drawing sizes, not spacing steps.
//
// The painted pieces are 256 px squares with the subject inside transparent
// padding (alpha bounds measured with PIL, 2026-10-04):
//   rail.png         x 13–243, y 96–159: a bar across 89.8% of the square and
//                    24.6% of its height, centred both ways
//   post.png         126 × 228 (49% × 89%), centred
//   pen_truffle.png  230 × 228 (90% × 89%), centred
// So every piece is drawn by giving the WHOLE square an explicit size (an
// Image without one keeps the asset's own 256 pt and grows past its box).
/** The widest the yard grows (a Max phone is ~366pt of board; a tablet stops here). */
export const YARD_MAX = 420;
/** A post's art box: the painted post is 0.147 × 0.267 of a pitch, so its
 *  visible half-width (0.074 pitch) covers a rail's end. */
const POST_FRAC = 0.3;
/** The rail's art box is a square one pitch wide: the painted rail spans 90%
 *  of it, so each end stops 0.05 pitch short of a post's centre and tucks
 *  under the post. */
const RAIL_FRAC = 1;
/** The dashed preview rail's thickness. */
const PREVIEW_THICK_FRAC = 0.2;
/** The truffle patch's art box inside a closed pen. */
const PEN_ART_FRAC = 0.8;
/** The owner's stamp in a closed pen's corner. */
const STAMP_FRAC = 0.34;
/** How far a rail travels as it slides in from its drawer's side. */
const SLIDE_FRAC = 0.75;

export interface YardLayout {
	/** Outer size of the yard sticker, border included. */
	w: number;
	h: number;
	/** First post's centre, measured from the inner (inside-border) edge. A
	 *  rim gap's 44pt hit zone stays inside the yard because of it. */
	inset: number;
	/** Post to post. */
	pitch: number;
	post: number;
	rail: number;
	previewLong: number;
	previewThick: number;
	/** A gap's hit zone: along the fence, and across it (TAP_MIN). */
	zoneLong: number;
	zoneThick: number;
	penArt: number;
	stamp: number;
	slide: number;
}

export interface Point {
	x: number;
	y: number;
}

export interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** The yard for a board `width` points wide; `side` caps its outer size
 *  when the board's height is the tighter edge (fencePlan). */
export function yardLayout(width: number, g: Grid, side: number = YARD_MAX): YardLayout {
	const outer = Math.min(width, YARD_MAX, side);
	const inset = TAP_MIN / 2;
	const span = Math.max(g.rows, g.cols);
	const pitch = (outer - BORDER.ink * 2 - inset * 2) / span;
	const post = pitch * POST_FRAC;
	return {
		w: inset * 2 + g.cols * pitch + BORDER.ink * 2,
		h: inset * 2 + g.rows * pitch + BORDER.ink * 2,
		inset,
		pitch,
		post,
		rail: pitch * RAIL_FRAC,
		previewLong: pitch - post,
		previewThick: pitch * PREVIEW_THICK_FRAC,
		zoneLong: Math.max(TAP_MIN, pitch - post),
		zoneThick: TAP_MIN,
		penArt: pitch * PEN_ART_FRAC,
		stamp: pitch * STAMP_FRAC,
		slide: pitch * SLIDE_FRAC,
	};
}

export function postCentre(L: YardLayout, p: PostAt): Point {
	return { x: L.inset + p.c * L.pitch, y: L.inset + p.r * L.pitch };
}

export function edgeCentre(L: YardLayout, at: EdgeAt): Point {
	return at.dir === "h"
		? { x: L.inset + (at.c + 0.5) * L.pitch, y: L.inset + at.r * L.pitch }
		: { x: L.inset + at.c * L.pitch, y: L.inset + (at.r + 0.5) * L.pitch };
}

/** A box of `long` × `thick` laid along a fence, centred on it. */
export function alongEdge(L: YardLayout, at: EdgeAt, long: number, thick: number): Rect {
	const c = edgeCentre(L, at);
	const width = at.dir === "h" ? long : thick;
	const height = at.dir === "h" ? thick : long;
	return { left: c.x - width / 2, top: c.y - height / 2, width, height };
}

/** A gap's touch target. Zones are centred on their fence and stop short of
 *  the posts, so two zones only meet in the post's own corner. */
export function zoneRect(L: YardLayout, at: EdgeAt): Rect {
	return alongEdge(L, at, L.zoneLong, L.zoneThick);
}

/** A pen's square, post to post. */
export function penCell(L: YardLayout, g: Grid, pen: number): Rect {
	const r = Math.floor(pen / g.cols);
	const c = pen % g.cols;
	return { left: L.inset + c * L.pitch, top: L.inset + r * L.pitch, width: L.pitch, height: L.pitch };
}

/** The middle of a pen that no gap's zone covers: where its screen-reader
 *  label lives, so exploring the yard by touch finds pens and gaps apart. */
export function penLabelRect(L: YardLayout, g: Grid, pen: number): Rect {
	const cell = penCell(L, g, pen);
	const side = Math.max(L.pitch - L.zoneThick, 1);
	return { left: cell.left + (L.pitch - side) / 2, top: cell.top + (L.pitch - side) / 2, width: side, height: side };
}

/** Where a closed pen's stamp sits: its top-left corner, clear of the post. */
export function stampOrigin(L: YardLayout, g: Grid, pen: number): Point {
	const cell = penCell(L, g, pen);
	return { x: cell.left + L.post / 2, y: cell.top + L.post / 2 };
}

/** Where a seat's pig stands, seen from the yard: on the strip above it, in
 *  seat order left to right. A rail slides in from there. */
export function drawerPoint(L: YardLayout, seat: Seat, seats: number): Point {
	return { x: ((seat + 0.5) / Math.max(seats, 1)) * L.w, y: -L.pitch };
}

/** The start offset of a rail sliding in from its drawer: `slide` points
 *  back along the line from the rail towards that pig. */
export function slideFrom(L: YardLayout, at: EdgeAt, seat: Seat, seats: number): Point {
	const rail = edgeCentre(L, at);
	const pig = drawerPoint(L, seat, seats);
	const dx = pig.x - rail.x;
	const dy = pig.y - rail.y;
	const len = Math.hypot(dx, dy) || 1;
	return { x: (dx / len) * L.slide, y: (dy / len) * L.slide };
}

// --- THE HEIGHT ------------------------------------------------------------
// Three rows: the fences-left count over the yard's right edge, the yard, and
// the hint line under it. In the height the match screen gives the board
// (GameUI.fillsHeight) the yard takes whatever the two text rows leave, so
// the whole yard (every gap is a move) always sits on screen. The text rows
// keep their slots at the board's capped text scale, so a word never pushes
// the yard about; the hint keeps the whole board width, since a yard that
// shrinks with the height would otherwise squeeze its hint onto two lines.

/** Between the rows; the tight step still clears the yard's 4 pt shadow and,
 *  with the count row, the "draw again" tape's overhang. */
const ROW_GAP = SPACE.sm;
const TIGHT_GAP = SPACE.xs;
/** The hint line's side padding. */
export const HINT_PAD = SPACE.sm;
/** The smallest pitch a yard is ever drawn at, however short the board: a
 *  floor so a degenerate height still draws a yard rather than nothing. */
const MIN_PITCH = 24;

export interface FencePlan {
	/** The most the yard's outer side may take (yardLayout's `side`). */
	side: number;
	/** The space between the rows. */
	gap: number;
	/** The count row over the yard and the hint row under it. */
	countRow: number;
	hintRow: number;
}

/** The rows for a board `width` × `height` (height undefined: the match
 *  screen has not measured yet, so the yard sizes from the width alone). */
export function fencePlan(width: number, height: number | undefined, g: Grid, s: number): FencePlan {
	const countRow = lineSlot("numeral", s);
	const hintWidth = width - HINT_PAD * 2;
	const hintLines = Math.max(1, ...FOOTER_LINES.map((line) => linesFor(line, "hand", s, hintWidth)));
	const hintRow = lineSlot("hand", s, hintLines);
	const roomy = Math.min(width, YARD_MAX);
	if (height === undefined) return { side: roomy, gap: ROW_GAP, countRow, hintRow };
	const free = (gap: number) => height - countRow - hintRow - gap * 2;
	const gap = free(ROW_GAP) >= roomy ? ROW_GAP : TIGHT_GAP;
	const smallest = TAP_MIN + Math.max(g.rows, g.cols) * MIN_PITCH + BORDER.ink * 2;
	return { side: Math.max(smallest, Math.min(roomy, free(gap))), gap, countRow, hintRow };
}

// --- THE REVISION'S CUES ---------------------------------------------------
// One revision can carry several fences (a timed-out pig's defaults, a sweep
// of pens), so the cues queue: each rail slides on its own beat, each pen
// pops on its own, and the "draw again" tape covers the run. Beats are the
// motion policy's steps.
export const FENCE_BEAT = MOTION_DURATION.state;
export const PEN_BEAT = MOTION_DURATION.state;

export interface Timeline {
	/** fence index → ms after the revision lands that its rail slides in. */
	fences: Map<number, { seat: Seat; at: number }>;
	/** pen index → ms its truffle patch pops. */
	pens: Map<number, number>;
	/** The "draw again" tape: who, from when, to when (the last extra move). */
	again: { seat: Seat; at: number; until: number } | null;
}

export const NO_CUES: Timeline = { fences: new Map(), pens: new Map(), again: null };

/** A seat, fence or pen index off an event: a non-negative integer. */
const isIndex = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function timelineOf(events: readonly GameEvent[]): Timeline {
	const fences = new Map<number, { seat: Seat; at: number }>();
	const pens = new Map<number, number>();
	let againFrom: { seat: Seat; at: number } | null = null;
	let againUntil = 0;
	let t = 0;
	for (const e of events) {
		if (e.type === "fence" && isIndex(e.edge) && isIndex(e.seat)) {
			fences.set(e.edge, { seat: e.seat, at: t });
			t += FENCE_BEAT;
		} else if (e.type === "pen" && isIndex(e.pen)) {
			pens.set(e.pen, t);
			t += PEN_BEAT;
		} else if (e.type === "again" && isIndex(e.seat)) {
			againFrom = againFrom ?? { seat: e.seat, at: t };
			againUntil = t;
		}
	}
	return { fences, pens, again: againFrom ? { ...againFrom, until: againUntil } : null };
}

// --- WORDS -----------------------------------------------------------------

/** The hint line under the yard: what a tap will do, in the hand voice. */
export const HINT = {
	draw: "tap a gap to preview, tap it again to draw",
	confirm: "tap the same gap again to draw it",
	again: "you kept a pen · draw again",
	sending: "drawing…",
} as const;

/** Why a fence did not go in: read for a toast's dwell, in the hint's place. */
export const REFUSAL: Partial<Record<ProtocolErrorCode, string>> = {
	illegal_move: "that gap was just fenced · pick another",
	not_your_turn: "not your move just yet",
	stale: "the yard just changed · have another look",
	game_over: "every fence is already up",
};
export const REFUSAL_FALLBACK = "that fence did not go in · try again";

/** Every line the hint row can hold, so its slot is reserved for the longest. */
const FOOTER_LINES: readonly string[] = [
	...Object.values(HINT),
	...Object.values(REFUSAL).filter((line): line is string => typeof line === "string"),
	REFUSAL_FALLBACK,
];

/** Posts read like a map: columns A, B, C…, rows 1, 2, 3… ("post B2"). */
export function postName(p: PostAt): string {
	return `${String.fromCharCode(65 + p.c)}${p.r + 1}`;
}

/** "Fence between post B2 and B3". */
export function fenceLabel(g: Grid, edge: number): string {
	const [a, b] = edgePosts(g, edge);
	return `Fence between post ${postName(a)} and ${postName(b)}`;
}

/** "Pen in row 2, column 3, kept by Clover" / "…, 3 of 4 fences up". */
export function penLabel(g: Grid, pen: number, owner: string | null, sides: number): string {
	const where = `Pen in row ${Math.floor(pen / g.cols) + 1}, column ${(pen % g.cols) + 1}`;
	if (owner !== null) return `${where}, kept by ${owner}`;
	return sides === 0 ? `${where}, no fences up yet` : `${where}, ${sides} of 4 fences up`;
}

/** What a screen reader hears when another pig's move lands: where the
 *  fences went, what they kept, and whether they go again. Your own move is
 *  already under your finger, so only its extra move is said. */
export function announcementOf(
	g: Grid,
	events: readonly GameEvent[],
	you: Seat,
	nameOf: (seat: Seat) => string,
): string | null {
	const lines: string[] = [];
	let kept = 0;
	let keeper: Seat | null = null;
	const flushKept = () => {
		if (keeper !== null && kept > 0 && keeper !== you) lines.push(`${nameOf(keeper)} kept ${kept === 1 ? "a pen" : `${kept} pens`}`);
		kept = 0;
	};
	for (const e of events) {
		if (e.type === "fence" && isIndex(e.edge) && isIndex(e.seat)) {
			flushKept();
			keeper = e.seat;
			if (e.seat !== you) lines.push(`${nameOf(e.seat)} drew the fence between post ${edgePosts(g, e.edge).map(postName).join(" and ")}`);
		} else if (e.type === "pen" && isIndex(e.seat)) {
			keeper = e.seat;
			kept++;
		}
	}
	flushKept();
	const last = [...events].reverse().find((e) => e.type === "again" || e.type === "turn" || e.type === "end");
	if (last?.type === "again" && isIndex(last.seat)) lines.push(last.seat === you ? "You kept a pen. Draw again" : `${nameOf(last.seat)} draws again`);
	return lines.length > 0 ? `${lines.join(". ")}.` : null;
}

/** Every fence's place, computed once per yard size. */
export function edgePlaces(g: Grid, count: number): EdgeAt[] {
	return Array.from({ length: count }, (_, e) => edgeAt(g, e));
}
