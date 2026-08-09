# Carrier receive-motion prototype

Question: can the player understand that the selected Carrier receives the
find from the clearing action itself, before reading the HUD?

- `carrierMotion=A`: shipped baseline. The find travels into a static Carrier.
- `carrierMotion=B`: the find follows a taller deliberate arc and the Carrier
  dips under its weight, then settles.
- `carrierMotion=C`: the Carrier slides toward the find to catch it, then
  returns to its resting place.

All variants use the same reducer state, timing window, art, loadout, reward,
and accessible description. The query switch exists only in this throwaway
branch and must not ship.

For a directly comparable still, add `carrierStudy=1&carrierFrame=mid`. This
holds the real game in the Carrier beat and freezes both the find and Carrier
at the midpoint of their authored CSS motion.

## Verdict

Choose **B — deliberate arc plus receiving dip**.

The baseline already sends the light toward the basket, but the Carrier never
answers, so the transfer can read as a glow passing in front of a prop. B gives
the recipient one small weight response and makes the arc readable without
moving the Carrier away from its grounded place. C is visually obvious, but a
basket sliding across the clearing looks self-propelled and competes with
Rosie. B preserves the quiet storybook physics and needs no new art, state, or
timing beat.
