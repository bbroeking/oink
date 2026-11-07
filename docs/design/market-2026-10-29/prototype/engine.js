/*
 * Bullion's Market, round 4: one price, two ways to trade (prototype, 2026-10-30).
 *
 * Rules: docs/design/market-2026-10-29/round-4-two-part.md.
 *   Part 1, the Counter: Bullion always buys and sells a set. He sells at max(U + 1, ceil(1.2 P))
 *     and buys at min(U, floor(0.8 P)), where U is the usual price (the Ghost Sheep's price for one
 *     find x the set size) and P is the price, kept in 0.85 U .. 1.15 U. Each set bought at the
 *     counter pushes P up 3% of U, each set sold pulls it down 3%. Every tick (30 minutes) the
 *     townsfolk wiggle P by up to 1% of U and it drifts 5% of the way home to U.
 *   Part 2, the Noticeboard: pigs post For sale, Wanted and Straight-up swaps, to everyone or to one
 *     friend. A pig sale moves P a third of the way toward what was paid; swaps move nothing. A
 *     listing at or under the counter's buying price sells to Bullion at once (at his price); a
 *     wanted ad at or over his selling price buys from him at once (at his price).
 *   No patient townsfolk fills. No daily counter caps by default (TUNING.counterCaps stays a valve).
 *
 * Runs in the page (window.MarketEngine) and in node (module.exports). Everything random is drawn
 * from a hash of (seed, tick, ...), so a reset with the same seed replays the same day.
 *
 * Demo only: the other pigs (two friends and a crowd of strangers) are simulated here; in the real
 * market they are real pigs. The counter and the price are the parts that would ship.
 */
(function (root, factory) {
	var api = factory();
	if (typeof module === "object" && module.exports) module.exports = api;
	if (typeof window !== "undefined") window.MarketEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
	"use strict";

	// ── catalog ────────────────────────────────────────────────────────────
	var FINDS = [
		{ id: "river_pebble", name: "river pebble", plural: "river pebbles", rarity: "common" },
		{ id: "blue_feather", name: "blue feather", plural: "blue feathers", rarity: "common" },
		{ id: "clover", name: "four-leaf clover", plural: "clovers", rarity: "common" },
		{ id: "snail_shell", name: "snail shell", plural: "snail shells", rarity: "common" },
		{ id: "brass_button", name: "brass button", plural: "brass buttons", rarity: "common" },
		{ id: "wool_tuft", name: "tuft of wool", plural: "tufts of wool", rarity: "common" },
		{ id: "red_berries", name: "red berries", plural: "red berries", rarity: "common" },
		{ id: "pinecone", name: "pinecone", plural: "pinecones", rarity: "common" },
		{ id: "old_key", name: "old key", plural: "old keys", rarity: "uncommon" },
		{ id: "honeycomb", name: "honeycomb chip", plural: "honeycomb chips", rarity: "uncommon" },
		{ id: "marble", name: "glass marble", plural: "glass marbles", rarity: "uncommon" },
		{ id: "tin_whistle", name: "tin whistle", plural: "tin whistles", rarity: "rare" },
	];
	var BY_ID = {};
	FINDS.forEach(function (f, i) {
		f.idx = i;
		BY_ID[f.id] = f;
	});

	var TUNING = {
		base: { common: 3, uncommon: 8, rare: 20 }, // the Ghost Sheep's price per find
		setSize: { common: 4, uncommon: 3, rare: 3 }, // four of a common, three of anything else
		listMultiple: 3, // a listing's price per set: 1 to 3 x the usual price
		openOffers: 4, // listings up at a time
		dailyPosts: 30,
		offerTicks: 48, // 24 hours of 30-minute ticks
		ticksPerDay: 48,
		tickMinutes: 30,
		coinCap: 25, // tickles ready refill to here; sales may bank past it
		refillEvery: 2, // one tickle every 2 ticks: about 24 a day
		fancyMultiple: 2, // the Ghost Sheep pays double for the find he fancies
		price: {
			lo: 0.85, // the price stays between 0.85x and 1.15x of the usual price
			hi: 1.15,
			sellFactor: 1.2, // Bullion sells at max(U + 1, ceil(1.2 x P))
			buyFactor: 0.8, // Bullion buys at min(U, floor(0.8 x P))
			impact: 0.03, // each set at the counter moves P by 3% of U
			pigPull: 1 / 3, // a pig sale moves P a third of the way to what was paid
			wiggle: 0.01, // every tick: P += U x 0.01 x (2r - 1)
			home: 0.05, // and P += 0.05 x (U - P)
		},
		counterCaps: null, // e.g. { sell: 3, buy: 2 } sets per pig per day; null = off (the default)
		printChance: { common: 0.2, uncommon: 0.1, rare: 0.03 }, // a townsfolk print on the tape, per tick
	};

	// Demo-only behaviour of the simulated pigs (not shipping rules).
	var SIM = {
		strangers: 40,
		activity: { stranger: 0.3, friend: 0.4 }, // chance a pig does something on a tick
		valueLo: 0.8, // private value per set = P x random(0.8, 1.2), rerolled daily
		valueHi: 1.2,
		longAt2: 0.82, // a pig holding 2+ sets values one more set less
		longAt3: 0.68, // and 3+ sets less again
		weights: {
			stranger: { buy: 0.16, sell: 0.13, postSell: 0.24, postBuy: 0.2, cancel: 0.04, swapPost: 0.04, swapTake: 0.06, friend: 0.02 },
			friend: { buy: 0.14, sell: 0.1, postSell: 0.2, postBuy: 0.16, cancel: 0.04, swapPost: 0.04, swapTake: 0.06, friend: 0.08 },
		},
		friendBonus: 1.15, // a friend's offer is worth a little more to a pig
		friendLook: 0.35, // chance a pig looks at offers sent to it, per tick
		friendToYou: 0.6, // Maya and Biscuit send most of their friend offers to you
		digsPerDay: 1.8,
		rarityDrop: { common: 0.7, uncommon: 0.25, rare: 0.05 },
	};

	var TOWNSFOLK = ["the Miller", "the Baker's boy", "Old Mrs Hedge", "the Tinker", "Farmer Bramble", "the Postmistress"];
	var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	var DAY0_WEEKDAY = 3; // day 0 is a Wednesday; day 1 (the demo's first day) is Thursday

	// ── seeded randomness ──────────────────────────────────────────────────
	function hash32() {
		var h = 0x811c9dc5 | 0;
		for (var i = 0; i < arguments.length; i++) {
			var v = arguments[i];
			if (typeof v === "string") {
				for (var j = 0; j < v.length; j++) {
					h ^= v.charCodeAt(j);
					h = Math.imul(h, 0x01000193);
				}
			} else {
				h ^= v | 0;
				h = Math.imul(h, 0x01000193);
				h ^= (v / 4294967296) | 0;
			}
			h ^= h >>> 15;
			h = Math.imul(h, 0x2c1b3c6d);
			h ^= h >>> 12;
			h = Math.imul(h, 0x297a2d39);
			h ^= h >>> 15;
		}
		return h >>> 0;
	}
	function mulberry32(a) {
		return function () {
			a |= 0;
			a = (a + 0x6d2b79f5) | 0;
			var t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}
	function rngFrom() {
		return mulberry32(hash32.apply(null, arguments));
	}
	function uni(r, lo, hi) {
		return lo + (hi - lo) * r();
	}
	function pick(r, arr) {
		return arr[Math.floor(r() * arr.length)];
	}
	function shuffle(r, arr) {
		var a = arr.slice();
		for (var i = a.length - 1; i > 0; i--) {
			var j = Math.floor(r() * (i + 1));
			var t = a[i];
			a[i] = a[j];
			a[j] = t;
		}
		return a;
	}

	// ── pure rules ─────────────────────────────────────────────────────────
	var EPS = 1e-9;
	function setSize(fid) {
		return TUNING.setSize[BY_ID[fid].rarity];
	}
	function basePrice(fid) {
		return TUNING.base[BY_ID[fid].rarity];
	}
	// the usual price of a set: the Sheep's price for one find x the set size
	function usual(fid) {
		return basePrice(fid) * setSize(fid);
	}
	function priceLo(fid) {
		return TUNING.price.lo * usual(fid);
	}
	function priceHi(fid) {
		return TUNING.price.hi * usual(fid);
	}
	function clampPrice(fid, p) {
		return Math.max(priceLo(fid), Math.min(priceHi(fid), p));
	}
	// what Bullion charges for a set at price P (never below the usual price + 1)
	function askAt(fid, P) {
		return Math.max(usual(fid) + 1, Math.ceil(TUNING.price.sellFactor * P - EPS));
	}
	// what Bullion pays for a set at price P (never above the usual price)
	function bidAt(fid, P) {
		return Math.min(usual(fid), Math.floor(TUNING.price.buyFactor * P + EPS));
	}
	// a listing's price range, per set
	function band(fid) {
		return { min: 1, max: TUNING.listMultiple * usual(fid) };
	}
	// one decimal, no trailing ".0": 12, 12.4
	function fmtPrice(p) {
		var r = Math.round(p * 10) / 10;
		return r % 1 === 0 ? String(r) : r.toFixed(1);
	}
	// how a price per set compares to the price: "3 under the price", "2 over", "at the price"
	function vsPrice(price, P) {
		var d = Math.round(price - P);
		if (d > 0) return { diff: d, word: d + " over the price", short: d + " over" };
		if (d < 0) return { diff: d, word: -d + " under the price", short: -d + " under" };
		return { diff: 0, word: "at the price", short: "at the price" };
	}
	function gainWord(g) {
		g = Math.round(g);
		if (g > 0) return "up " + g;
		if (g < 0) return "down " + -g;
		return "even";
	}
	function eachWord(total, size) {
		if (total % size === 0) return total / size + " each";
		return "about " + Math.round(total / size) + " each";
	}

	// ── the engine ─────────────────────────────────────────────────────────
	function create(opts) {
		opts = opts || {};
		var seed = opts.seed == null ? 20261030 : opts.seed;
		var nStrangers = opts.strangers == null ? SIM.strangers : opts.strangers;
		var simOn = opts.sim !== false;
		var caps = opts.counterCaps === undefined ? TUNING.counterCaps : opts.counterCaps;
		var startTick = opts.startTick == null ? 0 : opts.startTick;

		var S = {
			seed: seed,
			tick: startTick,
			pigs: [],
			byPig: {},
			friends: {},
			bags: {}, // pig -> find -> [lots {n, cost|null}], newest last
			coin: {},
			offers: [], // open listings: side 'sell' (for sale), 'buy' (wanted), 'swap'
			nextOfferId: 1,
			nextSeq: 1,
			trades: [],
			nextTradeId: 1,
			P: [], // the price per set, per find (a float in 0.85 U .. 1.15 U)
			hist: [], // per find: [{t, p}], one point a tick (the last P of that tick)
			lastActive: [], // per find: the tick of the last trade that moved the price
			counterDay: {}, // pig -> {sold, bought} today (only matters when caps are on)
			postsToday: {},
			sheepDone: {},
			sheepHour: {},
			fancy: {},
			mult: {}, // pig -> [per-find private value multiplier], rerolled daily
			ledger: {}, // pig -> {spent, tookIn, sheep}
			flows: { refill: 0, sheep: 0, counterPaid: 0, counterCharged: 0, pigToPig: 0 },
			findFlows: { dug: 0, counterSold: 0, counterBought: 0, sheepTook: 0 },
			refilled: {},
			dugByFind: {},
			tape: [],
			nextTapeId: 1,
			notices: [],
			dayStats: {}, // day -> find -> {counterBuys, counterSells, pigSales, swaps, prints, lo, hi, open}
		};

		// ── pigs ──
		function addPig(id, name, kind, art) {
			var p = { id: id, name: name, kind: kind, art: art, idx: S.pigs.length };
			S.pigs.push(p);
			S.byPig[id] = p;
			S.bags[id] = {};
			FINDS.forEach(function (f) {
				S.bags[id][f.id] = [];
			});
			S.coin[id] = TUNING.coinCap;
			S.counterDay[id] = { sold: 0, bought: 0 };
			S.postsToday[id] = 0;
			S.ledger[id] = { spent: 0, tookIn: 0, sheep: 0 };
			S.refilled[id] = 0;
			S.friends[id] = [];
			return p;
		}
		addPig("you", "you", "you", "rosie");
		addPig("maya", "Maya", "friend", "maya");
		addPig("biscuit", "Biscuit", "friend", "biscuit");
		for (var si = 1; si <= nStrangers; si++) addPig("s" + si, "a pig", "stranger", "pigface");
		S.friends.you = ["maya", "biscuit"];
		S.friends.maya = ["you", "biscuit"];
		S.friends.biscuit = ["you", "maya"];
		for (var fi = 1; fi + 1 <= nStrangers; fi += 2) {
			S.friends["s" + fi] = ["s" + (fi + 1)];
			S.friends["s" + (fi + 1)] = ["s" + fi];
		}

		// your bag (Rosie): one set of pinecones for the guided first trade, a few more sets to list
		var YOUR_BAG = {
			pinecone: [{ n: 4, cost: null }],
			snail_shell: [{ n: 6, cost: null }],
			red_berries: [{ n: 5, cost: null }],
			clover: [{ n: 4, cost: null }],
			wool_tuft: [{ n: 2, cost: null }],
			old_key: [{ n: 3, cost: 22 }],
			marble: [{ n: 2, cost: null }],
			honeycomb: [{ n: 1, cost: null }],
			tin_whistle: [{ n: 1, cost: null }],
		};
		Object.keys(YOUR_BAG).forEach(function (fid) {
			S.bags.you[fid] = YOUR_BAG[fid].map(function (l) {
				return { n: l.n, cost: l.cost };
			});
		});
		S.pigs.forEach(function (p) {
			if (p.id === "you") return;
			var r = rngFrom(seed, "bag", p.idx);
			FINDS.forEach(function (f) {
				var n;
				if (f.rarity === "common") n = Math.floor(uni(r, 0, 10)); // about a set of each, so nobody opens the day dumping
				else if (f.rarity === "uncommon") n = Math.floor(uni(r, 0, 7));
				else n = Math.floor(uni(r, 0, 5));
				if (n > 0) S.bags[p.id][f.id].push({ n: n, cost: null });
			});
			S.coin[p.id] = Math.floor(uni(r, 10, 26));
		});
		// your friends hold what the demo's first offers need
		// after the start, a top-up is booked as finds dug up (so every find still reconciles)
		var started = false;
		function topUp(pig, fid, n) {
			var have = count(pig, fid);
			if (have >= n) return;
			S.bags[pig][fid].push({ n: n - have, cost: null });
			if (started) {
				S.findFlows.dug += n - have;
				S.dugByFind[fid] = (S.dugByFind[fid] || 0) + n - have;
			}
		}
		if (S.byPig.maya) {
			topUp("maya", "pinecone", 8);
			topUp("maya", "old_key", 3);
			topUp("maya", "marble", 3);
		}
		if (S.byPig.biscuit) {
			topUp("biscuit", "brass_button", 8);
			topUp("biscuit", "old_key", 2);
		}
		var startFinds = {};
		FINDS.forEach(function (f) {
			startFinds[f.id] = 0;
			S.pigs.forEach(function (p) {
				startFinds[f.id] += count(p.id, f.id);
			});
		});

		// the price per find starts near the usual price
		FINDS.forEach(function (f) {
			var r = rngFrom(seed, "p0", f.idx);
			S.P[f.idx] = clampPrice(f.id, usual(f.id) * uni(r, 0.97, 1.03));
			S.hist[f.idx] = [{ t: S.tick, p: S.P[f.idx] }];
			S.lastActive[f.idx] = S.tick;
		});
		var initialCoin = totalCoin();
		rollDay(dayOf(S.tick));
		started = true;

		// ── time ──
		function dayOf(t) {
			return Math.floor(t / TUNING.ticksPerDay);
		}
		function clock(t) {
			t = t == null ? S.tick : t;
			var d = dayOf(t);
			var m = (((t % TUNING.ticksPerDay) + TUNING.ticksPerDay) % TUNING.ticksPerDay) * TUNING.tickMinutes;
			var hh = Math.floor(m / 60);
			var mm = m % 60;
			var time = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
			var weekday = WEEKDAYS[(((DAY0_WEEKDAY + d) % 7) + 7) % 7];
			return { day: d, weekday: weekday, time: time, label: weekday + " " + time + " · day " + d, minutes: m };
		}
		function rollDay(d) {
			S.pigs.forEach(function (p) {
				var r = rngFrom(seed, "day", d, p.idx);
				S.mult[p.id] = FINDS.map(function () {
					return uni(r, SIM.valueLo, SIM.valueHi);
				});
				// the demo's first day: your Ghost Sheep fancies brass buttons (you hold none, so a set is to buy)
				S.fancy[p.id] = p.id === "you" && d === 1 ? "brass_button" : pick(r, FINDS).id;
				S.sheepHour[p.id] = Math.floor(uni(r, 16, 42)); // a tick between 08:00 and 21:00
				S.counterDay[p.id] = { sold: 0, bought: 0 };
				S.postsToday[p.id] = 0;
				S.sheepDone[p.id] = false;
			});
		}

		// ── bags ──
		function count(pig, fid) {
			var lots = S.bags[pig][fid];
			var n = 0;
			for (var i = 0; i < lots.length; i++) n += lots[i].n;
			return n;
		}
		function addLot(pig, fid, n, cost) {
			if (n <= 0) return;
			S.bags[pig][fid].push({ n: n, cost: cost });
		}
		// take n units, newest first (so a set you just bought is the set you sell next)
		function takeUnits(pig, fid, n) {
			var lots = S.bags[pig][fid];
			var out = [];
			while (n > 0 && lots.length) {
				var l = lots[lots.length - 1];
				if (l.n <= n) {
					out.push(l);
					lots.pop();
					n -= l.n;
				} else {
					var part = l.cost == null ? null : (l.cost * n) / l.n;
					out.push({ n: n, cost: part });
					l.cost = l.cost == null ? null : l.cost - part;
					l.n -= n;
					n = 0;
				}
			}
			if (n > 0) throw new Error("takeUnits: not enough " + fid + " in " + pig);
			return out;
		}
		function returnLots(pig, fid, lots) {
			lots.forEach(function (l) {
				S.bags[pig][fid].push({ n: l.n, cost: l.cost });
			});
		}
		function lotsCost(lots) {
			var paid = 0;
			var paidUnits = 0;
			var dug = 0;
			lots.forEach(function (l) {
				if (l.cost == null) dug += l.n;
				else {
					paid += l.cost;
					paidUnits += l.n;
				}
			});
			return { cost: paidUnits ? Math.round(paid) : null, paidUnits: paidUnits, dug: dug };
		}
		function holding(pig, fid) {
			var lots = S.bags[pig][fid];
			var held = count(pig, fid);
			var size = setSize(fid);
			var paid = 0;
			var paidUnits = 0;
			lots.forEach(function (l) {
				if (l.cost != null) {
					paid += l.cost;
					paidUnits += l.n;
				}
			});
			var escrow = 0;
			S.offers.forEach(function (o) {
				if (o.pig === pig && o.find === fid && (o.side === "sell" || o.side === "swap")) escrow += o.qty;
			});
			return { held: held, sets: Math.floor(held / size), spare: held % size, size: size, paid: Math.round(paid), paidUnits: paidUnits, dugUnits: held - paidUnits, onOffer: escrow };
		}

		// ── the price ──
		function idxOf(fid) {
			return BY_ID[fid].idx;
		}
		function sample(i) {
			var h = S.hist[i];
			if (h.length && h[h.length - 1].t === S.tick) h[h.length - 1].p = S.P[i];
			else h.push({ t: S.tick, p: S.P[i] });
			if (h.length > 400) h.splice(0, h.length - 400);
		}
		function dayStat(fid) {
			var d = dayOf(S.tick);
			var ds = (S.dayStats[d] = S.dayStats[d] || {});
			var P = S.P[idxOf(fid)];
			return (ds[fid] = ds[fid] || { counterBuys: 0, counterSells: 0, pigSales: 0, swaps: 0, prints: 0, lo: P, hi: P, open: P });
		}
		function setPrice(fid, p) {
			var i = idxOf(fid);
			var from = S.P[i];
			S.P[i] = clampPrice(fid, p);
			sample(i);
			var st = dayStat(fid);
			st.lo = Math.min(st.lo, S.P[i]);
			st.hi = Math.max(st.hi, S.P[i]);
			return { from: from, to: S.P[i] };
		}
		function quote(fid) {
			var P = S.P[idxOf(fid)];
			return { find: fid, U: usual(fid), P: P, ask: askAt(fid, P), bid: bidAt(fid, P), lo: priceLo(fid), hi: priceHi(fid), each: P / setSize(fid) };
		}
		function counterOpen(pig, side) {
			if (!caps) return true;
			var cd = S.counterDay[pig];
			return side === "sell" ? cd.sold < caps.sell : cd.bought < caps.buy;
		}
		// what a counter trade would do: the price you pay or get, and where the price goes
		function previewCounter(fid, side) {
			var q = quote(fid);
			var to = clampPrice(fid, q.P + (side === "buy" ? 1 : -1) * TUNING.price.impact * q.U);
			return { side: side, price: side === "buy" ? q.ask : q.bid, from: q.P, to: to, bid: q.bid, ask: q.ask };
		}
		// what a pig-to-pig sale at this price would do to the price
		function previewPig(fid, price) {
			var q = quote(fid);
			return { from: q.P, to: clampPrice(fid, q.P + (price - q.P) * TUNING.price.pigPull), bid: q.bid, ask: q.ask };
		}
		function priceAgo(fid, ticks) {
			var h = S.hist[idxOf(fid)];
			var target = S.tick - ticks;
			for (var i = h.length - 1; i >= 0; i--) if (h[i].t <= target) return h[i].p;
			return h[0].p;
		}
		function series(fid, n) {
			var h = S.hist[idxOf(fid)];
			return h.slice(Math.max(0, h.length - n));
		}

		// ── the noticeboard ──
		function visible(o, viewer) {
			return o.target == null || o.target === viewer || o.pig === viewer;
		}
		function openOffers(pig) {
			return S.offers.filter(function (o) {
				return o.pig === pig;
			});
		}
		function openBuyTotal(pig) {
			var t = 0;
			S.offers.forEach(function (o) {
				if (o.pig === pig && o.side === "buy") t += o.price;
			});
			return t;
		}
		function findOffer(id) {
			for (var i = 0; i < S.offers.length; i++) if (S.offers[i].id === id) return S.offers[i];
			return null;
		}
		function removeOffer(o) {
			var i = S.offers.indexOf(o);
			if (i >= 0) S.offers.splice(i, 1);
		}
		// for-sale listings of a find this pig can take, cheapest first (from one pig if `from` is set)
		function salesFor(viewer, fid, from) {
			return S.offers
				.filter(function (o) {
					return o.side === "sell" && o.find === fid && o.pig !== viewer && visible(o, viewer) && (!from || o.pig === from);
				})
				.sort(function (a, b) {
					return a.price - b.price || a.seq - b.seq;
				});
		}
		// wanted ads for a find this pig can fill, best first
		function wantedFor(viewer, fid, from) {
			return S.offers
				.filter(function (o) {
					return o.side === "buy" && o.find === fid && o.pig !== viewer && visible(o, viewer) && (!from || o.pig === from);
				})
				.sort(function (a, b) {
					return b.price - a.price || a.seq - b.seq;
				});
		}
		// the best wanted ad paying at least minPrice whose pig can pay; ads whose pig can't pay lapse
		function bestWanted(viewer, fid, from, minPrice) {
			var ws = wantedFor(viewer, fid, from);
			for (var i = 0; i < ws.length; i++) {
				var w = ws[i];
				if (w.price < minPrice) return null;
				if (S.coin[w.pig] >= w.price) return w;
				lapse(w, "short");
			}
			return null;
		}
		// the same, without side effects (for reads and previews)
		function bestWantedPure(viewer, fid, from, minPrice) {
			var ws = wantedFor(viewer, fid, from);
			for (var i = 0; i < ws.length; i++) {
				if (ws[i].price < minPrice) return null;
				if (S.coin[ws[i].pig] >= ws[i].price) return ws[i];
			}
			return null;
		}
		function cheapestSale(viewer, fid, from, maxPrice) {
			var s = salesFor(viewer, fid, from)[0];
			return s && s.price <= maxPrice ? s : null;
		}

		// ── the tape ──
		function tape(kind, data) {
			var e = { id: S.nextTapeId++, t: S.tick, kind: kind };
			for (var k in data) e[k] = data[k];
			S.tape.push(e);
			if (S.tape.length > 800) S.tape.splice(0, S.tape.length - 800);
			return e;
		}
		function notice(n) {
			n.t = S.tick;
			S.notices.push(n);
		}
		function recordTrade(tr) {
			tr.id = S.nextTradeId++;
			tr.t = S.tick;
			S.trades.push(tr);
			if (S.trades.length > 6000) S.trades.splice(0, S.trades.length - 6000);
			if (tr.kind !== "sheep") {
				var st = dayStat(tr.find);
				if (tr.kind === "counter") st[tr.side === "buy" ? "counterBuys" : "counterSells"] += 1;
				else if (tr.kind === "pig") st.pigSales += 1;
				else if (tr.kind === "swap") st.swaps += 1;
				else if (tr.kind === "print") st.prints += 1;
			}
			tape("trade", { trade: tr });
			return tr;
		}
		function fail(reason, extra) {
			var r = { ok: false, reason: reason };
			if (extra) for (var k in extra) r[k] = extra[k];
			return r;
		}

		// ── settling ──
		// Bullion buys a pig's set at his buying price; the price drops 3% of the usual price
		function settleCounterSell(pig, fid, lots, how, offer) {
			var q = quote(fid);
			var size = setSize(fid);
			S.coin[pig] += q.bid;
			S.flows.counterPaid += q.bid;
			S.findFlows.counterBought += size;
			S.ledger[pig].tookIn += q.bid;
			S.counterDay[pig].sold += 1;
			if (offer) removeOffer(offer);
			var c = lotsCost(lots);
			var mv = setPrice(fid, q.P - TUNING.price.impact * q.U);
			S.lastActive[idxOf(fid)] = S.tick;
			var tr = recordTrade({ kind: "counter", side: "sell", how: how, find: fid, qty: size, price: q.bid, seller: pig, buyer: null, from: mv.from, to: mv.to, bid: q.bid, ask: q.ask, cost: c.cost, paidUnits: c.paidUnits, dug: c.dug, listed: offer ? offer.price : null });
			if (pig === "you" && offer) notice({ type: "crossed", trade: tr, offer: offer });
			return tr;
		}
		// Bullion sells a pig a set at his selling price; the price rises 3% of the usual price
		function settleCounterBuy(pig, fid, how, offer) {
			var q = quote(fid);
			var size = setSize(fid);
			S.coin[pig] -= q.ask;
			S.flows.counterCharged += q.ask;
			S.findFlows.counterSold += size;
			S.ledger[pig].spent += q.ask;
			S.counterDay[pig].bought += 1;
			addLot(pig, fid, size, q.ask);
			if (offer) removeOffer(offer);
			var mv = setPrice(fid, q.P + TUNING.price.impact * q.U);
			S.lastActive[idxOf(fid)] = S.tick;
			var tr = recordTrade({ kind: "counter", side: "buy", how: how, find: fid, qty: size, price: q.ask, seller: null, buyer: pig, from: mv.from, to: mv.to, bid: q.bid, ask: q.ask, listed: offer ? offer.price : null });
			if (pig === "you" && offer) notice({ type: "crossed", trade: tr, offer: offer });
			return tr;
		}
		// one pig sells another a set; the price moves a third of the way to what was paid
		function settlePig(seller, buyer, fid, price, lots, how, offer) {
			var q = quote(fid);
			var size = setSize(fid);
			S.coin[buyer] -= price;
			S.coin[seller] += price;
			S.flows.pigToPig += price;
			S.ledger[buyer].spent += price;
			S.ledger[seller].tookIn += price;
			addLot(buyer, fid, size, price);
			if (offer) removeOffer(offer);
			var c = lotsCost(lots);
			var mv = setPrice(fid, q.P + (price - q.P) * TUNING.price.pigPull);
			S.lastActive[idxOf(fid)] = S.tick;
			var tr = recordTrade({ kind: "pig", how: how, find: fid, qty: size, price: price, seller: seller, buyer: buyer, from: mv.from, to: mv.to, bid: q.bid, ask: q.ask, cost: c.cost, paidUnits: c.paidUnits, dug: c.dug, target: offer ? offer.target : null, poster: offer ? offer.pig : null });
			if (offer && offer.pig === "you") notice({ type: "filled", trade: tr, side: seller === "you" ? "sold" : "bought" });
			return tr;
		}
		function lapse(o, why) {
			removeOffer(o);
			if (o.lots) returnLots(o.pig, o.find, o.lots);
			tape("lapse", { offer: o, why: why });
			if (o.pig === "you") notice({ type: "lapsed", offer: o });
		}

		// ── Part 1: the counter ──
		// side 'buy' (the pig buys a set from Bullion) or 'sell'. limit guards the price: a buy fails
		// with price_moved if Bullion now charges more than limit, a sale if he now pays less.
		function counter(pig, fid, side, limit) {
			if (!BY_ID[fid]) return fail("unknown_find");
			if (side !== "buy" && side !== "sell") return fail("bad_side");
			var q = quote(fid);
			var size = setSize(fid);
			if (!counterOpen(pig, side)) return fail("counter_limit", { side: side });
			var tr;
			if (side === "buy") {
				if (limit != null && q.ask > limit) return fail("price_moved", { now: q.ask });
				if (S.coin[pig] < q.ask) return fail("not_enough_tickles", { ready: S.coin[pig], needed: q.ask });
				tr = settleCounterBuy(pig, fid, "counter", null);
			} else {
				if (limit != null && q.bid < limit) return fail("price_moved", { now: q.bid });
				if (count(pig, fid) < size) return fail("not_a_set", { held: count(pig, fid), set_size: size });
				tr = settleCounterSell(pig, fid, takeUnits(pig, fid, size), "counter", null);
			}
			return { ok: true, trade: tr, from: tr.from, to: tr.to };
		}

		// ── Part 2: the noticeboard ──
		// spec: {side: 'sell'|'buy'|'swap', find, price (per set, sell/buy), wantFind, wantQty (swap), target (a friend, or null)}
		// What it would do right now, without doing it.
		function previewList(pig, spec) {
			var fid = spec.find;
			var q = quote(fid);
			if (spec.side === "sell") {
				var w = bestWantedPure(pig, fid, spec.target || null, spec.price);
				if (w && (w.price >= q.bid || spec.price > q.bid)) return { fills: "pig", at: w.price, who: w.pig, offer: w, q: q };
				if (spec.price <= q.bid && counterOpen(pig, "sell")) return { fills: "counter", at: q.bid, q: q };
				return { fills: null, sits: spec.price >= q.ask, q: q };
			}
			if (spec.side === "buy") {
				var s = cheapestSale(pig, fid, spec.target || null, spec.price);
				if (s && (s.price <= q.ask || spec.price < q.ask)) return { fills: "pig", at: s.price, who: s.pig, offer: s, q: q };
				if (spec.price >= q.ask && counterOpen(pig, "buy")) return { fills: "counter", at: q.ask, q: q };
				return { fills: null, sits: spec.price <= q.bid, q: q };
			}
			return { fills: null, q: q };
		}
		function list(pig, spec) {
			var fid = spec.find;
			var side = spec.side;
			var target = spec.target || null;
			if (!BY_ID[fid]) return fail("unknown_find");
			if (side !== "sell" && side !== "buy" && side !== "swap") return fail("bad_side");
			if (target && (S.friends[pig] || []).indexOf(target) < 0) return fail("not_a_friend");
			var size = setSize(fid);
			if ((side === "sell" || side === "swap") && count(pig, fid) < size) return fail("not_a_set", { held: count(pig, fid), set_size: size });
			if (openOffers(pig).length >= TUNING.openOffers) return fail("too_many_offers");
			if (S.postsToday[pig] >= TUNING.dailyPosts) return fail("too_many_today");
			if (side === "swap") {
				var want = spec.wantFind;
				var wq = spec.wantQty;
				if (!BY_ID[want] || want === fid) return fail("bad_want");
				if (!(wq >= 1 && wq <= setSize(want)) || Math.round(wq) !== wq) return fail("bad_want", { max: setSize(want) });
				S.postsToday[pig] += 1;
				return { ok: true, filled: false, offer: post(pig, fid, "swap", null, takeUnits(pig, fid, size), target, want, wq) };
			}
			var price = spec.price;
			var b = band(fid);
			if (!(price >= b.min && price <= b.max) || Math.round(price) !== price) return fail("bad_price", { min: b.min, max: b.max });
			var q = quote(fid);
			if (side === "sell") {
				// the seller gets the better of a pig's wanted ad and Bullion (a tie goes to the pig)
				var w = bestWanted(pig, fid, target, price);
				if (w && (w.price >= q.bid || price > q.bid)) {
					S.postsToday[pig] += 1;
					return { ok: true, filled: true, via: "pig", trade: settlePig(pig, w.pig, fid, w.price, takeUnits(pig, fid, size), "wanted", w) };
				}
				if (price <= q.bid && counterOpen(pig, "sell")) {
					S.postsToday[pig] += 1;
					return { ok: true, filled: true, via: "counter", trade: settleCounterSell(pig, fid, takeUnits(pig, fid, size), "crossed", null) };
				}
				S.postsToday[pig] += 1;
				return { ok: true, filled: false, offer: post(pig, fid, "sell", price, takeUnits(pig, fid, size), target) };
			}
			// wanted: not set aside, but you need the tickles ready for all your wanted ads when you post
			if (S.coin[pig] < openBuyTotal(pig) + price) return fail("not_enough_tickles", { ready: S.coin[pig], needed: openBuyTotal(pig) + price });
			var s = cheapestSale(pig, fid, target, price);
			if (s && (s.price <= q.ask || price < q.ask)) {
				S.postsToday[pig] += 1;
				return { ok: true, filled: true, via: "pig", trade: settlePig(s.pig, pig, fid, s.price, s.lots, "listing", s) };
			}
			if (price >= q.ask && counterOpen(pig, "buy")) {
				S.postsToday[pig] += 1;
				return { ok: true, filled: true, via: "counter", trade: settleCounterBuy(pig, fid, "crossed", null) };
			}
			S.postsToday[pig] += 1;
			return { ok: true, filled: false, offer: post(pig, fid, "buy", price, null, target) };
		}
		function post(pig, fid, side, price, lots, target, wantFind, wantQty) {
			var o = { id: S.nextOfferId++, seq: S.nextSeq++, pig: pig, find: fid, side: side, price: price, qty: setSize(fid), lots: lots, target: target || null, t: S.tick, exp: S.tick + TUNING.offerTicks };
			if (side === "swap") {
				o.wantFind = wantFind;
				o.wantQty = wantQty;
			}
			S.offers.push(o);
			tape("offer", { offer: o });
			if (o.target === "you") notice({ type: "forYou", offer: o });
			return o;
		}
		function cancel(pig, offerId, quiet) {
			var o = findOffer(offerId);
			if (!o || o.pig !== pig) return fail("not_found");
			removeOffer(o);
			if (o.lots) returnLots(pig, o.find, o.lots);
			if (!quiet) tape("cancel", { offer: o });
			return { ok: true, offer_id: o.id, returned: o.lots ? "find" : "nothing", held: count(pig, o.find) };
		}
		// take a listing off the board: buy a for-sale set, fill a wanted ad, or take a swap
		function take(pig, offerId, limit) {
			var o = findOffer(offerId);
			if (!o || !visible(o, pig)) return fail("not_found");
			if (o.pig === pig) return fail("own_offer");
			var size = setSize(o.find);
			if (o.side === "sell") {
				if (limit != null && o.price > limit) return fail("price_moved", { now: o.price });
				if (S.coin[pig] < o.price) return fail("not_enough_tickles", { ready: S.coin[pig], needed: o.price });
				return { ok: true, trade: settlePig(o.pig, pig, o.find, o.price, o.lots, "listing", o) };
			}
			if (o.side === "buy") {
				if (count(pig, o.find) < size) return fail("not_a_set", { held: count(pig, o.find), set_size: size });
				if (S.coin[o.pig] < o.price) {
					lapse(o, "short");
					return fail("lapsed");
				}
				return { ok: true, trade: settlePig(pig, o.pig, o.find, o.price, takeUnits(pig, o.find, size), "wanted", o) };
			}
			// straight up: both sides move at once; no tickles; a swapped find carries no cost; the price stays put
			var held = count(pig, o.wantFind);
			if (held < o.wantQty) return fail("not_enough", { held: held, needed: o.wantQty });
			var given = takeUnits(pig, o.wantFind, o.wantQty);
			removeOffer(o);
			addLot(pig, o.find, o.qty, null);
			addLot(o.pig, o.wantFind, o.wantQty, null);
			var tr = recordTrade({
				kind: "swap",
				find: o.find,
				qty: o.qty,
				price: null,
				seller: o.pig,
				buyer: pig,
				wantFind: o.wantFind,
				wantQty: o.wantQty,
				giveVal: S.P[idxOf(o.find)],
				wantVal: (S.P[idxOf(o.wantFind)] / setSize(o.wantFind)) * o.wantQty,
				cost: lotsCost(o.lots).cost,
				gaveCost: lotsCost(given).cost,
				target: o.target,
			});
			if (o.pig === "you") notice({ type: "swapped", trade: tr });
			return { ok: true, trade: tr, held: count(pig, o.find) };
		}

		// ── the Ghost Sheep (an outlet, outside the market): one set a day per pig in this demo ──
		function sheepPrice(pig, fid) {
			var per = basePrice(fid) * (S.fancy[pig] === fid ? TUNING.fancyMultiple : 1);
			return { each: per, set: per * setSize(fid), fancy: S.fancy[pig] === fid };
		}
		function sellToSheep(pig, fid) {
			var size = setSize(fid);
			if (S.sheepDone[pig]) return fail("sheep_done");
			if (count(pig, fid) < size) return fail("not_a_set", { held: count(pig, fid), set_size: size });
			var p = sheepPrice(pig, fid).set;
			var lots = takeUnits(pig, fid, size);
			S.coin[pig] += p;
			S.flows.sheep += p;
			S.findFlows.sheepTook += size;
			S.ledger[pig].tookIn += p;
			S.ledger[pig].sheep += p;
			S.sheepDone[pig] = true;
			var c = lotsCost(lots);
			var tr = recordTrade({ kind: "sheep", find: fid, qty: size, price: p, seller: pig, buyer: null, cost: c.cost, paidUnits: c.paidUnits, dug: c.dug });
			return { ok: true, trade: tr };
		}

		// ── the simulated pigs (demo only) ──
		function value(pig, fid) {
			var f = BY_ID[fid];
			var size = setSize(fid);
			var v = S.P[f.idx] * S.mult[pig][f.idx];
			var n = count(pig, fid);
			if (S.fancy[pig] === fid && !S.sheepDone[pig] && n < size) v *= TUNING.fancyMultiple;
			else if (n >= 3 * size) v *= SIM.longAt3;
			else if (n >= 2 * size) v *= SIM.longAt2;
			return v;
		}
		function gapPrice(fid, x) {
			var q = quote(fid);
			return Math.max(q.bid + 1, Math.min(q.ask - 1, Math.round(x)));
		}
		function reserved(pig, fid) {
			return S.fancy[pig] === fid && !S.sheepDone[pig] && count(pig, fid) < 2 * setSize(fid);
		}
		// buy from whichever is cheaper: the cheapest listing it can see, or the counter (a tie goes to the pig)
		function simBuy(pig, r) {
			var finds = shuffle(r, FINDS);
			for (var i = 0; i < finds.length; i++) {
				var f = finds[i].id;
				var v = value(pig, f);
				var q = quote(f);
				var s = cheapestSale(pig, f, null, q.ask);
				var best = s ? s.price : q.ask;
				if (best >= v || S.coin[pig] < best) continue;
				if (s) return take(pig, s.id);
				if (counterOpen(pig, "buy")) return counter(pig, f, "buy", q.ask);
			}
			return null;
		}
		// sell to whichever pays more: the best wanted ad it can fill, or the counter
		function simSell(pig, r) {
			var finds = shuffle(r, FINDS);
			for (var i = 0; i < finds.length; i++) {
				var f = finds[i].id;
				if (count(pig, f) < setSize(f) || reserved(pig, f)) continue;
				var v = value(pig, f);
				var q = quote(f);
				var w = bestWanted(pig, f, null, q.bid);
				var best = w ? w.price : q.bid;
				if (best <= v) continue;
				if (w) return take(pig, w.id);
				if (counterOpen(pig, "sell")) return counter(pig, f, "sell", q.bid);
			}
			return null;
		}
		function simPostSell(pig, r, target) {
			var finds = shuffle(r, FINDS);
			for (var i = 0; i < finds.length; i++) {
				var f = finds[i].id;
				if (count(pig, f) < setSize(f) || reserved(pig, f)) continue;
				if (openOffers(pig).some(function (o) { return o.find === f && o.side === "sell"; })) continue;
				var lean = target ? uni(r, 0.9, 1.05) : uni(r, 1.0, 1.12);
				return list(pig, { side: "sell", find: f, price: gapPrice(f, value(pig, f) * lean), target: target || null });
			}
			return null;
		}
		function simPostBuy(pig, r) {
			var f = r() < 0.3 && !S.sheepDone[pig] ? S.fancy[pig] : pick(r, FINDS).id;
			if (count(pig, f) >= 2 * setSize(f)) return null;
			if (openOffers(pig).some(function (o) { return o.find === f && o.side === "buy"; })) return null;
			var p = gapPrice(f, value(pig, f) * uni(r, 0.88, 1.0));
			if (S.coin[pig] < openBuyTotal(pig) + p) return null;
			return list(pig, { side: "buy", find: f, price: p });
		}
		function simSwapPost(pig, r, target) {
			var held = FINDS.filter(function (ff) {
				return count(pig, ff.id) >= setSize(ff.id) && !reserved(pig, ff.id);
			});
			if (!held.length) return null;
			held.sort(function (a, b) {
				return value(pig, a.id) - value(pig, b.id);
			});
			var give = held[0].id;
			var want = FINDS.filter(function (ff) {
				return ff.id !== give;
			}).sort(function (a, b) {
				return value(pig, b.id) / setSize(b.id) - value(pig, a.id) / setSize(a.id);
			})[Math.floor(r() * 3)].id;
			var perWant = value(pig, want) / setSize(want);
			var q = Math.max(1, Math.min(setSize(want), Math.round((value(pig, give) / perWant) * uni(r, 0.75, 1.0))));
			return list(pig, { side: "swap", find: give, wantFind: want, wantQty: q, target: target || null });
		}
		function swapWorth(pig, o, bonus) {
			if (count(pig, o.wantFind) < o.wantQty) return false;
			var gets = value(pig, o.find) * bonus;
			var gives = (value(pig, o.wantFind) / setSize(o.wantFind)) * o.wantQty;
			return gets > gives * 1.05;
		}
		function simSwapTake(pig, r) {
			var swaps = shuffle(
				r,
				S.offers.filter(function (o) {
					return o.side === "swap" && o.pig !== pig && visible(o, pig);
				}),
			);
			for (var i = 0; i < swaps.length; i++) if (swapWorth(pig, swaps[i], 1)) return take(pig, swaps[i].id);
			return null;
		}
		// make an offer to one friend (Maya and Biscuit mostly send theirs to you)
		function simFriendOffer(pig, r) {
			var fr = S.friends[pig];
			if (!fr || !fr.length) return null;
			var target = fr.indexOf("you") >= 0 && r() < SIM.friendToYou ? "you" : pick(r, fr);
			if (target === "you" && openOffers(pig).some(function (o) { return o.target === "you"; })) return null;
			return r() < 0.6 ? simPostSell(pig, r, target) : simSwapPost(pig, r, target);
		}
		// look at what friends have sent this pig, and take what is worth it to it
		function simFriendLook(pig, r) {
			var mine = S.offers.filter(function (o) {
				return o.target === pig;
			});
			for (var i = 0; i < mine.length; i++) {
				var o = mine[i];
				if (S.offers.indexOf(o) < 0) continue;
				if (o.side === "sell" && value(pig, o.find) * SIM.friendBonus >= o.price && S.coin[pig] >= o.price) take(pig, o.id);
				else if (o.side === "buy" && count(pig, o.find) >= setSize(o.find) && !reserved(pig, o.find) && o.price * SIM.friendBonus >= value(pig, o.find)) take(pig, o.id);
				else if (o.side === "swap" && swapWorth(pig, o, SIM.friendBonus)) take(pig, o.id);
			}
		}
		function simPig(p, r) {
			var pig = p.id;
			var w = SIM.weights[p.kind === "friend" ? "friend" : "stranger"];
			var total = 0;
			for (var k in w) total += w[k];
			var x = r() * total;
			if ((x -= w.buy) < 0) return simBuy(pig, r);
			if ((x -= w.sell) < 0) return simSell(pig, r);
			var room = openOffers(pig).length < TUNING.openOffers;
			if ((x -= w.postSell) < 0) return room ? simPostSell(pig, r, null) : null;
			if ((x -= w.postBuy) < 0) return room ? simPostBuy(pig, r) : null;
			if ((x -= w.cancel) < 0) {
				var old = openOffers(pig).filter(function (o) {
					return S.tick - o.t >= 6;
				});
				return old.length ? cancel(pig, pick(r, old).id) : null;
			}
			if ((x -= w.swapPost) < 0) return room ? simSwapPost(pig, r, null) : null;
			if ((x -= w.swapTake) < 0) return simSwapTake(pig, r);
			return room ? simFriendOffer(pig, r) : null;
		}
		function dig(p, r) {
			if (r() >= SIM.digsPerDay / TUNING.ticksPerDay) return;
			var x = r();
			var rarity = x < SIM.rarityDrop.common ? "common" : x < SIM.rarityDrop.common + SIM.rarityDrop.uncommon ? "uncommon" : "rare";
			var f = pick(
				r,
				FINDS.filter(function (ff) {
					return ff.rarity === rarity;
				}),
			);
			addLot(p.id, f.id, 1, null);
			S.findFlows.dug += 1;
			S.dugByFind[f.id] = (S.dugByFind[f.id] || 0) + 1;
		}
		function simSheep(p) {
			var pig = p.id;
			if (S.sheepDone[pig] || S.tick % TUNING.ticksPerDay !== S.sheepHour[pig]) return;
			var fz = S.fancy[pig];
			if (count(pig, fz) >= setSize(fz)) {
				sellToSheep(pig, fz);
				return;
			}
			var long = FINDS.filter(function (f) {
				return count(pig, f.id) >= 3 * setSize(f.id);
			});
			if (long.length) sellToSheep(pig, long[0].id);
		}

		// ── one tick: 30 minutes ──
		function tick() {
			var noticeStart = S.notices.length;
			var tapeStart = S.nextTapeId;
			S.tick += 1;
			var t = S.tick;
			if (t % TUNING.ticksPerDay === 0) rollDay(dayOf(t));

			// 1. listings older than 24 hours lapse; a set on offer comes home
			S.offers.slice().forEach(function (o) {
				if (o.exp > t) return;
				removeOffer(o);
				if (o.lots) returnLots(o.pig, o.find, o.lots);
				tape("expire", { offer: o });
				if (o.pig === "you") notice({ type: "expired", offer: o });
			});

			// 2. quiet hours: the townsfolk's small trades wiggle the price, and it drifts home.
			//    A print on the tape is one of those small trades; its direction is the wiggle's sign.
			FINDS.forEach(function (f) {
				var r = rngFrom(seed, "wiggle", t, f.idx);
				var U = usual(f.id);
				var w = 2 * r() - 1;
				var P = S.P[f.idx];
				P += U * TUNING.price.wiggle * w;
				P += TUNING.price.home * (U - P);
				setPrice(f.id, P);
				if (r() < TUNING.printChance[f.rarity]) {
					var a = Math.floor(r() * TOWNSFOLK.length);
					var b = (a + 1 + Math.floor(r() * (TOWNSFOLK.length - 1))) % TOWNSFOLK.length;
					recordTrade({ kind: "print", dir: w >= 0 ? "up" : "down", find: f.id, qty: setSize(f.id), price: Math.round(S.P[f.idx]), seller: null, buyer: null, who: TOWNSFOLK[a], other: TOWNSFOLK[b] });
				}
			});

			// 3. the counter keeps the board honest: a resting listing at or under what Bullion pays sells
			//    to him (at his price); a wanted ad at or over what he charges buys from him (at his price)
			S.offers
				.slice()
				.sort(function (a, b) {
					return a.seq - b.seq;
				})
				.forEach(function (o) {
					if (S.offers.indexOf(o) < 0 || o.side === "swap") return;
					var q = quote(o.find);
					if (o.side === "sell" && o.price <= q.bid && counterOpen(o.pig, "sell")) settleCounterSell(o.pig, o.find, o.lots, "crossed", o);
					else if (o.side === "buy" && o.price >= q.ask && counterOpen(o.pig, "buy")) {
						if (S.coin[o.pig] < q.ask) lapse(o, "short");
						else settleCounterBuy(o.pig, o.find, "crossed", o);
					}
				});

			// 4. the other pigs (simulated) dig, trade, answer their friends and visit their Ghost Sheep
			if (simOn) {
				var order = shuffle(rngFrom(seed, "order", t), S.pigs.slice(1));
				order.forEach(function (p) {
					var r = rngFrom(seed, "pig", t, p.idx);
					dig(p, r);
					if (r() < SIM.friendLook) simFriendLook(p.id, r);
					if (r() < SIM.activity[p.kind === "friend" ? "friend" : "stranger"]) simPig(p, r);
					simSheep(p);
				});
			}

			// 5. every coin refills a tickle every other tick, up to 25 (sales may bank past it)
			if (t % TUNING.refillEvery === 0) {
				S.pigs.forEach(function (p) {
					if (S.coin[p.id] < TUNING.coinCap) {
						S.coin[p.id] += 1;
						S.flows.refill += 1;
						S.refilled[p.id] += 1;
					}
				});
			}

			FINDS.forEach(function (f) {
				sample(f.idx);
			});
			return {
				tick: t,
				notices: S.notices.slice(noticeStart),
				tape: S.tape.filter(function (e) {
					return e.id >= tapeStart;
				}),
			};
		}
		function run(n) {
			for (var i = 0; i < n; i++) tick();
		}

		// The demo's opening board: Maya undercuts the counter on pinecones, Biscuit sends you the
		// brass buttons your Sheep fancies, Maya wants snail shells (you hold six).
		function seedDemo() {
			function room(pig) {
				var mine = openOffers(pig).sort(function (a, b) {
					return a.seq - b.seq;
				});
				while (mine.length >= TUNING.openOffers) cancel(pig, mine.shift().id, true);
			}
			var out = [];
			if (!S.byPig.maya || !S.byPig.biscuit) return out;
			var qp = quote("pinecone");
			room("maya");
			topUp("maya", "pinecone", 4);
			out.push(list("maya", { side: "sell", find: "pinecone", price: qp.ask - 2 }));
			var qb = quote("brass_button");
			room("biscuit");
			topUp("biscuit", "brass_button", 4);
			out.push(list("biscuit", { side: "sell", find: "brass_button", price: Math.round((qb.bid + qb.ask) / 2), target: "you" }));
			var qs = quote("snail_shell");
			room("maya");
			if (S.coin.maya < openBuyTotal("maya") + qs.bid + 2) {
				S.offers.filter(function (o) { return o.pig === "maya" && o.side === "buy"; }).forEach(function (o) { cancel("maya", o.id, true); });
			}
			out.push(list("maya", { side: "buy", find: "snail_shell", price: qs.bid + 2 }));
			return out;
		}

		// ── reads for the page ──
		function lastTrades(fid, n, kinds) {
			var out = [];
			for (var i = S.trades.length - 1; i >= 0 && out.length < n; i--) {
				var tr = S.trades[i];
				if (fid && tr.find !== fid && tr.wantFind !== fid) continue;
				if (kinds && kinds.indexOf(tr.kind) < 0) continue;
				out.push(tr);
			}
			return out;
		}
		function boardBest(viewer, fid) {
			return { sale: salesFor(viewer, fid, null)[0] || null, wanted: bestWantedPure(viewer, fid, null, -Infinity) };
		}
		function counterRows(viewer) {
			viewer = viewer || "you";
			return FINDS.map(function (f) {
				var q = quote(f.id);
				var prev = priceAgo(f.id, TUNING.ticksPerDay);
				return {
					find: f.id,
					size: setSize(f.id),
					q: q,
					prev: prev,
					change: q.P - prev,
					spark: series(f.id, TUNING.ticksPerDay + 1),
					holding: holding(viewer, f.id),
					fancy: S.fancy[viewer] === f.id,
					board: boardBest(viewer, f.id),
					quietFor: S.tick - S.lastActive[f.idx],
				};
			});
		}
		function findView(fid, viewer) {
			viewer = viewer || "you";
			var q = quote(fid);
			var prev = priceAgo(fid, TUNING.ticksPerDay);
			var hist = series(fid, 2 * TUNING.ticksPerDay + 1);
			var t0 = hist.length ? hist[0].t : S.tick;
			return {
				find: fid,
				size: setSize(fid),
				q: q,
				prev: prev,
				change: q.P - prev,
				hist: hist,
				marks: S.trades.filter(function (tr) {
					return tr.find === fid && tr.t >= t0 && (tr.kind === "counter" || tr.kind === "pig" || tr.kind === "print");
				}),
				recent: lastTrades(fid, 10, ["counter", "pig", "swap", "print"]),
				holding: holding(viewer, fid),
				sheep: sheepPrice(viewer, fid),
				board: boardBest(viewer, fid),
				mine: S.offers.filter(function (o) {
					return o.pig === viewer && (o.find === fid || o.wantFind === fid);
				}),
				quietFor: S.tick - S.lastActive[idxOf(fid)],
				today: (S.dayStats[dayOf(S.tick)] || {})[fid] || null,
			};
		}
		// every listing this pig can see (not its own), with how it compares to the price
		function boardView(viewer) {
			viewer = viewer || "you";
			return S.offers
				.filter(function (o) {
					return o.pig !== viewer && visible(o, viewer);
				})
				.map(function (o) {
					var q = quote(o.find);
					var card = { offer: o, q: q, forYou: o.target === viewer };
					if (o.side === "swap") {
						card.giveVal = q.P;
						card.wantVal = (S.P[idxOf(o.wantFind)] / setSize(o.wantFind)) * o.wantQty;
					} else card.vs = vsPrice(o.price, q.P);
					return card;
				})
				.sort(function (a, b) {
					return (b.forYou ? 1 : 0) - (a.forYou ? 1 : 0) || b.offer.seq - a.offer.seq;
				});
		}
		function drainNotices() {
			var n = S.notices;
			S.notices = [];
			return n;
		}
		function totalCoin() {
			var t = 0;
			for (var k in S.coin) t += S.coin[k];
			return t;
		}
		function totalFinds() {
			var t = 0;
			S.pigs.forEach(function (p) {
				FINDS.forEach(function (f) {
					t += count(p.id, f.id);
				});
			});
			S.offers.forEach(function (o) {
				if (o.lots)
					o.lots.forEach(function (l) {
						t += l.n;
					});
			});
			return t;
		}
		function whoName(pig, viewer) {
			viewer = viewer || "you";
			if (pig == null) return null;
			if (pig === viewer) return "you";
			var p = S.byPig[pig];
			return p ? p.name : pig;
		}

		return {
			state: S,
			initialCoin: initialCoin,
			startFinds: startFinds,
			tick: tick,
			run: run,
			seedDemo: seedDemo,
			clock: clock,
			dayOf: dayOf,
			quote: quote,
			counterOpen: counterOpen,
			previewCounter: previewCounter,
			previewPig: previewPig,
			previewList: previewList,
			counter: counter,
			list: list,
			take: take,
			cancel: cancel,
			sellToSheep: sellToSheep,
			sheepPrice: sheepPrice,
			counterRows: counterRows,
			findView: findView,
			boardView: boardView,
			boardBest: boardBest,
			priceAgo: priceAgo,
			series: series,
			holding: holding,
			count: count,
			lastTrades: lastTrades,
			drainNotices: drainNotices,
			totalCoin: totalCoin,
			totalFinds: totalFinds,
			whoName: whoName,
			openOffers: openOffers,
			openBuyTotal: openBuyTotal,
			findOffer: findOffer,
			visible: visible,
		};
	}

	return {
		create: create,
		FINDS: FINDS,
		BY_ID: BY_ID,
		TUNING: TUNING,
		SIM: SIM,
		TOWNSFOLK: TOWNSFOLK,
		setSize: setSize,
		basePrice: basePrice,
		usual: usual,
		priceLo: priceLo,
		priceHi: priceHi,
		clampPrice: clampPrice,
		askAt: askAt,
		bidAt: bidAt,
		band: band,
		fmtPrice: fmtPrice,
		vsPrice: vsPrice,
		gainWord: gainWord,
		eachWord: eachWord,
	};
});
