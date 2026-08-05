# Homegrown Adventures — roadmap, version history, and devlog

This is the human-readable checkpoint record for the browser experiment. The
product contract remains in `docs/homegrown-adventures-build-goals.md`.

## Current roadmap

1. **v0.2 — Rosie Responds (in local validation):** make the authored Rive rig
   the only Rosie on screen and make the first tickle visibly satisfying.
2. **v0.3 — Rosie Notices:** add restrained breathing plus a clear Notice pose
   that points to the Kitchen Patch without obscuring the DOM story card.
3. **v0.4 — Rosie's Bag:** author the registered satchel and held-item anchors,
   then validate pack, return, and rapid-trigger settling.
4. **v0.5 — Living Barn:** bind crop beds, residents, the Hedge Bell, and the
   developed crossing one consequence at a time.

Depth and polish win over new crops, destinations, currencies, or parallel
systems. Each checkpoint starts with play and ships only after rendered proof.

## Version history

### v0.2.0 — Rosie Responds — 2026-08-05

- Renamed the paid Rive workspace to **Tickle the Pig**.
- Recovered and adapted the existing Rosie mesh/bone rig instead of replacing
  it with CSS motion.
- Added the exact Homegrown artboard, state-machine, View Model, enum, boolean,
  and trigger contract; retained a deterministic metadata patch step because
  the editor currently duplicates generated data-property names.
- Fixed two export failures found by playing the real build: the artboard's
  opaque fill and `pig_skin` being set to `Prevent Export / Referenced`.
- Embedded Rosie's 370×383 texture, made the 390×844 artboard transparent, and
  authored the `Rosie Tickle` squash/lift/settle motion on the foreground rig.
- Generated three non-destructive scene-plate derivatives that remove only
  static Rosie while preserving the approved concepts as references.
- Restarted rapid tickles instead of stacking transforms; reduced motion keeps
  the pose legible while progression, sound policy, and counters remain DOM
  owned.

### Validation evidence

- `npm run verify:rive-homegrown` — pass; 390×844 header and 30 contract names.
- `npm run prototype:homegrown:test` — 13/13 pass.
- `npm run quality:check` — pass, including TypeScript, 157-file layout gate,
  324 sprite integrity checks, security contracts, and 280 Jest assertions.
- Rendered Chromium play — authored asset reports `ready`; transparent
  composition verified in starting and developed states; single tickle,
  three rapid 90 ms tickles, 700 ms settle, and reduced-motion tickle verified.
- Remaining manual gate — current iOS Safari/device sharpness, haptic feel, and
  audio acceptance.

### Next highest-leverage weakness

Rosie is responsive but not yet alive while waiting. Author a subtle 2.8–3.6 s
Rive breathing loop at the approved foreground scale, then add the Notice pose.
Do not begin Bag or crop animation until those two motions settle cleanly.
