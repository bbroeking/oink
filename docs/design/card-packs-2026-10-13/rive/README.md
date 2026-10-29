# Card pack reveal — editor-authored asset and local reference

## Current deliverable

The existing cloud **Card Packs** file now contains an editable
`CardPackReveal` implementation authored through the local Rive MCP. The exact
exports and integration contract are in `assets/rive/card-packs/`:

- `card-pack-reveal.riv` — runtime export
- `source/card-pack-reveal.rev` — editable backup
- `contract.json` — React Native/Rive interface
- `artwork-package.md` — five fixtures and three living-scene packages
- `cue-sheet.md` — host-owned audio/haptic timing

The RML material below is retained as an earlier offline reference. It is not
the current runtime asset.

This is an offline authoring spike guided by the `SeedPacket.dc.html` Claude Design canvas. It is review material, not production UI. The source uses documented RML only: no Luau, shader, network asset, account session, or editor export.

## Desktop editor continuation

The user selected local Rive MCP authoring. On 2026-10-13, a new [Card Packs editor file](https://editor.rive.app/file/card-packs/2651084) was created in **Tickle the Pig → Shared Project** (project ID `1739110`). The file is open in Rive Early Access and reachable through the local MCP at `http://127.0.0.1:9791/mcp`. It currently contains the new, empty `CardPackReveal` artboard at 390×844; the CLI prototype below has not yet been transferred into this editable file. Continue the existing Claude Design canvas and use this RML project as the verified motion/reference source. Do not mistake the editor scaffold for a completed animation or runtime export.

## Build and inspect

From the repository root, with the verified Rive CLI v1.5.1 used for this spike:

```bash
/private/tmp/ttp-rive-cli/rive docs/design/card-packs-2026-10-13/rive --verify
/private/tmp/ttp-rive-cli/rive docs/design/card-packs-2026-10-13/rive --once
/private/tmp/ttp-rive-cli/rive docs/design/card-packs-2026-10-13/rive
```

The saved output is `build/card-pack-reveal.riv`. The prototype runtime contract is:

- artboard: `CardPackReveal`
- state machine: `CardPackRevealMachine`
- view model: `CardPackRevealViewModel`, default instance `Default`
- prototype properties: number `tearProgress` (0–1), number `revealIndex` (0–4), boolean `reduceMotion`, number `tiltX` (-1–1), number `tiltY` (-1–1), triggers `open` and `reset`

`open` plays the lift, split-seam, and card rise. `revealIndex` selects exactly one of Firefly Swarm, Mud Shovel, Puddle Duckling, Mushroom Cap, and Moon Firefly in a separate state-machine layer. The preview-only NEXT control advances the index modulo five; RESET returns to the sealed animation. `reduceMotion=true` jumps to the settled card and suppresses the foil overlay. `tearProgress` directly separates the two authored top flaps, while `tiltX` rotates the card and `tiltY` sweeps the vector foil strip.

All five images are the existing full gallery fronts from `landing/cards/img/*.webp`, including their real title, rank, type, rules text, training, and frame. The Rive layer presents those fronts as still art; it does not recreate their metadata or claim character rigging. The pig stamp on the packet is deliberately schematic prototype geometry.

## What was tested locally

- `--verify --format=json`: zero errors and zero warnings.
- `rive inspect ... --json`: no unresolved references or data-binding problems after adding the artboard style.
- Offline `--once`: compiled the self-contained `.riv`.
- Headless 390×844 captures cover sealed, reveal, reduced motion, visible foil/tilt, one NEXT click, five rapid NEXT clicks wrapping to index zero, and RESET after opening and advancing twice.
- `interaction-next.png`, `interaction-rapid-wrap.png`, and `interaction-reset.png` were driven exclusively through `--pointer` events rather than initial data presets. `foil-tilt.png` combines pointer-open with host-fed tilt values.
- The corrected packet, full card fronts, on-card foil strip, next/wrap behavior, and reset result were visually inspected.

The CLI needed access to the host graphics context for screenshots; source verification and compilation did not.

## Native work still required

The Expo/React Native screen must own reduced-motion preference, pack inventory/result truth, tap/gesture policy, haptics/audio, accessibility labels, analytics, and the sequencing lock that prevents double-open. It should mount one active Rive renderer/card, set the named view-model properties, and fire `open`/`reset`. Device testing must confirm the installed native runtime imports this CLI-produced file, resolves view-model data binding and trigger listeners, preserves image quality/memory on representative iPhones, and hits the intended frame budget.

The vector strip demonstrates a low-cost holographic tilt illusion. It is not true 3D, perspective, or a production foil shader. Full-bleed animated art would multiply decode/upload and animation cost; keep the production version to one visible card and one renderer, and profile any animated card art on device before expanding it.

The current `tiltX` and `tiltY` are host-fed numbers. A production screen should derive them from a bounded drag or sensor policy and return both to zero on release. The Rive state machine should continue to own the visual response, while app code owns input permissions and lifecycle.
