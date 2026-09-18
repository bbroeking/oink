// Snout Deep — client ↔ server parity for the wake replay.
//
// The server (supabase/migrations/20260913060000_snout_deep.sql) replays the
// action log against the seed's wake stream and the wake table, so both must
// be the client's exactly: the Park–Miller constants in _snout_deep_wake_draws
// equal utils/rooting.ts's Minstd/WakeStream, the VALUES rows in
// _snout_deep_wake_threshold equal constants/dig.ts WAKE_TABLE, and the co-op
// rule is the same floor+1 halving of the root's sniff and rub. A JS
// re-implementation of the SQL stream is pinned against WakeStream on a few
// seeds too, so a drift in either shows up here before it shows up as a
// receipt that disagrees with the phone.
import fs from "node:fs";
import path from "node:path";
import {
  WAKE_COOP_LAYER,
  WAKE_COOP_VERBS,
  WAKE_DIE,
  WAKE_TABLE,
  type SnoutDeepLayer,
  type SnoutDeepVerb,
} from "@/constants/dig";
import { DIG_COLLECTION_KINDS, DIG_CONSUMABLE_KINDS, DIG_FIND_TICKLES, type DigFindKind } from "@/constants/dig";
import { WAKE_SEED_MULT, WakeStream, wakeSeed, wakeThreshold } from "@/utils/rooting";

const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260913060000_snout_deep.sql"),
  "utf8",
);
// The tally (every find pays tickles) names the table and apply_tickles; the
// loose pouch (20260914090000) carries _submit_rooting_deep_core's latest
// def, so the log contract is pinned against THAT body.
const tallySql = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260913120000_dig_find_tickles.sql"),
  "utf8",
);
const pouchSql = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260914090000_loose_pouch.sql"),
  "utf8",
);
// The wake meter (rules 2, 2026-09-17): the two stamps, the tuning row, the
// deterministic meter in the replay, and the deeper purse merged into the same
// dig_finds row.
const rulesSql = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260917180000_snout_deep_attention_rules.sql"),
  "utf8",
);

function fnBody(name: string, source = sql): string {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("$function$;", start);
  return source.slice(start, end);
}

const VERB_LETTER: Record<SnoutDeepVerb, string> = { sniff: "s", rub: "r", shove: "h" };

describe("Snout Deep server parity", () => {
  test("the SQL wake stream is Minstd over seed × 7919 with the client's constants", () => {
    const body = fnBody("_snout_deep_wake_draws");
    expect(body).toContain(`* ${WAKE_SEED_MULT}) % 2147483647`);
    expect(body).toContain("(state * 16807) % 2147483647");
    expect(body).toContain(`% ${WAKE_DIE}`);
    // Minstd's normalisation of an out-of-range state.
    expect(body).toContain("(abs(state) % 2147483646) + 1");
    expect(body).toContain("state < 1 OR state > 2147483646");
    // The client's constants the SQL mirrors.
    expect(WAKE_SEED_MULT).toBe(7919);
    expect(WAKE_DIE).toBe(120);
    expect(wakeSeed(1)).toBe(7919);
  });

  test("a JS transcription of the SQL stream matches WakeStream draw for draw", () => {
    // Exactly the plpgsql body, in JS.
    const sqlDraws = (seed: number, n: number) => {
      let state = (seed * 7919) % 2147483647;
      if (state < 1 || state > 2147483646) state = (Math.abs(state) % 2147483646) + 1;
      const out: number[] = [];
      for (let i = 0; i < n; i++) {
        state = (state * 16807) % 2147483647;
        out.push(state % 120);
      }
      return out;
    };
    for (const seed of [1, 2, 20260913, 123456789, 2147483646]) {
      const ws = new WakeStream(seed);
      const client = Array.from({ length: 45 }, () => ws.next());
      expect(sqlDraws(seed, 45)).toEqual(client);
    }
    // The values the harness smoke pins (scripts/db-harness/87_snout_deep_smoke.sql).
    expect(sqlDraws(20260913, 12)).toEqual([79, 75, 20, 0, 47, 50, 4, 59, 80, 22, 114, 9]);
    expect(sqlDraws(1, 6)).toEqual([113, 104, 6, 38, 104, 77]);
    expect(sqlDraws(2147483646, 6)).toEqual([14, 23, 1, 89, 23, 50]);
  });

  test("the SQL wake table rows equal WAKE_TABLE", () => {
    const body = fnBody("_snout_deep_wake_threshold");
    const rows = new Map<string, number>();
    for (const m of body.matchAll(/\((\d), '([srh])', (\d+)\)/g)) {
      rows.set(`${m[1]}${m[2]}`, Number(m[3]));
    }
    expect(rows.size).toBe(9);
    for (const layer of [0, 1, 2] as SnoutDeepLayer[]) {
      for (const verb of ["sniff", "rub", "shove"] as SnoutDeepVerb[]) {
        expect(rows.get(`${layer}${VERB_LETTER[verb]}`)).toBe(WAKE_TABLE[layer][verb]);
      }
    }
  });

  test("the co-op rule is the root's sniff and rub, floor + 1", () => {
    const body = fnBody("_snout_deep_wake_threshold");
    expect(WAKE_COOP_LAYER).toBe(2);
    expect(WAKE_COOP_VERBS).toEqual(["sniff", "rub"]);
    expect(body).toContain("WHEN p_coop AND t.layer = 2 AND t.verb IN ('s', 'r') AND t.thr > 0 THEN (t.thr / 2) + 1");
    // The client's answer for the co-op root: 7 → 4, 15 → 8, shove unchanged.
    expect(wakeThreshold(2, "sniff", true)).toBe(4);
    expect(wakeThreshold(2, "rub", true)).toBe(8);
    expect(wakeThreshold(2, "shove", true)).toBe(40);
    expect(wakeThreshold(1, "rub", true)).toBe(6);
  });

  test("the log contract the server enforces is the client's encoding", () => {
    const body = fnBody("_submit_rooting_deep_core", pouchSql);
    expect(body).toContain("'^[srh][0-2]:([0-9]|[12][0-9])$'");
    expect(body).toContain("n > 45");
    // The waking action stays IN the log; nothing after it survives.
    expect(body).toContain("log := log[1:i];");
    // The three mints by layers banked, and the root's rule.
    expect(body).toContain("'dig', NULL");
    expect(body).toContain("'dig_deep', NULL");
    expect(body).toContain("AND tied_layer = 2 AND NOT v_woke");
    expect(body).toContain("'dig_root', NULL");
  });

  test("the migration's tickle table equals DIG_FIND_TICKLES (spec §2)", () => {
    const start = tallySql.indexOf("UPDATE public.app_settings SET");
    const end = tallySql.indexOf("WHERE key = 'dig_finds';", start);
    const block = tallySql.slice(start, end);
    const table: Partial<Record<DigFindKind, number>> = {};
    for (const m of block.matchAll(/"([a-z_]+)":\s*\{[^}]*"tickles":\s*(\d+)/g)) {
      table[m[1] as DigFindKind] = Number(m[2]);
    }
    // Deeper pays more (2026-09-17, cumulative-attention §3): 20260917180000
    // MERGES a new tickles value into some kinds. The live table is the
    // seeded row with those merged over it — that is what the server answers.
    for (const m of rulesSql.matchAll(
      /jsonb_build_object\('([a-z_]+)',\s+COALESCE\(value -> '[a-z_]+',\s+'\{\}'::jsonb\) \|\| '\{"tickles": (\d+)\}'::jsonb\)/g,
    )) {
      expect(table[m[1] as DigFindKind]).toBeDefined(); // merged, never invented
      table[m[1] as DigFindKind] = Number(m[2]);
    }
    expect(table).toEqual(DIG_FIND_TICKLES);
    // Every find kind is named, so a server-side lookup never falls to 0 by
    // accident (only the stone is 0).
    expect(Object.keys(table).sort()).toEqual(Object.keys(DIG_FIND_TICKLES).sort());
  });

  test("the tally lands through the applied-tickles rule and rides the receipt", () => {
    const apply = fnBody("apply_tickles", tallySql);
    // The 20260812010000 auto-apply rule: the count + the snouts, never the bank.
    expect(apply).toContain("tickles_earned = COALESCE(tickles_earned, 0) + p_n");
    expect(apply).toContain("counter = COALESCE(counter, 0) + p_n");
    expect(apply).not.toContain("user_items");
    expect(apply).not.toContain("grant_tickles");
    const core = fnBody("_submit_rooting_deep_core", pouchSql);
    expect(core).toContain("tickled_now := public.apply_tickles(p_user_id, tickle_total);");
    expect(core).not.toContain("grant_tickles");
    // A truffle he took pays 0, listed first as lost.
    expect(core).toContain("'id', COALESCE(lost_id, lost), 'kind', lost, 'tickles', 0, 'lost', true");
    // The tally sits OUTSIDE the crewed branch (uncrewed digs pay too).
    expect(core.indexOf("THE TALLY")).toBeGreaterThan(core.lastIndexOf("IF crewed THEN"));
    for (const key of ["'tickles',", "'tickles_total',", "'tickled_before',", "'tickled_now',"]) {
      expect(core).toContain(key);
    }
    // The client reads the same keys.
    const hook = fs.readFileSync(path.join(ROOT, "hooks/useRooting.ts"), "utf8");
    for (const key of ["r.tickles ??", "r.tickles_total", "r.tickled_before", "r.tickled_now"]) {
      expect(hook).toContain(key);
    }
  });

  test("the loose pouch: the server's kind classes are the client's, and a wake forces every consumable out of the bank", () => {
    const core = fnBody("_submit_rooting_deep_core", pouchSql);
    const kinds = (name: string) => {
      const m = new RegExp(`${name} text\\[\\] := ARRAY\\[([^\\]]+)\\]`).exec(core);
      expect(m).not.toBeNull();
      return m![1].split(",").map((x) => x.trim().replace(/'/g, ""));
    };
    expect(kinds("consumable_kinds")).toEqual([...DIG_CONSUMABLE_KINDS]);
    expect(kinds("collection_kinds")).toEqual([...DIG_COLLECTION_KINDS]);
    // Every non-food, non-stone kind is one or the other.
    const classed = new Set([...DIG_CONSUMABLE_KINDS, ...DIG_COLLECTION_KINDS]);
    for (const kind of Object.keys(DIG_FIND_TICKLES) as DigFindKind[]) {
      if (kind === "stone" || kind === "truffle_d" || kind === "truffle_l") continue;
      expect(classed.has(kind)).toBe(true);
    }
    // p_finds: a consumable banks only on a tie — a wake sends it to the lost pouch.
    expect(core).toContain("ELSIF k = ANY (consumable_kinds) THEN");
    expect(core).toContain("IF NOT (f = ANY (lost_things)) THEN lost_things := lost_things || f; END IF;");
    // The lost rows and the kept rows read 0 with their flag.
    expect(core).toContain("'id', find_id, 'kind', find_kind, 'tickles', 0, 'lost', true");
    expect(core).toContain("'id', find_id, 'kind', find_kind, 'tickles', 0, 'kept', true");
    // The receipt names both lists; the client's reconcile skips lost and kept rows.
    for (const key of ["'banked_things',", "'lost_things',"]) expect(core).toContain(key);
    const util = fs.readFileSync(path.join(ROOT, "utils/snoutDeep.ts"), "utf8");
    expect(util).toContain("if (t.lost || t.kept) continue;");
  });

  test("the client sends the log the server expects", () => {
    const hook = fs.readFileSync(path.join(ROOT, "hooks/useRooting.ts"), "utf8");
    expect(hook).toContain('rpcAction<SubmitPayload>("submit_rooting_deep", {');
    for (const key of ["p_user_id", "p_window_index", "p_actions", "p_layer", "p_finds", "p_missed", "p_things"]) {
      expect(hook).toContain(`${key}:`);
    }
    expect(hook).toContain('rpcAction("sync_rooting", {');
    // The classic call is untouched.
    expect(hook).toContain('rpcAction<SubmitPayload>("submit_rooting_checked", {');
  });
});

// ── The sniff budget (20260917130000) mirrors constants/dig.ts ──────────────
describe("sniff attention parity", () => {
  const { SNIFF_ATTENTION_STEP, SNIFF_FREE_PER_BOARD } = require("@/constants/dig") as typeof import("@/constants/dig");
  const { sniffAttention } = require("@/utils/rooting") as typeof import("@/utils/rooting");
  const mig = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/20260917130000_snout_deep_sniff_attention.sql"),
    "utf8",
  );
  it("the SQL overload's budget and step are the client's", () => {
    const m = mig.match(/GREATEST\(0, COALESCE\(p_prior_sniffs, 0\) \+ 1 - (\d+)\) \* (\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(SNIFF_FREE_PER_BOARD);
    expect(Number(m![2])).toBe(SNIFF_ATTENTION_STEP);
    expect(mig).toMatch(/LEAST\(/); // capped at the layer's shove
    expect(mig).toContain("public._snout_deep_wake_threshold(p_layer, 'h', p_coop)");
  });
  it("the core counts sniffs BEFORE the entry, the way sniffCount does", () => {
    expect(mig).toContain("thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open, prior_sniffs);");
    expect(mig).toContain("IF verb = 's' THEN prior_sniffs := prior_sniffs + 1; END IF;");
    expect(mig.indexOf("row_r.coop_at_open, prior_sniffs)")).toBeLessThan(mig.indexOf("prior_sniffs := prior_sniffs + 1"));
  });
  it("the per-board migration (20260917150000) resets the count on descent, before the threshold is read", () => {
    const per = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260917150000_snout_deep_sniff_budget_per_board.sql"),
      "utf8",
    );
    const reset = "IF lyr <> sniff_layer THEN prior_sniffs := 0; sniff_layer := lyr; END IF;";
    expect(per).toContain(reset);
    expect(per.indexOf(reset)).toBeLessThan(per.indexOf("row_r.coop_at_open, prior_sniffs)"));
    expect(per).toContain("IF verb = 's' THEN prior_sniffs := prior_sniffs + 1; END IF;");
    // Carried verbatim: the 130000 core and the 140000 core differ only by the reset and its declaration.
    const coreOf = (src: string) => src.slice(src.indexOf("CREATE OR REPLACE FUNCTION public._submit_rooting_deep_core"));
    const strip = (src: string) =>
      coreOf(src)
        .split("\n")
        .filter((l) => !l.includes("sniff_layer") && !l.trim().startsWith("--"))
        .join("\n");
    expect(strip(per)).toBe(strip(mig));
  });
  it("attention is 0 through the budget, then +step per extra sniff", () => {
    for (let k = 0; k < SNIFF_FREE_PER_BOARD; k++) expect(sniffAttention(k)).toBe(0);
    expect(sniffAttention(SNIFF_FREE_PER_BOARD)).toBe(SNIFF_ATTENTION_STEP);
    expect(sniffAttention(SNIFF_FREE_PER_BOARD + 3)).toBe(4 * SNIFF_ATTENTION_STEP);
  });
});

// ── The wake meter — rules 2 (20260917180000) ──────────────────────────────
// The meter is deterministic now, so parity is not "the same odds" but "the
// same NUMBER on the same action": both halves draw T off the same stream at
// the same index, add the same loudness, and compare the same way. Every line
// of that has to be pinned — the tuning defaults, the T formula over all 120
// draws, the order of the draws, the compare after the add, the scope reset,
// the dig_root gate — plus the carried core, which must differ from
// 20260917150000 by the marked meter lines alone.
describe("wake meter parity (rules 2)", () => {
  const {
    SNOUT_DEEP_RULES_MAX,
    WAKE_METER,
  } = require("@/constants/dig") as typeof import("@/constants/dig");
  const { sleepDepthFrom } = require("@/utils/rooting") as typeof import("@/utils/rooting");
  const { sanitizeWakeMeter } = require("@/utils/snoutDeep") as typeof import("@/utils/snoutDeep");
  const perBoardSql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/20260917150000_snout_deep_sniff_budget_per_board.sql"),
    "utf8",
  );
  const core = fnBody("_submit_rooting_deep_core", rulesSql);
  const meterFn = fnBody("_snout_deep_wake_meter", rulesSql);
  const overload = rulesSql.slice(
    rulesSql.indexOf("CREATE OR REPLACE FUNCTION public.open_rooting(p_rules smallint)"),
    rulesSql.indexOf("$function$;", rulesSql.indexOf("CREATE OR REPLACE FUNCTION public.open_rooting(")),
  );

  // The one line of arithmetic both halves live by, lifted out of the SQL.
  const T_LINE = "sleep_depth := m_lo + ((draws[di] * (m_hi - m_lo + 1)) / 120);";

  it("the tuning row's defaults are WAKE_METER", () => {
    const m = rulesSql.match(/'snout_deep_wake_meter', '(\{[^']*\})'::jsonb/);
    expect(m).not.toBeNull();
    const row = JSON.parse(m![1]) as Record<string, unknown>;
    expect(row).toEqual({ lo: 50, hi: 110, scope: "board", dig_root_gt: 0 });
    expect({
      lo: row.lo,
      hi: row.hi,
      scope: row.scope,
      digRootGt: row.dig_root_gt,
    }).toEqual(WAKE_METER);
    // Seeded, never clobbered — a retune survives a re-run of the migration.
    expect(rulesSql).toContain(
      "WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'snout_deep_wake_meter');",
    );
    // The stamp rides the row, NULL at rule 1.
    expect(rulesSql).toContain("ADD COLUMN IF NOT EXISTS wake_meter jsonb;");
    expect(rulesSql).toContain("COMMENT ON COLUMN public.war_rootings.wake_meter IS");
  });

  it("the SQL sanitiser garbles a bad row the way sanitizeWakeMeter does", () => {
    // Each end into [1, 120] on its own; a band that is not a band falls back
    // to the compiled defaults rather than inventing one.
    expect(meterFn).toContain("LEAST(120, GREATEST(1,");
    expect(meterFn).toContain("'lo', CASE WHEN lo < hi THEN lo ELSE 50 END,");
    expect(meterFn).toContain("'hi', CASE WHEN lo < hi THEN hi ELSE 110 END,");
    expect(meterFn).toContain("CASE WHEN v ->> 'scope' = 'dig' THEN 'dig' ELSE 'board' END");
    expect(meterFn).toContain("(v ->> 'dig_root_gt')::int = 1");
    // A JS transcription of the SQL, against the kernel's own sanitiser.
    const sqlMeter = (row: Record<string, unknown>) => {
      const int = (v: unknown, fallback: number) =>
        typeof v === "number" && Number.isInteger(v) ? v : fallback;
      const clamp = (v: number) => Math.min(120, Math.max(1, v));
      const lo = clamp(int(row.lo, 50));
      const hi = clamp(int(row.hi, 110));
      return {
        lo: lo < hi ? lo : 50,
        hi: lo < hi ? hi : 110,
        scope: row.scope === "dig" ? "dig" : "board",
        digRootGt: int(row.dig_root_gt, 0) === 1 ? 1 : 0,
      };
    };
    const rows: Record<string, unknown>[] = [
      {},
      { lo: 50, hi: 110, scope: "board", dig_root_gt: 0 },
      { lo: 40, hi: 80, scope: "dig", dig_root_gt: 1 },
      { lo: 0, hi: 999, scope: "dig", dig_root_gt: 1 },
      { lo: 200, hi: 5 },
      { lo: 70, hi: 70 },
      { lo: "deep", hi: null, scope: "sideways", dig_root_gt: "yes" },
      { dig_root_gt: 7 },
    ];
    for (const row of rows) expect(sqlMeter(row)).toEqual(sanitizeWakeMeter(row));
  });

  it("the SQL T formula is sleepDepthFrom, draw for draw, band for band", () => {
    expect(core).toContain(T_LINE);
    // Exactly the SQL line, in JS (integer division on non-negatives is floor).
    const m = T_LINE.match(
      /sleep_depth := m_lo \+ \(\(draws\[di\] \* \(m_hi - m_lo \+ (\d+)\)\) \/ (\d+)\);/,
    );
    expect(m).not.toBeNull();
    const [span1, die] = [Number(m![1]), Number(m![2])];
    expect(span1).toBe(1);
    expect(die).toBe(WAKE_DIE);
    const sqlT = (draw: number, lo: number, hi: number) =>
      lo + Math.trunc((draw * (hi - lo + span1)) / die);
    for (const [lo, hi] of [
      [WAKE_METER.lo, WAKE_METER.hi],
      [40, 80],
    ]) {
      for (let draw = 0; draw < WAKE_DIE; draw++) {
        expect(sqlT(draw, lo, hi)).toBe(sleepDepthFrom(draw, lo, hi));
      }
      // The band the rule promises: draw 0 is lo, the last draw is hi.
      expect(sqlT(0, lo, hi)).toBe(lo);
      expect(sqlT(WAKE_DIE - 1, lo, hi)).toBe(hi);
    }
  });

  it("the entry draw comes BEFORE the first action, and one per layer entered", () => {
    // Three board entries at most, on top of the log.
    expect(core).toContain("draws := public._snout_deep_wake_draws(row_r.seed, n + 3);");
    // Topsoil's T: the first draw, taken outside the loop.
    const openDraw = core.indexOf(T_LINE);
    const loopTop = core.indexOf("IF lyr <> sniff_layer THEN prior_sniffs := 0; sniff_layer := lyr; END IF;");
    expect(openDraw).toBeGreaterThan(core.indexOf("draws := public._snout_deep_wake_draws"));
    expect(openDraw).toBeLessThan(loopTop);
    // A descent takes ONE draw per layer entered, exactly as descend() does.
    expect(core).toContain("WHILE board_layer < lyr LOOP");
    expect(core).toContain("board_layer := board_layer + 1;");
    expect(core.indexOf(T_LINE, loopTop)).toBeGreaterThan(loopTop);
    // Every action consumes a draw too, so the k-th action still meets the
    // k-th draw after the entries (the kernel's wakeIndex counts both).
    expect(core).toContain("IF row_r.rules >= 2 THEN di := di + 1; END IF;");
    const kernel = fs.readFileSync(path.join(ROOT, "utils/snoutDeep.ts"), "utf8");
    expect(kernel).toContain("wakeIndex: entry == null ? 0 : 1,");
    expect(kernel).toContain("const wakeIndex = state.wakeIndex + 1;");
    expect(kernel).toContain("wakeIndex: resets ? state.wakeIndex + 1 : state.wakeIndex,");
  });

  it("the loudness lands first, then the compare — and the loudness is the wake table", () => {
    // No second table: rule 2 adds what rule 1 rolled against.
    expect(core).toContain(
      "thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open, prior_sniffs);",
    );
    expect(rulesSql).not.toContain("_snout_deep_loudness");
    expect(core).toContain("attention := attention + thr;");
    expect(core).toContain("IF attention >= sleep_depth THEN");
    expect(core.indexOf("attention := attention + thr;")).toBeLessThan(
      core.indexOf("IF attention >= sleep_depth THEN"),
    );
    // The kernel's loudness is the same call, and its wake is the same compare.
    const kernel = fs.readFileSync(path.join(ROOT, "utils/snoutDeep.ts"), "utf8");
    expect(kernel).toContain("return wakeThreshold(layer, verb, coop, priorSniffs);");
    // Rule 1 keeps its roll, on its own branch.
    expect(core).toContain("ELSIF draws[i] < thr THEN");
  });

  it("scope 'board' empties the meter on a descent; scope 'dig' never does", () => {
    expect(core).toContain("IF row_r.rules >= 2 AND m_scope = 'board' THEN");
    const at = core.indexOf("IF row_r.rules >= 2 AND m_scope = 'board' THEN");
    const reset = core.indexOf("attention := 0;", at);
    expect(reset).toBeGreaterThan(at);
    expect(reset).toBeLessThan(core.indexOf("END LOOP;", at));
    // The row's own stamp, never today's config.
    expect(core).toContain("wm      := COALESCE(row_r.wake_meter, public._snout_deep_wake_meter());");
    expect(core).toContain("m_scope := COALESCE(wm ->> 'scope', 'board');");
    // The kernel resets on the same condition and redraws on the same draw.
    const kernel = fs.readFileSync(path.join(ROOT, "utils/snoutDeep.ts"), "utf8");
    expect(kernel).toContain('const resets = state.rules === 2 && state.wakeMeter.scope === "board";');
    expect(kernel).toContain("attention: resets ? 0 : state.attention,");
  });

  it("the root tie's +1 is gated by the stamp under rule 2, and only there", () => {
    expect(core).toContain(
      "IF row_r.rules < 2 OR COALESCE((row_r.wake_meter ->> 'dig_root_gt')::int, 1) = 1 THEN",
    );
    // Still minted — gated, not removed.
    expect(core).toContain("'dig_root', NULL");
    expect(core).toContain("IF 'truffle_l' = ANY (claimed) AND tied_layer = 2 AND NOT v_woke");
    // The client's tie button counts it under the same stamp.
    const kernel = fs.readFileSync(path.join(ROOT, "utils/snoutDeep.ts"), "utf8");
    expect(kernel).toContain("state.rules !== 2 || state.wakeMeter.digRootGt === 1");
    expect(WAKE_METER.digRootGt).toBe(0);
  });

  it("the meter and his depth ride the receipt", () => {
    expect(core).toContain("'attention',      attention,");
    expect(core).toContain("'sleep_depth',    sleep_depth,");
    expect(core).toContain("attention   int := 0;");
    expect(core).toContain("sleep_depth int := NULL;");
  });

  it("the 150000 and 160000 cores differ only by the marked meter lines", () => {
    // Every line rule 2 adds sits between a >>> rules 2 and a <<< rules 2
    // marker, so the carry is auditable: strip the marked regions and what is
    // left must be the 20260917150000 body, line for line.
    const stripMarked = (src: string) => {
      const body = fnBody("_submit_rooting_deep_core", src);
      const out: string[] = [];
      let inMeter = false;
      let opened = 0;
      for (const line of body.split("\n")) {
        if (line.includes(">>> rules 2")) {
          expect(inMeter).toBe(false); // never nested
          inMeter = true;
          opened += 1;
          continue;
        }
        if (line.includes("<<< rules 2")) {
          expect(inMeter).toBe(true); // never closed unopened
          inMeter = false;
          continue;
        }
        if (!inMeter) out.push(line);
      }
      expect(inMeter).toBe(false); // every region closed
      return { lines: out.map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("--")), opened };
    };
    const was = stripMarked(perBoardSql);
    const now = stripMarked(rulesSql);
    expect(was.opened).toBe(0);
    // Eight regions: the declarations, the row's stamp, topsoil's T, the
    // descent's T + the action's draw, the compare, the dig_root gate's two
    // halves, and the two receipt keys. Any ninth is a meter line someone
    // forgot to mark.
    expect(now.opened).toBe(8);
    // The two lines the meter changes rather than adds, named out loud:
    // three more draws for the board entries, and rule 1's roll becoming the
    // ELSE of the meter's compare.
    const normalised = now.lines.map((l) =>
      l === "draws := public._snout_deep_wake_draws(row_r.seed, n + 3);"
        ? "draws := public._snout_deep_wake_draws(row_r.seed, n);"
        : l === "ELSIF draws[i] < thr THEN"
          ? "IF draws[i] < thr THEN"
          : l,
    );
    expect(normalised).toEqual(was.lines);
  });

  it("open_rooting(p_rules) is the zero-arg body, carried, plus the two stamps", () => {
    const zero = fnBody("open_rooting", sql); // 20260913060000 — the latest def
    // Strip the overload back down: the signature, the two declarations, the
    // two stamps and the four returned keys are the whole diff.
    const stripped = overload
      .replace("public.open_rooting(p_rules smallint)", "public.open_rooting()")
      .replace(", mode, coop_at_open, rules, wake_meter)", ", mode, coop_at_open)")
      .replace(", deep AND coop_now, the_rules, the_meter);", ", deep AND coop_now);")
      .split("\n")
      .filter(
        (l) =>
          !/the_rules|the_meter|'rules',|'wake_meter',/.test(l) && !l.trim().startsWith("--"),
      )
      .join("\n");
    const bare = zero
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(stripped).toBe(bare);
    // The stamps: what the client asks for, capped by the config; the tuning
    // as it stands at open, and only at rule 2.
    expect(overload).toContain(
      "the_rules := LEAST(GREATEST(COALESCE(p_rules, 1)::int, 1), public._snout_deep_rules())::smallint;",
    );
    expect(overload).toContain(
      "the_meter := CASE WHEN the_rules >= 2 THEN public._snout_deep_wake_meter() ELSE NULL END;",
    );
    // Both return paths name both stamps — the already-open row's own, too.
    expect(overload).toContain("'rules', the_rules,");
    expect(overload).toContain("'wake_meter', the_meter,");
    expect(overload).toContain("'rules', COALESCE(existing.rules, 1),");
    expect(overload).toContain("'wake_meter', existing.wake_meter,");
    // The zero-arg def is untouched: it never mentions rules, so it opens at
    // the column default and an old client keeps rolling.
    expect(zero).not.toContain("rules");
    expect(zero).not.toContain("wake_meter");
    expect(rulesSql).not.toContain("CREATE OR REPLACE FUNCTION public.open_rooting()");
    expect(rulesSql).toContain("GRANT EXECUTE ON FUNCTION public.open_rooting(smallint) TO authenticated;");
    expect(rulesSql).toContain("REVOKE ALL ON FUNCTION public.open_rooting(smallint) FROM PUBLIC, anon;");
  });

  it("the rule stamp and its config are the client's contract", () => {
    expect(SNOUT_DEEP_RULES_MAX).toBe(2);
    expect(rulesSql).toContain("ADD COLUMN IF NOT EXISTS rules smallint NOT NULL DEFAULT 1;");
    expect(rulesSql).toContain("CHECK (rules IN (1, 2))");
    expect(rulesSql).toContain(`'snout_deep_rules', '{"rules": ${SNOUT_DEEP_RULES_MAX}}'::jsonb`);
    // Seeded, never clobbered — a rollback to {"rules": 1} survives a re-run.
    expect(rulesSql).toContain(
      "WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'snout_deep_rules');",
    );
    // The reader falls back to rule 1 when the row is missing.
    const rules = fnBody("_snout_deep_rules", rulesSql);
    expect(rules).toContain("(value ->> 'rules')::int");
    expect(rules).toContain("1)");
    // The client asks for the newest it understands and reads back both stamps.
    const hook = fs.readFileSync(path.join(ROOT, "hooks/useRooting.ts"), "utf8");
    expect(hook).toMatch(/p_rules:\s*SNOUT_DEEP_RULES_MAX/);
    expect(hook).toMatch(/r\.rules/);
    expect(hook).toMatch(/wake_meter/);
  });
});
