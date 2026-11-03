#!/usr/bin/env python3
"""Agent-based balance run for Bullion's Market (docs/design/market-2026-10-31/).

Simulates whole populations of real pigs (30 / 150 / 600 daily players) at the market's
own 30-minute tick, from a Season-2 fresh start (empty bank, empty Satchel), with the
SHIPPED rules unless a lever says otherwise:

  market   20261031100000_bullions_market.sql + 20261031110000 + 20261101150000_bullion_board.sql
           U = Sheep price x set size; P in [lo U, hi U]; Bullion sells max(U+1, ceil(sf P)),
           buys min(U, floor(bf P)); +-impact U per counter set; a pig sale pulls P pig_pull of
           the way; per tick P += U wiggle (2r-1) then P += home (U - P); listings cross the
           counter; 4 open, 24 h; Bullion's shelf: n sets per UTC day at the integer midpoint.
  sheep    20260917170000 + 20260920100000 + 20261029210000: one 6 h visit per pig per local
           day, arrival uniform in [08, 16] local; 3 / 8 / 20 count per find; his fancy x2
           (seeded unit x 70/25/5, never yesterday's: in practice always a common); a pair in
           one visit pays half again; 9 finds a visit. Pays the COUNT, never bank or snouts.
  finds    a dig drops 0/1/2 at 30/50/20 %, rarity 70/25/5, uniform inside a rarity
           (8 commons, 3 uncommons, the tin whistle); one dig per 8 h feeding (local 05/13/21).
  bank     regen 1/h to the cap (25, 50 for Slop Club); sales may bank past it; a tap turns
           one bank tickle into one count + one snout.
  swaps    friend wishes (70/25/5, 48 h), one swap per pair per day, 3 count + 3 snouts each.

Pigs: casual (1 session/day), regular (3), engaged (7), waking 07-23 local, US time zones.
~2 player-friends each. A share of pigs use the market (`--adoption`); each pig values a
bank tickle at `bw` count (a mix: 1.0 "a tickle is a tickle", 1.5, 2.0 "a bank tickle is a
count AND a snout"). Market policies (all greedy, ex-ante, in the pig's own worth):
  * a complete set goes to the best of: the Sheep now, Bullion's counter, the best wanted ad,
    a listing inside Bullion's gap (patient pigs; expected value uses the live fill rate),
    the Sheep later today (if the pig will be on while he is here), or hold (price is low and
    wanders home);
  * the Sheep loop: while he is here, buy a set from the cheapest source (shelf, board, counter)
    whenever handing it to him pays more count than the bank it cost is worth to the pig;
  * engaged pigs post a wanted ad at the midpoint for his fancy instead of paying the ask;
  * collectors buy (or post wanted ads for) a set of any find they have never held;
  * patient pigs with a spare set and one short of another post a straight-up swap; pigs
    holding spares take swaps that complete nothing they would lose;
  * pigs that can wait keep a bank reserve for the loop; everyone taps the rest.

Prints answers to the balance questions per population and a fun scorecard. Every number is a
model output under stated assumptions, not a measurement. Rerun after any tuning change.

  python3 tools/balance_market.py                      # shipped tuning, 30/150/600, 28 days
  python3 tools/balance_market.py --tuning proposed    # the 2026-11-02 balance-pass proposal
  python3 tools/balance_market.py --compare            # shipped vs proposed vs no market
  python3 tools/balance_market.py --set set_size.c=3 --set wiggle=0.02 --pops 30
  python3 tools/balance_market.py --sweep              # every lever variant + robustness table
"""
from __future__ import annotations

import argparse
import bisect
import copy
import hashlib
import json
import math
import random
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass, field

# ── The world ────────────────────────────────────────────────────────────────
FINDS = [
	("river_pebble", "c"), ("blue_feather", "c"), ("clover", "c"), ("snail_shell", "c"),
	("brass_button", "c"), ("wool_tuft", "c"), ("red_berries", "c"), ("pinecone", "c"),
	("old_key", "u"), ("honeycomb", "u"), ("marble", "u"), ("tin_whistle", "r"),
]
NF = len(FINDS)
RAR = [r for _, r in FINDS]
BY_RAR = {r: [i for i in range(NF) if RAR[i] == r] for r in "cur"}
RNAME = {"c": "common", "u": "uncommon", "r": "rare"}
TPD = 48  # ticks a day (30 min)
TIERS = {"casual": 1, "regular": 3, "engaged": 7}
TIER_MIX = {"casual": 0.50, "regular": 0.35, "engaged": 0.15}
PATIENT = {"casual": 0.4, "regular": 0.7, "engaged": 0.9}
TZ_MIX = [(-5, 0.40), (-6, 0.25), (-7, 0.10), (-8, 0.25)]

SHIPPED = {
	# market_tuning
	"set_size": {"c": 4, "u": 3, "r": 3},
	"lo": 0.85, "hi": 1.15, "sell_factor": 1.2, "buy_factor": 0.8,
	"impact": 0.03, "pig_pull": 1 / 3, "wiggle": 0.01, "home": 0.05,
	"list_multiple": 3, "open_offers": 4, "daily_posts": 30, "offer_hours": 24,
	"counter_caps": None,            # (sell, buy) per pig per UTC day, or None
	"shelf_n": 3,                    # bullion_board.daily_listings
	"shelf_quote": "mid",            # "mid" (shipped) | "ask-1"
	"shelf_per_pig": None,           # NEW RULE (code): shelf sets one pig may take a UTC day
	"shelf_mode": "global",          # "global" (shipped: one shared stock) | "per_pig" (NEW: each pig its own)
	"board_window": 120,             # market_state shows the newest 120 listings
	# outside the market (trader_tuning, satchel_tuning, the bank)
	"sheep_prices": {"c": 3, "u": 8, "r": 20},
	"want_mult": 2.0, "pair_mult": 1.5, "per_visit": 9, "stay_h": 6.0, "window": (8.0, 22.0),
	"fancy_found_only": False,       # NEW RULE (code): his x2 only on finds you did not buy
	"bought_no_pair": False,         # NEW RULE (code, tested, not proposed): bought finds pay his base only
	"find_odds": (0.30, 0.50, 0.20), "rarity_w": {"c": 70, "u": 25, "r": 5},
	"bank_cap": 25, "vip_cap": 50, "regen_h": 1.0,
	"swap_tickles": 3,
}

# The 2026-11-02 balance pass (docs/design/market-2026-10-31/balance-pass-2026-11-02.md).
PROPOSED = copy.deepcopy(SHIPPED)
PROPOSED.update({
	"set_size": {"c": 3, "u": 2, "r": 1},   # market_tuning.set_size
	"impact": 0.05,                          # market_tuning.price.impact
	"wiggle": 0.02,                          # market_tuning.price.wiggle
	"offer_hours": 48,                       # market_tuning.offer_hours
	"fancy_found_only": True,                # OUTSIDE the market: trade_with_trader's x2 skips source 'market'
})

TUNINGS = {"shipped": SHIPPED, "proposed": PROPOSED}


def unit(key: str) -> float:
	"""The server's seeded unit: first 32 bits of md5(key) / 2^32."""
	return int(hashlib.md5(key.encode()).hexdigest()[:8], 16) / 4294967296.0


# ── Agents ───────────────────────────────────────────────────────────────────
@dataclass
class Listing:
	id: int
	pig: int
	f: int
	side: str           # sell | buy | swap
	price: int | None
	created: int
	expires: int
	esc_found: int = 0
	esc_bought: int = 0
	want_f: int | None = None
	want_qty: int = 0
	status: str = "open"
	closed: int | None = None
	purpose: str | None = None   # "sheep": a wanted ad for today's fancy
	visit: object = None


@dataclass
class Visit:
	arr_t: int
	leave_t: int
	fancy: int
	sold: int = 0
	unpaired: dict = field(default_factory=dict)
	caught: bool = False
	loop_gain: float = 0.0
	loop_cost: int = 0
	loop_sets: int = 0
	count_own: int = 0
	count_bought: int = 0


@dataclass
class Pig:
	i: int
	tier: str
	tz: int
	vip: bool
	bw: float
	market: bool
	patient: bool
	collector: bool
	friends: list = field(default_factory=list)
	found: list = field(default_factory=lambda: [0] * NF)
	bought: list = field(default_factory=lambda: [0] * NF)
	cum: list = field(default_factory=lambda: [0] * NF)   # hoard basis: every find this pig ever dug
	bank: float = 0.0
	last_h: float = 0.0
	count: float = 0.0
	snouts: float = 0.0
	wasted: float = 0.0
	met: set = field(default_factory=set)
	wish: int = 0
	wish_t: int = 0
	swapped: dict = field(default_factory=dict)
	dug: set = field(default_factory=set)
	visits: dict = field(default_factory=dict)
	sessions: list = field(default_factory=list)
	spent: int = 0
	took: int = 0
	first_set: dict = field(default_factory=dict)       # rarity -> tick (held, own finds)
	first_set_hoard: dict = field(default_factory=dict)
	counter_today: dict = field(default_factory=dict)   # (day, side) -> n
	shelf_today: dict = field(default_factory=dict)     # day -> n
	pshelf: dict = field(default_factory=dict)          # day -> own shelf slots (per_pig mode)
	posts_today: dict = field(default_factory=dict)
	last_open_t: int = -1
	last_open_prices: tuple | None = None
	open_ids: set = field(default_factory=set)
	closed_ts: list = field(default_factory=list)

	def held(self, f: int) -> int:
		return self.found[f] + self.bought[f]


class Market:
	def __init__(self, T: dict, n: int, days: int, seed: int, adoption: float, bw_mix, collectors: float,
	             friend_degree: float, vip_share: float, market_on: bool, min_profit: float):
		self.T = T
		self.days = days
		self.n_ticks = days * TPD
		self.rng = random.Random(seed)
		self.seed = seed
		self.market_on = market_on
		self.min_profit = min_profit
		rng = self.rng
		self.U = [T["sheep_prices"][r] * T["set_size"][r] for r in RAR]
		self.S = [T["set_size"][r] for r in RAR]
		self.P = [self.U[f] * (0.97 + 0.06 * unit(f"p0:{FINDS[f][0]}:{seed}")) for f in range(NF)]
		self.P = [self.clamp(f, p) for f, p in enumerate(self.P)]
		self.listings: dict[int, Listing] = {}
		self.open_by_f: dict[int, list[int]] = defaultdict(list)
		self.next_id = 1
		self.shelf: list[dict] = []            # global shelf slots
		self.created_ts: list[int] = []        # every listing's tick, in post order
		self._ver = 0
		self._cache_ver = -1
		self._cache_sorted: list[int] = []
		# metrics
		self.m = defaultdict(float)
		self.trades: list[dict] = []
		self.decisions: list[tuple] = []
		self.loop_days: list[dict] = []
		self.price_log = [[] for _ in range(NF)]
		self.ask_log = [[] for _ in range(NF)]
		self.bid_log = [[] for _ in range(NF)]
		self.vis_samples: list[tuple] = []
		self.news_samples: list[tuple] = []
		self.daily = defaultdict(lambda: defaultdict(float))   # day -> key -> sum
		self.fill_hist = {r: [4.0 * 0.5, 4.0] for r in "cur"}   # [filled, resolved] prior 0.5 (weight 4)
		self.swap_fill_hist = [2.0, 4.0]
		# pigs
		self.pigs: list[Pig] = []
		tiers = list(TIER_MIX)
		for i in range(n):
			tier = rng.choices(tiers, [TIER_MIX[t] for t in tiers])[0]
			tz = rng.choices([z for z, _ in TZ_MIX], [w for _, w in TZ_MIX])[0]
			bw = rng.choices([b for b, _ in bw_mix], [w for _, w in bw_mix])[0]
			mk = market_on and rng.random() < adoption
			p = Pig(i=i, tier=tier, tz=tz, vip=rng.random() < vip_share, bw=bw, market=mk,
			        patient=rng.random() < PATIENT[tier], collector=mk and rng.random() < collectors)
			p.wish = self.roll_find(rng)
			self.pigs.append(p)
		# friends: each pig links to Poisson(degree/2) others (mean degree ~ friend_degree)
		for p in self.pigs:
			k = self.poisson(friend_degree / 2)
			for _ in range(k):
				q = rng.randrange(n)
				if q != p.i and q not in p.friends:
					p.friends.append(q)
					self.pigs[q].friends.append(p.i)
		# sessions: per local day, uniform in [7, 23) local, as global ticks
		self.sched: dict[int, list[int]] = defaultdict(list)
		for p in self.pigs:
			for L in range(-1, days + 1):
				for _ in range(TIERS[p.tier]):
					h = L * 24 + rng.uniform(7, 23) - p.tz
					t = int(h * 2)
					if 0 <= t < self.n_ticks:
						self.sched[t].append(p.i)
						p.sessions.append(t)
			p.sessions.sort()

	# ── helpers ──
	def poisson(self, lam: float) -> int:
		L, k, pr = math.exp(-lam), 0, 1.0
		while True:
			pr *= self.rng.random()
			if pr < L:
				return k
			k += 1

	def roll_find(self, rng) -> int:
		w = self.T["rarity_w"]
		r = rng.choices("cur", [w["c"], w["u"], w["r"]])[0]
		return rng.choice(BY_RAR[r])

	def clamp(self, f: int, p: float) -> float:
		u = self.U[f]
		return max(self.T["lo"] * u, min(self.T["hi"] * u, p))

	def ask(self, f: int, p: float | None = None) -> int:
		p = self.P[f] if p is None else p
		return max(self.U[f] + 1, math.ceil(self.T["sell_factor"] * p - 1e-9))

	def bid(self, f: int, p: float | None = None) -> int:
		p = self.P[f] if p is None else p
		return min(self.U[f], math.floor(self.T["buy_factor"] * p + 1e-9))

	def mid(self, f: int) -> int:
		return (self.ask(f) + self.bid(f)) // 2

	def day(self, t: int) -> int:
		return t // TPD

	def local_day(self, p: Pig, t: int) -> int:
		return math.floor((t / 2 + p.tz) / 24)

	def settle(self, p: Pig, t: int) -> None:
		h = t / 2
		dt = max(0.0, h - p.last_h)
		cap = self.T["vip_cap"] if p.vip else self.T["bank_cap"]
		rate = self.T["regen_h"]
		if p.bank < cap:
			gain = min(cap - p.bank, rate * dt)
		else:
			gain = 0.0
		p.bank += gain
		p.wasted += rate * dt - gain
		self.daily[self.day(t)]["regen"] += gain
		self.daily[self.day(t)]["wasted"] += rate * dt - gain
		p.last_h = h

	def note_met(self, p: Pig, f: int, t: int) -> None:
		p.met.add(f)

	def check_first_set(self, p: Pig, t: int) -> None:
		for f in range(NF):
			r = RAR[f]
			if r not in p.first_set and p.found[f] >= self.S[f]:
				p.first_set[r] = t
			if r not in p.first_set_hoard and p.cum[f] >= self.S[f]:
				p.first_set_hoard[r] = t

	# take n units out of a bag: bought first (the server takes newest first)
	def take_units(self, p: Pig, f: int, n: int) -> tuple[int, int]:
		b = min(p.bought[f], n)
		p.bought[f] -= b
		fo = n - b
		assert p.found[f] >= fo, "bag underflow"
		p.found[f] -= fo
		return fo, b

	# ── the Sheep ──
	def visit_for(self, p: Pig, L: int) -> Visit:
		v = p.visits.get(L)
		if v is not None:
			return v
		T = self.T
		lo, hi = T["window"]
		span = max(0.0, hi - T["stay_h"] - lo)
		at = lo + span * unit(f"{self.seed}:{p.i}:{L}:arrival")
		arr_h = L * 24 + at - p.tz
		fancy = self.want_for(p, L, self.want_for(p, L - 1, None))
		v = Visit(arr_t=int(math.ceil(arr_h * 2)), leave_t=int(math.ceil((arr_h + T["stay_h"]) * 2)), fancy=fancy)
		p.visits[L] = v
		return v

	def want_for(self, p: Pig, L: int, not_f: int | None) -> int:
		# ORDER BY unit(user:day:find) * weight DESC: in practice always a common
		w = {"c": 70, "u": 25, "r": 5}
		best, bv = 0, -1.0
		for f in range(NF):
			if f == not_f:
				continue
			s = unit(f"{self.seed}:{p.i}:{L}:{FINDS[f][0]}") * w[RAR[f]]
			if s > bv:
				best, bv = f, s
		return best

	def present_visit(self, p: Pig, t: int) -> Visit | None:
		for L in (self.local_day(p, t), self.local_day(p, t) - 1):
			v = self.visit_for(p, L)
			if v.arr_t <= t < v.leave_t:
				return v
		return None

	def later_visit(self, p: Pig, t: int) -> Visit | None:
		"""Today's visit if he has not arrived yet and the pig has a session inside it."""
		v = self.visit_for(p, self.local_day(p, t))
		if v.arr_t > t and any(v.arr_t <= s < v.leave_t for s in p.sessions):
			return v
		return None

	def sheep_price(self, v: Visit, f: int, bought_unit: bool) -> int:
		base = self.T["sheep_prices"][RAR[f]]
		if bought_unit and self.T["bought_no_pair"]:
			return base
		if f == v.fancy and not (bought_unit and self.T["fancy_found_only"]):
			return int(math.floor(base * self.T["want_mult"]))
		return base

	def sheep_pay(self, v: Visit, f: int, units: list[bool]) -> tuple[int, int | None]:
		"""Count paid for handing `units` (True = a bought unit) of f now, and the new unpaired."""
		tot, unp = 0, v.unpaired.get(f)
		pm = self.T["pair_mult"]
		for b in units:
			price = self.sheep_price(v, f, b)
			bonus = 0
			if b and self.T["bought_no_pair"]:
				tot += price
				continue
			if pm > 1 and unp is not None:
				bonus = int(math.floor((unp + price) * (pm - 1)))
				unp = None
			else:
				unp = price
			tot += price + bonus
		return tot, unp

	def hand_order(self, v: Visit, p: Pig, f: int, n_found: int, n_bought: int) -> list[bool]:
		# found units first when his x2 is for found finds only
		return [False] * n_found + [True] * n_bought

	def hand(self, p: Pig, v: Visit, f: int, n_found: int, n_bought: int, t: int, why: str) -> int:
		units = self.hand_order(v, p, f, n_found, n_bought)
		d = self.daily[self.day(t)]
		total = 0
		for b in units:  # one tap per find, as the sheet does: attribute each unit's pay
			pay, unp = self.sheep_pay(v, f, [b])
			v.unpaired[f] = unp
			total += pay
			if b:
				v.count_bought += pay
				d["sheep_count_bought"] += pay
			else:
				v.count_own += pay
		p.found[f] -= n_found
		p.bought[f] -= n_bought
		assert p.found[f] >= 0 and p.bought[f] >= 0
		v.sold += n_found + n_bought
		p.count += total
		d["sheep_count"] += total
		d["sheep_units"] += n_found + n_bought
		return total

	# ── board ──
	def sorted_open(self) -> list[int]:
		if self._cache_ver != self._ver:
			self._cache_sorted = sorted(self.listings_open_ids(), reverse=True)
			self._cache_ver = self._ver
		return self._cache_sorted

	def visible(self, p: Pig, side: str, f: int | None = None) -> list[Listing]:
		"""The board a pig browses: the newest board_window open listings that are not its own
		(market_state cuts 120 candidates, then hides wanted ads their pig can't pay)."""
		out, seen = [], 0
		for lid in self.sorted_open():
			o = self.listings[lid]
			if o.pig == p.i:
				continue
			seen += 1
			if seen > self.T["board_window"]:
				break
			if o.side != side or (f is not None and o.f != f):
				continue
			if side == "buy" and self.pigs[o.pig].bank < (o.price or 0):
				continue
			out.append(o)
		return out

	def listings_open_ids(self) -> list[int]:
		return [lid for ids in self.open_by_f.values() for lid in ids]

	def open_listings_of(self, p: Pig) -> list[Listing]:
		return [self.listings[lid] for lid in p.open_ids]

	def post(self, p: Pig, t: int, side: str, f: int, price: int | None, n_found=0, n_bought=0,
	         want_f=None, want_qty=0) -> Listing:
		o = Listing(id=self.next_id, pig=p.i, f=f, side=side, price=price, created=t,
		            expires=t + int(self.T["offer_hours"] * 2), esc_found=n_found, esc_bought=n_bought,
		            want_f=want_f, want_qty=want_qty)
		self.next_id += 1
		self.listings[o.id] = o
		self.open_by_f[f].append(o.id)
		p.open_ids.add(o.id)
		self.created_ts.append(t)
		self._ver += 1
		p.posts_today[self.day(t)] = p.posts_today.get(self.day(t), 0) + 1
		self.daily[self.day(t)]["posts_" + side] += 1
		return o

	def close(self, o: Listing, status: str, t: int) -> None:
		o.status = status
		o.closed = t
		self.open_by_f[o.f].remove(o.id)
		self._ver += 1
		p = self.pigs[o.pig]
		p.open_ids.discard(o.id)
		p.closed_ts.append(t)
		if o.purpose == "sheep" and status == "filled" and o.visit is not None:
			o.visit.loop_cost += o.price
			o.visit.loop_sets += 1
		if status in ("expired", "cancelled") and o.side in ("sell", "swap"):
			p.found[o.f] += o.esc_found
			p.bought[o.f] += o.esc_bought
		if o.side == "sell" and status in ("filled", "crossed", "expired"):
			h = self.fill_hist[RAR[o.f]]
			h[0] += 1 if status == "filled" else 0
			h[1] += 1
		if o.side == "swap" and status in ("filled", "expired"):
			self.swap_fill_hist[0] += 1 if status == "filled" else 0
			self.swap_fill_hist[1] += 1

	def fill_est(self, f: int) -> float:
		h = self.fill_hist[RAR[f]]
		return h[0] / h[1]

	def can_post(self, p: Pig, t: int) -> bool:
		return (len(self.open_listings_of(p)) < self.T["open_offers"]
		        and p.posts_today.get(self.day(t), 0) < self.T["daily_posts"])

	def counter_open(self, p: Pig, side: str, t: int) -> bool:
		caps = self.T["counter_caps"]
		if not caps:
			return True
		cap = caps[0] if side == "sell" else caps[1]
		if cap is None:
			return True
		return p.counter_today.get((self.day(t), side), 0) < cap

	# ── settlement ──
	def record(self, kind: str, side: str | None, f: int, price: int, t: int, before: float, how: str,
	           seller=None, buyer=None) -> None:
		a0, b0 = self.ask(f, before), self.bid(f, before)
		a1, b1 = self.ask(f), self.bid(f)
		self.trades.append({"kind": kind, "side": side, "f": f, "price": price, "t": t, "how": how,
		                    "ask_moved": a0 != a1, "bid_moved": b0 != b1, "dp": self.P[f] - before,
		                    "seller": seller, "buyer": buyer})

	def counter_sell(self, p: Pig, f: int, t: int, how: str, n_found=None, n_bought=None) -> int:
		"""Bullion buys a set. Units already out of the bag when n_found/n_bought are given."""
		s = self.S[f]
		if n_found is None:
			self.take_units(p, f, s)
		b = self.bid(f)
		self.settle(p, t)
		p.bank += b
		p.took += b
		before = self.P[f]
		self.P[f] = self.clamp(f, self.P[f] - self.T["impact"] * self.U[f])
		p.counter_today[(self.day(t), "sell")] = p.counter_today.get((self.day(t), "sell"), 0) + 1
		d = self.daily[self.day(t)]
		d["bank_in_counter"] += b
		d["finds_bullion_bought"] += s
		self.record("counter", "sell", f, b, t, before, how, seller=p.i)
		return b

	def counter_buy(self, p: Pig, f: int, t: int, how: str, price: int | None = None) -> int:
		s = self.S[f]
		a = self.ask(f) if price is None else price
		self.settle(p, t)
		assert p.bank + 1e-9 >= a
		p.bank -= a
		p.spent += a
		p.bought[f] += s
		self.note_met(p, f, t)
		before = self.P[f]
		self.P[f] = self.clamp(f, self.P[f] + self.T["impact"] * self.U[f])
		p.counter_today[(self.day(t), "buy")] = p.counter_today.get((self.day(t), "buy"), 0) + 1
		d = self.daily[self.day(t)]
		d["bank_out_" + ("shelf" if how == "shelf" else "counter")] += a
		d["finds_bullion_sold"] += s
		self.record("counter", "buy", f, a, t, before, how, buyer=p.i)
		return a

	def pig_sale(self, seller: Pig, buyer: Pig, f: int, price: int, t: int, how: str) -> None:
		s = self.S[f]
		self.settle(buyer, t)
		self.settle(seller, t)
		buyer.bank -= price
		buyer.spent += price
		seller.bank += price
		seller.took += price
		buyer.bought[f] += s
		self.note_met(buyer, f, t)
		before = self.P[f]
		self.P[f] = self.clamp(f, self.P[f] + (price - self.P[f]) * self.T["pig_pull"])
		d = self.daily[self.day(t)]
		d["bank_pig_to_pig"] += price
		d["pig_trades"] += 1
		self.record("pig", None, f, price, t, before, how, seller=seller.i, buyer=buyer.i)

	# ── the tick ──
	def walk(self, t: int) -> None:
		T = self.T
		for f in range(NF):
			u = self.U[f]
			p = self.P[f] + u * T["wiggle"] * (2 * self.rng.random() - 1)
			p = p + T["home"] * (u - p)
			self.P[f] = self.clamp(f, p)
			self.price_log[f].append(self.P[f])
			self.ask_log[f].append(self.ask(f))
			self.bid_log[f].append(self.bid(f))

	def advance(self, t: int) -> None:
		# expiry
		for lid in list(self.listings_open_ids()):
			o = self.listings[lid]
			if o.expires <= t:
				self.close(o, "expired", t)
				self.daily[self.day(t)]["expired_" + o.side] += 1
		# the counter keeps the board honest
		for lid in sorted(self.listings_open_ids()):
			o = self.listings.get(lid)
			if o is None or o.status != "open":
				continue
			p = self.pigs[o.pig]
			if o.side == "sell" and o.price <= self.bid(o.f) and self.counter_open(p, "sell", t):
				self.close(o, "crossed", t)
				self.counter_sell(p, o.f, t, "crossed", o.esc_found, o.esc_bought)
			elif o.side == "buy" and o.price >= self.ask(o.f) and self.counter_open(p, "buy", t):
				self.settle(p, t)
				if p.bank < self.ask(o.f):
					self.close(o, "lapsed", t)
				else:
					self.close(o, "crossed", t)
					self.counter_buy(p, o.f, t, "crossed")
		# Bullion's shelf at UTC midnight
		if t % TPD == 0 and self.market_on and self.T["shelf_n"] > 0 and self.T["shelf_mode"] == "global":
			for slot in self.shelf:
				if slot["sold"] is None:
					self.daily[self.day(t) - 1]["shelf_unsold"] += 1
			fs = self.rng.sample(range(NF), min(NF, self.T["shelf_n"]))
			self.shelf = [{"f": f, "t0": t, "sold": None, "buyer": None} for f in fs]
			self.m["shelf_slots"] += len(fs)

	def get_shelf(self, p: Pig, t: int) -> list[dict]:
		if self.T["shelf_mode"] != "per_pig":
			return self.shelf
		dd = self.day(t)
		if dd not in p.pshelf:
			fs = self.rng.sample(range(NF), min(NF, self.T["shelf_n"]))
			p.pshelf[dd] = [{"f": f, "t0": dd * TPD, "sold": None, "buyer": None} for f in fs]
			self.m["shelf_slots"] += len(fs)
		return p.pshelf[dd]

	def shelf_quote(self, f: int) -> int | None:
		a, b = self.ask(f), self.bid(f)
		if a - b < 2:
			return None
		if self.T["shelf_quote"] == "ask-1":
			return a - 1
		return (a + b) // 2

	# ── one pig's session ──
	def session(self, p: Pig, t: int) -> None:
		T = self.T
		self.settle(p, t)
		d = self.daily[self.day(t)]
		d["sessions"] += 1
		# dig: one per 8 h feeding, anchored at local 05:00
		lh = t / 2 + p.tz
		feed = math.floor((lh - 5) / 8)
		if feed not in p.dug:
			p.dug.add(feed)
			n = self.rng.choices([0, 1, 2], T["find_odds"])[0]
			for _ in range(n):
				f = self.roll_find(self.rng)
				p.found[f] += 1
				p.cum[f] += 1
				self.note_met(p, f, t)
			d["digs"] += 1
			d["finds_dug"] += n
		self.check_first_set(p, t)
		v = self.present_visit(p, t)
		if v is not None and not v.caught:
			v.caught = True
			d["sheep_caught"] += 1
		if p.market:
			self.cancel_stale(p, t, v)
			self.market_open(p, t)
			self.set_decisions(p, t, v)
		if v is not None:
			self.sheep_partials(p, t, v)
			if p.market:
				self.sheep_loop(p, t, v)
		if p.market:
			self.other_buys(p, t)
			self.take_swaps(p, t)
		self.friend_swaps(p, t)
		self.tap(p, t)

	def market_open(self, p: Pig, t: int) -> None:
		# what a pig sees when it opens the market: listings per find, news since last time
		vis_sell = Counter(o.f for o in self.visible(p, "sell"))
		vis_buy = Counter(o.f for o in self.visible(p, "buy"))
		self.vis_samples.append((sum(vis_sell.values()), sum(vis_buy.values()),
		                         sum(1 for f in range(NF) if vis_sell[f] or vis_buy[f])))
		prices = tuple((self.ask(f), self.bid(f)) for f in range(NF))
		if p.last_open_t >= 0:
			new_lists = len(self.created_ts) - bisect.bisect_right(self.created_ts, p.last_open_t)
			moved = sum(1 for f in range(NF) if prices[f] != p.last_open_prices[f])
			mine = len(p.closed_ts) - bisect.bisect_right(p.closed_ts, p.last_open_t)
			self.news_samples.append((new_lists, moved, mine))
		p.last_open_t = t
		p.last_open_prices = prices
		self.daily[self.day(t)]["market_opens"] += 1

	def market_unit_worth(self, p: Pig, f: int) -> float:
		"""What one unit of a find is worth to this pig on the market, at the live midpoint."""
		return p.bw * self.mid(f) / self.S[f]

	def sheep_unit_worth(self, f: int, fancied: bool) -> float:
		base = self.T["sheep_prices"][RAR[f]]
		pm = self.T["pair_mult"]
		return base * (self.T["want_mult"] if fancied else 1) * pm  # sold in pairs: half again

	def list_price(self, p: Pig, f: int) -> int:
		a, b = self.ask(f), self.bid(f)
		lo, hi = b + 1, a - 1
		if hi < lo:
			return a
		cheapest = min((o.price for o in self.visible(p, "sell", f)), default=None)
		L = lo + round((hi - lo) * self.rng.uniform(0.35, 1.0))
		if cheapest is not None and cheapest - 1 >= lo:
			L = min(L, cheapest - 1)
		return max(lo, min(hi, L))

	def set_decisions(self, p: Pig, t: int, v: Visit | None) -> None:
		"""Every complete set the pig holds: Sheep now / counter / board / list / Sheep later / hold."""
		later = self.later_visit(p, t) if v is None else None
		for f in sorted(range(NF), key=lambda f: -self.U[f]):
			s = self.S[f]
			guard = 0
			while p.held(f) >= s and guard < 6:
				guard += 1
				opts = {}
				b = self.bid(f)
				if self.counter_open(p, "sell", t):
					opts["counter"] = p.bw * b
				wanted = [o for o in self.all_open(f, "buy") if o.pig != p.i
				          and self.pigs[o.pig].bank >= o.price and o.price > b]
				best_w = max(wanted, key=lambda o: (o.price, -o.id), default=None)
				if best_w is not None:
					opts["board_now"] = p.bw * best_w.price
				L = None
				if p.patient and self.can_post(p, t):
					L = self.list_price(p, f)
					fe = self.fill_est(f)
					opts["list"] = p.bw * (fe * L + (1 - fe) * b)
				if v is not None and self.T["per_visit"] - v.sold >= s:
					nb = min(p.bought[f], s)
					units = self.hand_order(v, p, f, s - nb, nb)
					opts["sheep_now"], _ = self.sheep_pay(v, f, units)
				if later is not None:
					# fancy unknown until he arrives: 1 in 7 commons is his
					fancy_p = 1 / 7 if RAR[f] == "c" else 0.0
					tmp = Visit(0, 0, fancy=-1)
					pay, _ = self.sheep_pay(tmp, f, [False] * s)
					opts["sheep_later"] = pay * (1 + fancy_p * (self.T["want_mult"] - 1))
				# hold: the price wanders home (5% a tick); worth the drift, discounted 10% for the wait
				shift = max(0, self.bid(f, self.U[f]) - b)
				market_best = max([opts[k] for k in ("counter", "board_now", "list") if k in opts], default=0.0)
				opts["hold"] = 0.9 * (market_best + p.bw * shift)
				choice = max(opts, key=opts.get)
				self.decisions.append((p.tier, p.bw, RAR[f], choice, dict(opts), (p.i, f, self.local_day(p, t))))
				if choice == "counter":
					self.counter_sell(p, f, t, "counter")
				elif choice == "board_now":
					fo, bo = self.take_units(p, f, s)
					buyer = self.pigs[best_w.pig]
					self.close(best_w, "filled", t)
					self.pig_sale(p, buyer, f, best_w.price, t, "wanted")
				elif choice == "list":
					fo, bo = self.take_units(p, f, s)
					self.post(p, t, "sell", f, L, fo, bo)
				elif choice == "sheep_now":
					nb = min(p.bought[f], s)
					self.hand(p, v, f, s - nb, nb, t, "set")
				else:  # sheep_later / hold: keep it
					break

	def all_open(self, f: int, side: str) -> list[Listing]:
		return [self.listings[lid] for lid in self.open_by_f[f] if self.listings[lid].side == side]

	def sheep_partials(self, p: Pig, t: int, v: Visit) -> None:
		"""Hand him what the pig does not keep: everything he fancies, the rest but one of each
		(a friend may wish for it) -- and a market pig keeps stacks the market pays more for."""
		cap = self.T["per_visit"] - v.sold
		if cap <= 0:
			return
		plan = []
		for f in range(NF):
			h = p.held(f)
			if h == 0:
				continue
			fancied = f == v.fancy
			keep = 0 if fancied else 1
			if p.market and not fancied:
				s = self.S[f]
				if self.market_unit_worth(p, f) > self.sheep_unit_worth(f, False):
					keep = max(keep, h)  # a builder keeps the stack for a set
				keep = max(keep, (h // s) * s if h >= s else 0)  # sets were decided already
			n = max(0, h - keep)
			if n:
				plan.append((self.sheep_price(v, f, False), f, n))
		plan.sort(reverse=True)
		for _, f, n in plan:
			if cap <= 0:
				break
			n = min(n, cap)
			nf = min(p.found[f], n)
			self.hand(p, v, f, nf, n - nf, t, "partial")
			cap -= n

	def cheapest_source(self, p: Pig, f: int, t: int) -> tuple[int, str, object] | None:
		cands = []
		if self.market_on and self.T["shelf_n"] > 0:
			lim = self.T["shelf_per_pig"]
			if lim is None or p.shelf_today.get(self.day(t), 0) < lim:
				for slot in self.get_shelf(p, t):
					if slot["f"] == f and slot["sold"] is None:
						q = self.shelf_quote(f)
						if q is not None:
							cands.append((q, "shelf", slot))
		for o in self.visible(p, "sell", f):
			cands.append((o.price, "board", o))
		if self.counter_open(p, "buy", t):
			cands.append((self.ask(f), "counter", None))
		if not cands:
			return None
		return min(cands, key=lambda c: (c[0], {"shelf": 0, "board": 1, "counter": 2}[c[1]]))

	def buy_from(self, p: Pig, f: int, t: int, src: tuple) -> int:
		price, kind, obj = src
		if kind == "shelf":
			obj["sold"] = t
			obj["buyer"] = p.tier
			p.shelf_today[self.day(t)] = p.shelf_today.get(self.day(t), 0) + 1
			self.counter_buy(p, f, t, "shelf", price=price)
		elif kind == "board":
			seller = self.pigs[obj.pig]
			self.close(obj, "filled", t)
			self.pig_sale(seller, p, f, price, t, "listing")
		else:
			self.counter_buy(p, f, t, "counter")
		return price

	def sheep_loop(self, p: Pig, t: int, v: Visit) -> None:
		"""Buy a set and hand it straight to him whenever that pays more count than the bank is worth."""
		for _ in range(4):
			cap = self.T["per_visit"] - v.sold
			best = None
			for f in range(NF):
				s = self.S[f]
				if cap < s:
					continue
				src = self.cheapest_source(p, f, t)
				if src is None or src[0] > p.bank:
					continue
				pay, _ = self.sheep_pay(v, f, [True] * s)
				gain = pay - p.bw * src[0]
				if gain >= self.min_profit and (best is None or gain > best[0]):
					best = (gain, f, src, pay)
			if best is None:
				return
			gain, f, src, pay = best
			waiting = [o for o in self.open_listings_of(p) if o.side == "buy" and o.f == f and o.purpose == "sheep"]
			back_in_visit = any(t < x < v.leave_t for x in p.sessions)
			if src[1] == "counter" and p.tier == "engaged" and p.patient and back_in_visit:
				# rather than pay his ask, pin a wanted ad at the midpoint and wait inside the visit
				w = self.mid(f)
				if not waiting and self.can_post(p, t) and p.bank >= w + self.wanted_total(p):
					o = self.post(p, t, "buy", f, w)
					o.purpose, o.visit = "sheep", v
					self.match_buy(p, o, t)
				return
			for o in waiting:
				self.close(o, "cancelled", t)
			cost = self.buy_from(p, f, t, src)
			v.loop_cost += cost
			v.loop_sets += 1
			v.loop_gain += pay - p.bw * cost
			self.hand(p, v, f, 0, self.S[f], t, "loop")
			self.daily[self.day(t)]["loop_sets"] += 1

	def cancel_stale(self, p: Pig, t: int, v: Visit | None) -> None:
		"""A wanted ad pinned for the Sheep comes down once he has gone."""
		for o in list(self.open_listings_of(p)):
			if o.purpose == "sheep" and (v is None or o.visit is not v):
				self.close(o, "cancelled", t)

	def wanted_total(self, p: Pig) -> int:
		return sum(o.price for o in self.open_listings_of(p) if o.side == "buy")

	def other_buys(self, p: Pig, t: int) -> None:
		"""Bullion's shelf (a deal worth taking), then a collector's never-held find."""
		later = self.later_visit(p, t)
		lim = self.T["shelf_per_pig"]
		for slot in list(self.get_shelf(p, t)) if self.T["shelf_n"] > 0 else []:
			if slot["sold"] is not None:
				continue
			if lim is not None and p.shelf_today.get(self.day(t), 0) >= lim:
				break
			f = slot["f"]
			q = self.shelf_quote(f)
			if q is None or q > p.bank:
				continue
			s = self.S[f]
			vals = []
			if p.collector and f not in p.met:
				vals.append(p.bw * self.ask(f))               # would pay the ask to meet it
			if p.patient:
				fe = self.fill_est(f)
				vals.append(p.bw * (fe * (self.ask(f) - 1) + (1 - fe) * self.bid(f)))  # flip it on the board
			if later is not None and self.T["per_visit"] >= s:
				pay, _ = self.sheep_pay(Visit(0, 0, fancy=-1), f, [True] * s)
				vals.append(pay)                                # hand it to him later today
			if vals and max(vals) - p.bw * q >= self.min_profit:
				self.buy_from(p, f, t, (q, "shelf", slot))
		if not p.collector:
			return
		for f in range(NF):
			if f in p.met:
				continue
			src = self.cheapest_source(p, f, t)
			if src is not None and src[0] <= p.bank and (src[1] != "counter" or not p.patient):
				self.buy_from(p, f, t, src)
				return
			# offer a set it holds, straight up, for one of the find it has never held
			for g in range(NF):
				if g != f and p.held(g) >= self.S[g] and self.can_post(p, t) and not any(
						o.side == "swap" and o.want_f == f for o in self.open_listings_of(p)):
					k = max(1, min(self.S[f], round(self.U[g] / self.T["sheep_prices"][RAR[f]])))
					fo, bo = self.take_units(p, g, self.S[g])
					self.post(p, t, "swap", g, None, fo, bo, want_f=f, want_qty=k)
					return
			w = self.mid(f)
			if (p.patient and self.can_post(p, t) and p.bank >= w + self.wanted_total(p)
			        and not any(o.f == f and o.side == "buy" for o in self.open_listings_of(p))):
				o = self.post(p, t, "buy", f, w)
				self.match_buy(p, o, t)
				return
			if src is None or src[0] > p.bank:
				self.daily[self.day(t)]["collector_priced_out_" + RAR[f]] += 1
			return

	def match_buy(self, p: Pig, o: Listing, t: int) -> None:
		sells = [x for x in self.all_open(o.f, "sell") if x.pig != p.i and x.price <= o.price]
		if sells:
			x = min(sells, key=lambda x: (x.price, x.id))
			if p.bank >= x.price:
				self.close(o, "filled", t)
				self.close(x, "filled", t)
				self.pig_sale(self.pigs[x.pig], p, o.f, x.price, t, "listing")

	def take_swaps(self, p: Pig, t: int) -> None:
		"""Take a straight-up swap when what comes is worth more to this pig than what goes."""
		for o in self.visible(p, "swap"):
			g, k = o.want_f, o.want_qty
			h = p.held(g)
			if h < k or (p.market and h // self.S[g] > (h - k) // self.S[g]):
				continue  # can't, or it would break a set
			give = k * max(self.market_unit_worth(p, g), self.sheep_unit_worth(g, False))
			get = self.S[o.f] * max(self.market_unit_worth(p, o.f), self.sheep_unit_worth(o.f, False))
			if get - give < self.min_profit:
				continue
			fo, bo = self.take_units(p, g, k)
			poster = self.pigs[o.pig]
			poster.found[g] += k           # a swapped find carries no cost
			self.note_met(poster, g, t)
			p.found[o.f] += o.esc_found + o.esc_bought
			self.note_met(p, o.f, t)
			self.close(o, "filled", t)
			self.daily[self.day(t)]["board_swaps"] += 1
			return

	def friend_swaps(self, p: Pig, t: int) -> None:
		T = self.T
		day = self.day(t)
		for qi in p.friends:
			if self.rng.random() > (0.5 if p.tier == "casual" else 0.25):
				continue
			q = self.pigs[qi]
			if t - q.wish_t > 96:      # 48 h reroll
				q.wish = self.roll_find(self.rng)
				q.wish_t = t
			w = q.wish
			if p.swapped.get(qi) == day or p.held(w) == 0:
				continue
			s = self.S[w]
			if p.market and p.held(w) % s == 0:
				continue  # would break a set kept for the market
			# give it; take the host's biggest stack the giver holds most of (or just give)
			fo, bo = self.take_units(p, w, 1)
			q.found[w] += 1
			self.note_met(q, w, t)
			opts = sorted((g for g in range(NF) if g != w and q.held(g) >= 2), key=lambda g: -q.held(g))[:3]
			if opts:
				g = max(opts, key=lambda g: (p.held(g), self.U[g]))
				self.take_units(q, g, 1)
				p.found[g] += 1
				self.note_met(p, g, t)
			p.swapped[qi] = day
			for x in (p, q):
				x.count += T["swap_tickles"]
				x.snouts += T["swap_tickles"]
			self.daily[day]["friend_swaps"] += 1
			self.daily[day]["swap_count"] += 2 * T["swap_tickles"]
			q.wish = self.roll_find(self.rng)
			while q.wish == w:
				q.wish = self.roll_find(self.rng)
			q.wish_t = t
			self.check_first_set(p, t)
			self.check_first_set(q, t)

	def tap(self, p: Pig, t: int) -> None:
		reserve = 0.0
		if p.market:
			reserve = self.wanted_total(p)
			if TIERS[p.tier] >= 2:
				# keep enough for one common set at the counter when the Sheep comes
				reserve += max(self.ask(f) for f in BY_RAR["c"])
		n = max(0.0, p.bank - reserve)
		n = math.floor(n)
		if n > 0:
			p.bank -= n
			p.count += n
			p.snouts += n
			d = self.daily[self.day(t)]
			d["tap_count"] += n

	# ── run ──
	def run(self) -> None:
		for t in range(self.n_ticks):
			self.walk(t)
			self.advance(t)
			pigs = self.sched.get(t, [])
			self.rng.shuffle(pigs)
			for i in pigs:
				self.session(self.pigs[i], t)
		# close the books on visits
		for p in self.pigs:
			for L, v in p.visits.items():
				if 0 <= v.arr_t < self.n_ticks:
					self.loop_days.append({"tier": p.tier, "market": p.market, "bw": p.bw, "caught": v.caught,
					                       "loop_sets": v.loop_sets, "loop_gain": v.loop_gain,
					                       "loop_cost": v.loop_cost, "count_bought": v.count_bought,
					                       "count_own": v.count_own, "day": v.arr_t // TPD})


# ── Reporting ────────────────────────────────────────────────────────────────
def pct(x: float) -> str:
	return f"{100 * x:.0f}%"


def med(xs, default=float("nan")):
	return statistics.median(xs) if xs else default


def analyse(ms: list[Market], steady_from: int = 7) -> dict:
	"""Pool several seeds of one (population, tuning) into the numbers the questions ask for."""
	out: dict = {}
	m0 = ms[0]
	T = m0.T
	days = m0.days
	n = len(m0.pigs)
	steady_from = min(steady_from, days // 2)  # short runs: the second half is the steady state
	steady = range(steady_from, days)
	nd = len(steady)
	# Q1 time to first set (own finds held at once) and hoard-basis sets a week
	first = defaultdict(list)
	hoard_first = defaultdict(list)
	sets_wk = Counter()
	for m in ms:
		for p in m.pigs:
			ts = min(p.first_set.values()) if p.first_set else None
			first[p.tier].append(ts / TPD if ts is not None else float("inf"))
			th = min(p.first_set_hoard.values()) if p.first_set_hoard else None
			hoard_first[p.tier].append(th / TPD if th is not None else float("inf"))
			for f in range(NF):
				sets_wk[RAR[f]] += p.cum[f] // m.S[f]
	npig = n * len(ms)
	out["first_set_days"] = {k: med(v) for k, v in first.items()}
	out["first_set_hoard_days"] = {k: med(v) for k, v in hoard_first.items()}
	out["first_set_by_d7"] = {k: sum(1 for x in v if x <= 7) / len(v) for k, v in first.items()}
	out["hoard_sets_per_pig_week"] = {RNAME[r]: sets_wk[r] / npig / (days / 7) for r in "cur"}
	# whistle market
	wl = [o for m in ms for o in m.listings.values() if RAR[o.f] == "r"]
	out["whistle"] = {
		"listings_per_day": len(wl) / len(ms) / days,
		"pig_trades_per_day": sum(1 for m in ms for tr in m.trades if tr["kind"] == "pig" and RAR[tr["f"]] == "r") / len(ms) / days,
		"bullion_sells_per_day": sum(1 for m in ms for tr in m.trades if tr["kind"] == "counter" and tr["side"] == "buy" and RAR[tr["f"]] == "r") / len(ms) / days,
		"bullion_buys_per_day": sum(1 for m in ms for tr in m.trades if tr["kind"] == "counter" and tr["side"] == "sell" and RAR[tr["f"]] == "r") / len(ms) / days,
		"collector_priced_out_per_day": sum(m.daily[d]["collector_priced_out_r"] for m in ms for d in range(days)) / len(ms) / days,
		"ask_at_U": m0.ask(11, m0.U[11]), "bid_at_U": m0.bid(11, m0.U[11]),
	}
	# Q2 liquidity
	vs = [s for m in ms for s in m.vis_samples]
	out["visible_per_open"] = {"sell": statistics.mean(x[0] for x in vs) if vs else 0,
	                           "buy": statistics.mean(x[1] for x in vs) if vs else 0,
	                           "finds_with_any": statistics.mean(x[2] for x in vs) if vs else 0}
	sells = [o for m in ms for o in m.listings.values() if o.side == "sell" and o.status != "open"]
	filled = [o for o in sells if o.status == "filled"]
	out["sell_listings_per_day"] = len([o for m in ms for o in m.listings.values() if o.side == "sell"]) / len(ms) / days
	out["sell_fill_share"] = len([o for o in filled if o.closed - o.created <= 48]) / len(sells) if sells else 0
	out["sell_outcomes"] = dict(Counter(o.status for o in sells))
	out["sell_fill_median_h"] = med([(o.closed - o.created) / 2 for o in filled])
	out["sell_fill_share_ever"] = len(filled) / len(sells) if sells else 0
	buys = [o for m in ms for o in m.listings.values() if o.side == "buy" and o.status != "open"]
	out["wanted_outcomes"] = dict(Counter(o.status for o in buys))
	swaps = [o for m in ms for o in m.listings.values() if o.side == "swap" and o.status != "open"]
	out["swap_outcomes"] = dict(Counter(o.status for o in swaps))
	ns = [s for m in ms for s in m.news_samples]
	out["news_per_open"] = {"new_listings": statistics.mean(x[0] for x in ns) if ns else 0,
	                        "prices_moved": statistics.mean(x[1] for x in ns) if ns else 0,
	                        "share_with_news": sum(1 for x in ns if x[0] or x[1] or x[2]) / len(ns) if ns else 0}
	# Q3 decisions
	# one decision per (pig, find, local day): the last one that day (a hold, then a sale, is a sale)
	dec = []
	for m in ms:
		last = {}
		for d in m.decisions:
			last[d[5]] = d
		dec.extend(last.values())
	out["decisions"] = len(dec) / len(ms) / days
	out["decision_share"] = {k: v / len(dec) for k, v in Counter(d[3] for d in dec).items()} if dec else {}
	out["decision_share_by_bw"] = {}
	for bw in sorted({d[1] for d in dec}):
		sub = [d for d in dec if d[1] == bw]
		out["decision_share_by_bw"][bw] = {k: v / len(sub) for k, v in Counter(d[3] for d in sub).items()}
	out["decision_share_by_rarity"] = {}
	for r in "cur":
		sub = [d for d in dec if d[2] == r]
		if sub:
			out["decision_share_by_rarity"][RNAME[r]] = {k: v / len(sub) for k, v in Counter(d[3] for d in sub).items()}
	close = [d for d in dec if len(d[4]) >= 2 and sorted(d[4].values())[-2] >= 0.85 * max(d[4].values())]
	out["close_calls"] = len(close) / len(dec) if dec else 0
	# Q4 the loop
	ld = [x for m in ms for x in m.loop_days if steady_from <= x["day"] < days]
	mk_caught = [x for x in ld if x["market"] and x["caught"]]
	mk_all = [x for x in ld if x["market"]]
	out["loop"] = {
		"share_market_pig_days": sum(1 for x in mk_all if x["loop_sets"]) / len(mk_all) if mk_all else 0,
		"share_when_caught": sum(1 for x in mk_caught if x["loop_sets"]) / len(mk_caught) if mk_caught else 0,
		"count_per_market_pig_day": statistics.mean(x["count_bought"] for x in mk_all) if mk_all else 0,
		"net_count_per_loop_day": med([x["count_bought"] - x["loop_cost"] for x in mk_all if x["loop_sets"]], 0),
		"cost_per_loop_day": med([x["loop_cost"] for x in mk_all if x["loop_sets"]], 0),
		"caught_share": sum(1 for x in ld if x["caught"]) / len(ld) if ld else 0,
		"by_tier": {tier: (sum(1 for x in mk_all if x["tier"] == tier and x["loop_sets"]) /
		                   max(1, sum(1 for x in mk_all if x["tier"] == tier))) for tier in TIERS},
	}
	# Q5 price feel
	pf = {}
	for r in "cur":
		rngs, ask_r, bid_r, edge = [], [], [], 0
		total = 0
		for m in ms:
			for f in BY_RAR[r]:
				for dd in steady:
					seg = m.price_log[f][dd * TPD:(dd + 1) * TPD]
					a = m.ask_log[f][dd * TPD:(dd + 1) * TPD]
					b = m.bid_log[f][dd * TPD:(dd + 1) * TPD]
					if not seg:
						continue
					rngs.append((max(seg) - min(seg)) / m.U[f])
					ask_r.append(max(a) - min(a))
					bid_r.append(max(b) - min(b))
					edge += sum(1 for x in seg if x <= (T["lo"] + 0.02) * m.U[f] or x >= (T["hi"] - 0.02) * m.U[f])
					total += len(seg)
		ct = [tr for m in ms for tr in m.trades if tr["kind"] == "counter" and RAR[tr["f"]] == r]
		pf[RNAME[r]] = {
			"U": m0.U[BY_RAR[r][0]],
			"bid_ask_at_U": (m0.bid(BY_RAR[r][0], m0.U[BY_RAR[r][0]]), m0.ask(BY_RAR[r][0], m0.U[BY_RAR[r][0]])),
			"daily_range_pct_U": med(rngs, 0) * 100,
			"ask_range_median": med(ask_r, 0), "bid_range_median": med(bid_r, 0),
			"days_ask_never_moved": sum(1 for x in ask_r if x == 0) / len(ask_r) if ask_r else 0,
			"at_band_edge": edge / total if total else 0,
			"mean_P_over_U": statistics.mean(x / m.U[f] for m in ms for f in BY_RAR[r] for x in m.price_log[f][steady_from * TPD:]),
			"counter_trades_per_day": len(ct) / len(ms) / days,
			"ask_moves_after_trade": sum(1 for tr in ct if tr["ask_moved"]) / len(ct) if ct else float("nan"),
			"bid_moves_after_trade": sum(1 for tr in ct if tr["bid_moved"]) / len(ct) if ct else float("nan"),
			"either_moves_after_trade": sum(1 for tr in ct if tr["ask_moved"] or tr["bid_moved"]) / len(ct) if ct else float("nan"),
		}
	out["price"] = pf
	# Q6 the shelf
	shelf_trades = [tr for m in ms for tr in m.trades if tr["how"] == "shelf"]
	waits = [((tr["t"] % TPD) / 2) for tr in shelf_trades]
	slots = sum(m.m["shelf_slots"] for m in ms)
	by_tier = Counter(m.pigs[tr["buyer"]].tier for m in ms for tr in m.trades if tr["how"] == "shelf")
	pop_tier = Counter(p.tier for m in ms for p in m.pigs)
	out["shelf"] = {
		"sold_share": len(shelf_trades) / slots if slots else 0,
		"median_h_after_drop": med(waits, float("nan")),
		"p90_h_after_drop": sorted(waits)[int(0.9 * (len(waits) - 1))] if waits else float("nan"),
		"buyer_share": {k: by_tier[k] / max(1, len(shelf_trades)) for k in TIERS},
		"pop_share": {k: pop_tier[k] / max(1, sum(pop_tier.values())) for k in TIERS},
		"distinct_buyers_per_day": statistics.mean(
			len({tr["buyer"] for tr in m.trades if tr["how"] == "shelf" and tr["t"] // TPD == dd}) for m in ms for dd in steady),
		"max_share_one_pig": max((Counter(tr["buyer"] for tr in m.trades if tr["how"] == "shelf").most_common(1) or [(0, 0)])[0][1]
		                         / max(1, sum(1 for tr in m.trades if tr["how"] == "shelf")) for m in ms),
	}
	# Q7 flows per pig per day (steady state)
	keys = ["regen", "wasted", "tap_count", "bank_out_counter", "bank_out_shelf", "bank_in_counter", "bank_pig_to_pig",
	        "finds_dug", "finds_bullion_sold", "finds_bullion_bought", "sheep_units", "sheep_count", "sheep_count_bought",
	        "swap_count", "friend_swaps", "board_swaps", "loop_sets", "market_opens", "pig_trades"]
	flows = {}
	for k in keys:
		flows[k] = sum(m.daily[d][k] for m in ms for d in steady) / (npig * nd)
	flows["count_total"] = flows["tap_count"] + flows["sheep_count"] + flows["swap_count"]
	flows["snouts"] = flows["tap_count"] + flows["swap_count"]
	out["flows"] = flows
	# Contend: count/day by group over the whole run
	grp = defaultdict(list)
	for m in ms:
		for p in m.pigs:
			grp[("market" if p.market else "no_market", p.tier)].append(p.count / days)
			grp[("all", p.tier)].append(p.count / days)
			grp[("market" if p.market else "no_market", "all")].append(p.count / days)
	out["count_per_day"] = {f"{a}/{b}": statistics.mean(v) for (a, b), v in grp.items()}
	led = [p.took - p.spent for m in ms for p in m.pigs if p.market and (p.took or p.spent)]
	out["ledger_down_share"] = sum(1 for x in led if x < 0) / len(led) if led else 0
	out["n"] = n
	out["seeds"] = len(ms)
	return out


def scorecard(a: dict, a_small: dict) -> dict:
	"""The fun scorecard (0-2 each). `a` is the population being scored, `a_small` the 30-pig run."""
	s = {}
	# 1. A goal within a week: a regular pig holds its first set (own finds) by day 7
	g = a["first_set_by_d7"].get("regular", 0)
	s["goal_within_a_week"] = (2 if g >= 0.6 else 1 if g >= 0.3 else 0, f"{pct(g)} of regulars hold a set by day 7")
	# 2. A real choice: no outlet takes > 60% of set decisions, and >= 25% are close calls
	ds = a["decision_share"]
	top = max(ds.values()) if ds else 1
	cc = a["close_calls"]
	s["real_choice"] = (2 if top <= 0.6 and cc >= 0.25 else 1 if top <= 0.75 else 0,
	                    f"top outlet {pct(top)} ({max(ds, key=ds.get) if ds else '-'}), close calls {pct(cc)}")
	# 3. No chore / dominant loop: the Sheep loop on <= 25% of market-pig days
	lp = a["loop"]["share_market_pig_days"]
	extra = a["flows"]["sheep_count_bought"] / max(1e-9, a["flows"]["tap_count"])
	s["no_chore"] = (2 if lp <= 0.25 else 1 if lp <= 0.45 else 0,
	                 f"loop on {pct(lp)} of market-pig days; Sheep count from bought finds = {pct(extra)} of tap count")
	# 4. A reason to check the board, even at 30 players
	fs = a_small["sell_fill_share"]
	vis = a_small["visible_per_open"]["finds_with_any"]
	s["board_alive_at_30"] = (2 if fs >= 0.5 and vis >= 3 else 1 if fs >= 0.25 or vis >= 2 else 0,
	                          f"30 pigs: {pct(fs)} of sell listings fill in 24 h; {vis:.1f} finds with a listing per open")
	# 5. Visible consequences: one counter trade moves an integer price, and quiet prices move
	pf = a["price"]
	mv = statistics.mean(v["either_moves_after_trade"] for v in pf.values() if v["either_moves_after_trade"] == v["either_moves_after_trade"])
	quiet = pf["common"]["days_ask_never_moved"]
	s["visible_consequences"] = (2 if mv >= 0.6 and quiet <= 0.3 else 1 if mv >= 0.4 else 0,
	                             f"one trade moves bid or ask {pct(mv)}; commons' ask frozen all day on {pct(quiet)} of days")
	# 6. Fair Contend: market users' count/day within 15% of non-users' (tier by tier, mix-weighted)
	cpd = a["count_per_day"]
	ratio = sum(TIER_MIX[k] * cpd.get(f"market/{k}", 0) / max(1e-9, cpd.get(f"no_market/{k}", 0)) for k in TIERS)
	s["fair_contend"] = (2 if ratio <= 1.15 else 1 if ratio <= 1.35 else 0, f"market users earn {ratio:.2f}x the count of non-users (same tier)")
	# 7. The shelf is not a rush only engaged pigs win
	sh = a["shelf"]
	eng = sh["buyer_share"].get("engaged", 0) / max(1e-9, sh["pop_share"].get("engaged", 0))
	s["fair_shelf"] = (2 if eng <= 1.5 and sh["max_share_one_pig"] <= 0.1 else 1 if eng <= 2.5 else 0,
	                   f"engaged pigs take {eng:.1f}x their share; one pig took {pct(sh['max_share_one_pig'])} of the shelf")
	# 8. Losing feels warm: an unfilled listing just comes home; few market users end the run down
	dn = a["ledger_down_share"]
	s["losing_warm"] = (2 if dn <= 0.4 else 1 if dn <= 0.6 else 0, f"{pct(dn)} of market users' bank ledgers end down (sets in hand or count instead)")
	s["total"] = sum(v[0] for k, v in s.items() if k != "total")
	return s


def fmt_report(label: str, res: dict, nomkt: dict | None) -> str:
	L = []
	a = res
	L.append(f"\n=== {label} · {a['n']} daily players · {a['seeds']} seeds ===")
	L.append("Q1 sets")
	L.append("  first set held (own finds, median days): " + ", ".join(f"{k} {v:.1f}" for k, v in a["first_set_days"].items())
	         + " | if nothing went to the Sheep: " + ", ".join(f"{k} {v:.1f}" for k, v in a["first_set_hoard_days"].items()))
	L.append("  holding a set by day 7: " + ", ".join(f"{k} {pct(v)}" for k, v in a["first_set_by_d7"].items()))
	L.append("  sets a pig digs per week (hoard basis): " + ", ".join(f"{k} {v:.2f}" for k, v in a["hoard_sets_per_pig_week"].items()))
	w = a["whistle"]
	L.append(f"  whistle: bid/ask at U {w['bid_at_U']}/{w['ask_at_U']}; listings/day {w['listings_per_day']:.2f}; pig trades/day {w['pig_trades_per_day']:.2f}; "
	         f"Bullion sold {w['bullion_sells_per_day']:.2f}/day, bought {w['bullion_buys_per_day']:.2f}/day; collector priced out/day {w['collector_priced_out_per_day']:.2f}")
	L.append("Q2 board")
	v = a["visible_per_open"]
	L.append(f"  per market open: {v['sell']:.1f} for-sale + {v['buy']:.1f} wanted visible; {v['finds_with_any']:.1f} of 12 finds have any")
	L.append(f"  sell listings/day {a['sell_listings_per_day']:.1f}; filled by a pig within 24 h {pct(a['sell_fill_share'])}; "
	         f"ever {pct(a['sell_fill_share_ever'])}; median fill {a['sell_fill_median_h']:.1f} h; outcomes {a['sell_outcomes']}")
	L.append(f"  wanted outcomes {a['wanted_outcomes']}; swap outcomes {a['swap_outcomes']}")
	nw = a["news_per_open"]
	L.append(f"  news per open: {nw['new_listings']:.1f} new listings, {nw['prices_moved']:.1f} finds' prices moved; something new {pct(nw['share_with_news'])}")
	L.append("Q3 decisions on a held set")
	L.append(f"  {a['decisions']:.1f} decisions/day; " + ", ".join(f"{k} {pct(x)}" for k, x in sorted(a['decision_share'].items(), key=lambda kv: -kv[1]))
	         + f"; close calls (2nd best within 15%) {pct(a['close_calls'])}")
	for bw, sh in a["decision_share_by_bw"].items():
		L.append(f"    bank worth {bw}: " + ", ".join(f"{k} {pct(x)}" for k, x in sorted(sh.items(), key=lambda kv: -kv[1])))
	for r, sh in a["decision_share_by_rarity"].items():
		L.append(f"    {r}: " + ", ".join(f"{k} {pct(x)}" for k, x in sorted(sh.items(), key=lambda kv: -kv[1])))
	lp = a["loop"]
	L.append("Q4 the Ghost Sheep loop (buy a set, hand it to him)")
	L.append(f"  Sheep caught on {pct(lp['caught_share'])} of pig-days; loop on {pct(lp['share_market_pig_days'])} of market-pig days "
	         f"({pct(lp['share_when_caught'])} when caught); by tier " + ", ".join(f"{k} {pct(x)}" for k, x in lp["by_tier"].items()))
	L.append(f"  count from bought finds {lp['count_per_market_pig_day']:.1f}/market-pig/day; a loop day: median cost {lp['cost_per_loop_day']:.0f} bank, "
	         f"net {lp['net_count_per_loop_day']:+.0f} count over the bank spent")
	L.append("Q5 price feel (steady state)")
	for r, pf in a["price"].items():
		L.append(f"  {r}: U {pf['U']}, bid/ask at U {pf['bid_ask_at_U']}; daily range {pf['daily_range_pct_U']:.1f}% of U; ask range {pf['ask_range_median']:.0f}, "
		         f"bid range {pf['bid_range_median']:.0f}; ask frozen all day {pct(pf['days_ask_never_moved'])}; at band edge {pct(pf['at_band_edge'])}; mean P/U {pf['mean_P_over_U']:.2f}; "
		         f"counter trades/day {pf['counter_trades_per_day']:.1f}; one trade moves ask {pct(pf['ask_moves_after_trade'])} / bid {pct(pf['bid_moves_after_trade'])}")
	sh = a["shelf"]
	L.append("Q6 the shelf")
	L.append(f"  sold {pct(sh['sold_share'])}; median {sh['median_h_after_drop']:.1f} h after the UTC-midnight drop (p90 {sh['p90_h_after_drop']:.1f} h); "
	         f"buyers " + ", ".join(f"{k} {pct(x)}" for k, x in sh["buyer_share"].items()) + " vs population "
	         + ", ".join(f"{k} {pct(x)}" for k, x in sh["pop_share"].items()) + f"; one pig's max share {pct(sh['max_share_one_pig'])}")
	fl = a["flows"]
	L.append("Q7 flows per pig per day (steady state)")
	L.append(f"  bank: regen +{fl['regen']:.1f} (wasted {fl['wasted']:.1f}), tapped {fl['tap_count']:.1f}; market out {fl['bank_out_counter'] + fl['bank_out_shelf']:.1f} "
	         f"(counter {fl['bank_out_counter']:.1f}, shelf {fl['bank_out_shelf']:.1f}), Bullion paid in {fl['bank_in_counter']:.1f}, pig-to-pig {fl['bank_pig_to_pig']:.1f}")
	L.append(f"  finds: dug {fl['finds_dug']:.2f}; Bullion created {fl['finds_bullion_sold']:.2f}, Bullion consumed {fl['finds_bullion_bought']:.2f}; "
	         f"Sheep consumed {fl['sheep_units']:.2f}")
	L.append(f"  count {fl['count_total']:.1f} (taps {fl['tap_count']:.1f}, Sheep {fl['sheep_count']:.1f} of which bought finds {fl['sheep_count_bought']:.1f}, "
	         f"swaps {fl['swap_count']:.1f}); snouts {fl['snouts']:.1f}")
	if nomkt is not None:
		fn = nomkt["flows"]
		L.append(f"  no-market day: count {fn['count_total']:.1f} (taps {fn['tap_count']:.1f}, Sheep {fn['sheep_count']:.1f}, swaps {fn['swap_count']:.1f}); "
		         f"snouts {fn['snouts']:.1f}; Sheep consumed {fn['sheep_units']:.2f} finds")
	cp = a["count_per_day"]
	L.append("  count/day by group: " + ", ".join(f"{k} {v:.1f}" for k, v in sorted(cp.items())))
	return "\n".join(L)


def parse_set(T: dict, kv: str) -> None:
	k, v = kv.split("=", 1)
	try:
		val = json.loads(v)
	except json.JSONDecodeError:
		val = v  # a bare word: shelf_mode=per_pig
	if "." in k:
		a, b = k.split(".", 1)
		T[a][b] = val
	else:
		T[k] = val if not isinstance(T.get(k), tuple) else tuple(val)


# The sweep behind the balance pass: one lever at a time, then the proposal's robustness.
SET_321 = {"c": 3, "u": 2, "r": 1}
SWEEP_LEVERS = [
	("shipped", "shipped", {}),
	("+ x2 for found finds only", "shipped", {"fancy_found_only": True}),
	("sets 3/2/1", "shipped", {"set_size": SET_321}),
	("sets 3/2/1 + found-only", "shipped", {"set_size": SET_321, "fancy_found_only": True}),
	("sets 3/2/1 + buy cap 1/day", "shipped", {"set_size": SET_321, "counter_caps": [None, 1]}),
	("sets 3/2/1 + found-only + wiggle .02 + 48 h", "shipped",
	 {"set_size": SET_321, "fancy_found_only": True, "wiggle": 0.02, "offer_hours": 48}),
	("PROPOSED (that + impact .05)", "proposed", {}),
	("proposed, sets 3/3/1", "proposed", {"set_size": {"c": 3, "u": 3, "r": 1}}),
	("proposed, sets 3/2/2", "proposed", {"set_size": {"c": 3, "u": 2, "r": 2}}),
	("proposed, shipped sets 4/3/3", "proposed", {"set_size": {"c": 4, "u": 3, "r": 3}}),
	("proposed + shelf 1 per pig/day", "proposed", {"shelf_per_pig": 1}),
	("proposed + per-pig shelf x1", "proposed", {"shelf_mode": "per_pig", "shelf_n": 1}),
	("proposed + shelf at ask-1", "proposed", {"shelf_quote": "ask-1"}),
	("proposed, no shelf", "proposed", {"shelf_n": 0}),
	("proposed + bought finds no pair", "proposed", {"bought_no_pair": True}),
]
SWEEP_SENS = [
	("base", {}),
	("adoption 0.4", {"adoption": 0.4}),
	("bank worth all 1.0", {"bw_mix": [(1.0, 1.0)]}),
	("bank worth all 2.0", {"bw_mix": [(2.0, 1.0)]}),
	("friends 1", {"friend_degree": 1.0}),
	("friends 4", {"friend_degree": 4.0}),
	("Slop Club 25%", {"vip": 0.25}),
	("min profit 3", {"min_profit": 3.0}),
]


def sweep_row(label: str, n: int, res: dict, small: dict) -> str:
	sc = scorecard(res, small)
	ds = res["decision_share"]
	top = max(ds, key=ds.get) if ds else "-"
	pf = res["price"]
	ok = [v["either_moves_after_trade"] for v in pf.values() if v["either_moves_after_trade"] == v["either_moves_after_trade"]]
	mv = sum(ok) / max(1, len(ok))
	cpd = res["count_per_day"]
	ratio = sum(TIER_MIX[k] * cpd.get(f"market/{k}", 0) / max(1e-9, cpd.get(f"no_market/{k}", 0)) for k in TIERS)
	sh = res["shelf"]
	eng = sh["buyer_share"].get("engaged", 0) / max(1e-9, sh["pop_share"].get("engaged", 0))
	return (f"{label:<44}{n:>4} | {res['first_set_by_d7'].get('regular', 0) * 100:>5.0f}% {res['first_set_days'].get('regular', 0):>5.1f}d "
	        f"{res['sell_fill_share'] * 100:>5.0f}% {res['visible_per_open']['finds_with_any']:>5.1f} {res['loop']['share_market_pig_days'] * 100:>5.0f}% "
	        f"{ratio:>6.2f} {top + ' ' + str(round(ds.get(top, 0) * 100)) + '%':>15} {res['close_calls'] * 100:>4.0f}% {mv * 100:>4.0f}% "
	        f"{pf['common']['days_ask_never_moved'] * 100:>4.0f}% {sh['median_h_after_drop']:>5.1f} {eng:>4.1f} {sh['max_share_one_pig'] * 100:>4.0f}% {sc['total']:>3}/16")


SWEEP_HEAD = (f"{'variant':<44}{'pop':>4} | {'d7reg':>6} {'1st':>6} {'fill':>6} {'vis':>5} {'loop':>6} {'mkt/no':>6} {'top decision':>15} "
              f"{'close':>5} {'mv':>5} {'frz':>5} {'shelf':>5} {'eng':>4} {'1pig':>5} {'score':>5}\n"
              "  d7reg: regulars holding a set by day 7 · 1st: their median first set · fill: sell listings filled by a pig in 24 h · "
              "vis: finds with any listing per market open · loop: market-pig days with the Sheep loop · mkt/no: market users' count "
              "vs non-users' · close: decisions whose 2nd-best is within 15% · mv: one counter trade moves Bullion's bid or ask · "
              "frz: days commons' ask never moved · shelf: median hours after the drop a shelf set sells · eng: engaged pigs' shelf "
              "share vs their population share · 1pig: most shelf sets one pig took")


def run_sweep(args, pops: list[int]) -> None:
	print("Levers, one at a time (board-alive scored on the smallest population)")
	print(SWEEP_HEAD)
	for label, base, over in SWEEP_LEVERS:
		T = copy.deepcopy(TUNINGS[base])
		T.update(copy.deepcopy(over))
		small = None
		for n in pops:
			res = analyse(run_pop(T, n, args))
			small = small or res
			print(sweep_row(label, n, res, small))
	print("\nRobustness: shipped vs proposed under other assumptions")
	print(SWEEP_HEAD)
	for tname in ("shipped", "proposed"):
		for label, kw in SWEEP_SENS:
			a = copy.copy(args)
			for k, v in kw.items():
				setattr(a, k, v)
			small = None
			for n in pops[:2]:
				res = analyse(run_pop(TUNINGS[tname], n, a))
				small = small or res
				print(sweep_row(f"{tname} · {label}", n, res, small))


def run_pop(T: dict, n: int, args, market_on: bool = True) -> list[Market]:
	out = []
	seeds = args.seeds if n > 30 else max(args.seeds, args.small_seeds)
	for s in range(seeds):
		m = Market(T, n, args.days, args.seed + 1000 * s + n, args.adoption, args.bw_mix, args.collectors,
		           args.friend_degree, args.vip, market_on, args.min_profit)
		random.seed(args.seed + 7 * s + n)
		m.run()
		out.append(m)
	return out


def main() -> None:
	ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	ap.add_argument("--tuning", choices=sorted(TUNINGS), default="shipped")
	ap.add_argument("--set", action="append", default=[], metavar="KEY=JSON",
	                help="override a lever, e.g. set_size.c=3, wiggle=0.02, counter_caps=[null,1], fancy_found_only=true")
	ap.add_argument("--pops", default="30,150,600", help="daily players per population")
	ap.add_argument("--days", type=int, default=28)
	ap.add_argument("--seeds", type=int, default=2, help="seeds per population (pooled)")
	ap.add_argument("--small-seeds", type=int, default=6, help="seeds for the 30-pig population (noisy)")
	ap.add_argument("--seed", type=int, default=11)
	ap.add_argument("--adoption", type=float, default=0.7, help="share of pigs who use the market")
	ap.add_argument("--bw-mix", default="1:0.4,1.5:0.4,2:0.2", help="bank-tickle worth in count : share")
	ap.add_argument("--collectors", type=float, default=0.3, help="share of market pigs who want to meet every find")
	ap.add_argument("--friend-degree", type=float, default=2.0, help="mean player-friends per pig")
	ap.add_argument("--vip", type=float, default=0.10, help="Slop Club share (bank cap 50)")
	ap.add_argument("--min-profit", type=float, default=1.0, help="worth a pig needs to clear to bother")
	ap.add_argument("--compare", action="store_true", help="shipped vs proposed vs no market, with scorecards")
	ap.add_argument("--no-market", action="store_true", help="the non-market day only")
	ap.add_argument("--json", metavar="PATH", help="write every pooled result as JSON")
	ap.add_argument("--sweep", action="store_true", help="the lever-by-lever and robustness tables of the balance pass")
	args = ap.parse_args()
	args.bw_mix = [(float(a), float(b)) for a, b in (x.split(":") for x in args.bw_mix.split(","))]
	pops = [int(x) for x in args.pops.split(",")]
	if args.sweep:
		run_sweep(args, pops)
		return

	tunings = {"shipped": SHIPPED, "proposed": PROPOSED} if args.compare else {args.tuning: TUNINGS[args.tuning]}
	results: dict = {}
	for name, base in tunings.items():
		T = copy.deepcopy(base)
		for kv in args.set:
			parse_set(T, kv)
		results[name] = {}
		for n in pops:
			if args.no_market:
				results[name][n] = analyse(run_pop(T, n, args, market_on=False))
			else:
				results[name][n] = analyse(run_pop(T, n, args, market_on=True))
	nomkt = {}
	if not args.no_market:
		T0 = copy.deepcopy(SHIPPED)
		for n in pops:
			nomkt[n] = analyse(run_pop(T0, n, args, market_on=False))
	print(f"Bullion's Market balance run · {args.days} days from a fresh start · adoption {args.adoption} · bank worth {args.bw_mix} "
	      f"· collectors {args.collectors} · friends {args.friend_degree} · Slop Club {args.vip}")
	for name in results:
		for n in pops:
			print(fmt_report(f"{name}", results[name][n], nomkt.get(n)))
	if not args.no_market:
		small = min(pops)
		print("\n=== Fun scorecard (0-2 each; board-alive scored on the smallest population) ===")
		for name in results:
			for n in pops:
				sc = scorecard(results[name][n], results[name][small])
				print(f"\n{name} · {n} players: total {sc['total']}/16")
				for k, (pts, why) in sc.items() if False else [(k, v) for k, v in sc.items() if k != "total"]:
					print(f"  {k:<22} {pts}  {why}")
	if args.json:
		with open(args.json, "w") as fh:
			json.dump({"results": results, "no_market": nomkt}, fh, indent=1, default=str)


if __name__ == "__main__":
	main()
