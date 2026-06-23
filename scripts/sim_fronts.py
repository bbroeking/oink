#!/usr/bin/env python3
"""
Mud Wars — "Fronts of the Bog v2" Monte-Carlo verifier.

Resolves the four unproven quantitative claims from the design tournament
(docs/mudwar-clan-design.md, iter 2 open risks 1-4) with ground-truth sim:

  A. Is the contested-fronts allocation a GENUINE dilemma? (empty dominant set,
     maximin, best-response cycle) — Pillar 1.
  B. FRONT_SCALE tuning + the {scattered,coordinated}x{low,high skill} win matrix —
     does coordination amplify, does skill still win, do mirrors draw? — Pillars 2/3.
  C. P(active) calibration: a 3-active crew wins exactly 1 front (never locked out),
     a 5-active crew must concede ~1 — Pillar 3 (under-roster).

Faithful to the v2 spec: 7 throws/day, band mud 0/1/2/3, per-front per-member
contribution capped (CAP), smoothstep hold curve vs hidden P, head-to-head front
winner, front_margin -> separate coord_notch added to the base per-capita notch,
total clamped +/-5, rout at 12, 7-day week.
"""
import random, itertools
from statistics import mean

RNG = random.Random(20260618)

# Band distributions [whiff(0), weak(1), good(2), perfect(3)] by skill tier.
# Calibrated so per-player day mud lands in the brief's ~12-18 "effective" range.
SKILL = {
    "low":  [0.15, 0.25, 0.35, 0.25],   # mean ~1.70/throw -> ~11.9/day
    "high": [0.04, 0.11, 0.30, 0.55],   # mean ~2.36/throw -> ~16.5/day
}
BANDVAL = [0, 1, 2, 3]
THROWS = 7
DAY_CAP = 21
FRONTS = [("Truffle", 5), ("Bridge", 4), ("Gate", 3)]  # (name, value V)

def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def roll_player(skill):
    """Return (day_mud capped, mean_band) for one player's 7 throws."""
    dist = SKILL[skill]
    pts = RNG.choices(BANDVAL, weights=dist, k=THROWS)
    return min(sum(pts), DAY_CAP), mean(pts)

def resolve_fronts(alloc_a, alloc_b, skill_a, skill_b, Ps, cap, rng=RNG,
                   fronts=None, mode="margin"):
    """alloc_* = list of front-index per active member. Ps = hidden P per front.
    mode='margin': above the concede floor, the side with MORE effMud wins (true
    Blotto — extra mud keeps helping). mode='saturate': original v2 spec (smoothstep
    capped at V, both-over-P => tie). Returns (front_margin_a, V_won_a, V_won_b)."""
    fronts = fronts or FRONTS
    nF = len(fronts)
    def side(alloc, skill):
        eff = [0.0] * nF; bandsum = [0.0] * nF; bandcnt = [0] * nF
        for f in alloc:
            mud, mb = roll_player(skill)
            eff[f] += min(mud, cap)
            bandsum[f] += mb * THROWS; bandcnt[f] += THROWS
        meanband = [(bandsum[i] / bandcnt[i]) if bandcnt[i] else 0.0 for i in range(nF)]
        return eff, meanband
    eff_a, mb_a = side(alloc_a, skill_a)
    eff_b, mb_b = side(alloc_b, skill_b)
    won_a = won_b = 0; margin = 0
    for i, (_, V) in enumerate(fronts):
        P = Ps[i]; concede = 0.6 * P
        if eff_a[i] < concede and eff_b[i] < concede:
            continue  # both below the floor -> nobody banks
        if mode == "saturate":
            pa = V * smoothstep(eff_a[i] / P); pb = V * smoothstep(eff_b[i] / P)
            tie = abs(pa - pb) < 0.01 * V
            winner = ("a" if mb_a[i] >= mb_b[i] else "b") if tie else ("a" if pa > pb else "b")
        else:  # margin: more effMud wins; near-tie -> skill tiebreak
            tie = abs(eff_a[i] - eff_b[i]) < 1.0
            winner = ("a" if mb_a[i] >= mb_b[i] else "b") if tie else ("a" if eff_a[i] > eff_b[i] else "b")
        if winner == "a" and eff_a[i] < concede: continue
        if winner == "b" and eff_b[i] < concede: continue
        if winner == "a": won_a += V; margin += V
        else:             won_b += V; margin -= V
    return margin, won_a, won_b

# ── allocations ───────────────────────────────────────────────────────────────
def compositions(n, k):
    """All ordered non-negative k-tuples summing to n."""
    if k == 1:
        yield (n,); return
    for i in range(n + 1):
        for rest in compositions(n - i, k - 1):
            yield (i,) + rest

def comp_to_alloc(comp):
    a = []
    for f, c in enumerate(comp):
        a += [f] * c
    return a

def scattered_alloc(n_active, rng):
    return [rng.randrange(len(FRONTS)) for _ in range(n_active)]

def hidden_Ps(rng, base):
    """Hidden P per front with fuzzy jitter (+/-20%)."""
    return [b * rng.uniform(0.8, 1.2) for b in base]

# ════════════════════════════════════════════════════════════════════════════
# PART A — is the contested-front allocation a GENUINE dilemma?
# ════════════════════════════════════════════════════════════════════════════
def dilemma_report(fronts, N, base_P, cap, mode="margin", M=250, label=""):
    """Payoff matrix over all troop allocations; report dominance/maximin/BR-cycle."""
    comps = list(compositions(N, len(fronts)))
    payoff = {}
    for a in comps:
        aa = comp_to_alloc(a)
        for b in comps:
            bb = comp_to_alloc(b); tot = 0
            for _ in range(M):
                Ps = hidden_Ps(RNG, base_P)
                m, _, _ = resolve_fronts(aa, bb, "high", "high", Ps, cap,
                                         fronts=fronts, mode=mode)
                tot += m
            payoff[(a, b)] = tot / M
    dominant = [i for i in comps
                if all(all(payoff[(i, j)] >= payoff[(k, j)] - 1e-9 for k in comps) for j in comps)]
    always_wins = [i for i in comps if all(payoff[(i, j)] > 0.10 for j in comps)]
    never_loses = [i for i in comps if all(payoff[(i, j)] >= -0.10 for j in comps)]
    worst = {i: min(payoff[(i, j)] for j in comps) for i in comps}
    mm = max(worst, key=worst.get)
    BR = {j: max(comps, key=lambda i: payoff[(i, j)]) for j in comps}
    seen, cur, chain = set(), mm, []
    while cur not in seen:
        seen.add(cur); chain.append(cur); cur = BR[cur]
    cycle = chain[chain.index(cur):]
    genuine = (not dominant) and (not always_wins) and len(cycle) >= 2 and worst[mm] < 0.5
    print(f"  [{label}] V={[v for _,v in fronts]} N={N} mode={mode} P={base_P} cap={cap}")
    print(f"      dominant={dominant or 'NONE'}  always-wins={always_wins or 'EMPTY'}  "
          f"never-loses={never_loses or 'EMPTY'}")
    print(f"      maximin={mm} worst={worst[mm]:+.2f}  BR-cycle(len {len(cycle)})="
          f"{' -> '.join(map(str,cycle[:6]))}{'...' if len(cycle)>6 else ''}")
    print(f"      >> {'GENUINE DILEMMA' if genuine else 'SOLVED (dominant line)'}")
    return genuine

def part_A():
    print("=" * 78)
    print("PART A — GENUINE DILEMMA SEARCH (5 active, equal high skill)")
    print("  (refuted: 3 fronts + saturate-mode = (3,2,0) dominant. Searching fixes.)")
    dilemma_report(FRONTS, 5, (26,22,18), 12, mode="saturate", label="orig-spec")
    dilemma_report(FRONTS, 5, (26,22,18), 12, mode="margin",   label="3f-margin")
    dilemma_report([("F",5),("F",4),("F",3),("F",2)], 5, (30,26,22,18), 12,
                   mode="margin", label="4f-margin")
    dilemma_report([("F",4),("F",3),("F",3),("F",2),("F",2)], 5, (30,26,24,20,18), 14,
                   mode="margin", M=150, label="5f-mixedV")
    dilemma_report([("F",3),("F",3),("F",3),("F",3),("F",3)], 5, (26,24,24,22,22), 14,
                   mode="margin", M=150, label="5f-equalV")

# ════════════════════════════════════════════════════════════════════════════
# PART B — FRONT_SCALE tuning + win-rate matrix (Pillars 2 & 3)
# ════════════════════════════════════════════════════════════════════════════
def play_day(allocA, skillA, allocB, skillB, Ps, cap, FRONT_SCALE):
    margin, _, _ = resolve_fronts(allocA, allocB, skillA, skillB, Ps, cap)
    # base notch: per-capita margin / 5 clamped +/-4 (built path, uncapped per-capita)
    def per_cap(alloc, skill):
        muds = [roll_player(skill)[0] for _ in alloc]
        return sum(muds) / max(1, len(alloc))
    pcA, pcB = per_cap(allocA, skillA), per_cap(allocB, skillB)
    base = max(-4, min(4, round((pcA - pcB) / 5)))
    coord = max(-2, min(2, round(margin / FRONT_SCALE)))
    return max(-5, min(5, base + coord)), base, coord

def play_war(stratA, skillA, stratB, skillB, base_P, cap, FRONT_SCALE, days=7, rng=RNG):
    """strat: 'coord' (fixed focused plan, concede cheapest) or 'scatter' (random)
    or 'bestread' (best-respond to opp's plan) / 'misread' (worst-respond)."""
    rope = 0
    # a focused coordinated plan: 3 on Truffle(5), 2 on Bridge(4), concede Gate
    COORD = comp_to_alloc((3, 2, 0))
    COORD_ALT = comp_to_alloc((2, 3, 0))
    for d in range(days):
        Ps = hidden_Ps(rng, base_P)
        def alloc(strat, opp_plan):
            if strat == "scatter": return scattered_alloc(5, rng)
            if strat == "coord":   return COORD if d % 2 == 0 else COORD_ALT
            if strat == "bestread":
                # counter opp's known composition: pile where they're light
                cnt = [opp_plan.count(f) for f in range(3)]
                light = sorted(range(3), key=lambda f: cnt[f])  # fewest-defended first
                # 3 on lightest valuable, 2 on next
                order = sorted(light, key=lambda f: (-FRONTS[f][1] if cnt[f] <= 1 else 99))
                return [order[0]]*3 + [order[1]]*2
            if strat == "misread":
                return comp_to_alloc((0, 0, 5))  # dump everything on the cheap front
            return scattered_alloc(5, rng)
        planB = COORD if d % 2 == 0 else COORD_ALT
        allocA = alloc(stratA, planB)
        allocB = alloc(stratB, allocA)
        notch, _, _ = play_day(allocA, skillA, allocB, skillB, Ps, cap, FRONT_SCALE)
        rope += notch
        if abs(rope) >= 12:  # rout
            return 1 if rope > 0 else -1
    if rope > 0: return 1
    if rope < 0: return -1
    return 0

def winrate(stratA, skillA, stratB, skillB, base_P, cap, FS, N=600):
    w = d = 0
    for _ in range(N):
        r = play_war(stratA, skillA, stratB, skillB, base_P, cap, FS)
        if r == 1: w += 1
        elif r == 0: d += 1
    return w / N, d / N

def part_B(base_P=(26, 22, 18)):
    print("=" * 78)
    print("PART B — FRONT_SCALE sweep + win matrix")
    for cap in (12, 15):
        for FS in (3, 4, 5, 6):
            # constraint (a): best-read swings >=3 of +/-5 over a mis-reader, vs same coord opp
            swing = mean(play_day(
                comp_to_alloc((3,2,0)) if s=="b" else comp_to_alloc((0,0,5)),
                "high", comp_to_alloc((3,2,0)), "high", hidden_Ps(RNG, base_P), cap, FS)[0]
                for s in (["b"]*400 + ["m"]*0))  # best-read avg notch
            br_notch = mean(play_day(comp_to_alloc((2,3,0)), "high",
                                     comp_to_alloc((3,2,0)), "high",
                                     hidden_Ps(RNG, base_P), cap, FS)[0] for _ in range(400))
            mr_notch = mean(play_day(comp_to_alloc((0,0,5)), "high",
                                     comp_to_alloc((3,2,0)), "high",
                                     hidden_Ps(RNG, base_P), cap, FS)[0] for _ in range(400))
            swing = br_notch - mr_notch
            # (b) skilled-scattered vs unskilled-coordinated
            ss_vs_uc, _ = winrate("scatter", "high", "coord", "low", base_P, cap, FS, 500)
            # (c) mirror coordinated draw rate
            _, mirror_draw = winrate("coord", "high", "coord", "high", base_P, cap, FS, 500)
            # amplification: coordinated vs scattered, equal (high) skill
            coord_amp, _ = winrate("coord", "high", "scatter", "high", base_P, cap, FS, 500)
            ok = (swing >= 3) and (ss_vs_uc > 0.5) and (mirror_draw < 0.5)
            print(f"  cap={cap} FRONT_SCALE={FS}: read-swing={swing:+.2f}  "
                  f"coord>scatter winrate={coord_amp:.0%}  "
                  f"skilled-scatter>unskilled-coord={ss_vs_uc:.0%}  "
                  f"mirror-draw={mirror_draw:.0%}  {'<== PASS' if ok else ''}")

# ════════════════════════════════════════════════════════════════════════════
# PART C — under-roster lockout / P(active) calibration (Pillar 3)
# ════════════════════════════════════════════════════════════════════════════
def part_C(cap=12):
    print("=" * 78)
    print("PART C — under-roster: can a 3-active crew win exactly 1 front? does 5 concede ~1?")
    for base_P in [(26,22,18),(30,24,18),(24,20,16),(20,17,14)]:
        # 3-active best play: all-in the marquee
        Ps_fixed = base_P
        def trial(nA, allocA, nB, allocB, M=800):
            wsum = 0; per_front_wins=[0,0,0]
            for _ in range(M):
                Ps = hidden_Ps(RNG, base_P)
                _, wa, wb = resolve_fronts(allocA, allocB, "high", "high", Ps, cap)
                # count fronts won by A this draw
            # recount properly:
            fa=0
            for _ in range(M):
                Ps = hidden_Ps(RNG, base_P)
                m, wa, wb = resolve_fronts(allocA, allocB, "high","high",Ps,cap)
                fa += (wa>0) + (wa>=9) + (wa>=12)  # rough; recompute below
            return None
        # cleaner: average fronts-won count
        def fronts_won(nA_alloc, nB_alloc, M=800):
            cnt=0.0
            for _ in range(M):
                Ps=hidden_Ps(RNG, base_P)
                _, wa, wb = resolve_fronts(nA_alloc, nB_alloc, "high","high",Ps,cap)
                # number of fronts won = wa decomposed; easier: re-run counting
                cnt += wa
            return cnt/M  # mean V won
        # 3-active all on Truffle vs a 5-active spread (3,2,0)
        v3 = fronts_won(comp_to_alloc((3,0,0)), comp_to_alloc((2,2,1)))
        # 5-active (2,2,1) vs 5-active (2,2,1) mirror -> how much V each holds (concession check)
        v5 = fronts_won(comp_to_alloc((2,2,1)), comp_to_alloc((1,2,2)))
        # max possible for 3 all-in on marquee front value 5
        print(f"  base_P={base_P}: 3-active(all-marquee) mean V won={v3:.2f} "
              f"(marquee V=5 -> {'HOLDS 1' if v3>=2.5 else 'LOCKED OUT' if v3<1 else 'partial'});  "
              f"5v5 mean V won={v5:.2f} of 12 (concedes ~{(12-2*v5)/ (12) *3:.1f}/3 fronts net)")

if __name__ == "__main__":
    part_A()
    part_B()
    part_C()
