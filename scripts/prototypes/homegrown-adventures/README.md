# Homegrown Adventures prototype

## v0.90 fast-forward hierarchy study (throwaway branch)

Question: where can the browser prototype's fast-forward stay obvious and
touch-safe without becoming the Farm's primary action?

Open Position 9 with
`?position=9&journey=homeward&debug=1&fastforward=A`, then compare:

- **A — Field-note aside:** a 44px secondary action lives inside the current
  journey note.
- **B — Route destination:** the Homeward step itself exposes a compact
  preview action.
- **C — Review rail:** fast-forward leaves the Farm and joins the prototype's
  external progression controls.

All three invoke the same existing `ADVANCE_TIME` action. The switcher and
losing structures stay off main after the rendered decision is captured.

**Rendered verdict:** C — Review rail. A made the current story note taller
and forced its copy, progress, and shortcut into one competing card. B made a
route status look tappable and reduced the label to an ambiguous “Preview.” C
left the Farm and three-step journey completely untouched while keeping one
44px fast-forward action visibly joined to the browser's existing progression
rail. Production keeps C's two-tier review dock; the prototype switcher and
both in-world treatments stay on this branch.

The v0.89 journey-progress pass derives one calm **trail → homeward → Home**
change from the six-hour timestamps the reducer already persists. At 75%, the
existing field note becomes route-specific homeward copy, the existing route
advances, path lights turn back, and the porch light brightens. Reload derives
the same beat, completion still belongs to the reducer, and reduced motion
keeps every state readable without movement. Three structures were rendered
on the real Position 9 watch and captured at commit `56d1bec` on
`codex/homegrown-v089-journey-progress-prototypes`; the field-note treatment
won. No prototype switcher, new screen, reward, timer fact, save field, or Rive
input remains on main.

The v0.88 journey-atmosphere pass keeps the remembered Farm visibly at dusk
while Rosie is away. The existing journey watch now fades in over one
scene-wide evening grade, keeps one restrained warm Home light, and recolors
the existing trail, route marker, and current step for warm moths or reflected
leaves. Three structures were compared on the real Position 9 watch at commit
`6a2ed6c` on `codex/homegrown-v088-journey-atmosphere-prototypes`; the whole-
Farm dusk treatment won, with only the porch-light cue borrowed from the darker
vigil. No prototype switcher, new journey screen, state, reward, or Rive input
remains on main.

The v0.87 journey-handoff pass removes the contradictory resolved note and
redundant **Let Rosie explore** confirmation from Position 9. After Provision,
Tool, and Pack have each played, one route-specific **Rosie follows…** bridge
holds for 900 ms and carries the scene into the existing idle journey watch.
Reduced motion holds the static bridge for 1.8 seconds. The winning no-extra-
click treatment was selected from three structures captured on
`codex/homegrown-v087-journey-handoff-prototypes` at `79ca1ef`; no Bag rule,
route, reward, duration, or persistence field changed.

The v0.86 Adventure-attention pass gives canonical Rive Rosie one restrained
authored `Rosie Notice` lean when the Tool cause—or a No Tool clue—takes focus
in Position 9. Provision and Pack keep their physical item actions, Rosie
settles before the Pack beat, and reduced motion holds the resolved pose. The
validated cadence was selected from three treatments captured on
`codex/homegrown-v086-rosie-response-prototypes` at `832544f`; no reducer fact,
Bag rule, reward, timer, or persistence state changed.

Throwaway browser prototype for the loop in
`docs/homegrown-adventures-build-goals.md`. It uses one deterministic reducer
and three UI variants; `?variant=A|B|C` changes presentation without changing
the saved simulation.

Run from the repository root:

```sh
npm run prototype:homegrown
```

Then open `http://127.0.0.1:4174/homegrown-adventures.html?variant=A`.

Build and test:

```sh
npm run prototype:homegrown:build
npm run prototype:homegrown:test
```

The build emits both minified stylesheets from their source files, writes
content hashes onto the published CSS and JavaScript URLs, and versions the
authored Rive request. Keep all three boundaries when changing deployment code;
public QA must exercise the exact bundle produced for the checkpoint.

The web-only Rive wrapper uses `@rive-app/react-webgl2`. The build now publishes
the checked-in authored Homegrown Adventures scene: Rosie's mesh/bone rig,
breathing, tickle and notice motions, plus the registered satchel with pack,
return, and hidden-state clips. The same scene owns Kitchen Patch bed one's
empty, growing, ready, plant, flourish, and harvest poses. The first crop loop
keeps the starting Barn plate fixed instead of faking growth with a background
swap. It now also owns the lasting Glowroot bed, flowering hedge crossing, and
Hedge Bell reveal; hidden, flourish, and developed clips remain bound to the
reducer's `hedgeCrossingOpen` fact. `runtime-sample.riv` remains only the
fallback runtime probe. Static
character-free concept plates provide the scene behind the transparent Rive
canvas so the animated rig is the only Rosie rendered.

Position 9 now uses a second tightly clipped view of the same authored file for
the physical Glowroot only. The successful branch removes the root from its
character-free environment plate and lets `Glowroot Home Flourish` reveal and
gently re-light the native vector rig. React decides whether that component is
mounted; the Near-Discovery plate contains no reward and instantiates no
Glowroot Rive canvas. The animation lab exposes the exact motion as **Reveal
Glowroot**.

The v0.60 presentation pass makes that deterministic Find the first read. One
larger complete or clue-only result sits directly below the HUD; a single **How
Rosie’s bag helped** ledger preserves the exact three Provision / Tool / Pack
consequences underneath it. This replaces three equally framed top cards but
does not change the Bag, branch, reward, timer, Rive contract, or Continue
action. The exact 360×780 touch layout keeps the story, clearing, action, and
prototype rail visible without page overflow.

Position 10 now replaces the floating return stack with matched, character-free
Barn-worktable plates derived from the approved return concept. The successful
plate physically shows the earned Glowroot Seed, Compost, and two Willow Fiber
coils; the Near-Discovery plate shows a leaf-print clue, Compost, and one Fiber
coil with no Seed. Canonical Rive Rosie performs the existing `Rosie Return`
above the plate, while React owns the branch, quantities, causal copy,
acknowledgement, and fast-forward stock delta. Reload holds the complete scene
without replaying the one-shot, and reduced motion skips it.

The v0.61 presentation pass leaves preparation causality in Position 9 and
turns Position 10 into a focused Homecoming. One larger **Added to Farm stock**
ledger now carries the exact complete, clue-only, alternative equipment, or
repeat return quantities; the former three-column cause recap is removed. A
compact-height treatment keeps that ledger, the current action, and the rail
separate at 360×780. No reward, branch, persistence, Rive, or reducer contract
changed.

The v0.62 interaction pass carries the first explicit **Plant Glowroot** choice
out of the return worktable and into the outdoor Farm after Welcome. The action
is registered to the empty third bed, previews the exact Seed spend, and then
uses the existing authored Rive Home flourish to reveal the lasting sprout.
`plant-glowroot` is a presentation-only trigger: it settles the unrelated
Clover crop layer instead of replaying its ready flourish, while React remains
authoritative for acknowledgement, stock, planting, persistence, and the next
Moonberry action.

The v0.63 interaction pass gives that next Moonberry choice the same spatial
grammar. The existing explicit action targets empty Bed 2, names its dusk-moth
purpose, and then hands off to the existing authored Rive Moonberry Plant and
growing poses. Farm stock shifts lower only while that bed choice is active so
the pulse, label, stock, and rail stay separate at 360×780. React still owns
`nextPlanting`, persistence, moth visibility, rapid-input idempotence, and the
subsequent Tickle action.

The v0.64 interaction pass returns that subsequent Tickle to Rosie herself.
Only during the open moth moment, the existing accessible Rosie target gains a
bounded ring and compact label while Farm stock shifts lower to preserve clear
spacing. The same React-owned Tickle awards one heart and completes the day;
the existing Rive Home Admire and moth Laugh respond, then the UI returns to
the established **Begin another day** action. Rapid input cannot turn that next
action into an accidental second tap.

The v0.65 presentation pass gives **Begin another day** a readable handoff.
React serializes the existing next-day reducer state immediately, then a short
non-interactive dawn wash reveals Position 1's next-morning Tickle over the same
remembered Farm. Rive keeps presenting the Home pose and persistent crops; it
does not own the day, timing, text, or save. Reduced motion uses a static 300ms
wash, and reload always resumes the already-committed morning.

The v0.66 hierarchy pass makes the following remembered-morning Seed choice
read as one decision. **Clover Seed** leads with its stock and Adventure purpose;
Moonberries, Glowroot, the spare Glowroot Seed, and optional Compost remain in
one quiet continuity receipt beneath it. React owns every fact and transition;
Rive continues to show the established growing beds without receiving UI or
inventory authority.

The v0.67 choice pass makes optional Compost require an explicit decision.
Choosing Clover now begins with Compost saved and compares the normal 4-hour,
3-yield crop against the 2-hour, 4-yield boost. One guarded tap adds it, reload
preserves it, and another deliberate tap saves it again. React owns the resource
commitment and exact outcome; the Rive crop receives only the resulting planted
state.

The v0.68 response pass lets that explicit boost touch the bed. Boosted planting
composes the checked-in native **Clover Plant** and **Clover Growing Sway** Rive
clips, while the already-cropped painterly bed gives one restrained lift and
warmth response before settling. Normal planting is unchanged. React still owns
Compost, duration, yield, persistence, and the resulting growing state; reload,
fast-forward, and reduced motion never replay the one-shot.

The v0.69 adventure pass gives the first outing a name before the player farms
for it: **A Glow Beneath the Hedge**. One quiet HUD line carries that opportunity
from Seed choice through Harvest, Bag preparation, and departure, with the clues
**until dusk · soft soil · carry it Home**. Bag copy now previews capabilities
instead of spoiling reward quantities, so Clover Lunch, Hand Trowel, and Wicker
Basket read as answers to the outing rather than three unrelated bonus items.

The v0.70 consequence pass makes the opened hedge lead somewhere on the next
Farm day. Once Glowroot is planted, Rosie discovers **Lights Past the Open
Gate** with a new brief—**nightfall · reflected leaves · gentle wrap**. The
existing Lantern and Cloth Wrap become legible alternate answers, the causal
vignette maps **Lanternleaf Path**, and a missing capability returns only the
**Lanternleaf Trail** clue plus useful Farm materials. The opportunity is
derived from the remembered Home, so reload and prototype fast-forward preserve
it without a mission board, new currency, parallel state machine, or Rive-owned
progression.

The v0.71 route pass gives that second opportunity its own physical place. A
new character-free **Lanternleaf Path** plate preserves the approved portrait
camera and twilight woodland, but replaces the Glowroot clearing with an open
wooden gate and a trail of gold-reflecting leaves. Live Rive Rosie and her
satchel remain above the plate; the selected Tool is a separate prop, and the
first route's live Glowroot appears only when Glowroot is actually the
Discovery. Because Rosie shares one Rive artboard with Home, the second-route
presentation also sends empty beds, hidden residents, hidden moths, and a
closed Home layer to Rive while the vignette is mounted. That prevents the
remembered Farm from leaking into the expedition without changing the saved
Farm or adding a second character rig.

The v0.72 motion pass gives only that painted trail one living environmental
cue. A separate 390×844 **Lanternleaf Reflections** Rive artboard draws seven
native warm-gold leaves over the existing path and exposes one authored
`Lanternleaf Reflection Pulse`. React mounts it only for the second route,
plays its rise, holds the readable glow, plays its fade, and leaves a long calm
gap. The first route instantiates no reflection canvas; reduced motion hides
the live layer and keeps the plate's static leaves. Route choice, story,
equipment, rewards, persistence, and timing remain reducer-owned.

The v0.73 story-order pass reserves the named Find for Homecoming. Position 9
now presents one route-specific environmental response and a present-tense
**What Rosie’s bag changes** ledger. Its copy explains preparation without
naming reward materials, the Glowroot, Lanternleaf Path, or a clue. **Let Rosie
explore** hands that beat into the established idle wait; Position 10 remains
the first named Discovery or Near-Discovery reveal. The same reducer facts,
routes, exact outcomes, Rive layers, and fast-forward positions remain intact.

The v0.74 waiting pass turns the state after **Let Rosie explore** into one
calm journey watch instead of an empty Farm spinner. Set off, the route-specific
trail, and Homecoming form one readable three-beat path; **Fast-forward to
Homecoming** is explicitly a prototype control. The resulting gate-bell state
still requires **Welcome Rosie home**, and Position 10 remains the only named
Discovery or Near-Discovery reveal. The visual layer adds no timer, reward,
route, mission, currency, or persistence authority, and reduced motion keeps a
static route with the same accessible DOM hierarchy.

The v0.75 causality pass makes the preceding Position 9 vignette enact the Bag
instead of exposing three answers at once. Provision, Tool, and Pack each
receive one short focus beat, with the matching physical prop emphasized in the
scene. The existing Glowroot or Lanternleaf Rive cue waits until the Tool beat,
so the environment visibly answers Rosie's preparation. React still owns the
beat order, route, Bag facts, exact outcome, and interruptible Continue action;
reduced motion resolves directly to the complete ledger, and empty slots keep
their established useful Near-Discovery paths.

The v0.76 Homecoming pass makes the final journey-watch promise physically
true. When the gate bell rings, canonical Rive Rosie becomes visible in the
Farm, performs the existing **Rosie Return** timeline with her reducer-owned
satchel, and remains for the player's **Welcome Rosie home** action. Reload can
replay this presentation-only arrival; reduced motion holds the same readable
Home pose. The second route keeps its earned crops, residents, pond, hedge, and
bell. Position 10 still owns the first named Discovery and exact Farm-stock
reward, so no gameplay state or reward timing moved into Rive.

The v0.77 handoff pass keeps that gate action as the one emotional welcome.
The first complete reward receipt now says **Glowroot can change the Farm** and
offers **Take Seed to Bed 3**, moving outdoors to the existing exact Seed-cost
preview and separate Plant action. Repeat returns still store supplies and
Near-Discoveries still adjust the Bag. React keeps the same reward timing and
state transition; no Rive asset, motion, route, quantity, or planting rule was
added.

The v0.78 clarity pass removes the isolated **+1** marker from the physical
return table. The existing Farm-stock receipt now explains the exact Tool bonus
beside its total: **Find +1 · Trowel +1** for two Glowroot Seeds, or **Find +2 ·
Lantern +1** for three Willow Fiber. Near-Discoveries display no Tool bonus.
React continues to own the same deterministic quantities; no Rive motion,
reward rule, route, or progression state changed.

The v0.79 handoff pass keeps one returned Glowroot Seed physically continuous
between the Barn worktable and Bed 3. It reaches Rosie in 420 ms, crosses with
her into the garden, and lands over the correct bed in another 460 ms before
planting unlocks. Trowel and Lantern returns use truthful two-Seed and
single-Seed origins; clue and later stock-only returns skip the transfer.
Reduced motion changes the scene atomically. React still owns acknowledgement,
Position 10 → 11, and the later Seed spend; the existing Rive Plant trigger is
unchanged. The three comparison treatments remain captured on
`codex/homegrown-v079-seed-handoff-prototypes` at `65c34f3`; main retains only
the continuous garden bridge.

The v0.80 hierarchy pass lets the resulting Glowroot change own one quiet
first beat. **Plant Glowroot** still commits the reducer state immediately and
starts the existing 780 ms Rive Home flourish, but React withholds **The Barn
remembers**, Farm stock, and the Moonberry action for 900 ms. Only the compact
HUD reads **Glowroot takes root · The Farm remembers** while the sprout, hedge,
bell, frog, and Rosie settle; the exact retained UI then returns. Reload resumes
the stable developed Farm, rapid taps spend one Seed, and reduced motion skips
the pause. The three comparison treatments remain captured on
`codex/homegrown-v080-glowroot-quiet-beat-prototypes` at `669b214`; main retains
only the world-first treatment.

The v0.81 memory pass keeps that first acknowledgement, then replaces the two
persistent teaching panels with one secondary **The Farm remembers** pocket.
Its collapsed state leaves Rosie, all three beds, and the current Farm action
readable; one explicit **See stock** action opens the permanence promise and the
same four named quantities inline. Opening the pocket temporarily removes the
overlapping world action and Rosie hit target, and every game action closes it.
The drawer is presentation state only: reload returns it collapsed, reduced
motion removes its 180 ms reveal, and no reducer, inventory, persistence, Rive,
or economy contract changes. Three structural treatments remain captured on
`codex/homegrown-v081-home-memory-prototypes` at `9c29852`; main retains only
the compact Memory Pocket.

The v0.82 Adventure pass replaces Position 9's simultaneous Discovery card
and three-row Bag ledger with one changing field note. Provision, Tool, and
Pack each own one 900 ms beat using the same deterministic `journeyTags`; the
resolved beat names what Rosie noticed. The active note remounts for a short
220 ms state reveal and announces itself through one polite live region while
the existing physical props and Rive environment continue to respond. The
primary action remains available, reload restarts the readable sequence, and
reduced motion paints the resolved note immediately. No Bag rule, cause,
outcome, reward, timer, persistence, or Rive input changes. Three structural
treatments remain captured on
`codex/homegrown-v082-adventure-story-prototypes` at `300fb9e`; main retains
only the single Field Note.

The v0.83 Tool pass makes the first Hand Trowel cause physical. Position 9 now
uses the clean clearing plus the existing separable painterly Tool asset rather
than a trowel baked into the background. During the exact 900 ms Tool beat, the
trowel performs one 680 ms dig toward the authored Rive Glowroot reveal, then
settles before Pack takes focus. Lantern uses its own separable prop and no dig;
an empty Tool shows neither object nor motion. Reduced motion paints the settled
Tool and resolved find immediately. The animation is a presentation response to
existing Bag state: it adds no interaction, rule, timing, result, or persisted
fact. Three treatments remain captured on
`codex/homegrown-v083-tool-action-prototypes` at `42a66ab`; main retains only
the one-dig treatment.

The v0.84 Pack pass completes that physical cause chain. During the existing
Pack beat, one restrained mote of the Glowroot's established warm light travels
from the find into Rosie's selected nonempty Pack and stays faintly visible at
its resting point. An empty Pack receives no mote, so its existing
Near-Discovery remains visually honest. The handoff is limited to **A Glow
Beneath the Hedge**; Cloth Wrap on the later Lanternleaf outing keeps that
route's own reflected-leaf language. Reduced motion paints the same settled
endpoint without travel. React still owns the Pack, result, and reward; Rive
still owns the Glowroot reveal. Three treatments remain captured on
`codex/homegrown-v084-pack-handoff-prototypes` at `bd77edf`; main retains only
the find-to-Pack handoff.

The v0.85 Provision pass makes the first cause physical too. During the
existing Provision beat, the selected Clover Lunch tin performs one restrained
lift to Rosie and returns before Tool takes focus. At the same time, one quiet
indigo wash settles over the clearing and remains through Tool, Pack, and the
resolved environmental beat, turning **keeps Rosie exploring until dusk** into
visible cause and effect. Leaving Provision empty renders no tin, no use
motion, and no dusk wash. The same response supports the later Lanternleaf
nightfall brief without covering its Rive reflections. The already-packed
Provision was still spent exactly once by React before departure; the visual
response does not spend it again or add hunger. Three treatments remain
captured on `codex/homegrown-v085-provision-action-prototypes` at `b439995`;
main retains only the lunch-to-dusk response.

The same Homecoming is repeat-aware after Glowroot is planted. A later
successful Adventure still adds one Seed, one Compost, and two Willow Fiber,
but React labels it **Discovery remembered** and offers one **Keep supplies in
Farm stock** action. That action retains the Seed, moves directly to Changed
Home, and completes the Barn day; it never offers a second planting action that
the reducer must reject. The first Discovery still spends its Seed exactly once
to establish the lasting Glowroot at Home.

On the following remembered morning, Position 2 carries that reward forward in
the existing planted-Glowroot tile. Zero spare Seeds add no claim; positive
stock reads **1 Seed stored** or its plural equivalent beside **Bed 3 planted**.
Clover remains the only next planting action, so the count strengthens visible
continuity without becoming another crop selector or inventory surface.

Willow Fiber now has one recurring use inside that same loop. Cloth Wrap still
comes Home as reusable Pack equipment, but each departure with it spends one
Fiber as fresh protective lining. Position 7 names the stock, previews the exact
before-and-after cost, and refuses an unavailable Wrap without blocking the
free Wicker Basket or empty-Pack routes. Position 8 keeps the remaining Fiber
visible in the existing loadout ribbon; the deterministic vignette then explains
that the Wrap protected the delicate Find. React owns selection, stock,
consumption, persistence, and refusal. No crafting state, currency, inventory
screen, or Rive progression input was added.

The v0.47 prototype question is whether those two Packs can remain genuinely
useful over repeated Farm days without adding another reward system. The
validated answer changes one existing practical return: Wicker Basket brings
Home one Compost, while Cloth Wrap spends one Fiber and preserves one Clover
Seed. Glowroot Seed and Willow Fiber remain common rewards. Position 10 swaps
the first ledger quantity and places a small seed pouch over the registered
table supply when Cloth is chosen; Position 11 and the next Seed choice then
show the preserved Seed. React derives every quantity from the selected Pack;
Rive receives no new progression fact.

The v0.48 prototype question is whether the two reusable Tools can create a
predictable stockpile tradeoff inside that same Glowroot Adventure. The
validated answer changes one existing bonus quantity: Hand Trowel uncovers one
extra Glowroot Seed, while Lantern follows the dusk trail to one extra Willow
Fiber. The selected Pack still decides Compost or Clover Seed independently.
Bag copy previews the exact bonus, the vignette explains it, Position 10 shows
the dynamic quantities and one tightly registered crop of the existing
painterly Seed or Fiber art, and Changed Home retains the result. Prototype
navigation now applies the chosen Tool,
Pack reward, and Cloth lining cost both forward and backward instead of
silently reverting to the default loadout. React owns every reward; Rive gains
no progression input. The rendered pass also prevents the fitted desktop frame
from focus-scrolling and explicitly resynchronizes Rive after a live viewport
change.

The v0.49 prototype question is whether that Tool choice remains legible in the
physical Adventure scene instead of changing labels alone. React now exposes
the selected Tool as a presentation-only data attribute while preserving the
same reducer state and reward branch. Hand Trowel retains the approved clearing
plate, Lantern selects `adventure-clearing-lantern.webp`, and an empty Tool uses
the clean clue plate with no stray equipment. The Lantern plate was produced as
a precise ImageGen edit of `adventure-clearing-discovery-rive.webp`: replace
only the lower-right Trowel with a small closed brass travel lantern at the same
scale, preserve the clearing composition and basket, add one restrained warm
glow, and add no character, reward, copy, control, or other object. The smaller
of two generated treatments won because the first Lantern competed with Rosie
and the Discovery card at phone size. Rive still owns only Rosie and the live
Glowroot performance; React owns the selected Tool and every gameplay result.
The public replay also exposed a prototype-rail inconsistency: an empty slot
could show a clue at Position 9 but inherit the successful preset when the story
continued. Review navigation now derives Provision spending, underpreparation,
the clue reason, and the exact clue supplies from the carried Bag, so the visual
branch and Return cannot disagree.

The v0.50 prototype question is whether Pack choice is equally physical instead
of remaining a causal label over a baked Basket. Position 9 now composes two
independent presentation facts from the existing Bag: the selected Tool chooses
a character-free, Pack-free clearing plate, while the selected Pack chooses one
registered painterly overlay. Wicker Basket, Cloth Wrap, and an empty Pack now
cross cleanly with Hand Trowel, Lantern, and an empty Tool without multiplying
gameplay states or changing any reward. The Trowel and Lantern plates are
precise ImageGen edits that remove only the old Basket and reconstruct its
occluded ground. The Basket and Cloth Wrap are ImageGen-derived alpha assets
matched to the approved Position 9 and Position 7 concepts. React owns both
equipment attributes; Rive still owns only canonical Rosie and the live
Glowroot performance.

The v0.51 prototype question completes that physical preparation trio: does the
Provision enter the clearing too? Position 9 now derives a third independent
presentation fact from the existing Bag. Clover Lunch places one compact open
travel tin on the ground near Rosie; an empty Provision leaves that part of the
clearing clean. The alpha prop is an ImageGen object study derived from the
approved Position 9 concept, cropped for its registered web placement and kept
below the story overlay. The reducer's duration, stock spend, branch, and reward
rules are unchanged. React owns the Provision fact; Rive still owns only the
canonical character, equipped satchel, and live Glowroot motion.

The v0.52 prototype question follows reusable equipment all the way Home.
Position 10 now derives a return-only Tool fact from the same Bag: the Hand
Trowel or Lantern rests at the worktable edge, while an empty Tool leaves that
space clean. Both compact alpha props are ImageGen studies matched to the
approved Return concept and registered below the exact reducer-owned reward
overlay. Their short settle is presentation only. React still owns which Tool
was packed, the Tool bonus, Return quantities, acknowledgement, persistence,
and fast-forward; Rive still owns Rosie's authored Return performance.

The v0.53 prototype question completes reusable equipment continuity at Home.
Position 10 now derives a return-only Pack fact from the existing Bag: the
Wicker Basket or Cloth Wrap rests beside the worktable, while an empty Pack
leaves that part of the Barn clean. The same approved alpha assets used in the
Adventure are registered at a smaller return scale, so no parallel art variant
or item state is introduced. React owns the Pack choice, practical-supply
reward, persistence, and fast-forward; Rive still owns Rosie's Return motion.

The v0.54 prototype question returns to Position 7's one-action hierarchy.
The approved open Bag, three selected slots, consumable/reusable explanation,
Pack action, and progression rail now fit as one readable stack at both the
390x844 reference size and the shorter 360x780 touch check. This is presentation
only: item choice, material costs, Bag validity, persistence, and fast-forward
remain reducer-owned, while the existing Rive Pack performance is unchanged.

The v0.55 prototype question gives each valid slot choice an immediate physical
answer. The authored `Bag Receive` timeline moves the existing native satchel
through one compact rise, enlargement, settle, and hide sequence; the open Bag
and packed React tokens answer during the same 600 ms window. React still owns
the exact Provision, Tool, or Pack choice, ownership rules, costs, persistence,
fast-forward, and accessible labels. The selector now uses concise reward lines,
a full-card Change target, and a separate 44px Empty action after a rendered
product-design pass. Reduced motion skips the one-shot and rapid changes restart
one response.

The v0.56 prototype question makes that response specific. React records only
the latest slot transition for presentation: the changed card remains clear,
one exact item travels into the open Bag, and only its matching packed token
lands while the shared Rive `Bag Receive` performance continues underneath.
Choosing Empty carries the previous item back out. Rapid touch input replaces
the active flight and restarts the bounded response; reduced motion, reload,
and fast-forward preserve the reducer-selected Bag without replaying it. The
rendered design pass also shortens empty-card copy while keeping complete
accessible names.

The v0.57 prototype question makes the equipped Bag belong on Rosie. The same
native `rosie_satchel` now uses a compact 112% settled pose, a restrained return
swing, and a warm brown leather palette sampled from the approved Position 8
concept. It remains one editable Rive group attached to Rosie's existing body
rig. React still owns whether the Bag is equipped and which three choices it
represents; reload, reduced motion, departure, and return all hold or replay
that same authored asset without a duplicate DOM satchel.

The v0.58 prototype question makes departure read as travel rather than a
front-facing slide. The existing one-second `Rosie Departure` timeline keeps
its root path and adds two alternating steps on Rosie's front-screen leg plus a
small counter-swing on the fitted satchel. React still owns the departure clock,
idempotence, Position 8 → 9 transition, persistence, and reduced-motion skip;
no destination, reward, or parallel movement state was introduced.

The v0.59 prototype question makes the established crossing acknowledge that
travel. The same Rive timeline reveals one existing green leaf backing only in
its final eighteen frames, gives it one damped rustle, and hides it again at
the endpoint. A restrained scene-level dusk wash bridges the final approach to
the existing clearing. React still owns the exact one-second Position 8 → 9
boundary, reduced-motion skip, persistence, and rapid-input guard; no new
screen, destination, or gameplay fact was introduced.

Position 11 now switches to the character-free
`11-changed-home-pond-scene-plate.png`, where the earned pond is painted into
the same Farm camera and visual language. The shared Rive artboard contributes
only the living frog, aligned to the plate's foreground rock; its older vector
water, rocks, lily pads, flower, and duplicate rock remain hidden. React
separates the already-earned Position 10 fact from the Position 11 reveal, then
preserves the plate and `Pond Frog Present` through reload and later mornings.
`Pond Frog Response` supplies one quiet bob between long rests; reduced motion
keeps the frog still and no resident progression lives inside Rive. The
animation lab exposes the same composition as **Pond remembers**.
The v0.40 resident pass retains that exact motion contract but reduces the
native frog to 80% scale, softens its contours, and replaces its bright vector
palette with muted olive, moss, and warm-gold colors derived from the approved
Position 11 concept. The frog remains one editable Rive group; React still owns
its earned visibility and persistence.

The v0.41 doorway pass retains the existing crossing state and timelines but
places two close, muted native Rive foliage backings behind its flowering
front. At Position 11 the earned route now reads as one substantial garden
arch instead of two thin temporary strokes. React still owns
`hedgeCrossingOpen`, reload, next-morning persistence, and reduced motion; the
Rive edit adds no destination, reward, or progression state.

The v0.42 leaf pass keeps that same doorway but gives its foliage an irregular
edge. Two more low-opacity native Rive backings diverge slightly in scale,
rotation, and registration, while crossed elliptical duplicates of the
existing green node group read as leaves at the arch edge. The original pink
blossoms remain in front. The same Home consequence parent still handles
reveal, developed hold, reload, and reduced motion; React owns every gameplay
fact.

The v0.44 short-desktop pass treats the fixed 390x844 game as one registered
composition. Above phone widths but below 930px in height, four bounded scale
steps keep the complete frame, primary action, and prototype rail inside the
first viewport. The smallest step still leaves a 58px action above 45px, while
the `max-width: 700px` phone layout overrides the transform and preserves its
full-size touch controls.

The remembered Moonberry and Glowroot beds use registered clips from
`11-changed-home-painted-crops-scene-plate.png` above that same pond plate.
`bedTwoState` and `bedThreeState` independently reveal the middle and right
beds, so Glowroot can be present while Moonberries are still a future choice.
The source Rive timelines remain connected to the reducer-owned states, while
the painterly clips keep the lasting crop mass rooted in the Farm art instead
of reading as a flat sticker.

The persistent Farm view and temporary Position 9 Glowroot view share Rive's
offscreen WebGL2 renderer. They remain separate canvases and React components,
but the temporary discovery view can unmount without invalidating the Farm's
live renderer before Position 11 reveals the frog.

Crop growth now has an explicit painterly early-sprout asset and a separate
flower-free lush-middle asset. React derives that visual boundary from
`plantedAt` and `readyAt`; the authored `Clover Growing Sway` timeline supplies
one restrained clover-only cadence during the middle stage. Rive still owns no
timer, inventory fact, ready transition, or reward.

Variant A is canonical. The return story temporarily expands for a 2.4-second
welcome-home ceremony, then becomes a compact, accessible Home record below the
HUD. Tickling Rosie dismisses the ceremony immediately; developed reloads are
compact from their first frame; reduced motion never opens it. The record's
button exposes the full story and Field Guide on request without permanently
covering Rosie or the Kitchen Patch.

The baked Clover instruction becomes visible once that record collapses, so the
post-return scene covers it with a reducer-bound DOM purpose sign. It reads
Glowroot Seed on return, requests Moonberries after planting, and persists the
chosen Moonberries state. Product text remains accessible and outside Rive; the
sign is not another inventory, order board, or progression system.
