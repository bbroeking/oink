// The Snout Says board (components/play/games/snout_says): a render smoke
// test for each seat's view, driven by real rule states.
//   • the Guesser waits on bubbles during the clue beat (spread not
//     tappable), then one tap is one guess; dimmed and fogged tiles never
//     take a tap, and nothing takes one while an action is in flight
//   • a Nose sees the answer ringed, picks from the tray, then Show this one
//     sends the clue; afterwards the pick is final and the others' picks
//     show as "has picked", never as pictures
//   • the scored round plays as a reveal, then the next beat comes back
//   • the ended table shows the band line; the result ledger names no seat
//   • the copy: prompts, bands, outcome words, seat status lines
//   • the seat strip's pigs react: a pick nods, a tear giggles, the table
//     answers a scored round together (never sad)
//   • the clue bubble floats over its own Nose's pig (a seal while hidden,
//     the picture once it lands, a tear when two Noses agree) and the board
//     keeps no clue row of its own; the clock shows only the window a pig
//     can act in; the result sheet waits for the last reveal
//   • the board fits the height the match screen gives it: on every phone we
//     design for, at both text sizes, the taps that answer a turn (the
//     spread, the tray, Show this one) sit inside the height at TAP_MIN,
//     and a tile too short for its name keeps the name for VoiceOver
import React from "react";
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { StyleSheet } from "react-native";

import { SNOUT_SAYS_TUNING, snout_says, type SnoutSaysState, type SnoutSaysView } from "@/multiplayer/games/snout_says/rules";
import type { PictureId } from "@/multiplayer/games/snout_says/deck";
import type { RoomResult, RoomSnapshot } from "@/multiplayer/protocol";
import { createRng } from "@/multiplayer/rng";
import type { GameEvent, Seat, StepContext } from "@/multiplayer/types";
import { TEST_LOOK } from "@/multiplayer/testkit";
import type { ActResult, BoardProps } from "@/components/play/types";
import { snoutSaysUi } from "@/components/play/games/snout_says";
import { REVEAL_MS, pipWords } from "@/components/play/games/snout_says/Board";
import { bandFor, guessPrompt, leftBand, listWords, outcomeLine, pictureArt, theName } from "@/components/play/games/snout_says/pictures";
import { cluesLine } from "@/components/play/games/snout_says/ResultDetail";
import { NOTHING_SAID } from "@/components/play/games/snout_says/Reveal";
import { PictureTile } from "@/components/play/games/snout_says/PictureTile";
import { GREAT_MINDS } from "@/components/play/games/snout_says/ClueBubble";
import {
	nosePlan,
	revealPlan,
	spreadPlan,
	tileFace,
	type NosePlan,
	type SpreadPlan,
} from "@/components/play/games/snout_says/layout";
import { BOARD_HEIGHTS, BOARD_WIDTHS, SE_DESIGN_HEIGHT, buttonSlot } from "@/components/play/games/fit";
import { TAP_MIN } from "@/constants/theme";
import { applyAction, createRoom, snapshotFor, startGame } from "@/multiplayer/engine";
import { testCards } from "@/multiplayer/testkit";

// jest.mock calls are hoisted above the imports by babel-jest.
jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
// Sentry starts a cleanup interval at import (via the ui barrel); keep it out.
jest.mock("@sentry/react-native", () => ({ captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(async () => {}),
	selectionAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
	NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const NOW = 1_700_000_000_000;
const NAMES = ["Rosie", "Clover", "Pip", "Bun"];
const SPREAD: PictureId[] = ["river_pebble", "blue_feather", "clover", "snail_shell", "brass_button", "wool_tuft", "red_berries", "pinecone", "old_key"];
const TARGET: PictureId = "red_berries";
const TRAY: PictureId[] = ["honeycomb", "marble", "tin_whistle", "acorn", "apple", "bag", "boom", "boot", "bow", "cap", "charm", "furnishing"];

function ctx(seed = "c", present = [true, true, true, true]): StepContext {
	return { now: NOW, rng: createRng(seed), pace: "live", present };
}

function known(seats: number): SnoutSaysState {
	const s = snout_says.setup({ seats, pace: "live", rng: createRng("board") });
	return { ...s, round: { ...s.round!, spread: SPREAD, target: TARGET, tray: TRAY } };
}

function step(state: SnoutSaysState, seat: Seat, type: "clue" | "guess", picture: PictureId): SnoutSaysState {
	const res = snout_says.apply(state, seat, { type, picture }, ctx(`${seat}${picture}`));
	if (!res.ok) throw new Error(res.error);
	return res.state;
}

function snapshot(state: SnoutSaysState, you: Seat, rev = 1, result: RoomResult | null = null): RoomSnapshot<SnoutSaysView> {
	const view = snout_says.view(state, you);
	return {
		roomId: "00000000-board",
		game: "snout_says",
		rulesVersion: 1,
		pace: "live",
		source: "queue",
		phase: result ? "ended" : "playing",
		seats: Array.from({ length: state.seats }, (_, seat) => ({ seat, userId: `u${seat}`, name: NAMES[seat], look: TEST_LOOK, connected: true, gone: false })),
		seatCount: state.seats,
		you,
		view,
		activeSeats: snout_says.activeSeats(state),
		deadline: NOW + 10_000,
		startsAt: null,
		rev,
		events: [],
		result,
		invite: null,
		rematch: null,
		host: null,
	};
}

type Props = BoardProps<SnoutSaysView>;

function props(state: SnoutSaysState, you: Seat, over: Partial<Props> = {}, rev = 1, result: RoomResult | null = null): Props {
	const room = snapshot(state, you, rev, result);
	return {
		view: room.view as SnoutSaysView,
		room,
		you,
		yourTurn: room.activeSeats.includes(you),
		act: jest.fn(async (): Promise<ActResult> => ({ ok: true })),
		pending: false,
		events: [],
		reduceMotion: true,
		width: 339,
		practice: false,
		...over,
	};
}

const Board = snoutSaysUi.Board;

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
	act(() => {
		while (mounted.length > 0) mounted.pop()?.unmount();
	});
});

function render(p: Props): ReactTestRenderer {
	let r!: ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(<Board {...p} />);
	});
	mounted.push(r);
	return r;
}

/** Host nodes only (a composite carrying the same testID comes first). */
function byId(root: ReactTestInstance, testID: string): ReactTestInstance[] {
	return root.findAll((n) => typeof n.type === "string" && n.props.testID === testID);
}

function has(root: ReactTestInstance, testID: string): boolean {
	return byId(root, testID).length > 0;
}

/** The press handler inside a tile / button, or null when it takes none. */
function pressOf(root: ReactTestInstance, testID: string): (() => void) | null {
	// From the outermost node carrying the testID: a Pressable's onPress lives
	// on the composite above the host view that repeats its testID.
	const [node] = root.findAll((n) => n.props.testID === testID);
	if (!node) throw new Error(`no ${testID}`);
	const pressable = node.findAll((n) => typeof n.props.onPress === "function" && !n.props.disabled);
	return pressable.length > 0 ? pressable[0].props.onPress : null;
}

function textOf(root: ReactTestInstance): string {
	return root
		.findAll((n) => String(n.type) === "Text")
		.map((n) => (n.children as unknown[]).filter((c) => typeof c === "string").join(""))
		.join(" | ");
}

describe("the Guesser's board", () => {
	it("waits on the Noses during the clue beat, without taking a tap", () => {
		const s = step(known(3), 1, "clue", "apple");
		const r = render(props(s, 0));
		expect(has(r.root, "snout-board-guesser")).toBe(true);
		expect(textOf(r.root)).toContain("Clover and Pip are picking pictures for one of these.");
		// The clues live over the pigs (seatBubble), never in a row on the board.
		expect(has(r.root, "snout-clue-row")).toBe(false);
		expect(textOf(r.root)).not.toContain("apple");
		for (const p of SPREAD) expect(pressOf(r.root, `snout-spread-${p}`)).toBeNull();
	});

	it("reads the clue, and one tap guesses", async () => {
		const s = step(known(2), 1, "clue", "apple");
		const p = props(s, 0);
		const r = render(p);
		expect(textOf(r.root)).toContain("which one reminds Clover of an apple?");
		expect(byId(r.root, "snout-pips")[0].props.accessibilityLabel).toBe("two guesses");
		const tap = pressOf(r.root, "snout-spread-pinecone");
		expect(tap).not.toBeNull();
		await act(async () => {
			tap?.();
		});
		expect(p.act).toHaveBeenCalledWith({ type: "guess", picture: "pinecone" });
		// The tapped tile is lifted and nothing else takes a tap until the
		// next revision arrives.
		expect(pressOf(r.root, "snout-spread-clover")).toBeNull();
	});

	it("dims a wrong tap and fogs the free sniff, and neither takes a tap", () => {
		const fogged = step(step(known(3), 1, "clue", "apple"), 2, "clue", "apple");
		const once = step(fogged, 0, "guess", fogged.round!.spread.find((x) => x !== TARGET && !fogged.round!.sniffed.includes(x)) as PictureId);
		const r = render(props(once, 0));
		expect(textOf(r.root)).toContain("nothing landed, so three tiles fogged over.");
		expect(byId(r.root, "snout-pips")[0].props.accessibilityLabel).toBe("one guess left");
		for (const p of once.round!.dimmed) expect(pressOf(r.root, `snout-spread-${p}`)).toBeNull();
		expect(pressOf(r.root, `snout-spread-${TARGET}`)).not.toBeNull();
	});

	it("takes no tap while an action is in flight or when it is not its move", () => {
		const s = step(known(2), 1, "clue", "apple");
		const r = render(props(s, 0, { pending: true }));
		expect(pressOf(r.root, "snout-spread-pinecone")).toBeNull();
		const r2 = render(props(s, 0, { yourTurn: false }));
		expect(pressOf(r2.root, "snout-spread-pinecone")).toBeNull();
	});
});

describe("a Nose's board", () => {
	it("rings the answer, picks from the tray, then shows the clue", async () => {
		const p = props(known(3), 1);
		const r = render(p);
		expect(has(r.root, "snout-board-nose")).toBe(true);
		expect(textOf(r.root)).toContain("the red berries");
		const show = () => byId(r.root, "snout-show")[0];
		expect(pressOf(r.root, "snout-show")).toBeNull();
		await act(async () => {
			pressOf(r.root, "snout-tray-apple")?.();
		});
		expect(byId(r.root, "snout-tray-apple")[0].findAll((n) => n.props.accessibilityState?.selected === true).length).toBeGreaterThan(0);
		expect(show().props.accessibilityLabel).toBe("Show the apple");
		await act(async () => {
			pressOf(r.root, "snout-show")?.();
		});
		expect(p.act).toHaveBeenCalledWith({ type: "clue", picture: "apple" });
	});

	it("keeps a shown clue final and shows only whose picks are in", () => {
		const s = step(step(known(4), 1, "clue", "apple"), 2, "clue", "bow");
		const r = render(props(s, 1));
		expect(has(r.root, "snout-shown")).toBe(true);
		expect(textOf(r.root)).toContain("you showed the apple. it's final.");
		expect(byId(r.root, "snout-others")[0].props.children).toBe("Pip has picked · Bun is still thinking");
		expect(textOf(r.root)).not.toContain("pink bow");
		for (const p of TRAY) expect(pressOf(r.root, `snout-tray-${p}`)).toBeNull();
	});

	it("watches the guess with the answer ringed", () => {
		const s = step(step(known(3), 1, "clue", "apple"), 2, "clue", "honeycomb");
		const r = render(props(s, 2));
		expect(has(r.root, "snout-board-nose-watching")).toBe(true);
		expect(textOf(r.root)).toContain("Rosie is guessing. your honeycomb landed.");
		expect(byId(r.root, `snout-spread-${TARGET}`)[0].findAll((n) => n.props.accessibilityLabel === "red berries, the answer").length).toBeGreaterThan(0);
		for (const p of SPREAD) expect(pressOf(r.root, `snout-spread-${p}`)).toBeNull();
	});
});

describe("the reveal", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it("plays the scored round, then hands back to the next beat", () => {
		const ready = step(known(2), 1, "clue", "apple");
		const r = render(props(ready, 1));
		expect(has(r.root, "snout-board-nose-watching")).toBe(true);
		const scored = step(ready, 0, "guess", TARGET);
		act(() => {
			r.update(<Board {...props(scored, 1, {}, 2)} />);
		});
		expect(has(r.root, "snout-board-reveal")).toBe(true);
		expect(byId(r.root, "snout-outcome")[0].props.children).toBe("knew");
		expect(byId(r.root, "snout-tally")[0].props.children).toBe("2 of 12 so far");
		act(() => {
			jest.advanceTimersByTime(REVEAL_MS);
		});
		expect(has(r.root, "snout-board-reveal")).toBe(false);
		expect(has(r.root, "snout-board-guesser")).toBe(true);
	});

	it("moves on early on a tap, and never replays on a mid-game mount", () => {
		const scored = step(step(known(2), 1, "clue", "apple"), 0, "guess", TARGET);
		const mounted = render(props(scored, 0));
		expect(has(mounted.root, "snout-board-reveal")).toBe(false);
		const r = render(props(step(known(2), 1, "clue", "apple"), 0));
		act(() => {
			r.update(<Board {...props(scored, 0, {}, 2)} />);
		});
		act(() => {
			pressOf(r.root, "snout-reveal")?.();
		});
		expect(has(r.root, "snout-board-reveal")).toBe(false);
	});

	it("animates without crashing when motion is allowed", () => {
		const ready = step(known(3), 1, "clue", "apple");
		const r = render(props(ready, 0, { reduceMotion: false }));
		const closed = step(ready, 2, "clue", "apple");
		act(() => {
			r.update(<Board {...props(closed, 0, { reduceMotion: false }, 2)} />);
		});
		const scored = step(step(closed, 0, "guess", "clover"), 0, "guess", TARGET);
		act(() => {
			r.update(<Board {...props(scored, 0, { reduceMotion: false }, 3)} />);
		});
		expect(byId(r.root, "snout-outcome")[0].props.children).toBe("nearly");
		act(() => {
			jest.advanceTimersByTime(REVEAL_MS);
		});
		expect(has(r.root, "snout-board-reveal")).toBe(false);
	});
});

describe("the end", () => {
	function finished(): SnoutSaysState {
		let s = known(2);
		while (s.phase !== "over") {
			const r = s.round!;
			if (s.phase === "clue") s = step(s, r.noses[0], "clue", r.tray[0]);
			else s = step(s, r.guesser, "guess", r.target);
		}
		return s;
	}

	it("shows the last round and the band line", () => {
		const s = finished();
		const result: RoomResult = { kind: "coop", winners: [0, 1], scores: [12, 12], success: true, summary: "12 of 12", reason: "complete" };
		const r = render(props(s, 0, {}, 1, result));
		expect(has(r.root, "snout-board-ended")).toBe(true);
		expect(textOf(r.root)).toContain("One language, no words.");
		expect(textOf(r.root)).toContain("12 of 12. snout says: again?");
	});

	it("lists every round in the ledger, naming no seat", () => {
		const s = finished();
		const p = props(s, 1);
		const Detail = snoutSaysUi.ResultDetail!;
		let r!: ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(<Detail view={p.view} room={p.room} you={1} />);
		});
		mounted.push(r);
		for (let i = 0; i < 6; i++) expect(has(r.root, `snout-ledger-${i}`)).toBe(true);
		const words = textOf(r.root);
		for (const name of NAMES) expect(words).not.toContain(name);
		expect(words).toContain("knew");
	});

	it("tells a table that lost a pig it can finish another time", () => {
		const s = { ...known(3), phase: "over" as const, round: null, total: 3 };
		const result: RoomResult = { kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" };
		const r = render(props(s, 0, {}, 1, result));
		expect(textOf(r.root)).toContain("We'll finish this one another time.");
	});
});

describe("the copy", () => {
	it("prompts by how many clues landed", () => {
		expect(guessPrompt(["apple"], null)).toBe("which one reminds them of an apple?");
		expect(guessPrompt(["red_berries"], "Clover")).toBe("which one reminds Clover of some red berries?");
		expect(guessPrompt(["apple", "furnishing"], null)).toBe("an apple and a barn lantern. which one do they mean?");
		expect(guessPrompt([], null)).toBe("nothing landed, so three tiles fogged over.");
	});

	it("bands the total warmly, live and by post", () => {
		expect(bandFor(11, 12).title).toBe("One language, no words.");
		expect(bandFor(7, 12)).toEqual({ title: "Most of them landed.", line: "7 of 12. the misses were the funny part." });
		expect(bandFor(2, 12).title).toBe("A few landed.");
		expect(bandFor(0, 12).line).toBe("0 of 12. that was a strange tray.");
		expect(bandFor(5, 6).title).toBe("One language, no words.");
		expect(bandFor(3, 6).title).toBe("Most of them landed.");
		expect(leftBand(4).line).toBe("4 so far.");
	});

	it("says each outcome without naming anyone", () => {
		expect(outcomeLine({ outcome: "knew", score: 2 })).toBe("a nose that knew. +2");
		expect(outcomeLine({ outcome: "nearly", score: 1 })).toBe("on the second sniff. +1");
		expect(outcomeLine({ outcome: "got_away", score: 0 })).toBe("that one got away.");
		expect(outcomeLine({ outcome: "mud", score: 0 })).toBe("no guess this round.");
		expect(cluesLine({ clues: [], cancelled: ["acorn"] })).toBe("great minds: acorn tore away");
	});

	it("puts a short line under each pig, never a picture before the clue beat closes", () => {
		const status = snoutSaysUi.seatStatus!;
		const s = step(known(3), 1, "clue", "apple");
		const room = snapshot(s, 0);
		const v = room.view as SnoutSaysView;
		// A picked Nose's line goes quiet: the seal over its pig says it.
		expect([0, 1, 2].map((seat) => status(v, seat, room))).toEqual(["guesser", null, "thinking"]);
		const closed = step(s, 2, "clue", "bow");
		const v2 = snout_says.view(closed, 0);
		expect([0, 1, 2].map((seat) => status(v2, seat, room))).toEqual(["guessing", null, null]);
		const over = snout_says.view({ ...s, phase: "over", round: null }, 0);
		expect(status(over, 0, room)).toBeNull();
	});
});

describe("the pigs in the seat strip", () => {
	const reactions = snoutSaysUi.reactions!;

	function eventsOf(state: SnoutSaysState, seat: Seat, type: "clue" | "guess", picture: PictureId): { state: SnoutSaysState; events: GameEvent[] } {
		const res = snout_says.apply(state, seat, { type, picture }, ctx(`${seat}${picture}`));
		if (!res.ok) throw new Error(res.error);
		return { state: res.state, events: res.events ?? [] };
	}

	it("nods when a Nose picks, and says nothing about what", () => {
		const s = known(3);
		const { events } = eventsOf(s, 1, "clue", "apple");
		expect(reactions(events, snapshot(s, 0))).toEqual({ 1: { kind: "jump" } });
	});

	it("giggles for two Noses who thought alike", () => {
		const one = eventsOf(known(3), 1, "clue", "apple").state;
		const { events } = eventsOf(one, 2, "clue", "apple");
		expect(reactions(events, snapshot(one, 0))).toEqual({ 1: { kind: "surprise" }, 2: { kind: "surprise" } });
	});

	it("answers a scored round as one table: happy, jump, or a hiccup, never sad", () => {
		const ready = eventsOf(known(3), 1, "clue", "apple").state;
		const both = eventsOf(ready, 2, "clue", "bow").state;
		const room = snapshot(both, 0);
		const knew = eventsOf(both, 0, "guess", TARGET).events;
		expect(reactions(knew, room)).toEqual({ 0: { kind: "happy" }, 1: { kind: "happy" }, 2: { kind: "happy" } });
		const missed = eventsOf(both, 0, "guess", "clover");
		expect(reactions(missed.events, room)).toEqual({});
		expect(reactions(eventsOf(missed.state, 0, "guess", TARGET).events, room)).toEqual({ 0: { kind: "jump" }, 1: { kind: "jump" }, 2: { kind: "jump" } });
		const away = eventsOf(missed.state, 0, "guess", "pinecone").events;
		const hiccup = reactions(away, room);
		expect(Object.values(hiccup)).toEqual([{ kind: "surprise" }, { kind: "surprise" }, { kind: "surprise" }]);
		for (const r of Object.values(hiccup)) expect(r?.mood).toBeUndefined();
	});

	it("leaves out a pig that has left, and ignores the engine's own cues and junk", () => {
		const both = eventsOf(eventsOf(known(3), 1, "clue", "apple").state, 2, "clue", "bow").state;
		const room = snapshot(both, 0);
		const gone = { ...room, seats: room.seats.map((s) => (s.seat === 2 ? { ...s, gone: true } : s)) };
		expect(reactions(eventsOf(both, 0, "guess", TARGET).events, gone)).toEqual({ 0: { kind: "happy" }, 1: { kind: "happy" } });
		const noise: GameEvent[] = [{ type: "start" }, { type: "timeout", seat: 1 }, { type: "gone", seat: 2 }, { type: "picked" }, { type: "cluesRevealed", said: "x" }, { type: "roundScored" }];
		expect(reactions(noise, room)).toEqual({});
	});
});

describe("the clue bubble over each pig", () => {
	const Bubble = snoutSaysUi.seatBubble!;

	function bubbles(state: SnoutSaysState, viewer: Seat, opts: { motion?: boolean } = {}): ReactTestRenderer {
		const room = snapshot(state, viewer);
		let r!: ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(
				<>
					{Array.from({ length: state.seats }, (_, seat) => (
						<Bubble key={seat} view={room.view as SnoutSaysView} seat={seat} room={room} />
					))}
				</>,
			);
		});
		mounted.push(r);
		if (opts.motion) {
			act(() => {
				jest.advanceTimersByTime(2_000);
			});
		}
		return r;
	}

	function labelOf(r: ReactTestRenderer, seat: Seat): string | null {
		const [node] = byId(r.root, `snout-seat-bubble-${seat}`);
		return node ? (node.props.accessibilityLabel as string) : null;
	}

	it("seals a Nose's pick while it is hidden, and says nothing over a Nose still thinking or the Guesser", () => {
		const s = step(known(3), 1, "clue", "apple");
		const r = bubbles(s, 0);
		expect(labelOf(r, 0)).toBeNull();
		expect(labelOf(r, 1)).toBe("Clover has picked");
		expect(labelOf(r, 2)).toBeNull();
		expect(textOf(r.root)).toContain("picked");
		expect(textOf(r.root)).not.toContain("apple");
		// The pig who picked sees its own seal the same way.
		expect(labelOf(bubbles(s, 1), 1)).toBe("You have picked");
	});

	it("floats each landed clue over its own Nose", () => {
		const s = step(step(known(3), 1, "clue", "apple"), 2, "clue", "bow");
		const r = bubbles(s, 0);
		expect(labelOf(r, 1)).toBe("Clover showed the apple");
		expect(labelOf(r, 2)).toBe("Pip showed the pink bow");
		expect(labelOf(r, 0)).toBeNull();
	});

	it("tears away a picture two Noses both showed", () => {
		const s = step(step(step(known(4), 1, "clue", "acorn"), 2, "clue", "bow"), 3, "clue", "acorn");
		const r = bubbles(s, 0);
		expect(labelOf(r, 1)).toContain("Great minds: it tore away");
		expect(labelOf(r, 3)).toContain("Great minds: it tore away");
		expect(labelOf(r, 2)).toBe("Pip showed the pink bow");
		expect(textOf(r.root)).toContain("great minds");
	});

	it("plays the drop-in and the tear with motion on, and clears when the game is over", () => {
		jest.useFakeTimers();
		try {
			const s = step(step(step(known(4), 1, "clue", "acorn"), 2, "clue", "bow"), 3, "clue", "acorn");
			const r = bubbles(s, 0, { motion: true });
			expect(labelOf(r, 2)).toBe("Pip showed the pink bow");
			const over = bubbles({ ...s, phase: "over", round: null }, 0);
			for (const seat of [0, 1, 2, 3]) expect(labelOf(over, seat)).toBeNull();
		} finally {
			jest.useRealTimers();
		}
	});
});

describe("the match screen's clock and result sheet", () => {
	const clock = snoutSaysUi.clock!;

	function room(pace: "live" | "async") {
		const created = createRoom({ roomId: "00000000-clock", game: snout_says, pace, source: "queue", seatCount: 2, seats: testCards(2), seed: "clock", now: NOW });
		return startGame({ ...created, phase: "starting" }, snout_says, NOW);
	}

	function windowOf(r: ReturnType<typeof room>, seat: Seat) {
		const snap = snapshotFor(r, snout_says, seat) as RoomSnapshot<SnoutSaysView>;
		return clock(snap.view as SnoutSaysView, snap);
	}

	it("shows only the window a pig can act in, never the reveal folded into the deadline", () => {
		let r = room("live");
		expect(windowOf(r, 0)).toEqual({ opensAt: NOW, closesAt: NOW + 10_000 });
		const g = () => r.game as SnoutSaysState;
		const ok = (res: ReturnType<typeof applyAction>) => {
			if (!res.ok) throw new Error(res.error);
			return res.room;
		};
		r = ok(applyAction(r, snout_says, 1, { type: "clue", picture: g().round!.tray[0] }, NOW + 1_000));
		expect(windowOf(r, 0)).toEqual({ opensAt: NOW + 1_000, closesAt: NOW + 11_000 });
		r = ok(applyAction(r, snout_says, 0, { type: "guess", picture: g().round!.target }, NOW + 2_000));
		// The next clue beat's deadline carries the 3 s reveal; the clock opens after it.
		expect(r.deadline).toBe(NOW + 2_000 + SNOUT_SAYS_TUNING.revealMs.live + 10_000);
		expect(windowOf(r, 0)).toEqual({ opensAt: NOW + 5_000, closesAt: NOW + 15_000 });
		// A Nose who answers inside the reveal: the Guesser's window still opens after it.
		r = ok(applyAction(r, snout_says, 0, { type: "clue", picture: g().round!.tray[0] }, NOW + 3_000));
		expect(windowOf(r, 1)).toEqual({ opensAt: NOW + 5_000, closesAt: NOW + 15_000 });
	});

	it("falls back to the room deadline by post and once the table is over", () => {
		const r = room("async");
		expect(windowOf(r, 0)).toBeNull();
		const live = snapshot(known(2), 0);
		expect(clock({ ...(live.view as SnoutSaysView), phase: "over" }, live)).toBeNull();
		expect(clock(live.view as SnoutSaysView, { ...live, deadline: null })).toBeNull();
	});

	it("holds the result sheet for the last reveal", () => {
		expect(snoutSaysUi.resultDelayMs).toBe(REVEAL_MS);
		expect(REVEAL_MS).toBe(3_000);
	});
});

// ── Fitting the height the match screen gives the board ─────────────────────

describe("the board fits the height it is given", () => {
	// The phones we design for (components/play/games/fit.ts): the board's
	// width and the height the match screen leaves under the clue sky.
	const MATRIX: [string, number, number][] = [
		["iPhone 17 Pro", BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.bubble],
		["iPhone 17 Pro at accessibility-large", BOARD_WIDTHS.pro, BOARD_HEIGHTS.proAx.bubble],
		["iPhone SE", BOARD_WIDTHS.se, BOARD_HEIGHTS.se.bubble],
		["iPhone SE at accessibility-large", BOARD_WIDTHS.se, BOARD_HEIGHTS.seAx.bubble],
		["iPhone SE, the design target", BOARD_WIDTHS.se, SE_DESIGN_HEIGHT],
	];
	const SCALES = [1, 1.3];
	// Below this the Guesser's three rows cannot all reach TAP_MIN, even with
	// one hand line and the hitSlop (196pt at the 1.3 cap).
	const FLOOR = 200;

	// The longest words each beat can say, so every reserve is the worst case.
	const SPREAD_NAMES = SPREAD.map((p) => pictureArt(p).short);
	const TRAY_NAMES = TRAY.map((p) => pictureArt(p).short);
	const guessing = (width: number, height: number | undefined, s: number) =>
		spreadPlan({
			width,
			height,
			s,
			line: guessPrompt(["apple", "furnishing", "tea"], null),
			pips: pipWords(1),
			tally: "round 6 of 6 · 12 of 12 so far",
			labels: SPREAD_NAMES,
		});
	const waiting = (width: number, height: number | undefined, s: number) =>
		spreadPlan({
			width,
			height,
			s,
			line: `${listWords(["Clover", "Pip", "Bun"])} are picking pictures for one of these.`,
			pips: pipWords(2),
			tally: "round 6 of 6 · 12 of 12 so far",
			labels: SPREAD_NAMES,
		});
	const watching = (width: number, height: number | undefined, s: number) =>
		spreadPlan({
			width,
			height,
			s,
			line: "Rosie is guessing. nothing landed, so three tiles fogged over.",
			pips: null,
			tally: "round 6 of 6 · 12 of 12 so far",
			labels: SPREAD_NAMES,
		});
	const nose = (width: number, height: number | undefined, s: number, others: string | null) =>
		nosePlan({
			width,
			height,
			s,
			title: theName("tea"),
			instruction: "show a picture that reminds you of it. Clover guesses.",
			others,
			labels: TRAY_NAMES,
		});
	const reveal = (width: number, height: number | undefined, s: number) =>
		revealPlan({ width, height, s, bubbles: ["snout stone", GREAT_MINDS, "bottle cap"], nothing: null, outcome: outcomeLine({ outcome: "nearly", score: 1 }) });
	const silentReveal = (width: number, height: number | undefined, s: number) =>
		revealPlan({ width, height, s, bubbles: [], nothing: NOTHING_SAID, outcome: outcomeLine({ outcome: "got_away", score: 0 }) });

	function expectSpreadFits(plan: SpreadPlan, height: number) {
		expect(plan.total).toBeLessThanOrEqual(height);
		expect(plan.footTop).toBeGreaterThanOrEqual(0);
		expect(plan.footTop + plan.gridH).toBeLessThanOrEqual(height);
		expect(plan.tileW).toBeGreaterThanOrEqual(TAP_MIN);
		// A tile's frame: its height plus the hitSlop it reaches into the gap.
		expect((plan.tileH ?? 0) + plan.hitSlop * 2).toBeGreaterThanOrEqual(TAP_MIN);
		expect(plan.hitSlop * 2).toBeLessThanOrEqual(plan.gridGap);
	}

	function expectNoseFits(plan: NosePlan, height: number, s: number) {
		expect(plan.total).toBeLessThanOrEqual(height);
		expect(plan.footTop).toBeGreaterThanOrEqual(0);
		expect(plan.footTop + plan.tray.h + plan.button).toBeLessThanOrEqual(height);
		expect(plan.button).toBe(buttonSlot("lg", s));
		expect(plan.tray.columns * plan.tray.rows).toBeGreaterThanOrEqual(TRAY.length);
		expect(plan.tray.tileW).toBeGreaterThanOrEqual(TAP_MIN);
		expect((plan.tray.tileH ?? 0) + plan.tray.hitSlop * 2).toBeGreaterThanOrEqual(TAP_MIN);
		expect(plan.tray.hitSlop * 2).toBeLessThanOrEqual(plan.tray.gap);
	}

	it.each(MATRIX)("plans every beat inside the height on the %s", (_phone, width, height) => {
		for (const s of SCALES) {
			expectSpreadFits(guessing(width, height, s), height);
			expectSpreadFits(waiting(width, height, s), height);
			expectSpreadFits(watching(width, height, s), height);
			expectNoseFits(nose(width, height, s, null), height, s);
			expectNoseFits(nose(width, height, s, "Pip has picked · Bun is still thinking"), height, s);
			expect(reveal(width, height, s).h).toBeLessThanOrEqual(height);
			expect(silentReveal(width, height, s).h).toBeLessThanOrEqual(height);
		}
	});

	it(`keeps every beat inside any height from ${FLOOR} to 600pt`, () => {
		for (const [, width] of MATRIX) {
			for (let height = FLOOR; height <= 600; height += 10) {
				for (const s of SCALES) {
					expectSpreadFits(guessing(width, height, s), height);
					expectSpreadFits(watching(width, height, s), height);
					expectNoseFits(nose(width, height, s, "Pip has picked · Bun is still thinking"), height, s);
					expect(reveal(width, height, s).h).toBeLessThanOrEqual(height);
					expect(silentReveal(width, height, s).h).toBeLessThanOrEqual(height);
				}
			}
		}
	});

	it("folds in order: a roomy board keeps the full answer card, a small one folds it, the smallest keeps a line", () => {
		const pro = nose(BOARD_WIDTHS.pro, BOARD_HEIGHTS.pro.bubble, 1, null);
		expect(pro.answer).toBe("grid");
		expect(pro.mini).toBe(40);
		expect(pro.instruction).toBe(true);
		const se = nose(BOARD_WIDTHS.se, BOARD_HEIGHTS.se.bubble, 1, null);
		expect(se.answer).toBe("row");
		const tiny = nose(BOARD_WIDTHS.se, BOARD_HEIGHTS.seAx.bubble, 1.3, null);
		expect(tiny.answer).toBe("line");
		// Roomy, the spread keeps its full tiles and their names.
		const roomy = spreadPlan({
			width: BOARD_WIDTHS.pro,
			height: BOARD_HEIGHTS.pro.bubble,
			s: 1,
			line: guessPrompt(["apple"], "Clover"),
			pips: pipWords(2),
			tally: "round 1 of 6 · 0 of 12 so far",
			labels: SPREAD_NAMES,
		});
		expect(roomy.tileH).toBe(96);
		expect(tileFace(roomy.tileW, roomy.tileH ?? 0, 1, roomy.labelLines).labelLines).toBeGreaterThan(0);
		// Unmeasured, every plan is the natural board.
		expect(guessing(BOARD_WIDTHS.se, undefined, 1).tileH).toBeUndefined();
		expect(nose(BOARD_WIDTHS.se, undefined, 1, null).tray.tileH).toBeUndefined();
	});

	// ── Drawn at a height (jest's font scale is 2: the 1.3 cap, the worst case)

	function flat(node: ReactTestInstance): Record<string, unknown> {
		return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
	}
	const num = (v: unknown) => (typeof v === "number" ? v : 0);

	/** A pinned stack's height: its own margin and padding, and every child's
	 *  height and top margin. */
	function stackHeight(node: ReactTestInstance): number {
		const own = flat(node);
		let h = num(own.marginTop) + num(own.paddingBottom);
		for (const child of node.children) {
			if (typeof child === "string") continue;
			const style = flat(child);
			expect(typeof style.height).toBe("number");
			h += num(style.height) + num(style.marginTop);
		}
		return h;
	}

	/** A fitted tile's drawn height (its sticker: the host carrying both a
	 *  height and the tile's inset, never the picture inside it) and the
	 *  hitSlop that extends its frame. */
	function tileBox(root: ReactTestInstance, testID: string): { height: number; slop: number } {
		const [outer] = byId(root, testID);
		const [sticker] = outer.findAll(
			(n) => typeof n.type === "string" && typeof flat(n).height === "number" && typeof flat(n).paddingVertical === "number",
		);
		const slopped = outer.findAll((n) => n.props.hitSlop !== undefined && n.props.hitSlop !== null)[0];
		return { height: num(flat(sticker).height), slop: slopped ? num(slopped.props.hitSlop.top) : 0 };
	}

	const DRAWN: [string, number, number][] = [MATRIX[0], MATRIX[2], MATRIX[3]];

	it.each(DRAWN)("draws the Guesser's spread inside the height on the %s", (_phone, width, height) => {
		const s = step(known(2), 1, "clue", "apple");
		const r = render(props(s, 0, { width, height }));
		const board = byId(r.root, "snout-board-guesser")[0];
		expect(flat(board).height).toBe(height);
		const foot = byId(r.root, "snout-foot")[0];
		expect(stackHeight(foot)).toBeLessThanOrEqual(height);
		for (const p of SPREAD) {
			const tile = tileBox(r.root, `snout-spread-${p}`);
			expect(tile.height + tile.slop * 2).toBeGreaterThanOrEqual(TAP_MIN);
			expect(pressOf(r.root, `snout-spread-${p}`)).not.toBeNull();
		}
		expect(has(foot, "snout-pips")).toBe(true);
	});

	it.each(DRAWN)("draws the Nose's tray and Show this one inside the height on the %s", async (_phone, width, height) => {
		const p = props(known(3), 1, { width, height });
		const r = render(p);
		const board = byId(r.root, "snout-board-nose")[0];
		expect(flat(board).height).toBe(height);
		const foot = byId(r.root, "snout-foot")[0];
		expect(stackHeight(foot)).toBeLessThanOrEqual(height);
		for (const picture of TRAY) {
			const tile = tileBox(r.root, `snout-tray-${picture}`);
			expect(tile.height + tile.slop * 2).toBeGreaterThanOrEqual(TAP_MIN);
		}
		expect(has(foot, "snout-show")).toBe(true);
		expect(flat(byId(foot, "snout-action")[0]).height).toBe(buttonSlot("lg", 1.3));
		// The answer is always on the board, whatever shape its card takes.
		expect(textOf(r.root)).toContain("the red berries");
		// And the tray still works at this size.
		await act(async () => {
			pressOf(r.root, "snout-tray-apple")?.();
		});
		await act(async () => {
			pressOf(r.root, "snout-show")?.();
		});
		expect(p.act).toHaveBeenCalledWith({ type: "clue", picture: "apple" });
	});

	it.each(DRAWN)("draws a Nose watching the guess inside the height on the %s", (_phone, width, height) => {
		const s = step(step(known(3), 1, "clue", "apple"), 2, "clue", "honeycomb");
		const r = render(props(s, 2, { width, height }));
		expect(flat(byId(r.root, "snout-board-nose-watching")[0]).height).toBe(height);
		expect(stackHeight(byId(r.root, "snout-foot")[0])).toBeLessThanOrEqual(height);
		expect(byId(r.root, "snout-spread-pinecone")).toHaveLength(1);
	});

	it("plays the reveal and shows the end inside the height on the smallest phone", () => {
		jest.useFakeTimers();
		try {
			const height = BOARD_HEIGHTS.seAx.bubble;
			const ready = step(known(2), 1, "clue", "apple");
			const r = render(props(ready, 1, { width: BOARD_WIDTHS.se, height }));
			act(() => {
				r.update(<Board {...props(step(ready, 0, "guess", TARGET), 1, { width: BOARD_WIDTHS.se, height }, 2)} />);
			});
			expect(flat(byId(r.root, "snout-board-reveal")[0]).height).toBe(height);
			expect(byId(r.root, "snout-outcome")[0].props.children).toBe("knew");
			const over = { ...known(2), phase: "over" as const, round: null, total: 3 };
			const ended = render(props(over, 0, { width: BOARD_WIDTHS.se, height }, 1, { kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" }));
			expect(flat(byId(ended.root, "snout-board-ended")[0]).height).toBe(height);
			expect(textOf(ended.root)).toContain("We'll finish this one another time.");
		} finally {
			jest.useRealTimers();
		}
	});

	it("drops a tile's name when the tile is too short for it, and keeps it for VoiceOver", () => {
		const tile = (height: number) => {
			let r!: ReactTestRenderer;
			act(() => {
				r = TestRenderer.create(
					<PictureTile id="honeycomb" size={96} height={height} label labelLines={1} reduceMotion onPress={() => {}} testID="tile" />,
				);
			});
			mounted.push(r);
			return r;
		};
		const short = tile(TAP_MIN);
		expect(byId(short.root, "tile-label")).toHaveLength(0);
		expect(short.root.findAll((n) => n.props.accessibilityLabel === "honeycomb chip").length).toBeGreaterThan(0);
		expect(tileFace(96, TAP_MIN, 1.3, 1).labelLines).toBe(0);
		const tall = tile(96);
		expect(byId(tall.root, "tile-label")).toHaveLength(1);
		expect(textOf(tall.root)).toContain("honeycomb");
	});

	it("tells the match screen it fills the height", () => {
		expect(snoutSaysUi.fillsHeight).toBe(true);
	});
});
