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
import { WAKE_SEED_MULT, WakeStream, wakeSeed, wakeThreshold } from "@/utils/rooting";

const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260913060000_snout_deep.sql"),
  "utf8",
);

function fnBody(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("$function$;", start);
  return sql.slice(start, end);
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
    const body = fnBody("_submit_rooting_deep_core");
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
