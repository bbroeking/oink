// Fence the Pen's board: the yard under the match screen's pig strip
// (components/play/types.ts BoardProps). A pure function of this seat's view:
// posts on a square sized from `width` and, once the match screen has
// measured it, `height` (GameUI.fillsHeight: the board is drawn in exactly
// that height with no scroll, so the yard takes what the count and the hint
// leave and every gap is always on screen), every open gap a 44pt invisible
// hit zone, drawn rails as painted stickers washed in their drawer's seat
// tint, closed pens as a truffle patch with the owner's stamp in the corner
// (ownership is never hue alone).
//
// Placement is two taps, because a misdraw gives a pen away and there is no
// undo: the first tap lays a dashed preview, the same gap again draws it, any
// other gap moves the preview. The board never applies a fence itself. It
// calls `act`, stands the rail up as a ghost while the server answers, and
// then draws whatever the next view says. Input sleeps while a request is in
// flight and whenever it is not this pig's move.
//
// Cues (`events`) play once per revision that lands while the board is up:
// a rail slides in from its drawer's side, a pen's mud spreads and its
// truffle bounces before the stamp comes down, and a "draw again" tape
// covers an extra move. Several in one revision queue rather than overlap,
// so a sweep reads as several pops. Nothing depends on them.

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { AccessibilityInfo, Image, Pressable, StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { BORDER, CHROME_TYPE_CAP, MOTION, OPACITY, RADII, SPACE, STICKER_SHADOW, TILT, TINT, UI_COLORS, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { Hand, Numeral } from "@/components/ui";
import type { Seat } from "@/multiplayer/types";
import type { FenceView } from "@/multiplayer/games/fence_the_pen/rules";
import { edgeCount, edgePosts, hEdge, sidesDrawn, vEdge, type EdgeAt, type Grid } from "@/multiplayer/games/fence_the_pen/geometry";
import { UNNAMED_PIG } from "@/utils/multiplayer/looks";
import { FENCE_ART } from "../../playArt";
import type { BoardProps } from "../../types";
import { useTextScale } from "../fit";
import {
	announcementOf,
	edgePlaces,
	fenceLabel,
	fencePlan,
	HINT,
	HINT_PAD,
	NO_CUES,
	penCell,
	penLabel,
	penLabelRect,
	postCentre,
	postName,
	REFUSAL,
	REFUSAL_FALLBACK,
	slideFrom,
	stampOrigin,
	timelineOf,
	yardLayout,
	zoneRect,
	type Point,
	type Rect,
	type YardLayout,
} from "./layout";
import { AgainTape, PenPatch, PenStamp, PreviewRail, Rail } from "./pieces";

// --- ART -------------------------------------------------------------------
// The open gaps' guide: a dotted line of round dots between two posts, so a
// first-time pig sees where a fence can go. Dot and gap lengths in points.
const GUIDE_DOT = 0.1;
const GUIDE_GAP = 8;
// The board's words (the count, the hint, the tape) are compact chrome around
// the yard, so they stop at the chrome type cap; their slots (fencePlan) are
// reserved at the capped scale and keep their height when they empty.

export function FenceBoard({ view, room, you, yourTurn, act, pending, events, reduceMotion, width, height }: BoardProps<FenceView>) {
	const policy = useMotionPolicy();
	const reduce = reduceMotion || policy.reduceMotion;
	const { rows, cols } = view;
	const g = useMemo<Grid>(() => ({ rows, cols }), [rows, cols]);
	const scale = useTextScale();
	const plan = useMemo(() => fencePlan(width, height, g, scale), [width, height, g, scale]);
	const L = useMemo(() => yardLayout(width, g, plan.side), [width, g, plan.side]);
	const places = useMemo(() => edgePlaces(g, edgeCount(g)), [g]);
	// Every gap's zone and every pen's square, once per yard size, so the
	// memoised pieces below see the same boxes from one render to the next.
	const zones = useMemo(() => places.map((at) => zoneRect(L, at)), [L, places]);
	const cells = useMemo(() => Array.from({ length: g.rows * g.cols }, (_, pen) => penCell(L, g, pen)), [L, g]);
	const stamps = useMemo(() => Array.from({ length: g.rows * g.cols }, (_, pen) => stampOrigin(L, g, pen)), [L, g]);

	const seatOf = useCallback((s: Seat) => room.seats.find((x) => x.seat === s) ?? null, [room.seats]);
	const nameOf = useCallback((s: Seat) => (s === you ? "you" : (seatOf(s)?.name ?? UNNAMED_PIG)), [seatOf, you]);

	// Local marks: the previewed gap, the fence on its way to the server, and
	// a refusal line. A new revision clears the marks it supersedes (state
	// adjusted during render, the React-sanctioned way).
	const [preview, setPreview] = useState<number | null>(null);
	const [sent, setSent] = useState<number | null>(null);
	const [refusal, setRefusal] = useState<string | null>(null);
	const [revSeen, setRevSeen] = useState(room.rev);
	if (revSeen !== room.rev) {
		setRevSeen(room.rev);
		setPreview(null);
		setRefusal(null);
	}

	// Cues play only for revisions that land while the board is up.
	const [mountRev] = useState(room.rev);
	const live = room.rev !== mountRev;
	const cues = useMemo(() => (live ? timelineOf(events) : NO_CUES), [live, events]);

	const playing = room.phase === "playing" && !view.over;
	const ghost = sent !== null && view.edges[sent] === 0 ? sent : null;
	const canDraw = playing && yourTurn && !pending && ghost === null;
	const previewEdge = canDraw && preview !== null && view.edges[preview] === 0 ? preview : null;
	const extraMove = playing && view.turn === you && view.last !== null && view.last.seat === you && view.last.closed.length > 0;
	// The most recent fence, when another pig drew it: lifted on the yard and
	// named to a screen reader, for a pig arriving without the cues.
	const theirLast = view.last !== null && view.last.seat !== you ? view.last : null;

	const onGap = useCallback(
		(edge: number) => {
			if (!canDraw || view.edges[edge] !== 0) return;
			if (previewEdge !== edge) {
				setPreview(edge);
				setRefusal(null);
				Haptics.selectionAsync().catch(() => {});
				return;
			}
			setPreview(null);
			setSent(edge);
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
			const fail = (line: string) => {
				setSent((s) => (s === edge ? null : s));
				setRefusal(line);
			};
			act({ type: "fence", edge }).then(
				(res) => {
					if (!res.ok) fail(REFUSAL[res.error] ?? REFUSAL_FALLBACK);
				},
				() => fail(REFUSAL_FALLBACK),
			);
		},
		[canDraw, previewEdge, view.edges, act],
	);

	// A refusal reads for a toast's dwell, then the hint comes back.
	useEffect(() => {
		if (refusal === null) return;
		const t = setTimeout(() => setRefusal(null), MOTION.toast);
		return () => clearTimeout(t);
	}, [refusal]);

	// A screen reader hears another pig's move once, when it lands.
	const announced = useRef(mountRev);
	useEffect(() => {
		if (room.rev === announced.current) return;
		announced.current = room.rev;
		const line = announcementOf(g, events, you, nameOf);
		if (line) AccessibilityInfo.announceForAccessibility(line);
	}, [room.rev, events, g, you, nameOf]);

	// This revision's rails, each sliding in from its drawer. Your own fence
	// already stood in place as the ghost, so it simply stays.
	const entrances = useMemo(() => {
		const out = new Map<number, { at: number; from: Point }>();
		for (const [edge, cue] of cues.fences) {
			if (edge === sent || !places[edge]) continue;
			out.set(edge, { at: cue.at, from: slideFrom(L, places[edge], cue.seat, view.seats) });
		}
		return out;
	}, [cues, L, places, view.seats, sent]);

	const hint =
		refusal ??
		(!playing
			? null
			: ghost !== null
				? HINT.sending
				: !yourTurn
					? null
					: previewEdge !== null
						? HINT.confirm
						: extraMove
							? HINT.again
							: HINT.draw);

	const againText = cues.again ? (cues.again.seat === you ? "draw again" : `${nameOf(cues.again.seat)} draws again`) : "";

	// Fitted: exactly the match screen's height, the rows stacked at its foot
	// (any slack above the count). Before the first measurement: natural size.
	const frame = height === undefined ? { width, gap: plan.gap } : { width, height, gap: plan.gap };

	return (
		<View style={[styles.board, frame]} testID="fence-board">
			<View style={[styles.topRow, { width: L.w, height: plan.countRow }]} testID="fence-count-row">
				{view.over ? (
					<Hand tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
						every fence is up
					</Hand>
				) : playing ? (
					<View
						accessible
						accessibilityRole="text"
						accessibilityLabel={`${view.fencesLeft} ${view.fencesLeft === 1 ? "fence" : "fences"} left${
							theirLast ? `. Last fence: ${nameOf(theirLast.seat)}, between post ${edgePosts(g, theirLast.edge).map(postName).join(" and ")}` : ""
						}`}
						style={styles.count}
					>
						<Numeral maxFontSizeMultiplier={CHROME_TYPE_CAP}>{view.fencesLeft}</Numeral>
						<Hand tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
							{view.fencesLeft === 1 ? "fence left" : "fences left"}
						</Hand>
					</View>
				) : null}
			</View>

			<View testID="fence-yard" style={[styles.yard, { width: L.w, height: L.h }]}>
				<Guides L={L} g={g} places={places} edges={view.edges} lit={canDraw} />
				{view.pens.map((owner, pen) =>
					owner >= 0 ? <PenPatch key={`patch-${pen}`} L={L} cell={cells[pen]} at={cues.pens.get(pen) ?? null} reduce={reduce} /> : null,
				)}
				{view.edges.map((mark, edge) =>
					mark > 0 && places[edge] ? (
						<Rail
							key={`rail-${edge}`}
							L={L}
							at={places[edge]}
							seat={mark - 1}
							enter={entrances.get(edge) ?? null}
							lifted={theirLast?.edge === edge}
							reduce={reduce}
						/>
					) : null,
				)}
				{ghost !== null && places[ghost] ? <Rail key={`ghost-${ghost}`} L={L} at={places[ghost]} seat={you} enter={null} ghost reduce={reduce} /> : null}
				{previewEdge !== null && places[previewEdge] ? (
					<PreviewRail key={`preview-${previewEdge}`} L={L} at={places[previewEdge]} seat={you} reduce={reduce} />
				) : null}
				<Posts L={L} g={g} />
				{view.pens.map((owner, pen) => {
					if (owner < 0) return null;
					const seat = seatOf(owner);
					return (
						<PenStamp
							key={`stamp-${pen}`}
							L={L}
							origin={stamps[pen]}
							owner={owner}
							look={seat?.look ?? null}
							tilt={TILT.row[pen % TILT.row.length]}
							dimmed={!!seat?.gone}
							at={cues.pens.get(pen) ?? null}
							reduce={reduce}
						/>
					);
				})}
				<TouchLayer
					L={L}
					g={g}
					places={places}
					zones={zones}
					view={view}
					canDraw={canDraw}
					previewEdge={previewEdge}
					onGap={onGap}
					ownerName={(owner) => (seatOf(owner)?.gone ? `${nameOf(owner)}, who trotted off` : nameOf(owner))}
				/>
				{cues.again ? <AgainTape key={`again-${room.rev}`} text={againText} at={cues.again.at} until={cues.again.until} reduce={reduce} /> : null}
			</View>

			<View style={[styles.hintSlot, { height: plan.hintRow }]} testID="fence-hint-row">
				{hint ? (
					<Hand tone={refusal ? "danger" : "secondary"} align="center" numberOfLines={2} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
						{hint}
					</Hand>
				) : null}
			</View>
		</View>
	);
}

// ── The yard's static layers ────────────────────────────────────────────────

/** Dotted guides along every open gap: brighter while it is your move. */
const Guides = memo(function Guides({
	L,
	g,
	places,
	edges,
	lit,
}: {
	L: YardLayout;
	g: Grid;
	places: EdgeAt[];
	edges: number[];
	lit: boolean;
}) {
	return (
		<Svg pointerEvents="none" width={L.w - BORDER.ink * 2} height={L.h - BORDER.ink * 2} style={StyleSheet.absoluteFill}>
			{places.map((_, e) => {
				if (edges[e] !== 0) return null;
				const [a, b] = edgePosts(g, e).map((p) => postCentre(L, p));
				return (
					<Line
						key={e}
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						stroke={UI_COLORS.uiMuted}
						strokeOpacity={lit ? OPACITY.muted : OPACITY.ghost}
						strokeWidth={BORDER.heavy}
						strokeDasharray={[GUIDE_DOT, GUIDE_GAP]}
						strokeLinecap="round"
					/>
				);
			})}
		</Svg>
	);
});

/** A post at every lattice point, drawn over the rails' ends. */
const Posts = memo(function Posts({ L, g }: { L: YardLayout; g: Grid }) {
	const posts: ReactElement[] = [];
	for (let r = 0; r <= g.rows; r++) {
		for (let c = 0; c <= g.cols; c++) {
			const p = postCentre(L, { r, c });
			posts.push(
				<Image
					key={`post-${r}-${c}`}
					source={FENCE_ART.post}
					resizeMode="contain"
					fadeDuration={0}
					accessible={false}
					style={[styles.abs, { left: p.x - L.post / 2, top: p.y - L.post / 2, width: L.post, height: L.post }]}
				/>,
			);
		}
	}
	return <>{posts}</>;
});

// ── Touch and the screen reader ─────────────────────────────────────────────

/**
 * The yard's touch targets and its screen-reader elements, in reading order:
 * a row's top fences left to right, then along the row each side fence
 * followed by the pen after it. Gaps are invisible 44pt zones; pens are quiet
 * labels in the middle of each square, clear of every zone.
 */
function TouchLayer({
	L,
	g,
	places,
	zones,
	view,
	canDraw,
	previewEdge,
	onGap,
	ownerName,
}: {
	L: YardLayout;
	g: Grid;
	places: EdgeAt[];
	zones: Rect[];
	view: FenceView;
	canDraw: boolean;
	previewEdge: number | null;
	onGap: (edge: number) => void;
	ownerName: (owner: Seat) => string;
}) {
	const nodes: ReactElement[] = [];
	const gap = (edge: number) => {
		if (view.edges[edge] !== 0 || !places[edge]) return;
		nodes.push(
			<GapZone
				key={`gap-${edge}`}
				edge={edge}
				rect={zones[edge]}
				label={fenceLabel(g, edge)}
				previewed={previewEdge === edge}
				canDraw={canDraw}
				onGap={onGap}
			/>,
		);
	};
	for (let r = 0; r <= g.rows; r++) {
		for (let c = 0; c < g.cols; c++) gap(hEdge(g, r, c));
		if (r === g.rows) break;
		for (let c = 0; c <= g.cols; c++) {
			gap(vEdge(g, r, c));
			if (c === g.cols) continue;
			const pen = r * g.cols + c;
			const owner = view.pens[pen];
			nodes.push(
				<View
					key={`pen-${pen}`}
					accessible
					accessibilityRole="text"
					accessibilityLabel={penLabel(g, pen, owner >= 0 ? ownerName(owner) : null, sidesDrawn(g, view.edges, pen))}
					pointerEvents="none"
					style={[styles.abs, penLabelRect(L, g, pen)]}
				/>,
			);
		}
	}
	return <>{nodes}</>;
}

const GapZone = memo(function GapZone({
	edge,
	rect,
	label,
	previewed,
	canDraw,
	onGap,
}: {
	edge: number;
	rect: Rect;
	label: string;
	previewed: boolean;
	canDraw: boolean;
	onGap: (edge: number) => void;
}) {
	return (
		<Pressable
			testID={`fence-gap-${edge}`}
			onPress={() => onGap(edge)}
			disabled={!canDraw}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={canDraw ? (previewed ? "Draws this fence" : "Marks this gap. Activate it again to draw the fence") : undefined}
			accessibilityState={{ disabled: !canDraw, selected: previewed }}
			style={({ pressed }) => [styles.abs, rect, pressed && canDraw ? styles.zonePressed : null]}
		/>
	);
});

const styles = StyleSheet.create({
	board: { alignSelf: "center", alignItems: "center", justifyContent: "flex-end" },
	topRow: {
		flexDirection: "row",
		justifyContent: "flex-end",
		alignItems: "baseline",
	},
	count: { flexDirection: "row", alignItems: "baseline", gap: SPACE.xs },
	// The yard is a sticker: cream2 paper, the ink outline, the hard shadow.
	// Straight, like the dig's patch: a grid you aim at does not lean.
	yard: {
		backgroundColor: WHIMSY.cream2,
		borderRadius: RADII.lg,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		...STICKER_SHADOW,
	},
	abs: { position: "absolute" },
	zonePressed: { backgroundColor: TINT.inkWash, borderRadius: RADII.sm },
	// The whole board's width, so a yard narrowed by the height never squeezes
	// the hint onto a second line.
	hintSlot: { alignSelf: "stretch", justifyContent: "center", paddingHorizontal: HINT_PAD },
});
