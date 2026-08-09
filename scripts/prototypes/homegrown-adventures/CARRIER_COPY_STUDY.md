# Carrier consequence copy study

## Question

Can the Position 9 Carrier beat explain both the outcome and the exact packed
cause inside the existing quiet HUD, without restoring a card, enlarging the
HUD, or competing with Rosie and the physical find-to-Carrier handoff?

The approved visual anchor remains
`assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/09-adventure-vignette.png`.
The production composition, canonical Rive Rosie, route art, physical Carrier,
timing, and reducer facts do not change in this study.

Run each treatment at Position 8 and follow Rosie into the clearing:

- `?variant=A&mode=loop&position=8&carrierCopy=A`
- `?variant=A&mode=loop&position=8&carrierCopy=B`
- `?variant=A&mode=loop&position=8&carrierCopy=C`

## Treatments

### A — Current sentence

Keep the existing single-line sentence and generic preparatory detail:

- **Wicker Basket makes the Glowroot find safe**
- *waits ready for a sturdy find*

This is truthful, but the 265 px title exceeds its 224 px rendered line and
appears as **Wicker Basket makes the Glowroot…** at 390 px.

### B — Short cause

Shorten the Carrier name and keep the existing detail:

- **Basket carries Glowroot Home**
- *waits ready for a sturdy find*

Both lines fit. The result becomes readable, but **Basket** and **Wrap** weaken
the exact equipment identity the player chose, while the secondary line still
describes readiness after the physical transfer has already happened.

### C — Outcome, then exact cause

Use the HUD's existing two-line hierarchy as one causal sentence:

- **Glowroot is coming Home**
- *Carried by the Wicker Basket*

The Glowroot title renders at 153 px, and the exact Carrier detail fits at the
same width. The Lanternleaf / Cloth Wrap treatment and the no-Carrier clue
treatment also fit at 390 px with no horizontal overflow:

- **Lanternleaf is coming Home** / *Protected by the Cloth Wrap*
- **The find stays here safely** / *Rosie remembers the way*

## Decision

Ship C. It answers the two player questions in reading order: what changed,
then why. It keeps the named Discovery primary, preserves the exact Carrier,
matches the physical find-to-Carrier animation, and turns an existing detail
line into useful causal evidence instead of adding another surface.

Production should retain this grammar for every complete and Near-Discovery
branch, test that each exact title and detail exists, and render-check the
Glowroot, Lanternleaf, clue, and reduced-motion branches. The `carrierCopy`
query parameter and all losing treatments are prototype-only.
