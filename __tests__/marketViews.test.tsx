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

import AsyncStorage from "@react-native-async-storage/async-storage";
import { BoardView, CounterView, FindView, MarketHome } from "@/components/market/MarketViews";
import { ConfirmSheet, OnboardSheet, PostSheet, draftSpec, newDraft } from "@/components/market/MarketSheets";
import { keepReceipt, keptReceipts, parseKept, useReceipts } from "@/components/market/ReceiptStack";
import {
	LOST_ANSWER,
	capLine,
	firstStepsCard,
	movedMoment,
	noticeReceipt,
	onboardingCards,
	pinnedReceipt,
	refusalReceipt,
	ownSetOf,
	setOf,
	setSizeLabel,
	setSizeWords,
	shortOfSet,
	takeDownReceipt,
	tradeLine,
	tradeReceipt,
} from "@/components/market/marketCopy";
import { MARKET_KEPT_RECEIPTS_KEY, MARKET_TUNING } from "@/constants/market";
import { TAP_MIN } from "@/constants/theme";
import { toMarketFindView, toMarketState, toMarketTrade, type MarketNotice, type MarketTrade } from "@/utils/market";

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
		{ id: 2, find_id: "pinecone", side: "buy", price: 11, qty: 4, poster: { friend: false }, poster_coin_ok: true, expires_at: "2026-11-06T09:00:00Z" },
		{ id: 3, find_id: "marble", side: "swap", price: null, qty: 3, want_find_id: "pinecone", want_qty: 2, poster: { id: "biscuit", name: "Biscuit", friend: true }, for_you: true, expires_at: "2026-11-06T09:00:00Z" },
		{ id: 4, find_id: "old_key", side: "sell", price: 40, qty: 3, poster: { friend: false }, expires_at: "2026-11-06T09:00:00Z" },
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
const renderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
	act(() => {
		for (const renderer of renderers.splice(0)) renderer.unmount();
	});
});

function render(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(<SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>);
		renderers.push(r);
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
		expect(t).toContain("The price goes 12 → 11.4.");
		expect(t).toContain("pulls it down 5% of the usual price.");
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

	it("queues receipts, holds them under a sheet, drops none, and puts your own first", () => {
		const { useReceipts } = jest.requireActual("@/components/market/ReceiptStack");
		let api: { shown: { title: string; id: number }[]; push: (r: unknown, o?: unknown) => void; dismiss: (id: number) => void } | null = null;
		function Probe({ held }: { held: boolean }) {
			api = useReceipts(held);
			return null;
		}
		const r = render(<Probe held />);
		act(() => {
			for (let i = 1; i <= 4; i++) api!.push({ pose: "stand", title: `n${i}`, tone: "plain" });
		});
		expect(api!.shown).toHaveLength(0);
		act(() => r.update(<SafeAreaProvider initialMetrics={METRICS}><Probe held={false} /></SafeAreaProvider>));
		expect(api!.shown.map((x) => x.title)).toEqual(["n1", "n2", "n3"]);
		act(() => api!.push({ pose: "gavel", title: "mine", tone: "plain" }, { urgent: true }));
		expect(api!.shown.map((x) => x.title)).toEqual(["mine", "n1", "n2"]);
		act(() => api!.dismiss(api!.shown[0].id));
		expect(api!.shown.map((x) => x.title)).toEqual(["n1", "n2", "n3"]);
		act(() => api!.dismiss(api!.shown[0].id));
		expect(api!.shown.map((x) => x.title)).toEqual(["n2", "n3", "n4"]);
	});

	it("locks a wanted ad whose pig can't pay", () => {
		const s = toMarketState({ ...RAW, board: [{ ...RAW.board[1], poster_coin_ok: false }] });
		const r = render(<BoardView state={s} filter="all" onFilter={jest.fn()} shown={24} onMore={jest.fn()} nowMs={NOW_MS} onTake={jest.fn()} onCancel={jest.fn()} busyId={null} />);
		expect(textOf(r)).toContain("can't pay right now");
	});
});

describe("Bullion daily shelf", () => {
	const state = toMarketState({ ...RAW, board: [{ id: -1, source: "bullion", find_id: "pinecone", side: "sell", price: 12, qty: 4, poster: { id: "bullion", kind: "bullion", name: "Bullion" }, expires_at: "2026-11-06T00:00:00Z" }] });
	it("names Bullion and the daily shelf on the board purchase action", () => {
		const onTake = jest.fn();
		const r = render(<BoardView state={state} filter="all" onFilter={jest.fn()} shown={24} onMore={jest.fn()} nowMs={NOW_MS} onTake={onTake} onCancel={jest.fn()} busyId={null} />);
		expect(textOf(r)).toContain("Daily shelf");
		pressByText(r, "Buy 4 pinecones for 12 from Bullion's daily shelf");
		expect(onTake).toHaveBeenCalledWith(state.board[0]);
	});
	it("confirms the shelf quote and counter impact, then takes that listing", () => {
		const onTake = jest.fn();
		const r = render(<ConfirmSheet open target={{ via: "board", card: state.board[0] }} state={state} busy={false} onClose={jest.fn()} onCounter={jest.fn()} onTake={onTake} onSwitchToCard={jest.fn()} onPostHere={jest.fn()} />);
		const text = textOf(r);
		expect(text).toContain("Buy 4 pinecones from Bullion");
		expect(text).toContain("Buy for 12.");
		expect(text).toContain("Buying from Bullion pushes the price up: 12 → 12.6.");
		expect(text).not.toContain("A pig sale");
		pressByText(r, "Buy for 12");
		expect(onTake).toHaveBeenCalledWith(state.board[0]);
	});
	it("receipts and tape preserve the actual shelf price and board source", () => {
		const { tickerLine, tradeLine, movedMoment } = jest.requireActual("@/components/market/marketCopy");
		const trade = toMarketTrade({ id: 1, kind: "counter", how: "board", side: "buy", find_id: "pinecone", qty: 4, price: 12, ask: 15, from: 12, to: 12.36, buyer: { id: "stranger" } })!;
		expect(tradeReceipt(trade)).toMatchObject({ title: "You bought 4 pinecones from Bullion for 12", line: "From his daily shelf · the price went 12 → 12.4" });
		expect(tickerLine(trade, 4)).toEqual({ tag: "board", text: "A pig bought 4 pinecones from Bullion · 12 · daily shelf" });
		expect(tradeLine(trade, "pinecone", 4).tag).toBe("board");
		expect(movedMoment(trade).line).toContain("Every set bought from me nudges it.");
	});
});

// ── The 2026-11-02 launch audit ──────────────────────────────────────────────

const LOST_TEXT = `${LOST_ANSWER.title}.`;
const noEmDash = (x: string | undefined) => expect(x ?? "").not.toMatch(/\u2014/);
const confirmProps = { busy: false, onClose: jest.fn(), onCounter: jest.fn(), onTake: jest.fn(), onSwitchToCard: jest.fn(), onPostHere: jest.fn() };

describe("a lost answer, said inside the open sheet", () => {
	it("words the lost answer as 'may have traded', never 'it didn't go through'", () => {
		for (const reason of ["network", "no_data", "timeout"]) {
			const r = refusalReceipt({ ok: false, reason, now: null, ready: null, needed: null, held: null, setSize: null }, "pinecone", 4, 30);
			expect(r).toMatchObject({ title: "Couldn't hear back from Bullion", line: "Check your bag before you try again." });
		}
	});

	it("shows the line in the confirm sheet when its trade is lost", () => {
		const r = render(<ConfirmSheet open target={{ via: "counter", findId: "pinecone", side: "buy" }} state={STATE} lost {...confirmProps} />);
		const t = textOf(r);
		expect(t).toContain(LOST_TEXT);
		expect(t).toContain("Check your bag before you try again.");
		const quiet = render(<ConfirmSheet open target={{ via: "counter", findId: "pinecone", side: "buy" }} state={STATE} {...confirmProps} />);
		expect(textOf(quiet)).not.toContain(LOST_TEXT);
	});

	it("shows it on a board listing, and on one that vanished (it may have gone to you)", () => {
		const live = render(<ConfirmSheet open target={{ via: "board", card: STATE.board[0] }} state={STATE} lost {...confirmProps} />);
		expect(textOf(live)).toContain(LOST_TEXT);
		const gone = render(<ConfirmSheet open target={{ via: "board", card: { ...STATE.board[0], id: 999 } }} state={STATE} lost {...confirmProps} />);
		expect(textOf(gone)).toContain(LOST_TEXT);
		expect(textOf(gone)).toContain("it may have gone to you");
		expect(textOf(gone)).not.toContain("Another pig got there first");
	});

	it("shows it in the post sheet", () => {
		const draft = newDraft(STATE, "sell", "pinecone");
		const r = render(<PostSheet open draft={draft} setDraft={jest.fn()} state={STATE} busy={false} error={null} lost onClose={jest.fn()} onPost={jest.fn()} />);
		expect(textOf(r)).toContain(LOST_TEXT);
	});

	it("posts the same spec the screen keys its nonce on", () => {
		const onPost = jest.fn();
		const draft = { ...newDraft(STATE, "sell", "pinecone"), price: 999 };
		const r = render(<PostSheet open draft={draft} setDraft={jest.fn()} state={STATE} busy={false} error={null} onClose={jest.fn()} onPost={onPost} />);
		pressByText(r, "Pin it anyway");
		// The price is held to the band (18 at most for pinecones here).
		expect(onPost).toHaveBeenCalledWith(draftSpec(STATE, draft));
		expect(draftSpec(STATE, draft)).toMatchObject({ price: 18 });
	});
});

describe("the season reset notice", () => {
	const offer = (side: "sell" | "buy" | "swap") => ({
		id: 9, findId: "pinecone" as const, side, price: side === "swap" ? null : 12, qty: 4, targetId: null,
		wantFindId: side === "swap" ? ("old_key" as const) : null, wantQty: side === "swap" ? 1 : null, createdAt: "", expiresAt: "", status: "reset",
	});
	const notice = (side: "sell" | "buy" | "swap"): MarketNotice => ({ id: 1, kind: "reset", offer: offer(side), trade: null });

	it("tells each listing kindly, in Bullion's voice, that the fresh start took it", () => {
		const sell = noticeReceipt(notice("sell"))!;
		expect(sell.title).toBe("Your 4 pinecones went with the fresh start");
		expect(sell.line).toContain("Season 2");
		expect(sell.line).toContain("I took your listing down");
		expect(sell.pose).toBe("stand");
		const swap = noticeReceipt(notice("swap"))!;
		expect(swap.title).toBe("Your swap went with the fresh start");
		const buy = noticeReceipt(notice("buy"))!;
		expect(buy.title).toBe("Your wanted ad for pinecones came down");
		expect(buy.line).toContain("I cleared the board");
		for (const r of [sell, swap, buy]) {
			noEmDash(r.title);
			noEmDash(r.line);
		}
	});
});

describe("the tunables are read off the server's tuning", () => {
	const small = { ...MARKET_TUNING, setSize: { common: 3, uncommon: 2, rare: 1 }, offerHours: 36, price: { ...MARKET_TUNING.price, impact: 0.04, pigPull: 0.5 } };

	it("says the set sizes, the listing hours, the price's step and a pig sale's pull from tuning", () => {
		const shipped = { ...MARKET_TUNING, setSize: { common: 4, uncommon: 3, rare: 3 } };
		expect(setSizeWords(MARKET_TUNING)).toBe("three of a common, two of an uncommon, or a rare on its own");
		expect(setSizeWords(small)).toBe("three of a common, two of an uncommon, or a rare on its own");
		expect(setSizeWords(shipped)).toBe("four of a common, three of the rest");
		expect(onboardingCards()[0].say).toBe(
			"Hand me a set and I'll pay you on the spot. Need a set? I've always got one. Three of a common, two of an uncommon, or a rare on its own.",
		);
		expect(onboardingCards(shipped)[0].say).toContain("Four of a common, three of the rest.");
		const expired = noticeReceipt({ id: 1, kind: "expired", offer: { id: 9, findId: "pinecone", side: "sell", price: 12, qty: 4, targetId: null, wantFindId: null, wantQty: null, createdAt: "", expiresAt: "", status: "expired" }, trade: null }, small);
		expect(expired?.line).toBe("Nobody took them at 12 in 36 hours.");
		const swapOffer = { id: 9, findId: "pinecone" as const, side: "swap" as const, price: null, qty: 4, targetId: null, wantFindId: "old_key" as const, wantQty: 1, createdAt: "", expiresAt: "", status: "open" };
		expect(pinnedReceipt(swapOffer, null, MARKET_TUNING).line).toBe("Straight up, for 48 hours. Take it down any time.");
		const pig = toMarketTrade({ id: 1, kind: "pig", find_id: "pinecone", qty: 4, price: 13, from: 12, to: 12.5, tick: 1, at: "x" })!;
		expect(movedMoment(pig, small).line).toContain("A pig sale nudges it half of the way.");
		expect(movedMoment(pig).line).toContain("a third of the way");
	});

	it("puts the live step and set sizes in the sheets", () => {
		const s = toMarketState({ ...RAW, tuning: { ...RAW.tuning, set_size: { common: 3, uncommon: 2, rare: 1 }, price: { impact: 0.04 } } });
		const confirm = render(<ConfirmSheet open target={{ via: "counter", findId: "pinecone", side: "buy" }} state={s} {...confirmProps} />);
		expect(textOf(confirm)).toContain("pushes it up 4% of the usual price.");
		const post = render(<PostSheet open draft={newDraft(s, "sell", "pinecone")} setDraft={jest.fn()} state={s} busy={false} error={null} onClose={jest.fn()} onPost={jest.fn()} />);
		expect(textOf(post)).toContain("three of a common, two of an uncommon, or a rare on its own");
		expect(textOf(post)).not.toContain("four of a common");
	});
});

describe("ties, the bank cap, and what to do first", () => {
	it("says a tie as the same as Bullion pays, never '0 more'", () => {
		const tie = tradeReceipt(toMarketTrade({ id: 1, kind: "pig", how: "listing", find_id: "pinecone", qty: 4, price: 9, bid: 9, ask: 15, seller: { id: "me", you: true }, buyer: { id: "maya", name: "Maya", friend: true }, tick: 1, at: "x" })!);
		expect(tie.line).toBe("The same as Bullion pays.");
		expect(tie.ribbon).toBeUndefined();
		const tied = toMarketState({ ...RAW, board: [{ ...RAW.board[1], price: 9 }] });
		const draft = newDraft(tied, "sell", "pinecone");
		const r = render(<PostSheet open draft={{ ...draft, price: 9 }} setDraft={jest.fn()} state={tied} busy={false} error={null} onClose={jest.fn()} onPost={jest.fn()} />);
		expect(textOf(r)).toContain("it sells now, the same as Bullion pays.");
		expect(textOf(r)).not.toContain("0 more");
	});

	it("explains the cap where an ask is over it", () => {
		// Old keys: Bullion sells at 30, the bank holds 25, 20 are ready.
		expect(capLine(25)).toBe("You hold up to 25 ready; selling a set can bank more.");
		const confirm = render(<ConfirmSheet open target={{ via: "counter", findId: "old_key", side: "buy" }} state={STATE} {...confirmProps} />);
		expect(textOf(confirm)).toContain("You have 20 tickles ready. You hold up to 25 ready; selling a set can bank more.");
		const view = render(
			<FindView state={STATE} find={STATE.finds[1]} view={null} fancy={null} sheepEach={null} sheepHere={false} nowMs={NOW_MS} weekdayOf={() => "Thu"} isDayStart={() => false} ticksPerDay={48} onTake={jest.fn()} onOpen={jest.fn()} onCancel={jest.fn()} busyId={null} />,
		);
		expect(textOf(view)).toContain(capLine(25));
		// Pinecones (15) fit under the cap: no note.
		const cheap = render(<ConfirmSheet open target={{ via: "counter", findId: "pinecone", side: "buy" }} state={toMarketState({ ...RAW, me: { ...RAW.me, coin: 3 } })} {...confirmProps} />);
		expect(textOf(cheap)).not.toContain("You hold up to");
	});

	it("tells a pig with no full set what to do first", () => {
		const r = firstStepsCard(MARKET_TUNING, true);
		expect(r.title).toBe("First, a full set");
		expect(r.line).toBe("A set is three of a common, two of an uncommon, or a rare on its own. Keep digging, or buy one from me right here.");
		expect(firstStepsCard(MARKET_TUNING, false).line).toContain("Keep digging: when one fills");
	});

	it("branches a failed take-down on why", () => {
		expect(takeDownReceipt("not_found").title).toBe("That listing is already down");
		expect(takeDownReceipt("network").title).toBe("Couldn't hear back from Bullion");
		expect(takeDownReceipt("timeout").line).toContain("may still be up");
		expect(takeDownReceipt("not_authenticated").title).toBe("You're signed out");
		expect(takeDownReceipt("weird").title).toBe("That listing didn't come down");
	});
});

describe("the find, the board, the ledger and the cards", () => {
	it("shows an error with a retry when the find's read fails, instead of chalking forever", () => {
		const onRetry = jest.fn();
		const r = render(
			<FindView state={STATE} find={STATE.finds[0]} view={null} viewFailed onRetryView={onRetry} fancy={null} sheepEach={null} sheepHere={false} nowMs={NOW_MS} weekdayOf={() => "Thu"} isDayStart={() => false} ticksPerDay={48} onTake={jest.fn()} onOpen={jest.fn()} onCancel={jest.fn()} busyId={null} />,
		);
		const t = textOf(r);
		expect(t).toContain("The chart didn't load");
		expect(t).not.toContain("chalking the board");
		pressByText(r, "Try again");
		expect(onRetry).toHaveBeenCalled();
	});

	it("names the find and the set on every board button", () => {
		const r = render(<BoardView state={STATE} filter="all" onFilter={jest.fn()} shown={24} onMore={jest.fn()} nowMs={NOW_MS} onTake={jest.fn()} onCancel={jest.fn()} busyId={null} />);
		const labels = r.root.findAll((n) => typeof n.props.onPress === "function" && typeof n.props.accessibilityLabel === "string").map((n) => n.props.accessibilityLabel as string);
		expect(labels).toContain("Buy 4 pinecones for 13 from Maya");
		expect(labels).toContain("Sell 4 pinecones for 11 to a pig");
		expect(labels).toContain("Swap 2 pinecones for 3 glass marbles from Biscuit");
		expect(labels).toContain("Buy 3 old keys for 40 from a pig: you have 20 ready");
	});

	it("says which span the ledger covers (one running total)", () => {
		const r = render(<MarketHome state={STATE} sayTurn={0} nowMs={NOW_MS} onCounter={jest.fn()} onBoard={jest.fn()} onBag={jest.fn()} onCancel={jest.fn()} onReplayIntro={jest.fn()} busyId={null} />);
		expect(textOf(r)).toContain("since the market opened");
	});

	it("gives the price band a 44pt touch frame and draws the swap's way as an icon", () => {
		const draft = newDraft(STATE, "sell", "pinecone");
		const r = render(<PostSheet open draft={draft} setDraft={jest.fn()} state={STATE} busy={false} error={null} onClose={jest.fn()} onPost={jest.fn()} />);
		const band = r.root.find((n) => n.props.accessibilityRole === "adjustable" && n.props.accessibilityLabel === "Price per set");
		const { top, bottom } = band.props.hitSlop;
		expect(18 + top + bottom).toBeGreaterThanOrEqual(TAP_MIN);
		const swap = render(<PostSheet open draft={{ ...draft, side: "swap", wantFindId: "old_key" }} setDraft={jest.fn()} state={STATE} busy={false} error={null} onClose={jest.fn()} onPost={jest.fn()} />);
		expect(textOf(swap)).not.toContain("\u21c4");
		const take = render(<ConfirmSheet open target={{ via: "board", card: STATE.board[2] }} state={STATE} {...confirmProps} />);
		expect(textOf(take)).not.toMatch(/(^|\s)\u2192(\s|$)/);
	});

	it("ends a replay of the cards on Got it, without 'new here?'", () => {
		const walk = (replay: boolean) => {
			const r = render(<OnboardSheet open state={STATE} replay={replay} ticksPerDay={48} onClose={jest.fn()} onDone={jest.fn()} />);
			pressByText(r, "Next");
			pressByText(r, "Next");
			return textOf(r);
		};
		const replay = walk(true);
		expect(replay).toContain("Got it");
		expect(replay).not.toContain("Step up to the counter");
		expect(replay).not.toContain("new here?");
		const first = walk(false);
		expect(first).toContain("Step up to the counter");
		expect(first).toContain("new here?");
	});
});

describe("receipts kept until shown", () => {
	type Api = ReturnType<typeof useReceipts>;
	let api: Api | null = null;
	function Probe({ held }: { held: boolean }) {
		api = useReceipts(held);
		return null;
	}
	const flush = async () => {
		await act(async () => {
			await keptReceipts("");
		});
	};
	const card = (title: string) => ({ pose: "stand" as const, title, tone: "plain" as const });

	beforeEach(async () => {
		await AsyncStorage.clear();
		api = null;
	});

	it("keeps a notice's receipt on the device until it has been on screen", async () => {
		const r = render(<Probe held />);
		act(() => {
			api!.push(card("your pinecones sold"), { keep: "me:1" });
			api!.push(card("the same notice again"), { keep: "me:1" });
		});
		await flush();
		expect((await keptReceipts("me:")).map((k) => k.key)).toEqual(["me:1"]);
		// Leaving the market with it still held under a sheet: it comes back.
		act(() => r.unmount());
		const again = render(<Probe held={false} />);
		await act(async () => {
			await api!.restore("me:");
		});
		expect(api!.shown.map((x) => x.title)).toEqual(["your pinecones sold"]);
		await flush();
		expect(await keptReceipts("me:")).toEqual([]);
		// A restore after it has shown never brings it back twice.
		await act(async () => {
			await api!.restore("me:");
		});
		expect(api!.shown).toHaveLength(1);
		act(() => again.unmount());
	});

	it("only restores this pig's receipts", async () => {
		await keepReceipt("me:1", card("mine"));
		await keepReceipt("them:2", card("theirs"));
		render(<Probe held={false} />);
		await act(async () => {
			await api!.restore("me:");
		});
		expect(api!.shown.map((x) => x.title)).toEqual(["mine"]);
	});

	it("drops a broken or stale kept list", () => {
		expect(parseKept("not json")).toEqual([]);
		expect(parseKept(JSON.stringify([{ key: "a", at: 0, receipt: card("old") }]), 30 * 24 * 3_600_000)).toEqual([]);
		expect(parseKept(JSON.stringify([{ key: "a", at: 1, receipt: { title: 3 } }, { key: "b", at: 1, receipt: card("ok") }]), 2).map((k) => k.key)).toEqual(["b"]);
		expect(MARKET_KEPT_RECEIPTS_KEY).toBe("ttp.market.receipts");
	});

	it("runs onShow when a card is first on screen, not when it is queued, and withdraws only an unseen card", () => {
		const onShow = jest.fn();
		const r = render(<Probe held />);
		let id: number | null = null;
		act(() => {
			id = api!.push(card("moment"), { urgent: true, onShow });
		});
		expect(onShow).not.toHaveBeenCalled();
		act(() => r.update(<SafeAreaProvider initialMetrics={METRICS}><Probe held={false} /></SafeAreaProvider>));
		expect(onShow).toHaveBeenCalledTimes(1);
		expect(api!.withdraw(id!)).toBe(false);
		let other: number | null = null;
		act(() => r.update(<SafeAreaProvider initialMetrics={METRICS}><Probe held /></SafeAreaProvider>));
		act(() => {
			other = api!.push(card("quiet"), { urgent: true });
		});
		let withdrawn = false;
		act(() => {
			withdrawn = api!.withdraw(other!);
		});
		expect(withdrawn).toBe(true);
		act(() => r.update(<SafeAreaProvider initialMetrics={METRICS}><Probe held={false} /></SafeAreaProvider>));
		expect(api!.shown.map((x) => x.title)).toEqual(["moment"]);
	});
});

describe("launch fixes, server round (2026-11-02)", () => {
	const shelfCard = { id: -1, source: "bullion", find_id: "pinecone", side: "sell", price: 12, qty: 4, poster: { id: "bullion", kind: "bullion", name: "Bullion" }, expires_at: "2026-11-06T00:00:00Z" };
	const withShelf = (shelfToday: number) => toMarketState({ ...RAW, board: [shelfCard, ...RAW.board], me: { ...RAW.me, shelf_today: shelfToday } });
	const refusal = (reason: string, limit: number | null = null) => ({ ok: false as const, reason, now: null, ready: null, needed: null, held: null, setSize: null, limit });

	it("says the shelf limit in Bullion's voice", () => {
		expect(refusalReceipt(refusal("shelf_limit", 1), "pinecone", 4, 30)).toMatchObject({ title: "One from my shelf a day, friend", line: "Come back tomorrow." });
		expect(refusalReceipt(refusal("shelf_limit", 2), "pinecone", 4, 30).title).toBe("Two from my shelf a day, friend");
		expect(refusalReceipt(refusal("shelf_limit"), "pinecone", 4, 30).title).toBe("One from my shelf a day, friend");
	});

	it("puts the shelf to sleep once the pig has had its share today", () => {
		const fresh = render(<BoardView state={withShelf(0)} filter="all" onFilter={jest.fn()} shown={24} onMore={jest.fn()} nowMs={NOW_MS} onTake={jest.fn()} onCancel={jest.fn()} busyId={null} />);
		expect(textOf(fresh)).not.toContain("you had yours today");
		const onTake = jest.fn();
		const had = render(<BoardView state={withShelf(1)} filter="all" onFilter={jest.fn()} shown={24} onMore={jest.fn()} nowMs={NOW_MS} onTake={onTake} onCancel={jest.fn()} busyId={null} />);
		expect(textOf(had)).toContain("you had yours today");
		const btn = had.root.find((n) => n.props.accessibilityLabel === "Buy 4 pinecones for 12 from Bullion's daily shelf: you had yours today" && typeof n.props.onPress === "function");
		expect(btn.props.disabled).toBe(true);
		// Maya's listing still sells.
		expect(textOf(had)).toContain("Buy for 13");
	});

	it("blocks the shelf in its confirm sheet, and stops pointing at it from a find", () => {
		const had = withShelf(1);
		const confirm = render(<ConfirmSheet open target={{ via: "board", card: had.board[0] }} state={had} {...confirmProps} />);
		expect(textOf(confirm)).toContain("One from my shelf a day, friend. Come back tomorrow.");
		const view = (s: typeof STATE) =>
			textOf(render(<FindView state={s} find={s.finds[0]} view={null} fancy={null} sheepEach={null} sheepHere={false} nowMs={NOW_MS} weekdayOf={() => "Thu"} isDayStart={() => false} ticksPerDay={48} onTake={jest.fn()} onOpen={jest.fn()} onCancel={jest.fn()} busyId={null} />));
		// Fresh: the shelf's 12 is the cheapest; had yours: Maya's 13 is.
		expect(view(withShelf(0))).toContain("Bullion's 4 for 12");
		expect(view(had)).toContain("Maya's 4 for 13");
		expect(view(had)).not.toContain("Bullion's 4 for 12");
	});

	it("says listings run their 48 hours", () => {
		const r = noticeReceipt({ id: 1, kind: "expired", offer: { id: 9, findId: "pinecone", side: "sell", price: 14, qty: 4, targetId: null, wantFindId: null, wantQty: null, createdAt: "", expiresAt: "", status: "expired" }, trade: null });
		expect(r?.line).toBe("Nobody took them at 14 in 48 hours.");
		expect(r?.line).not.toContain("a day");
	});

	it("brings a private offer home when its friend leaves the game", () => {
		const offer = (side: "sell" | "buy", targetId: string | null) => ({
			id: 9, findId: "pinecone" as const, side, price: 13, qty: 4, targetId, wantFindId: null, wantQty: null, createdAt: "", expiresAt: "", status: "expired", ended: "target_left",
		});
		const friends = STATE.friends;
		const named = noticeReceipt({ id: 1, kind: "expired", offer: offer("sell", "maya"), trade: null }, MARKET_TUNING, friends)!;
		expect(named).toMatchObject({ title: "Your offer to Maya came home", line: "They've left the game, so your set is back in your bag." });
		const nameless = noticeReceipt({ id: 1, kind: "expired", offer: offer("sell", null), trade: null }, MARKET_TUNING, friends)!;
		expect(nameless.title).toBe("Your private offer came home");
		const wanted = noticeReceipt({ id: 1, kind: "expired", offer: offer("buy", null), trade: null })!;
		expect(wanted.line).toBe("They've left the game, so I took your wanted ad down.");
		for (const r of [named, nameless, wanted]) {
			noEmDash(r.title);
			noEmDash(r.line);
		}
	});
});

describe("sets of three, two and one (2026-11 balance pass)", () => {
	const SMALL_RAW = {
		...RAW,
		tuning: { ...RAW.tuning, set_size: { common: 3, uncommon: 2, rare: 1 } },
		finds: [
			{ id: "pinecone", rarity: "common", size: 3, usual: 9, price: 9, ask: 11, bid: 7, prev: 9, quiet_for: 0, spark: [[990000, 9]] },
			{ id: "old_key", rarity: "uncommon", size: 2, usual: 16, price: 16, ask: 20, bid: 12, prev: 16, quiet_for: 0, spark: [[990000, 16]] },
			{ id: "tin_whistle", rarity: "rare", size: 1, usual: 20, price: 20, ask: 24, bid: 16, prev: 20, quiet_for: 0, spark: [[990000, 20]] },
		],
		me: { ...RAW.me, holdings: { old_key: { held: 1, paid: 0, paid_units: 0, on_offer: 0 } }, offers: [] },
		board: [],
	};
	const s = toMarketState(SMALL_RAW);
	const whistle = s.finds[2];
	const findProps = { view: null, fancy: null, sheepEach: null, sheepHere: false, nowMs: NOW_MS, weekdayOf: () => "Thu", isDayStart: () => false, ticksPerDay: 48, onTake: jest.fn(), onOpen: jest.fn(), onCancel: jest.fn(), busyId: null };
	const trade = (raw: Record<string, unknown>) => toMarketTrade({ id: 1, tick: 1, at: "x", ...raw }) as MarketTrade;

	it("names a set in the singular when it is one, as the server's pushes do", () => {
		expect(setOf("tin_whistle", 1)).toBe("a tin whistle");
		expect(setOf("old_key", 1)).toBe("an old key");
		expect(setOf("old_key", 2)).toBe("2 old keys");
		expect(setOf("pinecone", 3)).toBe("3 pinecones");
		expect(ownSetOf("tin_whistle", 1)).toBe("tin whistle");
		expect(ownSetOf("old_key", 2)).toBe("2 old keys");
		expect(setSizeLabel(1)).toBe("one at a time");
		expect(setSizeLabel(2)).toBe("a set of 2");
		expect(shortOfSet("tin_whistle", 0, 1)).toBe("You have no tin whistles.");
		expect(shortOfSet("old_key", 1, 2)).toBe("You have 1 of 2.");
	});

	it("says any mix of set sizes", () => {
		const t = (common: number, uncommon: number, rare: number) => ({ ...MARKET_TUNING, setSize: { common, uncommon, rare } });
		expect(setSizeWords(t(2, 2, 2))).toBe("two of any find");
		expect(setSizeWords(t(1, 1, 1))).toBe("any find on its own");
		expect(setSizeWords(t(3, 1, 1))).toBe("three of a common, the rest on their own");
		expect(firstStepsCard(t(3, 2, 1), false).line).toBe(
			"A set is three of a common, two of an uncommon, or a rare on its own. Keep digging: when one fills, bring it to me or pin it on the noticeboard.",
		);
	});

	it("tells a trade, a listing and a refusal of one find in the singular", () => {
		const sold = tradeReceipt(trade({ kind: "counter", side: "sell", find_id: "tin_whistle", qty: 1, price: 16, from: 20, to: 19, seller: { id: "me", you: true } }));
		expect(sold.title).toBe("Bullion bought your tin whistle for 16");
		const bought = tradeReceipt(trade({ kind: "counter", side: "buy", find_id: "tin_whistle", qty: 1, price: 24, from: 20, to: 21, buyer: { id: "me", you: true } }));
		expect(bought.title).toBe("You bought a tin whistle from Bullion for 24");
		const taken = tradeReceipt(trade({ kind: "pig", how: "listing", find_id: "tin_whistle", qty: 1, price: 22, bid: 16, ask: 24, seller: { id: "me", you: true }, buyer: { id: "maya", name: "Maya", friend: true } }));
		expect(taken.title).toBe("Maya bought your tin whistle for 22");
		expect(sold.line).toBe("you dug it up · +16 · the price went 20 → 19");
		const offer = { id: 9, findId: "tin_whistle" as const, price: 24, qty: 1, targetId: null, wantFindId: null, wantQty: null, createdAt: "", expiresAt: "", status: "expired" };
		expect(noticeReceipt({ id: 1, kind: "expired", offer: { ...offer, side: "sell" }, trade: null })).toMatchObject({
			title: "Your tin whistle came home",
			line: "Nobody took it at 24 in 48 hours.",
		});
		expect(noticeReceipt({ id: 1, kind: "expired", offer: { ...offer, side: "swap", price: null, wantFindId: "old_key", wantQty: 1 }, trade: null })?.line).toBe(
			"Your tin whistle is back in your bag.",
		);
		expect(noticeReceipt({ id: 1, kind: "for_you", offer: { ...offer, side: "sell", status: "open" }, trade: null })?.line).toBe(
			"A tin whistle for 24 · on the noticeboard, For you",
		);
		const notASet = (held: number, setSize: number) => ({ ok: false as const, reason: "not_a_set", now: null, ready: null, needed: null, held, setSize });
		expect(refusalReceipt(notASet(0, 1), "tin_whistle", 4, 30)).toMatchObject({ title: "A set is just one", line: "You have 0 tin whistles." });
		expect(refusalReceipt(notASet(1, 2), "old_key", 4, 30)).toMatchObject({ title: "A set is 2", line: "You have 1 old key." });
		const swap = trade({ kind: "swap", find_id: "tin_whistle", qty: 1, want_find_id: "old_key", want_qty: 2, buyer: { id: "maya", name: "Maya", friend: true } });
		expect(tradeLine(swap, "tin_whistle", 1).text).toBe("Maya swapped 2 old keys for a tin whistle");
		const gave = trade({ kind: "swap", find_id: "pinecone", qty: 3, want_find_id: "tin_whistle", want_qty: 1, buyer: { id: "maya", name: "Maya", friend: true } });
		expect(tradeLine(gave, "tin_whistle", 3).text).toBe("Maya swapped a tin whistle for 3 pinecones");
	});

	it("draws a one-find set without 'a set of 1'", () => {
		const counter = textOf(render(<CounterView state={s} fancy={null} onOpen={jest.fn()} />));
		expect(counter).toContain("Tin whistles");
		const row = render(<CounterView state={s} fancy={null} onOpen={jest.fn()} />).root.findAll((n) => String(n.props.accessibilityLabel ?? "").startsWith("Tin whistles"))[0];
		expect(row.props.accessibilityLabel).toContain("Tin whistles, one at a time.");
		const view = textOf(render(<FindView state={s} find={whistle} {...findProps} />));
		expect(view).toContain("One at a time");
		expect(view).not.toContain("set of 1");
		expect(view).not.toContain("sets of 1");
		const sell = render(<ConfirmSheet open target={{ via: "counter", findId: "tin_whistle", side: "sell" }} state={s} {...confirmProps} />);
		expect(textOf(sell)).toContain("Sell a tin whistle");
		expect(textOf(sell)).toContain("You have no tin whistles.");
		const keys = render(<ConfirmSheet open target={{ via: "counter", findId: "old_key", side: "sell" }} state={s} {...confirmProps} />);
		expect(textOf(keys)).toContain("Sell 2 old keys");
		expect(textOf(keys)).toContain("You have 1 of 2.");
		const wanted = render(<PostSheet open draft={{ ...newDraft(s, "buy", "tin_whistle"), side: "buy" }} setDraft={jest.fn()} state={s} busy={false} error={null} onClose={jest.fn()} onPost={jest.fn()} />);
		expect(textOf(wanted)).toContain("one at a time");
		expect(textOf(wanted)).not.toContain("a set of 1");
		expect(textOf(wanted)).toContain("wanted, a tin whistle for");
	});

	it("asks for one other find in a swap when it trades one at a time", () => {
		const held = toMarketState({ ...SMALL_RAW, me: { ...SMALL_RAW.me, holdings: { pinecone: { held: 3, paid: 0, paid_units: 0, on_offer: 0 } } } });
		const draft = { ...newDraft(held, "swap", "pinecone"), wantFindId: "tin_whistle" as const };
		const t = textOf(render(<PostSheet open draft={draft} setDraft={jest.fn()} state={held} busy={false} error={null} onClose={jest.fn()} onPost={jest.fn()} />));
		expect(t).toContain("one other find");
		expect(t).not.toContain("1 to 1");
		expect(t).toContain("3 pinecones for 1 tin whistle");
	});
});

describe("the Ghost Sheep on a buy (2026-11 balance pass)", () => {
	const trade = (raw: Record<string, unknown>) => toMarketTrade({ id: 1, find_id: "pinecone", qty: 3, tick: 1, at: "x", ...raw }) as MarketTrade;

	it("a buy receipt never quotes his double", () => {
		const me = { id: "me", you: true };
		const buys = [
			tradeReceipt(trade({ kind: "counter", side: "buy", price: 11, from: 9, to: 9.45, buyer: me })),
			tradeReceipt(trade({ kind: "counter", side: "buy", how: "board", price: 10, from: 9, to: 9.45, buyer: me })),
			tradeReceipt(trade({ kind: "pig", how: "listing", price: 10, ask: 11, buyer: me, seller: { id: "maya", name: "Maya", friend: true } })),
		];
		expect(buys[0]).toMatchObject({ title: "You bought 3 pinecones from Bullion for 11", line: "the price went 9 → 9.5" });
		for (const r of buys) {
			expect(`${r.title} ${r.line}`).not.toMatch(/Sheep|double/);
		}
	});

	it("says his double is for ones you found, and quotes the plain price for the rest", () => {
		const props = { view: null, sheepHere: true, nowMs: NOW_MS, weekdayOf: () => "Thu", isDayStart: () => false, ticksPerDay: 48, onTake: jest.fn(), onOpen: jest.fn(), onCancel: jest.fn(), busyId: null };
		const fancied = textOf(render(<FindView state={STATE} find={STATE.finds[0]} fancy="pinecone" sheepEach={3} sheepFoundEach={6} {...props} />));
		expect(fancied).toContain("He fancies pinecones today: 6 each for ones you found, 3 for ones you bought.");
		const other = textOf(render(<FindView state={STATE} find={STATE.finds[1]} fancy="pinecone" sheepEach={8} sheepFoundEach={null} {...props} />));
		expect(other).toContain("He pays 8 each for old keys (24 a set). Today he fancies pinecones.");
		const counter = render(<CounterView state={STATE} fancy="pinecone" onOpen={jest.fn()} />);
		const row = counter.root.findAll((n) => String(n.props.accessibilityLabel ?? "").startsWith("Pinecones"))[0];
		expect(row.props.accessibilityLabel).toContain("Your Ghost Sheep fancies these today, but only ones you found pay double.");
	});
});
