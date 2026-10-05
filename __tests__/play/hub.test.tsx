// The Play hub (components/play/PlayHub) with the multiplayer hooks mocked:
// the flag off (one warm line, nothing else); the default page (the five
// games, the any-game shortcut, the wins door); a search before and after the
// practice offer; an incoming invite; your tables; a resting game; a game's
// sheet; a found table opening; and the connection banner. Every rendered
// word is scanned for an em dash or an emoji.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { CatalogEntry, InviteSummary, RoomSummary } from "@/multiplayer/protocol";
import { DEFAULT_TIMING } from "@/multiplayer/protocol";
import type { GameId } from "@/multiplayer/types";
import { PlayHub, resetPushAskForTests } from "@/components/play/PlayHub";
import { resetTableNavForTests } from "@/components/play/nav";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissTo: jest.fn() };
const mockNavigation = { addListener: jest.fn(() => () => {}), dispatch: jest.fn() };
jest.mock("expo-router", () => ({
	get router() {
		return mockRouter;
	},
	useNavigation: () => mockNavigation,
}));
jest.mock("expo-router/react-navigation", () => ({
	// Keep the real module (NavigationContext, which the loading pig reads)
	// and run the focus effect as a plain effect: a mounted screen is focused.
	...jest.requireActual("expo-router/react-navigation"),
	useFocusEffect: (effect: () => void | (() => void)) => (jest.requireActual("react") as typeof import("react")).useEffect(effect, [effect]),
}));
jest.mock("@/utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock("@sentry/react-native", () => ({ captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/ui/PigStage", () => ({ PigStage: () => null }));
jest.mock("@/hooks/useMotionPolicy", () => ({
	MOTION_DURATION: { feedback: 120, state: 220, modal: 300, celebration: 450, crossfade: 150 },
	MotionPolicyProvider: ({ children }: { children: React.ReactNode }) => children,
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
const mockEnsurePush = jest.fn(async () => null);
jest.mock("@/utils/pushNotifications", () => ({ ensurePushPermission: () => mockEnsurePush() }));
jest.mock("@/components/play/useMyCard", () => ({ useMyCard: () => null }));
jest.mock("@/components/play/useInviteTargets", () => ({
	useInviteTargets: () => ({ friends: [], crewName: null, loading: false, retry: () => {} }),
}));

// ── The hooks, as plain state a test can change ──────────────────────────────

const NOW = 1_800_000_000_000;

function localEntry(id: GameId): CatalogEntry {
	const { GAMES } = jest.requireActual("@/multiplayer/games");
	const g = GAMES[id];
	return { id, title: g.title, tagline: g.tagline, kind: g.kind, seats: { ...g.seats }, paces: [...g.paces], rulesVersion: g.rulesVersion, enabled: true };
}

const mockHub = {
	enabled: true,
	connection: { status: "open", reason: null, connection: { status: "open", reason: null, attempt: 0, retryAt: null }, banner: null as string | null, retry: jest.fn() },
	play: {} as Record<string, unknown>,
	queue: {} as Record<string, unknown>,
	invites: {} as Record<string, unknown>,
	catalog: {} as Record<string, unknown>,
	now: NOW,
};

jest.mock("@/hooks/useMultiplayer", () => ({
	usePlayEnabled: () => mockHub.enabled,
	usePlayConnection: () => mockHub.connection,
	usePlay: () => mockHub.play,
	useQueue: () => mockHub.queue,
	useInvites: () => mockHub.invites,
	usePlayCatalog: () => mockHub.catalog,
	useServerClock: () => mockHub.now,
}));


const ALL: GameId[] = ["rootle", "fence_the_pen", "mud_volley", "snout_says", "out_looking"];

function reset() {
	mockHub.enabled = true;
	mockHub.now = NOW;
	mockHub.connection = {
		status: "open",
		reason: null,
		connection: { status: "open", reason: null, attempt: 0, retryAt: null },
		banner: null,
		retry: jest.fn(),
	};
	mockHub.play = {
		games: [] as RoomSummary[],
		incomingInvites: [],
		yourTurnCount: 0,
		me: { userId: "me", name: "Rosie" },
		timing: DEFAULT_TIMING,
		notices: [],
		joinQueue: jest.fn(async () => ({ ok: true })),
		leaveQueue: jest.fn(async () => ({ ok: true })),
		acceptInvite: jest.fn(async () => ({ ok: true, roomId: "22222222-room" })),
		declineInvite: jest.fn(async () => ({ ok: true })),
		startPractice: jest.fn(async () => ({ ok: true, roomId: "practice-abc" })),
		createInvite: jest.fn(async () => ({ ok: true, invite: null })),
		dismissNotice: jest.fn(),
	};
	mockHub.queue = {
		queue: { state: "idle", games: [], pace: "live", since: null },
		searching: false,
		since: null,
		practiceOfferMs: DEFAULT_TIMING.practiceOfferMs,
		join: jest.fn(async () => ({ ok: true })),
		leave: jest.fn(async () => ({ ok: true })),
	};
	mockHub.invites = { incoming: [] as InviteSummary[], sent: [], byCode: () => null };
	const local = ALL.map(localEntry);
	mockHub.catalog = {
		catalog: [] as CatalogEntry[],
		playable: [] as CatalogEntry[],
		practiceGames: local,
		practiceAllowed: true,
		asyncAllowed: true,
		byId: (id: GameId) => (mockHub.catalog.catalog as CatalogEntry[]).find((e) => e.id === id) ?? local.find((e) => e.id === id) ?? null,
	};
	Object.values(mockRouter).forEach((fn) => fn.mockClear());
	mockRouter.canGoBack.mockImplementation(() => true);
	mockNavigation.addListener.mockClear();
	mockEnsurePush.mockClear();
	resetPushAskForTests();
	resetTableNavForTests();
}

function searching(sinceAgo: number, games: GameId[] = ["rootle"]) {
	mockHub.queue = {
		...mockHub.queue,
		queue: { state: "searching", games, pace: "live", since: NOW - sinceAgo },
		searching: true,
		since: NOW - sinceAgo,
	};
}

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const EM_DASH = "\u2014";
const EMOJI = /[\u{1F300}-\u{1FAFF}]|[\u2600-\u2604\u2606-\u2664\u2666-\u2712\u2714\u2716-\u2725\u2728-\u27BF]/u;

function textOf(node: TestRenderer.ReactTestInstance | string): string {
	if (typeof node === "string") return node;
	return (node.children ?? []).map(textOf).join("");
}
function hosts(root: TestRenderer.ReactTestInstance, testID: string) {
	return root.findAll((n) => n.props.testID === testID && typeof n.type === "string");
}
function press(root: TestRenderer.ReactTestInstance, testID: string) {
	const target = root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === "function")[0];
	if (!target) throw new Error(`nothing to press: ${testID}`);
	return target.props.onPress();
}
function clean(text: string) {
	expect(text.includes(EM_DASH)).toBe(false);
	expect(EMOJI.test(text)).toBe(false);
}

const tree = () => (
	<SafeAreaProvider initialMetrics={METRICS}>
		<PlayHub />
	</SafeAreaProvider>
);

let mounted: TestRenderer.ReactTestRenderer[] = [];
async function render() {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(tree());
	});
	mounted.push(r);
	return r;
}
async function rerender(r: TestRenderer.ReactTestRenderer) {
	await act(async () => {
		r.update(tree());
	});
}

const INVITE: InviteSummary = {
	code: "ABCDEFGH",
	url: "https://ticklethepig.com/play/ABCDEFGH",
	game: "rootle",
	pace: "live",
	kind: "direct",
	from: { userId: "u-clover", name: "Clover", look: { pigId: "rosie", hat: null, bow: null, glasses: null, mask: null, neck: null, held: null, aura: null, wallow: 0 } },
	to: ["me"],
	status: "open",
	roomId: "22222222-room",
	seatsTaken: 1,
	seatsMax: 2,
	expiresAt: NOW + 12 * 60_000 + 5_000,
};

function table(over: Partial<RoomSummary>): RoomSummary {
	return {
		roomId: "33333333-tab",
		game: "fence_the_pen",
		pace: "async",
		phase: "playing",
		yourTurn: false,
		opponents: [{ userId: "u-bandit", name: "Bandit", look: INVITE.from.look }],
		deadline: NOW + 11 * 3_600_000,
		updatedAt: NOW,
		...over,
	};
}

describe("PlayHub", () => {
	beforeEach(reset);
	afterEach(() => {
		act(() => {
			while (mounted.length) mounted.pop()?.unmount();
		});
		mounted = [];
	});

	it("with the flag off, is one warm line and nothing else", async () => {
		mockHub.enabled = false;
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Play together is on its way");
		expect(hosts(r.root, "game-card-rootle")).toHaveLength(0);
		expect(hosts(r.root, "hub-any-game")).toHaveLength(0);
		expect(mockEnsurePush).not.toHaveBeenCalled();
		clean(text);
	});

	it("the shortcut sits under the crown with no second heading; a small one names the five", async () => {
		const r = await render();
		const text = textOf(r.root);
		expect(text).not.toContain("pick one");
		const games = hosts(r.root, "hub-games")[0];
		const order = textOf(games);
		expect(order.indexOf("Find a pig for any game")).toBeLessThan(order.indexOf("The five"));
		expect(order.indexOf("or invite friends to a game")).toBeLessThan(order.indexOf("The five"));
		expect(order.indexOf("The five")).toBeLessThan(order.indexOf("Rootle"));
		// A status is printed: the cards' tags lie flat.
		const tags = r.root.findAll((n) => n.props.label === "co-op" && n.props.flat !== undefined);
		expect(tags.length).toBeGreaterThan(0);
		expect(tags.every((t) => t.props.flat === true)).toBe(true);
	});

	it("the crown states its ceiling and the scroller ends on the stack scroll pad", async () => {
		const r = await render();
		const crown = r.root.findAll((n) => n.props.title === "Play together" && n.props.kicker === "five little games")[0];
		expect(crown.props.maxFontSizeMultiplier).toBe(1.3);
		const scroll = r.root.findAll((n) => n.props.testID === "play-hub-scroll" && n.props.contentContainerStyle !== undefined)[0];
		const flat = [scroll.props.contentContainerStyle].flat(Infinity).reduce((a: Record<string, unknown>, b: unknown) => ({ ...a, ...(b as object) }), {});
		// SPACE.xl plus the 34pt home indicator, and the page leaves the bottom edge to it.
		expect(flat.paddingBottom).toBe(24 + 34);
		const page = r.root.findAll((n) => n.props.testID === "play-hub" && n.props.edges !== undefined)[0];
		expect(page.props.edges).toEqual(["top", "left", "right"]);
	});

	it("by default: the five games, the any-game shortcut and the wins door; asks for pushes once", async () => {
		const r = await render();
		for (const id of ALL) expect(hosts(r.root, `game-card-${id}`).length).toBeGreaterThan(0);
		const text = textOf(r.root);
		expect(text).toContain("Find a pig for any game");
		expect(text).toContain("Wins this month");
		expect(text).toContain("2–4 pigs");
		expect(text).toContain("co-op");
		expect(hosts(r.root, "searching-card")).toHaveLength(0);
		expect(hosts(r.root, "hub-invites")).toHaveLength(0);
		expect(hosts(r.root, "hub-tables")).toHaveLength(0);
		expect(mockEnsurePush).toHaveBeenCalledTimes(1);
		clean(text);
		await render();
		expect(mockEnsurePush).toHaveBeenCalledTimes(1);
	});

	it("the any-game shortcut queues for every game that plays live", async () => {
		const r = await render();
		await act(async () => press(r.root, "hub-any-game"));
		expect(mockHub.play.joinQueue).toHaveBeenCalledWith(ALL, "live");
	});

	it("a search, before the practice offer: your pig, what for, how long, and Stop", async () => {
		searching(5_000, ["rootle", "fence_the_pen"]);
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Looking for a pig to play with…");
		expect(text).toContain("Rootle or Fence the Pen");
		expect(text).toContain("sniffing for 5s");
		expect(hosts(r.root, "searching-offer")).toHaveLength(0);
		expect(hosts(r.root, "hub-any-game")).toHaveLength(0);
		expect(text).not.toMatch(/\d+ pigs (online|waiting)/);
		clean(text);
		await act(async () => press(r.root, "searching-stop"));
		expect(mockHub.play.leaveQueue).toHaveBeenCalled();
	});

	it("after the practice offer: an open seat by post, or a bot pig", async () => {
		searching(DEFAULT_TIMING.practiceOfferMs + 4_000, ["rootle"]);
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Still sniffing around. Practice while you wait, or play by post?");
		expect(text).toContain("Leave an open seat");
		expect(text).toContain("Practice with a bot pig");
		clean(text);
		await act(async () => press(r.root, "searching-open-seat"));
		expect(mockHub.play.joinQueue).toHaveBeenCalledWith(["rootle"], "async");
		await act(async () => press(r.root, "searching-practice"));
		expect(mockHub.play.leaveQueue).toHaveBeenCalled();
		expect(mockHub.play.startPractice).toHaveBeenCalledWith({ gameId: "rootle" });
		expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: "practice-abc" } });
	});

	it("an incoming invite: who, which game, how long, Accept and Not now", async () => {
		mockHub.invites = { ...mockHub.invites, incoming: [INVITE] };
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Clover wants to play Rootle");
		expect(text).toContain("12m left");
		clean(text);
		await act(async () => press(r.root, `incoming-accept-${INVITE.code}`));
		expect(mockHub.play.acceptInvite).toHaveBeenCalledWith(INVITE.code);
		expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: "22222222-room" } });
		await act(async () => press(r.root, `incoming-not-now-${INVITE.code}`));
		expect(mockHub.play.declineInvite).toHaveBeenCalledWith(INVITE.code);
		expect(hosts(r.root, `incoming-${INVITE.code}`)).toHaveLength(0);
	});

	it("accepting opens the table once, though its first snapshot lands before the ack", async () => {
		// A search is running, so the hub is watching for a fresh table.
		searching(2_000);
		mockHub.invites = { ...mockHub.invites, incoming: [INVITE] };
		let ack!: (value: unknown) => void;
		mockHub.play = { ...mockHub.play, acceptInvite: jest.fn(() => new Promise((resolve) => (ack = resolve))) };
		const r = await render();
		await act(async () => {
			void press(r.root, `incoming-accept-${INVITE.code}`);
		});
		// The server's order: the queue goes idle, the table's first snapshot,
		// then the ack.
		mockHub.queue = { ...mockHub.queue, queue: { state: "idle", games: [], pace: "live", since: null }, searching: false, since: null };
		mockHub.play = { ...mockHub.play, games: [table({ roomId: INVITE.roomId!, game: "rootle", pace: "live", phase: "lobby" })] };
		await rerender(r);
		expect(mockRouter.push).not.toHaveBeenCalled();
		await act(async () => ack({ ok: true, roomId: INVITE.roomId }));
		expect(mockRouter.push).toHaveBeenCalledTimes(1);
		expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: INVITE.roomId } });
	});

	it("a link invite's Not now tells nobody: it just leaves the list", async () => {
		mockHub.invites = { ...mockHub.invites, incoming: [{ ...INVITE, kind: "link", to: [] }] };
		const r = await render();
		await act(async () => press(r.root, `incoming-not-now-${INVITE.code}`));
		expect(mockHub.play.declineInvite).not.toHaveBeenCalled();
		expect(hosts(r.root, `incoming-${INVITE.code}`)).toHaveLength(0);
	});

	it("your tables: your move first in sun, the other pig's move after; a tap opens it", async () => {
		mockHub.play = {
			...mockHub.play,
			games: [table({ roomId: "aaaaaaaa-mine", yourTurn: true }), table({ roomId: "bbbbbbbb-theirs", game: "rootle", yourTurn: false })],
		};
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Your tables");
		expect(textOf(hosts(r.root, "table-status-aaaaaaaa-mine")[0])).toBe("Your move · 11h left");
		expect(textOf(hosts(r.root, "table-status-bbbbbbbb-theirs")[0])).toBe("Bandit's move");
		expect(text).toContain("with Bandit");
		clean(text);
		await act(async () => press(r.root, "table-row-aaaaaaaa-mine"));
		expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: "aaaaaaaa-mine" } });
		// A second way to the same table in the same beat is the same tap.
		await act(async () => press(r.root, "table-row-aaaaaaaa-mine"));
		expect(mockRouter.push).toHaveBeenCalledTimes(1);
	});

	it("a game the server switched off rests, it does not vanish", async () => {
		const server = ALL.map(localEntry).map((e) => (e.id === "mud_volley" ? { ...e, enabled: false } : e));
		mockHub.catalog = { ...mockHub.catalog, catalog: server, playable: server.filter((e) => e.enabled) };
		const r = await render();
		expect(hosts(r.root, "game-card-mud_volley").length).toBeGreaterThan(0);
		expect(hosts(r.root, "game-asleep-mud_volley").length).toBeGreaterThan(0);
		await act(async () => press(r.root, "hub-any-game"));
		expect(mockHub.play.joinQueue).toHaveBeenCalledWith(["rootle", "fence_the_pen", "snout_says", "out_looking"], "live");
	});

	it("a game's sheet: how it goes, then Find a pig, by post, and Practice with bot pigs", async () => {
		jest.useFakeTimers();
		const r = await render();
		await act(async () => press(r.root, "game-card-fence_the_pen"));
		const text = textOf(r.root);
		expect(text).toContain("how it goes");
		expect(text).toContain("On your turn, draw one fence between two posts.");
		expect(text).toContain("Practice · 1 bot pig");
		clean(text);
		// Timed by default, like a live table.
		expect(r.root.findAll((n) => n.props.testID === "game-sheet-no-clock" && n.props.value === false).length).toBeGreaterThan(0);
		await act(async () => press(r.root, "game-sheet-practice"));
		expect(mockHub.play.startPractice).toHaveBeenCalledWith({ gameId: "fence_the_pen", seats: 2 });
		// The sheet finishes closing before the table opens (the modal handoff).
		expect(mockRouter.push).not.toHaveBeenCalled();
		await act(async () => {
			jest.advanceTimersByTime(1_000);
		});
		expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: "practice-abc" } });
		jest.useRealTimers();
		await act(async () => press(r.root, "game-card-rootle"));
		await act(async () => press(r.root, "game-sheet-find"));
		expect(mockHub.play.joinQueue).toHaveBeenCalledWith(["rootle"], "live");
		await act(async () => press(r.root, "game-card-snout_says"));
		await act(async () => press(r.root, "game-sheet-post"));
		expect(mockHub.play.joinQueue).toHaveBeenCalledWith(["snout_says"], "async");
	});

	it("Practice with No clock sets an untimed table", async () => {
		jest.useFakeTimers();
		const r = await render();
		await act(async () => press(r.root, "game-card-rootle"));
		expect(textOf(r.root)).toContain("No clock");
		const toggle = r.root.findAll((n) => n.props.testID === "game-sheet-no-clock" && typeof n.props.onValueChange === "function")[0];
		await act(async () => toggle.props.onValueChange(true));
		await act(async () => press(r.root, "game-sheet-practice"));
		expect(mockHub.play.startPractice).toHaveBeenCalledWith({ gameId: "rootle", seats: 2, untimed: true });
		await act(async () => {
			jest.advanceTimersByTime(1_000);
		});
		expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: "practice-abc" } });
		jest.useRealTimers();
	});

	it("a table found by a running search opens by itself", async () => {
		const r = await render();
		searching(1_000);
		await rerender(r);
		mockHub.play = { ...mockHub.play, games: [table({ roomId: "cccccccc-found", pace: "live", phase: "starting" })] };
		mockHub.queue = { ...mockHub.queue, queue: { state: "idle", games: [], pace: "live", since: null }, searching: false, since: null };
		await rerender(r);
		expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/match/[roomId]", params: { roomId: "cccccccc-found" } });
	});

	it("a table that was already there when the search began does not open by itself", async () => {
		mockHub.play = { ...mockHub.play, games: [table({ roomId: "dddddddd-old" })] };
		const r = await render();
		searching(1_000);
		await rerender(r);
		mockHub.queue = { ...mockHub.queue, searching: false };
		await rerender(r);
		expect(mockRouter.push).not.toHaveBeenCalled();
	});

	it("says when the socket has stopped, with a retry; the first dial is not news", async () => {
		mockHub.connection = { ...mockHub.connection, status: "connecting", banner: "Finding the table…" };
		const r = await render();
		expect(hosts(r.root, "play-connection-banner")).toHaveLength(0);
		mockHub.connection = { ...mockHub.connection, status: "stopped", reason: "disabled" as never, banner: "Play is napping right now. Try again soon." };
		await rerender(r);
		expect(textOf(r.root)).toContain("Play is napping right now. Try again soon.");
		await act(async () => press(r.root, "play-connection-banner-retry"));
		expect(mockHub.connection.retry).toHaveBeenCalled();
	});

	it("backing out of the hub stops a live search", async () => {
		searching(3_000);
		await render();
		const calls = mockNavigation.addListener.mock.calls as unknown as [string, () => void][];
		const listener = calls.find((c) => c[0] === "beforeRemove")?.[1];
		expect(listener).toBeDefined();
		act(() => listener?.());
		expect(mockHub.queue.leave).toHaveBeenCalled();
	});
});
