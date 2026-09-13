/* eslint-disable @typescript-eslint/no-require-imports -- mock factories load render primitives after Jest hoisting */
// The friend row's doors. Today's BLESSING stays out on the rail — one tap from
// rest. Everything else (visit · curse · pin · profile) appears below the
// identity when the row is tapped. One row is open at a time, and the friend's
// name remains visible above its actions.
//
// A curse therefore costs expand → arm → tap. A spent allowance rests every
// door of that mode, and a friend who already has today's ritual says so.

import fs from "node:fs";
import path from "node:path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockRpcAction = jest.fn();
jest.mock("@/utils/rpc", () => ({
	rpc: jest.fn(async () => null),
	rpcAction: (...args: unknown[]) => mockRpcAction(...args),
}));
jest.mock("expo-haptics", () => ({
	notificationAsync: jest.fn().mockResolvedValue(undefined),
	NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));
jest.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlag: () => false }));
jest.mock("expo-router/react-navigation", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/components/ui/PrestigeAvatar", () => ({ PrestigeAvatar: () => null }));
jest.mock("@/components/PorchRoundLaunchCard", () => ({
	PorchRoundLaunchCard: () => null,
}));
jest.mock("@/components/BarnVisitModal", () => ({ BarnVisitModal: () => null }));
jest.mock("@/components/UserSheet", () => ({ UserSheet: () => null }));
const mockToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
	showToast: (...args: unknown[]) => mockToast(...args),
	ToastHost: () => null,
}));
jest.mock("@/utils/supabase", () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

import { FriendsList } from "@/components/Friends";
import { dailyRitual } from "@/utils/rituals";
import { MOTION } from "@/constants/theme";
import type { Profile } from "@/utils/friendships";

const FRIENDS = [
	{ id: "f1", username: "alice", discriminator: "0001" },
	{ id: "f2", username: "bob", discriminator: "0002" },
] as unknown as Profile[];

// The full allowance, unless a test says otherwise.
const STATUS = { ok: true, bless_used: 0, bless_cap: 3, curse_used: 0, curse_cap: 3 };

function serve(castReply: Record<string, unknown>, status = STATUS) {
	mockRpcAction.mockImplementation(async (name: string) => {
		if (name === "ritual_status") return status;
		if (name === "barn_visit_status" || name === "barn_pair_locks") {
			return { ok: false, reason: "unavailable" };
		}
		return castReply;
	});
}

const HANDLERS = {
	onToggleFavorite: jest.fn(),
	onPick: jest.fn(),
	onVisit: jest.fn(),
};

function renderList() {
	return TestRenderer.create(
		<FriendsList
			friends={FRIENDS}
			crewNames={new Map()}
			loaded
			loadFailed={false}
			onRetry={jest.fn()}
			visitsSpent={false}
			pairLocked={new Set()}
			visitStreaks={new Map()}
			favorites={new Set()}
			onToggleFavorite={HANDLERS.onToggleFavorite}
			onPick={HANDLERS.onPick}
			onVisit={HANDLERS.onVisit}
		/>
	);
}

async function mountList() {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = renderList();
	});
	return r;
}

// The Pressable inside the Sticker — where the press and the a11y props land.
function pressableFor(r: TestRenderer.ReactTestRenderer, testID: string) {
	return r.root.findAll(
		(n) => n.props.testID === testID && !!n.props.accessibilityRole
	)[0];
}

function doorFor(
	r: TestRenderer.ReactTestRenderer,
	mode: "bless" | "curse",
	id: string
) {
	return pressableFor(r, `ritual-door-${mode}-${id}`);
}

function rowFor(r: TestRenderer.ReactTestRenderer, id: string) {
	return pressableFor(r, `friend-row-${id}`);
}

/** Are this friend's inline actions mounted? */
function actionsOpen(r: TestRenderer.ReactTestRenderer, id: string) {
	return (
		r.root.findAll((n) => n.props.testID === `friend-profile-${id}`).length > 0
	);
}

async function tap(node: TestRenderer.ReactTestInstance) {
	await act(async () => {
		node.props.onPress();
		await Promise.resolve();
	});
}

/** Open a row's inline actions — the only way to reach curse / visit / pin. */
async function expand(r: TestRenderer.ReactTestRenderer, id: string) {
	await tap(rowFor(r, id));
}

describe("friend-row ritual doors", () => {
	beforeEach(() => {
		mockRpcAction.mockReset();
		mockToast.mockClear();
		HANDLERS.onToggleFavorite.mockClear();
		HANDLERS.onPick.mockClear();
		HANDLERS.onVisit.mockClear();
		serve({ ok: true });
	});

	test("the bless door casts on ONE tap, on the right friend", async () => {
		const r = await mountList();
		await tap(doorFor(r, "bless", "f2"));
		expect(mockRpcAction).toHaveBeenCalledWith("send_blessing", {
			target_user_id: "f2",
		});
		// alice's door was not touched.
		expect(mockRpcAction).not.toHaveBeenCalledWith("send_blessing", {
			target_user_id: "f1",
		});
		act(() => r.unmount());
	});

	test("the bless door names its target, its ritual and its consequence", async () => {
		const r = await mountList();
		const door = doorFor(r, "bless", "f1");
		expect(door.props.accessibilityLabel).toBe(
			`Bless alice with ${dailyRitual("bless").name}`
		);
		expect(door.props.accessibilityHint).toContain("can't be taken back");
		expect(door.props.accessibilityState).toEqual(
			expect.objectContaining({ disabled: false })
		);
		act(() => r.unmount());
	});

	test("a sent blessing rests that friend's door and says so", async () => {
		const r = await mountList();
		await tap(doorFor(r, "bless", "f1"));
		const door = doorFor(r, "bless", "f1");
		expect(door.props.accessibilityLabel).toBe(
			`Blessed alice with ${dailyRitual("bless").name} today`
		);
		expect(door.props.accessibilityState.disabled).toBe(true);
		// bob's door is untouched — the memory is per friend.
		expect(doorFor(r, "bless", "f2").props.accessibilityState.disabled).toBe(false);
		act(() => r.unmount());
	});

	test("the curse door arms on the first tap and casts on the second", async () => {
		const r = await mountList();
		// The curse is not on the rail — it costs an expand to reach.
		expect(doorFor(r, "curse", "f1")).toBeUndefined();
		await expand(r, "f1");
		await tap(doorFor(r, "curse", "f1"));
		expect(mockRpcAction).not.toHaveBeenCalledWith("send_curse", expect.anything());
		const armed = doorFor(r, "curse", "f1");
		expect(armed.props.accessibilityLabel).toBe("Tap again to curse alice");
		expect(armed.props.accessibilityState).toEqual(
			expect.objectContaining({ expanded: true })
		);

		await tap(armed);
		expect(mockRpcAction).toHaveBeenCalledWith("send_curse", {
			target_user_id: "f1",
		});
		act(() => r.unmount());
	});

	test("an armed curse disarms when the window passes", async () => {
		jest.useFakeTimers();
		try {
			let r!: TestRenderer.ReactTestRenderer;
			await act(async () => {
				r = renderList();
			});
			await expand(r, "f1");
			await tap(doorFor(r, "curse", "f1"));
			expect(doorFor(r, "curse", "f1").props.accessibilityLabel).toBe(
				"Tap again to curse alice"
			);

			await act(async () => {
				jest.advanceTimersByTime(MOTION.beat * 3 + 1);
			});
			expect(doorFor(r, "curse", "f1").props.accessibilityLabel).toBe(
				`Curse alice with ${dailyRitual("curse").name}`
			);

			// The next tap re-arms rather than casting.
			await tap(doorFor(r, "curse", "f1"));
			expect(mockRpcAction).not.toHaveBeenCalledWith("send_curse", expect.anything());
			act(() => r.unmount());
		} finally {
			jest.useRealTimers();
		}
	});

	test("daily_cap rests every door of that mode, not just the one tapped", async () => {
		serve({ ok: false, reason: "daily_cap" });
		const r = await mountList();
		await tap(doorFor(r, "bless", "f1"));
		expect(doorFor(r, "bless", "f1").props.accessibilityLabel).toBe(
			"All 3 blessings used today"
		);
		expect(doorFor(r, "bless", "f2").props.accessibilityState.disabled).toBe(true);
		// The curse side keeps its own allowance.
		await expand(r, "f1");
		expect(doorFor(r, "curse", "f1").props.accessibilityState.disabled).toBe(false);
		act(() => r.unmount());
	});

	test("a spent allowance rests the doors before any tap", async () => {
		serve({ ok: true }, { ...STATUS, bless_used: 3 });
		const r = await mountList();
		expect(doorFor(r, "bless", "f1").props.accessibilityState.disabled).toBe(true);
		await expand(r, "f1");
		expect(doorFor(r, "curse", "f1").props.accessibilityState.disabled).toBe(false);
		act(() => r.unmount());
	});

	test("already_blessed_today reads as done, with the reset on the label", async () => {
		serve({ ok: false, reason: "already_blessed_today" });
		const r = await mountList();
		await tap(doorFor(r, "bless", "f1"));
		const door = doorFor(r, "bless", "f1");
		expect(door.props.accessibilityLabel).toMatch(
			/^Already blessed alice today; next in /
		);
		expect(door.props.accessibilityState.disabled).toBe(true);
		expect(mockToast).toHaveBeenCalledWith(
			expect.objectContaining({ tone: "fail" })
		);
		act(() => r.unmount());
	});

	test("today's rituals are named once, above the list", async () => {
		const r = await mountList();
		const strip = r.root.findByProps({ testID: "ritual-strip-bless" });
		expect(strip.props.label).toBe(`${dailyRitual("bless").name} · 3 left`);
		const curse = r.root.findByProps({ testID: "ritual-strip-curse" });
		expect(curse.props.label).toBe(`${dailyRitual("curse").name} · 3 left`);
		act(() => r.unmount());
	});

	test("the strip counts down as rituals are cast", async () => {
		const r = await mountList();
		await tap(doorFor(r, "bless", "f1"));
		expect(r.root.findByProps({ testID: "ritual-strip-bless" }).props.label).toBe(
			`${dailyRitual("bless").name} · 2 left`
		);
		act(() => r.unmount());
	});
});

describe("friend-row inline actions", () => {
	beforeEach(() => {
		mockRpcAction.mockReset();
		mockToast.mockClear();
		HANDLERS.onToggleFavorite.mockClear();
		HANDLERS.onPick.mockClear();
		HANDLERS.onVisit.mockClear();
		serve({ ok: true });
	});

	test("at rest the row carries ONE option: today's blessing", async () => {
		const r = await mountList();
		expect(doorFor(r, "bless", "f1")).toBeDefined();
		expect(actionsOpen(r, "f1")).toBe(false);
		expect(rowFor(r, "f1").props.accessibilityState.expanded).toBe(false);
		expect(rowFor(r, "f1").props.accessibilityHint).toBe("Shows quick actions");
		act(() => r.unmount());
	});

	test("tapping a row opens its actions; tapping it again closes and unmounts them", async () => {
		const r = await mountList();
		await expand(r, "f1");
		expect(actionsOpen(r, "f1")).toBe(true);
		expect(rowFor(r, "f1").props.accessibilityState.expanded).toBe(true);
		expect(rowFor(r, "f1").props.accessibilityHint).toBe("Hides quick actions");

		await tap(rowFor(r, "f1"));
		expect(rowFor(r, "f1").props.accessibilityState.expanded).toBe(false);
		expect(actionsOpen(r, "f1")).toBe(false);
		act(() => r.unmount());
	});

	test("only one row is expanded at a time", async () => {
		const r = await mountList();
		await expand(r, "f1");
		await expand(r, "f2");
		expect(rowFor(r, "f1").props.accessibilityState.expanded).toBe(false);
		expect(rowFor(r, "f2").props.accessibilityState.expanded).toBe(true);
		act(() => r.unmount());
	});

	test("Visit and Profile call their handlers, then close and unmount the actions", async () => {
		const r = await mountList();
		await expand(r, "f2");
		await tap(pressableFor(r, "friend-visit-f2"));
		expect(HANDLERS.onVisit).toHaveBeenCalledWith(
			expect.objectContaining({ id: "f2" })
		);
		expect(rowFor(r, "f2").props.accessibilityState.expanded).toBe(false);
		expect(actionsOpen(r, "f2")).toBe(false);

		await expand(r, "f2");
		await tap(pressableFor(r, "friend-profile-f2"));
		expect(HANDLERS.onPick).toHaveBeenCalledWith("f2");
		expect(rowFor(r, "f2").props.accessibilityState.expanded).toBe(false);
		expect(actionsOpen(r, "f2")).toBe(false);
		act(() => r.unmount());
	});

	test("Pin appears with the inline actions, not at rest", async () => {
		const r = await mountList();
		expect(r.root.findAll((n) => n.props.testID === "friend-pin-f1")).toHaveLength(0);
		await expand(r, "f1");
		await tap(pressableFor(r, "friend-pin-f1"));
		expect(HANDLERS.onToggleFavorite).toHaveBeenCalledWith("f1");
		act(() => r.unmount());
	});

	test("closing the row disarms an armed curse", async () => {
		const r = await mountList();
		await expand(r, "f1");
		await tap(doorFor(r, "curse", "f1"));
		expect(doorFor(r, "curse", "f1").props.accessibilityLabel).toBe(
			"Tap again to curse alice"
		);
		// Open another row — the first closes, and its arm drops with it.
		await expand(r, "f2");
		await expand(r, "f1");
		expect(doorFor(r, "curse", "f1").props.accessibilityLabel).toBe(
			`Curse alice with ${dailyRitual("curse").name}`
		);
		expect(mockRpcAction).not.toHaveBeenCalledWith("send_curse", expect.anything());
		act(() => r.unmount());
	});
});

describe("the ListRow primitive's text column", () => {
	// The root cause of the cut-off action icons: Yoga's automatic minimum size
	// is CONTENT size, so a `flex: 1` column without `minWidth: 0` cannot shrink
	// below its widest child and pushes the trailing rail off the card.
	test("can shrink below its content width", () => {
		const source = fs.readFileSync(
			path.join(process.cwd(), "components/ui/ListRow.tsx"),
			"utf8"
		);
		const text = source.slice(source.indexOf("\ttext: {"));
		expect(text.slice(0, text.indexOf("},"))).toContain("minWidth: 0");
	});
});
