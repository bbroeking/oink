# MapleStory iTCG: system breakdown and lessons for Rosie's Loadout

## Scope and source quality

This note treats “the original MapleStory card game” as the English-language
**MapleStory iTCG**, designed by Brian Tinsman and published by Wizards of the
Coast in 2007.

The rules reconstruction below is based primarily on two contemporary
first-party documents:

- The [official four-page Wizards of the Coast rulebook](https://ccggamez.com/files/mpls/maplestory_itcg_rules.pdf),
  preserved by a third-party host. Its credits and copyright block identify
  Wizards of the Coast as publisher, Bill McQuillan as rules writer, and Brian
  Tinsman as original game designer.
- The [official Set 1 FAQ](https://assets.cardgamegeek.com/public/library/msitcg/MapleStory%20Set%201%20FAQ.pdf),
  preserved in CardGameGeek's document library. It resolves omissions and
  edge cases in the short rulebook.

An [official Nexon announcement for a later expansion](https://m.maplestory.nexon.com/News/Notice/73430)
confirms that the physical game continued to add cards tied to digital
MapleStory content. A contemporary [trade report quoting Wizards brand manager
Laura Tommervik](https://icv2.com/print/article/11011) is used only for product
positioning, not for rules.

The surviving English rulebook is a short starter rulebook rather than a
comprehensive rules reference. Where it does not state a rule, this note does
not invent one.

## The game in one paragraph

Each player begins with a character already in play and tries to reduce the
opposing character to zero HP. On a turn, a player may permanently tuck one
card from hand under their character. That card raises the character's level,
adds HP, contributes a colored job member to the character's party, and exposes
a new action strip. The player then works through the actions on their
character and tucked cards in order, using them to draw or play monsters,
items, and one-shot tactics. Finally, their monsters attack. The central
decision is therefore not merely which card to play, but whether a card is more
valuable as its normal card type now or as permanent character growth for the
rest of the game.

## Objective and setup

### Objective

Reduce the opposing character to **zero HP**. Leveling is a means of growing
the character and enabling stronger plays; it is not itself the victory
condition. The official rulebook states this directly in “How to Win.”

### Setup

Each player needs one character card and one deck.

1. Put the character face up in play; it is not shuffled into the deck.
2. Shuffle the deck.
3. Randomly choose who decides to play first or second.
4. The first player draws five cards; the second player draws six.

The Set 1 FAQ makes an important correction to assumptions imported from other
card games: **players do not automatically draw at the start of a turn**.
Drawing is supplied by character or card actions.

## Turn structure

The base turn has three ordered sections.

### 1. Level up

At the start of the turn, the active player **may level up once** by choosing
one card from hand and sliding it under their character. Only the card's bottom
action strip remains visible.

Every tucked card:

- raises the character's displayed level by 10;
- adds 20 HP to the player's total;
- contributes its job color to the character's party;
- exposes its bottom character action for future turns; and
- may perform a one-time effect immediately if that strip carries the
  lightning-bolt symbol.

The FAQ confirms that characters begin at level zero. One tucked card means
level 10, two mean level 20, and so on.

### 2. Perform character actions

Actions are processed as a visible program:

1. read the actions printed on the character from top to bottom;
2. then read the exposed actions on the tucked cards from the topmost card
   downward.

Each eligible action may be used once per turn. An action may be skipped, but
the ordering is fixed.

An action's cost is a **threshold**, not a pool of points that is spent. The
player must have reached its minimum level and have the indicated number and
colors of cards tucked under the character. Many actions allow a player to
draw or to play a monster, item, or tactic from hand.

### 3. Attack with monsters

Each monster in play may attack once, one at a time. It may target the opposing
character or an opposing monster and deals its printed attack value. A
defending monster does not strike back. After monster attacks, the turn ends.

## The level and resource system

The game has no separate land, energy, or mana deck in the starter rules.
Instead, a single tucked card performs four resource functions at once:

| Function | What the tucked card does |
|---|---|
| Tempo clock | Advances the character by 10 levels |
| Survivability | Adds 20 HP |
| Affiliation | Adds one job color to the party |
| Action engine | Adds a reusable or one-shot action strip |

This makes leveling a permanent conversion of hand value into engine value.
Once a card is tucked, the player ignores its normal monster, item, or tactic
half. Conversely, playing the card normally gives up the opportunity to make
its level strip part of the character.

That dual use is the game's strongest system. It reduces the number of dead
cards because even a card that cannot currently be played can become a level,
but the choice remains costly because the player receives no normal draw by
default.

## Characters, jobs, colors, and the party

The base game has four job colors:

| Job | Color in the rulebook |
|---|---|
| Bowman | Green |
| Magician | Red |
| Thief | Gray |
| Warrior | Blue |

The character is called the **party leader**. Tucked colors represent other
jobs joining that leader's party. A mixed-color level stack therefore both
tells a progression story and grants access to a wider action vocabulary.

To play a monster, item, or tactic of a color, the player must have at least
one tucked card of the same color. Individual actions can demand additional
colored cards and a minimum level.

Color is consequently not only deck identity. It is visible party composition,
and deck construction determines how reliably the player can assemble the
party required by their action chain.

## Monsters and combat

Monsters are persistent cards with attack and HP.

- A monster can attack once on its controller's turn.
- It can attack the opposing character or another monster.
- Combat is one-way: the target does not retaliate.
- Damage to a normal monster accumulates during the current turn.
- A monster is destroyed when that turn's accumulated damage reaches its HP.
- Remaining damage on a surviving normal monster clears at the end of the
  turn.

Monsters are also passive protection. Every monster a player controls prevents
10 damage **each time** that player's character would take damage, regardless
of the source. The monster does not absorb that damage itself. The Set 1 FAQ
confirms this applies to all character damage, not only monster attacks.

This rule gives every monster two simultaneous roles:

1. an attacker or removal target; and
2. one unit of repeatable armor for the party leader.

It is a notably simple way to make board presence matter without a separate
blocking step.

## Items and equipment

The base game calls these cards **items**, but its rules do not define a
slot-based equipment system.

- An item is played face up next to the character.
- It stays in play until an effect destroys it or returns it to hand.
- Its rules text supplies a continuous or triggered benefit.
- The base rulebook states no universal item limit, attachment rule, or Head /
  Hand / Body slot.

The Set 1 FAQ demonstrates that duplicate items can coexist and stack. It
explains that two copies of Red Apprentice Hat each grant their level-up HP
bonus, and two Emerald Earrings each trigger when another item is played.

This distinction matters for Tickle the Pig: MapleStory contributed a
persistent item layer, but **Head, Held, and Aura slots are an original loadout
system**, not something that should be copied from MapleStory.

## Tactics

Tactics are immediate, one-shot cards. When an action permits a tactic to be
played, its instructions are resolved and it is put face up in the discard
pile. Their lower action strips can instead be tucked during leveling, like
those of monsters and items.

## Card anatomy

The rulebook diagrams two broad layouts.

### Character card

- starting HP;
- name;
- ordered character actions;
- the level and color thresholds for those actions;
- rarity symbol and collector number; and
- card color.

### Monster, item, or tactic

The top and bottom are intentionally different modes.

**Normal-play area**

- name and card level;
- card type;
- attack and HP where applicable;
- type, subtype, and location;
- rules text;
- flavor text;
- color, rarity, and collector information.

**Level-up strip**

- action threshold;
- job-color requirements; and
- a character action, sometimes marked as a one-time effect.

The physical layout makes the dual-use decision legible: when the card is
tucked under a character, only the reusable action strip needs to remain
visible.

## Deck construction

The base construction rules are spare:

- a deck contains at least 40 cards;
- no more than four copies of any one card may be included; and
- the chosen character starts outside the deck.

The rest of the rulebook's deck guidance is advice rather than law. It
recommends starting from a character, using many cards of that character's
color, limiting extra colors for consistency, playing mostly monsters, mixing
card levels, and ensuring the character actions can actually play the selected
cards.

## The physical-to-digital bridge

Every booster contained at least one card with an online code. The rulebook
instructed the player to enter that code in MapleStory's Cash Shop, where a
matching virtual card appeared in the player's inventory. Wizards positioned
codes as a bridge to artifacts, pets, and quests in the online game, according
to the contemporary trade report quoting the game's brand manager.

The structural lesson is stronger than the exact redemption implementation:
the paper card had independent tabletop value, while the code made opening and
owning it matter in the digital world too.

For Rosie's Loadout, the existing identical QR card back is the cleaner modern
version. It keeps hidden cards indistinguishable, lets an installed app claim
through the Shop scanner, and lets the landing page route a player without the
app to download it.

## What made play feel distinctive

These are design inferences from the cited rules, not language used by Wizards.

### 1. Every hand is also a skill tree

A card is either a creature, item, or event now, or a permanent node in the
character's growing action column. That is a richer decision than merely
paying a card as a face-down generic resource.

### 2. Progress is tactile and visible

The physical stack under the character grows downward. The player can see
level, party composition, and an increasingly long action sequence without a
separate board.

### 3. The player builds a turn engine during the match

Early turns have only the character's basic actions. Later turns chain the
character and every exposed level strip in a fixed order. The player's “build”
is not confined to deck construction; it materializes on the table.

### 4. Class identity emerges as a party

Adding another color is framed as recruiting another job into the party. The
resource system therefore carries worldbuilding rather than feeling like
abstract currency.

### 5. Board presence is both sword and shield

Monsters attack, but every monster also reduces incoming character damage.
Going wide changes both the player's offensive output and effective
durability.

### 6. Physical ownership continued into the video game

The code did not make the paper rules function, but it made the product feel
connected to the MMO. That bridge was part of the game's identity rather than
a generic marketing URL.

## What to carry into a Tickle the Pig game

The strongest direction is not “MapleStory with pig names.” It is an original
equipment duel that borrows three abstract structures:

1. **dual-use cards**;
2. **visible character growth**; and
3. **paper-to-app continuity**.

### Recommended translation

| MapleStory structure | Original Rosie translation |
|---|---|
| Character starts in play | Rosie hero card starts in play |
| Tuck one card to gain 10 levels | Tuck at most one card as a Memory / Training card to gain one level |
| Tucked color is a party job | Tucked icon develops one of Rosie's styles: Bash, Guard, or Flair |
| Tucked bottom action joins the engine | A slim “Rosie action” strip remains visible below the hero |
| Items remain as unbounded permanents | Equipment uses exactly one Head, one Held, and one Aura slot |
| Monsters attack and protect the hero | Optional Buddies or Critters can add one simple attack or protection role |
| Tactics resolve once | Stunts resolve once and discard |
| Online code card in a booster | Identical QR back on every promo card opens the app / claim route |

### Preserve these decisions

- **Normal mode versus growth mode.** Every non-hero card should be playable
  for its illustration-side effect or tucked for its narrow action strip, but
  never both.
- **One growth choice per turn.** This creates a readable tempo clock and keeps
  the visible stack tidy.
- **Ordered actions.** Rosie performs her hero actions, then tucked actions from
  top to bottom. The table itself remembers the turn sequence.
- **Meaningful loadout slots.** Head, Held, and Aura should stay limited to one
  each. Replacing equipment becomes a real tactical choice and keeps the
  Release Party Crown mechanically and visually special.
- **Identical backs.** QR treatment must not reveal which card is face down.

### Deliberately change these decisions

- **Add a normal draw.** The original's lack of a default draw makes every tuck
  especially punishing and pushes card draw into the action engine. For a
  short, family-friendly promo game, drawing one card per turn is easier to
  teach and less likely to stall.
- **Use small numbers.** Single-digit Hearts, Bash, Guard, and Flair are easier
  to read across a release-party table than HP and damage in tens.
- **Use a fixed starter before deck construction.** Do not begin with a
  40-card collectible deck. Prove the loop with matched 18-card decks or a
  shared armory first.
- **Do not turn pig patterns into power tiers.** Rosie remains the same lead
  character across spotted, belted, sandy, midnight, and classic
  illustrations. Patterns can support collection and flavor without implying
  that one real-world pig pattern is stronger.
- **Do not copy job names, color mapping, wording, card frame, monsters, or
  iconography.** The reusable value is the system relationship, not the
  protected expression.

## Proposed first playable product

The current nine equipment cards are a strong **Armory Pack**, but nine
equipment cards alone cannot express the level/action engine.

A small duel kit can remain compatible with nine-up printing:

- **Rosie hero/reference card:** one per player, printed separately or included
  in a learn-to-play sheet.
- **18-card matched deck per player:** two nine-up sheets.
  - 3 Head items
  - 3 Held items
  - 3 Aura items
  - 6 Stunts
  - 3 Buddies or Encounters
- **Existing nine-card armory:** serves as the equipment half of the first
  prototype rather than being discarded.

Suggested turn:

1. **Draw** one card.
2. **Grow** by optionally tucking one card under Rosie.
3. **Act** through Rosie's hero actions and visible tucked actions in order.
4. **Gear** Head, Held, and Aura when actions permit; replacing a slot discards
   its old item.
5. **Battle** once using the equipped Bash / Guard / Flair relationship.
6. **End** and clear temporary effects.

The precise victory condition and combat math should be playtested rather than
assumed. The first prototype should answer one question: **is it painful and
interesting to choose between equipping a beautiful item now and tucking it to
make Rosie stronger for the rest of the match?** If that choice works, the
game has inherited the most valuable part of MapleStory iTCG while becoming
its own equipment-first system.

