#!/usr/bin/env python3
"""
Songs of the Bog — deploy-Blotto + rhythm Monte-Carlo verifier (P0 gate).

Validates the NEW claims the rhythm redesign rests on (docs/mudwar-rhythm-design.md),
before any migration code is written:

  A. Is the HIDDEN DEPLOYMENT a meaningful, non-dominant decision?
     - RELEVANCE: does the deployed difficulty actually swing held-V (else it's flavour)?
     - DILEMMA: does the deploy x defense matrix have NO pure saddle / dominant line, and
       is the attacker's best deployment NON-CONSTANT across where the defender hides
       weak players? (Pillar 1)
  B. Does coordination still AMPLIFY with the short-run summed model, and does SKILL
     still win? (Pillars 2/3)
  C. Under-roster: a 3-active crew degrades gracefully, never auto-locked-out. (Pillar 3)

THE CORRECTED MODEL (the fix to the synthesis's "difficulty is cosmetic-only" flaw):
  Difficulty does NOT change a hit's VALUE (a perfect is always worth 3 -> the FLOOR is
  flat and the skill ceiling is preserved). Difficulty does two things to the rope: it
  (a) TIGHTENS the timing windows a little (so a weak defender leaks more), and primarily
  (b) RAISES the area's HOLD-PRESSURE -- the bar of banked mud needed to hold the area.
  A hard wave on the marquee raises its bar past what two capped members can cover, so the
  defender must commit a THIRD body there (concentration) -- or a skilled crew clears it
  with fewer. The deploy is therefore a READ: aim your single 'hard' where they're thin or
  weak to deny an area; your single 'easy' is a cheap gift elsewhere. The rope still moves
  only on normalized band-mud (base per-capita notch + coord held-V notch). The +2/+3/+4 /
  -4/-6/-8 snout numbers are the separate COSMETIC coffer; they never touch the rope and are
  not modelled here.

Reuses the Fronts substrate verbatim: per-member-per-area cap = 12, concede floor 0.6*P,
hidden P jitter, V=[5,4,3], FRONT_SCALE=4, coord_notch clamp +/-2, rout 12. The rhythm run
just replaces the throw as the band source.
"""
import random
from statistics import mean
from itertools import permutations, product

import os
RNG = random.Random(int(os.environ.get("SIM_SEED", "20260618")))

# ── rhythm timing model ──────────────────────────────────────────────────────
# Per-note timing error e = |N(0, sigma_skill)| ms. Band by which window e falls in.
# sigma by skill (smaller = sharper). Calibrated so skill expresses in per-capita mud.
SIGMA = {"high": 34.0, "med": 64.0, "low": 108.0}

# Base windows (ms) = temporal analogs of SlopToss GOLD/GREEN/WEAK half-widths (45/90/150).
BASE_WIN = (45.0, 90.0, 150.0)  # perfect, good, weak ; beyond weak = leak (whiff)

# Difficulty (a) mildly tightens the windows (skill expression) and (b) -- primarily --
# raises the area's HOLD-PRESSURE (the bar to clear). Both tuned until the dilemma holds.
DIFF_MULT = {"easy": 1.30, "med": 1.0, "hard": 0.82}   # window multiplier
PRESS = {"easy": 0.80, "med": 1.0, "hard": 1.30}       # hold-pressure multiplier on P

NOTES_PER_RUN = 3
RUNS_PER_DAY = 2          # baseline Hold-day budget (access token can add 1; not in the floor)
BANDVAL = [0, 1, 2, 3]    # leak, weak, good, perfect
CAP = 12                  # per-member-per-area (reused PER_FRONT_CAP)
BASE_P = (26.0, 22.0, 18.0)
V = (5, 4, 3)             # Truffle, Bridge, Gate
FRONT_SCALE = 4
# Hold-pressure coefficient (Fronts used 0.6 as the concede floor). Tuned so a HARD wave on
# the marquee needs 3 bodies (2*cap=24 < 0.78*26*1.30 = 26.4) while MED needs only 2 — this
# is what makes pre-stacking 3 (concentration) pay off when you read the hard wave correctly.
HOLD_COEF = 0.78

def note_band(sigma, mult):
    """One note: sample timing error, classify into a band value 0..3."""
    e = abs(RNG.gauss(0.0, sigma))
    wp, wg, ww = (w * mult for w in BASE_WIN)
    if e <= wp: return 3
    if e <= wg: return 2
    if e <= ww: return 1
    return 0  # leak

def roll_member(skill, diff, runs=RUNS_PER_DAY):
    """A member's banked day-mud on an area (capped) + mean band, under a difficulty."""
    sigma = SIGMA[skill]; mult = DIFF_MULT[diff]
    pts = [note_band(sigma, mult) for _ in range(runs * NOTES_PER_RUN)]
    return min(sum(pts), CAP), (mean(pts) if pts else 0.0)

def hidden_Ps(base):
    return [b * RNG.uniform(0.8, 1.2) for b in base]

# ── one day's resolve: each crew defends its OWN 3 areas under the OPPONENT's deploy ──
# assignment = list of (area_index or None) per member skill; deploy = (d0,d1,d2) one per area.
def held_value(roster, assignment, deploy, Ps):
    """Defend 3 areas vs the opponent's deployed difficulties. Returns (held_V, total_banked,
    n_active). An area is HELD (banks V) iff banked mud >= P_i * PRESS[difficulty] (the
    hold-pressure raised by a harder wave). 0.6 keeps the concede-floor spirit of Fronts."""
    area_mud = [0.0, 0.0, 0.0]; active = 0
    for skill, area in zip(roster, assignment):
        if area is None: continue
        active += 1
        mud, _ = roll_member(skill, deploy[area])
        area_mud[area] += min(mud, CAP)
    hv = 0
    for i in range(3):
        pressure = HOLD_COEF * Ps[i] * PRESS[deploy[i]]
        if area_mud[i] >= pressure:
            hv += V[i]
    return hv, sum(area_mud), active

def per_capita(total, active):
    return total / max(1, active)

def day_notch(rosterA, asgA, deployB, rosterB, asgB, deployA, Ps):
    """Faithful to the built rope: base per-capita notch (+/-4) + coord held-V notch (+/-2),
    total clamped +/-5. A defends its areas under B's deploy, and vice-versa."""
    hvA, tA, nA = held_value(rosterA, asgA, deployB, Ps)
    hvB, tB, nB = held_value(rosterB, asgB, deployA, Ps)
    base = max(-4, min(4, round((per_capita(tA, nA) - per_capita(tB, nB)) / 5)))
    coord = max(-2, min(2, round((hvA - hvB) / FRONT_SCALE)))
    return max(-5, min(5, base + coord)), hvA, hvB

# ── strategy spaces ──────────────────────────────────────────────────────────
DEPLOYS = list(permutations(("easy", "med", "hard")))  # 6 bijections onto areas 0,1,2

def skill_fill(comp, roster_sorted):
    """Given a composition (n0,n1,n2) of members across areas, fill strongest-first per the
    list order. roster_sorted is the roster; returns an assignment list aligned to roster_sorted."""
    asg = [None] * len(roster_sorted)
    idx = 0
    for area, n in enumerate(comp):
        for _ in range(n):
            if idx < len(roster_sorted):
                asg[idx] = area; idx += 1
    return asg

def compositions(n, k):
    if k == 1:
        yield (n,); return
    for i in range(n + 1):
        for rest in compositions(n - i, k - 1):
            yield (i,) + rest

# ════════════════════════════════════════════════════════════════════════════
# PART A — deployment RELEVANCE + DILEMMA
# ════════════════════════════════════════════════════════════════════════════
def expected_hv(roster, assignment, deploy, M=400):
    return mean(held_value(roster, assignment, deploy, hidden_Ps(BASE_P))[0] for _ in range(M))

def part_A():
    print("=" * 80)
    print("PART A — is the hidden DEPLOYMENT meaningful AND non-dominant? (Pillar 1)")
    print(f"  windows={BASE_WIN}  DIFF_MULT={DIFF_MULT}  SIGMA={SIGMA}  P={BASE_P} V={V} cap={CAP}")

    # Per-member expected banked mud table (skill x difficulty) — the engine of the read.
    print("\n  per-member E[banked mud] (cap 12), by skill x difficulty:")
    for sk in ("high", "med", "low"):
        row = "   ".join(f"{d}={mean(roll_member(sk, d)[0] for _ in range(3000)):4.1f}" for d in ("easy","med","hard"))
        print(f"      {sk:>4}:  {row}")

    # A roster with a readable weak spot: 2 aces, 1 mid, 2 weak.
    roster = ["high", "high", "med", "low", "low"]
    # Three archetypal defenses (strongest-first fill): stack marquee / balanced / spread.
    defs = {
        "stack(3,2,0)": skill_fill((3, 2, 0), roster),   # aces+mid on Truffle, 2 weak on Bridge, concede Gate
        "balanced(2,2,1)": skill_fill((2, 2, 1), roster),
        "spread(1,2,2)": skill_fill((1, 2, 2), roster),
    }

    # RELEVANCE: for each defense, how much does held-V swing across the 6 deploys?
    print("\n  RELEVANCE — held-V the defender keeps, best vs worst opposing deploy:")
    swings = []
    best_deploy_by_def = {}
    for name, asg in defs.items():
        hv = {dp: expected_hv(roster, asg, dp) for dp in DEPLOYS}
        worst_for_def = min(hv.values()); best_for_def = max(hv.values())
        # attacker MINIMISES the defender's held-V -> attacker's best deploy = argmin
        atk_best = min(hv, key=hv.get)
        best_deploy_by_def[name] = atk_best
        swing = best_for_def - worst_for_def
        swings.append(swing)
        # which area got 'hard' in the attacker's best deploy
        hard_area = atk_best.index("hard")
        print(f"      {name:>16}: held-V {worst_for_def:4.1f}..{best_for_def:4.1f}  swing={swing:4.1f}  "
              f"attacker best -> hard@area{hard_area} (V={V[hard_area]})")
    # Relevant if the deploy moves held-V by ~half-an-area on average and >= a notch everywhere.
    relevant = (mean(swings) >= 2.0) and (min(swings) >= 1.5)
    print(f"      >> deploy RELEVANT (mean swing {mean(swings):.1f}>=2.0, min {min(swings):.1f}>=1.5): {relevant}")

    # NON-CONSTANT best deployment across defender placement (the read).
    hard_targets = {n: dp.index("hard") for n, dp in best_deploy_by_def.items()}
    non_constant = len(set(hard_targets.values())) >= 2
    print(f"      attacker's best hard-target by defense: {hard_targets}")
    print(f"      >> best deploy NON-CONSTANT across defender placement: {non_constant}")

    # DILEMMA: build the deploy(attacker, 6) x defense(defender, all sensible comps) matrix,
    # payoff = defender's expected held-V. Check for a pure saddle / dominant line.
    comps = [c for c in compositions(5, 3)]  # 21 compositions, incl. concedes (a 0)
    def_asgs = {c: skill_fill(c, roster) for c in comps}
    # payoff[deploy][comp] = defender held-V (attacker wants LOW, defender wants HIGH)
    M = 250
    payoff = {dp: {c: expected_hv(roster, def_asgs[c], dp, M=M) for c in comps} for dp in DEPLOYS}
    # Defender best response to each deploy; attacker best response to each comp.
    def_BR = {dp: max(comps, key=lambda c: payoff[dp][c]) for dp in DEPLOYS}
    atk_BR = {c: min(DEPLOYS, key=lambda dp: payoff[dp][c]) for c in comps}
    # Pure-strategy saddle: a (dp,c) where dp=atk_BR[c] and c=def_BR[dp].
    saddles = [(dp, c) for dp in DEPLOYS for c in comps
               if atk_BR[c] == dp and def_BR[dp] == c]
    # Dominant deploy for the attacker (a single deploy that minimises held-V for EVERY comp).
    dom_deploy = [dp for dp in DEPLOYS
                  if all(all(payoff[dp][c] <= payoff[dp2][c] + 1e-9 for dp2 in DEPLOYS) for c in comps)]
    # Dominant defense for the defender (a comp that maximises held-V for EVERY deploy).
    dom_def = [c for c in comps
               if all(all(payoff[dp][c] >= payoff[dp][c2] - 1e-9 for c2 in comps) for dp in DEPLOYS)]
    # Best-response cycle length from an arbitrary start.
    seen, cur, chain = set(), comps[0], []
    while cur not in seen:
        seen.add(cur); chain.append(cur)
        cur = def_BR[atk_BR[cur]]
    cyc = chain[chain.index(cur):]
    genuine = (not dom_deploy) and (not dom_def) and non_constant and relevant and len(cyc) >= 2
    print(f"\n  DILEMMA matrix (6 deploys x {len(comps)} defenses):")
    print(f"      pure saddle points: {len(saddles)}  (0 => mixed-strategy game, good)")
    print(f"      dominant attacker deploy: {dom_deploy or 'NONE'}   dominant defender comp: {dom_def or 'NONE'}")
    print(f"      defense best-response cycle length: {len(cyc)}")
    print(f"      >> GENUINE DILEMMA: {genuine}")
    return genuine

# ════════════════════════════════════════════════════════════════════════════
# PART B — coordination amplifies + skill still wins (Pillars 2 & 3)
# ════════════════════════════════════════════════════════════════════════════
def play_war(rosterA, stratA, rosterB, stratB, days=5):
    """5 Hold days. strat in {coord, scatter}. Each side also deploys vs the other (best-read
    of the opp's *composition tendency*; fogged in spirit -> both use the same heuristic)."""
    rope = 0
    for d in range(days):
        Ps = hidden_Ps(BASE_P)
        asgA = coord_asg(rosterA, d) if stratA == "coord" else scatter_asg(rosterA)
        asgB = coord_asg(rosterB, d) if stratB == "coord" else scatter_asg(rosterB)
        # each deploys its single 'hard' to contest the opponent's densest (stacked) area,
        # 'easy' at the thinnest — a fixed symmetric read; Part B isolates DEFENSE/skill.
        depA = read_deploy(asgB)
        depB = read_deploy(asgA)
        notch, _, _ = day_notch(rosterA, asgA, depB, rosterB, asgB, depA, Ps)
        rope += notch
        if abs(rope) >= 12:
            return 1 if rope > 0 else -1
    return 1 if rope > 0 else (-1 if rope < 0 else 0)

def coord_asg(roster, d):
    # concentrate: strongest-first onto marquee+bridge, concede the gate; alternate which is heavier
    comp = (3, 2, 0) if d % 2 == 0 else (2, 3, 0)
    return skill_fill(comp, roster)

def scatter_asg(roster):
    return [RNG.randrange(3) for _ in roster]

def read_deploy(opp_asg):
    """Put 'hard' on the opponent's densest area, 'easy' on the sparsest."""
    cnt = [sum(1 for a in opp_asg if a == i) for i in range(3)]
    order = sorted(range(3), key=lambda i: cnt[i])  # sparsest..densest
    dep = [None, None, None]
    dep[order[0]] = "easy"; dep[order[1]] = "med"; dep[order[2]] = "hard"
    return tuple(dep)

def winrate(rosterA, stratA, rosterB, stratB, N=500):
    w = dr = 0
    for _ in range(N):
        r = play_war(rosterA, stratA, rosterB, stratB)
        if r == 1: w += 1
        elif r == 0: dr += 1
    return w / N, dr / N

def part_B():
    print("=" * 80)
    print("PART B — coordination amplifies + skill still wins (Pillars 2 & 3)")
    HI = ["high", "high", "high", "high", "high"]
    LO = ["low", "low", "low", "low", "low"]
    MIX = ["high", "high", "med", "low", "low"]
    # (2) coordination amplifies: equal-skill coord vs scatter
    amp, _ = winrate(HI, "coord", HI, "scatter")
    # (3) skill still wins: skilled-scatter vs unskilled-coord
    sw, _ = winrate(HI, "scatter", LO, "coord")
    # mirror draw rate
    _, mdraw = winrate(MIX, "coord", MIX, "coord")
    print(f"      coord>scatter (equal high skill):        {amp:.0%}   {'PASS' if amp > 0.70 else 'WEAK'}")
    print(f"      skilled-scatter > unskilled-coord:       {sw:.0%}   {'PASS' if sw > 0.55 else 'FAIL'}")
    print(f"      mirror (coord vs coord) draw rate:       {mdraw:.0%}  {'PASS' if mdraw < 0.45 else 'high'}")
    return amp > 0.70 and sw > 0.55

# ════════════════════════════════════════════════════════════════════════════
# PART C — under-roster graceful degradation (Pillar 3)
# ════════════════════════════════════════════════════════════════════════════
def part_C():
    print("=" * 80)
    print("PART C — under-roster: a 3-active crew's MAXIMIN held-V (best defense vs worst deploy)")
    print("  (the sensible short-handed play: concede the marquee, hold a cheaper area with 2 bodies)")
    comps3 = [c for c in compositions(3, 3)]   # all ways to place 3 members across 3 areas
    for label, roster in [("3 high", ["high", "high", "high"]),
                          ("3 mixed", ["high", "med", "low"])]:
        best_asg, best_min = None, -1
        for c in comps3:
            asg = skill_fill(c, roster)
            worst_over_deploys = min(
                mean(held_value(roster, asg, dp, hidden_Ps(BASE_P))[0] for _ in range(400))
                for dp in DEPLOYS)
            if worst_over_deploys > best_min:
                best_min, best_asg = worst_over_deploys, c
        verdict = "HOLDS >=1 area" if best_min >= 3.0 else ("locked out" if best_min < 1.0 else "partial")
        print(f"      {label:>8}: best comp {best_asg} -> maximin held-V={best_min:4.1f}  ({verdict})")

if __name__ == "__main__":
    a = part_A()
    b = part_B()
    part_C()
    print("=" * 80)
    print(f"P0 GATE: dilemma={a}  coordination+skill={b}  ->  "
          f"{'PASS — lock numbers, proceed to P1' if (a and b) else 'TUNE windows/sigma and re-run'}")
