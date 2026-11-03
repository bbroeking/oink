// hooks/useMarket (2026-11-02 launch audit):
//   • a write's answer comes back at once; the read that catches the screen up
//     runs behind it and can hang without holding the receipt
//   • a hung read lets go after its timeout (no endless spinner), and its late
//     answer still hands over its notices without rolling the screen back
//   • the poll runs only while the app is in the foreground; coming back reads
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState, type AppStateStatus } from "react-native";

jest.mock("expo-router/react-navigation", () => ({
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- a mock factory loads React after Jest hoisting
	useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
}));
jest.mock("@/utils/market", () => ({
	...jest.requireActual("@/utils/market"),
	fetchMarketState: jest.fn(),
	fetchMarketFind: jest.fn(),
	marketCounter: jest.fn(),
	marketPost: jest.fn(),
	marketTake: jest.fn(),
	marketCancel: jest.fn(),
}));

import { MARKET_READ_TIMEOUT_MS, useMarket, type UseMarket } from "@/hooks/useMarket";
import { fetchMarketFind, fetchMarketState, marketCancel, marketCounter, toMarketState, type MarketNotice, type MarketState } from "@/utils/market";

const mockFetch = jest.mocked(fetchMarketState);
const mockCancel = jest.mocked(marketCancel);
const mockFind = jest.mocked(fetchMarketFind);
const mockCounter = jest.mocked(marketCounter);

const stateWith = (coin: number, notices: unknown[] = []) =>
	toMarketState({ now: "x", tick: 1, me: { id: "me", coin }, finds: [], board: [], tape: [], notices });
const answered = (s: MarketState) => Promise.resolve({ ok: true as const, state: s });
const hung = () => new Promise<never>(() => {});

let appListener: ((s: AppStateStatus) => void) | null = null;
const setApp = (s: AppStateStatus) => {
	(AppState as unknown as { currentState: AppStateStatus }).currentState = s;
};

let hook: UseMarket | null = null;
let onNotices: jest.Mock;
const renderers: TestRenderer.ReactTestRenderer[] = [];

function Probe() {
	const value = useMarket({ onNotices });
	React.useEffect(() => {
		hook = value;
	});
	return null;
}

function mount() {
	act(() => {
		renderers.push(TestRenderer.create(<Probe />));
	});
}

beforeEach(() => {
	jest.useFakeTimers();
	setApp("active");
	appListener = null;
	jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
		appListener = listener as (s: AppStateStatus) => void;
		return { remove: () => (appListener = null) } as never;
	});
	onNotices = jest.fn();
	mockFetch.mockReset();
	mockFind.mockReset();
	mockCounter.mockReset();
	mockCancel.mockReset();
	hook = null;
});

afterEach(() => {
	act(() => {
		for (const r of renderers.splice(0)) r.unmount();
	});
	jest.clearAllTimers();
	jest.useRealTimers();
	jest.restoreAllMocks();
});

// Let resolved promises run.
const settle = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
};

describe("useMarket", () => {
	it("hands a write's answer back at once, with the bank, while the catch-up read hangs", async () => {
		mockFetch.mockReturnValueOnce(answered(stateWith(20))).mockImplementation(hung);
		mount();
		await settle();
		expect(hook!.state?.me.coin).toBe(20);
		mockCounter.mockResolvedValue({ ok: true, replay: false, filled: true, via: "counter", trade: null, offer: null, coin: 5 });
		let out: Awaited<ReturnType<UseMarket["counter"]>> | null = null;
		await act(async () => {
			out = await hook!.counter("pinecone", "buy", 15, "n1");
		});
		expect(out).toMatchObject({ ok: true, coin: 5 });
		expect(mockCounter).toHaveBeenCalledWith("pinecone", "buy", 15, "n1");
		// The header's tickles moved with the receipt; the read is still out.
		expect(hook!.state?.me.coin).toBe(5);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it("takes a listing down at once, without waiting on the catch-up read", async () => {
		const listed = toMarketState({
			now: "x",
			tick: 1,
			me: { id: "me", coin: 1, offers: [{ id: 50, find_id: "pinecone", side: "sell", price: 13, qty: 4, status: "open" }] },
			board: [{ id: 50, find_id: "pinecone", side: "sell", price: 13, qty: 4, poster: { id: "me", you: true } }],
		});
		mockFetch.mockReturnValueOnce(answered(listed)).mockImplementation(hung);
		mount();
		await settle();
		expect(hook!.state?.me.offers).toHaveLength(1);
		mockCancel.mockResolvedValue({ ok: true, reason: null });
		await act(async () => {
			await hook!.cancel(50);
		});
		expect(hook!.state?.me.offers).toEqual([]);
		expect(hook!.state?.board).toEqual([]);
	});

	it("holds a closed answer with your listings until a read finds the market open", async () => {
		const closedAnswer = {
			ok: false as const,
			reason: "closed",
			closed: { now: "x", tick: 1, me: { id: "me", offers: toMarketState({ me: { offers: [{ id: 50, find_id: "pinecone", side: "sell", price: 13, qty: 4, status: "open" }] } }).me.offers, holdings: {} } },
		};
		const emptied = { ...closedAnswer, closed: { ...closedAnswer.closed, me: { ...closedAnswer.closed.me, offers: [] } } };
		// The focus read is shut; the catch-up read after the take-down hangs.
		mockFetch.mockResolvedValueOnce(closedAnswer).mockImplementationOnce(hung).mockResolvedValue(emptied);
		mount();
		await settle();
		expect(hook!.closed?.me.offers.map((o) => o.id)).toEqual([50]);
		expect(hook!.error).toBe("closed");
		expect(hook!.state).toBeNull();
		// Taking one down while shut: it leaves the list at once.
		mockCancel.mockResolvedValue({ ok: true, reason: null });
		await act(async () => {
			await hook!.cancel(50);
		});
		expect(hook!.closed?.me.offers).toEqual([]);
		// The hung catch-up read lets go; then a read finds the market open again.
		await act(async () => {
			jest.advanceTimersByTime(MARKET_READ_TIMEOUT_MS);
		});
		await settle();
		mockFetch.mockReset();
		mockFetch.mockReturnValue(answered(stateWith(9)));
		await act(async () => {
			await hook!.refresh(true);
		});
		expect(hook!.closed).toBeNull();
		expect(hook!.state?.me.coin).toBe(9);
	});

	it("answers a hung write as a lost answer once its timeout passes", async () => {
		mockFetch.mockReturnValueOnce(answered(stateWith(20))).mockImplementation(hung);
		mount();
		await settle();
		mockCounter.mockImplementation(hung);
		let done = false;
		const out = hook!.counter("pinecone", "buy", 15, "n1").then((r) => {
			done = true;
			return r;
		});
		await settle();
		expect(done).toBe(false);
		await act(async () => {
			jest.advanceTimersByTime(20_000);
		});
		await settle();
		await expect(out).resolves.toMatchObject({ ok: false, reason: "timeout" });
	});

	it("lets a hung read go after its timeout, then lands its late notices without rolling back", async () => {
		let lateResolve: (v: { ok: true; state: MarketState }) => void = () => {};
		mockFetch.mockImplementationOnce(() => new Promise((r) => (lateResolve = r)));
		mount();
		// The focus read is the one that hangs; a second refresh shares it.
		const first = hook!.refresh();
		await act(async () => {
			jest.advanceTimersByTime(MARKET_READ_TIMEOUT_MS);
		});
		await settle();
		await expect(first).resolves.toBeNull();
		expect(hook!.error).toBe("timeout");
		expect(hook!.loading).toBe(false);
		// A newer read lands first ...
		mockFetch.mockReturnValueOnce(answered(stateWith(30)));
		await act(async () => {
			await hook!.refresh(true);
		});
		expect(hook!.state?.me.coin).toBe(30);
		expect(hook!.error).toBeNull();
		// ... then the old one: its notice is handed over, its state is not.
		const notice = { id: 7, kind: "expired", offer: { id: 1, find_id: "pinecone", side: "sell", price: 12, qty: 4 }, trade: null };
		await act(async () => {
			lateResolve({ ok: true, state: stateWith(10, [notice]) });
		});
		await settle();
		expect(hook!.state?.me.coin).toBe(30);
		expect(onNotices).toHaveBeenCalledTimes(1);
		expect((onNotices.mock.calls[0][0] as MarketNotice[])[0]).toMatchObject({ id: 7, kind: "expired" });
	});

	it("answers a find's chart as null when its read times out", async () => {
		mockFetch.mockImplementation(() => answered(stateWith(1)));
		mockFind.mockImplementation(hung);
		mount();
		await settle();
		const view = hook!.loadFind("pinecone");
		await act(async () => {
			jest.advanceTimersByTime(MARKET_READ_TIMEOUT_MS);
		});
		await expect(view).resolves.toBeNull();
	});

	it("polls only in the foreground and reads on coming back", async () => {
		mockFetch.mockImplementation(() => answered(stateWith(1)));
		mount();
		await settle();
		expect(mockFetch).toHaveBeenCalledTimes(1);
		await act(async () => {
			jest.advanceTimersByTime(20_000);
		});
		expect(mockFetch).toHaveBeenCalledTimes(2);
		act(() => {
			setApp("background");
			appListener?.("background");
		});
		await act(async () => {
			jest.advanceTimersByTime(60_000);
		});
		expect(mockFetch).toHaveBeenCalledTimes(2);
		act(() => {
			setApp("active");
			appListener?.("active");
		});
		await settle();
		expect(mockFetch).toHaveBeenCalledTimes(3);
		await act(async () => {
			jest.advanceTimersByTime(20_000);
		});
		expect(mockFetch).toHaveBeenCalledTimes(4);
	});
});
