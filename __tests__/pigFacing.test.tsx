// A pig given a `facing` turns toward it (2026-09-15). At rest it takes the
// three-quarter families — standing "face", seated "face_sit" — which are
// drawn looking right and mirrored for left; a mood or a reaction keeps its
// front frames, mirrored so the tilt stays toward the friend. No facing, no
// turn: the Barn's own pig is exactly what it was.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PigStage } from "@/components/ui/PigStage";
import { PigRestingPoseProvider } from "@/components/ui/PigRestingPose";
import { PIG_FRAMES } from "@/constants/pigFrames.generated";
import { PIG_FRAMES_EXTRA } from "@/constants/pigFramesExtra";
import { PIG_FRAME_ANCHORS } from "@/constants/hats";
import {
	PIG_ANIMATION_SPECS,
	pigDrawnFacing,
	resolveFacingAnimation,
} from "@/components/ui/pigRendererContract";
import { PIG_IDS } from "@/utils/pigs";

const ROSIE = { ...PIG_FRAMES.rosie, ...PIG_FRAMES_EXTRA.rosie };

const frameNodes = (root: TestRenderer.ReactTestInstance) =>
	root.findAll(
		(n) => !!n.props && n.props.source !== undefined && n.props.resizeMode !== undefined,
	);
const mountedSources = (root: TestRenderer.ReactTestInstance) =>
	frameNodes(root).map((n) => n.props.source);
// The stage wrapper is the one View whose transform carries the breath.
const stageMirrored = (root: TestRenderer.ReactTestInstance) => {
	const stage = root.find((n) => {
		const style = Array.isArray(n.props.style) ? n.props.style : [n.props.style];
		return style.some(
			(s: unknown) =>
				!!s && typeof s === "object" && Array.isArray((s as { transform?: unknown }).transform) &&
				(s as { transform: Record<string, unknown>[] }).transform.some((t) => "scaleY" in t),
		);
	});
	const style = (Array.isArray(stage.props.style) ? stage.props.style : [stage.props.style]) as { transform?: Record<string, unknown>[] }[];
	const transform = style.find((s) => s && Array.isArray(s.transform))!.transform!;
	return transform.some((t) => t.scaleX === -1);
};

async function render(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}

describe("the contract", () => {
	test("only the rests turn; the turned families are drawn looking right", () => {
		expect(resolveFacingAnimation("idle", "right")).toBe("face");
		expect(resolveFacingAnimation("sit", "left")).toBe("face_sit");
		// A happy rest is the idle with a squint — it turns (the Home turn
		// button, 2026-09-15); low moods keep their front frames.
		expect(resolveFacingAnimation("happy", "left")).toBe("face");
		expect(resolveFacingAnimation("tired", "left")).toBe("tired");
		expect(resolveFacingAnimation("sad", "left")).toBe("sad");
		expect(resolveFacingAnimation("wave", "right")).toBe("wave");
		expect(resolveFacingAnimation("idle", undefined)).toBe("idle");
		expect(pigDrawnFacing("face")).toBe("right");
		expect(pigDrawnFacing("face_sit")).toBe("right");
		expect(pigDrawnFacing("idle")).toBe("left");
	});

	test("every pig has both turned families, and every frame has anchors", () => {
		for (const pig of PIG_IDS)
			for (const frame of [...PIG_ANIMATION_SPECS.face.frames, ...PIG_ANIMATION_SPECS.face_sit.frames])
				expect(PIG_FRAMES_EXTRA[pig]?.[frame]).toBeDefined();
		expect(PIG_FRAME_ANCHORS.face).toHaveLength(4);
		expect(PIG_FRAME_ANCHORS.face_sit).toHaveLength(4);
		// A hat on a turned head sits toward the face, not on the front crown.
		expect(PIG_FRAME_ANCHORS.face[0].head!.x).toBeGreaterThan(PIG_FRAME_ANCHORS.idle[0].head!.x);
	});
});

describe("PigStage", () => {
	test("facing right stands a pig on the turned frames as drawn", async () => {
		const r = await render(<PigStage pigAnimation="idle" pigMood="content" facing="right" />);
		expect(mountedSources(r.root)).toContain(ROSIE.face_1);
		expect(mountedSources(r.root)).not.toContain(ROSIE.idle_1);
		expect(stageMirrored(r.root)).toBe(false);
		act(() => r.unmount());
	});

	test("facing left mirrors the turned frames; seated in a room it takes the seated turn", async () => {
		const r = await render(
			<PigRestingPoseProvider pose="sit">
				<PigStage pigAnimation="idle" pigMood="content" facing="left" />
			</PigRestingPoseProvider>,
		);
		expect(mountedSources(r.root)).toContain(ROSIE.face_sit_1);
		expect(mountedSources(r.root)).not.toContain(ROSIE.happy_1);
		expect(stageMirrored(r.root)).toBe(true);
		act(() => r.unmount());
	});

	test("a tired host keeps the front nap, mirrored toward its guest", async () => {
		const r = await render(<PigStage pigAnimation="idle" pigMood="tired" facing="left" />);
		expect(mountedSources(r.root)).toContain(ROSIE.tired_1);
		expect(stageMirrored(r.root)).toBe(false);
		const right = await render(<PigStage pigAnimation="idle" pigMood="tired" facing="right" />);
		expect(stageMirrored(right.root)).toBe(true);
		act(() => { r.unmount(); right.unmount(); });
	});

	test("no facing, no turn and no mirror", async () => {
		const r = await render(<PigStage pigAnimation="idle" pigMood="content" />);
		expect(mountedSources(r.root)).toContain(ROSIE.idle_1);
		expect(mountedSources(r.root)).not.toContain(ROSIE.face_1);
		expect(stageMirrored(r.root)).toBe(false);
		act(() => r.unmount());
	});
});
