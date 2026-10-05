// The Fence the Pen board (components/play/games/fence_the_pen/) rendered with
// react-test-renderer: your move, the two-tap preview (and moving it), the
// ghost while the server answers, a refusal, their move, a sweep's cues, the
// extra move, the end, Reduce Motion, two phone widths and the heights the
// match screen leaves on each phone; the painted pieces drawn the size of
// their boxes; plus the pure pieces under it (the yard's numbers, the cue
// timeline, the words). Every case is a real view from the rules module and a
// room snapshot around it.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, StyleSheet } from "react-native";
import type { RoomPhase, RoomSnapshot } from "../../multiplayer/protocol";
import type { GameEvent, Seat } from "../../multiplayer/types";
import { fence_the_pen, type FenceState } from "../../multiplayer/games/fence_the_pen/rules";
import { edgeAt, edgeCount, edgePosts, hEdge, penCount, vEdge, type Grid } from "../../multiplayer/games/fence_the_pen/geometry";
import { createRng } from "../../multiplayer/rng";
import { playOut, TEST_LOOK } from "../../multiplayer/testkit";
import { eventsFor, snapshotFor } from "../../multiplayer/engine";
import { SPACE, STICKER_SHADOW, TAP_MIN } from "../../constants/theme";
import type { ActResult, BoardProps } from "../../components/play/types";
import { FENCE_ART } from "../../components/play/playArt";
import { fenceThePenUi } from "../../components/play/games/fence_the_pen";
import { BOARD_HEIGHTS, BOARD_WIDTHS, SE_DESIGN_HEIGHT } from "../../components/play/games/fit";
import {
	alongEdge,
	announcementOf,
	edgePlaces,
	fenceLabel,
	fencePlan,
	penCell,
	penLabel,
	penLabelRect,
	postCentre,
	postName,
	slideFrom,
	timelineOf,
	yardLayout,
	zoneRect,
	FENCE_BEAT,
	PEN_BEAT,
	type YardLayout,
} from "../../components/play/games/fence_the_pen/layout";

// The ui barrel reaches utils/log, whose Sentry import starts an interval
// that would keep jest alive after the suite; the looks helper reaches the
// Supabase client, which would start its token refresh. (babel-jest hoists
// these above the imports.)
jest.mock("../../utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock("../../utils/supabase", () => ({ supabase: {} }));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	selectionAsync: jest.fn(async () => {}),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
	NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// ── Harness ──────────────────────────────────────────────────────────────────

const NAMES = ["Rosie", "Clover", "Biscuit", "Pickles"];
const EM_DASH = "—";
const EMOJI = /[\u{1F300}-\u{1FAFF}]|[☀-☄☆-♤♦-✒✔✖-✥✨-➿]/u;
const G4: Grid = { rows: 4, cols: 4 };
const G3: Grid = { rows: 3, cols: 3 };

function yard(seats = 2, pace: "live" | "async" = "live"): FenceState {
	return fence_the_pen.setup({ seats, pace, rng: createRng("board") });
}

/** Draw fences through the real rules, in order, by whoever owes each one. */
function drawn(v: FenceState, edges: number[]): { state: FenceState; events: GameEvent[] } {
	let state = v;
	let events: GameEvent[] = [];
	for (const edge of edges) {
		const res = fence_the_pen.apply(state, state.turn, { type: "fence", edge }, { now: 0, rng: createRng("x"), pace: "live", present: state.scores.map(() => true) });
		if (!res.ok) throw new Error(`fence ${edge}: ${res.error}`);
		state = res.state;
		events = res.events ?? [];
	}
	return { state, events };
}

interface SnapOpts {
	you?: Seat;
	rev?: number;
	events?: GameEvent[];
	phase?: RoomPhase;
	gone?: Seat[];
}

function snapshot(v: FenceState, opts: SnapOpts = {}): RoomSnapshot<FenceState> {
	const result = fence_the_pen.result(v);
	return {
		roomId: "00000000-fence-board",
		game: "fence_the_pen",
		rulesVersion: fence_the_pen.rulesVersion,
		pace: v.rows === 3 ? "async" : "live",
		source: "queue",
		phase: opts.phase ?? (v.over ? "ended" : "playing"),
		seats: Array.from({ length: v.seats }, (_, seat) => ({
			seat,
			userId: `user-${seat}`,
			name: NAMES[seat],
			look: TEST_LOOK,
			connected: true,
			gone: opts.gone?.includes(seat) ?? false,
		})),
		seatCount: v.seats,
		you: opts.you ?? 0,
		view: v,
		activeSeats: v.over ? [] : [v.turn],
		deadline: null,
		startsAt: null,
		rev: opts.rev ?? 1,
		events: opts.events ?? [],
		result: result ? { ...result, reason: "complete" } : null,
		invite: null,
		rematch: null,
		host: null,
	};
}

interface BoardOpts extends SnapOpts {
	act?: (action: unknown) => Promise<ActResult>;
	pending?: boolean;
	reduceMotion?: boolean;
	width?: number;
	height?: number;
}

const Board = fenceThePenUi.Board;

function element(v: FenceState, opts: BoardOpts = {}) {
	const room = snapshot(v, opts);
	const you = room.you ?? 0;
	const props: BoardProps<FenceState> = {
		view: v,
		room,
		you,
		yourTurn: room.phase === "playing" && room.activeSeats.includes(you),
		act: opts.act ?? jest.fn(async () => ({ ok: true }) as ActResult),
		pending: opts.pending ?? false,
		events: room.events,
		reduceMotion: opts.reduceMotion ?? false,
		width: opts.width ?? 354,
		height: opts.height,
		practice: false,
	};
	return <Board {...props} />;
}

function mount(v: FenceState, opts: BoardOpts = {}) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(element(v, opts));
	});
	return renderer;
}

function hosts(r: TestRenderer.ReactTestRenderer, testID: string) {
	return r.root.findAll((n) => typeof n.type === "string" && n.props.testID === testID);
}

/** A gap's Pressable (the composite: it carries onPress and the a11y props). */
function gap(r: TestRenderer.ReactTestRenderer, edge: number) {
	const found = r.root.findAll((n) => n.props.testID === `fence-gap-${edge}` && typeof n.props.onPress === "function");
	if (found.length === 0) throw new Error(`no gap ${edge}`);
	return found[0];
}

/** Every open gap's host view (one per gap; it carries the a11y props). */
function gaps(r: TestRenderer.ReactTestRenderer) {
	return r.root.findAll((n) => typeof n.type === "string" && typeof n.props.testID === "string" && n.props.testID.startsWith("fence-gap-"));
}

const asleep = (n: TestRenderer.ReactTestInstance) => n.props.accessibilityState?.disabled === true;

function labelled(r: TestRenderer.ReactTestRenderer, prefix: string) {
	return r.root.findAll((n) => typeof n.type === "string" && typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith(prefix));
}

function textOf(node: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	const walk = (n: TestRenderer.ReactTestInstance | string) => {
		if (typeof n === "string") out.push(n);
		else for (const child of n.children ?? []) walk(child);
	};
	walk(node);
	return out.join(" ");
}

beforeEach(() => {
	jest.clearAllMocks();
	jest.useFakeTimers();
	jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
});

afterEach(() => {
	jest.clearAllTimers();
	jest.useRealTimers();
	jest.restoreAllMocks();
});

// ── Your move ────────────────────────────────────────────────────────────────

describe("Fence the Pen board · your move", () => {
	it("lays out an open 4×4 yard: every gap live and labelled by its posts, every pen read out", () => {
		const r = mount(yard());
		const all = gaps(r);
		expect(all).toHaveLength(40);
		expect(all.every((n) => n.props.accessibilityRole === "button" && !asleep(n))).toBe(true);
		expect(gap(r, 0).props.accessibilityLabel).toBe("Fence between post A1 and B1");
		expect(gap(r, 39).props.accessibilityLabel).toBe("Fence between post E4 and E5");
		expect(gap(r, 0).props.accessibilityHint).toBe("Marks this gap. Activate it again to draw the fence");
		expect(labelled(r, "Pen in row")).toHaveLength(16);
		expect(labelled(r, "Pen in row 1, column 1")[0].props.accessibilityLabel).toBe("Pen in row 1, column 1, no fences up yet");
		expect(labelled(r, "40 fences left")).toHaveLength(1);
		expect(textOf(r.root)).toContain("tap a gap to preview, tap it again to draw");
		expect(hosts(r, "fence-preview")).toHaveLength(0);
		expect(hosts(r, "fence-again-tape")).toHaveLength(0);
		act(() => r.unmount());
	});

	it("previews on the first tap, moves the preview on another gap, and draws on the same gap again", async () => {
		const send = jest.fn(async () => ({ ok: true }) as ActResult);
		const r = mount(yard(), { act: send, rev: 3 });
		act(() => gap(r, 0).props.onPress());
		expect(send).not.toHaveBeenCalled();
		expect(hosts(r, "fence-preview")).toHaveLength(1);
		expect(gap(r, 0).props.accessibilityState).toMatchObject({ selected: true });
		expect(gap(r, 0).props.accessibilityHint).toBe("Draws this fence");
		expect(textOf(r.root)).toContain("tap the same gap again to draw it");

		act(() => gap(r, 25).props.onPress());
		expect(send).not.toHaveBeenCalled();
		expect(gap(r, 0).props.accessibilityState).toMatchObject({ selected: false });
		expect(gap(r, 25).props.accessibilityState).toMatchObject({ selected: true });

		await act(async () => {
			gap(r, 25).props.onPress();
		});
		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({ type: "fence", edge: 25 });
		// The ghost stands while the server answers; input sleeps.
		expect(hosts(r, "fence-preview")).toHaveLength(0);
		expect(textOf(r.root)).toContain("drawing…");
		expect(gaps(r).every(asleep)).toBe(true);

		// The next revision draws it for real and hands the turn over.
		const next = drawn(yard(), [25]);
		act(() => r.update(element(next.state, { act: send, rev: 4, events: next.events })));
		expect(gaps(r)).toHaveLength(39);
		expect(gaps(r).every(asleep)).toBe(true);
		expect(textOf(r.root)).not.toContain("drawing…");
		expect(labelled(r, "39 fences left")).toHaveLength(1);
		act(() => r.unmount());
	});

	it("says why a refused fence did not go in, and lets the pig try again", async () => {
		const send = jest.fn(async () => ({ ok: false, error: "illegal_move" }) as ActResult);
		const r = mount(yard(), { act: send });
		act(() => gap(r, 7).props.onPress());
		await act(async () => {
			gap(r, 7).props.onPress();
		});
		expect(send).toHaveBeenCalledWith({ type: "fence", edge: 7 });
		expect(textOf(r.root)).toContain("that gap was just fenced · pick another");
		expect(asleep(gaps(r).find((n) => n.props.testID === "fence-gap-7")!)).toBe(false);
		act(() => {
			jest.runOnlyPendingTimers();
		});
		expect(textOf(r.root)).toContain("tap a gap to preview, tap it again to draw");
		act(() => r.unmount());
	});

	it("holds input while a request is in flight", () => {
		const r = mount(yard(), { pending: true });
		expect(gaps(r).every(asleep)).toBe(true);
		act(() => r.unmount());
	});

	it("tells a pig on an extra move to draw again", () => {
		// Turns alternate on 0, 4 and 20 (three sides of pen 0); seat 1 closes it
		// with 21 and owes another fence.
		const { state } = drawn(yard(), [0, 4, 20, 21]);
		expect(state.pens[0]).toBe(1);
		expect(state.turn).toBe(1);
		const r = mount(state, { you: 1 });
		expect(textOf(r.root)).toContain("you kept a pen · draw again");
		act(() => r.unmount());
	});
});

// ── Their move, cues and the end ─────────────────────────────────────────────

describe("Fence the Pen board · their move and the cues", () => {
	it("sleeps every gap while another pig draws, and says nothing under the yard", () => {
		const { state } = drawn(yard(), [0]);
		const send = jest.fn(async () => ({ ok: true }) as ActResult);
		const r = mount(state, { you: 0, act: send });
		expect(state.turn).toBe(1);
		expect(gaps(r).every((n) => asleep(n) && n.props.accessibilityHint === undefined)).toBe(true);
		act(() => gap(r, 5).props.onPress());
		expect(send).not.toHaveBeenCalled();
		expect(hosts(r, "fence-preview")).toHaveLength(0);
		expect(textOf(r.root)).not.toContain("tap a gap");
		act(() => r.unmount());
	});

	it("plays a sweep's cues once: the rail, each pen, the stamp, and the draw-again tape", () => {
		// Clover (seat 1) closes pens 0 and 1 with the shared rail 21.
		const before = drawn(yard(), [0, 1, 4, 5, 20, 22, 39]);
		expect(before.state.turn).toBe(1);
		const r = mount(before.state, { you: 0, rev: 7 });
		expect(hosts(r, "fence-again-tape")).toHaveLength(0);
		const sweep = drawn(before.state, [21]);
		expect(sweep.events.map((e) => e.type)).toEqual(["fence", "pen", "pen", "again"]);
		act(() => r.update(element(sweep.state, { you: 0, rev: 8, events: sweep.events })));
		const tape = hosts(r, "fence-again-tape");
		expect(tape).toHaveLength(1);
		expect(textOf(tape[0])).toContain("Clover draws again");
		expect(labelled(r, "Pen in row 1, column 1")[0].props.accessibilityLabel).toBe("Pen in row 1, column 1, kept by Clover");
		expect(labelled(r, "Pen in row 1, column 2")[0].props.accessibilityLabel).toBe("Pen in row 1, column 2, kept by Clover");
		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
			"Clover drew the fence between post B1 and B2. Clover kept 2 pens. Clover draws again.",
		);
		// Re-rendering the same revision replays nothing.
		act(() => r.update(element(sweep.state, { you: 0, rev: 8, events: sweep.events, pending: false })));
		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
		act(() => {
			jest.runAllTimers();
		});
		act(() => r.unmount());
	});

	it("lifts the last fence another pig drew and names it, for a pig arriving without the cues", () => {
		const sweep = drawn(drawn(yard(), [0, 1, 4, 5, 20, 22, 39]).state, [21]);
		const r = mount(sweep.state, { you: 0, rev: 9 });
		expect(hosts(r, "fence-last")).toHaveLength(1);
		expect(labelled(r, "32 fences left")[0].props.accessibilityLabel).toBe("32 fences left. Last fence: Clover, between post B1 and B2");
		act(() => r.unmount());
		// Your own last fence needs no pointing out.
		const mine = mount(sweep.state, { you: 1, rev: 9 });
		expect(hosts(mine, "fence-last")).toHaveLength(0);
		expect(labelled(mine, "32 fences left")[0].props.accessibilityLabel).toBe("32 fences left");
		act(() => mine.unmount());
	});

	it("does not replay the cues a board mounts into", () => {
		const sweep = drawn(drawn(yard(), [0, 1, 4, 5, 20, 22, 39]).state, [21]);
		const r = mount(sweep.state, { you: 0, rev: 8, events: sweep.events });
		expect(hosts(r, "fence-again-tape")).toHaveLength(0);
		expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
		act(() => r.unmount());
	});

	it("draws the same cues as cross-fades under Reduce Motion", () => {
		const before = drawn(yard(), [0, 1, 4, 5, 20, 22, 39]);
		const r = mount(before.state, { you: 0, rev: 7, reduceMotion: true });
		const sweep = drawn(before.state, [21]);
		act(() => r.update(element(sweep.state, { you: 0, rev: 8, events: sweep.events, reduceMotion: true })));
		expect(hosts(r, "fence-again-tape")).toHaveLength(1);
		act(() => {
			jest.runAllTimers();
		});
		act(() => r.unmount());
	});

	it("dims nothing it should not: a departed pig's pens still read as theirs", () => {
		const sweep = drawn(drawn(yard(3), [0, 1, 4, 5, 20, 22, 39, 38]).state, [21]);
		const owner = sweep.state.pens[0];
		const r = mount(sweep.state, { you: 0, gone: [owner] });
		expect(labelled(r, "Pen in row 1, column 1")[0].props.accessibilityLabel).toBe(`Pen in row 1, column 1, kept by ${NAMES[owner]}, who trotted off`);
		act(() => r.unmount());
	});

	it("shows the finished yard at the end: every fence up, every pen stamped, no hint", () => {
		const all = Array.from({ length: edgeCount(G4) }, (_, e) => e);
		const { state } = drawn(yard(), all);
		expect(state.over).toBe(true);
		const r = mount(state, { you: 0, rev: 50 });
		expect(gaps(r)).toHaveLength(0);
		expect(textOf(r.root)).toContain("every fence is up");
		expect(textOf(r.root)).not.toContain("tap a gap");
		expect(labelled(r, "Pen in row").every((n) => /kept by (you|Clover)$/.test(n.props.accessibilityLabel))).toBe(true);
		act(() => r.unmount());
	});
});

// ── The pigs in the seat strip ───────────────────────────────────────────────

describe("Fence the Pen · seat-strip reactions", () => {
	const react = fenceThePenUi.reactions!;

	it("leaves the pigs alone for a fence that closes nothing", () => {
		const { state, events } = drawn(yard(), [0]);
		expect(react(events, snapshot(state, { events }))).toEqual({});
	});

	it("makes a pig that keeps a pen and draws again jump, and stays happy", () => {
		const { state, events } = drawn(yard(), [0, 4, 20, 21]);
		expect(events.map((e) => e.type)).toEqual(["fence", "pen", "again"]);
		expect(react(events, snapshot(state, { events }))).toEqual({ 1: { kind: "jump", mood: "happy" } });
	});

	it("makes the others gasp at a sweep", () => {
		const sweep = drawn(drawn(yard(3), [0, 1, 4, 5, 20, 22, 39, 38]).state, [21]);
		expect(react(sweep.events, snapshot(sweep.state, { events: sweep.events }))).toEqual({
			2: { kind: "jump", mood: "happy" },
			0: { kind: "surprise" },
			1: { kind: "surprise" },
		});
	});

	it("shows a pig that ran out the clock as tired, even if its defaults kept pens", () => {
		const events: GameEvent[] = [
			{ type: "timeout", seat: 1 },
			{ type: "fence", seat: 1, edge: 0 },
			{ type: "pen", seat: 1, pen: 0 },
			{ type: "pen", seat: 1, pen: 1 },
			{ type: "again", seat: 1 },
			{ type: "fence", seat: 1, edge: 9 },
			{ type: "turn", seat: 0 },
		];
		expect(react(events, snapshot(yard(), { events }))).toEqual({ 1: { mood: "tired" } });
	});

	it("ends with the winners happy and everyone else waving; a pig who left does nothing", () => {
		const all = Array.from({ length: edgeCount(G4) }, (_, e) => e);
		const { state, events } = drawn(yard(3), all);
		expect(events.map((e) => e.type)).toContain("end");
		const room = snapshot(state, { events, gone: [2] });
		const happy = { kind: "happy", mood: "happy" };
		const won = react(events, { ...room, result: { kind: "win", winners: [1], scores: state.scores, summary: "", reason: "complete" } });
		expect(won).toEqual({ 0: { kind: "wave" }, 1: happy });
		// A shared win: both pigs still at the table are happy.
		const shared = react(events, { ...room, result: { kind: "draw", winners: [0, 1], scores: state.scores, summary: "", reason: "complete" } });
		expect(shared).toEqual({ 0: happy, 1: happy });
		// Before the room has written its result, the most pens on the view decide.
		const best = Math.max(state.scores[0], state.scores[1]);
		const early = react(events, { ...room, result: null });
		for (const seat of [0, 1]) expect(early[seat]).toEqual(state.scores[seat] === best ? happy : { kind: "wave" });
		expect(early[2]).toBeUndefined();
	});

	it("holds over every revision of real tables: valid seats and kinds, nothing for a pig who left", () => {
		const kinds = new Set(["happy", "jump", "surprise", "wave", undefined]);
		const moods = new Set(["happy", "tired", undefined]);
		let reacted = 0;
		for (let i = 0; i < 24; i++) {
			const seats = 2 + (i % 3);
			playOut(fence_the_pen, {
				seats,
				seed: `react-${i}`,
				pace: i % 2 === 0 ? "live" : "async",
				timeoutRate: 0.15,
				leave: seats > 2 ? { seat: i % seats, atStep: 6 } : undefined,
				onRevision: (room) => {
					if (room.game === null) return;
					for (let you = 0; you < seats; you++) {
						const snap = snapshotFor(room, fence_the_pen, you) as RoomSnapshot<FenceState>;
						const out = react(eventsFor(room.events, you), snap);
						for (const [key, r] of Object.entries(out)) {
							const seat = Number(key);
							expect(Number.isInteger(seat) && seat >= 0 && seat < seats).toBe(true);
							expect(room.seats[seat]?.gone).toBe(false);
							expect(kinds.has(r?.kind)).toBe(true);
							expect(moods.has(r?.mood)).toBe(true);
							reacted++;
						}
					}
				},
			});
		}
		expect(reacted).toBeGreaterThan(100);
	});
});

// ── Sizes, words and the seat strip ──────────────────────────────────────────

describe("Fence the Pen board · fit and words", () => {
	it.each([339, 366])("fits a %ipt board: the yard inside the width, every gap a full tap target", (width) => {
		for (const v of [yard(2, "live"), yard(4, "async")]) {
			const g = { rows: v.rows, cols: v.cols };
			const L = yardLayout(width, g);
			expect(L.w).toBeLessThanOrEqual(width + 0.001);
			for (const at of edgePlaces(g, edgeCount(g))) {
				const z = zoneRect(L, at);
				expect(Math.min(z.width, z.height)).toBeGreaterThanOrEqual(TAP_MIN);
				expect(z.left).toBeGreaterThanOrEqual(0);
				expect(z.top).toBeGreaterThanOrEqual(0);
				expect(z.left + z.width).toBeLessThanOrEqual(L.w + 0.001);
				expect(z.top + z.height).toBeLessThanOrEqual(L.h + 0.001);
			}
			// A pen's label never sits under a gap's zone.
			for (let pen = 0; pen < penCount(g); pen++) {
				const p = penLabelRect(L, g, pen);
				for (const at of edgePlaces(g, edgeCount(g))) {
					const z = zoneRect(L, at);
					const e = 1e-6;
					const overlap =
						p.left + e < z.left + z.width && z.left + e < p.left + p.width && p.top + e < z.top + z.height && z.top + e < p.top + p.height;
					expect(overlap).toBe(false);
				}
			}
			const r = mount(v, { width });
			expect(gaps(r)).toHaveLength(edgeCount(g));
			act(() => r.unmount());
		}
	});

	it("says pens under each pig, never a zero", () => {
		const status = fenceThePenUi.seatStatus!;
		const v = { ...yard(3), scores: [0, 1, 5] };
		const room = snapshot(v);
		expect(status(v, 0, room)).toBeNull();
		expect(status(v, 1, room)).toBe("1 pen");
		expect(status(v, 2, room)).toBe("5 pens");
		expect(fenceThePenUi.seatStrip).toBe("pigs");
		expect(fenceThePenUi.howTo.sentence).toBe(fence_the_pen.tagline);
		expect(fenceThePenUi.howTo.steps.length).toBeGreaterThanOrEqual(2);
	});

	it("speaks the yard by its posts and pens", () => {
		expect(postName({ r: 1, c: 1 })).toBe("B2");
		expect(fenceLabel(G4, 5)).toBe("Fence between post B2 and C2");
		expect(edgePosts(G4, 26).map(postName)).toEqual(["B2", "B3"]);
		expect(fenceLabel(G4, 26)).toBe("Fence between post B2 and B3");
		expect(penLabel(G4, 6, null, 3)).toBe("Pen in row 2, column 3, 3 of 4 fences up");
		expect(penLabel(G4, 6, "you", 4)).toBe("Pen in row 2, column 3, kept by you");
		const nameOf = (s: Seat) => (s === 0 ? "you" : NAMES[s]);
		expect(announcementOf(G4, [{ type: "fence", seat: 0, edge: 3 }, { type: "turn", seat: 1 }], 0, nameOf)).toBeNull();
		expect(announcementOf(G4, [{ type: "fence", seat: 0, edge: 3 }, { type: "pen", seat: 0, pen: 3 }, { type: "again", seat: 0 }], 0, nameOf)).toBe(
			"You kept a pen. Draw again.",
		);
	});

	it("queues a revision's cues: each rail and each pen on its own beat, one tape over the run", () => {
		const t = timelineOf([
			{ type: "timeout", seat: 1 },
			{ type: "fence", seat: 1, edge: 4 },
			{ type: "pen", seat: 1, pen: 0 },
			{ type: "again", seat: 1 },
			{ type: "fence", seat: 1, edge: 9 },
			{ type: "pen", seat: 1, pen: 5 },
			{ type: "pen", seat: 1, pen: 6 },
			{ type: "again", seat: 1 },
			{ type: "fence", seat: 1, edge: 30 },
			{ type: "turn", seat: 0 },
		]);
		expect(t.fences.get(4)).toEqual({ seat: 1, at: 0 });
		expect(t.pens.get(0)).toBe(FENCE_BEAT);
		expect(t.fences.get(9)?.at).toBe(FENCE_BEAT + PEN_BEAT);
		expect(t.pens.get(5)).toBe(FENCE_BEAT * 2 + PEN_BEAT);
		expect(t.pens.get(6)).toBe(FENCE_BEAT * 2 + PEN_BEAT * 2);
		expect(t.again).toEqual({ seat: 1, at: FENCE_BEAT + PEN_BEAT, until: FENCE_BEAT * 2 + PEN_BEAT * 3 });
		expect(t.fences.get(30)?.at).toBe(FENCE_BEAT * 2 + PEN_BEAT * 3);
	});

	it("slides a rail in from its drawer's side of the yard", () => {
		const L = yardLayout(354, G4);
		const mid = edgePlaces(G4, edgeCount(G4))[vEdge(G4, 3, 2)];
		// Of two pigs on the strip above, seat 0 stands left and seat 1 right:
		// a rail comes from its drawer's side, and from above.
		const left = slideFrom(L, mid, 0, 2);
		const right = slideFrom(L, mid, 1, 2);
		expect(left.x).toBeLessThan(0);
		expect(right.x).toBeGreaterThan(0);
		expect(left.y).toBeLessThan(0);
		expect(Math.hypot(left.x, left.y)).toBeCloseTo(L.slide);
	});

	it("never renders an em dash or an emoji", () => {
		const sweep = drawn(drawn(yard(), [0, 1, 4, 5, 20, 22, 39]).state, [21]);
		const r = mount(sweep.state, { you: 0, rev: 1 });
		act(() => r.update(element(sweep.state, { you: 0, rev: 2, events: sweep.events })));
		const words = [
			textOf(r.root),
			...r.root.findAll((n) => typeof n.props.accessibilityLabel === "string").map((n) => n.props.accessibilityLabel as string),
			...r.root.findAll((n) => typeof n.props.accessibilityHint === "string").map((n) => n.props.accessibilityHint as string),
			fenceThePenUi.howTo.sentence,
			...fenceThePenUi.howTo.steps,
		].join("\n");
		expect(words).not.toContain(EM_DASH);
		expect(EMOJI.test(words)).toBe(false);
		act(() => {
			jest.runAllTimers();
		});
		act(() => r.unmount());
	});
});

// ── Fitting the height the match screen gives it ─────────────────────────────

/** Every phone and text size this board is drawn at (fit.ts BOARD_HEIGHTS,
 *  the `pigs` strip), and the 4×4 and 3×3 pitch the plan gives it at text
 *  scale 1 and 1.3. The yard is the board and every move, so all of it must
 *  sit inside the height. */
const FIT_CASES: { name: string; width: number; height: number; pitch4: [number, number]; pitch3: [number, number] }[] = [
	{ name: "17 Pro", width: BOARD_WIDTHS.pro, height: BOARD_HEIGHTS.pro.pigs, pitch4: [79.5, 79.5], pitch3: [106, 106] },
	{ name: "17 Pro, accessibility-large", width: BOARD_WIDTHS.pro, height: BOARD_HEIGHTS.proAx.pigs, pitch4: [73.75, 70.75], pitch3: [98.33, 94.33] },
	{ name: "SE", width: BOARD_WIDTHS.se, height: BOARD_HEIGHTS.se.pigs, pitch4: [53, 50], pitch3: [70.67, 66.67] },
	{ name: "SE, accessibility-large", width: BOARD_WIDTHS.se, height: BOARD_HEIGHTS.seAx.pigs, pitch4: [41, 38], pitch3: [54.67, 50.67] },
	{ name: "SE, the design target", width: BOARD_WIDTHS.se, height: SE_DESIGN_HEIGHT, pitch4: [71, 68], pitch3: [94.67, 90.67] },
];
const SCALES = [1, 1.3] as const;
/** jest's window reports fontScale 2, so a rendered board is at the cap. */
const RENDERED_SCALE = 1.3;
/** Below this the yard stops shrinking (its floor pitch), so the sweep starts here. */
const SWEEP_FLOOR = 210;
const EPS = 1e-6;

/** Where the plan puts the rows in a board `height` tall: stacked at its foot. */
function placed(width: number, height: number, g: Grid, s: number) {
	const plan = fencePlan(width, height, g, s);
	const L = yardLayout(width, g, plan.side);
	const stack = plan.countRow + plan.gap + L.h + plan.gap + plan.hintRow;
	const yardBottom = height - plan.hintRow - plan.gap;
	return { plan, L, stack, yardTop: yardBottom - L.h, yardBottom };
}

function expectYardFits(width: number, height: number, g: Grid, s: number) {
	const { plan, L, stack, yardTop, yardBottom } = placed(width, height, g, s);
	expect(stack).toBeLessThanOrEqual(height + EPS);
	expect(yardTop).toBeGreaterThanOrEqual(plan.countRow + plan.gap - EPS);
	expect(yardBottom).toBeLessThanOrEqual(height + EPS);
	expect(L.w).toBeLessThanOrEqual(width + EPS);
	// The yard's hard shadow lands in the gap over the hint, and the "draw
	// again" tape's overhang lands in the count row and the gap under it.
	expect(plan.gap).toBeGreaterThanOrEqual(STICKER_SHADOW.shadowOffset.height);
	expect(plan.countRow + plan.gap).toBeGreaterThanOrEqual(SPACE.md);
	// Every gap stays a full tap target inside the yard.
	for (const at of edgePlaces(g, edgeCount(g))) {
		const z = zoneRect(L, at);
		expect(Math.min(z.width, z.height)).toBeGreaterThanOrEqual(TAP_MIN);
		expect(z.left).toBeGreaterThanOrEqual(-EPS);
		expect(z.top).toBeGreaterThanOrEqual(-EPS);
		expect(z.left + z.width).toBeLessThanOrEqual(L.w + EPS);
		expect(z.top + z.height).toBeLessThanOrEqual(L.h + EPS);
	}
	return { plan, L };
}

describe("Fence the Pen board · fitting the height", () => {
	it("says it fits the height it is given", () => {
		expect(fenceThePenUi.fillsHeight).toBe(true);
	});

	describe.each(FIT_CASES)("$name ($width × $height pt)", ({ width, height, pitch4, pitch3 }) => {
		it.each(SCALES.map((s, i) => [s, i] as const))("at text scale %s: the whole yard sits inside the board", (s, i) => {
			const four = expectYardFits(width, height, G4, s);
			const three = expectYardFits(width, height, G3, s);
			expect(four.L.pitch).toBeCloseTo(pitch4[i], 1);
			expect(three.L.pitch).toBeCloseTo(pitch3[i], 1);
			// A pen's spoken label stays clear of every gap's zone wherever the
			// pitch leaves room for one (every phone but the accessibility-large SE).
			if (four.L.pitch >= TAP_MIN) {
				for (let pen = 0; pen < penCount(G4); pen++) {
					const p = penLabelRect(four.L, G4, pen);
					for (const at of edgePlaces(G4, edgeCount(G4))) {
						const z = zoneRect(four.L, at);
						const overlap = p.left + EPS < z.left + z.width && z.left + EPS < p.left + p.width && p.top + EPS < z.top + z.height && z.top + EPS < p.top + p.height;
						expect(overlap).toBe(false);
					}
				}
			}
		});
	});

	it("keeps the 17 Pro's yard the full board width and only narrows it when the height is the tighter edge", () => {
		for (const s of SCALES) {
			expect(placed(BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.pigs, G4, s).L.w).toBeCloseTo(BOARD_WIDTHS.pro);
			expect(placed(BOARD_WIDTHS.se, BOARD_HEIGHTS.se.pigs, G4, s).L.w).toBeLessThan(BOARD_WIDTHS.se);
		}
	});

	it("fits every height from the floor up, and the yard only grows as the board does", () => {
		for (const width of [BOARD_WIDTHS.se, BOARD_WIDTHS.pro]) {
			for (const g of [G4, G3]) {
				for (const s of SCALES) {
					let last = 0;
					for (let height = SWEEP_FLOOR; height <= 600; height += 10) {
						const { L } = expectYardFits(width, height, g, s);
						expect(L.w).toBeGreaterThanOrEqual(last - EPS);
						last = L.w;
					}
				}
			}
		}
	});

	it("sizes from the width alone until the match screen has measured a height", () => {
		const plan = fencePlan(354, undefined, G4, 1);
		expect(yardLayout(354, G4, plan.side)).toEqual(yardLayout(354, G4));
		const r = mount(yard(), { width: 354 });
		const board = StyleSheet.flatten(hosts(r, "fence-board")[0].props.style);
		expect(board.height).toBeUndefined();
		expect(StyleSheet.flatten(hosts(r, "fence-yard")[0].props.style)).toMatchObject({ width: 354, height: 354 });
		act(() => r.unmount());
	});

	it.each([
		["17 Pro", BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.pigs],
		["SE", BOARD_WIDTHS.se, BOARD_HEIGHTS.se.pigs],
		["SE, the design target", BOARD_WIDTHS.se, SE_DESIGN_HEIGHT],
	])("draws the %s board exactly its height, with the yard and every gap inside it", (_name, width, height) => {
		for (const v of [yard(2, "live"), yard(4, "async")]) {
			const g = { rows: v.rows, cols: v.cols };
			const { plan, L } = placed(width, height, g, RENDERED_SCALE);
			const r = mount(v, { width, height });
			const board = StyleSheet.flatten(hosts(r, "fence-board")[0].props.style);
			expect(board).toMatchObject({ width, height, gap: plan.gap, justifyContent: "flex-end" });
			const count = StyleSheet.flatten(hosts(r, "fence-count-row")[0].props.style);
			const yardStyle = StyleSheet.flatten(hosts(r, "fence-yard")[0].props.style);
			const hint = StyleSheet.flatten(hosts(r, "fence-hint-row")[0].props.style);
			expect(yardStyle).toMatchObject({ width: L.w, height: L.h });
			expect(count.height).toBe(plan.countRow);
			expect(hint.height).toBe(plan.hintRow);
			// The three rows and their two gaps, stacked at the foot of the board.
			const stack = Number(count.height) + Number(yardStyle.height) + Number(hint.height) + plan.gap * 2;
			expect(stack).toBeLessThanOrEqual(height + EPS);
			// Every gap's zone lies inside the yard, so inside the board.
			const zones = gaps(r);
			expect(zones).toHaveLength(edgeCount(g));
			for (const z of zones) {
				const rect = StyleSheet.flatten(z.props.style);
				expect(Number(rect.left)).toBeGreaterThanOrEqual(-EPS);
				expect(Number(rect.top)).toBeGreaterThanOrEqual(-EPS);
				expect(Number(rect.left) + Number(rect.width)).toBeLessThanOrEqual(L.w + EPS);
				expect(Number(rect.top) + Number(rect.height)).toBeLessThanOrEqual(L.h + EPS);
				expect(Math.min(Number(rect.width), Number(rect.height))).toBeGreaterThanOrEqual(TAP_MIN);
			}
			act(() => r.unmount());
		}
	});
});

// ── The painted pieces ───────────────────────────────────────────────────────

/** The painted art's subject inside its 256 px square (alpha bounds, PIL). */
const RAIL_SPAN = 230 / 256;
const POST_WIDTH = 126 / 256;

/** The nearest host view under `node` that turns its children. */
function turnUnder(node: TestRenderer.ReactTestInstance): string | undefined {
	const found = node.findAll((n) => typeof n.type === "string" && Array.isArray(StyleSheet.flatten(n.props.style)?.transform));
	for (const n of found) {
		const turn = (StyleSheet.flatten(n.props.style).transform as Record<string, unknown>[]).find((t) => "rotate" in t);
		if (turn) return String(turn.rotate);
	}
	return undefined;
}

function sameRect(style: Record<string, unknown>, rect: { left: number; top: number; width: number; height: number }) {
	return (
		Math.abs(Number(style.left) - rect.left) < EPS &&
		Math.abs(Number(style.top) - rect.top) < EPS &&
		Math.abs(Number(style.width) - rect.width) < EPS &&
		Math.abs(Number(style.height) - rect.height) < EPS
	);
}

describe("Fence the Pen board · the painted pieces", () => {
	it.each([
		["at the natural width", 366, undefined],
		["fitted to the SE's height", BOARD_WIDTHS.se, BOARD_HEIGHTS.se.pigs],
	])("draws every rail the size of its box %s, turned a quarter on a vertical fence, deaf to touch", (_name, width, height) => {
		const across = hEdge(G4, 0, 0);
		const down = vEdge(G4, 1, 2);
		const { state } = drawn(yard(), [across, down]);
		const r = mount(state, { width, height });
		const L: YardLayout =
			height === undefined ? yardLayout(width, G4) : yardLayout(width, G4, fencePlan(width, height, G4, RENDERED_SCALE).side);
		// Both copies of the art (the wood and its seat tint) take the box's own
		// size: the asset's 256 pt square never leaks through.
		const art = [...hosts(r, "fence-rail-art"), ...hosts(r, "fence-rail-tint")];
		expect(art).toHaveLength(4);
		for (const image of art) {
			expect(image.props.source).toBe(FENCE_ART.rail);
			expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: L.rail, height: L.rail });
		}
		// Each rail's box is one pitch square centred on its fence, takes no
		// touch (its clear corners lie over the neighbouring gaps), and turns
		// a quarter for a vertical fence.
		const boxes = [...hosts(r, "fence-rail"), ...hosts(r, "fence-last")];
		expect(boxes).toHaveLength(2);
		for (const [edge, turn] of [
			[across, "0deg"],
			[down, "90deg"],
		] as const) {
			const at = edgeAt(G4, edge);
			const box = boxes.find((b) => sameRect(StyleSheet.flatten(b.props.style), alongEdge(L, at, L.rail, L.rail)));
			expect(box).toBeDefined();
			expect(box!.props.pointerEvents).toBe("none");
			expect(turnUnder(box!)).toBe(turn);
			expect(box!.findAll((n) => typeof n.props.onPress === "function" || n.props.accessible === true)).toHaveLength(0);
		}
		// The painted bar spans the fence: its ends tuck under the two posts
		// (each end's gap to a post's centre is under the post's half-width) and
		// never run past them.
		const railDrawn = L.rail * RAIL_SPAN;
		expect((L.pitch - railDrawn) / 2).toBeLessThan((L.post * POST_WIDTH) / 2);
		expect(railDrawn).toBeLessThanOrEqual(L.pitch);
		act(() => r.unmount());
	});

	it("draws every post and a closed pen's patch at their boxes' explicit sizes", () => {
		const width = 366;
		const L = yardLayout(width, G4);
		const { state } = drawn(yard(), [0, 4, 20, 21]);
		expect(state.pens[0]).toBe(1);
		const r = mount(state, { width });
		const posts = r.root.findAll((n) => typeof n.type === "string" && n.props.source === FENCE_ART.post);
		expect(posts).toHaveLength((G4.rows + 1) * (G4.cols + 1));
		for (const post of posts) {
			const style = StyleSheet.flatten(post.props.style);
			expect(style).toMatchObject({ width: L.post, height: L.post });
		}
		const centre = postCentre(L, { r: 2, c: 3 });
		expect(posts.some((p) => sameRect(StyleSheet.flatten(p.props.style), { left: centre.x - L.post / 2, top: centre.y - L.post / 2, width: L.post, height: L.post }))).toBe(true);
		const patch = r.root.findAll((n) => typeof n.type === "string" && n.props.source === FENCE_ART.penTruffle);
		expect(patch).toHaveLength(1);
		expect(StyleSheet.flatten(patch[0].props.style)).toMatchObject({ width: L.penArt, height: L.penArt });
		// The patch sits inside its pen.
		expect(L.penArt).toBeLessThanOrEqual(penCell(L, G4, 0).width);
		act(() => r.unmount());
	});
});
