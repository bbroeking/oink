# Card Pack Reveal

Runtime asset authored in the existing cloud Rive file **Card Packs**:
https://editor.rive.app/file/card-packs/2651084

- Runtime export: `card-pack-reveal.riv`
- Editable backup: `source/card-pack-reveal.rev`
- Contract: `contract.json`
- Artwork guidance: `artwork-package.md`
- Audio and haptic cues: `cue-sheet.md`
- Transparent sealed fallback poster: `sealed-packet-poster.png`

The artboard is a script-free 390×844 seed-packet performance. React Native owns
gesture recognition, accessible controls, reward truth, card order, persistence,
audio, haptics, and the authoritative framed/typeset card. In the current
opening ceremony Rive owns the branded sealed packet, tear strip, seam, wrapper
exit, and contact-shadow motion. The legacy card/finish studies remain available
for compatibility but are not the opening card renderer.

Five original 750×1050 printed fronts are embedded as editor fixtures. Runtime
replaces the single bound `cardArt` image. The printed title/rules must remain
stable in the React Native frame when an art-only living crop is supplied.
The dynamic image node defaults to zero opacity before the state machine's first
advance, preventing a cold-load artwork flash. Reveal, reduced reveal, and
inspect timelines explicitly make it visible.

The sealed packet uses a warm waxed-paper gradient, highlighted top crimp,
recessed seam, bottom crimp, and a Rosie label reading “ROSIE'S LOADOUT”,
“LITTLE THINGS · LOVELY FINDS”, and “3 CARDS FROM THE BOG”. Its visible bounds
are x=44...346 and y=226...656 on the 390×844 artboard.
The poster is the editor's exact 390×844 transparent render. Its measured
nontransparent pixel bounds are x=43...351 and y=206...663 (309×458). A host
may render the full poster with the same contain sizing as the Rive artboard, or
use that exact alpha crop for a tighter packet shelf. Do not stretch the crop
independently in each axis.

The state machine was simulated in the editor through five reveals to Complete.
`PackOpen` lasts 42 frames at 60 fps (0.7 seconds): the horizontal seam holds,
the two strip halves lift and fling up-right, and the wrapper body drops out.
`CardReveal` lasts 21 frames at 60 fps (0.35 seconds). It keys packet opacity,
card opacity, position, scale, and rotation from its own first frame, so a resumed
reveal does not depend on `PackOpen` having run in the current session.
`PackIdle` and `PackOpen` keep the card group fully transparent, and `PackReset`
fades it back to transparent before returning to idle. The terminal Complete
state holds the reveal animation so the fifth card remains visible.
The revealed card is 300 px wide, centered at x=195 and y=410, with a restrained
overshoot before settling. The host owns outgoing-card drag and dismissal.
Cold-start `reveal` transitions directly from `PackIdle` to `CardReveal`, or to
`ReducedMotionReveal` when `reduceMotion` is true. Cold-start `inspect` enters
`CardInspect` directly, so resumed packs and album inspection do not require an
`open` trigger first.
Exact-binary WASM inspection verifies the artboard-bound View Model, `Default`
instance, all 15 typed properties, finish enum, dynamic image binding, and
state-machine advance. A prior compatible export imported on the iOS simulator
and rendered the original Firefly artwork; the final hash still needs reload
verification. Android remains unverified. Output trigger properties are
addressable, but timeline callback emission is not authored: the MCP accepted
trigger-property keyframe writes without creating keyframes, so the host must
retain its recovery timer.

The host decides whether the reward contains three current cards or five legacy
cards and stops dispatching reveal at that count. The Rive API intentionally
does not add a `cardCount` property.
