import fs from "fs";
import path from "path";
import {
	MATCH_INVITE_CATEGORY,
	NOTIFICATION_SCREENS,
	PLAY_ACTION,
	PLAY_DISMISS_ACTION,
	routeForPush,
	routeForScreen,
	responseConsumeKey,
	planTapRoute,
	tapTargetFromResponse,
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
			expect.arrayContaining(["account", "achievements", "friends", "season", "shop", "trade", "pen"])
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

	test("trough routes to the Barn tab (its row is on the Barn button's fan)", () => {
		expect(routeForScreen("trough")).toBe("/");
	});

	test("pen routes to the Pen (the errand's homecoming waits on its corkboard)", () => {
		expect(routeForScreen("pen")).toBe("/pen");
	});

	test("play routes to the Play hub (sent by the Render play server, not a migration)", () => {
		expect(routeForScreen("play")).toBe("/play");
		expect(NOTIFICATION_SCREENS).toContain("play");
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

	// An unmanaged native Modal (the Snout Deep dig, a tab sheet) holds the
	// popup queue. Replacing the Stack under it hides its host Modal while a
	// sheet nested inside may still be presented — iOS dismisses the sheet and
	// strands the host, invisible over the whole app (the 2026-09-20 freeze).
	test("known screen + router ready + an unmanaged Modal held → defer until the hold lifts", () => {
		expect(planTapRoute("season", true, true)).toEqual({
			action: "defer",
			path: "/season",
		});
		expect(planTapRoute("season", true, false)).toEqual({
			action: "navigate",
			path: "/season",
		});
	});

	test("the root layout routes a tap through the hold and flushes on its lift", () => {
		const layout = fs.readFileSync(path.join(__dirname, "..", "app", "_layout.tsx"), "utf8");
		expect(layout).toMatch(/planTapRoute\(\s*(?:screen|target),\s*routerReadyRef\.current,\s*popupHeldRef\.current,?\s*\)/);
		expect(layout).toMatch(/if \(loaded && authChecked && !popupHeld && pendingRouteRef\.current\)/);
	});

	// Params ride the same consume-once + defer path: the layout hands the
	// whole tap target over, never just its screen.
	test("the root layout passes each tap's full target (screen + params + action)", () => {
		const layout = fs.readFileSync(path.join(__dirname, "..", "app", "_layout.tsx"), "utf8");
		const calls = layout.match(/routeForTap\(tapTargetFromResponse\(res\)\)/g) ?? [];
		expect(calls).toHaveLength(2); // cold-start read + warm listener
		expect(layout).not.toMatch(/routeForTap\(data\?\.screen\)/);
	});

	test("a play tap with params defers its full path until the router is ready", () => {
		expect(planTapRoute({ screen: "play", invite: "ABCD2345" }, false)).toEqual({
			action: "defer",
			path: "/play/ABCD2345",
		});
		expect(planTapRoute({ screen: "play", room: "0000aaaa-1111" }, true)).toEqual({
			action: "navigate",
			path: "/match/0000aaaa-1111",
		});
		expect(planTapRoute({ screen: "play", invite: "ABCD2345" }, true, true)).toEqual({
			action: "defer",
			path: "/play/ABCD2345",
		});
		expect(planTapRoute({ screen: "play", invite: "ABCD2345", action: PLAY_DISMISS_ACTION }, true)).toEqual({
			action: "ignore",
			path: null,
		});
	});
});

describe("routeForPush — params for matchmade play (2026-10-04)", () => {
	test("an invite push opens that invite", () => {
		expect(routeForPush({ screen: "play", invite: "ABCD2345" })).toBe("/play/ABCD2345");
		expect(routeForPush({ screen: "play", invite: "abcd2345" })).toBe("/play/ABCD2345");
	});

	test("the invite push's ticklethepig:// url works on its own", () => {
		expect(routeForPush({ screen: "play", url: "ticklethepig://play/ABCD2345" })).toBe("/play/ABCD2345");
		expect(routeForPush({ screen: "play", url: "https://ticklethepig.com/play/ABCD2345" })).toBe("/play/ABCD2345");
	});

	test("a your-turn push opens the table", () => {
		expect(routeForPush({ screen: "play", room: "0f3a9c2e-1b7d-4e5f-9a6b-2c8d0e1f3a4b" })).toBe(
			"/match/0f3a9c2e-1b7d-4e5f-9a6b-2c8d0e1f3a4b"
		);
	});

	test("the invite wins when a push carries both (an invitee is not seated yet)", () => {
		expect(routeForPush({ screen: "play", invite: "ABCD2345", room: "0000aaaa-1111" })).toBe("/play/ABCD2345");
	});

	test("malformed params fall back to the Play hub, never a broken route", () => {
		expect(routeForPush({ screen: "play", invite: "ABCD1111" })).toBe("/play"); // 1 is not in the alphabet
		expect(routeForPush({ screen: "play", room: "../../etc" })).toBe("/play");
		expect(routeForPush({ screen: "play", invite: 42 as unknown as string })).toBe("/play");
		expect(routeForPush({ screen: "play" })).toBe("/play");
	});

	test("params only matter for play; other screens route as before", () => {
		expect(routeForPush({ screen: "season", invite: "ABCD2345", room: "0000aaaa-1111" })).toBe("/season");
		expect(routeForPush("friends")).toBe("/friends");
		expect(routeForPush({ screen: "nonsense", invite: "ABCD2345" })).toBeNull();
		expect(routeForPush(null)).toBeNull();
		expect(routeForPush(undefined)).toBeNull();
	});

	test("'Play' routes like a plain tap; 'Not now' is a dismissal", () => {
		expect(routeForPush({ screen: "play", invite: "ABCD2345", action: PLAY_ACTION })).toBe("/play/ABCD2345");
		expect(routeForPush({ screen: "play", invite: "ABCD2345", action: "expo.modules.notifications.actions.DEFAULT" })).toBe(
			"/play/ABCD2345"
		);
		expect(routeForPush({ screen: "play", invite: "ABCD2345", action: PLAY_DISMISS_ACTION })).toBeNull();
	});

	test("the invite category id is iOS-safe (no ':' or '-')", () => {
		expect(MATCH_INVITE_CATEGORY).toBe("match_invite");
		expect(MATCH_INVITE_CATEGORY).not.toMatch(/[:-]/);
	});
});

describe("tapTargetFromResponse — reading a notification response", () => {
	const response = (data: unknown, actionIdentifier?: string) => ({
		actionIdentifier,
		notification: { request: { content: { data } } },
	});

	test("reads screen, params and the tapped action", () => {
		expect(
			tapTargetFromResponse(
				response(
					{ screen: "play", invite: "ABCD2345", url: "ticklethepig://play/ABCD2345", inviteId: "x", expiresAt: 1 },
					PLAY_ACTION
				)
			)
		).toEqual({ screen: "play", invite: "ABCD2345", room: null, url: "ticklethepig://play/ABCD2345", action: PLAY_ACTION });
	});

	test("keeps the old screen-only payloads routing exactly as before", () => {
		const target = tapTargetFromResponse(response({ screen: "season" }));
		expect(target).toMatchObject({ screen: "season", invite: null, room: null });
		expect(planTapRoute(target, true)).toEqual({ action: "navigate", path: "/season" });
	});

	test("never throws on a malformed payload", () => {
		expect(tapTargetFromResponse(response(null))).toMatchObject({ screen: null });
		expect(tapTargetFromResponse(response("screen=play"))).toMatchObject({ screen: null });
		expect(tapTargetFromResponse(response({ screen: 7, room: {} }))).toMatchObject({ screen: null, room: null });
		expect(tapTargetFromResponse(null)).toMatchObject({ screen: null, action: null });
		expect(planTapRoute(tapTargetFromResponse(response(undefined)), true)).toEqual({ action: "ignore", path: null });
	});
});
