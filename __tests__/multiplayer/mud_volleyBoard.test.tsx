// Mud Volley's board (components/play/games/mud_volley) rendered from real
// views of the real rules: attacking, defending, locked, a reveal played
// through its beat, the envelope form, the waiting envelope, the reel, and
// the ended table; plus the how-to, the seat lines and the result ledger.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BORDER, SPACE, TAP_MIN } from "@/constants/theme";
import { BOARD_HEIGHTS, BOARD_WIDTHS, SE_DESIGN_HEIGHT, TICKET_SLOT, widthFor } from "@/components/play/games/fit";
import { mudVolleyUi } from "@/components/play/games/mud_volley";
import { MudVolleyBoard } from "@/components/play/games/mud_volley/Board";
import { MudVolleyResultDetail } from "@/components/play/games/mud_volley/ResultDetail";
import { ENVELOPE_WAITING, TABLE_CLOSED } from "@/components/play/games/mud_volley/copy";
import { WHO_WORD } from "@/components/play/games/mud_volley/LaneCards";
import {
	CARD_ART_MAX,
	CARD_ART_MIN,
	CARD_LIFT,
	PASTURE_MIN,
	SCENE_H,
	pastureGeometry,
	volleyPlan,
	type VolleyBoardKind,
} from "@/components/play/games/mud_volley/layout";
import {
	EXCHANGES,
	VOLLEY_TIMING,
	attackerOf,
	mud_volley,
	type Lane,
	type VolleyAction,
	type VolleyState,
	type VolleyView,
} from "@/multiplayer/games/mud_volley/rules";
import type { GameEvent, Seat } from "@/multiplayer/types";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import { TEST_LOOK } from "@/multiplayer/testkit";
import { createRng } from "@/multiplayer/rng";

// jest.mock calls are hoisted above the imports by babel-jest.
// The UI barrel reaches Sentry through utils/log, whose module-level cleanup
// interval would keep jest alive after the run (the repo's usual stub).
jest.mock("@sentry/react-native", () => ({ captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/ui/PigStage", () => ({ PigStage: () => null }));
jest.mock("@/utils/multiplayer/looks", () => ({ pigStagePropsForLook: () => ({ pigId: "rosie" }) }));
jest.mock("@/hooks/useMotionPolicy", () => ({
	MOTION_DURATION: { feedback: 120, state: 220, modal: 300, celebration: 450, crossfade: 150 },
	startDecorativeLoop: () => () => {},
	useMotionPolicy: () => ({
		reduceMotion: true,
		allowDecorativeMotion: false,
		largeTransition: "crossfade",
		duration: (_standard: number, reduced = 150) => reduced,
	}),
}));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(async () => {}),
	selectionAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
	NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const METRICS = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const NOW = 1_700_000_000_000;
const WIDTH = 358;

/** A table with a known schedule; `start` is the server time it began (the
 *  engine always passes one, which stamps the first toss's window). */
function known(firstAttacker: Seat, pace: "live" | "async" = "live", start?: number): VolleyState {
	const base = mud_volley.setup({ seats: 2, rng: createRng("board"), pace, now: start });
	const lanes: Lane[] = ["L", "M", "R", "L", "M", "R"];
	return { ...base, firstAttacker, windups: lanes.map((lane, ex) => ({ lane, seal: `board-${ex}-${lane}` })) };
}

function apply(s: VolleyState, seat: Seat, action: VolleyAction, now = NOW) {
	const res = mud_volley.apply(s, seat, action, { now, rng: createRng("apply"), pace: s.mode === "envelope" ? "async" : "live", present: [true, true] });
	if (!res.ok) throw new Error(res.error);
	return res;
}

function room(view: VolleyView, rev: number, s: VolleyState): RoomSnapshot<VolleyView> {
	return {
		roomId: "00000000-board",
		game: "mud_volley",
		rulesVersion: mud_volley.rulesVersion,
		pace: view.mode === "envelope" ? "async" : "live",
		source: "queue",
		phase: view.phase === "done" ? "ended" : "playing",
		seats: [
			{ seat: 0, userId: "user-0", name: "Rosie", look: TEST_LOOK, connected: true, gone: false },
			{ seat: 1, userId: "user-1", name: "Bandit", look: { ...TEST_LOOK, pigId: "bandit" }, connected: true, gone: false },
		],
		seatCount: 2,
		you: view.you,
		view,
		activeSeats: mud_volley.activeSeats(s),
		deadline: null,
		startsAt: null,
		rev,
		events: [],
		result: null,
		invite: null,
		rematch: null,
		host: null,
	};
}

/** Every tree a test mounts, unmounted after it (stops the beat's timers
 *  and the animations, so jest exits clean). */
const mounted: TestRenderer.ReactTestRenderer[] = [];

interface Rendered {
	tree: TestRenderer.ReactTestRenderer;
	sent: jest.Mock;
	rerender: (s: VolleyState, events: GameEvent[], rev: number) => void;
}

function render(
	s: VolleyState,
	opts: { you?: Seat; events?: GameEvent[]; rev?: number; pending?: boolean; ended?: boolean; serverNow?: () => number; width?: number; height?: number } = {},
): Rendered {
	const you = opts.you ?? 0;
	const sent = jest.fn(async () => ({ ok: true as const }));
	const element = (state: VolleyState, events: GameEvent[], rev: number) => {
		const view = mud_volley.view(state, you);
		const open = room(view, rev, state);
		// A room the engine ended early (a forfeit, a no contest) owes nothing.
		const snap: RoomSnapshot<VolleyView> = opts.ended ? { ...open, phase: "ended", activeSeats: [] } : open;
		return (
			<SafeAreaProvider initialMetrics={METRICS}>
				<MudVolleyBoard
					view={view}
					room={snap}
					you={you}
					yourTurn={snap.activeSeats.includes(you)}
					act={sent}
					pending={opts.pending ?? false}
					events={events}
					reduceMotion
					width={opts.width ?? WIDTH}
					height={opts.height}
					serverNow={opts.serverNow}
					practice={false}
				/>
			</SafeAreaProvider>
		);
	};
	let tree!: TestRenderer.ReactTestRenderer;
	act(() => {
		tree = TestRenderer.create(element(s, opts.events ?? [], opts.rev ?? 1));
	});
	mounted.push(tree);
	return {
		tree,
		sent,
		rerender: (state, events, rev) =>
			act(() => {
				tree.update(element(state, events, rev));
			}),
	};
}

function textOf(tree: TestRenderer.ReactTestRenderer): string {
	const out: string[] = [];
	const walk = (node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | string | null) => {
		if (node === null) return;
		if (typeof node === "string") {
			out.push(node);
			return;
		}
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}
		(node.children ?? []).forEach(walk);
	};
	walk(tree.toJSON());
	return out.join(" ");
}

function count(text: string, needle: string): number {
	return text.split(needle).length - 1;
}

/** Press whatever carries this testID and an onPress (the host Pressable). */
function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
	const target = tree.root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === "function")[0];
	if (!target) throw new Error(`nothing pressable at ${testID}`);
	act(() => {
		target.props.onPress();
	});
}

function tappable(tree: TestRenderer.ReactTestRenderer, testID: string): boolean {
	return tree.root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === "function").length > 0;
}

/** GameUI.resultDelayMs, whichever form it takes. */
function resultDelay(view: VolleyView, snap: RoomSnapshot<VolleyView>): number {
	const delay = mudVolleyUi.resultDelayMs;
	return typeof delay === "function" ? delay(view, snap) : (delay ?? 0);
}

function has(tree: TestRenderer.ReactTestRenderer, testID: string): boolean {
	return tree.root.findAll((n) => n.props.testID === testID).length > 0;
}

/** The host view carrying a testID (composites forward it, so filter to hosts). */
function host(node: TestRenderer.ReactTestInstance, testID: string): TestRenderer.ReactTestInstance | undefined {
	return node.findAll((n) => typeof n.type === "string" && n.props.testID === testID)[0];
}

function nodeText(node: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	const walk = (n: TestRenderer.ReactTestInstance | string) => {
		if (typeof n === "string") out.push(n);
		else (n.children ?? []).forEach(walk);
	};
	walk(node);
	return out.join("");
}

/** Each revealed card's whose-lane tag, by lane ("" for an untagged card). */
function whoTags(tree: TestRenderer.ReactTestRenderer): Record<Lane, string> {
	const tag = (lane: Lane) => {
		const node = host(tree.root, `volley-who-${lane}`);
		return node ? nodeText(node) : "";
	};
	return { L: tag("L"), M: tag("M"), R: tag("R") };
}

function flatHeight(node: TestRenderer.ReactTestInstance | undefined): number | undefined {
	return node ? (StyleSheet.flatten(node.props.style)?.height as number | undefined) : undefined;
}

describe("mud volley board", () => {
	afterEach(() => {
		act(() => {
			while (mounted.length > 0) mounted.pop()?.unmount();
		});
		jest.useRealTimers();
	});

	it("draws a tossing pig's turn: the rule in one line, a big splat on the wind-up card", () => {
		const { tree, sent } = render(known(0));
		const text = textOf(tree);
		expect(text).toContain("You're winding up left. Follow through, or flick it?");
		expect(count(text, "big splat · 2")).toBe(1);
		expect(count(text, "splat · 1")).toBe(2);
		expect(text).toContain("wind-up");
		expect(text).toContain("toss 1 of 6");
		expect(text).toContain("Lock it in");
		expect(text).not.toContain("—");
		press(tree, "volley-lane-L");
		expect(textOf(tree)).toContain("+2");
		expect(textOf(tree)).toContain("big splat");
		press(tree, "volley-lock");
		expect(sent).toHaveBeenCalledWith({ type: "lane", lane: "L", ex: 0 });
	});

	it("draws a catching pig's turn: every card a catch", () => {
		const { tree, sent } = render(known(1));
		const text = textOf(tree);
		expect(text).toContain("Bandit's winding up left. Where will you catch?");
		expect(count(text, "catch · 1")).toBe(3);
		expect(text).not.toContain("big splat");
		press(tree, "volley-lane-M");
		press(tree, "volley-lock");
		expect(sent).toHaveBeenCalledWith({ type: "lane", lane: "M", ex: 0 });
	});

	it("stamps a sealed lane and shows the rival's seal, never its lane", () => {
		const mine = apply(known(0), 0, { type: "lane", lane: "R" }).state;
		const locked = render(mine);
		const text = textOf(locked.tree);
		expect(text).toContain("locked");
		expect(text).toContain("Locked in");
		expect(text).toContain("Your toss is sealed. Bandit is picking a catch.");
		expect(has(locked.tree, "volley-locked-stamp")).toBe(true);
		const theirs = apply(known(0), 1, { type: "lane", lane: "R" }).state;
		const sealed = render(theirs);
		expect(has(sealed.tree, "volley-rival-sealed")).toBe(true);
		expect(textOf(sealed.tree)).toContain("sealed");
		expect(textOf(sealed.tree)).toContain("Lock it in");
	});

	it("plays a reveal before the next toss: here it comes, the landing, then the cards wake", () => {
		// The phone's clock is the table's here; the toss resolves "now".
		jest.useFakeTimers({ now: NOW });
		const first = apply(known(0), 1, { type: "lane", lane: "M" }).state;
		const view = render(first, { rev: 4, serverNow: () => Date.now() });
		const resolved = apply(first, 0, { type: "lane", lane: "L" });
		view.rerender(resolved.state, resolved.events ?? [], 5);
		let text = textOf(view.tree);
		expect(text).toContain("Both lanes are in. Here it comes!");
		// While it settles, only your own lane is tagged.
		expect(whoTags(view.tree)).toEqual({ L: "you", M: "", R: "" });
		expect(text).toContain("Watch the toss");
		// Not on the scoreboard until it lands.
		expect(view.tree.root.findAll((n) => n.props.testID === "volley-score-left")[0].props.accessibilityLabel).toBe("You, 0 points");
		act(() => {
			jest.advanceTimersByTime(VOLLEY_TIMING.settleMs + VOLLEY_TIMING.arcMs);
		});
		text = textOf(view.tree);
		expect(text).toContain("Big splat! You followed through. +2 to you.");
		expect(whoTags(view.tree)).toEqual({ L: "you", M: "them", R: "" });
		// The screen reader still hears the whole of it.
		expect(host(view.tree.root, "volley-lane-M")?.props.accessibilityLabel).toBe("Middle lane, their catch");
		expect(has(view.tree, "volley-landing-splat2")).toBe(true);
		expect(view.tree.root.findAll((n) => n.props.testID === "volley-score-left")[0].props.accessibilityLabel).toBe("You, 2 points");
		act(() => {
			jest.advanceTimersByTime(VOLLEY_TIMING.revealMs);
		});
		text = textOf(view.tree);
		expect(text).toContain("Bandit's winding up middle. Where will you catch?");
		expect(text).toContain("toss 2 of 6");
		expect(text).toContain("Lock it in");
		press(view.tree, "volley-lane-R");
		press(view.tree, "volley-lock");
		expect(view.sent).toHaveBeenCalledWith({ type: "lane", lane: "R", ex: 1 });
	});

	it("owns up to a lane the clock threw (timed by Date.now when no table clock is passed)", () => {
		jest.useFakeTimers({ now: NOW });
		const first = apply(known(0), 1, { type: "lane", lane: "M" }).state;
		const view = render(first, { rev: 4 });
		const timed = mud_volley.onTimeout(first, 0, { now: NOW, rng: createRng("lobbed"), pace: "live", present: [true, true] });
		view.rerender(timed.state, [{ type: "timeout", seat: 0 }, ...(timed.events ?? [])], 5);
		act(() => {
			jest.advanceTimersByTime(VOLLEY_TIMING.settleMs + VOLLEY_TIMING.arcMs);
		});
		expect(textOf(view.tree)).toContain("Your pig lobbed it anyhow.");
	});

	it("wakes the cards when the server's window opens, not a whole beat after a late view lands", () => {
		jest.useFakeTimers({ now: NOW });
		const first = apply(known(0), 1, { type: "lane", lane: "M" }, NOW - 1_000).state;
		const view = render(first, { rev: 4, serverNow: () => Date.now() });
		// The toss resolved a second before its view reached this phone.
		const resolved = apply(first, 0, { type: "lane", lane: "L" }, NOW - 1_000);
		view.rerender(resolved.state, resolved.events ?? [], 5);
		const opensAt = resolved.state.commitOpensAt as number;
		expect(opensAt).toBe(NOW - 1_000 + VOLLEY_TIMING.settleMs + VOLLEY_TIMING.revealMs);
		expect(textOf(view.tree)).toContain("Watch the toss");
		// It lands on the server's beat (resolved + settle + arc), not 1.8 s after arrival.
		act(() => {
			jest.advanceTimersByTime(NOW - 1_000 + VOLLEY_TIMING.settleMs + VOLLEY_TIMING.arcMs - NOW);
		});
		expect(textOf(view.tree)).toContain("Big splat! You followed through.");
		act(() => {
			jest.advanceTimersByTime(opensAt - Date.now() - 1);
		});
		expect(textOf(view.tree)).toContain("Watch the toss");
		expect(tappable(view.tree, "volley-lane-L")).toBe(false);
		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(textOf(view.tree)).toContain("Lock it in");
		expect(tappable(view.tree, "volley-lane-L")).toBe(true);
	});

	it("skips the beat for a view that lands after its window opened", () => {
		jest.useFakeTimers({ now: NOW });
		const first = apply(known(0), 1, { type: "lane", lane: "M" }, NOW - 5_000).state;
		const view = render(first, { rev: 4, serverNow: () => Date.now() });
		const resolved = apply(first, 0, { type: "lane", lane: "L" }, NOW - 5_000);
		view.rerender(resolved.state, resolved.events ?? [], 5);
		act(() => {
			jest.advanceTimersByTime(0);
		});
		expect(textOf(view.tree)).toContain("Lock it in");
		expect(tappable(view.tree, "volley-lane-R")).toBe(true);
		expect(view.tree.root.findAll((n) => n.props.testID === "volley-score-left")[0].props.accessibilityLabel).toBe("You, 2 points");
	});

	it("reads the table's clock, not the phone's", () => {
		jest.useFakeTimers({ now: NOW });
		// The server runs two seconds ahead of this phone.
		const ahead = () => Date.now() + 2_000;
		const first = apply(known(0), 1, { type: "lane", lane: "M" }, NOW + 2_000).state;
		const view = render(first, { rev: 4, serverNow: ahead });
		const resolved = apply(first, 0, { type: "lane", lane: "L" }, NOW + 2_000);
		view.rerender(resolved.state, resolved.events ?? [], 5);
		const beat = VOLLEY_TIMING.settleMs + VOLLEY_TIMING.revealMs;
		act(() => {
			jest.advanceTimersByTime(beat - 1);
		});
		expect(textOf(view.tree)).toContain("Watch the toss");
		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(textOf(view.tree)).toContain("Lock it in");
	});

	it("holds the first toss's cards through the wind-up until the window opens", () => {
		jest.useFakeTimers({ now: NOW });
		const s = known(0, "live", NOW);
		const view = render(s, { events: [{ type: "start" }], serverNow: () => Date.now() });
		expect(textOf(view.tree)).toContain("Winding up");
		expect(textOf(view.tree)).toContain("You're winding up left. Follow through, or flick it?");
		expect(tappable(view.tree, "volley-lane-L")).toBe(false);
		act(() => {
			jest.advanceTimersByTime(VOLLEY_TIMING.windupMs - 1);
		});
		expect(tappable(view.tree, "volley-lane-L")).toBe(false);
		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(textOf(view.tree)).toContain("Lock it in");
		expect(tappable(view.tree, "volley-lane-L")).toBe(true);
	});

	it("holds a live result sheet for exactly the last toss's beat", () => {
		jest.useFakeTimers({ now: NOW });
		// The board's own last beat ends on the same millisecond: the pigs wave
		// as the sheet arrives.
		let s = known(0);
		for (let ex = 0; ex < EXCHANGES - 1; ex++) {
			const attacker = attackerOf(s.firstAttacker, ex);
			s = apply(apply(s, attacker, { type: "lane", lane: "L" }).state, 1 - attacker, { type: "lane", lane: "R" }).state;
		}
		const lastTosser = attackerOf(s.firstAttacker, EXCHANGES - 1);
		const before = apply(s, 1 - lastTosser, { type: "lane", lane: "M" }).state;
		const view = render(before, { rev: 20, serverNow: () => Date.now() });
		const last = apply(before, lastTosser, { type: "lane", lane: "L" }, NOW);
		expect(last.state.phase).toBe("done");
		const finalView = mud_volley.view(last.state, 0);
		const delay = resultDelay(finalView, room(finalView, 21, last.state));
		expect(delay).toBe(VOLLEY_TIMING.settleMs + VOLLEY_TIMING.revealMs);
		view.rerender(last.state, last.events ?? [], 21);
		act(() => {
			jest.advanceTimersByTime(delay - 1);
		});
		expect(textOf(view.tree)).toContain("Watch the toss");
		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(textOf(view.tree)).toMatch(/Both pigs go home muddy\./);
		expect(has(view.tree, "volley-lock")).toBe(false);
	});

	it("holds an envelope's result sheet for the whole reel", () => {
		jest.useFakeTimers({ now: NOW });
		const one = apply(known(0, "async"), 0, { type: "envelope", tosses: ["L", "R", "M"], catches: ["M", "L", "R"] }).state;
		const both = apply(one, 1, { type: "envelope", tosses: ["M", "L", "R"], catches: ["L", "R", "M"] }).state;
		const opened = mud_volley.view(both, 0);
		const delay = resultDelay(opened, room(opened, 3, both));
		expect(delay).toBe(EXCHANGES * VOLLEY_TIMING.revealMs);
		// An envelope the room closed before it opened has no reel to wait for.
		const unopened = mud_volley.view(one, 0);
		expect(resultDelay(unopened, { ...room(unopened, 2, one), phase: "ended" })).toBe(0);
		// The reel's last toss ends on the same millisecond as the hold. Each
		// toss arms the next after it renders, so step one toss per act().
		const { tree } = render(both);
		for (let toss = 1; toss < EXCHANGES; toss++) {
			act(() => {
				jest.advanceTimersByTime(VOLLEY_TIMING.revealMs);
			});
		}
		act(() => {
			jest.advanceTimersByTime(VOLLEY_TIMING.revealMs - 1);
		});
		expect(Date.now() - NOW).toBe(delay - 1);
		expect(textOf(tree)).toContain(`toss ${EXCHANGES} of ${EXCHANGES}`);
		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(textOf(tree)).toMatch(/Both pigs go home muddy\./);
		expect(has(tree, "volley-reel-again")).toBe(true);
	});

	it("hands the match screen's clock the visible window, never the reveal or the grace", () => {
		const start = known(0, "live", NOW);
		const v0 = mud_volley.view(start, 0);
		expect(mudVolleyUi.clock?.(v0, room(v0, 1, start))).toEqual({
			opensAt: NOW + VOLLEY_TIMING.windupMs,
			closesAt: NOW + VOLLEY_TIMING.windupMs + VOLLEY_TIMING.commitMs,
		});
		const at = NOW + 4_000;
		const next = apply(apply(start, 0, { type: "lane", lane: "L" }, at).state, 1, { type: "lane", lane: "M" }, at).state;
		const v1 = mud_volley.view(next, 1);
		expect(mudVolleyUi.clock?.(v1, room(v1, 2, next))).toEqual({
			opensAt: at + VOLLEY_TIMING.settleMs + VOLLEY_TIMING.revealMs,
			closesAt: at + VOLLEY_TIMING.settleMs + VOLLEY_TIMING.revealMs + VOLLEY_TIMING.commitMs,
		});
		const env = known(0, "async", NOW);
		const ve = mud_volley.view(env, 0);
		expect(mudVolleyUi.clock?.(ve, room(ve, 1, env))).toBeNull();
		let done = start;
		for (let ex = 0; ex < EXCHANGES; ex++) {
			const attacker = attackerOf(done.firstAttacker, ex);
			done = apply(apply(done, attacker, { type: "lane", lane: "L" }).state, 1 - attacker, { type: "lane", lane: "R" }).state;
		}
		const vd = mud_volley.view(done, 0);
		expect(mudVolleyUi.clock?.(vd, room(vd, 9, done))).toBeNull();
	});

	it("draws the sealed envelope form, then seals all six at once", () => {
		const { tree, sent } = render(known(0, "async"));
		let text = textOf(tree);
		expect(text).toContain("Toss 1 of 3. You wind up left. Follow through, or flick it?");
		expect(text).toContain("Pick all six");
		for (const slot of ["T1", "T2", "T3", "C1", "C2", "C3"]) expect(text).toContain(slot);
		// Seat 0 tosses 0, 2, 4 (wind-ups L, R, M) and catches 1, 3, 5.
		const lanes: Lane[] = ["L", "M", "M", "R", "R", "L"];
		lanes.forEach((lane, i) => {
			press(tree, `volley-lane-${lane}`);
			if (i === 2) expect(textOf(tree)).toContain("Catch 1 of 3. They wind up middle. Where will you catch?");
		});
		text = textOf(tree);
		expect(text).toContain("Seal the envelope");
		expect(text).toContain("6/6");
		press(tree, "volley-seal");
		expect(sent).toHaveBeenCalledWith({ type: "envelope", tosses: ["L", "M", "M"], catches: ["R", "R", "L"] });
	});

	it("lets a pick in the review row be changed", () => {
		const { tree, sent } = render(known(0, "async"));
		(["L", "L", "L", "M", "M", "M"] as Lane[]).forEach((lane) => press(tree, `volley-lane-${lane}`));
		press(tree, "volley-review-1");
		expect(textOf(tree)).toContain("Toss 2 of 3.");
		press(tree, "volley-lane-R");
		press(tree, "volley-seal");
		expect(sent).toHaveBeenCalledWith({ type: "envelope", tosses: ["L", "R", "L"], catches: ["M", "M", "M"] });
	});

	it("tells a sealed pig to wait for the next pig", () => {
		const sealed = apply(known(0, "async"), 0, { type: "envelope", tosses: ["L", "M", "R"], catches: ["R", "M", "L"] }).state;
		const { tree } = render(sealed);
		const text = textOf(tree);
		expect(text).toContain(ENVELOPE_WAITING);
		expect(has(tree, "volley-review-row")).toBe(true);
		expect(text).not.toContain("Seal the envelope");
	});

	it("reels an opened envelope, skippably, to the final line", () => {
		jest.useFakeTimers();
		const one = apply(known(0, "async"), 0, { type: "envelope", tosses: ["L", "R", "M"], catches: ["M", "L", "R"] }).state;
		const both = apply(one, 1, { type: "envelope", tosses: ["M", "L", "R"], catches: ["L", "R", "M"] }).state;
		const { tree } = render(both);
		expect(textOf(tree)).toContain("Here it comes!");
		expect(textOf(tree)).toContain("toss 1 of 6");
		act(() => {
			jest.advanceTimersByTime(VOLLEY_TIMING.revealMs);
		});
		expect(textOf(tree)).toContain("toss 2 of 6");
		press(tree, "volley-reel-skip");
		const text = textOf(tree);
		expect(text).toMatch(/(You take it|Bandit takes it|A draw), \d to \d\. Both pigs go home muddy\./);
		expect(has(tree, "volley-reel-again")).toBe(true);
	});

	it("draws an ended live table: the last toss on the cards, the final line, no ticket", () => {
		let s = known(0);
		for (let ex = 0; ex < EXCHANGES; ex++) {
			const attacker = attackerOf(s.firstAttacker, ex);
			s = apply(apply(s, attacker, { type: "lane", lane: "L" }).state, 1 - attacker, { type: "lane", lane: "M" }).state;
		}
		const { tree } = render(s);
		const text = textOf(tree);
		expect(s.phase).toBe("done");
		expect(text).toMatch(/(You take it|Bandit takes it|A draw), \d to \d\. Both pigs go home muddy\./);
		expect(has(tree, "volley-lock")).toBe(false);
		// Seat 1 tossed the last one (left), you waited in the middle.
		expect(whoTags(tree)).toEqual({ L: "them", M: "you", R: "" });
		expect(host(tree.root, "volley-lane-M")?.props.accessibilityLabel).toBe("Middle lane, your catch");
		expect(host(tree.root, "volley-lane-L")?.props.accessibilityLabel).toBe("Left lane, their toss");
	});

	it("stops asking when the room closes the table early", () => {
		const live = render(apply(known(0), 1, { type: "lane", lane: "L" }).state, { ended: true });
		const text = textOf(live.tree);
		expect(text).toContain(TABLE_CLOSED);
		expect(text).not.toContain("Follow through");
		expect(has(live.tree, "volley-lock")).toBe(false);
		expect(has(live.tree, "volley-lane-cards")).toBe(false);
		expect(has(live.tree, "volley-rival-sealed")).toBe(false);
		const envelope = render(known(0, "async"), { ended: true });
		expect(textOf(envelope.tree)).toContain(TABLE_CLOSED);
		expect(has(envelope.tree, "volley-seal")).toBe(false);
	});

	it("gives the match screen a how-to, seat lines and a ledger", () => {
		expect(mudVolleyUi.seatStrip).toBe("compact");
		expect(mudVolleyUi.howTo.sentence).toBe(mud_volley.tagline);
		expect(mudVolleyUi.howTo.steps).toHaveLength(3);
		const open = mud_volley.view(known(0), 0);
		expect(mudVolleyUi.seatStatus?.(open, 1, room(open, 1, known(0)))).toBe("thinking");
		expect(mudVolleyUi.seatStatus?.(open, 0, room(open, 1, known(0)))).toBeNull();
		const mineLocked = mud_volley.view(apply(known(0), 0, { type: "lane", lane: "M" }).state, 0);
		expect(mudVolleyUi.seatStatus?.(mineLocked, 0, room(mineLocked, 2, known(0)))).toBe("locked in");
		const locked = apply(known(0), 1, { type: "lane", lane: "L" }).state;
		const v = mud_volley.view(locked, 0);
		expect(mudVolleyUi.seatStatus?.(v, 1, room(v, 2, locked))).toBe("locked in");
		let s = known(0);
		for (let ex = 0; ex < EXCHANGES; ex++) {
			const attacker = attackerOf(s.firstAttacker, ex);
			s = apply(apply(s, attacker, { type: "lane", lane: "L" }).state, 1 - attacker, { type: "lane", lane: ex === 5 ? "L" : "R" }).state;
		}
		const done = mud_volley.view(s, 0);
		expect(mudVolleyUi.seatStatus?.(done, 0, room(done, 9, s))).toBeNull();
		let ledger!: TestRenderer.ReactTestRenderer;
		act(() => {
			ledger = TestRenderer.create(
				<SafeAreaProvider initialMetrics={METRICS}>
					<MudVolleyResultDetail view={done} room={room(done, 9, s)} you={0} />
				</SafeAreaProvider>,
			);
		});
		mounted.push(ledger);
		// Wind-ups L M R L M R, every toss to L, every catch to R but the last.
		const text = textOf(ledger);
		expect(text).toContain("1. You followed through");
		expect(text).toContain("2. Bandit flicked it left");
		expect(text).toContain("4. Bandit followed through");
		expect(text).toContain("6. You caught it left");
		expect(count(text, "+2")).toBe(2);
		expect(count(text, "+1")).toBe(4);
	});
});

// ── Fitting the board to the height the match screen gives it ────────────────

const KINDS: VolleyBoardKind[] = ["live", "form", "waiting", "reel"];
const SCALES = [1, 1.3];
/** The compact-strip boards on the phones we design for (fit.ts BOARD_HEIGHTS). */
const PHONES: { name: string; width: number; height: number }[] = [
	{ name: "17 Pro", width: BOARD_WIDTHS.pro, height: BOARD_HEIGHTS.pro.compact },
	{ name: "17 Pro at accessibility-large", width: BOARD_WIDTHS.pro, height: BOARD_HEIGHTS.proAx.compact },
	{ name: "SE", width: BOARD_WIDTHS.se, height: BOARD_HEIGHTS.se.compact },
	{ name: "SE at accessibility-large", width: BOARD_WIDTHS.se, height: BOARD_HEIGHTS.seAx.compact },
	{ name: "SE at the design target", width: BOARD_WIDTHS.se, height: SE_DESIGN_HEIGHT },
];

/** The foot holds each kind's actions at their full size. */
function expectFullFoot(kind: VolleyBoardKind, plan: ReturnType<typeof volleyPlan>) {
	if (kind !== "waiting") {
		expect(plan.card).not.toBeNull();
		expect(plan.card?.height ?? 0).toBeGreaterThanOrEqual(TAP_MIN);
	}
	if (kind === "live" || kind === "form") expect(plan.ticket).toBe(TICKET_SLOT);
	if (kind === "form" || kind === "waiting") expect(plan.review).toBeGreaterThanOrEqual(TAP_MIN);
	if (kind === "reel") expect(plan.link).toBeGreaterThanOrEqual(TAP_MIN);
}

describe("mud volley board · fits the height it is given", () => {
	afterEach(() => {
		act(() => {
			while (mounted.length > 0) mounted.pop()?.unmount();
		});
	});

	it("asks the match screen for its whole height", () => {
		expect(mudVolleyUi.fillsHeight).toBe(true);
	});

	it("draws today's pasture exactly at its full height", () => {
		expect(SCENE_H).toBe(204);
		expect(pastureGeometry()).toEqual(pastureGeometry(SCENE_H));
		expect(pastureGeometry(SCENE_H)).toMatchObject({
			sceneH: 204,
			pigBox: 116,
			pigTop: 14,
			groundY: 130,
			stageScale: 116 / 300,
			shadowW: 58,
			shadowH: 8,
			grassTop: 106,
			puddleTop: 132,
			puddleH: 64,
			postW: 40,
			postH: 50,
			postTop: 139,
			arcSize: 40,
			arcHang: 8,
			ball: 28,
			held: 24,
			heldLift: 8,
			mudMark: 22,
			arcApex: 8,
			sealedTop: 4,
			sealedRight: 92,
			landing: 56,
			emptySeat: 60,
			emptyFace: 40,
		});
		// A shorter scene is the same drawing, smaller: everything stays inside it.
		const short = pastureGeometry(PASTURE_MIN);
		expect(short.pigTop + short.pigBox).toBeLessThan(short.sceneH);
		expect(short.postTop + short.postH).toBeLessThanOrEqual(short.puddleTop + short.puddleH);
		expect(short.pigBox / short.sceneH).toBeCloseTo(116 / 204);
	});

	describe.each(PHONES)("on the $name ($height pt)", ({ height }) => {
		it.each(KINDS.flatMap((kind) => SCALES.map((s) => [kind, s] as const)))("plans %s at text scale %s with the foot whole and everything inside", (kind, s) => {
			const plan = volleyPlan({ kind, height, s });
			expect(plan.height).toBe(height);
			// Everything fits: the planned rows, the gap, and the pinned foot.
			expect(plan.top + plan.gap + plan.foot).toBeLessThanOrEqual(height);
			// The foot's top edge is inside the board, below the planned rows.
			expect(height - plan.foot).toBeGreaterThanOrEqual(plan.top + plan.gap);
			expectFullFoot(kind, plan);
			if (plan.card && plan.card.art > 0) {
				expect(plan.card.art).toBeGreaterThanOrEqual(CARD_ART_MIN);
				expect(plan.card.art).toBeLessThanOrEqual(CARD_ART_MAX);
			}
			// A live table always has its pasture, however small the phone.
			if (kind === "live" || kind === "reel") expect(plan.sceneH).toBeGreaterThanOrEqual(PASTURE_MIN);
			if (plan.sceneH > 0) expect(plan.sceneH).toBeLessThanOrEqual(SCENE_H);
			// The picked card lifts into the gap above it, never into the hand line.
			expect(plan.gap).toBeGreaterThanOrEqual(CARD_LIFT);
		});
	});

	it("draws the 17 Pro's live board at full size, on snug gaps", () => {
		// The 17 Pro's board is 8pt short of the roomy gaps: the air gives way
		// before the pasture or the cards' art does.
		const plan = volleyPlan({ kind: "live", height: BOARD_HEIGHTS.pro.compact, s: 1 });
		expect(plan.sceneH).toBe(SCENE_H);
		expect(plan.card?.art).toBe(CARD_ART_MAX);
		expect(plan.gap).toBe(SPACE.sm);
		// With a little more room the roomy gaps come back.
		expect(volleyPlan({ kind: "live", height: BOARD_HEIGHTS.pro.compact + 16, s: 1 }).gap).toBe(SPACE.md);
	});

	it.each(KINDS.flatMap((kind) => SCALES.map((s) => [kind, s] as const)))("keeps %s whole from its floor to a tall phone (text scale %s)", (kind, s) => {
		// The floor: the shortest board that holds every row (the pasture hidden).
		const least = volleyPlan({ kind, height: 0, s });
		const floor = least.top + least.gap + least.foot;
		expect(least.sceneH).toBe(0);
		for (let height = Math.ceil(floor); height <= 600; height += 10) {
			const plan = volleyPlan({ kind, height, s });
			expect(plan.top + plan.gap + plan.foot).toBeLessThanOrEqual(height);
			expectFullFoot(kind, plan);
		}
	});

	it("states its floors: the live cards and ticket fit from 251pt, the pasture from 323pt (364pt at the cap)", () => {
		const floor = (kind: VolleyBoardKind, s: number) => {
			const p = volleyPlan({ kind, height: 0, s });
			return p.top + p.gap + p.foot;
		};
		expect(floor("live", 1)).toBe(251);
		expect(floor("live", 1.3)).toBe(292);
		expect(volleyPlan({ kind: "live", height: 322, s: 1 }).sceneH).toBe(0);
		expect(volleyPlan({ kind: "live", height: 323, s: 1 }).sceneH).toBeGreaterThanOrEqual(PASTURE_MIN);
		expect(volleyPlan({ kind: "live", height: 364, s: 1.3 }).sceneH).toBeGreaterThanOrEqual(PASTURE_MIN);
	});

	it("draws the natural column until the match screen has measured the board", () => {
		const plan = volleyPlan({ kind: "live", s: 1 });
		expect(plan.height).toBeNull();
		expect(plan.sceneH).toBe(SCENE_H);
		expect(plan.card?.art).toBe(CARD_ART_MAX);
		const { tree } = render(known(0));
		expect(flatHeight(host(tree.root, "volley-board"))).toBeUndefined();
	});

	it.each(PHONES.slice(0, 3))("renders the live board on the $name: exactly its height, the cards and ticket pinned at its foot", ({ width, height }) => {
		// jest's font scale is 2, so the board renders at the 1.3 cap: the worst case.
		const plan = volleyPlan({ kind: "live", height, s: 1.3 });
		const { tree } = render(known(0), { width, height });
		const board = host(tree.root, "volley-board");
		const planned = host(tree.root, "volley-planned");
		const foot = host(tree.root, "volley-foot");
		if (!board || !planned || !foot) throw new Error("the board's frame is missing");
		expect(flatHeight(board)).toBe(height);
		// The planned region takes what the foot leaves and clips; it never pushes.
		expect(StyleSheet.flatten(planned.props.style)).toMatchObject({ flex: 1, minHeight: 0, overflow: "hidden" });
		expect(host(planned, "volley-pasture")).toBeDefined();
		expect(host(planned, "volley-lane-cards")).toBeUndefined();
		expect(host(planned, "volley-lock")).toBeUndefined();
		// The foot: the three cards and the ticket, at their planned size.
		expect(host(foot, "volley-lane-cards")).toBeDefined();
		expect(host(foot, "volley-lock")).toBeDefined();
		const slots = foot.children.filter((c): c is TestRenderer.ReactTestInstance => typeof c !== "string");
		const footH = slots.reduce((sum, slot) => sum + (flatHeight(slot) ?? 0), 0) + plan.gap * (slots.length - 1);
		expect(footH).toBe(plan.foot);
		expect(footH).toBeLessThanOrEqual(height);
		expect(height - footH - plan.gap).toBeGreaterThanOrEqual(plan.top);
		expect(flatHeight(host(foot, "volley-lane-cards"))).toBe(plan.card?.height);
		for (const lane of ["L", "M", "R"] as Lane[]) expect(flatHeight(host(foot, `volley-lane-${lane}`))).toBe(plan.card?.height);
	});

	it("keeps one card height picking and revealing, so nothing jumps when a toss lands", () => {
		jest.useFakeTimers({ now: NOW });
		const height = BOARD_HEIGHTS.se.compact;
		const plan = volleyPlan({ kind: "live", height, s: 1.3 });
		const first = apply(known(0), 1, { type: "lane", lane: "M" }).state;
		const view = render(first, { rev: 4, serverNow: () => Date.now(), width: BOARD_WIDTHS.se, height });
		expect(flatHeight(host(view.tree.root, "volley-lane-L"))).toBe(plan.card?.height);
		const resolved = apply(first, 0, { type: "lane", lane: "L" });
		view.rerender(resolved.state, resolved.events ?? [], 5);
		act(() => {
			jest.advanceTimersByTime(VOLLEY_TIMING.settleMs + VOLLEY_TIMING.arcMs);
		});
		expect(whoTags(view.tree)).toEqual({ L: "you", M: "them", R: "" });
		for (const lane of ["L", "M", "R"] as Lane[]) expect(flatHeight(host(view.tree.root, `volley-lane-${lane}`))).toBe(plan.card?.height);
		jest.useRealTimers();
	});

	it("pins the envelope's cards, review row and Seal ticket on the SE", () => {
		const height = BOARD_HEIGHTS.se.compact;
		const { tree } = render(known(0, "async"), { width: BOARD_WIDTHS.se, height });
		const foot = host(tree.root, "volley-foot");
		if (!foot) throw new Error("no foot");
		expect(flatHeight(host(tree.root, "volley-envelope-form"))).toBe(height);
		expect(host(foot, "volley-lane-cards")).toBeDefined();
		expect(host(foot, "volley-review-row")).toBeDefined();
		expect(host(foot, "volley-seal")).toBeDefined();
		expect(flatHeight(host(foot, "volley-review-row"))).toBeGreaterThanOrEqual(TAP_MIN);
	});

	it("pins the reel's cards and its skip link on the SE", () => {
		const height = BOARD_HEIGHTS.se.compact;
		const one = apply(known(0, "async"), 0, { type: "envelope", tosses: ["L", "R", "M"], catches: ["M", "L", "R"] }).state;
		const both = apply(one, 1, { type: "envelope", tosses: ["M", "L", "R"], catches: ["L", "R", "M"] }).state;
		const { tree } = render(both, { width: BOARD_WIDTHS.se, height });
		const foot = host(tree.root, "volley-foot");
		if (!foot) throw new Error("no foot");
		expect(flatHeight(host(tree.root, "volley-envelope-reel"))).toBe(height);
		expect(host(foot, "volley-lane-cards")).toBeDefined();
		expect(host(foot, "volley-reel-skip")).toBeDefined();
	});
});

describe("mud volley board · whose lane it was", () => {
	afterEach(() => {
		act(() => {
			while (mounted.length > 0) mounted.pop()?.unmount();
		});
	});

	it("tags a catch 'both': the two pigs picked the same lane", () => {
		let s = known(0);
		for (let ex = 0; ex < EXCHANGES; ex++) {
			const attacker = attackerOf(s.firstAttacker, ex);
			s = apply(apply(s, attacker, { type: "lane", lane: "L" }).state, 1 - attacker, { type: "lane", lane: ex === 5 ? "L" : "R" }).state;
		}
		const { tree } = render(s);
		expect(whoTags(tree)).toEqual({ L: "both", M: "", R: "" });
		// Bandit tossed the last one; you caught it.
		expect(host(tree.root, "volley-lane-L")?.props.accessibilityLabel).toBe("Left lane, your catch, their toss");
	});

	it("says it in one short word that fits a lane card on the SE at the text cap", () => {
		// A card on the SE: a third of the row less its two gaps, then its heavy
		// outline and its padding; the tag adds its own padding and thin outline.
		const card = (BOARD_WIDTHS.se - SPACE.sm * 2) / 3;
		const inner = card - BORDER.heavy * 2 - SPACE.xxs * 2;
		for (const word of Object.values(WHO_WORD)) {
			expect(word).toMatch(/^[a-z]+$/);
			expect(widthFor(word, "kickerPillSm", 1.3) + SPACE.sm * 2 + BORDER.thin * 2).toBeLessThanOrEqual(inner);
		}
		// The old two-word tags did not fit, which is why they truncated.
		expect(widthFor("their catch", "kickerPillSm", 1.3) + SPACE.sm * 2 + BORDER.thin * 2).toBeGreaterThan(inner);
	});
});

