# Rive card-opening feasibility — Expo 57 / React Native 0.86

Implementation update: the requested existing cloud Card Packs file has now been authored through local Rive MCP and exported with an editable backup. See [current handoff](../design/card-packs-2026-10-13/HANDOFF.md) and the runtime contract for exact evidence. The earlier CLI spike below is historical research, not the shipped prototype source.

Date: 2026-10-13

## Decision

A satisfying pack-opening and card-reveal sequence is feasible in the current app with the already-installed Rive Nitro runtime. The production-safe version should be a **single active `RiveView` rendering one card at a time**, with a 2D authored foil/parallax illusion. React Native should own the pack result, reveal order, accessibility, gesture/sensor normalization, persistence, navigation, and fallback. Rive should own only the visible performance.

Do not base the first version on true runtime 3D. The installed package is `@rive-app/react-native@0.4.19`, backed by Rive iOS `6.21.1` and Android `11.7.2` (`package.json`, `pnpm-lock.yaml`, `ios/Podfile.lock`). Rive's August 2026 runtime update says Apple GPU Canvas, required for 3D content, arrived in iOS 6.24–6.25 and is off by default; that is newer than Oink's installed iOS runtime. Rive also describes current GPU Canvas/3D workflows as early access. A convincing holographic effect remains practical without it: layer authored gradients, additive/normal highlights, masks, texture offsets, restrained card rotation/skew, shadow displacement, and art parallax, all driven by two normalized tilt properties.

This note does not create or claim a `.riv` asset. Visual creation must begin in Claude Design under the repository's `AGENTS.md`. The implementation can then be authored either in the Rive editor or as a text-based Rive CLI project and actually compiled to `.riv`. The current official CLI can create a project from scratch, compile Rive Markup Language (RML), images, and fonts to a local runtime binary, and do so signed out; an existing `.rev` or cloud file is not required. A clean, non-watermarked published build and editor round-trip have separate account/plan requirements, detailed below. [Rive CLI getting started](https://github.com/rive-app/rive-docs/blob/main/cli/getting-started.mdx)

## What is already verified in this repository

- `package.json` pins Expo `~57.0.12`, React Native `0.86.2`, `@rive-app/react-native` `0.4.19`, and `react-native-nitro-modules` `0.35.10`. The installed Rive package declares Expo 53+, RN 0.78+, iOS 15.1+, and Android 24+ as its minimums, so the project is above the supported baseline. [`@rive-app/react-native` source/README](https://github.com/rive-app/rive-nitro-react-native/blob/main/README.md)
- `ios/Podfile.lock` resolves `RiveRuntime 6.21.1`; the installed package declares Android runtime `11.7.2`. Native linkage is therefore present, rather than a proposed dependency change.
- `components/mote-machine/MoteMachineRive.native.tsx` is the best current integration template. It loads a bundled resource with `useRiveFile`, binds the named default instance, uses number/boolean/string/trigger hooks, calls `playIfNeeded()` after property changes, reports runtime readiness only after contract binding, and replaces the view with `MoteMachineFallback` on load, contract, or render failure.
- `components/ui/RivePig.native.tsx` proves the second needed path: a statically required `.riv`, referenced raster replacement through `useRiveFile(source, { referencedAssets })`, explicit `awaitViewReady()`, a four-second readiness timeout, event listening, pause/play, and a raster placeholder/fallback. Its `key` forces remounting when the referenced skin changes to prevent cross-instance leakage.
- `components/mote-machine/moteMachineRiveContract.ts` demonstrates the right separation: code has a named, versionable contract; server-confirmed values enter Rive as display facts; Rive never decides or persists the reward.
- `hooks/useMotionPolicy.tsx` already tracks the platform reduce-motion preference and converts large transitions to crossfades. `RivePig.native.tsx` already chooses raster output when reduced motion is active. The card experience should reuse this policy.
- The older `docs/design/rive-homepage-feasibility-2026-07.md` describes the pre-Nitro package and Expo 52. Treat its runtime/API conclusions as historical. Its authoring lessons about one stable contract, attachment testing, and device gates are still useful. `docs/rive-pig-rigging.md` also records a prior editor-export blocker; it does not prove today's account can export.

## Current Rive CLI and MCP authoring paths

### The official CLI can build this `.riv` from scratch

Rive's current first-party CLI materially changes the prior authoring conclusion. `rive create myproject` scaffolds `rive.yaml`, agent instructions, and a `scene.rml` containing an artboard, timeline, and state machine. Running `rive myproject` or `rive myproject --once` compiles the text project to `build/myproject.riv`; images, fonts, `.luau`, and `.wgsl` files in the project are discovered by extension. Rive explicitly says the resulting `.riv` is for its runtimes. No editor source, `.rev`, account login, or cloud service is needed to create, preview, verify, or build locally. [Rive CLI overview](https://github.com/rive-app/rive-docs/blob/main/cli/overview.mdx), [Rive CLI getting started](https://github.com/rive-app/rive-docs/blob/main/cli/getting-started.mdx)

The CLI is therefore a valid programmatic authoring route for the card prototype. It can build the artboard, timelines, state machine, view model, bindings, shapes, layouts, and asset references as reviewable text. Official agent guidance says agents can write RML, scripts, and shaders, query the object schema, verify compilation, inspect the result, and render screenshots. The bundled examples specifically cover view-model input, pointer-to-view-model binding, and headless pointer/data simulation. [Rive CLI agent workflow](https://github.com/rive-app/rive-docs/blob/main/cli/agents.mdx), [Rive CLI examples](https://github.com/rive-app/rive-docs/blob/main/cli/examples.mdx)

This does **not** mean the proposed asset has already been generated, that the CLI is installed here, or that every desired editor feature is proven in RML. No software was installed or executed for this research. The implementation spike must first install the official CLI with user authorization, scaffold a throwaway project, and prove the minimum contract with `--verify`, `inspect --summary`, screenshots, and loading the compiled binary in Oink.

The recommended CLI-first source package would contain:

- `rive.yaml`;
- one or more `.rml` files defining the artboard, component layers, timelines, state machine, view model, default instance, and bindings;
- imported card-frame/foil textures and test card artwork at declared dimensions;
- embedded or referenced font assets with an explicit glyph policy;
- no Luau or WGSL in the first mobile spike unless a required effect cannot be expressed with ordinary Rive objects and data binding.

Avoiding scripts matters for compatibility and distribution. Rive says unsigned local projects work offline, but files containing scripts destined for the web must be published/signed; `--publish` requires login and may add a watermark. A clean published `.riv` requires the project to be bound to a cloud file in a Cadet-or-higher workspace. The native card proposal does not need scripting, so a locally compiled, ordinary RML `.riv` is the first artifact to test. Account/plan status remains relevant for clean publishing, cloud/editor collaboration, and `.rev` export, rather than for the initial local `.riv` build itself. [Rive CLI signing and publishing](https://github.com/rive-app/rive-docs/blob/main/cli/getting-started.mdx#signing-in)

### Runtime compatibility still requires a load test

The CLI docs do not expose a target-runtime-version switch in the documented project setup, and Rive's feature-support guidance says newer authoring features can require newer runtimes. Oink is on React Native package `0.4.19` with iOS runtime `6.21.1` and Android `11.7.2`, while the current docs track newer runtime releases. Therefore “the CLI emitted a `.riv`” is not sufficient evidence that the file is compatible with both installed native runtimes. [Rive feature support](https://github.com/rive-app/rive-docs/blob/main/feature-support.mdx)

Keep the initial RML to established 2D features already represented in Oink's checked-in assets and runtime APIs: artboards, shapes/images, masks, ordinary timelines/state machines, view-model primitive/image properties, bindings, and triggers. Exclude GPU Canvas, 3D, scripts, shaders, text input, global view models, and other newly released features. Then load the exact compiled binary on iOS and Android before expanding the asset. If the latest CLI still produces an unreadable file or a needed feature is unsupported by 0.4.19, the options are to simplify the RML or treat a runtime upgrade as a separate native change.

### Official MCP is the selected desktop authoring path

Rive's official MCP server is served by the Rive desktop Editor at `127.0.0.1:9791/mcp`. The docs say it is available only through the Windows/macOS desktop Editor, requires the Early Access app to be open, and can create/edit files, scene hierarchies, shapes, layouts, animations, state machines, data binding, scripts, and shaders. It is a capable authoring assistant, but it is not the headless compiler and it does not remove the editor dependency for that workflow. [Official Rive MCP integration](https://rive.app/docs/editor/ai/mcp)

The user selected local desktop Rive authoring through MCP. Continue the established Claude Design direction in the editor, retain an editable `.rev` backup and contract manifest, and export the runtime `.riv` for native verification. The existing CLI/RML spike remains a reproducible reference. Neither path replaces Claude Design for deciding the visual interface, and neither proves runtime compatibility without the native load/device gates.

Connection check on 2026-10-13: Codex already has `mcp_servers.rive` configured at `http://127.0.0.1:9791/mcp`. The local endpoint successfully completed MCP initialization as server `rive` version `0.6`, returned its tool catalog, and answered `session_info`. Its current catalog includes artboard/object editing, animations, state machines, View Models, capture, `.rev` import, and `export_file` for `.riv` and `.rev`; these exports remain account/plan-dependent and have not been exercised for the card file. The editor is currently at its login screen, and `session_info` returned no open tabs or active file. Desktop sign-in and an open card-pack document are required before authoring can continue. No editor document was changed during this connection check.

Later the same day, desktop sign-in was complete. A new [Card Packs file](https://editor.rive.app/file/card-packs/2651084) was created under **Tickle the Pig → Shared Project**, with a 390×844 `CardPackReveal` artboard created and read through MCP. The editor source is now available for authoring; it is still an empty scaffold. The existing CLI animation is a separate artifact and has not yet been transferred into this file.

## Runtime capabilities relevant to cards

### Data binding, text, images, and completion

The installed 0.4.19 types and current docs support view-model properties for numbers, booleans, strings, colors, enums, triggers, images, lists, nested view models, and artboards. `useViewModelInstance(..., { async: true })` is the current path; async creation is available from 0.4.18 and synchronous creation is deprecated. Values are applied when the bound state machine advances, which is why Oink's existing code calls `playIfNeeded()` after updates. [Rive React Native data binding](https://rive.app/docs/runtimes/react-native/data-binding)

For this feature:

- Bind player-visible labels (`title`, `rarityLabel`, optional serial/edition) as strings. Rive's direct text-run methods still exist in the installed API but are deprecated; bind strings to text runs in the RML project or editor source instead.
- Bind card artwork with an Image property or a referenced image asset. The installed `ViewModelImageProperty.set()` and `RiveImages` API support runtime images, while `useRiveFile` also supports React Native asset IDs, URIs, file resources, and already-decoded Rive images for referenced assets. [Rive React Native loading assets](https://rive.app/docs/runtimes/react-native/loading-assets)
- Use a data-binding trigger such as `revealFinished` for app-side completion. Rive's official React Native example recommends an editor Trigger property set by a state-machine action at 100% exit time, then observed with `useRiveTrigger`. Legacy Rive events are supported but deprecated. [`@rive-app/react-native` completion example](https://github.com/rive-app/rive-nitro-react-native/blob/main/README.md#reacting-to-an-animation-finishing)
- Initialize every display value before firing `open`/`reveal`, then call `playIfNeeded()`. Do not derive a reward from which visual branch appears.

Dynamic full-bleed card art is therefore API-feasible. What is not verified is the practical decode/upload cost of the intended image dimensions, alpha, color treatment, and rapid repeated swaps on target phones. Use one correctly sized art property with `cover`-style clipping authored in the card component, preload/decode the next image if measurements justify it, and do not mount a renderer per card in a carousel.

### State-machine inputs and events

The existing pig component uses imperative number inputs, triggers, and `onEventListener`; all are present in 0.4.19 but marked deprecated in the installed type declarations. New work should use a view model and data binding unless an exported file forces a temporary compatibility bridge. The state machine remains appropriate for sequencing authored phases; it should react to app-owned properties and publish completion triggers.

The state machine should not contain probabilities, entitlement logic, rarity selection, collection ownership, server timing, retry rules, or navigation. Those decisions must already be final before `open` fires.

### Gestures and tilt

Rive listeners can react to pointer down/up/move over editor hit areas and drive state-machine actions. The editor docs describe listeners as pointer-driven interactions attached to hit areas. [Rive editor listeners](https://rive.app/docs/editor/state-machine/listeners)

For a card, React Native should still own drag/tilt input and write normalized `tiltX` / `tiltY` numbers into Rive. This gives the app one place to implement gesture cancellation, modal/back gestures, device-orientation permission and sampling, reduced motion, screen-reader behavior, and clamping. It also avoids making the reward interaction depend on an editor hit area. Rive listeners remain useful for a self-contained tap sparkle, but the primary reveal gesture and any motion-sensor feed need a device trial.

The practical update policy is frame-coalesced and bounded: clamp each axis to `[-1, 1]`, update at most once per display frame, apply a small dead zone and smoothing in React Native, and stop writes when the screen is blurred or the card settles. Verify that sustained property writes do not produce JS/native frame pacing problems on the oldest supported iPhone and a mid/low Android device.

### Renderer, sizing, and layout

`RiveView` 0.4.19 offers a single Rive renderer, not a renderer choice. It supports `Fit`, `Alignment`, `Fit.Layout`, and `layoutScaleFactor`; the package describes responsive layout support as basic. [`RiveView` source](https://github.com/rive-app/rive-nitro-react-native/blob/main/src/specs/RiveView.nitro.ts), [Rive layout overview](https://rive.app/docs/editor/layouts/layouts-overview)

Use a fixed-aspect card artboard inside a React Native stage that handles safe areas and sheet/modal chrome. Prefer `Fit.Contain` for the whole card so no edge is accidentally cropped. Put the full-bleed art inside the authored card mask. Only adopt `Fit.Layout` if the exported file uses Rive Layouts intentionally and device tests prove the responsive behavior; a fixed card ratio is simpler and more predictable.

One active card and one renderer is the recommended ceiling for the reveal. Queue later cards in app state and swap/rebind only after the current card has settled. A fan of static previous/next cards can be React Native images. This reduces native views, state machines, image memory, and simultaneous per-frame work. It also follows the repository's existing practice of one main Rive machine per surface.

## Holographic tilt and animated full-bleed art

### Feasible now: 2D illusion

An effective foil card does not require true 3D geometry. Author the card as a layered 2D component:

1. full-bleed raster art clipped to the card face;
2. border/frame and rarity treatment as vectors;
3. a broad diagonal spectral gradient masked to foil regions;
4. a fine noise/sparkle texture whose translation responds more strongly than the base art;
5. one soft specular band and a restrained rim highlight;
6. foreground subject accents at a slightly different parallax factor;
7. a shadow/backplate that moves opposite the highlight.

Drive those layers from `tiltX` and `tiltY`. The state machine can interpolate them and add a low-amplitude authored shimmer only while the card is active. This can read as depth and holographic foil even though the renderer is drawing a flat artboard.

Rive supports meshes, gradients, clipping, opacity and animated transforms; its custom renderer also supports vector feathering. Keep expensive visual ideas subordinate to real-device frame time. [Rive meshes](https://rive.app/docs/editor/manipulating-shapes/meshes), [Rive vector feathering](https://www.rive.app/blog/how-rive-reinvented-feathering-for-the-vectorian-era)

### Not production-proven here: true 3D

Do not promise a physically correct perspective card, 3D particles, or GPU Canvas shader foil in this version. Oink's installed iOS runtime predates the Apple GPU Canvas release identified as required for 3D content, and Rive labels the workflow early access. Upgrading Rive solely for this would be a native/runtime change requiring its own compatibility and device investigation. A React Native outer transform could rotate the whole flat view, but this must be visually tested because transformed native render surfaces can have platform-specific clipping and compositing behavior.

### Full-bleed animated art

There are two reasonable levels:

- **Recommended:** one dynamic still image plus Rive-authored local motion (foil, particles, border, reveal mask, subtle image-mesh deformation). This keeps the payload bounded and makes every card use the same rig.
- **Selective premium variant:** embed or bind a small number of alternate art layers and animate opacity/deformation. This is feasible but multiplies decoded texture memory. It needs measured `.riv` size, peak resident memory, image decode time, first-frame latency, and thermal/frame behavior.

Avoid video-like frame sequences inside `.riv` for every card. They erase the size and reuse advantages of the shared rig. If a card needs bespoke living art, author a limited overlay or a separate premium asset loaded only for that reveal.

## Recommended responsibility split

| React Native / app owns | Rive owns |
|---|---|
| Server/API result and idempotency | Pack/card visual staging |
| Exact cards, order, rarity, duplicates, inventory writes | Tear, burst, lift, flip, settle, sparkle |
| Loading/error/retry and navigation | Interpolation between named visual phases |
| Accessibility labels, focus, announcements, accessible buttons | Decorative text rendering mirrored from app values |
| Reduce-motion decision and static fallback | Reduced-motion pose selected by a bound property |
| Gesture/sensor capture, clamping, smoothing | Mapping `tiltX`/`tiltY` to layered visual transforms |
| Audio/haptic policy and timing authority | Optional visual cue trigger requesting a beat |
| Analytics and completion timeout | `revealFinished` notification after the authored one-shot |

React Native must be able to complete the reveal if Rive never becomes ready or never emits completion. Use an app-side timeout, show the actual card in an accessible static component, and allow continue/close. A Rive failure cannot strand or duplicate an awarded item.

## Minimal authoring contract

The first authoring deliverable should be one source project plus one compiled runtime binary, not a family of card files:

- Claude Design canvas for the pack, unopened/open states, card front/back, foil behavior, reduced-motion state, and fallback/static composition.
- Prefer an editable CLI project (`rive.yaml`, `.rml`, and source assets) checked into the repository so the source is diffable and the binary reproducible. An editor/workspace source plus `.rev` backup is an acceptable alternative when the visual workflow needs editor-only tools. `.riv` is a runtime binary and is not the sole editable source; Rive stopped accepting `.riv` imports back into the editor. [Rive staff explanation of `.riv` vs `.rev`](https://rive.app/community/forums/support/fsnLLkXUaA62/import-riv/ft51hiVaMKdW)
- Compiled `card-pack-reveal.riv` (final repository path to be chosen during implementation), produced by `rive <project> --once` for a CLI source or exported from the editor source.
- One artboard: `CardPackReveal`.
- One state machine: `CardPackRevealMachine`.
- One default view model and instance: `CardPackRevealViewModel` / `Default`.

Minimum view-model properties:

| Name | Type | Direction | Meaning |
|---|---|---|---|
| `phase` | Enum | app → Rive | `sealed`, `opening`, `cardBack`, `revealing`, `settled` |
| `open` | Trigger | app → Rive | begin pack performance after result/art are ready |
| `reveal` | Trigger | app → Rive | flip/reveal current card |
| `reset` | Trigger | app → Rive | return to deterministic sealed pose |
| `reduceMotion` | Boolean | app → Rive | select static/crossfade lane |
| `rarity` | Enum | app → Rive | stable authored rarity treatment names |
| `title` | String | app → Rive | visible card title |
| `rarityLabel` | String | app → Rive | visible rarity text |
| `cardArt` | Image | app → Rive | full-bleed dynamic art |
| `tiltX` | Number | app → Rive | normalized horizontal tilt `[-1, 1]` |
| `tiltY` | Number | app → Rive | normalized vertical tilt `[-1, 1]` |
| `revealFinished` | Trigger | Rive → app | one-shot completion notification |

Keep a separate app-side semantic label containing the complete card description; do not rely on text embedded in the canvas for screen readers. If authored Rive semantics are considered, note that the package README reports accessibility semantics as partial (iOS support, Android still in progress at that documentation point), so native React accessibility remains required.

The export handoff must include a short contract manifest listing exact names/types/directions, artboard dimensions, intended card ratio, image slot pixel dimensions and alpha/color-space assumptions, fonts and glyph export settings, animation durations, completion trigger timing, and screenshots of sealed/reveal/settled/reduced states. Dynamic text requires the needed glyphs; Rive's font docs explain embedded, referenced, and hosted options and warn that “glyphs used” is insufficient for arbitrary runtime text. [Rive fonts](https://rive.app/community/doc/fonts/docIMUINFL5T)

## Device/runtime trial gates

The following are **not verified by repository inspection or documentation** and block a production recommendation until tested with the actual exported file:

1. An actual `.riv` matching the contract. First try the signed-out local CLI build, which does not require export entitlement; separately verify account/plan capability only if clean publishing, cloud/editor collaboration, or `.rev` export is required.
2. Correct first frame, binding order, completion trigger, reset, and repeated opens on iOS and Android. Test app background/foreground during every phase.
3. Dynamic image replacement before and after binding; verify no stale previous-card texture and no flash. Compare remount-per-card with in-place image property updates.
4. Sustained `tiltX`/`tiltY` updates under finger drag and, if used, motion sensor input. Record UI/JS frame rate and native frame pacing.
5. Full-bleed image memory and decode latency at chosen dimensions; test several consecutive cards and verify disposal after leaving the screen.
6. Native-view clipping/compositing if React Native applies outer perspective/rotation.
7. TalkBack/VoiceOver order, announcements, accessible escape/continue, and operation with Rive unavailable.
8. Reduce Motion from initial mount and toggled while the surface is active. It must settle immediately into a readable static result without replaying.
9. Low Power Mode/thermal behavior and a mid/low Android GPU. Foil and particles should have a cheaper authored tier if profiling requires it.
10. Failure injection: malformed/missing asset, wrong property name, readiness timeout, absent completion, interrupted reveal, and memory pressure. The confirmed reward must remain visible and recoverable.

## Integration approach for this app

Implementation should follow `MoteMachineRive.native.tsx` rather than inventing another lifecycle:

1. Create a renderer-neutral card-reveal contract and a native Rive component with a static fallback sibling.
2. Load the exported asset with `useRiveFile(require(...))`; create the VMI asynchronously; render only when file and VMI are ready.
3. Set all app-owned values, including image and reduced-motion state, before firing the one-shot. Call `playIfNeeded()` after bound updates.
4. Register `revealFinished`, plus an app timeout. Deduplicate completion with a reveal token/receipt ID so remounts or repeated triggers cannot advance twice.
5. Keep exactly one Rive view mounted for the active reveal. Render queued/settled cards as ordinary React Native views/images.
6. Pause/unmount when the screen loses focus; dispose through the runtime hook lifecycle; avoid retaining decoded card images after exit.
7. Gate rollout behind the same kind of readiness/error reporting used by the pig and Mote Machine paths.
8. Use `npm run quality:loop` during the player-facing layout work and `npm run quality:check` before handoff, as required by `AGENTS.md`. Any distributable build then follows `docs/RELEASE_CHECKLIST.md`; no build is part of this research.

## Practical verdict

Proceed with a narrow authoring spike. The current runtime integration is sufficient, and the app already contains the needed patterns for lifecycle, binding, reduce motion, and fallback. The best first target is one pack, one dynamically bound card, one rarity treatment, one drag-driven foil response, and one reduced-motion static reveal. It should feel premium if the visual art and timing are strong.

The main blockers are installing and exercising the official CLI (or using the editor), producing a real compiled asset, proving that the current CLI output loads on Oink's slightly older native runtimes, and gathering device evidence for dynamic full-bleed images plus continuous tilt updates. Editor export entitlement is not a blocker for the first local CLI-built, script-free prototype. True 3D is outside the safe scope of the installed runtime. A layered 2D holographic illusion is the recommended production direction.
