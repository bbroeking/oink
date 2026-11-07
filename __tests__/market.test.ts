// Bullion's Market — the pure rules (constants/market) and the payload
// narrowing (utils/market). The numbers are the round-4 prototype's engine,
// which the server (20261031100000_bullions_market.sql) implements too.
import {
	MARKET_TUNING,
	askAt,
	bidAt,
	changeWords,
	clampPrice,
	counterMove,
	eachWord,
	fmtPrice,
	gainWord,
	haveWords,
	listBand,
	middle,
	pigMove,
	postRange,
	previewList,
	swapVerdict,
	usualFor,
	vsPrice,
	type PreviewOffer,
} from "@/constants/market";
import {
	MARKET_TIMED_OUT,
	boardBest,
	createNonceBook,
	isIndefinite,
	marketWriteKey,
	pigName,
	previewBoard,
	shelfDone,
	takeableBoard,
	toMarketClosed,
	toMarketOutcome,
	toMarketState,
	withTimeout,
	type BoardCard,
} from "@/utils/market";

describe("market rules", () => {
	it("falls back to the balance pass's tuning (the server sets the same)", () => {
		expect(MARKET_TUNING.price.impact).toBe(0.05);
		expect(MARKET_TUNING.price.wiggle).toBe(0.02);
		expect(MARKET_TUNING.offerHours).toBe(48);
		// Three of a common, two of an uncommon, the whistle on its own.
		expect(MARKET_TUNING.setSize).toEqual({ common: 3, uncommon: 2, rare: 1 });
	});

	it("prices a set off the Ghost Sheep's price for one find", () => {
		expect(usualFor("common")).toBe(9);
		expect(usualFor("uncommon")).toBe(16);
		expect(usualFor("rare")).toBe(20);
		expect(usualFor("common", { ...MARKET_TUNING, setSize: { common: 4, uncommon: 3, rare: 3 } })).toBe(12);
	});

	it("puts Bullion's cut around the price", () => {
		// Pinecones at their usual price: he sells at 15, buys at 9.
		expect(askAt(12, 12)).toBe(15);
		expect(bidAt(12, 12)).toBe(9);
		// He never sells under U + 1 nor buys over U.
		expect(askAt(12, 10.2)).toBe(13);
		expect(bidAt(12, 13.8)).toBe(11);
		expect(bidAt(60, 69)).toBe(55);
		// Exact products don't round the wrong way (1.2 x 12.5 = 15).
		expect(askAt(12, 12.5)).toBe(15);
	});

	it("keeps the price in its band and moves it the prototype's way", () => {
		expect(clampPrice(12, 20)).toBeCloseTo(13.8);
		expect(clampPrice(12, 1)).toBeCloseTo(10.2);
		// The 2026-11-02 balance pass: a set at the counter moves P 5% of U.
		expect(counterMove(12, 12, "buy")).toBeCloseTo(12.6);
		expect(counterMove(12, 12, "sell")).toBeCloseTo(11.4);
		expect(counterMove(12, 13.7, "buy")).toBeCloseTo(13.8);
		// The server's tuning, whatever it is, is the rule (the prototype's 3%).
		const proto = { ...MARKET_TUNING, price: { ...MARKET_TUNING.price, impact: 0.03 } };
		expect(counterMove(12, 12, "buy", proto)).toBeCloseTo(12.36);
		expect(pigMove(12, 12, 15)).toBeCloseTo(13);
		expect(listBand(12)).toEqual({ min: 1, max: 36 });
		expect(postRange(12, 9, 15)).toEqual({ min: 6, max: 18 });
		expect(middle(9, 15)).toBe(12);
	});

	it("speaks the numbers", () => {
		expect(fmtPrice(12)).toBe("12");
		expect(fmtPrice(12.44)).toBe("12.4");
		expect(vsPrice(14, 12.2).word).toBe("2 over the price");
		expect(vsPrice(10, 12.2).short).toBe("2 under");
		expect(vsPrice(12, 12.2).word).toBe("at the price");
		expect(gainWord(3)).toBe("up 3");
		expect(gainWord(-2)).toBe("down 2");
		expect(gainWord(0)).toBe("even");
		expect(eachWord(12, 4)).toBe("3 each");
		expect(eachWord(13, 4)).toBe("about 3 each");
		expect(changeWords(0.02)).toEqual({ trend: "flat", word: "steady" });
		expect(changeWords(-0.44)).toEqual({ trend: "down", word: "down 0.4" });
		expect(haveWords({ held: 0, size: 4 })).toBe("none in your bag");
		expect(haveWords({ held: 3, size: 4 })).toBe("you have 3 of 4");
		expect(haveWords({ held: 6, size: 4 })).toBe("you have 1 set + 2");
		expect(swapVerdict(12, 14)).toBe("asking_more");
		expect(swapVerdict(12, 8)).toBe("giving_more");
		expect(swapVerdict(12, 12)).toBe("fair");
	});
});

describe("previewList", () => {
	const board: PreviewOffer[] = [
		{ id: 1, side: "buy", findId: "pinecone", price: 11, posterId: "maya", payable: true },
		{ id: 2, side: "buy", findId: "pinecone", price: 13, posterId: "s1", payable: false },
		{ id: 3, side: "sell", findId: "pinecone", price: 13, posterId: "s2", payable: true },
		{ id: 4, side: "sell", findId: "pinecone", price: 12, posterId: "maya", payable: true },
	];

	it("sells to the best payable wanted ad when it beats the counter", () => {
		const p = previewList("sell", "pinecone", 10, 9, 15, board);
		expect(p).toMatchObject({ fills: "pig", at: 11 });
	});

	it("crosses with the counter at HIS price when nothing better waits", () => {
		expect(previewList("sell", "pinecone", 8, 9, 15, [])).toEqual({ fills: "counter", at: 9 });
		expect(previewList("buy", "pinecone", 16, 9, 15, [])).toEqual({ fills: "counter", at: 15 });
	});

	it("rests between his prices, and says when it would just sit", () => {
		expect(previewList("sell", "pinecone", 12, 9, 15, [])).toEqual({ fills: null, sits: false });
		expect(previewList("sell", "pinecone", 15, 9, 15, [])).toEqual({ fills: null, sits: true });
		expect(previewList("buy", "pinecone", 9, 9, 15, [])).toEqual({ fills: null, sits: true });
	});

	it("buys the cheapest listing, limited to one friend when sent to one", () => {
		expect(previewList("buy", "pinecone", 13, 9, 15, board)).toMatchObject({ fills: "pig", at: 12 });
		expect(previewList("buy", "pinecone", 13, 9, 15, board, "s2")).toMatchObject({ fills: "pig", at: 13 });
	});
});

describe("market narrowing", () => {
	const raw = {
		ok: true,
		now: "2026-11-05T14:10:00Z",
		tick: 990000,
		tuning: { set_size: { common: 4, uncommon: 3, rare: 3 }, base: { common: 3, uncommon: 8, rare: 20 }, price: { lo: 0.85 }, open_offers: 4 },
		finds: [
			{ id: "pinecone", rarity: "common", size: 4, usual: 12, price: 12.2, ask: 15, bid: 9, prev: 12, quiet_for: 3, spark: [[1, 12], [2, 12.2]] },
			{ id: "not_a_find", rarity: "common" },
		],
		me: {
			id: "u1",
			coin: 31,
			cap: 25,
			spent: 13,
			took_in: 9,
			posts_today: 1,
			holdings: { pinecone: { held: 5, paid: 13, paid_units: 4, on_offer: 0 }, bogus: { held: 1 } },
			offers: [{ id: 7, find_id: "pinecone", side: "sell", price: 12, qty: 4, created_at: "x", expires_at: "y", status: "open" }],
		},
		board: [
			{ id: 8, find_id: "pinecone", side: "buy", price: 11, qty: 4, poster: { id: "m", name: "Maya", friend: true }, for_you: false, poster_coin_ok: true },
			{ id: 9, find_id: "pinecone", side: "buy", price: 13, qty: 4, poster: { id: "s", friend: false }, poster_coin_ok: false },
			{ id: 10, find_id: "pinecone", side: "sell", price: 13, qty: 4, poster: { id: "s", friend: false } },
			{ id: 11, find_id: "old_key", side: "swap", price: null, qty: 3, want_find_id: "marble", want_qty: 1, poster: { id: "m", name: "Maya", friend: true }, for_you: true },
		],
		tape: [{ id: 3, kind: "print", find_id: "pinecone", qty: 4, price: 12, who: "the Miller", dir: "up", tick: 1, at: "z" }],
		notices: [{ id: 1, kind: "filled", offer: null, trade: null }, { id: 2, kind: "nope" }],
		friends: [{ id: "m", name: "Maya", pig_id: "maya" }],
		yesterday: { find_id: "pinecone", sets: 4, lo: 11.5, hi: 12.6 },
	};

	it("keeps what it understands and drops the rest", () => {
		const s = toMarketState(raw);
		expect(s.finds).toHaveLength(1);
		expect(s.finds[0]).toMatchObject({ id: "pinecone", ask: 15, bid: 9, spark: [{ t: 1, p: 12 }, { t: 2, p: 12.2 }] });
		expect(s.me.coin).toBe(31);
		expect(s.me.holdings.pinecone).toEqual({ held: 5, paid: 13, paidUnits: 4, onOffer: 0 });
		expect(Object.keys(s.me.holdings)).toEqual(["pinecone"]);
		expect(s.me.offers[0].id).toBe(7);
		expect(s.board).toHaveLength(4);
		expect(s.board[3]).toMatchObject({ side: "swap", wantFindId: "marble", wantQty: 1, forYou: true });
		expect(s.tape[0]).toMatchObject({ kind: "print", who: "the Miller", dir: "up" });
		expect(s.notices).toHaveLength(1);
		expect(s.yesterday).toEqual({ findId: "pinecone", sets: 4, lo: 11.5, hi: 12.6 });
		expect(s.tuning.price.lo).toBe(0.85);
		expect(s.tuning.price.sellFactor).toBe(MARKET_TUNING.price.sellFactor);
	});

	it("finds the board's best on each side, skipping an ad its pig can't pay", () => {
		const s = toMarketState(raw);
		const best = boardBest(s.board as BoardCard[], "pinecone");
		expect(best.sale?.id).toBe(10);
		expect(best.wanted?.id).toBe(8);
		const pb = previewBoard(s.board);
		expect(pb.find((o) => o.id === 9)?.payable).toBe(false);
		expect(pigName(s.board[0].poster)).toBe("Maya");
		expect(pigName(s.board[1].poster)).toBe("a pig");
	});

	it("reads a write's receipt and its refusal", () => {
		const ok = toMarketOutcome({
			ok: true,
			replay: false,
			via: "counter",
			coin: 40,
			trade: { id: 5, kind: "counter", side: "sell", find_id: "pinecone", qty: 4, price: 9, from: 12, to: 11.64, tick: 1, at: "x" },
		} as never);
		expect(ok).toMatchObject({ ok: true, filled: true, via: "counter", coin: 40 });
		const no = toMarketOutcome({ ok: false, reason: "price_moved", now: 8 } as never);
		expect(no).toMatchObject({ ok: false, reason: "price_moved", now: 8 });
	});
});

describe("Bullion daily shelf payload", () => {
	it("keeps the canonical NPC identity and routes its sale only through take", () => {
		const state = toMarketState({ board: [{ id: -1, source: "bullion", find_id: "pinecone", side: "sell", price: 12, qty: 4, poster: { id: "bullion", kind: "bullion", name: "Bullion" }, for_you: false, expires_at: "2026-11-06T00:00:00Z" }] });
		expect(state.board[0]).toMatchObject({ id: -1, source: "bullion", poster: { kind: "bullion" }, forYou: false });
		expect(pigName({ ...state.board[0].poster, name: null })).toBe("Bullion");
		expect(previewBoard(state.board)).toEqual([]);
		expect(boardBest(state.board, "pinecone").sale?.id).toBe(-1);
	});
});

describe("the season reset notice and why a listing ended", () => {
	it("keeps a reset notice with its listing", () => {
		const s = toMarketState({
			notices: [
				{ id: 4, kind: "reset", offer: { id: 9, find_id: "pinecone", side: "sell", price: 12, qty: 4, status: "reset" }, trade: null },
				{ id: 5, kind: "mystery" },
			],
		});
		expect(s.notices).toHaveLength(1);
		expect(s.notices[0]).toMatchObject({ id: 4, kind: "reset", offer: { id: 9, side: "sell", qty: 4 } });
	});

	it("reads why a listing ended (the friend it was offered to left)", () => {
		const s = toMarketState({
			notices: [{ id: 6, kind: "expired", offer: { id: 9, find_id: "pinecone", side: "sell", price: 12, qty: 4, target_id: null, status: "expired", ended: "target_left" } }],
		});
		expect(s.notices[0].offer).toMatchObject({ ended: "target_left", targetId: null });
		expect(toMarketState({ me: { offers: [{ id: 1, find_id: "pinecone", side: "sell", price: 12, qty: 4 }] } }).me.offers[0].ended).toBeNull();
	});
});

describe("the closed market", () => {
	it("keeps your own open listings and your bag, and nothing else", () => {
		const c = toMarketClosed({
			ok: false,
			reason: "closed",
			now: "2026-11-05T14:10:00Z",
			tick: 990000,
			me: {
				id: "me",
				offers: [
					{ id: 7, find_id: "pinecone", side: "sell", price: 13, qty: 4, status: "open", expires_at: "2026-11-06T10:00:00Z" },
					{ id: 8, find_id: "bogus", side: "sell", price: 13, qty: 4, status: "open" },
					{ id: 9, find_id: "old_key", side: "buy", price: 30, qty: 3, status: "filled" },
				],
				holdings: { pinecone: { held: 4, on_offer: 4 }, nope: { held: 1 } },
			},
		});
		expect(c.me.offers.map((o) => o.id)).toEqual([7]);
		expect(c.me.holdings).toEqual({ pinecone: { held: 4, paid: 0, paidUnits: 0, onOffer: 4 } });
		expect(c.tick).toBe(990000);
	});

	it("reads an older server's bare closed answer as no listings", () => {
		expect(toMarketClosed({ ok: false, reason: "closed" })).toEqual({ now: "", tick: 0, me: { id: "", offers: [], holdings: {} } });
	});
});

describe("Bullion's shelf, one pig's share a day", () => {
	const shelf = { id: -1, source: "bullion", find_id: "pinecone", side: "sell", price: 12, qty: 4, poster: { id: "bullion", kind: "bullion" } };
	const pig = { id: 3, find_id: "pinecone", side: "sell", price: 13, qty: 4, poster: { id: "s" } };

	it("reads the share and today's buys, an explicit null as no limit", () => {
		expect(toMarketState({}).tuning.bullionBoard).toEqual({ dailyListings: 3, perPig: 1 });
		expect(toMarketState({ tuning: { bullion_board: { daily_listings: 2, per_pig: 2 } } }).tuning.bullionBoard).toEqual({ dailyListings: 2, perPig: 2 });
		expect(toMarketState({ tuning: { bullion_board: { per_pig: null } } }).tuning.bullionBoard.perPig).toBeNull();
		expect(toMarketState({ me: { shelf_today: 1 } }).me.shelfToday).toBe(1);
		expect(toMarketOutcome({ ok: false, reason: "shelf_limit", limit: 1 } as never)).toMatchObject({ ok: false, reason: "shelf_limit", limit: 1 });
	});

	it("drops the shelf from what the pig can take once it has had its share", () => {
		const fresh = toMarketState({ board: [shelf, pig], me: { shelf_today: 0 } });
		expect(shelfDone(fresh)).toBe(false);
		expect(takeableBoard(fresh).map((c) => c.id)).toEqual([-1, 3]);
		const had = toMarketState({ board: [shelf, pig], me: { shelf_today: 1 } });
		expect(shelfDone(had)).toBe(true);
		expect(takeableBoard(had).map((c) => c.id)).toEqual([3]);
		expect(boardBest(takeableBoard(had), "pinecone").sale?.id).toBe(3);
		const unlimited = toMarketState({ board: [shelf], me: { shelf_today: 5 }, tuning: { bullion_board: { per_pig: null } } });
		expect(shelfDone(unlimited)).toBe(false);
	});
});

describe("a lost answer keeps its nonce", () => {
	const res = (reason: string | null) => (reason ? { ok: false, reason } : { ok: true });

	it("tells a lost answer from a definite one", () => {
		expect(isIndefinite(res("network"))).toBe(true);
		expect(isIndefinite(res("no_data"))).toBe(true);
		expect(isIndefinite(res("timeout"))).toBe(true);
		expect(isIndefinite(MARKET_TIMED_OUT)).toBe(true);
		expect(isIndefinite(res("price_moved"))).toBe(false);
		expect(isIndefinite(res("lapsed"))).toBe(false);
		expect(isIndefinite(res(null))).toBe(false);
	});

	it("keys one exact trade: find, side and price (or listing and limit)", () => {
		const a = marketWriteKey({ via: "counter", findId: "pinecone", side: "buy", limit: 15 });
		expect(marketWriteKey({ via: "counter", findId: "pinecone", side: "buy", limit: 15 })).toBe(a);
		expect(marketWriteKey({ via: "counter", findId: "pinecone", side: "buy", limit: 16 })).not.toBe(a);
		expect(marketWriteKey({ via: "counter", findId: "pinecone", side: "sell", limit: 15 })).not.toBe(a);
		expect(marketWriteKey({ via: "counter", findId: "old_key", side: "buy", limit: 15 })).not.toBe(a);
		expect(marketWriteKey({ via: "take", offerId: 7, limit: 13 })).not.toBe(marketWriteKey({ via: "take", offerId: 8, limit: 13 }));
		const post = { side: "sell" as const, findId: "pinecone" as const, price: 12, targetId: null };
		expect(marketWriteKey({ via: "post", spec: post })).toBe(marketWriteKey({ via: "post", spec: { ...post } }));
		expect(marketWriteKey({ via: "post", spec: { ...post, price: 13 } })).not.toBe(marketWriteKey({ via: "post", spec: post }));
		expect(marketWriteKey({ via: "post", spec: { ...post, targetId: "maya" } })).not.toBe(marketWriteKey({ via: "post", spec: post }));
		const swap = { side: "swap" as const, findId: "marble" as const, wantFindId: "pinecone" as const, wantQty: 2, targetId: null };
		expect(marketWriteKey({ via: "post", spec: swap })).not.toBe(marketWriteKey({ via: "post", spec: { ...swap, wantQty: 3 } }));
	});

	it("reuses the nonce for the same target until a definite answer, and never across targets", () => {
		let n = 0;
		const book = createNonceBook(() => `n${++n}`);
		const buy15 = "counter:pinecone:buy:15";
		// A double tap before the first answer: the same trade.
		expect(book.nonceFor(buy15)).toBe("n1");
		expect(book.nonceFor(buy15)).toBe("n1");
		// The answer is lost: the sheet closes and reopens on the same find,
		// side and price, and the retry replays n1.
		book.settle(buy15, res("network"));
		expect(book.isLost(buy15)).toBe(true);
		expect(book.nonceFor(buy15)).toBe("n1");
		// A different target meanwhile is its own trade.
		expect(book.nonceFor("counter:pinecone:buy:16")).toBe("n2");
		expect(book.nonceFor("counter:pinecone:sell:9")).toBe("n3");
		// The retry is lost again (a timeout): still n1.
		book.settle(buy15, res("timeout"));
		expect(book.nonceFor(buy15)).toBe("n1");
		// A definite answer (the replayed trade, or a refusal) frees it.
		book.settle(buy15, res(null));
		expect(book.isLost(buy15)).toBe(false);
		expect(book.nonceFor(buy15)).toBe("n4");
		book.settle(buy15, res("price_moved"));
		expect(book.nonceFor(buy15)).toBe("n5");
	});
});

describe("withTimeout", () => {
	afterEach(() => jest.useRealTimers());

	it("answers the promise when it lands in time", async () => {
		await expect(withTimeout(Promise.resolve(3), 1000, 0)).resolves.toBe(3);
	});

	it("lets go after the timeout, and on a rejection", async () => {
		jest.useFakeTimers();
		const hung = new Promise<number>(() => {});
		const out = withTimeout(hung, 12_000, -1);
		jest.advanceTimersByTime(12_000);
		await expect(out).resolves.toBe(-1);
		jest.useRealTimers();
		await expect(withTimeout(Promise.reject(new Error("x")), 1000, -2)).resolves.toBe(-2);
	});
});
