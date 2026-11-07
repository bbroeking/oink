#!/usr/bin/env node
/*
 * Headless check of Bullion's Market, round 4 (one price, two ways to trade): `node engine.test.js`.
 *
 *   1. Fairness by construction: over the whole band (0.85 U .. 1.15 U) the counter's best possible
 *      buying price is below its worst possible selling price, for every find.
 *   2. The spec's worked numbers (pinecones: sell 15, buy 9, "12 -> 12.4").
 *   3. No strategy of buying at the counter and selling back to it ever profits: push the price up
 *      and sell back; buy at the bottom of a crash and sell after it drifts home; and a random
 *      search of thousands of loops by a coalition of friends, wash trades included. All lose.
 *   4. The rules: crossing (a listing at or under Bullion's buying price sells to him at once, a
 *      wanted ad at or over his selling price buys from him), impact (3% of U a set), a pig sale
 *      moves the price a third of the way, swaps move nothing, the caps valve works when turned on.
 *   5. A long simulation (default 3000 ticks, 62 days) with a scripted "you" pressing every button,
 *      checking after every step: prices in band, quotes sane, no negative coin/bag/lot, every pig's
 *      coin reconciles from its trades (pig to pig conserved; counter flows accounted), every find
 *      reconciles, listings are sets, at most 4 up, 24 hours, offers to friends only.
 * Then prints a summary.
 */
"use strict";
const assert = require("assert");
const E = require("./engine.js");

const TICKS = Number(process.argv[2]) || 3000;
const SEED = Number(process.argv[3]) || 20261030;
const FINDS = E.FINDS;
const size = (f) => E.setSize(f);
const U = (f) => E.usual(f);
const fmt = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n);
const out = [];
const say = (s = "") => out.push(s);

// ── 1. fairness by construction ─────────────────────────────────────────────
const fair = {};
for (const f of FINDS) {
	const u = U(f.id);
	const lo = E.priceLo(f.id);
	const hi = E.priceHi(f.id);
	const Ps = [lo, hi];
	for (let k = 0; k <= 20000; k++) Ps.push(lo + ((hi - lo) * k) / 20000);
	// every rounding edge inside the band, and a hair either side of it
	for (let n = 1; n <= 3 * u; n++)
		for (const edge of [n / 0.8, n / 1.2])
			for (const d of [-1e-7, 0, 1e-7]) if (edge + d >= lo && edge + d <= hi) Ps.push(edge + d);
	let maxBid = -Infinity;
	let minAsk = Infinity;
	for (const P of Ps) {
		const bid = E.bidAt(f.id, P);
		const ask = E.askAt(f.id, P);
		assert.ok(bid <= u, `${f.id}: Bullion pays ${bid} > the usual price ${u} at P=${P}`);
		assert.ok(ask >= u + 1, `${f.id}: Bullion charges ${ask} < the usual price + 1 at P=${P}`);
		assert.ok(bid >= 1, `${f.id}: Bullion pays nothing at P=${P}`);
		maxBid = Math.max(maxBid, bid);
		minAsk = Math.min(minAsk, ask);
	}
	assert.ok(maxBid < minAsk, `${f.id}: best buy ${maxBid} reaches worst sell ${minAsk}`);
	fair[f.id] = { maxBid, minAsk, u };
}

// ── 2. the spec's numbers ─────────────────────────────────────────────────
{
	assert.strictEqual(U("pinecone"), 12);
	assert.strictEqual(U("old_key"), 24);
	assert.strictEqual(U("tin_whistle"), 60);
	assert.strictEqual(E.askAt("pinecone", 12), 15, "I'll sell for 15");
	assert.strictEqual(E.bidAt("pinecone", 12), 9, "I'll buy for 9");
	const m = E.create({ sim: false, strangers: 0 });
	m.state.P[E.BY_ID.pinecone.idx] = 12;
	const pv = m.previewCounter("pinecone", "buy");
	assert.strictEqual(pv.price, 15);
	assert.strictEqual(E.fmtPrice(pv.from) + " -> " + E.fmtPrice(pv.to), "12 -> 12.4", "Buy for 15. The price goes 12 -> 12.4");
	assert.strictEqual(E.vsPrice(9, 12).word, "3 under the price");
	assert.strictEqual(E.vsPrice(14, 12).word, "2 over the price");
}

// ── 3. no counter loop ever profits ─────────────────────────────────────────
// A clean market (no simulated pigs) where you, Maya and Biscuit start with no finds of the one
// being tested, so every set they ever hold of it came from the counter.
function clean(seed, fid) {
	const m = E.create({ sim: false, strangers: 0, seed });
	for (const p of ["you", "maya", "biscuit"]) {
		m.state.coin[p] = 1e6;
		m.state.bags[p][fid] = [];
		m.state.offers.filter((o) => o.pig === p).forEach((o) => m.cancel(p, o.id, true));
	}
	return m;
}
const coalitionCoin = (m, pigs) => pigs.reduce((t, p) => t + m.state.coin[p], 0);
function sellAllBack(m, pig, fid) {
	while (m.count(pig, fid) >= size(fid)) assert.ok(m.counter(pig, fid, "sell").ok);
}
const loops = { pushTried: 0, pushBestPerSet: -Infinity, crashTried: 0, crashBest: -Infinity, randomTried: 0, randomBestPerSet: -Infinity, randomTrades: 0 };

// 3a. buy N to push the price up, (maybe) wait, sell them all back
for (const f of FINDS) {
	for (const N of [1, 2, 3, 5, 10, 20, 40]) {
		for (const wait of [0, 1, 4, 12, 48, 96]) {
			const m = clean(SEED + N + wait, f.id);
			const c0 = m.state.coin.you;
			for (let i = 0; i < N; i++) assert.ok(m.counter("you", f.id, "buy").ok);
			m.run(wait);
			sellAllBack(m, "you", f.id);
			const net = m.state.coin.you - c0;
			assert.ok(net < 0, `push-up loop on ${f.id} (N=${N}, wait=${wait}) made ${net}`);
			loops.pushTried++;
			loops.pushBestPerSet = Math.max(loops.pushBestPerSet, net / N);
		}
	}
}
// 3b. crash it (a friend dumps dug sets), buy at the bottom, sell after it drifts home; also an oracle
//     that sells every set at the single best moment of the whole drift
for (const f of FINDS) {
	for (const K of [1, 3, 5, 10]) {
		const m = clean(SEED + 7 * K, f.id);
		m.state.bags.maya[f.id] = [{ n: 40 * size(f.id), cost: null }];
		const i = f.idx;
		while (m.state.P[i] > E.priceLo(f.id) + 1e-9) assert.ok(m.counter("maya", f.id, "sell").ok);
		const c0 = m.state.coin.you;
		let paid = 0;
		for (let k = 0; k < K; k++) {
			const r = m.counter("you", f.id, "buy");
			assert.ok(r.ok);
			paid += r.trade.price;
		}
		let bestBid = m.quote(f.id).bid;
		let ticks = 0;
		while (Math.abs(m.state.P[i] - U(f.id)) > 0.01 * U(f.id) && ticks < 400) {
			m.tick();
			ticks++;
			bestBid = Math.max(bestBid, m.quote(f.id).bid);
		}
		sellAllBack(m, "you", f.id);
		const net = m.state.coin.you - c0;
		assert.ok(net < 0, `crash loop on ${f.id} (K=${K}) made ${net}`);
		const oracle = K * bestBid - paid;
		assert.ok(oracle < 0, `crash loop on ${f.id} (K=${K}) at the best moment would make ${oracle}`);
		loops.crashTried++;
		loops.crashBest = Math.max(loops.crashBest, oracle / K);
	}
}
// 3c. random search: a coalition of one to three friends, any mix of counter buys and sells, waits,
//     and wash trades among themselves at any price (to drag the price), then everyone sells back
{
	const rr = (() => {
		let a = 987654;
		return () => {
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	})();
	const ri = (n) => Math.floor(rr() * n);
	for (let trial = 0; trial < 3000; trial++) {
		const f = FINDS[ri(FINDS.length)].id;
		const pigs = ["you", "maya", "biscuit"].slice(0, 1 + ri(3));
		const m = clean(SEED + trial, f);
		const c0 = coalitionCoin(m, pigs);
		let bought = 0;
		const ops = 5 + ri(60);
		for (let k = 0; k < ops; k++) {
			const x = rr();
			const a = pigs[ri(pigs.length)];
			if (x < 0.4) {
				if (m.counter(a, f, "buy").ok) bought++;
			} else if (x < 0.65) {
				if (m.count(a, f) >= size(f)) assert.ok(m.counter(a, f, "sell").ok);
			} else if (x < 0.85) {
				m.run(1 + ri(30));
			} else if (pigs.length > 1 && m.count(a, f) >= size(f)) {
				// a wash trade: offer a set to a friend at any price in the listing band, the friend takes it
				const b = pigs.filter((p) => p !== a)[ri(pigs.length - 1)];
				const price = 1 + ri(E.band(f).max);
				const res = m.list(a, { side: "sell", find: f, price, target: b });
				if (res.ok && !res.filled) assert.ok(m.take(b, res.offer.id).ok);
			}
		}
		for (const p of pigs) {
			m.openOffers(p).forEach((o) => m.cancel(p, o.id, true));
			sellAllBack(m, p, f);
		}
		// the leftovers (less than a set) are worth at most U each set; count them in the coalition's favour
		const spare = pigs.reduce((t, p) => t + m.count(p, f), 0);
		const net = coalitionCoin(m, pigs) - c0 + (spare / size(f)) * U(f);
		if (bought) {
			assert.ok(net < 0, `random loop ${trial} on ${f} by ${pigs.join("+")} made ${net}`);
			loops.randomBestPerSet = Math.max(loops.randomBestPerSet, net / bought);
			loops.randomTrades += bought;
		} else assert.ok(net <= 0, `random loop ${trial} made ${net} without buying`);
		loops.randomTried++;
	}
}

// ── 4. the rules ────────────────────────────────────────────────────────────
{
	const m = E.create({ sim: false, strangers: 0, seed: SEED });
	const S = m.state;
	const i = E.BY_ID.pinecone.idx;
	S.offers.slice().forEach((o) => m.cancel(o.pig, o.id, true));
	S.coin.you = 500;
	S.coin.maya = 500;
	S.bags.you.pinecone = [{ n: 40, cost: null }];
	S.bags.maya.pinecone = [{ n: 40, cost: null }];
	// impact: 3% of U a set, both ways
	S.P[i] = 12;
	let r = m.counter("you", "pinecone", "buy");
	assert.ok(r.ok && Math.abs(S.P[i] - 12.36) < 1e-9 && r.trade.price === 15, "a set bought pushes the price up 3% of U");
	r = m.counter("you", "pinecone", "sell");
	assert.ok(r.ok && Math.abs(S.P[i] - 12) < 1e-9 && r.trade.price === 9, "a set sold pulls it down 3% of U");
	// the guard: a stale quote fails as price_moved
	assert.strictEqual(m.counter("you", "pinecone", "buy", 14).reason, "price_moved");
	assert.strictEqual(m.counter("you", "pinecone", "sell", 10).reason, "price_moved");
	// crossing: a listing at Bullion's buying price sells to him at once, at his price
	S.P[i] = 12;
	r = m.list("you", { side: "sell", find: "pinecone", price: 7 });
	assert.ok(r.ok && r.filled && r.via === "counter" && r.trade.price === 9, "a listing under the counter's buying price sells to Bullion at his price");
	// one inside the gap rests
	S.P[i] = 12;
	r = m.list("you", { side: "sell", find: "pinecone", price: 12 });
	assert.ok(r.ok && !r.filled, "a listing inside the gap rests");
	const resting = r.offer;
	// a wanted ad at or over his selling price buys from him at once, at his price
	r = m.list("maya", { side: "buy", find: "red_berries", price: 30 });
	assert.ok(r.ok && r.filled && r.via === "counter" && r.trade.price === E.askAt("red_berries", r.trade.from), "a wanted ad over the counter's selling price buys from Bullion at his price");
	// a pig sale moves the price a third of the way toward what was paid
	S.P[i] = 11;
	r = m.take("maya", resting.id);
	assert.ok(r.ok && Math.abs(S.P[i] - (11 + (12 - 11) / 3)) < 1e-9, "a pig sale moves the price a third of the way to what was paid");
	assert.ok(r.trade.bid === E.bidAt("pinecone", 11) && r.trade.ask === E.askAt("pinecone", 11), "the receipt remembers what Bullion would have paid and charged");
	// swaps don't move the price
	const before = S.P.slice();
	r = m.list("you", { side: "swap", find: "pinecone", wantFind: "old_key", wantQty: 1, target: "maya" });
	assert.ok(r.ok);
	S.bags.maya.old_key = [{ n: 3, cost: null }];
	assert.strictEqual(m.take("biscuit", r.offer.id).reason, "not_found", "an offer to Maya is hers alone");
	assert.ok(m.take("maya", r.offer.id).ok);
	assert.deepStrictEqual(S.P, before, "a swap moves no price");
	// a resting listing the counter's buying price climbs past sells to Bullion on the next tick
	S.P[i] = 12;
	r = m.list("you", { side: "sell", find: "pinecone", price: 10 });
	assert.ok(r.ok && !r.filled);
	while (E.bidAt("pinecone", S.P[i]) < 10) assert.ok(m.counter("maya", "pinecone", "buy").ok);
	m.drainNotices();
	const tk = m.tick();
	assert.ok(tk.notices.some((n) => n.type === "crossed" && n.trade.price >= 10), "a crossed listing sells to Bullion on the tick, at his price");
	// friends only
	assert.strictEqual(m.list("you", { side: "sell", find: "pinecone", price: 12, target: "s1" }).reason, "not_a_friend");
	// the caps valve, off by default and working when turned on
	assert.strictEqual(E.TUNING.counterCaps, null, "no daily caps by default");
	const c = E.create({ sim: false, strangers: 0, counterCaps: { sell: 3, buy: 2 } });
	c.state.bags.you.pinecone = [{ n: 40, cost: null }];
	c.state.coin.you = 500;
	for (let k = 0; k < 3; k++) assert.ok(c.counter("you", "pinecone", "sell").ok);
	assert.strictEqual(c.counter("you", "pinecone", "sell").reason, "counter_limit");
	for (let k = 0; k < 2; k++) assert.ok(c.counter("you", "pinecone", "buy").ok);
	assert.strictEqual(c.counter("you", "pinecone", "buy").reason, "counter_limit");
	c.run(E.TUNING.ticksPerDay);
	assert.ok(c.counter("you", "pinecone", "sell").ok, "the caps reset with the day");
}

// ── 5. the long simulation ──────────────────────────────────────────────────
const m = E.create({ seed: SEED });
const S = m.state;
const startCoin = Object.assign({}, S.coin);
const net = {};
S.pigs.forEach((p) => (net[p.id] = 0));
const findsIn = {};
const findsOut = {};
FINDS.forEach((f) => {
	findsIn[f.id] = 0;
	findsOut[f.id] = 0;
});
const stats = {
	counterBuys: 0,
	counterSells: 0,
	counterCrossed: 0,
	pigListing: 0,
	pigWanted: 0,
	pigFriend: 0,
	pigInGap: 0,
	pigSales: 0,
	swaps: 0,
	swapFriend: 0,
	prints: 0,
	sheep: 0,
	pigToPigSum: 0,
	youActions: {},
	pigSaleBeatSeller: 0, // seller got more than Bullion would have paid
	pigSaleBeatBuyer: 0, // buyer paid less than Bullion would have charged
	boardCards: 0,
	boardForYou: 0,
	boardN: 0,
};
let lastTradeId = 0;
function absorbTrades() {
	for (const tr of S.trades) {
		if (tr.id <= lastTradeId) continue;
		lastTradeId = tr.id;
		const f = tr.find;
		if (tr.kind === "swap") {
			assert.strictEqual(tr.qty, size(f), "a swap gives a set");
			assert.ok(tr.wantQty >= 1 && tr.wantQty <= size(tr.wantFind) && tr.wantFind !== f, "a swap asks 1..N of another find");
			assert.ok(tr.price == null, "a swap moves no tickles");
			stats.swaps++;
			if (tr.target) stats.swapFriend++;
			continue;
		}
		if (tr.kind === "print") {
			assert.ok(!tr.buyer && !tr.seller && tr.who && tr.other && tr.who !== tr.other, "two townsfolk");
			stats.prints++;
			continue;
		}
		assert.strictEqual(tr.qty, size(f), `${tr.kind} trade of ${f} is a set`);
		assert.ok(Number.isInteger(tr.price) && tr.price >= 1, "whole tickles");
		switch (tr.kind) {
			case "counter":
				assert.strictEqual(tr.price, tr.side === "buy" ? tr.ask : tr.bid, "the counter trades at its own quote");
				assert.ok(tr.bid < tr.ask && tr.bid <= U(f) && tr.ask >= U(f) + 1, "a sane quote");
				assert.ok(Math.abs(tr.to - E.clampPrice(f, tr.from + (tr.side === "buy" ? 1 : -1) * 0.03 * U(f))) < 1e-9, "a counter set moves the price 3% of U");
				if (tr.side === "buy") {
					net[tr.buyer] -= tr.price;
					findsIn[f] += tr.qty;
					stats.counterBuys++;
				} else {
					net[tr.seller] += tr.price;
					findsOut[f] += tr.qty;
					stats.counterSells++;
				}
				if (tr.how === "crossed") stats.counterCrossed++;
				break;
			case "pig":
				assert.ok(tr.buyer && tr.seller && tr.buyer !== tr.seller, "pig to pig, never with yourself");
				assert.ok(Math.abs(tr.to - E.clampPrice(f, tr.from + (tr.price - tr.from) / 3)) < 1e-9, "a pig sale moves the price a third of the way");
				net[tr.buyer] -= tr.price;
				net[tr.seller] += tr.price;
				stats.pigToPigSum += tr.price;
				stats.pigSales++;
				if (tr.how === "listing") stats.pigListing++;
				else stats.pigWanted++;
				if (tr.target) stats.pigFriend++;
				if (tr.price > tr.bid) stats.pigSaleBeatSeller++;
				if (tr.price < tr.ask) stats.pigSaleBeatBuyer++;
				if (tr.price > tr.bid && tr.price < tr.ask) stats.pigInGap++;
				break;
			case "sheep":
				net[tr.seller] += tr.price;
				findsOut[f] += tr.qty;
				stats.sheep++;
				break;
			default:
				assert.fail("unknown trade kind " + tr.kind);
		}
	}
}
function checkInvariants(where) {
	for (const f of FINDS) {
		const P = S.P[f.idx];
		assert.ok(P >= E.priceLo(f.id) - 1e-9 && P <= E.priceHi(f.id) + 1e-9, `${where}: ${f.id} price ${P} left the band`);
		const q = m.quote(f.id);
		assert.ok(q.bid < q.ask && q.bid <= U(f.id) && q.ask >= U(f.id) + 1, `${where}: ${f.id} quote ${q.bid}/${q.ask}`);
	}
	for (const p of S.pigs) {
		assert.ok(S.coin[p.id] >= 0, `${where}: ${p.id} coin ${S.coin[p.id]}`);
		for (const f of FINDS) for (const l of S.bags[p.id][f.id]) assert.ok(l.n > 0 && (l.cost == null || l.cost >= -1e-9), `${where}: bad lot ${p.id} ${f.id}`);
		const expect = startCoin[p.id] + S.refilled[p.id] + net[p.id];
		assert.strictEqual(S.coin[p.id], expect, `${where}: ${p.id} coin ${S.coin[p.id]} but its trades say ${expect}`);
	}
	const fl = S.flows;
	assert.strictEqual(fl.pigToPig, stats.pigToPigSum, `${where}: pig-to-pig tickles off`);
	assert.strictEqual(m.totalCoin(), m.initialCoin + fl.refill + fl.sheep + fl.counterPaid - fl.counterCharged, `${where}: coin total off the flows`);
	for (const f of FINDS) {
		let held = 0;
		for (const p of S.pigs) held += m.count(p.id, f.id);
		for (const o of S.offers) if (o.find === f.id && o.lots) held += o.lots.reduce((t, l) => t + l.n, 0);
		const expect = m.startFinds[f.id] + (S.dugByFind[f.id] || 0) + findsIn[f.id] - findsOut[f.id];
		assert.strictEqual(held, expect, `${where}: ${f.id} count ${held} but its flows say ${expect}`);
	}
	const perPig = {};
	for (const o of S.offers) {
		assert.strictEqual(o.qty, size(o.find), `${where}: listing qty`);
		if (o.side === "sell" || o.side === "swap") assert.strictEqual(o.lots.reduce((t, l) => t + l.n, 0), size(o.find), `${where}: escrow is a set`);
		else assert.ok(o.lots == null, `${where}: a wanted ad sets nothing aside`);
		if (o.side === "swap") assert.ok(o.wantQty >= 1 && o.wantQty <= size(o.wantFind) && o.wantFind !== o.find, `${where}: swap want`);
		else assert.ok(Number.isInteger(o.price) && o.price >= 1 && o.price <= E.band(o.find).max, `${where}: listing price in its band`);
		if (o.target) assert.ok(S.friends[o.pig].indexOf(o.target) >= 0, `${where}: an offer to a pig who isn't a friend`);
		perPig[o.pig] = (perPig[o.pig] || 0) + 1;
		assert.ok(o.exp - S.tick <= E.TUNING.offerTicks && o.exp > S.tick, `${where}: listing outlived 24 hours`);
	}
	for (const k in perPig) assert.ok(perPig[k] <= E.TUNING.openOffers, `${where}: ${k} has ${perPig[k]} listings up`);
}

// a scripted "you" pressing every button
const yr = (() => {
	let a = 12345;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
})();
function youAct() {
	const f = FINDS[Math.floor(yr() * FINDS.length)].id;
	const q = m.quote(f);
	const x = yr();
	const target = yr() < 0.3 ? (yr() < 0.5 ? "maya" : "biscuit") : null;
	let what;
	let res;
	if (x < 0.14) {
		what = "counterBuy";
		res = m.counter("you", f, "buy", q.ask);
	} else if (x < 0.28) {
		what = "counterSell";
		res = m.counter("you", f, "sell", q.bid);
	} else if (x < 0.46) {
		what = "listSale";
		const p = Math.max(1, q.bid - 2 + Math.floor(yr() * (q.ask - q.bid + 5)));
		m.previewList("you", { side: "sell", find: f, price: p, target });
		res = m.list("you", { side: "sell", find: f, price: p, target });
	} else if (x < 0.58) {
		what = "listWanted";
		const p = Math.max(1, q.bid - 2 + Math.floor(yr() * (q.ask - q.bid + 5)));
		m.previewList("you", { side: "buy", find: f, price: p, target });
		res = m.list("you", { side: "buy", find: f, price: p, target });
	} else if (x < 0.66) {
		what = "listSwap";
		const want = FINDS[Math.floor(yr() * FINDS.length)].id;
		res = m.list("you", { side: "swap", find: f, wantFind: want, wantQty: 1 + Math.floor(yr() * size(want)), target });
	} else if (x < 0.82) {
		what = "take";
		const cards = m.boardView("you");
		if (cards.length) {
			const o = cards[Math.floor(yr() * cards.length)].offer;
			if (o.side !== "swap") m.previewPig(o.find, o.price);
			res = m.take("you", o.id);
		}
	} else if (x < 0.92) {
		what = "cancel";
		const mine = m.openOffers("you");
		if (mine.length) res = m.cancel("you", mine[Math.floor(yr() * mine.length)].id);
	} else {
		what = "sellToSheep";
		res = m.sellToSheep("you", f);
	}
	const k = what + (res ? (res.ok ? (res.filled === false ? ":posted" : res.via ? ":crossed-" + res.via : ":ok") : ":" + res.reason) : ":none");
	stats.youActions[k] = (stats.youActions[k] || 0) + 1;
}

checkInvariants("start");
const t0 = S.tick;
for (let i = 0; i < TICKS; i++) {
	m.tick();
	absorbTrades();
	checkInvariants(`tick ${S.tick}`);
	if (yr() < 0.3) {
		youAct();
		absorbTrades();
		checkInvariants(`you at tick ${S.tick}`);
	}
	if (i === 60) m.seedDemo(), absorbTrades(), checkInvariants("seedDemo");
	// the page's reads must never throw
	m.counterRows("you");
	m.findView("pinecone", "you");
	const cards = m.boardView("you");
	stats.boardCards += cards.length;
	stats.boardForYou += cards.filter((c) => c.forYou).length;
	stats.boardN++;
	m.drainNotices();
}
const days = (S.tick - t0) / E.TUNING.ticksPerDay;

// how far a price moves in a day, and on its busiest day
const ranges = [];
const busiest = {};
for (const d in S.dayStats) {
	if (Number(d) <= m.dayOf(t0) || Number(d) >= m.dayOf(S.tick)) continue; // whole days only
	for (const fid in S.dayStats[d]) {
		const st = S.dayStats[d][fid];
		const range = (st.hi - st.lo) / U(fid);
		const busy = st.counterBuys + st.counterSells + st.pigSales;
		ranges.push(range);
		if (!busiest[fid] || busy > busiest[fid].busy) busiest[fid] = { busy, range, counter: st.counterBuys + st.counterSells, pig: st.pigSales, day: d, lo: st.lo, hi: st.hi };
	}
}
ranges.sort((a, b) => a - b);
const median = ranges[Math.floor(ranges.length / 2)];
const p90 = ranges[Math.floor(ranges.length * 0.9)];
const maxRange = ranges[ranges.length - 1];

// how long a pushed price takes to drift home (no trades; wiggle on), from the top of the band
const drift = { to5: [], to2: [], to1: [] };
for (let s = 0; s < 20; s++) {
	for (const f of FINDS) {
		const d = E.create({ sim: false, strangers: 0, seed: SEED + 1000 + s });
		d.state.P[f.idx] = E.priceHi(f.id);
		let t = 0;
		const seen = {};
		while (t < 400 && !(seen.to1 != null)) {
			d.tick();
			t++;
			const gap = Math.abs(d.state.P[f.idx] - U(f.id)) / U(f.id);
			if (seen.to5 == null && gap <= 0.05) seen.to5 = t;
			if (seen.to2 == null && gap <= 0.02) seen.to2 = t;
			if (seen.to1 == null && gap <= 0.01) seen.to1 = t;
		}
		for (const k of ["to5", "to2", "to1"]) drift[k].push(seen[k] == null ? 400 : seen[k]);
	}
}
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const hrs = (ticks) => fmt((ticks * E.TUNING.tickMinutes) / 60, 0);

// ── summary ─────────────────────────────────────────────────────────────────
const pigs = S.pigs.length;
console.log(`Bullion's Market, round 4: ${TICKS} ticks (${fmt(days)} days), seed ${SEED}, ${pigs} pigs (you, Maya, Biscuit, ${pigs - 3} strangers)`);
console.log("");
console.log("ALL CHECKS HELD:");
console.log("  fairness: over the whole band, Bullion's best buy < his worst sell, every find:");
console.log("    " + FINDS.map((f) => `${f.id} ${fair[f.id].maxBid}<${fair[f.id].minAsk} (U ${fair[f.id].u})`).join(", "));
console.log(`  no counter loop profits: ${loops.pushTried} push-up-and-sell-back loops (best lost ${fmt(-loops.pushBestPerSet)} a set),`);
console.log(`    ${loops.crashTried} buy-the-crash-sell-after-drift loops, even selling at the best moment (best lost ${fmt(-loops.crashBest)} a set),`);
console.log(`    ${loops.randomTried} random coalition loops with wash trades, ${loops.randomTrades} sets bought (best lost ${fmt(-loops.randomBestPerSet)} a set)`);
console.log("  rules: impact 3% of U a set; crossing both ways; a pig sale moves the price a third; swaps move nothing;");
console.log("    offers to a friend are hers alone; daily caps off by default and working when on");
console.log("  every tick and action of the long run: prices in band, quotes sane, no negative coin/bag/lot,");
console.log("    every pig's coin reconciles from its trades, pig to pig conserved, counter flows accounted,");
console.log("    every find reconciles, every listing a set, at most 4 up, 24 hours, offers to friends only");
console.log("");
console.log("How far a price moves in a day (high minus low, as a share of the usual price):");
console.log(`  median day ${fmt(median * 100)}%, 90th percentile ${fmt(p90 * 100)}%, widest ${fmt(maxRange * 100)}% (the band is 30% wide)`);
console.log("  each find's busiest day:");
for (const f of FINDS) {
	const b = busiest[f.id];
	if (!b) continue;
	console.log(`    ${f.id.padEnd(13)} ${String(b.counter).padStart(2)} counter sets + ${String(b.pig).padStart(2)} pig sales: ${E.fmtPrice(b.lo)}..${E.fmtPrice(b.hi)} (usual ${U(f.id)}, ${fmt(b.range * 100)}% of it)`);
}
console.log("");
console.log(`A price pushed to the top drifts home (no trades, wiggle on; median of ${drift.to1.length} runs):`);
console.log(`  within 5% of usual in ${hrs(med(drift.to5))} h, within 2% in ${hrs(med(drift.to2))} h, within 1% in ${hrs(med(drift.to1))} h`);
console.log("");
const perDay = (n) => fmt(n / days);
const counterSets = stats.counterBuys + stats.counterSells;
const boardTrades = stats.pigSales + stats.swaps;
console.log("Trades per day, the whole market:");
console.log(`  the counter:    ${perDay(counterSets)} sets (${perDay(stats.counterBuys)} bought from Bullion, ${perDay(stats.counterSells)} sold to him; ${perDay(stats.counterCrossed)} of them crossed listings)`);
console.log(`  the noticeboard: ${perDay(boardTrades)} (${perDay(stats.pigListing)} for-sale listings taken, ${perDay(stats.pigWanted)} wanted ads filled, ${perDay(stats.swaps)} swaps; ${perDay(stats.pigFriend + stats.swapFriend)} were offers to a friend)`);
console.log(`  townsfolk prints on the tape: ${perDay(stats.prints)}; Ghost Sheep sales: ${perDay(stats.sheep)}`);
console.log(`  the board shows you ${fmt(stats.boardCards / stats.boardN)} cards on average, ${fmt(stats.boardForYou / stats.boardN, 2)} of them for you`);
console.log("");
console.log("Pig sales against the counter:");
console.log(`  ${fmt((100 * stats.pigInGap) / stats.pigSales)}% beat the counter for both sides (priced strictly between what Bullion pays and charges)`);
console.log(`  ${fmt((100 * stats.pigSaleBeatSeller) / stats.pigSales)}% paid the seller more than Bullion would have; ${fmt((100 * stats.pigSaleBeatBuyer) / stats.pigSales)}% cost the buyer less than Bullion charges`);
console.log("");
console.log("Scripted you: " + Object.keys(stats.youActions).sort().map((k) => `${k} ${stats.youActions[k]}`).join(", "));
console.log(`You end with ${S.coin.you} tickles ready, ledger spent ${S.ledger.you.spent} · took in ${S.ledger.you.tookIn}`);
console.log("");
console.log("PASS");
