# v0.123 Lanternleaf Home-memory prototype

Question: after Rosie maps Lanternleaf Path on the second Adventure, how should
the completed Home screen remember that newer Discovery instead of repeating
the first day's Glowroot promise?

Three treatments live on the existing `homegrown-adventures.html` endpoint and
use a real Position 11 Lanternleaf review state:

- **A — Old Memory:** the shipped endpoint repeats Glowroot's plaque and pocket.
- **B — Latest Chapter:** the existing storybook hierarchy names Lanternleaf
  Path and its promise to guide Rosie Home.
- **C — Living Route:** reflected leaves remain beside the hedge as an animated
  world landmark with one small route marker.

Run `npm run prototype:homegrown`, then open:

`http://localhost:4174/homegrown-adventures.html?debug=1&mode=loop&position=11&route=lanternleaf&variant=A`

Use the bottom switcher or Left/Right Arrow to compare A, B, and C. The
prototype changes presentation only. Its `route=lanternleaf` Position 11 preset
exists solely to reproduce the completed second-day state; no new production
save field, reward, crop, or rule is proposed.

## Verdict

**B — Latest Chapter.** A directly contradicts the reward the player just
accepted. C makes the route physical, but the reused Adventure Rive layer is
misregistered against the Home plate and its marker covers the open hedge—the
exact proof it should clarify. B uses the already-established completed-day
hierarchy to give the newest Discovery one calm, accurate read while Rosie,
the Farm, and all earlier Glowroot consequences remain visible.

Production should derive the memory from the persisted Field Guide rather than
add another save field. The storybook promise, compact Home pocket, rendered
scene description, and Position 11 review label must all agree on Lanternleaf
Path after the successful second Adventure. First-day Glowroot and every
Near-Discovery remain unchanged.
