// PROTOTYPE — pure Rosie's Loadout game state.
//
// Question: does a small dual-use deck create enough tension between permanent
// Training, building a three-slot loadout, and attacking before the opponent
// reaches the same peak? This intentionally models the core loop, not every
// printed card exception.

import { CARDS } from "../../../docs/marketing/trading-cards/base-set-84/cards.mjs";

export const STARTER_IDS = [
  "ticket_takers_cap",
  "muddy_cap",
  "bog_helmet",
  "toy_sword",
  "firefly_lantern",
  "mud_shovel",
  "firefly_aura",
  "shadow_aura",
  "lantern_rabbit",
  "bog_frog",
  "truffle_mole",
  "porch_fireflies",
  "big_wind_up",
  "duck_into_the_mud",
  "warm_tea",
  "root_around",
  "homestead_barn",
  "festival_night",
];

const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]));
const MAX_CHEER = 12;
const MAX_LEVEL = 6;

const copyCard = (id, owner, copy) => {
  const source = CARD_BY_ID.get(id);
  if (!source) throw new Error(`Unknown prototype card: ${id}`);
  return {
    ...source,
    uid: `${owner}-${id}-${copy}`,
    exhausted: false,
    damage: 0,
  };
};

function seededShuffle(cards, seed) {
  let value = seed >>> 0;
  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

const buildPlayer = (name, index, seed) => ({
  name,
  cheer: MAX_CHEER,
  level: 0,
  deck: seededShuffle(
    STARTER_IDS.map((id, copy) => copyCard(id, index, copy)),
    seed,
  ),
  hand: [],
  discard: [],
  training: [],
  gear: { head: null, held: null, aura: null },
  critters: [],
  place: null,
  turn: {
    grew: false,
    played: { gear: false, critter: false, stunt: false, place: false },
    attackBonus: 0,
    preventNext: 0,
  },
});

const clone = (state) => structuredClone(state);
const otherIndex = (state) => 1 - state.active;

function log(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 6);
}

function draw(state, playerIndex, count = 1) {
  const player = state.players[playerIndex];
  for (let drawIndex = 0; drawIndex < count; drawIndex += 1) {
    const card = player.deck.shift();
    if (!card) {
      state.winner = 1 - playerIndex;
      state.reason = `${player.name} ran out of cards.`;
      return;
    }
    player.hand.push(card);
  }
}

function readyPlayer(player) {
  Object.values(player.gear).forEach((card) => {
    if (card) card.exhausted = false;
  });
  player.critters.forEach((card) => {
    card.exhausted = false;
    card.damage = 0;
  });
  player.turn = {
    grew: false,
    played: { gear: false, critter: false, stunt: false, place: false },
    attackBonus: 0,
    preventNext: player.turn.preventNext,
  };
}

export function createGame(seed = 20260728) {
  const state = {
    prototype: true,
    active: 0,
    phase: "grow",
    round: 1,
    winner: null,
    reason: null,
    log: [],
    telemetry: {
      trained: [0, 0],
      played: [0, 0],
      attacks: [0, 0],
      fullLoadoutTurns: [0, 0],
      placesPlayed: [0, 0],
    },
    players: [
      buildPlayer("Rosie", 0, seed),
      buildPlayer("Copper", 1, seed + 99),
    ],
  };
  draw(state, 0, 5);
  draw(state, 1, 6);
  log(state, "Rosie goes first. Grow by tucking one card, or skip.");
  return state;
}

function requirePhase(state, phase) {
  if (state.phase !== phase) {
    throw new Error(`That action belongs in ${phase}; current phase is ${state.phase}.`);
  }
}

function takeFromHand(player, handIndex) {
  const index = Number(handIndex);
  if (!Number.isInteger(index) || index < 0 || index >= player.hand.length) {
    throw new Error("Choose a valid hand number.");
  }
  return player.hand.splice(index, 1)[0];
}

function styleIsTrained(player, card) {
  return player.training.some((trained) => trained.style === card.style);
}

function canPlay(player, card) {
  if (card.rank > player.level) {
    throw new Error(`${card.name} is rank ${card.rank}; ${player.name} is level ${player.level}.`);
  }
  if (!styleIsTrained(player, card)) {
    throw new Error(`Train a ${card.style} card before playing ${card.name}.`);
  }
}

export function trainCard(source, handIndex) {
  const state = clone(source);
  requirePhase(state, "grow");
  const player = state.players[state.active];
  if (player.turn.grew) throw new Error("You already grew this turn.");
  if (player.level >= MAX_LEVEL) throw new Error("Your Legend is already level 6.");
  const card = takeFromHand(player, handIndex);
  player.training.push(card);
  player.level += 1;
  player.cheer = Math.min(MAX_CHEER, player.cheer + 1);
  player.turn.grew = true;
  state.telemetry.trained[state.active] += 1;
  log(state, `${player.name} trained ${card.name}: level ${player.level}, ${card.style} unlocked.`);
  return state;
}

function resolveStunt(state, player, card) {
  switch (card.id) {
    case "big_wind_up":
      player.turn.attackBonus += 2;
      break;
    case "duck_into_the_mud":
      player.turn.preventNext += 2;
      break;
    case "warm_tea":
      player.cheer = Math.min(MAX_CHEER, player.cheer + 2);
      break;
    case "root_around":
      draw(state, state.active, 1);
      break;
    default:
      draw(state, state.active, 1);
  }
}

export function playCard(source, handIndex) {
  const state = clone(source);
  requirePhase(state, "act");
  const player = state.players[state.active];
  const card = player.hand[Number(handIndex)];
  if (!card) throw new Error("Choose a valid hand number.");
  canPlay(player, card);
  const kind = card.type === "gear" ? "gear" : card.type;
  if (!["gear", "critter", "stunt", "place"].includes(kind)) {
    throw new Error(`${card.type} is outside this prototype slice.`);
  }
  if (player.turn.played[kind]) {
    throw new Error(`You already played a ${kind} this turn.`);
  }
  if (kind === "critter" && player.critters.length >= 2) {
    throw new Error("Both Critter spaces are full.");
  }

  takeFromHand(player, handIndex);
  if (kind === "gear") {
    const old = player.gear[card.slot];
    if (old) player.discard.push(old);
    player.gear[card.slot] = card;
  } else if (kind === "critter") {
    player.critters.push(card);
  } else if (kind === "place") {
    if (player.place) player.discard.push(player.place);
    player.place = card;
    state.telemetry.placesPlayed[state.active] += 1;
  } else {
    resolveStunt(state, player, card);
    player.discard.push(card);
  }
  player.turn.played[kind] = true;
  state.telemetry.played[state.active] += 1;
  log(state, `${player.name} played ${card.name}.`);
  return state;
}

function attackValue(player, attacker) {
  let value = attacker.bash ?? 0;
  value += player.turn.attackBonus;
  if (player.place?.id === "mud_derby" && attacker.type === "critter") value += 1;
  return value;
}

function dealToLegend(state, attackerIndex, damage) {
  const defenderIndex = 1 - attackerIndex;
  const defender = state.players[defenderIndex];
  let remaining = damage;

  if (defender.turn.preventNext > 0) {
    const prevented = Math.min(defender.turn.preventNext, remaining);
    defender.turn.preventNext -= prevented;
    remaining -= prevented;
  }

  // A ready Critter protects by exhausting to prevent 1. This differs from the
  // current paper draft on purpose: the simulator is testing whether protection
  // needs a visible cost to keep 12-Cheer games moving.
  const protector = defender.critters.find((card) => !card.exhausted);
  if (remaining > 0 && protector) {
    protector.exhausted = true;
    remaining -= 1;
  }

  const head = defender.gear.head;
  if (remaining > 0 && head && !head.exhausted) {
    head.exhausted = true;
    remaining = Math.max(0, remaining - (head.guard ?? 0));
  }

  defender.cheer = Math.max(0, defender.cheer - remaining);
  if (defender.cheer === 0) {
    state.winner = attackerIndex;
    state.reason = `${defender.name} ran out of Cheer.`;
  }
  return remaining;
}

export function attack(source, attackerKey, targetKey = "legend") {
  const state = clone(source);
  requirePhase(state, "battle");
  const player = state.players[state.active];
  const opponent = state.players[otherIndex(state)];
  let attacker;

  if (attackerKey === "gear") {
    attacker = player.gear.held;
    if (!attacker) throw new Error("Equip Held Gear before your Legend can attack.");
  } else if (String(attackerKey).startsWith("critter:")) {
    attacker = player.critters[Number(String(attackerKey).split(":")[1])];
    if (!attacker) throw new Error("Choose a valid Critter attacker.");
  } else {
    throw new Error("Attacker must be gear or critter:N.");
  }
  if (attacker.exhausted) throw new Error(`${attacker.name} is exhausted.`);

  attacker.exhausted = true;
  let damage = attackValue(player, attacker);
  player.turn.attackBonus = 0;
  state.telemetry.attacks[state.active] += 1;

  if (targetKey === "legend") {
    const dealt = dealToLegend(state, state.active, damage);
    log(state, `${attacker.name} attacked ${opponent.name} for ${dealt} Cheer.`);
  } else if (String(targetKey).startsWith("critter:")) {
    const targetIndex = Number(String(targetKey).split(":")[1]);
    const target = opponent.critters[targetIndex];
    if (!target) throw new Error("Choose a valid opposing Critter.");
    target.damage += damage;
    log(state, `${attacker.name} dealt ${damage} to ${target.name}.`);
    if (target.damage >= target.hearts) {
      opponent.discard.push(opponent.critters.splice(targetIndex, 1)[0]);
      log(state, `${target.name} was tuckered out.`);
    }
  } else {
    throw new Error("Target must be legend or critter:N.");
  }
  return state;
}

export function advance(source) {
  const state = clone(source);
  if (state.winner !== null) return state;
  const player = state.players[state.active];
  if (state.phase === "grow") {
    state.phase = "act";
  } else if (state.phase === "act") {
    state.phase = "battle";
  } else if (state.phase === "battle") {
    state.phase = "end";
  } else {
    if (Object.values(player.gear).every(Boolean)) {
      state.telemetry.fullLoadoutTurns[state.active] += 1;
    }
    state.active = otherIndex(state);
    if (state.active === 0) state.round += 1;
    readyPlayer(state.players[state.active]);
    draw(state, state.active, 1);
    state.phase = "grow";
    log(state, `${state.players[state.active].name}'s turn.`);
  }
  return state;
}

export function availableActions(state) {
  if (state.winner !== null) return ["restart", "quit"];
  if (state.phase === "grow") return ["train N", "next"];
  if (state.phase === "act") return ["play N", "next"];
  if (state.phase === "battle") {
    return ["attack gear legend", "attack critter:N legend", "next"];
  }
  return ["next"];
}
