// Rosie's press, as a contract. `squashAndSpring` is the one shared motion
// recipe: the pig, the barn building, and anything else that wants to answer a
// tap the way she does all run THIS, so the numbers live here rather than in
// three inline sequences that drift apart.
import { Animated } from "react-native";
import type { MotionPolicy } from "@/hooks/useMotionPolicy";
import {
	REST_SCALE,
	ROSIE_BOUNCE,
	SQUASH_MS,
	SQUASH_SCALE,
	restPose,
	squashAndSpring,
} from "@/utils/motionRecipes";

// `Animated.Value.__getValue` is the public-in-practice read that every RN
// animation test uses; it is simply not on the TS surface.
const read = (value: Animated.Value) =>
	(value as unknown as { __getValue: () => number }).__getValue();

const policy = (reduceMotion: boolean): MotionPolicy => ({
	reduceMotion,
	allowDecorativeMotion: !reduceMotion,
	largeTransition: reduceMotion ? "crossfade" : "motion",
	duration: (standardMs: number, reducedMs = 150) =>
		reduceMotion ? reducedMs : standardMs,
});

describe("squashAndSpring — the recipe", () => {
	let sequence: jest.SpyInstance;
	let timing: jest.SpyInstance;
	let spring: jest.SpyInstance;

	beforeEach(() => {
		sequence = jest.spyOn(Animated, "sequence");
		timing = jest.spyOn(Animated, "timing");
		spring = jest.spyOn(Animated, "spring");
	});
	afterEach(() => {
		sequence.mockRestore();
		timing.mockRestore();
		spring.mockRestore();
	});

	test("full motion is a squash, then the spring back — in that order", () => {
		const value = new Animated.Value(REST_SCALE);
		squashAndSpring(value, policy(false));

		// The squash: a quick timing DOWN to 94%.
		expect(timing).toHaveBeenCalledTimes(1);
		expect(timing.mock.calls[0][0]).toBe(value);
		expect(timing.mock.calls[0][1]).toEqual({
			toValue: SQUASH_SCALE,
			duration: SQUASH_MS,
			useNativeDriver: true,
		});

		// Then the bounce: a spring back to full size on Rosie's loose friction.
		expect(spring).toHaveBeenCalledTimes(1);
		expect(spring.mock.calls[0][0]).toBe(value);
		expect(spring.mock.calls[0][1]).toEqual({
			toValue: REST_SCALE,
			...ROSIE_BOUNCE,
			useNativeDriver: true,
		});

		// And they are sequenced, not run together: squash first, spring second.
		expect(sequence).toHaveBeenCalledTimes(1);
		expect(sequence.mock.calls[0][0]).toEqual([
			timing.mock.results[0].value,
			spring.mock.results[0].value,
		]);
	});

	test("Reduce Motion animates nothing at all", () => {
		const value = new Animated.Value(REST_SCALE);
		const animation = squashAndSpring(value, policy(true));

		expect(timing).not.toHaveBeenCalled();
		expect(spring).not.toHaveBeenCalled();
		expect(sequence).not.toHaveBeenCalled();

		// It is still a composite the caller can start, and it reports finished
		// straight away — so a call site that sequences off `finished` behaves
		// the same whether or not the motion played.
		const settled = jest.fn();
		animation.start(settled);
		expect(settled).toHaveBeenCalledWith({ finished: true });
		expect(read(value)).toBe(REST_SCALE);
	});

	test("Reduce Motion puts a mid-flight value back at rest", () => {
		const value = new Animated.Value(SQUASH_SCALE);
		squashAndSpring(value, policy(true)).start();
		expect(read(value)).toBe(REST_SCALE);
	});

	test("the recipe can be re-tuned without re-typing it", () => {
		const value = new Animated.Value(REST_SCALE);
		squashAndSpring(value, policy(false), {
			scale: 0.5,
			duration: 10,
			spring: { friction: 9 },
			rest: 2,
		});
		expect(timing.mock.calls[0][1]).toEqual({
			toValue: 0.5,
			duration: 10,
			useNativeDriver: true,
		});
		expect(spring.mock.calls[0][1]).toEqual({
			toValue: 2,
			friction: 9,
			useNativeDriver: true,
		});
	});
});

describe("restPose — the Reduce Motion answer", () => {
	test("snaps the value home and reports finished", () => {
		const value = new Animated.Value(0);
		const settled = jest.fn();
		restPose(value, 1).start(settled);
		expect(read(value)).toBe(1);
		expect(settled).toHaveBeenCalledWith({ finished: true });
	});

	test("stopping it is a no-op, resetting it re-poses", () => {
		const value = new Animated.Value(0);
		const pose = restPose(value, 1);
		expect(() => pose.stop()).not.toThrow();
		pose.reset();
		expect(read(value)).toBe(1);
	});
});
