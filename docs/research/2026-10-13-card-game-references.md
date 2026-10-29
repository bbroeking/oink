# Card collection and short-battle references for Tickle the Pig

Checked: **2026-10-13**

Scope: official, first-party sources only. This note separates facts stated by the publishers from product observations and design inferences. Live-service reward rates change frequently; historical economy figures are not treated as current recommendations.

## Source audit

The linked first-party pages were opened directly on 2026-10-13. Pokémon's product page still states two no-cost packs per day and describes immersive cards as entering the illustration; its collecting guide documents swipe-to-open, displays, ownership visibility, Wonder Pick, and excess-copy flair. Marvel Snap's current official overview states 12-card decks and three-minute matches. Blizzard's official 17.0 notes state that duplicate protection supplies no more than the playable two copies of Common, Rare, or Epic cards until that rarity is collected, without changing rarity distribution. The TITANS first-party FAQ documents Signature as a cosmetic quality with alternate full art and animation. Assertions about pacing, tactile effect, or what Tickle the Pig should adopt remain labelled interpretation below.

## Compact comparison

| Reference | Documented facts | Useful pattern for Tickle the Pig |
|---|---|---|
| **Pokémon TCG Pocket** | The official site promises two no-cost booster packs per day, nostalgic and exclusive art, and “immersive cards” that enter the illustration’s world. Pokémon’s own strategy article explicitly describes **swiping a finger to open a pack**. Collection is useful for display (binders and display boards), social discovery (Wonder Pick), and play. Battles use **20-card decks**, streamlined rules, auto-build, rental decks, and auto-battle. [Official product site](https://tcgpocket.pokemon.com/en-us/) · [Pokémon product overview](https://www.pokemon.com/uk/pokemon-video-games/pokemon-trading-card-game-pocket) · [Official collecting guide](https://www.pokemon.com/uk/strategy/a-guide-to-collecting-cards-and-using-wonder-picks-in-pokemon-trading-card-game-pocket) · [Official deck strategy](https://www.pokemon.com/us/features/pokemon-tcg-pocket-deck-strategies-pikachu-ex-mewtwo-ex-and-charizard-ex) | Treat opening as a tactile ritual rather than a modal reward. Let a card be worth owning before it is strategically useful. Give every card three possible lives: collection/display, cosmetic delight, and battle utility. |
| **Marvel Snap** | The official overview describes a **12-card deck** and matches that take about **three minutes**. Official help says each battle selects three locations, revealed over rounds 1–3, whose rules can change how the match plays. [Official overview](https://marvelsnap.com/) · [Official How to Play](https://marvelsnap.com/how-to-play/) · [Official locations help](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/faq/93-what-are-locations/?p=web) | Shortness comes from a small decision space, fixed board geography, and changing context—not from removing all interaction. A cozy card game can be readable in one glance while still asking the player to adapt. |
| **Hearthstone** | Blizzard describes premade decks as a way to enter play quickly and offers both casual and ranked formats. In its March 2020 official patch notes, Blizzard extended duplicate protection to all rarities; an official expansion page explains the rule as receiving unseen cards of a rarity before extra copies beyond the playable limit. [Official game page](https://hearthstone.blizzard.com/en-us) · [Official 17.0 patch notes](https://hearthstone.blizzard.com/en-us/news/23357896/ashes-of-outland-patch-17-0-march-26) · [Official duplicate-protection explanation](https://hearthstone.blizzard.com/en-gb/expansions-adventures/titans) | Protect early openings from feeling wasted. A new collector should see breadth before surplus. When duplicates arrive, convert them into an understandable, player-chosen benefit rather than dead inventory. |

## Pokémon TCG Pocket: the collection loop

### Documented

- The product’s stated intent is casual collecting and battling. Players can open two packs per day at no cost, collect old and Pocket-exclusive illustrations, and encounter digital-only parallax and immersive-card treatments. [Official site](https://tcgpocket.pokemon.com/en-us/)
- Wonder Pick exposes five cards from another player’s opened pack, turns them face down, shuffles them, and lets the player choose one. The collection guide also shows whether a card is already owned. [Official collecting guide](https://www.pokemon.com/uk/strategy/a-guide-to-collecting-cards-and-using-wonder-picks-in-pokemon-trading-card-game-pocket)
- Cards can be arranged for admiration and sharing in binders and display boards; the support FAQ documents privacy controls for both. [Official sharing FAQ](https://support.pokemon.com/hc/en-us/articles/30332621133204-Pok%C3%A9mon-TCG-Pocket-Sharing-and-Social-FAQ)
- Excess copies can be used to obtain cosmetic “flair.” [Official collecting guide](https://www.pokemon.com/uk/strategy/a-guide-to-collecting-cards-and-using-wonder-picks-in-pokemon-trading-card-game-pocket)
- The onboarding path connects collection progress to play: opening packs earns experience, missions can award pack hourglasses, and battles unlock at level 3 with guided tasks, prebuilt decks, and player-built decks. [Official battle-unlock guide](https://www.pokemon.com/uk/features/how-to-unlock-battles-in-pokemon-tcg-pocket)

### Observation and inference

The strong loop is broader than `open pack → increase inventory`. It is:

`anticipate → physically reveal → inspect art → register collection progress → display/share → try in play → earn another opening`

The swipe matters because it gives the player authorship over the reveal. The digital card treatments then justify slowing down after the reveal. Wonder Pick extends the emotional life of somebody else’s opening without requiring the same pack-opening sequence again.

For Tickle the Pig, the opening should therefore have an **input-dependent middle**, not just a tap followed by a canned movie. Rive can make the wrapper respond continuously to drag, pressure proxy (distance/speed), and release. The card should remain directly manipulable after reveal—tilt for depth, rub or tap for a reaction, then place it into the album—so the reward does not end when rarity text appears.

## A Rive pack-opening experience for Tickle the Pig

This is a proposed adaptation, not a description of the reference games.

1. **Pack arrival:** the pig nudges or carries in a soft paper packet. Small idle motion and a restrained sound bed create anticipation before any rarity signal.
2. **Tactile hold:** the packet follows the player’s touch with a slight elastic lag. A highlighted seam teaches the gesture without an instruction panel.
3. **Player-driven tear:** horizontal drag advances a Rive state variable. Paper stretch, crumbs/confetti, and the pig’s expression react to progress. Crossing the completion threshold opens the packet; releasing early lets it settle rather than failing.
4. **Card backs fan out:** cards enter as physical objects. The player reveals each at their own pace. Keep the unrevealed count visible through the fan itself.
5. **Per-card beat:** common cards get a quick, warm response; a first copy, set completion, or rare card earns a stronger composition change. Do not telegraph the best card so early that the other reveals become chores.
6. **Direct inspection:** the revealed card can tilt, shimmer, animate its illustrated character, or trigger a tiny sound/reaction. This is where original animated cards create value independent of stats.
7. **Meaningful landing:** show one concise destination at a time: `New`, album/set progress, and optionally “try in deck.” Duplicates visibly feed a cosmetic or crafting meter.
8. **Return hook:** close on a clear next source of a pack—play, care task, daily return, or set milestone—without burying the player in currencies.

Implementation implication for Rive: model this as explicit states (`arrive`, `held`, `tearing`, `open`, `fan`, `reveal`, `inspect`, `summary`) with continuous inputs for drag/tilt and discrete triggers for thresholds. Keep reward selection and ownership authoritative in application state; Rive should render and respond, not decide the contents.

## Short battle implications

### Pokémon Pocket facts

Pokémon explicitly positions Pocket’s battles as “quick” and “fast,” with 20-card decks and streamlined rules. Auto-build, rental decks, and auto-battle reduce the collection-to-play barrier. Official deck lists also show a two-copy limit in practice, while the collecting guide states that decks can contain at most two cards with the same name. [Product overview](https://www.pokemon.com/uk/pokemon-video-games/pokemon-trading-card-game-pocket) · [Collecting guide](https://www.pokemon.com/uk/strategy/a-guide-to-collecting-cards-and-using-wonder-picks-in-pokemon-trading-card-game-pocket)

### Marvel Snap facts

Snap’s official product promise is unusually concrete: 12-card decks and roughly three-minute matches. Three randomly selected locations reveal over the first three rounds and alter the play space. [Official overview](https://marvelsnap.com/) · [Locations help](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/faq/93-what-are-locations/?p=web)

### Proposed Tickle the Pig structure

- Start with **8–12 card decks** and a **small fixed hand horizon**. The exact count should be playtested, not copied blindly.
- Use **three cozy farm spots** (for example Mud Patch, Trough, Hay Bale), each with one short rule. Revealing or changing a spot supplies variation while preserving a readable board.
- Resolve both sides’ choices together or in a brisk alternation so there is little waiting. Let cards create combinations through tags such as `snack`, `muddy`, `cozy`, and `mischief` rather than long rules text.
- Target a fixed, small number of rounds. Promise a duration only after measured playtests; Snap’s three-minute claim is evidence for the value of a time promise, not proof that the same timing fits Tickle the Pig.
- Give players a usable starter deck and one-tap deck suggestions immediately. Newly opened cards should offer a “try it” path without forcing deck construction.
- Keep the win condition legible: earn the most joy/attention at two of three spots, complete a shared barn goal first, or score the strongest farm tableau after the final round. Prototype these as separate variants rather than mixing them.
- Preserve the cozy tone with low-punishment outcomes: rewards for completion and small bonuses for clever play; avoid making a loss erase opening progress.

## What to adapt

- **Tactile agency from Pocket:** the player performs the reveal gesture.
- **Cards as keepsakes:** animated illustration, inspection, albums, set pages, and favorite/display slots should matter before competitive balance does.
- **A bridge from opening to use:** “try this card” and prebuilt/auto-built decks prevent collection and battle from becoming separate products.
- **A small strategic board from Snap:** few lanes/spots, few turns, short card text, and contextual rules create variety efficiently.
- **Breadth protection from Hearthstone:** favor unseen cards early and make duplicates visibly useful.
- **Multiple gentle goals:** collecting a set, finding an art variant, improving a deck, and decorating a display can coexist without requiring every player to care about ranked mastery.

## What to avoid

- **Do not clone franchise-specific trade dress or gestures beat for beat.** Use Tickle the Pig’s materials, humor, sound, and character acting: feed sacks, seed packets, scrapbook sleeves, muddy hoofprints, snorts, and barn-made embellishments.
- **Do not let animation hide the result or become compulsory friction.** The first few openings can breathe; repeat openings need acceleration and skip paths that preserve the best reveal beat.
- **Do not make rarity the only delight.** If common cards have no animation, album role, set purpose, or play niche, most openings become losses.
- **Do not expose several currencies at the reveal.** The player should understand what was gained and where it went.
- **Do not import mutable live-service economies as design constants.** Snap’s official collection posts document repeated acquisition changes, including attempts to address long gaps, inability to target desired cards, and duplicate frustration. Those are warnings about opaque randomness, not stable benchmarks. [Collection Level Evolution](https://marvelsnap.com/collection-level-evolution/) · [New Cards and How to Get ’Em](https://marvelsnap.com/new-cards-and-how-to-get-em/) · [January 2025 acquisition changes](https://marvelsnap.com/patch-notes-jan-14-2025/)
- **Do not balance the battle game around rare ownership.** A beautiful rare can be exciting without being a strict power upgrade; otherwise the collection fantasy undermines the short, friendly match.

## Questions to answer with prototypes

1. Does drag-to-tear remain satisfying by the tenth pack, and what abbreviated gesture preserves its feel?
2. Is revealing cards one by one better than a fan-and-pick interaction for this audience?
3. Which animation budget produces the most perceived value: every card gets a small idle, or fewer cards get deep interactive scenes?
4. Can a new card enter a suggested deck in one action while keeping the deck understandable?
5. Which short-game variant produces meaningful decisions within the measured target session: three spots, one shared tableau, or a single escalating farm goal?
6. What duplicate conversion feels native to the fiction—stickers, scrapbook decorations, animation upgrades, or crafting toward a chosen card?
