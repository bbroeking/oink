# Artwork package

The reusable runtime slot is 270×408 inside a 390×844 artboard. Supply
`cardArt` at 750×1050 for the full-front fallback. For React Native framed
cards, supply an art-only crop at 714×900 (238×300 logical window at 3×).

The five fixtures preserve the repository originals:

| Card | Source | Runtime treatment |
| --- | --- | --- |
| Firefly Swarm | `landing/cards/img/034-firefly_swarm.webp` | Living showcase: separate background haze, swarm clusters, two foreground lights; flat layered parallax and glow pulses, no character rig |
| Mud Shovel | `landing/cards/img/019-mud_shovel.webp` | Standard: whole-art settle, two-degree touch response, no internal deformation |
| Puddle Duckling | `landing/cards/img/038-puddle_duckling.webp` | Living showcase: water backplate, ripple rings, duckling body/head/wing, foreground reeds; head and wing may use a two-bone rig |
| Mushroom Cap | `landing/cards/img/009-mushroom_cap.webp` | Standard or foil: whole-art settle plus restrained diagonal glint |
| Moon Firefly | `landing/cards/img/046-moon_firefly.webp` | Living showcase: night gradient, moon halo, insect body/wings, foreground motes; wing pair may use pivot animation, body remains illustration |

Living source layers should use premultiplied-alpha WebP or PNG, identical crop
and registration, with 48 px transparent overscan. Masks stay inside the
714×900 art window. Keep title, stats, and printed rules out of moving layers.

“Flat motion” means transforms, opacity, masks, glow, and parallax applied to
illustration layers. “Rigged” means separately painted articulated parts bound
to pivots or bones. Only Puddle Duckling’s head/wing and Moon Firefly’s wings
justify rigs in the first three showcases.


## Runtime image sizing

The bound Rive image uses intrinsic pixel dimensions and expects 750×1050. Pass `riveCardArtSources` to the animation adapter, not the unnormalized original sources. `scripts/rive/normalize-card-pack-art.py` creates contain-centered, transparent-padded PNG derivatives for the five opening fixtures and records source/output dimensions and hashes in `art/manifest.json`. Verify with `python3 scripts/rive/normalize-card-pack-art.py --check`. Original files and static album sources stay unchanged. New animated identities need an equivalent derivative before being bound.
