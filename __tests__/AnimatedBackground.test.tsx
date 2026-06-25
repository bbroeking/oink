// Regression guard for the Barn "whole screen is dead, can't tap anything"
// bug. AnimatedBackground stacks full-screen frame <Image>s behind the page
// content. On the new architecture (Fabric/Bridgeless) an absolute sibling
// can hit-test ABOVE a later flex sibling, so if the frames are touchable
// they swallow EVERY tap on the screen they back (the Barn went fully
// unresponsive while the tab bar still worked). The frames must carry
// pointerEvents="none". If anyone removes it, this goes red.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";
import { AnimatedBackground } from "../components/ui/AnimatedBackground";

async function renderAct(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}

// The frame images are the only nodes carrying both `source` and `resizeMode`.
function frameNodes(r: TestRenderer.ReactTestRenderer) {
	return r.root.findAll(
		(n) =>
			!!n.props &&
			n.props.source !== undefined &&
			n.props.resizeMode !== undefined
	);
}

describe("AnimatedBackground — frames must not be in the touch path", () => {
	test("every full-screen frame has pointerEvents='none'", async () => {
		const r = await renderAct(
			<AnimatedBackground frames={[1, 2, 3]}>
				<Text>content</Text>
			</AnimatedBackground>
		);
		const frames = frameNodes(r);
		expect(frames.length).toBeGreaterThanOrEqual(2);
		for (const f of frames) {
			// pointerEvents lives in the (flattened) style on the new arch.
			const flat = StyleSheet.flatten(f.props.style) as { pointerEvents?: string };
			expect(flat.pointerEvents).toBe("none");
		}
		act(() => r.unmount());
	});

	test("renders the page content (children) so taps have something to hit", async () => {
		const r = await renderAct(
			<AnimatedBackground frames={[1, 2]}>
				<Text>pig-content</Text>
			</AnimatedBackground>
		);
		expect(JSON.stringify(r.toJSON())).toContain("pig-content");
		act(() => r.unmount());
	});

	test("single-frame / no-frame path still renders children", async () => {
		const r = await renderAct(
			<AnimatedBackground frames={[]}>
				<Text>solo</Text>
			</AnimatedBackground>
		);
		expect(JSON.stringify(r.toJSON())).toContain("solo");
		act(() => r.unmount());
	});
});
