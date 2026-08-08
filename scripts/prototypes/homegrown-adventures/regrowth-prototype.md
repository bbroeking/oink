# Moonberry regrowth treatment prototype

Question: how should the existing rooted Moonberry bed explain what happens after harvest without adding another Seed or crafting system?

Run with `npm run prototype:homegrown`, then open the existing Homegrown route at Position 6:

- `?variant=A&position=6&regrowth=A` — immediate rootstock: Bed 2 shows a sprout and the harvest receipt says the roots remain.
- `?variant=A&position=6&regrowth=B` — overnight wake: Bed 2 stays empty and copy promises fresh shoots tomorrow.
- `?variant=A&position=6&regrowth=C` — reserve a berry: the player chooses whether to spend one harvested berry on regrowth.

Verdict: Variant A wins. It makes the cause visible at the exact payoff moment, uses the existing Rive `sprout` state, and adds no new cost or decision. Variant B postpones proof until a later screen. Variant C turns a legibility fix into an unnecessary economy rule and weakens the stockpile payoff.

The production checkpoint should keep the rootstock fact in React progression, let Rive show the post-harvest sprout, carry that regrowing state through Adventure and Homecoming, and show the normal growing bed on the next morning.
