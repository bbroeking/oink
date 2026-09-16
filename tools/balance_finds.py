#!/usr/bin/env python3
"""Sets-per-day for the proposed find/swap/Stranger loop (docs/design/2026-09-16-finds-swaps-and-the-stranger.md).

Monte Carlo over a ring of pigs. Each pig digs `--digs` feedings a day (typical, not the
3/day ceiling); every dig drops 1/2/3 finds at 30/50/20 %, rarity 70/25/5, spread evenly
inside each tier. The bag holds 12; a full bag tosses a single that isn't the most-held
find (the player curating toward a set — hold-to-Toss is the curation act). Every pig asks
for the find it holds most of, offering anything; every friend who holds the want fills it
once a day and takes the asker's largest other stack. Stacks of three sell to the Stranger,
three sets a day at most.

Prints days-per-set and swaps-per-pig-per-day for three catalog sizes × four friend counts —
the two numbers that decide whether the loop needs friends without stalling the friendless.
Assumptions, not measurements; rerun after tuning changes.
"""
from __future__ import annotations

import argparse
import random
from collections import Counter

CATALOGS = {"20 (14/4/2)": (14, 4, 2), "30 (20/7/3)": (20, 7, 3), "45 (32/10/3)": (32, 10, 3)}
FIND_ODDS = ([1, 2, 3], [0.30, 0.50, 0.20])
RARITY = (70, 25, 5)
CAP = 12
SET = 3
SETS_PER_DAY = 3


def run(n_common: int, n_unc: int, n_rare: int, friends: int, digs_per_day: float,
        days: int, pigs: int, seed: int) -> tuple[float, float]:
    rnd = random.Random(seed)
    cat = [("c", i) for i in range(n_common)] + [("u", i) for i in range(n_unc)] + [("r", i) for i in range(n_rare)]
    w = [RARITY[0] / n_common] * n_common + [RARITY[1] / n_unc] * n_unc + [RARITY[2] / n_rare] * n_rare
    bags = [Counter() for _ in range(pigs)]
    ring = [[(p + k) % pigs for k in range(1, friends + 1)] for p in range(pigs)]
    sets = swaps = 0
    for _ in range(days):
        for p in range(pigs):
            ndig = int(digs_per_day) + (1 if rnd.random() < digs_per_day - int(digs_per_day) else 0)
            for _ in range(ndig):
                for _ in range(rnd.choices(*FIND_ODDS)[0]):
                    f = rnd.choices(cat, w)[0]
                    if sum(bags[p].values()) >= CAP:
                        singles = [x for x, c in bags[p].items() if c == 1]
                        if not singles:
                            continue
                        bags[p][rnd.choice(singles)] -= 1
                        bags[p] += Counter()
                    bags[p][f] += 1
        for p in range(pigs):
            if not bags[p]:
                continue
            want, held = bags[p].most_common(1)[0]
            if held >= SET:
                continue
            for q in ring[p]:
                if bags[q][want] > 0 and bags[p][want] < SET:
                    others = [(x, c) for x, c in bags[p].items() if x != want and c > 0]
                    if not others:
                        continue
                    take = max(others, key=lambda t: t[1])[0]
                    bags[q][want] -= 1
                    bags[p][want] += 1
                    bags[p][take] -= 1
                    bags[q][take] += 1
                    bags[q] += Counter()
                    bags[p] += Counter()
                    swaps += 1
        for p in range(pigs):
            sold = 0
            for x, c in list(bags[p].items()):
                while c >= SET and sold < SETS_PER_DAY:
                    bags[p][x] -= SET
                    c -= SET
                    sets += 1
                    sold += 1
            bags[p] += Counter()
    return sets / pigs / days, swaps / pigs / days


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--digs", type=float, default=2.0, help="feedings dug per pig per day (default 2)")
    ap.add_argument("--days", type=int, default=60)
    ap.add_argument("--pigs", type=int, default=40)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    for label, (c, u, r) in CATALOGS.items():
        for fr in (0, 2, 4, 7):
            s, sw = run(c, u, r, fr, a.digs, a.days, a.pigs, a.seed)
            dps = 1 / s if s else float("inf")
            print(f"catalog {label:12} friends {fr}: {dps:5.1f} days/set   {sw:4.2f} swaps/pig/day")


if __name__ == "__main__":
    main()
