# Rosie's Loadout visual system

## Art direction

**Creative direction: illustrated storybook equipment card.**

The illustration remains the card's first read, but the frame now teaches the
game before the player reads the rules. Every front has a compact title plate,
a rank or Cheer socket, a style-colored perimeter, an illustration field, and
separate Play and Training hardware. Legends replace Training with
a named Legend Ability and two favored-style plates.

The shared visual grammar is:

- one uniform, cut-safe trading-card silhouette;
- an ink-dark outer shell and restrained class-colored frame;
- a shallow parchment title plate;
- a large Rank socket or heart-shaped Cheer medallion;
- a dominant illustration field with type-specific edge details;
- a light Play cartridge or coral Legend Ability field; and
- a compact rules footer that stays readable at printed size.

This is informed by the information architecture of the original MapleStory
iTCG: character actions are stacked in discrete rows, combat values live in
fixed edge sockets, class color owns the frame, and every deck card preserves a
visually separate lower level-up action. We are borrowing those structural
ideas, not its leaf marks, frame drawings, class icons, or trade dress. The
source breakdown and translation rules are recorded in
[`MAPLESTORY-FRAME-STUDY.md`](./MAPLESTORY-FRAME-STUDY.md).

The base set has eight visible front treatments:

| Layout | Primary read | Unique structure |
| --- | --- | --- |
| Legend | One of the six pigs you play | Scene-filling portrait, Cheer medallion, named Legend Ability cartridge, paired favored-style plates |
| Head Gear | Protection | Artifact reveal, Guard medallion, angular Rank socket |
| Held Gear | Attacking | Artifact reveal, Bash medallion, angular Rank socket |
| Aura Gear | Persistent loadout effect | Environmental glow as the subject, no combat stat medallion |
| Critter | Friendly board unit | Creature scene, paired Bash and Hearts medallions |
| Enemy | Trouble played against an opponent | Paired combat medallions and a toothed upper art rail |
| Stunt | Immediate one-shot action | Moment-in-progress composition and a broad rules cartridge |
| Place | Persistent destination | Controlled full-art environment beneath a compact map plaque and translucent field-note panel |

Every deck card keeps the same reading order without sharing an identical stack
of boxes:

1. Name, type, rank or Cheer, style, and rarity
2. Illustration
3. Board stat medallions, where applicable
4. Play text
5. A quiet flavor inscription
6. Training strip
7. Collector line and the card's persistent zone reminder

Legends are Legend cards that begin outside the deck, so their lower
band shows favored styles instead of Training.

## Typography

Typography is assigned by narrative job:

- **Fredoka Bold** — card names and named actions. It appears dark on a light
  plate, never as large outlined display text over the painting.
- **Nunito ExtraBold** — rules, metadata, style names, and Training instructions.
- **Patrick Hand** — epithets, flavor inscriptions, and the small storyteller voice.
- **Caprasimo** — numbers inside stat seals and rarity marks only.

The hierarchy is name → named action → rules → metadata. Uppercase is limited to
small navigational labels such as `TRAINING ACTION`, `PLAY`, and `RANK`.

## Six Legends

The six pigs are a complete Legend roster, not ordinary cards hidden
inside the set:

| Card | Pig | Favored styles | Character role |
| --- | --- | --- | --- |
| 001 | Rosie | Brave + Spark | Gear-driven hand shaping |
| 002 | Copper | Brave + Steady | Critter attacker |
| 003 | Pepper | Steady + Spark | Critter defender |
| 004 | Bandit | Brave + Spark | Stunt-to-Gear pressure |
| 005 | Pickles | Steady + Spark | Deck scouting |
| 006 | Biscuit | Brave + Steady | Head Gear recovery |

All six carry `legend: true`, `startsOutsideDeck: true`, and `fullArt: true`,
have dedicated 1024×1536 narrative illustrations, start at 12 Cheer, and remain
outside the deck. The generated `visual-system/legend-roster.png` shows the
complete cast together; `visual-system/legend-roster-detail.png` is the
large-format inspection proof.

### Legend color system

Color has three different jobs and those jobs do not compete:

1. **Legend class colors are shared.** Every Legend uses cocoa ink
   (`#2A1F15`), warm parchment (`#FFF0DD`), coral frame (`#F17868`), and coral
   ability field (`#F58B78`). At a glance, six different pigs still read as one
   card class.
2. **Pig identity is a small accent.** Rosie uses poppy red, Copper trail
   orange, Pepper moon blue, Bandit saddle brown, Pickles orchard green, and
   Biscuit oat brown. The accent is limited to the identity underline,
   Cheer medallion, ability seal, and center snout. It never recolors the
   entire rules field.
3. **Mechanical style colors are invariant.** Brave is coral-red, Steady is
   leaf green, and Spark is violet on every card. These colors appear only in
   the favored-style chips and rules icons, so players can learn them once.

Illustration palettes are intentionally free to vary by scene. They do not
redefine the frame or mechanical colors.

### Legend footer

The front footer carries only two pieces of useful information:

- left: the snout set mark and `001/88` collector number;
- right: `OUTSIDE DECK`, the rule players need while setting up.

The set mark sits with the number instead of interrupting the center of the
footer. The QR is visible on the physical card back, so the front no longer
spends scarce space saying that a QR exists.

### Print legibility

Legend fronts use four primary reading zones: identity, illustration, ability,
and setup metadata. The Cheer medallion is subordinate to the name rather than
sharing its baseline. Rules text is 26 units in the 750×1050 master, favored
style names and footer text are 22, and the flavor caption is at least 20.
Production abbreviations and redundant QR reminders are omitted rather than
shrunk into microtype.

The full-art paintings are stored in
`assets/images/trading-cards/full-art/`. They use the pigs' production sprites
only as identity references; the card artwork itself is a complete environment
with foreground, midground, background, lighting, and an action beat.
The shared generation stem and six scene briefs are recorded in
[`FULL-ART-PROMPTS.md`](./FULL-ART-PROMPTS.md).

## Rarity symbols

Rarity uses an original **bog truffle** symbol. Color is secondary: each tier also
has a letter and an increasing number of sparkle marks, so the system survives
grayscale printing and common forms of color-vision deficiency.

| Rarity | Mark | Color | Sparkle count |
| --- | --- | --- | --- |
| Common | C truffle | warm gray | 0 |
| Uncommon | U truffle | reed green | 1 |
| Rare | R truffle | lagoon blue | 2 |
| Epic | E truffle | lilac | 3 |
| Legendary | L truffle | bog gold | 4 |

## Illustration readiness

All 88 cards have an explicit art assignment and status. The 34 cards that
previously required new illustration now have a complete first generated pass;
the remaining adaptation cards still need a dedicated illustration treatment.

| Status | Cards | Meaning |
| --- | ---: | --- |
| Art ready | 79 | Existing game art or a selected first-pass card painting is assigned |
| Adapt game art | 9 | Existing icon or asset is a composition source, but needs a card illustration pass |
| New illustration | 0 | No card remains without an assigned image |

Warm Tea and the other adaptation cards still show existing icons marked for
adaptation rather than finished narrative illustration. The 34 newly assigned
paintings and their prompts are documented in
[`MISSING-ART-GENERATION-PROMPTS.md`](./MISSING-ART-GENERATION-PROMPTS.md).

## Special illustration cards

The three showcase cards remain:

- 013 Release Party Crown
- 022 Golden Truffle
- 031 Golden Bog Aura

They use the same rules architecture as ordinary Gear, with a gold special-
illustration stamp and more room for the illustration to carry the card.

## Full-art Places

Places are the second controlled full-art family after Legends. Their location
painting runs beneath the entire face, but the outer cut shape, title position,
Play-before-Training reading order, and collector line remain fixed. A compact
opaque map plaque protects identity; one translucent field-note panel protects
rules. Full art signals “destination,” not rarity or extra power.

## QR placement

The front stays illustration-first. The redeem/download QR remains on the common
card back, where it can route through the Tickle the Pig web handoff, open the app
when installed, and fall back to the App Store when it is not. The back labels
the scan action directly; the Legend front uses that space for
`STARTS OUTSIDE YOUR DECK`.

## Generated proofs

- `visual-system/type-layout-sampler.png` — eight front-layout proofs
- `visual-system/legend-roster.png` — all six playable Legends
- `visual-system/legend-roster-detail.png` — two-column large inspection proof
- `visual-system/full-set-overview.png` — all 88 fronts in collector order
- `visual-system/full-set-detail-01.png` — large proofs for cards 001–44
- `visual-system/full-set-detail-02.png` — large proofs for cards 045–88
- `assets/images/trading-cards/full-art/six-pig-full-art-contact-sheet.png` —
  the six paintings without card furniture
- `visual-system/set-art-coverage-wall.png` — all 88 cards, rarity, type, and art readiness
- `visual-system/*.svg` — editable vector masters for every front

Regenerate with:

```sh
node scripts/render-trading-card-visual-system.mjs
```
