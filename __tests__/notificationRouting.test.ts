import {
	NOTIFICATION_SCREENS,
	routeForScreen,
	responseConsumeKey,
	planTapRoute,
} from "../utils/notificationRouting";

describe("routeForScreen — push deep-link map", () => {
	test("every server-sent screen resolves to a route (no dead deep-links)", () => {
		for (const s of NOTIFICATION_SCREENS) {
			expect(routeForScreen(s)).not.toBeNull();
		}
	});

	test("trade and friends both land on the Friends tab (Inbox)", () => {
		expect(routeForScreen("trade")).toBe("/friends");
		expect(routeForScreen("friends")).toBe("/friends");
	});

	test("season routes to the season tab (this was the missing branch)", () => {
		expect(routeForScreen("season")).toBe("/season");
	});

	test("achievements + account route to their screens", () => {
		expect(routeForScreen("achievements")).toBe("/achievements");
		expect(routeForScreen("account")).toBe("/account");
	});

	test("trough routes to the Shop tab (where item drives live)", () => {
		expect(routeForScreen("trough")).toBe("/shop");
	});

	test("unknown / missing screen → null (no navigation)", () => {
		expect(routeForScreen("nonsense")).toBeNull();
		expect(routeForScreen(undefined)).toBeNull();
		expect(routeForScreen(null)).toBeNull();
	});
});

describe("responseConsumeKey — stale-tap consume-once guard (spec-18 suspect 2)", () => {
	const res = (identifier: string | null | undefined, date?: number | null) => ({
		notification: { date, request: { identifier } },
	});

	test("null / undefined response → null (nothing to key on)", () => {
		expect(responseConsumeKey(null)).toBeNull();
		expect(responseConsumeKey(undefined)).toBeNull();
	});

	test("missing identifier → null (can't dedupe, don't guard)", () => {
		expect(responseConsumeKey(res(null, 123))).toBeNull();
		expect(responseConsumeKey(res(undefined, 123))).toBeNull();
	});

	test("identifier + date form the key", () => {
		expect(responseConsumeKey(res("abc", 1700000000000))).toBe(
			"abc:1700000000000"
		);
	});

	test("the SAME response yields the SAME key (a replay is caught)", () => {
		const a = res("abc", 1700000000000);
		expect(responseConsumeKey(a)).toBe(responseConsumeKey(a));
	});

	test("a different tap (different date) yields a different key", () => {
		expect(responseConsumeKey(res("abc", 1))).not.toBe(
			responseConsumeKey(res("abc", 2))
		);
	});

	test("missing date still keys off the identifier (stable, empty date slot)", () => {
		expect(responseConsumeKey(res("abc"))).toBe("abc:");
	});
});

describe("planTapRoute — router-ready deferral (spec-18 suspect 3)", () => {
	test("unknown/absent screen → ignore, no path", () => {
		expect(planTapRoute("nonsense", true)).toEqual({
			action: "ignore",
			path: null,
		});
		expect(planTapRoute(undefined, false)).toEqual({
			action: "ignore",
			path: null,
		});
	});

	test("known screen + router ready → navigate now", () => {
		expect(planTapRoute("season", true)).toEqual({
			action: "navigate",
			path: "/season",
		});
	});

	test("known screen + router NOT ready → defer (never navigate pre-mount)", () => {
		expect(planTapRoute("friends", false)).toEqual({
			action: "defer",
			path: "/friends",
		});
	});
});
