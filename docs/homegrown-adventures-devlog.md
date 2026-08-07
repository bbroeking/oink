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
27. **v0.28 — Clover Grows Up (locally verified):** separate newly planted
    sprouts from a lush middle stage, give the living clover one restrained
    authored sway, and keep readiness, reload, and reduced motion reducer-owned.
28. **v0.29 — Harvest in the Garden (locally verified):** replace the large
    rhythm card with one bed-anchored swipe cue, let the authored Rive Harvest
    play unobscured, and reveal Farm stock only after the crop leaves the bed.
29. **v0.30 — The Harvest Has a Home (locally verified):** replace the floating
    stock report with a painterly Farm shelf and full Clover basket while React
    keeps every quantity, cause, and action truthful and accessible.
30. **v0.31 — The Bag Is Open (locally verified):** replace the tall preparation
    form with a physical open satchel, compact typed choices, and visible packed
    objects that respond to every free selection.
31. **v0.32 — Rosie Wears the Choice (locally verified):** keep the native Rive
    satchel visibly equipped through packing, reload, reduced motion, departure,
    and the Adventure handoff instead of letting preparation collapse back into
    labels alone.
32. **v0.33 — The Glowroot Clearing (locally verified):** replace Position 9's
    abstract blurred backdrop with one tangible twilight root alcove, preserve
    live Rive Rosie and the three deterministic causes, and give incomplete
    Bags a visibly different clue-only version of the same place.
33. **v0.34 — The Glowroot Wakes (locally verified):** replace the baked
    successful-branch root with the existing native Rive Glowroot rig, reveal
    it at the clearing's discovery point, and let it breathe without giving
    Rive ownership of the reward branch.
34. **v0.35 — What Rosie Brought Home (locally verified):** replace Position
    10's stacked return cards with a physical Barn-worktable homecoming,
    complete and clue-only object sets, and one observable authored Rive Return
    while React preserves exact rewards and persistence.
35. **v0.36 — The Pond Remembers (locally verified):** give Position 11 one
    fully framed native pond-and-frog consequence, reveal it only on the next
    morning, and keep its calm authored response subordinate to React-owned
    persistence and reduced motion.
36. **v0.36.1 — The Pond Waits for Morning (locally verified):** make Hidden
    the resident group's authored base pose so unrelated crop and character
    input can never reset the pond into an earlier Farm position.
37. **v0.37 — The Pond Belongs Here (shipped):** paint the earned
    pond into the Farm itself, leave only its living frog in Rive, and preserve
    the complete remembered place after **Begin another day**.
38. **v0.37.1 — One Shared Rive Stage (shipped):** move the persistent
    Farm and temporary Glowroot view onto Rive's shared offscreen WebGL2
    renderer so their handoff cannot tear down a live graphics context.
39. **v0.38 — The Crops Belong Here (shipped):** replace the flat
    remembered Moonberry and Glowroot masses with state-bound painterly bed
    art, and repair the ready-Clover reveal gate found during the complete
    rendered replay.
40. **v0.39 — Rosie Makes Room (shipped):** give Changed Home its
    own authored Rosie pose so the earned crops and pond remain readable,
    while the same canonical rig still reacts to the final tickle and returns
    to its normal morning scale on the next day.
41. **v0.40 — The Frog Belongs Here (shipped):** restyle and reduce
    the existing native Rive frog so it sits quietly inside the painterly pond
    instead of reading as an oversized neon sticker, without changing its
    reveal, response cadence, persistence, or progression ownership.
42. **v0.41 — The Hedge Becomes a Doorway (shipped):** layer two
    restrained native Rive foliage backings behind the existing flowering
    crossing so Changed Home reads as a permanent garden arch instead of a
    thin temporary effect, without changing its earned state or progression.
43. **v0.42 — Leaves Make the Doorway (shipped):** break the smooth
    hedge bands into crossed rows of native Rive leaf shapes, keeping the
    established blossom path in front and the same earned Home state beneath.
44. **v0.43 — The Second Seed Has a Home (shipped):** recognize a
    repeated Glowroot return, keep its Seed and practical supplies in Farm
    stock, and finish the Barn day instead of offering an unusable second
    planting action.
45. **v0.44 — The Homecoming Stays in Reach (shipped):** fit the
    complete 390x844 game frame inside short desktop viewports so Position 10's
    one Homecoming action and progression rail remain visible without changing
    the full-size phone layout.
46. **v0.45 — The Stored Seed Stays Visible (shipped):** carry the
    repeated Glowroot reward into the next morning by showing its retained Seed
    count inside the existing planted-Glowroot tile.
47. **v0.46 — Willow Fiber Lines the Pack (shipped):** make
    Cloth Wrap spend one Willow Fiber as fresh packing material, preview the
    exact cost, preserve free alternatives, and keep the remaining stock visible
    through departure and Homecoming.
48. **v0.47 — The Pack Changes the Return (shipped):** make
    Wicker Basket return Compost while Cloth Wrap preserves Clover Seed, keeping
    both existing Packs predictably useful across the next Farm cycle.
49. **v0.48 — The Tool Changes the Bonus (shipped):** make Hand
    Trowel return one extra Glowroot Seed while Lantern returns one extra Willow
    Fiber, preserving the same named Adventure and independent Pack choice.
50. **v0.49 — The Chosen Tool Enters the Story (shipped):** make the
    physical tool in Position 9 agree with Rosie's selected loadout, so Lantern
    no longer changes only labels while a baked Hand Trowel remains in view.
51. **v0.50 — The Chosen Pack Enters the Story (shipped):** make the
    physical Pack in Position 9 agree with Rosie's selected loadout, so Cloth
    Wrap and an empty Pack no longer inherit the baked Wicker Basket.
52. **v0.51 — The Chosen Provision Enters the Story (shipped):** make the
    physical Provision in Position 9 agree with Rosie's selected loadout, so
    Clover Lunch and an empty Provision differ in the world as clearly as their
    cause cards do.
53. **v0.52 — The Chosen Tool Comes Home (shipped):** keep Rosie's
    reusable Hand Trowel, Lantern, or empty Tool physically truthful at the
    Position 10 worktable instead of letting the selected gear disappear into
    the preparation recap.
54. **v0.53 — The Chosen Pack Comes Home (shipped):** keep Rosie's
    reusable Wicker Basket, Cloth Wrap, or empty Pack physically truthful at
    the Position 10 worktable instead of letting the selected carrier disappear
    into the preparation recap.
55. **v0.54 — The Bag Choice Stays in Reach (shipped):** fit Position 7's
    selected slots, one Pack action, and consumable/reusable explanation above
    the progression rail at touch sizes, preserving the open Bag without hiding
    the reason each choice matters.
56. **v0.55 — The Bag Receives the Choice (shipped):** replace Position 7's
    silent token swap with one bounded Rive-authored satchel rise, enlarge,
    settle, and hide response, while React remains authoritative for the chosen
    slot, costs, validity, persistence, and fast-forward.
57. **v0.56 — The Chosen Item Leads the Motion (shipped):** make only the
    most recently changed Provision, Tool, or Pack token lead the shared Bag
    response, so the animation communicates which exact choice just landed.
58. **v0.57 — The Bag Fits Rosie (shipped):** replace Position 8's large, flat
    mustard satchel block with a compact warm-brown worn Bag that preserves
    canonical Rosie's silhouette through departure, Return, and reload.
59. **v0.58 — Rosie Walks Beyond the Hedge (shipped):** replace the current
    front-facing departure slide with a legible walk toward the hedge path,
    including two restrained step cycles and a fitted-satchel counter-swing.
60. **v0.59 — The Hedge Receives Rosie (shipped):** give the end of the
    departure one restrained path or gate response and a readable dusk handoff
    before Position 9 appears, without adding a destination or loading screen.
61. **v0.60 — The Discovery Leads (shipped):** make the newly found
    Glowroot the clear first read in Position 9, with the three truthful Bag
    consequences supporting it instead of competing as equal top cards.
62. **v0.61 — The Homecoming Keeps Focus (shipped):** remove the tiny
    repeated preparation recap from Position 10 so the exact returned stock,
    Rosie, and the one welcome-Home action can breathe after Position 9 has
    already explained causality.
63. **v0.62 — The Seed Finds Its Bed (shipped):** move the existing Plant
    Glowroot moment out of the Barn worktable and into the changed Farm where
    the player can see the Seed enter its lasting bed, without auto-spending it
    or adding another planting system.
64. **v0.63 — Moonberries Find Their Bed (in progress):** give the existing
    Grow Moonberries choice the same spatial clarity by relating it directly to
    the empty middle bed, while preserving the established moth payoff and
    single-action Home sequence.

Depth and polish win over new crops, destinations, currencies, or parallel
systems. Each checkpoint starts with play and ships only after rendered proof.

## Version history

### v0.62 — The Seed Finds Its Bed — 2026-08-07

- Replayed the complete Position 10 Welcome → Plant boundary against
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/10-return-discovery.png`
  and `11-changed-barn-next-day.png`. The reward was clear, but acknowledging
  Rosie left **Plant Glowroot** floating over the indoor return worktable even
  though the Seed's lasting consequence belongs to the outdoor third bed.
- Kept Welcome as an acknowledgement only, then moved the existing explicit
  Plant decision to Position 11. The Farm now names **Bed 3 is ready for
  Glowroot**, anchors one warm action pulse to that empty bed, and previews the
  exact `Glowroot Seed 2 → 1` cost before the player commits.
- Reused the existing authored Rive Home flourish for the planting payoff and
  introduced only a presentation trigger, `plant-glowroot`, so that the
  Glowroot motion cannot accidentally replay Clover's ready flourish. React
  remains authoritative for Seed spending, the planted fact, persistence,
  progression, and the next action.
- Framed three Prototype options: auto-plant on Welcome, keep planting indoors,
  or carry the same explicit choice outdoors. The third passed the installed
  Impeccable product-design review as the available Claude-Design substitute:
  one bed-aligned target, one cost preview, canonical Rosie unobstructed, and
  no added inventory or planting system.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass, including first and repeat
  returns, exact stock deltas, fast-forward, reload, and invalid/rapid input.
- `npm run verify:rive-homegrown` — pass; the checked-in 390×844 scene and 60
  authored names remain valid. `npm run prototype:homegrown:build`,
  `npm run quality:loop`, and `npm run quality:check` also pass, including
  TypeScript, 78 layout tests, 202 security tests, 324 sprite checks, and the
  locked quality contracts.
- Exact 360×780 touch rendering measures a 360×780 document with no overflow.
  The bed action occupies 155–360px by 480–625px, its visible label ends at
  626px, and the progression rail begins at 722px. The pulse sits over Bed 3;
  Rosie, the Farm, cost, action, and rail remain simultaneously readable.
- Welcome reloads into the unspent outdoor decision. Two immediate Plant taps
  spend exactly one Seed, reveal Bed 3's sprout, and expose the unchanged next
  action. Reload preserves the planted Home and exact `2 / 1 / 2 / 2` Farm
  stock. Reduced motion reports `true`, keeps Rive `ready`, and settles directly
  to the same sprout without a one-shot. The rendered run reports no console
  errors.
- Centered desktop and 390×844 reviews preserve the same hierarchy and Farm
  composition. Mobile Safari/device sharpness, haptic feel, and audible
  acceptance remain manual gates; this browser checkpoint does not claim them.
- GitHub Pages run `31209281643` deployed checkpoint `8a934de`. A fresh public
  Position 10 replay fetched CSS `356fd3d535` and JavaScript `3acbb626fc`, then
  Welcome entered **Glowroot at Home** with Rive `ready`, Bed 3 `empty`, and the
  exact `2 → 1` action. Planting changed Bed 3 to `sprout`, played only the Home
  flourish, retained exact `2 / 1 / 2 / 2` stock, and exposed **Grow
  Moonberries**. Reload settled Home to `developed` with the same facts and no
  console errors. The companion site now links **Bring Glowroot to its bed**.

### Observable acceptance criteria

- Welcoming Rosie does not spend Glowroot Seed; it reveals one outdoor Plant
  decision associated with the visibly empty third bed.
- Planting spends one Seed exactly once, reveals the lasting Glowroot Home
  consequence, and survives reload, reduced motion, fast-forward, and rapid
  input.
- The Glowroot planting performance does not fire Clover's plant/ready
  flourish or give Rive ownership of inventory or progression.
- At touch and desktop sizes there is one primary action, no overlapping hit
  targets, and enough open Farm space for Rosie and the planting payoff.
- The next rendered weakness is the existing full-width **Grow Moonberries**
  action: unlike Glowroot, it does not yet point to the empty bed it will fill.

### v0.61 — The Homecoming Keeps Focus — 2026-08-07

- Replayed Position 10 against
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/10-return-discovery.png`.
  The named Find, physical supplies, and exact stock delta were present, but a
  second three-column preparation recap repeated Position 9 in 9px copy and
  compressed the actual reward ledger against the welcome action.
- Removed only that duplicate recap. Position 9 remains the single causal
  explanation; Position 10 now has one job: show what Rosie physically brought
  Home and what was added to persistent Farm stock.
- Promoted the reward surface to one visibly titled **Added to Farm stock**
  ledger with larger quantities and readable wrapping for complete,
  Near-Discovery, alternative Tool / Pack, and repeat-Discovery results.
- Kept canonical Rive Rosie, the authored Return, physical Tool / Pack props,
  reward calculation, two-step Welcome → Plant decision, persistence, and
  reducer transitions unchanged.
- Framed three Prototype options—retain the repeated strip, merge its copy into
  the stock cells, or remove it after Position 9 and promote the ledger. The
  third passed the installed Impeccable product-design review as the available
  Claude-Design substitute: one reward plaque, one stock surface, and one
  primary action, without nested reward cards.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass, including complete,
  Near-Discovery, repeat-Discovery, fast-forward, reload, and idempotent reward
  settlement.
- `npm run verify:rive-homegrown` — pass; unchanged 390×844 Rive header and 60
  authored names.
- `npm run prototype:homegrown:build`, `npm run quality:loop`, and
  `npm run quality:check` — pass, including TypeScript, 78 layout tests, 202
  security tests, 324 sprite checks, and the locked quality contracts.
- Rendered centered 1280×720 replay — complete, missing-Provision, and repeat
  returns each showed the correct plaque, exact three stock results, branch
  action, physical props, and zero duplicate causal strips.
- GitHub Pages run `31207905295` deployed checkpoint `0ee44eb`. A fresh public
  Position 10 load fetched CSS `69e4d553ea` and JavaScript `dd5aa0c880`, reported
  Rive `ready`, exposed one **Added to Farm stock** ledger with the exact
  `+1 / +2 / +2` results, zero former cause strips, and one Welcome action.
  Welcome changed only to **Plant Glowroot**; reload retained that state. The
  companion site exposes **See what Rosie brought Home**.
- Exact 360×780 touch emulation initially exposed a 38px ledger/action
  collision. The compact-height treatment now measures ledger 566–640px,
  action 652–710px, and rail 722–780px with a 360×780 document and no overflow.
- Two immediate welcome taps advance only to **Plant Glowroot**; reload retains
  that acknowledged state; the next deliberate Plant action reaches Position
  11. Reduced motion reports `true`, keeps Rive `ready`, and exposes the same
  welcome state. The rendered run reported no console errors.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### Observable acceptance criteria

- Position 10 contains one named Find, one clearly titled exact stock ledger,
  and one current primary action; it does not repeat Position 9's cause recap.
- Complete, Near-Discovery, and repeat returns retain their exact quantities,
  branch copy, physical objects, and reducer outcomes.
- At 390×844, 360×780, and centered desktop sizes, the ledger, action, and
  progression rail have visible gaps and no overflow or overlapping targets.
- Rapid welcome input cannot skip the explicit Plant decision; acknowledgement
  and the later planted state both survive reload and reduced motion.
- The next rendered weakness is spatial: after Welcome, **Plant Glowroot** still
  appears over the indoor return worktable instead of the outdoor bed that will
  remember the Seed.

### v0.60 — The Discovery Leads — 2026-08-07

- Replayed Position 9 against
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/09-adventure-vignette.png`.
  The deterministic Discovery and three consequences were truthful, but three
  equally framed cards arrived before the named Find and compressed every
  explanation to tiny phone-scale copy.
- Moved the complete or clue-only Find directly below the HUD and increased its
  headline and result treatment. The objective now announces **A new
  Discovery!** or **A promising clue!** without changing the underlying branch.
- Replaced three independent hanging cards with one supporting **How Rosie’s
  bag helped** thread. Every exact Provision, Tool, and Pack consequence remains
  visible, including all three empty-slot Near-Discovery explanations.
- Kept the physical clearing, canonical Rive Rosie, live successful-branch
  Glowroot, one Continue action, reward calculation, timers, persistence, and
  Position 9 → 10 handoff unchanged.
- Framed three hierarchy options through the Prototype skill—equal top cards,
  one cause-first ledger, and Discovery-first with one supporting ledger—and
  selected the third. The rendered screen then passed the installed Impeccable
  product-design review as the available Claude-Design substitute: one first
  read, one supporting surface, one primary action, and no nested card stack.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass, including complete and
  Near-Discovery branches, navigation, persistence, and idempotent settlement.
- `npm run verify:rive-homegrown` — pass; unchanged 390×844 Rive header and 60
  authored names.
- `npm run prototype:homegrown:build` — pass with content-hashed browser assets.
- `npm run quality:loop` and `npm run quality:check` — pass, including
  TypeScript, 78 layout tests, 202 security tests, 324 sprite checks, and the
  locked quality contracts.
- Rendered local browser replay — complete and missing-Provision branches both
  lead with the correct Find, retain three exact causes, expose one Continue
  action, survive reload, and remain readable with reduced motion enabled.
- GitHub Pages run `31206698856` deployed checkpoint `a8efe42`. A fresh public
  Position 9 load fetched CSS `765467f0b7` and JavaScript `2d16b9a651`, reported
  the authored Rive scene `ready`, exposed one Glowroot headline, one three-row
  cause ledger, zero former equal cause cards, and one Continue action. Continue
  entered the existing idle wait and reload retained it. The companion site
  exposes **See Rosie's Glowroot Discovery**.
- Exact 360×780 touch emulation measured a 360×780 document with no overflow;
  the Find, cause thread, Rosie, physical result, Continue action, and
  progression rail were simultaneously visible. Centered 1280×720 rendered the
  full fitted phone with the same non-overlapping hierarchy.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### Observable acceptance criteria

- The first large story surface names the earned Glowroot or promising clue;
  no item consequence has equal visual weight with that result.
- Provision, Tool, and Pack still expose their exact deterministic consequences
  in one consolidated supporting ledger, including empty-slot explanations.
- Complete and Near-Discovery branches retain one Continue action and transition
  to their existing exact Homecoming outcomes without reward or state changes.
- Position 9 remains non-overlapping at 390×844, 360×780, and centered desktop
  sizes, including reduced motion and reload.
- The next rendered weakness is Position 10's tiny repeated cause strip: after
  this screen has established causality, the duplicate recap crowds the exact
  returned stock and welcome-Home action.

### v0.59 — The Hedge Receives Rosie — 2026-08-07

- Replayed the shipped Position 8 → 9 transition against
  `rosie-v3/08-departure.png`. Rosie now walked with a fitted Bag, but the Farm
  still cut directly to the twilight clearing without the crossing answering
  her approach.
- Extended the existing one-second `Rosie Departure` timeline with four late
  rotation keys on `hedge_crossing_flourish 3`: 2.6° at frame 42, -3.8° at
  frame 49, 5.2° at frame 55, and 2.6° at frame 60. Matching opacity keys use
  0% → 100% → 82% → 0%, so only that restrained leaf backing appears during
  the crossing; the later flowering Home reward remains hidden.
- Added one scene-contained dusk wash tied to the observable Rive `departure`
  performance. It stays absent for the first 56% of the walk, settles over the
  lower Farm only as Rosie reaches the path, and yields to the existing
  Position 9 clearing at React's unchanged one-second boundary.
- Added no destination, loading screen, input, timer, reward, or progression
  fact. React still owns departure timing, idempotence, persistence, reduced
  motion, and the Position 8 → 9 transition; Rive owns the walk and foliage
  acknowledgement.
- Ran the rendered transition through the installed Impeccable design gate.
  Review kept the single action and existing HUD, reused the clearing's dark
  green atmospheric palette, introduced no new card or layout, and retained a
  direct reduced-motion handoff.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass, including departure timing,
  direct review, navigation, reduced motion, and idempotent settlement.
- `npm run verify:rive-homegrown` — pass; 390×844 header and 60 authored names.
- `npm run prototype:homegrown:build` — pass with the exact exported Rive scene
  and content-hashed browser assets.
- `npm run quality:check` — pass, including TypeScript, 78 layout tests, 202
  security tests, 324 sprite checks, and the locked quality contracts.
- Rendered local browser replay — direct Position 8 load held breathing with no
  dusk; full motion reported `departure`, made the late leaf response visible,
  and reached one Position 9 vignette; rapid double input stayed idempotent;
  reduced motion reported no performed departure and used the direct handoff.
- GitHub Pages run `31205335697` deployed checkpoint `63164b3`. A fresh public
  replay loaded the authored Rive scene `ready`, held Position 8 with no dusk,
  reported `departure` and a late dusk opacity during the crossing, then
  settled to one Position 9 vignette with no horizontal overflow. The companion
  site exposes **Watch the hedge receive Rosie**.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim those device checks.

### Observable acceptance criteria

- Full motion exposes the existing `departure` performance, reveals one late
  foliage response, darkens only after Rosie's approach, and settles exactly
  once to Position 9.
- Direct Position 8 load and reload show no departure foliage or dusk veil.
- Reduced motion performs no Rive departure one-shot and enters Position 9
  through the existing 120 ms boundary; rapid double input cannot duplicate
  the vignette.
- The Bag remains attached and the sole action, objective, and progression rail
  remain readable without horizontal overflow.
- The next rendered weakness is Position 9's hierarchy: three equally weighted
  cause cards arrive before the named Discovery and are too small to reward a
  phone-scale first read.

### v0.58 — Rosie Walks Beyond the Hedge — 2026-08-07

- Replayed the shipped Position 8 against `rosie-v3/08-departure.png`. The new
  fitted Bag belonged on Rosie, but the departure still relied entirely on root
  translation and scale, so her feet appeared to slide across the grass.
- Preserved the existing 60-frame `Rosie Departure` root path and added six
  keyed rotations to `leg_front_screen_right`: the neutral pose, two alternating
  forward/back contacts, and a final neutral settle. This produces two readable
  steps without changing canonical Rosie's face, body mesh, or game position.
- Added five rotation-only keys to the same native `rosie_satchel`. Its small
  82° → 86° → 79° → 85° → 82° counter-swing stays centered on the fitted pose
  instead of introducing a second Bag asset or independent equipment state.
- Kept the existing one-second reducer boundary, transition copy, and Position
  8 → 9 handoff. Reduced motion still performs no Rive one-shot; rapid double
  input remains idempotent; reload holds the equipped start pose; Previous/Next
  preserves the exact loadout.
- Ran the rendered sequence at 390x844, 360x780, and centered 1440x900 through
  the Impeccable design gate. The motion-specific detector returned no findings,
  and visual review confirmed no overflow, detached Bag, obscured action, or
  competing UI appeared during any step pose.
- The next concept comparison isolates the remaining departure gap: Rosie now
  walks, but the final travel frame cuts directly to dusk without the hedge or
  path visibly receiving her approach.

### Observable acceptance criteria

- `Rosie Departure` exposes at least three visibly distinct leg-contact poses
  while moving toward the existing hedge path; it does not read as a static
  sprite sliding across the Farm.
- The fitted satchel stays attached and visibly counter-swings without changing
  the reducer-owned selected Provision, Tool, or Pack.
- Normal motion exposes one observable `departure` performance and settles once
  to Position 9; rapid double input cannot queue or duplicate the transition.
- Reduced motion records no performed one-shot and moves to Position 9 within
  the existing shortened boundary. Direct Position 8 reload records no replay.
- The complete departure remains readable and non-overlapping at 390x844,
  360x780, and centered 1440x900.

### v0.57 — The Bag Fits Rosie — 2026-08-07

- Replayed Position 8 at 390x844 and compared it with
  `rosie-v3/08-departure.png`. The chosen loadout and equipped fact were correct,
  but the authored mustard satchel was approximately one and a half times the
  intended scale and covered Rosie's lower face and chest like a flat tile.
- Refined the existing native `rosie_satchel` in the paid Rive workspace rather
  than introducing a parallel asset. `Rosie Pack` now settles at `(-58, -58)`,
  112% scale, and 82° rotation; `Rosie Return` shares that endpoint with a
  restrained 112% → 118% → 110% → 112% swing.
- Recolored the same editable vector body, flap, and strap highlight to warm
  brown leather (`#8b5a32`, `#b97845`, `#c28a4b`) while retaining the dark edge
  and clover clasp. The source SVG mirrors those authoring colors.
- Kept `satchelEquipped`, loadout identity, persistence, and transition timing
  in React. Rive still owns only the visible Bag pose and movement, and the
  existing Position 7 `Bag Receive` response remains unchanged.
- Ran the rendered 390x844, 360x780, and centered desktop screens through the
  installed Impeccable design review as the available Claude-Design substitute.
  The Bag now reads as equipment on canonical Rosie, the one-action hierarchy
  remains clear, and the page has no horizontal or vertical overflow at the
  compact touch size.
- Replayed Pack, departure, Adventure, Return, reload, reduced motion, and the
  prior one-item Bag-selection response in the real browser. The next concept
  comparison makes the remaining weakness specific: Rosie still leaves as a
  front-facing slide rather than walking toward the hedge path.

### Observable acceptance criteria

- Position 8 holds one compact warm-brown native Rive satchel on Rosie with the
  exact selected Provision, Tool, and Pack still readable above the scene.
- Pack, departure, and Return never detach, duplicate, enlarge, or hide the Bag;
  direct reload and reduced motion paint the same fitted endpoint without a
  performed one-shot.
- Position 7 still emits one exact `bag-receive` item flight after the Rive
  export changes; the selected slot remains observable and rapid input keeps
  latest-choice-wins behavior.
- The complete Position 8 frame remains readable and non-overlapping at
  390x844, 360x780, and centered desktop sizes.

### v0.56 — The Chosen Item Leads the Motion — 2026-08-07

- Compared the shipped Position 7 response with
  `rosie-v3/07-free-bag-selection.png`. The shared Rive satchel answered, but
  every filled preview token animated together, so the player still had to
  infer which card caused the response.
- Kept slot identity in React as one small `lastBagSelection` fact containing
  the changed slot, new item, previous item, and action time. It survives
  serialization but never becomes a Rive progression property, inventory rule,
  reward branch, or timer.
- During `Bag Receive`, only the changed card remains fully legible. One exact
  item token travels from that card into the open Bag and only the matching
  destination token lands. Choosing Empty reverses the previous item outward
  instead of showing an empty object being packed.
- Removed the old 600 ms pointer lock found during rapid touch QA. A second
  quick choice now replaces the first flight, updates the observable slot, and
  restarts one bounded Rive response instead of being ignored or queued.
- Ran the rendered 390x844, 360x780, and centered 1440x900 screens through the
  installed Impeccable design review. The selected card stays visually awake,
  other cards recede, and an empty slot now uses the short visible action
  `Choose` with its complete item name retained in the accessible label.
- The next concept comparison exposes Position 8 as the highest-leverage gap:
  the selected facts are correct, but the large flat mustard satchel obscures
  Rosie and does not resemble the believable worn Bag in
  `rosie-v3/08-departure.png`.

### Observable acceptance criteria

- Provision, Tool, and Pack changes expose the exact active slot on the Rive
  scene, animate one flight token, and land only that matching Bag preview.
- Emptying a filled slot carries the previous item out of the Bag while the
  reducer-selected empty state appears immediately and remains accessible.
- Rapid Provision-then-Tool touch input leaves one Tool flight and one restarted
  `bag-receive` performance; the latest choice wins without queued clips.
- Reduced motion paints the new selection immediately with no performed
  one-shot. Position 7→8→7 fast-forward and reload preserve the same loadout
  without replaying the flight.
- The complete Position 7 stack remains readable and non-overlapping at
  390x844, 360x780, and centered desktop sizes.

### v0.55 — The Bag Receives the Choice — 2026-08-07

- Replayed Position 7 at 390x844 and proved that reusing `Rosie Pack` was not
  enough: the selection cards covered the lower-body satchel motion, so a valid
  choice still looked like an instantaneous token swap.
- Authored a dedicated `Timeline 28` in the paid Homegrown Adventures Rive
  workspace. The checked-in patch contract names it `Bag Receive`; it keys the
  existing native `rosie_satchel` from a hidden compact pose through one clear
  rise and enlargement, then settles and disappears in 600 ms.
- Added `bag-receive` as a presentation-only motion trigger. `SET_BAG_SLOT`
  remains the single source of truth for slot identity and validity; the Rive
  runtime plays the direct timeline without adding a View Model progression
  property, inventory fact, timer, or reward branch.
- Mirrored that same motion window into the existing open-Bag composition: the
  selector cards step back, the Bag answers, and the currently packed tokens
  land. This keeps the exact item identity in accessible React while Rive owns
  Rosie's live satchel performance.
- Ran the Position 7 surface through the installed Impeccable product-design
  review. Item effects are now short reward lines, each whole slot card is a
  large Change target, and Empty is a separate 44px action. The open Bag and
  one Pack confirmation remain the visual hierarchy.
- The rendered pass now makes the remaining weakness precise: every filled
  token answers together. v0.56 should let only the most recently changed slot
  lead the motion, without adding another selection system.

### Observable acceptance criteria

- Every valid Provision, Tool, Pack, and Empty choice emits exactly one
  observable `bag-receive` performance and settles to the reducer-selected
  loadout.
- Rapid slot changes restart one bounded response rather than queueing clips;
  reduced motion paints the chosen state immediately with no one-shot.
- At 390x844 touch and fitted desktop sizes, the slot controls, open Bag, one
  Pack action, and progression rail remain visible, readable, and non-overlapping.
- Reload and fast-forward preserve the exact selected Bag without replaying or
  changing inventory.

### v0.54 — The Bag Choice Stays in Reach — 2026-08-07

- Replayed the public Position 7 against `07-free-bag-selection.png`. The open
  Bag, physical item previews, and three freely chosen slots were already
  present, but the consumable/reusable explanation sat underneath the fixed
  progression rail at 390x844, and the Pack action collided with that rail on
  a 360x780 touch viewport.
- Kept the same one-column slot treatment and open Bag composition, shortened
  only the redundant explanation, and turned the bottom area into a deliberate
  stack: selected slots, explanation, one Pack action, then progression rail.
- Added one short-touch layout for 820-pixel-and-shorter screens. It lifts and
  compacts the existing Bag stage instead of introducing scrolling, a modal,
  a second confirmation, or a smaller parallel interface.
- This checkpoint changes presentation only. React still owns item choice,
  material costs, Bag validity, inventory, persistence, and fast-forward. The
  existing Rive Pack performance remains unchanged.
- The next public weakness is motion: changing a valid slot instantly swaps a
  static token. The approved concept calls for the Bag to open and receive that
  choice, so the next checkpoint should author one bounded Rive response rather
  than adding another inventory system.

### Observable acceptance criteria

- At 390x844 and 360x780 touch sizes, all three selected slots, the complete
  consumable/reusable explanation, the one Pack action, and the progression
  rail are simultaneously visible and do not overlap.
- At fitted 1280x720 desktop size, the Pack action remains visibly separated
  from the fixed progression rail, with no horizontal overflow.
- Provision, Tool, Pack, empty choices, ownership costs, disabled states, and
  the open Bag remain readable and behave exactly as before.
- Reload, reduced motion, and rapid confirmation preserve one stable Position
  7 or Position 8 state without changing inventory twice.

### Validation evidence

- Local 390x844 render placed the explanation at y=698–707, the Pack action at
  y=714–766, and the progression rail at y=786–844. The approved open Bag and
  all three cards remained visible.
- Local 360x780 render had document width 360: slots ended at y=624, the full
  explanation occupied y=631–640, the Pack action y=657–707, and the rail
  y=722–780. At fitted 1280x720 desktop, the action ended at y=646 and the rail
  began at y=650.
- Reload retained Position 7, its exact explanation, and reduced motion. A
  rapid double Pack attempt advanced exactly once to Position 8 with the same
  Provision, Tool, and Pack. Local browser logs stayed clean.
- `npm run prototype:homegrown:test` — 47/47 gameplay, navigation, inventory,
  reward, fast-forward, and persistence tests passed.
- `npm run verify:rive-homegrown` — the 390x844 artboard and all 59 authored
  names passed; the existing manual mobile-Safari gate remains unchanged.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- Public Pages run `31197119217` shipped feature commit `1b357b8`. The public
  360x780 and fitted 1280x720 replays retained the complete hierarchy and had
  no browser warnings or errors.

### v0.53 — The Chosen Pack Comes Home — 2026-08-07

- Replayed the public return against `10-return-discovery.png` after making the
  chosen Tool physically truthful. The Wicker Basket or Cloth Wrap still
  changed the practical supply correctly, but the reusable carrier disappeared
  from the Barn and survived only as a line in the preparation recap.
- Added one return-only Pack placement behind the worktable's right edge.
  Wicker Basket and Cloth Wrap reuse the exact approved Adventure alpha assets
  at a smaller, darker return scale; an empty Pack leaves the Barn clean.
- React exposes `data-return-pack` from the existing Bag. Rive still owns
  Rosie's authored Return; the reducer still owns Pack choice, practical-supply
  reward, inventory, acknowledgement, persistence, and fast-forward.
- The next public weakness is Position 7's vertical hierarchy. Compared with
  `07-free-bag-selection.png`, the open Bag and three selected slots are present,
  but the explanation is partially covered by the progression rail at 390x844.

### Observable acceptance criteria

- Position 10 physically shows Wicker Basket after a Wicker Adventure, Cloth
  Wrap after a Cloth Adventure, and no carrier after an empty-Pack Adventure.
- Discovery and Near-Discovery branches remain truthful; the physical Pack
  never changes the reducer's existing Compost or Clover Seed reward.
- Pack presentation survives reload and Previous / Next fast-forward. Reduced
  motion paints the stable Pack without its settle animation.
- The Pack remains subordinate to Rosie, returned supplies, reward ledger,
  recap, and the one Home action at 390x844 touch and fitted 1280x720 desktop.

### Validation evidence

- Rendered Wicker Basket, Cloth Wrap, and empty-Pack returns locally. Wicker
  returned Compost, Cloth returned Clover Seed after spending Willow Fiber,
  and empty Pack stayed on its specific Near-Discovery branch without a prop.
- Reload retained Cloth Wrap and its exact background asset. Reduced motion
  computed the Pack animation to `none`; a rapid double Home action advanced
  only once. The return remained readable at 390x844 touch and fitted 1280x720
  desktop, with no local browser warnings or errors.
- `npm run prototype:homegrown:test` — 47/47 gameplay, navigation, inventory,
  reward, fast-forward, and persistence tests passed.
- `npm run verify:rive-homegrown` — the 390x844 artboard and all 59 authored
  names passed; the existing manual mobile-Safari gate remains unchanged.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- Public Pages run `31195386074` shipped feature commit `631c1d7`. A complete
  public second-day loop earned Willow Fiber, selected Cloth Wrap, and rendered
  it at Home; Wicker and empty-Pack replays selected their matching physical
  states. The public console stayed clean. Wicker matched SHA-256
  `e87500fd944ff7aa61b0c9c2e51250b25a2e961ba505ef4609701dfa0efa14f4`;
  Cloth matched
  `813ba9bc097e903a1dadc34ff0ae89ddf547f895bb895e8488f011c4d1a4e93b`.

### v0.52 — The Chosen Tool Comes Home — 2026-08-07

- Replayed the public return against `10-return-discovery.png` after completing
  the physical preparation trio. Position 10 correctly calculated and named the
  Trowel or Lantern bonus, but the chosen reusable Tool vanished when Rosie
  reached the Barn and existed only in the compact recap.
- Added one return-only Tool placement at the left worktable edge. Hand Trowel,
  Lantern, and empty Tool now select independent presentation states while the
  existing Compost, Glowroot Seed, Willow Fiber, reward ledger, recap, and one
  Welcome action remain untouched.
- Used the built-in ImageGen path twice with the approved Return concept as the
  style reference, generating a compact trowel and travel lantern on flat
  magenta keys. Both keys were removed locally; the final tightly cropped alpha
  assets are copied byte-for-byte into the public build.
- React exposes `data-return-tool` from the existing Bag. Rive still owns
  Rosie's authored Return; the reducer still owns equipment choice, exact Tool
  bonus, inventory, acknowledgement, persistence, and fast-forward.
- The next public weakness is the other reusable slot: Wicker Basket or Cloth
  Wrap changes the practical supply, but the selected Pack still disappears at
  the worktable.

### Observable acceptance criteria

- Position 10 physically shows the Hand Trowel after a Trowel Adventure, the
  compact Lantern after a Lantern Adventure, and no Tool prop after an empty
  Tool Adventure.
- Both complete Discovery and kind Near-Discovery returns remain truthful. The
  physical Tool never changes the existing Glowroot Seed / Willow Fiber bonus.
- Tool presentation survives reload and Previous / Next fast-forward. Reduced
  motion paints the stable Tool without its settle animation.
- The Tool remains subordinate to Rosie, the returned supplies, and the one
  Welcome action at 390x844 touch and fitted 1280x720 desktop sizes.

### Validation evidence

- Rendered Hand Trowel, Lantern, and empty Tool returns locally. Hand Trowel
  produced Glowroot Seed +2, Lantern produced Glowroot Seed +1 and Willow Fiber
  +3, and empty Tool stayed on the Near-Discovery branch with no physical prop.
- Reload retained Lantern and its exact background asset. Under reduced motion,
  `data-reduce-motion` remained `true` and the return Tool animation computed to
  `none`. Rapid double Welcome exposed one stable next action; rapid double
  Plant advanced once to Position 11.
- At 390x844 touch, the Tool, Rosie, all returned supplies, reward ledger,
  preparation recap, action, and rail remained visible. At fitted 1280x720, the
  phone ended at 709 px and the primary action at 629 px.
- `npm run prototype:homegrown:test` — 47/47 gameplay, navigation, inventory,
  reward, fast-forward, and persistence tests passed.
- `npm run verify:rive-homegrown` — the 390x844 artboard and all 59 authored
  names passed; the existing manual mobile-Safari gate remains unchanged.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- Public Pages run `31193752321` shipped feature commit `a939e09`. The deployed
  Trowel matched SHA-256
  `47fec2fd04c93652ab459602cee5274c11cf9e6966b6c47fc5eb458651f1f001`;
  Lantern matched
  `4dc75f68bbcc866c626c37ccccb8d9e040cc078bf5f05ddb8e89069a2773bdc3`.
  Public Trowel, Lantern, and empty Tool replays selected the expected physical
  state and produced no browser warnings or errors.

### v0.51 — The Chosen Provision Enters the Story — 2026-08-07

- Replayed the shipped Position 9 against `09-adventure-vignette.png` after the
  Tool and Pack checkpoints. Their cause cards and physical props now agreed,
  but Clover Lunch still existed only as text even though the approved concept
  places the packed meal on the clearing floor.
- Added one compact open Clover Lunch tin at the concept's lower-left ground
  position. The first integration render was rejected because its 142-pixel
  treatment competed with Rosie and crowded the result card; the final
  106-pixel placement stays subordinate and leaves the one-action hierarchy
  intact. An empty Provision leaves that ground clean.
- Used the built-in ImageGen path with the approved Position 9 concept as a
  style reference, generated the opaque lunch tin on a flat magenta key, removed
  that key locally, then tightly cropped and resized the selected alpha asset.
  The source and public copies are byte-identical project assets.
- React exposes `data-adventure-provision` from the existing Bag and mounts one
  presentation-only prop. Rive ownership is unchanged: canonical Rosie, her
  equipped satchel, and Glowroot motion remain authored animation; stock spend,
  duration, branch, rewards, persistence, and fast-forward stay reducer-owned.
- Rapid QA exposed an existing rail bug: two simultaneous Next presses could
  skip Position 10 and land on Position 11. Previous and Next now share the
  existing 350 ms transition guard, so one physical input causes one review
  transition in either direction.
- The next public weakness is Position 10: its recap says reusable Tool, but
  the selected Hand Trowel, Lantern, or empty state is not physically visible
  on Rosie's return worktable.

### Observable acceptance criteria

- Position 9 physically shows the Clover Lunch tin when Clover Lunch is packed
  and no Provision prop when the slot is left empty.
- Provision presentation crosses independently with both Tools, both Packs,
  and empty equipment without changing the deterministic Adventure outcome.
- The selected Provision survives reload and fast-forward. Reduced motion shows
  the stable tin with no settle animation.
- The scene keeps one obvious **Continue the story** action at 390x844 touch and
  fitted 1280x720 desktop sizes. The lunch remains smaller than Rosie and does
  not obscure the live Glowroot, result, or progression rail.
- Two simultaneous Previous or Next presses move exactly one position.

### Validation evidence

- Compared complete Clover Lunch + Hand Trowel + Wicker Basket, alternate
  Clover Lunch + Lantern + Cloth Wrap, and empty-Provision branches in the
  rendered local build. All three independent DOM facts and physical props
  agreed; empty Provision computed to `display: none`.
- Reload retained Clover Lunch + Lantern + Cloth Wrap. Under reduced motion,
  `data-reduce-motion` remained `true` and the Provision animation computed to
  `none`. Rapid double Next held at Position 10; rapid double Previous held at
  Position 9; rapid double story input produced one stable next action.
- The 390x844 touch frame kept the complete cause row, Rosie, lunch tin, Tool,
  Pack, Glowroot result, primary action, and rail visible. At fitted 1280x720,
  the phone ended at 709 px and the action at 629 px.
- `npm run prototype:homegrown:test` — 47/47 gameplay, navigation, inventory,
  reward, fast-forward, and persistence tests passed.
- `npm run verify:rive-homegrown` — the 390x844 artboard and all 59 authored
  names passed; the existing manual mobile-Safari gate remains unchanged.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- Public Pages run `31192668258` shipped feature commit `ac8c4e0`. The deployed
  lunch asset matched SHA-256
  `e67197977d87013cbd626a90fbb5fc0aaeb5a35710421021ef1cf6d70ba714fc`.
  Public complete and empty-Provision replays selected the expected physical
  state and produced no browser warnings or errors.

### v0.50 — The Chosen Pack Enters the Story — 2026-08-07

- Replayed the public Position 9 against `09-adventure-vignette.png` after the
  Tool checkpoint. Hand Trowel, Lantern, and an empty Tool were now truthful,
  but every physical clearing still contained the same Wicker Basket even when
  the player chose Cloth Wrap or deliberately left Pack empty.
- Kept the approved camera, clearing, canonical Rosie, live Glowroot, Bag,
  cause tags, result, and one-action hierarchy. The selected Tool now chooses a
  Pack-free painterly clearing plate; the selected Pack independently chooses a
  registered Wicker Basket, Cloth Wrap, or no overlay. This covers the full
  three-by-three Tool / Pack matrix without creating nine scene variants.
- Used ImageGen as a precise asset-production step: two edits remove only the
  baked Basket and reconstruct the occluded path, and two matched object studies
  supply transparent Basket and Cloth overlays. The final four source assets
  live beside the prototype and are copied byte-for-byte into the public build.
- React exposes `data-adventure-pack` from the existing Bag and mounts one
  presentation-only prop. Rive ownership is unchanged: canonical Rosie, the
  equipped satchel, and Glowroot motion remain authored animation; inventory,
  selection, rewards, persistence, fast-forward, and the Adventure branch stay
  reducer-owned.
- The next public weakness is the remaining member of the preparation trio:
  Provision changes the cause card and duration, but the clearing has no
  equally clear physical Clover Lunch / empty-Provision distinction yet.

### Observable acceptance criteria

- Position 9 physically shows the Wicker Basket after choosing Wicker Basket,
  the folded Cloth Wrap after choosing Cloth Wrap, and no Pack prop when the
  player leaves Pack empty.
- Pack presentation crosses independently with Hand Trowel, Lantern, and an
  empty Tool. It never changes the already-approved Pack reward rules.
- The selected Pack survives reload and Previous / Next fast-forward, remains
  subordinate to Rosie and the one **Continue the story** action, and fits both
  390x844 touch and fitted 1280x720 desktop layouts.
- Reduced motion paints the selected Pack without its settle animation. Rapid
  duplicate story input remains idempotent, and empty-Pack Adventures remain
  kind, useful Near-Discoveries.

### Validation evidence

- Played the rendered second-day loop to earn Willow Fiber, then compared
  Wicker Basket + Hand Trowel, Cloth Wrap + Lantern, empty Pack + Lantern, and
  Wicker Basket + empty Tool at Position 9. Every DOM presentation fact and
  physical prop agreed; empty Pack computed to `display: none`.
- Reload retained Wicker Basket + empty Tool. With reduced motion active,
  `data-reduce-motion` remained `true` and the Pack animation computed to
  `none`. Two simultaneous **Continue the story** clicks and two simultaneous
  **Preview her return** clicks each resolved to one stable next action.
- At fitted 1280x720 desktop, the complete game frame, primary action, and
  progression rail remained visible. The earlier 390x844 touch replay kept all
  three cause cards, the physical Pack, result, action, and rail legible.
- `npm run prototype:homegrown:test` — 47/47 gameplay, navigation, inventory,
  reward, fast-forward, and persistence tests passed.
- `npm run verify:rive-homegrown` — the 390x844 artboard and all 59 authored
  names passed; the existing manual mobile-Safari gate remains unchanged.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- Public Pages run `31191284325` shipped feature commit `051f4ce`. The deployed
  Wicker asset matched SHA-256
  `e87500fd944ff7aa61b0c9c2e51250b25a2e961ba505ef4609701dfa0efa14f4`;
  Cloth matched
  `813ba9bc097e903a1dadc34ff0ae89ddf547f895bb895e8488f011c4d1a4e93b`.
  The public rendered replay selected the new Wicker URL, showed the physical
  Basket beside the live clearing, and produced no browser warnings or errors.

### v0.49 — The Chosen Tool Enters the Story — 2026-08-07

- Replayed the public Lantern branch against `09-adventure-vignette.png` and
  found that its cause card and reward were correct while the physical clearing
  still showed the baked Hand Trowel. The Tool choice changed numbers and copy,
  but not the world Rosie occupied.
- Kept the existing clearing, camera, Glowroot performance, Bag, destination,
  story branch, and rewards. React now exposes only the selected Tool as a
  presentation fact: Hand Trowel keeps the approved plate, Lantern selects one
  matched painterly plate, and an empty Tool selects the clean clue plate.
- Used ImageGen to replace only the lower-right Trowel with a compact closed
  brass travel Lantern. The first generated treatment was rejected because it
  became a large foreground prop; the selected treatment stays at the original
  Tool footprint with one restrained glow and no added character, reward,
  control, text, or scene object.
- Kept Rive ownership unchanged. Canonical Rosie, her Bag, and the live
  Glowroot remain authored animation; React still owns equipment selection,
  the deterministic Adventure branch, inventory, reward calculation, copy,
  persistence, and fast-forward.
- The first public replay exposed a review-rail contradiction: an empty
  Provision showed the correct clue at Position 9, but continuing inherited
  Position 10's successful preset. Fast-forward now derives Provision spending,
  underpreparation, clue reason, and exact clue supplies from the selected Bag;
  two regression tests cover both continued and direct Return review paths.
- Updated the companion site to send players directly to **Choose Rosie’s
  Tool** in the existing Bag step.

### Observable acceptance criteria

- Position 9 physically shows a Hand Trowel after selecting Hand Trowel and a
  small brass Lantern after selecting Lantern; it never shows both.
- Leaving Tool empty produces the clean clearing with no stray equipment, and
  a selected Lantern remains visible in both a complete Discovery and a kind
  clue-only Adventure.
- The selected Tool survives reload and Previous/Next fast-forward. Its existing
  Trowel Seed or Lantern Fiber reward remains unchanged through Return and the
  remembered next morning.
- The treatment remains subordinate to Rosie, the live Glowroot, and the one
  **Continue the story** action at 390x844 touch and fitted 1280x720 desktop.
- Reduced motion, rapid duplicate input, and all empty-slot routes remain safe;
  no Rive progression input, item, crop, destination, currency, or state field
  is added.

### Local validation evidence

- Played a fresh Lantern loop from the first Tickle through Seed choice,
  Compost planting, growth preview, left-right-up Harvest, Bag selection,
  authored departure, physical Lantern clearing, Return, Glowroot planting,
  Changed Home, fulfilled tickle, and **Begin another day**. Position 10 showed
  **Glowroot Seed +1**, **Willow Fiber +3**, and **Compost +1**; the next morning
  retained Fiber 3 and every established Home consequence.
- At 390x844, compared Hand Trowel, Lantern, empty Tool, and a Lantern
  Near-Discovery. Each DOM presentation fact selected its exact plate; the
  empty branch used the clean clearing and every browser log was empty.
- At fitted 1280x720 desktop, the complete Adventure frame, primary action,
  and prototype rail remained inside the first viewport. Reload retained the
  Lantern at Position 9. Reduced motion kept the Lantern visible while all Rive
  motion channels reported `reduced`. Two simultaneous story clicks resolved
  to one stable **Preview her return** action.
- `npm run prototype:homegrown:test` — 47/47 gameplay, navigation, and
  persistence tests.
- `npm run verify:rive-homegrown` — 390x844 artboard and all 59 authored names.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- An isolated tree reconstructed from `HEAD` plus the staged checkpoint
  installed all 1,304 packages offline, passed 47/47 tests and
  `npm run verify:rive-web`, and reproduced CSS
  `3d7fd732c217cc0e28a355daea835b269bf347fcb21a6a59f836ff1e2bc6f9e7`,
  player `c9346fd606865526bccb3f5544dbbe272175a70438f342583b1aaef3837cc776`,
  animation lab
  `033a150905a66502c9eb6eeb74c8d5588a54bebcca1caf67547eb19ed040edc4`,
  and Lantern plate
  `66bd9f4db30d43712bce816ff7b8121dce9a54d6848fecec0490e519858f0a74`
  exactly. The authored Rive remained
  `0f2e966d04cb66f8827ee1268eefe44b9b080ba66a963bf9020e4be86b9f2fc1`.

### Public deployment evidence

- Feature checkpoint `e8e8581` and review-causality fix `621982c` shipped from
  `main` in successful Pages runs `31188388511` and `31189221872`.
- The final public HTML selected CSS `3d7fd732c2` and player `c9346fd606`;
  their full SHA-256 hashes exactly matched the isolated build. The animation
  lab matched `033a150905a66502c9eb6eeb74c8d5588a54bebcca1caf67547eb19ed040edc4`,
  the Lantern plate matched
  `66bd9f4db30d43712bce816ff7b8121dce9a54d6848fecec0490e519858f0a74`,
  and the authored Rive remained
  `0f2e966d04cb66f8827ee1268eefe44b9b080ba66a963bf9020e4be86b9f2fc1`.
- At 390x844, public Hand Trowel, Lantern, and empty-Tool replays selected the
  Trowel, Lantern, and clean clearing plates exactly. Lantern also remained
  physical on a clue-only Adventure and after reload. All public browser logs
  were empty.
- The first public clue continuation exposed the successful-preset mismatch;
  after the fix deployed, the same empty-Provision + Lantern + Wicker path
  returned **Useful clue**, **Compost +1**, **Leaf-print clue Found**, and
  **Willow Fiber +1**, with no Glowroot Seed claim.
- The companion site now exposes **Choose Rosie’s Tool** beside the full-loop
  link.

### Next highest-leverage weakness

- With Lantern and Cloth Wrap selected, Position 9's causal cards correctly say
  **Lantern** and **Cloth Wrap**, but the generated clearing still physically
  contains its Wicker Basket. The next checkpoint should make Wicker, Cloth,
  and empty Pack selections agree with the scene using registered painterly
  art, without changing rewards, inventory, destination, or Rive progression.

### v0.48 — The Tool Changes the Bonus — 2026-08-07

- Replayed both Pack branches and found the next dominated choice at Position
  7: Hand Trowel and Lantern changed the story tag but converged on the same
  Glowroot Seed, Willow Fiber, and practical Pack supply.
- Kept the single Glowroot Adventure and changed exactly one existing bonus.
  Hand Trowel now uncovers a second Glowroot Seed; Lantern follows a trail to a
  third Willow Fiber. Wicker or Cloth still decides the independent practical
  supply. No item, crop, destination, currency, state field, or Rive progression
  input was added.
- Carried the Tool through the Bag effect, Adventure cause, return plaque,
  three-column ledger, physical worktable crop, Changed Home stock, and the next
  retained-Seed state. Prototype Previous/Next navigation now applies the
  selected Tool, Pack reward, and Cloth lining cost exactly in both directions.
- Rendered validation also exposed two presentation defects. Short-desktop
  focus could programmatically scroll the transformed phone, so that container
  now uses non-scrollable clipping. Rive now resynchronizes its drawing surface
  on a live viewport change, preventing Rosie from retaining stale geometry
  after desktop-to-touch resizing.

### Observable acceptance criteria

- Position 7 says **Uncover 1 extra Glowroot Seed** for Hand Trowel and **Follow
  a trail to 1 extra Willow Fiber** for Lantern.
- A complete Trowel return shows **Glowroot Seed +2** and **Willow Fiber +2**;
  planting the first Glowroot leaves one Seed in Farm stock.
- A complete Lantern return shows **Glowroot Seed +1** and **Willow Fiber +3**;
  planting consumes that Seed while retaining the extra Fiber.
- Pack effects remain independent, all quantities survive reload, and
  fast-forwarding forward or backward preserves the selected loadout exactly.
- Touch, fitted 1280x720 desktop, reduced motion, live resizing, and rapid
  duplicate acknowledgement remain safe and visually complete.

### Local validation evidence

- At 390x844, played Trowel from Bag through the live Adventure and Homecoming.
  The visible thread read **Uncover 1 extra Glowroot Seed → uncovered a second
  glowing Seed → Glowroot Seed +2 → Glowroot Seed 1** after planting. Reload
  retained the complete Changed Home stock and the browser log was empty.
- Selected Lantern at Position 7 and used the prototype rail through Position
  10. The return read **followed a trail to extra Willow Fiber**, **Glowroot Seed
  +1**, and **Willow Fiber +3**; Position 11 retained Fiber 3 after planting.
- At 1280x720, the 328x709 phone and complete prototype rail remained inside the
  first viewport after Previous/Next focus. Resizing that live scene to 390x844
  kept canonical Rive Rosie registered without reload.
- The first public visual replay made the vector bonus markers look detached
  from the painterly worktable. Replacing them with tightly registered crops of
  the existing Homecoming Seed and Fiber art kept the exact plate texture and
  made both bonus objects belong to the scene.
- Two simultaneous **Welcome Rosie Home** clicks both fulfilled but advanced to
  one acknowledged reward and one Plant action. Reduced motion reported the
  Rosie, Crop, and Home Rive channels as `reduced`; all rendered browser logs
  were empty.
- `npm run prototype:homegrown:test` — 45/45 gameplay, navigation, and
  persistence tests.
- `npm run verify:rive-homegrown` — 390x844 artboard and all 59 authored names.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- An isolated tree reconstructed from `HEAD` plus the staged checkpoint
  installed all 1,304 packages offline, passed 45/45 tests and
  `npm run verify:rive-web`, and reproduced CSS
  `7166175dc2b35571a4d3a9ffd86504c37545495844b04d11536a6a836914edbc`,
  player `59e02e4946539ccaad4da126da596365d66ddf1f55e514d9a6118758c89b612d`,
  and animation-lab
  `dc7051a68c5bfb0c9abeec719b4180872b0d26ab6043479d931b43c8fc549a39`
  exactly.

### Public deployment evidence

- Feature checkpoint `799ec05` and painterly-object refinement `b90d85f`
  shipped from `main` in successful Pages runs `31185196877` and
  `31185857961`.
- The final public HTML selected CSS `7166175dc2` and player `59e02e4946`;
  their full SHA-256 hashes exactly matched the isolated build. The authored
  Rive remained SHA-256
  `0f2e966d04cb66f8827ee1268eefe44b9b080ba66a963bf9020e4be86b9f2fc1`.
- At 390x844, the public Trowel branch showed the second painterly Glowroot
  nest on the table, **Glowroot Seed +2**, **Willow Fiber +2**, and **Compost
  +1**. The public Lantern branch showed the added painterly Fiber coil,
  **Glowroot Seed +1**, **Willow Fiber +3**, and **Compost +1**. Both causal
  recaps agreed with the selected Tool and both browser logs were empty.

### Next highest-leverage weakness

- Position 9's cause cards correctly say **Lantern**, but the approved clearing
  plate still physically contains its baked Hand Trowel and never shows the
  Lantern. The next checkpoint should make the existing Tool choice visible in
  the scene itself—using registered painterly art and no new reward, item,
  destination, state field, or Rive-owned progression decision.

### v0.47 — The Pack Changes the Return — 2026-08-07

- Replayed the public Fiber-backed loop and found that Cloth Wrap had acquired
  a truthful cost but still produced the same practical return as free Wicker
  Basket. The new choice was understandable but materially dominated.
- Kept Glowroot Seed and Willow Fiber as common successful-Adventure rewards,
  then changed exactly one existing practical supply. Wicker Basket now brings
  **Compost +1** for faster growth and a larger guaranteed harvest; Cloth Wrap
  spends one Fiber and preserves **Clover Seed +1** for another required
  planting. No new item, currency, recipe, destination, or state field exists.
- Carried the choice through the existing Bag effect line, causal Adventure
  tag, three-column return ledger, physical worktable, Home shelf, and next Seed
  choice. The Cloth branch adds one small painterly seed pouch at the registered
  table position so the object and quantity agree without changing the Rive
  scene or replacing the Homecoming plate.

### Observable acceptance criteria

- Wicker Basket says **Bring Home 1 Compost** and a successful return adds one
  Compost without adding Clover Seed.
- Cloth Wrap says **Willow Fiber 2 → 1 · Protect 1 Clover Seed** and a successful
  return adds one Clover Seed without adding Compost; the common Glowroot Seed
  and Willow Fiber rewards remain unchanged.
- The chosen supply is named in the Adventure cause, rendered on the worktable,
  listed in the Return ledger, retained at Home, and visible in the next planting
  decision.
- Both branches survive reload, fast-forward, reduced motion, simultaneous
  input, touch, and the fitted 1280x720 desktop layout.

### Local validation evidence

- At 390x844, replayed the stocked Cloth branch from Bag through Adventure,
  Return, Changed Home, and the next Seed choice. The visible thread read
  **Protect 1 Clover Seed → Clover Seed +1 → Clover Seed 2 → 2 owned**; the
  Home shelf and planting card agreed after reload.
- Replayed Wicker through the prototype fast-forward rail with reduced motion
  active. Position 10 showed **Compost +1**, the cause **carried fresh Compost
  with the seed**, and the unchanged common rewards. At 1280x720 the complete
  328x709 game frame remained inside the first viewport.
- Two simultaneous Home acknowledgement clicks resolved to one retained reward,
  both local browser logs were empty, and the approved Bag, Return, and Changed
  Home concepts retained their one-action hierarchy.
- `npm run prototype:homegrown:test` — 44/44 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390x844 artboard and all 59 authored names.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- An isolated tree reconstructed from `HEAD` plus the staged diff installed all
  1,304 packages offline, reproduced the checked-in player and animation-lab
  artifacts exactly, and passed `npm run verify:rive-web`.

### Public deployment evidence

- Feature checkpoint `ebd5672` and its checkpoint record shipped from `main` in
  successful Pages run `31183119741`.
- The public HTML selected CSS `972bb245db` and player
  `019e24d52e`; their full SHA-256 hashes exactly matched the isolated build.
  The authored Rive remained 297,820 bytes with SHA-256
  `0f2e966d04cb66f8827ee1268eefe44b9b080ba66a963bf9020e4be86b9f2fc1`.
- At 390x844, replayed Cloth from the stocked Bag through the live Adventure,
  Homecoming, reload, Changed Home, and next planting decision. The return
  showed the seed pouch, **Clover Seed +1**, and **protected one Clover Seed
  beside the glow**; Home retained the Seed and Position 2 offered it as
  **1 owned**. The zero-to-one public preset complements the one-to-two local
  replay and proves both acquisition and accumulation.
- Replayed Wicker from Position 7 through the public fast-forward rail. The
  return showed **Compost +1** and **carried fresh Compost with the seed** after
  reload. Both public browser logs were empty.

### Next highest-leverage weakness

- The Pack slot now changes a predictable practical supply, but the Tool slot
  remains mostly flavor: Hand Trowel and Lantern still converge on the same
  Discovery and reward. The next checkpoint should make the existing Tool
  choice alter one deterministic part of the Adventure result without adding a
  destination, currency, or parallel system.

### v0.46 — Willow Fiber Lines the Pack — 2026-08-07

- Followed the named Willow Fiber reward from the return worktable into the next
  Bag cycle. The stock persisted and accumulated, but Position 7 exposed no use
  for it; Cloth Wrap was a free alternative whose protection copy had no Farm
  cost or preparation consequence.
- Kept Cloth Wrap reusable while making each departure spend one Fiber as fresh
  protective lining. Selection requires available Fiber but consumes nothing;
  **Pack these** spends exactly one Fiber once. A stale unavailable selection is
  refused by the reducer rather than silently creating negative stock.
- Named Willow Fiber in the existing Farm shelf and Home memory, previewed its
  exact before-and-after quantity on Cloth Wrap, and carried the remaining count
  into the existing departure ribbon. Wicker Basket stays free, leaving Pack
  empty stays valid, and no crafting screen, currency, recipe, or new state
  field was added.

### Observable acceptance criteria

- With zero Willow Fiber, Wicker Basket remains selected, **Needs Fiber** is
  disabled, and the player may still pack Wicker Basket or leave Pack empty.
- With two Fiber, selecting Cloth Wrap shows **Willow Fiber 2 → 1**, packing
  advances to Departure with **Pack · Fiber 1**, and reload does not spend it a
  second time.
- The Adventure says Cloth Wrap **protected its delicate glow**; the return adds
  two Fiber, and Changed Home shows three after the one spent before departure.
- Touch and short-desktop layouts remain readable; reduced motion, fast-forward,
  reload, and simultaneous input preserve one deterministic stock change.

### Local validation evidence

- Replayed the first Bag at 390x844 and confirmed the zero-Fiber lock left
  **Pack these** available with Wicker Basket. Continued through Changed Home,
  began another day, selected Cloth Wrap at two Fiber, and observed the exact
  `2 → 1 → +2 → 3` stock thread across Bag, Departure, Adventure, Return, and
  Home memory.
- Reload at Departure retained **Pack · Fiber 1**. At 1280x720 the fixed game
  frame measured 328x709 at x=476/y=0 and kept the complete action and rail in
  the first viewport. Reduced motion remained active through fast-forward, and
  two simultaneous Pack clicks both resolved while the rendered trace recorded
  one Pack action.
- `npm run prototype:homegrown:test` — 43/43 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390x844 artboard and all 59 authored names.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- An isolated tree reconstructed from `HEAD` plus the staged diff installed all
  1,304 packages offline, reproduced the checked-in player and animation-lab
  artifacts exactly, and passed `npm run verify:rive-web`.

### Public deployment evidence

- Shipped commit `3a536ae` through GitHub Pages run `31181286644`.
- The public game loaded `homegrown-adventures.css?v=bdb4d269f2` and
  `homegrown-adventures.js?v=b5b3156b19`; both public files matched their
  checked-in SHA-256 values. The unchanged 297,820-byte Rive scene matched
  `0f2e966d04cb66f8827ee1268eefe44b9b080ba66a963bf9020e4be86b9f2fc1`.
- At 390x844, replayed the public first-day zero-Fiber fallback, completed the
  first return, began another day, selected Cloth Wrap at **2 → 1**, reloaded
  Departure at **Pack · Fiber 1**, and followed its **protected its delicate
  glow** cause through the repeated return. Changed Home showed Willow Fiber 3
  and the public browser recorded no warnings or errors.

### Next highest-leverage weakness

- Cloth Wrap now has a truthful recurring cost and visible consequence, but its
  successful return is still materially identical to the free Wicker Basket.
  The next bounded checkpoint should make those two existing Packs change one
  useful returned quantity in different, predictable ways. It must stay inside
  the current reward ledger, avoid a new item or crafting system, and keep both
  choices valid rather than making one a strict upgrade.

### v0.45 — The Stored Seed Stays Visible — 2026-08-07

- Continued the fitted public v0.44 replay into Position 2. The prior screen
  explicitly stored one known Glowroot Seed, and reducer stock retained it, but
  **Already growing at Home** reduced Glowroot to **Bed 3 · planted**. The named
  reward disappeared from the visible loop one screen after collection.
- Added the positive Glowroot Seed count to the existing remembered-crop tile.
  A first remembered morning with zero spare Seeds remains exactly **Bed 3 ·
  planted**; a repeated morning now adds **1 Seed stored**. Plural copy follows
  higher stock counts without creating another selection or state field.
- Kept Clover as the one next planting action. The stored Seed appears as a
  quiet Home-memory fact beside the planted crop, not as a selectable fourth
  card, new bed, order, currency, or full inventory surface.

### Observable acceptance criteria

- Position 2 shows no stored-Seed claim when Glowroot is planted and Farm stock
  contains zero Glowroot Seeds.
- After a repeated Homecoming retains one Seed, the following Position 2 shows
  **Glowroot · Bed 3 planted · 1 Seed stored** while **Choose Clover** remains
  the only planting action.
- The stored count survives reload and 2 -> 1 -> 2 fast-forward, stays readable
  at 390x844 and 1280x720, and does not change reduced-motion or rapid-input
  behavior.

### Local validation evidence

- Rendered a first remembered morning at 390x844 and confirmed the Glowroot tile
  made no stored-Seed claim. Replayed a repeated return, began another day, and
  confirmed the same tile added **1 Seed stored** without another button.
- Reload and 2 -> 1 -> 2 fast-forward retained the count. The touch and fitted
  1280x720 compositions remained readable with empty browser logs; reduced
  motion remained active and simultaneous tickles increased 1,119 to 1,120
  exactly once.
- `npm run prototype:homegrown:test` — 42/42 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390x844 artboard and all 59 authored names.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- An isolated tree reconstructed from `HEAD` plus the staged diff installed all
  1,304 packages offline, reproduced the checked-in player CSS, HTML, and
  JavaScript hashes exactly, and passed `npm run verify:rive-web`.

### Public deployment evidence

- Shipped commit `42317ae` through replacement GitHub Pages run `31179744370`;
  GitHub cancelled the duplicate trigger and completed the replacement run.
- The public game loaded `homegrown-adventures.css?v=776adb7e4f` and
  `homegrown-adventures.js?v=45afb51936`. Both public files and the unchanged
  297,820-byte Rive scene matched their checked-in SHA-256 values exactly.
- At the public 390x844 layout, a repeated return retained one Seed, the next
  morning's Glowroot tile showed **1 Seed stored**, and **Choose Clover**
  remained the only planting action. The full screen and browser logs were
  clean.

### Next highest-leverage weakness

Following the now-visible stock into the next preparation cycle exposes the
next weak reward: Willow Fiber accumulates under the generic **Materials** count
but does not affect farming, the Bag, or any Adventure choice. The next bounded
checkpoint should give that existing practical supply one understandable use
inside the current Farm-to-Bag loop—preferably through an existing Pack choice—
without opening a crafting screen, adding a currency, or creating another
parallel progression system.

### v0.44 — The Homecoming Stays in Reach — 2026-08-07

- Replayed the public v0.43 repeated Homecoming at 1280x720. The returned
  objects, exact reward ledger, and causal thread were readable, but the single
  **Keep supplies in Farm stock** action began below the first viewport and the
  prototype rail cut through the bottom of the composition. The DOM action
  existed, but the player-visible hierarchy violated the one-clear-action rule.
- Added four restrained short-desktop scale steps for the fixed 390x844 frame.
  From 930px down to 700px-high laptop viewports, the whole game now stays
  proportionally registered and fully visible. The smallest desktop scale keeps
  the 58px primary action above 45px; layouts at 700px wide or below keep the
  original full-size touch controls and use no desktop transform.
- Made the browser build emit the minified player and animation-lab stylesheets
  from their source files and add content hashes to both stylesheet links. A
  responsive checkpoint can no longer deploy new source CSS while public Pages
  silently serves the previous generated file or a cached stylesheet.
- Changed no reducer fact, reward, crop, Adventure, Rive timeline, or visual
  registration inside the game frame. The approved 9:16 composition is scaled
  as one unit only when the available desktop height requires it.

### Observable acceptance criteria

- Position 10 shows its full worktable, reward ledger, causal thread, primary
  action, and Previous / Next rail without scrolling at 1280x700, 1280x720,
  1280x800, 1280x850, and 1280x900.
- The 390x844 phone layout remains unscaled and retains the full 58px action.
- A complete real loop still reaches the next remembered morning; reload,
  reduced motion, 10 -> 11 fast-forward, and rapid input preserve their prior
  behavior with no browser warnings or errors.

### Local validation evidence

- Rendered Position 10 at 1280x700, 1280x720, and 1280x900 after the generated
  stylesheet was rebuilt. Every screenshot contained the complete Homecoming
  action and progression rail; 390x844 retained the original full-size screen.
- Played the latest rendered build at 1280x700 from **Tickle Rosie** through
  farming, accessible guaranteed Harvest, Bag preparation, deterministic
  Adventure, first Glowroot planting, Changed Home, and the following morning.
- Reload preserved the remembered morning. Reduced motion retained the repeat
  Homecoming and its action, 10 -> 11 fast-forward remained correct, and two
  simultaneous tickles increased 1,119 to 1,120 exactly once. Browser logs were
  empty throughout.
- `npm run prototype:homegrown:test` — 42/42 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390x844 artboard and all 59 authored names.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- An isolated tree reconstructed from `HEAD` plus the staged diff installed all
  1,304 packages offline, reproduced the checked-in CSS and HTML hashes exactly,
  passed all 42 prototype tests, and passed `npm run verify:rive-web`.

### Public deployment evidence

- Shipped commit `113c0ef` through GitHub Pages run `31154603848`.
- The public page loaded `homegrown-adventures.css?v=54c3631644` and
  `homegrown-adventures.js?v=6852a4087f`; the animation lab loaded its exact
  `81b9ac5e7a` CSS and `fdbd7b1e76` JavaScript. The public HTML, player CSS,
  and 297,820-byte Rive file matched the checked-in SHA-256 values exactly.
- At the public 1280x720 viewport, the repeated Position 10 rendered the full
  worktable, ledger, causal thread, **Keep supplies in Farm stock**, and the
  complete Previous / Next rail without scrolling. Keeping the supplies reached
  Position 11 with one retained Seed; **Begin another day** reached the next
  remembered morning. Browser logs remained empty.

### Next highest-leverage weakness

The fitted public replay exposed the next continuity gap on Position 2. After
the second return, Farm stock truthfully contains one Glowroot Seed, but the
**Already growing at Home** tile only says **Glowroot · Bed 3 planted**. The
named reward disappears from the visible loop one screen after it was stored.
The next bounded checkpoint should show that retained Seed beside the planted
Glowroot without making it a selectable crop, adding a new bed, or opening a
full inventory screen.

### v0.43 — The Second Seed Has a Home — 2026-08-07

- Replayed a complete second Barn day after the shipped v0.42 checkpoint. The
  deterministic Adventure correctly returned another Glowroot Seed, Compost,
  and Willow Fiber, but Position 10 still offered **Plant Glowroot**. Because
  the lasting Glowroot was already planted, the reducer correctly rejected the
  action and left the player at a dead Homecoming.
- Kept the first Discovery path unchanged: the first Seed must still be
  welcomed, planted, and spent exactly once. When Home already remembers
  Glowroot, the same acknowledgement now stores the returned Seed, advances to
  Changed Home, and marks the repeated Barn day complete.
- Made the repeated return explicit in the rendered interface with
  **Discovery remembered**, the exact +1 Seed / +1 Compost / +2 Willow Fiber
  ledger, and one **Keep supplies in Farm stock** action. Position 11 then
  shows the retained Seed and **Begin another day**.
- Added no crop, destination, currency, reward roll, inventory view, or Rive
  progression state. React remains authoritative for rewards, stock,
  persistence, and the one-action transition; the existing authored Return and
  Changed Home performances remain unchanged.

### Observable acceptance criteria

- A first successful return still requires **Welcome Rosie Home** and
  **Plant Glowroot**, consuming the first Seed from 1 to 0.
- A later successful return describes the known Discovery truthfully, keeps the
  second Seed in Farm stock, and reaches Position 11 with the day complete in
  one bounded acknowledgement.
- Reload at the repeated Position 10 and after Position 11 preserves the exact
  branch and stock. Previous / Next, reduced motion, rapid input, touch, and
  desktop remain safe and readable.

### Local validation evidence

- Played the rendered loop twice at 390x844. The first return retained its
  original planting flow; the second showed **Discovery remembered**, exact
  returned quantities, and **Keep supplies in Farm stock**. The resulting
  Changed Home held one Glowroot Seed and exposed **Begin another day**.
- Reload held the repeated Position 10 branch. Fast-forward traversed
  11 -> 10 -> 11 with repeat-aware copy; reduced motion retained the action and
  position; simultaneous tickle attempts increased 1,119 to 1,120 exactly
  once. Desktop 1280x900 and touch renders reported no warnings or errors.
- `npm run prototype:homegrown:test` — 42/42 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390x844 artboard and all 59 authored names.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.
- An isolated tree reconstructed from `HEAD` plus the exact staged diff
  installed 1,304 packages from the offline lockfile and passed
  `npm run verify:rive-web`; unrelated worktree changes were not present.

### Public deployment evidence

- Shipped commit `3c50dda` through GitHub Pages run `31153727096`.
- The public game loaded `homegrown-adventures.js?v=6852a4087f`; the animation
  lab loaded `homegrown-animation-lab.js?v=fdbd7b1e76`; and the 297,820-byte
  public Rive file matched the checked-in SHA-256 exactly.
- Starting at the public Changed Home, Previous opened Position 10 with
  **Discovery remembered** and **Keep supplies in Farm stock**. The action
  retained one Glowroot Seed, returned to Position 11 with **Begin another
  day**, and the next morning preserved the remembered Home. The public browser
  reported no warnings or errors.

### Next highest-leverage weakness

The public replay at a 1280x720 laptop viewport exposed the next clarity gap:
Position 10's physical worktable, reward ledger, and prototype rail can push the
single Homecoming action below the first viewport. The next bounded checkpoint
should keep that action visible at short desktop heights without shrinking the
touch target, hiding returned objects, or adding a second control surface.

### v0.42 — Leaves Make the Doorway — 2026-08-07

- Replayed the shipped v0.41 Position 11 and next morning beside
  `rosie-v3/11-changed-barn-next-day.png`. The crossing finally had doorway
  weight, but its broad, smooth green bands still read as ribbon. The concept
  gets its garden-arch silhouette from clustered leaves that interrupt the
  edge, not from another progression object or denser UI.
- Added two low-opacity native Rive foliage copies with deliberately different
  X/Y scale, rotation, and offset, then duplicated the existing green node
  subgroup into two crossed rows of stretched ellipses. Those editable shapes
  now protrude as leaves while one exact blossom copy remains at the front.
  All additions stay inside the existing Home consequence hierarchy and use
  the current olive, sage, leaf-green, and blossom palette.
- Mirrored the backing and leaf-row construction in
  `assets/rive/homegrown-adventures/source/home-remembers.svg`. The current
  `Home Consequence Hidden`, `Home Consequence Developed`, and
  `Glowroot Home Flourish` timelines still own presentation; React still owns
  `hedgeCrossingOpen`, persistence, rewards, text, and reduced motion.

### Observable acceptance criteria

- The earned crossing reads as one flowered, leafy garden doorway at 390x844
  and desktop sizes, with an irregular plant silhouette instead of a smooth
  translucent band.
- The Barn, bell, canonical Rosie, crops, pond, frog, Farm stock, and single
  primary action remain readable and unobscured.
- Reload, next morning, reduced motion, and 11 -> 10 -> 11 fast-forward hold
  the same developed pose. No new timeline, state-machine input, reward, crop,
  destination, resident, currency, or progression fact is introduced.

### Local validation evidence

- A fresh rendered 390x844 loop completed Tickle Rosie, Clover Seed and
  optional Compost, predictable growth, left-right-up Harvest Rhythm, Farm
  stock, the full freely chosen Bag, deterministic Adventure, exact return
  rewards, Glowroot planting, Moonberry follow-through, and Changed Home.
- Direct reload retained the leafy doorway. Reduced motion toggled from motion
  back to the held pose, fast-forward traversed 11 -> 10 -> 11, and eight
  simultaneous tickle attempts increased the total from 1,119 to 1,120
  exactly once. The browser reported no warnings or errors.
- Touch 390x844 and desktop 1280x720 renders kept the full composition
  readable with no horizontal overflow or clipped game controls.
- `npm run prototype:homegrown:test` — 41/41 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390x844 artboard and all 59 authored names.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.

### Public deployment evidence

- Shipped commit `dcd31b9` through GitHub Pages run `31152615186`.
- The public game loaded `homegrown-adventures.js?v=a48a1c9797`; the animation
  lab loaded `homegrown-animation-lab.js?v=24a2314ddb`; and the 297,820-byte
  public Rive file matched the checked-in SHA-256 exactly.
- Public Position 11 exposed exactly **Begin another day**, **Previous**, and
  **Loop**, rendered the crossed leaf rows around the flowered doorway, and
  reported no browser warnings or errors. Beginning another day returned to
  **Tickle Rosie** while the doorway, bell, crops, pond, frog, and Farm stock
  remained visible.

### Next highest-leverage weakness

A rendered second-day replay exposed a progression dead end: after the first
Glowroot is already planted, the same deterministic Adventure can return
another Glowroot Seed, but Position 10 still says **Plant Glowroot** and the
action cannot advance. The next bounded checkpoint should make an already-known
Discovery join Farm stock and finish the Homecoming without inventing another
crop, destination, currency, or reward system.

### v0.41 — The Hedge Becomes a Doorway — 2026-08-07

- Replayed Position 11 beside
  `rosie-v3/11-changed-barn-next-day.png`. The earned crops, pond, frog, and
  smaller Rosie were readable, but the hedge crossing was still two thin
  bright strokes with regularly spaced nodes. It read like a temporary vector
  trail rather than the lasting flowered entrance in the approved concept.
- Duplicated the existing editable `hedge_crossing_flourish` group twice in
  Rive, kept both copies inside the existing Home consequence hierarchy, and
  sent them behind the original blossom layer. The two backings sit only a few
  pixels to either side of the established path, use muted olive, sage, and
  leaf-green colors, and hold the outer layer at 82% blend. The original pink
  blossoms remain in front, turning the single line into one broad planted
  arch without adding a new object, resident, or effect timeline.
- Mirrored the authored backing construction in
  `assets/rive/homegrown-adventures/source/home-remembers.svg`. Hidden,
  Developed, and `Glowroot Home Flourish` still reveal the same parent rig;
  React remains the sole owner of `hedgeCrossingOpen`, persistence, rewards,
  and reduced-motion selection.

### Observable acceptance criteria

- The crossing reads as a substantial flowered doorway at 390x844 and desktop
  sizes while leaving the Barn, bell, Rosie, crops, pond, and primary action
  unobscured.
- The added native foliage is absent before the Home memory is earned, appears
  with the established Home flourish, and holds the same developed pose after
  reload, fast-forward, reduced motion, and the next morning.
- No new timeline, state-machine input, reward, crop, destination, resident,
  or progression fact is introduced.

### Local validation evidence

- A clean rendered loop completed Tickle Rosie, Seed and optional Compost,
  predictable growth, Clover's left-right-up Harvest Rhythm, Farm stock, the
  freely chosen Bag, deterministic Adventure, return rewards, Glowroot
  planting, Changed Home, and the next morning at 390x844.
- Position 11 retained the flowered doorway after direct reload. Reduced
  motion held the developed frame, fast-forward traversed 11 -> 10 -> 11, and
  simultaneous rapid tickle input increased the total from 1,119 to 1,120
  exactly once. The browser reported no warnings or errors.
- Desktop 1280x720 and touch 390x844 renders kept the complete Changed Home
  composition readable with no clipped controls or horizontal overflow.
- `npm run prototype:homegrown:test` — 41/41 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390x844 artboard and all 59 authored names.
- `npm run verify:rive-web` — passed from an exact staged-checkpoint clone;
  three Expo bundles kept their approved WebGL2 boundaries with no native
  runtime leakage.
- `npm run quality:check` — quality contracts, 324 sprite checks, TypeScript,
  78 layout tests, and 202 security tests passed.

### Public deployment evidence

- Shipped commit `8944b66` through GitHub Pages run `31151173732`.
- The public page loaded the exact content-hashed game and animation-lab
  bundles plus the authored Rive file with HTTP 200 responses and no browser
  warnings or errors.
- Public Position 11 exposed exactly **Begin another day**, **Previous**, and
  **Loop**. Beginning the next day returned to **Tickle Rosie** while the open
  doorway, bell, crops, pond, frog, and Farm stock remained visible.

### Next checkpoint selection

The public comparison selected v0.42: replace the smooth ribbon-like edge with
restrained native leaf clusters while keeping the same doorway and progression
fact. No parallel system was selected.

### v0.40 — The Frog Belongs Here — 2026-08-07

- Replayed Position 11 beside
  `rosie-v3/11-changed-barn-next-day.png`. The pond, crops, and smaller Rosie
  now matched the earned Home composition, but the resident was still a large,
  bright outlined icon that competed with Rosie and sat above the painted
  world.
- Used built-in ImageGen with the approved Position 11 concept as the sole
  style reference to create the tightly cropped transparent authoring study
  `assets/rive/homegrown-adventures/source/pond-frog-painterly.png`. The study
  established the target: compact proportions, olive and moss greens, a warm
  golden belly, and soft low-contrast edges at resident scale.
- Applied that treatment to the existing editable Rive `frog` subgroup rather
  than adding a bitmap or parallel resident. The subgroup is now 80% scale;
  its body, feet, eyes, and belly use the quieter reference palette; and its
  two dark contour colors are held at 48% opacity. `Pond Frog Present`, `Pond
  Frog Hidden`, and `Pond Frog Response` remain the same authored timelines.

### Observable acceptance criteria

- The frog is concept-sized, remains registered to the foreground pond rock,
  and reads behind Rosie instead of competing with her.
- The resident is visible only after the Home memory is earned, performs the
  same quiet response between rests, and remains still under reduced motion.
- Reload, fast-forward, rapid final input, and **Begin another day** preserve
  the exact React-owned Home state; no resident economy, reward, or progression
  fact is added.

### Local validation evidence

- Rendered desktop and 390×844 comparisons keep the frog on the pond rock with
  all three crop beds, the Farm-stock shelf, Rosie, and the primary action
  readable at once and no horizontal overflow.
- A clean full-loop replay completed farming, Harvest Rhythm, Bag preparation,
  deterministic Adventure, return, planting, Changed Home, and the next
  morning. Rive reported `ready`; the frog held `present`, entered
  `responding` on its existing cadence, and remained visible after the new day.
- Reload preserved Position 11 and the resident. Reduced motion reported
  `frog="reduced"`; rapid double input awarded the final tickle once; and the
  browser produced no warnings or errors.
- GitHub Pages deployment `31149087659` completed successfully from commit
  `6bf3b87`. On the public 390×844 build, Position 11 reported Rive `ready`,
  `frog="present"`, `motion="home"`, exact 390-pixel document width, and no
  browser warnings or errors.
- Public **Begin another day** restored Position 1, Rosie's `breathing` motion,
  and the primary **Tickle Rosie** action while keeping the earned frog visible
  beside the remembered pond.

### Next highest-leverage weakness

The shipped-build comparison now makes the hedge crossing the clearest visual
mismatch: its thin green stem, bright pink nodes, and sparkles read like a
temporary vector effect instead of the lush flowered arch in the approved
Position 11 concept. The next checkpoint should improve only the existing
crossing's authored Rive appearance and registration while preserving the
earned bell, open/hidden state, reduced motion, and React-owned persistence. Do
not add a visitor, destination, currency, crop, or parallel system merely
because the pond resident now belongs in the scene.

### v0.39 — Rosie Makes Room — 2026-08-07

- Replayed Position 11 beside
  `rosie-v3/11-changed-barn-next-day.png`. The Farm's new pond and painterly
  crops were correct, but the unchanged first-morning Rosie pose still filled
  the center of the phone and covered the world the player had just earned.
- Authored one new root-bone timeline on the existing canonical Rosie rig.
  `Rosie Home Admire` holds the body at `(118, 500)` and `50%` scale, gives it
  one restrained six-pixel lift, and settles to the same pose. No alternate
  character art, DOM duplicate, new rig, or progression fact was added.
- React selects that pose only while the Changed Home memory is being shown.
  The final tickle replays the small authored response instead of jumping to
  Rosie's full-size first-morning animation; reload and reduced motion hold the
  correct Rive frame, and **Begin another day** restores the normal breathing
  pose automatically.

### Observable acceptance criteria

- Position 11 keeps Rosie recognizably canonical, left of the center beds,
  with all three crops, the crate, pond, and frog readable at once.
- The final **Tickle Rosie** action changes the earned total exactly once and
  never pops Rosie back to her larger morning scale.
- Direct reload and reduced motion hold the smaller Home pose; the next
  morning restores the large, obvious Rosie tickle target.
- Fast-forwarding backward and forward does not leak the Home pose into any
  earlier position, and rapid input cannot skip into a second day.

### Local validation evidence

- `npm run prototype:homegrown:test` — 41/41 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390×844 artboard and all 59 authored names.
- `npm run verify:rive-web` — passed from an exact staged-checkpoint clone;
  three Expo bundles contain only the approved WebGL2 boundaries.
- `npm run quality:loop` and `npm run quality:check` — pass, including layout,
  security, TypeScript, sprite, and contract gates.
- Rendered 390×844 and 375×812 checks keep Rosie at the concept's left-side
  ground line while every remembered bed and the pond remain unobscured.
- Clean full-loop replay completed morning tickle, farming, rhythm harvest,
  Bag preparation, deterministic Adventure, return, Changed Home, and the
  next morning. Rive reported `ready`; Changed Home settled to `home`, the
  final input recorded `tickle`, and the next morning resumed `breathing`.
- Reload, reduced-motion, and rapid-double-input checks preserved Position 11,
  one tickle reward, and the authored Home pose without browser warnings or
  errors.
- GitHub Pages deployment `31147845527` completed successfully from commit
  `f343009`. On the public 390×844 build, Changed Home reported Rive `ready`,
  held motion `home` after the final tickle, preserved all three beds and the
  pond, and produced no browser warnings or errors.
- The public Position 10 → 11 path recorded `tickle` as the last performed
  motion and awarded the final interaction once. **Begin another day** then
  restored Position 1 with the large canonical Rosie target and motion
  `breathing`.

### Next highest-leverage weakness

The shipped-build comparison makes the pond resident the clearest remaining
visual mismatch: the bright, flat outlined frog reads like a sticker against
the painterly pond and canonical Rosie. The next checkpoint should improve
only the existing Rive frog's authored appearance and registration while
preserving its quiet response, earned timing, and React-owned persistence. Do
not add a crop, destination, currency, or parallel system merely because Rosie
now makes room for the Farm.

### v0.38 — The Crops Belong Here — 2026-08-06

- Replayed the changed Farm against
  `rosie-v3/04-growing-fast-forward.png` and
  `rosie-v3/11-changed-barn-next-day.png`. The earned pond already belonged to
  the scene, but the middle Moonberry cluster and right Glowroot still read as
  flat vector stickers sitting above the painterly soil.
- Used built-in ImageGen edit mode—not Python—to create the character-free
  853×1844 plate
  `assets/concepts/homegrown-adventures/11-changed-home-painted-crops-scene-plate.png`.
  The production prompt directed ImageGen to: “Edit only the middle and right foreground
  Kitchen Patch beds in the existing painterly pond plate. Paint a low young
  Moonberry crop directly into the middle soil bed and three small warm-gold
  Glowroot sprouts directly into the right soil bed. Preserve the exact
  camera, crop, pond, barn, paths, lighting, dimensions, bed borders, soil
  shapes, and empty left bed; match the warm hand-painted storybook texture;
  add no Rosie, character, UI, text, tools, or extra objects; avoid flat vector
  shapes, thick outlines, excessive bloom, or sticker-like crops.”
- React now exposes `bedThreeState` beside the existing bed-one and bed-two
  attributes. Two full-registration painted clips cover only the corresponding
  soil beds: Glowroot appears as soon as its Seed is planted, while Moonberries
  remain absent until the player explicitly chooses them. The authored Rive
  crop timelines and reducer facts remain connected underneath; the painted
  layer supplies the lasting mass, while Rive continues to own the shared
  character, resident, and Home flourish performances.
- The required clean browser replay found a separate player-visible gate:
  freshly ready Clover showed the harvest rhythm before Rosie revealed the
  change, so the reducer correctly rejected every beat. The rhythm now waits
  for `changeRevealed`; **Welcome Rosie** is the one clear action first, then
  left → right → up harvest becomes available.

### Observable acceptance criteria

- Fresh Glowroot planting paints only the right bed; the middle bed remains
  visibly empty until **Grow Moonberries**.
- Moonberries then arrive in the middle bed without moving the camera,
  repainting the pond, duplicating crops, or changing inventory rules.
- Both remembered beds survive reload and **Begin another day**; a fresh first
  day still shows neither future crop.
- Reduced motion holds both painted beds without arrival animation. Rapid
  input remains guarded, and the authored Rive scene stays ready.
- A clean player-visible run completes morning Tickle, farming, ready reveal,
  rhythm harvest, Bag preparation, Adventure, return, planting, and the next
  morning without explanation or browser errors.

### Local validation evidence

- `npm run prototype:homegrown:test` — 41/41 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390×844 artboard and all 58 authored names.
- `npm run verify:rive-web` — passed from an exact staged-checkpoint clone;
  three Expo bundles contain only the approved WebGL2 boundaries.
- `npm run quality:loop` and `npm run quality:check` — pass, including 78
  layout tests, 202 security tests, TypeScript, 324 sprite checks, and contract
  gates.
- Rendered first-plant comparison — `bedTwoState=empty`,
  `bedThreeState=sprout`, Moonberry opacity `0`, Glowroot opacity `1`.
- Rendered post-choice and reload comparison — both remembered beds visible,
  Rive status `ready`, and no duplicate vector crops.
- Rendered 390×844 and 375×812 touch checks — exact bed registration and zero
  horizontal overflow.
- Rendered reduced-motion check — both crop arrival animations `none`, frog
  and Moonberry Rive motions `reduced`.
- Clean full-loop replay — all eleven positions plus the second morning,
  including the repaired **Welcome Rosie** → harvest-rhythm handoff; zero
  browser warnings or errors.
- GitHub Pages deployment `31146071952` completed successfully from
  `6a4d8d9`. The public 375×812 build has zero horizontal overflow, keeps both
  remembered crop clips registered with Rive status `ready`, preserves them
  after **Begin another day**, and reports zero browser warnings or errors.
- Public ready-Clover replay confirms **Preview it ready** advances to Position
  5 with **Welcome Rosie** as the sole primary action; the rhythm cannot appear
  until that reveal succeeds.

### Next highest-leverage weakness

Replay the locally verified checkpoint beside the approved concept sequence
and choose the next single player-visible weakness. Do not add a crop,
destination, currency, or parallel system merely because the beds now belong
to the Farm.

### v0.37.1 — One Shared Rive Stage — 2026-08-06

- The first deployed v0.37 replay rendered correctly but exposed one browser
  `deleteTexture` error after the temporary Position 9 Glowroot canvas had
  unmounted and the persistent Farm next revealed its frog at Position 11.
- Both web-only Rive views had explicitly opted out of the shared offscreen
  renderer. Changed them to `useOffscreenRenderer: true`, matching Rive's
  recommendation for pages that display multiple Rive instances and avoiding
  a separate WebGL2 context teardown for the temporary view.
- The change affects rendering ownership only. The same checked-in `.riv`,
  reducer facts, visible poses, timings, controls, and persistence remain.
- GitHub Pages deployment `31144629248` completed successfully from `9be68d9`.
  A fresh public Position 8 → 11 replay kept the Farm Rive status ready, showed
  the frog only at the earned Home, and produced zero browser errors. Reload
  plus **Begin another day** preserved the pond and frog at Position 1 while
  restoring the single **Tickle Rosie** action.

### Observable acceptance criteria

- Position 8 → 9 → 10 → 11 keeps one ready persistent Farm canvas, reveals the
  same painterly pond and Rive frog, and reports no browser errors.
- The Glowroot view remains clipped over its painterly clearing and cleans up
  without disrupting the Farm renderer.
- Gameplay, static Rive contract, exact-clone Web bundling, and repository
  quality gates remain green.

### Next highest-leverage weakness

The changed Farm now exposes the next visual mismatch: the middle Moonberry
cluster and right Glowroot foliage still read as flat Rive stickers beside the
integrated painterly pond. The next bounded checkpoint should compare those
beds with the approved growth and changed-Home concepts, move their static crop
mass into matched painterly bed art, and reserve Rive for living sway, growth,
and glow. Do not add another crop or farming system.

### v0.37.0 — The Pond Belongs Here — 2026-08-06

- Replayed Position 11 against
  `rosie-v3/11-changed-barn-next-day.png`. The previous native vector pond was
  functionally correct but read as a flat sticker laid over the painterly Farm.
- Used the built-in ImageGen workflow to make one character-free 853×1844
  scene plate, `11-changed-home-pond-scene-plate.png`. It preserves the Barn,
  camera, path, beds, crate, and daylight while replacing only the watering-can
  patch with a painterly pond, lily pads, flower, and foreground frog rock.
- Kept the original Rive pond source group for edit history but set its water,
  highlight, rocks, lily pads, flower, and duplicate frog rock to 0% base
  blend. The living `frog` subgroup remains native Rive and retains its calm
  response animation. Its parent moved from `(240, 459.07)` to `(222, 438)` so
  the frog sits on the painted foreground rock.
- Split earned Home persistence from the Position 11 memory panel. Once
  Glowroot has been planted, the painted pond and Rive frog now remain through
  reload and **Begin another day**; the explanatory panel still appears only
  at Position 11, so the next morning returns to one clear Tickle action.
- The player and Motion Lab both use the same plate-plus-Rive composition.
  React still owns whether the memory is earned and visible; Rive owns only the
  frog's appearance and response.

### Observable acceptance criteria

- A fresh first-day Position 1–10 never paints the future pond or frog.
- Position 11 paints one integrated storybook pond and one live Rive frog with
  no duplicate vector water, rocks, lily pads, flower, or frog rock.
- Reload and **Begin another day** preserve the earned pond and frog while
  returning the player to the ordinary morning Tickle action.
- The pinned Motion Lab study uses the same composition, reduced motion holds
  the frog still, and rapid replay produces no errors or duplicate residents.

### Local validation evidence

- `npm run prototype:homegrown:test` — 41/41 gameplay and persistence tests.
- `npm run verify:rive-homegrown` — 390×844 artboard and all 58 authored names.
- `npm run verify:rive-web` — passed in an exact staged-checkpoint clone; three
  Expo bundles contain only the approved WebGL2 boundaries.
- `npm run quality:loop` and `npm run quality:check` — pass, including 78
  layout tests, 202 security tests, TypeScript, 324 sprite checks, and contract
  gates.
- Rendered eleven-position replay — frog hidden through Position 10 and shown
  on the painted pond at Position 11.
- Rendered reload/new-day replay — the remembered plate and frog persist at
  Position 1 while the Home-memory panel closes.
- The actual game surface remains 390×844; the Motion Lab reduced-motion and
  five-repeat stress checks keep the frog visible and report no browser errors.

### Next highest-leverage weakness

Replay the public checkpoint from the first Tickle through the remembered
second morning, then choose the next bounded player-visible weakness from that
rendered comparison. Do not add a new crop, destination, currency, or system
merely because this visual gap is closed.

### v0.36.1 — The Pond Waits for Morning — 2026-08-06

- The required post-ship public replay exposed a cross-state Rive regression:
  Position 5 correctly reported `frogVisible=false`, but repeated harvest
  swipes could release the paused Hidden timeline and reveal the pond at the
  ready Clover bed.
- Changed the native `pond-frog` group's editor base blend from 100% to 0%.
  `Pond Frog Present` remains the sole explicit 100% pose, while `Pond Frog
  Hidden` remains an explicit 0% pose. A runtime reset is therefore safely
  hidden instead of leaking a future Home consequence.
- Cold-load harvest validation completed Clover's left → right → up rhythm and
  advanced to Farm stock without painting the resident. A separate cold-load
  Position 11 still paints the complete pond and resumes its calm response.

### Observable acceptance criteria

- Positions 1–10 never paint the pond or frog, even after crop, Rosie, Bag,
  departure, Return, rapid-input, or reload activity on the shared artboard.
- Position 11 and the pinned Motion Lab study still paint the complete resident
  when React explicitly selects `Pond Frog Present`.
- The visible/hidden data attributes and actual rendered pixels agree.

### Next highest-leverage weakness

Repeat the public eleven-position replay after this hotfix before selecting the
next polish checkpoint. The false-positive resident takes priority over any
new visual or gameplay work.

### v0.36.0 — The Pond Remembers — 2026-08-06

- Replayed the Position 10 → 11 handoff and compared the next morning with
  `rosie-v3/11-changed-barn-next-day.png`. The open hedge, bell, growing beds,
  and stock were correct, but the earned pond resident was absent, so the Farm
  did not visibly remember that part of Rosie's Adventure.
- Imported one compact paper-cut pond-and-frog vector into the existing
  390×844 Rive artboard and corrected its base position after the first
  rendered comparison exposed right-edge clipping. The complete pond, rocks,
  flower, and frog now remain inside the frame without changing the camera or
  replacing the approved Farm plate.
- Added `Pond Frog Hidden`, `Pond Frog Present`, and `Pond Frog Response` to
  the checked-in source, patched runtime export, static contract, and visual
  reference list. The response is a restrained 560 ms frog bob followed by a
  3.25-second quiet hold.
- Kept authority explicit: the reducer still earns `frogVisible`, while React
  reveals the resident only in the Position 11 next-morning presentation.
  Position 10 therefore records the earned consequence without painting it
  over Rosie's homecoming. Rive owns only the vector poses and response.
- Added observable `data-rive-frog-earned`, `data-rive-frog-visible`, and
  `data-rive-frog-motion` states so reload, reduced motion, fast-forward, and
  rapid navigation can prove the handoff in the real rendered game. The
  companion animation lab exposes the exact runtime study as **Pond remembers**.

### Observable acceptance criteria

- Position 10 contains no pond resident; advancing once reveals the complete
  pond and readable frog in Position 11 without changing the Farm camera.
- The resident holds a calm persisted pose, performs one brief response
  between long rests, and never competes with Rosie or the primary action.
- Reduced motion holds the same complete visible pose without periodic motion.
- Reload and rapid Previous / Next input preserve the earned-versus-visible
  boundary and cannot duplicate progression, rewards, or resident instances.

### Local validation evidence

- `npm run prototype:homegrown:test` — 41/41 reducer and persistence tests pass.
- `npm run verify:rive-homegrown` — pass; the 390×844 artboard and all 58
  authored names, including all three pond/frog clips, are present.
- `npm run prototype:homegrown:build` — pass; the player and animation lab use
  the corrected content-hashed export.
- `npm run verify:rive-web` — pass from an exact checkpoint clone; three Expo
  bundles contain only the approved WebGL2 boundaries. The live dirty tree's
  unrelated AdMob web import remains outside this checkpoint.
- `npm run quality:loop` and `npm run quality:check` — pass, including 78 layout
  tests, 202 security tests, TypeScript, 324 sprite checks, and contract gates.
- Rendered desktop and narrow-layout validation proved the corrected framing,
  one primary action, normal response cadence, reduced-motion hold, reload,
  Position 10 → 11 reveal, rapid fast-forward input, and zero browser logs.

### Next highest-leverage weakness

The checkpoint closes the last missing spatial consequence in the approved
11-screen loop. The next cycle must replay the shipped public loop from Tickle
Rosie through the second morning and compare all positions before selecting a
new bounded weakness; do not infer a new system from the now-complete pond.

### v0.35.0 — What Rosie Brought Home — 2026-08-06

- Replayed both Position 10 outcomes and compared the complete return with
  `rosie-v3/10-return-discovery.png`. The stock, causes, and Welcome action were
  truthful, but they appeared as stacked cards over the outdoor Farm, so Rosie
  never seemed to physically carry anything into the Barn.
- Used the built-in ImageGen workflow to generate one character-free,
  lantern-lit Barn-worktable plate with exactly the complete reward set, then
  made one precise object edit for the Near-Discovery: remove the Seed and its
  glow, replace it with the pressed leaf-print clue, and reduce the Fiber to one
  coil while preserving the composition. The two 780×1688 WebP sources are
  `return-homecoming-discovery.webp` and `return-homecoming-clue.webp`.
- Composited canonical live Rive Rosie between the full scene plate and its
  foreground table crop. The existing 900 ms `Rosie Return` timeline now plays
  exactly once when Position 9 advances to Position 10, and its completed
  trigger remains observable without letting Rive own progression.
- Replaced the old return stack with one compact discovery plaque, one stock
  ledger aligned to the physical props, one three-part causal thread, and one
  Welcome action. The complete branch shows `+1 / +1 / +2`; the clue branch
  shows `+1 / Found / +1` and never claims or paints an unearned Seed.
- Made fast-forward preserve player stock deviations while applying the exact
  target-position delta. Repeated same-position input is now a no-op, rewind
  removes the preview delta, Position 11 consumes the Seed once, direct reload
  does not replay Return, and reduced motion holds the stable result.
- Added the same **Welcome Home** composition to the animation lab and added a
  persistent `data-rive-last-performed-motion` marker so rendered validation
  can prove the short Rive performance after it has settled.

### Observable acceptance criteria

- A complete Adventure visibly places one Glowroot Seed, one Compost bundle,
  and two Willow Fiber coils on the Barn table; a Near-Discovery visibly places
  only its leaf-print clue, Compost, and one Fiber.
- Canonical Rosie performs the authored Return once and remains correctly
  occluded behind the foreground table. No duplicate character is baked into
  either plate.
- The physical rewards, accessible labels, reducer stock, acknowledgement, and
  following Glowroot planting agree exactly in normal play and fast-forward.
- Touch, desktop, reload, reduced motion, and rapid activation preserve one
  primary action and cannot duplicate the Return or its stock delta.

### Local validation evidence

- `npm run prototype:homegrown:test` — 41/41 pass, including exact return
  deltas, idempotent fast-forward, rewind, and clue-branch truthfulness.
- `npm run verify:rive-homegrown` — pass; the 390×844 artboard and all 55
  authored names remain intact.
- `npm run prototype:homegrown:build` — pass; both return WebPs publish with the
  player and animation-lab routes.
- `npm run quality:loop` and `npm run quality:check` — pass, including 78 layout
  tests, 202 security tests, TypeScript, 324 sprite checks, and contract gates.
- Rendered browser validation proved the complete and clue-only returns,
  Return performance, acknowledgement, Glowroot planting, reload, reduced
  motion, rapid input, fast-forward, touch framing, and desktop presentation.

### Next highest-leverage weakness

Position 11 correctly preserves Glowroot, growing crops, Farm stock, the open
hedge, bell, and visitors, but rendered comparison with
`rosie-v3/11-changed-barn-next-day.png` shows that the pond and resident
consequence do not yet read as a place Rosie changed. The next checkpoint
should make one existing earned pond-and-frog detail spatially legible with a
restrained authored response. Do not add a resident economy, collection screen,
new reward, or parallel visitor system.

### v0.34.0 — The Glowroot Wakes — 2026-08-06

- Replayed both Position 9 outcomes and compared the successful clearing with
  `rosie-v3/09-adventure-vignette.png`. The place and preparation causes were
  readable, but the earned Glowroot was permanently baked into the plate, so
  the discovery itself had no living state change.
- Used the built-in ImageGen edit workflow to remove only the luminous root and
  its emitted glow from the successful clearing while retaining the alcove,
  trowel, basket, vegetation, lighting, framing, and empty discovery space. The
  versioned character-free result is
  `adventure-clearing-discovery-rive.webp`; the clue-only plate remains
  unchanged.
- Reused the checked-in native `glowroot_bed_three` vector rig and its existing
  `Glowroot Home Flourish` animation through one tightly clipped 100×78 Rive
  view at the clearing's discovery point. A bounded reveal settles into a calm
  final pose, followed by a brief glow beat between long rests.
- Kept authority explicit: React derives the Adventure result and mounts the
  Rive boundary only for a successful Discovery. A Near-Discovery mounts no
  Glowroot canvas. Reduced motion scrubs to the authored final frame and pauses
  without exposing an intermediate state.
- Added **Reveal Glowroot** to the animation lab and expanded the web verifier
  to require both approved WebGL2 boundaries, the native flourish name, and an
  observable motion state.

### Observable acceptance criteria

- A complete Bag produces one visible Glowroot reveal at the physical find
  point, then a quiet resting pose and a restrained breathing glow.
- The clue-only branch contains no Glowroot art and no hidden Rive reward
  canvas; React remains the sole authority for which outcome was earned.
- The live result stays aligned at touch and desktop sizes, survives reload,
  respects reduced motion, and cannot be duplicated or skipped by rapid input.
- Position 9 retains one primary story action and canonical Rosie remains live
  above the character-free environment.

### Local validation evidence

- `npm run prototype:homegrown:test` — 39/39 pass.
- `npm run verify:rive-homegrown` — pass; the 390×844 artboard and all 55
  authored names remain intact.
- `npm run verify:rive-web` — pass from an exact clean-index snapshot; three
  Expo web bundles load both approved WebGL2 boundaries without native leakage.
- `npm run prototype:homegrown:build` — pass; the edited WebP publishes with
  both prototype routes.
- `npm run quality:loop` and `npm run quality:check` — pass, including 78 layout
  tests, 202 security tests, TypeScript, sprite integrity, and contract gates.
- Rendered browser validation proved reveal → rest → glow cadence, the clue
  branch's absent canvas, reload, reduced motion, rapid input, fast-forward,
  the 390×844 touch surface, and centered desktop presentation.

### Next highest-leverage weakness

Rendered comparison with `rosie-v3/10-return-discovery.png` shows that Position
10 has the correct Glowroot Seed, Compost, Willow Fiber, preparation recap, and
single Welcome action, but presents them as stacked interface cards over the
Farm. The next checkpoint should make Rosie's return feel physical: use the
existing Rive Return performance and stage the Seed, Compost, and Willow Fiber
as one brief Barn-table homecoming before collapsing to the ordinary Farm. Do
not add a new reward rule, currency, destination, or ceremony screen.

### v0.33.0 — The Glowroot Clearing — 2026-08-06

- Replayed the complete and empty-Provision Position 9 branches and compared
  them with `rosie-v3/09-adventure-vignette.png`. The causal copy was truthful,
  but the CSS blur and floating report cards did not make the Adventure feel
  like a place where Rosie's preparation physically produced a discovery.
- Generated three character-free twilight-clearing compositions with the
  built-in ImageGen workflow. A sheltered root alcove won because it preserves
  the center-left stage for canonical live Rive Rosie while placing the warm
  root, trowel, and basket together in the world. The two alternate clearings
  were not added to the game.
- Derived a second plate from the same clearing for Near-Discoveries: the root,
  trowel, and basket are absent, leaving only a faint warm leaf-print and motes.
  Complete and incomplete Bags therefore share one believable location but no
  longer share the same reward picture.
- Reworked the three cause tags as small hanging field labels and moved the
  result into one compact world-anchored find marker. React still derives every
  label, branch, reward, and transition; the environment plates contain no
  character, UI text, inventory fact, timer, or progression logic.

### Observable acceptance criteria

- Position 9 reads as a tangible storybook clearing while canonical Rive Rosie
  and her equipped satchel remain live and unobscured.
- Clover Lunch, Hand Trowel, and Wicker Basket each explain one specific cause;
  the complete branch visibly contains the sleeping Glowroot discovery.
- Leaving any Bag slot empty keeps the same one-action scene but removes the
  physical reward and presents the reducer-derived promising clue instead.
- Both outcomes survive reload and reduced motion. Rapid activation dismisses
  the vignette once, without skipping the deterministic waiting state.

### Local validation evidence

- `npm run prototype:homegrown:test` — 39/39 pass, including every empty-slot
  vignette, successful alternatives, persistence, and rapid-transition guards.
- `npm run verify:rive-homegrown` — pass; the 390×844 artboard and 55 authored
  names remain intact.
- `npm run prototype:homegrown:build` — pass; both 780×1688 WebP clearing plates
  publish under `docs/assets/homegrown-adventures/`.
- `npm run quality:loop` and `npm run quality:check` — pass, including 78 layout
  tests, 202 security tests, TypeScript, sprite integrity, and contract gates.
- Rendered browser validation proved the complete discovery, an empty-Provision
  Near-Discovery, reload persistence, reduced motion, rapid input, the 390×844
  touch surface, and the centered desktop presentation.

### Next highest-leverage weakness

The clearing now matches the approved composition, but the sleeping Glowroot
is still baked into the environment plate. The next checkpoint should author
one restrained Rive reveal and breathing glow at the existing discovery point,
with React continuing to own whether the complete or clue branch is shown. No
new reward, destination, roll, or progression branch is needed.

### v0.32.0 — Rosie Wears the Choice — 2026-08-06

- Replayed Position 8 and compared it with `rosie-v3/08-departure.png`. The
  chosen Provision, Tool, and Pack were truthful in the ribbon, but Rosie was
  visibly empty-handed in the ready pose, so the physical preparation created
  in Position 7 disappeared at the moment it should become equipment.
- Traced the native `rosie_satchel` group through the checked-in Rive source,
  the editor timeline, and the rendered WebGL2 runtime. The authored `Rosie
  Pack` keys were correct; the runtime was scrubbing the nested group before it
  had been painted and was holding a time beyond its frame-16 settled pose.
- Fixed the Rive boundary by playing the Pack timeline once, scrubbing to the
  exact authored frame-16 endpoint, and pausing it on the next task whenever
  reducer-owned `satchelEquipped` is true. React still owns the fact; Rive owns
  the visible Bag and its attachment to Rosie.
- Preserved the existing one-shot Pack and Departure performances. The Bag now
  appears during confirmation, stays attached while Rosie crosses the Farm,
  and remains visible in the causal Adventure vignette without a duplicate DOM
  satchel or any change to Bag rules, timing, stock, or rewards.

### Observable acceptance criteria

- Position 8 shows the native tan clover satchel on Rosie alongside the exact
  selected Provision, Tool, and Pack.
- The equipped pose survives direct loading, reload, reduced motion, Previous /
  Next fast-forward, and the Position 7 **Pack these** handoff.
- The satchel follows Rosie's authored departure from the Barn and stays visible
  when Position 9 explains what the three choices enabled.
- Empty Bag state still uses the authored hidden pose; React remains the only
  owner of inventory and progression.

### Local validation evidence

- `npm run prototype:homegrown:test` — 39/39 pass, including deterministic Bag
  choices, persistence, departure timing, and Adventure carry-through.
- `npm run verify:rive-homegrown` — pass; the 390×844 artboard and 55 required
  authored names remain intact.
- `npm run prototype:homegrown:build` — pass with the authored Rive asset.
- `npm run quality:loop` and `npm run quality:check` — pass, including 78 layout
  tests, 202 security tests, TypeScript, sprite integrity, and contract gates.
- Rendered browser validation proved the equipped pose after Pack, direct
  Position 8 loading, reload, reduced motion, four sampled departure moments,
  and the Position 9 handoff. Rapid transition guards still advance once.

### Next highest-leverage weakness

Position 9 explains the deterministic cause and effect correctly, but its
abstract blurred CSS backdrop and floating report cards do not yet feel like
the twilight discovery pictured in `rosie-v3/09-adventure-vignette.png`. The
next checkpoint should bring the existing Glowroot encounter into one tangible
storybook clearing while preserving the same three causes and one continuation
action—no new destination, roll, currency, or reward system.

### v0.31.0 — The Bag Is Open — 2026-08-06

- Replayed Position 7 and compared it with
  `rosie-v3/07-free-bag-selection.png`. Provision, Tool, and Pack were already
  real choices, but three tall cards covered Rosie and the Bag itself was not
  visible, so preparation read as editing a form.
- Prototyped three compositions: an open Bag above a horizontal card row, an
  open Bag beside a compact typed slot stack, and an open Bag below three
  floating item cards. The side-by-side composition won because it preserves
  Rosie's face, makes the Bag the destination, and keeps all three **Leave
  empty** controls. The two losing layouts were removed.
- Generated one isolated empty tan satchel from the approved concept with the
  built-in ImageGen workflow, removed the chroma background, and shipped a
  transparent 52 KB WebP. The build explicitly publishes it with the other
  Homegrown world assets.
- Added small CSS-rendered Clover Lunch, Trowel, Lantern, Wicker Basket, and
  Cloth Wrap objects. Changing a slot immediately changes the matching object
  resting in the open Bag; empty slots show a quiet vacant token.
- Preserved React ownership of stock, slot selection, empty choices, packing,
  and progression. The existing authored Rive Pack response still owns the
  character's bounded packing motion after confirmation.

### Observable acceptance criteria

- Position 7 keeps canonical Rosie readable beside one open Bag and three
  concise typed choices rather than a full-width inventory screen.
- Provision shows the exact `5 → 4` spend and dusk purpose. Tool and Pack remain
  explicitly reusable and explain their Adventure purpose.
- Changing Trowel to Lantern or Basket to Cloth Wrap changes both the card and
  the visible object in the Bag. Any slot may still be left empty.
- Alternative and empty selections survive reload. **Pack these** advances
  once under rapid input and carries the same loadout into departure.
- The same composition remains readable at 390×844 touch size, centered
  1280×1000 desktop size, and with reduced motion enabled.

### Local validation evidence

- `npm run prototype:homegrown:test` — 39/39 pass, including free slots,
  alternative loadouts, one-use Provision spending, persistence, and every
  empty-slot Adventure branch.
- `npm run verify:rive-homegrown` — pass; the 390×844 header and 55 authored
  names, including the existing Pack response, remain valid.
- `npm run prototype:homegrown:build` — pass; the open Bag asset is copied into
  `docs/assets/homegrown-adventures/`.
- `npm run quality:loop` and `npm run quality:check` — pass, including 78 layout
  tests, 202 security tests, TypeScript, sprite integrity, and contract gates.
- Rendered Chromium proved the chosen mobile and desktop composition, every
  alternative, empty Provision, reload, reduced motion, rapid packing, and
  loadout continuity through the departure handoff.

### Next highest-leverage weakness

Position 8 correctly carries the chosen loadout forward, but it collapses back
into a thin report ribbon and canonical Rosie does not visibly wear the packed
satchel in the ready pose. Compared with `rosie-v3/08-departure.png`, the
physical preparation disappears at the exact moment it should become Rosie's
equipment. The next checkpoint should make the persisted Rive Bag readable on
Rosie before and during the existing departure without changing Adventure
timing or preparation rules.

### v0.30.0 — The Harvest Has a Home — 2026-08-06

- Replayed Position 6 after both the clean-rhythm and normal-gather branches
  and compared it with `rosie-v3/06-harvest-result-stock.png`. The values were
  correct, but the large cream report obscured Rosie and made a harvest feel
  like reading a dashboard.
- Prototyped three world-anchored compositions: a four-compartment shelf with
  a full harvest basket, a basket-first horizontal sign, and a row of loose
  crates. The shelf won because it turns stock into a place at the Farm while
  leaving Rosie and the Barn readable. The two losing layouts were removed.
- Generated an isolated storybook shelf and Clover basket from the approved
  Position 6 concept, removed the chroma background, and shipped transparent
  37 KB and 67 KB WebP assets. The build now explicitly publishes both assets
  beside the browser bundle.
- Kept all gameplay facts in React. The shelf overlays the real Clover Lunch,
  Clover Seed, Compost, and Materials values; the basket names the exact yield
  and only lists Compost or rhythm when that bonus was actually earned.
- Kept one primary action, **Prepare an Adventure**, and preserved the existing
  reducer guard so rapid input cannot spend stock or advance twice.

### Observable acceptance criteria

- Position 6 shows canonical Rosie, a full harvest basket, a four-compartment
  Farm Stock shelf, and one obvious preparation action without a floating
  inventory card.
- A clean rhythm shows `Clover Lunch +5` and `3 harvest · +1 Compost · +1
  rhythm`; normal gathering shows `Clover Lunch +4` and omits the rhythm cause.
- Reload preserves the same result. Reduced motion renders the same complete
  static composition without replaying a celebration.
- Rapid double-activating **Prepare an Adventure** reaches Position 7 once.
- The composition remains readable at 390×844 touch size and in the centered
  1280×1000 desktop presentation.

### Local validation evidence

- `npm run prototype:homegrown:test` — 39/39 pass, including both harvest
  branches, idempotent settlement, persistence, and reduced motion.
- `npm run verify:rive-homegrown` — pass; the 390×844 header and 55 authored
  names remain valid.
- `npm run prototype:homegrown:build` — pass; both new visual assets are copied
  into `docs/assets/homegrown-adventures/`.
- `npm run quality:loop` and `npm run quality:check` — pass, including 78 layout
  tests, 202 security tests, TypeScript, sprite integrity, and contract gates.
- Rendered Chromium proved touch and desktop composition, clean and normal
  yields, Position 7 single advancement under a double click, reload, and the
  persisted reduced-motion path.

### Next highest-leverage weakness

Position 7 correctly preserves the freely chosen Provision, Tool, and Pack,
but three tall cards cover Rosie and the Bag itself is not the center of the
choice. Compared with `rosie-v3/07-free-bag-selection.png`, preparation still
reads as editing a form instead of physically putting useful Farm things into
Rosie's open satchel. The next checkpoint should make the Bag the spatial
anchor without weakening free choice, empty slots, or stock-cost clarity.

### v0.29.0 — Harvest in the Garden — 2026-08-06

- Replayed Position 5 into Position 6 and compared it with
  `rosie-v3/05-harvest-rhythm.png`. The scoring was already correct, but a
  large five-section card covered the Farm and made the rhythm feel like form
  filling instead of harvesting a crop.
- Prototyped three compositions on the existing `?variant=A|B|C` route: a
  smaller floating card, a ribbon mapped to the three garden beds, and a Rosie
  coaching bubble. The bed-mapped ribbon won because Rosie, the ready Clover,
  and all three beds remain readable. The two losing branches were removed.
- Reduced the active interface to the flowered-bed swipe target, the exact
  `← → ↑` pattern, one current-direction cue, one accessible current-direction
  button, the guaranteed-yield promise, and a quiet normal-gather fallback.
  React still scores direction and timing and every completed harvest remains
  safe.
- Added persisted `harvestCompletedAt` timing. The final beat now clears the
  controls for 560 ms while the authored `Clover Harvest` clip performs, then
  reveals the stock result. Reload derives the remaining pause from that fact;
  reduced motion reveals the result immediately.
- Removed the CSS-generated leaf burst. During the one-shot, the painterly bed
  cover briefly yields to the Rive crop rig, so the authored Harvest is the
  only visible crop motion while React remains the only owner of yield, stock,
  rhythm eligibility, and progression.

### Observable acceptance criteria

- Position 5 keeps canonical Rosie, the ready flowered bed, and both resting
  beds visible while presenting one obvious instruction: **Swipe Left**.
- A left → right → up touch sequence advances the live cue one beat at a time
  and awards the existing +1 rhythm bonus; the single accessible button does
  the same without changing the guarantee.
- The final beat reports `data-rive-crop-motion="harvest"`, shows the authored
  crop leaving the bed without a competing result card, and reveals the
  Position 6 stock result after 560 ms.
- Reload after the first beat resumes at **Swipe Right**. Reload during the
  bounded celebration cannot duplicate stock and settles to the result.
- Reduced motion skips the one-shot and delay, and rapid double-final input
  records one harvest and one stock increase.

### Local validation evidence

- `npm run prototype:homegrown:test` — 39/39 pass, including the new persisted
  harvest-completion timestamp plus existing perfect, imperfect, slow, and
  normal-gather branches.
- `npm run verify:rive-homegrown` — pass; 390×844 header and all 55 authored
  names, including `Clover Harvest`, remain valid.
- `npm run prototype:homegrown:build` — pass; player and animation lab share
  the same content-hashed authored Rive binary.
- Rendered Chromium proved the final mobile composition, real touch swipes,
  accessible buttons, +1 rhythm result, the unobscured Rive-only performance,
  delayed stock reveal, one-beat reload, reduced-motion immediate reveal, and
  rapid double-final containment.

### Next highest-leverage weakness

Position 6 now waits politely for the harvest, but its dense floating result
card still covers much of Rosie and reads as a report rather than the Farm
stock shelf and full basket shown in `rosie-v3/06-harvest-result-stock.png`.
The next checkpoint should make that earned stock feel present in the world
without adding another inventory system.

### v0.28.0 — Clover Grows Up — 2026-08-06

- Replayed Position 3 through Position 5 and compared Position 4 with
  `rosie-v3/04-growing-fast-forward.png`. The timer and no-spoil promise were
  correct, but the bed still showed the same tiny sprouts as the first planting
  frame, so a two-hour crop did not visibly feel as though it was growing.
- Generated one painterly intermediate bed from the existing early and ready
  crop assets. It preserves the exact bed crop and camera while replacing only
  sparse shoots with a lush, flower-free clover middle state.
- Prototyped three motions in the paid Rive editor: whole-bed lift, breathing
  scale, and clover-only sunward wave. The clover-only treatment won because it
  keeps the soil grounded and lets only the living plant move; the two rejected
  studies were removed from the file.
- Added `Clover Growing Sway` to the checked Rive contract. The runtime holds
  the static reducer-selected Growing pose, plays the one-second authored sway,
  rests for 1.85 seconds, and repeats only while the bed is in the leafy middle
  stage. Reduced motion never starts the cadence.
- Made the Rive bridge derive `sprout` versus `growing` from explicit
  `plantedAt`, `readyAt`, and a 45% threshold supplied by React's presentation
  clock. Rive still owns no timer or progression fact. React also schedules the
  real ready settlement, so an open page no longer needs a reload to notice a
  completed crop.
- Kept Position 4 as a late-growth review checkpoint at 66% progress while
  real planting begins at 0%. Fast-forward and reload therefore review the lush
  state without falsifying the actual farming timeline.
- Removed the old CSS leaf-fragment loops. The painterly bed provides visual
  fidelity; the authored clover rig supplies the living cadence.

### Observable acceptance criteria

- Planting Clover first renders the sparse `sprout` bed and reports the Rive
  Plant response.
- At 45% elapsed growth, the same save renders the lush, flower-free `growing`
  bed without changing inventory, yield, or ready time.
- The authored crop cadence alternates `growing → swaying → growing`; it does
  not run for sprouts, ready crops, or reduced motion.
- Fast-forward to Position 5 produces the distinct flowered ready bed and the
  existing guaranteed Harvest Rhythm.
- Reloading Position 4 preserves the lush state and a ready Rive runtime.
- Rapid double fast-forward settles on Position 5 once and never skips to the
  harvest result.

### Local validation evidence

- `npm run verify:rive-homegrown` — pass; 390×844 header and 55 authored names,
  including `Clover Growing Sway` and the restored `Clover Bed Ready` pose.
- `npm run prototype:homegrown:test` — 39/39 pass, including deterministic
  sprout and threshold-derived lush states.
- `npm run prototype:homegrown:build` — pass; player and animation lab share
  the exact content-hashed Rive binary and lush crop asset.
- Rendered Chromium proved sparse planting, lush Position 4, flowered Position
  5, `growing / swaying` cadence samples, reload stability, reduced-motion
  `reduced` pose, and rapid double fast-forward containment.
- The Growth Focus animation lab renders the lush bed and reports the same
  reducer-derived `growing` state on its connected authored scene.

### Next highest-leverage weakness

Position 5 now receives a clearly mature crop, but the large Harvest Rhythm
panel competes with Rosie and the bed, and its reward burst still reads more
like interface feedback than a farm action. The next checkpoint should simplify
that composition and make the existing Rive Harvest performance carry the
moment without changing scoring, guaranteed yield, or the accessible fallback.

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
