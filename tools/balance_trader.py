#!/usr/bin/env python3
"""Tuning run for the Ghost Sheep Trader (20260917170000_ghost_sheep_trader.sql).

Monte Carlo over one pig's days. The pig opens the yard `--sessions` times a day at
random minutes of a 16 h waking window; digs `--digs` feedings a day (3/day is the
ceiling); every dig drops 0/1/2 Satchel finds at 30/50/20 % with rarity 70/25/5; the
bag holds 6 and a full bag leaves the find in the mud (swaps are ignored — this is the
friendless floor).

The trader follows the server's rule exactly: ONE visit per day, its arrival drawn inside
the local `--window` (so the whole `--stay` fits before the window closes). A visit is
CAUGHT when a session lands inside it; a caught visit sells finds by `--policy`:
  all   — everything in the bag, up to the per-visit cap (the upper bound)
  rare  — only uncommons, rares and the fancied find (a pig saving commons for swaps)

Prints, per sessions×digs cell: visits rolled and caught per week, finds sold per day,
trader tickles per day, and that as a share of a dig-faucet day (`--dig-tickles` per dig,
~25 for a typical Snout Deep receipt). Assumptions, not measurements; rerun after tuning.

  python3 tools/balance_trader.py
  python3 tools/balance_trader.py --window 8 22 --stay 6 --prices 3 8 20 --per-visit 6
"""
from __future__ import annotations

import argparse
import random

FIND_ODDS = ([0, 1, 2], [0.30, 0.50, 0.20])
RARITY = (["c", "u", "r"], [70, 25, 5])
CAP = 6
WAKE_H = 16.0
DAY = 24.0


def run(sessions: float, digs: float, args: argparse.Namespace, seed: int) -> dict[str, float]:
    rnd = random.Random(seed)
    price = dict(zip(("c", "u", "r"), args.prices))
    bag: list[str] = []
    rolled = caught = sold = tickles = 0
    lo, hi = args.window
    span = max(0.0, hi - args.stay - lo)
    for day in range(args.days):
        t0 = day * DAY
        # the day's visit: a seeded hour inside the window, a fixed stay
        a = t0 + lo + span * rnd.random()
        l = a + args.stay
        want = rnd.choices(*RARITY)[0]
        rolled += 1
        sold_in_visit = 0
        seen = False
        ndig = int(digs) + (1 if rnd.random() < digs - int(digs) else 0)
        events: list[tuple[float, str]] = [(t0 + rnd.uniform(0, WAKE_H), "dig") for _ in range(ndig)]
        n_sess = int(sessions) + (1 if rnd.random() < sessions - int(sessions) else 0)
        events += [(t0 + rnd.uniform(0, WAKE_H), "session") for _ in range(n_sess)]
        for t, kind in sorted(events):
            if kind == "dig":
                for _ in range(rnd.choices(*FIND_ODDS)[0]):
                    if len(bag) < CAP:
                        bag.append(rnd.choices(*RARITY)[0])
                continue
            if not (a <= t < l):
                continue
            if not seen:
                seen = True
                caught += 1
            keep: list[str] = []
            for f in bag:
                sellable = args.policy == "all" or f != "c" or f == want
                if sold_in_visit < args.per_visit and sellable:
                    tickles += int(price[f] * (args.mult if f == want else 1))
                    sold += 1
                    sold_in_visit += 1
                else:
                    keep.append(f)
            bag = keep
    weeks = args.days / 7
    return {
        "rolled/wk": rolled / weeks,
        "caught/wk": caught / weeks,
        "sold/day": sold / args.days,
        "tickles/day": tickles / args.days,
        "vs dig-day": (tickles / args.days) / max(1e-9, args.dig_tickles * digs),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--window", nargs=2, type=float, default=(8, 22), metavar=("START", "END"), help="local hours his arrival is drawn from")
    ap.add_argument("--stay", type=float, default=6, help="hours he stays")
    ap.add_argument("--prices", nargs=3, type=int, default=(3, 8, 20), metavar=("C", "U", "R"))
    ap.add_argument("--mult", type=float, default=2.0, help="the fancied find's multiplier")
    ap.add_argument("--per-visit", type=int, default=6, help="finds he takes per visit")
    ap.add_argument("--policy", choices=("all", "rare"), default="all")
    ap.add_argument("--dig-tickles", type=float, default=25, help="tickles a typical dig receipt pays, for scale")
    ap.add_argument("--days", type=int, default=700)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    print(f"window {args.window[0]:g}–{args.window[1]:g}h · stay {args.stay:g}h · prices {args.prices} · "
          f"want ×{args.mult:g} · {args.per_visit}/visit · policy {args.policy} · {args.days} days")
    print(f"{'sessions/day':>12} {'digs/day':>8} | {'rolled/wk':>9} {'caught/wk':>9} {'sold/day':>8} {'tickles/day':>11} {'vs dig-day':>10}")
    for sessions in (1, 2, 4, 8):
        for digs in (1, 1.5, 3):
            r = run(sessions, digs, args, args.seed)
            print(f"{sessions:>12} {digs:>8g} | {r['rolled/wk']:>9.1f} {r['caught/wk']:>9.1f} {r['sold/day']:>8.2f} "
                  f"{r['tickles/day']:>11.1f} {r['vs dig-day']:>9.0%}")


if __name__ == "__main__":
    main()
