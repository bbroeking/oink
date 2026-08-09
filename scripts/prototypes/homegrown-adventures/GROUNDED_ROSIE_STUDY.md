# Position 9 grounded-Rosie study

Question: how should the existing canonical Rive Rosie occupy the Adventure
clearing so the prepared-item causes feel explored rather than composited?

Approved reference:
`assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/09-adventure-vignette.png`

Run:

`npm run prototype:homegrown:build`

Then open Position 9 with `groundStudy=1` and select A, B, or C through the
external study switcher or the `variant` query parameter.

- A · Hero Float: current full-size centered Rosie. Control treatment.
- B · Trail Companion: scale Rosie to 78% and place her behind the prepared
  items with her feet on the visible trail.
- C · Close Witness: retain more of Rosie's scale, move her left, and let the
  objects overlap her foreground silhouette.

All three treatments preserve the same Rive asset, authored motions, Bag,
route, cause sequence, exact rewards, reduced-motion behavior, and React-owned
progression. The study changes only the presentation transform while the
Position 9 causal vignette is mounted.

## Verdict

**B · Trail Companion wins.** Hero Float leaves Rosie suspended against the
sky with no relationship to the trail. Close Witness restores ground contact
but keeps enough scale that Rosie crowds the find. Trail Companion gives the
prepared objects a clear foreground, places Rosie's feet at the root crossing,
and reveals the dusk opening above her. The final treatment places a dedicated
550 px viewport around the existing Rive component, lets Rive size its own
canvas, and covers the one offstage bed fragment with a route-matched patch
below Rosie's feet. That preserves every authored pose without moving the
scene's other DOM layers or leaking an unrelated Rive group into the clearing.
