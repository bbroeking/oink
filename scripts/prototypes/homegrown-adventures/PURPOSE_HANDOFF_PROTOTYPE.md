# v0.122 Rosie-to-purpose handoff prototype

Question: after the remembered morning Tickle reveals **Lights Past the Open
Gate**, what should happen before the player chooses what to grow?

Three treatments run on the real Position 1 → 2 transition:

- **A — Immediate Choice:** current behavior; the complete two-card crop chooser
  appears on the same frame as Rosie's Tickle response.
- **B — Rosie Introduces It:** Rosie and one short route invitation own a
  presentation beat, then the already-validated crop chooser appears without
  another click. The throwaway comparison holds this frame for five seconds so
  it can be inspected; production timing is intentionally undecided here.
- **C — Beds Become Choices:** remove the chooser panel and attach the two crop
  actions directly to their remembered Farm beds.

Run `npm run prototype:homegrown`, then open:

`http://localhost:4174/homegrown-adventures.html?debug=1&mode=loop&position=11&variant=A`

Use **Begin another day**, then Tickle Rosie. The bottom switcher or Left/Right
Arrow compares A, B, and C. Presentation changes only; route, crop rules,
duration, yield, Compost, rewards, saves, and Rive inputs are unchanged.

## Verdict

**B — Rosie Introduces It.** A is mechanically correct, but the chooser hides
most of Rosie on the same frame as her authored Tickle response. C leaves more
Farm visible, yet its large bed buttons cover Rosie's face and discard the
already-validated duration, yield, safe-wait, and route-cause hierarchy. B
keeps the proven crop choice intact after one short no-click handoff and lets
Rosie, the open hedge, the remembered crops, and the named route explain why
the farming decision exists.

Production should use the authored Tickle's 450–650 ms response as the center
of a roughly 1.2 second handoff. Reduced motion should hold the same static
route statement briefly. Reloading Position 2 should resume the crop choice
directly rather than replaying a transient reaction.
