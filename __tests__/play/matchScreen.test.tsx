// The table (components/play/MatchScreen) with the multiplayer hooks mocked
// and a stub board: every phase (the lobby as host and as guest, the
// countdown, play, the end as a win, a draw, a co-op table and a forfeit),
// a play-by-post table, a practice table, the leave dialog per kind of
// table, refusals, emotes and the result sheet's next steps. Every way out
// that starts in a dialog or a sheet closes it before the route changes (a
// screen popped under a presented Modal strands it: the 2026-10-04 freeze).
// A board that fills its height gets the measured box and no scroller.
// Every rendered word is scanned for an em dash or an emoji.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { RoomSnapshot, SeatInfo } from "@/multiplayer/protocol";
import { DEFAULT_TIMING } from "@/multiplayer/protocol";
import type { GameId } from "@/multiplayer/types";
import { POPUP_HANDOFF_GAP_MS } from "@/components/ui";
import { MatchScreen, resultDelay } from "@/components/play/MatchScreen";
import { isTableOpen, resetTableNavForTests } from "@/components/play/nav";
import { takeHandedOffSearch } from "@/components/play/searchHandoff";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissTo: jest.fn() };
const mockListeners: Record<string, ((e: unknown) => void)[]> = {};
const mockNavigation = {
	addListener: jest.fn((name: string, fn: (e: unknown) => void) => {
		(mockListeners[name] ??= []).push(fn);
		return () => {
			mockListeners[name] = (mockListeners[name] ?? []).filter((f) => f !== fn);
		};
	}),
	dispatch: jest.fn(),
};
jest.mock("expo-router", () => ({
	get router() {
		return mockRouter;
	},
	useNavigation: () => mockNavigation,
}));
jest.mock("@/utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock("@sentry/react-native", () => ({ captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
const mockPigs: Record<string, unknown>[] = [];
jest.mock("@/components/ui/PigStage", () => ({
	PigStage: (props: Record<string, unknown>) => {
		mockPigs.push(props);
		return null;
	},
}));
const mockToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({ showToast: (...a: unknown[]) => mockToast(...a), ToastHost: () => null }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(async () => {}),
	selectionAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
	NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const NOW = 1_800_000_000_000;

interface MockSource {
	roomId: string;
	practice: boolean;
	snapshot: RoomSnapshot | null;
	emotes: Record<number, { emote: string; at: number }>;
	subscribe: () => () => void;
	now: () => number;
	act: jest.Mock;
	emote: jest.Mock;
	leave: jest.Mock;
	rematch: jest.Mock;
	start: jest.Mock;
}

const mockMatch = {
	enabled: true,
	reduceMotion: false,
	now: NOW,
	room: null as null | { roomId: string | null; snapshot: RoomSnapshot | null; source: MockSource | null; practice: boolean; gone: string | null; emotes: Record<number, unknown> },
	play: {} as Record<string, unknown>,
	connection: { status: "open", reason: null, connection: {}, banner: null as string | null, retry: jest.fn() },
	ui: {} as Record<string, unknown>,
	boardProps: null as Record<string, unknown> | null,
};

jest.mock("@/hooks/useMotionPolicy", () => ({
	MOTION_DURATION: { feedback: 120, state: 220, modal: 300, celebration: 450, crossfade: 150 },
	startDecorativeLoop: () => () => {},
	useMotionPolicy: () => ({
		reduceMotion: mockMatch.reduceMotion,
		allowDecorativeMotion: !mockMatch.reduceMotion,
		largeTransition: mockMatch.reduceMotion ? "crossfade" : "motion",
		duration: (s: number, r = 150) => (mockMatch.reduceMotion ? r : s),
	}),
}));
jest.mock("@/hooks/useMultiplayer", () => ({
	usePlayEnabled: () => mockMatch.enabled,
	useRoom: () => mockMatch.room,
	usePlay: () => mockMatch.play,
	usePlayConnection: () => mockMatch.connection,
	useServerClock: () => mockMatch.now,
}));
jest.mock("@/components/play/gameUi", () => ({ gameUi: () => mockMatch.ui }));


const boardSpy = jest.fn((props: Record<string, unknown>) => {
	mockMatch.boardProps = props;
});
function StubBoard(props: Record<string, unknown>) {
	boardSpy(props);
	const { Text } = jest.requireActual("react-native");
	return <Text testID="stub-board">the stub board</Text>;
}

const LOOK = { pigId: "rosie", hat: null, bow: null, glasses: null, mask: null, neck: null, held: null, aura: null, wallow: 0 };
function seat(n: number, name: string, over: Partial<SeatInfo> = {}): SeatInfo {
	return { seat: n, userId: `u${n}`, name, look: LOOK, connected: true, gone: false, ...over };
}

function snap(over: Partial<RoomSnapshot> = {}): RoomSnapshot {
	return {
		roomId: "55555555-room",
		game: "fence_the_pen",
		rulesVersion: 1,
		pace: "live",
		source: "queue",
		phase: "playing",
		seats: [seat(0, "Rosie"), seat(1, "Bandit")],
		seatCount: 2,
		you: 0,
		view: { v: 1 },
		activeSeats: [0],
		deadline: NOW + 15_000,
		startsAt: null,
		rev: 5,
		events: [],
		result: null,
		invite: null,
		rematch: null,
		host: null,
		...over,
	};
}

function source(snapshot: RoomSnapshot | null, practice = false): MockSource {
	const s: MockSource = {
		roomId: snapshot?.roomId ?? "55555555-room",
		practice,
		snapshot,
		emotes: {},
		subscribe: () => () => {},
		now: () => mockMatch.now,
		act: jest.fn(async () => ({ ok: true })),
		emote: jest.fn(),
		leave: jest.fn(async () => {}),
		rematch: jest.fn(async () => {}),
		start: jest.fn(async () => {}),
	};
	return s;
}

function setRoom(snapshot: RoomSnapshot | null, opts: { practice?: boolean; gone?: string | null; source?: MockSource | null } = {}) {
	const src = opts.source !== undefined ? opts.source : source(snapshot, opts.practice ?? false);
	if (src) src.snapshot = snapshot;
	mockMatch.room = { roomId: snapshot?.roomId ?? null, snapshot, source: src, practice: opts.practice ?? false, gone: opts.gone ?? null, emotes: {} };
	return src;
}

function ui(game: GameId = "fence_the_pen", over: Record<string, unknown> = {}) {
	mockMatch.ui = {
		id: game,
		Board: StubBoard,
		howTo: { sentence: "One sentence.", steps: [] },
		seatStatus: (_view: unknown, s: number) => (s === 0 ? "3 pens" : null),
		reactions: () => ({}),
		resultDelayMs: 3_000,
		seatStrip: "pigs",
		...over,
	};
}

function reset() {
	mockMatch.enabled = true;
	mockMatch.reduceMotion = false;
	mockMatch.now = NOW;
	mockMatch.boardProps = null;
	mockMatch.connection = { status: "open", reason: null, connection: {}, banner: null, retry: jest.fn() };
	mockMatch.play = {
		timing: DEFAULT_TIMING,
		notices: [],
		dismissNotice: jest.fn(),
		cancelInvite: jest.fn(async () => ({ ok: true })),
		joinQueue: jest.fn(async () => ({ ok: true })),
	};
	ui();
	setRoom(snap());
	mockPigs.length = 0;
	mockToast.mockClear();
	Object.values(mockRouter).forEach((fn) => fn.mockReset());
	mockRouter.canGoBack.mockImplementation(() => true);
	mockNavigation.dispatch.mockReset();
	for (const k of Object.keys(mockListeners)) delete mockListeners[k];
	takeHandedOffSearch();
	resetTableNavForTests();
}

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const EM_DASH = "\u2014";
const EMOJI = /[\u{1F300}-\u{1FAFF}]|[\u2600-\u2604\u2606-\u2664\u2666-\u2712\u2714\u2716-\u2725\u2728-\u27BF]/u;

function textOf(node: TestRenderer.ReactTestInstance | string): string {
	if (typeof node === "string") return node;
	return (node.children ?? []).map(textOf).join("");
}
function hosts(root: TestRenderer.ReactTestInstance, testID: string) {
	return root.findAll((n) => n.props.testID === testID && typeof n.type === "string");
}
function pressable(root: TestRenderer.ReactTestInstance, testID: string) {
	return root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === "function")[0];
}
async function press(root: TestRenderer.ReactTestInstance, testID: string) {
	const target = pressable(root, testID);
	if (!target) throw new Error(`nothing to press: ${testID}`);
	await act(async () => {
		await target.props.onPress();
	});
}
async function pressText(root: TestRenderer.ReactTestInstance, label: string) {
	const target = root.findAll((n) => typeof n.props.onPress === "function" && (n.props.accessibilityLabel === label || textOf(n) === label))[0];
	if (!target) throw new Error(`nothing labelled ${label}`);
	await act(async () => {
		await target.props.onPress();
	});
}
function clean(r: TestRenderer.ReactTestRenderer) {
	const text = textOf(r.root);
	expect(text.includes(EM_DASH)).toBe(false);
	expect(EMOJI.test(text)).toBe(false);
	return text;
}
async function advance(ms: number) {
	await act(async () => {
		jest.advanceTimersByTime(ms);
	});
}
/** The board area lays out at this size (the match screen measures it). */
async function layoutBoard(r: TestRenderer.ReactTestRenderer, width: number, height: number) {
	const area = r.root.findAll((n) => n.props.testID === "match-board-area" && typeof n.props.onLayout === "function")[0];
	if (!area) throw new Error("no board area");
	await act(async () => {
		area.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
	});
}
/** Every navigation call notes whether a dialog or a sheet was still up. */
function watchRouteChanges(r: TestRenderer.ReactTestRenderer) {
	const calls: { how: string; modalUp: boolean }[] = [];
	const note = (how: string) => () => {
		calls.push({ how, modalUp: hosts(r.root, "confirm-dialog").length > 0 || hosts(r.root, "result-sheet").length > 0 });
	};
	mockRouter.back.mockImplementation(note("back"));
	mockRouter.dismissTo.mockImplementation(note("dismissTo"));
	mockRouter.replace.mockImplementation(note("replace"));
	mockNavigation.dispatch.mockImplementation(note("dispatch"));
	return calls;
}

const tree = () => (
	<SafeAreaProvider initialMetrics={METRICS}>
		<MatchScreen roomId={mockMatch.room?.roomId ?? null} />
	</SafeAreaProvider>
);

let mounted: TestRenderer.ReactTestRenderer[] = [];
async function render() {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(tree());
	});
	mounted.push(r);
	return r;
}
async function update(r: TestRenderer.ReactTestRenderer) {
	await act(async () => {
		r.update(tree());
	});
}

describe("MatchScreen", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(NOW);
		reset();
	});
	afterEach(() => {
		act(() => {
			while (mounted.length) mounted.pop()?.unmount();
		});
		mounted = [];
		jest.useRealTimers();
	});

	describe("the lobby", () => {
		const invite = {
			code: "QRSTVWXY",
			url: "https://ticklethepig.com/play/QRSTVWXY",
			game: "rootle" as GameId,
			pace: "live" as const,
			kind: "link" as const,
			from: { userId: "u0", name: "Rosie", look: LOOK },
			to: [],
			status: "open" as const,
			roomId: "55555555-room",
			seatsTaken: 1,
			seatsMax: 4,
			expiresAt: NOW + 40 * 60_000,
		};

		it("as the host: the link to copy and share, the open seats, and Start now once enough pigs sit", async () => {
			ui("rootle");
			setRoom(snap({ game: "rootle", source: "invite", phase: "lobby", host: 0, seatCount: 4, activeSeats: [], deadline: null, view: null, invite }));
			const r = await render();
			let text = clean(r);
			expect(text).toContain("your table");
			expect(text).toContain("Share the link and pigs can sit down.");
			const open = hosts(r.root, "lobby-open-seat");
			expect(open.length).toBe(2);
			// One word under the dashed chair; the chair says it in full.
			expect(textOf(open[0])).toBe("open");
			expect(open[0].props.accessibilityLabel).toBe("an open seat");
			expect(text).toContain("Copy link");
			expect(text).toContain("40m left on the invite");
			// The code to read out: large, in two groups, spelled for a screen reader.
			const code = hosts(r.root, "lobby-code")[0];
			expect(textOf(code)).toBe("QRST VWXY");
			expect(code.props.accessibilityLabel).toBe("The table's code: Q R S T, V W X Y");
			expect(hosts(r.root, "lobby-code-block").length).toBeGreaterThan(0);
			expect(pressable(r.root, "lobby-share")).toBeDefined();
			await press(r.root, "lobby-start");
			expect(mockMatch.room?.source?.start).toHaveBeenCalled();
			// One pig short of the minimum: a line, not a button.
			setRoom(snap({ game: "rootle", source: "invite", phase: "lobby", host: 0, seats: [seat(0, "Rosie")], seatCount: 4, activeSeats: [], deadline: null, view: null, invite }));
			await update(r);
			text = clean(r);
			expect(text).toContain("Start once 1 more pig sits down");
			expect(pressable(r.root, "lobby-start")).toBeUndefined();
		});

		it("the host calling it off confirms first, then closes the invite and leaves", async () => {
			ui("rootle");
			const src = setRoom(snap({ game: "rootle", source: "invite", phase: "lobby", host: 0, seatCount: 4, activeSeats: [], deadline: null, view: null, invite }));
			const r = await render();
			await press(r.root, "lobby-cancel");
			const text = clean(r);
			expect(text).toContain("Call off the table?");
			expect(text).toContain("The invite closes and nobody else can sit down.");
			const routes = watchRouteChanges(r);
			await press(r.root, "dialog-confirm");
			expect(mockMatch.play.cancelInvite).toHaveBeenCalledWith("QRSTVWXY");
			expect(src?.leave).toHaveBeenCalled();
			// The dialog is gone; the route waits for it to finish leaving.
			expect(hosts(r.root, "confirm-dialog")).toHaveLength(0);
			expect(mockRouter.back).not.toHaveBeenCalled();
			await advance(POPUP_HANDOFF_GAP_MS);
			expect(routes).toEqual([{ how: "back", modalUp: false }]);
		});

		it("a table that starts itself when full never offers Start, and has no tray yet", async () => {
			ui("mud_volley", { seatStrip: "compact" });
			const direct = { ...invite, game: "mud_volley" as GameId, kind: "direct" as const, seatsMax: 2 };
			setRoom(snap({ game: "mud_volley", source: "invite", phase: "lobby", host: 0, seats: [seat(0, "Rosie")], seatCount: 2, activeSeats: [], deadline: null, view: null, invite: direct }));
			const r = await render();
			const text = clean(r);
			expect(text).toContain("Your friends have a ping to take their seats.");
			// Only the friends it names may sit: no code to read out.
			expect(hosts(r.root, "lobby-code")).toHaveLength(0);
			expect(textOf(hosts(r.root, "lobby-need-more")[0])).toBe("It starts the moment every seat is taken.");
			expect(pressable(r.root, "lobby-start")).toBeUndefined();
			expect(hosts(r.root, "emote-tray")).toHaveLength(0);
		});

		it("a Sounder invite shows its code too", async () => {
			ui("rootle");
			const crew = { ...invite, kind: "crew" as const };
			setRoom(snap({ game: "rootle", source: "invite", phase: "lobby", host: 0, seatCount: 4, activeSeats: [], deadline: null, view: null, invite: crew }));
			const r = await render();
			expect(clean(r)).toContain("Your Sounder has a ping. First pigs to tap take the seats.");
			expect(textOf(hosts(r.root, "lobby-code")[0])).toBe("QRST VWXY");
		});

		it("as a guest: whose table it is, and nothing that costs anyone anything", async () => {
			ui("rootle");
			const src = setRoom(snap({ game: "rootle", source: "invite", phase: "lobby", host: 0, you: 1, seats: [seat(0, "Clover"), seat(1, "Rosie")], seatCount: 4, activeSeats: [], deadline: null, view: null, invite }));
			const r = await render();
			const text = clean(r);
			expect(text).toContain("Waiting for Clover to start");
			expect(pressable(r.root, "lobby-start")).toBeUndefined();
			expect(pressable(r.root, "lobby-copy")).toBeUndefined();
			await press(r.root, "match-leave");
			expect(textOf(r.root)).not.toContain("Call off the table?");
			expect(src?.leave).toHaveBeenCalled();
			expect(mockRouter.back).toHaveBeenCalled();
		});
	});

	it("a table the queue is gathering starts by itself, and says so once", async () => {
		ui("rootle");
		setRoom(snap({ game: "rootle", source: "queue", phase: "lobby", host: null, seatCount: 4, activeSeats: [], deadline: null, view: null }));
		const r = await render();
		const text = clean(r);
		expect(text).toContain("A few more pigs may sit down. It starts in a moment.");
		expect(text).not.toContain("It starts the moment every seat is taken.");
		expect(pressable(r.root, "lobby-start")).toBeUndefined();
	});

	it("starting: who you found, 3-2-1, and the pigs turn to face each other", async () => {
		setRoom(snap({ phase: "starting", startsAt: NOW + 2_500, view: null, activeSeats: [], deadline: null }));
		const r = await render();
		const text = clean(r);
		expect(text).toContain("Found a pig!");
		expect(textOf(hosts(r.root, "countdown-number")[0])).toBe("3");
		expect(hosts(r.root, "stub-board")).toHaveLength(0);
		expect(mockPigs.slice(-2).map((p) => p.facing)).toEqual([undefined, undefined]);
		await advance(1_000);
		expect(mockPigs.slice(-2).map((p) => p.facing)).toEqual(["right", "left"]);
	});

	it("playing: the seat strip, the clock, and the board with every prop it is owed", async () => {
		const r = await render();
		const text = clean(r);
		expect(text).toContain("live table");
		expect(text).toContain("Fence the Pen");
		expect(textOf(hosts(r.root, "seat-tag-0")[0])).toBe("You");
		expect(textOf(hosts(r.root, "seat-tag-1")[0])).toBe("Bandit");
		expect(textOf(hosts(r.root, "seat-status-0")[0])).toBe("3 pens");
		expect(hosts(r.root, "seat-status-1")).toHaveLength(0);
		expect(text).toContain("Your move");
		expect(textOf(hosts(r.root, "turn-clock-seconds")[0])).toBe("15s");
		const props = mockMatch.boardProps as Record<string, unknown>;
		expect(props).toMatchObject({ you: 0, yourTurn: true, pending: false, practice: false, reduceMotion: false });
		expect(props.view).toEqual({ v: 1 });
		expect(props.events).toEqual([]);
		expect(typeof props.serverNow).toBe("function");
		expect((props.width as number) > 0).toBe(true);
	});

	it("a newer revision's cues reach the board; the one it mounted on did not", async () => {
		setRoom(snap({ rev: 5, events: [{ type: "old" }] }));
		const r = await render();
		expect((mockMatch.boardProps as Record<string, unknown>).events).toEqual([]);
		setRoom(snap({ rev: 6, events: [{ type: "fence", seat: 1 }], activeSeats: [1] }));
		await update(r);
		expect((mockMatch.boardProps as Record<string, unknown>).events).toEqual([{ type: "fence", seat: 1 }]);
	});

	it("a refusal is a toast in the protocol's words; a stale 'not your turn' stays quiet", async () => {
		const src = setRoom(snap());
		const r = await render();
		src!.act.mockResolvedValueOnce({ ok: false, error: "illegal_move" });
		await act(async () => {
			await (mockMatch.boardProps!.act as (a: unknown) => Promise<unknown>)({ type: "fence" });
		});
		expect(mockToast).toHaveBeenCalledWith({ tone: "fail", title: "Not quite", text: "That move isn't allowed here. Try another." });
		mockToast.mockClear();
		// The table moved on: the latest snapshot no longer waits on you.
		src!.act.mockImplementationOnce(async () => {
			src!.snapshot = snap({ activeSeats: [1], rev: 6 });
			return { ok: false, error: "not_your_turn" };
		});
		await act(async () => {
			await (mockMatch.boardProps!.act as (a: unknown) => Promise<unknown>)({ type: "fence" });
		});
		expect(mockToast).not.toHaveBeenCalled();
		await update(r);
	});

	describe("the end", () => {
		async function endWith(result: RoomSnapshot["result"], over: Partial<RoomSnapshot> = {}) {
			const r = await render();
			setRoom(snap({ phase: "ended", activeSeats: [], deadline: null, rev: 9, result, ...over }));
			await update(r);
			return r;
		}

		it("a win waits for the board's last beat, can be skipped, then names it warmly", async () => {
			const r = await endWith({ kind: "win", winners: [0], scores: [5, 4], summary: "5 pens to 4", reason: "complete" });
			expect(hosts(r.root, "result-sheet")).toHaveLength(0);
			expect(pressable(r.root, "match-skip")).toBeDefined();
			await advance(3_000);
			const text = clean(r);
			expect(text).toContain("You took it");
			expect(text).toContain("5 pens to 4");
			expect(text).toContain("took it");
			expect(text).toContain("Rematch");
			expect(text).toContain("Find another pig");
			expect(text).toContain("Head home");
		});

		it("Skip to result shows it at once", async () => {
			const r = await endWith({ kind: "win", winners: [1], scores: [2, 5], summary: "", reason: "complete" });
			await press(r.root, "match-skip");
			expect(clean(r)).toContain("Bandit took it");
		});

		it("a function delay is asked with the final view; Reduce Motion skips it", async () => {
			const fn = jest.fn(() => 15_600);
			ui("mud_volley", { resultDelayMs: fn, seatStrip: "compact" });
			const room = snap({ game: "mud_volley", phase: "ended", result: { kind: "draw", winners: [0, 1], scores: [3, 3], summary: "", reason: "complete" } });
			expect(resultDelay(mockMatch.ui as never, room)).toBe(15_600);
			expect(fn).toHaveBeenCalledWith(room.view, room);
			expect(resultDelay(mockMatch.ui as never, { ...room, result: { ...room.result!, reason: "forfeit" } })).toBe(0);
			mockMatch.reduceMotion = true;
			const r = await endWith({ kind: "draw", winners: [0, 1], scores: [3, 3], summary: "", reason: "complete" }, { game: "mud_volley" });
			expect(clean(r)).toContain("A draw");
		});

		it("a co-op table reads as something the table did together", async () => {
			ui("snout_says", { seatStatus: () => null });
			setRoom(snap({ game: "snout_says" }));
			const r = await endWith({ kind: "coop", winners: [0, 1], scores: [7, 7], success: true, summary: "7 points between you", reason: "complete" }, { game: "snout_says" });
			await advance(3_000);
			const text = clean(r);
			expect(text).toContain("You did it together");
			expect(text).toContain("The table");
			expect(text).toContain("together");
			expect(text).not.toContain("took it");
		});

		it("a co-op table that ended early is nobody's fault, and not called together", async () => {
			ui("snout_says", { seatStatus: () => null });
			setRoom(snap({ game: "snout_says" }));
			const r = await endWith(
				{ kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" },
				{ game: "snout_says", seats: [seat(0, "Rosie"), seat(1, "Bandit", { gone: true, connected: false })] },
			);
			const text = clean(r);
			expect(text).toContain("Ended early");
			expect(text).toContain("Bandit had to head home.");
			expect(text).not.toContain("together");
		});

		it("a forfeit never blames: the other pig had to head home", async () => {
			const r = await endWith(
				{ kind: "win", winners: [0], scores: [1, 2], summary: "", reason: "forfeit" },
				{ seats: [seat(0, "Rosie"), seat(1, "Bandit", { gone: true, connected: false })] },
			);
			const text = clean(r);
			expect(text).toContain("You took it");
			expect(text).toContain("Bandit had to head home.");
			expect(text).toContain("headed home");
		});

		it("says who already wants a rematch, and how long the window has", async () => {
			const r = await endWith({ kind: "win", winners: [0], scores: [5, 4], summary: "", reason: "complete" }, { rematch: { votes: [1], until: NOW + 20_000 } });
			await advance(3_000);
			expect(textOf(hosts(r.root, "result-rematch-line")[0])).toBe("Bandit wants a rematch · 20s to say yes");
			await press(r.root, "result-rematch");
			expect(mockMatch.room?.source?.rematch).toHaveBeenCalled();
		});

		it("Find another pig leaves, hands the hub the same game and pace, and goes there once the sheet has gone", async () => {
			const r = await endWith({ kind: "win", winners: [0], scores: [5, 4], summary: "", reason: "complete" });
			await advance(3_000);
			const routes = watchRouteChanges(r);
			await press(r.root, "result-find-another");
			expect(mockMatch.room?.source?.leave).toHaveBeenCalled();
			expect(takeHandedOffSearch()).toEqual({ games: ["fence_the_pen"], pace: "live" });
			expect(hosts(r.root, "result-sheet")).toHaveLength(0);
			expect(mockRouter.dismissTo).not.toHaveBeenCalled();
			await advance(POPUP_HANDOFF_GAP_MS);
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/play");
			expect(routes).toEqual([{ how: "dismissTo", modalUp: false }]);
		});

		it("Head home closes the sheet first, then goes back, once", async () => {
			const r = await endWith({ kind: "win", winners: [0], scores: [5, 4], summary: "", reason: "complete" });
			await advance(3_000);
			const routes = watchRouteChanges(r);
			await press(r.root, "result-head-home");
			expect(mockMatch.room?.source?.leave).toHaveBeenCalled();
			expect(hosts(r.root, "result-sheet")).toHaveLength(0);
			// Nothing to tap on the way out; the result does not come back.
			expect(pressable(r.root, "match-see-result")).toBeUndefined();
			expect(mockRouter.back).not.toHaveBeenCalled();
			await advance(POPUP_HANDOFF_GAP_MS);
			expect(routes).toEqual([{ how: "back", modalUp: false }]);
			await advance(POPUP_HANDOFF_GAP_MS);
			expect(mockRouter.back).toHaveBeenCalledTimes(1);
		});

		it("a pig the table moved on without reads one line true of a leave and a timeout", async () => {
			const r = await endWith(
				{ kind: "win", winners: [1], scores: [2, 5], summary: "", reason: "forfeit" },
				{ seats: [seat(0, "Rosie", { gone: true }), seat(1, "Bandit")] },
			);
			const text = clean(r);
			expect(text).toContain("Bandit took it");
			expect(text).toContain("The table moved on without you.");
			expect(textOf(hosts(r.root, "result-row-0")[0])).toContain("sat out");
			expect(text).not.toContain("You left before the end");
			expect(text).not.toContain("You headed home early");
		});

		it("an early end with only you gone says the same", async () => {
			ui("snout_says", { seatStatus: () => null });
			setRoom(snap({ game: "snout_says" }));
			const r = await endWith(
				{ kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" },
				{ game: "snout_says", seats: [seat(0, "Rosie", { gone: true }), seat(1, "Bandit")] },
			);
			const text = clean(r);
			expect(text).toContain("Ended early");
			expect(text).toContain("The table moved on without you.");
			expect(text).not.toContain("You left before the end");
		});
	});

	describe("leaving", () => {
		it("a live competitive table names the cost: the other pig takes the win", async () => {
			const r = await render();
			await press(r.root, "match-leave");
			const text = clean(r);
			expect(text).toContain("Leave the table?");
			expect(text).toContain("Bandit takes the win.");
			const routes = watchRouteChanges(r);
			await press(r.root, "dialog-confirm");
			expect(mockMatch.room?.source?.leave).toHaveBeenCalled();
			await advance(POPUP_HANDOFF_GAP_MS);
			expect(routes).toEqual([{ how: "back", modalUp: false }]);
		});

		it("closes the dialog before any navigation, and waits out its exit (the freeze)", async () => {
			const r = await render();
			await press(r.root, "match-leave");
			expect(hosts(r.root, "confirm-dialog").length).toBeGreaterThan(0);
			const routes = watchRouteChanges(r);
			await press(r.root, "dialog-confirm");
			expect(hosts(r.root, "confirm-dialog")).toHaveLength(0);
			await advance(POPUP_HANDOFF_GAP_MS - 1);
			expect(routes).toEqual([]);
			await advance(1);
			expect(routes).toEqual([{ how: "back", modalUp: false }]);
		});

		it("a leave the table is slow to hear keeps the dialog busy, and still closes it before the route changes", async () => {
			const src = setRoom(snap());
			let heard!: () => void;
			src!.leave.mockImplementation(() => new Promise<void>((resolve) => (heard = resolve)));
			const r = await render();
			await press(r.root, "match-leave");
			const routes = watchRouteChanges(r);
			await act(async () => {
				void pressable(r.root, "dialog-confirm").props.onPress();
			});
			// Busy: still up, nothing navigates, a second tap does nothing.
			expect(hosts(r.root, "confirm-dialog").length).toBeGreaterThan(0);
			await act(async () => {
				void pressable(r.root, "dialog-confirm")?.props.onPress();
			});
			expect(src!.leave).toHaveBeenCalledTimes(1);
			await advance(POPUP_HANDOFF_GAP_MS * 2);
			expect(routes).toEqual([]);
			await act(async () => heard());
			expect(hosts(r.root, "confirm-dialog")).toHaveLength(0);
			await advance(POPUP_HANDOFF_GAP_MS);
			expect(routes).toEqual([{ how: "back", modalUp: false }]);
		});

		it("a result that lands on the way out opens no sheet over it", async () => {
			const r = await render();
			await press(r.root, "match-leave");
			const routes = watchRouteChanges(r);
			await press(r.root, "dialog-confirm");
			// The leave made it a forfeit: the final snapshot arrives mid-exit.
			setRoom(
				snap({ phase: "ended", activeSeats: [], deadline: null, rev: 9, seats: [seat(0, "Rosie", { gone: true }), seat(1, "Bandit")], result: { kind: "win", winners: [1], scores: [0, 0], summary: "", reason: "forfeit" } }),
				{ gone: "left" },
			);
			await update(r);
			expect(hosts(r.root, "result-sheet")).toHaveLength(0);
			expect(textOf(r.root)).not.toContain("This table has packed up");
			await advance(POPUP_HANDOFF_GAP_MS);
			expect(routes).toEqual([{ how: "back", modalUp: false }]);
		});

		it("a back gesture during the wait is the way out: nothing navigates twice", async () => {
			const r = await render();
			await press(r.root, "match-leave");
			await press(r.root, "dialog-confirm");
			const preventDefault = jest.fn();
			act(() => {
				for (const fn of mockListeners.beforeRemove ?? []) fn({ preventDefault, data: { action: { type: "GO_BACK" } } });
			});
			expect(preventDefault).not.toHaveBeenCalled();
			await advance(POPUP_HANDOFF_GAP_MS * 2);
			expect(mockRouter.back).not.toHaveBeenCalled();
			expect(mockNavigation.dispatch).not.toHaveBeenCalled();
		});

		it("a co-op table that cannot go on ends for everyone", async () => {
			ui("snout_says");
			setRoom(snap({ game: "snout_says" }));
			const r = await render();
			await press(r.root, "match-leave");
			const text = clean(r);
			expect(text).toContain("Leave?");
			expect(text).toContain("The game ends for everyone.");
		});

		it("Stay keeps the pig at the table", async () => {
			const r = await render();
			await press(r.root, "match-leave");
			expect(textOf(hosts(r.root, "dialog-cancel")[0])).toBe("Stay");
			await press(r.root, "dialog-cancel");
			expect(mockMatch.room?.source?.leave).not.toHaveBeenCalled();
			expect(textOf(r.root)).not.toContain("Leave the table?");
		});

		it("a back swipe at a live table asks first too", async () => {
			const r = await render();
			const preventDefault = jest.fn();
			act(() => {
				for (const fn of mockListeners.beforeRemove ?? []) fn({ preventDefault, data: { action: { type: "GO_BACK" } } });
			});
			await update(r);
			expect(preventDefault).toHaveBeenCalled();
			expect(textOf(r.root)).toContain("Leave the table?");
			const routes = watchRouteChanges(r);
			await press(r.root, "dialog-confirm");
			expect(mockNavigation.dispatch).not.toHaveBeenCalled();
			await advance(POPUP_HANDOFF_GAP_MS);
			expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: "GO_BACK" });
			expect(routes).toEqual([{ how: "dispatch", modalUp: false }]);
		});
	});

	describe("the board's box", () => {
		it("a board that fills its height is drawn in the measured box, with no scroller", async () => {
			ui("fence_the_pen", { fillsHeight: true });
			const r = await render();
			expect(hosts(r.root, "match-board-fill").length).toBeGreaterThan(0);
			expect(hosts(r.root, "match-board-scroll")).toHaveLength(0);
			await layoutBoard(r, 390, 500);
			// The width less the two gutters; the height less the foot over the tray.
			expect(mockMatch.boardProps).toMatchObject({ width: 390 - 18 * 2, height: 500 - 8 });
			// The tray is its own row under the box, never over it.
			expect(hosts(r.root, "emote-tray").length).toBeGreaterThan(0);
		});

		it("a board without the flag keeps the scroller, and the lobby always scrolls", async () => {
			const r = await render();
			expect(hosts(r.root, "match-board-scroll").length).toBeGreaterThan(0);
			expect(hosts(r.root, "match-board-fill")).toHaveLength(0);
			ui("rootle", { fillsHeight: true });
			setRoom(snap({ game: "rootle", source: "invite", phase: "lobby", host: 0, seatCount: 4, activeSeats: [], deadline: null, view: null }));
			await update(r);
			expect(hosts(r.root, "match-board-scroll").length).toBeGreaterThan(0);
		});

		it("holds its table on the stack while it is mounted", async () => {
			const r = await render();
			expect(isTableOpen("55555555-room")).toBe(true);
			act(() => r.unmount());
			mounted = mounted.filter((m) => m !== r);
			expect(isTableOpen("55555555-room")).toBe(false);
		});
	});

	describe("play by post", () => {
		it("waiting: a line, not a ticking clock; back just steps away; Resign asks first", async () => {
			const src = setRoom(snap({ pace: "async", activeSeats: [1], deadline: NOW + 20 * 3_600_000 }));
			const r = await render();
			let text = clean(r);
			expect(text).toContain("by post");
			expect(textOf(hosts(r.root, "turn-clock-post")[0])).toBe("Waiting for Bandit · we'll ping you");
			expect(hosts(r.root, "turn-clock-seconds")).toHaveLength(0);
			await press(r.root, "match-more");
			await pressText(r.root, "Resign");
			await advance(1_000);
			text = clean(r);
			expect(text).toContain("Resign this table?");
			expect(text).toContain("Bandit takes the win.");
			expect(textOf(hosts(r.root, "dialog-cancel")[0])).toBe("Keep playing");
			await press(r.root, "dialog-cancel");
			expect(src?.leave).not.toHaveBeenCalled();
		});

		it("your move says how long it waits", async () => {
			setRoom(snap({ pace: "async", activeSeats: [0], deadline: NOW + 11 * 3_600_000 + 60_000 }));
			const r = await render();
			expect(textOf(hosts(r.root, "turn-clock-post")[0])).toBe("Your move · 11h left");
		});
	});

	describe("practice", () => {
		it("is plainly labelled, and leaving costs nothing", async () => {
			const src = setRoom(snap(), { practice: true });
			const r = await render();
			const text = clean(r);
			expect(text).toContain("practice · bot pigs");
			expect(textOf(hosts(r.root, "seat-status-1")[0])).toBe("practice pig");
			await press(r.root, "match-leave");
			expect(textOf(r.root)).not.toContain("Leave the table?");
			expect(src?.leave).toHaveBeenCalled();
			expect(mockRouter.back).toHaveBeenCalled();
		});

		it("a practice table that did not survive a restart has packed up", async () => {
			setRoom(null, { practice: true, source: null });
			mockMatch.room!.roomId = "practice-gone";
			const r = await render();
			expect(clean(r)).toContain("This table has packed up");
			await press(r.root, "match-back-to-hub");
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/play");
		});
	});

	it("a table the server closed has packed up too", async () => {
		setRoom(null, { gone: "expired" });
		mockMatch.room!.roomId = "66666666-gone";
		const r = await render();
		expect(clean(r)).toContain("This table has packed up");
	});

	it("with the flag off: Play together is on its way", async () => {
		mockMatch.enabled = false;
		const r = await render();
		expect(clean(r)).toContain("Play together is on its way");
	});

	it("an emote goes to the table, then the tray rests for the server's gap", async () => {
		const src = setRoom(snap());
		const r = await render();
		await press(r.root, "emote-oink");
		expect(src?.emote).toHaveBeenCalledWith("oink");
		const sticker = pressable(r.root, "emote-love");
		expect(sticker.props.disabled).toBe(true);
		await advance(DEFAULT_TIMING.emoteCooldownMs);
		expect(pressable(r.root, "emote-love").props.disabled).toBe(false);
	});

	it("another pig's emote pops over that pig while the table is watched; an old one does not", async () => {
		setRoom(snap());
		mockMatch.room!.emotes = { 1: { emote: "oink", at: NOW - 500 } };
		const r = await render();
		// Already up when the screen opened: old news.
		expect(hosts(r.root, "seat-emote-1")).toHaveLength(0);
		mockMatch.room!.emotes = { 1: { emote: "gg", at: NOW } };
		await update(r);
		expect(hosts(r.root, "seat-emote-1").length).toBeGreaterThan(0);
		await advance(3_000);
		expect(hosts(r.root, "seat-emote-1")).toHaveLength(0);
	});

	it("a pig whose socket dropped naps, softly marked away", async () => {
		setRoom(snap({ seats: [seat(0, "Rosie"), seat(1, "Bandit", { connected: false })] }));
		const r = await render();
		expect(textOf(hosts(r.root, "seat-status-1")[0])).toBe("away");
		expect(mockPigs.some((p) => p.pigMood === "tired")).toBe(true);
	});

	it("a dropped socket says so over the table", async () => {
		mockMatch.connection = { ...mockMatch.connection, status: "reconnecting", banner: "Reconnecting…" };
		const r = await render();
		expect(textOf(r.root)).toContain("Reconnecting…");
	});
});
