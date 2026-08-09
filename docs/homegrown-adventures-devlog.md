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
64. **v0.63 — Moonberries Find Their Bed (shipped):** give the existing
    Grow Moonberries choice the same spatial clarity by relating it directly to
    the empty middle bed, while preserving the established moth payoff and
    single-action Home sequence.
65. **v0.64 — The Tickle Comes Back to Rosie (shipped):** return the
    post-Moonberry Tickle action from the detached bottom button to Rosie
    herself, so the moth response closes through the game's core affection
    gesture without adding a new ceremony.
66. **v0.65 — A New Day Arrives (shipped):** replace the abrupt Begin
    another day cut with one restrained morning handoff that preserves the
    remembered Farm before Position 2 asks for the next Seed.
67. **v0.66 — The Next Seed Leads (shipped):** simplify the remembered
    Position 2 hierarchy so the one next Seed choice leads while already-growing
    crops and optional Compost remain useful, quieter context.
68. **v0.67 — Optional Means Chosen (shipped):** stop preselecting Compost
    when the player chooses a Seed, so saving or spending the predictable boost
    is an explicit planting decision rather than an inherited default.
69. **v0.68 — The Boost Touches the Bed (shipped):** make chosen Compost
    answer during the existing Rive planting performance with one restrained
    soil-level cue, without bringing back a persistent special-dirt overlay or
    giving Rive resource authority.
70. **v0.69 — The Adventure Has a Name (shipped):** reveal one named field
    opportunity after Rosie's Tickle and carry its duration and environmental
    clues through farming, Bag preparation, and departure without adding a
    mission board or another card stack.
71. **v0.70 — The Open Gate Leads Somewhere (shipped):** let the
    planted Glowroot create a distinct second-day opportunity, make alternate
    Bag capabilities answer its clues, and return either Lanternleaf Path or a
    useful trail clue without adding another progression system.
72. **v0.71 — Lanternleaf Becomes a Place (shipped):** give the
    second expedition its own open-gate path, keep its selected Tool physical,
    and prevent remembered Home layers from leaking through Rosie's shared Rive
    artboard without changing progression.
73. **v0.72 — Lanternleaf Catches the Light (shipped):** let a few leaves on
    the established second route rise, hold, and fade through one dedicated
    native Rive timeline, while the first route and reduced-motion presentation
    retain their existing illustrated states.
74. **v0.73 — The Journey Comes Before the Find (shipped):** turn
    Position 9 into the environmental cause-and-effect beat, let Rosie continue
    exploring afterward, and reserve the named Discovery or clue for
    Homecoming without changing any outcome.
75. **v0.74 — The Journey Is Worth Watching (shipped):** replace the
    empty Farm spinner after Rosie's causal vignette with one calm route watch,
    an honest prototype fast-forward, and a gate-bell Homecoming handoff while
    keeping the reward hidden.
76. **v0.75 — The Bag Tells the Story (shipped):** turn the simultaneous
    Provision / Tool / Pack ledger into three short causal beats, let the Tool
    wake the route's existing Rive clue, and keep incomplete Bags kind without
    changing any outcome.
77. **v0.76 — Rosie Is Home (shipped):** replace the empty gate-bell yard with
    Rosie's existing authored Return performance and packed satchel, preserving
    the remembered Farm and withholding the reward until she is welcomed.
78. **v0.77 — Discovery to Garden (shipped):** preserve the one emotional
    welcome at the gate, then make the first reward action carry Glowroot toward
    the exact Farm bed it can change.
79. **v0.78 — Tool Bonus, Explained (shipped):** remove the orphan reward
    marker and explain the Trowel- or Lantern-earned extra directly beside the
    exact total in Farm stock.
80. **v0.79 — Seed to Soil (shipped):** carry one returned Glowroot Seed from
    the Barn table, through Rosie's hands, and into Bed 3 before planting.
81. **v0.80 — Glowroot First (shipped):** let the authored Farm change own one
    quiet beat before memory, stock, and Moonberries return.
82. **v0.81 — Memory in Its Place (shipped):** keep the first memory
    acknowledgement, then collapse repeat-state teaching and stock into one
    secondary Farm-memory pocket.
83. **v0.82 — One Cause at a Time (shipped):** let Provision, Tool, Pack, and
    the resulting find each own one field note while the illustrated Adventure
    remains primary.
84. **v0.83 — The Trowel Opens the Roots (shipped):** separate the first
    outing's Tool from its background and let one restrained dig fulfill the
    existing Hand Trowel cause.
85. **v0.84 — The Pack Carries the Find (shipped):** let one
    restrained trace of the Glowroot settle into the selected Pack, while an
    empty Pack visibly leaves the find in the clearing.
86. **v0.85 — Lunch Until Dusk (shipped):** let Rosie visibly use
    the packed Clover Lunch and let that use carry the existing Adventure into
    evening before Tool and Pack take over.
87. **v0.86 — Rosie Leans In (shipped):** let canonical Rive Rosie answer the
    Tool turning point with one restrained authored attention lean, including
    a useful No Tool clue, before she settles for the Pack beat.
88. **v0.87 — The Journey Continues (shipped):** replace the contradictory
    pre-journey find announcement and redundant confirmation with one quiet,
    route-specific bridge into Rosie's existing idle journey watch.
89. **v0.88 — Home Keeps the Dusk (shipped):** carry the Adventure's evening
    into the existing journey watch so the remembered Farm feels like the same
    place waiting for Rosie, with route-aware light and no additional screen.
90. **v0.89 — The Trail Turns Home (shipped):** let the existing
    journey note and route advance once from exploring to heading Home, derived
    from the outing's persisted timestamps rather than a new timer system.
91. **v0.90 — The Farm Holds the Journey (shipped):** move the
    browser's fast-forward shortcut beside its external progression rail so the
    waiting Farm stays quiet and Homecoming keeps the only primary action.
92. **v0.91 — The Rail Follows Rosie (shipped):** let Position 9's external
    review readout name the causal story, trail, homeward, and gate states it
    is actually showing without adding another label inside the Farm.
93. **v0.92 — The HUD Turns Home (shipped):** let the persistent top objective
    follow the same trail, homeward, and Home facts as the story and review rail
    without adding copy or changing its footprint.
94. **v0.93 — The Description Turns Home (shipped):** let the existing Barn
    image description lead with Rosie's real journey phase and route so
    screen-reader review no longer begins with a stale trail state.
95. **v0.94 — The Journey Remembers the Bag (shipped):** keep one quiet,
    truthful stamp of the Provision, Tool, and Pack choices attached to the
    journey note until Rosie reaches the gate.
96. **v0.95 — Home Has a Time (shipped):** attach one calm local
    **Expected Home** promise to the existing journey note, derived from the
    outing's persisted completion timestamp without adding a countdown or
    another timer system.
97. **v0.96 — Tomorrow Means Tomorrow (shipped):** add local calendar
    context to the existing return ticket only when Rosie's persisted return
    crosses midnight, without changing the journey or expanding the surface.
98. **v0.97 — Grow for Rosie (shipped):** keep the current Adventure's purpose
    and exact clues attached to Farm Stock through Seed choice, without adding
    a quest panel or covering more of Rosie.
99. **v0.98 — A Lunch, Not a Number (shipped):** name the actual Clover Lunch
    outcome and exact Compost benefit at planting instead of asking the player
    to interpret anonymous Harvest 3 / Harvest 4 numbers.
100. **v0.99 — Swipe the Clover (shipped):** make the flowered bed the
    one obvious Harvest Rhythm surface, integrate the accessible tap fallback
    into its active arrow, and keep the exact guaranteed harvest visible.
101. **v0.100 — The Bag Belongs to the Player (shipped):**
    begin Position 7 empty, present one direct preparation question at a time,
    and keep every slot optional without hiding the alternatives or the open
    Bag.
102. **v0.101 — The Journey Tells the Truth (shipped):** keep an incomplete
    Bag causal through the idle journey by changing the existing field note and
    route into a specific Near-Discovery, without adding another results card.
103. **v0.102 — The Clue Comes Home (shipped):** present an incomplete return
    as a named Field Guide update, separate it from actual Farm supplies, and
    open the exact Bag pocket that can complete the Discovery next time.
104. **v0.103 — The Bag Remembers the Clue (shipped):** keep the earned Field
    Guide lesson attached to its Bag pocket and visibly answer it when the
    player packs a capability for the repeated Adventure.
105. **v0.104 — The Farm Names What Changed (shipped):** make the completed
    Glowroot Discovery name its lasting effects at Home while keeping exact
    material quantities in the existing stock drawer.
106. **v0.105 — Glowroot Opens the Next Route (shipped):** connect the lasting
    Glowroot Discovery directly to the next morning's Clover preparation in
    the existing primary Seed action.
107. **v0.106 — Two Crops, Two Ways Forward (shipped):** turn the remembered
    crop screen into a real Clover-or-Moonberry decision, carry each choice
    through its own timer and Harvest Rhythm, preserve both stockpiles, and let
    the packed harvest visibly change Rosie's existing Lanternleaf journey.
108. **v0.107 — Moonberry Roots Remember (shipped):** replace the silent
    post-harvest refill with visible young rootstock, one clear harvest receipt,
    and continuous Bed 2 state through Adventure, Homecoming, reload, and the
    following morning.
109. **v0.108 — Clover Harvest Stays Harvested (shipped):** keep annual Clover's
    first bed visibly empty after its Seed-paid Harvest, through changed Home,
    reload, and the following morning, without adding stubble, a replant prompt,
    or another crop rule.
110. **v0.109 — Dusk Answers the Provision (shipped):** replace the Adventure's
    opening Provision receipt with one in-scene use, a delighted Rosie response,
    route-colored dusk lights, and exact cause text in the existing HUD.
111. **v0.110 — The Ground Answers the Tool (shipped):** remove the next large
    receipt and let Rosie's Notice, the physical Tool, route-aware ground or
    light responses, and the existing HUD explain the cause together.
112. **v0.111 — The Pack Receives the Find (shipped):** remove the final Bag
    receipt, keep the physical find-to-Pack handoff primary, and explain every
    complete, clue, alternative, and empty-Pack outcome in the existing HUD.
113. **v0.112 — The Trail Opens for Rosie (shipped):** remove the final centered
    journey caption and let route-colored path lights plus the existing HUD
    carry Rosie automatically into the idle journey.
114. **v0.113 — The Trail Lights Reach Home (shipped):** carry those same lights
    across the scene change, let Home breathe first, then settle the existing
    idle information and prototype fast-forward into place.
115. **v0.114 — One Field Folio (shipped):** fold the stable journey story,
    **Expected Home** promise, and exact Packed choices into one physical note
    while keeping the three-step route and Farm visible.
116. **v0.115 — The Lights Carry the Route (shipped):** remove the numbered
    route widget and let five route-colored lights plus one current phrase
    carry the same exact path state in the painted world, while preserving the
    ordered route for assistive technology.
117. **v0.116 — The Ready Crop Leads (shipped):** let the crop announce its
    exact harvest before Rosie's affectionate Tickle opens the established
    personal rhythm, removing a misleading welcome-home beat from Farm growth.
118. **v0.117 — The Satchel Belongs to Rosie (shipped):**
    replace the remaining chest-tile attachment with a compact screen-left hip
    satchel that stays registered through Pack, departure, Return, reload, and
    reduced motion without changing the Bag system or Rosie's canonical rig.

Depth and polish win over new crops, destinations, currencies, or parallel
systems. Each checkpoint starts with play and ships only after rendered proof.

## Version history

### v0.117 — The Satchel Belongs to Rosie — 2026-08-08

- Began at the exact weakness left by v0.116: Position 8's Bag was truthful but
  still read as a flat rectangle laid over Rosie's chest. The stable packed
  pose, authored Pack one-shot, full departure, Return, reload, and
  reduced-motion pose were all played before changing the source.
- Compared three runnable attachment treatments against
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/08-departure.png`:
  the current chest Bag, a compact screen-left hip satchel, and a back sling.
  The hip satchel won because it clears Rosie's face, snout, front legs, and
  farming beds while remaining readable at phone scale. The back sling looked
  like a loose tail on the current front-facing character and is reserved for
  a future three-quarter pose. The isolated evidence and verdict remain at
  prototype commit `0837f9a` on
  `codex/homegrown-v117-satchel-prototypes`; no experiment switcher shipped.
- Re-authored the existing native `rosie_satchel` group in the paid Rive file
  instead of adding a DOM duplicate or another equipment system. Its stable
  pose now sits at Rosie's screen-left hip; Pack gives it one compact rise and
  settle, Return gives it one restrained weight shift, and Departure keeps a
  small counter-swing while the body crosses toward the hedge.
- React's `satchelEquipped` fact still owns whether the Bag exists. Item
  identity, inventory, packing costs, deterministic Adventure results,
  persistence, timers, and accessible controls are unchanged. Reload and
  reduced motion hold the same equipped endpoint without replaying the
  one-shots.
- Rendered QA exposed one separate lab defect: the **Equip the Bag** study had
  not entered the reducer's newer Position 7 Bag-selection state, so Pack was
  correctly rejected and the lab falsely showed a hidden Bag. The study now
  performs `OPEN_BAG_SELECTION` before Pack, with a regression assertion.

### Local validation evidence

- The real Position 8 reload reports the authored asset `ready`,
  `satchelEquipped=true`, and normal breathing with the compact hip pose. The
  actual **Follow the glow** action reports `motion=departure` and
  `lastPerformedMotion=departure`; the animation lab shows the Bag remaining
  attached through early and late walk frames.
- The real fast-forward and **Welcome Rosie home** path reports
  `lastPerformedMotion=return`, keeps the satchel clear of the named Glowroot
  and returned-material table, and settles without changing rewards. Reduced
  motion reports `motion=reduced` while retaining the same equipped pose.
- `npm run prototype:homegrown:test` passes 85/85, including the repaired
  Pack-study sequence. `npm run verify:rive-homegrown` passes the 390×844
  header and all 60 authored names. `npm run prototype:homegrown:build`,
  `npm run quality:loop`, and `npm run quality:check` pass; the repository gate
  covers 157 layout files, 324 sprites, TypeScript, 78 layout assertions, and
  202 security assertions. Watchman's existing recrawl notice and manual
  mobile Safari checks remain warnings.

### Public verification evidence

- Feature commit `8a14c8b` deployed successfully through GitHub Pages run
  `31286926245`.
- Exact checked-in checkpoint bytes:
  - authored runtime Rive: `b71059e81f9949ad7001901e26dd0e9d8f3bfd6ce65e2f7371c1a4ba1cf871a2`
  - player HTML: `b9ff0058b840c20e8e530d54bdea9ee31ad292077a6b69121abc1ca972a8abc4`
  - player JavaScript: `090f0e8883b19d454fc0e24444db8cf465a99f83ca5fb97fbd805466a282e8f8`
  - player CSS: `305257d0316d43548363f27d51049db1f240b74968929234be90a158f81a0d30`
- Direct public fetches match all four hashes. The rendered public Position 8
  reports `asset=authored`, `status=ready`, normal `motion=breathing`, and
  `satchelEquipped=true`; **Follow the glow** immediately reports
  `motion=departure` and `lastPerformedMotion=departure` while keeping the Bag
  equipped.
- Exact checkpoint route:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&mode=loop&position=8&v=8a14c8b`

### Next highest-leverage weakness

Continue the chronological replay inside the first causal Adventure beat.
Determine whether the selected Pack remains a legible physical capability once
Rosie enters the clearing, rather than assuming that the departure pose or HUD
labels prove the Adventure itself.

### v0.116 — The Ready Crop Leads — 2026-08-08

- Began with the required fresh-player replay of all eleven positions after
  v0.115. Purpose, planting, stock, Bag, causal Adventure, waiting, Homecoming,
  and lasting Home memory formed one understandable chain. The first break was
  earlier: **Preview it ready** produced **Rosie noticed something / Welcome
  Rosie**, even though Rosie had never left Home and the player needed to
  understand that a harvest was ready.
- The settled crop now leads with **Clover Lunch is ready** or **Moonberries are
  ready**. The supporting line says that Tickle begins that crop's Harvest
  Rhythm, Rosie's in-world action is the familiar **Tickle Rosie**, and the
  scene description names the same ready crop.
- Tickle remains a real affection action: it increments the same earned count,
  plays the existing authored Rosie response, and then exposes the unchanged
  crop-specific rhythm, guaranteed yield, optional normal-gather fallback, and
  small clean-rhythm bonus. Only the misleading handoff language changed.
- A Moonberry branch assertion caught and fixed **Moonberries's** before ship;
  the final plural copy uses **Moonberries’ harvest rhythm**. Crop duration,
  Compost rules, readiness, no-spoil behavior, yield, Farm stock, save format,
  Rive source, View Model, and authored motions are unchanged.

### Local validation evidence

- Played Position 4 into the real settled Clover-ready state at 1280×720. The
  rendered HUD, scene description, and only in-world action all named the ready
  Clover before interaction. Tickle increased affection from 1,120 to 1,121
  and immediately exposed **Harvest for Rosie’s journey**, **Clover rhythm: ←
  → ↑**, and the accessible **Tap Left instead** fallback with no horizontal
  overflow or console warnings.
- `npm run prototype:homegrown:test` passes 84/84, including both Clover and
  Moonberry ready-copy branches. `npm run prototype:homegrown:build`, `npm run
  quality:check`, and `npm run verify:rive-homegrown` pass. The quality gate
  covers 157 layout files, 324 sprites, security contracts, TypeScript, 78
  layout tests, and 202 security tests. Watchman's existing recrawl notice and
  manual mobile Safari checks remain warnings.

### Public verification evidence

- Feature commit `4d70005` deployed successfully through GitHub Pages run
  `31285295681`.
- The deployed player bytes match the locally rendered checked-in artifacts
  exactly:
  - player HTML: `2a8b96e5d03663247a492da418a77c75dbf8cd2e1e648b34b8f30c369956b0c5`
  - player JavaScript: `ecda8ed74a59e14aa604778b11f378ea8b47f403c7d3432e914a683d646f5fa6`
  - player CSS: `305257d0316d43548363f27d51049db1f240b74968929234be90a158f81a0d30`
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&mode=loop&position=4&v=4d70005`

### Next highest-leverage weakness

Continue the chronological replay at departure after the production Rive scene
is fully ready. Determine whether Rosie's packed satchel reads as worn
equipment or as a flat UI tile over her body; distinguish the stable pose from
the intentional Bag-receive transition before choosing a checkpoint.

### v0.115 — The Lights Carry the Route — 2026-08-08

- Began from v0.114's verified one-field folio and replayed the stable Glowroot,
  Lanternleaf, homeward, Homecoming, reduced-motion, and incomplete-Bag states.
  The folio now read as one object, but the numbered three-node route still
  looked like a progress widget laid over the Barn instead of part of Rosie's
  journey.
- Compared three physical treatments in the real Position 9 composition: path
  stones, tied waymarks, and living route lights. Living lights won because
  they reuse the established warm moth and silver reflection language, keep
  the painted path visible, and require no invented prop vocabulary. Stones
  still read like board-game tokens; tied waymarks added visual clutter.
- Captured all three runnable treatments and their verdict at commit `8419a81`
  on `codex/homegrown-v115-physical-route-prototypes`. Main contains no `path`
  query parameter, prototype switcher, path stones, or tied-waymark treatment.
- Five warm Glowroot lights or silver Lanternleaf reflections now live on the
  painted path. One route-aware phrase names the active trail, the turn toward
  Home, or Rosie at the gate. Homeward reverses the light cadence; Homecoming
  settles it. Near-Discovery renders five static dashed clue rings and its
  exact clue name without implying a completed find.
- The exact ordered **Set off → named route → Homeward** list, current step,
  labels, and accessible Adventure status remain in the DOM and are visually
  clipped rather than removed. Reduced motion keeps all five lights stable.
  This checkpoint changes no reducer fact, timestamp, Bag choice, reward,
  save field, Rive source, View Model, or authored motion.

### Local validation evidence

- Played the real stable Glowroot and Lanternleaf watches at 500×844, the
  Glowroot homeward turn, the gate state, reduced motion, and a deliberately
  incomplete Pack reached through the actual Position 7 UI. Every complete
  route shows five correctly colored path lights and the exact phrase;
  incomplete Pack shows **Leaf-print**, five dashed rings, and no reward Rive
  canvas.
- Prototype fast-forward reaches the unchanged Return and **Welcome Rosie
  home** handoff. Direct reload preserves the same phase and route treatment;
  Homecoming exposes the large in-world action without restarting the light
  cadence.
- `npm run prototype:homegrown:test` passes 83/83. `npm run
  prototype:homegrown:build`, `npm run quality:loop`, `npm run quality:check`,
  and `npm run verify:rive-homegrown` pass. The quality gate covers 157 layout
  files, 324 sprites, security contracts, TypeScript, 78 layout tests, and 202
  security tests. Watchman's existing recrawl notice and manual mobile Safari
  checks remain warnings.

### Public verification evidence

- Feature commit `72028af` deployed successfully through GitHub Pages run
  `31284692609`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `b01624cbf7bab4bf240967117c31b9a1b9fea10686e9cc0c9ca28dda2a8bc306`
  - player JavaScript: `2fb4938fec3e32109ca9a226054434918d9463db138153fc266e1495f4d34077`
  - player CSS: `305257d0316d43548363f27d51049db1f240b74968929234be90a158f81a0d30`
- Public CDP playback waited for the production Rive asset, then verified the
  stable Glowroot watch (**Warm moth trail**), Lanternleaf watch (**Reflected
  leaves**), and Glowroot homeward turn (**Warm lights turn Home**). Each had
  five physical lights, the accessible ordered route, a clipped redundant
  visual list, and no horizontal overflow at 500×844. The away-state Rive
  canvas remained hidden as intended.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=9&route=glowroot&v=72028af`

### Next highest-leverage weakness

The idle journey watch is now visually coherent. Replay Positions 1–11 as a
fresh player and choose the first place where the complete **Tickle → purpose
→ grow → harvest → stock → Bag → Adventure → Home memory** chain becomes
unclear. Do not add another crop or route until that full-loop weakness is
visible in the rendered game.

### v0.114 — One Field Folio — 2026-08-08

- Began from v0.113's verified light bridge and replayed the settled Glowroot
  and Lanternleaf watches. The journey facts were correct, but the field note,
  detached return ticket, detached Packed stamp, route, and prototype control
  still read as competing widgets across the top third of Home.
- Compared three structures in the real Position 9 composition: one field
  folio with a divided facts footer, a route-first composition, and one larger
  journal containing story, route, and facts. The field folio won because it
  keeps Rosie's story first and returns more of the illustrated Farm than the
  all-in journal; the route-first version scattered the explanation.
- Captured all three runnable treatments and the verdict at commit `3ddab97`
  on `codex/homegrown-v114-idle-watch-prototypes`. Main contains no `watch`
  query parameter, variant switcher, route-first structure, or oversized
  journal.
- The exact route-aware story, persisted local return promise, and accessible
  **Rosie set out with** Provision / Tool / Pack group now share one physical
  folio. A single divider separates story from trip facts; the route remains
  immediately beneath it. Empty Bag slots, overnight wording, homeward copy,
  and Homecoming removal stay truthful.
- This is presentation consolidation only. The reducer, timestamps, six-hour
  duration, Bag selections, Near-Discovery causes, reward quantities, save
  format, Rive binary, View Model, and authored motions are unchanged.

### Local validation evidence

- Played the real stable Glowroot and Lanternleaf routes at 500×844 plus the
  Glowroot homeward turn. Each shows one folio, the correct warm or silver
  route color, the full three-step state, exact Packed art, and the stable
  local return promise with no overlap. The homeward turn advances the same
  note and route to **Rosie is heading Home**.
- The field folio leaves the Farm visible and preserves the existing external
  prototype fast-forward. Its entry animation now fades the folio once rather
  than independently animating nested trip facts; reduced motion keeps the
  complete static presentation.
- `npm run prototype:homegrown:test` passes 83/83. `npm run
  prototype:homegrown:build`, `npm run quality:loop`, `npm run quality:check`,
  and `npm run verify:rive-homegrown` pass. The quality gate covers 157 layout
  files, 324 sprites, security contracts, TypeScript, 78 layout tests, and 202
  security tests. Watchman's existing recrawl notice and manual mobile Safari
  checks remain warnings.

### Public verification evidence

- Feature commit `eba48aa` deployed successfully through GitHub Pages run
  `31283945366`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `47363dc995c340393b22b28db328c900b919c338807774d38469f99acd17e8d1`
  - player JavaScript: `f6946efb534123c8e8f1de50d8cfabedd9891cc56dc219efef428a7bf45ccf44`
  - player CSS: `7decc208fcab2faa890b76daa33c04d484faf74704b0f7330f1c6d957804d196`
- Public CDP playback confirmed the stable Glowroot watch after the Rive asset
  reached `ready`: the authored scene had computed opacity `0` while Rosie was
  away, the document had no horizontal overflow, and the consolidated folio,
  route, lights, and fast-forward were all visible. The public Lanternleaf
  route reproduced the same layout with silver leaves and its earned pond.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=9&route=glowroot&v=eba48aa`

### Next highest-leverage weakness

The numbered route is now the only remaining abstract UI object over the Barn
art. Replay the complete wait and compare whether the same truthful **Set off
→ route → Homeward** state can live as physical trail markers or lights in the
path without weakening accessibility, adding state, or hiding the expected
return.

### v0.113 — The Trail Lights Reach Home — 2026-08-08

- Began from v0.112's clean trail opening. The next frame still replaced the
  clearing with the complete Farm watch, note, ticket, Packed stamp, route, and
  fast-forward all at once, so the journey felt like a hard screen change.
- Compared the existing cut, a route-tinted dusk dissolve, and a
  lights-arrive-first bridge in the real Position 9 sequence. The light bridge
  won because the same world object now crosses the edit; the dissolve was
  smoother but generic.
- Captured all three treatments and the decision at commit `ad883fe` on
  `codex/homegrown-v113-journey-entry-prototypes`. Main contains no query
  switcher, generic dissolve, new click, or permanent transition state.
- Five warm Glowroot lights or silver Lanternleaf lights now travel into the
  Farm path for 900 ms. The existing note, return time, Packed reminder, route,
  and prototype fast-forward settle only after Home receives that visual beat.
- The bridge is ephemeral React presentation. Direct reload and reduced motion
  show the stable idle watch immediately. The reducer, six-hour timestamps,
  route, reward, Rive binary, View Model, and authored motions are unchanged.

### Local validation evidence

- Played the real Glowroot transition with WebGL enabled at 500×844. Its early
  frame had five warm lights, no note, no fast-forward, a ready Rive scene, and
  no horizontal overflow; the note settled during the bridge, then the lights
  left and fast-forward returned on the unchanged **Following the trail** watch.
- Lanternleaf rendered the same bridge in `#c3ead6` and retained **Rosie is
  following reflected leaves**. Reduced motion mounted no bridge, kept the note
  fully visible, and kept fast-forward available on the stable watch.
- `npm run prototype:homegrown:test` passes 83/83. `npm run
  prototype:homegrown:build`, `npm run quality:loop`, `npm run quality:check`,
  and `npm run verify:rive-homegrown` pass. The quality gate covers 157 layout
  files, 324 sprites, security contracts, TypeScript, 78 layout tests, and 202
  security tests. Watchman's existing recrawl notice and manual mobile Safari
  checks remain warnings. `npm run verify:rive-web` remains blocked by the
  separate uncommitted rewarded-ad native web import recorded in v0.112.

### Public verification evidence

- Feature commit `1bc11ce` deployed successfully through GitHub Pages run
  `31283210770`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `bd61b1a8015936746c5c6ee7ca98890746c5a89dee9a27132b934c28e93160be`
  - player JavaScript: `37b019125dd16b0a344b3434ec855e8f31033c8fbd18e6f119e3cf226acdefcc`
  - player CSS: `bf3a63cc512982ba0d39f10b1c03512cf9b0c06d3c7178fe6497897450d56ecb`
- Public rendered playback reproduces the quiet early Home frame, five warm or
  silver route lights, delayed note and fast-forward, ready Rive scene, no
  overflow, and the unchanged stable journey watch.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=9&route=glowroot&v=1bc11ce`

### Next highest-leverage weakness

After the bridge settles, the stable idle watch still asks the player to parse
the field note, separate return ticket, separate Packed stamp, three-step route,
and prototype fast-forward together. Prototype a calmer one-glance hierarchy
that preserves every fact without adding another drawer, screen, or journey
state.

### v0.112 — The Trail Opens for Rosie — 2026-08-08

- Began from the publicly verified card-free Provision, Tool, and Pack
  sequence. Its separate resolved beat still placed **The journey continues…**
  over the clearing, briefly returning the journey to report UI.
- Compared the existing centered caption, a physical wooden path marker, and a
  card-free trail opening in the real Position 9 composition. The trail won:
  the caption repeated the HUD and the marker invented an unexplained object.
- Captured all three treatments and the decision at commit `5c6a551` on
  `codex/homegrown-v112-journey-handoff-prototypes`. Main contains no handoff
  switcher, marker, caption, confirmation, extended timing, or new interaction.
- Five warm Glowroot lights or silver Lanternleaf lights now rise from the Pack
  transfer into the path. The existing HUD names the route destination and a
  polite hidden status preserves the full transition for assistive technology.
- The 900 ms automatic handoff, 1.8-second reduced-motion hold, idle journey,
  deterministic outcomes, Rive binary, View Model, and authored motions remain
  unchanged. Reduced motion paints all five lights statically.

### Local validation evidence

- Played both real rendered routes with WebGL enabled at 500×844. Glowroot
  rendered **Warm lights lead Rosie onward · Beyond the hedge**; Lanternleaf
  rendered **Silver leaves lead Rosie onward · Past the open gate**. Each had
  five route-colored lights, no old handoff card, a ready authored Rive scene,
  no horizontal overflow, and transitioned automatically into the matching
  **Following the trail** journey watch.
- The reduced-motion Lanternleaf route reported `animation-name: none` on all
  five lights, retained the polite route status, and held the resolved scene
  before the existing transition.
- `npm run prototype:homegrown:test` passes 82/82. `npm run
  prototype:homegrown:build`, `npm run quality:loop`, `npm run quality:check`,
  and `npm run verify:rive-homegrown` pass. The quality gate covers 157 layout
  files, 324 sprites, security contracts, TypeScript, 78 layout tests, and 202
  security tests. Watchman's existing recrawl notice remains a warning.
- `npm run verify:rive-web` is presently blocked outside this checkpoint by the
  uncommitted rewarded-ad work importing `react-native-google-mobile-ads`'s
  native banner component during Expo web export. The Homegrown Rive static
  contract itself passes; manual mobile Safari checks remain required.

### Public verification evidence

- Feature commits `aa1ef39` and `8a1e267` deployed successfully through GitHub
  Pages runs `31282565329` and `31282645468`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `f3a749d6eff44386435d2d217d7a0aea6544e703d075f3cfb38b45ec74d04deb`
  - player JavaScript: `68206eba32eaf8c60fbfd2050b16bd4e8ad6b5fbd0e2ec8fa954c721c93352cc`
  - player CSS: `b0c430d2c558150bd80139c785ae46239a98b3dde8442013c5b535cebb6d8388`
- Public rendered playback reproduces both HUD destinations, five lights,
  route-specific color, hidden status, ready Rive state, absent old caption,
  and the automatic transition into the existing idle journey.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=9&route=glowroot&v=8a1e267`

### Next highest-leverage weakness

The trail now opens cleanly, but the receiving transition still hard-cuts from
the enchanted clearing to the information-heavy idle Farm watch. Prototype a
continuous departure-to-Home watch transition without adding a loading screen,
new journey state, reward, timer, or confirmation.

### v0.111 — The Pack Receives the Find — 2026-08-08

- Began from the card-free Provision and Tool beats. Pack was the only remaining
  Bag cause that covered the clearing with a field-note receipt, even though a
  complete Glowroot find already moved visibly into the selected Pack.
- Compared the existing receipt, a smaller Pack-side label, and a card-free
  physical resolution in the real Position 9 composition. The card-free
  treatment won because both labels redirected attention during the transfer.
- Captured all three treatments and the decision at commit `f1baaa4` on
  `codex/homegrown-v111-pack-beat-prototypes`. Main contains no switcher,
  extended timing, or Pack label, and the now-unused field-note markup and CSS
  have been removed.
- Wicker Basket, Cloth Wrap, complete Discovery, Near-Discovery, and no Pack now
  receive exact route-aware HUD copy plus hidden live-region causes. Wicker and
  Cloth use distinct restrained finishes. Empty Pack uses remembered trail
  leaves and never displays the complete-branch find handoff.
- The existing find-to-Pack animation, 900 ms beat, deterministic reward rules,
  later journey, reduced-motion behavior, Rive binary, View Model, and authored
  motions are unchanged. The three Bag causes now contain zero field-note cards.

### Local validation evidence

- Replayed the real Glowroot Pack beat with WebGL enabled. It reported exact
  Wicker Basket copy, zero field-note cards, three Pack responses, the correct
  `wicker-basket` visual kind, a visible find handoff, and a ready Rive scene.
  Lanternleaf rendered its route-specific supply copy; the Near-Discovery state
  kept the find hidden.
- `npm run prototype:homegrown:test` passes 82/82, including complete and clue
  branches, Wicker Basket, Cloth Wrap, no Pack, hidden cause text, reduced
  motion, the find handoff, and the absence of field-note markup and CSS. `npm
  run prototype:homegrown:build`, `npm run quality:loop`, `npm run
  quality:check`, `npm run verify:rive-homegrown`, and `npm run verify:rive-web`
  pass. The quality gate covers 157 layout files, 324 sprites, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice and manual mobile Safari checks remain warnings.

### Public verification evidence

- Feature commit `3fd3fc4` deployed successfully through GitHub Pages run
  `31281977886`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `0e63b20d9bab7580d54785e1eebee76f7057bf3b5bf6f808de9a6dcced309897`
  - player JavaScript: `7bae0607b9604d6c809086a6275ac237dd80d84740b54cb20079126f869d549a`
  - player CSS: `9761695267738c907f3eb34c6abedd85e56635647aa1af239b094b973ec14e67`
- Public rendered playback at Pack reports exact Wicker Basket copy, zero
  field-note cards, three Pack responses, `wicker-basket`, a visible find
  handoff, and a ready authored Rive scene.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=9&route=glowroot&v=3fd3fc4`

### Next highest-leverage weakness

After the clean three-cause story, the separate resolved beat still places a
centered **The journey continues…** sign over the clearing. Test a world-led
handoff into the existing idle trail without adding another journey screen,
timer, encounter, or reward.

### v0.110 — The Ground Answers the Tool — 2026-08-08

- Began from the publicly verified v0.109 Provision beat. The very next 900 ms
  Tool beat already contained a physical Hand Trowel dig, the Glowroot or
  Lanternleaf route response, and an authored `Rosie Notice`, but a large field
  note still covered the clearing and repeated the same cause.
- Compared the current receipt, a small ground-level trail label, and a
  card-free world response in the real Position 9 composition. The card-free
  treatment won on both routes: the receipt hid the world, and the smaller label
  still competed with the Tool it explained.
- Captured all three treatments and the decision at commit `82d8ccc` on
  `codex/homegrown-v110-tool-beat-prototypes`. Main contains no study switcher,
  extended timing, or trail label.
- The existing HUD now names Hand Trowel, Lantern, and no-Tool outcomes on both
  Glowroot and Lanternleaf. The same exact cause remains in hidden live-region
  text, while three restrained Tool-aware details read as soil, lantern motes,
  or falling undisturbed leaves.
- The existing `adventure-attention` Rive motion remains the only Rosie response.
  The Rive binary, View Model, triggers, reducer outcomes, rewards, timers,
  inventory rules, persistence schema, and later Pack beat are unchanged.

### Local validation evidence

- Replayed Glowroot and Lanternleaf at the real 900 ms cadence with WebGL
  enabled. During Tool, each route reported zero field notes, three ground
  responses, exact Hand Trowel copy, `data-rive-status=ready`, and current plus
  last motion as `adventure-attention`. Rosie, the Tool, and the route remained
  visible together.
- `npm run prototype:homegrown:test` passes 82/82, including Tool HUD copy,
  Hand Trowel, Lantern, no Tool, hidden cause text, both routes, reduced motion,
  and the existing authored Notice. `npm run prototype:homegrown:build`, `npm
  run quality:loop`, `npm run quality:check`, `npm run verify:rive-homegrown`,
  and `npm run verify:rive-web` pass. The quality gate covers 157 layout files,
  324 sprites, security contracts, TypeScript, 78 layout tests, and 202 security
  tests. Watchman's existing recrawl notice and manual mobile Safari motion
  checks remain warnings.

### Public verification evidence

- Feature commit `f4a0cda` deployed successfully through GitHub Pages run
  `31281570647`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `b3b2344158ee0cd8a3f70749da2e82bc3ec7cd3f9affbe42150f49a593f95ebb`
  - player JavaScript: `6e98475a9e12a7b595dc5a0ed0e8e1a6c59cc336f77bd3913629f522316b3cd7`
  - player CSS: `1212171f65f5be4c5d8706970eba3a152d868b714f863abaac687d47eb43bd8e`
- Public rendered playback at the Tool beat reports exact Hand Trowel copy,
  zero field-note cards, three ground responses, the correct `hand-trowel`
  visual kind, a ready Rive scene, and `adventure-attention` as both current and
  last performed motion.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=9&route=glowroot&v=f4a0cda`

### Next highest-leverage weakness

Pack is now the only Bag cause still presented as a large receipt. Its physical
find-to-Pack handoff is already working. Compare a card-free Pack resolution
against the current receipt, preserve exact empty-Pack and alternative-Pack
causes, and do not add another reward, encounter, destination, or screen.

### v0.109 — Dusk Answers the Provision — 2026-08-08

- Began by replaying the deployed complete Glowroot and Lanternleaf routes. Both
  opened Position 9 with the correct food and time-of-day animation, but a large
  inventory-like field note claimed attention before Rosie or the clearing.
- Compared the current receipt, a small Rosie picnic caption, and an
  environment-led dusk response in the actual Adventure composition. The
  environment-led treatment won because it keeps the clearing visible and uses
  the existing quiet HUD instead of adding another surface. The picnic study's
  single Rosie response was retained because it makes the food feel received.
- Captured all three treatments and the decision at commit `6d865df` on
  `codex/homegrown-v109-provision-beat-prototypes`. Main contains no study
  switcher, extended review timing, or picnic caption.
- The Provision now moves into Rosie, fades, and stays consumed. Four restrained
  lights rise with warm gold on the Glowroot route and pale green on the
  Lanternleaf route. Tool and Pack props remain available for their later
  deterministic beats.
- The existing HUD now names the actual outcome for Clover Lunch, Moonberries,
  and no Provision on each route. The overlay retains the same cause as hidden
  live-region text, so removing the visible receipt does not remove its
  accessible explanation.
- React emits one presentation-only `adventure-provision` motion. The Rive
  boundary reuses the authored `Rosie Tickle` timeline without firing the
  reducer-owned Tickle trigger or adding a Rive binary, View Model property,
  reward, timer, inventory rule, or save fact.

### Local validation evidence

- Replayed the real Position 8 → 9 handoff with WebGL enabled. During Provision,
  the DOM reported zero field notes, four dusk lights, exact Clover Lunch copy,
  `data-rive-status=ready`, and both current and last performed motion as
  `adventure-provision`. Rosie remained the live authored character in the
  clearing. Direct Lanternleaf playback showed the nightfall copy and four
  route-colored lights before its existing Tool beat.
- `npm run prototype:homegrown:test` passes 82/82, including the HUD copy,
  persistent one-use food, accessible cause, both light treatments, reduced
  motion, and presentation-only Rive response. `npm run
  prototype:homegrown:build`, `npm run quality:loop`, `npm run quality:check`,
  `npm run verify:rive-homegrown`, and `npm run verify:rive-web` pass. The
  quality gate covers 157 layout files, 324 sprites, security contracts,
  TypeScript, 78 layout tests, and 202 security tests. Watchman's existing
  recrawl notice and manual mobile Safari motion checks remain warnings.

### Public verification evidence

- Feature commit `abc2ad4` deployed successfully through GitHub Pages run
  `31281106307`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `dd406546529c611fb4b392b977c9b2de2f7fc98e5df13fe61f0ad1f2daf82d13`
  - player JavaScript: `f0a1389ad2e13814266eb98e2d578be8e9288e350f0e5f3015a2307d57d5f214`
  - player CSS: `ad53086bcd18100798b4ff509f4f0b320f2a020acb0417c1cf1d44097299fd89`
- Public rendered inspection shows the exact dusk HUD cause, zero Provision
  field-note cards, and four environment lights at the opening beat. The
  checked-in and public JavaScript and CSS are byte-identical to the real local
  handoff used for the authored-Rive motion proof.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=9&route=glowroot&v=abc2ad4`

### Next highest-leverage weakness

The following Tool beat already contains a physical Hand Trowel dig and one
authored Rosie Notice, but its large receipt still covers the clearing. Compare
one in-scene Tool treatment against that card and remove only the redundant
reporting; do not add an encounter system, destination, reward table, or screen.

### v0.108 — Clover Harvest Stays Harvested — 2026-08-08

- Began by replaying the deployed first-day Clover route from Seed choice
  through Harvest, the complete Glowroot Adventure, Homecoming, and changed
  Home. Bed 1 was correctly empty after Harvest and throughout the Adventure,
  then silently refilled with fully flowered Clover the instant Glowroot took
  root.
- Compared three throwaway endings in the real Position 11 composition:
  resting soil, low cut stubble, and an immediate **Replant Clover** action.
  Resting soil won because it preserves the completed annual harvest, keeps
  Glowroot as the scene's single new event, and defers the next planting choice
  to the established morning crop flow.
- Captured all three treatments and the decision at commit `0792629` on
  `codex/homegrown-v108-clover-bed-prototypes`. Main contains only the selected
  state; no study switcher, stubble layer, or replant action ships.
- The React-to-Rive presentation bridge now derives Bed 1 as `empty` in the
  developed Home state. The same empty bed is visible after Harvest, while
  Rosie is away, at Homecoming, after Glowroot planting, after Moonberries take
  root, and the following morning.
- The scene description now distinguishes the Seed-paid resting first bed from
  rooted Moonberries. The checked-in Rive binary, View Model values, timer,
  inventory, crop rules, rewards, and persistence schema are unchanged.
- The Impeccable product pass favored one honest world state over extra copy or
  another action. The visual comparison rejected stubble because it resembled
  unexplained debris or regrowth, and rejected immediate replanting because it
  competed with the new Discovery.

### Local validation evidence

- Replayed the real browser loop through Clover planting, waiting, Tickle,
  Harvest, Farm stock, a Clover Lunch / Hand Trowel / Wicker Basket Bag, the
  complete Glowroot Adventure, Homecoming, Glowroot planting, Moonberry rooting,
  **Begin another day**, and the next-morning Tickle. Bed 1 stayed empty at
  every post-Harvest rendered checkpoint while Bed 2 and Bed 3 retained their
  distinct rooted states.
- `npm run prototype:homegrown:test` passes 81/81, including one continuity test
  across Harvest, Adventure, Homecoming, changed Home, and the next morning.
  `npm run prototype:homegrown:build`, `npm run verify:rive-homegrown`, `npm run
  quality:loop`, and `npm run quality:check` pass the authored Rive contracts,
  quality contracts, 157-file layout gate, 324-sprite integrity gate, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice and the verifier's already-required manual mobile
  Safari checks remain warnings.

### Public verification evidence

- Feature commit `2ff21ae` deployed successfully through GitHub Pages run
  `31280243652`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `179331bfc13be3204ac4b5500f686968b2abfea6119d8c8c54b70e2ddc88f40e`
  - player JavaScript: `da4f4cd7fb5ee3db0414bc0889621fbab62d7d22a773fd2b78854d2226be6256`
  - player CSS: `76686ea3bde5e33738c1b7238d5df156b7ca9ac10cdfe4196ca141396fbf8c72`
- Replayed the public changed-Home checkpoint with the authored Rive scene:
  Bed 1 is empty, the Moonberry bed and Glowroot remain distinct, and the next
  primary action still leads into the established second-day loop.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=11&route=glowroot&v=2ff21ae`

### Next highest-leverage weakness

Replay both complete Adventures with the now-honest Farm and identify the first
moment where the journey feels like a report instead of a cozy naturalist
outing. Prefer one environmental or Rosie response inside the existing causal
vignette over a new destination, encounter system, reward table, or parallel
screen.

### v0.107 — Moonberry Roots Remember — 2026-08-08

- Began by replaying the deployed Moonberry route from the second-morning crop
  choice through Harvest, Lanternleaf Homecoming, and another morning. Bed 2
  correctly emptied at Harvest but silently returned as a mature leafy crop as
  soon as Rosie packed. The stock total was honest; the Farm's visual cause was
  not.
- Compared three throwaway treatments on the existing Position 6 route:
  immediate visible rootstock, an empty bed that wakes overnight, and spending
  one harvested berry to replant. Immediate rootstock won because it answers at
  the payoff moment, preserves every earned berry, and adds no economy rule.
- Captured all three treatments and the decision at commit `9dc98bd` on
  `codex/homegrown-v107-regrowth-prototypes`. Main contains only the selected
  treatment; no `regrowth` query, switcher, or reserve-a-berry choice ships.
- A Moonberry Harvest now transitions Bed 2 from mature berries to young rooted
  leaves instead of empty soil. The result receipt says **Roots stay in Bed 2**
  once, then the physical bed carries that fact through Bag preparation,
  departure, Adventure, Homecoming, end of day, reload, and the next morning.
- The authored Rive **Moonberry Plant** timeline now supplies the honest young
  rootstock hold instead of reusing the fully leafy Growing pose for every
  non-empty state. The painterly scene layer masks the mature crop and reveals
  only its low leafy base while the reducer says `sprout`; Growing and Ready
  still return at their React-owned elapsed-time thresholds.
- React continues to own crop choice, the eight-hour timer, Compost, Harvest
  yield, stock, Bag consumption, persistence, and no-spoilage. The checked-in
  Rive binary and View Model contract are unchanged; only the existing
  presentation bridge gained a `ready → sprout` regrowth performance.
- The required Impeccable product review favored one brief receipt plus visible
  world state over another card or modal. The first production render was
  rejected because the underlying Rive layer still looked mature; the corrected
  scene uses an aligned empty-bed mask and cropped approved crop artwork so the
  settled rootstock reads clearly at phone scale.

### Local validation evidence

- Played the real second-morning Moonberry path through normal planting,
  waiting, Tickle, Harvest, Farm stock, a Moonberry/Lantern/Wicker Bag,
  Lanternleaf Homecoming, **Begin another day**, and reload. Harvest granted all
  four berries, the receipt named the retained roots, and no berry or other
  material was spent on regrowth.
- The rendered Bed 2 changed from mature berries to a small berry-free leafy
  rootstock. That same young bed remained visible at packed departure, the
  completed Home screen, and the following morning. Rive reported `ready` with
  `bedTwoState="sprout"` after reload.
- `npm run prototype:homegrown:test` passes 80/80, including full-loop
  rootstock continuity and rendered Rive/copy contracts. `npm run
  prototype:homegrown:build`, `npm run verify:rive-homegrown`, `npm run
  quality:loop`, and `npm run quality:check` pass the authored Rive contracts,
  quality contracts, 157-file layout gate, 324-sprite integrity gate, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice and the verifier's already-required manual mobile
  Safari checks remain warnings.

### Public verification evidence

- Feature commit `0b0c727` deployed successfully through GitHub Pages run
  `31279453560`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `b89377ffbbc184df39d3273e3cd590e5786fe57cdb6cccb10feb19c94b09decf`
  - player JavaScript: `1144acb880299ca84b6f38af37e23a3bdf99a11d15cbcd86736e4268654dac66`
  - player CSS: `76686ea3bde5e33738c1b7238d5df156b7ca9ac10cdfe4196ca141396fbf8c72`
- Replayed the public Moonberry crop through Harvest, saw **Roots stay in Bed
  2**, packed Moonberries/Lantern/Wicker Basket, verified the small rooted bed
  with the live Rive scene ready, completed Lanternleaf Homecoming, and began
  the following morning with the same rootstock visible.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=2&route=lanternleaf&v=0b0c727`

### Next highest-leverage weakness

Replay the Clover choice across a complete day. Bed 1 currently returns as a
fully flowered crop after its Harvest, making the Seed-spent annual crop look
as magically refillable as Moonberries used to. Prefer one honest resting-bed
or replanting consequence in the existing Seed, timer, and Home-memory model;
do not introduce another crop, building, or crafting rule.

### v0.106 — Two Crops, Two Ways Forward — 2026-08-08

- Began by replaying the shipped remembered morning. Position 2 promised
  **Choose a Seed**, but every reducer path rejected Moonberries, every growth
  timer and Harvest Rhythm was Clover-only, Farm stock had no Moonberry
  quantity, and Rosie's Provision pocket could not accept the crop visibly
  growing in Bed 2. The choice was decorative rather than authored.
- Exercised three throwaway logic models: two Adventure-ready crops, a required
  Clover crop plus a stockpile detour, and two beds planned in parallel. The
  equal Adventure-crop model won. The detour postponed Rosie's current purpose
  through another complete Farm cycle; the parallel plan made one timer and
  one Compost choice govern crops with unlike durations.
- Compared three rendered Position 2 treatments: equal crop cards, a weighted
  Clover recommendation, and equal cards plus a separate time scale. Equal
  cards won because duration, guaranteed yield, and Adventure use already make
  the tradeoff legible without recommendation pressure or another control.
- Captured the logic and visual studies at commit `829dbe9` on
  `codex/homegrown-v106-crop-choice-prototypes`. Main ships only the equal-card
  winner; no `cropchoice` query, prototype switcher, comparison model, or
  Moonberry crafting system ships.
- Clover remains the four-hour, three-Lunch first-day crop and consumes one
  Clover Seed. On earned mornings, Moonberries become a second complete choice:
  the already-rooted Bed 2 crop takes eight hours, yields four berries, and
  consumes no invented Seed. Both crops wait safely forever; Compost
  predictably removes two hours and adds one guaranteed item.
- Clover keeps `← → ↑`; Moonberries use their own `↓ ← → ↑` Harvest Rhythm.
  Every rhythm preserves the full guaranteed harvest and grants only one small
  clean-rhythm bonus. The result enters a persistent crop-specific Farm-stock
  compartment before Rosie's Bag opens.
- Moonberries are now a real one-use Provision alongside Clover Lunch. The Bag
  previews **Reveal reflected leaves**, spends exactly one berry, preserves the
  remaining stockpile, and changes both the causal vignette and Lanternleaf
  journey copy. The shared Provision question now asks **What should help Rosie
  keep going?** so it truthfully covers both duration and perception.
- Existing Rive state bindings animate the selected physical bed: Clover uses
  Bed 1 and Moonberries use Bed 2 through sprout, growing, ready, Harvest, and
  reduced-motion states. React still owns selection, timers, Compost, yield,
  stock, Bag validity, story causality, and persistence; the Rive binary and
  contract did not need a new progression fact.
- Used the built-in image-generation edit path on the existing approved Clover
  basket, replacing only its contents with Moonberries. The chroma-keyed result
  was locally matted, alpha-checked, resized to 640×640, and saved as
  `scripts/prototypes/homegrown-adventures/assets/homegrown-adventures/harvest-basket-moonberries.png`.

### Local validation evidence

- Played the actual second-morning Position 2 and chose Moonberries. The next
  rendered states showed **No Seed spent**, optional Compost, **5 Moonberries ·
  ready in 6 hours**, Bed 2 growing, the ready purple crop, and its four-beat
  rhythm.
- Completed the clean rhythm and observed **Moonberries +6**, with **4 harvest
  · +1 from Compost · +1 rhythm**, while Clover Seed, Compost, and Willow Fiber
  remained independently visible in Farm stock.
- Packed Moonberries, Lantern, and Wicker Basket from the real Bag UI. The
  Provision count changed from six to five, the packed ribbon named all three
  selections, the journey changed to **Rosie follows reflected leaves**, and
  Homecoming returned the named **Lanternleaf Path** plus exact materials.
- Replayed the Clover choice through planting, waiting, normal gathering, and
  Farm stock. It still produced three Clover Lunches, spent one Seed, preserved
  Compost, and reached the same existing Bag handoff.
- `npm run prototype:homegrown:test` passes 78/78, including first-day lock,
  second-day availability, no-spoilage settling, both timers, both Harvest
  Rhythms, stockpile preservation, Bag consumption, story causality, and Rive
  bed selection. `npm run prototype:homegrown:build`, `npm run
  verify:rive-homegrown`, `npm run quality:loop`, and `npm run quality:check`
  pass the authored Rive contracts, quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice and the verifier's
  already-required manual mobile Safari checks remain warnings.

### Public verification evidence

- Feature commits `d8cc84d` and `18d19ab` deployed through GitHub Pages run
  `31278489518`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `848d13c1bef95c82e2c501976e0c0b8c58aad12669f5550d08af03067252797a`
  - player JavaScript: `990a6e112c9b5d42b631b54d78fb27458f3a8897773ec14057632aa8acfe52f2`
  - player CSS: `770f74ddf89b0824d1063fa93d9b149d21ede3fcb76d95e30909ab0e6bbbf16c`
  - Moonberry basket: `644280d5e3ef3eb603ebf917b25c48ff424c472dcb289efdc78df473dc271905`
- Replayed the public crop choice through Moonberry growth, its personal
  Harvest Rhythm, Farm stock, Bag selection, the reflected-leaf journey, and
  Lanternleaf Homecoming. Replayed Clover through its separate stock result.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=2&route=lanternleaf&v=18d19ab`

### Next highest-leverage weakness

Replay the second complete Adventure into another morning. Determine whether
the rooted Moonberry bed visibly explains its post-harvest regrowth, or appears
to refill itself for free. Prefer one clear perennial/regrowth consequence in
the existing Bed 2, timer, and Home-memory model over a new Seed, crafting,
upgrade, or parallel farming system.

### v0.105 — Glowroot Opens the Next Route — 2026-08-08

- Began by replaying the shipped Changed Home through **Begin another day**,
  **Tickle Rosie**, the next purpose, and Seed choice. The open hedge, Glowroot
  bed, bell, and frog remained visible, and the new opportunity was correctly
  named **Lights Past the Open Gate**, but the UI jumped straight to Clover.
  Nothing said that yesterday's Glowroot Discovery created today's route, so
  the new purpose felt scheduled rather than caused.
- Compared three real Position 2 treatments: the cause in the existing purpose
  receipt, the cause in the primary Seed action, and the cause in the quiet
  HUD. The Seed action won because the player reads it at the exact decision
  point. The receipt was easier to overlook, while the HUD put the cause in
  small copy far from the tap.
- Captured all three throwaway treatments at commit `f1fa423` on
  `codex/homegrown-v105-discovery-purpose-prototypes`. Main keeps only the
  Seed-action treatment; no `purpose` query or comparison switcher ships.
- On remembered mornings, the existing Clover action now reads **Glowroot
  opened this route**, **Clover Seed**, and **Grow a Lunch for the lights
  beyond**. The existing receipt still explains that Clover becomes a
  Provision and preserves **Nightfall · reflected leaves · gentle wrap**.
- The required Impeccable product review substituted for unavailable Claude
  Design. It selected the Seed action because it expresses past cause, present
  choice, and future use without adding a panel or competing with Rosie and the
  living Farm.
- This is presentation derived from existing `daysCompleted`,
  `glowrootPlanted`, and Adventure-opportunity facts. No progression, Seed,
  stock, crop, reward, timer, persistence, animation, Rive asset, or Rive
  contract changed.

### Local validation evidence

- Played the real Changed Home state into a new morning and tickled Rosie. The
  next Seed action named Glowroot's causal role while the open hedge, frog,
  bell, Glowroot bed, and Moonberries stayed visible in the rendered Farm.
- Chose Clover from that action. The next screen retained **Prepare for the
  gate lights** and the exact three-Lunch promise.
- Reloaded after the choice and verified the gate-light purpose and Clover
  quantities persisted through the actual flow rather than a direct review
  preset.
- Repeated the flow with reduced motion active; the cause, Seed choice, and
  route purpose remained fully legible without depending on motion.
- `npm run prototype:homegrown:test` passes 75/75. `npm run
  prototype:homegrown:build`, `npm run verify:rive-homegrown`, `npm run
  quality:loop`, and `npm run quality:check` pass the authored Rive contracts,
  quality contracts, 157-file layout gate, 324-sprite integrity gate, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice and the verifier's already-required manual mobile
  Safari checks are the only outstanding warnings.

### Public verification evidence

- Feature commit `bb3b9ec` deployed successfully in GitHub Pages run
  `31277177336`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `1b59f087db27b81ac5ea6a1df87b1c16e15d7c8f6a657ec8ccde81e51a743921`
  - player JavaScript: `4e5587677d47ddcff611950952bf6c3743e9ef6e6b124ecd20b9380dc4011861`
  - player CSS: `14d96904ebdc2264c5587803367b978a6d6e555c3303cf3d8be6d988534b0e93`
- Replayed the public build from Changed Home through **Begin another day**
  and **Tickle Rosie**. The live primary action named **Glowroot opened this
  route** and **Grow a Lunch for the lights beyond** beside the open hedge and
  remembered Farm.
- Chose Clover, reached **Prepare for the gate lights**, reloaded the public
  page, and verified the second-route purpose and exact Lunch quantity stayed
  intact.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=2&route=lanternleaf&v=bb3b9ec`

### Next highest-leverage weakness

Replay the remembered Seed screen as a decision rather than a guided step.
Determine whether **Choose a Seed** still feels falsely authored when Clover is
the only actionable crop; prefer one meaningful alternative inside the
existing Seed, Farm-stock, purpose, and crop-duration rules over another
screen, currency, destination, or parallel system.

### v0.104 — The Farm Names What Changed — 2026-08-08

- Began by replaying the shipped answered clue through the complete Discovery,
  planting, Changed Home, and next morning. The rendered Farm visibly retained
  the Glowroot bed, open hedge, earned bell, and pond frog, but the stable Home
  memory called all of that **The Farm remembers** and showed only material
  glyph counts. Its expanded copy claimed that Discoveries stayed without
  naming a single lasting Discovery consequence.
- Compared three real Position 11 treatments: a named world-memory bar, a Field
  Guide completion bar, and a split changes-and-stock drawer. The named world
  memory won because it makes the permanent world consequence visible without
  a tap, reuses one existing surface, and avoids both checklist language and a
  denser second panel.
- Captured all three throwaway treatments at commit `d255aff` on
  `codex/homegrown-v104-home-memory-prototypes`. Main keeps only the named
  world-memory treatment; no `homememory` query or comparison switcher ships.
- The existing collapsed pocket now says **Glowroot changed Home** and names
  **Bed 3 · Open hedge · Pond frog**. Opening that same pocket shows **Farm
  stock stays useful** and the exact Clover Seed, Glowroot Seed, Compost, and
  Willow Fiber quantities.
- The required Impeccable product review substituted for unavailable Claude
  Design. It selected the named world memory because it gives the completed
  Adventure one readable consequence while preserving Rosie, the living Farm,
  and the next action as the composition's primary elements.
- This is a presentation-only acknowledgement of existing reducer facts. No
  Discovery, reward, inventory, crop, timer, persistence, animation, Rive
  asset, or Rive contract changed.

### Local validation evidence

- Played the complete Glowroot return into planting and the stable Changed Home
  state. The collapsed memory named all three lasting changes without clipping
  or covering Rosie, the frog, the open hedge, or the growing beds.
- Opened the same pocket and verified that the exact existing Farm stock stayed
  readable in one drawer rather than being confused with world Discoveries.
- Reloaded Position 11 with reduced motion active. The named Home changes and
  stock drawer contract persisted without depending on animation.
- Began another day and verified the Glowroot bed, open hedge, earned bell, and
  pond frog remained visible behind the next **Tickle Rosie** action.
- `npm run prototype:homegrown:test` passes 75/75. `npm run
  verify:rive-homegrown`, `npm run quality:loop`, and `npm run quality:check`
  pass the authored Rive contracts, quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice and the verifier's
  already-required manual mobile Safari checks are the only outstanding
  warnings.

### Public verification evidence

- Feature commit `d4818f1` deployed successfully in GitHub Pages run
  `31276593916`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `0d20b1dd79bc5be77500f7a79dc4b97bdcfc6e438d3b10c334045a6bb892aa8e`
  - player JavaScript: `4c6b4fa8b300def966254573a361f80798b3b4fe5f766f7d3bd457633c330bac`
  - player CSS: `9f5fe253239f304b89df294b27ff57640cd62171435f40dd278d29c90512c27d`
- Replayed a clean public Position 11. The collapsed pocket named **Glowroot
  changed Home** and **Bed 3 · Open hedge · Pond frog**; its accessible drawer
  preserved the four exact stock quantities.
- Reloaded that public state, then chose **Begin another day**. The next morning
  returned to **Tickle Rosie** with the open hedge, earned bell, Glowroot bed,
  and pond frog still rendered in the living Farm.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=11&v=d4818f1`

### Next highest-leverage weakness

Replay the remembered next morning from **Tickle Rosie** into the new purpose
and Seed choice. Determine whether a lasting Discovery feels like part of
Rosie's next curiosity and preparation, or merely like background decoration;
prefer one causal response in the existing purpose or Farm-stock surface over
a new map, journal, quest log, crop, destination, or currency.

### v0.103 — The Bag Remembers the Clue — 2026-08-08

- Began by replaying the shipped Near-Discovery action through re-packing and a
  second complete Adventure. The loop worked mechanically, but the Field Guide
  disappeared as soon as Position 7 opened. The Bag looked identical to a
  first attempt, and selecting the missing capability gave no sign that the
  player had applied Rosie's lesson.
- Compared three real Position 7 treatments: a Field Guide folio inside the
  picker, a matching-item badge, and a marked Bag pocket. The marked pocket
  won. The folio added another bordered panel to an already complete decision;
  the item badge prescribed an answer instead of letting the player interpret
  the earned capability.
- Captured all three throwaway treatments at commit `3d043e6` on
  `codex/homegrown-v103-bag-clue-prototypes`. Main keeps only the marked-pocket
  treatment; no `bagclue` query or comparison switcher ships.
- The existing Bag header now repeats the route- and capability-specific Field
  Guide lesson. The relevant Provision, Tool, or Pack tab says **Clue** while
  empty, then **Answered** after the player packs any valid item in that
  capability slot. The header names the chosen item and route clue.
- First-time packing remains exactly as before: all three slots begin empty,
  every choice remains optional, and no clue marker appears until Rosie has
  actually brought one Home.
- The required Impeccable product review substituted for unavailable Claude
  Design. It selected the marked pocket because it reuses the current
  hierarchy, keeps the illustration readable, and makes learned causality
  visible without adding a quest or recommendation surface.
- React owns the clue presentation and selection confirmation. No success
  rule, route, Bag choice, reward, material cost, timestamp, save field,
  animation, Rive asset, or Rive contract changed.

### Local validation evidence

- Played a first-route Adventure without a Tool, brought **Glowroot Trail**
  Home, and opened the Tool pocket. The Tool tab was selected, the header kept
  the sleeping-root lesson visible, and the tab said **Clue**.
- Packed Lantern as the freely chosen Tool. The existing Rive Bag-receive beat
  played, the tab changed to **Answered**, the choice survived reload, and the
  repeated Adventure returned a complete Glowroot Discovery with its existing
  Lantern bonus.
- Played **Lights Past the Open Gate** without a Pack. The Lanternleaf lesson
  returned to the Pack pocket, then Cloth Wrap changed the same marker to
  **Answered** with route-correct copy.
- Verified a first-time Position 7 separately; it retained the original empty
  Bag title and contained no unearned clue marker.
- Reloaded the answered Tool state with reduced motion enabled. The exact
  header, selected item, and Answered marker persisted.
- `npm run prototype:homegrown:test` passes 75/75. `npm run
  prototype:homegrown:build`, `npm run verify:rive-homegrown`, `npm run
  quality:loop`, and `npm run quality:check` pass the authored Rive contracts,
  quality contracts, 157-file layout gate, 324-sprite integrity gate, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice is the only warning.

### Public verification evidence

- Feature commit `69c3483` deployed successfully in GitHub Pages run
  `31275852677`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `3adc39d659a4174980c87a69ff5fa8a8670ef00df71b040bf80e9d259cb93310`
  - player JavaScript: `0c4b6a72c6f8564f936a3d2ddb28c95a19fbe35b87a2a6eb46a900b517a118fe`
  - player CSS: `b7eebe2a6bedae24daebb57413b93d9bbf10b8ce7de2d3bdccce7b7ae15741a3`
- Ran a fresh public Adventure without a Provision. After the truthful journey
  and Field Guide Homecoming, **Open the Provision pocket** returned to the
  selected Provision tab with the dusk lesson and **Clue** marker intact.
- Packed Clover Lunch. The live public tab changed to **Answered** and said
  **Clover Lunch answers the Glowroot Trail clue**. Repeated the same Adventure
  through fast-forward and Homecoming; it returned the established Glowroot
  Seed +2, Compost +1, and Willow Fiber +2 Discovery.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=7&v=69c3483`

### Next highest-leverage weakness

Replay the answered clue through the complete Discovery ceremony, planting,
and Changed Home. Find the first moment where the Field Guide lesson fails to
feel resolved into a lasting world change; prefer one acknowledgement in an
existing Homecoming or Home-memory surface over a new journal, quest, or
completion screen.

### v0.102 — The Clue Comes Home — 2026-08-08

- Began by replaying the shipped prepared and incomplete journeys through the
  complete Homecoming. The prepared route had an intentional Discovery
  ceremony, but the incomplete route looked like a validation error: its Field
  Guide clue was listed under **Added to Farm stock**, and **Adjust Rosie's
  Bag** reopened the Provision question even when Tool or Pack was missing.
- Compared three real Position 10 treatments: an enlarged Field Guide plaque,
  a pinned note from Rosie, and a return receipt. The Field Guide plaque won.
  The pinned note covered the physical return objects, while the receipt turned
  the emotional Homecoming into bookkeeping.
- Captured all three throwaway treatments at commit `5b83fe3` on
  `codex/homegrown-v102-homecoming-clue-prototypes`. Main keeps only the Field
  Guide treatment; no `nearhome` query or comparison switcher ships.
- Each route and missing slot now records a specific story and names the exact
  capability to try next. The action says **Open the Provision pocket**,
  **Open the Tool pocket**, or **Open the Pack pocket**, then returns to
  Position 7 with that tab selected.
- The return ledger now says **Supplies brought Home** and contains only real
  stock: Compost and Willow Fiber. The clue remains in the Field Guide instead
  of masquerading as a Farm material.
- Complete Discoveries retain their established named Seed, quantities,
  preparation bonuses, and **Take Seed to Bed 3** action. No route, reward,
  Bag rule, inventory quantity, timestamp, save field, animation, Rive asset,
  or Rive contract changed.
- The required Impeccable product review substituted for unavailable Claude
  Design. It selected the plaque because it creates one calm hierarchy with
  the fewest new surfaces and preserves the worktable composition.

### Local validation evidence

- Played the first route with Provision, Tool, and Pack missing in turn. Each
  Homecoming rendered distinct Field Guide copy, the correct next capability,
  only its real supplies, and an action that opened the matching Bag tab.
- Played the Lanternleaf route without a Tool. Its reflected-leaf clue and
  Tool-specific follow-up remained route-correct.
- Reloaded a reduced-motion Near-Discovery. Its exact Field Guide result,
  supplies, and Bag action persisted.
- Played a fully prepared journey through departure, the six-hour
  fast-forward, gate welcome, and Homecoming. It still returned Glowroot Seed
  +2, Compost +1, Willow Fiber +2, and **Take Seed to Bed 3**.
- `npm run prototype:homegrown:test` passes 74/74. `npm run
  prototype:homegrown:build`, `npm run verify:rive-homegrown`, `npm run
  quality:loop`, and `npm run quality:check` pass the authored Rive contracts,
  quality contracts, 157-file layout gate, 324-sprite integrity gate, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice is the only warning.

### Public verification evidence

- Feature commit `63afc83` deployed successfully in GitHub Pages run
  `31274859128`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `802fe7b295b2b863707febfcda0157a16695d9e704ba99d2fd74ed7dfeca5e8a`
  - player JavaScript: `1e235a1177375e4b23dfb448e4beaad893f2068e74145b42e569ac4ed5f5c068`
  - player CSS: `ef9ba36a6a65cf8f1a134bc1df6962e846aacaa43c2ae1cc1c38c844cc6fd1a9`
- Opened a persisted public incomplete Homecoming. It rendered **Field Guide
  updated**, **Glowroot Trail**, the missing-Provision explanation, Compost
  +1, Willow Fiber +1, and no unearned Glowroot Seed. **Open the Provision
  pocket** returned to Position 7 with Provision selected.
- Opened the public prepared Homecoming separately. It retained **New
  Discovery**, Glowroot Seed +2, Compost +1, Willow Fiber +2, and **Take Seed
  to Bed 3**.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=7&v=63afc83`

### Next highest-leverage weakness

Replay the shipped Near-Discovery action through re-packing and the repeated
Adventure. Find the first moment where the remembered clue fails to help the
player close the loop into a complete Discovery; prefer one confirmation in
the existing Bag or journey surface over a new quest, tutorial, or reward
system.

### v0.101 — The Journey Tells the Truth — 2026-08-08

- Began by replaying the exact public Position 8 → 9 handoff with the canonical
  prepared Bag, an alternative prepared Bag, and an entirely empty Bag. Both
  empty and prepared routes eventually displayed **Her Bag keeps the golden
  trail within reach**, even though the empty Bag had just shown that daylight
  ended the outing. Preparation stopped mattering during the longest Adventure
  beat.
- Compared three real Position 9 structures: rewriting the existing field
  note, attaching a separate Bag-clue slip, and rewriting both the note and the
  existing three-step route. The route treatment won. The note-only treatment
  left the progress rail claiming a successful trail; the clue slip added a
  fourth dense information surface beside time, packed items, and progress.
- Captured all three throwaway treatments at commit `2995aae` on
  `codex/homegrown-v101-journey-truth-prototypes`. Main keeps only the route
  treatment; no `journeytruth` query or comparison switcher ships.
- The first route now names **Marked the glow**, **Root clue**, or
  **Leaf-print** when Provision, Tool, or Pack is missing. The Lanternleaf route
  names **Marked reflections**, **Path clue**, or **Trail map**. Each is paired
  with one route- and capability-specific field note that explains what Rosie
  safely did and why she is returning with useful knowledge.
- A prepared Bag retains **Warm moth trail** or **Reflected leaves** and its
  established success copy. During the homeward phase, an incomplete Bag says
  that Rosie is bringing a useful clue Home rather than silently becoming a
  complete Discovery.
- React derives every presentation fact from the existing `underprepared` and
  `nearDiscoveryReason` reducer facts. No Bag rule, item, route, reward,
  timestamp, save field, animation, Rive asset, or Rive contract changed.
- The required Impeccable product review substituted for unavailable Claude
  Design. It selected the route treatment because it strengthens hierarchy and
  causal legibility while reusing the calm composition instead of adding UI.

### Local validation evidence

- Rendered all three treatments at the 390×844 reference frame. The winning
  treatment preserves the field note, Expected Home ticket, Packed stamp, and
  three-step route without introducing another panel.
- Played the first route with Provision, Tool, and Pack missing in turn. The
  real journey rendered **Marked the glow**, **Root clue**, and **Leaf-print**
  with the matching explanation for each capability.
- Played the Lanternleaf route without a Provision. It rendered **Rosie marks
  the first reflections** and **Marked reflections**, with no claim that the
  complete night route had been earned.
- Played a prepared first route. It retained **Rosie follows warm moths** and
  **Warm moth trail**. Rendered the prepared homeward phase separately; the HUD,
  note, route, and review rail all turned Home together.
- Enabled reduced motion on the incomplete Lanternleaf route and reloaded the
  page. The exact Near-Discovery headline and branched route persisted, and the
  authored scene remained in its reduced pose.
- `npm run prototype:homegrown:test` passes 72/72. `npm run
  prototype:homegrown:build`, `npm run verify:rive-homegrown`, `npm run
  quality:loop`, and `npm run quality:check` pass the authored Rive contracts,
  quality contracts, 157-file layout gate, 324-sprite integrity gate, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice is the only warning.

### Public verification evidence

- Feature commit `6e7efd4` deployed successfully in GitHub Pages run
  `31273960859`.
- The deployed player bytes match the checked-in artifacts exactly:
  - player HTML: `abc9d5de43059b9ed9fbd45c2c776098c7f3eb75ae4c548b816384e75ff9b2a7`
  - player JavaScript: `89cd5cf8f6452135383b735aae924601b4cfd394683e3399779ed27dc9e05f48`
  - player CSS: `6fb009c0638f751729959db88e85cc4ccf8bdfd68c56b0bef289ae5dd0bb24de`
- Opened a fresh public Position 7 and sent Rosie with Provision, Tool, and
  Pack all empty. After the three causal beats, the live idle journey rendered
  **Rosie follows as far as daylight allows**, explicitly named the missing
  Provision, and changed the route to **Marked the glow**. It did not claim
  that the empty Bag kept the complete golden trail within reach.
- Fast-forwarded that exact public journey. The same branched route reached
  **At Home**, then Homecoming revealed **Glowroot Trail**, Compost +1,
  Leaf-print clue, and Willow Fiber +1 with no unearned Glowroot Seed.
- The companion checkpoint link now reads **Pack a Bag, then follow what
  changes** and opens the freely chosen Position 7 preparation.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=7&v=6e7efd4`

### Next highest-leverage weakness

Replay the shipped incomplete and prepared journeys through the gate and full
Homecoming. Choose the next checkpoint from the first moment where the named
Discovery or useful Near-Discovery fails to feel equally intentional; do not
add another destination, item tier, or reward system by default.

### v0.100 — The Bag Belongs to the Player — 2026-08-08

- Began by replaying the exact public Harvest → Farm Stock → Bag handoff. Farm
  Stock explained the harvest clearly, but Position 7 arrived pre-filled with
  Clover Lunch, Hand Trowel, and Wicker Basket. **Pack these** allowed the
  player to skip the preparation decision entirely, while Lantern and Cloth
  Wrap remained hidden behind repeated **Change** actions.
- Compared three real Position 7 structures: all options visible at once, one
  guided question at a time, and literal pockets around the open Bag. The
  guided question won. The first rebuilt the dense choice wall; the third made
  the pockets compete spatially with Rosie and the Bag art.
- Captured all three throwaway treatments at commit `dc14425` on
  `codex/homegrown-v100-first-bag-choice-prototypes`. Main keeps only the
  guided structure; no `bagchoice` query or comparison switcher ships.
- The Bag now begins with Provision, Tool, and Pack empty. Each slot tab keeps
  its current summary visible while the active question shows every owned
  alternative and **Leave empty** directly. The tabs support arrow, Home, and
  End keyboard navigation with one roving tab stop.
- The primary action now says **Set out with an empty Bag**, **Pack 1 choice**,
  **Pack 2 choices**, or **Pack 3 choices**. The empty state explicitly
  promises a useful clue and Rosie's safety instead of implying failure.
- Save version 2 clears only an untouched version-one prescribed first Bag.
  Progressed departures and later review positions preserve their chosen
  loadout and exact spent resources.
- Corrected the Position 7 image description from the false **Clover Lunch is
  in Rosie's Bag** to **Rosie's Bag is ready to pack**; Position 6 now truthfully
  says the harvest joined Farm stock.
- React still owns choices, inventory, costs, validation, persistence,
  deterministic Discovery and Near-Discovery branches, and accessible DOM.
  The existing authored Rive `Bag Receive` motion remains the only selection
  performance. No route, item, reward quantity, timer, currency, crop rule,
  Rive asset, or Rive contract changed.
- The required Impeccable product review substituted for unavailable Claude
  Design. It selected the guided structure for a single clear task, visible
  alternatives, truthful empty state, and preserved character/world art.

### Local validation evidence

- Rendered Position 7 at the 390×844 reference frame and centered desktop.
  Rosie, the open Bag, all three empty slot summaries, the active question,
  direct choices, and the empty departure action remain visible without a
  comparison switcher.
- Played a complete alternative Bag: Clover Lunch, Lantern, and Wicker Basket.
  Each choice updated its summary and physical token; Position 8 retained the
  exact loadout and spent one Clover Lunch after reload.
- Played an entirely empty Bag through departure, causal vignette, six-hour
  prototype fast-forward, and Homecoming. Rosie returned safely with the
  **Glowroot Trail** clue, Compost +1, and Willow Fiber +1 rather than an
  unearned Seed.
- Enabled reduced motion from the rendered lab, selected an item, and confirmed
  the same readable state with the Rive scene reporting its reduced pose.
  ArrowRight moved focus and selection from Provision to Tool in the real
  tablist.
- `npm run prototype:homegrown:test` passes 71/71. `npm run
  prototype:homegrown:build` and `npm run verify:rive-homegrown` pass both
  authored Rive contracts. `npm run quality:loop` and `npm run quality:check`
  pass the quality contracts, 157-file layout gate, 324-sprite integrity gate,
  security contracts, TypeScript, 78 layout tests, and 202 security tests.
  Watchman's existing recrawl notice is the only warning.

### Public verification evidence

- Feature commit `59bfa1c` deployed successfully in GitHub Pages run
  `31273046909`.
- The deployed player, animation lab, and companion bytes match the checked-in
  artifacts exactly:
  - player HTML: `5385b567566f380d9bc2a729e4563e7fc81fc17868cb89eb15dc18200aa77c3f`
  - player JavaScript: `b10c17917e4dca9a1244c702407edc114e792c64dbe63cc2dbdf4ca43451f927`
  - player CSS: `7dcbd9de8b0fdae54028f44daff637f0d4d593ef280fa2f9d91bef7fb88a008d`
  - animation-lab HTML: `731f997e7803134ced7de42198593f2601ac680de024850dada1c2a88b4c7fde`
  - animation-lab JavaScript: `e6f5a0277397b22f280040fcb3a318f6527914f80e93cd22e6a2435943280ea1`
  - companion HTML: `f21f6dbfbbe76b3a38aa87d87b905b713374aad1c41899c0129dc86d801983a1`
- Replayed the public Position 7. It began with all three slots empty, exposed
  Clover Lunch and **Leave empty** directly, and described the scene as
  **Rosie's Bag is ready to pack** instead of claiming the Lunch was already
  inside.
- Packed Clover Lunch, Lantern, and Wicker Basket on the public build. Position
  8 named all three exact choices, spent one Lunch, and retained the same
  loadout after a live reload.
- Opened a fresh public Position 7 and sent Rosie with every slot empty. The
  live departure, causal vignette, prototype fast-forward, and Homecoming
  returned **Glowroot Trail**, Compost +1, a leaf-print clue, and Willow Fiber
  +1, with no unearned Seed and no blocked departure.
- The companion checkpoint link now reads **Choose Rosie's first Bag** and
  opens Position 7.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=7&v=59bfa1c`

### Next highest-leverage weakness

Replay the shipped Position 8 → 9 handoff with the newly player-authored empty
and alternative Bags. Choose the next checkpoint from the first player-visible
moment where Rosie's exact preparation stops being legible; do not add another
destination, item tier, or progression system by default.

### v0.99 — Swipe the Clover — 2026-08-08

- Began by playing the exact public Position 5 return to a ready Clover bed.
  The HUD repeated **Clover's rhythm: left, right, up** as both objective and
  detail, while the scene simultaneously offered a swipe zone, a large
  **Tap Left** button, and **Gather normally**. The crop was visible, but the
  player had three competing answers to the same immediate question.
- Compared three real Position 5 structures: one bed-anchored harvest ribbon,
  a callout laid over the bed, and a detached swipe dock. The single ribbon
  won. The callout covered the crop; the dock separated the gesture from the
  thing being harvested; both retained an unnecessary separate tap action.
- Captured all three throwaway treatments at commit `1487aca` on
  `codex/homegrown-v099-harvest-focus-prototypes`. Main keeps only the single
  ribbon; no `rhythm` query or comparison switcher ships.
- The flowered bed remains the direct swipe target. The active left, right, or
  up arrow inside the ribbon is now the keyboard and tap fallback, with an
  exact accessible name such as **Tap Left instead**. Completed and future
  arrows remain noninteractive.
- The HUD preserves **Harvest for Rosie's journey** and uses **Clover's rhythm:
  left, right, up** as supporting detail. The guarantee now says **3 Lunches
  guaranteed** normally or **4 Lunches guaranteed** with Compost, followed by
  the established **clean rhythm +1** promise.
- **Gather normally** remains the only separate alternate path. It grants the
  complete base and Compost harvest without a rhythm bonus, so the skill
  gesture stays optional and never becomes a harvesting gate.
- No crop rule, yield, Compost behavior, rhythm sequence, reward, Farm-stock
  transition, persistence field, animation, Rive asset, or Rive input changed.
- The required Impeccable review substituted for unavailable Claude Design.
  It selected the single-ribbon treatment for direct manipulation, one clear
  hierarchy, consistent control vocabulary, and preservation of the crop art.

### Local validation evidence

- Rendered the selected Position 5 state at 390x844 with the Adventure purpose,
  active arrow fallback, exact guaranteed yield, and normal-gather path all
  visible without covering the ready crop or exposing a prototype switcher.
- Played the active fallback through left, right, and up. Each accessible name
  advanced exactly once and the completed rhythm entered Position 6 with the
  clean-rhythm bonus.
- Played an unboosted crop through **Gather normally**. It returned **Clover
  Lunch +3** with no rhythm bonus, proving that the guaranteed path remains
  complete and independent.
- After one rhythm beat, reduced motion and reload preserved **Tap Right
  instead**, the Adventure purpose, and the exact guarantee. Pointer swipe,
  keyboard/tap fallback, and normal gathering all retain their existing reducer
  paths.
- `npm run prototype:homegrown:test` passes 69/69. `npm run
  prototype:homegrown:build`, `npx tsc --noEmit`, and `npm run
  verify:rive-homegrown` pass both authored Rive contracts.
- `npm run quality:loop` and `npm run quality:check` pass the quality
  contracts, 157-file layout gate, 324-sprite integrity gate, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice is the only warning.

### Public verification evidence

- Feature commit `95994e2` deployed successfully in GitHub Pages run
  `31271876488`.
- The deployed player and companion bytes match the checked-in artifacts
  exactly:
  - HTML: `a66d5e4d40949174e2c9b3b061a368ca463ac2e98192fd811dc505d98720d19e`
  - JavaScript: `ad2fa06674c723940d2a894bc89ba09a952fa40885af54e690ceaf8c6e088f28`
  - CSS: `b322c37a33d9d6c955c44dcba48885b126f461659146bf5d390fb2cade41a0c4`
  - companion HTML: `a55b889232b951c3109099441cb6831b271419ac4d645bbcb5e12d6cf0ced22c`
- Replayed the public rendered Position 5. It retained **Harvest for Rosie's
  journey**, the supporting left-right-up rhythm, **4 Lunches guaranteed**, one
  active **Tap Left instead** fallback, and **Gather normally**, with no old
  separate Tap action or prototype comparison control.
- Played the public active arrows through left, right, and up. The action
  advanced exactly once per beat and entered Position 6 with **Clover Lunch
  +5**: three base, one Compost, and one clean-rhythm bonus.
- Opened a fresh public Position 5 and chose **Gather normally**. It entered
  Position 6 with **Clover Lunch +4**: three base and one Compost, with no
  rhythm bonus and no lost yield.
- The companion checkpoint link now reads **Try Clover's Harvest Rhythm** and
  opens Position 5.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=5&v=95994e2`

### v0.98 — A Lunch, Not a Number — 2026-08-08

- Began by playing the exact public Seed-to-planting handoff on the remembered
  Adventure route. Position 3 preserved **Prepare for the gate lights**, but
  its farming outcome became **Harvest 3** or **Harvest 4**. The only visible
  mention of **Clover Lunch** was the scene's nonvisual description, so the
  player could not see what the number represented or connect it to Rosie's
  Provision.
- Compared three real Position 3 structures: one named outcome promise, a
  physical Clover Lunch shelf, and a persistent before/after comparison. The
  named promise won. The comparison was clearest mathematically but read like
  a stat screen; the shelf made the item tangible but did not explain the
  optional benefit until after Compost was selected.
- Captured all three throwaway treatments plus the selected Compost state at
  commit `640a844` on
  `codex/homegrown-v098-compost-promise-prototypes`. Main keeps only the named
  promise; no `compost` query or comparison switcher ships.
- Without Compost, the screen now promises **3 Clover Lunches · ready in 4
  hours** and previews **1 more Lunch, 2 hours sooner**. With Compost selected,
  it promises **4 Clover Lunches · ready in 2 hours** and explains that Compost
  saves two hours and adds one Lunch.
- The quiet HUD now says **Clover Lunch ×3 · ready in 4h** or **Clover Lunch ×4
  · ready in 2h**, replacing its separate Harvest vocabulary. Both visible
  surfaces derive yield from the established crop rules.
- No Seed cost, Compost cost, duration, yield, Harvest Rhythm, stock,
  persistence, route, state transition, animation, Rive asset, or Rive input
  changed.
- The required Impeccable review substituted for unavailable Claude Design.
  It selected the named promise for plain language, low density, proximity to
  the decision, and consistent Adventure vocabulary.

### Local validation evidence

- Rendered normal and Compost-selected Position 3 states at 390×844. Both name
  Clover Lunch, give the exact count and time, keep Rosie visible, preserve one
  obvious planting action, and expose no prototype comparison control.
- Played from the remembered-Farm Seed choice into planting. **Prepare for the
  gate lights**, the named Clover Lunch outcome, and the matching HUD promise
  remained together.
- The existing live status announces the full changed promise when Compost is
  toggled. Reduced motion and reload retain the same truth.
- `npm run prototype:homegrown:test` passes 68/68, including normal and boosted
  HUD promises and a guard against the retired Harvest wording.
  `npm run prototype:homegrown:build`, `npx tsc --noEmit`, and
  `npm run verify:rive-homegrown` pass both authored Rive contracts.
- `npm run quality:loop` and `npm run quality:check` pass the quality
  contracts, 157-file layout gate, 324-sprite integrity gate, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice is the only warning.

### Public verification evidence

- Feature commit `85c3d79` deployed successfully in GitHub Pages run
  `31271262756`.
- The deployed player bytes match the checked-in artifacts exactly:
  - HTML: `2491a8819260da4d52d552243793128d507490a1a544964f25e9154caa3c7021`
  - JavaScript: `c294d8703c00a33f4b186311e57510c5665d8e42f65ef716f6a6d7cb998e657f`
  - CSS: `9a9ce063824a329f25735a7613f3481834b0deb204b9b786bbacb874dbc06649`
- Replayed the public normal and Compost-selected Position 3 states. The
  normal state promised **3 Clover Lunches · ready in 4 hours** and previewed
  the exact boost; selecting Compost changed the live promise and HUD to four
  Lunches in two hours with no prototype switcher.
- Played the public remembered-Farm route from Seed choice into planting. It
  retained **Prepare for the gate lights** beside the same named Provision
  promise.
- The deployed companion-site bytes match checked-in `docs/index.html`, and
  its checkpoint link now reads **See what Compost grows for Rosie**.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=3&v=85c3d79`

### v0.97 — Grow for Rosie — 2026-08-08

- Began by playing the exact public morning handoff. After **Tickle Rosie**
  revealed **A Glow Beneath the Hedge**, the Farm Stock drawer took over and
  retained only a generic dusk sentence. The player could no longer answer
  what Rosie noticed: **soft soil** and a need to **carry it Home** had
  disappeared at the moment they chose a Seed.
- Compared three real Position 2 structures: a complete invitation ticket
  above Farm Stock, three spatial clues over the illustrated world, and one
  purpose receipt attached to the drawer. The attached receipt won. The ticket
  repeated the HUD and covered more of Rosie; the spatial clues looked like
  unrelated tooltips and made the quiet Farm busier.
- Captured the three throwaway treatments at commit `07028a7` on
  `codex/homegrown-v097-adventure-invitation-prototypes`. Main keeps only the
  selected receipt; no `invitation` query or comparison switcher ships.
- The receipt says **Grow for Rosie · Clover becomes a Provision**, followed
  by the current opportunity's exact clue phrase. The existing HUD continues
  to own the Adventure name and immediate instruction, so the new element does
  not repeat a title or create another primary action.
- The first route renders **Until dusk · soft soil · carry it Home**. The
  remembered-Farm route renders **Nightfall · reflected leaves · gentle
  wrap**. Both derive from `adventureOpportunity(state)` rather than static
  first-day copy, and the accessible note names the current Adventure.
- Direct Position 2 review now accepts the established `route=lanternleaf`
  route so the second morning is reproducible and reload-stable without
  changing live progression.
- No crop, Compost, inventory, Bag, reward, timer, persistence, transition,
  animation, Rive asset, or Rive input changed.
- The required Impeccable review substituted for unavailable Claude Design.
  It selected the attached receipt for proximity, calm hierarchy, clear cause
  and effect, and preservation of the illustrated world.

### Local validation evidence

- Played the local loop from **Tickle Rosie** into Seed choice. The resulting
  screen retained the named opportunity, growth purpose, all three clues, and
  one obvious **Choose Clover** action.
- Rendered the first and remembered-Farm Position 2 states at 390×844. Both
  keep Rosie visible, fit above the external review rail, and ship no prototype
  comparison control.
- Reduced motion retained the same second-route clue receipt, and reload
  preserved both the route and reduced-motion presentation.
- The receipt is a semantic `role="note"` whose accessible name includes the
  current Adventure, the Provision purpose, and all three route clues.
- `npm run prototype:homegrown:test` passes 68/68, including first- and
  second-route derivation and a guard against shipping the comparison harness.
  `npm run prototype:homegrown:build`, `npx tsc --noEmit`, and
  `npm run verify:rive-homegrown` pass both authored Rive contracts.
- `npm run quality:loop` and `npm run quality:check` pass the quality
  contracts, 157-file layout gate, 324-sprite integrity gate, security
  contracts, TypeScript, 78 layout tests, and 202 security tests. Watchman's
  existing recrawl notice is the only warning.

### Public verification evidence

- Feature commit `58ce989` deployed successfully in GitHub Pages run
  `31270754169`.
- The deployed player bytes match the checked-in artifacts exactly:
  - HTML: `b078edeaf5f544e3a27c03117defc6e7413096095c6c9d6b058792be32b8dc80`
  - JavaScript: `1fb2eb20b3d0d8e8d1deb0c7da1e2515a8e843f20a478cc111b9626af7cb7946`
  - CSS: `9a9ce063824a329f25735a7613f3481834b0deb204b9b786bbacb874dbc06649`
- Replayed the public 390×844 route from Position 1. **Tickle Rosie** advanced
  into Seed choice with **A Glow Beneath the Hedge**, **Clover becomes a
  Provision**, and **Until dusk · soft soil · carry it Home** all present.
- The public remembered-Farm route rendered **Lights Past the Open Gate** with
  **Nightfall · reflected leaves · gentle wrap** and the established growing
  beds. Neither route exposed the discarded comparison switcher.
- The deployed companion-site bytes match the checked-in `docs/index.html`,
  and its checkpoint link now reads **See why Rosie is growing Clover**.
- Exact public checkpoint:
  `https://bbroeking.github.io/oink/homegrown-adventures.html?variant=A&position=2&v=58ce989`

### v0.96 — Tomorrow Means Tomorrow — 2026-08-08

- Began by replaying the exact public v0.95 journey. Its ticket said only
  **Around 2:46 PM**; a six-hour Adventure starting late in the day could show
  an early-morning clock without telling the player that Rosie returns
  tomorrow.
- Compared three overnight treatments on the real Position 9 Farm: **Tomorrow
  · 2:30 AM** inside the existing ticket, a split calendar ticket, and
  **Tomorrow** repeated in the field-note eyebrow. The existing-ticket
  treatment won. The calendar version looked interactive, while the eyebrow
  turned timing into a second story fact.
- Captured all three throwaway treatments at commit `b2f54ac` on
  `codex/homegrown-v096-return-day-prototypes`. Main keeps only the local-
  calendar wording; no `returnday` query or comparison switcher ships.
- Same-day journeys retain **Around [time]**. The next local calendar day uses
  **Tomorrow · [time]**. A farther future return uses a short weekday, while
  the accessible label speaks its full name.
- A pure formatter receives the persisted `adventureReadyAt` timestamp and
  React's existing visual time. It compares local calendar dates using
  normalized date parts, so daylight-saving transitions do not become 23- or
  25-hour day mistakes.
- Expired or invalid timestamps render no promise while the reducer settles.
  No route, duration, timer, reward, state transition, save field, animation,
  Rive asset, or Rive input changed.
- The required Impeccable review substituted for unavailable Claude Design. It
  selected the first treatment because it preserves the existing hierarchy
  and established ticket vocabulary without suggesting a new control.

### Local validation evidence

- Rendered the selected **Tomorrow · 2:30 AM** treatment on the real 390×844
  journey surface beside the Packed stamp. The field note and route remain
  unchanged and unobstructed.
- Rendered the production same-day path as **Around 7:38 PM** with no redundant
  **Today** label and no overnight comparison control.
- Pure tests cover same-day, tomorrow, farther-weekday, expired, and invalid
  timestamps. A separate America/New_York daylight-saving-boundary check
  returned **Tomorrow · 3:00 AM** correctly.
- Reload retained the same promise, the Lanternleaf route retained reflected-
  leaf copy, reduced motion kept the ticket, and fast-forward removed it before
  **Rosie is Home**.
- `npm run prototype:homegrown:test` passes 67/67 and
  `npm run prototype:homegrown:build` passes. `npx tsc --noEmit` and
  `npm run verify:rive-homegrown` pass both authored Rive contracts.
  `npm run quality:check` passes the quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice is the only
  warning.

### Public verification evidence

- Feature commit `10c5f41` deployed successfully in GitHub Pages run
  `31270037392`.
- Fresh public HTML, JavaScript, and CSS matched the verified local files byte
  for byte. Their SHA-256 hashes are
  `ef6794e8b72b25f20a9118ba7cda9017d80a2f48b82a8fb4a23f0b780febfaa5`,
  `8b75f032c14d3a9a88879dcaad556c33330d54fc16997fb89011b446423cfe5a`,
  and `82d9a848a57aea26e40812d55664959650f498ff240ef84921b79d6ab4150224`.
- Replayed both exact public homeward routes. The same-day case remained the
  quiet **Around 2:55 PM** form with no redundant **Today** label; Glowroot and
  Lanternleaf retained their distinct route copy and no overnight treatment
  switcher shipped.
- Public fast-forward removed the promise before **Rosie is Home** and
  **Welcome Rosie home**. The overnight case is proven by the captured rendered
  branch plus pure local-calendar and daylight-saving tests; the public clock
  did not cross midnight during this verification window.

### Next highest-leverage weakness

Replaying the public morning Tickle into Position 2 shows the next disconnect:
**A Glow Beneath the Hedge** becomes a small HUD line while the Farm Stock
drawer immediately dominates, and the curiosity's **soft soil · carry it
Home** clues disappear until much later. The next cycle should compare one
quiet way to preserve the physical Adventure invitation through Seed choice,
so the player understands what Rosie noticed before optimizing stock, without
adding a modal, quest list, or parallel opportunity system.

### v0.95 — Home Has a Time — 2026-08-08

- Began by replaying the exact shipped v0.94 homeward watch. The route, current
  phase, and packed items were visible, but the player still could not answer
  the basic idle-game question: when will Rosie be Home?
- Compared three treatments on the real Position 9 Farm: a small ticket
  attached to the field note, a time sentence inside the note, and a clock
  folded into the Homeward route endpoint. The ticket won. The sentence was
  too easy to miss, while the endpoint became cramped and changed a place into
  a timing label.
- Captured all three throwaway treatments at commit `3b2a8a6` on
  `codex/homegrown-v095-return-time-prototypes`. Main retains only the attached
  ticket; no `returntime` query or comparison switcher ships.
- **Expected Home · Around [local time]** is formatted from the same persisted
  `adventureReadyAt` fact that already completes the six-hour journey. It does
  not tick, create a second timer, or announce repeatedly.
- The ticket balances the existing **Packed** stamp beneath the note and stays
  subordinate to **Rosie is heading Home**. Its accessible group label says
  **Rosie is expected Home around [time]** once, while its visible children are
  hidden from duplicate screen-reader announcement.
- The ticket appears during both trail and homeward waiting, survives reload,
  and leaves before **Rosie is Home** and the Homecoming action. No route,
  duration, reward, state transition, save field, animation, Rive asset, or
  Rive input changed.
- The required Impeccable product-design review substituted for unavailable
  Claude Design. It selected the attached treatment for preserving the note,
  route, and Farm hierarchy without adding a panel or converting the scene
  into a countdown dashboard.

### Local validation evidence

- Rendered the selected treatment at the exact 390×844 game surface and in the
  fitted desktop frame. The time ticket and Packed stamp remain separate, the
  route is unobstructed, and there is no page overflow.
- Reload retained the exact same **Rosie is expected Home around 2:36 PM**
  label. Fast-forward removed it at the gate while retaining **Rosie is Home**.
- The Lanternleaf route retained its silver-reflection copy and the same return
  promise. Toggling reduced motion set `data-reduce-motion="true"` without
  removing or duplicating the time.
- The production render contains no return-time prototype switcher.
  `npm run prototype:homegrown:test` passes 66/66 and
  `npm run prototype:homegrown:build` passes. `npx tsc --noEmit` and
  `npm run verify:rive-homegrown` pass both authored Rive contracts.
  `npm run quality:check` passes the quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice is the only
  warning.

### Public verification evidence

- Feature commit `8f81f33` deployed successfully in GitHub Pages run
  `31269494902`.
- Fresh public HTML, JavaScript, and CSS matched the verified local files byte
  for byte. Their SHA-256 hashes are
  `48859c8f89e95f76908d70f34eb16966e4710db8b1859b4e0b6937755570cc57`,
  `fd1bbeffa0016355c7683168b372af9bfb2672a34a5f09a9457dab64c91e9c68`,
  and `82d9a848a57aea26e40812d55664959650f498ff240ef84921b79d6ab4150224`.
- Replayed both exact public homeward routes. Glowroot showed warm moths,
  Lanternleaf showed reflected leaves, and both exposed **Rosie is expected
  Home around 2:42 PM** beside the exact Packed stamp with no treatment
  switcher.
- Public fast-forward removed the time before **Rosie is Home** and **Welcome
  Rosie home**. The companion site now exposes **See when Rosie will be Home**.

### Next highest-leverage weakness

The public return promise is clear for a same-day outing, but its clock-only
label becomes ambiguous when a six-hour Adventure crosses midnight. The next
cycle should compare calm **Today / Tomorrow** treatments derived from the
same persisted timestamp and local calendar, without adding a countdown,
another timer, or a larger journey surface.

### v0.94 — The Journey Remembers the Bag — 2026-08-08

- Began by replaying the exact shipped v0.93 journey watch. The causal vignette
  explained the Provision, Tool, and Pack in sequence, but all three choices
  disappeared for the rest of the six-hour wait. The player could follow the
  route but could no longer recall what their preparation had authored.
- Compared three treatments on the real Position 9 Farm: item stamps pinned to
  the existing field note, a full named strip beneath the route, and a new Bag
  sentence inside an enlarged note. The pinned stamps won. The named strip
  created another card in the Farm; the sentence compressed the story and
  pushed the route down.
- Captured all three throwaway treatments at commit `0488e7b` on
  `codex/homegrown-v094-journey-bag-prototypes`. Main retains only the pinned
  stamp; no treatment switcher or `loadout` query remains.
- The stamp reuses the established Bag item art and says **Packed**, while its
  group label says **Rosie set out with** and names the exact Provision, Tool,
  and Pack. That wording remembers the one-use Provision without claiming it
  remains unconsumed in Rosie's Bag.
- Empty slots retain their dashed item marks and are named **empty**. The stamp
  is present during trail and homeward phases, then leaves before the gate's
  **Rosie is Home** and **Welcome Rosie home** handoff.
- No Bag choice, item ownership, consumption, route, duration, reward, journey
  state, action, save field, animation, Rive asset, or Rive input changed.
- The required Impeccable product-design review substituted for unavailable
  Claude Design. It favored the note-attached stamps for preserving the Farm
  and route hierarchy, using an established visual vocabulary, and avoiding
  another full-width card, tiny name ledger, interaction, or decorative motion.

### Local validation evidence

- Rendered the first route at trail and homeward and the Lanternleaf route at
  homeward. All three retained their exact story and route while the stamp
  named Clover Lunch, Hand Trowel, and Wicker Basket.
- Replayed preparation with Lantern and confirmed the journey group changed to
  **Tool Lantern**. Replayed all three empty choices and confirmed both the
  dashed visual marks and **Provision empty, Tool empty, Pack empty** label.
- Reload preserved the empty loadout. Reduced motion kept the same reminder
  with `data-reduce-motion="true"`; the production build exposed no comparison
  switcher.
- Fast-forward removed the stamp at the gate and retained **Rosie is Home**,
  **At the gate**, and the single **Welcome Rosie home** action.
- `npm run prototype:homegrown:test` passes 65/65 and
  `npm run prototype:homegrown:build` passes. `npx tsc --noEmit` and
  `npm run verify:rive-homegrown` pass both authored Rive contracts.
  `npm run quality:check` passes the quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice is the only
  warning.

### Public verification evidence

- Feature commit `692c6ec` deployed successfully in GitHub Pages run
  `31268888209`.
- Fresh public HTML, JavaScript, and CSS matched the verified files byte for
  byte. Their SHA-256 hashes are `6008833d25264a628a664abccb8a539d29e4fb1115811e33e2b1f9805cae0ec8`,
  `76fd14cee152d43a48ad1fbf1eb3ed9a523e7d47dd26994fc6650d056ae23baa`,
  and `52ecd3e077c79f69dfb83b3aaec8c9f724b4d20e99723e94a1cd5abdaf2903d7`.
- Replayed both exact public homeward routes. The pinned item stamps remained
  attached to the field note, the group named Clover Lunch, Hand Trowel, and
  Wicker Basket, and no treatment switcher shipped.
- Public fast-forward removed the stamps before **Rosie is Home**, **At the
  gate**, and **Welcome Rosie home**. The companion site exposes **See what
  Rosie packed for the journey**.

### Next highest-leverage weakness

The journey now preserves its route and preparation, but the player still has
no in-world indication of when Rosie will be Home. The next cycle should derive
one calm time-to-Home treatment from the already persisted `adventureReadyAt`
timestamp, avoiding a high-frequency countdown or another competing panel.

### v0.93 — The Description Turns Home — 2026-08-08

- Began with the exact shipped v0.92 homeward screen. Its visible HUD, field
  note, and review rail all said Rosie was heading Home, but the scene's
  accessible image description still began **Rosie is following the moths** or
  **Rosie is following reflected leaves**.
- Compared three semantic orders on the real screen: Rosie and her action
  first, a terse phase heading first, and the environment first. The
  Rosie-first treatment won because a player encounters the character and
  current action before the stable Barn context, matching the visible reading
  order without becoming another live announcement.
- Captured the three throwaway treatments at commit `0f55b04` on
  `codex/homegrown-v093-scene-label-prototypes`. Main retains only the direct
  description; no query parameter or comparison control ships.
- The first route now describes warm moth lights turning toward the old gate;
  the second describes silver reflections. Both lead with **Rosie is heading
  Home**. Trail descriptions remain route-specific and the completed gate
  retains its established Homecoming description.
- No visible element, CSS geometry, live region, action, duration, journey
  state, route, Bag rule, reward, save field, Rive asset, or Rive input changed.
  The existing `role="img"` label reads reducer-derived state already visible
  elsewhere on the screen.
- The required Impeccable product-design review substituted for unavailable
  Claude Design. It favored the Rosie-first order for subject/action clarity,
  exact agreement with the visible hierarchy, retained route texture, and no
  added density or announcement competition.

### Local validation evidence

- Rendered both the warm-moth and Lanternleaf trail states and confirmed their
  existing route-specific descriptions remained unchanged.
- Rendered both routes at homeward. Their descriptions led with **Rosie is
  heading Home** and then distinguished warm moth lights from silver
  reflections while the visible HUD and field note retained the same phase.
- Reload preserved the Lanternleaf homeward description. Reduced motion kept
  the same text with `data-reduce-motion="true"` and no comparison control.
- Fast-forwarding retained the established returned-through-the-gate scene
  description, **Rosie is Home**, **At the gate**, and **Welcome Rosie home**.
- `npm run prototype:homegrown:test` passes 64/64 and
  `npm run prototype:homegrown:build` passes. `npx tsc --noEmit` and
  `npm run verify:rive-homegrown` pass both authored Rive contracts.
  `npm run quality:check` passes the quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice is the only
  warning.

### Public verification evidence

- Feature commit `e7a0bac` deployed successfully in GitHub Pages run
  `31268182096`.
- Fresh public HTML, JavaScript, and CSS matched the verified files byte for
  byte. Their SHA-256 hashes are `4146b43f7491f03b7646c8910658c1c2252e29031d8dec634c485b10bbc7520c`,
  `f9fd1e99fb8719d1804a3b436e31622bf93b5e740f3f5d9bf74a3b0b42517c89`,
  and `d2c78dcf941ce1b214d9eb988b4e9bc4085776f5691ecc113eff4a056b7e47cf`.
- Replayed both exact public homeward routes. The scene descriptions led with
  **Rosie is heading Home**, then correctly named warm moth lights or silver
  reflections while the visible HUD, field note, and rail remained aligned.
- Public fast-forward retained the returned-through-the-gate description,
  **Rosie is Home**, **At the gate**, and **Welcome Rosie home**. The companion
  site now exposes **Follow Rosie's journey Home**.

### Next highest-leverage weakness

After the causal vignette ends, the six-hour journey watch keeps the route and
Home visible but removes every reminder of the Provision, Tool, and Pack the
player chose. The next cycle should compare restrained ways to keep one truthful
loadout reminder in reach during the wait without restoring the dense answer
ledger or competing with the Homeward story.

### v0.92 — The HUD Turns Home — 2026-08-08

- Replayed the shipped v0.91 first-route homeward state. Its story note and
  review rail agreed on **Heading Home**, but the persistent HUD still said
  **Rosie is following the moths**. The second route had the same contradiction
  with reflected leaves.
- Compared three treatments on the real homeward screen: the existing
  single-line objective following the phase, a two-line route name plus phase
  summary, and no objective while Rosie was away. The single line won. The
  route summary duplicated the field note in smaller text; removing the HUD
  left the heart counter visually stranded and discarded useful orientation.
- Captured all three throwaway treatments at commit `84c0d70` on
  `codex/homegrown-v092-journey-hud-prototypes`. Main retains only the derived
  homeward objective; no treatment switcher or alternate HUD structure ships.
- The warm-moth and reflected-leaf trail objectives remain route-specific.
  Both change to **Rosie is heading Home** at the existing homeward threshold,
  and the settled gate retains **Rosie is Home**.
- No CSS geometry, action, duration, journey state, route, Bag rule, reward,
  save field, Rive asset, or Rive input changed. The HUD reads the same phase
  the real screen already renders.
- The required Impeccable product-design review substituted for unavailable
  Claude Design. It approved the single changing line because it restores
  agreement, preserves orientation and the established compact footprint, and
  adds no density or competing surface.

### Local validation evidence

- Rendered the first route's causal vignette and confirmed **A warm glow
  answers Rosie**, then let it hand into the trail and confirmed **Rosie is
  following the moths** remained route-specific.
- Rendered the first route at homeward and confirmed the HUD, field note, and
  rail all agreed that Rosie was heading Home. Fast-forwarding retained the
  unchanged **Rosie is Home**, **At the gate**, and **Welcome Rosie home**
  handoff.
- Rendered the Lanternleaf second route at homeward and confirmed the same HUD
  agreement while the silver-leaf note and route remained distinct. Reload
  restored the same phase and copy.
- Enabled reduced motion through the real Lab tools and confirmed the same
  journey-aware HUD with no comparison switcher in production.
- `npm run prototype:homegrown:test` passes 63/63,
  `npm run prototype:homegrown:build` passes, `npx tsc --noEmit` passes,
  `npm run verify:rive-homegrown` passes both authored Rive contracts, and
  `npm run quality:check` passes the quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice is the only
  warning.

### Public verification evidence

- Feature commit `1a91a9e` deployed successfully in GitHub Pages run
  `31267669886`.
- Fresh public HTML, JavaScript, and CSS matched the verified files byte for
  byte. Their SHA-256 hashes are `e67cf9c6a8618e8ea9c82417366cdd197f60371bc7c6381b43ed33f464fd6944`,
  `1941368aaff8595c50b120d2c2770db3d69cc1c4fd1f7ee0ad3b781965ce66d3`,
  and `d2c78dcf941ce1b214d9eb988b4e9bc4085776f5691ecc113eff4a056b7e47cf`.
- Replayed the exact public Position 9 homeward state. The rendered HUD and
  field note both read **Rosie is heading Home**, the external rail read
  **Heading Home**, and no prototype treatment control shipped.
- Public **Fast-forward to Homecoming** handed the same screen to **Rosie is
  Home**, **At the gate**, and the single **Welcome Rosie home** action. The
  companion site exposes **See Rosie heading Home**.

### Next highest-leverage weakness

The visible HUD, story note, route, and review rail now agree, but the scene's
accessible image description still begins **Rosie is following the moths** or
**Rosie is following reflected leaves** during homeward. The next cycle should
let that existing description follow the same phase so screen-reader players
receive one truthful journey state, without changing the visible composition.

### v0.91 — The Rail Follows Rosie — 2026-08-08

- Replayed the shipped v0.90 first-route homeward state. The in-world field
  note correctly said **Rosie is heading Home**, while the persistent external
  rail contradicted it with **Adventure vignette**.
- Compared three treatments on the real Position 9 route: one changing phase
  title, a compact four-step phase strip, and a route-name-plus-current-beat
  title. The single phase title won. The phase strip duplicated the existing
  journey tracker; the route-led title repeated story context and crowded the
  rail's narrow center.
- Captured all three throwaway treatments at commit `8a934c2` on
  `codex/homegrown-v091-rail-readout-prototypes`. Main retains only the
  changing title; no treatment switcher or alternate rail structure ships.
- The rail now reads **Adventure begins**, **Following the trail**, **Heading
  Home**, and **At the gate** from the existing rendered state. All other
  positions retain their established names.
- No CSS geometry, action, duration, journey state, route, Bag rule, reward,
  save field, Rive asset, or Rive input changed. This is presentation derived
  from facts the real screen already owns.
- The required Impeccable product-design review substituted for unavailable
  Claude Design. It approved the single changing title because it restores
  agreement, keeps the world and its primary action dominant, remains within
  the established ellipsized rail geometry, and adds no duplicate progress
  component.

### Local validation evidence

- Rendered Position 9's causal vignette and confirmed **Adventure begins**.
- Let the same real first-route state hand itself into the idle watch and
  confirmed **Following the trail** with the warm-moth route unchanged.
- Rendered the persisted first-route homeward state and confirmed **Heading
  Home**, then used the existing fast-forward and confirmed **At the gate**,
  the shortcut's removal, and the unchanged **Welcome Rosie home** action.
- Rendered the Lanternleaf second route at homeward, reloaded it through the
  causal sequence, and confirmed the rail returned to **Heading Home** while
  the silver-leaf story remained intact.
- Enabled reduced motion through the real Lab tools and confirmed the same
  phase-aware readout with no comparison switcher in production.
- `npm run prototype:homegrown:test` passes 62/62,
  `npm run prototype:homegrown:build` passes, `npx tsc --noEmit` passes,
  `npm run verify:rive-homegrown` passes both authored Rive contracts, and
  `npm run quality:check` passes the quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice is the only
  warning.
- Feature commit `ac494eb` deployed successfully through GitHub Pages run
  `31267186453`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `04c5d8f2be34463664f25b85aa21843a71cb6e255b48d19d7d6fc3e9b7a389ae`,
  `68d292088367fff65a7ba6b8bb94e9db3d8595835b51c5696aa7dde21ba672f7`, and
  `d2c78dcf941ce1b214d9eb988b4e9bc4085776f5691ecc113eff4a056b7e47cf`.
- A fresh public homeward replay rendered the correct route note, current
  Homeward step, external **Heading Home** readout, and no treatment switcher.
  Fast-forwarding that exact served build changed the readout to **At the
  gate**, removed the review shortcut, and restored the unchanged in-world
  **Welcome Rosie home** action.
- The public companion page now exposes **Follow Rosie's journey Home** and
  links directly to Position 9's reviewable homeward beat.

### Next highest-leverage weakness

The external rail now agrees with the journey, but the quiet top HUD still
says **Rosie is following the moths** or **Rosie is following reflected
leaves** after the field note and route have advanced to **Heading Home**. The
next cycle should let that existing HUD objective follow the same derived
phase without adding another label, timer, or saved state.

### v0.90 — The Farm Holds the Journey — 2026-08-08

- Replayed the shipped v0.89 homeward state. Its field note, three-step route,
  reversed lights, and brighter porch made the journey readable, but the
  294px **Fast-forward to Homecoming** slab remained the strongest object in
  the lower half of the Farm. A browser-review affordance visually outweighed
  Rosie's actual outing.
- Compared three placements on the real Position 9 screen: a secondary action
  inside the field note, an actionable Homeward route step, and a two-tier
  external review dock above Previous / Next. The dock won. The field-note
  treatment grew the story card until it crowded the route; the route treatment
  confused a progress state with a button and reduced its visible label to the
  ambiguous **Preview**.
- Captured all three throwaway treatments at commit `df43a46` on
  `codex/homegrown-v090-fast-forward-prototypes`. Main retains only the
  external review dock; neither in-world treatment nor the prototype switcher
  ships.
- During trail and homeward, the Farm now contains no fast-forward action. A
  compact dock immediately above the prototype progression rail identifies
  itself as **Browser prototype**, explains **Skip the six-hour wait**, and
  offers one 44px **Fast-forward** button whose accessible name remains
  **Fast-forward to Homecoming**.
- When the same reducer-owned `ADVANCE_TIME` reaches Home, the review shortcut
  disappears and the established full in-world **Welcome Rosie home** action
  returns. That action still performs `WELCOME_HOME`, advances to Position 10,
  and alone reveals the named Discovery or Near-Discovery.
- No action, duration, journey phase, route, Bag rule, reward, save field, Rive
  asset, or Rive input changed. This is purely hierarchy and placement for the
  browser prototype.

### Local validation evidence

- Rendered the real first-route homeward state. The entire Farm below the route
  remained visible; the compact shortcut aligned with the external rail and
  exposed a 44px target without competing with the story note.
- Rendered the second route at its earlier trail state. **Rosie follows
  reflected leaves**, the current route step, and the pale-green light stayed
  unchanged while the same external shortcut remained reachable.
- Fast-forwarded that real second route, confirmed the shortcut left the DOM,
  confirmed **Rosie is Home**, **At Home**, and the full **Welcome Rosie home**
  action, then welcomed Rosie and reached Position 10 with **Lanternleaf Path**
  intact.
- Enabled reduced motion through the real Lab tools on the Lanternleaf
  homeward state. The correct copy and shortcut remained readable, no
  fast-forward treatment switcher existed, and the established motion policy
  remained authoritative.
- `npm run prototype:homegrown:test` passes 61/61,
  `npm run prototype:homegrown:build` passes, `npx tsc --noEmit` passes,
  `npm run verify:rive-homegrown` passes both authored Rive contracts, and
  `npm run quality:check` passes the quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice is the only
  warning.
- Feature commit `2a2e045` deployed successfully through GitHub Pages run
  `31266562930`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `6acdc952638b7170dca76a0857fc9a3d5a8f3214738f194c173a01674fdc715b`,
  `97cf494019576f3b7c552dd087f306b13d01ccf2e879f5c924892408c5afe76c`, and
  `d2c78dcf941ce1b214d9eb988b4e9bc4085776f5691ecc113eff4a056b7e47cf`.
- A fresh public homeward replay rendered the unobstructed Farm, **Rosie is
  heading Home**, current Homeward, and the compact two-tier review dock. Its
  44px button retained the accessible name **Fast-forward to Homecoming** and
  no treatment switcher was present.
- Fast-forwarding that exact served build removed the review shortcut, restored
  **Rosie is Home**, **At Home**, and the full **Welcome Rosie home** action,
  then advanced to Position 10 before revealing **Glowroot Seed**.
- The public companion page now exposes **Watch Rosie's journey Home** and
  links directly to Position 9's reviewable homeward beat.

### Next highest-leverage weakness

The review shortcut now belongs with the prototype controls, but the rail still
labels every Position 9 state **Adventure vignette** even after the vignette
has handed off to trail, homeward, or Home. The next cycle should make that
external readout agree with the current journey beat—without adding a fourth
in-world progress label or splitting Position 9 into more screens.

### v0.89 — The Trail Turns Home — 2026-08-08

- Replayed the exact shipped v0.88 Position 9 watch. The Farm held the correct
  dusk and route color, but **Rosie is following the moths**, the middle route
  step, and the large review fast-forward action remained unchanged for the
  entire six-hour outing. Nothing in the waiting surface showed that the
  journey itself was progressing.
- Compared three treatments inside the real Position 9 screen: a traveler dot
  on the painted path, one changing field note plus route step, and a
  Home-centered porch vigil. The field-note treatment won because it made the
  temporal change immediately understandable using the hierarchy already on
  screen. The traveler dot felt abstract and detached from Rosie; the porch
  vigil introduced a second competing message.
- Captured the complete throwaway comparison at commit `56d1bec` on
  `codex/homegrown-v089-journey-progress-prototypes`. Main keeps only the
  winner's existing-note structure, the path treatment's reversed light
  motion, and the Home treatment's brighter porch light. No comparison
  switcher or losing layout remains.
- Added pure `adventureJourneyProgress`, `adventureHomewardAt`, and
  `adventureJourneyPhase` derivations over the existing six-hour start and
  ready timestamps. **Trail** holds through the first 75%; **Homeward** then
  lasts until the reducer-owned **Home** state. No new saved state or opaque
  countdown can drift from the real Adventure.
- The warm-moth route changes from **Beyond the hedge · Rosie follows warm
  moths** to **The moths turn Home · Rosie is heading Home**. The second route
  changes from reflected leaves to the corresponding silver-leaf homeward
  copy. Both advance Set off → route → Homeward without revealing the named
  Discovery before Homecoming.
- The open page schedules only the next derived beat and the existing reducer
  settlement. Reload computes the same phase from timestamps. Reduced motion
  removes the current-step, route-light, and porch animations while preserving
  the exact readable phase.
- Added direct review parameters for `journey=homeward` and
  `route=lanternleaf`; these seed valid Position 9 timestamps and route facts
  so the real rendered states can be inspected without waiting six hours.
  They add no player state, production branch, or alternate UI.

### Local validation evidence

- Rendered the real built first route at its earlier trail phase: the scene
  description named the remembered twilight Farm, the note read **Rosie
  follows warm moths**, Warm moth trail remained current, and the existing
  fast-forward action remained reachable.
- Rendered the same real build at its later phase: the note read **Rosie is
  heading Home**, Warm moth trail was complete, Homeward was current, route
  lights reversed, and the porch light strengthened without adding another
  card or action.
- Rendered the real Lanternleaf homeward state: the note and route used silver
  leaf language, the existing route color remained pale green, and the
  remembered pond stayed visible. Reload retained that same homeward state.
- Used the real Lab tools to enable reduced motion, then fast-forwarded the
  second route. The surface advanced to **The gate bell rings · Rosie is
  Home**, Set off and Reflected leaves were complete, **At Home** was current,
  canonical Rive Rosie returned with her satchel, and the named Discovery was
  still withheld until **Welcome Rosie home**.
- `npm run prototype:homegrown:test` passes 60/60,
  `npm run prototype:homegrown:build` passes, `npx tsc --noEmit` passes,
  `npm run verify:rive-homegrown` passes both authored Rive contracts, and
  `npm run quality:check` passes the quality contracts, 157-file layout gate,
  324-sprite integrity gate, security contracts, TypeScript, 78 layout tests,
  and 202 security tests. Watchman's existing recrawl notice is the only
  warning.
- Feature commit `3e88199` deployed successfully through GitHub Pages run
  `31266035078`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `362333a6c48ba63679b2451266ea3e133788a75a9e4ff01099f155fb9955f426`,
  `d0e56f0017e1cd911a5176c908b013c47c84dbaca48f63cbda06092feaed7306`, and
  `a924db2d0fc0d3f27643fe7df1b9157a0597f11a11399c258a6574265f058eb4`.
- A fresh public homeward replay rendered **The moths turn Home · Rosie is
  heading Home**, completed Warm moth trail, current Homeward, the brighter
  porch light, and the existing reachable fast-forward action. Fast-forward
  advanced that exact served build to **The gate bell rings · Rosie is Home**,
  current **At Home**, and **Welcome Rosie home**, with no journey-progress
  prototype switcher.
- The public companion page exposes **Follow Rosie's trail Home** and links
  directly to the reviewable Position 9 homeward beat.

### Next highest-leverage weakness

The journey now changes meaningfully while Rosie is away, but the browser
prototype's large **Fast-forward to Homecoming** action still dominates the
quiet Farm. The next cycle should replay the complete shipped loop and decide
whether that review affordance can become visually secondary while remaining
obvious and touch-accessible—without hiding fast-forward, adding a countdown
dashboard, or weakening Homecoming.

### v0.88 — Home Keeps the Dusk — 2026-08-08

- Replayed the exact shipped v0.87 handoff. **The journey continues…** held a
  dark beyond-the-hedge clearing, then cut one second later to the bright blue
  daytime Farm while **Rosie is following the moths** said she was still away
  after dusk. The 1280 px render had no layout failure; the discontinuity was
  entirely in time, color, and place.
- Compared that cut with the approved `04-adventure-departure.png` and
  `05-welcome-home-discovery.png` concepts. Both keep Home, the path, and the
  return in one richly colored evening, so the Farm remains a remembered place
  rather than becoming a generic wait-screen backdrop.
- Compared three treatments on the real Position 9 watch: whole-Farm dusk, a
  clipped night window along the hedge route, and a deeper porch-light vigil.
  The whole-Farm treatment won because it preserved every Farm consequence and
  the existing one-action hierarchy. The clipped trail looked pasted over the
  scene; the vigil hid too much of Home. The winner borrows only the vigil's
  restrained warm Home light.
- Captured all three throwaway treatments at commit `6a2ed6c` on
  `codex/homegrown-v088-journey-atmosphere-prototypes`. Main retains one 440 ms
  twilight arrival, one static evening grade, one warm Home light, and the
  existing route lights—no prototype switcher or alternate layout.
- Warm moths retain a gold trail; reflected leaves now tint the existing route
  mark, current step, and path lights a pale leaf-green. The accessible scene
  description names the twilight Farm and remembered Kitchen Patch while Rosie
  is away.
- React and the existing reducer still own the journey, completion, action,
  route, Bag, reward, persistence, and Homecoming states. This checkpoint adds
  no screen, timer fact, destination, Find, save field, Rive asset, or Rive
  input. Reduced motion paints the final dusk and Home light without their two
  new CSS animations.

### Validation evidence

- A full-motion first-route replay reported the existing
  **Rosie is following the moths** watch, gold route light, the 440 ms
  `journey-home-dusk-enter`, the independent `journey-home-light-breathe`, no
  atmosphere switcher, and equal 1280 px client/scroll widths.
- Continued through the actual first Homecoming, planted Glowroot, grew
  Moonberries, tickled Rosie, began the next day, and used all eight visible
  review-position advances to reach the second Adventure. Its real watch read
  **Rosie is following reflected leaves**, showed Set off → Reflected leaves →
  Homecoming, and colored the existing mark, current step, and path lights
  `#c3ead6` with no overflow.
- Reduced motion on that second route retained the same twilight grade and
  route identity while reporting no scene-entry or Home-light animation.
- `npm run prototype:homegrown:test` passes 58/58,
  `npm run prototype:homegrown:build` passes, `npx tsc --noEmit` passes, and
  `npm run verify:rive-homegrown` passes both authored Rive contracts.
- `npm run quality:check` passes the quality contracts, 157-file layout
  inspection, 324-sprite integrity gate, security contracts, TypeScript, 78
  layout tests, and 202 security tests. Watchman's existing recrawl notice is
  the only warning.
- Feature commit `37e9ae6` deployed successfully through GitHub Pages run
  `31265289393`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `ae58cbd74837b65af51cb990516a0aa1444b2bd6e159826e63ab865193dadce0`,
  `6d1621b0e6b718d4b4bc68cbcf45f231ee84f902bd976ecc078b88da3e102bdf`, and
  `9d6dba00fc34987d3f94e1db29ad57d6133ee7673bd47db06b3ad0e581e29314`.
- A fresh public Position 8 → 9 replay rendered the full-motion first route
  with **Rosie is following the moths**, Set off → Warm moth trail →
  Homecoming, gold `#f7d568` route light, the dusk-entry and Home-light
  animations, the exact twilight scene description, no prototype switcher,
  and equal 1280 px client/scroll widths.
- The public companion page exposes **Wait at dusk while Rosie explores** and
  links directly to Position 9.

### Next highest-leverage weakness

Home and the route now belong to the same evening, but the middle of the idle
journey still communicates only one fixed route step and one large fast-forward
action. The next cycle should make waiting itself feel alive with one bounded,
route-specific ambient progression inside the existing watch—without adding a
new screen, choice, reward, or opaque timer system.

### v0.87 — The Journey Continues — 2026-08-08

- Replayed the exact live v0.86 resolved vignette at Position 9. It reported
  **What Rosie found · Warm light stirs beneath the hedge**, while the only
  action beneath it still said **Let Rosie explore**. The screen therefore
  implied that the Find existed before the Adventure it was asking to begin,
  despite Homecoming correctly owning the named Discovery.
- Compared three structures on the real clearing: a route-specific path note
  with an explicit follow action, a compact journey-beginning seal, and a
  no-extra-click cinematic bridge into the existing wait. The cinematic bridge
  won because the player had already chosen to send Rosie, the causal sequence
  was complete, and another confirmation weakened rather than clarified that
  commitment. The seal became a second card competing with Rosie and the
  clearing.
- Captured all three throwaway treatments at commit `79ca1ef` on
  `codex/homegrown-v087-journey-handoff-prototypes`. Main retains only the
  automatic handoff and no prototype switcher.
- Provision, Tool, and Pack still receive their existing 900 ms notes and
  physical responses. After Pack, the note clears and one short status reads
  **Rosie follows the warm light** or **Rosie follows the reflected leaves**,
  followed by **The journey continues…**. After 900 ms it enters the existing
  idle journey watch without another button.
- Reduced motion skips the cause animation as before, paints the static bridge,
  and holds it for 1.8 seconds before continuing. The handoff status remains a
  polite live region. Reload before settlement safely restarts the bounded
  vignette; reducer settlement stays idempotent.
- React still owns the `CONTINUE_ADVENTURE_STORY` transition and all Bag,
  route, duration, result, reward, persistence, and Homecoming facts. The
  change adds no Find, dialogue, choice, danger, timer state, save field, Rive
  asset, or Rive input, and the named Discovery remains reserved for Return.

### Validation evidence

- The complete Lanternleaf route rendered
  `Rosie follows the reflected leaves · The journey continues…`, mounted no
  old field note or confirmation button, kept equal 1280 px client/scroll
  widths, and transitioned after the bounded hold to the existing
  **Rosie is following reflected leaves** journey watch and its
  Set off → Reflected leaves → Homecoming route.
- A reduced-motion first-route replay settled into the existing
  **Rosie is following the moths** journey watch with Rive `motion=reduced`;
  the source contract fixes its static bridge hold at 1.8 seconds and removes
  the old continuation button from every cause beat.
- `npm run prototype:homegrown:test` passes 57/57,
  `npm run prototype:homegrown:build` passes, `npx tsc --noEmit` passes, and
  `npm run verify:rive-homegrown` passes both authored Rive contracts.
- `npm run quality:check` passes the quality contracts, 157-file layout
  inspection, 324-sprite integrity gate, security contracts, TypeScript, 78
  layout tests, and 202 security tests. Watchman's existing recrawl notice is
  the only warning.
- Feature commit `3fd68d9` deployed successfully through GitHub Pages run
  `31264340740`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `3e400a60a4f1727dd3333f0a962e12fe582637e2a8fb26041797378f4b414664`,
  `868129a2bff0cf6619a01413380e9245dfc17dd8d18eedb143ebc947f6a02e85`, and
  `a95c15d1b90551d1527cfa249734dd2c52036c8b092df3ae30532e5ed66c7536`.
- A fresh public Position 8 → 9 replay captured the first route at
  `beat=resolved` with **Rosie follows the warm light · The journey
  continues…**, no field note, no confirmation button, no journey watch yet,
  and equal 1280 px client/scroll widths. After the bounded hold, the bridge
  disappeared and the existing **Rosie is following the moths** watch exposed
  Set off → Warm moth trail → Homecoming and **Fast-forward to Homecoming**.
- The public companion page exposes **Watch the Adventure become a journey**
  and links directly to Position 9.

### Next highest-leverage weakness

The causal vignette now hands off in the right order, but its twilight clearing
still cuts directly to a bright daytime Farm while the journey watch says Rosie
is away after dusk. The next cycle should preserve the established time and
route atmosphere across that transition without hiding the remembered Farm or
adding another journey screen.

### v0.86 — Rosie Leans In — 2026-08-08

- Replayed the exact shipped v0.85 cause sequence. Clover Lunch reached Rosie
  and brought dusk, the Tool acted, and the Pack received the find, but the
  foreground Rive scene reported only ordinary breathing while all three
  Adventure facts happened around her.
- Compared three temporal treatments on the real Position 9 scene: repeat the
  existing authored `Rosie Notice` lean for every cause, reserve it for the
  Tool turning point, or pair an early Notice with the existing Tickle delight
  after resolution. The single Tool response won. Repetition felt mechanically
  cued, while the Tickle jump carried Rosie into the field note and away from
  the Find.
- Captured all three throwaway treatments at commit `832544f` on
  `codex/homegrown-v086-rosie-response-prototypes`. Main retains only the
  one-turning-point treatment and no prototype switcher.
- When the existing Tool field note takes focus, React emits one presentation-
  only `adventure-attention` motion and the Rive boundary plays the already
  authored `Rosie Notice` timeline. Rosie settles before Pack takes focus. The
  same response plays for a **No Tool** Near-Discovery, making her visible
  attention honest even when no Tool object or earned reward is mounted.
- **A Glow Beneath the Hedge** and **Lights Past the Open Gate** share this
  grammar. The latter keeps its independent Lanternleaf reflection rise behind
  Rosie. Reduced motion emits no attention trigger and holds the resolved Rive
  pose immediately.
- This is orchestration of an existing Rive performance, not a new game fact.
  React still owns the selected Tool, route, branch, outcome, timer, reward,
  persistence, and exact field note; no dialogue, control, danger, stat,
  progression state, Rive asset, or View Model input was added.

### Validation evidence

- The complete Glowroot route reported `beat=tool`,
  `motion=adventure-attention`, and
  `last=adventure-attention` while the Hand Trowel field note and physical dig
  were visible. The authored lean remained inside the existing clearing and
  settled before the final Pack/result state.
- The empty-Tool route reported `kind=near-discovery`, `tool=none`, the exact
  **No Tool · the warmth stays hidden beneath tangled roots** clue, and the
  same Rive attention response without mounting a Tool prop.
- The second route reported `opportunity=lights-past-open-gate`,
  `beat=tool`, `motion=adventure-attention`, and Lanternleaf reflections
  `rising` together. A fresh reduced-motion replay reported `beat=resolved`,
  `motion=reduced`, and `last=none`.
- `npm run prototype:homegrown:test` passes 56/56,
  `npm run prototype:homegrown:build` passes, `npx tsc --noEmit` passes, and
  `npm run verify:rive-homegrown` passes both authored Rive contracts.
  `npm run quality:check` also passes the quality contracts, 157-file layout
  inspection, 324-sprite integrity gate, security contracts, TypeScript, 78
  layout tests, and the security suite; Watchman's existing recrawl notice is
  the only warning.
- Feature commit `6d97503` deployed successfully through GitHub Pages run
  `31263696874`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `f868eb46cb4925a3416f8c6c913361c761ad9566b21e68d4503e3f57176a950e`,
  `77be609432cdc6c1d0ca6de3b60525c58342cd35d7f53a6f32f1668ad9cb4a32`, and
  `d388814af585292314aac9eccd6f5fca03c70d8a5f893eba84ca6ca23f9fe089`.
- A clean public Position 9 replay at 1280×720 reported
  `opportunity=glow-beneath-hedge`, `beat=tool`, Rive `ready`,
  `motion=adventure-attention`, `last=adventure-attention`, the exact Hand
  Trowel field note, and equal 1280 px client/scroll widths. The deployed
  companion page links directly to the same checkpoint as **Watch Rosie lean
  into the Adventure clue**.

### Next highest-leverage weakness

Rosie now answers the Adventure's turning point, but the final field note says
**What Rosie found** while the primary action still says **Let Rosie explore**.
That temporal handoff suggests the find happened before exploration begins.
The next cycle should make the resolved vignette lead cleanly into the quiet
journey watch without announcing or implying the Homecoming reward early.

### v0.85 — Lunch Until Dusk — 2026-08-08

- Replayed the exact shipped v0.84 Provision beat at centered 1280×720. The
  field note correctly said **Clover Lunch · keeps Rosie exploring until dusk**,
  and the selected tin brightened on the ground, but neither Rosie nor the
  clearing changed. The first cause remained a label while Tool and Pack now
  performed their verbs.
- Compared three bounded treatments on the existing Position 9 route: retain
  the spotlight-only tin, lift the tin to Rosie once, or combine that physical
  use with one restrained dusk transition. The combined treatment won because
  the lift explains **used** and the environmental handoff explains **until
  dusk** without another panel, interaction, resource, or status effect.
- Captured all three throwaway treatments at commit `b439995` on
  `codex/homegrown-v085-provision-action-prototypes`. Main retains only the
  lunch-to-dusk treatment and no prototype switcher.
- During the existing 900 ms Provision beat, the painterly Clover Lunch tin
  follows one 760 ms lift toward Rosie, holds briefly, and returns to its
  established ground position before the Tool beat. A quiet indigo wash arrives
  over 820 ms and remains behind the subsequent Tool, Pack, and resolved beats.
- Leaving Provision empty renders no tin, no motion, and no added dusk while
  keeping the exact **No Provision** Near-Discovery text. The later Lanternleaf
  route receives the same nightfall grammar, with its Rive reflection layer
  still mounted above the environmental wash. Reduced motion skips the lift and
  paints the resolved dusk state immediately.
- React already spent the selected Provision exactly once when the Bag was
  packed and remains authoritative for the opportunity, branch, outcome, and
  persistence. The visual use response does not spend again and adds no hunger,
  timer, reward, input, reducer state, save field, Rive asset, or Rive input.

### Validation evidence

- The first-route replay reported `beat=provision`,
  `animation=adventure-provision-one-use`, the exact **Clover Lunch** field
  note, a held mid-use transform, and a visible dusk overlay that remained at
  opacity 1 after the story advanced.
- Leaving Provision empty produced `kind=near-discovery`, `provision=none`,
  `display=none` for the tin, and dusk opacity 0. The lighter clue clearing and
  **No Provision · daylight fades before the warm root opens** remained
  readable with the same one continuation action.
- A complete second-day replay entered **Lights Past the Open Gate**, used the
  same Clover Lunch response, kept the Lanternleaf Rive layer mounted, and
  preserved the route's reflected-leaf story above the darker scene.
- Reduced motion reported `beat=resolved`, `animation=none`, the settled ground
  tin, and the finished dusk wash. At the full-motion midpoint the 56×55 px tin
  remained inside the fitted 328×709 game frame, did not overlap the field note
  or primary action, and the 1280 px client and scroll widths were equal.
- `npm run prototype:homegrown:test` passes 55/55, `npx tsc --noEmit` passes,
  and `npm run verify:rive-homegrown` passes both authored Rive contracts.
  `npm run quality:check` passes its quality contracts, 157-file layout
  inspection, 324-sprite integrity gate, security contracts, TypeScript, 78
  layout tests, and the security suite; Watchman's existing recrawl notice is
  the only warning.
- Feature commit `66ad4c5` deployed successfully through GitHub Pages run
  `31263008524`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `2fc453ac8327c5df14ef4636cbee5c848e859b0ec97667528370a429f7d33d4c`,
  `e8b28e93e3164e41d1e302c6c8d61374f2802a28bcfd6e67ec1c617a98f972f1`, and
  `d388814af585292314aac9eccd6f5fca03c70d8a5f893eba84ca6ca23f9fe089`.
- Replayed a clean public Position 8 → 9 handoff at 1280×720. The exact
  Provision beat reported `opportunity=glow-beneath-hedge`,
  `provision=clover-lunch`, `animation=adventure-provision-one-use`, the held
  mid-use transform, dusk opacity `0.956354`, the exact **Clover Lunch** field
  note, and equal 1280 px client/scroll widths.
- The deployed companion page links directly to Position 9 as **Watch Clover
  Lunch carry Rosie to dusk**.

### Next highest-leverage weakness

Provision, Tool, and Pack now perform one readable cause each, but canonical
Rive Rosie holds the same neutral Adventure pose while those three actions
happen around her. The next cycle should give Rosie one restrained
attention-and-discovery response inside the existing vignette, without adding
dialogue, control, danger, or progression state.

### v0.84 — The Pack Carries the Find — 2026-08-08

- Replayed the exact shipped v0.83 Pack beat at centered 1280×720. Provision
  already established dusk and the Trowel physically opened the roots, but the
  Wicker Basket only brightened while its field note said it waited for the
  find. The final cause remained an inference.
- Compared three bounded treatments on the existing Position 9 route: retain
  the spotlight-only Pack, let the Pack lean toward the find, or move one
  restrained warm-light mote from the Glowroot into the Pack. The light handoff
  won because it expresses find → carrier without introducing another panel,
  literal inventory icon, or repeated Pack motion.
- Captured all three throwaway treatments at commit `bd77edf` on
  `codex/homegrown-v084-pack-handoff-prototypes`. Main retains only the
  find-to-Pack treatment and no prototype switcher.
- During the existing 900 ms Pack beat, one 760 ms mote leaves the established
  Glowroot position, follows a short readable arc, and settles faintly inside
  the selected nonempty Pack. The Glowroot remains Rive-owned; the handoff is a
  presentation trace rather than a second reward object.
- Leaving Pack empty renders no transfer and keeps the existing clue-only
  clearing. The treatment is scoped to **A Glow Beneath the Hedge**, so Cloth
  Wrap on **Lights Past the Open Gate** does not inherit a Glowroot cue.
  Reduced motion paints the same settled endpoint immediately.
- React still derives the exact existing opportunity, Pack, beat, outcome, and
  reward. No Pack rule, cause copy, reward quantity, Rive asset, Rive input,
  timer, interaction, reducer state, or persisted field changed.

### Validation evidence

- The full-motion Wicker Basket replay reported `beat=pack`,
  `animation=adventure-find-to-pack`, and a visible mid-arc transform while the
  exact **Wicker Basket** field note remained readable. The settled frame kept
  the light inside the Basket rather than floating over the clearing.
- Leaving Pack empty produced `kind=near-discovery`, `pack=none`, and
  `display=none` for the handoff. The clean clue clearing, Rosie, Trowel, note,
  and one continuation action remained intact.
- A complete second-day replay selected Cloth Wrap, spent one Willow Fiber,
  entered **Lights Past the Open Gate**, reached its Pack beat, and reported no
  Glowroot handoff. Its reflected leaves and Cloth-specific field note remained
  the only route language.
- Reduced motion reported `beat=resolved`, `animation=none`, and the same
  settled Pack transform. The change adds no layout box or interactive target;
  the established game frame and rail remain unchanged.
- `npm run prototype:homegrown:test` passes 54/54, `npx tsc --noEmit` passes,
  and `npm run verify:rive-homegrown` passes both authored Rive contracts.
  `npm run quality:check` passes its quality contracts, 157-file layout
  inspection, 324-sprite integrity gate, security contracts, TypeScript, 78
  layout tests, and the security suite; Watchman's existing recrawl notice is
  the only warning.
- Feature commit `71830a9` deployed successfully through GitHub Pages run
  `31262426425`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `e7c62659e0e61f9151bb2dc53bcfc32d2a51a13a56740e14d3863381346a2bf9`,
  `e8b28e93e3164e41d1e302c6c8d61374f2802a28bcfd6e67ec1c617a98f972f1`, and
  `dc327b8d99c7f07c94b47cfd2c9767c1aefa92e5dcbb2864a14b3774a8f0d8ed`.
- Replayed the exact public Position 9 at 1280×720. During the Pack beat it
  reported `opportunity=glow-beneath-hedge`, `pack=wicker-basket`,
  `animation=adventure-find-to-pack`, a visible mid-arc transform, the exact
  **Wicker Basket** field note, and equal 1280 px client/scroll widths. The
  moving light remained inside the game frame and visually joined the Basket.
- The deployed companion page links directly to Position 9 as **Watch Rosie's
  find enter the Pack**.

### Next highest-leverage weakness

The Tool and Pack now perform their verbs, but the Provision beat still only
highlights an open Clover Lunch tin while its note says it keeps Rosie exploring
until dusk. The next cycle should give that existing Provision one bounded,
physical use response inside the clearing—without changing its one-use stock
rule, adding hunger, or adding another interaction.

### v0.83 — The Trowel Opens the Roots — 2026-08-08

- Began with the exact shipped v0.82 Tool beat at 360×780. The new field note
  clearly said **Hand Trowel · opens a careful way beneath the roots**, but the
  matching trowel remained painted into the clearing. Its cause was readable
  yet not performed.
- Compared three bounded treatments on the existing Position 9 route: retain
  the baked Tool, replace it with one separable highlighted prop, or let that
  prop perform one restrained dig during its existing cause beat. The one-dig
  treatment won because it completed the verb without adding input, repetition,
  or a Tool minigame.
- Captured all three throwaway treatments at commit `42a66ab` on
  `codex/homegrown-v083-tool-action-prototypes`. Main retains only the one-dig
  treatment and no prototype switcher.
- The first outing now uses the clean clearing plus the existing separable
  `return-tool-trowel.png`. At the Tool beat it follows one 680 ms press-and-
  settle path toward the same Rive Glowroot reveal, then becomes motionless
  before Pack takes focus.
- Lantern uses its existing separable prop in the same clearing and does not
  inherit the trowel motion. Leaving Tool empty renders no prop and no animation;
  the existing Near-Discovery remains honest. Reduced motion paints the settled
  trowel and resolved find immediately.
- React still derives the beat from the same local presentation sequence and
  Rive still owns Glowroot. No Bag choice, cause copy, encounter, reward,
  animation input, timer, reducer state, save field, or result changed.

### Validation evidence

- A normal 360×780 replay reported `animation=none` for Provision,
  `adventure-trowel-one-dig` for Tool, then `none` for Pack and resolved. The
  motion lasted 680 ms inside the existing 900 ms Tool beat and did not overlap
  the primary action or create horizontal overflow.
- The Tool-beat screenshot kept Rosie, Clover Lunch, Basket, field note,
  Glowroot reveal, and **Let Rosie explore** readable while the trowel crossed
  the disturbed soil once. Its settled frame remained above the primary action.
- Choosing Lantern produced `return-tool-lantern.png`, the correct Lantern
  field note, the clean clearing, and no trowel animation. Leaving Tool empty
  produced `display=none`, **No Tool · the warmth stays hidden beneath tangled
  roots**, and a kind Near-Discovery.
- Reduced motion reported `resolved`, a visible settled Hand Trowel, and
  `animation=none`. The 360 px client and scroll widths remained equal.
- At 1280×720 the complete 328×709 game remained centered; the settled Tool,
  field note, and primary action all remained inside the first viewport. The
  surrounding Position 9 layout is otherwise unchanged from v0.82's verified
  390×844 render.
- `npm run prototype:homegrown:test` passes 53/53 and `npx tsc --noEmit`
  passes locally. `npm run verify:rive-homegrown` passes both authored Rive
  contracts. `npm run quality:check` passes its quality contracts, 157-file
  layout inspection, 324-sprite integrity gate, security contracts,
  TypeScript, 78 layout tests, and 202 security tests; Watchman's existing
  recrawl notice is the only warning.
- Feature commit `bea16d2` deployed successfully through GitHub Pages run
  `31261753775`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `ee0c2b2014271cda7e79cbce818f8576afa8b2e533dd48429a7e38728c5840f6`,
  `a12c30c385cbd799c1c05e9436a2edce8a56852d9dd08896221e5c62593adf8d`, and
  `86979c4d080f49c18dbf80d58a062e25ac527e7e323837a46f1c4ee633498f3a`.
- Replayed the exact public Position 8 → 9 handoff at 360×780, then reloaded
  the active vignette for a timed capture. At 1.12 seconds the page reported
  `beat=tool`, `animation=adventure-trowel-one-dig`, the correct Hand Trowel
  field note, equal 360 px client/scroll widths, and no baked Tool background.
- The captured public frame kept the moving Tool above the primary action and
  beside the Rive Glowroot reveal; no overlap obscured Rosie, the Basket, or
  the story note.
- The deployed companion page links directly to Position 9 as **Watch Rosie's
  Trowel reveal the Glowroot**.

### Next highest-leverage weakness

The Provision keeps Rosie out until dusk and the Tool now opens the roots, but
the Pack beat still only highlights an empty Wicker Basket while its note says
it waits for the find. The next cycle should make the existing Glowroot find
settle visibly into the selected Pack—or make an empty Pack visibly leave it
behind—without changing reward logic or adding another inventory panel.

### v0.82 — One Cause at a Time — 2026-08-08

- Began by replaying the exact public v0.81 Position 9 at 360×780 beside the
  approved `rosie-v3/09-adventure-vignette.png` direction. The clearing already
  contained Rosie, her packed objects, an authored Glowroot response, and
  deterministic causes, but an 87 px Discovery card and 108 px three-row Bag
  ledger occupied the first 195 px below the HUD. The outing read as a report
  before it read as a place.
- Compared three structural treatments on the existing route: retain the full
  cause ledger, use one changing field note, or attach a small story bubble to
  Rosie. The field note won. It removed the ledger without suggesting that
  Rosie was speaking or covering her face, and left the path and physical Bag
  props readable throughout the cause sequence.
- Captured all three throwaway treatments at commit `300fb9e` on
  `codex/homegrown-v082-adventure-story-prototypes`. Main retains only the
  single field note and no prototype switcher.
- Provision, Tool, Pack, and the resolved find each occupy the same 310×92
  note for one existing 900 ms beat. The exact item name and deterministic
  `journeyTags` cause remain unchanged; the active physical props and Rive
  environment keep their existing response.
- The changing note remounts for one 220 ms state reveal and uses a polite live
  region. Reload during the vignette restarts the explanation at Provision.
  Reduced motion exposes the resolved note immediately with no entrance
  animation. The player can still continue without waiting for ceremony.
- This checkpoint changes presentation hierarchy only. It adds no dialogue,
  Bag slot, item, location, discovery, outcome, timer, reward, reducer state,
  persisted field, Rive asset, or Rive input.

### Validation evidence

- At 360×780 the first field note measured 310×92 at y=80; the 286×56 **Let
  Rosie explore** action remained at y=632. Client and scroll widths remained
  equal, and neither legacy explanatory panel existed.
- Normal motion announced, in order: Clover Lunch keeping Rosie out until
  dusk; Hand Trowel opening the roots; Wicker Basket waiting for the find; and
  warm light stirring beneath the hedge. A Lantern alternative instead said
  it made the fading glow easier to follow.
- Leaving Pack empty rendered a kind Near-Discovery sequence and explicitly
  said **No Pack · records the place so Rosie can return**. No unearned find or
  reward appeared.
- Replayed a complete remembered second day through Position 9. **Lights Past
  the Open Gate** used the same field-note hierarchy and resolved to **Reflected
  leaves lead Rosie onward** without overflow.
- Reduced motion reported `resolved` within 80 ms with no CSS animation. Reload
  restarted an unfinished second outing at Provision. A rapid double **Let
  Rosie explore** produced one journey watch, one Fast-forward action, and no
  premature Return panel.
- At 390×844 the note remained 310×96 above the 286×56 action with equal 390 px
  client/scroll widths. At 1280×720 the complete 328×709 game remained centered
  and both note and action stayed inside the first viewport.
- `npm run prototype:homegrown:test` passes 52/52 and `npx tsc --noEmit`
  passes locally. `npm run verify:rive-homegrown` passes both authored Rive
  contracts. `npm run quality:check` passes its quality contracts, 157-file
  layout inspection, 324-sprite integrity gate, security contracts,
  TypeScript, 78 layout tests, and 202 security tests; Watchman's existing
  recrawl notice is the only warning.
- Feature commit `5842b8d` deployed successfully through GitHub Pages run
  `31261142037`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `c3f67fb1e624f111246a36cab9e5322713fdb5956bd343f52dba7cac8365c059`,
  `e7ac7b8fdd7ed53002356b52fee9e1b35faf0d4a6ea600c6ae316f9aa8d7b068`, and
  `8dc157014c57d2c82d056e7657337da75aef717c382546bd07fe069db2d986f6`.
- Replayed the exact public Position 9 URL at 360×780. One uninterrupted
  capture reported the four expected notes in order: Clover Lunch at
  Provision, Hand Trowel at Tool, Wicker Basket at Pack, and **Warm light
  stirs beneath the hedge** at resolved. Neither legacy panel existed and
  client/scroll widths remained equal.
- A rapid public double **Let Rosie explore** produced one journey watch, one
  **Fast-forward to Homecoming** action, and no premature Return panel.
- The deployed companion page links directly to Position 9 as **Watch Rosie's
  Bag shape the Adventure**.

### Next highest-leverage weakness

The expedition now reads as an illustrated place with one cause at a time, but
the first outing's Hand Trowel remains painted and motionless while the field
note says it opens the roots. The next cycle should compare one bounded,
technically achievable Tool-action response—preferably using the existing
separable trowel asset and Rive/DOM motion—before adding another destination,
item, reward, or explanatory panel.

### v0.81 — Memory in Its Place — 2026-08-08

- Began by replaying the exact public v0.80 settled Position 11 at 360×780.
  The quiet Glowroot flourish succeeded, but its resolution restored a 336×74
  teaching panel at the top and a 336×58 stock ledger near the bottom around
  the 210×130 Moonberry action. The player could read every fact, but the Farm
  immediately became interface again.
- Compared three structural treatments on the existing route: keep the full
  teaching stack, use one permanently visible inventory shelf, or retain one
  compact **The Farm remembers** pocket with details on demand. The pocket won
  because it leaves Rosie, all beds, and the current action readable without
  discarding the permanence promise or exact stock.
- Captured all three throwaway treatments at commit `9c29852` on
  `codex/homegrown-v081-home-memory-prototypes`. Main retains only the compact
  pocket and no prototype switcher.
- The collapsed pocket shows the four exact counts in shorthand. **See stock**
  opens one inline drawer containing **Crops grow · Stock stays · Discoveries
  stay** and the full Clover Seed, Glowroot Seed, Compost, and Willow Fiber
  names and quantities.
- While the drawer is open, the overlapping Moonberry action and Rosie hit
  target are unavailable. Closing it restores the same action; any gameplay or
  review jump also closes it. The drawer never changes reducer state, stock,
  persistence, progression, or a Rive input.
- Reload returns the repeat state collapsed. Reduced motion makes the drawer
  reveal immediate while retaining the complete result.

### Validation evidence

- The normal-motion Plant Glowroot handoff still held memory and Moonberries
  for the approved first 900 ms. Once settled, the 360×780 view showed one
  332×47 secondary pocket instead of two large persistent panels, with no
  horizontal overflow.
- Opening the pocket exposed exact stock of Clover Seed 2, Glowroot Seed 1,
  Compost 2, and Willow Fiber 2, removed the Moonberry action, and retained the
  named permanence promise. Closing it restored **Grow Moonberries** without a
  crop, stock, objective, or position change.
- Three rapid open/close cycles ended collapsed with the same Moonberry action
  and quantities. Reload also returned collapsed.
- The 390×844 player kept a 362×47 pocket above its 306×58 terminal action with
  equal 390 px client and scroll widths. At 1280×720 the complete 328×709 game
  remained centered with the pocket and action inside the first viewport.
- A full continuation through Moonberries, Rosie's shared tickle, **Begin
  another day**, the next Morning Tickle, and the remembered Clover choice kept
  Glowroot, dusk moths, frog, Hedge Bell, open path, and stock coherent.
- `npm run prototype:homegrown:test` passes 51/51; `npx tsc --noEmit` and
  `npm run verify:rive-homegrown` pass locally. `npm run quality:check` also
  passes its quality contracts, 157-file layout inspection, 324-sprite
  integrity gate, security contracts, TypeScript, 78 layout tests, and 202
  security tests; Watchman's existing recrawl notice is the only warning.
- Feature commit `ea7aa12` deployed successfully through GitHub Pages run
  `31260256885`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `3ab8338f6308667fadbac794302fede4714c9ad17a732e3be54cd800ba2bc11a`,
  `1db436936bc42f2afa6c5d8ef09e7296b9978929b8676b94c06cb7c8789856c9`, and
  `27d06ba219b79e14a1f95847b3294cc4fe05372e694fac8d997e9ef23c3e7a43`.
- Replayed the exact public Position 10 → 11 handoff at 360×780. At 80 ms the
  phone was busy, and neither the memory pocket nor Moonberry action existed.
  After the hold, the phone was settled, the collapsed pocket and **Grow
  Moonberries** were both present, and client/scroll widths remained 360 px.
- On that public build, **See stock** exposed **Crops grow · Stock stays ·
  Discoveries stay** plus Clover Seed 2, Glowroot Seed 1, Compost 2, and Willow
  Fiber 2 while removing the conflicting world and Rosie targets. Reload
  returned the pocket collapsed and restored the Moonberry action.
- The deployed companion page now links to Position 10 as **Plant Glowroot,
  then open the Farm memory pocket**.

### Next highest-leverage weakness

The persistent Farm hierarchy is now quiet enough to replay the Adventure
itself as the primary experience. The next cycle should compare the existing
Position 9 journey against the approved naturalist-expedition promise and pick
one bounded weakness in its curiosity, environmental storytelling, or visible
Bag causality. It must deepen the existing Glowroot outing before adding a new
destination, crop, reward class, or parallel system.

### v0.80 — Glowroot First — 2026-08-08

- Began by replaying the exact public v0.79 Position 10 → 11 handoff at
  360×780. Within 80 ms of **Plant Glowroot**, the correct `sprout` and authored
  `flourish` were already active, but **The Barn remembers**, four-column Farm
  stock, **Grow Moonberries**, and the new objective all appeared on top of the
  same frame.
- Compared three treatments on the existing `?variant=A|B|C` route: keep the
  immediate full handoff, replace it with a Bed-3 confirmation, or let the
  changing Farm own the beat with only the compact HUD. The world-first
  treatment won: the Bed label still covered the earned crop, while the quiet
  treatment made the sprout, open hedge, Hedge Bell, frog, and Rosie readable
  as one consequence.
- Captured all three throwaway treatments at commit `669b214` on
  `codex/homegrown-v080-glowroot-quiet-beat-prototypes`. Main retains only a
  900 ms local presentation hold aligned to the existing 780 ms Rive Home
  flourish.
- **Plant Glowroot** still commits the reducer result and spends exactly one
  Seed immediately. During the hold the accessible HUD reads **Glowroot takes
  root · The Farm remembers** and the phone reports busy; the memory panel,
  stock ledger, next action, and review jumps return after the flourish. No
  gameplay timer or persisted state was introduced.
- Reload during the hold resumes the stable developed Farm rather than
  replaying a ceremony. Reduced motion paints that same complete state
  immediately. Rapid duplicate taps still spend one Seed and leave the
  Moonberry purpose intact.

### Validation evidence

- At 80 ms after planting, the rendered 360×780 player had no memory panel or
  Moonberry action; Rive reported `homeMotion=flourish` and `bedThree=sprout`,
  while the compact HUD carried the only explanation.
- After 900 ms, Rive reported `homeMotion=developed`; **The Barn remembers**,
  Farm stock, and **Grow Moonberries** returned with one Glowroot Seed stored.
- Reloaded 100 ms into the reveal. The restored screen was not busy, did not
  replay the flourish, retained Bed 3 as `sprout`, and exposed the exact next
  purpose. Two rapid taps produced the same single Seed spend.
- With reduced motion enabled, the same plant action exposed the complete
  memory and Moonberry state within 80 ms and Rive reported `homeMotion=reduced`.
- `npm run prototype:homegrown:test` passes 50/50; `npx tsc --noEmit`,
  `npm run verify:rive-homegrown`, and `npm run quality:check` pass. The only
  warning is Watchman's existing recrawl notice.
- Feature commit `416611f` deployed successfully through GitHub Pages run
  `31259432768`. The served HTML, JavaScript, and CSS match the committed
  artifacts byte-for-byte at SHA-256
  `a86389aca912659b75f818cf4bc7fd30d88b2b24d2793b82dba719f19c722798`,
  `aaf8a45b1013a5b2e153a37ca5160dd3e979b680979720bb8b1cd86e791e62ba`, and
  `16fed740dc23cd5865c595b34c3e5edb80dbcdcb33b220d07d2ed80614cd6968`.
- Replayed the exact public feature URL at 360×780. At 80 ms after planting,
  the served build reported `aria-busy`, `homeMotion=flourish`, and
  `bedThree=sprout`; only **Glowroot takes root · The Farm remembers** remained
  above the scene, with no memory panel, Moonberry action, or horizontal
  overflow.
- After the public hold settled, Rive reported `homeMotion=developed`; the
  retained memory, **Grow Moonberries**, and exact Farm stock returned with one
  Glowroot Seed. Public reload held that stable state without replaying the
  flourish and kept equal 360px client/scroll widths.
- The deployed companion page links directly to Position 10 as **Bring
  Glowroot Home and watch the Farm remember**.

### Next highest-leverage weakness

The quiet beat now lets the new world consequence register, but the large
instructional **The Barn remembers** panel and four-column stock ledger still
return together and cover the Farm afterward. The next cycle should preserve
their exact facts while reducing the persistent post-ceremony teaching UI—one
first-time memory acknowledgement, then a quieter repeat-state treatment—before
adding another crop, route, resident, or reward system.

### v0.79 — Seed to Soil — 2026-08-08

- Began with the exact public v0.78 Position 10 action. Within 150 ms of **Take
  Seed to Bed 3**, the full lantern-lit workshop was already replaced by the
  outdoor Farm. Both screens were truthful, but nothing visibly travelled
  between them.
- Compared three treatments on the existing `?variant=A|B|C` route: retain the
  direct cut, lift the Seed only into Rosie's hands, or keep one glowing Seed
  continuous across the workshop-to-garden change and land it over Bed 3. The
  continuous garden bridge won because it supplies both a clear origin and a
  clear destination without another card, sentence, or long ceremony.
- Captured all three throwaway treatments at commit `65c34f3` on
  `codex/homegrown-v079-seed-handoff-prototypes`. Main retains only the winner:
  420 ms from the table to Rosie and 460 ms from Rosie to Bed 3.
- The transition is presentation-only. React still acknowledges the return at
  the exact midpoint, owns Position 10 → 11, and spends no Seed until the
  player presses **Plant Glowroot**. The existing Rive Plant motion and reducer
  remain authoritative after that second action.
- A Trowel return carries the earned spare Seed and leaves the base Seed on the
  table, matching the later `2 → 1` stock change. A successful Lantern loadout
  carries the single base Seed and briefly reveals its leaf-shaped table
  imprint instead of fabricating a second object.
- Near-Discovery and later **Keep supplies in Farm stock** returns bypass the
  planting handoff. Reduced motion performs the same state change atomically.
  The return action, review rail, and planting action remain locked only while
  the 880 ms bridge is active.

### Validation evidence

- Rendered the current public cut, all three slowed comparison treatments, and
  the final-speed winner. The final 360×780 departure visibly lifted the exact
  glowing Seed from the table toward Rosie; the garden phase kept that same
  token above Bed 3 while the planting action remained disabled.
- Replayed the alternative Lantern loadout through Position 10. It returned
  **Glowroot Seed +1** and **Willow Fiber +3**, used the base-Seed origin, and
  entered Position 11 with the correct `1 → 0` planting preview.
- Replayed an empty-Tool Near-Discovery. **Adjust Rosie's Bag** returned
  directly to Position 7 with no handoff token or busy state.
- Reduced motion entered Position 11 immediately with no transient token,
  exact 360px client/scroll widths, and the correct `Glowroot Seed 2 → 1`
  preview. Reload retained Position 11; planting then produced the authored
  `sprout` Bed 3 state and advanced the purpose to Moonberries.
- `npm run prototype:homegrown:test` passes 49/49; `npx tsc --noEmit`,
  `npm run verify:rive-homegrown`, `npm run quality:loop`, and
  `npm run quality:check` pass. The only warning is Watchman's existing recrawl
  notice.
- Feature commit `9f03b73` deployed successfully through GitHub Pages run
  `31258659431`. The served HTML, CSS, and JavaScript match the committed
  artifacts byte-for-byte at SHA-256 `5978790276df74788e39b3aefa38947ec5e1caa0f1524f8d88ff592a0bffbebe`,
  `16fed740dc23cd5865c595b34c3e5edb80dbcdcb33b220d07d2ed80614cd6968`, and
  `a43ff1224379b181ca5ceddbd032abe74ac96731fe397d51ff94f1ce33a000c0`.
- Replayed the exact public feature URL at 360×780. The captured mid-flight
  frame remained on Position 10 with `origin-bonus is-departing`, `aria-busy`,
  a disabled return action, and equal 360px body client/scroll widths. It then
  settled on Position 11 with **Bed 3 is ready for Glowroot** and **Glowroot
  Seed 2 → 1**.
- Public reload retained the settled Position 11 with no transient handoff.
  **Plant Glowroot** then changed the authored Bed 3 state to `sprout`, left one
  Glowroot Seed in Farm stock, and advanced the objective to Moonberries.
- The deployed companion page links directly to Position 10 as **Carry Rosie's
  Seed all the way to Bed 3**.

### Next highest-leverage weakness

The Seed now reaches and changes Bed 3, but the completed planting immediately
competes with **The Barn remembers**, the full Farm-stock strip, and the next
Moonberry objective. The next cycle should let the new Glowroot sprout own one
quiet first beat before the retained memory and next purpose return—without a
modal, another reward ceremony, or a new progression state.

### v0.78 — Tool Bonus, Explained — 2026-08-08

- Began with the exact public v0.77 first-return screen. The plaque and stock
  receipt correctly showed **Glowroot Seed +2**, but a tiny floating **+1** sat
  above the physical Seed with no visible connection to the Hand Trowel. The
  math was correct; its cause was not readable.
- Compared three treatments on the existing Position 10 `?variant=A|B|C`
  prototype: keep the marker alone, rename it **Trowel +1** on the table, or
  move the arithmetic into the stock receipt. The receipt treatment won because
  it places cause beside the exact total and removes an isolated badge from the
  artwork.
- Folded only the winner into the shared screen and removed the temporary
  variant rules. A Hand Trowel return now reads **Find +1 · Trowel +1** below
  **Glowroot Seed +2**. A Lantern return uses the same grammar—**Find +2 ·
  Lantern +1** below **Willow Fiber +3**—instead of leaving the same orphan
  marker on a different material.
- Near-Discovery returns render neither breakdown because no Tool bonus was
  earned. Wicker Basket and Cloth Wrap rewards keep their established receipt
  rows and physical props.
- The installed Impeccable product-design pass selected the receipt treatment:
  it clarifies cause without restoring three cause cards, adding a tutorial, or
  layering another motion cue over Rosie's Homecoming.
- No Bag rule, route, reward amount, inventory transition, Rive asset, motion,
  timer, persistence key, currency, or progression fact changed.

### Validation evidence

- `npm run prototype:homegrown:test` — 49/49 pass, including exact Trowel and
  Lantern reward quantities, complete and incomplete Bags, persistence, and
  both Adventure opportunities.
- `npx tsc --noEmit`, `npm run verify:rive-homegrown`,
  `npm run quality:loop`, and `npm run quality:check` pass. The quality gates
  cover 157 layout files, 324 sprites, 78 layout assertions, and 202 security
  assertions; Watchman's existing recrawl notice is the only warning.
- Rendered all three temporary treatments on Position 10, selected the receipt
  breakdown, removed the losing code, rebuilt, and replayed the final Variant A
  screen at desktop and 360×780.
- The first-route mobile render has one **Find +1 · Trowel +1** explanation,
  no generated marker, a 12px action-to-rail gap, exact 360px body width, and no
  horizontal overflow.
- A developed second-route return with Lantern rendered **Willow Fiber +3** and
  **Find +2 · Lantern +1**. An empty-Tool return rendered the useful Glowroot
  Trail clue with no bonus explanation.
- Direct reload retained the receipt breakdown. Reduced motion held the stable
  authored Rosie pose, kept the same 360×780 hierarchy, and produced no console
  warnings or errors.
- Feature commit `926c9eb` deployed successfully through GitHub Pages run
  `31257675627`. The served HTML, CSS, and JavaScript match the committed
  artifacts byte-for-byte at SHA-256 `a0e6283382d4934bf98d5d1c585cb91ca83ed8a42a93ce3d9c87cec1ce7b6ed4`,
  `f075fdcae5cd9fc849c4fd4fe0856609a87a12917d2df0ba2bdac37e099083f9`, and
  `5a10cfe280704654a2aab913fdde65f24d8ace155579621df010a2ce0c8416d0`.
- Replayed the exact public feature URL at 360×780. The rendered return showed
  **Glowroot Seed +2** with **Find +1 · Trowel +1**, no generated bonus marker,
  a 12px action-to-rail gap, and equal 360px body client/scroll widths. Reload
  retained the same receipt. **Take Seed to Bed 3** then entered Position 11
  with **Bed 3 is ready for Glowroot** and **Glowroot Seed 2 → 1**.
- The deployed companion page links directly to Position 10 as **See how
  Rosie's Tool shaped the reward**.

### Next highest-leverage weakness

The receipt now explains why two Seeds came Home, but **Take Seed to Bed 3**
still cuts instantly from the Barn worktable to the outdoor bed. The next cycle
should make that one physical handoff continuous—Rosie or the Seed visibly
leaves the table and arrives at Bed 3—without turning the acknowledgement into
another long cutscene or moving planting authority into Rive.

### v0.77 — Discovery to Garden — 2026-08-08

- Began with the exact public v0.76 Homecoming and reward handoff. Position 9
  already asked the player to **Welcome Rosie home** in the yard; Position 10
  then repeated **Welcome Rosie Home** beneath a receipt that already showed
  Rosie, the named Discovery, and the supplies added to Farm stock. The second
  action had no distinct meaning.
- Kept the first welcome at the gate as the sole emotional Homecoming action.
  The first complete reward now leads with **Glowroot can change the Farm** and
  offers **Take Seed to Bed 3**. That action moves to the established outdoor
  Bed 3 planting decision; it does not plant automatically or change reward
  timing.
- Preserved the other return meanings. A known Discovery still offers **Keep
  supplies in Farm stock**, and an incomplete Bag still offers **Adjust Rosie’s
  Bag**. Neither branch falsely points at Bed 3.
- The installed Impeccable product-design pass rejected adding another card,
  tutorial prompt, or transition animation. The existing plaque and stock
  ledger already explain what came Home; one short objective and one concrete
  action are enough to connect the Discovery to visible Farm change.
- No route, reward amount, inventory transition, planting rule, Rive asset,
  animation, timer, currency, persistence key, or progression fact changed.

### Validation evidence

- `npm run prototype:homegrown:test` — 49/49 pass, including the new exact
  first-return presentation contract and the unchanged repeat and clue routes.
- `npx tsc --noEmit`, `npm run verify:rive-homegrown`,
  `npm run quality:loop`, and `npm run quality:check` pass. The quality gates
  cover 157 layout files, 324 sprites, 78 layout assertions, and 202 security
  assertions; Watchman's existing recrawl notice is the only warning.
- Rendered the first complete return at desktop and 360×780. The HUD reads
  **Glowroot can change the Farm**, the single action reads **Take Seed to Bed
  3**, the action-to-rail gap is 12px, and body width remains exactly 360px with
  no horizontal overflow.
- Clicking the new action reaches Position 11 exactly once with **Bed 3 is ready
  for Glowroot**, the exact **Glowroot Seed 2 → 1** preview, and the separate
  **Plant Glowroot** decision.
- Replayed a second-route return with remembered Home and confirmed
  **Lanternleaf Path is mapped** still uses **Keep supplies in Farm stock**.
  Replayed an empty-Tool return and confirmed the useful **Glowroot Trail** clue
  still uses **Adjust Rosie’s Bag**.
- Direct reload retained the new first-return objective and action. Reduced
  motion reported the stable authored Rive pose, kept the same hierarchy at
  360×780, and produced no console warnings or errors.
- GitHub Pages run
  [`31257013908`](https://github.com/bbroeking/oink/actions/runs/31257013908)
  checked out exact feature commit `c323c05` and deployed the resulting player.
  GitHub's dynamic deployment metadata retained the preceding revision label,
  so source proof uses the run's checkout log plus the served artifact rather
  than that lagging label.
- The exact public player served CSS `f29ae4d7f4` and JavaScript `1ff539fcfc`.
  Its 360×780 render exposed one **Take Seed to Bed 3** action, retained the
  12px action-to-rail gap and exact 360px body width, and logged no warning or
  error.
- Public reload retained Position 10, **Glowroot can change the Farm**, and the
  new action. Activating it reached Position 11 with **Bed 3 is ready for
  Glowroot**, **Glowroot Seed 2 → 1**, and the separate **Plant Glowroot**
  action. The companion site published **Carry Rosie's Discovery to the
  garden**.

### Next highest-leverage weakness

The first reward table shows a small **+1** marker above the physical Glowroot
while the plaque and stock ledger correctly total **Glowroot Seed +2**. The
marker represents the Hand Trowel bonus, but that cause is no longer legible on
the focused Homecoming screen. The next cycle should make that physical bonus
read as a Trowel-earned extra Seed—or remove the orphan marker—without restoring
the redundant three-cause ledger.

### v0.76 — Rosie Is Home — 2026-08-08

- Began with a complete public v0.75 Adventure-to-Homecoming replay. After the
  journey watch reached **Homecoming**, the interface said **Rosie is waiting at
  the gate** over an empty Farm. Rosie then appeared abruptly inside the Barn
  with the reward. The emotional promise and the rendered scene contradicted
  one another at the exact moment the player was meant to welcome her.
- Reused the existing authored **Rosie Return** Rive timeline rather than
  creating another character, cutscene, or animation system. The reducer's
  established `adventureComplete` fact now reveals the persistent Rosie canvas,
  runs Return once, and keeps her packed satchel attached.
- Renamed the visible objective to **Rosie is Home** and corrected the scene's
  accessible description to say she has returned through the gate into the
  yard. **Welcome Rosie home** remains the one action, and the named Discovery
  still stays hidden until Position 10.
- Made the gate state reload-stable. A direct reload replays the same bounded
  Return entrance, then settles Rosie into the existing breathing pose instead
  of reverting to an empty yard.
- Preserved the developed Farm on the second route. Glowroot, Moonberries, the
  hedge opening, pond frog, moths, and the earned bell remain visible when Rosie
  comes back; this checkpoint does not reset Home to make the arrival simpler.
- Reduced motion skips the entrance while keeping Rosie, her satchel, the Farm,
  journey labels, and action visible in one stable frame.
- No reducer transition, route, reward, duration, equipment rule, Rive asset,
  currency, or progression fact changed. React still owns Homecoming; Rive owns
  only Rosie's bounded arrival and settled pose.

### Validation evidence

- `npm run prototype:homegrown:test` — 49/49 pass, including both routes,
  incomplete Bags, fast-forward, persistence, and exact reward settlement.
- `npm run verify:rive-homegrown` — the 390×844 Homegrown contract with 60
  authored names and the Lanternleaf reflection contract both pass.
- `npm run quality:loop` and `npm run quality:check` — quality contracts, the
  157-file layout scan, 324 sprite checks, security contracts, TypeScript, and
  280 focused Jest assertions pass. Watchman's existing recrawl notice is the
  only warning.
- Rendered first-route fast-forward reported Rive motion `return`, last
  performed motion `return`, the satchel equipped, and the corrected scene
  description before settling to idle with Rosie still visible.
- Direct gate reload replayed Return and retained Rosie. The next action moved
  to Position 10 with the same Rosie and exact **Glowroot Seed +2** reward.
- Rendered second-route Homecoming kept the developed Farm and reported the
  frog visible while Rosie returned. Normal and reduced motion both remained
  legible at 360×780 with no horizontal overflow or console errors.
- Public GitHub Pages run
  [`31256394499`](https://github.com/bbroeking/oink/actions/runs/31256394499)
  deployed feature commit `a2c9e31` successfully. The exact public player
  referenced CSS `f29ae4d7f4` and JavaScript `8652f9baf5`.
- Replayed that public bundle from the Position 9 vignette through the idle
  journey and fast-forward. At the gate, the live scene reported Return as
  both current and last performed Rive motion, kept the satchel equipped, and
  exposed the corrected **Rosie is Home** objective and scene description.
- After settling, Rosie remained visible in her breathing pose. A direct
  public reload replayed Return without losing the satchel or Homecoming state.
  **Welcome Rosie home** then advanced to Position 10 and revealed the exact
  **Glowroot Seed +2**, Compost +1, and Willow Fiber +2 reward for the first
  time. The companion site also published **Follow Rosie's journey Home**.

### Next highest-leverage weakness

The player now welcomes Rosie once at the yard, but Position 10 immediately
asks them to **Welcome Rosie Home** again to acknowledge the reward. The next
cycle should make that second action about receiving the Discovery and Farm
stock—not repeat the Homecoming ritual—and should preserve the single emotional
welcome established here.

### v0.75 — The Bag Tells the Story — 2026-08-07

- Began with a complete public v0.74 play-through. Position 9 had the correct
  route, Bag items, physical props, and deterministic result, but presented all
  three causes at once. The player could read the answer; they did not see the
  preparation become a story.
- Compared the gap with the approved
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/09-adventure-vignette.png`
  concept. Its useful promise was one fixed illustrated scene where Rosie and
  her physical equipment do the explaining—not another card, reward preview,
  mission layer, or stat screen.
- Sequenced the existing causes as **Provision**, **Tool**, and **Pack**. One
  compact row and its registered physical prop receive focus at a time; prior
  causes remain visible and future causes stay quiet.
- Held both route-specific Rive cues until the Tool beat. Glowroot now reveals
  only when the Hand Trowel gets its moment, and Lanternleaf reflections rise
  only when the chosen Tool begins investigating the path. React still owns
  the route, cause order, timing, Bag facts, and outcome.
- Kept the action available throughout. The player may continue immediately;
  the sequence is explanatory presentation, never a new gate or timer.
- Reduced motion resolves directly to the complete readable ledger and static
  route state. An empty slot keeps its explicit **No Provision**, **No Tool**,
  or **No Pack** cause and still resolves to the existing useful Near-Discovery.
- The Prototype verdict is positive: the same deterministic Adventure now
  reads as “I packed this, so Rosie could do that” without expanding scope.

### Validation evidence

- `npm run prototype:homegrown:test` — 49/49 pass across both routes, all empty
  Bag slots, persistence, fast-forward, and exact Homecoming rewards.
- `npm run verify:rive-homegrown` — both authored Rive static contracts pass.
- `npm run quality:loop` and `npm run quality:check` — quality contracts, the
  157-file layout scan, 324 sprite checks, security contracts, TypeScript, and
  280 focused Jest assertions pass. Watchman's existing recrawl notice is the
  only warning.
- Rendered second-route play showed **Clover Lunch** first, **Hand Trowel**
  second with the Lanternleaf reflections beginning at that beat, and **Wicker
  Basket** third with its physical prop emphasized.
- Rendered first-route play reported the authored Glowroot layer `waiting`
  during Provision and `resting` after the Tool-triggered reveal. The incomplete
  Bag route stayed a `near-discovery`, named **No Pack**, and mounted no false
  Glowroot reward layer.
- At 360×780 the player-facing frame had no horizontal overflow and kept the
  complete Bag ledger, Rosie, physical props, **Let Rosie explore**, and the
  fast-forward rail visible. Reduced motion resolved all three causes at once.
- GitHub Pages run `31255647663` deployed commit `acf51a0`. Fresh public HTML
  loaded CSS `f6cfb4d552` and JavaScript `aea0044ffa`; the companion site linked
  **See Rosie's Bag shape the journey**.
- Public first-route replay reported **Clover Lunch** / `waiting` at Provision,
  **Hand Trowel** / `reveal` at Tool, **Wicker Basket** / `resting` at Pack, and
  retained the complete 360×780 player frame with the action visible.

### Next highest-leverage weakness

The causal vignette now makes preparation legible, but it still speaks in
summary sentences above a largely posed Rosie. The next cycle should begin by
playing the complete public loop and judge whether Rosie's own reaction during
the Tool beat—or the Homecoming immediately after the journey watch—is the
larger emotional gap. It should deepen only the winner, not add a third route,
resource, or parallel interaction.

### v0.74 — The Journey Is Worth Watching — 2026-08-07

- Began with a complete public v0.73 play-through. After **Let Rosie explore**,
  the twilight expedition disappeared into a nearly empty daytime Farm with a
  spinner and **Preview her return**. The state was mechanically correct but
  no longer communicated progress, anticipation, or the pleasure of waiting
  for Rosie to come Home.
- Compared that gap with the approved adventure-departure concept. The fixed
  camera, hedge path, warm dusk light, and one clear action were the useful
  visual promises; another modal, mission board, or reward preview was not.
- Added one Position 9 journey-watch surface over the established Farm. It
  shows three concise beats—**Set off**, **Warm moth trail** or **Reflected
  leaves**, and **Homecoming**—with only the current location emphasized.
- Replaced **Preview her return** and the hidden wait action with the explicit
  prototype control **Fast-forward to Homecoming**. The following state rings
  the gate bell and offers **Welcome Rosie home** before any Bag reward is
  shown.
- The exact Discovery, Near-Discovery, material quantities, and cause ledger
  still belong to Position 10. The new copy explicitly keeps the Find a
  surprise and never names Glowroot, Lanternleaf Path, a clue, or stock.
- One restrained trail-light cadence and current-step pulse make the waiting
  state feel alive; the existing reduced-motion policy shortens both to a
  static readable frame. React still owns every timer, route, reward, and
  persisted fact.
- The Prototype and Impeccable verdict is positive: the idle beat now explains
  where Rosie is, what remains unknown, and how to inspect the next prototype
  position without adding a parallel Adventure system.

### Validation evidence

- `npm run prototype:homegrown:test` — 49/49 pass, including both routes,
  deterministic Bag outcomes, the new fast-forward label, and reward ordering.
- `npm run quality:loop` — quality contracts, the 157-file layout scan, 324
  sprite checks, security contracts, TypeScript, and 280 focused Jest
  assertions pass. Watchman's existing recrawl notice is the only warning.
- Rendered first-route, incomplete-Bag play kept the three-beat watch and then
  returned the Glowroot Trail clue without naming it during the wait.
- Rendered second-route, complete-Bag play used **Reflected leaves** as the
  active beat and preserved the remembered pond while withholding Lanternleaf
  Path until Homecoming.
- At 360×780, the HUD, field note, route, Farm, one action, and progression rail
  remained visible with no horizontal overflow. Reduced motion reported
  `0.00001s` for the active-step and trail-light animations while preserving
  every label and action.
- GitHub Pages run `31234194198` deployed commit `ec3d950`. Fresh public HTML
  returned CSS `45a02b3dfa` and JavaScript `0ad0eef441`; the companion site
  linked **Watch Rosie's journey**.
- Public 360×780 play showed **Rosie is away**, the active **Warm moth trail**,
  and **Fast-forward to Homecoming** over the remembered Farm. Fast-forward
  changed the same route to **The gate bell rings** and **Welcome Rosie home**;
  only that welcome advanced to Position 10 and revealed **Glowroot Seed +2**
  with exact +1 Compost and +2 Willow Fiber stock.

### Observable acceptance criteria

- After **Let Rosie explore**, the player can identify Rosie's current journey
  beat and the upcoming Homecoming without seeing the reward.
- The prototype control is named **Fast-forward to Homecoming**, not framed as
  an in-world reward preview.
- Fast-forward produces a separate gate-ready welcome state before Position 10.
- First/second routes and complete/incomplete Bags keep their existing exact
  reducer outcomes.
- The waiting state remains legible at 360×780 and under reduced motion.

### v0.73 — The Journey Comes Before the Find — 2026-08-07

- Began with a complete public v0.72 play-through. Position 9 immediately said
  **A new Discovery!** and **Rosie found the Lanternleaf Path**, then the next
  action returned Rosie to **following reflected leaves** before Position 10
  revealed Lanternleaf Path again. The information was correct, but the story
  order removed anticipation and made Homecoming repetitive.
- Split the existing deterministic story presentation into two views of the
  same reducer facts. Position 9 now owns route-specific `journeyObjective`,
  `journeyHeadline`, `journeyResult`, and present-tense `journeyTags`.
  Position 10 continues using the established reward headline, clue, exact
  materials, and named Field Guide result.
- The first route now opens with **Warm light stirs beneath the hedge**; the
  second opens with **Reflected leaves lead Rosie onward**. Their ledgers say
  what the selected items make possible without mentioning a Seed, Compost,
  Willow Fiber, Glowroot, Lanternleaf Path, or clue before Rosie returns.
- Replaced **Continue the story** with **Let Rosie explore**. That action hands
  the causal vignette into the existing idle wait and **Preview her return**;
  Homecoming is now the first place the named Discovery appears.
- Empty Bag slots remain kind and specific. The journey explains what became
  difficult and how Rosie records the place, while the exact Near-Discovery and
  useful materials remain deferred to Return.
- The Prototype and Impeccable verdict is positive: Adventure mode now has a
  readable preparation → environmental response → anticipation → Homecoming
  order without another screen, timer, route, reward, or state machine.

### Validation evidence

- `npm run prototype:homegrown:test` — 49/49 pass. The vignette contract now
  asserts that journey copy names all three selected items while containing no
  reward materials or “found” claim; the original reward contract remains
  intact.
- `npm run verify:rive-homegrown` — both 390×844 Rive assets and all authored
  runtime names pass unchanged.
- `npm run quality:check` — quality contracts, the 157-file layout scan, 324
  sprite checks, security contracts, TypeScript, and 280 focused Jest
  assertions pass. Watchman's existing recrawl notice is the only warning.
- Rendered second-route Position 9 showed **The reflected leaves answer Rosie**,
  **Reflected leaves lead Rosie onward**, present-tense Bag consequences, and
  **Let Rosie explore** over the open-gate plate and live Rive cue. The next
  state read **Rosie is following reflected leaves**; Position 10 alone then
  mapped **Lanternleaf Path** and returned the exact +1 Compost, +2 Glowroot
  Seed, and +2 Willow Fiber default loadout.
- The first route mounted zero Lanternleaf canvases, retained the live Glowroot,
  and used **Warm light stirs beneath the hedge** without pre-naming its Seed.
  An empty-Pack route used the same journey order and named no clue before
  Return.
- At 360×780, the journey headline, three-row cause ledger, Rosie, selected
  equipment, one action, and progression rail remained visible without page
  overflow. Reduced motion kept the exact journey hierarchy and static
  environmental clues.
- GitHub Pages run `31233517913` deployed commit `e1f1e30`. Fresh public HTML
  returned JavaScript `e819458bc9`; the companion site linked **See Rosie's
  journey unfold**. Public second-route Position 9 contained **Reflected leaves
  lead Rosie onward**, did not contain **Rosie found the Lanternleaf Path**,
  mounted the `ready` Lanternleaf Rive cue, and offered **Let Rosie explore**.
  The next public state read **Rosie is following reflected leaves**; only the
  subsequent Homecoming mapped **Lanternleaf Path** and exposed **Added to Farm
  stock**.

### Observable acceptance criteria

- Position 9 never names the earned Discovery, route, clue, or returned
  materials.
- Every selected or empty Bag slot still changes one readable journey line.
- **Let Rosie explore** precedes the idle wait and Homecoming.
- Position 10 remains the first and only named reward reveal.
- First/second routes, complete/incomplete Bags, fast-forward, reload, reduced
  motion, and exact reducer-owned outcomes remain unchanged.

### v0.72 — Lanternleaf Catches the Light — 2026-08-07

- Began by playing the shipped second-day Position 9 against its dedicated
  Lanternleaf plate. The open gate and reflected trail established a new place,
  but the brightest environmental clue was completely static while live Rosie
  breathed in front of it.
- Authored a separate paid-workspace Rive file named **Lanternleaf
  Reflections** at the exact 390×844 game registration. Seven native warm-gold
  ellipse shapes follow the existing painted trail; `Lanternleaf Reflection
  Pulse` raises their opacity over 15 frames and returns to the quiet endpoint
  at frame 32.
- Added a stable web boundary that mounts only for **Lights Past the Open
  Gate**. React starts the authored rise, holds its readable luminous frame for
  720ms, plays the authored fall, then rests for 2.35 seconds. Rive owns the
  reflected-light performance; React still owns route choice, cadence,
  progression, rewards, persistence, and accessible UI.
- Kept the canvas behind canonical Rosie and her fitted Bag, used a tight
  route-only crop plus screen blend so the editor artboard cannot flatten the
  woodland plate, and retained the static painted leaves underneath. Reduced
  motion hides the live layer rather than replacing the clue or outcome.
- Added a separate checked source export, runtime-name patch, contract, static
  verifier, content-hashed build copy, and runtime diagnostics. The main
  Homegrown artboard and first-route Glowroot animation remain unchanged.
- The Prototype and Impeccable verdict is positive: one small environmental
  motion makes the second route feel alive without adding a destination,
  reward, timer, equipment choice, or another character rig.

### Validation evidence

- `npm run prototype:homegrown:test` — 49/49 pass, including the deterministic
  second opportunity, complete and clue branches, return quantities, new-day
  state, reload, and all eleven review positions.
- `npm run verify:rive-homegrown` — the main 390×844 asset and all 60 authored
  names pass; the separate 390×844 Lanternleaf header, artboard name, and
  `Lanternleaf Reflection Pulse` name also pass.
- `npm run quality:check` — quality contracts, the 157-file layout scan, 324
  sprite-integrity checks, security contracts, TypeScript, and 280 focused Jest
  assertions pass. The only output warning is Watchman's existing recrawl
  notice.
- Real browser play completed the first adventure, Welcome Home, Plant
  Glowroot, Grow Moonberries, Tickle Rosie, Begin another day, and eight
  player-visible Next-position fast-forwards into the second Adventure. The
  Lanternleaf canvas reported `ready`, exposed the exact authored animation,
  and survived a direct Position 9 reload.
- The first Glowroot route mounted zero Lanternleaf canvases and retained its
  existing live Glowroot view. The second route mounted exactly one reflection
  canvas and kept the open gate, selected equipment, Bag causes, and named
  Discovery intact.
- At 360×780, the luminous hold remained registered to the painted trail,
  Rosie and the primary action stayed fully visible after the normal Rive load,
  and the page retained its full-width touch composition. With reduced motion,
  the component reported `reduced`, its live layer was hidden, and the static
  illustrated leaves still communicated the route.
- GitHub Pages run `31232910852` deployed main commit `968a4bd`, which contains
  v0.72 commit `2c16c0d`. Fresh public fetches returned CSS `bbccab7cef`,
  JavaScript `28b53f6492`, and the exact 665-byte Rive asset
  `039413337d`. A public first-return → changed-Home → new-day play-through and
  eight Next-position fast-forwards reached **Lanternleaf Path** with one
  `ready` canvas and `Lanternleaf Reflection Pulse` in its luminous hold. A
  public reduced-motion replay reported `reduced` while preserving the named
  route, static leaf clue, and complete interface. The companion site now links
  **Play the Rive-lit Adventure loop**.

### Observable acceptance criteria

- Only the second Lanternleaf route receives the live reflection cue.
- The motion follows the painted path and remains behind Rosie, the Bag, and
  all DOM-owned story and controls.
- The cue has a readable rise, hold, fall, and restful gap instead of constant
  pulsing.
- Reduced motion leaves the route clue and complete UI legible with no live
  environmental animation.
- The complete two-day loop, fast-forward rail, reload, first-route isolation,
  and exact reducer-owned outcomes remain intact.

### v0.71 — Lanternleaf Becomes a Place — 2026-08-07

- Began with a rendered comparison between the second-route Position 9, the
  first Glowroot clearing, and the approved `rosie-v3/09-adventure-vignette.png`
  concept. The concept's useful invariant was a framed, readable path with live
  Rosie and separable equipment. The current Lanternleaf branch changed every
  word and reward but could still use the first route's root alcove.
- Used the built-in ImageGen edit workflow with the existing character-free
  clue plate as the strict camera, lighting, texture, and palette reference.
  The resulting 780×1688 plate adds one weathered open gate and a trail of
  pale-green leaves reflecting soft Glowroot gold. It intentionally contains no
  character, gear, Discovery, interface, text, or baked animation.
- Bound that plate to **Lights Past the Open Gate**, independent of Tool or Pack.
  The selected Hand Trowel or Lantern is now a separate foreground prop; empty
  Tool renders none. Existing Provision and Pack props remain independent, so
  every complete and Near-Discovery loadout stays physically truthful.
- Removed the live Glowroot reveal from the Lanternleaf branch. The native Rive
  Glowroot still wakes in the first route, but a route Discovery no longer
  falsely presents another glowing Seed at the path.
- The render audit exposed a shared-artboard boundary bug: persistent
  Moonberries, Glowroot, frog, moths, flower arch, bell, and hedge crossing were
  traveling with Rive Rosie into the second expedition. While the Lanternleaf
  vignette is visible, React now derives a temporary presentation-only Rive
  model with empty beds and hidden Home/resident layers. Rosie, her authored
  breath, and her equipped satchel remain live. Reducer state, saved Home,
  rewards, and the `.riv` asset are unchanged.
- The Prototype verdict is positive: a route can feel distinct through one
  environmental plate and correct compositing, without a map, destination
  picker, route currency, second Rosie, or duplicated equipment sprites. The
  installed Impeccable review kept the open gate and reflected leaves behind
  the established one-action hierarchy rather than adding another label.

### Validation evidence

- `npm run prototype:homegrown:test` — 49/49 pass; route/reward state is
  unchanged and the two-day deterministic contract remains intact.
- `npm run verify:rive-homegrown` — the 390×844 header and all 60 authored Rive
  names pass. The checked-in `.riv` file was not changed.
- `npm run quality:check` — quality contracts, the 157-file layout scan, all
  324 sprite-integrity checks, security contracts, TypeScript, and 280 focused
  Jest tests pass.
- Real 390×844 renders compared the first Glowroot route with Lanternleaf using
  Lantern/Cloth, Trowel/Basket, empty Tool, and empty Pack. Lanternleaf always
  used the open-gate plate, selected equipment stayed truthful, no live
  Glowroot appeared, and Rive reported empty beds, hidden Home, hidden moths,
  and hidden frog with no console errors.
- At 360×780 with reduced motion, reload plus Position 7 → 9 fast-forward kept
  the Lanternleaf plate and hidden Home layers; Position 10 still returned only
  **Lanternleaf Trail**, +1 Compost, and +1 Willow Fiber for an empty Pack. Body
  width remained exactly 360px.
- GitHub Pages run `31230908768` deployed checkpoint `5f41566`. A fresh public
  fetch returned CSS `e85e60c9e1`, JavaScript `11da952fc1`, and HTTP 200 WebP
  `adventure-lanternleaf-path.webp` at 221,702 bytes. Public 390×844 comparison
  kept the first route on its Trowel clearing with one live Glowroot and moved
  the second route to the open-gate plate with one selected Tool and no
  Glowroot. The Lanternleaf Rive boundary reported all three beds `empty`, Home
  `false`, and frog `false`. Reduced-motion 360×780 produced the same boundary,
  exact body width, and no console errors. The companion site now links **Play
  both Adventure routes**.

### Observable acceptance criteria

- The first expedition remains the root alcove and uses the live Rive Glowroot
  only for its earned Glowroot Discovery.
- The second expedition visibly shows an open gate and reflected-leaf path for
  every Tool and Pack combination.
- Rosie and her satchel stay live while Farm beds, residents, moths, bell, and
  hedge arch remain at Home.
- Selected Tool and Pack remain physical; empty slots remove their props.
- Reload, fast-forward, reduced motion, and clue-only return preserve the same
  route identity and exact reducer-owned outcome.

### v0.70 — The Open Gate Leads Somewhere — 2026-08-07

- Began by playing through the remembered second morning. The Farm preserved
  Glowroot, Moonberries, stock, equipment, and the open crossing, but then
  repeated **A Glow Beneath the Hedge**. The lasting Home consequence changed
  scenery without changing what Rosie could explore.
- Made that consequence causal. A planted Glowroot after the first completed
  day now reveals **Lights Past the Open Gate** with the compact brief
  **nightfall · reflected leaves · gentle wrap**. The opportunity is derived
  from existing persistent Home facts rather than stored as a new mission or
  scheduled event.
- Carried the new purpose through Seed choice, planting, growth, Harvest, Bag
  preparation, departure, waiting, and Homecoming. The same freely chosen Bag
  now reads differently in context: Clover Lunch reaches nightfall, Lantern
  follows reflected leaves, and Cloth Wrap protects delicate leaves. Existing
  Hand Trowel and Wicker Basket alternatives remain useful and deterministic.
- A complete Bag maps **Lanternleaf Path** and adds that route to the Field
  Guide. An incomplete Bag adds only **Lanternleaf Trail (clue)** plus Compost
  and Willow Fiber; it never grants the route or an unearned Glowroot Seed.
  The story and reward ledger explain which capability changed the result.
- Updated the eleven-position fast-forward reducer so second-day Return review
  carries the correct route or clue instead of silently restoring the first
  Glowroot entries. Reload derives the same opportunity from the remembered
  Farm. No new crop, equipment, currency, destination selector, Rive input, or
  parallel state machine was added.
- The Prototype verdict is positive: a second curiosity can feel like genuine
  progression when it is caused by a visible Home change and reuses the same
  preparation grammar. The installed Impeccable review kept that distinction
  in the quiet objective HUD, physical Bag, causal vignette, and one return
  plaque instead of adding a mission board or another stack of cards.

### Validation evidence

- `npm run prototype:homegrown:test` — 49/49 pass, including the full second
  opportunity, alternate Lantern/Cloth loadout, deterministic stock deltas,
  clue-only incomplete return, persistence, and fast-forward.
- `npm run verify:rive-homegrown` — the 390×844 header and all 60 authored Rive
  names pass. This checkpoint changes no `.riv` asset or progression contract.
- `npm run quality:check` — quality contracts, the 157-file layout scan, all
  324 sprite-integrity checks, security contracts, TypeScript, and 280 focused
  Jest tests pass.
- A real 390×844 browser session played both complete Farm days from the first
  Tickle through the Lanternleaf Homecoming with Lantern and Cloth Wrap. The
  page reported no console or runtime errors; Bag copy and the return ledger
  agreed on +1 Clover Seed, +1 Glowroot Seed, and +3 Willow Fiber.
- At 360×780 with reduced motion, the opportunity survived reload and
  fast-forward. Emptying the Pack and moving from Position 7 to Position 10
  produced **Lanternleaf Trail**, +1 Compost, and +1 Willow Fiber without
  granting **Lanternleaf Path**. Body width remained exactly 360px.
- GitHub Pages run `31230345776` deployed checkpoint `584d8e2`. A fresh public
  fetch returned CSS `31ac870eb7` and JavaScript `9f58395fd9`; the latter
  contains the second-opportunity, Lanternleaf, and contextual clue contract.
  On the public site at 390×844, reload retained **Lights Past the Open Gate**,
  Lantern plus Cloth Wrap produced **Lanternleaf Path**, and the ledger returned
  +1 Clover Seed, +1 Glowroot Seed, and +3 Willow Fiber without console errors.
  At 360×780, an empty Pack fast-forwarded to **Lanternleaf Trail**, +1 Compost,
  and +1 Willow Fiber with no route grant, console error, or body overflow. The
  companion site now names the **two-day Adventure loop** directly.

### Observable acceptance criteria

- The second opportunity appears only after the first Adventure visibly opens
  the crossing and a new Farm day begins.
- Purpose, farming, Bag clues, story, return, and Field Guide all name the same
  Lanternleaf route rather than falling back to the first Glowroot outing.
- A complete Bag unlocks the route; an incomplete Bag gives a specific clue and
  useful materials without punishment or a false Discovery.
- Reload and fast-forward preserve the route context and exact stock effects.
- The next depth pass should give Lanternleaf a visually recognizable path;
  it must not add a third destination or a new selection screen.

### v0.69 — The Adventure Has a Name — 2026-08-07

- Audited the complete loop against the approved Adventure-mode direction and
  replayed Positions 1, 2, 6, 7, 8, and 9 at phone scale. Farming, Bag choice,
  and the causal vignette worked, but the player packed for an abstract
  **Adventure** and only learned what the outing was after departure.
- Named the first field opportunity **A Glow Beneath the Hedge**. The existing
  quiet objective HUD now carries its compact brief—**until dusk · soft soil ·
  carry it Home**—from Seed choice through harvested Farm stock, Bag choice,
  and the final **Follow the glow** departure. No mission board, modal, second
  HUD, destination selector, or new progression state was added.
- Reframed Bag effects as capabilities before the result: Clover Lunch helps
  Rosie stay until dusk, the Hand Trowel digs soft soil, and the Wicker Basket
  carries a find Home. Exact deterministic rewards remain visible at the
  Adventure vignette and Homecoming, where they are consequences rather than
  loadout spoilers.
- The Prototype question was whether one named opportunity could make farming
  and packing feel like a single act of preparation. The installed Impeccable
  review kept the answer inside the existing HUD and rejected another field-note
  card because Position 7 was already information-dense.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass, including the named brief,
  Bag handoff, deterministic Adventure, persistence, and all eleven review
  positions.
- `npm run verify:rive-homegrown` — the 390×844 header and all 60 authored Rive
  names pass; no Rive asset or progression contract changed.
- `npm run quality:check` — quality contracts, the 157-file layout scan, 324
  sprite integrity checks, security contracts, TypeScript, and 280 focused Jest
  tests pass.
- A real 390×844 loop ran from first Tickle through Clover planting, Harvest
  Rhythm, named Bag preparation, departure, causal vignette, Glowroot return,
  changed Home, Moonberries, moth Tickle, and the next morning with no console
  errors. The same opportunity is visible again after the next Tickle.
- At 360×780, the two-line brief ends at 62px, the Bag action ends at 707px,
  and the review rail begins at 722px. Centered 1280×900 Bag and departure
  renders preserve the same hierarchy. Reload retains the brief; rapid Pack
  reaches Position 8 once; reduced motion reaches Position 9 with Rive
  `reduced`; fast-forward preserves the named brief across Positions 6–8.
  Mobile Safari sharpness remains the manual device gate.
- GitHub Pages run `31229341475` deployed checkpoint `bdb7474`. A fresh public
  fetch returned CSS `31ac870eb7` and JavaScript `a167c5148f`; the latter
  contains the named opportunity contract. Public reload retained the complete
  brief, rapid Pack reached Position 8 once, reduced motion reached Position 9
  with Rive `reduced`, and fast-forward carried the same brief from Position 6
  through departure without console errors. The companion site now links
  **Pack for a glow beneath the hedge** directly to Position 7.

### Observable acceptance criteria

- The first post-Tickle Seed choice tells the player what Rosie wants to
  investigate and why a Provision matters.
- Bag choices answer readable environmental clues without revealing the exact
  reward table before departure.
- Farming, preparation, departure, and the causal vignette read as one journey;
  reload, rapid input, reduced motion, and fast-forward do not break that thread.

### v0.68 — The Boost Touches the Bed — 2026-08-07

- Replayed boosted and unboosted Position 3 → 4 at 390×844 and centered
  desktop. The explicit Compost choice was clear, but both choices produced the
  same planting performance before the duration card appeared.
- Rejected reopening the old special-dirt treatment: it covered the approved
  painterly crop bed and made the boost read as a foreign UI layer. Boosted
  planting instead composes the current production Rive asset's native
  **Clover Plant** and **Clover Growing Sway** clips. The already-cropped
  painterly bed gives one bounded lift, saturation, and warmth response while
  the native crop wakes, then returns to its established growing presentation.
- Kept ordinary planting unchanged and added **Plant with Compost** to the
  animation lab so the two responses can be compared directly. React remains
  authoritative for whether Compost was chosen, stock, duration, yield,
  persistence, and growth state; Rive receives only a presentation trigger.
- Inspected the editable Rive workspace before changing it. Its latest visible
  source ends at Timeline 23, while the checked-in production asset contains
  later approved work through Timeline 28. Exporting the older editor file
  would regress current Bag, resident, and Home motion, so this checkpoint
  safely composes the current shipped asset and does not overwrite it.
- The installed Impeccable motion/design review, used as the available
  Claude-Design substitute, kept the response bed-local, brief, non-blocking,
  and absent under reduced motion. It adds no card, currency, persistent
  effect, animation-owned state, or repeated ambient flourish.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass, including distinct boosted
  and normal Rive triggers, exact duration/yield, persistence, deterministic
  positions, and the complete loop.
- `npm run verify:rive-homegrown` — the 390×844 header and 60 authored names
  pass against the checked-in production Rive asset.
- `npm run quality:check` — quality contracts, 157-file layout scan, 324 sprite
  integrity checks, security contracts, TypeScript, and 280 focused Jest tests
  pass.
- Real Chromium play at 390×844 shows `plant` followed by `compost-wake`, then
  the stable `growing` state in Position 4 with **Composted · Ready in 2
  hours**. Reload remains `growing` without replay or console errors. A
  centered 1280×900 fast-forward render lands on the same stable card and bed.
- Reduced motion reaches Position 4 with `data-rive-crop-motion="reduced"` and
  no flourish. Immediate duplicate Plant input reaches Position 4 once.
  Mobile Safari sharpness and feel remain the manual device gate.
- GitHub Pages run `31217733579` deployed checkpoint `8effae0`. A fresh public
  fetch returned CSS `0c74353dc0` and JavaScript `d9f95a10bc`, both containing
  the new bounded response. Real public play at 390×844 recorded `plant` at
  80ms, `compost-wake` at 240ms and 520ms, then stable `growing` at 1160ms.
  Reload remained `growing`; reduced motion reported `reduced`; rapid duplicate
  Plant reached Position 4 once; public fast-forward landed on the stable
  **Composted · Ready in 2 hours** state. No console errors occurred. The
  companion site now links **See Compost wake the bed** to Position 3.

### Observable acceptance criteria

- Choosing Compost produces one readable response in the bed during planting;
  saving Compost preserves the established normal planting response.
- The response never restores special dirt, obscures the crop art, creates a
  second crop, or changes the guaranteed resource outcome.
- Reload, reduced motion, rapid input, and fast-forward all settle from React's
  reducer facts and never depend on animation completion.

### v0.67 — Optional Means Chosen — 2026-08-07

- Replayed Position 2 → 3 on the first and remembered mornings against
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/03-plant-and-compost.png`.
  The comparison was predictable, but choosing Clover silently preselected
  Compost and would spend one unless the player noticed and turned it off.
- Changed crop selection and the Position 3 review preset to begin with Compost
  saved. The objective and confirmation now lead with the baseline **Clover:
  4h · harvest 3** and **Plant Clover**.
- Rewrote the optional card as **Add Compost · 2 owned** and made the comparison
  state the exact benefit: **2 hours · Harvest 4**. Selecting it still shows the
  existing before/after stock, **Compost added**, and **Plant with Compost**.
  React remains authoritative for selection, quantities, duration, yield, and
  persistence.
- Added the optional toggle to the existing rapid-input guard after the first
  rendered replay found that a double tap could add and immediately remove the
  boost. One rapid gesture now records one deliberate choice.
- Framed three Prototype options: keep auto-selection, hide Compost until later,
  or default to saving it while exposing the complete comparison. The third
  passed the installed Impeccable review as the available Claude-Design
  substitute. It preserves the approved two-card composition while making the
  optional resource genuinely optional.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass, including freely choosing
  Compost, saving it for normal duration/yield, spending it for the guaranteed
  boost, full-loop settlement, persistence, and deterministic review states.
- At exact 360×780, the complete Position 3 panel is 340×221px and ends at
  697px, 25px before the rail. At 390×844 it is 370×221px; the centered
  1280×720 render preserves the same complete phone. No overflow or console
  errors occur.
- Position 3 opens with `aria-pressed=false`, **2 owned**, **Plant Clover**, and
  the 4h/3 baseline. Two immediate Compost coordinate taps produce one
  `aria-pressed=true` state with 2h/4 and **Plant with Compost**. Reload retains
  that explicit selection.
- Turning the boost off and rapidly planting reaches one Position 4 with
  **Growing normally · Ready in 4 hours**; reload preserves it. Previous returns
  to the Position 3 saved default. The complete second-morning loop reaches the
  same unboosted default with both remembered beds intact. Reduced motion shows
  the same choice. Mobile Safari/device sharpness, haptic feel, and audible
  acceptance remain manual gates.
- GitHub Pages run `31213342769` deployed checkpoint `2c5f27b`. A fresh public
  replay fetched CSS `800f24a35d` and JavaScript `3e82a0affb`, entered Position
  3 with Compost unselected, and used two immediate coordinate taps to reach
  exactly one selected 2h/4 state. Reload retained it. One deliberate deselect
  restored the 4h/3 baseline; rapid Plant reached one normal-growth Position 4,
  and reload retained it with Rive `ready`. No console errors occurred. The
  companion site now links **Choose whether to use Compost** directly to the
  public decision.

### Observable acceptance criteria

- Choosing a Seed never silently commits Compost.
- The unboosted and boosted outcomes are both visible before planting, and only
  an explicit Compost tap changes the resource commitment.
- Rapid input, reload, reduced motion, fast-forward, first-day and remembered
  play, touch, and desktop preserve the same reducer-owned choice and exact
  outcome.

### v0.66 — The Next Seed Leads — 2026-08-07

- Replayed the full changed-Home loop into the second-morning Position 2 and
  compared it with
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/02-farm-stock-seed-choice.png`.
  The reducer remembered both beds and stock correctly, but the crop ledger,
  next Seed, and Compost presented as three equal decisions.
- Replaced that equal stack with one large **Plant next · Clover Seed** action.
  It keeps the exact owned count and names the purpose—stocking Rosie's next
  Adventure—before the player commits.
- Compressed Moonberries and Glowroot into a non-interactive **Growing** receipt
  and made **Optional after Seed · Compost** subordinate context. The spare
  Glowroot Seed remains visible in Farm stock; no economy or crop state was
  removed.
- Framed three Prototype options: retain the equal stack, hide remembered crops,
  or let the required next Seed lead above a quiet continuity receipt. The
  third passed the installed Impeccable review as the available Claude-Design
  substitute. Its first rendered receipt was too tall and truncated crop names;
  the corrected version names both crops and gives more of the Farm back to the
  image.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass. The Rive contract and web
  build also pass, with React still authoritative for Seed choice, stock,
  persistence, and navigation.
- At exact 360×780, the panel is 344×178px and ends at 656px, 66px before the
  navigation rail. At 390×844 it is 374×178px; the centered 1280×720 render
  preserves the same hierarchy and complete phone. No viewport overflows or
  console errors occur.
- The remembered panel contains exactly one interactive button. Two immediate
  coordinate clicks reach Position 3 once with one planting panel. Reload
  retains Position 3; Previous returns to the same remembered Position 2 with
  Bed 2 `growing` and Bed 3 `sprout`.
- Reduced motion presents the same one-action layout with both beds and stock
  intact. Mobile Safari/device sharpness, haptic feel, and audible acceptance
  remain manual gates.
- GitHub Pages run `31212619703` deployed checkpoint `f84ca5b`. A fresh public
  replay fetched CSS `800f24a35d` and JavaScript `684457463b`, completed the
  Homecoming, both lasting plantings, Rosie tickle, and new-morning handoff,
  then reached the remembered Position 2 with exactly one Seed button. Bed 2
  remained `growing`, Bed 3 remained `sprout`, and the live receipt named both
  crops, optional Compost, and one stored Glowroot Seed. Two immediate Seed
  clicks reached one Position 3 planting panel; reload retained it. No console
  errors occurred, and the companion site now links **See what the Farm grows
  next** to the public flow.

### Observable acceptance criteria

- The next Clover Seed is the unmistakable first and only decision on the
  remembered-morning Seed screen.
- Already-growing crops and optional Compost remain legible as context without
  competing as actions.
- Rapid input, reload, reduced motion, fast-forward, touch, and desktop preserve
  the same reducer-owned state without duplicate transitions or overflow.

### v0.65 — A New Day Arrives — 2026-08-07

- Replayed **Begin another day** through Position 1 and the following Position
  2 against
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/11-changed-barn-next-day.png`
  and `01-morning-tickle.png`. Progress persisted correctly, but the complete
  Home cut straight into the next morning with no visible handoff.
- Added one 900ms presentation boundary: React commits the existing
  reducer-owned new day immediately, then a warm dawn wash and small **A new
  morning · Your Farm remembers** status reveal Position 1 underneath. The
  existing Rive Home pose, remembered crops, residents, stock, and next-morning
  Tickle remain unchanged.
- Kept the transition non-interactive and `aria-busy`, so rapid input cannot
  reach the action beneath it. Reduced motion uses the same truthful state with
  a static 300ms wash. Reload never needs to recover a presentation timer
  because the next day is serialized before the wash begins.
- Framed three Prototype options: retain the hard cut, add a long morning
  ceremony, or bridge the same reducer transition with one restrained wash.
  The third passed the installed Impeccable review as the available
  Claude-Design substitute. A bordered sun treatment failed as a pasted-on UI
  token and was removed; the final version uses only light already present in
  the Farm art plus one compact status.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass, including the complete loop,
  persistent second morning, repeated-day stock, fast-forward, and idempotent
  invalid actions.
- At exact 360×780, the warm wash fills the existing phone without changing the
  360×780 document or rail. Position 1, canonical Rosie, remembered Moonberries
  and Glowroot, pond, crossing, next Tickle, and navigation remain readable
  beneath the transient status; no console errors occur.
- At 390×844, the status occupies 100–290px by 88–139px while the rail remains
  786–844px. A centered 1280×720 render preserves the complete fitted phone and
  the same quiet hierarchy.
- Two immediate Begin-another-day coordinate clicks produce one Position 1
  state. Mid-handoff reports `aria-busy=true`, Rive `ready`, and the exact
  morning status; after 900ms it reports `aria-busy=false` with no overlay.
  Reload retains Position 1 with **Rosie wants to play**.
- The next deliberate Tickle reaches Position 2 with its Seed panel, Bed 2
  still `growing`, and Bed 3 still `sprout`. Reduced motion holds the status for
  300ms, then reaches the same Position 1 state. Mobile Safari/device sharpness,
  haptic feel, and audible acceptance remain manual gates.
- GitHub Pages run `31211832924` deployed checkpoint `d63533a`. A fresh public
  replay fetched CSS `de7c39048f` and JavaScript `ddcb65004a`, then **Begin
  another day** entered Position 1 with `aria-busy=true`, the exact morning
  status, and Rive `ready`. The wash cleared after 900ms; reload retained
  Position 1, Bed 2 `growing`, and Bed 3 `sprout`. The next Tickle reached
  Position 2 with the Seed panel and both remembered beds intact. No console
  errors occurred, and the companion site now links **See the Farm remember
  tomorrow**.

### Observable acceptance criteria

- **Begin another day** persists the new day immediately and shows one bounded
  morning handoff instead of a hard visual cut or a second ceremony.
- The transition preserves the changed Farm in view and resolves to Position
  1's core Tickle before Position 2 asks for the next Seed.
- Rapid input, reload, reduced motion, fast-forward, touch, and desktop retain
  the same reducer-owned new-day result without duplicate actions or overflow.
- Rive continues presenting the remembered Home; React alone owns the day
  transition, persistence, overlay duration, text, and accessibility.
- The next rendered weakness is Position 2's equal-weight stack of already
  growing crops, the next Seed, and optional Compost, which weakens the one
  choice a returning player should make.

### v0.64 — The Tickle Comes Back to Rosie — 2026-08-07

- Replayed the post-Moonberry Position 11 state against
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/11-changed-barn-next-day.png`.
  Moonberries and moths were both visible, but the core affection gesture had
  become a detached full-width **Tickle Rosie** footer below Farm stock.
- Removed only that footer for the open moth moment and restored the existing
  accessible Rosie hit target. One bounded ring surrounds canonical Rosie and
  one short label sits directly beneath her; the objective still names **The
  dusk moths found Home**.
- Kept the existing reducer Tickle, one-heart reward, Rive Home Admire response,
  moth Laugh, cycle completion, persistence, and later **Begin another day**
  action unchanged. Rive remains a presentation layer and receives no new
  progression fact.
- Framed three Prototype options: retain the footer, auto-tickle after planting,
  or restore direct Rosie interaction. The third passed the installed
  Impeccable review as the available Claude-Design substitute. Its first render
  failed for an oversized default ring and stock collision; the corrected
  treatment bounds the target to Rosie and lowers stock only during this beat.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass. The complete loop, direct
  Position 11 fast-forward, return branches, persistence, and invalid actions
  remain unchanged.
- At exact 360×780, Rosie's accessible hit target is 190×238px, its visible
  label occupies 521–571px, Farm stock begins at 617px and ends at 675px, and
  navigation begins at 722px. The page remains exactly 360×780 with no
  overflow, hidden action, or console error.
- At 390×844, the same hit target and label remain above stock at 681px and the
  rail at 786px. Centered 1280×720 keeps the complete fitted phone, Rosie,
  Moonberries, moths, stock, label, and rail visible.
- Two immediate coordinate clicks on Rosie award exactly one heart (`1,120 →
  1,121`), run the existing Home response plus moth `laugh`, remove the Tickle
  target, and expose **Begin another day**. Reload preserves the completed day;
  Previous → Next fast-forward reaches the same final action without a stray
  Rosie target.
- Reduced motion keeps Rive `ready`, awards the same one heart, reports character
  and moth motion `reduced`, and exposes the same next-day action. Mobile
  Safari/device sharpness, haptic feel, and audible acceptance remain manual
  gates; this browser checkpoint does not claim them.
- GitHub Pages run `31210902645` deployed checkpoint `5e31e32`. A fresh public
  replay fetched CSS `8d888208e1` and JavaScript `9b31f01667`, then exposed one
  190×238 Rosie target after Moonberries entered `growing`. Two immediate
  coordinate clicks awarded exactly one heart, reported last Rive motion
  `tickle` plus moth `laugh`, removed the Rosie target, and exposed **Begin
  another day**. Reload retained the completed day, both crops, moths, and exact
  Farm stock with Rive `ready` and no console errors. The companion site now
  links **Share Rosie’s moth moment**.

### Observable acceptance criteria

- After Moonberries reveal the moths, the one current action is visibly and
  accessibly attached to Rosie rather than a detached footer.
- A single interaction awards one heart, completes the Barn day, plays the
  existing Rosie/moth response, and reveals **Begin another day**.
- Rapid input, reload, reduced motion, fast-forward, touch, and desktop retain
  the same reducer-owned outcome with no overlapping controls.
- Rosie, both new crops, the moth result, Farm stock, and navigation remain
  readable throughout the interaction.
- The next rendered weakness is the next-day handoff itself: **Begin another
  day** resets directly to Position 1's next-morning Tickle without a visible
  morning transition.

### v0.63 — Moonberries Find Their Bed — 2026-08-07

- Replayed the planted Position 11 Home against
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/11-changed-barn-next-day.png`.
  The remembered Farm, stock, and next purpose were visible, but the existing
  full-width **Grow Moonberries** button sat apart from the empty middle bed it
  would change.
- Kept the existing explicit choice and moved only its presentation into the
  Farm. The objective now names **Bed 2 is ready for Moonberries**; one violet
  pulse marks that bed, and the compact action explains **Invite the dusk
  moths** before the player commits.
- Reused the established Rive Moonberry Plant and growing states. React still
  owns the purpose choice, `nextPlanting`, persistence, the moth-visibility
  fact, and the next Tickle action; no Seed, inventory, timer, or reward rule
  changed.
- Framed three Prototype options: retain the detached full-width button,
  auto-grow Moonberries after Glowroot, or anchor the same explicit choice to
  Bed 2. The third passed the installed Impeccable review as the available
  Claude-Design substitute. The first rendered layout failed that gate because
  its label crossed Farm stock; the corrected layout moves stock down only for
  this choice and keeps one clear, non-overlapping action.

### Validation evidence

- `npm run prototype:homegrown:test` — 47/47 pass, including the exact
  Moonberry presentation target, complete loop, persistence, fast-forward, and
  invalid input. `npm run verify:rive-homegrown`,
  `npm run prototype:homegrown:build`, `npm run quality:loop`, and
  `npm run quality:check` pass, including TypeScript, 78 layout tests, 202
  security tests, 324 sprite checks, and the locked quality contracts.
- At exact 360×780, the action label occupies 546–601px, Farm stock begins at
  617px and ends at 675px, and navigation begins at 722px. The document remains
  exactly 360×780 with no overflow, overlapping targets, or console errors.
- At 390×844, the action ends at 599px, stock begins at 681px, stock ends at
  739px, and navigation begins at 786px. A centered 1280×720 render preserves
  the complete fitted phone, Rosie, the bed pulse, stock, action, and rail.
- Two immediate action-point clicks produce one `nextPlanting` transition:
  Bed 2 enters `growing`, Rive reports Moonberry `plant`, and the existing
  Tickle action appears. Reload settles Moonberry motion to `growing` with the
  moths still present. Reduced motion keeps Rive `ready`, Bed 2 `growing`, and
  Moonberry motion `reduced` with identical reducer facts.
- Mobile Safari/device sharpness, haptic feel, and audible acceptance remain
  manual gates; this browser checkpoint does not claim them.
- GitHub Pages run `31210093147` deployed checkpoint `57ac4e7`. A fresh public
  replay fetched CSS `4fa49cf558` and JavaScript `3f3514656e`, then exposed the
  exact Bed 2 objective, `world-action-moonberry-bed` target, empty bed, and
  dusk-moth purpose. Choosing it changed Bed 2 to `growing`, played Moonberry
  `plant`, revealed the moths, and exposed **Tickle Rosie**. Reload retained the
  same stock, growing bed, `growing` motion, moths, and action with Rive `ready`
  and no console errors.

### Observable acceptance criteria

- The next crop decision visibly belongs to empty Bed 2 and retains one short
  explanation of why Moonberries matter.
- Choosing it once runs the existing Rive plant response, reveals the growing
  bed and moth result, and remains idempotent under rapid input.
- Reload, reduced motion, fast-forward, and touch/desktop layouts preserve the
  same reducer-owned result without page overflow or hidden controls.
- The Farm-memory panel remains readable but does not compete with the one
  current action or obscure Rosie and the planting payoff.
- The next rendered weakness is the resulting full-width **Tickle Rosie**
  button, which is clear copy but spatially detached from Rosie herself.

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
