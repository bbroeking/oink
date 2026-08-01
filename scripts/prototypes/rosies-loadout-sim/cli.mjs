#!/usr/bin/env node

// PROTOTYPE — throwaway terminal shell for the pure state in game.mjs.

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  advance,
  attack,
  availableActions,
  createGame,
  playCard,
  trainCard,
} from "./game.mjs";

const bold = "\u001b[1m";
const dim = "\u001b[2m";
const reset = "\u001b[0m";
const color = {
  brave: "\u001b[31m",
  steady: "\u001b[32m",
  spark: "\u001b[35m",
};

const rl = createInterface({ input, output });
let state = createGame();
let error = "";

function shortCard(card) {
  if (!card) return "—";
  const stats = card.slot === "head"
    ? `Guard ${card.guard}`
    : card.slot === "held"
      ? `Bash ${card.bash}`
      : card.type === "critter"
        ? `${card.bash}/${card.hearts}`
        : "";
  return `${card.name}${stats ? ` · ${stats}` : ""}${card.exhausted ? " · exhausted" : ""}`;
}

function board(player) {
  return [
    `${bold}${player.name}${reset}  Cheer ${player.cheer}/12 · Level ${player.level} · Deck ${player.deck.length} · Hand ${player.hand.length}`,
    `  Training  ${player.training.map((card) => `${color[card.style] ?? ""}${card.style[0].toUpperCase()}${reset}`).join(" ") || "—"}`,
    `  Head      ${shortCard(player.gear.head)}`,
    `  Held      ${shortCard(player.gear.held)}`,
    `  Aura      ${shortCard(player.gear.aura)}`,
    `  Critters  ${player.critters.map((card, index) => `${index}:${shortCard(card)}`).join(" | ") || "—"}`,
    `  Place     ${shortCard(player.place)}`,
  ].join("\n");
}

function hand(player) {
  return player.hand.map((card, index) => {
    const rank = card.rank ? `R${card.rank}` : "";
    return `  ${bold}${index}${reset}  ${card.name} · ${card.type}${card.slot ? `/${card.slot}` : ""} · ${rank} ${color[card.style] ?? ""}${card.style ?? ""}${reset}`;
  }).join("\n");
}

function render() {
  console.clear();
  const active = state.players[state.active];
  console.log(`${bold}ROSIE'S LOADOUT — LOGIC PROTOTYPE${reset}`);
  console.log(`${dim}Round ${state.round} · ${active.name}'s ${state.phase.toUpperCase()} phase · no state is saved${reset}\n`);
  console.log(board(state.players[0]));
  console.log("\n" + board(state.players[1]));
  console.log(`\n${bold}${active.name}'s hand${reset}`);
  console.log(hand(active) || "  —");
  if (state.winner !== null) {
    console.log(`\n${bold}${state.players[state.winner].name} wins!${reset} ${state.reason}`);
    console.log(`${dim}${JSON.stringify(state.telemetry)}${reset}`);
  }
  if (error) console.log(`\n\u001b[31m${error}${reset}`);
  console.log(`\n${bold}Recent play${reset}`);
  state.log.slice(0, 3).forEach((line) => console.log(`  ${dim}${line}${reset}`));
  console.log(`\n${bold}Commands${reset}  ${availableActions(state).join("  ·  ")}  ·  state  ·  restart  ·  quit`);
}

function printState() {
  console.log(JSON.stringify(state, null, 2));
}

while (true) {
  render();
  const line = (await rl.question("\n> ")).trim();
  const [command, first, second] = line.split(/\s+/);
  error = "";
  try {
    if (command === "quit" || command === "q") break;
    if (command === "restart") state = createGame(Date.now());
    else if (command === "train") state = trainCard(state, Number(first));
    else if (command === "play") state = playCard(state, Number(first));
    else if (command === "attack") state = attack(state, first, second);
    else if (command === "next" || command === "n") state = advance(state);
    else if (command === "state") {
      printState();
      await rl.question("\nPress return to continue.");
    } else error = "Unknown command.";
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
}

rl.close();

