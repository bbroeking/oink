#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const assetDir = resolve(root, "assets/rive/card-packs");
const contract = JSON.parse(readFileSync(resolve(assetDir, "contract.json"), "utf8"));
const runtimePath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(assetDir, contract.binary.path);
const binary = readFileSync(runtimePath);

const expectedProperties = new Map([
  ...Object.entries(contract.inputs),
  ...Object.entries(contract.outputs),
].map(([name, specification]) => [name, specification]));

const evidence = {
  runtimePath,
  bytes: statSync(runtimePath).size,
  sha256: createHash("sha256").update(binary).digest("hex"),
  riveHeader: binary.subarray(0, 4).toString("ascii"),
  expected: {
    artboard: contract.artboard.name,
    stateMachine: contract.stateMachine,
    viewModel: contract.viewModel,
    defaultInstance: contract.defaultInstance,
    properties: Object.fromEntries(expectedProperties),
  },
  actual: {},
  failures: [],
};

const fail = (message) => evidence.failures.push(message);
if (evidence.riveHeader !== "RIVE") fail("runtime has no RIVE header");
if (evidence.bytes !== contract.binary.bytes) {
  fail(`byte count ${evidence.bytes} does not match contract ${contract.binary.bytes}`);
}
if (evidence.sha256 !== contract.binary.sha256) {
  fail(`sha256 ${evidence.sha256} does not match contract ${contract.binary.sha256}`);
}

const requireFromRive = createRequire(
  createRequire(import.meta.url).resolve("@rive-app/react-webgl2/package.json"),
);
const runtimeModulePath = requireFromRive.resolve("@rive-app/webgl2/rive.js");
const rive = createRequire(runtimeModulePath)(runtimeModulePath);
const arrayBuffer = (value) => value.buffer.slice(
  value.byteOffset,
  value.byteOffset + value.byteLength,
);
rive.RuntimeLoader.setWasmFallbackUrl(null);
rive.RuntimeLoader.setWasmBinary(
  arrayBuffer(readFileSync(join(dirname(runtimeModulePath), "rive.wasm"))),
);

let riveFile;
let file;
let artboard;
let selectedInstance;
let diagnosticInstance;
let stateMachineInstance;
try {
  riveFile = new rive.RiveFile({
    buffer: arrayBuffer(binary),
    // Embedded fixture images need no external replacement for inspection.
    assetLoader: () => true,
  });
  await riveFile.init();
  file = riveFile.getInstance();
  artboard = file.artboardByName(contract.artboard.name);
  const stateMachine = artboard?.stateMachineByName(contract.stateMachine) ?? null;
  // The runtime can contain more than one definition with the same display
  // name. The artboard-bound definition is authoritative for DataBindByName;
  // The artboard-bound lookup is authoritative; the named lookup is retained
  // as a diagnostic for accidental duplicate definitions in future exports.
  const namedViewModel = file.viewModelByName(contract.viewModel);
  const viewModel = artboard ? file.defaultArtboardViewModel(artboard) : null;
  const instanceNames = viewModel?.getInstanceNames?.() ?? viewModel?.instanceNames ?? [];
  const definitionProperties = viewModel?.getProperties?.() ?? viewModel?.properties ?? [];
  selectedInstance = instanceNames.includes(contract.defaultInstance)
    ? viewModel?.instanceByName(contract.defaultInstance) ?? null
    : null;
  const runtimeDefaultInstance = viewModel?.defaultInstance() ?? null;
  diagnosticInstance = contract.defaultInstance === "Instance"
    ? null
    : viewModel?.instanceByName("Instance") ?? null;
  if (artboard && stateMachine && selectedInstance) {
    stateMachineInstance = new riveFile.runtime.StateMachineInstance(stateMachine, artboard);
    stateMachineInstance.bindViewModelInstance(selectedInstance);
    stateMachineInstance.bind();
    stateMachineInstance.advanceAndApply(0);
  }
  const behavior = stateMachineInstance && selectedInstance
    ? exerciseMachine(stateMachineInstance, selectedInstance)
    : null;
  const coldStartResume = artboard && stateMachine && selectedInstance
    ? exerciseColdStartResume(riveFile.runtime, file, contract)
    : null;

  evidence.actual = {
    artboardFound: Boolean(artboard),
    artboardSize: artboard ? { width: artboard.width, height: artboard.height } : null,
    stateMachineFound: Boolean(stateMachine),
    stateMachineBoundToSelectedInstance: Boolean(stateMachineInstance),
    behavior,
    coldStartResume,
    viewModelFound: Boolean(viewModel),
    boundViewModelName: viewModel?.name ?? null,
    namedLookupDiagnostic: namedViewModel ? {
      name: namedViewModel.name,
      instanceNames: namedViewModel.getInstanceNames?.() ?? namedViewModel.instanceNames ?? [],
      properties: namedViewModel.getProperties?.() ?? namedViewModel.properties ?? [],
    } : null,
    instanceNames,
    selectedInstanceName: selectedInstance?.name ?? selectedInstance?.instanceName ?? null,
    runtimeDefaultInstanceProperties: inspectInstance(runtimeDefaultInstance, expectedProperties),
    definitionProperties,
    selectedProperties: inspectInstance(selectedInstance, expectedProperties),
    diagnosticInstance: diagnosticInstance ? {
      name: diagnosticInstance.name ?? diagnosticInstance.instanceName ?? "Instance",
      properties: inspectInstance(diagnosticInstance, expectedProperties),
    } : null,
  };

  if (!artboard) fail(`missing artboard ${contract.artboard.name}`);
  if (artboard && (artboard.width !== contract.artboard.width || artboard.height !== contract.artboard.height)) {
    fail(`artboard size ${artboard.width}x${artboard.height} does not match contract`);
  }
  if (!stateMachine) fail(`missing state machine ${contract.stateMachine}`);
  if (stateMachine && selectedInstance && !stateMachineInstance) {
    fail(`state machine did not bind to ${contract.defaultInstance}`);
  }
  if (behavior && !behavior.normalMotion.states.includes("PackOpen")) {
    fail(`normal-motion open did not enter PackOpen: ${JSON.stringify(behavior.normalMotion.states)}`);
  }
  if (behavior && !behavior.normalMotion.states.includes("CardReveal")) {
    fail(`normal-motion open did not enter CardReveal: ${JSON.stringify(behavior.normalMotion.states)}`);
  }
  if (behavior && !behavior.reducedMotion.states.includes("ReducedMotionReveal")) {
    fail(`reduced-motion open did not enter ReducedMotionReveal: ${JSON.stringify(behavior.reducedMotion.states)}`);
  }
  if (coldStartResume) {
    if (!coldStartResume.reveal.states.includes("CardReveal")) {
      fail(`cold-start reveal at index 2 did not enter CardReveal: ${JSON.stringify(coldStartResume.reveal.states)}`);
    }
    if (coldStartResume.reveal.states.includes("PackOpen")) {
      fail(`cold-start reveal at index 2 incorrectly entered PackOpen: ${JSON.stringify(coldStartResume.reveal.states)}`);
    }
    if (!coldStartResume.inspect.states.includes("CardInspect")) {
      fail(`cold-start inspect at index 2 did not enter CardInspect: ${JSON.stringify(coldStartResume.inspect.states)}`);
    }
    if (coldStartResume.inspect.states.includes("PackOpen")) {
      fail(`cold-start inspect at index 2 incorrectly entered PackOpen: ${JSON.stringify(coldStartResume.inspect.states)}`);
    }
  }
  if (!viewModel) fail(`artboard has no default View Model`);
  if (viewModel && viewModel.name !== contract.viewModel) {
    fail(`artboard-bound View Model ${viewModel.name} does not match ${contract.viewModel}`);
  }
  if (!instanceNames.includes(contract.defaultInstance)) {
    fail(`missing named View Model instance ${contract.defaultInstance}; found ${JSON.stringify(instanceNames)}`);
  }
  if (!selectedInstance || !instanceNames.includes(contract.defaultInstance)) {
    fail(`cannot inspect required instance ${contract.defaultInstance}`);
  }
  const definitions = new Map(definitionProperties.map(({ name, type }) => [name, type]));
  for (const [name, specification] of expectedProperties) {
    const optional = specification.optional === true;
    const definedType = normalizeRuntimeType(definitions.get(name));
    const lookup = evidence.actual.selectedProperties[name];
    if (!optional && definedType !== specification.type) {
      fail(`definition property ${name} expected ${specification.type}, found ${definedType ?? "missing"}`);
    }
    if (!optional && !lookup.found) fail(`instance property ${name} is not runtime-addressable as ${specification.type}`);
    if (name === "finish" && lookup.found) {
      const expected = specification.values;
      if (JSON.stringify(lookup.values) !== JSON.stringify(expected)) {
        fail(`finish enum values ${JSON.stringify(lookup.values)} do not match ${JSON.stringify(expected)}`);
      }
    }
  }
  if (runtimeDefaultInstance && runtimeDefaultInstance !== selectedInstance && runtimeDefaultInstance !== diagnosticInstance) {
    runtimeDefaultInstance.delete?.();
  }
} catch (error) {
  fail(`runtime import/inspection failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  try { stateMachineInstance?.delete?.(); } catch {}
  try { diagnosticInstance?.delete?.(); } catch {}
  try { selectedInstance?.delete?.(); } catch {}
  try { artboard?.delete?.(); } catch {}
  try { file?.unref?.(); } catch {}
  try { riveFile?.cleanup?.(); } catch {}
}

evidence.ok = evidence.failures.length === 0;
console.log(JSON.stringify(evidence, null, 2));
if (!evidence.ok) process.exitCode = 1;

function inspectInstance(instance, properties) {
  const result = {};
  for (const [name, specification] of properties) {
    const property = typedLookup(instance, name, specification.type);
    result[name] = {
      expectedType: specification.type,
      optional: specification.optional === true,
      found: Boolean(property),
      ...(specification.type === "enum" && property
        ? { value: property.value, values: property.values }
        : {}),
    };
  }
  return result;
}

function typedLookup(instance, name, type) {
  if (!instance) return null;
  if (type === "number") return instance.number(name);
  if (type === "boolean") return instance.boolean(name);
  if (type === "trigger") return instance.trigger(name);
  if (type === "enum") return instance.enum(name);
  if (type === "image") return instance.image(name);
  if (type === "string") return instance.string(name);
  return null;
}

function normalizeRuntimeType(type) {
  return type === "enumType" ? "enum" : type;
}

function exerciseMachine(machine, instance) {
  const advance = (seconds) => {
    const states = [];
    for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
      machine.advanceAndApply(1 / 60);
      for (let index = 0; index < machine.stateChangedCount(); index += 1) {
        states.push(machine.stateChangedNameByIndex(index));
      }
    }
    return states;
  };
  const configure = (reducedMotion) => {
    instance.number("tearProgress").value = 1;
    instance.number("revealIndex").value = 0;
    instance.number("tiltX").value = 0.25;
    instance.number("tiltY").value = -0.25;
    instance.boolean("reduceMotion").value = reducedMotion;
    instance.enum("finish").value = "Foil";
  };

  const imageBinding = instance.image("cardArt");
  imageBinding.value = null;
  machine.advanceAndApply(0);

  configure(false);
  instance.trigger("open").trigger();
  const normalStates = advance(2);
  instance.trigger("reset").trigger();
  const resetStates = advance(1);
  configure(true);
  instance.trigger("open").trigger();
  const reducedStates = advance(2);
  return {
    normalMotion: { states: normalStates },
    reset: { states: resetStates },
    reducedMotion: { states: reducedStates },
    dynamicImageBindingAddressable: Boolean(imageBinding),
    dynamicImageNullAssignmentAdvanced: true,
    signalBindingsAddressable: Object.fromEntries(
      ["tearComplete", "cardSettled", "inspectComplete", "sequenceComplete"]
        .map((name) => [name, Boolean(instance.trigger(name))]),
    ),
    callbackEmissionTested: false,
    callbackEmissionLimitation: "The headless low-level WebGL wrapper exposes trigger() but no listener API; device/browser hook callback delivery remains a runtime integration test.",
    imageDecodeTested: false,
    imageDecodeLimitation: "WebGL decodeImage requires the browser Image API; headless Node verifies the typed image property but cannot decode pixels.",
  };
}

function exerciseColdStartResume(runtime, file, specification) {
  const run = (command) => {
    let caseArtboard;
    let caseInstance;
    let caseMachine;
    try {
      caseArtboard = file.artboardByName(specification.artboard.name);
      const machineDefinition = caseArtboard?.stateMachineByName(specification.stateMachine) ?? null;
      const viewModel = caseArtboard ? file.defaultArtboardViewModel(caseArtboard) : null;
      caseInstance = viewModel?.instanceByName(specification.defaultInstance) ?? null;
      if (!caseArtboard || !machineDefinition || !caseInstance) {
        return { states: [], error: "Could not construct isolated resume case" };
      }

      caseMachine = new runtime.StateMachineInstance(machineDefinition, caseArtboard);
      caseMachine.bindViewModelInstance(caseInstance);
      caseMachine.bind();
      caseInstance.number("tearProgress").value = 1;
      caseInstance.number("revealIndex").value = 2;
      caseInstance.number("tiltX").value = 0;
      caseInstance.number("tiltY").value = 0;
      caseInstance.boolean("reduceMotion").value = false;
      caseInstance.enum("finish").value = "Standard";
      caseMachine.advanceAndApply(0);
      caseInstance.trigger(command).trigger();

      const states = [];
      for (let elapsed = 0; elapsed < 2; elapsed += 1 / 60) {
        caseMachine.advanceAndApply(1 / 60);
        for (let index = 0; index < caseMachine.stateChangedCount(); index += 1) {
          states.push(caseMachine.stateChangedNameByIndex(index));
        }
      }
      return { states };
    } finally {
      try { caseMachine?.delete?.(); } catch {}
      try { caseInstance?.delete?.(); } catch {}
      try { caseArtboard?.delete?.(); } catch {}
    }
  };

  // These deliberately omit `open`: a restored presentation must reconstruct
  // its current card directly rather than replaying the closed packet.
  return {
    reveal: run("reveal"),
    inspect: run("inspect"),
  };
}
