# Growing-bed focus — visual translation

## Design question

How should the growing crop, its predictable wait, and its Compost state stay attached to the selected bed without covering the Farm, while the browser prototype still offers an obvious fast-forward?

The checkpoint begins after the existing Plant / Tend action and authored Rive planting response. It ends when React-owned time makes the crop ready or the prototype rail jumps to Position 5. It changes composition only.

## Approved visual context

- [`04-growing-fast-forward.png`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/04-growing-fast-forward.png) is the primary reference: the growing crop is the subject, the selected bed owns one small Compost/time sign, Rosie and all beds stay visible, and prototype navigation remains outside the scene.
- [`03-plant-and-compost.png`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/03-plant-and-compost.png) provides the incoming physical handoff from the chosen crop and optional Compost.
- [`rosie-v3/README.md`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/README.md) locks React timer authority, staged Rive growth, no spoilage, portrait scale, and the external eleven-position review rail.

The approved screen is a composition reference, not a bitmap to import. The real authored Rive crop remains the only growing crop. Variant C reuses the tracked watering-can art as a separable non-gameplay prop; it grants no item or boost.

## Current rendered gap

Deployed v0.133 now gives Position 4 a clear crop-to-bed handoff, but the next screen places a 202 × 149 status card across the neighboring beds. The same **Composted · ready in 2h** fact already appears in the HUD, while **Preview it ready** introduces a second in-world action beside the external prototype rail. The growing Rive crop is visible, but the status card—not growth—owns the composition.

## Locked invariants

- React continues to own planted time, ready time, elapsed-stage derivation, persistence, and settlement.
- Compost continues to save two hours and add one guaranteed item; this screen cannot change or spend it.
- Clover grows in Bed 1; rooted Moonberries grow in Bed 2.
- Ready crops wait safely forever and never spoil.
- Existing sparse/lush crop poses and authored Rive sway remain unchanged.
- The external Position 4 rail may fast-forward the browser review to the ready state; no second timer or new game action is introduced.
- Reduced motion preserves every status and static crop pose.
- No modal, progress bar, countdown loop, watering mechanic, resource, or Rive input is introduced.

## Prototype variants

### A — Bed Sign

One compact staked sign sits immediately below the highlighted growing bed. It names Compost state, crop, duration, and safe waiting. The Farm itself contains no action; the existing external rail becomes **Fast-forward** at Position 4.

Hypothesis: this most closely follows the approved concept and keeps the Rive crop primary, but the low sign must not collide with the rail or look like another crop card.

### B — Growth Ribbon

A single cream **Clover / Moonberries is growing** sign anchors the upper Farm, while one bottom ribbon carries the Compost, duration, and safe-wait facts. The selected bed remains highlighted and unobstructed.

Hypothesis: the state may teach fastest, but it repeats the HUD and uses two scene-wide surfaces for a passive wait.

### C — Care Scene

The selected bed remains outlined, an existing separable watering can sits nearby as an ambient care prop, and one compact note below the beds carries the status. Fast-forward remains in the external rail.

Hypothesis: this may feel most like farming, but the watering can risks implying a new required action or covering a neighboring bed.

## Evaluation criteria

1. The staged Rive crop is the first thing the player notices.
2. Clover Bed 1 and rooted Moonberry Bed 2 are both nameable without a large overlay.
3. Compost state, duration, and no-spoil promise remain readable.
4. Rosie, the selected bed, and both neighboring beds remain visible.
5. No in-world control competes with the passive wait; the external rail provides a 44px+ fast-forward.
6. The 384 × 838 phone has no overflow, one authored Rive canvas, and no player-facing experiment label.
7. Clicking rail Fast-forward reaches the established crop-specific Harvest Rhythm.
8. Reduced motion keeps the same hierarchy without relying on animation.

## Review route

Use `?debug=1&variant=A&mode=loop&position=4&route=lanternleaf&repeat=1`, then switch A/B/C. Direct Position 4 shows Composted Clover; use the returning route and Moonberry crop path when verifying rooted Bed 2. Production must include only the winning structure, while the external rail may keep the truthful Position 4 fast-forward label.

## Rendered verdict

**Ship A — Bed Sign.** On the 384 × 838 target it leaves Rosie and all three beds visible, keeps the authored Rive crop as the dominant changing object, and attaches the passive Compost/time facts to the selected bed. Its rendered sign is approximately 125 × 64 px, the bed outline remains close to the crop at approximately 111 × 96 px, and the external Fast-forward target is 92 × 54 px. The page has zero horizontal overflow and exactly one Rive canvas.

Do not ship B. The upper sign and lower ribbon turn one passive wait into two interface surfaces, repeat the HUD, and make the scene feel more supervised than grown.

Do not ship C. The extra turquoise watering can duplicates the existing pink watering can in the scene and reads as a new watering interaction even though none exists. That is a gameplay promise the checkpoint must not make.

## Route and motion evidence

- **Clover / Bed 1:** direct Position 4 renders `Composted`, `Clover · 2 hours`, and `Waits safely when ready` below the selected bed without hiding its neighbors.
- **Moonberries / Bed 2:** choosing **Lights Past the Open Gate**, selecting Moonberries, adding Compost, and tending renders `Moonberries · 6 hours` on rooted Bed 2 with the same hierarchy.
- **Fast-forward continuity:** the first rendered alternate-crop pass exposed that the generic Position 5 preset reset the crop to Clover. The Position 4 → 5 transition now settles the current planted crop instead. The next rendered screen correctly shows `Moonberries rhythm: ↓ ← → ↑` and `5 Moonberries guaranteed · clean rhythm +1`, while preserving Compost and planted stock.
- **Reduced motion:** after toggling the lab control, the sign and outline both report `animation-name: none`; all status text remains visible, the page retains zero horizontal overflow, and the scene still contains one Rive canvas.

The production translation should therefore include only A's outline and bed sign, retain external review fast-forward, and carry the crop-identity settlement fix. It should not include the experiment selector, ribbon, extra watering-can asset, or prototype-only variant names.
