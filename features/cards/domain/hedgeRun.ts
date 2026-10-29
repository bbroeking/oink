export const HEDGE_RUN_RULES_VERSION = "hedge-run-v1" as const;
export const HEDGE_RUN_LEGEND_IDS = [
  "legend_rosie", "legend_copper", "legend_pepper", "legend_bandit", "legend_pickles", "legend_biscuit",
] as const;
export type LoadoutSlot = "head" | "held" | "aura" | "critter";
export type RunStatus = "active" | "complete" | "escaped";

export interface QuickCard {
  cardId: string;
  slot: LoadoutSlot;
  guard: number;
  search: number;
}

export const HEDGE_RUN_KIT: readonly QuickCard[] = [
  { cardId: "ticket_takers_cap", slot: "head", guard: 2, search: 1 },
  { cardId: "bog_helmet", slot: "head", guard: 3, search: 0 },
  { cardId: "release_party_crown", slot: "head", guard: 1, search: 2 },
  { cardId: "toy_sword", slot: "held", guard: 0, search: 3 },
  { cardId: "mud_shovel", slot: "held", guard: 1, search: 2 },
  { cardId: "golden_truffle", slot: "held", guard: 2, search: 1 },
  { cardId: "firefly_aura", slot: "aura", guard: 1, search: 1 },
  { cardId: "shadow_aura", slot: "aura", guard: 0, search: 2 },
  { cardId: "golden_bog_aura", slot: "aura", guard: 2, search: 0 },
  { cardId: "lantern_rabbit", slot: "critter", guard: 0, search: 2 },
  { cardId: "bog_frog", slot: "critter", guard: 2, search: 0 },
  { cardId: "truffle_mole", slot: "critter", guard: 1, search: 1 },
] as const;

export interface HedgeEvent {
  id: string;
  name: string;
  danger: number;
  searchTarget: number;
  discovery: string;
}

export const HEDGE_EVENTS: readonly HedgeEvent[] = [
  { id: "rattling_reeds", name: "Rattling Reeds", danger: 2, searchTarget: 2, discovery: "Reed Ribbon" },
  { id: "muddy_footprints", name: "Muddy Footprints", danger: 3, searchTarget: 3, discovery: "Bent Spoon" },
  { id: "snuffling_shadow", name: "Snuffling Shadow", danger: 4, searchTarget: 3, discovery: "Button Bell" },
  { id: "hungerling_scramble", name: "Hungerling Scramble", danger: 4, searchTarget: 5, discovery: "Pocket Apple" },
  { id: "root_tangle", name: "Root Tangle", danger: 5, searchTarget: 4, discovery: "Knotted Charm" },
  { id: "hungerer_reaches", name: "The Hungerer Reaches", danger: 6, searchTarget: 6, discovery: "Golden Acorn" },
  { id: "bog_bubbles", name: "Bog Bubbles", danger: 3, searchTarget: 5, discovery: "Glassy Pebble" },
  { id: "crow_swoop", name: "Crow Swoop", danger: 5, searchTarget: 3, discovery: "Blue Feather" },
  { id: "moonlit_gap", name: "Moonlit Gap", danger: 2, searchTarget: 6, discovery: "Moon Button" },
] as const;

export interface HedgeChoice { cardId: string; mode: "play" | "train" }
export interface ResolvedRound {
  round: number; cardId: string; mode: "play" | "train"; eventId: string;
  guard: number; search: number; damage: number; foundDiscovery: boolean;
}
export interface HedgeRunState {
  seed: string;
  rulesVersion: typeof HEDGE_RUN_RULES_VERSION;
  legendId: string;
  round: number;
  cheer: number;
  status: RunStatus;
  deckOrder: readonly string[];
  drawIndex: number;
  hand: readonly string[];
  trail: readonly string[];
  slots: Readonly<Partial<Record<LoadoutSlot, string>>>;
  trainingIds: readonly string[];
  replacedIds: readonly string[];
  discoveries: readonly string[];
  choices: readonly HedgeChoice[];
  resolvedRounds: readonly ResolvedRound[];
}

function seedHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rngFor(seed: string): () => number {
  let state = seedHash(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createEventTrail(seed: string): readonly string[] {
  const random = rngFor(`${HEDGE_RUN_RULES_VERSION}:trail:${seed}`);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const trail = shuffle(HEDGE_EVENTS, random).slice(0, 6);
    const hardDanger = trail.filter((event) => event.danger >= 5).length;
    if (hardDanger >= 1 && hardDanger <= 2 && trail.some((event) => event.searchTarget >= 5)) {
      return trail.map((event) => event.id);
    }
  }
  throw new Error("Unable to construct a valid Hedge Run trail");
}

export function createHedgeRun(seed: string, legendId: string): HedgeRunState {
  if (!seed || !HEDGE_RUN_LEGEND_IDS.includes(legendId as (typeof HEDGE_RUN_LEGEND_IDS)[number])) {
    throw new Error("Hedge Run requires a seed and a known guaranteed Legend");
  }
  const deckOrder = shuffle(HEDGE_RUN_KIT.map((card) => card.cardId), rngFor(`${HEDGE_RUN_RULES_VERSION}:deck:${seed}`));
  return {
    seed, rulesVersion: HEDGE_RUN_RULES_VERSION, legendId, round: 1, cheer: 10, status: "active",
    deckOrder, drawIndex: 5, hand: deckOrder.slice(0, 5), trail: createEventTrail(seed), slots: {},
    trainingIds: [], replacedIds: [], discoveries: [], choices: [], resolvedRounds: [],
  };
}

const kitById = new Map(HEDGE_RUN_KIT.map((card) => [card.cardId, card]));
const eventById = new Map(HEDGE_EVENTS.map((event) => [event.id, event]));

export function getRunTotals(state: HedgeRunState): { guard: number; search: number } {
  let guard = 1;
  let search = state.trainingIds.length;
  for (const cardId of Object.values(state.slots)) {
    const card = cardId ? kitById.get(cardId) : undefined;
    if (card) { guard += card.guard; search += card.search; }
  }
  return { guard, search };
}

export function applyHedgeChoice(state: HedgeRunState, choice: HedgeChoice): HedgeRunState {
  if (state.status !== "active") throw new Error("This Hedge Run is already locked");
  if (!state.hand.includes(choice.cardId)) throw new Error("The chosen card is not in hand");
  const card = kitById.get(choice.cardId);
  if (!card) throw new Error("The chosen card is not in the Hedge Run kit");
  if (choice.mode === "train" && state.trainingIds.length >= 2) throw new Error("Both Training spaces are full");

  const hand = state.hand.filter((id) => id !== choice.cardId);
  const slots = { ...state.slots };
  const replacedIds = [...state.replacedIds];
  const trainingIds = [...state.trainingIds];
  if (choice.mode === "train") trainingIds.push(choice.cardId);
  else {
    const replaced = slots[card.slot];
    if (replaced) replacedIds.push(replaced);
    slots[card.slot] = choice.cardId;
  }

  const provisional = { ...state, hand, slots, replacedIds, trainingIds };
  const totals = getRunTotals(provisional);
  const event = eventById.get(state.trail[state.round - 1]);
  if (!event) throw new Error("Missing event for current round");
  const damage = Math.max(0, event.danger - totals.guard);
  const cheer = Math.max(0, state.cheer - damage);
  const foundDiscovery = cheer > 0 && totals.search >= event.searchTarget;
  const discoveries = foundDiscovery ? [...state.discoveries, event.discovery] : [...state.discoveries];
  const choices = [...state.choices, choice];
  const resolvedRounds = [...state.resolvedRounds, {
    round: state.round, ...choice, eventId: event.id, ...totals, damage, foundDiscovery,
  }];
  const isLastRound = state.round === 6;
  const status: RunStatus = cheer === 0 ? "escaped" : isLastRound ? "complete" : "active";
  if (status !== "active") return { ...provisional, cheer, discoveries, choices, resolvedRounds, status };

  const nextCard = state.deckOrder[state.drawIndex];
  return {
    ...provisional, cheer, discoveries, choices, resolvedRounds, status, round: state.round + 1,
    hand: nextCard ? [...hand, nextCard] : hand, drawIndex: state.drawIndex + (nextCard ? 1 : 0),
  };
}

export function replayHedgeRun(seed: string, legendId: string, choices: readonly HedgeChoice[]): HedgeRunState {
  return choices.reduce(applyHedgeChoice, createHedgeRun(seed, legendId));
}

/** Rebuilds authoritative derived state from the only persisted inputs that matter. */
export function restoreHedgeRun(value: unknown): HedgeRunState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<HedgeRunState>;
  if (
    candidate.rulesVersion !== HEDGE_RUN_RULES_VERSION || typeof candidate.seed !== "string" ||
    typeof candidate.legendId !== "string" || !Array.isArray(candidate.choices)
  ) return null;
  const choices: HedgeChoice[] = [];
  for (const choice of candidate.choices) {
    if (!choice || typeof choice !== "object") return null;
    const item = choice as Partial<HedgeChoice>;
    if (typeof item.cardId !== "string" || (item.mode !== "play" && item.mode !== "train")) return null;
    choices.push({ cardId: item.cardId, mode: item.mode });
  }
  try {
    return replayHedgeRun(candidate.seed, candidate.legendId, choices);
  } catch {
    return null;
  }
}

export interface RunScore { discoveries: number; cheer: number }
export const scoreHedgeRun = (state: HedgeRunState): RunScore => ({ discoveries: state.discoveries.length, cheer: state.cheer });

export function compareHedgeRuns(left: HedgeRunState, right: HedgeRunState): "left" | "right" | "draw" {
  if (left.status === "active" || right.status === "active") throw new Error("Both runs must be locked before comparison");
  if (
    left.seed !== right.seed || left.rulesVersion !== right.rulesVersion ||
    left.deckOrder.join("\0") !== right.deckOrder.join("\0") || left.trail.join("\0") !== right.trail.join("\0")
  ) throw new Error("Hedge Run comparison requires the same pinned seed and setup");
  const a = scoreHedgeRun(left); const b = scoreHedgeRun(right);
  if (a.discoveries !== b.discoveries) return a.discoveries > b.discoveries ? "left" : "right";
  if (a.cheer !== b.cheer) return a.cheer > b.cheer ? "left" : "right";
  return "draw";
}

export interface HedgeChallenge {
  id: string; seed: string; creatorId: string; friendId: string;
  runs: Readonly<Partial<Record<"creator" | "friend", HedgeRunState>>>;
}
export interface HedgeChallengeView {
  ownRun?: HedgeRunState;
  friendStatus: "not-started" | "in-progress" | "complete";
  friendScore?: RunScore;
  result?: "win" | "loss" | "draw";
}

// This projection prevents accidental UI disclosure only. Local challenge state is not a security
// boundary; production async play must keep the opponent's sealed run on the server.

export function viewHedgeChallenge(challenge: HedgeChallenge, viewerId: string): HedgeChallengeView {
  const side = viewerId === challenge.creatorId ? "creator" : viewerId === challenge.friendId ? "friend" : null;
  if (!side) throw new Error("Viewer is not a participant in this challenge");
  const otherSide = side === "creator" ? "friend" : "creator";
  const ownRun = challenge.runs[side]; const friendRun = challenge.runs[otherSide];
  const friendStatus = !friendRun ? "not-started" : friendRun.status === "active" ? "in-progress" : "complete";
  const bothLocked = ownRun && friendRun && ownRun.status !== "active" && friendRun.status !== "active";
  if (!bothLocked) return { ownRun, friendStatus };
  const comparison = compareHedgeRuns(ownRun, friendRun);
  return {
    ownRun, friendStatus, friendScore: scoreHedgeRun(friendRun),
    result: comparison === "draw" ? "draw" : comparison === "left" ? "win" : "loss",
  };
}

/** Explicit marker used by UI adapters; Practice never represents a real opponent. */
export const PRACTICE_MODE = { kind: "practice", label: "Practice", changesResources: false } as const;
