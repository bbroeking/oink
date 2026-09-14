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
