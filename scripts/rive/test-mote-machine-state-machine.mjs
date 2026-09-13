#!/usr/bin/env node

/**
 * Behavioral contract for the production Mote Machine state machine.
 *
 * This deliberately uses the same locally installed Rive WASM package that
 * backs the web boundary, but supplies a no-op asset loader: this test is
 * about state-machine progression, not pixels. It is safe to run in Node
 * without a canvas/WebGL context.
 */

import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const rivePath = process.argv[2] ? resolve(process.argv[2]) : join(root, "assets/rive/mote-machine.riv");
const requireFromReactWebgl = createRequire(
  createRequire(import.meta.url).resolve("@rive-app/react-webgl2/package.json"),
);
const runtimePath = requireFromReactWebgl.resolve("@rive-app/webgl2/rive.js");
const requireRuntime = createRequire(runtimePath);
const rive = requireRuntime(runtimePath);

const ARTBOARD = "MOTE MACHINE";
const STATE_MACHINE = "MoteMachine";
const SPIN_ANIMATION = "Machine Spin";
const RESULT_STATE = "Result Hold";
const STEP_SECONDS = 1 / 60;
const ENTRY_TOLERANCE_SECONDS = 0.1;
const RESULT_TOLERANCE_SECONDS = 0.25;

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function formatTrace(trace) {
  return trace.length
    ? trace.map(({ at, states }) => `${at.toFixed(3)}s:${states.join("|")}`).join(", ")
    : "(no state changes)";
}

function advance(stateMachine, seconds, trace, elapsed) {
  stateMachine.advanceAndApply(seconds);
  const states = Array.from(
    { length: stateMachine.stateChangedCount() },
    (_, index) => stateMachine.stateChangedNameByIndex(index),
  );
  if (states.length) trace.push({ at: elapsed.value, states });
}

function advanceFor(stateMachine, seconds, trace, elapsed) {
  const steps = Math.ceil(seconds / STEP_SECONDS);
  for (let index = 0; index < steps; index += 1) {
    const delta = Math.min(STEP_SECONDS, seconds - elapsed.value);
    if (delta <= 0) break;
    elapsed.value += delta;
    advance(stateMachine, delta, trace, elapsed);
  }
}

function createHarnessSession(file, runtime) {
  const artboard = file.artboardByName(ARTBOARD);
  if (!artboard) throw new Error(`Artboard ${ARTBOARD} is missing.`);
  const definition = artboard.stateMachineByName(STATE_MACHINE);
  if (!definition) throw new Error(`State machine ${STATE_MACHINE} is missing.`);
  const viewModelDefinition = file.defaultArtboardViewModel(artboard);
  if (!viewModelDefinition) throw new Error(`Artboard ${ARTBOARD} has no default View Model.`);

  const viewModel = viewModelDefinition.defaultInstance();
  const stateMachine = new runtime.StateMachineInstance(definition, artboard);
  stateMachine.bindViewModelInstance(viewModel);
  stateMachine.bind();

  const trace = [];
  const elapsed = { value: 0 };
  advance(stateMachine, 0, trace, elapsed);

  return { artboard, stateMachine, trace, elapsed, viewModel };
}

function statesNamed(trace, name) {
  return trace.flatMap(({ at, states }) =>
    states.filter((state) => state === name).map(() => at),
  );
}

function releaseSession(session) {
  session.stateMachine.delete();
  session.artboard.delete();
  session.viewModel.delete();
}

const binary = readFileSync(rivePath);
const wasm = readFileSync(join(dirname(runtimePath), "rive.wasm"));
rive.RuntimeLoader.setWasmFallbackUrl(null);
rive.RuntimeLoader.setWasmBinary(toArrayBuffer(wasm));

const riveFile = new rive.RiveFile({
  buffer: toArrayBuffer(binary),
  // Embedded PNG/font decoding requires browser Image APIs. Asset pixels do
  // not affect state-machine progression, so claim the assets here.
  assetLoader: () => true,
});

await riveFile.init();
const file = riveFile.getInstance();
const animation = file.artboardByName(ARTBOARD)?.animationByName(SPIN_ANIMATION);
if (!animation) throw new Error(`Animation ${SPIN_ANIMATION} is missing.`);
const spinDurationSeconds = animation.duration / animation.fps;
const failures = [];

// A presentation flag is display state. It must never initiate or restart a
// paid spin; only the receipt-bound `spin` trigger may do that.
const presentingOnly = createHarnessSession(file, riveFile.runtime);
presentingOnly.viewModel.boolean("presenting").value = true;
advanceFor(presentingOnly.stateMachine, 0.75, presentingOnly.trace, presentingOnly.elapsed);
const presentingSpinEntries = statesNamed(presentingOnly.trace, SPIN_ANIMATION);
if (presentingSpinEntries.length !== 0) {
  failures.push(
    `presenting=true alone entered ${SPIN_ANIMATION} ${presentingSpinEntries.length} time(s) at ${presentingSpinEntries.map((time) => `${time.toFixed(3)}s`).join(", ")}.`,
  );
}

// A confirmed receipt fires `spin` exactly once. The state must then run
// uninterrupted through the authored one-shot and land in Result Hold.
const spin = createHarnessSession(file, riveFile.runtime);
spin.viewModel.trigger("spin").trigger();
advanceFor(
  spin.stateMachine,
  spinDurationSeconds + RESULT_TOLERANCE_SECONDS,
  spin.trace,
  spin.elapsed,
);
const spinEntries = statesNamed(spin.trace, SPIN_ANIMATION);
const resultEntries = statesNamed(spin.trace, RESULT_STATE);

if (spinEntries.length !== 1) {
  failures.push(
    `spin trigger entered ${SPIN_ANIMATION} ${spinEntries.length} time(s); expected exactly once.`,
  );
} else {
  if (spinEntries[0] > ENTRY_TOLERANCE_SECONDS) {
    failures.push(
      `spin trigger entered ${SPIN_ANIMATION} at ${spinEntries[0].toFixed(3)}s; expected within ${ENTRY_TOLERANCE_SECONDS.toFixed(2)}s.`,
    );
  }
  if (resultEntries.length !== 1) {
    failures.push(
      `${SPIN_ANIMATION} did not land in ${RESULT_STATE} exactly once; observed ${resultEntries.length} entries.`,
    );
  } else {
    const expectedResultAt = spinEntries[0] + spinDurationSeconds;
    const drift = Math.abs(resultEntries[0] - expectedResultAt);
    if (drift > RESULT_TOLERANCE_SECONDS) {
      failures.push(
        `${RESULT_STATE} arrived at ${resultEntries[0].toFixed(3)}s, ${drift.toFixed(3)}s away from the ${spinDurationSeconds.toFixed(3)}s ${SPIN_ANIMATION} duration.`,
      );
    }
  }
}

// Every reward selector must work repeatedly from Result Hold. Reduced motion
// uses its own 28-frame settle and may never enter the full spin animation.
for (const reduceMotion of [false, true]) {
  const session = createHarnessSession(file, riveFile.runtime);
  const expectedState = reduceMotion ? "Machine Settle" : SPIN_ANIMATION;
  const duration = reduceMotion ? 28 / 60 : spinDurationSeconds;
  const advanceBy = (seconds) => advanceFor(session.stateMachine, session.elapsed.value + seconds, session.trace, session.elapsed);
  session.viewModel.boolean("reduceMotion").value = reduceMotion;
  session.viewModel.boolean("presenting").value = true;
  advanceBy(0.75);
  if (statesNamed(session.trace, expectedState).length) failures.push(`${expectedState} started without a receipt.`);
  for (const [index, selector] of [3, 5, 10, 25].entries()) {
    session.viewModel.number("tickles").value = selector;
    session.viewModel.trigger("spin").trigger();
    advanceBy(duration + 0.15);
    const entries = statesNamed(session.trace, expectedState);
    const results = statesNamed(session.trace, RESULT_STATE);
    if (entries.length !== index + 1 || results.length !== index + 1) {
      failures.push(`${expectedState}: selector ${selector} did not play and settle exactly once.`);
    } else if (Math.abs(results[index] - entries[index] - duration) > 0.06) {
      failures.push(`${expectedState}: selector ${selector} did not preserve the authored duration.`);
    }
  }
  advanceBy(5);
  if (statesNamed(session.trace, expectedState).length !== 4) failures.push(`${expectedState} restarted while holding the result.`);
  if (reduceMotion && statesNamed(session.trace, SPIN_ANIMATION).length) failures.push("Reduced motion entered the full spin animation.");
  releaseSession(session);
}

releaseSession(presentingOnly);
releaseSession(spin);
riveFile.cleanup();

if (failures.length) {
  console.error("Mote Machine state-machine regression FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`- presenting-only trace: ${formatTrace(presentingOnly.trace)}`);
  console.error(`- spin-trigger trace: ${formatTrace(spin.trace)}`);
  process.exitCode = 1;
} else {
  console.log(
    `Mote Machine state-machine regression passed: spin entered once, ran ${spinDurationSeconds.toFixed(3)}s, and landed in ${RESULT_STATE}; four repeated selectors pass in full and reduced motion.`,
  );
}
