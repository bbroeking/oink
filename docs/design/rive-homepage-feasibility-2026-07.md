---
title: "Rive homepage pig feasibility"
type: memo
date: 2026-07-26
tags: [research, rive, animation, pigs, homepage]
---

# Rive homepage pig feasibility

## Decision

**Rive is a reasonable long-term replacement for the homepage flipbook, but it
is not the fastest fix for the current pig artwork.** The viable Rive design is
one skeleton, one state machine, and six embedded skins—not a separately
animated file per pig.

For the immediate art repair, generate each pig's complete 32-frame pack as one
coordinated batch (the eight distinct four-frame animations currently exposed
by `SpritePig`; `bounce` reuses `jump`). In parallel, make a small Rive proof of
concept with Rosie and one spotted pig. Do not migrate the homepage until that
prototype proves animation parity and equipped-cosmetic behavior on a real iOS
development build.

## Spike update — 2026-07-26

The first runtime gate passed. Oink's installed
`rive-react-native@9.8.3` / `RiveRuntime 6.18.2` stack rendered Rive's official
avatar sample in the iPhone 16e / iOS 18.6 simulator from the development-only
`/ui-audit` route. The probe reported `Native Rive view is rendering`; importing
and mounting the native view did not crash the Expo 52 development client.

This validates native runtime linkage only. It does not yet validate the pig
rig, skin registration, animation quality, cosmetic attachment, physical-device
behavior, or memory stability.

## Repository facts

- Oink is on Expo `~52.0.49`, React Native `0.76.9`, and has the New
  Architecture enabled.
- The legacy `rive-react-native@9.8.3` dependency is already installed, and the
  iOS lockfile resolves its native `RiveRuntime 6.18.2` pod.
- The app currently renders six pig identities through one `SpritePig` API.
  Each identity supplies the same eight four-frame animation packs:
  `idle`, `walk`, `jump`, `happy`, `sad`, `tired`, `surprise`, and `wave`.
- Cosmetics are separate React Native image layers positioned from
  frame-specific anchors in `constants/hats.ts`; they are not baked into the
  pig sprites.

Relevant code: [`package.json`](../../package.json),
[`app.json`](../../app.json), [`utils/pigs.ts`](../../utils/pigs.ts),
[`components/ui/SpritePig.tsx`](../../components/ui/SpritePig.tsx), and
[`components/ui/PigStage.tsx`](../../components/ui/PigStage.tsx).

## Runtime compatibility

### What works now

Rive officially documents Expo integration for both its new and legacy React
Native runtimes. Both contain custom native code, so neither works in Expo Go;
they require a development build. The legacy runtime requires iOS 14+, below
Expo SDK 52's iOS 15.1 minimum. [Rive: Adding Rive to
Expo](https://rive.app/docs/runtimes/react-native/adding-rive-to-expo)

Expo SDK 52 ships React Native 0.76 and introduced the New Architecture as the
default for new apps. Oink explicitly enables it. [Expo SDK 52
release](https://expo.dev/changelog/2024-11-12-sdk-52)

The installed Rive package is the **legacy bridge runtime**, not the new Nitro
runtime. Its official source describes it as a wrapper over the iOS and Android
runtimes and continues to document Expo use. [Rive legacy React Native
source](https://github.com/rive-app/rive-react-native)

The pods resolving proves that native dependencies can be assembled; it does
not prove rendering under Oink's New Architecture configuration. Treat an iOS
simulator/device render as a required spike gate.

### What cannot be adopted on Expo 52

Rive's recommended new package, `@rive-app/react-native`, requires React Native
0.78+ and Expo SDK 53+. Oink's React Native 0.76 / Expo 52 stack is below both
minimums, so adopting the new runtime is coupled to an Expo upgrade. [Rive React
Native migration requirements](https://rive.app/docs/runtimes/react-native/migration-guide)

The new runtime does not itself force this project to enable the New
Architecture—Oink already has it enabled—but it does require Nitro Modules and
the newer React Native/Expo baseline. It should be evaluated during the next
Expo upgrade rather than smuggled into this art fix.

### Build implications

Rive is native code. Adding, removing, or changing the native Rive runtime
requires regenerating/rebuilding the development client. Expo explicitly
requires rebuilding when a library with native code is installed or updated.
[Expo: development
builds](https://docs.expo.dev/develop/development-builds/introduction/)

After that native build exists, use the legacy runtime's
`source={require("./pig.riv")}` loading path so `.riv` edits can be served by
Metro without rebuilding. Oink's current `metro.config.js` does not include
`riv` in `resolver.assetExts`, so the spike must add that configuration before
loading the prototype this way. Native `resourceName` loading instead bundles
the file into the native target. [Rive: Loading Rive
Files](https://rive.app/docs/runtimes/react-native/loading-rive-files)

For Oink, the first prototype therefore requires an iOS development build
(`npx expo run:ios` under this repo's build conventions), not Expo Go. A
production/TestFlight binary would still follow `docs/RELEASE_CHECKLIST.md`.

## Can all pigs share exactly the same animation?

Yes. Rive bones form a reusable hierarchy; artwork parented to a bone inherits
its transform. Raster images can also be meshed and deformed, with bones driving
the mesh. [Rive: Bones](https://rive.app/docs/editor/manipulating-shapes/bones),
[Rive: Meshes](https://rive.app/docs/editor/manipulating-shapes/meshes)

The recommended authoring model is:

```text
pig artboard
├── one skeleton
├── one animation set
├── one "pig" state machine
└── skin Solo
    ├── Rosie artwork
    ├── Copper artwork
    ├── Pepper artwork
    ├── Bandit artwork
    ├── Pickles artwork
    └── Biscuit artwork
```

A Rive Solo displays one child at a time, and Rive explicitly names character
skins as a common Solo use case. [Rive:
Solos](https://rive.app/docs/editor/manipulating-shapes/solos)

The skin selector can be a number/enum property or legacy state-machine input.
The installed legacy runtime exposes number, string, boolean, color, enum, and
trigger data-binding hooks, plus `setInputState` and `fireState`. This is enough
to select one of six embedded skins and trigger the shared animation graph.
[Rive: state-machine playback](https://rive.app/docs/runtimes/react-native/state-machines),
[Rive: legacy ref methods](https://rive.app/docs/runtimes/react-native/rive-ref-methods)

This does **not** automatically convert the current pose drawings into a rig.
Each pig needs consistent layered source artwork (body, head, ears, limbs,
features, tail, markings), and each skin must fit the same joint layout. Rive
then prevents inter-frame redrawing drift because animation moves the shared
rig rather than asking an image generator to redraw every pose.

## Images and runtime skin switching

Rive files can embed PNG/JPEG/WebP images or load referenced assets while a file
is initialized. Referenced assets are useful for file size and for choosing
assets at load time. Rive recommends image data binding for true runtime image
replacement. [Rive: Loading
Assets](https://rive.app/docs/runtimes/react-native/loading-assets)

The new React Native runtime adds direct view-model access and advanced property
types including images and artboards. The installed legacy 9.8.3 TypeScript API
only exposes primitive properties; it has no image- or artboard-property setter.
[Rive: migration
guide](https://rive.app/docs/runtimes/react-native/migration-guide)

Consequences on Expo 52:

1. **Recommended:** embed all six skin layers in one `.riv` and switch a Solo
   with a primitive enum/number. This is deterministic and available now.
2. **Possible but weaker:** put each pig on its own artboard and change
   `artboardName`. This duplicates more setup and can reset playback.
3. **Not available in the installed API:** hot-swap an arbitrary pig bitmap into
   an image property while preserving one live instance. That becomes practical
   after the new-runtime/Expo upgrade.

## State machine and app contract

Use one state machine named `pig` with a small stable contract:

| Property/input | Type | Purpose |
|---|---|---|
| `skin` | enum or number | Select one of the six embedded skins |
| `rest` | enum | `idle`, `sad`, or `tired` |
| `walk`, `jump`, `happy`, `surprise`, `wave` | trigger | Play the matching shared animation |
| `animation_complete` | trigger/event back to code | Let the app return to the selected rest state |

Rive state machines advance continuously and react to external data-binding
changes. Rive recommends data binding as the modern contract, but legacy
state-machine inputs remain supported by the installed runtime. [Rive:
State-machine playback](https://rive.app/docs/runtimes/react-native/state-machines),
[Rive: Data Binding
overview](https://rive.app/docs/editor/data-binding/overview)

## Cosmetics are the hard boundary

The React Native runtime exposes playback, state-machine/data-binding controls,
text updates, and events. Its documented view/ref API does **not** expose a
bone/node world-transform query. Therefore an external React Native `<Image>`
cannot directly ask Rive where `head`, `eyes`, or `hand_r` is on the current
interpolated frame. This conclusion is an inference from the complete official
React Native prop/ref surface, not a stated Rive prohibition. [Rive React Native
props](https://rive.app/docs/runtimes/react-native/props), [Rive React Native
ref methods](https://rive.app/docs/runtimes/react-native/rive-ref-methods)

The legacy component permits absolutely positioned React children, but that
only layers content over the Rive view; it does not make the child inherit a
bone transform.

There are three choices:

1. **Put cosmetics inside Rive (recommended for a full migration).** Parent
   cosmetic artwork to head/face/body/hand nodes so it inherits the animation
   natively. Solos or embedded components select equipped items.
2. **Expose slot transforms as data-bound numbers (experimental).** Bind an
   animated target's X/Y/rotation back to view-model properties and observe them
   in React Native. Rive supports target-to-source bindings conceptually, but
   this would send per-frame values over the legacy bridge and risks visible
   one-frame lag. It needs a performance/visual spike and should not be assumed
   production-safe. [Rive: Data Binding
   overview](https://rive.app/docs/editor/data-binding/overview)
3. **Keep a duplicate transform table in React Native.** This recreates the
   current anchor-maintenance problem and defeats much of the reason to move to
   Rive.

Rive-internal cosmetics are technically clean but materially expand authoring:
Oink's existing catalog must be imported, mapped to slots, and tested in every
animation. This is the largest migration cost—not the pig skin switch.

## Recommended proof of concept

Time-box the decision to one thin vertical slice:

1. Author one 300×300 `.riv` with a shared skeleton and only `idle`, `jump`, and
   `wave`.
2. Add two skins: Rosie and Pickles. Both must use the same bones and timelines.
3. Add three representative cosmetics inside Rive: one hat, one pair of
   glasses, and one held item.
4. Wire `skin`, three animation triggers, and three cosmetic selectors through
   the installed legacy runtime.
5. Run on the current iOS simulator and a physical iPhone development build.
6. Compare against the raster path for silhouette fidelity, reaction timing,
   touch latency, memory, thermal behavior, and cosmetic attachment.

**Go to full Rive migration only if** the two skins remain visually identical in
proportions, all three cosmetics stay attached throughout every test animation,
and the native view is stable under Oink's current New Architecture build.

If any of those fail, keep `SpritePig` and replace the generated recolors with
coordinated, identity-locked frame packs. That path is less elegant but ships
the needed visual correction without coupling it to an Expo upgrade or a
catalog-wide cosmetic conversion.
