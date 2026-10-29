# Card magic and pack-opening deep dive

October 14, 2026. Method: two isolated reviews,
`card_magic_review` (design) and `opening_evidence` (detector/runtime).
The user asked to pull up seasonal cards and explore why the cards and opening
feel boring. This is design research and a concrete visual workshop, not a
change to reward authority, dates, odds or shipping UI.

## Main finding

The interaction plumbing is stronger than the presentation. Ownership is
committed before the performance; interruptions, inspection and Skip preserve
the result. Gesture alternatives and reduced-motion paths already exist.
The artwork has the right cozy painted voice. The shared frame makes the
34 seasonal rewards feel too similar, however: small objects float on beige
while repeated unlock copy and disclaimer panels dominate the card.

The highest-value change is a painted keepsake whose picture leads, coupled
with one short moment of uncertainty before a reveal and a visual ownership
payoff afterward. More particles alone will not solve the composition.

## Design health

| Area | Score / 4 |
| --- | ---: |
| Status and progress | 4 |
| Familiar physical metaphors | 3 |
| Player control | 4 |
| Consistency | 3 |
| Error prevention | 4 |
| Recognition over memory | 4 |
| Speed and flexibility | 3 |
| Visual hierarchy | 2 |
| Recovery | 4 |
| Contextual help | 3 |

Total **34/40**. All ten heuristics apply. This is a usability assessment,
not a score for how magical the result feels, and not native acceptance.
Emotional journey: promising packet -> diagnostic percent-open progress ->
similar card entrances -> dense reading -> administrative receipt.
Cognitive load is moderate: image and repeated ownership explanations compete,
and inspect/next arrive while the player is still reading.

## Priorities

1. **P1: illustration first.** Give art roughly 70–85% of the first-glance face.
   Use a short name ribbon and small category/rarity mark. Preserve exact names
   and collector numbers; put detailed collection-only rules in inspection or
   the back. Full-bleed places and staged item still lifes can share one family.
2. **P1: rarity and finish have distinct jobs.** Rarity changes reveal punctuation
   and a stable material/mark cue. Foil changes how metallic ink catches light;
   living gets a small authored subject animation. A color change alone does
   neither job. Avoid obscuring text or depending on hue.
3. **P1: a readable mystery beat.** Give the season its own back, show back or
   silhouette, turn, then claim. Keep the player in control of Next and Skip.
   Do not invent a near miss, reroll, different odds or new rarity tiers.
4. **P1: ownership should be visible.** Peel a seal into a scrapbook pocket or
   show the named item joining the collection. Real pig try-on waits for
   shipping wearable assets and verified fits.
5. **P2: preserve the crescendo in the receipt.** A recognizable fan of three
   finds, with tap-to-front inspection, beats a dense small-card grid. Repeat
   copy status still appears clearly and never grants another cosmetic.
6. **P2: keep the fiction intact.** Preserve accessible controls and saved-state
   reassurance, but replace percentage-open diagnostic copy with physical
   feedback. Keep internal prototype warnings outside the reward composition.

For first-time players, jargon and small markings crowd the reward. For
distracted players, short readable beats matter more than a forced movie.
For experienced openers, fast/repeat paths matter. For VoiceOver and reduced
motion, the same outcome and labeled controls must remain directly available.

## The craft choices to compare

Keep five axes distinct. **Identity/type** names the item or place and its
permanent unlock. **Rarity** names its existing rarity class and can guide a
material mark/reveal accent; no new odds are being designed. **Finish** is the
same identity rendered standard, foil or living, without a second cosmetic.
**Art treatment** changes composition, such as a frame break or shallow
diorama, rather than gameplay. **Season** gives the collection a back, wrapper
and atmosphere. An epic item can have a foil finish; those are separate
properties. A living treatment needs actual authored motion, not just tint.

| Part | Current evidence | Proposed job |
| --- | --- | --- |
| Card front | 300 × 420, 190px beige art aperture, repeated panels | Picture-led keepsake; legible short name |
| Card back | Shallow stack rectangles; little seasonal identity | Stitched moon, seasonal ink, mystery before turn |
| Finish | Foil: 650ms gleam + 10% wash; living: tint | Finger-responsive metallic ink or restrained subject motion |
| Rarity | Metadata and tiny footer marks | Shape/material mark plus a short reveal accent |
| Gesture | Horizontal pull dx/230, button alternative | Paper resistance, seam stretch, rupture feedback |
| Anticipation | Auto-first reveal after 350ms | Brief back/silhouette/light glimpse |
| Reveal | Rise, settle, swipe; nearly shared choreography | Shadow -> turn -> claim; category-specific cue |
| Sound/haptics | Hooks and toggles in code; not device-verified | Paper rasp, seam snap, soft turn, rare chime at named beats |
| Unlock | Named text and local ownership map | Seal/item joins a scrapbook pocket |
| Receipt | Compact grid and repeated explanatory copy | Three large recognizable finds; repeat state once |
| Accessibility | Skip/buttons/reduced motion and semantic labels | Identical reward state with static/crossfade lane |
| Rendering | Rive packet/open transition; React Native settled card | Explicit single choreography contract across the handoff |

## Three directions in Claude Design

The existing owned [Halloween canvas](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Halloween+-+Spooky+Snouts.dc.html)
now contains a Card magic workshop, using the selected Tickle the Pig
Design System. The same Moonbrew Witch Hat (SSN001), Hedge Broom (SSN002), and
foil Lantern Porch (SSN017) fixture makes the directions comparable.

The first broad workshop request ended after reference inspection without a
rendered addition. A smaller retry completed three static Moonbrew fronts,
three corresponding seasonal backs and a craft matrix. Interactive opening
proofs are the next slice, not a claimed result of that smaller pass.

The lead inspected the comparison at 1280 × 900, and all three fronts at
393 × 852. The fronts fit phone width and their names remain readable. These
are composition/material studies using existing Moon Firefly/Bog Frog raster
crops plus explicitly labelled concept drawings. They are not finished
painted hat art, working foil shaders or an implemented opening ritual.
Remaining design observations: A needs a larger hero-item silhouette, B's
small footer needs a clean text strip separated from stitch decoration, and
the drawn hat/stump/cushion/theatre elements need final painted assets.
The strongest synthesis is A's painted world, B's larger frame-breaking
subject, and C's short silhouette reveal.

Saved evidence: [desktop comparison](claude-card-magic-workshop-desktop.png),
[story plate on phone](claude-card-magic-workshop-phone.png),
[foil on phone](claude-card-magic-foil-phone.png), and
[theatre on phone](claude-card-magic-theatre-phone.png).
The temporary presentation tab was closed and the viewport override reset.

| Direction | Card object | Opening | Cost / risk |
| --- | --- | --- | --- |
| Moonlit Story Plate | Painting, hand-cut perimeter, name ribbon, unlock seal | Moonlit back -> turn -> scrapbook claim | Best starting point; needs composed art and safe text zones |
| Foil Keepsake | Layered paper, metallic moon/stitch ink, foreground frame break | Tactile tear; tilt exposes finish | Needs layer masks, responsive material and low-cost fallback |
| Lantern Shadow Theatre | Small painted stage and seasonal back | Lantern exposes silhouette, then color | Strongest Halloween surprise; more authored masks and choreography |

Recommendation: use **Moonlit Story Plate** as the collectible family and borrow
one restrained lantern/silhouette beat for the reveal. Do not force every
ordinary card into the most expensive animation treatment.

The existing Card Depth Studies exploration already investigates layered
storybook, Living Legend and bog diorama cards. It is complementary:
dimensional treatment changes the artifact; this workshop adds the seasonal
front/back, packet ritual and cosmetic-ownership payoff. Its existing model
concepts are not evidence of an installed native 3D renderer.

## Reference patterns

Verified against first-party pages on October 14; these facts and our proposed
adaptations are distinct:

- Pokémon TCG Pocket describes immersive cards as entering the illustration.
  Our adaptation: a short sense of place inside the card, rather than another
  inventory form. [Official product page](https://tcgpocket.pokemon.com/en-us/)
- Marvel Snap documents frame breaks, parallax, animation, shiny logos and
  animated borders as visual upgrades. Our adaptation: foreground separation
  and finish behavior, preserving Oink's painted materials.
  [Official support](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/faq/34-what-does-upgrading-a-card-do/)
- Hearthstone's 2023 Signature redesign gave art more room with a thinner frame
  and moved rules into inspection. Our adaptation: reduce repeated information
  on cosmetic fronts while keeping it accessible.
  [Official 26.0 notes](https://hearthstone.blizzard.com/en-us/news/23934449)

No reference economy, monetization or odds are proposed here.

## First implementation slice

Prove one three-card seasonal opening and one shared frame treatment:

1. One item front, one place front and one seasonal back with exact native text.
2. Standard/foil material comparison; keep existing finish identities.
3. Pull, mystery glimpse, turn and claim, with button and Skip equivalents.
4. One visual scrapbook ownership payoff, then a three-find receipt.
5. Explicit choreography timestamps and completion signals shared by Rive and
   React Native; no visible crop/scale/finish switch at the handoff.
6. Static/reduced-motion/readiness-error alternatives that show the identical
   saved receipt, plus interrupt/resume tests.
7. Verify on small and current iPhones, VoiceOver, Reduce Motion, silent mode,
   app background/foreground, and physical-device sound/haptics/frame pacing.

An 8–12 second first-time three-card sequence is a **creative target**, not a
measured current duration; the player controls Next, and repeat/Skip can be
faster. Additional living-card layers come after this slice is convincing.

## Evidence limits and minor findings

Both reviews were isolated and used source plus the saved 393px and 320px
captures. Their fresh browser attempts found the local server offline. The
lead restored localhost4320, verified a fresh live seasonal card view, then
replayed the fixed three-card packet with Reduce Motion off in a separate
in-app review tab. Open, both Next transitions and the final receipt settled
correctly; screenshots are `magic-baseline-sealed.png`,
`magic-baseline-reveal.png` and `magic-baseline-receipt.png`.
The seasonal ceremony still displays the ordinary Rosie's Loadout wrapper,
and epic item / rare item / foil place use closely related choreography.
This fresh web replay does not prove native haptics or frame pacing.
The temporary review tab was closed; the user-facing seasonal card view stays
open. The localhost preview server is retained for the requested live preview.
The detector ran once and reported two advisory undocumented finish colors:
`CollectibleCard.tsx:133` (#fff1b8) and :134 (#eee7ff). They are governance
drift, not demonstrated contrast failures or the main visual problem.
No ignore list exists. Read-only browser controls prevent detector injection;
no overlay is claimed.

Native iOS/Rive handoff, actual sound, haptic feel and frame-time budget remain
unverified in this research. The seasonal pack remains local demo ownership.
The artwork is card art, not an all-frame wearable-fit certification.

Questions skipped: a mood preference was already requested; the comparison
uses cozy storybook magic as its starting point while retaining all three
directions for review.
