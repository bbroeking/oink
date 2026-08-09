# Harvest Rhythm — visual translation

## Design question

How can the ripe bed itself carry the crop-specific rhythm, its accessible tap fallback, and its guaranteed reward without turning one short gesture into four separate UI surfaces?

This checkpoint begins after Position 4 settles the selected crop. It ends when the established crop-specific rhythm completes or the player chooses the unchanged normal-gather fallback. It changes composition and feedback only.

## Approved visual context

- [`05-harvest-rhythm.png`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/05-harvest-rhythm.png) is the primary reference: the three beds visibly own the three beats, the active direction glows on the crop, the sequence reads as one path, and guaranteed harvest plus the small skill bonus remain explicit.
- [`04-growing-fast-forward.png`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/04-growing-fast-forward.png) provides the incoming crop-first composition and selected-bed identity.
- [`06-harvest-result-stock.png`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/06-harvest-result-stock.png) provides the outgoing basket and stock consequence.
- [`rosie-v3/README.md`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/README.md) locks crop-specific swipe patterns, guaranteed base harvest, a small performance bonus, React authority, one authored Rive Harvest response, and the external review rail.

The approved screen is a composition reference, not a bitmap to import. The real Rive crop and Harvest response remain the only crop animation.

## Current rendered gap

Shipped v0.134 hands the player from a calm crop-first wait into a large cream instruction slab below the beds. A separate guaranteed-yield strip, separate **Gather normally** button, active arrow on the bed, and repeated HUD rhythm turn one three-beat gesture into four visual surfaces. The ripe bed remains visible, but the control panel—not the crop—owns the interaction.

## Locked invariants

- Clover remains Left → Right → Up; Moonberries remain Down → Left → Right → Up.
- Every completed harvest grants the base yield plus any explicit Compost bonus.
- A clean rhythm adds exactly one small bonus; an imperfect or slow rhythm never reduces the guaranteed harvest.
- **Gather normally** remains a keyboard-, touch-, and screen-reader-accessible fallback.
- React owns beat order, correctness, timing, settlement, stock, persistence, and the 560 ms Harvest performance window.
- The authored Rive Harvest response remains unobscured and fires once.
- Bed 1 remains Clover's surface; rooted Bed 2 remains Moonberries' surface.
- Reduced motion preserves static direction, progress, guaranteed yield, and fallback.
- No score, combo meter, miss punishment, lives, countdown, new currency, or Rive input is introduced.

## Prototype variants

### A — Bed Sequence

Place one direction medallion over each bed position, let the current beat glow, and connect them with one subtle path. A compact promise immediately below the beds combines guaranteed yield, +1 clean bonus, and **Gather normally**.

Hypothesis: the player swipes the Farm rather than a panel, and the accessible fallback stays truthful without becoming a second mode.

### B — Rhythm Furrow

Keep the active gesture on the selected ripe bed and engrave the remaining sequence into one narrow soil-colored furrow across the beds. Put the guaranteed reward in a small corner seal.

Hypothesis: this may feel most agricultural, but the furrow could become another horizontal toolbar and weaken individual beat locations.

### C — Rosie Leads

Give Rosie one small speech sign with the next direction while translucent bed medallions show the whole pattern. Keep reward and fallback in a bottom ribbon.

Hypothesis: Rosie may make the action warmer, but another speech surface could compete with the crop and repeat the HUD.

## Evaluation criteria

1. The ripe crop and selected bed are the first interactive subject.
2. The complete crop-specific pattern is readable without a large instruction card.
3. Current beat, completed beats, and next beat remain distinguishable without motion.
4. Guaranteed yield and the optional +1 bonus read as one promise.
5. The normal-gather fallback remains at least 44px and does not look like failure.
6. Rosie, all three beds, and the authored Harvest performance remain visible.
7. The 384 × 838 target has zero overflow, one Rive canvas, and no player-facing experiment label.
8. Clover and Moonberry paths both settle the exact existing stock.

## Review route

Use `?debug=1&variant=A&mode=loop&position=5&route=lanternleaf&repeat=1`, then switch A/B/C. Direct Position 5 shows Composted Clover. Exercise the rooted Moonberry path from Position 2 when verifying four beats and Bed 2. Production must include only the winning structure.

## Rendered verdict

**Ship A — Bed Sequence.** It is the only treatment where the Farm visibly owns the action: Clover's three 54px medallions sit directly on the three beds, the current beat is the only gold glow, and one compact row combines guaranteed yield, +1 clean bonus, and the 44px+ normal-gather fallback. Rosie, the ripe crop, and all three beds stay visible. At the player-facing 720px browser height the active control renders approximately 45 × 45px, **Gather normally** approximately 87 × 45px, the page has zero horizontal overflow, and exactly one Rive canvas remains.

Do not ship B. The soil-colored furrow reads as a conventional toolbar laid across the beds, covers more of the crop row, and squeezes the reward promise into a narrow corner.

Do not ship C. The speech sign covers Rosie's torso and repeats the current direction already present in the HUD, making Rosie another instruction surface instead of the emotional witness to the harvest.

## Crop, interaction, and motion evidence

- **Clover / three beats:** the rendered sequence places Left, Right, and Up directly over the three bed positions. The selected Bed 1 remains outlined and the active Left medallion is the only interactive tap fallback.
- **Moonberries / four beats:** the complete **Lights Past the Open Gate** → Moonberries → Compost → Tend → Fast-forward path renders a small diamond: Down starts on outlined rooted Bed 2, Left and Right branch to the side beds, and Up returns to Bed 2. The selected gesture zone's center and active Down medallion are aligned within approximately 4px.
- **Exact completion:** tapping the active fallback in order reports Down → Left → Right → Up, then reaches Position 6 with **Moonberries +6**: four base, one Compost, and one clean-rhythm bonus. Farm stock, root persistence, and the existing 560ms authored Harvest handoff remain intact.
- **Reduced motion:** Clover still shows the gold current beat, muted future beats, `Clover rhythm · Swipe Left`, `4 Clover Lunch · Guaranteed`, `+1 clean`, and **Gather normally** with one canvas and zero overflow. The hierarchy does not depend on animation.

Production should keep only A's selected-bed gesture zone, bed medallions, and consolidated promise row. It should not retain the experiment selector, furrow, Rosie speech treatment, prototype variant names, or `harvest-prototype` / `harvest-layout-*` classes.
