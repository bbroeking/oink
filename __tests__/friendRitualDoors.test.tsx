/* eslint-disable @typescript-eslint/no-require-imports -- mock factories load render primitives after Jest hoisting */
// The friend row's actions menu. Every verb the row owns lives in ONE anchored
// panel the row's "…" opens: visit · bless · curse · pin · profile, five equal
// cells sliding over the name column. Exactly one panel is out at a time — a
// single id at the list level — and the identity itself stays a second door to
// the profile.
//
// A curse still costs two taps inside the panel — arm, then cast — because it
// is hostile and irreversible, and an arm you cannot see is an arm that fires
// by surprise, so it dies with the panel as well as on its own timer. A spent
// allowance rests every cell of that mode, and a friend who already has today's
// ritual says so.

import fs from "node:fs";
import path from "node:path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
jest.mock("@/components/BarnVisitModal", () => ({ BarnVisitModal: () => null }));
jest.mock("@/components/UserSheet", () => ({ UserSheet: () => null }));
// The panel's entrance is a spring; under Reduce Motion it takes the rest pose
// and unmounts immediately, which is the mount/unmount contract these tests are
// about. (The spring itself is covered by the motion policy's own tests.)
jest.mock("@/hooks/useMotionPolicy", () => ({
	MOTION_DURATION: {
		feedback: 120,
		state: 220,
		modal: 300,
		celebration: 450,
		crossfade: 150,
	},
	MotionPolicyProvider: ({ children }: { children: React.ReactNode }) => children,
	useMotionPolicy: () => ({
		reduceMotion: true,
		allowDecorativeMotion: false,
		largeTransition: "crossfade" as const,
		duration: (standardMs: number) => standardMs,
	}),
}));
const mockToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
	showToast: (...args: unknown[]) => mockToast(...args),
}));
const mockBubble = jest.fn();
jest.mock("@/components/ui/RitualBubble", () => ({
	showRitualBubble: (...args: unknown[]) => mockBubble(...args),
	ToastHost: () => null,
}));
jest.mock("@/utils/supabase", () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

import { FriendsList } from "@/components/Friends";
import { castBlurb, dailyRitual } from "@/utils/rituals";
import { LIST_BLEED, MOTION, TAP_MIN, TYPE } from "@/constants/theme";
import { RITUAL_DOOR } from "@/hooks/useRitualDoor";
import type { Profile } from "@/utils/friendships";

const FRIENDS = [
	{ id: "f1", username: "alice", discriminator: "0001" },
	{ id: "f2", username: "bob", discriminator: "0002" },
] as unknown as Profile[];

// The full allowance, unless a test says otherwise.
const STATUS = { ok: true, bless_used: 0, bless_cap: 3, curse_used: 0, curse_cap: 3 };

function serve(
	castReply: Record<string, unknown>,
	// A status read can also FAIL — the allowance is then unknown, which is a
	// state the list has to render (by rendering no count line at all).
	status: Record<string, unknown> = STATUS
) {
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

// The ritual sheet the strip opens is the `Sheet` panel, which reads safe-area
// insets.
const METRICS = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

function renderList(friends: Profile[] = FRIENDS) {
	return (
		<SafeAreaProvider initialMetrics={METRICS}>
			<FriendsList
				friends={friends}
				crewNames={new Map()}
				loaded
				loadFailed={false}
				onRetry={jest.fn()}
				visitsSpent={false}
				pairLocked={new Set()}
				visitStreaks={new Map()}
				friendWishes={new Map()}
				myBag={[]}
				favorites={new Set()}
				onToggleFavorite={HANDLERS.onToggleFavorite}
				onPick={HANDLERS.onPick}
				onVisit={HANDLERS.onVisit}
			/>
		</SafeAreaProvider>
	);
}

function textOf(node: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	const walk = (n: TestRenderer.ReactTestInstance | string) => {
		if (typeof n === "string") out.push(n);
		else for (const c of n.children ?? []) walk(c);
	};
	walk(node);
	return out.join("");
}

/** One half of the count line above the list, as a player reads it. */
function halfText(r: TestRenderer.ReactTestRenderer, mode: "bless" | "curse") {
	const half = r.root.findAll(
		(n) => n.props.testID === `ritual-strip-${mode}` && !!n.props.accessibilityRole
	)[0];
	// What it says and what a screen reader hears are the same sentence.
	expect(half.props.accessibilityLabel).toBe(textOf(half));
	return textOf(half);
}

/** The cast notice on one row's meta line, or null when the row has none. */
// The image inside a ritual mark — its `source` is the cast ritual's art.
function markArt(notice: TestRenderer.ReactTestInstance) {
	return notice.findAll((n) => n.props.resizeMode === "contain" && !!n.props.source)[0]
		?.props.source;
}

function noticeFor(
	r: TestRenderer.ReactTestRenderer,
	mode: "bless" | "curse",
	id: string
) {
	const row = r.root.findAll((n) => n.props.testID === `friend-row-${id}`)[0];
	return (
		row.findAll((n) => n.props.testID === `ritual-notice-${mode}` && !!n.props.accessible)[0] ?? null
	);
}

async function mountList() {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(renderList());
	});
	return r;
}

// The Pressable inside the Sticker — where the press and the a11y props land.
function pressableFor(r: TestRenderer.ReactTestRenderer, testID: string) {
	return r.root.findAll(
		(n) => n.props.testID === testID && !!n.props.accessibilityRole
	)[0];
}

/** The panel is mounted only while it is out — never hidden in the tree. */
function panelMounted(r: TestRenderer.ReactTestRenderer, id: string) {
	return (
		r.root.findAll(
			(n) =>
				n.props.testID === `friend-menu-${id}` &&
				n.props.accessibilityRole === "menu"
		).length > 0
	);
}

function triggerFor(r: TestRenderer.ReactTestRenderer, id: string) {
	return pressableFor(r, `friend-menu-trigger-${id}`);
}

function cellFor(
	r: TestRenderer.ReactTestRenderer,
	key: "visit" | "bless" | "curse" | "pin" | "profile",
	id: string
) {
	return pressableFor(r, `friend-menu-${key}-${id}`);
}

function rowFor(r: TestRenderer.ReactTestRenderer, id: string) {
	return pressableFor(r, `friend-row-${id}`);
}

/** A touch anywhere on the list's root — the outside-tap hit test's own entry point. */
async function touchList(
	r: TestRenderer.ReactTestRenderer,
	pageX: number,
	pageY: number
) {
	const wrap = r.root.findAll(
		(n) => typeof n.props.onTouchStart === "function"
	)[0];
	await act(async () => {
		wrap.props.onTouchStart({ nativeEvent: { pageX, pageY } });
	});
}

async function tap(node: TestRenderer.ReactTestInstance) {
	await act(async () => {
		node.props.onPress();
		await Promise.resolve();
	});
}

/**
 * The React Native jest mock gives every host instance a `measureInWindow`
 * that never answers, so the panel's outside-touch hit test would never
 * complete. Hand every measurable node the same frame, and the hit test
 * becomes a real assertion about the touch point. (The rects only have to say
 * "the open boxes are here"; there is one panel and one trigger.)
 */
function frameEverythingAt(
	r: TestRenderer.ReactTestRenderer,
	box: { x: number; y: number; w: number; h: number }
) {
	for (const node of r.root.findAll(
		(n) => typeof (n.instance as { measureInWindow?: unknown } | null)
			?.measureInWindow === "function"
	)) {
		const instance = node.instance as unknown as {
			measureInWindow: (
				cb: (x: number, y: number, w: number, h: number) => void
			) => void;
		};
		instance.measureInWindow = (cb) => cb(box.x, box.y, box.w, box.h);
	}
}

/** Open a row's menu, the way a thumb does: one tap on its "…". */
async function openMenu(r: TestRenderer.ReactTestRenderer, id: string) {
	await tap(triggerFor(r, id));
}

describe("the friend row's actions menu", () => {
	beforeEach(() => {
		mockRpcAction.mockReset();
		mockToast.mockClear();
		mockBubble.mockClear();
		HANDLERS.onToggleFavorite.mockClear();
		HANDLERS.onPick.mockClear();
		HANDLERS.onVisit.mockClear();
		serve({ ok: true });
	});

	test("at rest nothing is out and every trigger says so", async () => {
		const r = await mountList();
		expect(panelMounted(r, "f1")).toBe(false);
		expect(panelMounted(r, "f2")).toBe(false);
		for (const id of ["f1", "f2"]) {
			const trigger = triggerFor(r, id);
			expect(trigger.props.accessibilityState.expanded).toBe(false);
			expect(trigger.props.accessibilityLabel).toBe(
				`Actions for ${id === "f1" ? "alice" : "bob"}`
			);
		}
		// The identity is still the profile door, and it is not a disclosure.
		expect(rowFor(r, "f1").props.accessibilityHint).toBe("Opens their profile");
		expect(rowFor(r, "f1").props.accessibilityState.expanded).toBeUndefined();
		act(() => r.unmount());
	});

	test("opening one row's menu mounts that row's panel and no other", async () => {
		const r = await mountList();
		await openMenu(r, "f2");
		expect(panelMounted(r, "f2")).toBe(true);
		expect(panelMounted(r, "f1")).toBe(false);
		expect(triggerFor(r, "f2").props.accessibilityState.expanded).toBe(true);
		expect(triggerFor(r, "f2").props.accessibilityLabel).toBe(
			"Hide actions for bob"
		);
		expect(triggerFor(r, "f1").props.accessibilityState.expanded).toBe(false);
		// All five cells, in the order the spec lays them out.
		for (const key of ["visit", "bless", "curse", "pin", "profile"] as const) {
			expect(cellFor(r, key, "f2")).toBeDefined();
			expect(cellFor(r, key, "f2").props.accessibilityRole).toBe("menuitem");
		}
		act(() => r.unmount());
	});

	test("the panel's cells follow the trigger in the rendered tree", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		const order = r.root
			.findAll((n) => typeof n.props.testID === "string")
			.map((n) => n.props.testID as string)
			.filter(
				(id) =>
					id === "friend-row-f1" ||
					id === "friend-menu-trigger-f1" ||
					id === "friend-menu-visit-f1"
			);
		expect(order.indexOf("friend-row-f1")).toBeLessThan(
			order.indexOf("friend-menu-trigger-f1")
		);
		expect(order.indexOf("friend-menu-trigger-f1")).toBeLessThan(
			order.indexOf("friend-menu-visit-f1")
		);
		act(() => r.unmount());
	});

	test("the trigger closes its own panel", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		await tap(triggerFor(r, "f1"));
		expect(panelMounted(r, "f1")).toBe(false);
		expect(triggerFor(r, "f1").props.accessibilityState.expanded).toBe(false);
		act(() => r.unmount());
	});

	test("opening one while another is out switches, never stacks", async () => {
		const r = await mountList();
		await openMenu(r, "f2");
		await openMenu(r, "f1");
		expect(panelMounted(r, "f1")).toBe(true);
		expect(panelMounted(r, "f2")).toBe(false);
		act(() => r.unmount());
	});

	test("Visit calls its handler for that friend and closes", async () => {
		const r = await mountList();
		await openMenu(r, "f2");
		await tap(cellFor(r, "visit", "f2"));
		expect(HANDLERS.onVisit).toHaveBeenCalledWith(
			expect.objectContaining({ id: "f2" })
		);
		expect(HANDLERS.onVisit).toHaveBeenCalledTimes(1);
		expect(panelMounted(r, "f2")).toBe(false);
		act(() => r.unmount());
	});

	test("Profile and the identity both open the profile", async () => {
		const r = await mountList();
		await openMenu(r, "f2");
		await tap(cellFor(r, "profile", "f2"));
		expect(HANDLERS.onPick).toHaveBeenCalledWith("f2");
		expect(panelMounted(r, "f2")).toBe(false);

		HANDLERS.onPick.mockClear();
		await tap(rowFor(r, "f1"));
		expect(HANDLERS.onPick).toHaveBeenCalledWith("f1");
		act(() => r.unmount());
	});

	test("Pin toggles and closes; the pushpin is visible without opening", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		const pin = cellFor(r, "pin", "f1");
		expect(pin.props.accessibilityLabel).toBe("Pin alice to the top");
		await tap(pin);
		expect(HANDLERS.onToggleFavorite).toHaveBeenCalledWith("f1");
		expect(HANDLERS.onToggleFavorite).toHaveBeenCalledTimes(1);
		expect(panelMounted(r, "f1")).toBe(false);
		// A pinned row wears the label and the selected chrome at rest.
		let pinned!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			pinned = TestRenderer.create(
				<FriendsList
					friends={FRIENDS}
					crewNames={new Map()}
					loaded
					loadFailed={false}
					onRetry={jest.fn()}
					visitsSpent={false}
					pairLocked={new Set()}
					visitStreaks={new Map()}
					friendWishes={new Map()}
					myBag={[]}
					favorites={new Set(["f1"])}
					onToggleFavorite={HANDLERS.onToggleFavorite}
					onPick={HANDLERS.onPick}
					onVisit={HANDLERS.onVisit}
				/>
			);
		});
		expect(rowFor(pinned, "f1").props.accessibilityLabel).toBe(
			"alice #0001, pinned"
		);
		expect(rowFor(pinned, "f1").props.accessibilityState.selected).toBe(true);
		await openMenu(pinned, "f1");
		expect(cellFor(pinned, "pin", "f1").props.accessibilityLabel).toBe(
			"Unpin alice from the top"
		);
		act(() => pinned.unmount());
		act(() => r.unmount());
	});

	test("a reload closes whatever was out", async () => {
		const r = await mountList();
		await openMenu(r, "f2");
		expect(panelMounted(r, "f2")).toBe(true);
		// A re-sort under the thumb is a new `friends` array.
		await act(async () => {
			r.update(renderList([...FRIENDS]));
		});
		expect(panelMounted(r, "f2")).toBe(false);
		act(() => r.unmount());
	});

	test("a touch outside the panel closes it", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		// The open boxes sit well away from the corner the touch lands in.
		frameEverythingAt(r, { x: 100, y: 100, w: 200, h: 80 });
		await touchList(r, 4, 4);
		expect(panelMounted(r, "f1")).toBe(false);
		act(() => r.unmount());
	});

	test("a touch inside the panel leaves it out", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		frameEverythingAt(r, { x: 0, y: 0, w: 400, h: 120 });
		await touchList(r, 40, 40);
		expect(panelMounted(r, "f1")).toBe(true);
		act(() => r.unmount());
	});

	test("one gesture on another row's trigger lands on that row", async () => {
		// The outside-touch hit test never claims the responder, so the touch
		// continues into the trigger it landed on: close A, then open B, and the
		// net state is B out.
		const r = await mountList();
		await openMenu(r, "f2");
		frameEverythingAt(r, { x: 100, y: 100, w: 200, h: 80 });
		await touchList(r, 4, 4);
		await openMenu(r, "f1");
		expect(panelMounted(r, "f1")).toBe(true);
		expect(panelMounted(r, "f2")).toBe(false);
		act(() => r.unmount());
	});

	test("dragging the list closes the panel", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		const list = r.root.findAll(
			(n) => typeof n.props.onScrollBeginDrag === "function"
		)[0];
		await act(async () => {
			list.props.onScrollBeginDrag();
		});
		expect(panelMounted(r, "f1")).toBe(false);
		act(() => r.unmount());
	});
});

describe("the menu's rituals", () => {
	beforeEach(() => {
		mockRpcAction.mockReset();
		mockToast.mockClear();
		mockBubble.mockClear();
		HANDLERS.onToggleFavorite.mockClear();
		HANDLERS.onPick.mockClear();
		HANDLERS.onVisit.mockClear();
		serve({ ok: true });
	});

	test("the bless cell casts on one tap, on the right friend, and closes", async () => {
		const r = await mountList();
		await openMenu(r, "f2");
		await tap(cellFor(r, "bless", "f2"));
		expect(mockRpcAction).toHaveBeenCalledWith("send_blessing", {
			target_user_id: "f2",
		});
		// alice's cell was not touched.
		expect(mockRpcAction).not.toHaveBeenCalledWith("send_blessing", {
			target_user_id: "f1",
		});
		expect(panelMounted(r, "f2")).toBe(false);
		act(() => r.unmount());
	});

	test("the bless cell names its target, its ritual and its consequence", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		const cell = cellFor(r, "bless", "f1");
		expect(cell.props.accessibilityLabel).toBe(
			`Bless alice with ${dailyRitual("bless").name}`
		);
		expect(cell.props.accessibilityHint).toContain("can't be taken back");
		expect(cell.props.accessibilityState).toEqual(
			expect.objectContaining({ disabled: false })
		);
		act(() => r.unmount());
	});

	test("a sent blessing rests that friend's cell and says so", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		await tap(cellFor(r, "bless", "f1"));
		await openMenu(r, "f1");
		const cell = cellFor(r, "bless", "f1");
		expect(cell.props.accessibilityLabel).toBe(
			`Blessed alice with ${dailyRitual("bless").name} today`
		);
		expect(cell.props.accessibilityState.disabled).toBe(true);
		// bob's cell is untouched — the memory is per friend.
		await openMenu(r, "f2");
		expect(cellFor(r, "bless", "f2").props.accessibilityState.disabled).toBe(
			false
		);
		act(() => r.unmount());
	});

	test("the curse arms on the first tap, keeping the panel out, and casts on the second", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		await tap(cellFor(r, "curse", "f1"));
		expect(mockRpcAction).not.toHaveBeenCalledWith("send_curse", expect.anything());
		// The panel stays out so the armed cell can be seen.
		expect(panelMounted(r, "f1")).toBe(true);
		const armed = cellFor(r, "curse", "f1");
		expect(armed.props.accessibilityLabel).toBe("Tap again to curse alice");
		expect(armed.props.accessibilityState).toEqual(
			expect.objectContaining({ expanded: true })
		);

		await tap(armed);
		expect(mockRpcAction).toHaveBeenCalledWith("send_curse", {
			target_user_id: "f1",
		});
		expect(panelMounted(r, "f1")).toBe(false);
		act(() => r.unmount());
	});

	test("an armed curse is dropped when the panel closes", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		await tap(cellFor(r, "curse", "f1"));
		expect(cellFor(r, "curse", "f1").props.accessibilityLabel).toBe(
			"Tap again to curse alice"
		);
		// Close it and come back: the arm is gone, so the next tap re-arms.
		await tap(triggerFor(r, "f1"));
		await openMenu(r, "f1");
		expect(cellFor(r, "curse", "f1").props.accessibilityLabel).toBe(
			`Curse alice with ${dailyRitual("curse").name}`
		);
		await tap(cellFor(r, "curse", "f1"));
		expect(mockRpcAction).not.toHaveBeenCalledWith("send_curse", expect.anything());
		act(() => r.unmount());
	});

	test("an armed curse disarms when the window passes", async () => {
		jest.useFakeTimers();
		try {
			let r!: TestRenderer.ReactTestRenderer;
			await act(async () => {
				r = TestRenderer.create(renderList());
			});
			await openMenu(r, "f1");
			await tap(cellFor(r, "curse", "f1"));
			expect(cellFor(r, "curse", "f1").props.accessibilityLabel).toBe(
				"Tap again to curse alice"
			);

			await act(async () => {
				jest.advanceTimersByTime(MOTION.beat * 3 + 1);
			});
			expect(cellFor(r, "curse", "f1").props.accessibilityLabel).toBe(
				`Curse alice with ${dailyRitual("curse").name}`
			);
			act(() => r.unmount());
		} finally {
			jest.useRealTimers();
		}
	});

	test("daily_cap rests every cell of that mode, not just the one tapped", async () => {
		serve({ ok: false, reason: "daily_cap" });
		const r = await mountList();
		await openMenu(r, "f1");
		await tap(cellFor(r, "bless", "f1"));
		await openMenu(r, "f1");
		expect(cellFor(r, "bless", "f1").props.accessibilityLabel).toBe(
			"All 3 blessings used today"
		);
		// The curse side keeps its own allowance.
		expect(cellFor(r, "curse", "f1").props.accessibilityState.disabled).toBe(
			false
		);
		await openMenu(r, "f2");
		expect(cellFor(r, "bless", "f2").props.accessibilityState.disabled).toBe(
			true
		);
		act(() => r.unmount());
	});

	test("a spent allowance rests the cells before any tap", async () => {
		serve({ ok: true }, { ...STATUS, bless_used: 3 });
		const r = await mountList();
		await openMenu(r, "f1");
		expect(cellFor(r, "bless", "f1").props.accessibilityState.disabled).toBe(
			true
		);
		expect(cellFor(r, "curse", "f1").props.accessibilityState.disabled).toBe(
			false
		);
		act(() => r.unmount());
	});

	test("already_blessed_today reads as done, with the reset on the label", async () => {
		serve({ ok: false, reason: "already_blessed_today" });
		const r = await mountList();
		await openMenu(r, "f1");
		await tap(cellFor(r, "bless", "f1"));
		await openMenu(r, "f1");
		const cell = cellFor(r, "bless", "f1");
		expect(cell.props.accessibilityLabel).toMatch(
			/^Already blessed alice today; next in /
		);
		expect(cell.props.accessibilityState.disabled).toBe(true);
		expect(mockToast).toHaveBeenCalledWith(
			expect.objectContaining({ tone: "fail" })
		);
		// A refusal has nothing to celebrate: no bubble.
		expect(mockBubble).not.toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("the count line counts down as rituals are cast", async () => {
		const r = await mountList();
		await openMenu(r, "f1");
		await tap(cellFor(r, "bless", "f1"));
		expect(halfText(r, "bless")).toBe("Two glimmer left");
		// The curse's own allowance is untouched by a blessing.
		expect(halfText(r, "curse")).toBe("three truffle left");
		act(() => r.unmount());
	});

	test("the list says how many of each are left, in words, in one line", async () => {
		const r = await mountList();
		expect(halfText(r, "bless")).toBe("Three glimmer left");
		expect(halfText(r, "curse")).toBe("three truffle left");
		// Names, art and what a ritual does are NOT on the list — they live in
		// the sheet the line opens, the row's panel, and the row's cast notice.
		const header = r.root.findAll(
			(n) => n.props.testID === "ritual-strip-bless"
		)[0].parent!;
		for (const mode of ["bless", "curse"] as const) {
			expect(textOf(header)).not.toContain(dailyRitual(mode).name);
			expect(textOf(header)).not.toContain(castBlurb(dailyRitual(mode).blurb));
		}
		act(() => r.unmount());
	});

	test("a spent allowance reads 'No'/'no', never a zero", async () => {
		serve(
			{ ok: true },
			{ ok: true, bless_used: 3, bless_cap: 3, curse_used: 2, curse_cap: 3 }
		);
		const r = await mountList();
		expect(halfText(r, "bless")).toBe("No glimmer left");
		expect(halfText(r, "curse")).toBe("one truffle left");
		act(() => r.unmount());
	});

	test("while the allowance is unknown the line is absent, never a placeholder", async () => {
		serve({ ok: true }, { ok: false, reason: "unavailable" });
		const r = await mountList();
		for (const mode of ["bless", "curse"] as const) {
			expect(
				r.root.findAll((n) => n.props.testID === `ritual-strip-${mode}`)
			).toHaveLength(0);
		}
		// The rows are still there — an unknown allowance is not an empty list.
		expect(r.root.findAll((n) => n.props.testID === "friend-row-f1").length)
			.toBeGreaterThan(0);
		act(() => r.unmount());
	});

	test("each half of the line is its own 44pt door into the ritual's sheet", async () => {
		const r = await mountList();
		for (const mode of ["bless", "curse"] as const) {
			const half = pressableFor(r, `ritual-strip-${mode}`);
			expect(half.props.accessibilityRole).toBe("button");
			// The line stays a line; the frame reaches TAP_MIN through hitSlop.
			const slop = half.props.hitSlop as { top: number; bottom: number };
			expect(slop.top + slop.bottom + TYPE.kicker.lineHeight).toBe(TAP_MIN);
		}
		act(() => r.unmount());
	});

	test("tapping a capsule opens that ritual's sheet; Done closes it", async () => {
		const r = await mountList();
		const sheetOpen = (mode: string) =>
			r.root.findAll((n) => n.props.testID === `ritual-explain-${mode}`).length > 0;
		expect(sheetOpen("bless")).toBe(false);
		await tap(pressableFor(r, "ritual-strip-curse"));
		expect(sheetOpen("curse")).toBe(true);
		expect(sheetOpen("bless")).toBe(false);
		const sheet = r.root.findAll((n) => n.props.testID === "ritual-explain-curse")[0];
		const blurb = sheet.findAll(
			(n) => n.props.testID === "ritual-explain-blurb" && typeof n.type === "string"
		)[0];
		expect(textOf(blurb)).toBe(castBlurb(dailyRitual("curse").blurb));
		const allowance = sheet.findAll(
			(n) => n.props.testID === "ritual-explain-allowance" && typeof n.type === "string"
		)[0];
		expect(textOf(allowance)).toMatch(/^3 of 3 left today · resets in /);
		expect(textOf(sheet)).toContain(dailyRitual("curse").name);
		const done = sheet.findAll(
			(n) => n.props.accessibilityLabel === "Done" && !!n.props.accessibilityRole
		)[0];
		await tap(done);
		expect(sheetOpen("curse")).toBe(false);
		act(() => r.unmount());
	});

	test("a sent blessing is marked on that friend's row, not in a toast", async () => {
		const r = await mountList();
		expect(noticeFor(r, "bless", "f1")).toBeNull();
		await openMenu(r, "f1");
		await tap(cellFor(r, "bless", "f1"));
		const notice = noticeFor(r, "bless", "f1");
		expect(notice).not.toBeNull();
		// The mark is the cast's own art on the door's tint — no words on the
		// row; the sentence is the label a screen reader hears.
		expect(notice!.props.accessibilityLabel).toBe(
			`Blessed alice with ${dailyRitual("bless").name} today`
		);
		expect(textOf(notice!)).toBe("");
		expect(markArt(notice!)).toBe(dailyRitual("bless").icon);
		expect(StyleSheet.flatten(notice!.props.style).backgroundColor).toBe(
			RITUAL_DOOR.bless.fill
		);
		// bob's row says nothing — the memory is per friend — and no curse notice
		// rides alice's row for a blessing.
		expect(noticeFor(r, "bless", "f2")).toBeNull();
		expect(noticeFor(r, "curse", "f1")).toBeNull();
		expect(mockToast).not.toHaveBeenCalled();
		// The moment itself is the ritual bubble — once, for alice, carrying the
		// cast's own art and the sentence a screen reader hears.
		expect(mockBubble).toHaveBeenCalledTimes(1);
		expect(mockBubble).toHaveBeenCalledWith({
			mode: "bless",
			targetName: "alice",
			ritual: expect.objectContaining({ name: dailyRitual("bless").name }),
			announcement: `${dailyRitual("bless").name} sent to alice`,
		});
		act(() => r.unmount());
	});

	test("a landed curse is announced on the row the same way", async () => {
		const r = await mountList();
		await openMenu(r, "f2");
		await tap(cellFor(r, "curse", "f2"));
		await tap(cellFor(r, "curse", "f2"));
		const notice = noticeFor(r, "curse", "f2");
		expect(notice).not.toBeNull();
		expect(textOf(notice!)).toBe("");
		expect(markArt(notice!)).toBe(dailyRitual("curse").icon);
		expect(StyleSheet.flatten(notice!.props.style).backgroundColor).toBe(
			RITUAL_DOOR.curse.fill
		);
		expect(mockToast).not.toHaveBeenCalled();
		expect(mockBubble).toHaveBeenCalledWith(
			expect.objectContaining({ mode: "curse", targetName: "bob" })
		);
		act(() => r.unmount());
	});

	test("every friend gets exactly one row, in the list's one order", async () => {
		// The order's rules are `__tests__/friendOrder.test.ts`; this is the
		// wiring — the list sorts with that comparator, keeps everyone, and the
		// row index it hands down follows the VISIBLE order (the tilt sequence).
		const roster = [
			{ id: "f3", username: "pig10" },
			{ id: "f1", username: "Zara" },
			{ id: "f4", username: null },
			{ id: "f2", username: "pig2" },
		] as unknown as Profile[];
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(renderList(roster));
		});
		// One row draws as several nodes; the first of each is the row.
		const rows = [
			...new Set(
				r.root
					.findAll(
						(n) =>
							typeof n.props.testID === "string" &&
							n.props.testID.startsWith("friend-row-") &&
							!!n.props.accessibilityRole
					)
					.map((row) => row.props.testID as string)
			),
		];
		expect(rows).toEqual([
			"friend-row-f2",
			"friend-row-f3",
			"friend-row-f1",
			"friend-row-f4",
		]);
		// One row per friend — the count the `Friends · N` segment shows is the
		// length of the very array this list sorts.
		expect(rows).toHaveLength(roster.length);
		act(() => r.unmount());
	});

	test("the list no longer carries a Sounder strip above the rituals", () => {
		const source = fs.readFileSync(
			path.join(process.cwd(), "components/Friends.tsx"),
			"utf8"
		);
		expect(source).not.toContain("your Sounder");
		expect(source).not.toContain("onViewSounder");
	});
});

describe("the ListRow primitive's text column", () => {
	// The root cause of the cut-off action icons: Yoga's automatic minimum size
	// is CONTENT size, so a `flex: 1` column without `minWidth: 0` cannot shrink
	// below its widest child and pushes the trailing rail off the card — out of
	// the clip box the panel's slide needs.
	test("can shrink below its content width", () => {
		const source = fs.readFileSync(
			path.join(process.cwd(), "components/ui/ListRow.tsx"),
			"utf8"
		);
		const text = source.slice(source.indexOf("\ttext: {"));
		expect(text.slice(0, text.indexOf("},"))).toContain("minWidth: 0");
	});

	test("the panel slot is drawn after the rail, so focus order follows it", () => {
		const source = fs.readFileSync(
			path.join(process.cwd(), "components/ui/ListRow.tsx"),
			"utf8"
		);
		const body = source.slice(source.lastIndexOf("{identity}"));
		expect(body.indexOf("{trailing")).toBeLessThan(body.indexOf("{after}"));
	});
});

describe("the friend list's rows sit straight and its clip edge bleeds", () => {
	// A row this dense read as clipped when it leaned on ROW_TILTS, and the
	// tilt's overhang was what the list clipped. Straight rows, and a list
	// whose clip edge sits LIST_BLEED outside the rows so the 2pt sticker
	// shadow is whole on both sides. (2026-09-15)
	test("every row's sticker rotates by exactly 0deg", async () => {
		const r = await mountList();
		const rotations = r.root
			.findAll((n) => {
				const t = StyleSheet.flatten(n.props.style)?.transform as
					| { rotate?: string }[]
					| undefined;
				return Array.isArray(t) && t.some((x) => typeof x.rotate === "string");
			})
			.map((n) => {
				const t = StyleSheet.flatten(n.props.style).transform as { rotate?: string }[];
				return t.find((x) => x.rotate)!.rotate;
			});
		expect(rotations.length).toBeGreaterThan(0);
		expect(new Set(rotations)).toEqual(new Set(["0deg"]));
		act(() => r.unmount());
	});

	test("the list bleeds LIST_BLEED past its rows and pads its content back", async () => {
		const r = await mountList();
		const list = r.root.findAll((n) => n.props.contentContainerStyle && n.props.data)[0];
		expect(StyleSheet.flatten(list.props.style).marginHorizontal).toBe(-LIST_BLEED);
		expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingHorizontal).toBe(
			LIST_BLEED
		);
		act(() => r.unmount());
	});
});
