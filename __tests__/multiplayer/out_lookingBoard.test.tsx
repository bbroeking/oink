// Out Looking's board (components/play/games/out_looking): the yard's pure
// staging (it fits every supported phone, pigs who meet face each other, a
// place nobody picked draws nobody), the board fitted to the height the
// match screen gives it (./layout.ts: the picks and the Send button pinned
// at the foot on every phone we design for), then render smoke tests for
// each phase: picking (the gold button restates the choice and sends it),
// sent (my pig is out looking; the others show only a check), a reveal with a
// share (the heart, the outcome line, back to picking), and the ended table
// with its result detail and seat lines. Rendered under Reduce Motion, as the
// Pen's test is: idle loops never settle under react-test-renderer.

import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { glyphSource } from "@/components/ui";
import { BORDER, CHROME_TYPE_CAP, PAGE_PAD, SPACE } from "@/constants/theme";
import { BOARD_HEIGHTS, BOARD_WIDTHS, SE_DESIGN_HEIGHT } from "@/components/play/games/fit";
import { outLookingUi } from "@/components/play/games/out_looking";
import { OutLookingBoard } from "@/components/play/games/out_looking/Board";
import { OutLookingResult } from "@/components/play/games/out_looking/ResultDetail";
import {
	CARD_COMFORT,
	FOOT,
	controlsCopy,
	controlsHeight,
	controlsHeights,
	lookingFit,
	topContentHeight,
	type ControlsCopy,
	type LookingPlan,
} from "@/components/play/games/out_looking/layout";
import {
	BEAT_AT,
	CARD_H,
	FIELD_PAD,
	PLACE_ART_MIN,
	cardChrome,
	cardFloor,
	geometry,
	heapSlots,
	heapsAt,
	placeRow,
	seatStatusLine,
	spread,
	stagePigs,
	yardRow,
	PIG_BIG,
} from "@/components/play/games/out_looking/model";
import { out_looking, type OlState, type OlView } from "@/multiplayer/games/out_looking/rules";
import type { GameEvent, Pace, StepContext } from "@/multiplayer/types";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import { createRng } from "@/multiplayer/rng";
import { playOut, testCards } from "@/multiplayer/testkit";

// Hoisted above the imports by babel-jest.
jest.mock("@/utils/supabase", () => ({ supabase: { auth: { getSession: jest.fn() }, from: jest.fn() } }));
// utils/log pulls in Sentry, whose module-level interval keeps jest alive.
jest.mock("@/utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

const NOW = 1_700_000_000_000;
const BOARD_W = 390 - 2 * PAGE_PAD;
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ctx = (seats: number): StepContext => ({ now: NOW, rng: createRng("ctx"), pace: "live", present: Array(seats).fill(true) });

function pick(state: OlState, seat: number, place: number | null): OlState {
	if (place === null) return out_looking.onTimeout(state, seat, ctx(state.seats)).state;
	const res = out_looking.apply(state, seat, { type: "go", place }, ctx(state.seats));
	if (!res.ok) throw new Error(res.error);
	return res.state;
}

function snapshot(state: OlState, you: number, over: Partial<RoomSnapshot<OlView>> = {}): RoomSnapshot<OlView> {
	return {
		roomId: "00000000-ol-board",
		game: "out_looking",
		rulesVersion: out_looking.rulesVersion,
		pace: "live",
		source: "queue",
		phase: state.phase === "ended" ? "ended" : "playing",
		seats: testCards(state.seats).map((card, seat) => ({ ...card, seat, connected: true, gone: false })),
		seatCount: state.seats,
		you,
		view: out_looking.view(state, you),
		activeSeats: out_looking.activeSeats(state),
		deadline: NOW + 15_000,
		startsAt: null,
		rev: 1,
		events: [],
		result: null,
		invite: null,
		rematch: null,
		host: null,
		...over,
	};
}

type Answer = { ok: true } | { ok: false; error: "stale" };

interface RenderOpts {
	pace?: Pace;
	events?: GameEvent[];
	pending?: boolean;
	answer?: Answer;
	width?: number;
	height?: number;
	/** Motion on (the default is Reduce Motion, as the Pen's test runs). */
	moving?: boolean;
}

function render(state: OlState, you: number, opts: RenderOpts = {}) {
	const room = snapshot(state, you, { pace: opts.pace ?? "live", events: opts.events ?? [] });
	const send = jest.fn(async (): Promise<Answer> => opts.answer ?? { ok: true });
	const view = room.view as OlView;
	const board = (r: RoomSnapshot<OlView>, height = opts.height) => (
		<SafeAreaProvider initialMetrics={metrics}>
			<MotionPolicyProvider reduceMotion={!opts.moving}>
				<OutLookingBoard
					view={r.view as OlView}
					room={r}
					you={you}
					yourTurn={r.activeSeats.includes(you)}
					act={send}
					pending={!!opts.pending}
					events={r.events}
					reduceMotion={!opts.moving}
					width={opts.width ?? BOARD_W}
					height={height}
					practice={false}
				/>
			</MotionPolicyProvider>
		</SafeAreaProvider>
	);
	const r = TestRenderer.create(board(room));
	return { r, send, view, room, rerender: (height?: number) => act(() => r.update(board(room, height))) };
}

const textOf = (node: TestRenderer.ReactTestInstance): string =>
	node
		.findAll((n) => n.type === Text)
		.map((n) => React.Children.toArray(n.props.children).join(""))
		.join(" | ");
const byId = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.find((n) => n.props.testID === id && typeof n.type !== "string");
const pressable = (r: TestRenderer.ReactTestRenderer, id: string) =>
	r.root.find((n) => n.props.testID === id && typeof n.props.onPress === "function");
const has = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.findAll((n) => n.props.testID === id).length > 0;
const glyphCount = (r: TestRenderer.ReactTestRenderer, name: Parameters<typeof glyphSource>[0]) =>
	r.root.findAll((n) => String(n.type) === "Image" && n.props.source === glyphSource(name)).length;
/** The host view carrying a testID (composites forward it; the host is what lays out). */
const host = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.find((n) => typeof n.type === "string" && n.props.testID === id);
const styleOf = (node: TestRenderer.ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
/** The seats the yard draws a pig for. */
const pigsDrawn = (r: TestRenderer.ReactTestRenderer) =>
	[...new Set(r.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("ol-pig-")).map((n) => n.props.testID as string))].sort();

describe("the yard's staging", () => {
	it("fits every supported phone: cards inside the scene, apart, heaps inside their cards", () => {
		for (const phone of [375, 390, 393, 402]) {
			for (const placeCount of [3, 4]) {
				const geo = geometry(phone - 2 * PAGE_PAD - 2 * 14, placeCount);
				for (const card of geo.cards) {
					expect(card.x).toBeGreaterThanOrEqual(0);
					expect(card.x + card.w).toBeLessThanOrEqual(geo.width + 0.5);
					for (const slot of heapSlots(card, 9)) {
						expect(slot.x - 12).toBeGreaterThanOrEqual(card.x);
						expect(slot.x + 12).toBeLessThanOrEqual(card.x + card.w);
					}
				}
				geo.cards.forEach((a, i) =>
					geo.cards.slice(i + 1).forEach((b) => {
						const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
						expect(apart).toBe(true);
					}),
				);
				if (placeCount === 4) expect(geo.yard.w).toBeGreaterThanOrEqual(PIG_BIG);
			}
		}
	});

	it("faces pigs who met toward each other, sleeps a pig who stayed home, and rests an emptied pile", () => {
		let s = out_looking.setup({ seats: 4, rng: createRng("stage"), pace: "live" });
		// Two pigs meet at the three-tile pile (one tile stays, so it grows);
		// one takes a one-tile pile whole (it rests); one stays home.
		const big = s.places.findIndex((p) => p.pile.length === 3);
		const small = s.places.findIndex((p) => p.pile.length === 1);
		s = pick(pick(pick(pick(s, 0, big), 1, big), 2, small), 3, null);
		const view = out_looking.view(s, 0);
		const day = view.history[0];
		const geo = geometry(BOARD_W, view.places.length);
		const spots = stagePigs({ geo, view, you: 0, seated: [0, 1, 2, 3], gone: [false, false, false, false], sent: null, reveal: { day, beat: "outcome" } });
		expect([spots[0].facing, spots[1].facing].sort()).toEqual(["left", "right"]);
		expect(spots[2]).toMatchObject({ pose: "happy", facing: null });
		expect(spots[3]).toMatchObject({ pose: "tired", mark: "zzz" });
		expect(spots[3].x).toBeGreaterThan(geo.yard.x);
		expect(spots[3].x).toBeLessThan(geo.yard.x + geo.yard.w);
		// The leaving tiles keep their spots on the outcome beat; the night's
		// tile drops after, on every pile but the one emptied today.
		const out = heapsAt(geo, view, { day, beat: "out" });
		const outcome = heapsAt(geo, view, { day, beat: "outcome" });
		const grew = heapsAt(geo, view, { day, beat: "grew" });
		expect(outcome[big].finds).toHaveLength(1);
		expect(outcome[big].tiles.map((t) => t.at)).toEqual(out[big].tiles.slice(2).map((t) => t.at));
		expect(grew[big].tiles.some((t) => t.fresh)).toBe(true);
		expect(grew[small]).toMatchObject({ finds: [], tiles: [] });
		expect(grew.map((h) => h.finds)).toEqual(view.places.map((p) => p.pile));
		// Back to picking, the rested place is marked bare rather than left blank.
		expect(heapsAt(geo, view, null)[small].bare).toBe(true);
		expect(heapsAt(geo, view, null).filter((h) => h.bare)).toHaveLength(1);
	});
});

describe("the board", () => {
	afterEach(() => jest.useRealTimers());

	it("picking: tapping a place or its chip chooses it, and the gold button says and sends exactly that", async () => {
		const s = out_looking.setup({ seats: 3, rng: createRng("picking"), pace: "live" });
		const { r, send, view } = render(s, 0);
		expect(textOf(byId(r, "ol-day"))).toBe("Day 1 of 5");
		expect(textOf(byId(r, "ol-send"))).toContain("Pick a place for Rosie");
		expect(byId(r, "ol-send").props.disabled).toBe(true);

		const farmhouse = view.places.findIndex((p) => p.id === "farmhouse");
		await act(async () => pressable(r, "ol-chip-farmhouse").props.onPress());
		expect(textOf(byId(r, "ol-send"))).toContain("Send Rosie to the Farmhouse");

		await act(async () => pressable(r, "ol-place-river").props.onPress());
		expect(textOf(byId(r, "ol-send"))).toContain("Send Rosie to the River");
		await act(async () => pressable(r, "ol-chip-farmhouse").props.onPress());
		await act(async () => pressable(r, "ol-send").props.onPress());
		expect(send).toHaveBeenCalledWith({ type: "go", place: farmhouse });
	});

	it("walks my pig home again when the server refuses the pick, and says so", async () => {
		const s = out_looking.setup({ seats: 2, rng: createRng("refused"), pace: "live" });
		const { r, send } = render(s, 0, { answer: { ok: false, error: "stale" } });
		await act(async () => pressable(r, "ol-chip-hedge").props.onPress());
		await act(async () => pressable(r, "ol-send").props.onPress());
		expect(send).toHaveBeenCalledTimes(1);
		expect(has(r, "ol-looking")).toBe(false);
		expect(textOf(byId(r, "ol-picker"))).toContain("That didn't go through. Pick again?");
		expect(textOf(byId(r, "ol-send"))).toContain("Send Rosie to the Hedge");
	});

	it("sent: my pig is out looking with a tag; the others show only that they have chosen", () => {
		let s = out_looking.setup({ seats: 3, rng: createRng("sent"), pace: "live" });
		const farmhouse = s.places.findIndex((p) => p.id === "farmhouse");
		s = pick(pick(s, 0, farmhouse), 1, 0);
		const live = render(s, 0);
		expect(textOf(byId(live.r, "ol-sent"))).toContain("Rosie is out looking at the Farmhouse.");
		expect(textOf(byId(live.r, "ol-sent"))).toContain("Waiting on one more pig.");
		expect(has(live.r, "ol-looking")).toBe(true);
		expect(glyphCount(live.r, "check")).toBe(1);
		// Where seat 1 went is not in my view, so it cannot be on my board.
		expect(JSON.stringify(live.view)).not.toContain("sealed:");
		expect(has(live.r, "ol-picker")).toBe(false);

		const later = render(s, 0, { pace: "async" });
		expect(textOf(byId(later.r, "ol-sent"))).toContain("We'll ping you when the round closes.");
	});

	it("a reveal with a share: the pigs meet, a heart floats, the outcome reads, then the next day opens", () => {
		jest.useFakeTimers();
		let s = out_looking.setup({ seats: 3, rng: createRng("reveal"), pace: "live" });
		s = pick(pick(pick(s, 0, 1), 1, 1), 2, 3);
		const { r } = render(s, 0, { events: [{ type: "picked", seat: 2 }, { type: "revealed", round: 1 }, { type: "grew", round: 1 }] });
		expect(textOf(byId(r, "ol-day"))).toBe("Day 1 of 5");
		expect(textOf(byId(r, "ol-outcome"))).toContain("Rosie met Pig 2 at the Hedge.");
		expect(has(r, "ol-heart")).toBe(false);

		act(() => {
			jest.advanceTimersByTime(1_300);
		});
		expect(has(r, "ol-heart")).toBe(true);
		expect(textOf(byId(r, "ol-outcome"))).toMatch(/heart/);

		act(() => {
			jest.advanceTimersByTime(5_000);
		});
		expect(has(r, "ol-outcome")).toBe(false);
		expect(has(r, "ol-picker")).toBe(true);
		expect(textOf(byId(r, "ol-day"))).toBe("Day 2 of 5");
	});

	it("marks a place taken whole yesterday as bare today, and muddy trotters lands where its pile was", () => {
		jest.useFakeTimers();
		// Day 1: Rosie takes the River whole, so it rests overnight.
		const day1 = pick(pick(out_looking.setup({ seats: 2, rng: createRng("muddy"), pace: "live" }), 0, 0), 1, 2);
		const bare = render(day1, 1);
		expect(has(bare.r, "ol-bare-river")).toBe(true);
		expect(byId(bare.r, "ol-place-river").props.accessibilityLabel).toContain("bare today");
		// Day 2: she goes back alone anyway.
		const day2 = pick(pick(day1, 0, 0), 1, 1);
		const { r } = render(day2, 0, { events: [{ type: "revealed", round: 2 }] });
		expect(textOf(byId(r, "ol-outcome"))).toContain("Muddy trotters at the River.");
		act(() => {
			jest.advanceTimersByTime(1_300);
		});
		expect(has(r, "ol-muddy")).toBe(true);
	});

	it("ended: the last day is done, and the result detail draws every pouch with its weight", () => {
		const report = playOut(out_looking, { seats: 3, seed: "board-end" });
		const s = report.room.game as OlState;
		expect(s.phase).toBe("ended");
		const { r, room } = render(s, 1);
		expect(textOf(byId(r, "ol-ended"))).toContain("That was the last day.");
		expect(has(r, "ol-picker")).toBe(false);

		const view = room.view as OlView;
		const detail = TestRenderer.create(<OutLookingResult view={view} room={room} you={1} />);
		for (let seat = 0; seat < 3; seat++) {
			const row = detail.root.find((n) => n.props.testID === `ol-result-${seat}`);
			expect(textOf(row)).toContain(String(view.weights[seat]));
		}
		for (let seat = 0; seat < 3; seat++) {
			expect(outLookingUi.seatStatus?.(view, seat, room)).toBe(seatStatusLine(view.weights[seat], view.hearts[seat]));
		}
	});

	it("never puts a zero under a pig", () => {
		expect(seatStatusLine(0, 0)).toBeNull();
		expect(seatStatusLine(7, 0)).toBe("pouch 7");
		expect(seatStatusLine(0, 1)).toBe("1 heart");
		expect(seatStatusLine(7, 2)).toBe("pouch 7 · 2 hearts");
		expect(outLookingUi.seatStrip).toBe("compact");
		// The result sheet waits for the last day's scene.
		expect(outLookingUi.resultDelayMs).toBe(BEAT_AT.done);
		expect(outLookingUi.howTo.steps.join(" ")).not.toMatch(/tickle/i);
	});
});

// ── A place nobody picked draws nobody ───────────────────────────────────────

describe("a reveal stages only the pigs who are there", () => {
	it("an empty row stands nobody", () => {
		expect(spread(100, 80, 0, 44)).toEqual([]);
		expect(spread(100, 80, 1, 44)).toEqual([100]);
		expect(spread(100, 80, 2, 44)).toHaveLength(2);
		const geo = geometry(BOARD_W - 2 * FIELD_PAD - 2 * BORDER.ink, 4);
		expect(yardRow(geo, 0)).toEqual([]);
		expect(placeRow(geo, geo.cards[0], 0)).toEqual([]);
		expect(placeRow(geo, geo.cards[0], 3)).toHaveLength(3);
	});

	// Two pigs both at the first place; two pigs apart with one at home; three
	// pigs with two places empty and nobody home; three with one at home.
	const tables: [string, number, (number | null)[]][] = [
		["two pigs at one place", 2, [0, 0]],
		["two pigs, one at home", 2, [1, null]],
		["three pigs, two places empty, nobody home", 3, [0, 0, 2]],
		["three pigs, one at home", 3, [3, null, 3]],
	];

	it.each(tables)("%s: a spot for every seated pig and no other key", (_, seats, picks) => {
		let s = out_looking.setup({ seats, rng: createRng(`phantom-${seats}`), pace: "live" });
		picks.forEach((place, seat) => {
			s = pick(s, seat, place);
		});
		const view = out_looking.view(s, 0);
		const day = view.history[0];
		const geo = geometry(BOARD_W - 2 * FIELD_PAD - 2 * BORDER.ink, view.places.length);
		const seated = Array.from({ length: seats }, (_, seat) => seat);
		for (const beat of ["out", "outcome", "grew"] as const) {
			const spots = stagePigs({ geo, view, you: 0, seated, gone: seated.map(() => false), sent: null, reveal: { day, beat } });
			expect(Object.keys(spots).sort()).toEqual(seated.map(String));
			for (const spot of Object.values(spots)) expect(Number.isFinite(spot.x) && Number.isFinite(spot.y)).toBe(true);
		}
	});

	it("draws exactly one pig per seated pig on a revealed day", () => {
		jest.useFakeTimers();
		let s = out_looking.setup({ seats: 3, rng: createRng("phantom-render"), pace: "live" });
		s = pick(pick(pick(s, 0, 0), 1, 0), 2, 2);
		const { r } = render(s, 0, { events: [{ type: "revealed", round: 1 }] });
		expect(has(r, "ol-outcome")).toBe(true);
		expect(pigsDrawn(r)).toEqual(["ol-pig-0", "ol-pig-1", "ol-pig-2"]);
		// Every beat of the scene, and back to picking.
		for (const ms of [BEAT_AT.outcome, BEAT_AT.grew, BEAT_AT.done]) {
			act(() => {
				jest.advanceTimersByTime(ms);
			});
			expect(pigsDrawn(r)).toEqual(["ol-pig-0", "ol-pig-1", "ol-pig-2"]);
		}
		act(() => r.unmount());
		jest.useRealTimers();
	});
});

// ── Fitting the height the match screen gives it ─────────────────────────────

describe("the board fits the height it is given", () => {
	const TABLES: [string, ControlsCopy, number][] = [
		["two pigs, three places", controlsCopy({ pigName: "Rosie", places: ["river", "hedge", "farmhouse"], others: ["Bandit"], rounds: 4, seats: 2 }), 3],
		[
			"three pigs, four places",
			controlsCopy({ pigName: "Rosie", places: ["river", "hedge", "meadow", "farmhouse"], others: ["Bandit", "Pepper"], rounds: 5, seats: 3 }),
			4,
		],
		[
			"four pigs with long names",
			controlsCopy({
				pigName: "Biscuit",
				places: ["river", "hedge", "meadow", "farmhouse"],
				others: ["Bartholomew", "Clementine", "Montgomery"],
				rounds: 5,
				seats: 4,
			}),
			4,
		],
	];
	const SCALES = [1, CHROME_TYPE_CAP];
	const PHONES: [string, number, number[]][] = [
		["17 Pro", BOARD_WIDTHS.pro, [BOARD_HEIGHTS.pro.compact, BOARD_HEIGHTS.proAx.compact]],
		["SE", BOARD_WIDTHS.se, [BOARD_HEIGHTS.se.compact, BOARD_HEIGHTS.seAx.compact, SE_DESIGN_HEIGHT]],
	];
	/** Under this the thumb zone alone outgrows the board (the tallest one: four
	 *  long names, chips in two rows, at the text cap). */
	const SWEEP_FLOOR = 240;
	const fieldWidth = (width: number) => width - 2 * FIELD_PAD - 2 * BORDER.ink;

	/** Everything a plan promises, checked against its own arithmetic. */
	function expectFits(plan: LookingPlan, width: number, height: number, scale: number, copy: ControlsCopy, places: number) {
		// The board is exactly its height: the top region, a gap, the thumb
		// zone and the foot under the gold button's shadow.
		expect(plan.topH + plan.gap + plan.controlsH + FOOT).toBe(height);
		// The thumb zone lies wholly inside the board, under the top region.
		const controlsTop = height - FOOT - plan.controlsH;
		expect(controlsTop).toBeGreaterThanOrEqual(plan.gap);
		expect(controlsTop + plan.controlsH).toBeLessThanOrEqual(height);
		// It holds every state, so it never changes height mid-game.
		const heights = controlsHeights(copy, scale, width);
		expect(plan.controlsH).toBe(controlsHeight(heights, plan.chips));
		// The yard: scrolled at the floor, or whole in the room it was left.
		if (plan.scroll) {
			expect(plan.cardH).toBe(cardFloor(scale));
			// The picks never scroll away: the chips stay pinned with Send.
			expect(plan.chips).toBe(true);
		} else {
			expect(topContentHeight(plan)).toBeLessThanOrEqual(plan.topH);
			expect(plan.cardH).toBeGreaterThanOrEqual(cardFloor(scale));
		}
		expect(plan.cardH).toBeLessThanOrEqual(CARD_H);
		// The yard as drawn at that card height: the pasture is the plan's,
		// every card holds its name, heap and sticker, and the cards sit apart
		// inside the scene.
		const geo = geometry(fieldWidth(width), places, { cardH: plan.cardH, rowGap: plan.rowGap, scale });
		expect(geo.height + 2 * FIELD_PAD + 2 * BORDER.ink).toBe(plan.fieldH);
		expect(geo.sizes.art).toBeGreaterThanOrEqual(PLACE_ART_MIN);
		expect(cardChrome(geo.sizes.nameH, geo.sizes.heap) + geo.sizes.art).toBeLessThanOrEqual(geo.sizes.cardH);
		for (const card of geo.cards) {
			expect(card.x).toBeGreaterThanOrEqual(0);
			expect(card.x + card.w).toBeLessThanOrEqual(geo.width + 0.5);
			expect(card.y + card.h).toBeLessThanOrEqual(geo.height + 0.5);
		}
	}

	const matrix = PHONES.flatMap(([phone, width, heights]) =>
		heights.flatMap((height) => SCALES.flatMap((scale) => TABLES.map(([table, copy, places]) => ({ phone, width, height, scale, table, copy, places })))),
	);

	it.each(matrix)("$phone, $height pt at text x$scale, $table: the picks and Send fit, the yard fits or scrolls", ({ width, height, scale, copy, places }) => {
		expectFits(lookingFit({ width, height, scale, copy }), width, height, scale, copy, places);
	});

	it("keeps the full-size board where there is room, and gives way in order where there is not", () => {
		const at = (width: number, height: number, scale: number, table: number) => lookingFit({ width, height, scale, copy: TABLES[table][1] });
		// The 17 Pro at the default text size: the board exactly as designed.
		for (let t = 0; t < TABLES.length; t++) {
			expect(at(BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.compact, 1, t)).toMatchObject({ cardH: CARD_H, chips: true, day: "sign", gap: SPACE.md, scroll: false });
		}
		// The SE at the default text size: snug gaps and the day as a one-line
		// kicker, the chips kept, the yard still comfortable.
		for (const t of [0, 1]) {
			const plan = at(BOARD_WIDTHS.se, BOARD_HEIGHTS.se.compact, 1, t);
			expect(plan).toMatchObject({ chips: true, day: "kicker", gap: SPACE.sm, scroll: false });
			expect(plan.cardH).toBeGreaterThanOrEqual(CARD_COMFORT);
		}
		// The 17 Pro at accessibility sizes keeps the chips (the picks a screen
		// reader finds first) at a smaller yard.
		expect(at(BOARD_WIDTHS.pro, BOARD_HEIGHTS.proAx.compact, CHROME_TYPE_CAP, 1)).toMatchObject({ chips: true, day: "sign", scroll: false });
		// The lead's 380pt small-phone board: the signpost becomes a kicker
		// and the yard still fits whole.
		for (const t of [0, 1]) expect(at(BOARD_WIDTHS.se, SE_DESIGN_HEIGHT, 1, t)).toMatchObject({ day: "kicker", scroll: false });
		// A board too short for even the floor: the yard scrolls, the picks stay.
		expect(at(BOARD_WIDTHS.se, BOARD_HEIGHTS.seAx.compact, CHROME_TYPE_CAP, 1)).toMatchObject({ scroll: true, chips: true });
	});

	it("only drops the chips when the yard then holds the picks whole, and keeps them when they cost nothing", () => {
		// Four places at the text cap: two rows of chips make picking the
		// tallest state, so a short board trades them for yard.
		const party = TABLES[1][1];
		const heights = controlsHeights(party, CHROME_TYPE_CAP, BOARD_WIDTHS.se);
		expect(heights.pickerChips).toBeGreaterThan(heights.reveal);
		const dropped = lookingFit({ width: BOARD_WIDTHS.se, height: 440, scale: CHROME_TYPE_CAP, copy: party });
		expect(dropped).toMatchObject({ chips: false, scroll: false });
		// Long names make the reveal the tallest state: the chips ride free.
		const long = TABLES[2][1];
		const free = controlsHeights(long, 1, BOARD_WIDTHS.se);
		expect(free.reveal).toBeGreaterThanOrEqual(free.pickerChips);
		expect(lookingFit({ width: BOARD_WIDTHS.se, height: BOARD_HEIGHTS.se.compact, scale: 1, copy: long }).chips).toBe(true);
	});

	it(`fits every height from ${SWEEP_FLOOR} to 600pt, both phones, both text sizes, every table`, () => {
		for (let height = SWEEP_FLOOR; height <= 600; height += 10) {
			for (const [, width] of PHONES) {
				for (const scale of SCALES) {
					for (const [, copy, places] of TABLES) {
						expectFits(lookingFit({ width, height, scale, copy }), width, height, scale, copy, places);
					}
				}
			}
		}
	});

	it("draws exactly today's yard at full size", () => {
		for (const places of [3, 4]) {
			const natural = geometry(fieldWidth(BOARD_W), places);
			expect(geometry(fieldWidth(BOARD_W), places, { cardH: CARD_H, rowGap: SPACE.md, scale: 1 })).toEqual(natural);
			expect(natural.height).toBe(CARD_H * 2 + SPACE.md);
			expect(natural.cards.every((card) => card.h === CARD_H)).toBe(true);
			expect(natural.sizes).toEqual({ cardH: 132, nameH: 21, heap: 24, heapPitch: 18, art: 64, pigBig: 96, pigSmall: 44, muddy: 56, heapY: 47, rowGap: 12 });
			expect(heapSlots(natural.cards[0], 4)).toEqual(heapSlots(natural.cards[0], 4, natural.sizes));
		}
	});

	it("is a board that fills the height (GameUI.fillsHeight)", () => {
		expect(outLookingUi.fillsHeight).toBe(true);
	});

	// Rendered: jest's font scale (2) is capped at 1.3, the worst case.
	const boardCases: [string, number, number, number][] = [
		["17 Pro, three pigs", BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.compact, 3],
		["17 Pro, two pigs", BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.compact, 2],
		["SE, three pigs", BOARD_WIDTHS.se, BOARD_HEIGHTS.se.compact, 3],
		["SE, two pigs", BOARD_WIDTHS.se, BOARD_HEIGHTS.se.compact, 2],
		["SE at accessibility sizes, three pigs", BOARD_WIDTHS.se, BOARD_HEIGHTS.seAx.compact, 3],
	];

	it.each(boardCases)("%s: the board is exactly its height, the picks and Send pinned at its foot", (_, width, height, seats) => {
		const s = out_looking.setup({ seats, rng: createRng(`fit-${seats}`), pace: "live" });
		const { r, view } = render(s, 0, { width, height });
		const plan = lookingFit({
			width,
			height,
			scale: CHROME_TYPE_CAP,
			copy: controlsCopy({
				pigName: "Rosie",
				places: view.places.map((p) => p.id),
				others: Array.from({ length: seats - 1 }, (__, i) => `Pig ${i + 2}`),
				rounds: view.rounds,
				seats,
			}),
		});
		const root = host(r, "ol-board");
		expect(styleOf(root).height).toBe(height);
		expect(styleOf(root).paddingBottom).toBe(FOOT);
		// The thumb zone is the board's last child, at the plan's height.
		const zone = host(r, "ol-picker");
		const last = root.children[root.children.length - 1];
		expect(typeof last === "string" ? last : last.props.testID).toBe("ol-picker");
		expect(styleOf(zone).height).toBe(plan.controlsH);
		expect(zone.findAll((n) => n.props.testID === "ol-send").length).toBeGreaterThan(0);
		const chips = new Set(zone.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("ol-chip-")).map((n) => n.props.testID));
		expect(chips.size).toBe(plan.chips ? view.places.length : 0);
		// The yard is drawn at the plan's card height, scrolled only at the floor.
		expect(styleOf(byId(r, `ol-place-${view.places[0].id}`)).height).toBe(plan.cardH);
		expect(byId(r, "ol-top-scroll").props.scrollEnabled).toBe(plan.scroll);
		// Picking still works from wherever the picks are.
		expect(pressable(r, `ol-place-${view.places[0].id}`)).toBeTruthy();
	});

	it("draws at its natural size until the match screen has measured it", () => {
		const s = out_looking.setup({ seats: 3, rng: createRng("natural"), pace: "live" });
		const { r, view } = render(s, 0);
		expect(styleOf(host(r, "ol-board")).height).toBeUndefined();
		expect(styleOf(host(r, "ol-picker")).minHeight).toBe(132);
		expect(has(r, "ol-chip-river")).toBe(true);
		expect(styleOf(byId(r, `ol-place-${view.places[0].id}`)).height).toBe(CARD_H);
	});

	it("puts every pig in its new spot, without a walk, when the yard changes size", async () => {
		jest.useFakeTimers();
		const s = out_looking.setup({ seats: 3, rng: createRng("resize"), pace: "live" });
		const { r, rerender } = render(s, 0, { width: BOARD_WIDTHS.se, moving: true });
		const animations = () =>
			r.root
				.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("ol-pig-") && typeof n.type === "string")
				.flatMap((pig) => pig.findAll((n) => typeof n.props.pigAnimation === "string").map((n) => n.props.pigAnimation as string));
		expect(animations().length).toBeGreaterThan(0);
		const at = () => styleOf(byId(r, "ol-place-river")).height;
		// The board's height arrives, then the text size or the seat strip
		// changes it: the yard redraws smaller (down to the floor, where it
		// scrolls) and nobody walks anywhere.
		rerender(BOARD_HEIGHTS.pro.compact);
		const tall = at();
		rerender(BOARD_HEIGHTS.proAx.compact);
		expect(at()).toBeLessThan(tall);
		expect(animations()).not.toContain("walk");
		rerender(BOARD_HEIGHTS.se.compact);
		expect(byId(r, "ol-top-scroll").props.scrollEnabled).toBe(true);
		expect(animations()).not.toContain("walk");
		// A real move still walks: my pig sets off for the River.
		act(() => pressable(r, "ol-place-river").props.onPress());
		await act(async () => pressable(r, "ol-send").props.onPress());
		expect(animations()).toContain("walk");
		act(() => r.unmount());
		jest.useRealTimers();
	});
});
