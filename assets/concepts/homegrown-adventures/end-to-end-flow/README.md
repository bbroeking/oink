# Homegrown Adventures — end-to-end visual flow

> The current complete screen-direction candidate is the 11-position [`rosie-v3/`](./rosie-v3/README.md) set. The corrected six-screen `rosie-v2/` set and the six images at this level are retained as earlier comparison checkpoints.

These six ImageGen concepts are the implementation references for the first complete Barn day. They use one fixed portrait camera, one stable farm layout, one Rosie design, and one visible action at a time.

| Screen | Player-visible state | Primary interaction | Build implication |
| --- | --- | --- | --- |
| `01-morning-promise.png` | Rosie is waiting in an unchanged morning Barn | Tickle Rosie | Rosie is a separable Rive character region; the three beds begin empty. |
| `02-growth-and-harvest.png` | Clover has grown naturally from the left bed | Harvest Clover | Animate plant clusters from soil, then use loose leaves for the harvest burst. Do not place a second dirt texture over the scene. |
| `03-bag-preparation.png` | The harvested crop becomes useful preparation | Pack Rosie's Bag | Keep one food pocket and exactly two equipment slots in-world, not in a full-screen inventory. |
| `04-adventure-departure.png` | Rosie carries the chosen loadout through the hedge | Send Rosie | Animate the gate, moth trail, walking legs, ears, tail, and bag flap; retain the farm in view. |
| `05-welcome-home-discovery.png` | Rosie returns with one named, causal discovery | Plant Glowroot | The reward appears in the same bag beside the equipment that enabled it. Use restrained seed glow and moth motion. |
| `06-changed-barn-new-day.png` | The discovery permanently changes Home | Begin Another Day | Preserve the base geography and add Glowroot, Moonberries, Hedge Bell, pond, frog, hedgehog, and flower arch as bounded layers. |

## Locked visual rules

- One clear objective card and one spatial action button.
- No bottom navigation, currency panels, quest list, timers, or modal reward grid in the core loop.
- Farm, bag, and adventure are one causal loop: grow → harvest → pack → explore → return → improve Home.
- Every animated element must be crop-ready or separable for Rive: Rosie, crop clusters, leaves, bag pieces, moths, gate, bell, seed glow, and small visitors.
- The scene plate remains clean. Crops grow out of the authored beds; no pasted dirt overlay.
- Returning rewards create visible, persistent changes in the same Barn scene.

Generated with the built-in ImageGen workflow using the approved Starting Barn scene plate and earlier screens as strict sequential references.
