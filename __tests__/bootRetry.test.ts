// Unit tests for the boot-retry helpers behind the offline soft-lock fixes
// (spec 03 / issue #5). These are the pure core the useHomeStats retry loop
// and the (tabs)/_layout "saddling up" gate both derive their behaviour from.

import {
	HOME_STATS_BACKOFF_MS,
	USERNAME_BACKOFF_MS,
	retryDelayMs,
	resolveUsernameFetch,
} from "../utils/bootRetry";

describe("retryDelayMs", () => {
	it("walks the home-stats schedule attempt by attempt", () => {
		expect(retryDelayMs(0, HOME_STATS_BACKOFF_MS)).toBe(2000);
		expect(retryDelayMs(1, HOME_STATS_BACKOFF_MS)).toBe(5000);
		expect(retryDelayMs(2, HOME_STATS_BACKOFF_MS)).toBe(15000);
	});

	it("walks the username schedule and exhausts inside ~10s", () => {
		expect(retryDelayMs(0, USERNAME_BACKOFF_MS)).toBe(2000);
		expect(retryDelayMs(1, USERNAME_BACKOFF_MS)).toBe(3000);
		expect(retryDelayMs(2, USERNAME_BACKOFF_MS)).toBe(5000);
		const total = USERNAME_BACKOFF_MS.reduce((a, b) => a + b, 0);
		expect(total).toBeLessThanOrEqual(10000);
	});

	it("returns null once the schedule is exhausted — the caller's stop signal", () => {
		expect(retryDelayMs(HOME_STATS_BACKOFF_MS.length, HOME_STATS_BACKOFF_MS)).toBeNull();
		expect(retryDelayMs(USERNAME_BACKOFF_MS.length, USERNAME_BACKOFF_MS)).toBeNull();
		expect(retryDelayMs(99, HOME_STATS_BACKOFF_MS)).toBeNull();
	});

	it("treats a negative attempt as out of range (null), never a crash", () => {
		expect(retryDelayMs(-1, HOME_STATS_BACKOFF_MS)).toBeNull();
	});
});

describe("resolveUsernameFetch", () => {
	it("returns the username on a successful fetch", () => {
		expect(resolveUsernameFetch({ data: { username: "porkchop" } })).toBe(
			"porkchop"
		);
	});

	it("returns null only when a SUCCESSFUL fetch shows no username", () => {
		expect(resolveUsernameFetch({ data: { username: null } })).toBeNull();
		expect(resolveUsernameFetch({ data: {} })).toBeNull();
		expect(resolveUsernameFetch({ data: null })).toBeNull();
	});

	it("stays undefined on a fetch error — never routes a named pig to UsernameSetup", () => {
		// The load-bearing invariant: undefined-due-to-error must not be read
		// as "no username". Even if stale data rides along, the error wins.
		expect(resolveUsernameFetch({ error: new Error("network") })).toBeUndefined();
		expect(
			resolveUsernameFetch({ error: { code: "PGRST116" }, data: null })
		).toBeUndefined();
		expect(
			resolveUsernameFetch({ error: new Error("x"), data: { username: "stale" } })
		).toBeUndefined();
	});
});
