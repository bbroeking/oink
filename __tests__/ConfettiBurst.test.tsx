// Confetti Snout's tap burst. The three things that matter:
//   • nothing at rest — the Barn mounts one of these permanently, so an
//     ordinary Barn must pay nothing for a blessing nobody cast;
//   • `fire()` puts a fistful of paper bits on screen;
//   • Reduce Motion still SHOWS the confetti (the ritual stays identifiable),
//     it just doesn't fly — a static ring that fades in.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import {
	ConfettiBurst,
	type ConfettiBurstHandle,
} from "../components/ui/ConfettiBurst";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";

function mount(reduceMotion = false) {
	const ref = React.createRef<ConfettiBurstHandle>();
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(
			<MotionPolicyProvider reduceMotion={reduceMotion}>
				<ConfettiBurst ref={ref} size={200} />
			</MotionPolicyProvider>,
		);
	});
	return { r, ref };
}

const bits = (r: TestRenderer.ReactTestRenderer) =>
	r.root
		.findAllByProps({ testID: "confetti-bit" })
		.filter((n) => typeof n.type === "string");

describe("ConfettiBurst", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("draws nothing at rest", () => {
		const { r } = mount();
		expect(r.toJSON()).toBeNull();
		expect(bits(r)).toHaveLength(0);
		act(() => r.unmount());
	});

	test("fire() throws a fistful of paper bits", () => {
		const { r, ref } = mount();
		act(() => ref.current!.fire());
		const count = bits(r).length;
		expect(count).toBeGreaterThanOrEqual(14);
		expect(count).toBeLessThanOrEqual(20);
		expect(r.root.findAllByProps({ testID: "confetti-burst" }).length).toBeGreaterThan(0);
		act(() => r.unmount());
	});

	test("the burst clears itself and returns to nothing", () => {
		const { r, ref } = mount();
		act(() => ref.current!.fire());
		expect(bits(r).length).toBeGreaterThan(0);
		act(() => jest.advanceTimersByTime(2000));
		expect(r.toJSON()).toBeNull();
		act(() => r.unmount());
	});

	test("a second tickle starts a fresh burst rather than nothing", () => {
		const { r, ref } = mount();
		act(() => ref.current!.fire());
		act(() => jest.advanceTimersByTime(300));
		act(() => ref.current!.fire());
		expect(bits(r).length).toBeGreaterThanOrEqual(14);
		act(() => r.unmount());
	});

	test("the burst never intercepts the tickle underneath it", () => {
		const { r, ref } = mount();
		act(() => ref.current!.fire());
		const json = r.toJSON() as TestRenderer.ReactTestRendererJSON;
		expect(json.props.pointerEvents).toBe("none");
		expect(StyleSheet.flatten(json.props.style).zIndex).toBe(20);
		for (const bit of bits(r)) expect(bit.props.pointerEvents).toBe("none");
		act(() => r.unmount());
	});

	test("Reduce Motion: the bits are there, already placed, not flying", () => {
		const { r, ref } = mount(true);
		act(() => ref.current!.fire());
		const all = bits(r);
		expect(all.length).toBeGreaterThanOrEqual(14);
		// Every offset is a plain number — a still ring, not an interpolation.
		for (const bit of all) {
			const style = StyleSheet.flatten(bit.props.style) as {
				transform: Record<string, unknown>[];
			};
			const translateX = style.transform.find((e) => "translateX" in e);
			expect(typeof translateX!.translateX).toBe("number");
			const rotate = style.transform.find((e) => "rotate" in e);
			expect(typeof rotate!.rotate).toBe("string");
		}
		act(() => r.unmount());
	});

	test("Reduce Motion still tidies up after itself", () => {
		const { r, ref } = mount(true);
		act(() => ref.current!.fire());
		act(() => jest.advanceTimersByTime(3000));
		expect(r.toJSON()).toBeNull();
		act(() => r.unmount());
	});
});
