// Bullion's Market screens and sheets (components/market) render against a
// realistic market_state, and their key words and actions are there:
//   • the home: Bullion's line, the ledger, the ticker, both places, your listings
//   • the Counter: a row per find with its price and change; a tap opens it
//   • a find: the quote, the cheaper listing and the better wanted ad on the board
//   • the board: cards sorted for-you first; Buy / Sell / Swap gated on bank and bag
//   • confirm: the counter sale says where the price goes and offers the board's
//     better deal; a board listing that vanished says so
//   • post: between Bullion's prices the verdict is "good"; a sell under his
//     buying price says Bullion buys it at once; posting hands the spec over
//   • the receipts' words for a counter sale, a pig sale that beat the counter,
//     and a refusal
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

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

import { BoardView, CounterView, FindView, MarketHome } from "@/components/market/MarketViews";
import { ConfirmSheet, PostSheet, newDraft } from "@/components/market/MarketSheets";
import { refusalReceipt, tradeReceipt } from "@/components/market/marketCopy";
import { toMarketFindView, toMarketState, toMarketTrade, type MarketTrade } from "@/utils/market";

const METRICS = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const RAW = {
	ok: true,
	now: "2026-11-05T14:10:00Z",
	tick: 990000,
	tuning: { set_size: { common: 4, uncommon: 3, rare: 3 }, base: { common: 3, uncommon: 8, rare: 20 } },
	finds: [
		{ id: "pinecone", rarity: "common", size: 4, usual: 12, price: 12, ask: 15, bid: 9, prev: 11.6, quiet_for: 2, spark: [[989999, 11.9], [990000, 12]] },
		{ id: "old_key", rarity: "uncommon", size: 3, usual: 24, price: 24.5, ask: 30, bid: 19, prev: 24.5, quiet_for: 9, spark: [[990000, 24.5]] },
		{ id: "marble", rarity: "uncommon", size: 3, usual: 24, price: 23, ask: 28, bid: 18, prev: 24, quiet_for: 1, spark: [] },
	],
	me: {
		id: "me",
		coin: 20,
		cap: 25,
		spent: 13,
		took_in: 18,
		posts_today: 1,
		holdings: { pinecone: { held: 5, paid: 0, paid_units: 0, on_offer: 0 }, old_key: { held: 3, paid: 22, paid_units: 3, on_offer: 0 } },
		offers: [{ id: 50, find_id: "old_key", side: "sell", price: 26, qty: 3, created_at: "2026-11-05T10:00:00Z", expires_at: "2026-11-06T10:00:00Z", status: "open" }],
	},
	board: [
		{ id: 1, find_id: "pinecone", side: "sell", price: 13, qty: 4, poster: { id: "maya", name: "Maya", friend: true }, for_you: false, expires_at: "2026-11-06T09:00:00Z" },
		{ id: 2, find_id: "pinecone", side: "buy", price: 11, qty: 4, poster: { id: "s1", friend: false }, poster_coin_ok: true, expires_at: "2026-11-06T09:00:00Z" },
		{ id: 3, find_id: "marble", side: "swap", price: null, qty: 3, want_find_id: "pinecone", want_qty: 2, poster: { id: "biscuit", name: "Biscuit", friend: true }, for_you: true, expires_at: "2026-11-06T09:00:00Z" },
		{ id: 4, find_id: "old_key", side: "sell", price: 40, qty: 3, poster: { id: "s2", friend: false }, expires_at: "2026-11-06T09:00:00Z" },
	],
	tape: [
		{ id: 9, kind: "counter", side: "sell", find_id: "pinecone", qty: 4, price: 9, seller: { id: "me", you: true }, tick: 990000, at: "x" },
		{ id: 8, kind: "print", find_id: "old_key", qty: 3, price: 24, who: "the Miller", dir: "up", tick: 989999, at: "x" },
	],
	notices: [],
	friends: [{ id: "maya", name: "Maya", pig_id: "maya" }, { id: "biscuit", name: "Biscuit", pig_id: "biscuit" }],
	yesterday: { find_id: "pinecone", sets: 6, lo: 11.4, hi: 12.8 },
};
const STATE = toMarketState(RAW);
const NOW_MS = Date.parse("2026-11-05T14:10:00Z");

function render(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(<SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>);
	});
	return r;
}

function textOf(r: TestRenderer.ReactTestRenderer): string {
	const out: string[] = [];
	const walk = (n: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | string | null) => {
		if (n == null) return;
		if (typeof n === "string") out.push(n);
		else if (Array.isArray(n)) n.forEach(walk);
		else (n.children ?? []).forEach((c) => walk(c as never));
	};
	walk(r.toJSON() as never);
	return out.join(" ");
}

function nodeText(n: TestRenderer.ReactTestInstance | string): string {
	if (typeof n === "string") return n;
	return n.children.map((c) => nodeText(c as TestRenderer.ReactTestInstance | string)).join("");
}

function pressByText(r: TestRenderer.ReactTestRenderer, text: string) {
	const hit = r.root.findAll(
		(n) =>
			typeof n.props.onPress === "function" &&
			(String(n.props.accessibilityLabel ?? "").includes(text) || nodeText(n).includes(text)),
	);
	if (!hit.length) throw new Error(`nothing pressable says ${text}`);
	act(() => hit[0].props.onPress());
}

describe("Bullion's Market screens", () => {
	it("draws the market home", () => {
		const onCounter = jest.fn();
		const r = render(
			<MarketHome state={STATE} sayTurn={0} nowMs={NOW_MS} onCounter={onCounter} onBoard={jest.fn()} onBag={jest.fn()} onCancel={jest.fn()} onReplayIntro={jest.fn()} busyId={null} />,
		);
		const t = textOf(r);
		expect(t).toContain("Pinecones were busy yesterday: 6 sets, the price between 11.4 and 12.8.");
		expect(t).toContain("spent 13 · took in 18 · ");
		expect(t).toContain("up 5");
		expect(t).toContain("You sold Bullion 4 pinecones · 9");
		expect(t).toContain("The Counter");
		expect(t).toContain("The Noticeboard");
		expect(t).toContain("1 for you");
		expect(t).toContain("Selling 3 old keys for 26");
		expect(t).toContain("1 up · 1 down since yesterday");
		pressByText(r, "The Counter: buy or sell");
		expect(onCounter).toHaveBeenCalled();
	});

	it("draws the counter, a row per find", () => {
		const onOpen = jest.fn();
		const r = render(<CounterView state={STATE} fancy="old_key" onOpen={onOpen} />);
		const t = textOf(r);
		expect(t).toContain("Pinecones");
		expect(t).toContain("you have 1 set");
		expect(t).toContain("up 0.4");
		expect(t).toContain("steady");
		expect(t).toContain("3 each");
		pressByText(r, "Old keys, a set of 3");
		expect(onOpen).toHaveBeenCalledWith("old_key");
	});

	it("draws a find, with the board's better deals", () => {
		const view = toMarketFindView({ find_id: "pinecone", tick: 990000, hist: [[989990, 11.8], [990000, 12]], marks: [[989995, "counter", 9]], recent: RAW.tape, today: {} });
		const r = render(
			<FindView
				state={STATE}
				find={STATE.finds[0]}
				view={view}
				fancy={null}
				sheepEach={3}
				sheepHere={false}
				nowMs={NOW_MS}
				weekdayOf={() => "Thu"}
				isDayStart={() => false}
				ticksPerDay={48}
				onTake={jest.fn()}
				onOpen={jest.fn()}
				onCancel={jest.fn()}
				busyId={null}
			/>,
		);
		const t = textOf(r);
		expect(t).toContain("“I'll sell for 15 · I'll buy for 9”");
		expect(t).toContain("Cheaper on the noticeboard");
		expect(t).toContain("Maya's 4 for 13");
		expect(t).toContain("Pays more on the noticeboard");
		expect(t).toContain("A pig wants 4 for 11");
		expect(t).toContain("all dug up, so a sale is all gain");
		expect(t).toContain("He pays 3 each for pinecones (12 a set).");
		expect(t).toContain("You sold to Bullion");
	});

	it("draws the board, for-you first, gated on bank and bag", () => {
		const onTake = jest.fn();
		const r = render(
			<BoardView state={STATE} filter="all" onFilter={jest.fn()} shown={24} onMore={jest.fn()} nowMs={NOW_MS} onTake={onTake} onCancel={jest.fn()} busyId={null} />,
		);
		const t = textOf(r);
		// Biscuit's swap was sent to you: it is pinned first.
		expect(t.indexOf("Biscuit")).toBeLessThan(t.indexOf("Maya"));
		expect(t).toContain("Swap");
		expect(t).toContain("Buy for 13");
		expect(t).toContain("Sell for 11");
		expect(t).toContain("you have 20 ready");
		pressByText(r, "Buy for 13");
		expect(onTake).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
	});
});

describe("Bullion's Market sheets", () => {
	it("confirms a counter sale with the price move and the board's better deal", () => {
		const r = render(
			<ConfirmSheet
				open
				target={{ via: "counter", findId: "pinecone", side: "sell" }}
				state={STATE}
				busy={false}
				onClose={jest.fn()}
				onCounter={jest.fn()}
				onTake={jest.fn()}
				onSwitchToCard={jest.fn()}
				onPostHere={jest.fn()}
			/>,
		);
		const t = textOf(r);
		expect(t).toContain("Sell for 9.");
		expect(t).toContain("The price goes 12 → 11.6.");
		expect(t).toContain("Pays more on the noticeboard");
	});

	it("says a vanished listing is gone", () => {
		const gone = { ...STATE.board[0], id: 999 };
		const r = render(
			<ConfirmSheet open target={{ via: "board", card: gone }} state={STATE} busy={false} onClose={jest.fn()} onCounter={jest.fn()} onTake={jest.fn()} onSwitchToCard={jest.fn()} onPostHere={jest.fn()} />,
		);
		expect(textOf(r)).toContain("That listing is gone");
	});

	it("posts between Bullion's prices, and warns under his buying price", () => {
		const onPost = jest.fn();
		const draft = newDraft(STATE, "sell", "pinecone");
		expect(draft).toMatchObject({ side: "sell", findId: "pinecone", price: 12 });
		const r = render(
			<PostSheet open draft={{ ...draft, price: 12 }} setDraft={jest.fn()} state={STATE} busy={false} error={null} onClose={jest.fn()} onPost={onPost} />,
		);
		expect(textOf(r)).toContain("Between his prices: you beat Bullion's 9, and a buyer beats his 15.");
		pressByText(r, "Pin it: 4 pinecones for 12");
		expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ side: "sell", findId: "pinecone", price: 12, targetId: null }));

		const r2 = render(
			<PostSheet open draft={{ ...draft, price: 8 }} setDraft={jest.fn()} state={STATE} busy={false} error={null} onClose={jest.fn()} onPost={jest.fn()} />,
		);
		// A stranger's wanted ad pays 11: better than Bullion's 9, so the pig gets it.
		expect(textOf(r2)).toContain("A pig's wanted ad pays 11: it sells now, 2 more than Bullion pays.");

		const bare = toMarketState({ ...RAW, board: [] });
		const r3 = render(
			<PostSheet open draft={{ ...draft, price: 8 }} setDraft={jest.fn()} state={bare} busy={false} error={null} onClose={jest.fn()} onPost={jest.fn()} />,
		);
		expect(textOf(r3)).toContain("At 9 or under, Bullion buys it at once for 9.");
	});

	it("falls back to Wanted when you hold no set to sell", () => {
		const d = newDraft(STATE, "sell", "marble");
		expect(d.findId).toBe("pinecone");
		const empty = toMarketState({ ...RAW, me: { ...RAW.me, holdings: {} } });
		expect(newDraft(empty, "swap", "marble").side).toBe("buy");
	});
});

describe("Bullion's Market receipts", () => {
	const trade = (raw: Record<string, unknown>) => toMarketTrade({ id: 1, find_id: "pinecone", qty: 4, tick: 1, at: "x", ...raw }) as MarketTrade;

	it("tells a counter sale with its cost and the move", () => {
		const r = tradeReceipt(trade({ kind: "counter", side: "sell", price: 9, from: 12, to: 11.64, seller: { id: "me", you: true } }));
		expect(r.title).toBe("Bullion bought your 4 pinecones for 9");
		expect(r.line).toBe("you dug them up · +9 · the price went 12 → 11.6");
	});

	it("ribbons a pig sale that beat the counter", () => {
		const r = tradeReceipt(trade({ kind: "pig", how: "listing", price: 12, bid: 9, ask: 15, seller: { id: "me", you: true }, buyer: { id: "maya", name: "Maya", friend: true } }));
		expect(r.ribbon).toBe("beat the counter");
		expect(r.line).toBe("Bullion would have paid 9 · +3 for listing it");
	});

	it("shrugs a refusal", () => {
		const r = refusalReceipt({ ok: false, reason: "price_moved", now: 8, ready: null, needed: null, held: null, setSize: null }, "pinecone", 4, 30);
		expect(r).toMatchObject({ pose: "shrug", title: "The price moved", line: "It's 8 now. Take another look." });
	});
});

describe("Bullion's Market audit regressions", () => {
	it("sizes a notice from the server's own qty, not a default", () => {
		const { noticeReceipt, bullionSays } = jest.requireActual("@/components/market/marketCopy");
		const r = noticeReceipt({
			id: 1,
			kind: "expired",
			offer: { id: 9, findId: "tin_whistle", side: "sell", price: 70, qty: 3, targetId: null, wantFindId: null, wantQty: null, createdAt: "", expiresAt: "", status: "expired" },
			trade: null,
		});
		expect(r.title).toBe("Your 3 tin whistles came home");
		expect(bullionSays(0, { findId: "pinecone", sets: 1, lo: 11, hi: 12 })).toContain("1 set, the price");
	});

	it("queues receipts, holds them under a sheet, and drops none", () => {
		const { useReceipts } = jest.requireActual("@/components/market/ReceiptStack");
		let api: { shown: { title: string }[]; push: (r: unknown) => void; dismiss: (id: number) => void } | null = null;
		function Probe({ held }: { held: boolean }) {
			api = useReceipts(held);
			return null;
		}
		const r = render(<Probe held />);
		act(() => {
			for (let i = 1; i <= 5; i++) api!.push({ pose: "stand", title: `n${i}`, tone: "plain" });
		});
		expect(api!.shown).toHaveLength(0);
		act(() => r.update(<SafeAreaProvider initialMetrics={METRICS}><Probe held={false} /></SafeAreaProvider>));
		expect(api!.shown.map((x) => x.title).sort()).toEqual(["n1", "n2", "n3"]);
		act(() => api!.dismiss((api!.shown[0] as unknown as { id: number }).id));
		expect(api!.shown).toHaveLength(3);
	});

	it("locks a wanted ad whose pig can't pay", () => {
		const s = toMarketState({ ...RAW, board: [{ ...RAW.board[1], poster_coin_ok: false }] });
		const r = render(<BoardView state={s} filter="all" onFilter={jest.fn()} shown={24} onMore={jest.fn()} nowMs={NOW_MS} onTake={jest.fn()} onCancel={jest.fn()} busyId={null} />);
		expect(textOf(r)).toContain("can't pay right now");
	});
});
