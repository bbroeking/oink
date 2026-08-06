# Tickle the Pig: Homegrown Adventures — build goals

**Status:** Browser gameplay prototype implemented; Dusk Moths Arrive checkpoint shipped to the browser lab

**Implementation record (August 5, 2026):** The deterministic prototype, three
shareable UI variants, approved concepts, anonymous trace, local persistence,
responsive DOM controls, and GitHub Pages route live in
`scripts/prototypes/homegrown-adventures/` and `docs/homegrown-adventures.html`.
The authored Rive scene is checked in: a transparent 390×844 artboard, embedded
Rosie texture, mesh/bone rig, exact View Model contract, and named breathing,
tickle, notice, pack, return, and Bag-hidden motions. The tan clover satchel is
a native vector group registered to Rosie's body with offset-preserving
translation, rotation, and scale constraints. Kitchen Patch bed one now has a
native crop rig with reducer-bound empty, growing, and ready poses plus plant,
flourish, and harvest one-shots.
The same artboard now includes a native Home consequence rig with persisted
hidden/developed poses and a Glowroot flourish for the planted third bed,
flowering hedge crossing, and earned Hedge Bell.
Character-free derivatives of the three approved concepts remain the scene
plates so the Rive rig is the only Rosie rendered. Breathing uses a calm
3.25-second cadence; the first meaningful tickle transitions into a clear
Kitchen Patch notice lean. Packing visibly equips the persisted Bag, return
emphasizes it once, the first Clover Lunch loop changes one bed, and planting
Glowroot reveals a lasting Home change without replacing the whole Barn plate.
Rapid input, deterministic settling, reduced motion, the real rendered route,
and the contract gate pass locally. Rosie's harvest celebration, resident
animation, purpose-sign continuity, and mobile Safari device acceptance remain
Goal 6 work; do not claim the whole motion sheet complete yet. Rosie's return
now borrows the larger story treatment for one brief ceremony only, then
collapses into an optional Home record that leaves Rosie and all three beds
readable. Developed reloads begin compact and reduced motion skips the ceremony.
The post-return illustrated sign is now covered by reducer-driven DOM text:
Glowroot Seed on return, Moonberries as the next named purpose, and a persisted
chosen state. This keeps product text accessible and out of the Rive binary.
Choosing that second intention now fills Kitchen Patch bed two with an authored
purple Moonberry crop. Empty and Growing are persisted Rive poses and Plant is
one bounded arrival; the reducer remains authoritative and no second timer or
economy was introduced.

**Rive handoff record:** The browser build detects
`assets/rive/homegrown-adventures/homegrown-adventures.riv` automatically and
switches its single stable canvas from the official probe to that authored
scene. Reducer facts are mapped into the exact Data Binding contract in
`assets/rive/homegrown-adventures/contract.json`. Authoring names, rig layers,
timings, reduced-motion behavior, visual references, export steps, and manual
quality gates are locked in `docs/rive-homegrown-adventures-authoring.md`.
The editable Rive source export is retained under
`assets/rive/homegrown-adventures/source/`; the deterministic metadata patcher
produces the runtime file and `npm run verify:rive-homegrown` gates its contract.
The browser build publishes the binary behind a content-hashed URL so a new
checkpoint cannot be hidden by a stale cached `.riv` response.

**Purpose:** Turn the FarmVille-inspired direction into one focused, testable
web slice inside Tickle the Pig's existing Barn. This document defines outcomes
and acceptance criteria. It does not authorize a production database push,
distributable build, or replacement of the shipped Barn.

## Required context before building

The builder must read these sources in order:

1. This document.
2. `PRODUCT.md` and the domain terms in `CONTEXT.md`.
3. `docs/research/farmville-loop-tickle-the-pig-2026.md`.
4. `docs/beyond-the-hedge-design.md`.
5. `docs/rive-pig-rigging.md` and
   `docs/design/rive-homepage-implementation-plan-2026-07.md`.
6. All three concept images below at full size.

The images are required visual context, not optional inspiration. They establish
the fixed portrait camera, Rosie's relative scale, the three-bed Kitchen Patch,
the warm paper-cut visual language, the Barn/Friends/Season/Shop/Me navigation,
and the amount of change Home should show over time.

### State 1 — starting Barn

![Starting Barn](../assets/concepts/homegrown-adventures/01-starting-barn.png)

Absolute path:
`/Users/bbroeking/projects/oink/assets/concepts/homegrown-adventures/01-starting-barn.png`

### State 2 — first completed loop

![First farming payoff](../assets/concepts/homegrown-adventures/02-first-payoff.png)

Absolute path:
`/Users/bbroeking/projects/oink/assets/concepts/homegrown-adventures/02-first-payoff.png`

### State 3 — developed Barn

![Developed Barn](../assets/concepts/homegrown-adventures/03-developed-barn.png)

Absolute path:
`/Users/bbroeking/projects/oink/assets/concepts/homegrown-adventures/03-developed-barn.png`

The earlier images under `assets/concepts/rosies-little-farm/` are superseded.
They incorrectly separated Farm, Home, and Adventure into navigation tabs. Do
not use that navigation model.

The generated images are direction, not pixel-perfect production layouts. Fix
AI-rendered typography, counter shapes, accessibility, and spacing in code.
When an image conflicts with the behavioral rules below, the behavioral rules
win.

Variant A, **Rosie First**, is canonical. Variant C's larger story treatment is
allowed only as a brief welcome-home ceremony; it must collapse automatically
or when Rosie is tickled. Persisted and developed states use a compact,
player-expandable Home record and must not obscure Rosie or the earned crop.

## Filled game brief

**Idea:** Care for Rosie on a living little farm where every tickle wakes Home,
every harvest has a purpose, and every idle Adventure returns something that
permanently changes the Barn.

**Player fantasy:** I am Rosie's caretaker and Adventure partner. I grow what
she needs, help creatures and friends, prepare her journeys, and turn an
ordinary farm into a place filled with discoveries.

**Core action:** Tickle Rosie and immediately see her—and the farm—respond.
Rosie reacts, the existing tickle counters change, and she draws attention to
what happened while I was away.

**Vibe:** Warm hand-drawn paper craft, expressive character animation, gentle
acoustic and farm sounds, satisfying harvest pops, and unhurried check-ins from
thirty seconds to five minutes. Nothing is harmed by absence.

**References:** FarmVille's anticipation, visible growth, and neighbor
reciprocity; FarmVille 2: Country Escape's farm-to-expedition relationship;
Cats & Soup's affection for a central character; Animal Crossing's personal,
visitable Home; and Beyond the Hedge's named Discoveries.

**Avoid:** Withering, giant crop grids, selling everything for coins, anonymous
order-board churn, energy meters, percentage upgrades, rarity ladders,
pay-to-win, notification pressure, generic glossy 3D, combat, or a farming game
disconnected from tickling Rosie.

**Target:** Touch-first portrait web prototype at a 390×844 design viewport,
implemented so its state model and assets can later inform the Expo/iOS app.

## Parent outcome

Build one shareable browser slice in which a player can:

1. Arrive at the existing Barn and tickle Rosie.
2. See the real TTP tickle counters react and the farm wake up.
3. Grow Clover Lunch for a named purpose.
4. Return after kind idle progress, welcome Rosie, and harvest it.
5. Pack Clover Lunch for a Dusk Picnic Adventure.
6. Welcome Rosie Home with a named Glowroot Seed Discovery.
7. Plant Glowroot and see a lasting change in the same Barn scene.

The slice succeeds when a fresh player can explain the loop as:

> Tickle Rosie, grow something for a reason, use it on an Adventure, and bring
> Home something that changes the farm.

## Goal 1 — make the farm part of the existing Barn

The farm is the Barn Exterior, not a separate mode.

### Required

- Preserve the existing bottom navigation: Barn, Friends, Season, Shop, Me.
- Keep Barn selected throughout the prototype.
- Keep Rosie as the largest and most inviting touch target.
- Use one fixed portrait camera and one persistent scene across all states.
- Start with one Kitchen Patch containing exactly three beds.
- Let the hedge path and Rosie's Bag open the Adventure flow contextually.
- Never introduce Farm, Home, or Adventure as new top-level tabs.

### Done when

A tester can move from tickle to planting to Adventure and back without feeling
that they entered a separate game.

## Goal 2 — preserve tickling as the emotional heartbeat

Tickling remains an existing TTP action, not farm stamina.

### Required

- Tapping Rosie produces immediate visual, audio, and haptic-style web feedback.
- The prototype demonstrates `Ready to Tickle` decreasing and `Tickles Earned`
  increasing.
- The first tickle after a meaningful return reveals what changed: a ripe crop,
  visitor, route, or Discovery.
- Mood may change Rosie's pose and the scene's emotional tone, but never crop
  yield or Adventure quality.
- Tickles must not be spent to water crops, accelerate timers, or multiply
  harvests.

### Done when

The first tap feels good before the player understands farming, and players
still describe the central action as tickling Rosie.

## Goal 3 — build a tiny purpose-driven farming loop

Farming creates intentions, not a second currency economy.

### Required

- Provide three prototype crops with different plain-language jobs:
  - Clover Lunch: an Adventure provision.
  - Moonberries: a creature gift or dusk lure.
  - Glowroot: an Adventure-return seed that visibly changes Home.
- Ask what the player is growing **for** before asking what they want to plant.
- Use named Requests from a creature or place instead of anonymous orders.
- Let crops grow safely while away and wait indefinitely when ripe.
- Use harvests for Adventures, creatures, friends, or restoration.
- Do not add crop selling, farm coins, inventory pressure, or multi-building
  crafting queues to the slice.

### Done when

After harvesting, the player can say what the crop is for and chooses the next
planting for a reason other than value or efficiency.

## Goal 4 — close the farm-to-Adventure-to-Home loop

Beyond the Hedge supplies surprise and new possibility; the farm supplies
preparation.

### Required

- Offer one Dusk Picnic Adventure from the hedge path.
- Pack Clover Lunch plus the existing Adventure concepts of Tool, Pack, and
  Intention, but keep the prototype decision surface small.
- Resolve the Adventure while away or through a development time-skip.
- Return one headline Discovery: Glowroot Seed.
- Explain in Rosie's return story how preparation mattered.
- Add the seed to the Field Guide/Discovery model and make it immediately
  plantable.
- Planting it must create a persistent visual consequence in the Barn.
- Treat insufficient preparation as a kind clue or Near-Discovery, never a
  failed mission.

### Done when

The player wants to send Rosie again because the world changed, not because a
reward number increased.

## Goal 5 — connect existing progression without creating power creep

The farm is connective tissue for TTP's current systems.

### Required prototype connections

- **Happiness/Mood:** changes Rosie's visible rest and reaction animation only.
- **Streak/Garden:** express consistency through the whole farm flourishing;
  do not add a competing numeric Garden meter.
- **Field Guide:** records crops, creatures, seeds, places, and named Finds.
- **Friends/Visits:** represent one optional, bounded Farm Favor in the developed
  state. It may water, share a seed, or help a named Request, but cannot create
  friend-count advantage.
- **Season:** leave a clean content hook for seasonal crops and visitors using
  the same verbs; do not build a separate event game.
- **Shop:** expression only. No crop speed, rare seeds, or Adventure advantage.
- **Wallow:** no farming-output multiplier.

### Deferred

Real friend mutation, Sounder restoration projects, production Field Guide
schema, seasonal catalogs, and backend settlement are outside this browser
slice. Represent only enough state to prove the product loop.

## Goal 6 — use Rive for clean web animation

Rive owns meaningful character and scene animation in the web prototype. Do
not claim this goal complete with CSS wiggles or a raster flipbook standing in
for the required motion.

### Runtime architecture

- Add the web-specific `@rive-app/react-webgl2` runtime in a `.web` boundary.
- Never import `rive-react-native` into a shared or web module.
- Preserve and extend `npm run verify:rive-web`: native Rive markers must remain
  absent from the Expo web bundle, while the approved web runtime is allowed.
- Isolate `useRive` inside a stable wrapper component so conditional React
  rendering does not orphan or restart a canvas.
- Give the Rive canvas an explicit responsive container and verify high-DPI
  resizing at the 390×844 reference viewport.
- Prefer one main Rive scene/canvas or a shared offscreen renderer over many
  independent WebGL contexts.
- Keep accessible counters, labels, buttons, focus order, and layout in DOM/
  React. Do not bake product text into the `.riv` file.
- Cover any stale concept-plate lettering with reducer-driven DOM text before
  it becomes player-visible; the visible purpose must agree with the current
  Request, Discovery, or next planting.

Rive currently recommends `@rive-app/react-webgl2` for React web and recommends
Data Binding for new state contracts. Use a View Model for this new web scene
rather than adding another collection of unrelated legacy inputs. Existing
native pig inputs may remain unchanged until a deliberate cross-platform
migration.

### Required Rive-owned motion

- Rosie: breathing idle, tickle anticipation/squash/bounce, happy settle,
  attention/point, harvest celebration, and satchel return.
- Kitchen Patch: sprout, gentle growing loop, ready flourish, and harvest pop.
- Home consequences: Hedge Bell ring, hedge crossing open, and Glowroot planting
  flourish.
- Ambient residents: restrained hedgehog, frog, and moth idle loops in the
  developed state.

### Suggested web View Model contract

- `rosieMood`: content, happy, sad.
- `rosieAction`: idle, tickle, notice, harvest, pack, return.
- `satchelEquipped`: boolean.
- `bedOneState`, `bedTwoState`, `bedThreeState`: empty, sprout, growing, ready.
- `hedgehogVisible`, `frogVisible`, `mothsVisible`: booleans.
- `hedgeCrossingOpen`, `hedgeBellEarned`: booleans.
- `reduceMotion`: boolean.
- Trigger properties for `tickle`, `harvest`, `pack`, `return`, and `plant`.

The game reducer is the source of truth. Rive visualizes state and may emit user
intent; it does not own timers, rewards, or persistence.

### Rive asset dependency

The repo does not currently contain an exported production `assets/rive/pig.riv`;
the existing Rive authoring notes record an editor/export gate. The builder must
produce and check in an exportable `.riv` source for this slice, or report the
Rive goal as blocked. A raster fallback may keep development usable, but it does
not satisfy this goal.

The required drop location is
`assets/rive/homegrown-adventures/homegrown-adventures.riv`. Follow
`docs/rive-homegrown-adventures-authoring.md`, then run
`npm run verify:rive-homegrown` and `npm run prototype:homegrown:build`. No
React or reducer changes should be needed after export.

### Animation quality gates

- Rosie preserves the approved silhouette throughout every extreme pose.
- No accessory, satchel, face, or held-item drift.
- One-shot animations settle cleanly into the correct idle state.
- Repeated rapid tickles do not overlap into broken poses.
- Ambient motion is subtle enough that the primary action remains legible.
- `prefers-reduced-motion` pauses ambient loops and replaces reactions with
  short, readable pose/opacity changes.
- The slice remains responsive on current mobile Safari and desktop Chrome.

## Goal 7 — implement a deterministic, testable prototype state model

Use a small pure reducer and local persistence before any backend work.

### Required states

1. Starting Barn.
2. Clover planted/growing.
3. Clover ready after simulated absence.
4. Clover Lunch packed.
5. Dusk Picnic underway/complete.
6. Rosie returned with Glowroot Seed.
7. Glowroot planted and developed Barn unlocked.

### Required controls

- Reset prototype.
- Development-only advance-time control.
- Reduced-motion toggle or OS preference simulation.
- Optional state selector for direct review of the three concept states.

### Verification

- Unit-test every reducer transition and invalid action.
- Verify refresh resumes the same local prototype state.
- Verify repeated settlement is idempotent.
- Verify the three concept states at 390px without horizontal overflow.
- Verify keyboard focus, touch targets, and screen-reader labels for all DOM
  controls.
- Verify no browser console errors through the complete loop.
- Run `npm run quality:loop` during player-facing work and
  `npm run quality:check` before handoff.

## Goal 8 — produce one shareable experiment and evidence loop

### Deliverable

- Host the experiment on Tickle the Pig's GitHub Pages site at a stable route,
  recommended: `https://bbroeking.github.io/oink/homegrown-adventures.html`.
- Keep `docs/idle-lab.html` intact as historical Beyond-the-Hedge evidence.
- Include a small developer-only trace that records tickle, planting, harvest,
  packing, return, and next-planting actions without personal information.

### Validation question

> After the first harvest and Adventure return, does the player understand what
> farming is for and immediately choose what to grow next?

### Pass signals

- The player tickles Rosie before interacting with a plot.
- The player connects Clover Lunch to the Dusk Picnic.
- The player remembers Glowroot Seed by name or unmistakable description.
- The player points to a lasting Barn change.
- The player chooses the next crop for an Adventure, creature, friend, or
  restoration purpose—not for price or efficiency.

## Recommended build order

1. Implement the pure reducer and static DOM/paper UI matching the three images.
2. Author and export the minimal Rive scene and lock its View Model contract.
3. Integrate the web-only Rive wrapper with a safe raster/static fallback.
4. Wire tickle, crop, return, and Home-change state transitions.
5. Add local persistence, time advance, reset, reduced motion, and tests.
6. Run layout/Rive/web quality gates and host the experiment.
7. Observe fresh players before expanding crops, destinations, social systems,
   or backend scope.

## Explicitly out of scope

- Production Supabase tables or migrations.
- Database pushes or server settlement.
- A distributable iOS/Android build.
- Replacing the shipped Barn or raster pig renderer.
- Full FarmVille-style economy, market, crafting buildings, or inventory.
- Full friend/Sounder/Season implementation.
- A second Adventure destination.
- Monetization.
- Full pig roster and cosmetic-catalog migration into Rive.

## Primary technical references

- [Rive React runtime](https://rive.app/docs/runtimes/react/react)
- [Rive WebGL2 guidance](https://rive.app/docs/runtimes/web/canvas-vs-webgl)
- [Rive Data Binding](https://rive.app/docs/runtimes/web/data-binding)
- [Rive state-machine playback](https://rive.app/docs/runtimes/web/state-machines)
- [Rive runtime best practices](https://rive.app/docs/getting-started/best-practices)
