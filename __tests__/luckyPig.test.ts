// rollLucky math — verifies the three trigger paths (first-time
// guarantee, sunbeam, boost window, steady-state) at boundary cases
// with deterministic random + clock.

import {
	rollLucky,
	LUCKY_GUARANTEED_BY_TICKLE_N,
	LUCKY_BOOST_UNTIL_ISO,
	LUCKY_TRIGGER_CHANCE,
	LUCKY_TRIGGER_CHANCE_BOOST,
	LUCKY_TRIGGER_CHANCE_SUNBEAM,
} from "../utils/luckyPig";

const BOOST_END_MS = new Date(LUCKY_BOOST_UNTIL_ISO).getTime();
const BEFORE_BOOST = BOOST_END_MS - 60_000; // 1 minute before
const AFTER_BOOST = BOOST_END_MS + 60_000; // 1 minute after

// Deterministic random injector — returns whatever you pass.
const fixedRandom = (v: number) => () => v;

describe("rollLucky — first-time guarantee", () => {
	test("fires when first-time user crosses the Nth tickle", () => {
		const r = rollLucky({
			isFirstTimeUser: true,
			preFirstTicklesIncludingThis: LUCKY_GUARANTEED_BY_TICKLE_N,
			sunBeamActive: false,
			now: AFTER_BOOST,
			random: fixedRandom(0.99), // would otherwise miss
		});
		expect(r.triggerNow).toBe(true);
		expect(r.reason).toBe("first_time_guarantee");
	});

	test("fires when first-time user is past the threshold", () => {
		const r = rollLucky({
			isFirstTimeUser: true,
			preFirstTicklesIncludingThis: LUCKY_GUARANTEED_BY_TICKLE_N + 5,
			sunBeamActive: false,
			now: AFTER_BOOST,
			random: fixedRandom(0.99),
		});
		expect(r.triggerNow).toBe(true);
		expect(r.reason).toBe("first_time_guarantee");
	});

	test("does NOT fire when first-time user is below threshold", () => {
		const r = rollLucky({
			isFirstTimeUser: true,
			preFirstTicklesIncludingThis: LUCKY_GUARANTEED_BY_TICKLE_N - 1,
			sunBeamActive: false,
			now: AFTER_BOOST,
			random: fixedRandom(0.99),
		});
		expect(r.triggerNow).toBe(false);
	});

	test("guarantee does NOT apply to returning users", () => {
		const r = rollLucky({
			isFirstTimeUser: false,
			preFirstTicklesIncludingThis: LUCKY_GUARANTEED_BY_TICKLE_N + 100,
			sunBeamActive: false,
			now: AFTER_BOOST,
			random: fixedRandom(0.99),
		});
		expect(r.triggerNow).toBe(false);
	});
});

describe("rollLucky — chance gates", () => {
	test("sunbeam takes priority over boost + steady", () => {
		// Roll just under sunbeam threshold; would miss boost + steady.
		const r = rollLucky({
			isFirstTimeUser: false,
			preFirstTicklesIncludingThis: 0,
			sunBeamActive: true,
			now: BEFORE_BOOST,
			random: fixedRandom(LUCKY_TRIGGER_CHANCE_SUNBEAM - 0.01),
		});
		expect(r.triggerNow).toBe(true);
		expect(r.reason).toBe("sunbeam");
	});

	test("sunbeam misses when random >= sunbeam chance", () => {
		const r = rollLucky({
			isFirstTimeUser: false,
			preFirstTicklesIncludingThis: 0,
			sunBeamActive: true,
			now: BEFORE_BOOST,
			random: fixedRandom(LUCKY_TRIGGER_CHANCE_SUNBEAM + 0.01),
		});
		expect(r.triggerNow).toBe(false);
		expect(r.reason).toBe("miss");
	});

	test("boost-window chance is 12% (not 5%)", () => {
		// Random between steady (5%) and boost (12%) → should hit boost.
		const r = rollLucky({
			isFirstTimeUser: false,
			preFirstTicklesIncludingThis: 0,
			sunBeamActive: false,
			now: BEFORE_BOOST,
			random: fixedRandom((LUCKY_TRIGGER_CHANCE + LUCKY_TRIGGER_CHANCE_BOOST) / 2),
		});
		expect(r.triggerNow).toBe(true);
		expect(r.reason).toBe("boost");
	});

	test("steady-state chance after boost window expires", () => {
		// Same random as previous test but past the boost window → miss.
		const r = rollLucky({
			isFirstTimeUser: false,
			preFirstTicklesIncludingThis: 0,
			sunBeamActive: false,
			now: AFTER_BOOST,
			random: fixedRandom((LUCKY_TRIGGER_CHANCE + LUCKY_TRIGGER_CHANCE_BOOST) / 2),
		});
		expect(r.triggerNow).toBe(false);
		expect(r.reason).toBe("miss");
	});

	test("steady-state hits below 5%", () => {
		const r = rollLucky({
			isFirstTimeUser: false,
			preFirstTicklesIncludingThis: 0,
			sunBeamActive: false,
			now: AFTER_BOOST,
			random: fixedRandom(LUCKY_TRIGGER_CHANCE - 0.01),
		});
		expect(r.triggerNow).toBe(true);
		expect(r.reason).toBe("steady");
	});

	test("misses just above steady-state chance", () => {
		const r = rollLucky({
			isFirstTimeUser: false,
			preFirstTicklesIncludingThis: 0,
			sunBeamActive: false,
			now: AFTER_BOOST,
			random: fixedRandom(LUCKY_TRIGGER_CHANCE + 0.01),
		});
		expect(r.triggerNow).toBe(false);
	});
});
