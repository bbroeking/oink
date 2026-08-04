# Beyond the Hedge - Canonical Direction and Prototype Brief

**Status:** Canonical creative direction; gameplay implementation remains a prototype

**Ratified:** 2026-08-04

**Primary prototype:** docs/idle-lab.html

**Playtest protocol:** docs/beyond-the-hedge-playtest-guide.md

Run locally with one command:

```sh
python3 -m http.server 4174 --directory docs
```

Then open `http://127.0.0.1:4174/idle-lab.html?variant=A`.

## Goal

Design and validate **Beyond the Hedge** as Rosie's idle-adventure universe: transform the ordinary countryside around the Barn into a deep, cozy micro-wilderness that feels wondrous at pig height. Players choose where Rosie goes, how long she wanders, what Tool and Pack she carries, and what she intends to notice. Those preparations must understandably change her encounters, stories, and named discoveries. Every return should foreground one memorable thing, demonstrate how the player's care mattered, and leave a visible trace in Home. Prove the idea with a playable Clover Verge chapter that makes players want to change one preparation choice and send Rosie out again—not to optimize a payout, but to discover what else a familiar place contains.

## Core belief

> Familiar places contain impossible depth—and Rosie may notice something nobody else would.

## Product promise

> Choose where Rosie will wander, pack the two things that might matter, let time carry her through an unseen story, and welcome her Home with something you could not have found any other way.

## World laws

1. **The world begins at Home.** The first great adventure is just beyond the Barn, not through a portal to a separate fantasy game.
2. **Pig height changes meaning.** A culvert can be a cave, a puddle can hold a sky, and a fencepost can hide a bell.
3. **Rosie notices sideways.** Her curiosity, nose, humor, and kindness reveal things a conventional hero would overlook.
4. **Magic remains faint.** The world may be impossible, but it should still feel touchable, local, and half-explainable.
5. **Absence is kind.** Rosie never returns injured, ashamed, or empty because the player chose badly or stayed away too long.
6. **Preparation creates possibility.** Tools create verbs, Packs preserve kinds of Finds, and Intentions bias Rosie's attention.
7. **Every Adventure leaves a trace.** Home, Rosie's Bag, the map, a collection, a relationship, or a shared Sounder memory changes.

## Canonical player loop

    NOTICE a possibility near Home
    -> CHOOSE a destination and trip shape
    -> PACK one Tool and one Pack
    -> GIVE Rosie an Intention
    -> LET the Adventure unfold while away
    -> WELCOME Rosie Home before showing rewards
    -> REVEAL one memorable Find and how preparation mattered
    -> CHANGE Home or Rosie's remembered world
    -> FORM a hypothesis and send her out differently

## Authorship contract

The player does not direct Rosie beat by beat. The player creates the conditions for a story and then learns what Rosie did with them.

- **Player authorship:** destination, trip shape, Tool, Pack, Intention, and the decision to revisit.
- **Rosie's authorship:** route behavior, character response, humor, small choices, and the story she tells.
- **System authorship:** current condition, available encounter, relationship state, and controlled variation.

The return must make those three sources legible without showing a probability table.

## Progression promise

Progression expands authorship rather than power:

- Reach new places and deeper layers of familiar places.
- Gain Tools with new verbs.
- Gain Packs that preserve new kinds of Finds.
- Learn conditions and relationships well enough to prepare intentionally.
- Express Rosie's history through her Bag and Home.
- Belong through kind, non-ranked Sounder projects.

There is no generic Adventure power score.

## Reward promise

Every return foregrounds one named headline result: a Wonder, Curio, Discovery, Pattern, Clue, relationship beat, or meaningful Near-Discovery. Supporting materials may exist but cannot become the emotional center.

A good reward answers at least one question:

- What new place can Rosie reach?
- What new encounter can happen?
- What can she now preserve or bring Home?
- What changed at Home?
- What story or relationship deepened?
- What can the player remember, display, or share?

## First chapter - Clover Verge

### Place truth

Clover Verge is the apparently ordinary strip of countryside beyond the Barn path. At pig height it contains clover tunnels, a puddle that holds the whole sky, a humming fencepost, and a hedge-bottom repository of lost human objects.

### Chapter question

Why does a blue button appear beside the Barn path after every rain when nobody at Home owns a blue coat?

### Prototype content

- **Landmarks:** Rain-Glass Puddle and Hollow Fencepost.
- **Conditions:** dry afternoon and after rain.
- **Tools:** Wooden Spoon and Lantern.
- **Packs:** Wicker Basket and Dry Bag.
- **Intentions:** Look for something strange; Bring something for the Barn.
- **Finds:** Blue Button, Bent Thimble, Creek Glass, Clover Beetle observation, and Hedgehog-Crest Token.
- **Near-Discovery:** Rain-Glass that dissolves before the Wicker Basket reaches Home.
- **Wonder:** Hedge Bell.
- **Permanent consequence:** Hedge-Tunnel Crossing opens toward Moonlit Creek and the bell hangs at Home.

## Prototype question

> Does making one understandable preparation change create enough anticipation and causality that the player wants to send Rosie back to the same familiar place?

The hosted lab provides three structurally different ways to answer it:

- **A - Pack the Bag:** preparation-first; the Bag is the primary decision surface.
- **B - Walk the Verge:** place-first; opportunities are anchored to the living destination.
- **C - Welcome Home:** return-first; Rosie's story and the next hypothesis drive replay.

All variants share one in-memory state. Switching ?variant=A|B|C changes presentation, not simulation.

## Validation criteria

The slice succeeds when observed players can:

1. Describe Clover Verge as more than a timer destination.
2. Explain how the Tool, Pack, Intention, or trip shape changed what happened.
3. Remember the headline Find by name after the return.
4. Treat a Near-Discovery as a useful promise rather than a denied reward.
5. Point to a lasting change in Home or Rosie's remembered world.
6. Form a world-based hypothesis and change one preparation choice.
7. Say what they hope Rosie finds next.
8. Want to revisit Clover Verge after the Hedge Bell is found.

## Revision triggers

- If players ask for percentages before choosing, improve condition and affordance language.
- If they scan rewards and skip Rosie, reduce supporting Finds and strengthen her opening line.
- If the “correct” Pack feels compulsory, create two valid but different outcomes.
- If the Near-Discovery feels punitive, let it produce knowledge or a smaller Find immediately.
- If the return feels like a reward chest, show Rosie before any inventory surface.
- If the Wonder exhausts Clover Verge, add a post-Wonder relationship or condition.
- If players remember rarity but not names, revise the objects and consequences before adding content.

## Boundaries

- No combat, injury, power scores, rarity ladders, or optimized farming.
- No continent-scale fantasy requirement.
- No single mystery that explains the entire countryside.
- No energy system, timer skip, paid reroll, Discovery odds, or sold equipment advantage.
- No ranked Sounder contribution or punishment for absence.
- No expansion to a second destination until Clover Verge proves preparation, return, and replay.

## Open validation decisions

These remain hypotheses until the prototype is observed:

- Whether adventure Discoveries broaden the existing Field Guide or need a neighboring journal.
- Whether the Bag is primarily a send-off interface, a character-history object, or both.
- Which trip-shape names and real durations fit normal TTP check-in rhythms.
- Which return layout best balances Rosie's story, the Find, and the immediate resend decision.

## Prototype verification log

### 2026-08-04 - Mechanical and interface pass

Verified locally against the shared in-memory simulation:

- Wicker Basket produces the Blue Button plus a fair Rain-Glass Near-Discovery.
- Changing only the Pack to Dry Bag preserves Creek Glass.
- Changing the trip shape to Good Wander while retaining the Wooden Spoon reveals the Hedge Bell.
- The Hedge Bell creates a visible Home consequence and opens Hedge-Tunnel Crossing toward Moonlit Creek.
- Variants A, B, and C preserve the same state while changing the information hierarchy.
- The floating switcher updates the shareable `?variant=A|B|C` URL and supports arrow-key navigation.
- All three variants fit a 390px viewport without horizontal overflow.
- The page reports no browser console errors during the full three-trip sequence.

This verifies implementation causality and presentation structure. It does **not** yet prove memory, anticipation, delight, or willingness to revisit; those require observed player sessions against the eight validation criteria above.

### Validation instrument

The prototype now withholds exact solution buttons: a return offers **Change one thing**, then requires the tester to infer the relevant Tool, Pack, Intention, or trip shape from Rosie's story. After the Hedge Bell, a local-only verdict sheet compares the behavioral trace with three self-reports:

- What primarily pulled the tester back.
- Which interface made them want to act.
- Whether they would send Rosie again after the Wonder.

The optional copied trace contains preparation changes, returns, variants viewed, and answers, but no persistence or player identifier. Use docs/beyond-the-hedge-playtest-guide.md for the unprimed facilitator script and five-person pass thresholds.

Verified locally on 2026-08-04:

- The Blue Button return names a waterproof possibility but exposes no Dry Bag shortcut.
- The tester must reopen preparation and manually choose Dry Bag.
- The Creek Glass return likewise requires a manual trip-shape inference.
- The trace correctly reports both preparation changes, all returns, variants viewed, and verdict answers.
- The verdict sheet and copyable trace remain within a 390px viewport in all variants.
- The full instrumented sequence reports no browser console errors.
