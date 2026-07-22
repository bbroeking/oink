import fs from "fs";
import path from "path";
import {
	NOTIFICATION_SCREENS,
	routeForScreen,
	responseConsumeKey,
	planTapRoute,
} from "../utils/notificationRouting";

// Read the REAL server contract instead of trusting a hand-kept list: scan the
// migrations for the `screen` literals the push payloads actually emit. The
// server sets them via `jsonb_build_object(... 'screen', '<x>' ...)`, so every
// emit is a `'screen', '<value>'` pair. (The old test guarded a maintained
// NOTIFICATION_SCREENS array that itself drifted from the server — a `shop`
// push had no route for builds. This closes that loop at the source.)
function serverEmittedScreens(): string[] {
	const dir = path.join(__dirname, "..", "supabase", "migrations");
	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
	const re = /'screen'\s*,\s*'([a-z_]+)'/g;
	const found = new Set<string>();
	for (const f of files) {
		const sql = fs.readFileSync(path.join(dir, f), "utf8");
		let m: RegExpExecArray | null;
		while ((m = re.exec(sql)) !== null) found.add(m[1]);
	}
	return [...found].sort();
}

describe("routeForScreen — push deep-link map", () => {
	const emitted = serverEmittedScreens();

	test("the migrations actually emit screens (extraction isn't silently empty)", () => {
		// A guard on the guard: if the regex or path breaks, the loop below would
		// vacuously pass. Anchor on the screens we know the server sends today.
		expect(emitted).toEqual(
			expect.arrayContaining(["account", "achievements", "friends", "season", "shop", "trade"])
		);
	});

	test("every server-emitted screen resolves to a route (no dead deep-links)", () => {
		for (const s of emitted) {
			expect(routeForScreen(s)).not.toBeNull();
		}
	});

	test("every server-emitted screen is in the accepted-screen set", () => {
		for (const s of emitted) {
			expect(NOTIFICATION_SCREENS).toContain(s);
		}
	});

	test("shop routes to the Shop tab (was falling through to null)", () => {
		expect(routeForScreen("shop")).toBe("/shop");
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
