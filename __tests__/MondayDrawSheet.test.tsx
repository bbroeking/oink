import fs from "node:fs";
import path from "node:path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("@/components/ui/Icon", () => ({
	Icon: () => null,
}));
jest.mock("@/components/ui/WaitingRosie", () => ({
	WaitingRosie: () => null,
}));

import { MondayDrawSheet, drumBallsLine } from "@/components/season1/MondayDrawSheet";
import { MONDAY_DRAW_TUNING, type MondayDrawState } from "@/utils/mondayDraw";

const METRICS = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function baseState(over: Partial<MondayDrawState> = {}): MondayDrawState {
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
		runningBalls: 3,
		runningCap: 21,
		runningOddsOneIn: 3,
		nextTurnAt: "2026-09-28T00:00:00.000Z",
		tuning: MONDAY_DRAW_TUNING,
		...over,
	};
}

// A testID rides every layer of the T → DynamicTypeText → RN Text chain;
// count the host node once.
function hostCount(root: TestRenderer.ReactTestInstance, testID: string): number {
	return root.findAll((n) => n.props.testID === testID && typeof n.type === "string").length;
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

function mount(
	state: MondayDrawState | null,
	onDraw: () => Promise<MondayDrawState | null> = jest.fn(async () => null),
	onClose: () => void = jest.fn(),
	autoDraw = false,
	open = true,
) {
	return (
		<SafeAreaProvider initialMetrics={METRICS}>
			<MondayDrawSheet open={open} state={state} onDraw={onDraw} onClose={onClose} autoDraw={autoDraw} />
		</SafeAreaProvider>
	);
}

describe("MondayDrawSheet", () => {
	it("opens as a PEEK on an undrawn week: odds shown, nothing rolled, no `you`", async () => {
		const onDraw = jest.fn(async () => null);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState(), onDraw));
		});
		expect(onDraw).not.toHaveBeenCalled();
		const text = textOf(renderer.root);
		expect(text).toContain("Your purse is waiting.");
		// The drum, in two lines: this week's balls and the odds off them.
		expect(text).toContain("7 of 21 balls in the drum");
		expect(text).toContain("rare or better: 1 in 2");
		// Nothing about a streak, a warmer Monday or the herd survives.
		expect(text).not.toMatch(/warm|streak|herd|Monday's warmer/i);
		for (const tier of ["common", "good", "rare", "jackpot"]) {
			expect(renderer.root.findByProps({ testID: `monday-draw-tile-${tier}` })).toBeTruthy();
		}
		expect(hostCount(renderer.root, "monday-draw-you")).toBe(0);
		expect(renderer.root.findAllByProps({ testID: "monday-draw-pocket" })).toHaveLength(0);
		expect(renderer.root.findByProps({ testID: "monday-draw-draw" })).toBeTruthy();
		expect(textOf(renderer.root)).toContain("Draw your Monday purse");
	});

	it("rolls only from the draw button, then reveals the purse and pockets", async () => {
		const drawn = baseState({ drawn: true, amount: 60, tier: "good" });
		const onDraw = jest.fn(async () => drawn);
		const onClose = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState(), onDraw, onClose));
		});
		expect(onDraw).not.toHaveBeenCalled();

		await act(async () => {
			renderer.root.findByProps({ testID: "monday-draw-draw" }).props.onPress();
		});
		expect(onDraw).toHaveBeenCalledTimes(1);

		await act(async () => {
			renderer.update(mount(drawn, onDraw, onClose));
		});
		// A re-render with the drawn state must not ask the server again.
		expect(onDraw).toHaveBeenCalledTimes(1);
		const text = textOf(renderer.root);
		expect(text).toContain("60");
		expect(text).toContain("A good purse.");
		expect(text).toContain("Pocket 60 tickles");
		// `you` over the hit tile only.
		expect(hostCount(renderer.root, "monday-draw-you")).toBe(1);
		expect(
			renderer.root.findByProps({ testID: "monday-draw-tile-good" }).props.accessibilityLabel,
		).toBe("60 tickles, good, yours");
		expect(
			renderer.root.findByProps({ testID: "monday-draw-tile-rare" }).props.accessibilityLabel,
		).toBe("150 tickles, rare");
		const pocket = renderer.root.findByProps({ testID: "monday-draw-pocket" });
		expect(pocket.props.loading).toBe(false);
		await act(async () => {
			pocket.props.onPress();
		});
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("waits on the button while the roll is in flight", async () => {
		let settle!: (s: MondayDrawState | null) => void;
		const onDraw = jest.fn(
			() => new Promise<MondayDrawState | null>((resolve) => { settle = resolve; }),
		);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState(), onDraw));
		});
		await act(async () => {
			renderer.root.findByProps({ testID: "monday-draw-draw" }).props.onPress();
		});
		expect(textOf(renderer.root)).toContain("Drawing your purse");
		expect(renderer.root.findByProps({ testID: "monday-draw-pocket" }).props.loading).toBe(true);
		await act(async () => {
			settle(baseState({ drawn: true, amount: 20, tier: "common" }));
		});
	});

	it("rolls on open only when the door already said so (autoDraw)", async () => {
		const drawn = baseState({ drawn: true, amount: 150, tier: "rare" });
		const onDraw = jest.fn(async () => drawn);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState(), onDraw, jest.fn(), true));
		});
		expect(onDraw).toHaveBeenCalledTimes(1);
		expect(renderer.root.findAllByProps({ testID: "monday-draw-draw" })).toHaveLength(0);
		await act(async () => {
			renderer.update(mount(drawn, onDraw, jest.fn(), true));
		});
		expect(onDraw).toHaveBeenCalledTimes(1);
		expect(textOf(renderer.root)).toContain("A rare purse!");
		expect(textOf(renderer.root)).toContain("Pocket 150 tickles");
	});

	it("does not draw an already-drawn week, even with autoDraw — and reads as the receipt", async () => {
		const onDraw = jest.fn(async () => null);
		const onClose = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				mount(baseState({ drawn: true, amount: 400, tier: "jackpot" }), onDraw, onClose, true),
			);
		});
		expect(onDraw).not.toHaveBeenCalled();
		const text = textOf(renderer.root);
		// Pocketed before this open: the title is the receipt, the button is a
		// door back — never a second `Pocket` (which read as an uncleared claim).
		expect(text).toContain("400 tickles, pocketed.");
		expect(text).not.toContain("Pocket 400 tickles");
		expect(text).toContain("7 of 21 balls in the drum");
		expect(renderer.root.findAllByProps({ testID: "monday-draw-pocket" })).toHaveLength(0);
		await act(async () => {
			renderer.root.findByProps({ testID: "monday-draw-done" }).props.onPress();
		});
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("reads as the receipt when the drawn state lands after the sheet opens", async () => {
		const onDraw = jest.fn(async () => null);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(null, onDraw));
		});
		await act(async () => {
			renderer.update(mount(baseState({ drawn: true, amount: 60, tier: "good" }), onDraw));
		});
		expect(onDraw).not.toHaveBeenCalled();
		expect(textOf(renderer.root)).toContain("60 tickles, pocketed.");
		expect(renderer.root.findAllByProps({ testID: "monday-draw-pocket" })).toHaveLength(0);
		expect(renderer.root.findByProps({ testID: "monday-draw-done" })).toBeTruthy();
	});

	it("a purse drawn this open keeps its reveal and its Pocket beat", async () => {
		const drawn = baseState({ drawn: true, amount: 60, tier: "good" });
		const onDraw = jest.fn(async () => drawn);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState(), onDraw));
		});
		await act(async () => {
			renderer.root.findByProps({ testID: "monday-draw-draw" }).props.onPress();
		});
		await act(async () => {
			renderer.update(mount(drawn, onDraw));
		});
		const text = textOf(renderer.root);
		expect(text).toContain("A good purse.");
		expect(text).toContain("Pocket 60 tickles");
		expect(text).not.toContain("pocketed.");
	});

	it("shows the warm not-eligible line — a door, not a verdict — and never draws", async () => {
		const onDraw = jest.fn(async () => null);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState({ eligible: false }), onDraw, jest.fn(), true));
		});
		expect(onDraw).not.toHaveBeenCalled();
		const text = textOf(renderer.root);
		expect(text).toContain("No purse this Monday.");
		expect(text).toContain("Dig once this week and you're in Monday's drum.");
		// The ball-less week is an invitation, never a loss.
		expect(text).not.toMatch(/lost|missed|too late|no luck/i);
		expect(text).not.toContain("Pocket");
		expect(renderer.root.findAllByProps({ testID: "monday-draw-disc" })).toHaveLength(0);
		expect(renderer.root.findByProps({ testID: "monday-draw-done" })).toBeTruthy();
	});

	it("offers the draw again when the roll does not land", async () => {
		const onDraw = jest.fn(async () => null);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState(), onDraw));
		});
		await act(async () => {
			renderer.root.findByProps({ testID: "monday-draw-draw" }).props.onPress();
		});
		expect(onDraw).toHaveBeenCalledTimes(1);
		expect(textOf(renderer.root)).toContain("The purse slipped");
		await act(async () => {
			renderer.root.findByProps({ testID: "monday-draw-draw" }).props.onPress();
		});
		expect(onDraw).toHaveBeenCalledTimes(2);
	});

	it("peeks afresh on the next open after a draw was tapped", async () => {
		const onDraw = jest.fn(async () => null);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState(), onDraw));
		});
		await act(async () => {
			renderer.root.findByProps({ testID: "monday-draw-draw" }).props.onPress();
		});
		await act(async () => {
			renderer.update(mount(baseState(), onDraw, jest.fn(), false, false));
		});
		await act(async () => {
			renderer.update(mount(baseState(), onDraw, jest.fn(), false, true));
		});
		expect(onDraw).toHaveBeenCalledTimes(1);
		expect(textOf(renderer.root)).toContain("Your purse is waiting.");
	});

	it("waits on the loading beat while the state is still in flight", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(null));
		});
		expect(textOf(renderer.root)).toContain("finding your drum");
	});
});

describe("drumBallsLine", () => {
	it("prints the count against the snout's own cap", () => {
		expect(drumBallsLine(7, 21)).toBe("7 of 21 balls in the drum");
		expect(drumBallsLine(1, 21)).toBe("1 of 21 balls in the drum");
	});

	it("earns the perfect-week words on a full drum", () => {
		expect(drumBallsLine(21, 21)).toBe("21 of 21 balls in the drum · every last feeding");
		// A cap that moved under a schedule change never truncates the words.
		expect(drumBallsLine(22, 21)).toBe("21 of 21 balls in the drum · every last feeding");
	});

	it("drops the `of N` rather than invent a cap the server didn't send", () => {
		expect(drumBallsLine(3, 0)).toBe("3 balls in the drum");
		expect(drumBallsLine(1, 0)).toBe("1 ball in the drum");
	});
});

describe("the drum's reveal", () => {
	it("drops one ball per roll and lifts the winner", async () => {
		const drawn = baseState({
			drawn: true,
			amount: 150,
			tier: "rare",
			rolls: ["common", "common", "rare", "good", "common", "common", "common"],
		});
		const onDraw = jest.fn(async () => drawn);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState(), onDraw));
		});
		await act(async () => {
			renderer.root.findByProps({ testID: "monday-draw-draw" }).props.onPress();
		});
		await act(async () => {
			renderer.update(mount(drawn, onDraw));
		});
		const balls = renderer.root.findByProps({ testID: "monday-draw-balls" });
		expect(balls.props.accessibilityLabel).toBe("7 balls turned, one paid");
		expect(hostCount(renderer.root, "monday-draw-ball-winner")).toBe(1);
		expect(textOf(renderer.root)).toContain("A rare purse!");
	});

	it("shows the balls before the purse is drawn, with no winner", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState()));
		});
		const balls = renderer.root.findByProps({ testID: "monday-draw-balls" });
		expect(balls.props.accessibilityLabel).toBe("7 balls in the drum");
		expect(hostCount(renderer.root, "monday-draw-ball-winner")).toBe(0);
	});

	it("puts a Leftovers ball (Season 2) in the drum and names it on the card", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState({ leftoverBalls: 1 })));
		});
		const balls = renderer.root.findByProps({ testID: "monday-draw-balls" });
		expect(balls.props.accessibilityLabel).toBe("8 balls in the drum");
		expect(textOf(renderer.root)).toContain("7 of 21 balls in the drum (+1 leftover)");
	});

	it("has no drum at all on a ball-less week", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount(baseState({ eligible: false, balls: 0 })));
		});
		expect(renderer.root.findAllByProps({ testID: "monday-draw-balls" })).toHaveLength(0);
	});

	it("respects Reduce Motion — the result, with no telling", () => {
		// A source check: the drum and the disc both read the motion policy and
		// snap to their end values instead of animating. The result is written
		// server-side before any of this runs, so state is the truth.
		const src = fs.readFileSync(
			path.join(__dirname, "..", "components/season1/MondayDrawSheet.tsx"),
			"utf8",
		);
		expect(src).toContain('import { useMotionPolicy } from "@/hooks/useMotionPolicy";');
		// Two animated pieces, two motion-policy reads (the balls, the disc).
		expect(src.match(/useMotionPolicy\(\)/g)).toHaveLength(2);
		// Each one short-circuits to the landed value before starting anything.
		expect(src).toContain("if (motion.reduceMotion) {\n\t\t\tdrop.setValue(1);\n\t\t\tlift.setValue(1);\n\t\t\treturn;\n\t\t}");
		expect(src).toContain("if (motion.reduceMotion) {\n\t\t\tscale.setValue(1);\n\t\t\treturn;\n\t\t}");
	});
});
