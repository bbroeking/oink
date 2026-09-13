// Inside a room the pig sits. HabitatScene provides the seated rest for every
// pig it stages; PigStage takes it in place of a standing idle, runs the loop
// at the rest tempo (the frame index advances, so worn items ride along),
// keeps a mood or a reaction, and rests on the eyes-open frame under Reduce
// Motion. Outside a room nothing changes — the Exterior's tickle idle is the
// same animation it was.
import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { PigStage, resolveSlot } from "@/components/ui/PigStage";
import { PigRestingPoseProvider } from "@/components/ui/PigRestingPose";
import { HabitatScene } from "@/components/habitat/HabitatScene";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { PIG_FRAMES } from "@/constants/pigFrames.generated";
import { HAT_IMAGES, PIG_FRAME_ANCHORS } from "@/constants/hats";
import {
	HABITAT_CATALOG_BY_ID,
	HABITAT_POSITIONS,
	HABITAT_STARTER_POSITIONS,
} from "@/constants/habitat";
import type { HabitatSnapshot } from "@/utils/habitat";

const ROSIE = PIG_FRAMES.rosie;
const REST_TICK_MS = 400; // 1000 / PIG_REST_FPS

// Every frame of the current animation is mounted at once; the visible one has
// opacity 1 (the SpritePig flip-book, same reading as PigStage.test).
const frameNodes = (root: TestRenderer.ReactTestInstance) =>
	root.findAll(
		(n) => !!n.props && n.props.source !== undefined && n.props.resizeMode !== undefined,
	);
const opacityOf = (style: unknown): number | undefined => {
	const arr = Array.isArray(style) ? style : [style];
	for (const s of arr)
		if (s && typeof s === "object" && "opacity" in (s as object))
			return (s as { opacity: number }).opacity;
	return undefined;
};
const visibleSource = (root: TestRenderer.ReactTestInstance) =>
	[...new Set(frameNodes(root).filter((n) => opacityOf(n.props.style) === 1).map((n) => n.props.source))][0];
const mountedSources = (root: TestRenderer.ReactTestInstance) =>
	frameNodes(root).map((n) => n.props.source);

const snapshot = (): HabitatSnapshot => ({
	ownerId: "owner",
	revision: 1,
	positions: Object.fromEntries(
		HABITAT_POSITIONS.map((position) => {
			const id = HABITAT_STARTER_POSITIONS[position];
			return [position, id ? HABITAT_CATALOG_BY_ID[id] : null];
		}),
	) as HabitatSnapshot["positions"],
});

async function render(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}
const advance = async (ms: number) => {
	await act(async () => {
		jest.advanceTimersByTime(ms);
	});
};

describe("the pig sits inside a room", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("a seated content pig loops the sitting frames and its frame index advances", async () => {
		const onPigFrame = jest.fn();
		const r = await render(
			<PigRestingPoseProvider pose="sit">
				<PigStage pigAnimation="idle" pigMood="content" onPigFrame={onPigFrame} />
			</PigRestingPoseProvider>,
		);
		// Sitting mounts the happy family, never the standing idle art.
		expect(mountedSources(r.root)).toContain(ROSIE.happy_1);
		expect(mountedSources(r.root)).not.toContain(ROSIE.idle_2);
		expect(visibleSource(r.root)).toBe(ROSIE.happy_1);
		expect(onPigFrame).toHaveBeenLastCalledWith(0);

		// Six open-eye ticks, then the squint, then the re-open pose.
		await advance(REST_TICK_MS * 6);
		expect(visibleSource(r.root)).toBe(ROSIE.happy_2);
		expect(onPigFrame).toHaveBeenLastCalledWith(1);
		await advance(REST_TICK_MS);
		expect(visibleSource(r.root)).toBe(ROSIE.happy_3);
		expect(onPigFrame).toHaveBeenLastCalledWith(2);
		await advance(REST_TICK_MS);
		expect(visibleSource(r.root)).toBe(ROSIE.happy_4);
		expect(onPigFrame).toHaveBeenLastCalledWith(3);
		// ...and the loop comes back around to the open hold.
		await advance(REST_TICK_MS * 2);
		expect(visibleSource(r.root)).toBe(ROSIE.happy_1);

		const seen = new Set(onPigFrame.mock.calls.map(([idx]) => idx));
		expect(seen.size).toBeGreaterThanOrEqual(2);
		act(() => r.unmount());
	});

	test("Reduce Motion rests a seated pig on the eyes-open frame with no loop", async () => {
		const interval = jest.spyOn(global, "setInterval");
		const r = await render(
			<MotionPolicyProvider reduceMotion>
				<PigRestingPoseProvider pose="sit">
					<PigStage pigAnimation="idle" pigMood="content" />
				</PigRestingPoseProvider>
			</MotionPolicyProvider>,
		);
		expect(interval).not.toHaveBeenCalled();
		expect(visibleSource(r.root)).toBe(ROSIE.happy_1);
		await advance(5000);
		expect(visibleSource(r.root)).toBe(ROSIE.happy_1);
		act(() => r.unmount());
		interval.mockRestore();
	});

	test("a mood still shows and a reaction still plays while seated", async () => {
		const sad = await render(
			<PigRestingPoseProvider pose="sit">
				<PigStage pigAnimation="idle" pigMood="sad" />
			</PigRestingPoseProvider>,
		);
		expect(visibleSource(sad.root)).toBe(ROSIE.sad_1);
		act(() => sad.unmount());

		const onComplete = jest.fn();
		const reacting = await render(
			<PigRestingPoseProvider pose="sit">
				<PigStage
					pigAnimation="idle"
					pigMood="content"
					pigReaction={{ id: 1, kind: "jump" }}
					onPigComplete={onComplete}
				/>
			</PigRestingPoseProvider>,
		);
		expect(visibleSource(reacting.root)).toBe(ROSIE.jump_1);
		await advance(1000); // jump is 4 frames at 6 fps
		expect(onComplete).toHaveBeenCalled();
		expect(visibleSource(reacting.root)).toBe(ROSIE.happy_1); // back to sitting
		act(() => reacting.unmount());
	});

	test("outside a room the standing idle is untouched", async () => {
		const r = await render(<PigStage pigAnimation="idle" pigMood="content" />);
		expect(mountedSources(r.root)).toContain(ROSIE.idle_1);
		expect(mountedSources(r.root)).not.toContain(ROSIE.happy_1);
		act(() => r.unmount());
	});

	test("a worn item tracks the sitting frames on the happy family's anchors", async () => {
		const hat = { id: "cowboy", category: "hat", emoji: null };
		// Every sitting frame resolves through happy's tuned anchors — there is
		// one anchor entry per happy frame, so nothing falls back to rest.
		expect(PIG_FRAME_ANCHORS.happy).toHaveLength(4);
		for (let frame = 0; frame < 4; frame++)
			expect(resolveSlot(hat, "sit", frame)?.overlay).toEqual(
				resolveSlot(hat, "happy", frame)?.overlay,
			);
		// And the seated frames move the item: the squint frame's anchor differs
		// from the open one, so the hat is not pinned while the pig blinks.
		expect(resolveSlot(hat, "sit", 2)?.overlay).not.toEqual(
			resolveSlot(hat, "sit", 0)?.overlay,
		);

		// Live: the stage feeds back the frame it shows, and the item's box at
		// that frame is the one the happy anchors say.
		let frameIdx = 0;
		const Living = () => {
			const [idx, setIdx] = React.useState(0);
			frameIdx = idx;
			return (
				<PigRestingPoseProvider pose="sit">
					<PigStage pigAnimation="idle" pigMood="content" equipped={hat} pigFrameIdx={idx} onPigFrame={setIdx} />
				</PigRestingPoseProvider>
			);
		};
		const r = await render(<Living />);
		await advance(REST_TICK_MS * 7);
		expect(frameIdx).toBe(2);
		const hatImage = r.root.find((n) => n.props?.source === HAT_IMAGES.cowboy);
		const box = StyleSheet.flatten(hatImage.parent!.props.style);
		const expected = resolveSlot(hat, "happy", 2)!.overlay!;
		expect(box).toMatchObject({
			left: expected.left,
			bottom: expected.bottom,
			width: expected.width,
			height: expected.height,
		});
		act(() => r.unmount());
	});

	test("HabitatScene seats both the host and the visitor pig", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<HabitatScene
					snapshot={snapshot()}
					hostPig={<PigStage pigAnimation="idle" pigMood="content" />}
					visitorPig={<PigStage pigId="pickles" pigAnimation="idle" pigMood="content" />}
				/>,
			);
		});
		const host = renderer.root.findByProps({ testID: "habitat-host-pig" });
		const visitor = renderer.root.findByProps({ testID: "habitat-visitor-pig" });
		expect(visibleSource(host)).toBe(ROSIE.happy_1);
		expect(visibleSource(visitor)).toBe(PIG_FRAMES.pickles.happy_1);
		act(() => renderer.unmount());
	});
});
