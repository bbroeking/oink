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
11. **v0.12 — Purpose Fulfilled (shipped):** let the Barn sign and terminal action
    acknowledge that the dusk moths are now here instead of describing
    Moonberries as a future intention forever.
12. **v0.13 — Rosie Shares the Moment (shipped):** return the large terminal action to
    Rosie's tickle heartbeat once the moths arrive instead of ending on a
    permanently disabled acknowledgement.
13. **v0.14 — Moth Joins the Laugh (shipped):** let the existing resident give one
    immediate wing response to the fulfilled-state tickle so “with the moths”
    becomes visible causality, not copy alone.
14. **v0.15 — A Shared Glint (shipped):** add one restrained gold glint at the
    resident during Laugh so its correct but tiny roof response reads at phone
    scale without enlarging it, duplicating it, or competing with Rosie.
15. **v0.16 — The Moth Finds Its Place (shipped):** move the resident's calm
    Home pose onto the Barn roofline so the earned relationship remains legible
    between tickles without making the moth larger or adding a new system.
16. **v0.17 — The Moth Comes Home (ready for public verification):** replace
    the resident's in-place arrival fade with one short authored landing from
    the garden-side roof slope to the exact perch, making fulfillment feel
    caused without adding a ceremony or a parallel reward system.
17. **v0.18 — The Whole Day at a Glance (locally verified):** add eleven
    reducer-owned, shareable review positions and a prototype-only Previous /
    Next rail so the approved end-to-end flow can be inspected without waiting.
18. **v0.19 — Rosie Packs Her Way (locally verified):** turn Position 7 into a
    real Provision / Tool / Pack choice with alternatives, empty slots,
    persistence, and a visible departure loadout.
19. **v0.20 — Beyond the Hedge (locally verified):** add one brief causal
    Adventure vignette that shows Rosie, the chosen items, and what each choice
    changed before handing back to the idle Barn wait.
20. **v0.21 — Rosie Brings It Home (locally verified):** turn Position 10 into
    one named Discovery reveal with persistent Seed, Compost, Willow Fiber,
    and preparation recap instead of a generic planting action.
21. **v0.22 — What the Soil Remembers (locally verified):** make Positions
    2–4 spend required Clover Seed, offer optional predictable Compost, show
    both costs before planting, and preserve the resulting duration and yield.
22. **v0.23 — Clover Finds Its Rhythm (locally verified):** turn Position 5
    into a real left → right → up swipe rhythm with accessible buttons,
    guaranteed harvest, one clean-rhythm bonus, and a clear stock result.
23. **v0.24 — Pack What We Grew (locally verified):** make Clover Lunch a
    real one-use Provision, preview its stock cost, preserve reusable equipment,
    and keep an empty-Provision Adventure available when stock is exhausted.
24. **v0.25 — The Farm Remembers (locally verified):** make Glowroot planting
    spend its returned Seed exactly once, enter the changed-Home position, and
    preserve the earned Rive Home, stock, discoveries, and growing crop into
    the next morning.
25. **v0.26 — Home Greets the New Day (locally verified):** make the second
    morning's Seed choice distinguish crops already growing at Home from the
    next usable Seed, and keep that remembered state intact through the
    prototype fast-forward rail.
26. **v0.27 — Rosie Crosses the Hedge (locally verified):** hold Position 8
    for one authored Rive departure, keep the chosen Bag visible, and enter the
    causal Adventure vignette only after React's deterministic handoff.

Depth and polish win over new crops, destinations, currencies, or parallel
systems. Each checkpoint starts with play and ships only after rendered proof.

## Version history

### v0.27.0 — Rosie Crosses the Hedge — 2026-08-06

- Replayed Position 8 into Position 9 and compared it with
  `rosie-v3/08-departure.png`. The packed loadout was clear, but one click
  replaced the entire Barn with the Adventure vignette; Rosie never visibly
  left Home.
- Authored `Rosie Departure` directly in the paid Rive editor on the canonical
  foreground root. The one-second path uses five keyed poses to create three
  restrained step beats, alternating lean, forward travel, and a slight
  perspective reduction while the registered Bag travels with Rosie.
- Kept the complete foreground pose underneath the root-only timeline so the
  same canonical Rosie remains painted throughout the departure instead of
  flashing to a hidden/default rig state.
- Added reducer-owned `departureStartedAt`, `departureReadyAt`, and
  `departureComplete` facts. Starting the Adventure stays on Position 8; a
  deterministic settle moves to Position 9 after the Rive performance. Rive
  never controls the Adventure timer, inventory, story, or stage transition.
- Made in-progress departure serialization explicit. Reload restarts one safe
  bounded performance, old Position 9 saves migrate as already departed, and
  elapsed Adventure settlement still remains idempotent.
- Reduced motion uses a 120 ms handoff without playing the one-shot. The
  existing rapid-transition guard plus reducer stage gate turns a double input
  into one departure.
- Added **Cross the hedge** to the real animation workbench and corrected that
  lab's return-to-Glowroot sequence to use the existing acknowledgement action.
- Updated the companion website to name the full Homegrown Adventures loop and
  link its motion workbench instead of advertising the obsolete v0.17 lab.

### Observable acceptance criteria

- **Explore beyond the hedge** changes the objective to **Rosie is setting
  off**, keeps the loadout visible, and disables competing input for the
  one-second performance.
- Position 8 remains in the DOM and URL throughout the departure; Position 9
  appears only after `departureComplete` becomes true.
- Rosie and her equipped Bag remain visible at desktop and 390×844 touch sizes.
- Reload during the one-shot returns to a valid Position 8 departure and then
  settles once to Position 9.
- Reduced motion reaches the same Position 9 state without showing an
  intermediate animated pose.
- Rapid double-input records one Adventure start and one departure completion.

### Local validation evidence

- `npm run verify:rive-homegrown` — pass; 390×844 header and 54 authored names,
  including `Rosie Departure`.
- `npm run prototype:homegrown:test` — 39/39 pass, including duration,
  early-settle rejection, exact completion, reload restart, legacy migration,
  reduced motion, and idempotence.
- `npm run prototype:homegrown:build` — pass; the player and animation lab use
  the same content-hashed authored Rive binary.
- Rendered Chromium at desktop and 390×844 touch size showed canonical Rosie,
  all three selected Bag items, the disabled in-progress action, visible
  step/lean movement, and one clean handoff to the causal vignette.
- Reload at roughly 280 ms replayed a valid departure and settled to Position
  9. Reduced motion reached Position 9 after its 120 ms boundary. A touch
  double-click produced one `adventure` and one `departure-complete` trace.
- The animation lab exposes **Cross the hedge** and reports the Bag equipped on
  the same reducer-derived state.
- `npm run quality:loop` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

The Farm-to-Adventure handoff now has a readable performance. Position 4 is
the next weakest player-visible moment: the timer and fast-forward work, but
Clover's long growth still reads mostly as one static state. The next
checkpoint should make early sprout, leafy middle, ready flourish, and a calm
idle sway visibly distinct using the existing Rive crop rig, while React keeps
the timer and no-spoil rule.

### v0.26.0 — Home Greets the New Day — 2026-08-06

- Replayed Position 11 through the next morning and compared Position 2 with
  `02-farm-stock-seed-choice.png`. The Farm visibly contained Moonberries and
  Glowroot, while its hard-coded tray simultaneously called Moonberry “Not
  discovered” and omitted Glowroot. The screen contradicted its own world.
- Prototyped three structural hierarchies on the existing `?variant=` route:
  a familiar three-card tray with a memory ribbon, an already-growing ledger
  above the next crop, and a single next-useful-crop path. Rendered comparison
  selected the ledger because it separates persistent beds from spendable
  stock and still explains why Clover matters. The losing variants were removed.
- The canonical second-morning tray now says **Already growing at Home** and
  identifies **Moonberries · Bed 2 · growing** and **Glowroot · Bed 3 · planted**.
  A separate row offers the one actionable Clover Seed, shows the retained
  count, and keeps Compost visible as the optional boost.
- Preserved first-day teaching. A new save still sees the approved Clover /
  unknown Moonberry / Compost tray; only a completed Adventure unlocks the
  remembered-morning hierarchy.
- Fixed the prototype fast-forward rail after it exposed a related reset. A
  new `dayStartFarmStock` snapshot applies each review position's normal stock
  delta to the current day instead of replacing progress with first-day
  inventory. Home facts, discoveries, Bag, and tickle totals travel with it.
- Updated the Rive bridge so the active Clover bed can grow or become ready
  while the persistent Moonberry and Glowroot beds remain visible alongside it.

### Observable acceptance criteria

- After Begin another day and Tickle Rosie, Position 2 names both persistent
  crops and exposes only one obvious **Choose Clover** action.
- Clover Seed and Compost counts match the retained second-day Farm stock.
- Reloading Position 2 retains the memory ledger and its exact counts.
- Two simultaneous Choose inputs advance only to Position 3; they do not plant,
  spend stock, or skip the Compost decision.
- Next fast-forward from Position 3 to Position 4 keeps the changed Home and
  applies one Clover Seed and one selected Compost spend to the day-start stock.
- A first-day Position 2 remains visually and semantically unchanged.

### Local validation evidence

- `npm run prototype:homegrown:test` — 38/38 pass, including second-morning
  serialization, day-start stock, Home-memory fast-forward, and simultaneous
  three-bed Rive state.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene and
  canonical remembered-morning tray.
- Desktop rendering at 1280×900 showed the ledger, Clover and Compost counts,
  canonical Rosie, all persistent Home details, and one Choose action.
- At 390×844, moving the ledger to the concept-aligned lower position kept
  Rosie's whole face, both memory entries, the action row, explanatory line,
  and review rail visible without scrolling.
- Reload preserved the same second-morning DOM and reduced-motion setting.
  Two simultaneous Choose clicks both settled safely on Position 3.
- Fast-forward to Position 4 retained the open hedge, earned bell, growing
  Moonberries, Glowroot sprouts, second-day tickle count, and the new Clover
  growth state. The first-day origin still rendered Moonberry as unknown.
- `npm run quality:loop` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

The persistent loop now reads correctly into day two. The next unmet promise is
motion at departure: Position 8 shows Rosie's packed Bag, but sending her starts
the Adventure vignette without an authored walk or hedge-crossing response.
The Rive contract contains Pack and Return but no Departure action or trigger.
The next checkpoint should make Rosie's chosen loadout visibly leave with her
before the story vignette appears, while keeping React authoritative over the
stage transition and Adventure timer.

### v0.25.0 — The Farm Remembers — 2026-08-06

- Replayed the real Position 10 return through the next morning and compared
  Position 11 with the approved `11-changed-barn-next-day.png` concept. The
  reducer's old Plant action only changed its temporary stage: it spent no
  Seed, stayed on Position 10, and lost the developed Rive Home on a new day.
- Added one persistent `glowrootPlanted` Home fact. Planting now requires the
  acknowledged return and one owned Glowroot Seed, spends `1 → 0` exactly once,
  advances to Position 11, and survives serialization and legacy developed
  saves.
- Made the Rive bridge derive the open hedge, earned bell, visitors, Glowroot
  bed, and existing Moonberry bed from that persistent fact instead of the
  temporary `developed` stage. Beginning another day can reset the active loop
  while leaving the earned Home visibly changed.
- Added the concept's quiet memory explanation to Position 11: **Crops keep
  growing**, **Farm stock remains**, and **Discoveries stay**, followed by the
  actual post-plant stock and one context-sensitive primary action.
- Preserved the already planted Moonberry bed across the day boundary. The
  changed-Home surface now progresses through Grow Moonberries, Tickle Rosie,
  and Begin another day without exposing a competing invisible Rosie or world
  target.
- Added rapid-action guarding for the day-completing tickle and next planting,
  while reducer gates keep repeated Glowroot planting idempotent.

### Observable acceptance criteria

- Position 10 awards one Glowroot Seed; Plant Glowroot cannot run before the
  return is acknowledged or when Seed stock is zero.
- Planting shows Position 11 with Glowroot Seed `0`, Clover Lunch `4`, Compost
  `2`, Materials `2`, and one obvious next action.
- Reloading Position 11 cannot spend another Seed or erase the changed Home.
- Beginning another day returns to Position 1 while the Glowroot, open hedge,
  earned bell, visitors, Moonberry bed, stock, Bag, and discoveries remain.
- The memory panel fits the 390×844 touch viewport and reduced motion remains
  enabled after reload.

### Local validation evidence

- `npm run prototype:homegrown:test` — 38/38 pass, including exact Seed spend,
  return acknowledgement, zero-stock rejection, reload, legacy migration,
  next-day stock and Bag persistence, and persistent Rive bed/Home state.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene and
  updated player bundle.
- The real rendered Position 10 → 11 path at 1280×900 showed the returned Seed
  at `1`, then Position 11 at `0` with the correct remaining `4 / 2 / 2` stock.
  Reload retained the same values and changed Home.
- The rendered next morning returned to Position 1 with the open floral hedge,
  earned bell, Glowroot sprouts, and growing Moonberries still visible.
- At 390×844, the memory promise, Rosie, all three beds, four stock values,
  primary action, and review rail fit in one viewport without scrolling.
- Two simultaneous Plant clicks both settled safely on Position 11 with Seed
  stock at `0`. Reduced motion changed to **Use motion** and remained so after
  a full reload.
- `npm run quality:loop` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

The Farm now remembers visually and mechanically, but the following morning's
Seed tray still presents the original hard-coded discovery state. It does not
acknowledge that Glowroot is known, Moonberries are growing, or the retained
stock came from Rosie's Adventure. The next checkpoint should make the first
post-Adventure crop choice visibly reflect what Home remembers without adding
a new crop or economy.

### v0.24.0 — Pack What We Grew — 2026-08-06

- Replayed Position 6 through departure after the Harvest Rhythm checkpoint.
  The Bag displayed an owned Clover quantity, but packing never changed it, so
  farming still was not actually converted into Adventure preparation.
- Added an exact-once Provision rule. Packing selected Clover Lunch now spends
  one unit and persists `packedProvisionSpent`; repeat or stale Pack actions
  cannot spend again after the stage changes.
- Kept Tools and Packs reusable equipment. The Bag now labels Trowel, Lantern,
  Basket, and Cloth Wrap as reusable instead of implying they are consumables.
- Added cost preview and depletion states. An owned Provision reads `5 → 4`;
  an unowned one reads `0 owned · Grow more or leave empty` and disables the
  main Pack action.
- Preserved the no-failure promise. Leaving Provision empty immediately
  re-enables packing, produces the existing Provision-specific Near-Discovery,
  and never invents or drives stock negative.
- Removed invisible Rosie hit targets from Bag selection and departure so each
  screen exposes only its intended primary action to pointer and assistive input.
- Updated direct departure and later review presets to reflect the spent
  Provision. Inventory and Bag choice still remain reducer-owned and reload-safe.

### Observable acceptance criteria

- Position 7 shows `Clover Lunch 5 → 4` before packing.
- Packing consumes exactly one Clover Lunch; reloading or repeated input cannot
  consume a second unit.
- Tool and Pack choices are visibly reusable and never alter Farm stock.
- At zero stock, selected Clover Lunch cannot be packed, but leaving Provision
  empty keeps `Pack these` available and leads to the kind empty-slot branch.
- Departure retains the exact Bag choice and has no competing invisible action.

### Local validation evidence

- `npm run prototype:homegrown:test` — 36/36 pass, including exact-once spend,
  repeat rejection, reload, zero-stock rejection, empty Provision, representative
  before/after review stock, and every prior loop branch.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene and
  updated player bundle.
- At 1280×900, Position 7 rendered **Clover Lunch 5 → 4**, reusable Tool / Pack
  copy, one **Pack these** action, and no Rosie action behind the panel.
- After packing and reload, returning through the review rail showed **4 → 3**,
  proving one persisted spend. Repeating the cycle to zero rendered a disabled
  **Need Clover Lunch** action and explicit “grow more or leave empty” guidance.
- Choosing **Leave empty** at zero restored **Pack these**. Departure and reload
  both showed **Provision · Empty**, Trowel, Basket, one Hedge action, and no
  hidden Rosie control.
- At 390×844, all three Bag cards, cost/reusable copy, secondary choices, the
  primary Pack action, Rosie, and the fixed rail fit without scrolling.
- `npm run quality:check` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

Preparation now genuinely spends Farm stock. The next end-to-end break is Home
memory: the actual `Plant Glowroot` action neither consumes its Seed nor moves
to Position 11, and beginning the next day can erase the developed Rive Home.
Make Glowroot planting exact, persist the Barn upgrade independently of the
current stage, and prove the changed Home survives the next morning.

### v0.23.0 — Clover Finds Its Rhythm — 2026-08-06

- Compared Positions 5–6 with the approved rhythm and Farm-stock concepts.
  The rendered game still used one ordinary Harvest tap, so the named rhythm
  had no gesture, momentum, accessible equivalent, or visible scoring result.
- Added reducer-owned Clover beats: left, right, then up. Swipe timing is
  bounded to 900ms between beats; the exact sequence earns one extra Clover
  Lunch. A slow or imperfect sequence still completes after three inputs and
  grants the entire base plus Compost harvest.
- Added a real swipe surface over the animated Clover bed and three 44px
  direction buttons as an equivalent keyboard/screen-reader path. Accessible
  buttons score sequence rather than speed, so motor or assistive needs do not
  make the bonus unattainable.
- Added a persistent Position 6 result showing base, Compost, and Rhythm as
  separate causes, followed by the resulting Clover Seed, Compost, and Clover
  Lunch stock. `Gather without rhythm` remains a one-action guaranteed fallback.
- Added a short transition guard after stage-changing actions. Rapid queued
  taps can no longer skip the harvest result and accidentally open Bag
  selection, while rhythm beats and reversible Compost choices stay responsive.
- Fixed review-mode reduced motion so it persists when a direct URL or the
  fast-forward rail changes positions. Locked the mobile player to one portrait
  viewport so focus scrolling cannot reveal a black strip beneath the game.
- Kept scoring, yield, inventory, timing, and persistence in React. Rive still
  receives only the derived Harvest one-shot and resulting empty-bed pose.

### Observable acceptance criteria

- Position 5 shows Clover's exact `← → ↑` pattern beside the visible ready bed.
- Real directional swipes and labeled Left / Right / Up buttons drive the same
  reducer state.
- Clean rhythm adds exactly +1; slow, wrong, or skipped rhythm never loses the
  crop or reduces the guaranteed base/Compost yield.
- Position 6 explains every quantity and keeps one `Prepare an Adventure`
  action. Its result survives reload and cannot be skipped by rapid repeat input.
- Both positions remain readable at 390×844 and 1280×900, with reduced motion
  and the prototype rail intact.

### Local validation evidence

- `npm run prototype:homegrown:test` — 33/33 pass, including clean, wrong,
  slow, fallback, post-completion rejection, exact yield, persistence, and all
  prior farming / Bag / Adventure branches.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene and
  updated player bundle.
- A real browser drag sequence `left → right → up` completed the harvest. Three
  sub-900ms swipes produced **+5** (**3 base +1 Compost +1 Rhythm**); a delayed
  sequence produced **+4** with **Rhythm +0** and no loss.
- The accessible Left / Right / Up buttons produced the same +5 result even
  when automation latency exceeded the swipe window. `Gather without rhythm`
  produced +4 and survived reload at Position 6.
- Concurrent fallback clicks initially exposed a result-skip bug. After the
  transition guard, the same rapid input stayed on Position 6 with one +4
  grant, and reload preserved the result.
- At 390×844, Rosie, the ready crop, swipe target, pattern, accessible controls,
  guarantee, stock breakdown, and fixed rail fit without overflow. Locking the
  portrait viewport removed the focus-scroll strip found during rendered QA.
- Reduced motion remained on when direct review navigation moved Position 6→5.
- `npm run quality:check` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

Goal 2's complete farming loop is now real. The next break in cause and effect
is Position 7: Clover Lunch displays an owned quantity, but packing it does not
preview or spend one unit. Make Provision stock causal—show `5 → 4`, refuse an
unowned Provision without blocking empty-slot Adventures, consume it exactly
once when packing, and keep Tools / Packs reusable equipment.

### v0.22.0 — What the Soil Remembers — 2026-08-06

- Replayed Positions 2–4 against the approved Farm-stock, Plant-and-Compost,
  and Growing concepts. The rendered flow named Clover but created it without
  Seed stock, hid Compost entirely, and gave the player no visible reason to
  save or spend supplies.
- Added three Clover Seeds and two Compost to initial Farm stock. Choosing
  Clover now selects one required Seed, and planting consumes it exactly once.
- Made Compost a visible, reversible choice before planting. Its outcome is
  deliberately predictable: two hours instead of four and four Clover Lunch
  instead of three. Saving Compost preserves both units and keeps the normal
  four-hour, three-item result.
- Added one calm Farm-stock tray, one two-cost planting panel, and one growth
  card that states the timer and the non-spoiling promise without covering the
  animated crop bed. Each position still has one obvious primary action.
- Preserved Farm stock and Rosie's chosen Bag across `Begin another day` and
  deep-merged old prototype saves so the new Seed field does not break reload.
  Rapid repeat planting is reducer-safe; once the first click changes stage,
  later clicks cannot spend the Seed or Compost again.
- Kept state authority in React. The authored Rive scene still receives only
  the derived growing pose and Plant trigger; it never owns costs, timers,
  yields, persistence, or the Compost decision.

### Observable acceptance criteria

- Position 2 shows Clover Seed ×3, unknown Moonberry, Compost ×2, and one
  `Choose Clover` action.
- Position 3 previews Seed 3→2 and Compost 2→1 before a composted planting;
  the player can save Compost and immediately sees the 4h / yield-3 branch.
- Position 4 shows the matching 2h or 4h state, leaves the growing crop visible,
  and explicitly says a ripe crop waits safely until harvest.
- Composted planting consumes one Seed and one Compost and yields four;
  unboosted planting consumes one Seed, no Compost, and yields three.
- The selected branch, remaining stock, reduced-motion preference, and current
  position survive reload. Fast-forward still moves cleanly among Positions
  2–5, and rapid input cannot duplicate a spend.

### Local validation evidence

- `npm run prototype:homegrown:test` — 30/30 pass, including required Seed,
  both Compost branches, exact duration and yield, insufficient stock,
  persistence, rapid repeat selection, and new-day inventory preservation.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene and
  updated player bundle.
- At 1280×900, Position 2 rendered Clover Seed **3 owned**, Compost **2 owned**,
  one **Choose Clover** action, and no competing world action. Position 3
  rendered **3→2**, **2→1**, **Ready in 2 hours · Harvest 4**, and one **Plant
  with Compost** action.
- The browser's unboosted branch changed immediately to **2 stays**, **Ready in
  4 hours · Harvest 3**, and persisted as **Growing normally**. The composted
  branch persisted through reload as **Composted · Ready in 2 hours**.
- At 390×844, the Seed tray, Rosie, animated first bed, growth card, objective,
  and fixed Position rail all remained in one frame without horizontal
  overflow. The growth card was moved over the empty beds after rendered
  comparison showed it obscuring the live Clover bed.
- Concurrent Plant clicks left one valid growing state; the first completed
  and the stale second control disappeared. Previous / Next fast-forward moved
  Position 4→5→4 correctly. Reduced motion persisted through the player UI.
- `npm run quality:check` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

The inputs, growth, and stockpiling reason are now legible, but Position 5 is
still an ordinary tap disguised as a Harvest Rhythm. Implement Clover's
left → right → up gesture with an accessible three-button alternative,
guaranteed base yield, and a small +1 rhythm bonus. Show the gesture and result
in the rendered crop bed without turning a missed beat into crop loss.

### v0.21.0 — Rosie Brings It Home — 2026-08-06

- Replayed the complete and empty-Tool branches from Bag selection through the
  Adventure vignette. The story now promised a concrete Find, but Position 10
  still returned to the ordinary Barn with no reward quantities or causal
  recap.
- Added persistent Farm-stock quantities for Clover Lunch, Glowroot Seed,
  Compost, and Willow Fiber. The complete return grants Seed +1, Compost +1,
  and Willow Fiber +2 exactly once.
- Built one restrained return reveal: a named Discovery card, a three-part
  preparation recap, one practical-supplies strip, and one Welcome action.
  Acknowledging it preserves the rewards and exposes `Plant Glowroot` without
  adding a modal loot grid.
- Kept imperfect preparation useful. A Near-Discovery grants no Glowroot Seed
  but returns Compost +1 and Willow Fiber +1 alongside its specific clue and
  `Adjust Rosie’s Bag` action.
- Kept reward calculation and acknowledgement in the reducer. Rive supplies
  Rosie's return pose and satchel only; DOM copy never decides or duplicates
  inventory changes.

### Observable acceptance criteria

- Position 10 clearly separates one named Discovery from practical supplies.
- The complete branch shows Glowroot Seed +1, Compost +1, Willow Fiber +2, and
  the exact three chosen items.
- Welcome acknowledges the result once, survives reload, and then offers
  Glowroot planting without changing quantities.
- A Near-Discovery shows a useful clue, Compost +1, Willow Fiber +1, and no
  Glowroot Seed.
- The reward screen has one primary action and no horizontal overflow at
  390×844 or 1280×900.

### Local validation evidence

- `npm run prototype:homegrown:test` — 26/26 pass, including exact full-return
  quantities, Near-Discovery supplies without Seed, acknowledgement, and
  persisted Farm stock.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene and
  updated browser bundle.
- At 390×844 the full path rendered **Glowroot Seed +1**, **Compost +1**,
  **Willow Fiber +2**, and the Clover / Trowel / Basket recap with one **Welcome
  Rosie Home** action. Acknowledgement changed that action to **Plant
  Glowroot**; reload retained the acknowledged state and quantities.
- The empty-Tool branch rendered **Useful clue · Glowroot Trail**, Compost +1,
  Willow Fiber +1, and **Adjust Rosie’s Bag** with no Seed card claim.
- At 1280×900 the document measured exactly 1,280 pixels wide with three recap
  entries, one reward action, no competing world action, and no overflow.
  Reduced motion remained enabled. The browser console reported no warnings or
  errors.
- `npm run quality:check` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

The preparation and return halves now explain why farming matters, but the
planting half still grants Clover without required Seed stock and offers no
optional Compost. Implement Positions 2–4 from their concepts: show Farm
stock, consume one Clover Seed, allow Compost to be toggled before planting,
and derive both shorter growth and larger yield from that single persisted
fact.

### v0.20.0 — Beyond the Hedge — 2026-08-06

- Replayed Position 7 through Position 9 with both a complete alternative
  loadout and an empty Pack. Preparation was now clear, but departure still
  removed Rosie and left an empty Barn with a generic return-preview target.
- Added a reducer-owned first Adventure beat. `Continue the story` is now the
  only action until the vignette is acknowledged; only then does the existing
  idle wait and return-preview state begin.
- Added a deterministic Adventure-story projection from the selected Bag.
  Clover Lunch, Trowel / Lantern, Basket / Cloth Wrap, and all three empty-slot
  states each produce one stable cause-and-effect sentence.
- Built one bounded twilight woodland composition over the existing scene.
  The same authored Rosie remains visible; a compact three-tag row explains
  the loadout and one restrained Glowroot card names the Find or clue.
- Kept the vignette out of the Rive/gameplay boundary: React owns story facts,
  action availability, persistence, and outcome; Rive supplies Rosie and the
  equipped satchel. No second explorable map, random roll, or new economy was
  added.
- Preserved the selected Bag and Farm stock when prototype navigation moves
  among Positions 6–11, so review fast-forward replays the chosen branch rather
  than silently restoring the default loadout.

### Observable acceptance criteria

- Position 9 names all three chosen items and states what each enabled.
- Empty Provision, Tool, or Pack keeps the vignette and changes its specific
  story instead of producing failure or blank space.
- Rosie and one clear Continue action remain visible in the same 390×844 frame.
- Continue removes the vignette and returns to the existing quiet Barn wait;
  reload preserves whether the vignette has been seen.
- Review navigation retains the selected loadout across departure, vignette,
  and return positions.

### Local validation evidence

- `npm run prototype:homegrown:test` — 24/24 pass, including deterministic
  full/empty story projection, Continue-to-wait transition, and review
  navigation preserving the loadout.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene and
  updated browser bundle.
- At 390×844 the complete alternative loadout rendered **Clover Lunch — stayed
  exploring until dusk**, **Lantern — followed a hidden gold trail**, and
  **Cloth Wrap — protected its delicate glow**, with Rosie, one Glowroot card,
  and one Continue action visible.
- The empty-Pack branch rendered **No Pack — made a glowing leaf-print** and a
  `near-discovery` result instead of removing the screen. Reload restored the
  same branch and visible vignette.
- Continue removed the vignette, exposed **Preview her return**, and survived
  reload in that quiet waiting state.
- At 1280×900 the document measured exactly 1,280 pixels wide with three cause
  tags, one Continue action, no competing world action, and no overflow.
  Reduced motion stayed enabled through the handoff. The browser console
  reported no warnings or errors.
- `npm run quality:check` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

The vignette now promises a named Glowroot outcome, but Position 10 still
returns to the ordinary Barn with only `Plant Glowroot`. Build the restrained
return reveal from `10-return-discovery.png`: one named Discovery, practical
Compost and Willow Fiber, and a short preparation recap before the changed
Home state. Keep reward calculation in the reducer and avoid a loot grid.

### v0.19.0 — Rosie Packs Her Way — 2026-08-06

- Compared Position 7 with `07-free-bag-selection.png`. The new reducer
  position and `Pack these` action were present, but the rendered game still
  showed only Rosie, the beds, and a generic target—no choices and no reason to
  believe preparation mattered.
- Added a portable Bag model with exactly one Provision, Tool, and Pack slot.
  Clover Lunch is the first Provision; Hand Trowel / Lantern and Wicker Basket
  / Cloth Wrap provide the first testable alternatives.
- Added a calm three-card selection surface over the existing Barn rather than
  a full-screen inventory grid. Each card states one concrete consequence,
  supports Change and Leave empty, and feeds one `Pack these` action.
- Added minimal Farm stock for the harvested Clover Lunch. Position 7 shows
  the owned count without turning the Bag into the Farm inventory.
- Preserved the selected loadout through Position 8 with a restrained ribbon
  while the existing Rive scene equips Rosie's shared satchel.
- Replaced the single missing-Clover fallback with deterministic Provision,
  Tool, and Pack Near-Discoveries. Each branch names what the missing
  capability could have changed and returns to the same Bag choices.
- Added a separate review-state storage key so loadout choices and reduced
  motion survive reload without polluting the ordinary prototype save.

### Observable acceptance criteria

- Position 7 simultaneously shows Provision, Tool, and Pack, with exactly one
  clear `Pack these` primary action.
- Tool and Pack each offer two meaningfully different choices. Any slot may be
  empty and `Pack these` remains available.
- Choices survive reload, remain visible at departure, and are reducer-owned.
- An empty Provision, Tool, or Pack produces a different deterministic
  Near-Discovery and never an empty or punitive failure.
- The Bag screen remains usable without horizontal overflow at 390×844 and
  1280×900; reduced motion and rapid item changes preserve valid state.

### Local validation evidence

- `npm run prototype:homegrown:test` — 21/21 pass, including alternative and
  empty slot validation, reload persistence, three deterministic
  Near-Discovery branches, and departure-state preservation.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene and
  updated browser bundle.
- At 390×844 the rendered Bag screen showed three typed cards, Clover Lunch
  `4 owned`, one Pack action, and the fixed prototype rail without horizontal
  overflow. Changing Tool to Lantern and Pack to Cloth Wrap updated their
  names and consequences immediately.
- Leaving Provision empty survived reload, packed into Position 8 as
  `Empty / Lantern / Cloth Wrap`, and returned the specific objective **A
  Provision could extend the trip**. `Adjust Rosie’s Bag` returned to the same
  three saved choices.
- At 1280×900 the document measured exactly 1,280 pixels wide with three slot
  cards, one Bag-confirm action, no competing world action, and a visible
  prototype rail.
- Four rapid Tool changes under reduced motion settled on one valid Lantern;
  reload preserved both Lantern and the reduced-motion setting. The browser
  console reported no warnings or errors.
- `npm run quality:check` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

The preparation screen now promises meaningful causality, but Position 9 still
removes Rosie and shows the quiet Barn with a generic return-preview target.
Build the bounded beyond-the-hedge vignette from
`09-adventure-vignette.png`: show Rosie, her three chosen items, and one clear
cause-and-effect story before returning Home. Do not add a second map or random
loot system.

### v0.18.0 — The Whole Day at a Glance — 2026-08-06

- Replayed the current browser loop from Rosie's first tickle through the next
  morning and compared it with the approved eleven-screen `rosie-v3` set. The
  player surface had become much calmer, but the prototype still exposed only
  one linear older loop and three coarse developer presets, so the new design
  could not be reviewed position by position.
- Added eleven named progression positions from Morning Tickle through Changed
  Home. Each position is constructed as a valid reducer state rather than an
  animation-only pose.
- Added a prototype-only Previous / Next rail outside the game surface. It
  shows the position number and name, disables Previous at the start, loops
  from Position 11, and keeps the selected position in the shareable URL.
- Split Farm Stock and Bag Selection into distinct reducer steps. Position 6
  now opens preparation; Position 7 owns the `Pack these` action; Position 8 is
  the packed departure state.
- Kept explicit review positions stable. The existing auto-play timer still
  advances an uninterrupted `mode=loop` playthrough, but it no longer moves a
  selected Growing or Adventure position while someone is comparing it with a
  concept.

### Observable acceptance criteria

- Previous / Next can reach all eleven positions in order, and Position 11 can
  loop to Position 1.
- Every position exposes exactly one short player-facing objective and one
  primary action while remaining a valid reducer state.
- Reloading `?position=11` restores Changed Home instead of resetting or
  depending on animation playback.
- The rail remains visible and usable at 390×844 and 1280×900 without causing
  horizontal overflow.
- Reduced motion remains active while rapidly moving between positions.

### Local validation evidence

- `npm run prototype:homegrown:test` — 18/18 pass, including all eleven
  reload-stable presets, the Farm Stock → Bag Selection handoff, and invalid
  position rejection.
- `npm run prototype:homegrown:build` — pass with the authored Rive scene and
  updated browser bundle.
- Rendered browser review reached Positions 1–11 in order. Position 4 remained
  stable instead of auto-advancing; Position 11 survived reload with its URL,
  objective, Loop control, and Changed Home state intact.
- At 390×844 the viewport, body, and document measured exactly 390 pixels wide;
  the rail measured 390×58 and the screen exposed one primary action. At
  1280×900 the document measured exactly 1,280 pixels wide with one primary
  action and no horizontal overflow.
- Reduced motion reported `true` and collapsed CSS animation duration to
  `0.00001s`; five rapid Next presses landed deterministically on Position 6
  with the setting preserved. The browser console reported no warnings or
  errors.
- `npm run quality:check` passed the quality contract, 324-sprite integrity,
  TypeScript, 78 layout tests, and 202 security tests.

### Next highest-leverage weakness

Position 7 now exists and is easy to reach, but the rendered game still shows
only a generic `Pack these` target over the Barn. Build the calm, typed
Provision / Tool / Pack choice surface from `07-free-bag-selection.png`, with
empty slots allowed and at least two meaningful choices, before polishing the
Adventure vignette or adding more content.

### v0.17.0 — The Moth Comes Home — 2026-08-06

- Replayed the exact public v0.16 route at 390×844. The resident finally felt
  attached to the Barn once settled, but fulfillment still faded it in at its
  destination, weakening the visible Moonberry-to-resident causality.
- Re-authored the 21-frame Arrive clip so the same three-piece resident appears
  on the left roof slope, glides up-right, and lands on the exact persisted
  perch. The endpoint also removes a previously hidden sky-to-roof snap.
- Kept every gameplay fact unchanged: same resident, scale, purpose, reward,
  persistence, counter, sound, haptic, economy, and fulfilled-state action.
- Fixed a real Rive WebGL2 reduced-motion edge case. Paused nested scrubs could
  rasterize one wing; the controller now commits the complete authored endpoint
  atomically and pauses before an intermediate frame can be painted.

### Observable acceptance criteria

- Fulfillment starts one intact moth on the garden-side roof slope and hands it
  to Present on the exact v0.16 perch without a sky snap, split shapes, drift,
  duplication, or collision with Rosie and the HUD.
- Reduced motion shows the complete static final resident immediately, with no
  flight or glint; the fulfilled purpose and counter still update normally.
- Five rapid terminal tickles keep one resident and one glint, restart Laugh,
  settle to Present, and resume the independent Resting cadence.
- Reload preserves the resident and fulfilled status. The 360×780 and
  1280×900 layouts remain free of horizontal overflow.

### Local validation evidence

- `npm run verify:rive-homegrown` passed the 390×844 header and all 53 authored
  names. Runtime and published-copy checksum:
  `f3d3e6574660d3ea5304fac149aa59210cb820fff5bf966fe8e9c1915b5f8663`.
- `npm run prototype:homegrown:test` passed 13/13. `npm run quality:check`
  passed the quality contract, 324-sprite integrity, TypeScript, 78 layout
  tests, and 202 security tests.
- Fresh Chromium at 390×844 captured Arrive beginning on the left roof slope,
  then Present at the exact roof perch. Five rapid tickles produced one Laugh
  and one glint at opacity `1`, then one Present resident and opacity `0`.
- A fulfilled reload retained the resident, purpose status, Rosie-first CTA,
  and dormant glint. Reduced motion reported `moth="reduced"`, rendered the
  complete static silhouette, and kept the glint at `display: none`.
- The 360×780 document measured exactly 360 pixels wide; the 1280×900 document
  measured exactly 1,280 pixels wide. Neither overflowed horizontally, and the
  browser console reported no warnings or errors.
- Mobile Safari motion, silhouette, and attachment acceptance remains a manual
  device gate; no distributable build is part of this browser checkpoint.
- Public deployment and exact-route replay remain the final shipment gate.

### v0.16.0 — The Moth Finds Its Place — 2026-08-06

- Replayed the exact public v0.15 binary at 390×844 and compared it with the
  approved developed-Barn concept. The resident's Laugh response read clearly,
  but its calm pose floated beneath the HUD in open sky instead of feeling like
  a creature that had made the Barn its Home.
- Moved the same authored resident 38 pixels down onto the Barn roofline across
  Present, Arrive, Resting, and Laugh. The calm two-pixel Resting lift and the
  stronger three-pixel Laugh lift are preserved and return to one exact perch.
- Moved the single mirrored paper glint beside the new perch, away from the
  compact story card. No resident was enlarged or duplicated, and no action,
  reward, timer, progression fact, persistence, sound, haptic, currency, or
  monetization changed.

### Observable acceptance criteria

- The same resident appears at the Barn roofline after Moonberries, at the same
  scale, and remains completely hidden before fulfillment.
- Arrive hands off to Present without a teleport; Resting and Laugh return to
  the same perch without drift. Five rapid tickles restart one Laugh and one
  glint instead of stacking elements.
- Reload preserves the fulfilled resident and leaves the glint absent. Reduced
  motion uses a static resident, hides the glint, and still updates the tickle
  counter normally.
- The fulfilled status and Rosie-first CTA remain readable at 390×844 and
  360×780; desktop Chromium has no horizontal overflow.

### Local validation evidence

- `npm run verify:rive-homegrown` — pass with all 53 exact authored contract
  names; the runtime binary checksum is
  `daa2e757e6f71c5abc72b89349e89f08ed2978f52f98749c2f974dae1c287914`.
- `npm run prototype:homegrown:test` — 13/13 pass; the generated browser build
  uses the same Rive checksum as the source runtime asset.
- Rendered Chromium at 390×844 showed the intact resident at the roofline in
  Present, the 360ms Arrive frame, the Laugh apex, and the later Resting pulse.
  Arrive settled to Present; five rapid presses kept one glint mounted, then
  returned to Present with opacity `0`; the independent Resting cadence resumed.
- A fulfilled reload kept `data-rive-moths-visible="true"`, one dormant glint,
  and the roof resident. Reset kept the resident hidden before Moonberries.
  Reduced motion reported `data-rive-moth-motion="reduced"`, hid the glint with
  `display: none`, and advanced Tickles Earned from 1,125 to 1,126.
- The 360×780 layout measured exactly 360 pixels wide and the 1280×900 desktop
  layout exactly 1,280 pixels, both without horizontal overflow. `npm run
  quality:check` passed the quality contract, 324-sprite integrity, TypeScript,
  78 layout tests, and 202 security tests.
- GitHub Pages run
  [31074046915](https://github.com/bbroeking/oink/actions/runs/31074046915)
  deployed commit `419216d` successfully. The exact public Rive response
  matched
  `daa2e757e6f71c5abc72b89349e89f08ed2978f52f98749c2f974dae1c287914`.
- A fresh public replay at 390×844 reported authored Rive connected, the
  persisted resident in Present/Resting on the roofline, one dormant glint,
  the fulfilled purpose status, the Rosie-first CTA, and no horizontal
  overflow. Tickle advanced the counter, entered `laugh` with one glint at
  opacity `1`, then returned to the independent Resting cadence with opacity
  `0`.
- The companion page exposed exactly one **Play The Moth Finds Its Place lab**
  link to canonical variant A.
- That public replay selected v0.17: the resident now belongs to the Barn once
  settled, but fulfillment still fades it in at its final coordinates. The
  next bounded checkpoint will author one short landing from the Moonberry
  side to the same perch, preserving size, persistence, reduced motion, and
  every gameplay fact.

### v0.15.0 — A Shared Glint — 2026-08-06

- Replayed the exact public v0.14 binary at 390×844 and compared the fulfilled
  Barn with the approved developed-state concept. The resident entered `laugh`,
  but its roughly 19-pixel roof response was too subtle to read beside Rosie's
  large tickle bounce.
- Added one warm gold paper glint beside the existing moth. The Rive source now
  carries the glint's hidden base and Laugh keys; the web presentation boundary
  mirrors that same `laugh` state with one crisp 22-pixel star so the cue
  survives browser rasterization without enlarging or duplicating the resident.
- The glint is presentation only. It adds no action, counter, reward, timer,
  progression fact, persistence, sound, haptic, currency, or monetization.

### Observable acceptance criteria

- One gold glint appears beside the visible resident only while the existing
  fulfilled-state tickle is in `laugh`, and it is readable at 390×844.
- It disappears completely after settle and reload. Reduced motion never shows
  it, while the counter and ready bank still update normally.
- Rapid presses restart one cue rather than stacking elements. The fulfilled
  status, CTA, Rosie response, moth state, and rest cadence remain intact.
- The 390×844 and 360×780 mobile layouts remain exact with no horizontal
  overflow, and desktop Chromium adds no horizontal overflow.

### Validation evidence

- `npm run verify:rive-homegrown` — pass with the 390×844 header and 53 exact
  authored contract names; the runtime binary checksum is
  `5bc5b3cfef36ac42ccfc29f3d86231da21f3b5075877b70f307b69f03a84e9c1`.
- `npm run prototype:homegrown:test` — 13/13 pass; `npm run
  prototype:homegrown:build` — pass with the authored scene.
- Rendered Chromium at 390×844 showed exactly one gold cue at the laugh apex,
  then opacity `0` after settle and reload. Five rapid presses kept exactly one
  cue mounted, restarted it visibly, and settled to opacity `0`.
- Reduced motion reported `data-rive-moth-motion="reduced"` and `display: none`
  for the cue. The 360×780 layout measured 360 pixels of document width; the
  1280×900 desktop layout measured 1,280 pixels with no horizontal overflow.
- GitHub Pages run
  [31070573112](https://github.com/bbroeking/oink/actions/runs/31070573112)
  deployed commit `befd188` successfully. The public Rive binary matched
  `5bc5b3cfef36ac42ccfc29f3d86231da21f3b5075877b70f307b69f03a84e9c1`
  and contained the exact `Dusk Moths Laugh` contract name.
- Replaying the exact public route at 390×844 reported authored Rive `ready`,
  moth `laugh`, one mounted glint at opacity `1`, 390 pixels of document width,
  and opacity `0` after settle. The companion page exposed exactly one **Play
  the A Shared Glint lab** handoff.
- The public replay selected v0.16: the resident's reaction is now readable,
  but its calm roof pose still feels disconnected from the Moonberries that
  earned it. The next bounded checkpoint will test a quiet Moonberry-side perch,
  preserving Rosie, scale, reward logic, and the existing Laugh response.

### v0.14.0 — Moth Joins the Laugh — 2026-08-05

- Replayed the public v0.13 fulfilled state at 390×844 and compared it with the
  approved developed-Barn concept. Rosie entered `tickle`, but the named moth
  stayed in its ordinary `present` pose throughout, so **with the moths** was
  copy rather than visible causality.
- Added the authored `Dusk Moths Laugh` Rive timeline to the existing resident.
  It starts from Present, lifts three pixels, opens both wings slightly farther
  than the calm rest pulse, and returns every keyed value to its exact starting
  pose in 17 frames.
- A visible moth now restarts that one-shot on Rosie's existing tickle nonce,
  settles after 600 ms, and resumes its independent Resting cadence. No action,
  counter, reward, progression state, sound, haptic, or persistent fact changed.
- Updated the companion site to link directly to the **Moth Joins the Laugh
  lab**.

### Observable acceptance criteria

- A fulfilled-state press immediately puts Rosie in `tickle` and the resident
  in `laugh`; the rendered moth visibly reaches the stronger wing-open pose.
- The one-shot returns to Present without position or rotation drift, then the
  existing Resting cadence resumes. Rapid presses restart rather than stack.
- Reduced motion keeps both authored rigs static while the existing tickle
  counter and ready bank still update.
- The accessible fulfilled status and CTA survive reload. The 390×844 and
  360×780 mobile layouts remain exact with no overflow, and desktop Chromium
  adds no horizontal overflow.

### Validation evidence

- `npm run verify:rive-homegrown` — pass with the 390×844 header and 53 exact
  authored contract names.
- `npm run prototype:homegrown:test` — 13/13 pass; `npm run
  prototype:homegrown:build` — pass with the authored scene.
- Rendered Chromium at 390×844 — one press moved Rosie to `tickle` and the moth
  to `laugh` in the first observed frame; the visible moth reached its authored
  open-wing pose, returned to Present, and resumed Resting.
- Five rapid presses advanced the existing counter five times, left the final
  active states at `tickle` / `laugh`, then settled to `breathing` / `present`
  with `data-rive-moths-visible="true"`.
- Reduced motion advanced 1,135 / 8-of-25 to 1,136 / 7-of-25 while both rigs
  remained `reduced`. Reload preserved the fulfilled status, CTA, resident,
  and static pose.
- Rendered Chromium at 360×780 retained exact viewport, body, and document
  dimensions; the CTA kept matching client/scroll dimensions. At 1280×900,
  the page retained exact horizontal width and both fulfilled surfaces remained
  visible.
- Motion-enabled presses exercised the unchanged sound/haptic path. Mobile
  Safari sharpness, physical haptic feel, and audible acceptance remain manual
  device gates.
- Feature commit `73c53aa` deployed in GitHub Pages run `31068770009`; asset
  copy commit `2e31b52` deployed in run `31069102679`. The final public `.riv`
  SHA-256 exactly matched the authored runtime at `290a3f187c…` and contained
  `Dusk Moths Laugh`, closing an initial generated-copy omission before final
  acceptance.
- Public Chromium at 390×844 against that exact binary confirmed the authored
  scene, fulfilled CTA, status, and resident. One live press moved 1,122 /
  21-of-25 to 1,123 / 20-of-25 while the rendered states changed together to
  `tickle` / `laugh`; a second capture retained the Laugh pose and the resident
  later returned to its independent `resting` cadence.
- The deployed companion page exposed exactly one **Play the Moth Joins the
  Laugh lab** handoff. Replaying the live response also selected v0.15: the
  roof resident is intentionally low priority but its wing response is small
  enough to miss at phone scale, so one temporary authored glint is the next
  highest-leverage visible polish—not another system or persistent resident.

### v0.13.0 — Rosie Shares the Moment — 2026-08-05

- Replayed the public v0.12 fulfilled state at 390×844. The Barn copy was now
  truthful, but the largest action surface ended permanently disabled while
  Rosie remained the emotional heartbeat elsewhere on screen.
- Reused the established tickle action. After Moonberries welcome the moths,
  the primary action is now **Tickle Rosie with the moths** and dispatches the
  same reducer event, authored Rive trigger, counter update, vibration policy,
  and sound-feedback path as every other tickle.
- Added no new reward, trigger, counter, state, or terminal progression. The
  fulfilled sign, Moonberries, resident visibility, and moth cadence remain
  reducer-owned and independent.
- Updated the companion site to link directly to the **Rosie Shares the Moment
  lab**.

### Validation evidence

- `npm run prototype:homegrown:test` — 13/13 pass, including the fulfilled
  primary action resolving to the existing `TICKLE` event.
- `npm run prototype:homegrown:build` and `npm run quality:check` — pass.
- Rendered Chromium at 390×844 — the enabled action was present with the
  fulfilled sign; one press moved Tickles Earned from 1,119 to 1,120 and Ready
  to Tickle from 24/25 to 23/25, put Rosie in `tickle`, and left the visible
  moth in its independent Resting cadence.
- Five rapid primary-action presses restarted Rosie cleanly, settled her to a
  valid idle, and left the moth cadence running. The accessible CTA remained
  enabled and correctly named.
- Reduced motion still incremented the established counter while holding Rosie
  and the moth in static `reduced` poses. Reload preserved the CTA, fulfilled
  sign, Moonberries, and resident.
- Rendered Chromium at 360×780 retained exact viewport, body, and document
  dimensions with no overflow; the CTA remained readable on one line.
- GitHub Pages run `31067710330` deployed feature commit `66877c8`. Public
  Chromium at 390×844 confirmed an enabled **Tickle Rosie with the moths**
  action, the fulfilled-purpose status, and `data-rive-moths-visible="true"`.
  One live press moved 1,119 / 24-of-25 to 1,120 / 23-of-25 and triggered the
  authored Rosie `tickle` motion while the moth remained present.
- The deployed companion page exposed exactly one **Play the Rosie Shares the
  Moment lab** handoff to the current public experiment.
- Motion-enabled primary clicks exercised the unchanged sound/haptic policy.
  Mobile Safari sharpness, haptic feel, and audible acceptance remain manual
  device gates.

### v0.12.0 — Purpose Fulfilled — 2026-08-05

- Replayed the public v0.11 fulfilled state at 390×844. The moth was visibly
  resting and Moonberries were growing, but the sign still said **Next crop:
  Moonberries** and the disabled action still said **Moonberries are next**.
- Kept the exact existing surfaces and made reducer-owned `nextPlanting` close
  the promise: the sign now reads **Purpose fulfilled · Dusk moths** and says
  **Moonberries welcomed them**; the terminal action reads **Dusk moths are
  here**.
- Preserved the pre-choice request and action verbatim, so causality remains
  legible before and after the player chooses Moonberries.
- Added no panel, collection, reward, timer, progression state, or Rive fact.
  This checkpoint only makes the existing Barn acknowledge the truth it already
  renders.
- Updated the companion site to link directly to the **Purpose Fulfilled lab**.

### Validation evidence

- `npm run prototype:homegrown:test` — 13/13 pass, including pre-choice and
  fulfilled primary-action assertions.
- `npm run prototype:homegrown:build`, `npm run verify:rive-homegrown`, and
  `npm run quality:check` — pass; the Rive gate retains 52 authored names.
- Rendered Chromium at 390×844 — before planting, the accessible sign requested
  Moonberries and the action offered to grow them; after planting, the sign and
  disabled action acknowledged the fulfilled purpose while the moth remained
  visible and continued its rest cadence.
- Reload preserved the fulfilled sign/action; five rapid tickles left them
  unchanged; reduced motion kept the same copy with the static moth pose.
- Rendered Chromium at 360×780 retained exact viewport, body, and document
  dimensions with no overflow. The two-line sign eyebrow, title, cause, terminal
  action, Rosie, moth, crops, and navigation remained legible.
- GitHub Pages shipped commit `3fd644e` in successful deployment run
  `31067277238`. The public 390×844 route preserved the pre-choice request,
  changed both existing surfaces to the fulfilled copy after planting, retained
  the visible moth, and exposed **Play the Purpose Fulfilled lab** on the
  companion site.
- The primary planting click exercised the unchanged audio-feedback path.
  Mobile Safari sharpness, haptic feel, and audible acceptance remain manual
  device gates.

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

The player can now share the fulfilled moment with Rosie, but the copy says
**with the moths** while the resident continues only its unrelated ambient
cadence. The next checkpoint should reuse the existing wing-rest motion as one
immediate, bounded response to that tickle—without adding a reward, trigger,
resident state, or parallel interaction.
