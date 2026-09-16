#!/usr/bin/env python3
"""Balance the Trough "notch drop" — the random tickle reward a chip earns when it
pushes a friend's Trough past a quarter mark (design: docs/design/claude-design/
shop-2026-09-16/, SKILL.md 2026-09-16).

The loop:  simulate → measure → score against the guardrails → nudge the drop
table → repeat until nothing improves.  Default policy is the POT rule (a Trough
holds max(4, cost/100) tickles; each notch spills a random share of what is left;
the filling notch empties it) — see docs/design/2026-09-16-trough-notch-balance.md
for why the fixed-table and slice rules were rejected.  It answers the two balance questions by
numbers instead of taste:

  Q1  replace the 1-per-100 credit, or stack the drop on top of it?
  Q2  credit the bank only, or the season's tickles_earned as well?
      (measured as tiebreak exposure: trough tickles as a share of a season's
       played tickles)

Server rules are modelled verbatim from
supabase/migrations/20260757000000_trough_quarter_cap_and_72h.sql:
  · opener seeds ceil(cost·0.10), no reward on the seed
  · per-donor cumulative cap ceil(cost·0.25); a chip is clamped to headroom and
    to the remaining gap; no headroom → refused
  · 12h cooldown per donor per drive; the drive closes after 72h (refunds if unfilled)
  · today's reward: floor(snouts_taken / 100), credited immediately to counter
    AND tickles_earned
Chip presets are 10 · 25 · 50 · Max (components/TroughSection.tsx).

Usage
  python3 tools/balance_trough_notch.py                # tune, print the report
  python3 tools/balance_trough_notch.py --drives 20000 --seed 7
  python3 tools/balance_trough_notch.py --write tools/balance/trough_notch.tuned.json

Everything player-behaviour-shaped is a knob at the top; the catalog prices are
the live ones (tools/balance/catalog_costs.json, read 2026-09-16).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import statistics
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
COSTS_PATH = os.path.join(HERE, "balance", "catalog_costs.json")

# ── server rules (verbatim) ──────────────────────────────────────────────────
SEED_FRAC = 0.10
DONOR_CAP_FRAC = 0.25
WINDOW_H = 72
COOLDOWN_H = 12
PRESETS = (10, 25, 50)
CURRENT_RATE = 100          # 1 tickle per 100 snouts, floored
CEILING_RATE = 100          # the 2026-07-20 bound: a Trough mints at most cost/100 (a 2,000-snout Trough ≤ 20)
MIN_DRIVE_CAP = 4           # knob: floor on that ceiling so a cheap Trough can still drop ~1 per notch (0 = pure cost/100)

def drive_cap(cost: int) -> int:
    return max(MIN_DRIVE_CAP, cost // CEILING_RATE)

# how the allowance is handed out
#   slice — each notch rolls a slice of the allowance independently; the drive total is clamped (can overshoot → clamp)
#   pot   — the allowance is a POT the Trough holds; each notch spills a random share of what is LEFT and the
#           filling notch empties it. Total ≤ allowance by construction, so nothing ever has to be clamped.
POLICY = "pot"
NOTCHES = (0.25, 0.50, 0.75, 1.00)

# ── behaviour knobs (assumptions — change them, rerun) ───────────────────────
DONOR_POOL = ((2, 0.10), (3, 0.20), (4, 0.30), (5, 0.20), (6, 0.12), (8, 0.08))  # friends who could chip
P_CHIP_PER_SLOT = 0.35      # a willing donor chips in a given 12h slot with this prob
PRESET_WEIGHTS = (0.35, 0.35, 0.20, 0.10)   # 10 · 25 · 50 · Max
WALLET_MEDIAN = 300         # snouts a donor has on hand (lognormal)
WALLET_SIGMA = 0.8
MAX_ITEM_COST = 1500        # friends rarely open Troughs on 3,000–5,500 members items; cap the sample
# season-scale exposure (Q2)
DRIVES_CHIPPED_PER_SEASON = 6   # drives one player chips into over a season
SEASON_PLAYED_TICKLES = 400     # tickles a regular player PLAYS in a season (tickles_earned from taps)


def load_costs() -> list[tuple[int, int]]:
    with open(COSTS_PATH) as f:
        rows = json.load(f)["rows"]
    out = [(r["cost"], r["n"]) for r in rows if r["cost"] <= MAX_ITEM_COST]
    if not out:
        raise SystemExit(f"no costs ≤ {MAX_ITEM_COST} in {COSTS_PATH}")
    return out


@dataclass
class DropTable:
    """The notch drop is a SLICE of the Trough's own allowance (max(MIN_DRIVE_CAP, cost/100)):
    per notch crossed, a random integer between lo/8 and hi/8 of the allowance, plus a
    bonus slice on the notch that fills the Trough. Eighths keep the search integer.
    A 120-snout Trough (allowance 4) with [2–6]/8 drops 1–3 a notch; a 1,200-snout one
    (allowance 12) drops 3–9. These three eighths are what the server config carries."""
    lo: int = 2
    hi: int = 6
    final_bonus: int = 0

    def roll(self, rng: random.Random, notch_index: int, allowance: int) -> int:
        a, b = round(allowance * self.lo / 8), round(allowance * self.hi / 8)
        n = rng.randint(a, b) if b >= a else 0
        if notch_index == len(NOTCHES) - 1:
            n += round(allowance * self.final_bonus / 8)
        return n

    def as_config(self) -> dict:
        return {"lo_eighths": self.lo, "hi_eighths": self.hi, "final_bonus_eighths": self.final_bonus, "allowance": f"max({MIN_DRIVE_CAP}, cost/{CEILING_RATE})"}


@dataclass
class DriveResult:
    cost: int
    funded: bool
    donors: int
    donors_who_chipped: int
    chips: int
    snouts_taken: int
    mint_current: int            # today's floor(snouts/100), summed over chips
    mint_notch: int              # notch drops, pre-cap
    mint_notch_capped: int       # notch drops after the per-drive cap
    chips_with_drop: int
    per_donor_notch: list[int] = field(default_factory=list)
    per_donor_current: list[int] = field(default_factory=list)


def simulate_drive(rng: random.Random, cost: int, table: DropTable) -> DriveResult:
    seed = math.ceil(cost * SEED_FRAC)
    donor_cap = math.ceil(cost * DONOR_CAP_FRAC)
    raised = min(seed, cost)
    n_donors = rng.choices([d for d, _ in DONOR_POOL], [w for _, w in DONOR_POOL])[0]
    wallets = [int(rng.lognormvariate(math.log(WALLET_MEDIAN), WALLET_SIGMA)) for _ in range(n_donors)]
    given = [0] * n_donors
    last_chip_h = [-1e9] * n_donors
    notch_current = [0] * n_donors
    notch_drop = [0] * n_donors
    chips = chips_with_drop = 0
    pot = drive_cap(cost)
    notches_passed = sum(1 for f in NOTCHES if raised >= cost * f)   # the seed never passes one (10%)
    slots = WINDOW_H // COOLDOWN_H
    for slot in range(slots):
        if raised >= cost:
            break
        hour = slot * COOLDOWN_H
        order = list(range(n_donors))
        rng.shuffle(order)
        for i in order:
            if raised >= cost:
                break
            if hour - last_chip_h[i] < COOLDOWN_H:
                continue
            if rng.random() > P_CHIP_PER_SLOT:
                continue
            headroom = donor_cap - given[i]
            gap = cost - raised
            if headroom <= 0 or gap <= 0:
                continue
            pick = rng.choices(range(4), PRESET_WEIGHTS)[0]
            want = min(headroom, gap) if pick == 3 else PRESETS[pick]
            want = min(want, wallets[i])
            if want <= 0:
                continue
            taken = min(want, gap, headroom)
            before = raised
            raised += taken
            given[i] += taken
            wallets[i] -= taken
            last_chip_h[i] = hour
            chips += 1
            notch_current[i] += taken // CURRENT_RATE
            # notches crossed by THIS chip
            crossed = [k for k, f in enumerate(NOTCHES) if before < cost * f <= raised]
            if POLICY == "pot":
                drop = 0
                for k in crossed:
                    d = pot if k == len(NOTCHES) - 1 else table.roll(rng, k, pot)
                    d = min(d, pot)
                    pot -= d
                    drop += d
            else:
                drop = sum(table.roll(rng, k, drive_cap(cost)) for k in crossed)
            if drop > 0:
                chips_with_drop += 1
            notch_drop[i] += drop
            notches_passed += len(crossed)
    total_notch = sum(notch_drop)
    capped = min(total_notch, drive_cap(cost))
    return DriveResult(
        cost=cost, funded=raised >= cost, donors=n_donors,
        donors_who_chipped=sum(1 for g in given if g > 0), chips=chips,
        snouts_taken=sum(given), mint_current=sum(notch_current), mint_notch=total_notch,
        mint_notch_capped=capped, chips_with_drop=chips_with_drop,
        per_donor_notch=[d for d, g in zip(notch_drop, given) if g > 0],
        per_donor_current=[c for c, g in zip(notch_current, given) if g > 0],
    )


@dataclass
class Metrics:
    drives: int
    funded_rate: float
    mean_current: float          # today's mint per drive (all drives)
    mean_notch: float            # notch mint per drive, pre-cap
    mean_notch_capped: float
    p_over_cap: float            # share of drives whose notch mint exceeded the cap before clamping
    max_notch: int
    drop_rate: float             # share of chips that dropped something
    donor_zero_rate: float       # share of chipping donors who got nothing from the drive (notch policy)
    donor_zero_rate_current: float
    per_donor_mean_notch: float
    per_donor_mean_current: float
    rate_per_100_current: float  # tickles per 100 snouts actually taken
    rate_per_100_notch: float
    budget_ratio: float          # notch mint ÷ current mint (context only)
    ceiling_ratio: float         # mean over FUNDED drives of notch mint ÷ that drive's cap (1.0 = the whole allowance)
    mean_notch_funded: float     # notch mint per FUNDED drive, after the cap
    mean_drop: float             # tickles per drop that landed


def measure(results: list[DriveResult]) -> Metrics:
    n = len(results)
    chips = sum(r.chips for r in results) or 1
    snouts = sum(r.snouts_taken for r in results) or 1
    donors_n = [d for r in results for d in r.per_donor_notch]
    donors_c = [d for r in results for d in r.per_donor_current]
    cur = sum(r.mint_current for r in results)
    notch = sum(r.mint_notch_capped for r in results)
    return Metrics(
        drives=n,
        funded_rate=sum(r.funded for r in results) / n,
        mean_current=cur / n,
        mean_notch=sum(r.mint_notch for r in results) / n,
        mean_notch_capped=notch / n,
        p_over_cap=sum(r.mint_notch > drive_cap(r.cost) for r in results) / n,
        max_notch=max(r.mint_notch for r in results),
        drop_rate=sum(r.chips_with_drop for r in results) / chips,
        donor_zero_rate=(sum(1 for d in donors_n if d == 0) / len(donors_n)) if donors_n else 1.0,
        donor_zero_rate_current=(sum(1 for d in donors_c if d == 0) / len(donors_c)) if donors_c else 1.0,
        per_donor_mean_notch=statistics.fmean(donors_n) if donors_n else 0.0,
        per_donor_mean_current=statistics.fmean(donors_c) if donors_c else 0.0,
        rate_per_100_current=100 * cur / snouts,
        rate_per_100_notch=100 * notch / snouts,
        budget_ratio=(notch / cur) if cur else float("inf"),
        ceiling_ratio=statistics.fmean([r.mint_notch_capped / drive_cap(r.cost) for r in results if r.funded]) if any(r.funded for r in results) else 0.0,
        mean_notch_funded=statistics.fmean([r.mint_notch_capped for r in results if r.funded]) if any(r.funded for r in results) else 0.0,
        mean_drop=(sum(r.mint_notch for r in results) / sum(r.chips_with_drop for r in results)) if any(r.chips_with_drop for r in results) else 0.0,
    )


# ── the guardrails the loop scores against ───────────────────────────────────
CEIL_LO, CEIL_HI = 0.55, 1.0       # a funded Trough spends 55–100% of its allowance (cost/100, floored at MIN_DRIVE_CAP)
MAX_P_OVER_CAP = 0.05              # the server clamp should rarely have to bite
MAX_DONOR_ZERO = 0.70              # reported more than enforced: four notches among 4–8 donors means most chips cross nothing
MIN_SURPRISE = 2                   # hi − lo ≥ 2, or it is a rate wearing a costume
MAX_MEAN_DROP = 5                  # a 'handful' — a drop that averages more than this is a payout, not a surprise
MIN_MEAN_DROP = 1.0                # …and one that averages under a tickle is a coin flip for nothing


def score(m: Metrics, t: DropTable) -> tuple[float, list[str]]:
    """Higher is better; 0 means every guardrail holds. Returns (score, violations)."""
    s = 0.0
    why: list[str] = []
    if m.ceiling_ratio < CEIL_LO:
        s -= 10 * (CEIL_LO - m.ceiling_ratio); why.append(f"spends only {m.ceiling_ratio:.0%} of the allowance")
    elif m.ceiling_ratio > CEIL_HI:
        s -= 10 * (m.ceiling_ratio - CEIL_HI); why.append(f"over the allowance ({m.ceiling_ratio:.0%})")
    if m.p_over_cap > MAX_P_OVER_CAP:
        s -= 20 * (m.p_over_cap - MAX_P_OVER_CAP); why.append(f"cap clamps {m.p_over_cap:.1%} of drives")
    if m.mean_drop > MAX_MEAN_DROP:
        s -= 2 * (m.mean_drop - MAX_MEAN_DROP); why.append(f"drops average {m.mean_drop:.1f} — a payout, not a handful")
    if m.mean_drop < MIN_MEAN_DROP:
        s -= 2 * (MIN_MEAN_DROP - m.mean_drop); why.append(f"drops average {m.mean_drop:.1f} — too often nothing")
    if m.donor_zero_rate > MAX_DONOR_ZERO:
        s -= 5 * (m.donor_zero_rate - MAX_DONOR_ZERO); why.append(f"{m.donor_zero_rate:.0%} of donors get nothing")
    if t.hi - t.lo < MIN_SURPRISE:
        s -= 1.0; why.append("not enough surprise (hi − lo < 2)")
    return s, why


def run(table: DropTable, costs, drives: int, seed: int) -> Metrics:
    rng = random.Random(seed)
    pool = [c for c, _ in costs]
    weights = [n for _, n in costs]
    return measure([simulate_drive(rng, rng.choices(pool, weights)[0], table) for _ in range(drives)])


def neighbours(t: DropTable):
    if POLICY == "pot":
        for dlo, dhi in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1)):
            lo, hi = t.lo + dlo, t.hi + dhi
            if 0 <= lo <= hi <= 8:
                yield DropTable(lo, hi, 0)
        return
    for dlo, dhi, db in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1), (1, 1, 0), (-1, -1, 0)):
        lo, hi, b = t.lo + dlo, t.hi + dhi, t.final_bonus + db
        if 0 <= lo <= hi <= 16 and 0 <= b <= 8:
            yield DropTable(lo, hi, b)


def tune(costs, drives: int, seed: int, start: DropTable, max_iters: int = 30, verbose=True):
    """Coordinate hill-climb on the integer drop table. Each iteration evaluates every
    neighbour on the same seed (common random numbers) and moves to the best; stops
    when no neighbour improves or every guardrail already holds."""
    cur = start
    cur_m = run(cur, costs, drives, seed)
    cur_s, cur_why = score(cur_m, cur)
    history = [(cur, cur_m, cur_s, cur_why)]
    for it in range(1, max_iters + 1):
        if verbose:
            print(f"  iter {it:02d}  [{cur.lo}–{cur.hi}]/8 +{cur.final_bonus}/8  score={cur_s:+.3f}  "
                  f"allowance={cur_m.ceiling_ratio:.0%}  mint/funded={cur_m.mean_notch_funded:.2f}  drop≈{cur_m.mean_drop:.1f}  zero={cur_m.donor_zero_rate:.0%}  "
                  f"clamp={cur_m.p_over_cap:.1%}  {'OK' if not cur_why else '; '.join(cur_why)}")
        if cur_s >= 0:
            break
        best = None
        for cand in neighbours(cur):
            m = run(cand, costs, drives, seed)
            s, why = score(m, cand)
            if best is None or s > best[2]:
                best = (cand, m, s, why)
        if best is None or best[2] <= cur_s:
            break
        cur, cur_m, cur_s, cur_why = best
        history.append(best)
    return cur, cur_m, cur_s, cur_why, history


def fmt_policy_table(m: Metrics, table: DropTable) -> str:
    stack_mean = m.mean_current + m.mean_notch_capped
    stack_rate = m.rate_per_100_current + m.rate_per_100_notch
    rows = [
        ("policy", "mint / drive", "per 100 snouts", "per donor", "donors w/ 0", "share of chips rewarded"),
        ("today · floor(snouts/100)", f"{m.mean_current:.2f}", f"{m.rate_per_100_current:.2f}", f"{m.per_donor_mean_current:.2f}", f"{m.donor_zero_rate_current:.0%}", "—"),
        (f"notch drop · replace  [{table.lo}–{table.hi}]/8 of allowance +{table.final_bonus}/8", f"{m.mean_notch_capped:.2f}", f"{m.rate_per_100_notch:.2f}", f"{m.per_donor_mean_notch:.2f}", f"{m.donor_zero_rate:.0%}", f"{m.drop_rate:.0%}"),
        ("stack · today + notch drop", f"{stack_mean:.2f}", f"{stack_rate:.2f}", f"{m.per_donor_mean_current + m.per_donor_mean_notch:.2f}", "—", "—"),
    ]
    w = [max(len(r[i]) for r in rows) for i in range(len(rows[0]))]
    return "\n".join("  " + "  ".join(c.ljust(w[i]) for i, c in enumerate(r)) for r in rows)


def exposure(m: Metrics) -> str:
    """Q2 — tiebreak exposure if the credit ALSO lands in tickles_earned."""
    per_season_notch = DRIVES_CHIPPED_PER_SEASON * m.per_donor_mean_notch
    per_season_current = DRIVES_CHIPPED_PER_SEASON * m.per_donor_mean_current
    return (
        f"  a player who chips into {DRIVES_CHIPPED_PER_SEASON} drives a season would bank ≈ {per_season_notch:.1f} notch tickles "
        f"(today: {per_season_current:.1f}) — {per_season_notch / SEASON_PLAYED_TICKLES:.1%} of the {SEASON_PLAYED_TICKLES} "
        f"tickles a regular player plays in a season (today: {per_season_current / SEASON_PLAYED_TICKLES:.1%})."
    )


def main():
    global MIN_DRIVE_CAP, POLICY
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--drives", type=int, default=8000, help="drives simulated per evaluation")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--start", type=str, default="2,6,0", help="starting drop table lo,hi,final_bonus in eighths of the allowance")
    ap.add_argument("--write", type=str, default=None, help="write the tuned table as JSON (server-config shape)")
    ap.add_argument("--validate-seeds", type=int, default=3, help="re-check the winner on this many fresh seeds")
    ap.add_argument("--policy", choices=("pot", "slice"), default="pot", help="pot: notches spill a share of what is left of the Trough's allowance (never clamps); slice: independent slices, clamped")
    ap.add_argument("--min-cap", type=int, default=None, help=f"override MIN_DRIVE_CAP (default {MIN_DRIVE_CAP}; 0 = pure cost/100)")
    args = ap.parse_args()

    if args.min_cap is not None:
        MIN_DRIVE_CAP = args.min_cap
    POLICY = args.policy
    print(f"policy: {POLICY}")
    costs = load_costs()
    lo, hi, b = (int(x) for x in args.start.split(","))
    start = DropTable(lo, hi, b)
    n_items = sum(n for _, n in costs)
    print(f"catalog: {n_items} items ≤ {MAX_ITEM_COST} snouts from {COSTS_PATH}")
    print(f"guardrails: a funded Trough spends {CEIL_LO:.0%}–{CEIL_HI:.0%} of max({MIN_DRIVE_CAP}, cost/{CEILING_RATE}) · clamp < {MAX_P_OVER_CAP:.0%} · donors-with-nothing ≤ {MAX_DONOR_ZERO:.0%} · hi−lo ≥ {MIN_SURPRISE} · mean drop ≤ {MAX_MEAN_DROP}")
    print("\ntuning loop")
    table, m, s, why, hist = tune(costs, args.drives, args.seed, start)

    print("\nwinner:", table.as_config(), "—", "every guardrail holds" if not why else "; ".join(why))
    print(f"  funded rate {m.funded_rate:.0%} · mint per funded drive {m.mean_notch_funded:.2f} · max pre-cap on one drive {m.max_notch}")
    print("\nQ1 · replace or stack?")
    print(fmt_policy_table(m, table))
    stack_ratio = (m.mean_current + m.mean_notch_capped) / m.mean_current if m.mean_current else float("inf")
    print(f"  → today's rule pays {m.mean_current:.2f} a drive at the presets (floor(snouts/100) is 0 under 100 snouts), so stacking adds "
          f"{m.mean_current:.2f}/drive (notch alone is {m.budget_ratio:.1f}× today). The cost of stacking is the second sentence, not the tickles.")
    print("\nQ2 · bank only, or tickles_earned too?")
    print(exposure(m))
    print("  → bank-only: zero tiebreak exposure by construction. Earned-too: the line above is what a Trough can add to Most Tickles.")

    if args.validate_seeds:
        print(f"\nvalidation on {args.validate_seeds} fresh seeds")
        for k in range(args.validate_seeds):
            mv = run(table, costs, args.drives, args.seed + 100 + k)
            sv, whyv = score(mv, table)
            print(f"  seed {args.seed + 100 + k}: allowance {mv.ceiling_ratio:.0%}  mint/funded {mv.mean_notch_funded:.2f}  zero {mv.donor_zero_rate:.0%}  clamp {mv.p_over_cap:.1%}  {'OK' if not whyv else '; '.join(whyv)}")

    if args.write:
        out = {
            "notch_drop": {"policy": POLICY, "lo_eighths": table.lo, "hi_eighths": table.hi, "final_bonus_eighths": table.final_bonus, "ceiling_rate": CEILING_RATE, "min_drive_cap": MIN_DRIVE_CAP,
                           "rule": ("pot: P = max(min_drive_cap, floor(cost/ceiling_rate)) tickles held by the Trough; a notch crossed spills randint(round(P_left*lo/8), round(P_left*hi/8)); the filling notch spills the rest" if POLICY == "pot" else "slice: per notch randint(round(A*lo/8), round(A*hi/8)), A = max(min_drive_cap, floor(cost/ceiling_rate)); the filling notch adds round(A*final_bonus/8); drive total clamped to A")},
            "notches": list(NOTCHES),
            "replaces_rate_per_100": True,
            "credit": "bank",
            "tuned": {"drives": args.drives, "seed": args.seed, "ceiling_ratio": round(m.ceiling_ratio, 3), "mean_notch_funded": round(m.mean_notch_funded, 3), "mean_drop": round(m.mean_drop, 2),
                      "drop_rate": round(m.drop_rate, 3), "donor_zero_rate": round(m.donor_zero_rate, 3),
                      "p_over_cap": round(m.p_over_cap, 4)},
            "assumptions": {"donor_pool": DONOR_POOL, "p_chip_per_slot": P_CHIP_PER_SLOT, "preset_weights": PRESET_WEIGHTS,
                            "wallet_median": WALLET_MEDIAN, "max_item_cost": MAX_ITEM_COST,
                            "drives_chipped_per_season": DRIVES_CHIPPED_PER_SEASON, "season_played_tickles": SEASON_PLAYED_TICKLES},
        }
        os.makedirs(os.path.dirname(args.write) or ".", exist_ok=True)
        with open(args.write, "w") as f:
            json.dump(out, f, indent=1)
        print(f"\nwrote {args.write}")


if __name__ == "__main__":
    main()
