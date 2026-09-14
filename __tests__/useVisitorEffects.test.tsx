// `useVisitorEffects` — the rituals on somebody else (weekday rituals,
// 2026-09-14, plan phase 4).
//
// The claims worth a test:
//   • ONE read per open. A sheet or a visit is short; two fetches on mount
//     (a plain effect AND a focus effect) is the bug this hook was written to
//     avoid, so the call count is asserted, not just the result.
//   • The target is the id it was given, and a null target reads nothing at all.
//   • Re-focus refetches; a changed id refetches against the NEW id.
//   • An expired row is dropped by the client's own clock, so a sheet left open
//     past an expiry stops drawing that ritual.
//   • A visitor who backs out mid-flight never repaints the next Barn with the
//     last one's weather.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useVisitorEffects, type UseVisitorEffects } from "@/hooks/useVisitorEffects";

const mockFetch = jest.fn();
let focusCallback: (() => (() => void) | undefined) | undefined;
jest.mock("expo-router/react-navigation", () => ({
	useFocusEffect: (callback: () => (() => void) | undefined) => {
		const { useEffect } = require("react"); // eslint-disable-line @typescript-eslint/no-require-imports -- mock factories load React after Jest hoisting
		focusCallback = callback;
		useEffect(() => callback(), [callback]);
	},
}));
jest.mock("@/utils/activeEffects", () => ({
	fetchActiveEffectsOf: (...args: unknown[]) => mockFetch(...args),
}));

const HOUR = 3_600_000;
const NOW = new Date("2026-09-18T12:00:00Z").getTime();
const at = (ms: number) => new Date(NOW + ms).toISOString();

const blessing = (kind: string, expires = at(6 * HOUR)) => ({
	source: "blessing" as const,
	kind,
	expires_at: expires,
});
const curse = (kind: string, expires = at(6 * HOUR)) => ({
	source: "curse" as const,
	kind,
	expires_at: expires,
});

let seen: UseVisitorEffects;
function Probe({ targetUserId }: { targetUserId: string | null }) {
	const value = useVisitorEffects(targetUserId);
	// Captured from an effect, never mid-render: the render pass must stay pure.
	React.useEffect(() => {
		seen = value;
	}, [value]);
	return null;
}

async function mount(targetUserId: string | null) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(<Probe targetUserId={targetUserId} />);
	});
	return r;
}

describe("useVisitorEffects", () => {
	beforeEach(() => {
		jest.spyOn(Date, "now").mockReturnValue(NOW);
		mockFetch.mockReset();
		mockFetch.mockResolvedValue([]);
		focusCallback = undefined;
	});
	afterEach(() => jest.restoreAllMocks());

	test("reads the target's effects exactly once on mount", async () => {
		mockFetch.mockResolvedValue([blessing("golden_hour"), curse("bacon_bits")]);
		const r = await mount("host");
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith("host");
		expect(seen.kinds).toEqual(["golden_hour", "bacon_bits"]);
		await act(async () => r.unmount());
	});

	test("loading is true only while the read is in flight", async () => {
		let settle!: (rows: unknown[]) => void;
		mockFetch.mockReturnValue(new Promise((resolve) => (settle = resolve)));
		let r!: TestRenderer.ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(<Probe targetUserId="host" />);
		});
		expect(seen.loading).toBe(true);
		await act(async () => settle([curse("hiccups")]));
		expect(seen.loading).toBe(false);
		expect(seen.kinds).toEqual(["hiccups"]);
		await act(async () => r.unmount());
	});

	test("a null target reads nothing and rests", async () => {
		const r = await mount(null);
		expect(mockFetch).not.toHaveBeenCalled();
		expect(seen.kinds).toEqual([]);
		expect(seen.loading).toBe(false);
		await act(async () => r.unmount());
	});

	test("a new target refetches against the new id", async () => {
		const r = await mount("host");
		expect(mockFetch).toHaveBeenCalledWith("host");
		mockFetch.mockResolvedValue([curse("pickle_brine")]);
		await act(async () => {
			r.update(<Probe targetUserId="other" />);
		});
		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(mockFetch).toHaveBeenLastCalledWith("other");
		expect(seen.kinds).toEqual(["pickle_brine"]);
		await act(async () => r.unmount());
	});

	test("coming back into focus refetches", async () => {
		const r = await mount("host");
		expect(mockFetch).toHaveBeenCalledTimes(1);
		mockFetch.mockResolvedValue([blessing("firefly_night")]);
		await act(async () => {
			focusCallback?.();
		});
		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(seen.kinds).toEqual(["firefly_night"]);
		await act(async () => r.unmount());
	});

	test("an expired row is dropped by the client's own clock", async () => {
		mockFetch.mockResolvedValue([
			blessing("golden_hour", at(2 * HOUR)),
			curse("bacon_bits", at(-1)),
		]);
		const r = await mount("host");
		expect(seen.kinds).toEqual(["golden_hour"]);
		await act(async () => r.unmount());
	});

	test("a read that lands after the visitor left is discarded", async () => {
		let settle!: (rows: unknown[]) => void;
		mockFetch.mockReturnValue(new Promise((resolve) => (settle = resolve)));
		const r = await mount("host");
		await act(async () => {
			r.update(<Probe targetUserId={null} />);
		});
		await act(async () => settle([curse("old_timey")]));
		expect(seen.kinds).toEqual([]);
		await act(async () => r.unmount());
	});
});
