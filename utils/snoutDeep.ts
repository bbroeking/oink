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
//     (one truffle per layer), a thing goes into `things` and is yours;
//   · the dig applies first, then the roll: a thing revealed on the waking
//     action is still yours, a truffle uncovered on it goes straight to
//     `missed` — the waking action is IN the log, not after it;
//   · `descend` banks `loose`, moves the layer's touched-but-uncollected
//     TRUFFLE into `missed` (only truffles carry), clears scent, enters the
//     next layer; not offered at the root;
//   · `tie` banks and ends; the 45th action ends as `cap` (= tie) unless it
//     woke him (the roll happens before the cap check); `close` ends as tie.

import {
  DIG_FOOD_KINDS,
  PATCH_COLS,
  PATCH_ROWS,
  SNOUT_DEEP_ACTION_CAP,
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
  banked: string[]; // find ids banked (truffles) — across layers
  things: string[]; // find ids revealed (things) — across layers
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
    banked: [],
    things: [],
    missed: [],
    layersTied: [],
    coop: opts.coop,
    uncrewed: opts.uncrewed,
    ended: null,
  };
}

export const wakeThreshold = kernelWakeThreshold;

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
  let things = state.things;
  if (verb === "sniff") {
    scent = state.scent.slice();
    scent[tile] = scentAt(currentLayer(state), tile);
  } else {
    depths = state.depths.slice();
    applySplash(depths, tile, verb);
    // Reveals: every cluster whose last tile just cleared. A truffle becomes
    // loose (a layer holds one); a thing is yours the moment it clears. Stones
    // reveal into nothing.
    for (const f of currentLayer(state).finds) {
      if (f.kind === "stone") continue;
      if (!clusterRevealed(f.tiles, depths)) continue;
      if (clusterRevealed(f.tiles, state.depths)) continue; // already up
      if (f.food) loose = f.id;
      else if (!things.includes(f.id)) things = [...things, f.id];
    }
  }

  // Then the roll. One draw per action, drawn even when the threshold is 0 so
  // the k-th action is the k-th draw on every replay.
  const draw = new WakeStream(state.board.seed).skip(state.wakeIndex).next();
  const wakeIndex = state.wakeIndex + 1;
  const threshold = wakeThreshold(state.layer, verb, state.coop);
  const woke = draw < threshold;

  const next: SnoutDeepState = {
    ...state,
    depths,
    scent,
    actions,
    wakeIndex,
    loose,
    things,
  };

  if (woke) {
    // He takes the loose truffle; everything banked and every thing is
    // untouched. The layer's touched-but-uncollected truffle is missed too
    // (it would have been, had the dig gone on).
    return {
      ...next,
      loose: null,
      missed: withMissed(next, loose),
      ended: { reason: "wake", layer: state.layer, wokeOn: entry },
    };
  }
  if (actions.length >= SNOUT_DEEP_ACTION_CAP) return end(next, "cap");
  return next;
}

/** `missed` plus the loose truffle (a wake) and/or the current layer's
 *  touched-but-uncollected truffle (a layer left behind). Only truffles
 *  carry — things are never at stake, so they are never missed. */
function withMissed(state: SnoutDeepState, lostLoose: string | null): string[] {
  const out = state.missed.slice();
  if (lostLoose && !out.includes(lostLoose)) out.push(lostLoose);
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

function descend(state: SnoutDeepState): SnoutDeepState {
  if (state.ended) return state;
  if (state.layer >= 2) return state; // no fourth layer — not offered at the root
  const nextLayer = (state.layer + 1) as Layer;
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
    ...bank(state),
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
// One table for the reveal sticker, the pouch marks and the receipt rows, so a
// find is named the same way everywhere. `title` is the sticker/row title,
// `tail` the reveal's second clause, `value` the ledger's right column, `sub`
// the row's hand line. The Boom's tickles are the catch-up's `boom(H)` (§4) —
// the client can't know H, so the reveal takes the amount as an argument
// (3 when H = 0).

export const BOOM_BASE_TICKLES = 3;

export type FindTone = "sun" | "sage" | "rose" | "lilac" | "paper";

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

export function findCopy(find: Find, boomTickles = BOOM_BASE_TICKLES): FindCopy {
  switch (find.kind) {
    case "truffle_d":
      return { title: "a truffle", tail: "loose, until you tie it", value: "loose", sub: "the topsoil's", tone: "sun" };
    case "truffle_l":
      return { title: "the fat one", tail: "loose, until you tie it", value: "loose", sub: "the mud's", tone: "sun" };
    case "boom":
      return { title: "a Tickle Boom", tail: `+${boomTickles} tickles, yours`, value: `+${boomTickles} tickles`, sub: "applied on the spot", tone: "rose" };
    case "pouch":
      return { title: "a snout pouch", tail: "+15 snouts", value: "+15 snouts", sub: "into your purse", tone: "sun" };
    case "apple":
      return { title: "a windfall apple", tail: "Rosie is +8 happier", value: "+8 happy", sub: "Rosie ate it already", tone: "rose" };
    case "junk":
      return { title: JUNK_TITLES[find.variant ?? ""] ?? "a keepsake", tail: "new for the Barn", value: "new", sub: "a shelf keepsake", tone: "paper" };
    case "shimmer":
      return { title: "a shimmer pocket", tail: "+1 Mote", value: "+1 Mote", sub: "for the machine", tone: "lilac" };
    case "acorn":
      return { title: "a Clockwork Acorn", tail: "a day of the Auto-Tickler", value: "1 day", sub: "wound into the Auto-Tickler", tone: "sage" };
    case "tea":
      return { title: "a flask of warm tea", tail: "warm tea, 8 h, on you", value: "8 h", sub: "warm tea on yourself", tone: "sage" };
    case "scroll":
      return { title: "a Pass XP scroll", tail: "+40 Pass XP", value: "+40 XP", sub: "read on the spot", tone: "lilac" };
    case "relic":
      return { title: "a relic", tail: "new in the Burrow Book", value: "new", sub: "for the Burrow Book", tone: "lilac" };
    case "furnishing":
      return { title: "an Unearthed furnishing", tail: "new for the Barn", value: "new", sub: "a dig-only Barn piece", tone: "paper" };
    case "bow":
      return { title: "a buried bow", tail: "new for the Closet", value: "new", sub: "a dig-only cosmetic", tone: "rose" };
    case "charm":
      return { title: "a bless charm", tail: "one free blessing to send", value: "1 to send", sub: "a blessing, on the house", tone: "sage" };
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

// ── The receipt — what the payoff sheets render ─────────────────────────────

export type GtReason = "dig" | "dig_deep" | "dig_root";

export interface DigReceiptRow {
  id: string;
  /** Which mark the ledger draws: a find kind, the truffles line, or XP. */
  mark: FindKind | "truffles" | "xp";
  tone: FindTone;
  title: string;
  sub?: string;
  value: string;
}

export interface DigReceipt {
  kind: "tied" | "woke";
  kicker: string;
  title: string;
  countLine: string;
  /** The woke sheet's hand line naming the action; absent on a tie. */
  wokeLine?: string;
  /** The woke sheet's closing hand line ("next time — tie it at the mud?"). */
  nextTimeLine?: string;
  rows: DigReceiptRow[];
  /** The GT reasons this dig mints, in order — empty when uncrewed. */
  gt: GtReason[];
  xp: number;
  /** Uncrewed only: the secondary that routes to the join path. */
  joinLine?: string;
  primary: string;
  secondary?: string;
}

export const DIG_PASS_XP = 20;
const SCROLL_XP = 40;

const LAYER_WORDS: Readonly<Record<Layer, string>> = { 0: "one layer", 1: "two layers", 2: "three layers" };

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

export function receipt(state: SnoutDeepState, boomTickles = BOOM_BASE_TICKLES): DigReceipt {
  const ended = state.ended ?? { reason: "tie" as const, layer: state.layer };
  const woke = ended.reason === "wake";
  const layerName = LAYER_NAMES[ended.layer];
  const rows: DigReceiptRow[] = [];
  const gt = gtReasons(state);

  // The truffle he took (a wake): the loose one, moved to missed on the roll.
  if (woke) {
    const lost = state.missed
      .map((id) => findById(state.board, id))
      .find((f) => f && f.food && f.tiles.length > 0 && layerOf(state.board, f.id) === ended.layer);
    if (lost) {
      const c = findCopy(lost);
      rows.push({
        id: lost.id,
        mark: lost.kind,
        tone: "sun",
        title: c.title,
        sub: "his — gilded next Feeding",
        value: "his",
      });
    }
  }

  // One row per thing, in the order they surfaced.
  let xp = DIG_PASS_XP;
  for (const id of state.things) {
    const f = findById(state.board, id);
    if (!f) continue;
    const c = findCopy(f, boomTickles);
    if (f.kind === "scroll") xp += SCROLL_XP;
    rows.push({ id, mark: f.kind, tone: c.tone, title: c.title, sub: c.sub, value: c.value });
  }

  // The truffles row: the GT this dig mints, by layer. Uncrewed digs mint none
  // and carry the join line instead.
  if (!state.uncrewed && gt.length > 0) {
    const where = gt
      .map((r) => (r === "dig" ? "topsoil" : r === "dig_deep" ? "the mud" : "the root"))
      .join(" · ");
    rows.push({
      id: "truffles",
      mark: "truffles",
      tone: "sun",
      title: gt.length === 1 ? "a Golden Truffle" : `${gt.length} Golden Truffles`,
      sub: where,
      value: `+${gt.length} GT`,
    });
  }

  rows.push({ id: "xp", mark: "xp", tone: "lilac", title: "Pass XP", sub: "the dig counts", value: `+${xp} XP` });

  const actionsLine = `${state.actions.length} ${state.actions.length === 1 ? "action" : "actions"}`;

  if (woke) {
    const a = ended.wokeOn ? decodeAction(ended.wokeOn) : null;
    const wokeLine = a
      ? `${LAYER_PUSH[a.layer]} on ${VERB_PAST[a.verb]}. ${oddsPhrase(
          wakeThreshold(a.layer, a.verb, state.coop),
        )} — this was the one.`
      : "he woke on the last one.";
    return {
      kind: "woke",
      kicker: `woke in ${layerName}`,
      title: "He woke.",
      countLine: `${LAYER_WORDS[ended.layer]} · ${actionsLine} · he took the loose one`,
      wokeLine,
      nextTimeLine: NEXT_TIME[ended.layer],
      rows,
      gt,
      xp,
      ...(state.uncrewed ? { joinLine: "truffles are for herds — find yours ›" } : {}),
      primary: "Back to Barn",
    };
  }

  const how =
    ended.reason === "cap"
      ? "he slept through all of it"
      : ended.reason === "close"
        ? "the patch closed on you"
        : "he slept through it";
  const tiedTitle =
    ended.layer === 0 ? "Tied off in topsoil" : ended.layer === 1 ? "Tied off in the mud" : "Tied off at the root";
  return {
    kind: "tied",
    kicker: "the truffle patch",
    title: tiedTitle,
    countLine: `${LAYER_WORDS[ended.layer]} · ${actionsLine} · ${how}`,
    rows,
    gt,
    xp,
    ...(state.uncrewed ? { joinLine: "truffles are for herds — find yours ›" } : {}),
    primary: "Back to Barn",
    secondary: state.uncrewed ? undefined : "share the dig ›",
  };
}

function layerOf(board: SnoutDeepBoard, id: string): Layer | null {
  for (let i = 0; i < board.layers.length; i++) {
    if (board.layers[i].finds.some((f) => f.id === id)) return i as Layer;
  }
  return null;
}

// ── Whispers (§5.4) — teach rules, say THAT something is near, never what ───

export function whisperFor(state: SnoutDeepState): string {
  if (state.ended?.reason === "wake") return "he woke. the loose one is his — he buries it gilded, next Feeding.";
  const sniffed = state.scent.filter((s) => s != null).length;
  const hasHigh = state.scent.some((s) => s != null && s >= 3);
  const hasLow = state.scent.some((s) => s === 1);
  if (state.layer === 0) {
    if (sniffed === 0)
      return "topsoil. a sniff counts the finds touching a tile. a rub moves a little, a shove a lot. nothing quiet wakes him here.";
    if (hasHigh && hasLow) return "a 3 beside a 1 — the truffle runs one way. follow the bigger number.";
    if (state.loose) return "the truffle is loose. tie it off, or dig deeper and bank it on the way down.";
    return "a 0 means nothing touches that tile. the numbers only ever tell the truth.";
  }
  if (state.layer === 1) {
    if (sniffed === 0) return "the mud. fatter down here — and he sleeps lighter. a sniff is the quiet way to know: one in forty stirs him. a rub, one in twenty.";
    if (state.loose) return "the fat one is loose. the root has no truffle of its own — it pays for this one, if you tie it there.";
    return "one rub in twenty stirs him here. one sniff in forty. nothing here is free.";
  }
  if (sniffed === 0)
    return `the root. a 1 on its own is usually a thing, not a truffle. ${oddsPhrase(
      wakeThreshold(2, "rub", state.coop),
    ).replace("one in", "one rub in")} wakes him now. ${oddsPhrase(wakeThreshold(2, "sniff", state.coop)).replace(
      "one in",
      "one sniff in",
    )}.`;
  return "nothing down here is his. every action is a roll — tie it off whenever you like.";
}

// ── Simulation — for tuning the thresholds ──────────────────────────────────
// Two bots at EQUAL effort: each spends up to `layerActions` actions on a
// layer (default 15 — three layers fit exactly under the 45 cap), leaves the layer
// early the moment its truffle is loose, then descends until `tieAt` and
// ties. `blind` rubs in a seeded scan, skipping cleared tiles. `nose` sniffs
// four lattice tiles whose 3 × 3s tile the board, then rubs outward from the
// strongest scent — the play the whispers teach. The sim reports finds, GT
// and survival per layer; the tests pin the §4 figures against it.

export type PolicyStyle = "blind" | "nose";
export type Policy =
  | PolicyStyle
  | { style: PolicyStyle; tieAt?: Layer; layerActions?: number };

export interface SimResult {
  seed: number;
  policy: PolicyStyle;
  tieAt: Layer;
  finds: number; // things revealed + truffles banked
  things: number;
  truffles: number;
  gt: number;
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
      if (unsniffed.length > 0) {
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
        if (state.ended || spent() >= layerActions) break;
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
    things: state.things.length,
    truffles: state.banked.length,
    gt: gtReasons(state).length,
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
