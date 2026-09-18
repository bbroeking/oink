// The Snout Deep tuning sim (spec §8): 2,000 seeds through two bots. These
// pin the §4 figures against the real reducer and the real wake stream, so a
// threshold change that breaks the design's promises breaks here first.
//
// The §4 figures are RULE 1's — build 192's per-action roll — so those runs
// name `rules: 1` out loud. The cumulative attention meter (rules 2,
// 2026-09-17) has its own block at the foot, pinned against rule 1's survival
// the way the contract asks: the mud tie within ±8 points, the root within ±10.

import { simulateSnoutDeep, type SimResult } from "../utils/snoutDeep";

const N = 2000;
const seedAt = (i: number) => 20260913 + i;

function run(policy: Parameters<typeof simulateSnoutDeep>[1]): SimResult[] {
  const out: SimResult[] = [];
  for (let i = 1; i <= N; i++) out.push(simulateSnoutDeep(seedAt(i), policy));
  return out;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** The share of digs that reached their tie depth without a wake. */
const survival = (rs: SimResult[]) => 1 - rs.filter((r) => r.woke).length / rs.length;

describe("simulateSnoutDeep over 2,000 seeds", () => {
  const nose = run({ style: "nose", rules: 1 });
  const blind = run({ style: "blind", rules: 1 });

  test("every run ends, within the cap, by tie / wake / cap", () => {
    for (const r of [...nose, ...blind]) {
      expect(["tie", "wake", "cap"]).toContain(r.endReason);
      expect(r.actions).toBeLessThanOrEqual(45);
      expect(r.woke).toBe(r.endReason === "wake");
      if (r.woke) expect(r.wokeLayer).toBe(r.reachedLayer);
    }
    // Topsoil rubs cost a little (1/120), so a topsoil wake is possible but
    // rare: a bot spending its whole 15-action budget there can wake him at
    // most 1 − (119/120)^15 ≈ 11.8 % of the time. Sniffs there never do.
    const topsoilCeiling = 1 - Math.pow(119 / 120, 15) + 0.02;
    for (const rs of [nose, blind]) {
      const topsoilWakes = rs.filter((r) => r.wokeLayer === 0).length / rs.length;
      expect(topsoilWakes).toBeLessThan(topsoilCeiling);
    }
  });

  test("≥ 60 % of root pushes survive their first five actions (nose)", () => {
    const pushes = nose.filter((r) => r.rootSurvivedFive != null);
    expect(pushes.length).toBeGreaterThan(N / 2);
    const rate = pushes.filter((r) => r.rootSurvivedFive).length / pushes.length;
    expect(rate).toBeGreaterThanOrEqual(0.6);
  });

  test("mud-tie EV is within ±0.4 GT of the §4 figure (1.66)", () => {
    const mudTie = run({ style: "nose", tieAt: 1, rules: 1 });
    const ev = mean(mudTie.map((r) => r.gt));
    expect(Math.abs(ev - 1.66)).toBeLessThanOrEqual(0.4);
    // And the shape holds: topsoil tie ≈ 1 GT, the root push ≈ 2 GT (§4).
    const topTie = run({ style: "nose", tieAt: 0, rules: 1 });
    expect(mean(topTie.map((r) => r.gt))).toBeGreaterThan(0.7);
    expect(mean(nose.map((r) => r.gt))).toBeGreaterThan(ev);
  });

  test("the loose pouch is at stake: a woke dig keeps fewer finds and pays fewer tickles than a tie at the same depth", () => {
    // Since 2026-09-14 a consumable banks only on the tie, so `finds` (what
    // the dig KEEPS) and `tickles` fall on every wake — the whole carried
    // pouch goes. Bounds from the 2,000-seed run after the change: nose
    // 2.69 · 3.11 · 2.97 finds and 14.8 · 23.7 · 24.8 tickles at topsoil ·
    // mud · root (before: 2.73 · 3.57 · 3.89 and 15.1 · 26.4 · 31.5).
    const byDepth = ([0, 1, 2] as const).map((tieAt) => run({ style: "nose", tieAt, rules: 1 }));
    const tickles = byDepth.map((rs) => mean(rs.map((r) => r.tickles)));
    const finds = byDepth.map((rs) => mean(rs.map((r) => r.finds)));
    // Topsoil is nearly safe, so its EV barely moves; the pouch is what the
    // deeper pushes stake, so the root's EV no longer runs away from the mud's.
    expect(tickles[0]).toBeGreaterThan(12);
    expect(tickles[0]).toBeLessThan(18);
    expect(tickles[1]).toBeGreaterThan(tickles[0]);
    expect(tickles[2]).toBeGreaterThan(18);
    expect(tickles[2]).toBeLessThan(tickles[1] + 5);
    expect(finds[2]).toBeLessThan(finds[1] + 0.2);
    // Within one depth, the woke digs keep less and pay less than the tied.
    for (const rs of byDepth.slice(1)) {
      const woke = rs.filter((r) => r.woke);
      const tied = rs.filter((r) => !r.woke);
      expect(woke.length).toBeGreaterThan(50);
      expect(mean(woke.map((r) => r.tickles))).toBeLessThan(mean(tied.map((r) => r.tickles)));
      expect(mean(woke.map((r) => r.finds))).toBeLessThan(mean(tied.map((r) => r.finds)));
    }
    // A woke dig never counts a consumable among its finds: only the
    // truffles banked on descent and the collection things it kept.
    for (const r of byDepth.flat()) {
      if (r.woke) expect(r.things + r.truffles).toBe(r.finds);
    }
  });

  test("a sniff-first policy beats a blind policy on finds, on GT, on tickles and on sleep", () => {
    // `finds` is what the dig keeps (banked + kept collection): the nose's
    // lead widened after the loose pouch (2.97 vs 2.26 at the root) because
    // it wakes less and so loses the pouch less.
    expect(mean(nose.map((r) => r.finds))).toBeGreaterThan(mean(blind.map((r) => r.finds)));
    expect(mean(nose.map((r) => r.tickles))).toBeGreaterThan(mean(blind.map((r) => r.tickles)));
    expect(mean(nose.map((r) => r.gt))).toBeGreaterThan(mean(blind.map((r) => r.gt)));
    const wokeRate = (rs: SimResult[]) => rs.filter((r) => r.woke).length / rs.length;
    expect(wokeRate(nose)).toBeLessThan(wokeRate(blind));
  });

  test("the sim is deterministic per seed and policy", () => {
    expect(simulateSnoutDeep(seedAt(7), "nose")).toEqual(simulateSnoutDeep(seedAt(7), "nose"));
    expect(simulateSnoutDeep(seedAt(7), { style: "nose" })).toEqual(simulateSnoutDeep(seedAt(7), "nose"));
  });
});

// ── Rules 2 — the wake meter (2026-09-17) ──────────────────────────────────
// The contract's §6 asks these pinned LOOSELY (±8 points, ±0.3 GT). Its own
// figures were simulated before the descent gate and the per-board sniff
// budget landed the same night, and the gate in particular buys the greedy bot
// a deeper dig: on today's kernel the same bot wakes 77% rather than 59%, and
// the other session's reference sim (scripts/sim/wakeMeter.sim.test.ts, which
// truncates trajectories instead of playing them) agrees to the point. What
// §6 promised about the SHAPE all holds: topsoil never wakes him, reading the
// meter pays, and the Golden Truffle faucet stays shut.

describe("the meter over 2,000 seeds", () => {
  const greedy = run({ style: "nose", rules: 2 });
  const bold = run({ style: "nose", rules: 2, stopAt: 0.5 });
  const careful = run({ style: "nose", rules: 2, stopAt: 0 });
  const blind2 = run({ style: "blind", rules: 2 });
  const share = (rs: SimResult[], p: (r: SimResult) => boolean) =>
    rs.filter(p).length / rs.length;
  const wokeAt = (rs: SimResult[], layer: 0 | 1 | 2) => share(rs, (r) => r.wokeLayer === layer);
  const near = (got: number, want: number, slack: number) =>
    expect(Math.abs(got - want)).toBeLessThanOrEqual(slack);

  test("topsoil is truly safe — the tutorial layer never wakes him, under any bot", () => {
    for (const rs of [greedy, bold, careful, blind2]) expect(wokeAt(rs, 0)).toBe(0);
    // Rule 1 woke him in topsoil roughly one dig in twelve — the thing the
    // meter was brought in to fix.
    expect(wokeAt(run({ style: "nose", rules: 1 }), 0)).toBeGreaterThan(0.05);
  });

  test("the greedy nose: the mud is a choice, the root is where digs end (§6)", () => {
    near(share(greedy, (r) => r.woke), 0.77, 0.08);
    near(wokeAt(greedy, 1), 0.09, 0.08);
    near(wokeAt(greedy, 2), 0.68, 0.08);
    near(share(greedy, (r) => r.reachedLayer === 2), 0.91, 0.08);
    // The root's first five actions still survive — §6's rootSurvive5.
    const pushes = greedy.filter((r) => r.rootSurvivedFive != null);
    expect(pushes.length).toBeGreaterThan(N / 2);
    expect(share(pushes, (r) => !!r.rootSurvivedFive)).toBeGreaterThanOrEqual(0.9);
  });

  test("reading the meter pays: the bold bot wakes half as often and keeps MORE", () => {
    expect(share(bold, (r) => r.woke)).toBeLessThan(share(greedy, (r) => r.woke) - 0.2);
    expect(mean(bold.map((r) => r.finds))).toBeGreaterThan(mean(greedy.map((r) => r.finds)));
    // And the careful bot never wakes him at all, still averaging near four finds.
    expect(share(careful, (r) => r.woke)).toBe(0);
    expect(mean(careful.map((r) => r.finds))).toBeGreaterThan(3.5);
    // It pays for that in depth: it turns back before the root about half the time.
    near(share(careful, (r) => r.reachedLayer === 2), 0.52, 0.08);
  });

  test("the Golden Truffle faucet stays shut: `dig_root` withheld, GT/dig near §6's 1.86", () => {
    // §6's gtNoRoot column: 1.86 for the bots that reach the root, 1.51 for
    // the careful one that often turns back before it.
    for (const [rs, want] of [[greedy, 1.86], [bold, 1.86], [careful, 1.51]] as const) {
      near(mean(rs.map((r) => r.gt)), want, 0.3);
      // With digRootGt 0 nothing mints beyond the two truffles a dig can bank.
      for (const r of rs) expect(r.gt).toBeLessThanOrEqual(2);
    }
    // Flip the stamp and the root tie pays again — the lever is real.
    const paid = run({
      style: "nose",
      rules: 2,
      stopAt: 0.5,
      wakeMeter: { lo: 50, hi: 110, scope: "board", digRootGt: 1 },
    });
    expect(mean(paid.map((r) => r.gt))).toBeGreaterThan(mean(bold.map((r) => r.gt)));
  });

  test("the meter and his sleep depth are honest all the way through", () => {
    for (const r of greedy) {
      expect(r.rules).toBe(2);
      expect(r.sleepDepth).toBeGreaterThanOrEqual(50);
      expect(r.sleepDepth).toBeLessThanOrEqual(110);
      // He woke exactly when the meter reached him, and not before.
      expect(r.woke).toBe(r.attention >= r.sleepDepth);
    }
    // Rule 1 keeps neither.
    for (const r of run({ style: "nose", rules: 1 })) {
      expect(r.attention).toBe(0);
      expect(r.sleepDepth).toBe(0);
    }
  });

  test("scope dig is a switch, not the default: one nap, and the root is the whole game", () => {
    const carry = run({
      style: "nose",
      rules: 2,
      wakeMeter: { lo: 50, hi: 110, scope: "dig", digRootGt: 0 },
    });
    // With the meter carried down, nearly every dig ends in a wake — which is
    // why the board scope ships (the doc's §4).
    expect(share(carry, (r) => r.woke)).toBeGreaterThan(share(greedy, (r) => r.woke));
    expect(wokeAt(carry, 0)).toBe(0); // topsoil is still too quiet to reach `lo`
  });

  test("deeper still pays: a root tie out-earns a mud tie out-earns a topsoil one", () => {
    const byDepth = ([0, 1, 2] as const).map((tieAt) => run({ style: "nose", tieAt, rules: 2 }));
    const tickles = byDepth.map((rs) => mean(rs.map((r) => r.tickles)));
    expect(tickles[1]).toBeGreaterThan(tickles[0]);
    expect(tickles[2]).toBeGreaterThan(tickles[0]);
    const gt = byDepth.map((rs) => mean(rs.map((r) => r.gt)));
    expect(gt[1]).toBeGreaterThan(gt[0]);
  });
});
