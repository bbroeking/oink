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
      // Topsoil never wakes him on a rub or a sniff — both bots only rub there.
      expect(r.wokeLayer).not.toBe(0);
      expect(r.survived[0]).toBe(true);
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

  test("a sniff-first policy beats a blind policy on finds, on GT, and on sleep", () => {
    expect(mean(nose.map((r) => r.finds))).toBeGreaterThan(mean(blind.map((r) => r.finds)));
    expect(mean(nose.map((r) => r.gt))).toBeGreaterThan(mean(blind.map((r) => r.gt)));
    const wokeRate = (rs: SimResult[]) => rs.filter((r) => r.woke).length / rs.length;
    expect(wokeRate(nose)).toBeLessThan(wokeRate(blind));
  });

  test("the sim is deterministic per seed and policy", () => {
    expect(simulateSnoutDeep(seedAt(7), "nose")).toEqual(simulateSnoutDeep(seedAt(7), "nose"));
    expect(simulateSnoutDeep(seedAt(7), { style: "nose" })).toEqual(simulateSnoutDeep(seedAt(7), "nose"));
  });
});
