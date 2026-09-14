// The Snout Deep tuning sim (spec §8): 2,000 seeds through two bots. These
// pin the §4 figures against the real reducer and the real wake stream, so a
// threshold change that breaks the design's promises breaks here first.

import { simulateSnoutDeep, type SimResult } from "../utils/snoutDeep";

const N = 2000;
const seedAt = (i: number) => 20260913 + i;

function run(policy: Parameters<typeof simulateSnoutDeep>[1]): SimResult[] {
  const out: SimResult[] = [];
  for (let i = 1; i <= N; i++) out.push(simulateSnoutDeep(seedAt(i), policy));
  return out;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("simulateSnoutDeep over 2,000 seeds", () => {
  const nose = run("nose");
  const blind = run("blind");

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
    const mudTie = run({ style: "nose", tieAt: 1 });
    const ev = mean(mudTie.map((r) => r.gt));
    expect(Math.abs(ev - 1.66)).toBeLessThanOrEqual(0.4);
    // And the shape holds: topsoil tie ≈ 1 GT, the root push ≈ 2 GT (§4).
    const topTie = run({ style: "nose", tieAt: 0 });
    expect(mean(topTie.map((r) => r.gt))).toBeGreaterThan(0.7);
    expect(mean(nose.map((r) => r.gt))).toBeGreaterThan(ev);
  });

  test("the loose pouch is at stake: a woke dig keeps fewer finds and pays fewer tickles than a tie at the same depth", () => {
    // Since 2026-09-14 a consumable banks only on the tie, so `finds` (what
    // the dig KEEPS) and `tickles` fall on every wake — the whole carried
    // pouch goes. Bounds from the 2,000-seed run after the change: nose
    // 2.69 · 3.11 · 2.97 finds and 14.8 · 23.7 · 24.8 tickles at topsoil ·
    // mud · root (before: 2.73 · 3.57 · 3.89 and 15.1 · 26.4 · 31.5).
    const byDepth = ([0, 1, 2] as const).map((tieAt) => run({ style: "nose", tieAt }));
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
