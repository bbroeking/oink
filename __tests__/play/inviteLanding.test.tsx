// The invite landing (components/play/InviteLanding) with the multiplayer
// hooks mocked, in every state: the flag off, signed out, a code that is not
// one, loading, an open invite (Join / Not now), and each way an invite ends
// (wandered off, filled up, called off, not found, a fetch that failed);
// a pig already at the table goes straight to it.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { InviteSummary } from "@/multiplayer/protocol";
import { InviteLanding } from "@/components/play/InviteLanding";
import { holdTableOnStack, resetTableNavForTests } from "@/components/play/nav";
import { isTableClaimed, resetTableClaimsForTests } from "@/components/play/tableClaims";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({
	get router() {
		return mockRouter;
	},
}));
jest.mock("@/utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock("@sentry/react-native", () => ({ captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/ui/PigStage", () => ({ PigStage: () => null }));
jest.mock("@/hooks/useMotionPolicy", () => ({
	MOTION_DURATION: { feedback: 120, state: 220, modal: 300, celebration: 450, crossfade: 150 },
	startDecorativeLoop: () => () => {},
	useMotionPolicy: () => ({ reduceMotion: true, allowDecorativeMotion: false, largeTransition: "crossfade", duration: (_s: number, r = 150) => r }),
}));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(async () => {}),
	selectionAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
	NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const mockSession = { userId: "me" as string | null | undefined };
jest.mock("@/components/play/useSessionUserId", () => ({ useSessionUserId: () => mockSession.userId }));

const NOW = 1_800_000_000_000;
const mockLanding = {
	enabled: true,
	store: {} as Record<string, InviteSummary>,
	play: {} as Record<string, unknown>,
	now: NOW,
};
jest.mock("@/hooks/useMultiplayer", () => ({
	usePlayEnabled: () => mockLanding.enabled,
	usePlayConnection: () => ({ status: "open", reason: null, connection: {}, banner: null, retry: () => {} }),
	usePlay: () => mockLanding.play,
	useInvites: () => ({ incoming: [], sent: [], byCode: (code: string) => mockLanding.store[code] ?? null }),
	useServerClock: () => mockLanding.now,
}));


const LOOK = { pigId: "rosie", hat: null, bow: null, glasses: null, mask: null, neck: null, held: null, aura: null, wallow: 0 };
const CODE = "ABCDEFGH";

function invite(over: Partial<InviteSummary> = {}): InviteSummary {
	return {
		code: CODE,
		url: `https://ticklethepig.com/play/${CODE}`,
		game: "rootle",
		pace: "live",
		kind: "direct",
		from: { userId: "u-clover", name: "Clover", look: LOOK },
		to: ["me"],
		status: "open",
		roomId: "44444444-room",
		seatsTaken: 1,
		seatsMax: 2,
		expiresAt: NOW + 12 * 60_000 + 5_000,
		...over,
	};
}

function reset(preview: () => Promise<unknown> = async () => ({ ok: true, invite: invite(), room: null })) {
	mockLanding.enabled = true;
	mockLanding.store = {};
	mockLanding.now = NOW;
	mockSession.userId = "me";
	mockLanding.play = {
		me: { userId: "me", name: "Rosie" },
		games: [],
		previewInvite: jest.fn(preview),
		acceptInvite: jest.fn(async () => ({ ok: true, roomId: "44444444-room" })),
		declineInvite: jest.fn(async () => ({ ok: true })),
	};
	Object.values(mockRouter).forEach((fn) => fn.mockClear());
	mockRouter.canGoBack.mockImplementation(() => true);
}

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const EM_DASH = "\u2014";
const EMOJI = /[\u{1F300}-\u{1FAFF}]|[\u2600-\u2604\u2606-\u2664\u2666-\u2712\u2714\u2716-\u2725\u2728-\u27BF]/u;

function textOf(node: TestRenderer.ReactTestInstance | string): string {
	if (typeof node === "string") return node;
	return (node.children ?? []).map(textOf).join("");
}
function press(root: TestRenderer.ReactTestInstance, testID: string) {
	const target = root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === "function")[0];
	if (!target) throw new Error(`nothing to press: ${testID}`);
	return target.props.onPress();
}

let mounted: TestRenderer.ReactTestRenderer[] = [];
async function render(code: string | null = CODE) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(
			<SafeAreaProvider initialMetrics={METRICS}>
				<InviteLanding code={code} />
			</SafeAreaProvider>,
		);
	});
	mounted.push(r);
	const text = textOf(r.root);
	expect(text.includes(EM_DASH)).toBe(false);
	expect(EMOJI.test(text)).toBe(false);
	return r;
}

describe("InviteLanding", () => {
	beforeEach(() => {
		reset();
		resetTableClaimsForTests();
		resetTableNavForTests();
	});
	afterEach(() => {
		act(() => {
			while (mounted.length) mounted.pop()?.unmount();
		});
		mounted = [];
	});

	it("with the flag off: Play together is on its way", async () => {
		mockLanding.enabled = false;
		const r = await render();
		expect(textOf(r.root)).toContain("Play together is on its way");
		expect(mockLanding.play.previewInvite).not.toHaveBeenCalled();
	});

	it("signed out: a line asking them to sign in and tap the link again", async () => {
		mockSession.userId = null;
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Sign in to take your seat");
		expect(text).toContain("Sign in, then tap the link again.");
		expect(mockLanding.play.previewInvite).not.toHaveBeenCalled();
	});

	it("a code that is not a code: couldn't find that table, and a way on", async () => {
		const r = await render(null);
		expect(textOf(r.root)).toContain("We couldn't find that table");
		await act(async () => press(r.root, "landing-instead"));
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/play");
	});

	it("loading: a warm beat while the invite is looked up", async () => {
		reset(() => new Promise(() => {}));
		const r = await render();
		expect(textOf(r.root)).toContain("finding your invite");
	});

	it("an open invite: who asks, which game, the seats, the time left; Join takes the seat", async () => {
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Clover invited you to play Rootle");
		expect(text).toContain("1 of 2 seats taken");
		expect(text).toContain("12m left");
		expect(text).toContain("Join the table");
		expect(text).toContain("Not now");
		expect(mockLanding.play.previewInvite).toHaveBeenCalledWith(CODE);
		await act(async () => press(r.root, "landing-join"));
		expect(mockLanding.play.acceptInvite).toHaveBeenCalledWith(CODE);
		expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: "44444444-room" } });
	});

	it("Join claims the table first, and enters it once when the store learns of the seat", async () => {
		const r = await render();
		await act(async () => press(r.root, "landing-join"));
		expect(isTableClaimed("44444444-room")).toBe(true);
		mockLanding.play = { ...mockLanding.play, games: [{ roomId: "44444444-room" }] };
		await act(async () => {
			r.update(
				<SafeAreaProvider initialMetrics={METRICS}>
					<InviteLanding code={CODE} />
				</SafeAreaProvider>,
			);
		});
		expect(mockRouter.replace).toHaveBeenCalledTimes(1);
	});

	it("a table already open under the landing is gone back to, never stacked twice", async () => {
		// Its match screen holds it on the stack (a seated pig tapping the invite again).
		const release = holdTableOnStack("44444444-room");
		const r = await render();
		await act(async () => press(r.root, "landing-join"));
		expect(mockRouter.replace).not.toHaveBeenCalled();
		expect(mockRouter.dismissTo).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: "44444444-room" } });
		release();
	});

	it("the scroller ends on the stack scroll pad, over the home indicator", async () => {
		const r = await render();
		const scroll = r.root.findAll((n) => n.props.testID === "invite-landing-scroll" && n.props.contentContainerStyle !== undefined)[0];
		const flat = [scroll.props.contentContainerStyle].flat(Infinity).reduce((a: Record<string, unknown>, b: unknown) => ({ ...a, ...(b as object) }), {});
		// SPACE.xl plus the 34pt home indicator.
		expect(flat.paddingBottom).toBe(24 + 34);
	});

	it("Not now turns a direct invite down and steps away", async () => {
		const r = await render();
		await act(async () => press(r.root, "landing-not-now"));
		expect(mockLanding.play.declineInvite).toHaveBeenCalledWith(CODE);
		expect(mockRouter.back).toHaveBeenCalled();
	});

	it("Not now on a link invite just steps away (home, when opened cold)", async () => {
		reset(async () => ({ ok: true, invite: invite({ kind: "link", to: [] }), room: null }));
		mockRouter.canGoBack.mockImplementation(() => false);
		const r = await render();
		await act(async () => press(r.root, "landing-not-now"));
		expect(mockLanding.play.declineInvite).not.toHaveBeenCalled();
		expect(mockRouter.replace).toHaveBeenCalledWith("/");
	});

	it("expired: this invite wandered off", async () => {
		reset(async () => ({ ok: true, invite: invite({ status: "expired" }), room: null }));
		const r = await render();
		expect(textOf(r.root)).toContain("This invite wandered off");
		expect(textOf(r.root)).toContain("Find a pig instead");
	});

	it("an invite past its time reads as wandered off even before the server says so", async () => {
		reset(async () => ({ ok: true, invite: invite({ expiresAt: NOW - 1 }), room: null }));
		const r = await render();
		expect(textOf(r.root)).toContain("This invite wandered off");
	});

	it("full: that table filled up", async () => {
		reset(async () => ({ ok: false, error: "full" }));
		const r = await render();
		expect(textOf(r.root)).toContain("That table filled up");
	});

	it("not found: couldn't find that table", async () => {
		reset(async () => ({ ok: false, error: "not_found" }));
		const r = await render();
		expect(textOf(r.root)).toContain("We couldn't find that table");
	});

	it("called off: the host's name, never blame", async () => {
		reset(async () => ({ ok: true, invite: invite({ status: "cancelled" }), room: null }));
		const r = await render();
		expect(textOf(r.root)).toContain("Clover called it off");
	});

	it("a fresher word from the server wins: the table filled while they read", async () => {
		const r = await render();
		expect(textOf(r.root)).toContain("Join the table");
		mockLanding.store[CODE] = invite({ status: "full" });
		await act(async () => {
			r.update(
				<SafeAreaProvider initialMetrics={METRICS}>
					<InviteLanding code={CODE} />
				</SafeAreaProvider>,
			);
		});
		expect(textOf(r.root)).toContain("That table filled up");
	});

	it("already at this table (the host's own invite): straight to it", async () => {
		reset(async () => ({ ok: true, invite: invite({ from: { userId: "me", name: "Rosie", look: LOOK } }), room: null }));
		await render();
		expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: "44444444-room" } });
	});

	it("a lookup that failed offers to try again", async () => {
		reset(async () => ({ ok: false, error: "offline" }));
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Couldn't reach the table");
		expect(text).toContain("You're offline. Play picks up when you're back.");
		await act(async () => press(r.root, "landing-retry"));
		expect(mockLanding.play.previewInvite).toHaveBeenCalledTimes(2);
	});

	it("a seat that filled under the thumb shows the warm state, not a toast", async () => {
		const r = await render();
		(mockLanding.play.acceptInvite as jest.Mock).mockResolvedValueOnce({ ok: false, error: "full" });
		await act(async () => press(r.root, "landing-join"));
		expect(textOf(r.root)).toContain("That table filled up");
		expect(mockRouter.replace).not.toHaveBeenCalled();
	});
});
