// Snout Deep — the press-your-luck dig as a pure (state, event) → state machine.
//
// "Sniff to know, rub to take, dig as deep as you dare — tie off before he
// wakes." Spec: docs/dig-redesign/a-snout-deep-spec.md (§7 is this file's
// contract). It mirrors utils/digSession.ts's idiom: every rule is a unit test
// and the UI is a renderer. Nothing here touches the network, the clock, or a
// component — the reducer takes a board (utils/rooting.generateLayeredBoard)
// and returns new state objects; a no-op returns the SAME object so a renderer
// can `===` its way out of a re-render.
//
// The rules, in one place:
//   · every non-no-op verb is one action (toward the 45 cap), one log entry
//     ("s2:14" / "r2:14" / "h2:14" = sniff / rub / shove, LAYER (0-based —
//     the `Layer` type's own numbering: 0 topsoil · 1 mud · 2 the root), then
//     ":" and the tile index) and one wake draw;
//   · every verb draws once. A sniff marks scent; its threshold is 0 in
//     topsoil (truly never), 3 in the mud, 7 at the root (4 co-op). A rub is
//     1 · 6 · 15 (8 co-op). Sniff and rub are never free below topsoil;
//   · a no-op (cleared tile, re-sniff, out of bounds, ended dig) changes
//     nothing and consumes no draw;
//   · rub / shove go through the shared applySplash kernel (rub −1/−½, shove
//     −2/−1, floor 0);
//   · a find whose tiles all reach 0 is revealed: a truffle becomes `loose`
//     (one truffle per layer); a CONSUMABLE thing (Boom, pouch, apple,
//     shimmer, acorn, tea, scroll, charm) joins `looseThings` — the pouch at
//     stake; a COLLECTION thing (keepsake, relic, furnishing, bow) goes into
//     `things` and is yours, tie or wake (the loose pouch, 2026-09-14);
//   · the dig applies first, then the roll: a collection thing revealed on
//     the waking action is still yours, a truffle or consumable uncovered on
//     it goes straight to `missed` — the waking action is IN the log, not
//     after it;
//   · `descend` banks the loose TRUFFLE (bank on descent), moves the layer's
//     touched-but-uncollected truffle into `missed` (only truffles carry),
//     clears scent, enters the next layer; `looseThings` ride down UNTOUCHED
//     — descending does not bank a thing; not offered at the root;
//   · `tie` banks the truffle AND sweeps `looseThings` into `banked`, then
//     ends; the 45th action ends as `cap` (= tie) unless it woke him (the
//     roll happens before the cap check); `close` ends as tie;
//   · a wake takes the loose truffle and EVERY loose thing — topsoil's, the
//     mud's and the root's together — into `missed`; `banked` and `things`
//     are untouched.

import { satchelReceiptLine, satchelReceiptRoll, type SatchelReceiptRoll } from "@/utils/satchel";
import {
  DIG_FIND_TICKLES,
  DIG_FOOD_KINDS,
  isDigCollectionThing,
  PATCH_COLS,
  PATCH_ROWS,
  SNOUT_DEEP_ACTION_CAP,
  SNIFF_FREE_PER_DIG,
  WAKE_DIE,
  type DigFindKind,
  type SnoutDeepLayer,
  type SnoutDeepVerb,
} from "@/constants/dig";
import {
  applySplash,
  clusterRevealed,
  clusterTouched,
  generateLayeredBoard,
  WakeStream,
  sniffAttention,
  wakeThreshold as kernelWakeThreshold,
  type LayerBoard,
  type LayerFind,
  type SnoutDeepBoard,
} from "@/utils/rooting";

export type Verb = SnoutDeepVerb;
export type Layer = SnoutDeepLayer;
export type FindKind = DigFindKind;
export type Find = LayerFind;
export type { LayerBoard, SnoutDeepBoard };

export const LAYER_NAMES: Readonly<Record<Layer, string>> = {
  0: "topsoil",
  1: "the mud",
  2: "the root",
};

/** The Feeding card's per-member line (spec §3 / §5.10): "tied at the mud" ·
 *  "woke at the root"; null when the row carries no layer (a classic dig). */
export function digLayerLine(
  layerTied: number | null | undefined,
  woke: boolean | null | undefined,
): string | null {
  if (layerTied !== 0 && layerTied !== 1 && layerTied !== 2) return null;
  return `${woke ? "woke" : "tied"} at ${LAYER_NAMES[layerTied]}`;
}

export interface SnoutDeepState {
  board: SnoutDeepBoard;
  layer: Layer;
  depths: number[]; // the current layer's live depths
  scent: (number | null)[]; // per tile, this layer
  actions: string[]; // the log: "s2:14" · "r2:14" · "h2:14"
  wakeIndex: number; // draws consumed
  loose: string | null; // the current layer's truffle id, if uncovered and unbanked
  looseThings: string[]; // consumable thing ids loose in the pouch, surfacing order — across layers, at stake until `tie`
  banked: string[]; // find ids banked (truffles on descend/tie, consumables on tie) — across layers
  things: string[]; // collection thing ids revealed (kept on reveal) — across layers
  found: string[]; // every find id (truffle or thing) in the order it surfaced — the tally's order
  missed: string[]; // touched-but-uncollected cluster ids left behind
  layersTied: Layer[]; // layers whose truffle banked (for GT reasons)
  coop: boolean;
  uncrewed: boolean;
  ended: null | {
    reason: "tie" | "wake" | "cap" | "close";
    layer: Layer;
    wokeOn?: string;
  };
}

export type SnoutDeepEvent =
  | { type: "act"; verb: Verb; tile: number } // no-ops return state unchanged
  | { type: "descend" } // Dig deeper
  | { type: "tie" }
  | { type: "close" }; // window closed (server tie)

const TILE_COUNT = PATCH_ROWS * PATCH_COLS;
const VERB_LETTER: Readonly<Record<Verb, string>> = {
  sniff: "s",
  rub: "r",
  shove: "h",
};
const LETTER_VERB: Readonly<Record<string, Verb>> = {
  s: "sniff",
  r: "rub",
  h: "shove",
};

export function initialState(
  board: SnoutDeepBoard,
  opts: { coop: boolean; uncrewed: boolean },
): SnoutDeepState {
  return {
    board,
    layer: 0,
    depths: board.layers[0].depths.slice(),
    scent: new Array<number | null>(TILE_COUNT).fill(null),
    actions: [],
    wakeIndex: 0,
    loose: null,
    looseThings: [],
    banked: [],
    things: [],
    found: [],
    missed: [],
    layersTied: [],
    coop: opts.coop,
    uncrewed: opts.uncrewed,
    ended: null,
  };
}

export const wakeThreshold = kernelWakeThreshold;

/** Sniffs spent so far — every "s…" entry in the log (no-ops are never logged). */
export function sniffCount(actions: readonly string[]): number {
  let n = 0;
  for (const a of actions) if (a.charCodeAt(0) === 115 /* s */) n += 1;
  return n;
}

/** Free sniffs left in this dig, never below 0. */
export function sniffsLeft(state: Pick<SnoutDeepState, "actions">): number {
  return Math.max(0, SNIFF_FREE_PER_DIG - sniffCount(state.actions));
}

/** The attention the NEXT sniff would draw (0 inside the budget). */
export function nextSniffAttention(state: Pick<SnoutDeepState, "actions">): number {
  return sniffAttention(sniffCount(state.actions));
}

/** The wake threshold the next action of `verb` would roll at. */
export function nextThreshold(
  state: Pick<SnoutDeepState, "actions" | "layer" | "coop">,
  verb: Verb,
): number {
  return wakeThreshold(state.layer, verb, state.coop, sniffCount(state.actions));
}

/** "free" · "1 in 120" · "1 in 6" — the short odds a verb card wears. */
export function shortOdds(threshold: number): string {
  if (threshold <= 0) return "free";
  return `1 in ${Math.round(WAKE_DIE / threshold)}`;
}

/** Encode one log entry. Exposed so the tests and the dev strip read the log
 *  the way the server will. */
export function encodeAction(verb: Verb, layer: Layer, tile: number): string {
  return `${VERB_LETTER[verb]}${layer}:${tile}`;
}

export function decodeAction(
  entry: string,
): { verb: Verb; layer: Layer; tile: number } | null {
  const m = /^([srh])([012]):(\d+)$/.exec(entry);
  if (!m) return null;
  return {
    verb: LETTER_VERB[m[1]],
    layer: Number(m[2]) as Layer,
    tile: Number(m[3]),
  };
}

// ── Scent ───────────────────────────────────────────────────────────────────
// The number of FIND tiles in the 3 × 3 around `tile` (itself included) in
// this layer. Every find counts — truffle tiles and every thing's tile; stones
// never. Buried, half-cleared and cleared tiles all count: the number is a
// property of the layer, not of the dig. Range 0–9. Exact — it never lies.

export function scentAt(layer: LayerBoard, tile: number): number {
  if (tile < 0 || tile >= TILE_COUNT) return 0;
  const r = Math.floor(tile / PATCH_COLS);
  const c = tile % PATCH_COLS;
  let n = 0;
  for (const f of layer.finds) {
    if (f.kind === "stone") continue;
    for (const t of f.tiles) {
      const tr = Math.floor(t / PATCH_COLS);
      const tc = t % PATCH_COLS;
      if (Math.abs(tr - r) <= 1 && Math.abs(tc - c) <= 1) n++;
    }
  }
  return n;
}

// ── Queries ─────────────────────────────────────────────────────────────────

function currentLayer(state: SnoutDeepState): LayerBoard {
  return state.board.layers[state.layer];
}

export function isNoOp(state: SnoutDeepState, verb: Verb, tile: number): boolean {
  if (state.ended) return true;
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_COUNT) return true;
  if (state.depths[tile] <= 0) return true; // any verb on a cleared tile
  if (verb === "sniff" && state.scent[tile] != null) return true; // re-sniff
  return false;
}

/** The finds (never stones) whose every tile is at depth 0 in this layer. */
export function revealed(state: SnoutDeepState): Find[] {
  return currentLayer(state).finds.filter(
    (f) => f.kind !== "stone" && clusterRevealed(f.tiles, state.depths),
  );
}

/** Which find (if any) owns a tile in the current layer. Render helper. */
export function findAtTile(state: SnoutDeepState, tile: number): Find | null {
  for (const f of currentLayer(state).finds) {
    if (f.tiles.includes(tile)) return f;
  }
  return null;
}

/** The layer's truffle cluster (a layer holds at most one; the root none). */
export function layerTruffle(layer: LayerBoard): Find | null {
  return layer.finds.find((f) => f.food) ?? null;
}

function findById(board: SnoutDeepBoard, id: string): Find | null {
  for (const layer of board.layers) {
    for (const f of layer.finds) if (f.id === id) return f;
  }
  return null;
}

// ── The reducer ─────────────────────────────────────────────────────────────

export function reduce(state: SnoutDeepState, event: SnoutDeepEvent): SnoutDeepState {
  switch (event.type) {
    case "act":
      return act(state, event.verb, event.tile);
    case "descend":
      return descend(state);
    case "tie":
      return end(state, "tie");
    case "close":
      return end(state, "close");
    default:
      return state;
  }
}

function act(state: SnoutDeepState, verb: Verb, tile: number): SnoutDeepState {
  if (isNoOp(state, verb, tile)) return state;

  const entry = encodeAction(verb, state.layer, tile);
  const actions = [...state.actions, entry];

  // The dig lands first.
  let depths = state.depths;
  let scent = state.scent;
  let loose = state.loose;
  let looseThings = state.looseThings;
  let things = state.things;
  let found = state.found;
  if (verb === "sniff") {
    scent = state.scent.slice();
    scent[tile] = scentAt(currentLayer(state), tile);
  } else {
    depths = state.depths.slice();
    applySplash(depths, tile, verb);
    // Reveals: every cluster whose last tile just cleared. A truffle becomes
    // loose (a layer holds one); a consumable thing joins the loose pouch; a
    // collection thing is yours the moment it clears. Stones reveal into
    // nothing.
    for (const f of currentLayer(state).finds) {
      if (f.kind === "stone") continue;
      if (!clusterRevealed(f.tiles, depths)) continue;
      if (clusterRevealed(f.tiles, state.depths)) continue; // already up
      if (f.food) loose = f.id;
      else if (isDigCollectionThing(f.kind)) {
        if (!things.includes(f.id)) things = [...things, f.id];
      } else if (!looseThings.includes(f.id) && !state.banked.includes(f.id)) {
        looseThings = [...looseThings, f.id];
      }
      if (!found.includes(f.id)) found = [...found, f.id];
    }
  }

  // Then the roll. One draw per action, drawn even when the threshold is 0 so
  // the k-th action is the k-th draw on every replay.
  const draw = new WakeStream(state.board.seed).skip(state.wakeIndex).next();
  const wakeIndex = state.wakeIndex + 1;
  const threshold = wakeThreshold(state.layer, verb, state.coop, sniffCount(state.actions));
  const woke = draw < threshold;

  const next: SnoutDeepState = {
    ...state,
    depths,
    scent,
    actions,
    wakeIndex,
    loose,
    looseThings,
    things,
    found,
  };

  if (woke) {
    // He takes the loose truffle and the whole loose pouch — every consumable
    // carried down from topsoil, the mud and the root; everything banked and
    // every collection thing is untouched. The layer's touched-but-uncollected
    // truffle is missed too (it would have been, had the dig gone on).
    return {
      ...next,
      loose: null,
      looseThings: [],
      missed: withMissed(next, loose, looseThings),
      ended: { reason: "wake", layer: state.layer, wokeOn: entry },
    };
  }
  if (actions.length >= SNOUT_DEEP_ACTION_CAP) return end(next, "cap");
  return next;
}

/** `missed` plus the loose truffle and the loose pouch (a wake) and/or the
 *  current layer's touched-but-uncollected truffle (a layer left behind).
 *  Only truffles carry to the next Feeding; a lost thing is listed so the
 *  tally can name it, and is gone. */
function withMissed(
  state: SnoutDeepState,
  lostLoose: string | null,
  lostThings: readonly string[] = [],
): string[] {
  const out = state.missed.slice();
  if (lostLoose && !out.includes(lostLoose)) out.push(lostLoose);
  for (const id of lostThings) if (!out.includes(id)) out.push(id);
  const truffle = layerTruffle(currentLayer(state));
  if (
    truffle &&
    truffle.id !== lostLoose &&
    !state.banked.includes(truffle.id) &&
    state.loose !== truffle.id &&
    !out.includes(truffle.id) &&
    clusterTouched(truffle.tiles, state.depths) &&
    !clusterRevealed(truffle.tiles, state.depths)
  ) {
    out.push(truffle.id);
  }
  return out;
}

/** Bank the loose truffle: into `banked`, its layer into `layersTied`. */
function bank(state: SnoutDeepState): Pick<SnoutDeepState, "banked" | "layersTied" | "loose"> {
  if (!state.loose) {
    return { banked: state.banked, layersTied: state.layersTied, loose: null };
  }
  return {
    banked: state.banked.includes(state.loose) ? state.banked : [...state.banked, state.loose],
    layersTied: state.layersTied.includes(state.layer)
      ? state.layersTied
      : [...state.layersTied, state.layer],
    loose: null,
  };
}

/** Tie it off: the truffle banks, then every loose thing, in surfacing order. */
function bankPouch(state: SnoutDeepState): Pick<SnoutDeepState, "banked" | "layersTied" | "loose" | "looseThings"> {
  const truffle = bank(state);
  if (state.looseThings.length === 0) return { ...truffle, looseThings: [] };
  const banked = truffle.banked.slice();
  for (const id of state.looseThings) if (!banked.includes(id)) banked.push(id);
  return { ...truffle, banked, looseThings: [] };
}

function descend(state: SnoutDeepState): SnoutDeepState {
  if (state.ended) return state;
  if (state.layer >= 2) return state; // no fourth layer — not offered at the root
  const nextLayer = (state.layer + 1) as Layer;
  // The truffle banks on the way down; the loose pouch rides down with you.
  return {
    ...state,
    ...bank(state),
    missed: withMissed(state, null),
    layer: nextLayer,
    depths: state.board.layers[nextLayer].depths.slice(),
    scent: new Array<number | null>(TILE_COUNT).fill(null),
  };
}

function end(state: SnoutDeepState, reason: "tie" | "cap" | "close"): SnoutDeepState {
  if (state.ended) return state;
  return {
    ...state,
    ...bankPouch(state),
    missed: withMissed(state, null),
    ended: { reason, layer: state.layer },
  };
}

// ── Replay ──────────────────────────────────────────────────────────────────
// The saved snapshot is `{ layer, actions }` (§10): the log carries each
// action's layer, so a replay descends whenever an entry sits deeper than the
// state and then acts. Determinism: replaying `state.actions` from
// `initialState` yields an equal state (before the closing tie).

export function replay(
  board: SnoutDeepBoard,
  opts: { coop: boolean; uncrewed: boolean },
  actions: readonly string[],
): SnoutDeepState {
  let state = initialState(board, opts);
  for (const entry of actions) {
    const a = decodeAction(entry);
    if (!a) continue;
    while (state.layer < a.layer && !state.ended) state = reduce(state, { type: "descend" });
    state = reduce(state, { type: "act", verb: a.verb, tile: a.tile });
  }
  return state;
}

/** The k-th (0-based) wake draw for a seed — the dev strip's "last draw". */
export function wakeDrawAt(seed: number, k: number): number {
  return new WakeStream(seed).skip(k).next();
}

// ── Copy — the finds as the player reads them ───────────────────────────────
// One table for the reveal sticker, the pouch marks and the tally rows, so a
// find is named the same way everywhere. `title` is the sticker/row title,
// `tail` the reveal's second clause, `value` the reveal's short read, `sub`
// the tally row's hand line — what the find ALSO does beside its tickles
// (§5.7: "the herd's too — +1 Golden Truffle" / "on the shelf as well" / "+1
// Mote as well"). The Boom's tickles are the catch-up's `boom(H)` (§4) — the
// client can't know H, so the reveal takes the amount as an argument (3 when
// H = 0) and the row reads "the catch-up: 3 + N for the gap".

export const BOOM_BASE_TICKLES = DIG_FIND_TICKLES.boom;

export type FindTone = "sun" | "sage" | "rose" | "lilac" | "paper" | "roseDeep";

interface FindCopy {
  title: string;
  tail: string;
  value: string;
  sub: string;
  tone: FindTone;
}

const JUNK_TITLES: Readonly<Record<string, string>> = {
  boot: "his old boot",
  horseshoe: "a bent horseshoe",
  cap: "a bottle cap",
};

/** The Boom row's hand line: the base plus the catch-up's gap, when there is one. */
export function boomSubLine(boomTickles: number): string {
  const gap = boomTickles - BOOM_BASE_TICKLES;
  return gap > 0 ? `the catch-up: ${BOOM_BASE_TICKLES} + ${gap} for the gap` : "the catch-up";
}

export function findCopy(find: Find, boomTickles = BOOM_BASE_TICKLES): FindCopy {
  switch (find.kind) {
    case "truffle_d":
      return { title: "a truffle", tail: "loose, until you tie it", value: "loose", sub: "the topsoil's", tone: "sun" };
    case "truffle_l":
      return { title: "the fat one", tail: "loose, until you tie it", value: "loose", sub: "the mud's", tone: "sun" };
    case "boom":
      return { title: "a Tickle Boom", tail: `+${boomTickles} tickles, yours`, value: `+${boomTickles} tickles`, sub: boomSubLine(boomTickles), tone: "rose" };
    case "pouch":
      return { title: "a snout pouch", tail: "+15 snouts", value: "+15 snouts", sub: "+15 snouts as well", tone: "sun" };
    case "apple":
      return { title: "a windfall apple", tail: "Rosie is +8 happier", value: "+8 happy", sub: "Rosie ate it — +8 happy as well", tone: "rose" };
    case "junk":
      return { title: JUNK_TITLES[find.variant ?? ""] ?? "a keepsake", tail: "new for the Barn", value: "new", sub: "on the shelf as well", tone: "paper" };
    case "shimmer":
      return { title: "a shimmer pocket", tail: "+1 Mote", value: "+1 Mote", sub: "+1 Mote as well", tone: "lilac" };
    case "acorn":
      return { title: "a Clockwork Acorn", tail: "a day of the Auto-Tickler", value: "1 day", sub: "a day of Auto-Tickler as well", tone: "sage" };
    case "tea":
      return { title: "a flask of warm tea", tail: "warm tea, 8 h, on you", value: "8 h", sub: "warm tea on you, 8 h, as well", tone: "sage" };
    case "scroll":
      return { title: "a Pass XP scroll", tail: "+40 Pass XP", value: "+40 XP", sub: "+40 Pass XP as well", tone: "lilac" };
    case "relic":
      return { title: "a relic", tail: "new in the Burrow Book", value: "new", sub: "in the Burrow Book as well", tone: "lilac" };
    case "furnishing":
      return { title: "an Unearthed furnishing", tail: "new for the Barn", value: "new", sub: "a Barn piece as well", tone: "paper" };
    case "bow":
      return { title: "a buried bow", tail: "new for the Closet", value: "new", sub: "in the Closet as well", tone: "rose" };
    case "charm":
      return { title: "a bless charm", tail: "one free blessing to send", value: "1 to send", sub: "a blessing to send as well", tone: "sage" };
    case "stone":
    default:
      return { title: "a stone", tail: "just a stone", value: "", sub: "", tone: "paper" };
  }
}

/** The reveal sticker's line: "a Tickle Boom · +19 tickles, yours". */
export function findRevealLine(find: Find, boomTickles = BOOM_BASE_TICKLES): string {
  const c = findCopy(find, boomTickles);
  return `${c.title} · ${c.tail}`;
}

// ── The find tickle table — the server's, over the compiled fallback ────────
// `app_settings.dig_finds` rides on open_rooting as {kind: {odds, tickles}}
// (20260913120000); a kind the server does not name keeps DIG_FIND_TICKLES's
// value, and an older server's {kind: [n, d]} shape names no tickles at all.

export type DigFindTickles = Readonly<Record<FindKind, number>>;

export function resolveDigFindTickles(server: unknown): DigFindTickles {
  const out: Record<FindKind, number> = { ...DIG_FIND_TICKLES };
  if (!server || typeof server !== "object" || Array.isArray(server)) return out;
  for (const kind of Object.keys(out) as FindKind[]) {
    const entry = (server as Record<string, unknown>)[kind];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const t = (entry as { tickles?: unknown }).tickles;
    if (typeof t === "number" && Number.isFinite(t) && t >= 0) out[kind] = Math.trunc(t);
  }
  return out;
}

// ── The receipt — the tally the payoff sheets render (§5.7 / §5.8) ──────────
// One row per find in the order it surfaced, each worth its tickles; the
// truffle he took first, at "his"; a consumable lost with the pouch at
// "lost"; a collection thing kept through a wake at "kept" (its tickles rode
// the tie he ended); Pass XP last, paying none. `tickledBefore`
// is the Barn's count as the dig ended (null when the caller can't know it —
// the sheet then rolls the dig's own total) and `tickledNow` is that plus the
// tally. The server's receipt corrects both and every row's tickles through
// `reconcileReceipt` when it lands.

export type GtReason = "dig" | "dig_deep" | "dig_root";

export interface DigReceiptRow {
  id: string;
  /** Which mark the ledger draws: a find kind, or XP. */
  mark: FindKind | "xp";
  /** The junk keepsake's variant (boot · horseshoe · cap) — which mark it wears. */
  variant?: string;
  tone: FindTone;
  title: string;
  sub?: string;
  /** The value column's text when the row pays no tickles ("his", "+20 XP"). */
  value: string;
  /** The tickles this row rolls into the count; absent = the row pays none. */
  tickles?: number;
  /** He took it: the truffle reads "his", a consumable from the pouch reads
   *  "lost" — the value column in mute, no number. */
  lost?: boolean;
  /** A collection thing kept through a wake: "kept", no number — its tickles
   *  would have paid on the tie. */
  kept?: boolean;
  /** Uncrewed: the row is the join door (its sub is the join line). */
  join?: boolean;
}

export interface DigReceipt {
  kind: "tied" | "woke";
  kicker: string;
  title: string;
  /** The hand line under the title. */
  countLine: string;
  /** The woke sheet's line naming the action and its odds; absent on a tie. */
  wokeLine?: string;
  /** The woke sheet's closing hand line ("next time — tie it at the mud?"). */
  nextTimeLine?: string;
  rows: DigReceiptRow[];
  /** The GT reasons this dig mints, in order — empty when uncrewed. */
  gt: GtReason[];
  xp: number;
  /** The sum of every row's tickles — the foot's "the dig · +N". */
  ticklesTotal: number;
  /** The count before the dig, or null when unknown until the server answers. */
  tickledBefore: number | null;
  /** The count after: before + total; null while before is unknown. */
  tickledNow: number | null;
  /** What the dig rolled into the Satchel — the finds that went in, the ones
   *  a full bag turned away, and the bag's count / cap — drawn as the tally's
   *  last beat. Filled by the server's receipt; null until it lands. */
  satchel?: SatchelReceiptRoll | null;
  /** The same roll as one sentence — the bag block's accessibility label. */
  satchelLine?: string | null;
  /** Uncrewed only, when no truffle row carries the join line: the foot's join door. */
  joinLine?: string;
  primary: string;
  secondary?: string;
}

export const DIG_PASS_XP = 20;
const SCROLL_XP = 40;
export const JOIN_LINE = "truffles are for herds — find yours ›";

// "one in six" — the odds a wake line names. The wake table's reciprocals,
// rounded, with a numeric fallback for a server-tuned threshold.
const ODDS_WORDS: Readonly<Record<number, string>> = {
  3: "three",
  6: "six",
  8: "eight",
  12: "twelve",
  15: "fifteen",
  17: "seventeen",
  20: "twenty",
  30: "thirty",
  40: "forty",
  120: "a hundred and twenty",
};
export function oddsPhrase(threshold: number): string {
  if (threshold <= 0) return "never";
  const n = Math.round(WAKE_DIE / threshold);
  return `one in ${ODDS_WORDS[n] ?? n}`;
}

const VERB_PAST: Readonly<Record<Verb, string>> = {
  sniff: "a sniff",
  rub: "a rub",
  shove: "a shove",
};
const LAYER_PUSH: Readonly<Record<Layer, string>> = {
  0: "scraped the topsoil",
  1: "worked the mud",
  2: "pushed the root",
};
const NEXT_TIME: Readonly<Record<Layer, string>> = {
  0: "next time — rub, not shove?",
  1: "next time — tie it in topsoil?",
  2: "next time — tie it at the mud?",
};

/** The GT reasons a state mints (§4): 'dig' topsoil, 'dig_deep' mud,
 *  'dig_root' when the mud truffle banked and the dig TIED at the root. */
export function gtReasons(state: SnoutDeepState): GtReason[] {
  if (state.uncrewed) return [];
  const out: GtReason[] = [];
  if (state.layersTied.includes(0)) out.push("dig");
  if (state.layersTied.includes(1)) out.push("dig_deep");
  const tiedAtRoot =
    state.ended != null && state.ended.reason !== "wake" && state.ended.layer === 2;
  if (tiedAtRoot && state.layersTied.includes(1)) out.push("dig_root");
  return out;
}

export interface ReceiptOptions {
  /** Tickles per find kind — the server's table when known, else DIG_FIND_TICKLES. */
  tickles?: DigFindTickles;
  /** The player's count as the dig ended (the Barn's stamp); null when unknown. */
  tickledBefore?: number | null;
}

/** The banked truffle's hand line: the herd's GT for it (and the root's, when
 *  the tie at the root pays 'dig_root' for the mud's truffle). */
function truffleSub(kind: FindKind, gt: GtReason[]): string {
  const root = kind === "truffle_l" && gt.includes("dig_root");
  return root
    ? "the herd's too — +1 Golden Truffle, +1 for the root"
    : "the herd's too — +1 Golden Truffle";
}

export function receipt(state: SnoutDeepState, opts: ReceiptOptions = {}): DigReceipt {
  const table = opts.tickles ?? DIG_FIND_TICKLES;
  const before = opts.tickledBefore ?? null;
  const ended = state.ended ?? { reason: "tie" as const, layer: state.layer };
  const woke = ended.reason === "wake";
  const layerName = LAYER_NAMES[ended.layer];
  const rows: DigReceiptRow[] = [];
  const gt = gtReasons(state);
  let total = 0;

  // The truffle he took (a wake): the loose one, moved to missed on the roll —
  // the first row, at "his".
  let lost: Find | null = null;
  if (woke) {
    lost =
      state.missed
        .map((id) => findById(state.board, id))
        .find((f) => f && f.food && f.tiles.length > 0 && layerOf(state.board, f.id) === ended.layer) ??
      null;
    if (lost) {
      rows.push({
        id: lost.id,
        mark: lost.kind,
        tone: "roseDeep",
        title: findCopy(lost).title,
        sub: "his — comes back gilded next Feeding",
        value: "his",
        lost: true,
      });
    }
  }

  // One row per find, in the order they surfaced: the banked truffles, the
  // banked consumables (or, on a wake, the ones lost with the pouch) and
  // every collection thing (kept either way; paid only when the dig tied). A
  // truffle left in the ground (missed, never banked) is not a row.
  let xp = DIG_PASS_XP;
  let truffleRows = 0;
  let lostThings = 0;
  for (const id of state.found) {
    const f = findById(state.board, id);
    if (!f) continue;
    if (f.food && !state.banked.includes(id)) continue;
    const collection = !f.food && isDigCollectionThing(f.kind);
    if (!f.food && !collection && !state.banked.includes(id)) {
      // A consumable that never banked: lost with the pouch on the wake.
      if (!state.missed.includes(id)) continue;
      const c = findCopy(f, table.boom);
      lostThings++;
      rows.push({
        id,
        mark: f.kind,
        ...(f.variant ? { variant: f.variant } : {}),
        tone: "roseDeep",
        title: c.title,
        sub: "lost with the layer",
        value: "lost",
        tickles: 0,
        lost: true,
      });
      continue;
    }
    if (collection && woke) {
      // Kept — a Barn piece is a Barn piece — but its tickles rode the tie.
      const c = findCopy(f, table.boom);
      rows.push({
        id,
        mark: f.kind,
        ...(f.variant ? { variant: f.variant } : {}),
        tone: c.tone,
        title: c.title,
        sub: "kept — its tickles went with the pouch",
        value: "kept",
        kept: true,
      });
      continue;
    }
    const n = Math.max(0, table[f.kind] ?? 0);
    total += n;
    if (f.food) {
      truffleRows++;
      rows.push({
        id,
        mark: f.kind,
        tone: "sun",
        title: findCopy(f).title,
        sub: state.uncrewed ? JOIN_LINE : truffleSub(f.kind, gt),
        value: `+${n}`,
        tickles: n,
        ...(state.uncrewed ? { join: true } : {}),
      });
      continue;
    }
    const c = findCopy(f, table.boom);
    if (f.kind === "scroll") xp += SCROLL_XP;
    rows.push({
      id,
      mark: f.kind,
      ...(f.variant ? { variant: f.variant } : {}),
      tone: c.tone,
      title: c.title,
      sub: c.sub,
      value: `+${n}`,
      tickles: n,
    });
  }

  rows.push({ id: "xp", mark: "xp", tone: "lilac", title: "Pass XP", sub: "the dig counts", value: `+${xp} XP` });

  const actionsLine = `${state.actions.length} ${state.actions.length === 1 ? "action" : "actions"}`;
  const join = state.uncrewed && truffleRows === 0 ? { joinLine: JOIN_LINE } : {};
  const counts = {
    ticklesTotal: total,
    tickledBefore: before,
    tickledNow: before == null ? null : before + total,
  };

  if (woke) {
    const a = ended.wokeOn ? decodeAction(ended.wokeOn) : null;
    const wokeLine = a
      ? `${LAYER_PUSH[a.layer]} on ${VERB_PAST[a.verb]}. ${oddsPhrase(
          wakeThreshold(a.layer, a.verb, state.coop, sniffCount(state.actions.slice(0, -1))),
        )} — this was the one.`
      : "he woke on the last one.";
    const took =
      lost && lostThings > 0
        ? "the loose truffle and the pouch were his."
        : lost
          ? "the loose truffle was his."
          : lostThings > 0
            ? "the loose pouch was his."
            : "nothing was loose for him to take.";
    return {
      kind: "woke",
      kicker: `the truffle patch · he woke at ${layerName}`,
      title: "He woke. Still worth it.",
      countLine: `what you'd tied is yours. ${took}`,
      wokeLine,
      nextTimeLine: NEXT_TIME[ended.layer],
      rows,
      gt,
      xp,
      ...counts,
      ...join,
      primary: "Back to the Barn",
    };
  }

  const how =
    ended.reason === "cap"
      ? "he slept through all of it"
      : ended.reason === "close"
        ? "the patch closed on you"
        : "he slept through it";
  return {
    kind: "tied",
    kicker: `the truffle patch · tied at ${layerName}`,
    title: "What the dig was worth",
    countLine: `each thing lands, the count ticks. ${actionsLine} · ${how}.`,
    rows,
    gt,
    xp,
    ...counts,
    ...join,
    primary: "Back to the Barn",
    secondary: state.uncrewed ? undefined : "share the dig ›",
  };
}

/** What the server's receipt says about the tally (submit_rooting_deep,
 *  20260913120000). Every field is optional: an older server names none. */
export interface ServerTally {
  tickles?: readonly { id: string; kind: string; tickles: number; lost?: boolean; kept?: boolean }[] | null;
  ticklesTotal?: number | null;
  tickledBefore?: number | null;
  tickledNow?: number | null;
  satchel?: { found?: unknown; lost?: unknown; count?: unknown; cap?: unknown } | null;
}

/** Correct a client-built receipt with the server's numbers: every row's
 *  tickles by id (then by kind — the server names truffles by their bare
 *  kind), the total, and the count before / after. Rows keep their order, so
 *  a roll-up already running only re-aims; it never restarts. */
export function reconcileReceipt(r: DigReceipt, server: ServerTally): DigReceipt {
  const byId = new Map<string, number>();
  const byKind = new Map<string, number>();
  for (const t of server.tickles ?? []) {
    if (t.lost || t.kept) continue;
    byId.set(t.id, t.tickles);
    if (!byKind.has(t.kind)) byKind.set(t.kind, t.tickles);
  }
  let total = 0;
  const rows = r.rows.map((row) => {
    if (row.tickles == null || row.lost || row.kept) return row;
    const n = byId.get(row.id) ?? byKind.get(row.mark) ?? row.tickles;
    total += n;
    return n === row.tickles ? row : { ...row, tickles: n, value: `+${n}` };
  });
  const ticklesTotal = server.ticklesTotal ?? total;
  const before = server.tickledBefore ?? r.tickledBefore;
  const now = server.tickledNow ?? (before == null ? null : before + ticklesTotal);
  const satchel = satchelReceiptRoll(server.satchel) ?? r.satchel ?? null;
  const satchelLine = satchelReceiptLine(server.satchel) ?? r.satchelLine ?? null;
  return { ...r, rows, ticklesTotal, tickledBefore: before, tickledNow: now, satchel, satchelLine };
}

function layerOf(board: SnoutDeepBoard, id: string): Layer | null {
  for (let i = 0; i < board.layers.length; i++) {
    if (board.layers[i].finds.some((f) => f.id === id)) return i as Layer;
  }
  return null;
}

// ── Whispers (§5.4) — teach rules, say THAT something is near, never what ───

// "five things" — the pouch whisper's count, spelled small.
const COUNT_WORDS: readonly string[] = [
  "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
];
export function countPhrase(n: number, noun: string): string {
  const word = COUNT_WORDS[n] ?? String(n);
  return `${word} ${n === 1 ? noun : `${noun}s`}`;
}

/** The stake, said plainly, when the pouch holds things and no truffle is
 *  loose to say it first: "five things loose in the pouch. tie it off to
 *  keep them, or carry them down." — at the root nothing carries deeper. */
function pouchWhisper(state: SnoutDeepState): string | null {
  const n = state.looseThings.length;
  if (n === 0 || state.loose) return null;
  const them = n === 1 ? "it" : "them";
  const tail =
    state.layer === 2
      ? `tie it off to keep ${them} — nothing carries deeper than the root.`
      : `tie it off to keep ${them}, or carry ${them} down.`;
  return `${countPhrase(n, "thing")} loose in the pouch. ${tail}`;
}

export function whisperFor(state: SnoutDeepState): string {
  if (state.ended?.reason === "wake") {
    const lostTruffle = state.missed.some((id) => findById(state.board, id)?.food);
    const lostThings = state.missed.some((id) => {
      const f = findById(state.board, id);
      return f != null && !f.food;
    });
    if (lostTruffle && lostThings)
      return "he woke. the loose truffle and the pouch are his — the truffle comes back gilded, next Feeding.";
    if (lostThings) return "he woke. the loose pouch is his. what you'd tied is yours.";
    return "he woke. the loose one is his — he buries it gilded, next Feeding.";
  }
  const sniffed = state.scent.filter((s) => s != null).length;
  const hasHigh = state.scent.some((s) => s != null && s >= 3);
  const hasLow = state.scent.some((s) => s === 1);
  const pouch = pouchWhisper(state);
  if (state.layer === 0) {
    if (sniffed === 0)
      return `topsoil. a sniff counts the finds touching a tile. a rub moves a little, a shove a lot. ${SNIFF_FREE_PER_DIG} sniffs are free — past that, each one draws his attention.`;
    // The budget's turn speaks first: the moment a sniff starts to cost, say so.
    if (nextSniffAttention(state) > 0 && !state.loose)
      return `he's noticing you — the next sniff is ${oddsPhrase(nextThreshold(state, "sniff"))}. a rub is ${oddsPhrase(nextThreshold(state, "rub"))}.`;
    if (hasHigh && hasLow) return "a 3 beside a 1 — the truffle runs one way. follow the bigger number.";
    if (state.loose) return "the truffle is loose. tie it off, or dig deeper and bank it on the way down.";
    if (pouch) return pouch;
    return "a 0 means nothing touches that tile. the numbers only ever tell the truth.";
  }
  if (state.layer === 1) {
    if (sniffed === 0) return "the mud. fatter down here — and he sleeps lighter. a sniff is the quiet way to know: one in forty stirs him. a rub, one in twenty.";
    if (state.loose) return "the fat one is loose. the root has no truffle of its own — it pays for this one, if you tie it there.";
    if (pouch) return pouch;
    return "one rub in twenty stirs him here. one sniff in forty. nothing here is free.";
  }
  if (sniffed === 0)
    return `the root. a 1 on its own is usually a thing, not a truffle. ${oddsPhrase(
      wakeThreshold(2, "rub", state.coop),
    ).replace("one in", "one rub in")} wakes him now. ${oddsPhrase(wakeThreshold(2, "sniff", state.coop)).replace(
      "one in",
      "one sniff in",
    )}.`;
  if (pouch) return pouch;
  return "no truffle down here is his to take. every action is a roll — tie it off whenever you like.";
}

// ── Simulation — for tuning the thresholds ──────────────────────────────────
// Two bots at EQUAL effort: each spends up to `layerActions` actions on a
// layer (default 15 — three layers fit exactly under the 45 cap), leaves the layer
// early the moment its truffle is loose, then descends until `tieAt` and
// ties. `blind` rubs in a seeded scan, skipping cleared tiles. `nose` sniffs
// four lattice tiles whose 3 × 3s tile the board, then rubs outward from the
// strongest scent — the play the whispers teach. The sim reports finds (what
// the dig KEEPS — banked truffles, banked consumables, kept collection
// things), GT, tickles paid and survival per layer; the tests pin the §4
// figures against it. Neither bot ties early to save the pouch: the leave-
// when-loose rule keys on the truffle, so the tickles EV per tie depth reads
// the pouch's stake honestly.

export type PolicyStyle = "blind" | "nose";
export type Policy =
  | PolicyStyle
  | { style: PolicyStyle; tieAt?: Layer; layerActions?: number };

export interface SimResult {
  seed: number;
  policy: PolicyStyle;
  tieAt: Layer;
  finds: number; // what the dig keeps: banked truffles + banked consumables + kept collection things
  things: number; // banked consumables + kept collection things
  truffles: number;
  gt: number;
  /** The tickles the dig pays (receipt().ticklesTotal — banked finds only). */
  tickles: number;
  actions: number;
  woke: boolean;
  wokeLayer: Layer | null;
  /** Per layer: entered, and left it (descended or tied) without a wake. */
  survived: [boolean, boolean, boolean];
  /** The root was entered and he did not wake within its first five actions
   *  (null when the dig never reached the root). */
  rootSurvivedFive: boolean | null;
  reachedLayer: Layer;
  endReason: "tie" | "wake" | "cap" | "close";
}

// The four sniff tiles whose 3 × 3 neighbourhoods cover a 6 × 5 board.
const NOSE_LATTICE = [1 * PATCH_COLS + 1, 1 * PATCH_COLS + 4, 3 * PATCH_COLS + 1, 3 * PATCH_COLS + 4];
const DEFAULT_LAYER_ACTIONS = 15;
// A bot's own scan order comes from a third stream so the seed alone fixes a
// sim run (the wake stream and the layout must not be reused for policy).
const SCAN_SEED_MULT = 104729;

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

export function simulateSnoutDeep(seed: number, policy: Policy): SimResult {
  const opts = typeof policy === "string" ? { style: policy } : policy;
  const style = opts.style;
  const tieAt: Layer = opts.tieAt ?? 2;
  const layerActions = opts.layerActions ?? DEFAULT_LAYER_ACTIONS;
  const board = generateLayeredBoard(seed);
  let state = initialState(board, { coop: false, uncrewed: false });
  // Park–Miller inline for the scan so the sim has no hidden coupling.
  let scan = ((seed * SCAN_SEED_MULT) % 2147483646) + 1;
  const scanNext = (n: number) => {
    scan = (scan * 16807) % 2147483647;
    return scan % n;
  };

  const survived: [boolean, boolean, boolean] = [false, false, false];
  let rootSurvivedFive: boolean | null = null;

  // What the player can see, and what both bots use: a half-cleared tile
  // (depth ≤ 1) shows the silhouette of what is under it, so a silhouetted
  // find is finished first; a cleared tile of a multi-tile cluster says the
  // cluster continues next door, so its buried neighbours come second; a
  // half-cleared tile with nothing under it, and every tile inside a
  // sniffed 0's 3 × 3, is known empty and never rubbed. Past that the nose
  // bot rubs the buried tile the scent marks point at hardest (the sum of the
  // sniffed marks whose 3 × 3 covers it) and sniffs rather than rub blind
  // while no mark points anywhere; the blind bot rubs a random buried tile.
  // The sniff budget (2026-09-16): past five sniffs each one draws his
  // attention, so the nose bot — like a player who has read the card — only
  // sniffs while a sniff is still quieter than a rub. In topsoil that is the
  // five free ones; deeper, until attention lifts the sniff to the rub's odds.
  const sniffWorthIt = () => nextThreshold(state, "sniff") < nextThreshold(state, "rub");
  const step = (): boolean => {
    const rub = (tile: number) => {
      state = reduce(state, { type: "act", verb: "rub", tile });
      return true;
    };
    // 1. Finish a silhouette.
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
    // 2. A cluster that continues.
    for (const f of currentLayer(state).finds) {
      if (f.kind === "stone" || f.tiles.length < 2) continue;
      if (clusterRevealed(f.tiles, state.depths)) continue;
      if (!f.tiles.some((t) => state.depths[t] <= 1)) continue;
      // Rub the buried tile next to the seen part — the player can't see which
      // neighbour, so take the one the scent (if any) favours, else the first.
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
        state = reduce(state, { type: "act", verb: "sniff", tile: unsniffed[scanNext(unsniffed.length)] });
        return true;
      }
    }
    const buried = unknown.length > 0 ? unknown : [];
    if (buried.length === 0) {
      // Only known-empty or half-cleared mud is left: the layer has nothing more.
      return false;
    }
    return rub(buried[scanNext(buried.length)]);
  };
  // A seen find tile: cleared, or half-cleared with a silhouette under it.
  const seenFind = (t: number): boolean => {
    if (state.depths[t] > 1) return false;
    const f = findAtTile(state, t);
    return !!f && f.kind !== "stone";
  };
  // What a mark still points at once the finds already seen in its 3 × 3
  // are subtracted — the deduction the whispers teach ("a 1 with the thing
  // found beside it: the rest of that 3 × 3 is empty").
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

  while (!state.ended) {
    const layer = state.layer;
    const atEntry = state.actions.length;
    const spent = () => state.actions.length - atEntry;
    if (style === "nose") {
      for (const t of NOSE_LATTICE) {
        if (state.ended || spent() >= layerActions || !sniffWorthIt()) break;
        state = reduce(state, { type: "act", verb: "sniff", tile: t });
      }
      // A second round pins the strongest mark down where a sniff is under
      // HALF a rub — the root (7 vs 15). In the mud a sniff is exactly half
      // (3 vs 6), and four more of them cost as much sleep as two rubs, so
      // the lattice alone is the cheaper read there; in topsoil a rub is a
      // hundred-and-twenty-to-one, so rubbing is the read. Skipped when
      // nothing read ≥ 2: a lattice with no lead is not worth four actions.
      // (Tuned 2026-09-13 against the priced sniff: this is what keeps the
      // nose ahead of blind play on finds, GT and sleep together.)
      if (
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
            state = reduce(state, { type: "act", verb: "sniff", tile: n });
          }
        }
      }
    }
    // Leave a layer the moment its truffle is loose where a rub costs real
    // sleep (the mud, the root); in topsoil a rub is a hundred-and-twenty-to-
    // one, so spend the whole budget — the things there are worth it.
    const leaveWhenLoose = layer > 0;
    while (!state.ended && !(leaveWhenLoose && state.loose) && spent() < layerActions) {
      if (!step()) break;
    }
    if (layer === 2) {
      const took = spent();
      const wokeHere = state.ended?.reason === "wake";
      // Survived = he did not wake within the first five root actions; a bot
      // that read four zeros and tied on the spot survived them too.
      rootSurvivedFive = !(wokeHere && took <= 5);
    }
    if (state.ended) break;
    survived[layer] = true;
    if (layer >= tieAt) {
      state = reduce(state, { type: "tie" });
      break;
    }
    state = reduce(state, { type: "descend" });
  }

  const ended = state.ended!;
  return {
    seed,
    policy: style,
    tieAt,
    finds: state.things.length + state.banked.length,
    things: state.things.length + state.banked.filter((id) => !findById(state.board, id)?.food).length,
    truffles: state.banked.filter((id) => findById(state.board, id)?.food).length,
    gt: gtReasons(state).length,
    tickles: receipt(state).ticklesTotal,
    actions: state.actions.length,
    woke: ended.reason === "wake",
    wokeLayer: ended.reason === "wake" ? ended.layer : null,
    survived,
    rootSurvivedFive,
    reachedLayer: state.layer,
    endReason: ended.reason,
  };
}

export const FOOD_KINDS = DIG_FOOD_KINDS;
