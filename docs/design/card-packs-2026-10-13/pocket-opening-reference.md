# Pocket opening motion reference

The requested “Pokémon GO pack opening” is being interpreted as Pokémon TCG Pocket's booster opening. No Pokémon imagery, branding, audio, or code is used in Tickle the Pig.

## Sources and observation

- [Official Pokémon TCG Pocket preview](https://www.youtube.com/watch?v=fE_03Hla2vU), Pokémon Asia ENG, September 19, 2024. The sequence around **0:15–0:22** is the motion reference. Inspected the video in the browser: a selected packet approaches from the carousel, fills the phone, opens along its upper seam, loses its upper strip and wrapper, and yields a large face-up card. Subsequent cards occupy the same reading position.
- [Pokémon's announcement](https://corporate.pokemon.co.jp/en/topics/detail/t-28/) describes the swipe-across-the-top opening gesture and physical feel with sound/vibration.
- [DeNA's official preview announcement](https://dena.com/intl/news/4742/) identifies the preview and its collection experience.

The trailer is edited footage, not a measured interaction specification. The durations below are implementation choices, not claims about Pokémon's exact timing.

## Tickle the Pig translation

Motion thesis: the packet and the current card are the focal objects. The tear tracks the hand and preserves progress. Once open, the wrapper leaves and the first card arrives without another button. A settled card stays indefinitely until the player dismisses it. A canceled card drag returns to the reading position. The fifth stays available for inspection before the complete receipt.

- Dedicated full-height cream stage, with the app's ordinary navigation removed during the ceremony.
- Waxed seed-packet skin, cocoa edges, original Rosie illustration, warm palette and established type.
- Horizontal cut, top-strip lift, and downward wrapper exit: approximately 700 ms.
- Current-card drag tracks horizontal movement; a completed dismissal exits before the next art is bound. Tap provides the same path.
- Incoming card uses a short settle with a small overshoot, approximately 350 ms. The guarded host fallback is slightly longer.
- Five restrained progress marks, one readable name, optional inspection. Printed rules remain in the inspection view.
- Reduced motion uses static artwork and immediate transitions; accessible buttons remain available.
- One Rive renderer. Immutable receipt order, ownership, persistence, and progression stay in the React Native host.

## Design source

Updated the existing private [Claude Design canvas](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Pack+Opening+Prototype.dc.html) with the source video, observations, gesture behavior, phone constraints, and attached Tickle the Pig Design System before implementation.

## Confirmation results

- Browser pointer drag of 110 px advanced a retained 6% tear to 54%; reload retained 54%.
- Open transitioned directly to the first Firefly Swarm card without a second reveal button.
- A horizontal swipe advanced to Mud Shovel; a rapid double-click advanced once to Puddle Duckling.
- Optional Puddle Duckling inspection showed the original printed rules and returned to card 3.
- Cards 4 and 5 appeared in order. Reload retained Moon Firefly at 5/5, with no sixth-card control; the explicit receipt showed all five.
- At 320×568, action bounds stayed inside the viewport and there was no document horizontal overflow.
- Rive dynamic image binding uses intrinsic image dimensions. Runtime-only 750×1050 contain-padded derivatives standardize the five showcase images; originals used in the album are unchanged. This prevents full-size illustrations overflowing the card frame.
- The current Rive export passes its exact-binary contract verifier. Completion triggers remain silent, so the guarded presentation fallback remains required.
- Native verification of this update remains pending because the simulator computer-use controller could not select the intended test window. The older native evidence does not validate this new export.
