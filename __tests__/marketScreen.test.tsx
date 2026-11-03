// app/market.tsx (2026-11-02 launch audit), against a stubbed useMarket:
//   • a lost answer stays in the open sheet, says so there, and the retry
//     (even after closing and reopening the sheet on the same find, side and
//     price) sends the SAME nonce; another target gets a fresh one; once a
//     definite answer lands the next trade is a new nonce
//   • a lost post says so inside the post sheet and keeps its nonce
//   • cold-started with nothing behind it, the way out goes to the Barn
//   • the cards' last step for a pig with no full set says what to do first
//   • a failed take-down says why
//   • the quiet moment's "seen" flag is written when it shows, and a queued
//     one is taken back when the pig leaves that find
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
jest.mock("@/hooks/useMotionPolicy", () => ({
	MOTION_DURATION: { feedback: 120, state: 220, modal: 300, celebration: 450, crossfade: 150 },
	startDecorativeLoop: () => () => {},
	useMotionPolicy: () => ({
		reduceMotion: true,
		allowDecorativeMotion: false,
		largeTransition: "crossfade",
		duration: (_standard: number, reduced = 150) => reduced,
	}),
}));
jest.mock("expo-haptics", () => ({
	notificationAsync: jest.fn(() => Promise.resolve()),
	NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("expo-router", () => ({
	router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) },
	useNavigation: () => ({ setOptions: () => {} }),
}));
jest.mock("@/hooks/useTrader", () => {
	const trader = { present: false, available: false, status: { visit: null, tuning: { prices: { common: 3, uncommon: 8, rare: 20 }, wantMultiplier: 2 } } };
	return { useTrader: () => trader };
});
jest.mock("@/hooks/useMarket", () => {
	const harness: { market: unknown; onNotices: unknown } = { market: null, onNotices: null };
	return {
		__harness: harness,
		useMarket: (opts: { onNotices?: unknown }) => {
			harness.onNotices = opts.onNotices;
			return harness.market;
		},
	};
});

import MarketScreen from "@/app/market";
import { MARKET_MOMENT_KEYS, MARKET_ONBOARDED_KEY } from "@/constants/market";
import { toMarketClosed, toMarketFindView, toMarketState, type MarketClosed, type MarketOutcome, type MarketState } from "@/utils/market";

const harness = jest.requireMock("@/hooks/useMarket").__harness as {
	market: Record<string, jest.Mock | unknown>;
	onNotices: ((ns: unknown[], s: MarketState) => void) | null;
};
const mockRouter = jest.requireMock("expo-router").router as { back: jest.Mock; replace: jest.Mock; canGoBack: jest.Mock };

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

const RAW = {
	now: "2026-11-05T14:10:00Z",
	tick: 990000,
	tuning: { set_size: { common: 4, uncommon: 3, rare: 3 }, base: { common: 3, uncommon: 8, rare: 20 } },
	finds: [
		{ id: "pinecone", rarity: "common", size: 4, usual: 12, price: 12, ask: 15, bid: 9, prev: 12, quiet_for: 0, spark: [[990000, 12]] },
		{ id: "old_key", rarity: "uncommon", size: 3, usual: 24, price: 24, ask: 30, bid: 19, prev: 24, quiet_for: 0, spark: [[990000, 24]] },
	],
	me: { id: "me", coin: 20, cap: 25, spent: 0, took_in: 0, posts_today: 0, holdings: { pinecone: { held: 4, paid: 0, paid_units: 0, on_offer: 0 } }, offers: [] },
	board: [],
	tape: [],
	notices: [],
	friends: [],
	yesterday: null,
};
const STATE = toMarketState(RAW);
const VIEW = toMarketFindView({ find_id: "pinecone", tick: 990000, hist: [[989999, 12], [990000, 12]], marks: [], recent: [], today: {} });

const lost: MarketOutcome = { ok: false, reason: "network", now: null, ready: null, needed: null, held: null, setSize: null };
const bought: MarketOutcome = {
	ok: true,
	replay: false,
	filled: true,
	via: "counter",
	offer: null,
	coin: 5,
	trade: {
		id: 1, kind: "counter", side: "buy", how: "counter", findId: "pinecone", qty: 4, price: 15, sellerId: null, buyerId: "me",
		seller: null, buyer: { id: "me", you: true, name: null, pigId: null, friend: false }, from: 12, to: 12.6, bid: 9, ask: 15,
		cost: null, dug: 0, listed: null, wantFindId: null, wantQty: null, giveVal: null, wantVal: null, who: null, dir: null, tick: 1, at: "x",
	},
};

function marketWith(state: MarketState | null, closed: MarketClosed | null = null) {
	return {
		state,
		closed,
		available: state != null,
		loading: false,
		error: closed ? "closed" : null,
		refresh: jest.fn(async () => state),
		loadFind: jest.fn(async () => VIEW),
		counter: jest.fn(),
		post: jest.fn(),
		take: jest.fn(),
		cancel: jest.fn(),
	};
}

const renderers: TestRenderer.ReactTestRenderer[] = [];

async function mount(state: MarketState | null = STATE, onboarded = true, closed: MarketClosed | null = null) {
	if (onboarded) await AsyncStorage.setItem(MARKET_ONBOARDED_KEY, "1");
	harness.market = marketWith(state, closed);
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(
			<SafeAreaProvider initialMetrics={METRICS}>
				<MarketScreen />
			</SafeAreaProvider>,
		);
		renderers.push(r);
	});
	await act(async () => {});
	return r;
}

function textOf(r: TestRenderer.ReactTestRenderer): string {
	const out: string[] = [];
	const walk = (n: unknown) => {
		if (n == null) return;
		if (typeof n === "string") out.push(n);
		else if (Array.isArray(n)) n.forEach(walk);
		else ((n as { children?: unknown[] }).children ?? []).forEach(walk);
	};
	walk(r.toJSON());
	return out.join(" ");
}

function nodeText(n: TestRenderer.ReactTestInstance | string): string {
	if (typeof n === "string") return n;
	return n.children.map((c) => nodeText(c as TestRenderer.ReactTestInstance | string)).join("");
}

/** Press the LAST pressable that says `text` (a sheet renders after the page). */
async function press(r: TestRenderer.ReactTestRenderer, text: string, { exact = false } = {}) {
	const hits = r.root.findAll((n) => {
		if (typeof n.props.onPress !== "function" || typeof n.type === "string") return false;
		const label = String(n.props.accessibilityLabel ?? "");
		return exact ? label === text : label.includes(text) || nodeText(n).includes(text);
	});
	if (!hits.length) throw new Error(`nothing pressable says ${text}`);
	await act(async () => {
		await hits[hits.length - 1].props.onPress();
	});
	await act(async () => {});
}

async function openPinecones(r: TestRenderer.ReactTestRenderer) {
	await press(r, "The Counter: buy or sell");
	await press(r, "Pinecones, a set of 4");
}

beforeEach(async () => {
	await AsyncStorage.clear();
	mockRouter.back.mockClear();
	mockRouter.replace.mockClear();
	mockRouter.canGoBack.mockReset().mockReturnValue(true);
});

afterEach(() => {
	act(() => {
		for (const r of renderers.splice(0)) r.unmount();
	});
});

describe("a lost answer never trades twice", () => {
	it("keeps the sheet and its nonce for the same find, side and price; a fresh one after a definite answer", async () => {
		const r = await mount();
		const counter = harness.market.counter as jest.Mock;
		await openPinecones(r);
		await press(r, "Buy 4 pinecones from Bullion for 15");
		counter.mockResolvedValueOnce(lost);
		await press(r, "Buy for 15");
		expect(counter).toHaveBeenCalledTimes(1);
		const [, , limit, first] = counter.mock.calls[0];
		expect(limit).toBe(15);
		// Still in the sheet, and it says so there.
		let t = textOf(r);
		expect(t).toContain("Couldn't hear back from Bullion.");
		expect(t).toContain("Check your bag before you try again.");
		expect(t).toContain("Every set bought here pushes it up");

		// Close it, try the other side: a different target, a fresh nonce.
		await press(r, "Close", { exact: true });
		expect(textOf(r)).not.toContain("Couldn't hear back from Bullion.");
		await press(r, "Sell 4 pinecones to Bullion for 9");
		expect(textOf(r)).not.toContain("Couldn't hear back from Bullion.");
		counter.mockResolvedValueOnce(lost);
		await press(r, "Sell for 9");
		expect(counter.mock.calls[1][3]).not.toBe(first);
		await press(r, "Close", { exact: true });

		// Reopen the same buy: the note is back, and the retry replays the original nonce.
		await press(r, "Buy 4 pinecones from Bullion for 15");
		expect(textOf(r)).toContain("Couldn't hear back from Bullion.");
		counter.mockResolvedValueOnce({ ...bought, replay: true });
		await press(r, "Buy for 15");
		expect(counter.mock.calls[2][3]).toBe(first);
		// A definite answer: the sheet closes and the receipt lands.
		t = textOf(r);
		expect(t).toContain("You bought 4 pinecones from Bullion for 15");
		expect(t).not.toContain("Couldn't hear back from Bullion.");

		// The next buy at the same price is a new trade.
		await press(r, "Buy 4 pinecones from Bullion for 15");
		expect(textOf(r)).not.toContain("Couldn't hear back from Bullion.");
		counter.mockResolvedValueOnce(bought);
		await press(r, "Buy for 15");
		expect(counter.mock.calls[3][3]).not.toBe(first);
	});

	it("says a lost post inside the post sheet and keeps its nonce", async () => {
		const r = await mount();
		const post = harness.market.post as jest.Mock;
		await openPinecones(r);
		await press(r, "Put it on the noticeboard instead");
		post.mockResolvedValueOnce(lost);
		await press(r, "Pin it: 4 pinecones for 12");
		expect(textOf(r)).toContain("Couldn't hear back from Bullion.");
		const first = post.mock.calls[0][1];
		post.mockResolvedValueOnce({ ok: false, reason: "too_many_today", now: null, ready: null, needed: null, held: null, setSize: null });
		await press(r, "Pin it: 4 pinecones for 12");
		expect(post.mock.calls[1][1]).toBe(first);
		// A definite refusal says why and frees the nonce.
		expect(textOf(r)).toContain("That's 30 listings today");
		post.mockResolvedValueOnce(lost);
		await press(r, "Pin it: 4 pinecones for 12");
		expect(post.mock.calls[2][1]).not.toBe(first);
	});
});

describe("the way out, and what to say", () => {
	it("goes to the Barn when a push opened the market cold", async () => {
		mockRouter.canGoBack.mockReturnValue(false);
		const r = await mount();
		await press(r, "Back", { exact: true });
		expect(mockRouter.replace).toHaveBeenCalledWith("/(tabs)");
		expect(mockRouter.back).not.toHaveBeenCalled();
		mockRouter.canGoBack.mockReturnValue(true);
		await press(r, "Back", { exact: true });
		expect(mockRouter.back).toHaveBeenCalledTimes(1);
	});

	it("tells a pig with no full set what to do first when the cards finish", async () => {
		const bare = toMarketState({ ...RAW, me: { ...RAW.me, holdings: {} } });
		const r = await mount(bare, false);
		await press(r, "Next");
		await press(r, "Next");
		await press(r, "Step up to the counter");
		const t = textOf(r);
		expect(t).toContain("First, a full set");
		expect(t).toContain("A set is four of a common, three of the rest. Keep digging, or buy one from me right here.");
		expect(await AsyncStorage.getItem(MARKET_ONBOARDED_KEY)).toBe("1");
	});

	it("says why a take-down failed", async () => {
		const mine = toMarketState({
			...RAW,
			me: { ...RAW.me, offers: [{ id: 50, find_id: "pinecone", side: "sell", price: 13, qty: 4, created_at: "x", expires_at: "2026-11-06T10:00:00Z", status: "open" }] },
		});
		const r = await mount(mine);
		(harness.market.cancel as jest.Mock).mockResolvedValueOnce({ ok: false, reason: "network" });
		await press(r, "Take down: Selling 4 pinecones for 13");
		expect(textOf(r)).toContain("It may still be up.");
		(harness.market.cancel as jest.Mock).mockResolvedValueOnce({ ok: false, reason: "not_found" });
		await press(r, "Take down: Selling 4 pinecones for 13");
		expect(textOf(r)).toContain("That listing is already down");
	});

	it("keeps a notice that arrives while a sheet is up, and shows it after", async () => {
		const r = await mount();
		await press(r, "Your bag: what you hold");
		const notice = { id: 3, kind: "expired", offer: { id: 9, findId: "pinecone", side: "sell", price: 13, qty: 4, targetId: null, wantFindId: null, wantQty: null, createdAt: "", expiresAt: "", status: "expired" }, trade: null };
		await act(async () => {
			harness.onNotices?.([notice], STATE);
		});
		expect(textOf(r)).not.toContain("Your 4 pinecones came home");
		const kept = JSON.parse((await AsyncStorage.getItem("ttp.market.receipts")) ?? "[]");
		expect(kept.map((k: { key: string }) => k.key)).toEqual(["me:3"]);
		await press(r, "Close", { exact: true });
		expect(textOf(r)).toContain("Your 4 pinecones came home");
		expect(textOf(r)).toContain("in 48 hours");
	});
});

describe("the market shut", () => {
	const shut = (offers: unknown[]) => toMarketClosed({ ok: false, reason: "closed", now: "x", tick: 1, me: { id: "me", offers, holdings: {} } });

	it("keeps your listings in reach, with Take down", async () => {
		const r = await mount(null, true, shut([{ id: 50, find_id: "pinecone", side: "sell", price: 13, qty: 4, status: "open", expires_at: "2026-11-06T10:00:00Z" }]));
		const t = textOf(r);
		expect(t).toContain("The market's shut");
		expect(t).toContain("Bullion's packed up for now. Take anything you've pinned home.");
		expect(t).toContain("Selling 4 pinecones for 13");
		(harness.market.cancel as jest.Mock).mockResolvedValueOnce({ ok: true, reason: null });
		await press(r, "Take down: Selling 4 pinecones for 13");
		expect(harness.market.cancel).toHaveBeenCalledWith(50);
		// A failed take-down still says why, with no sheet to hold it.
		(harness.market.cancel as jest.Mock).mockResolvedValueOnce({ ok: false, reason: "network" });
		await press(r, "Take down: Selling 4 pinecones for 13");
		expect(textOf(r)).toContain("It may still be up.");
	});

	it("says only that he's packed up when nothing is pinned, and shuts over a stale market", async () => {
		const r = await mount(STATE, true, shut([]));
		const t = textOf(r);
		expect(t).toContain("He's packed up for now. Back soon.");
		expect(t).not.toContain("Your listings");
		expect(t).not.toContain("The Counter");
		await press(r, "Back", { exact: true });
		expect(mockRouter.back).toHaveBeenCalledTimes(1);
	});
});

describe("one-time moments", () => {
	// Pinecones quiet for 8 ticks, drifting home from 13.4 to 12.7.
	const quiet = toMarketState({
		...RAW,
		finds: [
			{ ...RAW.finds[0], price: 12.7, quiet_for: 8, spark: [13.4, 13.3, 13.2, 13.1, 13.0, 12.9, 12.8, 12.7].map((p, i) => [990000 - 7 + i, p]) },
			RAW.finds[1],
		],
	});

	it("writes the seen flag only when the card shows", async () => {
		jest.useFakeTimers();
		try {
			const r = await mount(quiet);
			await openPinecones(r);
			await act(async () => {
				await Promise.resolve();
			});
			expect(await AsyncStorage.getItem(MARKET_MOMENT_KEYS.quiet)).toBeNull();
			await act(async () => {
				jest.advanceTimersByTime(900);
			});
			expect(textOf(r)).toContain("Nobody's traded pinecones for a while");
			expect(await AsyncStorage.getItem(MARKET_MOMENT_KEYS.quiet)).toBe("1");
		} finally {
			jest.useRealTimers();
		}
	});

	it("queued under a sheet, it is not 'seen' until the sheet closes and it shows", async () => {
		jest.useFakeTimers();
		try {
			const r = await mount(quiet);
			await openPinecones(r);
			await press(r, "Buy 4 pinecones from Bullion for 15");
			await act(async () => {
				jest.advanceTimersByTime(900);
			});
			// Queued, held under the sheet: not seen yet.
			expect(await AsyncStorage.getItem(MARKET_MOMENT_KEYS.quiet)).toBeNull();
			await press(r, "Close", { exact: true });
			expect(textOf(r)).toContain("Nobody's traded pinecones for a while");
			expect(await AsyncStorage.getItem(MARKET_MOMENT_KEYS.quiet)).toBe("1");
		} finally {
			jest.useRealTimers();
		}
	});

	it("drops a queued quiet moment when the pig leaves that find, unseen", async () => {
		jest.useFakeTimers();
		try {
			const r = await mount(quiet);
			await openPinecones(r);
			await press(r, "Buy 4 pinecones from Bullion for 15");
			await act(async () => {
				jest.advanceTimersByTime(900);
			});
			// Leave the find while the card still waits under the sheet.
			await press(r, "Back to the counter", { exact: true });
			await press(r, "Close", { exact: true });
			await act(async () => {
				jest.advanceTimersByTime(2000);
			});
			expect(textOf(r)).not.toContain("Nobody's traded pinecones for a while");
			expect(await AsyncStorage.getItem(MARKET_MOMENT_KEYS.quiet)).toBeNull();
			// Unseen, so it can still play: back on the quiet find, it does.
			await press(r, "Pinecones, a set of 4");
			await act(async () => {
				jest.advanceTimersByTime(900);
			});
			expect(textOf(r)).toContain("Nobody's traded pinecones for a while");
		} finally {
			jest.useRealTimers();
		}
	});

	it("takes back the quiet moment if the pig leaves before it shows", async () => {
		jest.useFakeTimers();
		try {
			const r = await mount(quiet);
			await openPinecones(r);
			// Leave during the delay: the timer is cancelled and nothing is written.
			await press(r, "Back to the counter", { exact: true });
			await act(async () => {
				jest.advanceTimersByTime(2000);
			});
			expect(textOf(r)).not.toContain("Nobody's traded pinecones for a while");
			expect(await AsyncStorage.getItem(MARKET_MOMENT_KEYS.quiet)).toBeNull();
		} finally {
			jest.useRealTimers();
		}
	});
});
