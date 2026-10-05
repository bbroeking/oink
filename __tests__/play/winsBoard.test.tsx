// The wins board (components/play/WinsBoard): rows of this month's wins,
// your own row pinned at the foot, the hand line before a first win, the
// "opens soon" state while the RPC is not deployed, a failed read with a
// retry, and one segment per game a pig can win. Never a loss, never a zero.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { WinsBoardResult } from "@/utils/multiplayer/leaderboard";
import { WINNABLE_GAMES, WinsBoard } from "@/components/play/WinsBoard";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({
	get router() {
		return mockRouter;
	},
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
jest.mock("@/components/play/useSessionUserId", () => ({ useSessionUserId: () => "u-me" }));

const mockFetch = jest.fn<Promise<WinsBoardResult>, unknown[]>();
jest.mock("@/utils/multiplayer/leaderboard", () => ({ fetchWinsBoard: (...args: unknown[]) => mockFetch(...args) }));


const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const EM_DASH = "\u2014";
const EMOJI = /[\u{1F300}-\u{1FAFF}]|[\u2600-\u2604\u2606-\u2664\u2666-\u2712\u2714\u2716-\u2725\u2728-\u27BF]/u;

function row(rank: number, userId: string, username: string, wins: number) {
	return { rank, userId, username, pigId: "rosie", hatId: null, bowId: null, wallow: 0, wins };
}

function board(over: Partial<{ rows: ReturnType<typeof row>[]; me: { wins: number; rank: number | null } }> = {}): WinsBoardResult {
	return {
		ok: true,
		board: {
			period: "2026-10",
			game: null,
			rows: over.rows ?? [row(1, "u-clover", "Clover", 5), row(2, "u-me", "Rosie", 3), row(3, "u-bandit", "Bandit", 1)],
			me: over.me ?? { wins: 3, rank: 2 },
		},
	};
}

function textOf(node: TestRenderer.ReactTestInstance | string): string {
	if (typeof node === "string") return node;
	return (node.children ?? []).map(textOf).join("");
}
function hosts(root: TestRenderer.ReactTestInstance, testID: string) {
	return root.findAll((n) => n.props.testID === testID && typeof n.type === "string");
}

let mounted: TestRenderer.ReactTestRenderer[] = [];
async function render() {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(
			<SafeAreaProvider initialMetrics={METRICS}>
				<WinsBoard />
			</SafeAreaProvider>,
		);
	});
	mounted.push(r);
	const text = textOf(r.root);
	expect(text.includes(EM_DASH)).toBe(false);
	expect(EMOJI.test(text)).toBe(false);
	return r;
}

describe("WinsBoard", () => {
	beforeEach(() => {
		mockFetch.mockReset();
		mockFetch.mockResolvedValue(board());
	});
	afterEach(() => {
		act(() => {
			while (mounted.length) mounted.pop()?.unmount();
		});
		mounted = [];
	});

	it("rows: the rank, the pig, the name and the wins; never a loss, never a zero", async () => {
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Wins this month");
		expect(text).toContain("october");
		expect(text).toContain("#1");
		expect(text).toContain("Clover");
		expect(text).toContain("5 wins");
		expect(text).toContain("1 win");
		expect(text).toContain("Wins only. Resets on the 1st.");
		expect(text).not.toMatch(/loss|lost|0 wins/i);
		expect(mockFetch).toHaveBeenCalledWith(null);
		const mine = r.root.find((n) => n.props.testID === "wins-row-u-me" && n.props.accessibilityLabel);
		expect(mine.props.accessibilityLabel).toBe("You, rank 2, 3 wins");
	});

	it("your row is pinned at the foot while you have a win", async () => {
		const r = await render();
		const you = hosts(r.root, "wins-you");
		expect(you.length).toBeGreaterThan(0);
		expect(textOf(you[0])).toContain("You · 3 wins");
		expect(textOf(you[0])).toContain("#2");
	});

	it("before your first win, the foot says what one would do", async () => {
		mockFetch.mockResolvedValue(board({ me: { wins: 0, rank: null } }));
		const r = await render();
		expect(hosts(r.root, "wins-you")).toHaveLength(0);
		expect(textOf(r.root)).toContain("Your first win puts you on the board");
	});

	it("a missing RPC is the board opening soon, never an error", async () => {
		mockFetch.mockResolvedValue({ ok: false, reason: "missing" });
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("The board opens soon");
		expect(text).not.toContain("Couldn't load");
		expect(hosts(r.root, "wins-retry")).toHaveLength(0);
	});

	it("a read that failed says so, with a retry", async () => {
		mockFetch.mockResolvedValueOnce({ ok: false, reason: "error" });
		const r = await render();
		expect(textOf(r.root)).toContain("The board didn't come back.");
		const retry = r.root.findAll((n) => n.props.testID === "wins-retry" && typeof n.props.onPress === "function")[0];
		await act(async () => retry.props.onPress());
		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(textOf(r.root)).toContain("Clover");
	});

	it("an empty month is warm, not a table of zeros", async () => {
		mockFetch.mockResolvedValue(board({ rows: [], me: { wins: 0, rank: null } }));
		const r = await render();
		expect(textOf(r.root)).toContain("No wins yet this month");
	});

	it("one segment per game a pig can win: co-op tables win together, off the board", async () => {
		expect(WINNABLE_GAMES).toEqual(["rootle", "fence_the_pen", "mud_volley", "out_looking"]);
		const r = await render();
		const text = textOf(r.root);
		expect(text).toContain("Fence");
		expect(text).not.toContain("Snout");
		const fence = r.root.findAll((n) => n.props.accessibilityLabel === "Fence the Pen" && typeof n.props.onPress === "function")[0];
		await act(async () => fence.props.onPress());
		expect(mockFetch).toHaveBeenLastCalledWith("fence_the_pen");
	});
});
