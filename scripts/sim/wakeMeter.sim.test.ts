// The wake meter — a design sim (2026-09-17), NOT a test.
//
// Runs only with WAKE_METER_SIM=1:
//   WAKE_METER_SIM=1 npx jest scripts/sim/wakeMeter.sim.test.ts
//
// Compares the shipped wake rule (A: every action an independent roll
// against the layer's threshold) with the cumulative attention rule the
// design doc proposes (B2: every action adds its loudness — the SAME
// table numbers — to a meter; he wakes when the meter reaches a sleep
// depth T drawn once from a bounded range). Nothing in the kernel is
// touched: the policy loop is a copy of utils/snoutDeep.ts
// simulateSnoutDeep with wakes switched off (WakeStream patched to draw
// 119 during the run, so no threshold ever fires), every state snapshotted,
// and each wake rule applied afterwards as a truncation of the trajectory.
// Rule A reproduced this way is cross-checked against simulateSnoutDeep
// itself (must match to the seed) before anything else is trusted.
//
// Design doc: docs/design/2026-09-17-wake-meter.md.

import { PATCH_COLS, PATCH_ROWS, WAKE_DIE } from "@/constants/dig";
import { clusterRevealed, generateLayeredBoard, WakeStream } from "@/utils/rooting";
import {
  findAtTile,
  gtReasons,
  initialState,
  nextThreshold,
  reduce,
  simulateSnoutDeep,
  wakeThreshold,
  type Layer,
  type SnoutDeepState,
  type Verb,
} from "@/utils/snoutDeep";

const SEEDS = Number(process.env.WAKE_METER_SEEDS ?? 2000);
const TILE_COUNT = PATCH_ROWS * PATCH_COLS;
const NOSE_LATTICE = [1 * PATCH_COLS + 1, 1 * PATCH_COLS + 4, 3 * PATCH_COLS + 1, 3 * PATCH_COLS + 4];
const DEFAULT_LAYER_ACTIONS = 15;
const SCAN_SEED_MULT = 104729;

// ── Rules ───────────────────────────────────────────────────────────────────

/** B2's sleep depth: T drawn once (carry) or once per layer (perLayer)
 *  uniformly on [lo, hi], in the same 120ths the table speaks. */
interface MeterRule {
  kind: "meter";
  name: string;
  lo: number;
  hi: number;
  /** carry: one nap, the meter runs the whole dig. perLayer: the meter and
   *  T reset on descent (each board its own round). */
  scope: "carry" | "perLayer";
}
interface RollRule {
  kind: "roll";
  name: string;
}
type Rule = RollRule | MeterRule;

// ── Policies ────────────────────────────────────────────────────────────────

/** What the bot knows about the meter when it decides. `stopAt` is where in
 *  the band [lo, hi] it ties: 0 = never enters the band (careful), 0.5 =
 *  leaves at the band's middle (bold), Infinity = ignores the meter (greedy,
 *  = today's nose bot). A truffle loose on the layer is always tied first. */
interface Policy {
  style: "blind" | "nose";
  stopAt: number;
  tieAt?: Layer;
  layerActions?: number;
}

interface Step {
  verb: Verb;
  layer: Layer;
  loud: number; // the threshold the action rolled at — B2's loudness
  after: SnoutDeepState;
}

interface Trajectory {
  seed: number;
  steps: Step[];
  /** The state the trajectory ended in by choice (tie / cap / close). */
  final: SnoutDeepState;
}

// Wakes off: every draw reads 119, below no threshold. The stream still
// advances so wakeIndex stays honest.
const origNext = WakeStream.prototype.next;
function withWakesOff<T>(fn: () => T): T {
  WakeStream.prototype.next = function (this: WakeStream) {
    origNext.call(this);
    return WAKE_DIE - 1;
  };
  try {
    return fn();
  } finally {
    WakeStream.prototype.next = origNext;
  }
}
function realDraws(seed: number, n: number): number[] {
  const ws = new WakeStream(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(origNext.call(ws));
  return out;
}

function neighbours4(tile: number): number[] {
  const r = Math.floor(tile / PATCH_COLS);
  const c = tile % PATCH_COLS;
  const out: number[] = [];
  if (r > 0) out.push(tile - PATCH_COLS);
  if (r < PATCH_ROWS - 1) out.push(tile + PATCH_COLS);
  if (c > 0) out.push(tile - 1);
  if (c < PATCH_COLS - 1) out.push(tile + 1);
  return out;
}
function neighbours8(tile: number): number[] {
  const r = Math.floor(tile / PATCH_COLS);
  const c = tile % PATCH_COLS;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= PATCH_ROWS || cc < 0 || cc >= PATCH_COLS) continue;
      out.push(rr * PATCH_COLS + cc);
    }
  }
  return out;
}

/** The policy loop of simulateSnoutDeep, verbatim in play, with two hooks:
 *  every act is recorded, and a meter-aware bot may tie instead of acting
 *  when the next action would carry the meter past its stop. The meter the
 *  bot reads is `meterRule`'s (null = no meter to read). */
function runTrajectory(seed: number, policy: Policy, meterRule: MeterRule | null): Trajectory {
  return withWakesOff(() => {
    const style = policy.style;
    const tieAt: Layer = policy.tieAt ?? 2;
    const layerActions = policy.layerActions ?? DEFAULT_LAYER_ACTIONS;
    const board = generateLayeredBoard(seed);
    let state = initialState(board, { coop: false, uncrewed: false });
    let scan = ((seed * SCAN_SEED_MULT) % 2147483646) + 1;
    const scanNext = (n: number) => {
      scan = (scan * 16807) % 2147483647;
      return scan % n;
    };
    const steps: Step[] = [];
    let attention = 0;
    let attentionLayer: Layer = 0;

    const stopLine = (): number => {
      if (!meterRule || !Number.isFinite(policy.stopAt)) return Infinity;
      return meterRule.lo + policy.stopAt * (meterRule.hi - meterRule.lo);
    };
    // The bot's tie: the next action would carry the meter past its stop.
    // A loose truffle is banked by the tie; a bot with nothing loose still
    // ties (it keeps what it banked). Returns true when it tied.
    const meterSays = (verb: Verb): boolean => {
      if (!meterRule) return false;
      if (meterRule.scope === "perLayer" && attentionLayer !== state.layer) {
        attention = 0;
        attentionLayer = state.layer;
      }
      const loud = nextThreshold(state, verb);
      if (attention + loud > stopLine()) {
        state = reduce(state, { type: "tie" });
        return true;
      }
      return false;
    };
    const doAct = (verb: Verb, tile: number): boolean => {
      if (meterSays(verb)) return false;
      const loud = nextThreshold(state, verb);
      const before = state;
      state = reduce(state, { type: "act", verb, tile });
      if (state === before) return true; // a no-op: nothing rolled
      if (meterRule?.scope === "perLayer" && attentionLayer !== before.layer) {
        attention = 0;
        attentionLayer = before.layer;
      }
      attention += loud;
      steps.push({ verb, layer: before.layer, loud, after: state });
      return true;
    };

    const sniffWorthIt = () => nextThreshold(state, "sniff") < nextThreshold(state, "rub");
    const currentFinds = () => state.board.layers[state.layer].finds;
    const seenFind = (t: number): boolean => {
      if (state.depths[t] > 1) return false;
      const f = findAtTile(state, t);
      return !!f && f.kind !== "stone";
    };
    const residual = (s: number): number => {
      const mark = state.scent[s];
      if (mark == null) return 0;
      let seen = 0;
      for (const n of neighbours8(s)) if (seenFind(n)) seen++;
      return Math.max(0, mark - seen);
    };
    const scentScore = (t: number): number => {
      let score = 0;
      for (const n of neighbours8(t)) score += residual(n);
      return score;
    };
    const knownEmpty = (t: number): boolean => {
      if (state.depths[t] <= 1 && state.depths[t] > 0) {
        const f = findAtTile(state, t);
        if (!f || f.kind === "stone") return true;
      }
      for (const n of neighbours8(t)) {
        if (state.scent[n] != null && residual(n) === 0) return true;
      }
      return false;
    };
    const step = (): boolean => {
      const rub = (tile: number) => doAct("rub", tile);
      let silhouette = -1;
      let silhouetteDepth = Infinity;
      for (let t = 0; t < TILE_COUNT; t++) {
        const d = state.depths[t];
        if (d <= 0 || d > 1) continue;
        const f = findAtTile(state, t);
        if (!f || f.kind === "stone") continue;
        if (d < silhouetteDepth) {
          silhouetteDepth = d;
          silhouette = t;
        }
      }
      if (silhouette >= 0) return rub(silhouette);
      for (const f of currentFinds()) {
        if (f.kind === "stone" || f.tiles.length < 2) continue;
        if (clusterRevealed(f.tiles, state.depths)) continue;
        if (!f.tiles.some((t) => state.depths[t] <= 1)) continue;
        let pick = -1;
        let pickScore = -1;
        for (const seen of f.tiles.filter((t) => state.depths[t] <= 1)) {
          for (const n of neighbours4(seen)) {
            if (state.depths[n] <= 1 || knownEmpty(n)) continue;
            const score = scentScore(n);
            if (score > pickScore) {
              pickScore = score;
              pick = n;
            }
          }
        }
        if (pick >= 0) return rub(pick);
      }
      const unknown: number[] = [];
      for (let t = 0; t < TILE_COUNT; t++) {
        if (state.depths[t] > 1 && !knownEmpty(t)) unknown.push(t);
      }
      if (style === "nose") {
        let best = -1;
        let bestScore = 0;
        for (const t of unknown) {
          const score = scentScore(t);
          if (score > bestScore) {
            bestScore = score;
            best = t;
          }
        }
        if (best >= 0) return rub(best);
        const unsniffed = unknown.filter((t) => state.scent[t] == null);
        if (unsniffed.length > 0 && sniffWorthIt()) {
          return doAct("sniff", unsniffed[scanNext(unsniffed.length)]);
        }
      }
      if (unknown.length === 0) return false;
      return rub(unknown[scanNext(unknown.length)]);
    };

    while (!state.ended) {
      const layer = state.layer;
      const atEntry = state.actions.length;
      const spent = () => state.actions.length - atEntry;
      if (style === "nose") {
        for (const t of NOSE_LATTICE) {
          if (state.ended || spent() >= layerActions || !sniffWorthIt()) break;
          doAct("sniff", t);
        }
        if (
          !state.ended &&
          layer > 0 &&
          wakeThreshold(layer, "sniff", state.coop) * 2 < wakeThreshold(layer, "rub", state.coop) &&
          NOSE_LATTICE.some((t) => (state.scent[t] ?? 0) >= 2)
        ) {
          let strongest = -1;
          let strongestScent = 0;
          for (const t of NOSE_LATTICE) {
            const sc = state.scent[t] ?? 0;
            if (sc > strongestScent) {
              strongestScent = sc;
              strongest = t;
            }
          }
          if (strongest >= 0) {
            for (const n of neighbours4(strongest)) {
              if (state.ended || spent() >= layerActions) break;
              doAct("sniff", n);
            }
          }
        }
      }
      const leaveWhenLoose = layer > 0;
      while (!state.ended && !(leaveWhenLoose && state.loose) && spent() < layerActions) {
        if (!step()) break;
      }
      if (state.ended) break;
      if (layer >= tieAt) {
        state = reduce(state, { type: "tie" });
        break;
      }
      state = reduce(state, { type: "descend" });
    }
    return { seed, steps, final: state };
  });
}

// ── Outcomes ────────────────────────────────────────────────────────────────

interface Outcome {
  finds: number;
  truffles: number;
  gt: number;
  /** GT with the root tie's 'dig_root' bonus set to 0 — the spec's stated lever (§4). */
  gtNoRoot: number;
  woke: boolean;
  wokeLayer: Layer | null;
  reachedRoot: boolean;
  rootSurvivedFive: boolean | null;
  actions: number;
  endLayer: Layer;
  /** For meter rules: the meter's reading when the dig ended, as a share of hi. */
  meterAtEnd: number | null;
}

function tally(state: SnoutDeepState, woke: boolean, wokeLayer: Layer | null, rootActions: number | null, meterAtEnd: number | null): Outcome {
  const isFood = (id: string) => state.board.layers.some((l) => l.finds.some((f) => f.id === id && f.food));
  const truffles = state.banked.filter(isFood).length;
  return {
    finds: state.things.length + state.banked.length,
    truffles,
    gt: gtReasons(state).length,
    gtNoRoot: gtReasons(state).filter((r) => r !== "dig_root").length,
    woke,
    wokeLayer,
    reachedRoot: state.layer === 2,
    rootSurvivedFive: rootActions == null ? null : !(woke && wokeLayer === 2 && rootActions <= 5),
    actions: state.actions.length,
    endLayer: state.layer,
    meterAtEnd,
  };
}

/** Apply a rule to a trajectory: where (if anywhere) he wakes. */
function evaluate(tr: Trajectory, rule: Rule): Outcome {
  const { steps } = tr;
  const rootEntry = steps.findIndex((s) => s.layer === 2);
  const rootActionsAt = (k: number) => (rootEntry < 0 || k < rootEntry ? null : k - rootEntry + 1);
  const rootActionsTotal = rootEntry < 0 ? null : steps.length - rootEntry;

  if (rule.kind === "roll") {
    const draws = realDraws(tr.seed, steps.length);
    for (let k = 0; k < steps.length; k++) {
      if (draws[k] < steps[k].loud) return wakeAt(tr, k, rootActionsAt(k), null);
    }
    return tally(tr.final, false, null, rootActionsTotal, null);
  }

  // The meter. T from the seed's first draw(s) — a dedicated stream in the
  // real kernel; here the wake stream's own draws, which rule A also reads,
  // so the two rules see the same luck.
  const span = rule.hi - rule.lo + 1;
  const draws = realDraws(tr.seed, 3);
  const tFor = (layer: Layer) => rule.lo + Math.floor((draws[rule.scope === "carry" ? 0 : layer] * span) / WAKE_DIE);
  let attention = 0;
  let layer: Layer = 0;
  let T = tFor(0);
  for (let k = 0; k < steps.length; k++) {
    const s = steps[k];
    if (rule.scope === "perLayer" && s.layer !== layer) {
      attention = 0;
      layer = s.layer;
      T = tFor(layer);
    }
    attention += s.loud;
    if (attention >= T) return wakeAt(tr, k, rootActionsAt(k), attention / rule.hi);
  }
  return tally(tr.final, false, null, rootActionsTotal, attention / rule.hi);
}

/** The state after step k's dig landed, with the wake applied the way
 *  act() applies it: the loose truffle and the loose pouch are his,
 *  everything banked and every collection thing stands. */
function wakeAt(tr: Trajectory, k: number, rootActions: number | null, meterAtEnd: number | null): Outcome {
  const s = tr.steps[k];
  const state: SnoutDeepState = {
    ...s.after,
    loose: null,
    looseThings: [],
    ended: { reason: "wake", layer: s.layer, wokeOn: s.after.actions[s.after.actions.length - 1] },
  };
  return tally(state, true, s.layer, rootActions, meterAtEnd);
}

// ── Report ──────────────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function pct(xs: boolean[]): string {
  return `${Math.round(mean(xs.map((x) => (x ? 1 : 0))) * 100)}%`;
}
function summarise(outs: Outcome[]) {
  const rootPushes = outs.filter((o) => o.rootSurvivedFive != null);
  const endedAt = [0, 1, 2].map((l) => outs.filter((o) => !o.woke && o.endLayer === l).length);
  return {
    finds: mean(outs.map((o) => o.finds)).toFixed(2),
    truffles: mean(outs.map((o) => o.truffles)).toFixed(2),
    gt: mean(outs.map((o) => o.gt)).toFixed(2),
    gtNoRoot: mean(outs.map((o) => o.gtNoRoot)).toFixed(2),
    woke: pct(outs.map((o) => o.woke)),
    wokeTop: pct(outs.map((o) => o.woke && o.wokeLayer === 0)),
    wokeMud: pct(outs.map((o) => o.woke && o.wokeLayer === 1)),
    wokeRoot: pct(outs.map((o) => o.woke && o.wokeLayer === 2)),
    reachedRoot: pct(outs.map((o) => o.reachedRoot)),
    rootSurvive5: rootPushes.length ? pct(rootPushes.map((o) => o.rootSurvivedFive!)) : "—",
    actions: mean(outs.map((o) => o.actions)).toFixed(1),
    tiedAt: `${endedAt[0]}/${endedAt[1]}/${endedAt[2]}`,
  };
}

const RULES: Rule[] = [
  { kind: "roll", name: "A · roll" },
  { kind: "meter", name: "B2 carry 120–120", lo: 120, hi: 120, scope: "carry" },
  { kind: "meter", name: "B2 carry 90–150", lo: 90, hi: 150, scope: "carry" },
  { kind: "meter", name: "B2 carry 70–170", lo: 70, hi: 170, scope: "carry" },
  { kind: "meter", name: "B2 carry 50–190", lo: 50, hi: 190, scope: "carry" },
  { kind: "meter", name: "B2 layer 40–80", lo: 40, hi: 80, scope: "perLayer" },
  { kind: "meter", name: "B2 layer 30–90", lo: 30, hi: 90, scope: "perLayer" },
  { kind: "meter", name: "B2 layer 50–110", lo: 50, hi: 110, scope: "perLayer" },
];

const POLICIES: { name: string; policy: Policy }[] = [
  { name: "blind (ignores meter)", policy: { style: "blind", stopAt: Infinity } },
  { name: "nose greedy (ignores meter)", policy: { style: "nose", stopAt: Infinity } },
  { name: "nose bold (ties mid-band)", policy: { style: "nose", stopAt: 0.5 } },
  { name: "nose careful (never enters band)", policy: { style: "nose", stopAt: 0 } },
  { name: "nose mud-tie greedy", policy: { style: "nose", stopAt: Infinity, tieAt: 1 } },
];

const run = process.env.WAKE_METER_SIM ? describe : describe.skip;

run("wake meter sim", () => {
  it("rule A reproduced by truncation matches simulateSnoutDeep to the seed", () => {
    for (const style of ["blind", "nose"] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const ref = simulateSnoutDeep(seed, style);
        const mine = evaluate(runTrajectory(seed, { style, stopAt: Infinity }, null), RULES[0]);
        expect([seed, style, mine.finds, mine.gt, mine.woke, mine.wokeLayer, mine.actions]).toEqual([
          seed, style, ref.finds, ref.gt, ref.woke, ref.wokeLayer, ref.actions,
        ]);
      }
    }
  });

  it("prints the grid", () => {
    const lines: string[] = [];
    lines.push(`seeds: ${SEEDS}`);
    for (const rule of RULES) {
      lines.push("");
      lines.push(`## ${rule.name}`);
      const rows: Record<string, ReturnType<typeof summarise>> = {};
      for (const { name, policy } of POLICIES) {
        // A bot that reads the meter only exists under a meter rule.
        if (rule.kind === "roll" && Number.isFinite(policy.stopAt)) continue;
        const outs: Outcome[] = [];
        for (let seed = 1; seed <= SEEDS; seed++) {
          const tr = runTrajectory(seed, policy, rule.kind === "meter" && Number.isFinite(policy.stopAt) ? rule : null);
          outs.push(evaluate(tr, rule));
        }
        rows[name] = summarise(outs);
      }
      lines.push(table(rows));
    }
    const text = lines.join("\n");
    // eslint-disable-next-line no-console
    console.log(text);
    const out = process.env.WAKE_METER_OUT;
    if (out) require("fs").writeFileSync(out, text + "\n");
  });
});

function table(rows: Record<string, ReturnType<typeof summarise>>): string {
  const cols = ["finds", "truffles", "gt", "gtNoRoot", "woke", "wokeTop", "wokeMud", "wokeRoot", "reachedRoot", "rootSurvive5", "actions", "tiedAt"] as const;
  const head = `| policy | ${cols.join(" | ")} |`;
  const sep = `|---|${cols.map(() => "---:").join("|")}|`;
  const body = Object.entries(rows).map(([name, r]) => `| ${name} | ${cols.map((c) => r[c]).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}
