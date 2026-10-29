// The Draw panel's copy and the strip cell it feeds (spec:
// docs/design/2026-09-21-season-page-rewrite.md §1 and §2). Three lines that
// move, all yours: the balls, the odds off them, and the clock. Nothing here
// may name a standing, a streak, another pig or a herd.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("@/components/ui/Icon", () => ({
	Icon: () => null,
}));
jest.mock("@/components/ui/WaitingRosie", () => ({
	WaitingRosie: () => null,
}));

import {
	DrawPanel,
	drawCellTodo,
	drawCellValue,
	drumLines,
} from "@/components/season1/almanac/DrawPanel";
import { MONDAY_DRAW_TUNING, type MondayDrawState } from "@/utils/mondayDraw";

const METRICS = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// Friday, 2026-09-25 19:00 UTC — the turn is 2d 5h off.
const NOW = Date.parse("2026-09-25T19:00:00.000Z");
const NEXT_TURN = "2026-09-28T00:00:00.000Z";

function state(over: Partial<MondayDrawState> = {}): MondayDrawState {
	return {
		week: "20260914",
		eligible: true,
		drawn: false,
		amount: null,
		tier: null,
		balls: 7,
		cap: 21,
		rolls: null,
		purseOddsOneIn: 2,
		runningWeek: "20260921",
		runningBalls: 7,
		runningCap: 21,
		runningOddsOneIn: 2,
		nextTurnAt: NEXT_TURN,
		tuning: MONDAY_DRAW_TUNING,
		...over,
	};
}

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	const walk = (node: TestRenderer.ReactTestInstance | string) => {
		if (typeof node === "string") {
			out.push(node);
			return;
		}
		for (const child of node.children ?? []) walk(child);
	};
	walk(tree);
	return out.join("");
}

describe("drumLines — the three lines", () => {
	it("prints the spec's own line for a week in progress", () => {
		const l = drumLines(state(), NOW);
		expect(l.balls).toBe("7 of 21 balls this week");
		expect(l.odds).toBe("rare or better: 1 in 2");
		expect(l.turn).toBe("the drum turns in 2d 5h");
	});

	it("calls a full drum the perfect week, in the achievement's words", () => {
		expect(drumLines(state({ runningBalls: 21 }), NOW).balls).toBe("21 of 21 · every last feeding");
		expect(drumLines(state({ runningBalls: 25 }), NOW).balls).toBe("21 of 21 · every last feeding");
	});

	it("counts an empty week honestly and still quotes a one-ball spin", () => {
		const l = drumLines(state({ runningBalls: 0, runningOddsOneIn: 8 }), NOW);
		expect(l.balls).toBe("0 of 21 balls this week");
		expect(l.odds).toBe("rare or better: 1 in 8");
	});

	it("drops the `of N` when a stale server sent no cap", () => {
		expect(drumLines(state({ runningBalls: 1, runningCap: 0 }), NOW).balls).toBe("1 ball this week");
		expect(drumLines(state({ runningBalls: 3, runningCap: 0 }), NOW).balls).toBe("3 balls this week");
	});

	it("keeps the turn line a countdown — hours inside a day, the rhythm when it's due", () => {
		expect(drumLines(state(), Date.parse("2026-09-27T18:45:00.000Z")).turn).toBe(
			"the drum turns in 5h 15m",
		);
		expect(drumLines(state(), Date.parse("2026-09-27T23:50:00.000Z")).turn).toBe(
			"the drum turns in 10m",
		);
		// Past the turn, or with no time from the server: the weekly rhythm,
		// never a clock time the player would have to convert.
		expect(drumLines(state(), Date.parse("2026-09-28T00:10:00.000Z")).turn).toBe(
			"the drum turns once a week",
		);
		expect(drumLines(state({ nextTurnAt: null }), NOW).turn).toBe("the drum turns once a week");
		expect(drumLines(state({ nextTurnAt: "not a time" }), NOW).turn).toBe(
			"the drum turns once a week",
		);
	});

	it("never prints a server's time zone at the player", () => {
		for (const at of [NOW, Date.parse("2026-09-27T23:50:00.000Z"), Date.parse("2026-09-28T00:10:00.000Z")]) {
			expect(drumLines(state(), at).turn).not.toMatch(/UTC|00:00/);
		}
	});

	it("names exactly one day when the hours round out", () => {
		expect(drumLines(state(), Date.parse("2026-09-26T00:00:00.000Z")).turn).toBe(
			"the drum turns in 2d",
		);
	});

	it("says which face the purse wears", () => {
		expect(drumLines(state(), NOW).purse).toBe("draw");
		expect(drumLines(state(), NOW).purseLine).toBe("Draw your Monday purse");

		const drawn = drumLines(state({ drawn: true, amount: 60, tier: "good" }), NOW);
		expect(drawn.purse).toBe("drawn");
		expect(drawn.purseLine).toBe("Drawn · 60 tickles");

		const none = drumLines(state({ eligible: false, balls: 0, purseOddsOneIn: null }), NOW);
		expect(none.purse).toBe("none");
		expect(none.purseLine).toBe(
			"no purse this Monday · dig once this week and you're in Monday's drum",
		);
	});

	it("never names a standing, a streak, another pig or a herd", () => {
		for (const s of [
			state(),
			state({ drawn: true, amount: 400, tier: "jackpot" }),
			state({ eligible: false, balls: 0 }),
			state({ runningBalls: 21 }),
		]) {
			const l = drumLines(s, NOW);
			const all = `${l.balls} ${l.odds} ${l.turn} ${l.purseLine}`;
			expect(all).not.toMatch(/herd|sounder|crew|rank|streak|warmer|place|behind/i);
		}
	});
});

describe("drumLines — Leftovers (Season 2)", () => {
	it("prints no leftover when the drum holds none (Season 1 reads unchanged)", () => {
		expect(drumLines(state(), NOW).balls).toBe("7 of 21 balls this week");
		expect(drumLines(state({ runningLeftoverBalls: 0 }), NOW).balls).toBe("7 of 21 balls this week");
	});

	it("names a leftover beside the count, never folded into it", () => {
		expect(drumLines(state({ runningLeftoverBalls: 1 }), NOW).balls).toBe(
			"7 of 21 balls this week (+1 leftover)",
		);
		expect(drumLines(state({ runningBalls: 21, runningLeftoverBalls: 1 }), NOW).balls).toBe(
			"21 of 21 · every last feeding (+1 leftover)",
		);
		expect(drumLines(state({ runningCap: 0, runningLeftoverBalls: 1 }), NOW).balls).toBe(
			"7 balls this week (+1 leftover)",
		);
	});

	it("quotes the server's odds, which count the leftover", () => {
		const l = drumLines(state({ runningBalls: 1, runningLeftoverBalls: 1, runningOddsOneIn: 4 }), NOW);
		expect(l.balls).toBe("1 of 21 balls this week (+1 leftover)");
		expect(l.odds).toBe("rare or better: 1 in 4");
	});
});

describe("the strip's Draw cell", () => {
	it("is gold only while a purse is drawable and undrawn", () => {
		expect(drawCellTodo(state())).toBe(true);
		expect(drawCellTodo(state({ drawn: true, amount: 60, tier: "good" }))).toBe(false);
		expect(drawCellTodo(state({ eligible: false, balls: 0 }))).toBe(false);
		expect(drawCellTodo(null)).toBe(false);
	});

	it("prints Ready, then the receipt, then this week's own count", () => {
		expect(drawCellValue(state())).toBe("Ready");
		// The pocketed amount lives in the panel; the cell says the state only, so
		// a three-digit purse never ends the cell in "…".
		expect(drawCellValue(state({ drawn: true, amount: 60, tier: "good" }))).toBe("Drawn");
		expect(drawCellValue(state({ drawn: true, amount: 400, tier: "jackpot" }))).toBe("Drawn");
		// A lapsed / ball-less drawable week: the cell falls back to the count.
		expect(drawCellValue(state({ eligible: false, balls: 0, runningBalls: 7 }))).toBe("7 balls");
		expect(drawCellValue(state({ eligible: false, balls: 0, runningBalls: 1 }))).toBe("1 ball");
		expect(drawCellValue(state({ eligible: false, balls: 0, runningBalls: 0 }))).toBe("0 balls");
	});

	it("says nothing before the first read lands", () => {
		expect(drawCellValue(null)).toBe("–");
	});
});

describe("DrawPanel", () => {
	function mount(
		s: MondayDrawState | null,
		onDraw = jest.fn(),
		onOpenSheet = jest.fn(),
		hero = true,
	) {
		return (
			<SafeAreaProvider initialMetrics={METRICS}>
				<DrawPanel state={s} onDraw={onDraw} onOpenSheet={onOpenSheet} hero={hero} />
			</SafeAreaProvider>
		);
	}

	it("waits on the cozy loading beat before the first read", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(null));
		});
		expect(textOf(renderer.root)).toContain("finding your drum");
	});

	it("prints the three lines and the draw, gold when it is the page's hero", async () => {
		const onDraw = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(state(), onDraw));
		});
		const text = textOf(renderer.root);
		expect(text).toContain("7 of 21 balls this week");
		expect(text).toContain("rare or better: 1 in 2");
		// The render reads the live clock: a countdown, or the rhythm once the
		// fixture's turn is behind us — never a server time zone.
		expect(text).toMatch(/the drum turns (in \d|once a week)/);
		expect(text).not.toMatch(/UTC/);
		const cta = renderer.root.findByProps({ testID: "draw-panel-draw" });
		expect(cta.props.variant).toBe("gold");
		await act(async () => {
			cta.props.onPress();
		});
		expect(onDraw).toHaveBeenCalledTimes(1);
	});

	it("keeps the gold for the page's one hero — elsewhere the draw is lilac", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(state(), jest.fn(), jest.fn(), false));
		});
		expect(renderer.root.findByProps({ testID: "draw-panel-draw" }).props.variant).toBe("lilac");
	});

	it("turns the drawn purse into a door back to the receipt", async () => {
		const onOpenSheet = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				mount(state({ drawn: true, amount: 60, tier: "good" }), jest.fn(), onOpenSheet),
			);
		});
		expect(textOf(renderer.root)).toContain("Drawn · 60 tickles");
		expect(renderer.root.findAllByProps({ testID: "draw-panel-draw" })).toHaveLength(0);
		await act(async () => {
			renderer.root.findByProps({ testID: "draw-panel-receipt" }).props.onPress();
		});
		expect(onOpenSheet).toHaveBeenCalledTimes(1);
	});

	it("says one quiet line when the ended week held no balls — never a loss", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(state({ eligible: false, balls: 0, purseOddsOneIn: null })));
		});
		const text = textOf(renderer.root);
		expect(text).toContain("dig once this week and you're in Monday's drum");
		expect(renderer.root.findAllByProps({ testID: "draw-panel-draw" })).toHaveLength(0);
		expect(renderer.root.findAllByProps({ testID: "draw-panel-receipt" })).toHaveLength(0);
		expect(text).not.toMatch(/lost|missed|too late/i);
	});
});
