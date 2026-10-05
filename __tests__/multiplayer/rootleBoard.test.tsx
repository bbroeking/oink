// The Rootle board (components/play/games/rootle/) rendered with
// react-test-renderer: your turn, their turn, a bust, a trot home, the last
// round, the end, Reduce Motion and two phone widths; plus the pure pieces
// under it (the copy, the cues, the seat strip line). The board is a pure
// function of the view, so every case is a view and a room snapshot.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, StyleSheet } from "react-native";
import type { RoomPhase, RoomSnapshot } from "../../multiplayer/protocol";
import type { GameEvent, Seat } from "../../multiplayer/types";
import { rootle, type RootleState } from "../../multiplayer/games/rootle/rules";
import { createRng } from "../../multiplayer/rng";
import { snapshotFor } from "../../multiplayer/engine";
import { TEST_LOOK, playOut } from "../../multiplayer/testkit";
import type { ActResult, BoardProps, SeatReaction } from "../../components/play/types";
import { rootleUi } from "../../components/play/games/rootle";
import { readCues } from "../../components/play/games/rootle/cues";
import {
	ROOTLE_HOW_TO,
	announcement,
	seatLine,
	statusLine,
	tableFacts,
	turnOutcome,
	waitingLine,
} from "../../components/play/games/rootle/copy";
import { flickFace } from "../../components/play/games/rootle/Die";
import { DIE_MIN, footHeight, rootleFit, statusLines } from "../../components/play/games/rootle/layout";
import { widestStatus } from "../../components/play/games/rootle/copy";
import { BOARD_HEIGHTS, BOARD_WIDTHS, SE_DESIGN_HEIGHT } from "../../components/play/games/fit";

// jest hoists these above the imports.
// The ui barrel reaches utils/log, whose Sentry import starts an interval
// that would keep jest alive after the suite.
jest.mock("../../utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	selectionAsync: jest.fn(async () => {}),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
	NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// ── Harness ──────────────────────────────────────────────────────────────────

const NAMES = ["Rosie", "Clover", "Biscuit", "Pickles"];
const EM_DASH = "\u2014";
// The lint's emoji set: the astral planes and the dingbat block, minus the
// marks the 2026-07-13 dingbat ruling sanctions (★ ♥ ✓ ✕ ✦ ✧).
const EMOJI = /[\u{1F300}-\u{1FAFF}]|[\u2600-\u2604\u2606-\u2664\u2666-\u2712\u2714\u2716-\u2725\u2728-\u27BF]/u;

function view(seats = 2, over: Partial<RootleState> = {}): RootleState {
	return { ...rootle.setup({ seats, rng: createRng("board"), pace: "live" }), ...over };
}

interface SnapOpts {
	you?: Seat;
	rev?: number;
	events?: GameEvent[];
	phase?: RoomPhase;
	gone?: Seat[];
}

function snapshot(v: RootleState, opts: SnapOpts = {}): RoomSnapshot<RootleState> {
	const result = rootle.result(v);
	return {
		roomId: "00000000-board",
		game: "rootle",
		rulesVersion: rootle.rulesVersion,
		pace: "live",
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

const Board = rootleUi.Board;

function element(v: RootleState, opts: BoardOpts = {}) {
	const room = snapshot(v, opts);
	const you = room.you ?? 0;
	const props: BoardProps<RootleState> = {
		view: v,
		room,
		you,
		yourTurn: room.activeSeats.includes(you),
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

function mount(v: RootleState, opts: BoardOpts = {}) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(element(v, opts));
	});
	return renderer;
}

/** Host nodes carrying a testID (composites forward it, so filter to hosts). */
function hosts(renderer: TestRenderer.ReactTestRenderer, testID: string) {
	return renderer.root.findAll((n) => typeof n.type === "string" && n.props.testID === testID);
}

function textOf(node: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	const walk = (n: TestRenderer.ReactTestInstance | string) => {
		if (typeof n === "string") out.push(n);
		else for (const child of n.children ?? []) walk(child);
	};
	walk(node);
	return out.join("");
}

function textById(renderer: TestRenderer.ReactTestRenderer, testID: string): string {
	const [node] = hosts(renderer, testID);
	return node ? textOf(node) : "";
}

function allText(renderer: TestRenderer.ReactTestRenderer): string {
	return textOf(renderer.root);
}

/** The pressable behind a Button, by the Button's testID. */
function pressable(renderer: TestRenderer.ReactTestRenderer, testID: string) {
	const found = renderer.root.findAll(
		(n) => n.props.testID === testID && typeof n.props.onPress === "function" && n.props.accessibilityRole === "button",
	);
	if (found.length === 0) throw new Error(`no pressable ${testID}`);
	return found[0];
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

// ── Your turn ────────────────────────────────────────────────────────────────

describe("Rootle board · your turn", () => {
	it("at the hand-off: Rootle is live, Trot home is locked, the die has not been rolled", () => {
		const r = mount(view(2));
		expect(textById(r, "rootle-status")).toBe("Your turn");
		expect(pressable(r, "rootle-roll").props.accessibilityState).toMatchObject({ disabled: false });
		const hold = pressable(r, "rootle-hold");
		expect(hold.props.accessibilityState).toMatchObject({ disabled: true });
		expect(hold.props.accessibilityHint).toBe("Roll the die at least once first");
		expect(hosts(r, "rootle-die")[0].props.accessibilityLabel).toBe("The die, not rolled yet");
		expect(textById(r, "rootle-basket")).toBe("empty");
		expect(textById(r, "rootle-barn")).toBe("nothing yet");
		expect(textById(r, "rootle-barn-owner")).toBe("your barn");
		expect(textById(r, "rootle-strip")).toContain("no turns yet");
		expect(hosts(r, "rootle-tape")).toHaveLength(0);
		expect(hosts(r, "rootle-waiting")).toHaveLength(0);
		act(() => r.unmount());
	});

	it("sends a roll, wobbles and shuts input until the next revision, then reopens", async () => {
		const send = jest.fn(async () => ({ ok: true }) as ActResult);
		const v = view(2);
		const r = mount(v, { act: send, rev: 4 });
		await act(async () => {
			pressable(r, "rootle-roll").props.onPress();
		});
		expect(send).toHaveBeenCalledWith({ type: "roll" });
		expect(pressable(r, "rootle-roll").props.accessibilityState).toMatchObject({ disabled: true, busy: true });
		expect(allText(r)).toContain("rolling");
		// The roll lands: a new revision reopens the controls.
		const rolled = { ...v, basket: 5, faces: [5] };
		act(() => r.update(element(rolled, { act: send, rev: 5, events: [{ type: "roll", seat: 0, face: 5, basket: 5 }] })));
		act(() => jest.advanceTimersByTime(1_000));
		expect(pressable(r, "rootle-roll").props.accessibilityState).toMatchObject({ disabled: false });
		expect(pressable(r, "rootle-hold").props.accessibilityState).toMatchObject({ disabled: false });
		expect(hosts(r, "rootle-die-face-5")).toHaveLength(1);
		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("You rolled 5. 5 in the basket.");
		act(() => r.unmount());
	});

	it("mid-turn: Trot home says what it banks and sends hold", async () => {
		const send = jest.fn(async () => ({ ok: true }) as ActResult);
		const r = mount(view(2, { basket: 14, faces: [4, 6, 4], barn: [12, 30] }), { act: send });
		expect(textById(r, "rootle-status")).toBe("Your turn · roll again or trot home");
		const hold = pressable(r, "rootle-hold");
		expect(hold.props.accessibilityLabel).toBe("Trot home with 14");
		expect(hold.props.accessibilityHint).toBe("Puts the 14 in your basket into your barn and ends your turn");
		expect(textById(r, "rootle-basket")).toBe("14");
		expect(textById(r, "rootle-barn")).toBe("12");
		expect(hosts(r, "rootle-die-face-4")).toHaveLength(1);
		await act(async () => {
			hold.props.onPress();
		});
		expect(send).toHaveBeenCalledWith({ type: "hold" });
		act(() => r.unmount());
	});

	it("names the consequence when trotting home now reaches 50", () => {
		const r = mount(view(2, { basket: 9, faces: [4, 5], barn: [44, 30] }));
		expect(textById(r, "rootle-status")).toBe("Trot home now to reach 50");
		act(() => r.unmount());
	});

	it("reopens the controls when the server refuses", async () => {
		const send = jest.fn(async () => ({ ok: false, error: "stale" }) as ActResult);
		const r = mount(view(2), { act: send });
		await act(async () => {
			pressable(r, "rootle-roll").props.onPress();
		});
		expect(send).toHaveBeenCalledTimes(1);
		expect(pressable(r, "rootle-roll").props.accessibilityState).toMatchObject({ disabled: false });
		act(() => r.unmount());
	});

	it("takes no taps while a request is pending", () => {
		const r = mount(view(2, { basket: 6, faces: [6] }), { pending: true });
		expect(pressable(r, "rootle-roll").props.accessibilityState).toMatchObject({ disabled: true });
		expect(pressable(r, "rootle-hold").props.accessibilityState).toMatchObject({ disabled: true });
		act(() => r.unmount());
	});
});

// ── Their turn ───────────────────────────────────────────────────────────────

describe("Rootle board · their turn", () => {
	it("hides both controls, names the pig rootling and tells you where you stand", () => {
		const r = mount(view(3, { turn: 1, basket: 8, faces: [3, 5] }), { you: 0 });
		expect(hosts(r, "rootle-roll")).toHaveLength(0);
		expect(hosts(r, "rootle-hold")).toHaveLength(0);
		expect(textById(r, "rootle-status")).toBe("Clover is rootling…");
		expect(textById(r, "rootle-waiting")).toBe("you rootle after Biscuit");
		expect(textById(r, "rootle-basket")).toBe("8");
		act(() => r.unmount());
		const two = mount(view(2, { turn: 1 }), { you: 0 });
		expect(textById(two, "rootle-waiting")).toBe("you're next");
		act(() => two.unmount());
	});
});

// ── Moments ──────────────────────────────────────────────────────────────────

describe("Rootle board · the moments that end a turn", () => {
	it("a bust: the die lands on the Hungerer, the basket splats with what he ate, then the board moves on", () => {
		const before = view(2, { turn: 1, basket: 10, faces: [4, 6], barn: [20, 18] });
		const r = mount(before, { you: 0, rev: 5 });
		const after = view(2, {
			turn: 0,
			barn: [20, 18],
			log: [{ seat: 1, faces: [4, 6, 1], banked: 0, end: "bust" }],
		});
		act(() =>
			r.update(
				element(after, {
					you: 0,
					rev: 6,
					events: [
						{ type: "roll", seat: 1, face: 1, basket: 0 },
						{ type: "bust", seat: 1, lost: 10 },
						{ type: "turn", seat: 0, last: false },
					],
				}),
			),
		);
		expect(hosts(r, "rootle-splat")).toHaveLength(1);
		expect(textById(r, "rootle-basket")).toBe("10");
		expect(textById(r, "rootle-barn")).toBe("18");
		// The status line has moved on to you; the barn still says whose it is.
		expect(textById(r, "rootle-barn-owner")).toBe("Clover's barn");
		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
			"Clover rolled the Hungerer. He ate 10. Your turn.",
		);
		// The tumble lands on his face.
		act(() => jest.advanceTimersByTime(500));
		expect(hosts(r, "rootle-die-face-1")).toHaveLength(1);
		// The beat ends: the board is about the pig whose turn it now is.
		act(() => jest.advanceTimersByTime(1_000));
		expect(hosts(r, "rootle-splat")).toHaveLength(0);
		expect(textById(r, "rootle-basket")).toBe("empty");
		expect(textById(r, "rootle-barn")).toBe("20");
		expect(textById(r, "rootle-barn-owner")).toBe("your barn");
		expect(textById(r, "rootle-status")).toBe("Your turn");
		const rows = hosts(r, "rootle-strip-row");
		expect(rows).toHaveLength(1);
		expect(textOf(rows[0])).toContain("Clover");
		expect(textOf(rows[0])).toContain("4 · 6");
		expect(textOf(rows[0])).toContain("Hungerer ate 10");
		expect(rows[0].props.accessibilityLabel).toBe("Clover, rolled 4, 6, then the Hungerer ate 10");
		act(() => r.unmount());
	});

	it("a trot home: the basket's number is carried into the barn for a beat", () => {
		const before = view(2, { turn: 1, basket: 13, faces: [4, 6, 3], barn: [20, 18] });
		const r = mount(before, { you: 0, rev: 8 });
		const after = view(2, { turn: 0, barn: [20, 31], log: [{ seat: 1, faces: [4, 6, 3], banked: 13, end: "hold" }] });
		act(() =>
			r.update(
				element(after, {
					you: 0,
					rev: 9,
					events: [
						{ type: "hold", seat: 1, banked: 13, barn: 31 },
						{ type: "turn", seat: 0, last: false },
					],
				}),
			),
		);
		expect(textById(r, "rootle-basket")).toBe("13");
		expect(textById(r, "rootle-barn")).toBe("31");
		expect(hosts(r, "rootle-splat")).toHaveLength(0);
		act(() => jest.advanceTimersByTime(1_500));
		expect(textById(r, "rootle-barn")).toBe("20");
		expect(textOf(hosts(r, "rootle-strip-row")[0])).toContain("home with 13");
		act(() => r.unmount());
	});

	it("keeps the strip three ledger lines tall from the first turn to the last", () => {
		const turn = (seat: Seat, banked: number) => ({ seat, faces: [banked], banked, end: "hold" as const });
		for (const log of [[], [turn(1, 4)], [turn(0, 2), turn(1, 3), turn(0, 4), turn(1, 5), turn(0, 6)]]) {
			const r = mount(view(2, { log }));
			expect(hosts(r, "rootle-strip-line")).toHaveLength(3);
			expect(hosts(r, "rootle-strip-row")).toHaveLength(Math.min(log.length, 3));
			expect(textById(r, "rootle-strip").includes("no turns yet")).toBe(log.length === 0);
			act(() => r.unmount());
		}
		const r = mount(view(2, { log: [turn(0, 2), turn(1, 3), turn(0, 4), turn(1, 5), turn(0, 6)] }));
		const rows = hosts(r, "rootle-strip-row");
		expect(textOf(rows[0])).toContain("home with 6");
		expect(textOf(rows[2])).toContain("home with 4");
		act(() => r.unmount());
	});

	it("a board that mounts mid-game replays nothing", () => {
		const r = mount(view(2, { turn: 0, log: [{ seat: 1, faces: [1], banked: 0, end: "bust" }] }), {
			rev: 12,
			events: [{ type: "bust", seat: 1, lost: 0 }],
		});
		expect(hosts(r, "rootle-splat")).toHaveLength(0);
		expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
		expect(hosts(r, "rootle-die-face-1")).toHaveLength(1);
		act(() => r.unmount());
	});
});

// ── The last round and the end ───────────────────────────────────────────────

describe("Rootle board · the last round", () => {
	const lastRound = view(3, { barn: [52, 30, 20], lastRound: { leader: 0, owed: [2] }, turn: 1, log: [{ seat: 0, faces: [6, 6], banked: 12, end: "hold" }] });

	it("lights the rail, tapes the die and names the barn to beat", () => {
		const r = mount(lastRound, { you: 1 });
		expect(hosts(r, "rootle-rail-lit")).toHaveLength(1);
		expect(textById(r, "rootle-tape")).toBe("last turn");
		expect(textById(r, "rootle-status")).toBe("Your last turn · 52 to beat");
		act(() => r.unmount());
	});

	it("tells the others where they stand", () => {
		const next = mount(lastRound, { you: 2 });
		expect(textById(next, "rootle-status")).toBe("Clover's last turn…");
		expect(textById(next, "rootle-waiting")).toBe("your last turn is next");
		act(() => next.unmount());
		const leader = mount(lastRound, { you: 0 });
		expect(textById(leader, "rootle-waiting")).toBe("you set the mark at 52");
		act(() => leader.unmount());
	});
});

describe("Rootle board · the end", () => {
	it("shows no controls, counts the barns and leaves the biggest barn on the table", () => {
		const done = view(2, { barn: [47, 54], over: true, lastRound: { leader: 1, owed: [] }, turn: 0, log: [{ seat: 0, faces: [5, 1], banked: 0, end: "bust" }] });
		const r = mount(done, { you: 0 });
		expect(hosts(r, "rootle-roll")).toHaveLength(0);
		expect(hosts(r, "rootle-waiting")).toHaveLength(0);
		expect(hosts(r, "rootle-tape")).toHaveLength(0);
		expect(textById(r, "rootle-status")).toBe("The barns are counted");
		expect(textById(r, "rootle-basket")).toBe("all home");
		expect(textById(r, "rootle-barn")).toBe("54");
		expect(textById(r, "rootle-barn-owner")).toBe("Clover's barn");
		act(() => r.unmount());
	});

	it("goes quiet when a forfeit ends the room before the race is run", () => {
		const r = mount(view(2, { turn: 1, barn: [10, 12] }), { you: 0, phase: "ended", gone: [1] });
		expect(hosts(r, "rootle-roll")).toHaveLength(0);
		expect(textById(r, "rootle-status")).toBe("The barns are counted");
		act(() => r.unmount());
	});
});

// ── Motion and size ──────────────────────────────────────────────────────────

describe("Rootle board · Reduce Motion and phone widths", () => {
	it("lands a roll's face at once, with no tumble, under Reduce Motion", () => {
		const r = mount(view(2), { reduceMotion: true, rev: 1 });
		act(() =>
			r.update(
				element(view(2, { basket: 5, faces: [5] }), {
					reduceMotion: true,
					rev: 2,
					events: [{ type: "roll", seat: 0, face: 5, basket: 5 }],
				}),
			),
		);
		expect(hosts(r, "rootle-die-face-5")).toHaveLength(1);
		act(() => r.unmount());
	});

	it.each([
		[339, 132],
		[366, 132],
		[300, 120],
	])("sizes the die for a %ipt board", (width, tray) => {
		const r = mount(view(2, { faces: [3], basket: 3 }), { width });
		const die = hosts(r, "rootle-die")[0];
		expect(StyleSheet.flatten(die.props.style)).toMatchObject({ width: tray, height: tray });
		act(() => r.unmount());
	});

	it("never writes an em dash or an emoji, in any state", () => {
		const states: [RootleState, BoardOpts][] = [
			[view(2), {}],
			[view(3, { turn: 1, basket: 8, faces: [3, 5] }), {}],
			[view(3, { barn: [52, 30, 20], lastRound: { leader: 0, owed: [2] }, turn: 1 }), { you: 1 }],
			[view(2, { barn: [47, 54], over: true, lastRound: { leader: 1, owed: [] } }), {}],
		];
		for (const [v, opts] of states) {
			const r = mount(v, opts);
			const text = allText(r);
			expect(text).not.toContain(EM_DASH);
			expect(text).not.toMatch(EMOJI);
			act(() => r.unmount());
		}
	});
});

// ── Fitting the height it is given ───────────────────────────────────────────

describe("Rootle board · fits the height it is given", () => {
	// The heights the match screen leaves a `pigs` table (fit.ts): the 17 Pro
	// and the SE, at default and accessibility-large text, plus the lead's SE
	// target. Planned at both ends of the board's text scale (jest's font
	// scale is 2, so a rendered board is always at the 1.3 cap).
	const PHONES: [string, number, number][] = [
		["17 Pro", BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.pigs],
		["17 Pro, accessibility-large", BOARD_WIDTHS.pro, BOARD_HEIGHTS.proAx.pigs],
		["SE", BOARD_WIDTHS.se, BOARD_HEIGHTS.se.pigs],
		["SE, accessibility-large", BOARD_WIDTHS.se, BOARD_HEIGHTS.seAx.pigs],
		["SE design target", BOARD_WIDTHS.se, SE_DESIGN_HEIGHT],
	];
	const SCALES = [1, 1.3];
	// A four-pig table with a long name: the widest status line a table says.
	const widest = widestStatus({ you: 0, names: ["You", "Bartholomew", "Biscuit", "Pickles"], present: [true, true, true, true], filled: [true, true, true, true], ended: false });
	// Below this the die would drop under its floor at the 1.3 cap.
	const FLOOR = 260;

	function expectFits(width: number, height: number, s: number) {
		const lines = statusLines(width, s, widest);
		const plan = rootleFit(width, height, s, lines);
		expect(plan.fit).toBe(true);
		// The foot (status line and thumb zone) is whole and sits on the
		// board's floor: Rootle and Trot home end at `height`, never past it.
		expect(plan.foot).toBe(footHeight(plan.button, s, lines));
		expect(plan.top + plan.foot).toBe(height);
		// Everything above it fits in what is left.
		expect(plan.content).toBeLessThanOrEqual(plan.top);
		expect(plan.die).toBeGreaterThanOrEqual(DIE_MIN);
		expect(plan.rows).toBeGreaterThanOrEqual(0);
		return plan;
	}

	it.each(PHONES)("plans the %s board with the foot inside it", (_name, width, height) => {
		for (const s of SCALES) expectFits(width, height, s);
	});

	it("gives the die priority and the strip what is left", () => {
		// The 17 Pro keeps two ledger lines under a near-full die; the SE keeps
		// the die and lets the strip go.
		const pro = expectFits(BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.pigs, 1);
		expect(pro.rows).toBe(2);
		expect(pro.die).toBeGreaterThanOrEqual(112);
		const se = expectFits(BOARD_WIDTHS.se, BOARD_HEIGHTS.se.pigs, 1);
		expect(se.rows).toBe(0);
		expect(se.die).toBeGreaterThanOrEqual(96);
		// Only the shortest boards give up the rail and step the Buttons down.
		const tightest = expectFits(BOARD_WIDTHS.se, BOARD_HEIGHTS.seAx.pigs, 1.3);
		expect(tightest.button).toBe("md");
		expect(tightest.rail).toBe(false);
		expect(pro.button).toBe("lg");
		expect(pro.rail).toBe(true);
	});

	it("fits every height from the floor up, at both text scales", () => {
		for (const width of [BOARD_WIDTHS.se, BOARD_WIDTHS.pro]) {
			for (const s of SCALES) {
				for (let height = FLOOR; height <= 600; height += 10) expectFits(width, height, s);
			}
		}
	});

	it("still pins a whole foot below the floor, and lets the planned rows clip", () => {
		for (const height of [180, 220, 250]) {
			const plan = rootleFit(BOARD_WIDTHS.se, height, 1.3, 1);
			expect(plan.top + plan.foot).toBe(height);
			expect(plan.foot).toBe(footHeight("md", 1.3, 1));
			expect(plan.die).toBe(DIE_MIN);
		}
	});

	it("draws the plan on the 17 Pro: the board is the height it is given, both buttons sit in its foot", () => {
		const r = mount(view(2, { basket: 6, faces: [6], log: [{ seat: 1, faces: [4, 4], banked: 8, end: "hold" }] }), {
			width: BOARD_WIDTHS.pro,
			height: BOARD_HEIGHTS.pro.pigs,
		});
		const plan = rootleFit(BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.pigs, 1.3, statusLines(BOARD_WIDTHS.pro, 1.3, widestStatus(tableFacts(view(2), snapshot(view(2)), 0))));
		expect(StyleSheet.flatten(hosts(r, "rootle-board")[0].props.style)).toMatchObject({ height: BOARD_HEIGHTS.pro.pigs });
		const [foot] = hosts(r, "rootle-foot");
		expect(foot.findAll((n) => n.props.testID === "rootle-roll").length).toBeGreaterThan(0);
		expect(foot.findAll((n) => n.props.testID === "rootle-hold").length).toBeGreaterThan(0);
		expect(StyleSheet.flatten(hosts(r, "rootle-die")[0].props.style)).toMatchObject({ width: plan.die, height: plan.die });
		expect(hosts(r, "rootle-strip-line")).toHaveLength(plan.rows);
		// The planned region takes what the foot leaves and clips there.
		expect(StyleSheet.flatten(hosts(r, "rootle-planned")[0].props.style)).toMatchObject({ flex: 1, minHeight: 0, overflow: "hidden" });
		act(() => r.unmount());
	});

	it("draws the SE board with no strip and the buttons still in the foot", () => {
		const r = mount(view(2), { width: BOARD_WIDTHS.se, height: BOARD_HEIGHTS.se.pigs });
		expect(StyleSheet.flatten(hosts(r, "rootle-board")[0].props.style)).toMatchObject({ height: BOARD_HEIGHTS.se.pigs });
		expect(hosts(r, "rootle-strip")).toHaveLength(0);
		const [foot] = hosts(r, "rootle-foot");
		expect(foot.findAll((n) => n.props.testID === "rootle-roll").length).toBeGreaterThan(0);
		expect(foot.findAll((n) => n.props.testID === "rootle-hold").length).toBeGreaterThan(0);
		act(() => r.unmount());
	});

	it("on the shortest board keeps both buttons, and an empty tray says \"not yet\" with its dashes and its label", () => {
		const r = mount(view(2), { width: BOARD_WIDTHS.se, height: BOARD_HEIGHTS.seAx.pigs });
		const [die] = hosts(r, "rootle-die");
		expect(StyleSheet.flatten(die.props.style).width).toBeLessThan(64);
		expect(textOf(die)).toBe("");
		expect(die.props.accessibilityLabel).toBe("The die, not rolled yet");
		const [foot] = hosts(r, "rootle-foot");
		expect(foot.findAll((n) => n.props.testID === "rootle-roll").length).toBeGreaterThan(0);
		expect(foot.findAll((n) => n.props.testID === "rootle-hold").length).toBeGreaterThan(0);
		act(() => r.unmount());
	});

	it("keeps the thumb zone one height whether or not the buttons are there", () => {
		const mine = mount(view(2), { width: BOARD_WIDTHS.se, height: BOARD_HEIGHTS.se.pigs });
		const theirs = mount(view(2, { turn: 1 }), { width: BOARD_WIDTHS.se, height: BOARD_HEIGHTS.se.pigs });
		const zone = (r: TestRenderer.ReactTestRenderer) => StyleSheet.flatten(hosts(r, "rootle-thumb")[0].props.style).minHeight;
		expect(zone(mine)).toBeGreaterThanOrEqual(44);
		expect(zone(theirs)).toBe(zone(mine));
		act(() => mine.unmount());
		act(() => theirs.unmount());
	});

	it("before the match screen measures it, draws the natural board", () => {
		const r = mount(view(2), { width: 366 });
		expect(StyleSheet.flatten(hosts(r, "rootle-board")[0].props.style).height).toBeUndefined();
		expect(hosts(r, "rootle-strip-line")).toHaveLength(3);
		expect(StyleSheet.flatten(hosts(r, "rootle-die")[0].props.style)).toMatchObject({ width: 132, height: 132 });
		act(() => r.unmount());
	});

	it("tells the match screen it fills the height", () => {
		expect(rootleUi.fillsHeight).toBe(true);
	});
});

// ── The basket after a beat ──────────────────────────────────────────────────

describe("Rootle board · the basket's number after a beat", () => {
	// A native-driven value stays on the view after its binding is dropped:
	// unbinding the slide when a trot home's beat closed left the basket's
	// number at opacity 0 for the rest of the table (A-04e, A-07h). The haul
	// now keeps every animated style bound, puts every value back at rest
	// however the beat ends, and runs its beats on the JS driver (a native
	// animation stopped mid-beat reports its value after the reset), which is
	// also why the renderer can watch the number fade here at all.

	type Drawn = { opacity?: number; transform?: Record<string, unknown>[] };
	const drawn = (r: TestRenderer.ReactTestRenderer, testID: string): Drawn => StyleSheet.flatten(hosts(r, testID)[0].props.style) as Drawn;
	const transformOf = (style: Drawn, key: string) => style.transform?.find((t) => key in t)?.[key];

	const before = view(2, { turn: 1, basket: 13, faces: [4, 6, 3], barn: [20, 18] });
	const banked = view(2, { turn: 0, barn: [20, 31], log: [{ seat: 1, faces: [4, 6, 3], banked: 13, end: "hold" }] });
	const holdEvents: GameEvent[] = [
		{ type: "hold", seat: 1, banked: 13, barn: 31 },
		{ type: "turn", seat: 0, last: false },
	];

	it("a trot home: the number rides the arrow out, and is back in place when the beat closes", () => {
		const r = mount(before, { rev: 8 });
		act(() => r.update(element(banked, { rev: 9, events: holdEvents })));
		expect(textById(r, "rootle-basket")).toBe("13");
		// Carried along the arrow into the barn, fading as it lands.
		act(() => jest.advanceTimersByTime(400));
		expect(drawn(r, "rootle-basket-line").opacity).toBe(0);
		// The beat closes on your turn: the number is drawn again, in place.
		act(() => jest.advanceTimersByTime(1_000));
		expect(textById(r, "rootle-basket")).toBe("empty");
		expect(drawn(r, "rootle-basket-line").opacity).toBe(1);
		expect(transformOf(drawn(r, "rootle-basket-line"), "translateX")).toBe(0);
		expect(transformOf(drawn(r, "rootle-barn-line"), "scale")).toBe(1);
		// And it stays drawn on the next roll.
		act(() => r.update(element(view(2, { turn: 0, barn: [20, 31], basket: 4, faces: [4] }), { rev: 10, events: [{ type: "roll", seat: 0, face: 4, basket: 4 }] })));
		act(() => jest.advanceTimersByTime(1_000));
		expect(textById(r, "rootle-basket")).toBe("4");
		expect(drawn(r, "rootle-basket-line").opacity).toBe(1);
		expect(transformOf(drawn(r, "rootle-basket-line"), "translateX")).toBe(0);
		act(() => r.unmount());
	});

	it("a newer revision mid-beat brings the number straight back", () => {
		const r = mount(before, { rev: 8 });
		act(() => r.update(element(banked, { rev: 9, events: holdEvents })));
		act(() => jest.advanceTimersByTime(400));
		expect(drawn(r, "rootle-basket-line").opacity).toBe(0);
		// Your first roll lands before the beat would have closed.
		act(() => r.update(element(view(2, { turn: 0, barn: [20, 31], basket: 5, faces: [5] }), { rev: 10, events: [{ type: "roll", seat: 0, face: 5, basket: 5 }] })));
		expect(textById(r, "rootle-basket")).toBe("5");
		expect(drawn(r, "rootle-basket-line").opacity).toBe(1);
		expect(transformOf(drawn(r, "rootle-basket-line"), "translateX")).toBe(0);
		expect(transformOf(drawn(r, "rootle-barn-line"), "scale")).toBe(1);
		act(() => r.unmount());
	});

	it("under Reduce Motion the number never leaves", () => {
		const r = mount(before, { rev: 8, reduceMotion: true });
		act(() => r.update(element(banked, { rev: 9, events: holdEvents, reduceMotion: true })));
		for (const step of [0, 400, 1_000]) {
			act(() => jest.advanceTimersByTime(step));
			expect(drawn(r, "rootle-basket-line").opacity).toBe(1);
			expect(transformOf(drawn(r, "rootle-basket-line"), "translateX")).toBe(0);
		}
		expect(textById(r, "rootle-basket")).toBe("empty");
		act(() => r.unmount());
	});

	it("a bust: the basket stops shaking upright when the beat closes", () => {
		const r = mount(view(2, { turn: 1, basket: 10, faces: [4, 6], barn: [20, 18] }), { rev: 5 });
		const busted = view(2, { turn: 0, barn: [20, 18], log: [{ seat: 1, faces: [4, 6, 1], banked: 0, end: "bust" }] });
		act(() =>
			r.update(
				element(busted, {
					rev: 6,
					events: [
						{ type: "roll", seat: 1, face: 1, basket: 0 },
						{ type: "bust", seat: 1, lost: 10 },
						{ type: "turn", seat: 0, last: false },
					],
				}),
			),
		);
		act(() => jest.advanceTimersByTime(150));
		act(() => jest.advanceTimersByTime(1_500));
		expect(hosts(r, "rootle-splat")).toHaveLength(0);
		expect(transformOf(drawn(r, "rootle-basket-cell"), "rotate")).toBe("0deg");
		expect(drawn(r, "rootle-basket-line").opacity).toBe(1);
		act(() => r.unmount());
	});
});

// ── The pure pieces ──────────────────────────────────────────────────────────

describe("Rootle board · seat strip, copy and cues", () => {
	const room = (v: RootleState, opts: SnapOpts = {}) => snapshot(v, opts);

	it("gives each pig its barn, the active pig its basket, and never a bare zero", () => {
		const v = view(3, { turn: 1, basket: 14, faces: [6, 4, 4], barn: [31, 9, 0] });
		const status = rootleUi.seatStatus;
		if (!status) throw new Error("rootleUi.seatStatus is missing");
		expect(status(v, 0, room(v))).toBe("31 in the barn");
		expect(status(v, 1, room(v))).toBe("rolling · 14 in the basket");
		expect(status(v, 2, room(v))).toBeNull();
		expect(status(view(2, { turn: 0 }), 0, room(view(2)))).toBe("rolling…");
		expect(status(v, 0, room(v, { gone: [0] }))).toBe("trotted off · 31 in the barn");
		expect(status(v, 2, room(v, { gone: [2] }))).toBe("trotted off");
		const last = view(3, { barn: [52, 9, 0], lastRound: { leader: 0, owed: [2] }, turn: 1, basket: 6, faces: [6] });
		expect(seatLine(last, 1, false)).toBe("last turn · 6 in the basket");
		expect(seatLine(last, 0, false)).toBe("52 in the barn");
		expect(rootleUi.seatStrip).toBe("pigs");
	});

	it("speaks in the house voice", () => {
		const v = view(3, { turn: 2 });
		const facts = tableFacts(v, room(v, { you: 0 }), 0);
		expect(facts.names).toEqual(["You", "Clover", "Biscuit"]);
		expect(statusLine(v, facts)).toBe("Biscuit is rootling…");
		expect(waitingLine(v, facts)).toBe("you're next");
		expect(turnOutcome({ seat: 1, faces: [1], banked: 0, end: "bust" }, false)).toBe("Hungerer, first roll");
		expect(turnOutcome({ seat: 1, faces: [], banked: 0, end: "pass" }, false)).toBe("dozed off");
		expect(turnOutcome({ seat: 1, faces: [4], banked: 0, end: "pass" }, true)).toBe("trotted off");
		expect(ROOTLE_HOW_TO.sentence).toBe(rootle.tagline);
		expect(ROOTLE_HOW_TO.steps).toHaveLength(3);
		for (const line of [ROOTLE_HOW_TO.sentence, ...ROOTLE_HOW_TO.steps]) {
			expect(line).not.toContain(EM_DASH);
			expect(line).not.toMatch(EMOJI);
		}
		expect(rootleUi.howTo).toBe(ROOTLE_HOW_TO);
	});

	it("reads a revision's cues and skips anything malformed", () => {
		// Off the wire as-is: two of these are malformed on purpose.
		const raw: unknown[] = [
			{ type: "timeout", seat: 0 },
			{ type: "roll", seat: 0, face: 1, basket: 0 },
			{ type: "bust", seat: 0, lost: 7 },
			{ type: "turn", seat: 1, last: true },
			{ type: "hold", seat: "0", banked: 3, barn: 9 },
			{ type: "lastRound" },
		];
		const cues = readCues(raw as GameEvent[], 7);
		expect(cues).toEqual({
			rev: 7,
			roll: { seat: 0, face: 1, basket: 0 },
			bust: { seat: 0, lost: 7 },
			hold: null,
			lastRound: null,
			turn: { seat: 1, last: true },
			pass: null,
			end: false,
		});
		const v = view(2, { turn: 1 });
		expect(announcement(cues, v, tableFacts(v, room(v), 0))).toBe("You rolled the Hungerer. He ate 7. Clover's last turn.");
	});

	it("never flicks past the Hungerer or the face it is about to land on", () => {
		for (let final = 1; final <= 6; final++) {
			for (let i = 0; i < 3; i++) {
				const face = flickFace(final, i);
				expect(face).not.toBe(final);
				expect(face).not.toBe(1);
				expect(face).toBeGreaterThanOrEqual(2);
				expect(face).toBeLessThanOrEqual(6);
			}
		}
	});

	it("puts the last turns on the result sheet", () => {
		const done = view(2, { barn: [54, 47], over: true, log: [{ seat: 0, faces: [6, 6, 5], banked: 17, end: "hold" }] });
		const Detail = rootleUi.ResultDetail;
		if (!Detail) throw new Error("rootleUi.ResultDetail is missing");
		let r!: TestRenderer.ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(<Detail view={done} room={snapshot(done)} you={1} />);
		});
		const text = allText(r);
		expect(text).toContain("how it ended");
		expect(text).toContain("Rosie");
		expect(text).toContain("home with 17");
		act(() => r.unmount());
	});
});

// ── The seat strip's pigs ────────────────────────────────────────────────────

describe("Rootle board · how the pigs in the seat strip answer", () => {
	const reactions = rootleUi.reactions;
	if (!reactions) throw new Error("rootleUi.reactions is missing");
	const at = (v: RootleState, events: GameEvent[], opts: SnapOpts = {}) => reactions(events, snapshot(v, { ...opts, events }));

	it("a roll of 2 to 6: the roller jumps and nobody else stirs", () => {
		expect(at(view(3, { basket: 4, faces: [4] }), [{ type: "roll", seat: 0, face: 4, basket: 4 }])).toEqual({ 0: { kind: "jump" } });
	});

	it("a bust: the roller is sad, every other pig at the table gasps, a pig who left does not", () => {
		const events: GameEvent[] = [
			{ type: "roll", seat: 1, face: 1, basket: 0 },
			{ type: "bust", seat: 1, lost: 9 },
			{ type: "turn", seat: 2, last: false },
		];
		expect(at(view(4, { turn: 2 }), events, { gone: [3] })).toEqual({
			0: { kind: "surprise" },
			1: { mood: "sad" },
			2: { kind: "surprise" },
		});
	});

	it("a trot home: the roller is happy", () => {
		const events: GameEvent[] = [
			{ type: "hold", seat: 0, banked: 6, barn: 51 },
			{ type: "lastRound", leader: 0 },
			{ type: "turn", seat: 1, last: true },
		];
		expect(at(view(2, { turn: 1, barn: [51, 20], lastRound: { leader: 0, owed: [] } }), events)).toEqual({ 0: { kind: "happy" } });
	});

	it("a missed turn: the pig turns tired; a pig who left is not napping", () => {
		const v = view(3, { turn: 2 });
		expect(at(v, [{ type: "timeout", seat: 1 }, { type: "pass", seat: 1 }, { type: "turn", seat: 2, last: false }])).toEqual({
			1: { mood: "tired" },
		});
		expect(at(v, [{ type: "gone", seat: 1 }, { type: "pass", seat: 1, left: true }], { gone: [1] })).toEqual({});
	});

	it("the end: the winner is happy, everyone else waves, and the pig who busted last stays sad", () => {
		const done = view(3, { barn: [61, 40, 55], over: true, lastRound: { leader: 0, owed: [] }, turn: 2 });
		const events: GameEvent[] = [
			{ type: "roll", seat: 2, face: 1, basket: 0 },
			{ type: "bust", seat: 2, lost: 4 },
			{ type: "end" },
		];
		expect(at(done, events)).toEqual({
			0: { kind: "happy" },
			1: { kind: "wave" },
			2: { mood: "sad", kind: "wave" },
		});
	});

	it("a shared win makes every sharer happy", () => {
		const done = view(3, { barn: [52, 52, 30], over: true, lastRound: { leader: 0, owed: [] }, turn: 1 });
		const events: GameEvent[] = [{ type: "hold", seat: 1, banked: 9, barn: 52 }, { type: "end" }];
		expect(at(done, events)).toEqual({ 0: { kind: "happy" }, 1: { kind: "happy" }, 2: { kind: "wave" } });
	});

	it("takes the room's word on who won, so a winner who left is not one", () => {
		const done = view(3, { barn: [61, 40, 55], over: true, lastRound: { leader: 0, owed: [] }, turn: 2 });
		const events: GameEvent[] = [{ type: "hold", seat: 2, banked: 3, barn: 55 }, { type: "end" }];
		const room = snapshot(done, { events, gone: [0] });
		const reRead = { ...room, result: { kind: "win" as const, winners: [2], scores: [61, 40, 55], summary: "", reason: "complete" as const } };
		expect(reactions(events, reRead)).toEqual({ 1: { kind: "wave" }, 2: { kind: "happy" } });
	});

	it("has nothing to say about a revision without a moment in it", () => {
		const v = view(2);
		expect(at(v, [])).toEqual({});
		expect(at(v, [{ type: "start" }])).toEqual({});
		expect(at(v, [{ type: "turn", seat: 1, last: false }])).toEqual({});
		expect(at(v, [{ type: "roll", seat: "0", face: 3 } as unknown as GameEvent])).toEqual({});
	});

	it("answers real revisions with allowed reactions for pigs still at the table", () => {
		const KINDS = new Set(["happy", "jump", "surprise", "wave"]);
		const MOODS = new Set(["happy", "sad", "tired"]);
		let answered = 0;
		let endings = 0;
		for (let i = 0; i < 24; i++) {
			playOut(rootle, {
				seats: 2 + (i % 3),
				seed: `react-${i}`,
				timeoutRate: 0.1,
				leave: i % 4 === 3 ? { seat: 1, atStep: 5 } : undefined,
				onRevision: (live) => {
					const snap = snapshotFor(live, rootle, 0) as RoomSnapshot<RootleState>;
					const map = reactions(snap.events, snap);
					for (const [seat, reaction] of Object.entries(map) as [string, SeatReaction][]) {
						const info = snap.seats.find((s) => s.seat === Number(seat));
						expect(info !== undefined && !info.gone).toBe(true);
						if (reaction.kind) expect(KINDS.has(reaction.kind)).toBe(true);
						if (reaction.mood) expect(MOODS.has(reaction.mood)).toBe(true);
						answered++;
					}
					if (snap.events.some((e) => e.type === "end")) {
						endings++;
						for (const winner of snap.result?.winners ?? []) expect(map[winner]?.kind).toBe("happy");
					}
				},
			});
		}
		expect(answered).toBeGreaterThan(200);
		expect(endings).toBeGreaterThan(10);
	});
});
