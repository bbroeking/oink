# Homegrown Adventures — 11-screen browser flow

Status: screen-direction candidate for review before implementation.

This set expands the approved Homegrown Adventures idea into every stable position the browser prototype must be able to enter with its prototype-only Previous/Next controls. The images are screen-design references, not bitmap frames to import wholesale into the game.

Open `contact-sheet.png` for the whole loop at a glance, then inspect the numbered images for full-size UI and animation details.

## Screen map

| Position | Image | Player understands | Primary action | Rive focus |
| ---: | --- | --- | --- | --- |
| 1 | `01-morning-tickle.png` | Rosie wants attention and the day begins with affection. | Tickle Rosie | Rosie idle, anticipation, tickle reaction, happy settle |
| 2 | `02-farm-stock-seed-choice.png` | Seeds and Compost are acquired resources; the player chooses what to grow. | Choose Clover | Rosie notice, tray hover, seed-card selection |
| 3 | `03-plant-and-compost.png` | A Seed is required; Compost is an optional, predictable boost. | Plant with Compost | seed drop, compost dust, soil settle, Rosie response |
| 4 | `04-growing-fast-forward.png` | The Crop grows over time, persists safely, and can be inspected without waiting in the prototype. | Fast-forward / wait | staged sprouts, leaf sway, timer-state poses |
| 5 | `05-harvest-rhythm.png` | Harvest is guaranteed; following Clover's personal swipe phrase earns a small bonus. | left → right → up | cue pulse, Crop lean, final lift, leaf burst |
| 6 | `06-harvest-result-stock.png` | The Harvest becomes lasting Farm stock for future preparation. | Prepare an Adventure | basket settle, stock increment, Rosie celebration |
| 7 | `07-free-bag-selection.png` | The player freely chooses up to one Provision, Tool, and Pack; empty slots are allowed. | Pack these | bag open, item placement, attachment settle |
| 8 | `08-departure.png` | Rosie's selected loadout is visible and she is ready to explore. | Send Rosie | walk cycle, satchel bob, gate, dusk transition |
| 9 | `09-adventure-vignette.png` | Each packed item causes a specific part of the Discovery story. | Continue the story | trowel dig, Glowroot pulse, basket/fiber settle, leaves |
| 10 | `10-return-discovery.png` | Rosie returns with one named Discovery plus practical Farm supplies. | Welcome Rosie home | return, bag open, restrained seed reveal, reward settle |
| 11 | `11-changed-barn-next-day.png` | Crops, stock, Discoveries, and small Barn improvements persist into the next loop. | Begin another day | Glowroot sprout, visitors, pond, sunrise, Rosie idle |

## Locked loop

Tickle Rosie → choose a Seed → optionally add Compost → wait or prototype-fast-forward → perform the Crop's Harvest Rhythm → add the guaranteed yield and earned bonus to Farm stock → freely pack a Provision, Tool, and Pack → send Rosie → see how each choice shaped the Adventure → receive farm supplies and one Discovery → return to a visibly changed, persistent Barn.

## Interaction rules shown by the set

- Seeds are required; Compost is optional and predictably shortens growth while increasing yield.
- Crops have different durations, remain harvestable forever, and never spoil.
- Each Crop has a learnable personal swipe phrase. Base yield is guaranteed; successful rhythm adds a small deterministic bonus.
- Harvested Crops accumulate in Farm stock and become useful Adventure Provisions.
- Bag choices are free, bounded to Provision / Tool / Pack, and may be left empty.
- Adventure outcomes are kind, deterministic, and preparation-driven rather than random loot rolls.
- A return contains one exciting named Discovery plus a small amount of practical supplies.
- The Barn itself shows lasting progress; the interface does not need to shout it.

## Implementation reading

React owns reducer state, timers, inventory, pointer/swipe interpretation, reward calculation, copy, buttons, accessibility, persistence, and prototype Previous/Next navigation.

Rive owns Rosie, Crop growth and Harvest responses, bag choreography, item attachment, departure/return performance, Glowroot reveal, visitors, and low-amplitude ambient life. Rive receives facts from React; it does not decide outcomes or own save state.

Keep the generated scenes as composition and art-direction targets. Rebuild them from the clean Barn scene plate, separable static assets, React UI, and bounded Rive layers. Do not import a whole generated screen as the interactive game.

Generated with the built-in ImageGen workflow. All eleven screens use a shared 9:16 visual brief, canonical quadruped Rosie constraints, one-action hierarchy, a thin prototype rail, and Rive-friendly separable-layer requirements.
