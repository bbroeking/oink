# Crop-to-bed handoff — visual translation

## Design question

How should the crop selected from the physical Farm tray remain visibly connected to its bed and optional Compost decision, without covering the Farm or adding another gameplay system?

The checkpoint begins after the player has freely chosen Clover or Moonberries. It ends when the established **Plant / Tend** action hands the state to the existing authored Rive planting motion. The prototype changes only composition and physical props.

## Approved visual context

- [`03-plant-and-compost.png`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/03-plant-and-compost.png) is the primary reference: the required crop resource and optional Compost are physical objects, the selected bed is visibly highlighted, and the action sits directly beneath the bed.
- [`02-farm-stock-seed-choice.png`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/02-farm-stock-seed-choice.png) provides the incoming state: the chosen crop leaves one physical wooden tray rather than becoming an abstract mark.
- [`rosie-v3/README.md`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/README.md) locks the portrait format, Rosie model, paper-craft language, predictable Compost rule, and touch-first review flow.

The approved screens are composition references, not full-screen bitmaps to import. This prototype uses separable production assets: the tracked Clover particle art becomes the mark on a CSS paper Seed packet, the existing Moonberry basket represents the rooted crop, and the Compost sack is a separable CSS prop. The real Rive scene remains mounted beneath the interface and retains authority for the eventual planting motion only.

## Current rendered gap

The deployed v0.132 crop tray establishes physical crop identity, but one tap later:

- Clover becomes `☘`, Moonberries become `●`, and Compost becomes `♣`;
- three floating rectangles cover all three beds;
- the player reads resource cards and a result card before seeing where the crop goes;
- the selected bed has no visual emphasis until after confirmation;
- the UI does not visually hand its selected object into the authored Rive planting response.

The rules are correct. The weakness is physical continuity and hierarchy.

## Locked invariants

- Clover consumes one Seed; rooted Moonberries consume no Seed.
- Compost remains optional, costs one when chosen, saves two hours, and adds one guaranteed harvest item.
- Normal and boosted yield and duration stay visible before confirmation.
- Clover targets Bed 1; Moonberries target rooted Bed 2.
- Both crops remain one-tap confirm actions after the optional boost choice.
- The authored Rive Plant / Moonberry Plant and Compost wake motions remain the state-change response.
- Reduced motion keeps the selected bed readable without pulsing.
- No drag-and-drop, modal, crafting rule, new resource, new Rive input, or second planting screen is introduced.

## Prototype variants

### A — Bedside kit

The crop resource and Compost sit together as two physical supply cards just above the beds. A glowing outline names the selected bed, while one bottom sheet combines the deterministic result and confirmation.

Hypothesis: this keeps the existing two-choice familiarity while exposing the bed, but the two cards may still read like the old floating panel.

### B — Concept split

A cream **Plant / Tend** sign and two compact physical resource cards sit above the beds. The middle of the screen is reserved for the highlighted bed and chosen crop prop. Confirmation and its predictable result sit below the bed, following the approved concept's vertical sequence.

Hypothesis: this is the most faithful translation of the reference and the clearest teaching composition, but it uses the most individual surfaces.

### C — Bed-first ribbon

The selected crop prop and resource fact live directly on the highlighted bed. Compost is one physical toggle above and to the right. A single bottom ribbon owns both the predictable outcome and the Plant / Tend action.

Hypothesis: this is the quietest and most game-like structure because the bed, not a panel, becomes the main object. It may need stronger copy to remain immediately understandable for a first-time player.

## Evaluation criteria

1. The selected bed is visible and nameable before the player presses Plant / Tend.
2. The crop remains recognizable without `☘`, `●`, or `♣` as its primary identity.
3. Seed/root cost, Compost cost, yield, and duration remain readable without zooming.
4. Compost can be toggled on and off; the predicted result updates immediately.
5. Plant / Tend is at least 44 px and visually belongs to the selected bed.
6. Rosie, the selected bed, and at least one neighboring bed remain visible.
7. The 384 × 838 rendered phone has no overflow, one authored Rive canvas, and no player-facing experiment labels.
8. Confirmation advances into the correct crop-specific growth state and existing authored motion.

## Review route

Use `?debug=1&variant=A&mode=loop&position=3&route=lanternleaf&repeat=1`, then switch A/B/C with the prototype switcher or arrow keys. The direct state shows Clover; use Position 2 and choose Moonberries to verify the rooted Bed 2 branch. Production must include only the selected composition and no switcher or experiment copy.

## Rendered verdict

**C — Bed-first ribbon wins.** All three variants were rendered in the real 384 × 838 phone shell against the live Farm and authored Rive scene. A preserved the Farm but still made the resource pair the visual subject. B matched the approved vertical sequence most literally, but divided one planting decision across five bordered surfaces and pushed Rosie behind a heading, two resource cards, and two result surfaces. C kept the bed as the subject: the physical crop prop rests on the selected soil, optional Compost remains one separable choice, and one ribbon explains and confirms the outcome.

The first C render also caught and corrected an invalid selector: generic bed-label styling was leaking onto the physical crop prop, creating a blank white speech-bubble shape behind the Clover packet. The label now has its own `planting-bed-label` class, leaving the packet and Moonberry basket separable and transparent.

Rendered evidence for the selected composition:

- phone content is exactly 384 × 838 inside the established 390 × 844 shell;
- Clover remains a 68 × 68 physical Seed packet on highlighted Bed 1;
- Moonberries remain the existing physical harvest basket on highlighted rooted Bed 2;
- the Compost choice is 176 × 76 and the Plant / Tend action is 150 × 86, both above the 44 px touch minimum;
- Rosie, all three beds, the crop prop, Compost, predicted yield, duration, and action remain visible together;
- one authored Rive canvas remains mounted, there is no horizontal overflow, and no experiment label enters the player surface;
- toggling Compost changes Moonberries from **4 · 8 hours** to **5 · 6 hours**, shows **2 → 1**, and changes the action to **Tend with Compost**;
- confirming the boosted Moonberry branch advances to the existing Composted growth state at six hours.

Production should rewrite only C without the global variant names, switcher behavior, or A/B structures. React remains authoritative for Seed/root cost, Compost, duration, yield, and transition; the existing Rive motion remains the planting response.
