---
title: "Rive multiplayer experiments for the Slop Club Lounge"
type: research
date: 2026-08-02
status: current
tags: [rive, lounge, multiplayer, expo, web]
---

# Rive multiplayer experiments for the Slop Club Lounge

## Bottom line

Rive is a strong fit for the **expressive layer** of the Lounge: pig reactions,
proximity-aware idles, paired social animations, and animated stations. It is
not the multiplayer layer. Supabase Presence/Broadcast should continue to own
who is present, movement, emotes, and interaction handshakes; Rive should
receive a small local state contract and turn it into motion.

The best first experiment is a **Pig-close tickle**: when two stationary pigs
come close, either player can offer a mutual tickle; acceptance plays a short
paired Rive reaction on both clients and produces a heart burst. Keep its first
version social-only. Because the Lounge is members-only, minting spendable
tickles there would make a paid area an advantage faucet, conflicting with the
project's “money buys expression, never advantage” charter. A local “close
tickles shared” count, a warm visual, or a keepsake is safe; a currency grant is
a separate economy decision requiring a server-authoritative, abuse-resistant
design.

For web development, Oink needs a separate official Rive web adapter. The
installed `rive-react-native` package wraps the native iOS and Android
runtimes—it is not a browser renderer—while Rive publishes official React web
packages. Rive currently recommends `@rive-app/react-webgl2` for rendering
quality/performance, with `@rive-app/react-canvas` as the smaller option for
simpler graphics. [Rive's legacy React Native repository](https://github.com/rive-app/rive-react-native),
[Rive React runtime](https://rive.app/docs/runtimes/react/react),
[Canvas vs WebGL2](https://rive.app/docs/runtimes/web/canvas-vs-webgl)

## Oink's current baseline

- Oink is on Expo 52, React Native 0.76, and `rive-react-native@9.8.3`; the
  package is the legacy bridge runtime. Its native Rive wrapper already drives
  state-machine inputs, swaps the referenced `pig_skin` asset at mount, and
  falls back to `SpritePig` on failure. The web adapter is intentionally
  raster-only today. See [`package.json`](../../package.json),
  [`RivePig.native.tsx`](../../components/ui/RivePig.native.tsx), and
  [`RivePig.web.tsx`](../../components/ui/RivePig.web.tsx).
- The Lounge already has the right multiplayer seam: Supabase Presence carries
  peer identity/station state, Broadcast carries movement and emotes, and Skia
  renders a single world canvas. The route's default export currently redirects
  to Shop; `LoungePrototype` is a named prototype rather than a player-reachable
  web development screen. See
  [`useLoungePeers.ts`](../../hooks/useLoungePeers.ts),
  [`lounge.tsx`](../../app/lounge.tsx), and
  [`lounge-farm-spec.md`](../lounge-farm-spec.md).
- Metro already recognizes `.riv` files. This matches Rive's recommended
  `require()` path: Metro serves an edited file during development, bundles it
  for a build, and can deliver it via an Expo OTA update without rebuilding the
  native runtime. [Rive: loading React Native files](https://rive.app/docs/runtimes/react-native/loading-rive-files)
- The custom pig runtime asset is still the practical blocker. The authoring
  guide records that the current editor account has not exported
  `assets/rive/pig.riv`; until that export exists, Oink can prove runtime
  linkage with the bundled official sample but cannot validate custom pig
  reactions. See [`rive-pig-rigging.md`](../rive-pig-rigging.md).

## Runtime capabilities that matter here

### State machines and app inputs

State machines advance each frame and evaluate transitions, keyframes, and
data-binding changes. Current Rive guidance prefers view-model properties over
legacy state-machine inputs, but existing inputs continue to work. That makes a
small, versioned contract viable across the native legacy runtime and a new web
adapter: booleans/enums for coarse state, numbers for bounded parameters, and
triggers for one-shots. [Rive: state-machine playback](https://rive.app/docs/runtimes/react-native/state-machines),
[Rive: inputs-to-data-binding migration](https://rive.app/docs/editor/data-binding/migration-guide)

For a Pig-close tickle prototype, the file contract could be:

| Name | Type | Meaning |
|---|---|---|
| `locomotion` | enum/number | idle, walk, sit, paired reaction |
| `near_friend` | boolean | another eligible pig is inside the interaction radius |
| `partner_side` | enum/number | partner is left or right, so the pig faces inward |
| `close_tickle` | trigger | play the accepted paired reaction |
| `reaction` | enum/number | heart, laugh, surprise, sleepy |
| `skin`, `equip_*` | existing selectors | pig identity and Rive-internal cosmetics |

Do not stream raw world coordinates into Rive every render frame. The Lounge
already owns interpolation and collision in Skia/Reanimated. Feed Rive only
meaningful state changes (entered/leaved proximity, started/stopped walking,
reaction accepted), which keeps the design contract small and avoids bridge
traffic on the legacy native runtime.

### Events, listeners, and output back to code

Rive listeners can react to pointer down/up, hover/enter/exit, movement, and
clicks inside an artboard, and can change view-model properties or fire
triggers. General Rive Events and runtime event listeners are now deprecated;
Rive recommends observable view-model properties—especially triggers—for new
code-to-design and design-to-code communication. Existing events remain
supported, so Oink's installed runtime can still use them for a spike.
[Rive: state-machine listeners](https://rive.app/docs/editor/state-machine/listeners),
[Rive: events overview](https://rive.app/docs/editor/events/overview),
[Rive: React Native ref methods](https://rive.app/docs/runtimes/react-native/rive-ref-methods)

Practical boundary: let React Native/Skia own the accessible interaction button
and Supabase mutation. Use Rive listeners only for interactions whose hit area
is genuinely part of the animation (for example, patting an animated mud
bubble). A Rive-reported trigger can cue haptics or sound, but it should not
directly award currency.

### Data binding and view models

Rive view-model properties support numbers, booleans, triggers, strings, enums,
colors, nested view models, lists, images, and artboards. They can be observed,
so a change authored inside Rive can notify app code after the state machine
advances. Lists can dynamically create repeated component instances, and
artboard properties can swap modular components. [Rive: data-binding overview](https://rive.app/docs/editor/data-binding/overview),
[Rive: web data binding](https://rive.app/docs/runtimes/web/data-binding)

Those richer types are not equally available in Oink's current native package.
The installed legacy 9.8.3 API exposes primitive hooks (boolean, string,
number, enum, color, trigger), legacy input methods, text-run updates, events,
and referenced assets. The new `@rive-app/react-native` runtime adds owned
`RiveFile` objects, direct `ViewModelInstance` access, multiple instances, and
advanced lists/images/artboards. Rive's migration requirements are React
Native 0.78+ and Expo 53+, so Oink's Expo 52 / RN 0.76 app cannot adopt it
without an Expo upgrade. [Rive 9.8.3 tagged source](https://github.com/rive-app/rive-react-native/blob/v9.8.3/src/Rive.tsx),
[Rive React Native migration guide](https://rive.app/docs/runtimes/react-native/migration-guide)

Therefore:

- Author new experiment contracts as view-model concepts, but mirror them with
  primitive legacy inputs for the current native spike.
- Avoid making a list of all twelve Lounge peers inside one native Rive file
  today. That becomes much cleaner after the runtime/Expo upgrade.
- Keep Supabase peer objects in application code rather than treating the Rive
  view model as network state.

### Text and image swaps

Dynamic text is possible now: the legacy native ref can set an exported text
run, and the newer data-binding path binds a string property to text. Rive now
deprecates direct text-run mutation in favor of data binding. For Lounge name
tags, the current Skia/RN text remains preferable because it is already
world-positioned and easier to expose accessibly; Rive text is more compelling
for a speech bubble or animated station sign contained entirely inside a Rive
artboard. [Rive: React Native ref methods](https://rive.app/docs/runtimes/react-native/rive-ref-methods),
[Rive: data-binding migration](https://rive.app/docs/editor/data-binding/migration-guide)

The installed native runtime can supply referenced PNG/JPEG/WebP assets when a
file initializes, from a JavaScript asset, URI, or native bundle. That matches
Oink's current `pig_skin` remount strategy. True per-instance live image
replacement is the data-binding-image path; it is available in the official web
runtime and in the new React Native runtime, but not exposed by Oink's installed
legacy type surface. [Rive: React Native asset loading](https://rive.app/docs/runtimes/react-native/loading-assets),
[Rive: web data-binding images](https://rive.app/docs/runtimes/web/data-binding)

For the first Lounge experiment, embed or reference the six prepared pig coats
and select known cosmetics with primitive selectors. Do not make remote profile
images or arbitrary bitmap hats a dependency of the spike.

### Loading, reuse, and caching

Native Rive contains custom code and cannot run in Expo Go; it requires a
development build. Updating a Metro-loaded `.riv` asset does not require a new
native build once the runtime is present. [Rive: adding Rive to Expo](https://rive.app/docs/runtimes/react-native/adding-rive-to-expo),
[Rive: loading React Native files](https://rive.app/docs/runtimes/react-native/loading-rive-files)

On web, a parsed `RiveFile` can be loaded once and shared across multiple Rive
instances, avoiding repeat fetch/parse work. The React `useRiveFile` hook owns
cleanup on unmount or source change. The WASM `RuntimeLoader` is a singleton
that manages the WASM binary across instances. [Rive: caching a web Rive file](https://rive.app/docs/runtimes/web/caching-a-rive-file),
[Rive React parameters](https://rive.app/docs/runtimes/react/parameters-and-return-values),
[Rive web parameters](https://rive.app/docs/runtimes/web/rive-parameters)

For a twelve-pig web room, do not create twelve unrelated file loads. Share one
parsed file. If using WebGL2, Rive warns that browsers cap concurrent WebGL
contexts and recommends `useOffscreenRenderer: true` when many Rive instances
are active. This must still pass a real 12-peer performance/thermal test; it is
not evidence that replacing Oink's single Skia world canvas will be cheaper.
[Rive: Canvas vs WebGL2](https://rive.app/docs/runtimes/web/canvas-vs-webgl)

## Experiment feasibility matrix

| Experiment | What Rive owns | Current native (Expo 52) | Web app | Recommendation |
|---|---|---:|---:|---|
| **Pig-close tickle** | Near-friend anticipation, inward turn, mutual tickle one-shot, heart burst | High after custom `.riv` export | High with official React web adapter | **First spike.** Supabase owns offer/accept; no currency mint. |
| **Proximity personality** | Idle changes when a pig is alone, near one friend, or inside a 3+ pig cluster | High | High | Cheap and ambient. Update only on threshold crossings. |
| **Emote echo** | Receiver reacts differently to heart, party, coffee, or zzz | High | High | Reuse existing `sendEmote`; add local trigger mapping. |
| **Synchronized greeting** | Wave, hoof-bump, nose-boop, or spin played on both pigs | Medium-high | High | Needs offer/accept and a shared start beat; tolerate loose synchronization first. |
| **Animated seesaw/station** | Occupancy state, anticipation, deterministic two-rider motion, completion cue | High | High | Good second spike; current Skia station registry stays authoritative. |
| **Three-pig “snort chorus”** | Layered reaction based on cluster size and emote sequence | Medium | Medium-high | Delightful, but requires clear cooldowns so the room does not become visual noise. |
| **Animated station sign/name bubble** | Bound text, reveal/typing motion | Medium-high | High | Technically easy; keep usernames outside Rive unless the animation materially benefits. |
| **Live arbitrary skins/profile images** | Per-instance image property | Low on legacy; remount/referenced-asset workaround only | High | Defer native parity until Expo/runtime upgrade. Known embedded coats are fine now. |
| **All 12 pigs rendered as separate Rive views** | Every avatar's continuous locomotion/reactions | Medium-risk | Medium-risk | Performance spike only. Keep Skia sprites as the safe world renderer. |
| **Whole Lounge scene in one Rive file** | World, peers, stations, UI, lists | Low today | Medium with advanced lists/artboards | Not recommended for v1; it collapses networking, world simulation, and art into one deep dependency. |
| **Spendable tickle reward for proximity** | Celebration only; server must own reward | Technically possible, product risk high | Same | **Do not ship from the members-only Lounge.** It is a paid advantage faucet unless the product rules change. |

## Recommended vertical slice

1. Export one Lounge-specific `.riv` with one pig artboard, two coats, and
   `idle`, `walk`, `near_friend`, and `close_tickle` states. Reuse the existing
   homepage skeleton only if the ¾ Lounge silhouette survives the camera shift;
   otherwise keep a separate Lounge artboard and preserve the same app-facing
   contract names.
2. Add a development web adapter with `@rive-app/react-webgl2` and use the same
   `.riv` file/input contract as native. This enables browser iteration without
   pretending `rive-react-native` renders on web.
3. In a fixture room, show the local pig and one practice peer. Derive
   `near_friend` from the existing interpolated positions. Do not add Supabase
   writes yet.
4. Add offer/accept as a one-shot Lounge Broadcast event with an expiry and
   pair identifier. On acceptance, both clients fire `close_tickle`; keep the
   existing sprite reaction as fallback.
5. Test 1, 2, 6, and 12 visible peers on web and two physical iPhones. Record
   frame time, memory, touch latency, background/reconnect recovery, and Reduce
   Motion behavior.
6. Only after the motion earns its place, decide whether the outcome is a
   social-only keepsake, an existing guestbook-style record, or no persistence
   at all. Do not couple the animation spike to a database migration or reward
   faucet.

### Go/no-go gate

Proceed beyond the spike only if the Pig-close tickle reads instantly without
instruction, two clients recover cleanly from rejection/disconnect, twelve
visible peers stay within the Lounge's frame budget, the web and native
adapters honor the same contract, and the Rive version looks materially better
than the existing sprite/Skia reaction. Otherwise, keep Rive for stations or
full-screen social celebrations and leave locomotion in the current renderer.
