# Rosie's Loadout: The Hunger in the Bog

Set code: `RLB`  
Unique cards: 88  
Status: mechanically specified, first-pass art complete

This is the first expandable card pool for Rosie's Loadout. Rosie remains the
face of the product, while the full Tickle the Pig roster supplies six playable
Legends. The set uses live game items, rituals, locations, pigs, goblins, and the
Great Hungerer, then adds small Critters and a few gentle obstacles where the
world needs connective tissue.

The machine-readable source of truth is [`cards.mjs`](./cards.mjs). Validate it
from the repository root:

```sh
node scripts/validate-trading-card-base-set.mjs
```

The card layouts, rarity symbols, art-readiness rules, and generated visual
proofs are documented in [`VISUAL-SYSTEM.md`](./VISUAL-SYSTEM.md). The two main
review surfaces are:

- [`visual-system/type-layout-sampler.png`](./visual-system/type-layout-sampler.png)
  for the eight front layouts; and
- [`visual-system/legend-roster.png`](./visual-system/legend-roster.png)
  for all six playable Legends;
- [`../../../../assets/images/trading-cards/full-art/six-pig-full-art-contact-sheet.png`](../../../../assets/images/trading-cards/full-art/six-pig-full-art-contact-sheet.png)
  for the six raw full-art paintings;
- [`visual-system/set-art-coverage-wall.png`](./visual-system/set-art-coverage-wall.png)
  for all 88 card assignments.

## Set skeleton

| Type      |  Count | Role                                                             |
| --------- | -----: | ---------------------------------------------------------------- |
| Legend      |      6 | Starts outside the deck and defines the deck's two styles        |
| Gear      |     27 | Nine Head, nine Held, and nine Aura cards                        |
| Critter   |     19 | Friendly little followers that attack or remain ready to protect |
| Enemy     |     13 | Trouble played into the opponent's side of the table             |
| Stunt     |     16 | Immediate one-shot plays                                         |
| Place     |      7 | Persistent locations; each player keeps one in play              |
| **Total** | **88** |                                                                  |

Every one of the 82 deck cards has a normal Play mode and a Training strip.
The pool is deliberately near-even:

- 27 Brave, 28 Steady, and 27 Spark cards;
- 27 rank 1, 28 rank 2, and 27 rank 3 cards; and
- 31 common, 26 uncommon, 16 rare, 6 epic, and 9 legendary cards.

Rarity does not mean raw strength. Rank controls when a card can be played;
rarity controls collectibility, rules complexity, and showcase treatment.
The six Legends are guaranteed play pieces rather than randomized deck pulls;
their Legendary treatment marks their top-level card class.

## Canonical card-game terms

- **Legend** — one of the six pig Legend cards. It starts outside the
  deck with 12 Cheer, a unique ability, and two favored styles.
- **Critter** — a friendly small creature such as a firefly, spider, frog, or
  mouse. “Companion” is not the card type because the app already uses that
  word for a player's long-term pig-roster choice.
- **Enemy** — an obstacle or antagonist placed in an opponent's Trouble row.
  Enemies can be mischievous or lonely; they need not be evil.
- **Gear** — a persistent item in exactly one Head, Held, or Aura slot.
- **Stunt** — an immediate card that resolves and is discarded.
- **Place** — a persistent location in a player's single Place slot.
- **Training** — the alternative use of a deck card. Tuck it beneath the Legend
  to gain one level, its style icon, and its exposed action strip.

## Constructed deck rule

The 18-card matched prototype remains the learn-to-play format. The first
constructed format stays intentionally compact:

- one Legend outside the deck;
- exactly 24 deck cards;
- every deck card must match at least one of that Legend's two favored styles;
- no more than two copies of a card;
- no more than one copy of a Legendary card; and
- the Legend still levels only once per turn, to a maximum of level 6.

The six Legends cover all three style pairs twice:

| Styles         | Legends          |
| -------------- | --------------- |
| Brave + Spark  | Rosie, Bandit   |
| Brave + Steady | Copper, Biscuit |
| Steady + Spark | Pepper, Pickles |

## Rules extensions

### Critters

“Critter” replaces the prototype term “Buddy.” A player has two Critter spaces.
A ready Critter prevents 1 damage to its Legend. Attacking exhausts it, creating
the central choice between pressure and protection.

### Enemies and Trouble

Each player has two Trouble spaces.

1. Play an Enemy into an open Trouble space on the opponent's side.
2. At the start of the afflicted player's Battle, each ready Enemy there
   attacks that player's Legend, then exhausts.
3. The afflicted player may attack those Enemies with their Legend and Critters.
4. Damage on an Enemy clears at the end of the afflicted player's turn unless
   it reaches the Enemy's Hearts and defeats it.
5. A defeated Enemy goes to its owner's discard.

The Great Hungerer occupies both Trouble spaces. Critters and Head Gear protect
against Enemy attacks normally.

### Places

Each player has one Place slot. A newly played Place replaces and discards the
old one. A Place affects only its controller unless its text explicitly says
otherwise. Places remain dual-use deck cards, so a beautiful location still
creates the game's central choice: visit it now or tuck it permanently as
Training.

Places use a controlled full-art treatment. The environment runs beneath the
whole card, while a compact title plaque and one translucent field-note panel
preserve the same reading order and cut line as every other front. This makes
Places feel like destinations without making them mechanically premium.

## Collector list

### Legends · 001–006

|   # | Card                     | Styles         | Rarity |
| --: | ------------------------ | -------------- | ------ |
| 001 | Rosie, Heart of the Herd | Brave + Spark  | Legendary |
| 002 | Copper, Trailblazer      | Brave + Steady | Legendary |
| 003 | Pepper, Night Watch      | Steady + Spark | Legendary |
| 004 | Bandit, Quick Hoof       | Brave + Spark  | Legendary |
| 005 | Pickles, Orchard Finder  | Steady + Spark | Legendary |
| 006 | Biscuit, Stouthearted    | Brave + Steady | Legendary |

### Gear · 007–033

|   # | Card                 | Slot | Rank · Style | Rarity    |
| --: | -------------------- | ---- | ------------ | --------- |
| 007 | Ticket Taker's Cap   | Head | 1 · Steady   | Common    |
| 008 | Muddy Cap            | Head | 1 · Brave    | Common    |
| 009 | Mushroom Cap         | Head | 1 · Spark    | Common    |
| 010 | Bog Helmet           | Head | 2 · Steady   | Uncommon  |
| 011 | Reed Hat             | Head | 2 · Spark    | Uncommon  |
| 012 | Slop Bucket Hat      | Head | 2 · Brave    | Uncommon  |
| 013 | Release Party Crown  | Head | 3 · Spark    | Legendary |
| 014 | Swamp Crown          | Head | 3 · Steady   | Rare      |
| 015 | The Hungerer's Crown | Head | 3 · Brave    | Epic      |
| 016 | Toy Sword            | Held | 1 · Brave    | Common    |
| 017 | Slop Bucket          | Held | 1 · Steady   | Common    |
| 018 | Firefly Lantern      | Held | 1 · Spark    | Common    |
| 019 | Mud Shovel           | Held | 2 · Steady   | Uncommon  |
| 020 | Magic Wand           | Held | 2 · Spark    | Uncommon  |
| 021 | Crew Pennant         | Held | 2 · Brave    | Uncommon  |
| 022 | Golden Truffle       | Held | 3 · Spark    | Epic      |
| 023 | Golden Hog Cup       | Held | 3 · Brave    | Rare      |
| 024 | Mud Pie              | Held | 3 · Steady   | Rare      |
| 025 | Firefly Aura         | Aura | 1 · Spark    | Common    |
| 026 | Mud Splatter Aura    | Aura | 1 · Brave    | Common    |
| 027 | Swamp Bubble Aura    | Aura | 1 · Steady   | Common    |
| 028 | Shadow Aura          | Aura | 2 · Brave    | Uncommon  |
| 029 | Confetti Aura        | Aura | 2 · Spark    | Uncommon  |
| 030 | Holy Aura            | Aura | 2 · Steady   | Uncommon  |
| 031 | Golden Bog Aura      | Aura | 3 · Steady   | Legendary |
| 032 | Heirloom Mire Aura   | Aura | 3 · Brave    | Epic      |
| 033 | Chorus Glow          | Aura | 3 · Spark    | Rare      |

### Critters · 034–051

|   # | Card               | Rank · Style | Rarity   |
| --: | ------------------ | ------------ | -------- |
| 034 | Firefly Swarm      | 1 · Spark    | Common   |
| 035 | Dewdrop Spider     | 1 · Steady   | Common   |
| 036 | Trough Sparrow     | 1 · Brave    | Common   |
| 037 | Bumblebee          | 1 · Spark    | Common   |
| 038 | Puddle Duckling    | 1 · Steady   | Common   |
| 039 | Garden Snail       | 1 · Brave    | Common   |
| 040 | Lantern Rabbit     | 2 · Spark    | Uncommon |
| 041 | Bog Frog           | 2 · Steady   | Uncommon |
| 042 | Truffle Mole       | 2 · Brave    | Uncommon |
| 043 | Waltzing Moth      | 2 · Spark    | Uncommon |
| 044 | Shy Field Mouse    | 2 · Steady   | Uncommon |
| 045 | Acorn Squirrel     | 2 · Brave    | Uncommon |
| 046 | Moon Firefly       | 3 · Spark    | Rare     |
| 047 | Coquí Critter      | 3 · Steady   | Rare     |
| 048 | Mud Crab           | 3 · Brave    | Rare     |
| 049 | Glowworm Choir     | 3 · Spark    | Common   |
| 050 | Field Mouse Family | 3 · Steady   | Common   |
| 051 | Robin Lookout      | 3 · Brave    | Common   |

### Enemies · 052–063

|   # | Card                     | Rank · Style | Rarity    |
| --: | ------------------------ | ------------ | --------- |
| 052 | Goblin Scout             | 1 · Brave    | Common    |
| 053 | Peeking Hungerling       | 1 · Spark    | Common    |
| 054 | Mud-Slick Spider         | 1 · Steady   | Common    |
| 055 | Truffle-Thief Crow       | 1 · Brave    | Common    |
| 056 | Goblin Grunt             | 2 · Brave    | Uncommon  |
| 057 | Cheek-Stuffed Hungerling | 2 · Steady   | Uncommon  |
| 058 | Bog Bubble               | 2 · Spark    | Uncommon  |
| 059 | Root Tangle              | 2 · Steady   | Uncommon  |
| 060 | Goblin Brute             | 3 · Brave    | Rare      |
| 061 | Scurrying Hungerling     | 3 · Spark    | Rare      |
| 062 | Goblin Warboss           | 3 · Steady   | Epic      |
| 063 | The Great Hungerer       | 3 · Spark    | Legendary |

### Stunts · 064–078

|   # | Card              | Rank · Style | Rarity   |
| --: | ----------------- | ------------ | -------- |
| 064 | Big Wind-Up       | 1 · Brave    | Common   |
| 065 | Duck Into the Mud | 1 · Steady   | Common   |
| 066 | Quick Change      | 1 · Spark    | Common   |
| 067 | Warm Tea          | 1 · Steady   | Common   |
| 068 | Sun Beam          | 1 · Spark    | Uncommon |
| 069 | Root Around       | 2 · Steady   | Common   |
| 070 | Firefly Feint     | 2 · Spark    | Uncommon |
| 071 | Halo Kiss         | 2 · Brave    | Uncommon |
| 072 | Mud Wrap          | 2 · Steady   | Uncommon |
| 073 | Goblin Whisper    | 2 · Brave    | Rare     |
| 074 | Encore!           | 3 · Brave    | Rare     |
| 075 | Glimmer Truffle   | 3 · Spark    | Rare     |
| 076 | Snoot Boop        | 3 · Brave    | Rare     |
| 077 | Phantom Itch      | 3 · Spark    | Epic     |
| 078 | Chorus Glow       | 3 · Steady   | Common   |

### Places · 079–084

|   # | Card           | Rank · Style | Rarity   |
| --: | -------------- | ------------ | -------- |
| 079 | Homestead Barn | 1 · Steady   | Common   |
| 080 | Truffle Patch  | 1 · Brave    | Common   |
| 081 | Reed Marsh     | 2 · Spark    | Uncommon |
| 082 | Mud Derby      | 2 · Brave    | Rare     |
| 083 | Festival Night | 3 · Spark    | Rare     |
| 084 | Golden Mire    | 3 · Steady   | Epic     |

### Sounder Spoils · 085–088

|   # | Card            | Type    | Rank · Style | Rarity   |
| --: | --------------- | ------- | ------------ | -------- |
| 085 | Porch Fireflies | Critter | 1 · Spark    | Common   |
| 086 | Wallow Gremlin  | Enemy   | 2 · Brave    | Uncommon |
| 087 | Golden Wave     | Stunt   | 2 · Steady   | Uncommon |
| 088 | Spa Wallow      | Place   | 3 · Steady   | Rare     |

## Art production

The validator currently reports:

- 79 cards with ready source art; and
- 9 cards that can adapt existing ritual or effect icons.

The 34 formerly missing illustrations now have a complete first generated pass:
18 Critters, 7 Enemies, and 9 Stunts. The selected 1024×1536 paintings live in
`assets/images/trading-cards/base-set-art/`; their shared prompt and individual
scene briefs are recorded in
[`MISSING-ART-GENERATION-PROMPTS.md`](./MISSING-ART-GENERATION-PROMPTS.md).
They are mechanically wired into `cards.mjs` and appear in the generated card
proofs. They still need a human identity, anatomy, crop, and print proof before
being treated as final production illustration.

The three existing Special Illustration Gear cards remain Release Party Crown
013, Golden Truffle 022, and Golden Bog Aura 031. The Great Hungerer gets a
distinct Boss frame rather than being counted as a fourth Special Illustration
printing.

## Print and QR plan

One collector master of 88 unique fronts needs ten nine-up sheets. The final
sheet contains cards 082–088 and two intentionally empty cut positions. A
playable two-player product needs duplicate deck cards; one unique
master set is a collector/design proof, not two constructed decks.

All standard backs remain identical and carry the existing Release Party Crown
route. The digital Crown remains capped at ten owners and expires September 1,
2026; printing 88 or 880 cards does not increase its digital supply.

Generated print masters:

- `output/pdf/rosies-loadout-base-set-88-fronts-9up.pdf` — ten front-only
  letter-size sheets;
- `output/pdf/rosies-loadout-base-set-88-duplex-9up.pdf` — twenty interleaved
  front/back pages for long-edge duplex printing; and
- `visual-system/card-manifest.csv` — collector-order source manifest.
