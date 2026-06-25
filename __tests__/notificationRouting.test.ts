import {
	NOTIFICATION_SCREENS,
	routeForScreen,
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

	test("unknown / missing screen → null (no navigation)", () => {
		expect(routeForScreen("nonsense")).toBeNull();
		expect(routeForScreen(undefined)).toBeNull();
		expect(routeForScreen(null)).toBeNull();
	});
});
