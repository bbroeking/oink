import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("@/components/ui/Icon", () => ({
	Icon: () => null,
}));
jest.mock("@/components/ui/WaitingRosie", () => ({
	WaitingRosie: () => null,
}));

import { MondayDrawSheet } from "@/components/season1/MondayDrawSheet";
import { MONDAY_DRAW_TUNING, type MondayDrawState } from "@/utils/mondayDraw";

const METRICS = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function baseState(over: Partial<MondayDrawState> = {}): MondayDrawState {
	return {
		week: "20260907",
		eligible: true,
		drawn: false,
		amount: null,
		tier: null,
		mondaysSinceRare: 4,
		herdBottomHalf: false,
		nextRareOddsOneIn: 3,
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
		expect(text).toContain(
			"Four Mondays without a rare, so next Monday's warmer: 1 in 3 for rare or better.",
		);
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
		const drawn = baseState({ drawn: true, amount: 150, tier: "rare", mondaysSinceRare: 0, nextRareOddsOneIn: 8 });
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

	it("does not draw an already-drawn week, even with autoDraw", async () => {
		const onDraw = jest.fn(async () => null);
		const onClose = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				mount(baseState({ drawn: true, amount: 400, tier: "jackpot", mondaysSinceRare: 0, nextRareOddsOneIn: 8 }), onDraw, onClose, true),
			);
		});
		expect(onDraw).not.toHaveBeenCalled();
		const text = textOf(renderer.root);
		expect(text).toContain("Jackpot.");
		expect(text).toContain("Every Monday without a rare warms the next: 1 in 8 for rare or better.");
		await act(async () => {
			renderer.root.findByProps({ testID: "monday-draw-pocket" }).props.onPress();
		});
		expect(onClose).toHaveBeenCalledTimes(1);
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
		expect(text).toContain("Dig any feeding and next one's yours.");
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
		expect(textOf(renderer.root)).toContain("finding your purse");
	});
});
