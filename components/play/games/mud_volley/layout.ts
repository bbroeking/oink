// Mud Volley's drawing geometry, and how each board fits the height the match
// screen gives it (the contract is in ../fit.ts). Pure: no React, so the
// pasture's numbers and the plan are testable without a renderer.
//
// Every board is a planned region over a pinned foot:
//
//   live     score row · pasture · hand line   |  lane cards · Lock it in
//   form     kicker · pasture · hand line      |  lane cards · review row · Seal
//   waiting  pasture · hand line               |  review row
//   reel     score row · pasture · hand line   |  lane cards · skip / again
//
// The foot never shrinks: the cards keep a thumb-sized face and the ticket is
// fixed chrome. What gives, in order, as the board gets shorter: the gaps
// (12 to 8) and the cards' padding (8 to 4); then the pasture and the cards'
// payoff art shrink together, from the full 204pt scene and 56pt art down to
// PASTURE_SOFT and a 24pt glyph; then the pasture alone, down to PASTURE_MIN;
// then the art goes (the payoff line already says it in words) and the
// pasture takes its room; and on the very shortest board the pasture hides.
// One plan per board kind, never per state, so nothing moves when a toss is
// revealed or the table ends (an empty slot keeps its size).

import { ART_SIZE, BORDER, BUTTON_SIZE, SPACE, TAP_MIN } from "@/constants/theme";
import { TICKET_SLOT, lineSlot } from "../fit";

// ── The pasture ──────────────────────────────────────────────────────────────
// Drawn at SCENE_H on a roomy board; on a shorter one every vertical measure
// and every drawn size scales by sceneH / SCENE_H (the posts keep their lane
// fractions of the width, the pigs their insets from the sides).

export const SCENE_H = 204;
/** The box each pig is drawn in; the 300pt stage is scaled into it. */
const PIG_BOX = 116;
/** Headroom above the pigs, so a tall hat stays inside the scene. */
const PIG_TOP = 14;
const SHADOW_H = 8;
/** The grass rises a little above the pigs' feet; the puddle sits just
 *  below them and runs to near the scene's floor. */
const GRASS_RISE = 24;
const PUDDLE_DROP = 2;
const PUDDLE_FLOOR = 8;
const POST_W = 40;
const POST_H = 50;
const ARC_SIZE = 40;
/** The arc's foot overlaps the post's top, so it reads as hung on it. */
const ARC_HANG = 8;
const BALL = 28;
const HELD = ART_SIZE.glyphSm;
const HELD_LIFT = 8;
const MUD_MARK = 22;
/** The mudball's apex, from the top of the scene. */
const ARC_APEX = 8;
/** The sealed sticker sits just inside the rival pig's near edge. */
const SEALED_TOP = 4;
const SEALED_TUCK = 24;
/** Horizontal insets: these stay put as the scene shortens. */
export const PUDDLE_INSET = 16;
export const PIG_INSET = 4;

export interface PastureGeometry {
	sceneH: number;
	pigBox: number;
	pigTop: number;
	groundY: number;
	/** The pig stage's 300pt canvas, scaled down to the pig box. */
	stageScale: number;
	shadowW: number;
	shadowH: number;
	grassTop: number;
	puddleTop: number;
	puddleH: number;
	postW: number;
	postH: number;
	postTop: number;
	arcSize: number;
	arcHang: number;
	ball: number;
	held: number;
	heldLift: number;
	mudMark: number;
	arcApex: number;
	sealedTop: number;
	sealedRight: number;
	/** The splat or bucket that lands on the toss lane's post. */
	landing: number;
	/** An unanswered chair's dashed disc, and the pig face on it. */
	emptySeat: number;
	emptyFace: number;
}

/** The pasture drawn `sceneH` tall (exactly today's drawing at SCENE_H). */
export function pastureGeometry(sceneH: number = SCENE_H): PastureGeometry {
	const k = sceneH / SCENE_H;
	const pigBox = PIG_BOX * k;
	const pigTop = PIG_TOP * k;
	const groundY = pigTop + pigBox;
	const puddleTop = groundY + PUDDLE_DROP * k;
	const puddleH = sceneH - puddleTop - PUDDLE_FLOOR * k;
	const postH = POST_H * k;
	return {
		sceneH,
		pigBox,
		pigTop,
		groundY,
		stageScale: pigBox / ART_SIZE.stage,
		shadowW: pigBox / 2,
		shadowH: SHADOW_H * k,
		grassTop: groundY - GRASS_RISE * k,
		puddleTop,
		puddleH,
		postW: POST_W * k,
		postH,
		postTop: puddleTop + (puddleH - postH) / 2,
		arcSize: ARC_SIZE * k,
		arcHang: ARC_HANG * k,
		ball: BALL * k,
		held: HELD * k,
		heldLift: HELD_LIFT * k,
		mudMark: MUD_MARK * k,
		arcApex: ARC_APEX * k,
		sealedTop: SEALED_TOP * k,
		sealedRight: pigBox - SEALED_TUCK * k,
		landing: ART_SIZE.badge * k,
		emptySeat: (ART_SIZE.portrait / 2) * k,
		emptyFace: ART_SIZE.glyph * k,
	};
}

// ── The lane cards ───────────────────────────────────────────────────────────

/** How far a picked card lifts (drawing travel; it rises into the gap above). */
export const CARD_LIFT = 8;
/** The payoff art: full size on a roomy board, down to a glyph on a short one. */
export const CARD_ART_MAX = ART_SIZE.badge;
export const CARD_ART_MIN = ART_SIZE.glyphSm;
const CARD_PAD_ROOMY = SPACE.sm;
const CARD_PAD_TIGHT = SPACE.xs;
/** Between a card's rows. */
export const CARD_ROW_GAP = SPACE.xxs;
/** Every card reserves the picked card's heavy outline, so a pick moves nothing. */
const CARD_OUTLINE = BORDER.heavy;

export interface CardSize {
	height: number;
	/** The payoff art's box; 0 when the board is too short to draw it. */
	art: number;
	padV: number;
	/** The "wind-up" row, the lane's title, and the one slot the payoff line
	 *  (picking) and whose-lane tag (a reveal) share. */
	tagRow: number;
	title: number;
	slot: number;
}

/** One lane card at text scale `s`: the same height picking and revealing. */
export function cardSize(s: number, art: number, padV: number): CardSize {
	const tagRow = lineSlot("kickerPillSm", s);
	const title = lineSlot("cardTitleSm", s);
	// The whose-lane tag is a kickerPillSm line inside a thin outline.
	const slot = Math.max(lineSlot("label", s), BORDER.thin * 2 + lineSlot("kickerPillSm", s));
	const rows = art > 0 ? 4 : 3;
	const height = tagRow + title + slot + art + (rows - 1) * CARD_ROW_GAP + padV * 2 + CARD_OUTLINE * 2;
	return { height: Math.ceil(height), art, padV, tagRow, title, slot };
}

// ── The other rows ───────────────────────────────────────────────────────────

const SCORE_PAD = SPACE.xxs;
const REVIEW_PAD = SPACE.xxs;

/** A score sticker: its outline, its padding and the big numeral's line. */
export function scoreRowHeight(s: number): number {
	return BORDER.ink * 2 + SCORE_PAD * 2 + lineSlot("numeralLg", s);
}

/** The envelope's six picks: a tap target, or the slot label over the pick. */
export function reviewRowHeight(s: number): number {
	return Math.max(TAP_MIN, REVIEW_PAD * 2 + BORDER.heavy * 2 + lineSlot("kickerPillSm", s) + lineSlot("cardTitleSm", s));
}

/** The reel's "Skip to the end" / "Watch it again" hand link. */
export function linkHeight(s: number): number {
	return Math.max(TAP_MIN, BUTTON_SIZE.md.py * 2 + lineSlot("hand", s));
}

// ── The plan ─────────────────────────────────────────────────────────────────

export type VolleyBoardKind = "live" | "form" | "waiting" | "reel";

interface Parts {
	kicker: boolean;
	score: boolean;
	cards: boolean;
	review: boolean;
	ticket: boolean;
	link: boolean;
}

const PARTS: Readonly<Record<VolleyBoardKind, Parts>> = {
	live: { kicker: false, score: true, cards: true, review: false, ticket: true, link: false },
	form: { kicker: true, score: false, cards: true, review: true, ticket: true, link: false },
	waiting: { kicker: false, score: false, cards: false, review: true, ticket: false, link: false },
	reel: { kicker: false, score: true, cards: true, review: false, ticket: false, link: true },
};

const GAP_ROOMY = SPACE.md;
const GAP_TIGHT = SPACE.sm;
/** Where the pasture stops shrinking alongside the card art (its pigs are
 *  then 55pt) and starts shrinking alone. */
export const PASTURE_SOFT = 96;
/** The smallest pasture worth drawing (36pt pigs); below it, it hides. */
export const PASTURE_MIN = 64;

export interface VolleyPlan {
	/** The board's exact height, or null for the natural layout drawn before
	 *  the match screen has measured the board. */
	height: number | null;
	/** Between every section, planned and pinned. */
	gap: number;
	kicker: number;
	score: number;
	/** The pasture's height; 0 when the board is too short to draw it. */
	sceneH: number;
	/** The hand line's slot: two lines, so a one-line prompt and a two-line
	 *  reveal never move anything. */
	hand: number;
	/** The lane cards (null for a board without them). */
	card: CardSize | null;
	review: number;
	ticket: number;
	link: number;
	/** The planned region's content, its gaps included. A floor: on a roomy
	 *  board the slack spreads between its sections. */
	top: number;
	/** The pinned foot, its gaps included. */
	foot: number;
}

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** How the pasture and the cards share what the fixed rows leave, on a board
 *  too short for both at full size (the gaps and padding already tight). */
function share(budget: number, s: number): { sceneH: number; card: CardSize } {
	const padV = CARD_PAD_TIGHT;
	const withArt = cardSize(s, CARD_ART_MIN, padV);
	const bare = withArt.height - CARD_ART_MIN;
	const excess = budget - PASTURE_SOFT - withArt.height;
	if (excess >= 0) {
		// Both grow, in proportion to how far each has to go.
		const range = SCENE_H - PASTURE_SOFT + CARD_ART_MAX - CARD_ART_MIN;
		const t = Math.min(1, excess / range);
		const art = Math.floor(CARD_ART_MIN + (CARD_ART_MAX - CARD_ART_MIN) * t);
		const card = cardSize(s, art, padV);
		return { sceneH: Math.min(SCENE_H, Math.floor(budget - bare - art)), card };
	}
	if (budget - withArt.height >= PASTURE_MIN) return { sceneH: Math.floor(budget - withArt.height), card: withArt };
	const artless = cardSize(s, 0, padV);
	const room = Math.floor(budget - artless.height);
	if (room >= PASTURE_MIN) return { sceneH: room, card: artless };
	// No pasture: the room it leaves (its gap too) goes back to the card art.
	const art = Math.min(CARD_ART_MAX, Math.floor(budget + GAP_TIGHT - bare));
	return { sceneH: 0, card: art >= CARD_ART_MIN ? cardSize(s, art, padV) : artless };
}

/** The plan for one board kind at a height (undefined: the natural layout)
 *  and text scale `s`. */
export function volleyPlan({ kind, height, s }: { kind: VolleyBoardKind; height?: number; s: number }): VolleyPlan {
	const p = PARTS[kind];
	const kicker = p.kicker ? lineSlot("kicker", s) : 0;
	const score = p.score ? scoreRowHeight(s) : 0;
	const hand = lineSlot("handLg", s, 2);
	const review = p.review ? reviewRowHeight(s) : 0;
	const ticket = p.ticket ? TICKET_SLOT : 0;
	const link = p.link ? linkHeight(s) : 0;

	const build = (gap: number, sceneH: number, card: CardSize | null): VolleyPlan => {
		const top = [kicker, score, sceneH, hand].filter((h) => h > 0);
		const foot = [card?.height ?? 0, review, ticket, link].filter((h) => h > 0);
		return {
			height: height ?? null,
			gap,
			kicker,
			score,
			sceneH,
			hand,
			card,
			review,
			ticket,
			link,
			top: sum(top) + gap * Math.max(0, top.length - 1),
			foot: sum(foot) + gap * Math.max(0, foot.length - 1),
		};
	};

	const roomyCard = p.cards ? cardSize(s, CARD_ART_MAX, CARD_PAD_ROOMY) : null;
	if (height === undefined) return build(GAP_ROOMY, SCENE_H, roomyCard);

	// Every gap with the pasture drawn: inside the region, the one between the
	// region and the foot, and inside the foot.
	const sections = [kicker, score, SCENE_H, hand, roomyCard?.height ?? 0, review, ticket, link].filter((h) => h > 0).length;
	const fixed = kicker + score + hand + review + ticket + link;
	for (const gap of [GAP_ROOMY, GAP_TIGHT]) {
		const budget = height - fixed - (sections - 1) * gap;
		if (budget - (roomyCard?.height ?? 0) >= SCENE_H) return build(gap, SCENE_H, roomyCard);
	}
	const budget = height - fixed - (sections - 1) * GAP_TIGHT;
	if (!p.cards) {
		const sceneH = Math.min(SCENE_H, Math.floor(budget));
		return build(GAP_TIGHT, sceneH >= PASTURE_MIN ? sceneH : 0, null);
	}
	const { sceneH, card } = share(budget, s);
	return build(GAP_TIGHT, sceneH, card);
}
