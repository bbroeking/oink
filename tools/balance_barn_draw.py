#!/usr/bin/env python3
"""Expected values for the proposed Barn prize draw (docs/design/2026-09-16-barn-prize-draw.md).

Two layers per weekly distribution (Monday, with the race and the tickle purse):
  1. everyone's draw  — every eligible snout rolls a tier and receives one for-sale design
                        they don't own from the week's featured collection (falls back to
                        the tickle purse when the collection is complete)
  2. the herd prize   — K scarce, grant-only prizes per distribution, drawn by weighted
                        lottery over earned tickets (capped per player), seed committed
                        before the week ends

This prints the numbers a founder wants before saying yes: designs and snout-value handed
out per player per week, weeks to complete a collection from draws alone, and how much
more likely a max-ticket player is to win the herd prize than a median one.
Behaviour knobs are assumptions; the catalog is the shipped 100-design expansion
(docs/design/barn-furnishing-expansion-100.json).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import statistics

HERE = os.path.dirname(os.path.abspath(__file__))
EXPANSION = os.path.join(HERE, "..", "docs", "design", "barn-furnishing-expansion-100.json")

# ── the proposal's tuning (placeholders, server config once built) ─────────
TIER_WEIGHTS = {"common": 60, "uncommon": 28, "rare": 12}   # everyone's draw
PRICE = {"common": 50, "uncommon": 100, "rare": 175}          # pricingDefaults
FEATURED_ROTATION_WEEKS = 10                                  # one collection a week, 10 collections
HERD_PRIZES_PER_WEEK = 3                                      # K scarce winners per distribution
TICKET_CAP = 10                                               # tickets a player can hold per week
PITY_STEP, PITY_AFTER, PITY_CAP = 0.5, 2, 3.0                 # same curve as the Monday draw, on the rare tier

# ── behaviour knobs ──────────────────────────────────────────────────────────
P_ELIGIBLE = 0.55            # share of players who dug at least once in a week
DIGS_PER_WEEK = (0, 1, 2, 3, 4, 6)
DIGS_WEIGHTS = (0.45, 0.15, 0.13, 0.10, 0.10, 0.07)
NOTCHES_PER_WEEK = (0, 0, 0, 1, 1, 2)   # trough notches crossed (tickets)
VISIT_DAYS_PER_WEEK = (0, 0, 1, 2, 3, 5, 7)


def load_catalog():
    with open(EXPANSION) as f:
        d = json.load(f)
    paid = [i for i in d["items"] if i["acquisition"]["type"] == "snouts"]
    by_coll = {}
    for i in paid:
        by_coll.setdefault(i["collection"], []).append((i["id"], i["rarity"]))
    return by_coll


def roll_tier(rng: random.Random, weeks_since_rare: int) -> str:
    steps = max(0, weeks_since_rare - PITY_AFTER + 1)
    mult = min(PITY_CAP, 1 + PITY_STEP * steps)
    w = dict(TIER_WEIGHTS)
    w["rare"] *= mult
    total = sum(w.values())
    r = rng.random() * total
    for k, v in w.items():
        r -= v
        if r <= 0:
            return k
    return "common"


def everyones_draw(rng, owned: set, collection: list, weeks_since_rare: int):
    """Returns (item_id, rarity) or None when the collection is complete."""
    unowned = [(i, r) for i, r in collection if i not in owned]
    if not unowned:
        return None
    tier = roll_tier(rng, weeks_since_rare)
    order = {"common": ["common", "uncommon", "rare"], "uncommon": ["uncommon", "common", "rare"], "rare": ["rare", "uncommon", "common"]}[tier]
    for t in order:
        pool = [x for x in unowned if x[1] == t]
        if pool:
            return rng.choice(pool)
    return None


def simulate_player(rng, by_coll, weeks: int):
    colls = list(by_coll.keys())
    owned: set = set()
    since_rare = 0
    got, value, rare_hits, complete_week = 0, 0, 0, None
    for w in range(weeks):
        if rng.random() > P_ELIGIBLE:
            continue
        coll = by_coll[colls[w % len(colls)]]
        res = everyones_draw(rng, owned, coll, since_rare)
        if res is None:
            continue
        item, rarity = res
        owned.add(item)
        got += 1
        value += PRICE[rarity]
        if rarity == "rare":
            rare_hits += 1
            since_rare = 0
        else:
            since_rare += 1
        if complete_week is None and all(i in owned for i, _ in coll):
            complete_week = w + 1
    return got, value, rare_hits, complete_week, len(owned)


def tickets(rng) -> int:
    d = rng.choices(DIGS_PER_WEEK, DIGS_WEIGHTS)[0]
    n = rng.choice(NOTCHES_PER_WEEK)
    v = rng.choice(VISIT_DAYS_PER_WEEK)
    return min(TICKET_CAP, d + n + v)


def herd_prize_odds(rng, players: int, weeks: int):
    """Weighted lottery without replacement (Efraimidis–Spirakis): key = U^(1/w), top-K win."""
    wins_by_ticket = {}
    entries_by_ticket = {}
    for _ in range(weeks):
        ts = [tickets(rng) for _ in range(players)]
        keys = [(rng.random() ** (1.0 / t) if t > 0 else -1.0, i) for i, t in enumerate(ts)]
        keys.sort(reverse=True)
        winners = {i for _, i in keys[:HERD_PRIZES_PER_WEEK] if ts[i] > 0}
        for i, t in enumerate(ts):
            entries_by_ticket[t] = entries_by_ticket.get(t, 0) + 1
            if i in winners:
                wins_by_ticket[t] = wins_by_ticket.get(t, 0) + 1
    return {t: wins_by_ticket.get(t, 0) / n for t, n in sorted(entries_by_ticket.items()) if t > 0}


def main():
    global P_ELIGIBLE
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--players", type=int, default=2000)
    ap.add_argument("--weeks", type=int, default=30)
    ap.add_argument("--herd", type=int, default=400, help="players in one herd-prize lottery (the whole active base, or a shard)")
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    by_coll = load_catalog()
    n_paid = sum(len(v) for v in by_coll.values())
    print(f"catalog: {n_paid} for-sale designs in {len(by_coll)} collections · tiers {TIER_WEIGHTS} · prices {PRICE}")

    rows = [simulate_player(rng, by_coll, args.weeks) for _ in range(args.players)]
    got = [r[0] for r in rows]; val = [r[1] for r in rows]; rare = [r[2] for r in rows]
    completes = [r[3] for r in rows if r[3] is not None]
    print(f"\neveryone's draw · {args.weeks} weeks · eligibility {P_ELIGIBLE:.0%}")
    print(f"  designs per player per week   {statistics.fmean(got)/args.weeks:.2f}   (≈ {statistics.fmean(got):.1f} over {args.weeks} weeks)")
    print(f"  snout value per player per week {statistics.fmean(val)/args.weeks:.0f}  (vs a common at 50 · uncommon 100 · rare 175)")
    print(f"  rares per player per {args.weeks} weeks  {statistics.fmean(rare):.2f}")
    print(f"  players who completed a featured collection's 8 paid designs from draws alone: {len(completes)/len(rows):.0%}"
          + (f" (median week {statistics.median(completes):.0f})" if completes else ""))
    print(f"  designs owned after {args.weeks} weeks (draws only): median {statistics.median(r[4] for r in rows):.0f} of {n_paid}")
    # a weekly digger
    rng2 = random.Random(args.seed + 1)
    keep = P_ELIGIBLE; P_ELIGIBLE = 1.0
    wk = [simulate_player(rng2, by_coll, args.weeks) for _ in range(500)]
    P_ELIGIBLE = keep
    print(f"  a snout who digs EVERY week: {statistics.fmean(r[0] for r in wk):.1f} designs, {statistics.fmean(r[1] for r in wk):.0f} snouts of value, in {args.weeks} weeks")

    odds = herd_prize_odds(random.Random(args.seed + 2), args.herd, 200)
    print(f"\nherd prize · {HERD_PRIZES_PER_WEEK} winners a week among {args.herd} entrants · tickets capped at {TICKET_CAP}")
    for t, p in odds.items():
        print(f"  {t:>2} tickets → {p:.2%} a week  (1 in {1/p if p else float('inf'):.0f}) · expected wait {1/p/52 if p else float('inf'):.1f} years" if p else f"  {t:>2} tickets → 0 wins observed")
    lo, hi = min(odds), max(odds)
    print(f"  max-ticket vs 1-ticket player: {odds[hi]/odds[lo]:.1f}× the odds — linear in tickets by construction, capped by TICKET_CAP")


if __name__ == "__main__":
    main()
