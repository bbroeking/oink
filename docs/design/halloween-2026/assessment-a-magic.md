# Assessment A — making cards and openings feel magical

## Scope and evidence

This is an independent critique of the current local prototype, not a proposal already present in code. Evidence reviewed:

- `components/prototypes/card-packs/CardExperience.tsx`
- `CollectibleCard.tsx`, `OpeningCeremony.tsx`, and `PerformanceStage.tsx` beside it
- the 393px captures `new-card-preview-393.png`, `preview-unlock-receipt-393.png`, `base-seasonal-family-comparison.png`, and `card-contact-sheet-393.png`

The local preview at `http://127.0.0.1:4320/` refused the connection, so interaction judgments come from source plus committed captures. The captures are browser render evidence, not verification of native iOS rendering, gesture feel, audio, haptics, performance, Dynamic Type, or reduced-motion behavior on device.

## Verdict

The system is clear, warm, and unusually responsible about ownership and recovery, but the collectible itself is visually subordinate to its template. Spooky Snouts has good individual illustrations; it does not yet feel like a season possessed the cards. At 393px, the receipt turns the prize into two small documents and the unlock into explanatory text. The opening has the right verbs—pick up, tear, reveal, swipe, inspect—but the emotional curve is nearly flat because the card is already visually knowable, rarity changes little, and the receipt resolves as inventory administration.

The highest-value direction is to make the card a painted object first and a rules document second, then stage one controlled moment of uncertainty around each reveal. Preserve the cozy scrapbook material language; let Halloween alter the paper, framing, light, silhouette, card back, and reveal behavior rather than merely changing the art inside a shared lilac frame.

## Design specificity

Specificity is **moderate (2.5/4)**. The packet copy (“A little rustle…”, “three little discoveries”), cream paper, ink outline, Caprasimo/Nunito voice, hard shadows, and tactile gestures belong to Tickle the Pig. The card face itself is closer to a generic tabletop catalog template: title box, framed art window, rule box, dark disclaimer band, metadata footer. The seasonal cards use the same perimeter, cream field, spacing, and hierarchy across item, place, rare, epic, and legendary cards. In the contact sheet, the dominant memory is “34 repeated lilac rectangles,” not moonlit orchards, stitched costumes, witch wood, or peculiar bog relics.

The art varies more than the object. Items float on a large beige field; places are cropped into the same aperture; legendary and uncommon cards differ primarily through tiny footer marks. The shared frame is so loud and regular that it neutralizes the set's painted differences. `CollectibleCard` also gives every seasonal unlock the same lilac perimeter and dark collection band, which explains the captured uniformity.

## Emotional journey

1. **Anticipation — promising.** A physical packet, pull seam, “A little rustle…,” visible progress ticks, sound/haptic hooks, and a dark performance stage establish ritual. The saved-place message lowers anxiety without breaking tone.
2. **Threshold — functional, too explicit.** “PULL TO OPEN,” percentage-open copy, and a simultaneous Open button make the interaction accessible, but the precise percentage converts a tactile fiction into a progress control. There is no visible clue on the sealed object about the set's atmosphere or the possible character of what is inside.
3. **Reveal — readable, weak escalation.** The card rises and settles, foil can gleam, and the player can swipe it away. But each reveal uses essentially the same scale and choreography. The `NEW TO YOUR ALBUM` badge communicates state after the visual beat rather than letting the object itself announce surprise. Rare/legendary cards do not appear to receive a meaningfully different hold, sound texture, light, or entrance.
4. **Discovery — split attention.** “Inspect card” competes with “Swipe or reveal next.” The card already contains title, type, rarity, unlock rule, collection disclaimer, set number, rarity marks, and footer rule, so the player is asked to read a dense miniature while also deciding whether to continue.
5. **Payoff — administrative.** The receipt headline is warm, but two-column compact cards at 393px make the prize smaller at the exact moment it should feel owned. “Permanent cosmetic unlocked…” repeats below each card; the panel then explains prototype limitations. The outcome is technically trustworthy and emotionally deflating.

## Cognitive load

**Moderate: 3 of 8 checklist failures.** The ceremony has one primary object and sequences cards one at a time; controls are few, state is saved, and a reveal counter remains visible. It fails visual hierarchy because dense card furniture competes with the illustration; it fails grouping because unlock meaning is repeated across card face, badge/caption, and receipt panel; it partially fails one-thing-at-a-time because inspect and next are presented together while the player is still decoding the card. Working-memory demand stays within four items, but reading demand is high for a reward moment.

For a distracted mobile player, the open and next controls are reachable and the receipt preserves ownership, but small card copy and a two-column 393px receipt will be scanned rather than enjoyed. For a first-timer, the explicit controls and saved-state language are strong, though “foil,” rarity initials/stars, and collection/deck legality crowd the first emotional encounter. For an accessibility-dependent player, source shows labels, a polite live-region reveal announcement, button fallback for gestures, Skip, and reduced-motion support; native VoiceOver order, focus return after inspection, contrast under foil washes, and 44pt targets remain unverified.

## Nielsen heuristic scores

| Heuristic | Score | Reason |
| --- | ---: | --- |
| Visibility of system status | 4 | Reveal ticks, live announcement, tear progress, settling state, saved ownership, receipt, and recovery copy are unusually explicit. |
| Match with the real world | 3 | Packet, seam, card stack, swipe, album, and scrapbook metaphors are natural; percentage-open copy and prototype/legal language puncture the fiction. |
| User control and freedom | 4 | Skip, button alternatives to gestures, inspect/back, resume, receipt revisit, and reduced motion provide exits and recovery. |
| Consistency and standards | 3 | Interaction and typography are cohesive; seasonal identity is over-normalized, and the prototype's custom top-level web-like navigation is not verified as native app structure. |
| Error prevention | 4 | Ownership is committed before presentation, duplicate/opening recovery is explicit, transition locks prevent double advance, and gestures have thresholds/fallbacks. |
| Recognition rather than recall | 4 | Current position, remaining cards, new/repeat state, visible actions, and receipt are present in context. |
| Flexibility and efficiency | 3 | Swipe, button, Skip, resume, and reduced-motion/static paths support different users; experienced openers still receive the same per-card pacing. |
| Aesthetic and minimalist design | 2 | The central art is boxed by repeated title/rules/collection/footer furniture; the compact receipt shrinks the reward and repeats unlock information. |
| Error recognition and recovery | 4 | Source contains plain-language failure-before/after-commit scenarios and an explicit resume path without losing ownership. |
| Help and documentation | 3 | Instructions are contextual and concise in the ceremony; specialist markings and deck-legality language compete with the reward without helping this immediate task. |

**Total: 34/40 (Good).** This is a strong usability skeleton carrying an underpowered collectible fantasy. The scores should not be read as native QA.

## What already works

1. **The ceremony respects ownership.** Saving before performance, resuming the same packet, and stating “Owned before the tear” remove the worst anxiety from reward openings. This is good product design and lets presentation become more daring without threatening trust.
2. **Tactile access is thoughtfully layered.** Pull, swipe, button equivalents, Skip, inspection, reduced motion, sound toggle, and haptic toggle give the ritual more than one route. The source has purpose-built reveal/receipt/tear cues rather than motion for decoration alone.
3. **The illustrations have a coherent cozy Halloween voice.** Witch wood, lantern paths, stitched bows, pocket crystal ball, pumpkin cap, and moonlit locations fit the painted scrapbook world. The raw material is stronger than the frame that currently contains it.

## Prioritized weaknesses

### P1 — The shared frame erases seasonal and rarity identity

Every seasonal unlock receives substantially the same lilac perimeter, cream title/rule field, dark collection band, and metadata footer. At contact-sheet scale, rarity and category require reading tiny labels; a legendary place and a rare hat do not create different silhouettes or visual gravity. This is why the season feels like a content swap rather than an event.

**Change:** establish category-specific compositions inside one collectible family: full-bleed painted locations, portrait-like wearable studies, relic still lifes, and a rarer “storybook plate” treatment. Give rarity a material consequence—edge treatment, paper stock, foil area, layered ink, or die-cut silhouette—without adding new stats or odds.

### P1 — Artwork is too small and too detached from the card object

Item art floats in a beige window with large unused margins; location art is trapped in the same window. Title, rule, disclaimer, and footer occupy nearly half the surface. The picture feels inserted into a form instead of painted onto a collectible.

**Change:** let art occupy roughly 70–85% of first-glance area. Layer the name, type mark, and unlock seal over controlled negative space in the painting; move legality, set number, and repeated unlock explanation to the back or inspection view. Locations should bleed to edges; items should sit in a painted vignette with cast shadow, scraps, foliage, moonlight, or evidence of use.

### P1 — Reveal beats do not build or vary

The opening supplies tear, rise, settle, swipe, and foil gleam, but every result follows the same tempo. The player sees explicit progress and the full templated face almost immediately. There is little “what is this?” interval, and rarity does not appear to change the ceremony.

**Change:** stage three readable beats: **shadow** (back/silhouette, 250–400ms), **turn** (category and palette become legible), **claim** (name/unlock seal lands with audio/haptic punctuation). Hold rare cards slightly longer through composition and sound, not through an unskippable delay. Keep Skip and reduced-motion alternatives.

### P1 — Unlock payoff is text, not transformation

The receipt says a cosmetic unlocked, but the captures show no visual movement from card to owned item and no glimpse of the pig or place changed by it. “Permanent cosmetic unlocked” is accurate yet fails the product rule that the world speaks in pictures.

**Change:** after the card claim, peel an illustrated unlock seal from the card and land it into a tiny scrapbook slot or a brief Rosie/place preview. On receipt, show the three finds as pinned keepsakes with one clear “now yours” visual state. Keep prototype disclaimers outside the ceremony or behind review controls.

### P2 — The receipt collapses the crescendo

At 393px, two compact cards plus tags and paragraphs create a small catalog grid. The headline has energy, then the eye drops into dense repeated modules. The final action is “Keep in album,” which is safe but emotionally neutral.

**Change:** use a single horizontal fan or layered stack large enough to recognize the art, with a tap to bring one forward. Summarize shared facts once: “3 finds · 3 new · 3 wardrobe pieces.” End on the collection changing visually—a filled scrapbook pocket, three new pins, or Rosie holding the packet remnants.

### P2 — The card back is missing as a source of anticipation

The source constructs deck-back rectangles during reveal, but no distinct seasonal card-back identity is evidenced in the captures. A generic hidden rectangle wastes the most useful mystery surface.

**Change:** create a tactile Spooky Snouts back: cream-black paper, stitched moon emblem, uneven ink registration, a tiny category tell that rewards attention without disclosing the item, and restrained foil ink for special finishes.

## Three bolder directions

### 1. The Moonlit Story Plate — recommended

Treat every seasonal card as a small painted storybook plate mounted into the scrapbook. Art bleeds under the frame; only a narrow torn-paper name strip and wax-like unlock seal sit above it. Locations use full bleed and foreground foliage; wearables are staged in miniature bog still lifes rather than isolated on beige. The back carries a stitched moon crest. On reveal, moonlight travels across the back, the card turns, then the unlock seal lifts into the receipt.

Why it fits: it makes the existing art valuable, stays cozy rather than horror-loud, and gives items/places distinct composition while preserving one recognizable family. It is also the most sustainable direction: painters can deliver a scene plus safe text zones without inventing a unique UI frame for every card.

### 2. The Trick-or-Treat Scrap Packet

Make the packet a messy envelope of found Halloween ephemera: tissue, twine, leaf scraps, wax spots, and handwritten names. Each reveal is physically different in small ways—one slides from tissue, one is stuck under tape, one arrives face-down with a stitched tab. Cards retain a clean painted center, but borders use collage layers keyed to category. The receipt is the opened envelope laid flat with the finds tucked into it.

Why it fits: strongest tactile surprise and most literal paper-craft expression. Risk: too many per-card variants could outrun the art/animation pipeline, so variability should come from a small reusable assembly kit rather than bespoke sequences.

### 3. The Haunted Lantern Theatre

Keep the dark ceremony stage, but turn it into a tabletop shadow theatre made of cut paper. A lantern reveals only silhouette and category; the player drags light across it to expose painted color. Places open outward as scenery; wearables swing forward like paper puppets; foil catches as metallic ink rather than a white digital sheen. The receipt returns to warm cream as a contact print of the performance.

Why it fits: most magical and season-specific, with audio/haptic opportunities—a paper rasp, lantern click, soft chime, heavier rare-card thump. Risk: the bespoke motion and mask work is highest; prototype one item and one place before committing.

## Recommendation

Choose **The Moonlit Story Plate** as the card system and borrow one restrained beat from **Haunted Lantern Theatre** for the opening. Build the experience around this sentence: **pull the packet, glimpse a moonlit silhouette, turn over a painted keepsake, watch its unlock seal join your scrapbook.**

The first design proof should contain only four frames at 393px: sealed packet, seasonal back/silhouette, one item and one place at full reveal, and the three-card ownership receipt. Use the same two rewards in every comparison so scale, layering, rarity material, and payoff can be judged directly. Prototype audio/haptics as named beats—paper pull, turn thump, rare chime, seal peel—while keeping them optional and avoiding louder-or-longer rarity theatrics. Validate the result on native hardware before treating browser motion or haptic timing as real.
