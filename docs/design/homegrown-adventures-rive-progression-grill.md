# Homegrown Adventures — Rive progression outline and grill setup

Status: shared understanding confirmed. The complete 11-screen candidate set is ready for review before browser implementation.

## Player promise

The player cares for Rosie at Home, uses acquired farming supplies to grow something with a purpose, packs a useful harvest for an Adventure, sends Rosie beyond the hedge, and welcomes her back with new Seeds, soil care, Materials, and one meaningful Discovery that can enrich the Barn.

The first complete loop should feel like one causal story:

> Adventure supplies → farming → useful harvest → Adventure preparation → exploration → new supplies and Discovery → a changed Home

## Visual references

The current screen-direction candidates are the eleven images in:

`assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/`

The screen-by-screen intent and React/Rive reading are indexed in:

`assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/README.md`

The earlier six-screen correction candidates remain in `rosie-v2/` as a comparison checkpoint.

Rosie's canonical identity references are:

- `assets/images/pigs/masters/rosie-v2.png`
- `assets/images/pigs/normalized/rosie.png`

These lock Rosie's quadruped silhouette, face, proportions, ears, hooves, tail, line quality, and soft cel-painted rendering language.

## Ownership boundary

### React/game state owns

- progression and transition rules;
- growth and Adventure timers;
- Home-held Seeds, soil care, Materials, and harvested Provisions;
- bag contents and equipment choices;
- reward selection and ownership;
- persistence and new-day state;
- copy, buttons, accessibility, focus, and touch targets;
- reduced-motion preference.

### Rive owns

- Rosie's rig, expressions, poses, and one-shot reactions;
- attached satchel and equipment registration;
- plant, growth, ready, sway, and harvest motion;
- bag opening, item placement, closing, and settle;
- departure, walk, gate, moth trail, return, and discovery performance;
- Glowroot, Moonberries, Hedge Bell, gate, frog, hedgehog, and moth motion;
- persisted visual poses selected by React after reload;
- reduced-motion visual alternatives.

### Static scene artwork owns

- the detailed Barn, sky, hills, path, tree, grass, fence, and authored soil beds;
- the fixed 390×844 composition beneath the transparent Rive overlay.

Rive must not own game logic, rewards, timers, save data, or UI text.

## End-to-end progression

| Checkpoint | Player action | State change | Rive performance | Persistent result |
| --- | --- | --- | --- | --- |
| 1. Morning promise | Tickle Rosie | Rosie becomes attentive; purpose is revealed | breathing → anticipation → squash/bounce → happy settle | affection resource increments |
| 2. Purposeful growth | Plant Starter Clover Seed | one Seed is consumed; bed one becomes planted, growing, then ready | soil lift, staggered sprouts, calm leaf sway, ready flourish | ripe Clover waits safely |
| 3. Harvest | Harvest Clover | the crop becomes a usable Adventure Provision | crop lift, leaf burst, basket response, resting bed | Clover Lunch is owned |
| 4. Preparation | Pack Rosie's Bag | one Provision, one Tool, and one Pack become the active preparation | bag opens, selected items settle into physical slots, flap closes, Rosie reacts | preparation is fixed for this Adventure |
| 5. Departure | Send Rosie | Adventure starts and Rosie leaves Home | walk cycle, satchel bob, gate swing, moth trail, Rosie exits/holds offscreen | Adventure timer is reducer-owned |
| 6. Welcome Home | Welcome Rosie | Adventure resolves with farm supplies and one named Discovery | Rosie returns, bag swings, bag opens, Glowroot light reveals the seed and soil-care bundle | Glowroot Seed and Compost enter Home stock |
| 7. Home remembers | Plant Glowroot | one Glowroot Seed is consumed; optional soil care modifies the grow | seed sinks, Glowroot grows, bell rings, crossing opens, visitors appear | changes survive reload and future days |
| 8. New day | Begin Another Day | temporary loop state resets | short sunrise/settle; Rosie returns to calm idle | discoveries and Home changes remain |

## Existing Rive foundation

The current `homegrown-adventures.riv` already includes:

- Rosie breathing, tickle, notice, pack, return, and bag-hidden clips;
- Clover empty, growing, ready, plant, flourish, and harvest clips;
- hidden/developed Home poses and Glowroot flourish;
- Moonberry empty, growing, and plant clips;
- moth hidden, present, arrive, rest, and laugh clips;
- reducer-driven data binding for beds, satchel, residents, crossing, bell, moths, and reduced motion.

Existing contract:

`assets/rive/homegrown-adventures/contract.json`

Existing React/Rive boundary:

`components/prototypes/homegrown-adventures/HomegrownRiveScene.web.tsx`

## Required Rive additions

### Rosie identity gate

- Replace or verify the active rig texture against canonical Rosie before adding motion.
- Reject any bipedal stance, floppy-ear drift, snout distortion, sliding feet, or satchel registration error.
- Test every extreme pose at 1× and 2× device scale.

### New state and trigger candidates

Names are provisional until the grill is complete:

- trigger: `depart`
- trigger: `bagOpen`
- trigger: `seedReveal`
- trigger: `newDay`
- boolean: `rosieAway`
- enum: `bagState = closed | open | packed`
- boolean: `glowrootSeedVisible`

### New authored clips

- `Rosie Walk`
- `Rosie Depart`
- `Rosie Away`
- `Adventure Gate Open`
- `Adventure Moth Trail`
- `Rosie Bag Open`
- `Bag Item Clover`
- `Bag Item Tool`
- `Bag Item Pack`
- `Glowroot Seed Reveal`
- `New Day Settle`

Only add a property when React needs to select a persistent pose. One-shot flourishes should remain triggers.

## Implementation checkpoints

### Checkpoint A — Rosie fidelity

Import the correct Rosie texture/parts, repair the shared rig if needed, and validate breathing plus tickle without changing gameplay.

Quality gate: side-by-side comparison against the canonical Rosie image at neutral pose and every animation extreme.

### Checkpoint B — crop loop

Align Clover assets to the corrected concept, then validate plant → grow → ready → harvest in the real rendered game.

Quality gate: the crop grows out of the authored bed without a pasted dirt rectangle; reload and reduced motion select correct poses.

### Checkpoint C — bag preparation

Add the in-world Bag state with one Provision, one Tool, and one Pack. Farm supplies remain in a separate Home stock surface. Keep interactive text and hit targets in React.

Quality gate: the player can understand the loadout without opening a full-screen inventory, and every attachment stays registered.

### Checkpoint D — departure and return

Add walk/departure, gate, moth trail, away pose, return, bag opening, and seed reveal.

Quality gate: departure and return clearly communicate elapsed Adventure state without Rive owning the timer.

### Checkpoint E — Home remembers

Polish Glowroot growth, Moonberries, bell, crossing, frog, hedgehog, moths, and new-day settle against the corrected developed-Barn reference.

Quality gate: the same Barn composition is visibly richer without becoming busier or harder to read.

### Checkpoint F — complete integration

Play the complete loop at the intended prototype duration, reload at every persisted state, test rapid inputs, and verify reduced motion.

Quality gate: one clear action at a time, no broken poses, no canvas/UI hit-target conflict, no console errors, and no state owned exclusively by animation playback.

## Motion rules

- Use transforms, bones, meshes, opacity, and small shape deformations—not full-screen frame animation.
- Every one-shot settles into a reducer-selected static pose.
- Ambient loops remain low amplitude and staggered.
- Rapid tickles may restart safely; other one-shots queue or crossfade once.
- Reduced motion stops ambient loops and replaces one-shots with a 100–180ms pose or opacity change.
- The full-screen generated concepts are references, not bitmap frames imported wholesale into Rive.

## Explicit no-go boundaries

- Rive does not calculate loot, mission outcomes, or time passage.
- Rive does not store progression.
- Do not embed objective copy or action buttons inside Rive.
- Do not turn the Bag into the player's farming inventory or add a dense inventory grid for the first loop.
- Do not add combat, failure punishment, currencies, or parallel farm systems.
- Do not expand to multiple Adventure destinations before the first loop is delightful.

## Grill order

The decisions must be resolved one at a time in this dependency order:

1. Prototype navigation: fast-forward between stable progression positions.
2. Adventure presentation: one short beyond-the-hedge vignette, then return to the waiting Barn.
3. Farming inputs: which are required and which are optional improvements.
4. First preparation: guided items or immediate player choice.
5. First return: deterministic Glowroot or randomized discovery.
6. Permanence: exactly what survives `Begin Another Day`.
7. Interaction tone: primarily tap, tickle, or light drag gestures.
8. Initial shipping surface: browser prototype only or simultaneous Expo integration.

Each question should include a recommendation. Implementation begins only after all seven branches are resolved and the user confirms shared understanding.

## Resolved grill decisions

### 1. Prototype navigation

Decision: the prototype can fast-forward between stable progression positions.

Implementation meaning:

- Provide a prototype-only `Previous position` / `Next position` control outside the player-facing game surface.
- Each position is a valid reducer state, never an animation-owned fake state.
- Moving forward still plays the relevant short transition: plant, ready flourish, harvest, pack, depart, return, seed reveal, or Home flourish.
- Moving backward selects the correct stable pose without attempting to reverse one-shot animation playback.
- Fast-forward never changes the intended production duration of crops or Adventures.
- Reloading a selected position restores the same stable visual state.

This lets the prototype evaluate the full progression and every Rive handoff without waiting through production-scale idle timers.

## Active grill question

### Final confirmation

Does this document capture the intended game well enough to begin the browser implementation?

## Harvest Rhythm concepts

### A. Pull on the beat

The Crop compresses while the player holds. A single upward swipe timed to the release pulse pulls the Harvest free.

- Best for roots and long-growing Crops.
- Strongest sense of momentum.
- Too small by itself to feel like DDR.

### B. Three-beat sweep — recommended

Three broad directional cues appear around the bed. The player swipes through them in rhythm, such as left → right → up. Each hit bends the Crop in that direction; the final swipe releases the Harvest.

- Roughly 1.5–2.5 seconds.
- Broad timing windows rather than precision rhythm-game difficulty.
- Crop-specific direction patterns and tempos create variety.
- Short enough to repeat across several beds without fatigue.

### C. Alternating momentum chain

The player alternates left/right swipes to build momentum, then finishes upward when the Crop glows.

- Most physical and energetic.
- Risks becoming repetitive or uncomfortable when harvesting stockpiles.
- Better reserved for an occasional giant Crop or special Harvest.

### Recommended crop signatures

- Clover: left → right → up; quick, light gather-and-lift.
- Moonberries: down-left → down-right → up; medium tempo, brush both clusters inward and lift the gathered berries.
- Glowroot: short down swipe → hold → long upward pull; slow, weighty anticipation followed by a warm release.
- Large or rare Crops: a short alternating chain followed by one finishing direction.

### First crop pattern sheet

| Crop | Gesture phrase | Cue spacing | Momentum | Rive response | Bonus read |
| --- | --- | ---: | --- | --- | --- |
| Clover | left → right → up | 500ms | light, quick swipes | leaves lean left/right; final bundle pops into basket | one extra Clover bundle |
| Moonberries | down-left → down-right → up | 620ms | medium diagonal sweeps | each side releases berries inward; final cluster lifts and settles | one extra berry cluster |
| Glowroot | short down → 450ms hold → long up | 700ms | slow press, strong upward finish | soil compresses, root glow builds, golden leaves release on pull | one extra Glowroot cutting |

All timing windows begin broad. The personal identity comes from direction, tempo, weight, sound, and plant response—not punitive precision.

### Runtime boundary

React owns pointer capture, swipe direction, velocity, timing windows, score, accessibility fallback, and awarded quantity.

Rive receives presentation facts and one-shots such as:

- `harvestCueDirection`
- `harvestHit`
- `harvestMiss`
- `harvestFinish`
- `harvestPerfect`

Rive animates Crop lean, squash, leaf or berry release, basket reaction, particles, Rosie response, and return to the reducer-selected bed pose. Rive never calculates whether a swipe counts.

### Safety and accessibility

- A ready Crop never spoils while the rhythm phrase is open.
- Missing a beat never destroys the Crop or produces zero yield.
- Reduce-motion mode replaces large bends and particles with short pose changes.
- An accessible non-swipe action must remain available.
- Prototype fast-forward lands on the same ready state and can replay the phrase repeatedly without granting duplicate output.

## Resolved Harvest Rhythm reward

Decision: Harvest Rhythm is optional and awards a small bonus.

Implementation meaning:

- Every ready Crop has a guaranteed base yield.
- Completing the phrase successfully adds a small deterministic amount of the same harvested output.
- Missing cues never removes base yield, damages the Crop, or creates a failure state.
- The first prototype uses a simple integer bonus, not percentages or a random reward table.
- Rive communicates performance quality; React awards the quantity exactly once.

## Resolved personal Crop patterns

Decision: every Crop has its own Harvest Rhythm pattern.

Implementation meaning:

- Crop data owns a short cue sequence, cue spacing, minimum momentum, broad timing window, sound family, and Rive response mapping.
- Every pattern is built from a shared vocabulary: horizontal swipe, diagonal sweep, vertical pull, and short hold.
- The first hand-authored patterns are Clover, Moonberries, and Glowroot; do not bulk-generate more until these establish the feel.
- Pattern identity remains stable so players can learn a Crop by feel.
- Accessible harvest uses the same guaranteed base yield and bypasses the rhythm bonus interaction cleanly.

## Resolved Harvest Rhythm difficulty

Decision: long-growing Crops do not have harder timing windows.

Implementation meaning:

- Crop weight is communicated through slower cue spacing, longer anticipation, sound, and stronger Rive deformation.
- Timing tolerance remains broad across Crop durations.
- Waiting longer never creates a more punitive Harvest.
- Difficulty, if introduced later, comes from optional mastery goals rather than reducing guaranteed yield.

## Resolved initial shipping surface

Decision: build and validate the browser prototype first.

Implementation meaning:

- Extend the existing Homegrown Adventures browser experiment rather than modifying Expo in parallel.
- Use prototype-only Previous/Next position controls to inspect every stable state and transition.
- Validate the real Rive-rendered loop, swipe input, persistence, reduced motion, and responsive layout in the browser.
- Keep the reducer, Crop definitions, outcome table, and Rive contract portable so the proven slice can move into Expo afterward.
- Browser completion does not imply an iOS build, release, database migration, or production deployment.

## Agreed product setup

- The loop is Adventure supplies → farming → useful Harvest → freely chosen preparation → Adventure → new supplies and Discovery → a changed Home.
- Seeds are required to plant; Compost is optional and both shortens growth time and increases yield.
- Crops have different growth durations, persist across days, never spoil, and build Farm stock through repeated Harvests.
- Rosie's Bag has up to one freely chosen Provision, Tool, and Pack; any slot may be empty.
- Empty or unusual preparation creates a kind, specific Near-Discovery rather than failure.
- Prototype Adventure outcomes are deterministic and preparation-driven.
- The prototype can fast-forward between valid stable positions while still playing Rive transitions.
- One short beyond-the-hedge vignette shows how preparation affected the Adventure.
- Every Crop has a personal Harvest Rhythm built from a small shared swipe vocabulary.
- Base yield is guaranteed; a successful rhythm adds a small deterministic bonus.
- Long-growing Crops feel slower and heavier but never use tighter timing windows.
- Rive owns visual performance; React owns state, timers, input evaluation, rewards, persistence, text, and accessibility.
- The first complete implementation and validation target is the browser prototype.

## Provisional resource model

- **Farm stock** is kept at Home and is separate from Rosie's Bag.
- **Seeds** are acquired, stored by crop type, and consumed when planting.
- **Compost** is the cozy working name for fertilizer or soil care; its required/optional role is the active decision.
- **Materials** return from Adventures and are spent on lasting farm, Tool, or Pack improvements rather than routine planting.
- **Harvests** become Provisions, ingredients, or crafting inputs with explicit uses.
- The **Bag** retains the existing domain shape: one useful Provision, one reusable Tool that gives Rosie a verb, and one reusable Pack that changes what she can carry or preserve.
- A headline **Find** remains a named story or Discovery. Seeds, Compost, and Materials support the loop but do not replace the emotional return payoff.

## Resolved farming-input rule

Decision: Seeds are required to plant; Compost is an optional boost and never blocks farming.

Implementation meaning:

- Planting always consumes exactly one crop-specific Seed.
- A bed can be planted without Compost whenever a Seed is available.
- Compost is chosen before planting and consumed only when applied.
- The bed and harvest must visually communicate that Compost had an effect.
- Prototype fast-forward preserves whether Compost was applied when jumping between positions.

## Resolved Compost effect

Decision: Compost both shortens growth time and produces a larger harvest.

Implementation meaning:

- The reducer records `compostApplied` when planting and derives both effects from that single fact.
- Growth completes sooner without Rive owning or calculating the timer.
- The growing and ready poses use visibly fuller crop clusters when Compost was applied.
- The harvest returns a larger quantity of the same output; Compost does not create a separate random reward table.
- Fast-forward jumps to the correct normal or composted stable pose before playing the relevant transition.

## Resolved preparation choice

Decision: the player freely chooses each Adventure's Provision, Tool, and Pack from their acquired collection.

Implementation meaning:

- The game never auto-fills or prescribes a best loadout.
- The Bag shows three small typed slots rather than a general inventory grid.
- Each available item explains one concrete verb or consequence in plain language.
- New Seeds and Materials expand farming outputs, Tools, and Packs over time, which expands future preparation choices.
- The prototype must include at least two meaningfully different choices somewhere in the Bag so free choice is testable rather than cosmetic.

## Resolved empty-slot behavior

Decision: Rosie may leave with any Provision, Tool, or Pack slot empty.

Implementation meaning:

- `Send Rosie` remains available for every valid combination, including an empty Bag.
- Empty preparation changes the vignette, return story, and available Find; it never produces punishment or an empty failure screen.
- A missing capability produces a specific Near-Discovery explaining what could have changed the encounter.
- Rive selects the appropriate equipped/empty Bag pose from reducer state.
- Prototype fast-forward can replay every empty-slot branch without mutating inventory.

## Resolved Adventure outcome rule

Decision: the prototype's Adventure outcomes are deterministic and preparation-driven.

Implementation meaning:

- Destination, Provision, Tool, Pack, and Intention resolve through an explicit outcome table.
- The same inputs always produce the same Discovery or Near-Discovery in the prototype.
- Every returned story can name which preparation changed the encounter.
- Randomness may be introduced later only within the eligible outcomes created by that preparation.
- Prototype fast-forward replays the selected branch without rerolling it.

## Resolved crop persistence and stockpiling

Decision: Crops have crop-specific growth durations and harvest outputs. Planted Crops persist across days, harvested outputs accumulate in Farm stock, and repeated farming intentionally builds useful stockpiles.

Implementation meaning:

- Each crop definition includes `growthDuration`, `baseYield`, visual stage assets, harvested item, and plain-language use.
- Short Crops support frequent sessions; long Crops support anticipation and valuable planning.
- Compost applies the already-resolved shorter-duration and larger-yield modifiers to either type.
- A ready Crop remains in its authored Rive pose until the reducer receives `harvest`.
- Harvest adds crop-specific quantity to Farm stock and returns only that bed to empty.
- `Begin Another Day` never clears planted beds, ready beds, or Farm stock.
- Prototype fast-forward can jump each bed independently through planted, growing, and ready positions without granting duplicate output.

## Resolved ready-Crop rule

Decision: ready Crops never spoil, expire, wither, or lose yield.

Implementation meaning:

- A ready bed is a stable persisted state with no expiration timestamp.
- Returning after any absence shows the same ready Crop and full harvest.
- Rive may play a calm ready idle but never an urgent pulse or decay animation.
- Notifications may announce readiness but never imply a deadline.

## Resolved adventure presentation

Decision: show one brief beyond-the-hedge vignette featuring Rosie and the packed items, then return to the quiet Barn waiting state.

Implementation meaning:

- The vignette is a bounded Rive artboard/state, not a second explorable map.
- It shows how at least one packed item helps Rosie encounter the discovery clue.
- The vignette plays quickly when using prototype fast-forward.
- The reducer continues to own Adventure completion and reward outcome.
- The quiet Barn waiting state remains available for testing real idle behavior.
