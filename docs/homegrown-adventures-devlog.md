# Homegrown Adventures — roadmap, version history, and devlog

This is the human-readable checkpoint record for the browser experiment. The
product contract remains in `docs/homegrown-adventures-build-goals.md`.

## Current roadmap

1. **v0.2 — Rosie Responds (shipped):** make the authored Rive rig the only
   Rosie on screen and make the first tickle visibly satisfying.
2. **v0.3 — Rosie Notices (shipped):** add restrained breathing
   plus a clear Notice pose that points to the Kitchen Patch without obscuring
   the DOM story card.
3. **v0.4 — Rosie's Bag (shipped):** register the satchel to Rosie's rig and
   make packing and returning visibly change the same persistent character.
4. **v0.5 — Living Barn (shipped):** bind the first crop bed to reducer state,
   beginning with one readable sprout, ready, and harvest consequence.
5. **v0.6 — Home Remembers (shipped):** replace the developed-state plate swap
   with one authored, lasting Glowroot-and-hedge consequence in the same Barn.
6. **v0.7 — Clear Reward (shipped):** let the larger return story appear as one
   short ceremony, then collapse it so Rosie and the Home reward remain clear.
7. **v0.8 — Purpose Sign (shipped):** make the Barn's visible sign follow the
   Discovery and next named crop instead of requesting Clover Lunch forever.
8. **v0.9 — Moonberries Take Root (shipped):** make choosing the second intention visibly
   plant Moonberries in the second bed instead of ending on an unchanged scene.
9. **v0.10 — Dusk Moths Arrive (shipped):** close the named-purpose promise by letting
   the planted Moonberries attract one small, authored dusk-moth response at
   the same Barn.
10. **v0.11 — Moth at Rest (shipped):** make the new resident feel alive with one calm,
    authored hover or wing-rest loop that never competes with Rosie.
11. **v0.12 — Purpose Fulfilled:** let the Barn sign and terminal action
    acknowledge that the dusk moths are now here instead of describing
    Moonberries as a future intention forever.

Depth and polish win over new crops, destinations, currencies, or parallel
systems. Each checkpoint starts with play and ships only after rendered proof.

## Version history

### v0.11.0 — Moth at Rest — 2026-08-05

- Replayed the public v0.10 settled state at 390×844 and compared it with
  `03-developed-barn.png`. The moth fulfilled the named purpose but became a
  completely static gold-and-purple token after its arrival.
- Authored `Dusk Moths Resting` in the paid **Homegrown Adventures** Rive
  project. The same three-shape resident now lifts two pixels and opens its
  wings through a short 28-frame pose before returning exactly to Present.
- Added a deliberately sparse runtime cadence: one 560ms wing-rest pulse,
  followed by a 2.25-second calm hold. The moth never competes with Rosie's
  breathing, tickle, notice, or return motion.
- Kept the reducer authoritative. The cadence starts only while
  `mothsVisible` is true, resumes after reload, ignores rapid tickles, and stops
  on the static Present pose under reduced motion.
- Added no resident collection, reward, timer, destination, currency, or farm
  economy. This checkpoint deepens one existing Home consequence only.
- Updated the companion site to link directly to the **Moth at Rest lab**.

### Validation evidence

- `npm run verify:rive-homegrown` — pass; 390×844 header and 52 authored names.
- `npm run prototype:homegrown:test` — 13/13 pass.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene.
- Rendered Chromium at 390×844 — no moth before the Moonberry choice; Arrive
  still settled cleanly; the resident cycled through `resting` and `present`;
  reload resumed Resting; five rapid tickles left it visible and the cadence
  resumed; reduced motion stayed on the static `reduced` pose for three seconds.
- Rendered Chromium at 360×780 retained exact viewport, body, and document
  dimensions with no overflow. Rosie, moth, crops, Home record, purpose sign,
  terminal action, and navigation remained legible.
- GitHub Pages shipped commit `c247292` in successful deployment run
  `31066799154`. The public 390×844 route reported the authored asset `ready`,
  replayed `hidden` → `arrive` → `resting`, and resumed Resting after reload;
  the companion site exposed **Play the Moth at Rest lab**.
- Accessible DOM names, focusable controls, and the existing primary-action
  feedback path are unchanged. Mobile Safari sharpness, haptic feel, and
  audible acceptance remain manual device gates.

### v0.10.0 — Dusk Moths Arrive — 2026-08-05

- Replayed the deployed Moonberry payoff at 390×844 and compared it with
  `03-developed-barn.png`. Bed two changed correctly, but nothing fulfilled the
  visible promise **Invite the dusk moths**.
- Added one small native Rive dusk moth in the paid **Homegrown Adventures**
  project, using golden paper-cut wings and a purple body that relates it to
  the Moonberry crop.
- Authored exact Hidden and Present persisted poses plus a 21-frame Arrive
  one-shot. The moth is absent in the developed pre-choice state, arrives with
  Moonberry planting, and always settles to the reducer-owned visible pose.
- Moved the first authored placement after real mobile play showed it hidden
  beneath the Home record. The final moth sits in open sky above the Barn roof,
  where it is legible at 390×844 and 360×780 without obscuring Rosie or copy.
- Kept Rive presentation-only: React still owns `nextPlanting`, persistence,
  audio policy, controls, and accessible purpose text. No timer, reward,
  currency, resident collection, or economy was added.
- Updated the companion site to link directly to the **Dusk Moths Arrive lab**.

### Validation evidence

- `npm run verify:rive-homegrown` — pass; 390×844 header and 51 authored names.
- `npm run prototype:homegrown:test` — 13/13 pass, including hidden-before-
  choice and visible-after-Moonberries assertions.
- `npm run prototype:homegrown:build`, `npm run quality:loop`, and
  `npm run quality:check` — pass.
- Rendered Chromium at 390×844 — the moth moved from `hidden` through `arrive`
  to `present` while bed two moved through Plant to Growing; reload restored
  both settled states; five rapid tickles did not disturb the moth; reduced
  motion snapped it to a readable persisted pose.
- Rendered Chromium at 360×780 retained exact viewport and document dimensions
  with no horizontal or vertical overflow; Rosie, moth, Moonberries, Home
  record, purpose sign, action, and navigation remained legible.
- GitHub Pages shipped commit `d2db91d` in successful deployment run
  `31065874147`. The public 390×844 route reported the authored asset `ready`,
  replayed moth state from `hidden` through `arrive` to `present`, settled the
  Moonberries to Growing, and exposed **Play the Dusk Moths Arrive lab** on the
  companion site.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### v0.9.0 — Moonberries Take Root — 2026-08-05

- Replayed the deployed Purpose Sign build at 390×844 and compared it with
  `03-developed-barn.png`. The UI named Moonberries, but the second bed stayed
  a tiny generic sprout and the choice ended without a visible farm response.
- Added a native second-bed Rive crop rig in the paid **Homegrown Adventures**
  project. Purple Moonberry clusters use the existing paper-cut soil language
  while remaining distinct from Clover.
- Added exact Empty and Growing persisted poses plus one short Plant arrival.
  The reducer-owned `nextPlanting` fact selects the pose; Rive owns only the
  bounded visual response and always settles to Growing.
- Made the developed scene start with bed two empty, fill it only after the
  named Moonberry choice, retain it on reload, and snap cleanly under reduced
  motion. No timer, currency, selling, or parallel farming system was added.
- Updated the companion site to link directly to the **Moonberries Take Root
  lab**.

### Validation evidence

- `npm run verify:rive-homegrown` — pass; 390×844 header and 48 authored names.
- `npm run prototype:homegrown:test` — 13/13 pass, including empty-before-choice
  and growing-after-choice assertions for bed two.
- `npm run prototype:homegrown:build` — pass with the corrected authored Rive
  export and content-hashed browser assets.
- `npm run quality:loop` — pass, including TypeScript, layout, sprite,
  security, and 280 focused Jest assertions.
- Rendered Chromium at 390×844 — the choice moved bed two from `empty` through
  `plant` to `growing`; reload retained the purple crop; ten rapid tickles left
  it growing while Rosie settled back to breathing; reduced motion snapped to
  the same readable crop; and browser error logs remained empty.
- At 360×780 the document width stayed 360px, the purpose sign stayed within
  x=210–343, and the primary action stayed within x=18–342. Rosie, all three
  beds, the sign, Home record, primary action, and navigation remained legible.
- Visual comparison with `03-developed-barn.png` confirmed the fixed camera,
  full purple middle bed, and preserved Clover/Glowroot crop contrast.
- GitHub Pages shipped commit `51c805a` from a provenance-checked Pages build.
  The public 390×844 route reported the authored Rive asset `ready`, replayed
  bed two from `empty` through `plant` to `growing`, settled without browser
  errors, and exposed **Play the Moonberries Take Root lab** on the companion
  site.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### v0.8.0 — Purpose Sign — 2026-08-05

- Replayed the public v0.7 developed state at 390×844 and confirmed a direct
  contradiction: the visible illustrated sign said **Grow for: Clover Lunch**
  while the primary action asked the player to grow Moonberries.
- Added one paper-craft DOM sign aligned over the baked lettering. It reads
  **Rosie found · Glowroot Seed** on return, **Grow for · Moonberries** after
  planting, and **Next crop · Moonberries** after the player chooses it.
- Kept the sign reducer-owned and accessible as a polite live status. Product
  text remains out of Rive, while the custom Rive rig continues to own Rosie,
  crops, equipment, and Home motion.
- Replaced the redundant floating next-choice pill with the in-world sign and
  settled the terminal prototype action to a disabled **Moonberries are next**
  state, preventing repeated no-op planting clicks.
- Added a reducer assertion for the settled action and retained persistence of
  the chosen crop without adding currency, inventory pressure, or a new timer.
- Updated the companion site to link directly to the **Purpose Sign lab**.

### Validation evidence

- `npm run prototype:homegrown:test` — 13/13 pass, including the settled next
  crop action.
- `npm run quality:loop` — pass, including TypeScript, layout, sprite,
  security, and 280 focused Jest assertions.
- Rendered Chromium full-loop play at 390×844 — the return ceremony reported
  `glowroot-found`; its compact settle exposed the matching Glowroot sign;
  planting switched to `moonberries-request` while Home flourished; choosing
  switched to `moonberries-chosen` and disabled the settled primary action.
- Reload retained `moonberries-chosen`. Ten rapid tickles left the purpose sign
  and developed Home pose intact; reduced motion showed
  `moonberries-request` with the Rive Home state `reduced`.
- At 360×780 the sign stayed within x=210–343 with document width 360, fully
  covering the stale lettering without obscuring Rosie, crops, Bell, crossing,
  primary action, or navigation. Desktop Chromium at DPR 2 had no overflow or
  console errors.
- GitHub Pages shipped commit `419f1b0` from an explicitly provenance-checked
  Pages build. The public 390×844 route reported Rive `ready`, replayed
  `glowroot-found` through `moonberries-request` to persisted
  `moonberries-chosen`, settled the primary action, and logged no browser
  errors. The companion site exposes **Play the Purpose Sign lab**.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### v0.7.0 — Clear Reward — 2026-08-05

- Replayed the public v0.6 developed state at the actual 390×844 viewport and
  confirmed that the persistent card hid Rosie's right side and all of the new
  Glowroot bed, unlike `03-developed-barn.png`.
- Turned the larger story treatment into a 2.4-second welcome-home ceremony.
  It auto-settles and a tickle dismisses it immediately, preserving tickling as
  the emotional way Rosie reveals what changed.
- Replaced the persistent return/developed card with a compact Home record
  below the HUD. Its real DOM button exposes the full story and Field Guide on
  request, with explicit expanded state and a 70px touch target.
- Made persisted developed states compact from the first frame and made reduced
  motion skip the ceremony entirely. No reducer, reward, timer, or Rive
  progression ownership moved into the presentation layer.
- Retired Variant C's persistent large-card styling; its larger treatment is
  now permitted only during the same bounded welcome-home ceremony.
- Updated the companion site to link directly to the **Clear Reward lab**.

### Validation evidence

- `npm run prototype:homegrown:test` — 13/13 pass.
- `npm run verify:rive-homegrown` — pass; 390×844 header and 45 authored names.
- `npm run quality:loop` — pass, including TypeScript, layout, sprite,
  security, and 280 focused Jest assertions.
- Rendered Chromium full-loop play at 390×844 — return reported `ceremony`,
  auto-settled to `compact` after 2.4 seconds, and tickling collapsed it
  immediately on a second pass. Planting kept the record compact while Home
  moved through `flourish` to `developed`.
- Developed reload began `compact` with the Home rig `developed`; ten rapid
  tickles left both states intact. Reduced motion skipped directly to the
  compact return record.
- At 360×780, document width remained 360px and the compact record stayed
  inside the viewport. Its closed state left Rosie, the Bell, flowering
  crossing, all three beds, primary action, and navigation readable.
- GitHub Pages shipped commit `7d9b0e8`; the public 390×844 route reported the
  authored Rive asset `ready`, replayed the full return ceremony, collapsed on
  tickle, planted into compact/developed state, retained that state after
  reload, and logged no browser errors. The companion site exposes **Play the
  Clear Reward lab**.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### v0.6.0 — Home Remembers — 2026-08-05

- Kept the approved starting Barn plate fixed through the developed state and
  moved the lasting change into the authored Rive scene.
- Added `home_consequence_rig` with a planted Glowroot, flowering hedge
  crossing, earned Hedge Bell, and restrained paper sparkle accents aligned to
  the developed-Barn concept.
- Added persisted Hidden and Developed poses plus one bounded Glowroot Home
  Flourish. The reducer's `hedgeCrossingOpen` fact remains authoritative and
  reload snaps to the correct pose.
- Preserved Rosie's independent breathing/tickle rig, Bag registration, first
  crop lifecycle, DOM-owned copy and controls, and reduced-motion behavior.
- Refined the first render after comparison with `03-developed-barn.png`: the
  draft arch and bell were too heavy, so both were reduced before export.
- Updated the companion site to link directly to the **Home Remembers lab**.

### Validation evidence

- `npm run verify:rive-homegrown` — pass; 390×844 header and 45 authored names.
- `npm run prototype:homegrown:test` — 13/13 pass.
- `npm run prototype:homegrown:build` — pass with content-hashed JavaScript and
  the exact refined Rive binary.
- `npm run quality:check` — pass, including TypeScript, layout, sprite,
  security, and Jest gates.
- Rendered local Chromium at the 390×844 reference layout — reset hid the Home
  rig; the developed transition reported `flourish` then settled to
  `developed`; reload retained it; reduced motion snapped to readable hidden
  and developed poses; and twelve rapid tickles did not disturb the Home state.
- Visual comparison with `03-developed-barn.png` confirmed the fixed camera,
  flowering route, gold Glowroot language, and smaller bell/arch proportions.
- GitHub Pages shipped commit `0b62bdc`; the public route reported the authored
  asset `ready`, moved from `hidden` through `flourish` to `developed`, retained
  that state after reload, and showed no desktop horizontal overflow at DPR 2.
  The companion site exposes **Play the Home Remembers lab**.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### v0.5.0 — Living Barn — 2026-08-05

- Added a native `bed_one_crop_rig` to the paid Tickle the Pig Rive workspace
  and retained its editable source export, vector source, deterministic runtime
  patch, and checked contract.
- Authored persisted empty, growing, and ready poses plus Plant, Ready Flourish,
  and Harvest one-shots. Every one-shot settles back to the reducer-owned pose.
- Kept the starting Barn plate fixed through the first farming loop so crop
  progress changes one Kitchen Patch bed instead of swapping the whole scene.
- Kept beds two and three out of the first loop's progression model and left
  farming timers, purpose, inventory, controls, and accessible copy in React.
- Preserved Rosie's breathing, rapid tickle interruption, Notice, Bag, Pack,
  and Return motion while the crop rig runs independently.
- Corrected the post-harvest story during rendered QA: once the bed is empty,
  the UI now says Clover Lunch is in Rosie's Bag and points toward packing.
- Content-hashed the generated browser bundle URL after rendered QA exposed a
  stale GitHub Pages script cache, so each shipped checkpoint loads its exact
  JavaScript as well as its exact Rive binary.
- Updated the companion site to link directly to the **Living Barn lab**.

### Validation evidence

- `npm run verify:rive-homegrown` — pass; 390×844 header and 42 authored names.
- `npm run prototype:homegrown:test` — 13/13 pass.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene.
- `npm run quality:check` — pass, including TypeScript, 157-file layout gate,
  324 sprite integrity checks, security contracts, and 280 Jest assertions.
- Rendered public Chrome play at 390×844 — reset showed the empty first bed;
  Plant moved through `plant` to `growing`; ten rapid tickles left the crop
  stable; elapsed time moved through `flourish` to `ready`; reload retained the
  ready pose; Harvest moved through `harvest` to `empty`; Pack still equipped
  Rosie's Bag; and reduced motion snapped both Rosie and crop to readable
  reducer-selected poses.
- Visual comparison with `02-first-payoff.png` confirmed the same fixed camera,
  single full Clover Lunch bed, warm paper-cut language, and DOM-owned controls.
- GitHub Pages shipped commits `ff33c19` and `3fe8258`; the companion site
  exposes **Play the Living Barn lab**.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### v0.4.0 — Rosie's Bag — 2026-08-05

- Authored the tan clover satchel as one native `rosie_satchel` vector group,
  matching the approved developed-Barn concept without obscuring Rosie's face.
- Registered the Bag to Rosie's body with offset-preserving translation,
  rotation, and scale constraints so it follows breathing and tickle poses.
- Added exact `Rosie Pack`, `Rosie Return`, and `Rosie Bag Hidden` timelines to
  the checked Rive contract and retained the editable paid-workspace export.
- Made the reducer's persisted `satchelEquipped` fact authoritative: the Bag is
  absent before packing, appears during Pack, survives reload, remains attached
  through rapid tickles, and receives one warm Return emphasis.
- Kept all packing choices, inventory facts, controls, and accessible copy in
  DOM/React. This checkpoint adds no inventory screen, destination, currency,
  or parallel equipment system.
- Updated the companion site to link directly to the **Rosie's Bag lab**.

### Local validation evidence

- `npm run verify:rive-homegrown` — pass; 390×844 header and 36 authored names.
- `npm run prototype:homegrown:test` — 13/13 pass.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene.
- `npm run quality:check` — pass, including TypeScript, 157-file layout gate,
  324 sprite integrity checks, security contracts, and 280 Jest assertions.
- GitHub Pages deployed checkpoint `cd82e0c`; the public runtime reported the
  authored Rive asset `ready` and the companion site exposed the new lab link.
- Rendered desktop Chrome play at the 390×844 reference layout — reset hid the
  Bag; Pack equipped it; ten rapid tickles all restarted cleanly and settled to
  breathing with the Bag registered; Return emphasized it once; reload retained
  the equipped state; and reduced motion stopped character loops without hiding
  the Bag or changing accessible DOM state.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### v0.3.0 — Rosie Notices — 2026-08-05

- Authored `Rosie Breathing Idle` on the foreground rig as a restrained
  one-second rise followed by a 2.25-second restful hold. Rosie now feels alive
  while waiting without becoming a visual metronome.
- Authored `Rosie Notice` as a clear lean toward the Kitchen Patch and layered
  it after the first meaningful tickle, so the character—not a floating panel—
  directs attention to what changed.
- Made breathing, tickle, and notice deterministic and interruptible. Rapid
  tickles restart from a valid pose; every one-shot returns to breathing.
- Honored reduced motion by stopping all authored loops and reactions while
  retaining the same readable game state.
- Lowered the notice story card so it supports rather than obscures Rosie's
  gesture, and retained all accessible product copy and controls in the DOM.
- Added the three exact animation names to the checked Rive contract and added
  a content hash to the published `.riv` URL so GitHub Pages and browsers cannot
  silently reuse an older character export.
- Added a direct **Play the Rosie lab** link to the companion website.

### Local validation evidence

- Rendered Chromium play — authored asset reports `ready`; the 3.25-second
  breathing cadence, single tickle, a ten-tap rapid-input stress pass, clean
  settle, first-return notice lean, and reduced-motion stability were verified
  at the 390×844 reference frame.
- Visual comparison — the starting Barn still preserves the fixed camera,
  Rosie scale, Kitchen Patch, paper-cut scene language, and uncluttered face
  established by `01-starting-barn.png`.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

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

The living consequence now feels present, but the persistent sign and disabled
terminal action still say **Next crop: Moonberries** and **Moonberries are
next** after the crop is growing and its moth has arrived. The next checkpoint
should acknowledge the fulfilled purpose in those existing surfaces—without a
new collection screen, reward, timer, or second Adventure.
