# v0.121 changed-Home promise prototype

Question: after the player has planted Glowroot and the authored flourish has
landed, what should make the stable Position 11 screen prove that the Adventure
permanently changed Home?

Three treatments live on the existing `homegrown-adventures.html` route and use
the real Position 11 state:

- **A — Current Handoff:** the current compact Home record and next action.
- **B — Storybook Promise:** one calm `The Barn remembers` plaque in the sky,
  paired with the physical Glowroot bed and existing compact stock disclosure.
- **C — In-world Memory:** two labels attached directly to Bed 3 and the open
  hedge, with no global promise.

Run `npm run prototype:homegrown`, then open:

`http://localhost:4174/homegrown-adventures.html?debug=1&mode=loop&position=11&variant=A`

Use the bottom switcher or Left/Right Arrow to compare A, B, and C. The
prototype changes presentation only; reducer state, rewards, inventory,
persistence, crop rules, and Rive inputs are untouched.

## Verdict

**B — Storybook Promise.** A leaves the player to infer permanence from a very
small stock pocket. C makes the consequences literal, but its two labels cover
the path and Bed 3—the exact physical proof they are meant to clarify. B gives
the completed-day endpoint one readable promise that matches the approved
`06-changed-barn-new-day.png` concept while leaving Rosie, the three beds, pond,
frog, and open hedge readable.

Production should show the plaque only when the day is complete and **Begin
another day** is available. The authored Glowroot flourish remains world-first,
and remembered mornings return to the existing compact pocket rather than
replaying ceremony UI.
