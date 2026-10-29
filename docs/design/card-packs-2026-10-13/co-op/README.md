# Co-op cards — first encounter and reusable templates

Status: exploratory test rules, not a replacement for the printed 88-card game. The user wants the existing Tickle the Pig artwork, a repeatable card frame, occasional art projecting beyond that frame, and friends facing a shared enemy. The existing three-card pack prototype stays separate.

## The game in one sentence

**Choose your pig, bring a small deck, and help your friends get past the Great Hungerer before everyone runs out of Cheer.**

The first test is one two-player encounter, played locally by controlling both seats. A short shared session is the provisional pacing choice. Networking, asynchronous turn storage, four-player scaling, rewards and collection requirements are not part of this experiment. Both players receive complete starter decks; foil, rarity and subscription confer no power.

The eventual dungeon-crawler shape is a short route: encounter → shared choice/rest → encounter → boss. Each stop reuses the same encounter vocabulary. First prove that guarding a friend, setting up an attack, and choosing a target are fun in one room. A map, shops and persistent upgrades would obscure that question now.

## Reference and translation

[Slay the Spire: The Board Game](https://contentiongames.com/games/slay/) is an especially close structural reference: its publisher describes a cooperative deckbuilding adventure for one to four players. Borrow the idea of a shared journey through encounters, with deck choices between them. Our first room tests whether that structure fits TTP before adding a route or upgrades.

[Marvel Champions](https://www.fantasyflightgames.com/en/products/marvel-champions-the-card-game/) uses player heroes, cooperating against a scenario's villain and scheme. Borrow the separation between player deck and encounter controller, plus useful support roles. Our first test deliberately announces a deterministic enemy intent before players act. It uses original TTP names, art, effects and presentation; it is not a reskin or a reproduction of another game's cards.

## Rules v0.1: Two Pigs at the Hedge

### Setup and round

- Rosie and Pepper each start at 12 Cheer, a shuffled 12-card starter deck, and four cards in hand. Legends stay outside the deck.
- Great Hungerer starts at 0 of 20 Encounter Progress. Round 1 of 6 starts with its current Intent face up.
- Each round each pig receives 3 Energy and draws up to four cards. Rosie leads odd rounds; Pepper leads even rounds. A pig completes its turn before its partner acts. Players may discuss both hands.
- Play one affordable card at a time, choose its target, and resolve it fully. Played cards enter their owner's discard immediately. Unplayed cards remain in hand; unspent Energy expires at the end of the round.
- After both pigs pass, allocate shared Guard against the announced damage packets. Players jointly choose ties/optional targets and Guard allocation; the round leader breaks disagreements. Resolve the packets simultaneously, then clear Guard.
- Discard down to four, advance the round, reveal the next Intent, refill Energy, and draw to four. Shuffle the discard only when a draw needs an empty deck. If both piles are empty, draw fewer.
- Win immediately upon reaching 20 Progress, after the primary card effect and before any post-card Legend trigger or enemy action. Lose if either pig reaches zero Cheer. If the sixth enemy phase ends without reaching 20, the team retreats. There is no loss of collection items or currency.
- Healing caps at 12; Progress caps at 20. “Ally” means the other pig. A resolved result is final; no further card can revive the game. Required discards must resolve before another card is played.

### Legend abilities — co-op test versions

| Legend | Ability |
| --- | --- |
| Rosie, Heart of the Herd | Loadout Tactician: once per round, after playing a Support, draw one and discard one. |
| Pepper, Night Watch | Critter Protector: the first Guard card Pepper plays each round adds one extra shared Guard. |

These are experimental translations of their established roles, not their printed abilities. The test omits Training, Rank gates, Gear slots, persistent Critters and the competitive Trouble row.

### Eight cards from three effect families

| Card | Energy | Family / target | Complete test effect |
| --- | --- | --- | --- |
| Toy Sword | 1 | Attack / encounter | Add 2 Progress. Add 1 more if the other pig has added Guard this round. |
| Big Wind-Up | 2 | Attack / encounter | Add 4 Progress. |
| Snoot Boop | 3 | Attack + Support / either pig | Add 3 Progress. Restore 2 Cheer to the chosen pig. |
| Duck Into the Mud | 1 | Guard / team | Add 3 shared Guard. |
| Bog Frog | 2 | Critter · Guard / team | Add 5 shared Guard. Discard after resolving; it does not remain in play. |
| Warm Tea | 2 | Support / either pig | Restore 3 Cheer to the chosen pig. |
| Root Around | 1 | Support / self | Draw 2, then discard 1. |
| Lantern Signal | 1 | Support / ally | The other pig draws 1, then may discard 1 and draw 1. |

Lantern Signal takes its identity from Firefly Lantern's Training action. The template data contract requires canonical source identity separately from each test ID. The isolated rules simulator currently uses test IDs only. Text, cost and effect are versioned co-op data, never edits to the original catalog.

**Rosie deck:** Toy Sword ×2, Big Wind-Up ×2, Duck Into the Mud ×2, Root Around ×2, Lantern Signal ×2, Warm Tea ×1, Snoot Boop ×1.

**Pepper deck:** Toy Sword ×2, Duck Into the Mud ×3, Bog Frog ×2, Warm Tea ×2, Lantern Signal ×1, Root Around ×1, Snoot Boop ×1. These fixed teaching decks do not use the constructed game's two-copy limit.

### Enemy intent track

| Round | Intent | Damage before Guard |
| --- | --- | --- |
| 1 | Reaching Claw | 5 to the lower-Cheer pig; leader chooses ties. |
| 2 | Bottomless Gulp | 3 to each pig. |
| 3 | Belly Flop | 7 to one pig chosen by the team. |
| 4 | Reaching Claw | 6 to the lower-Cheer pig. |
| 5 | Bottomless Gulp | 4 to each pig. |
| 6 | Final Gulp | 5 to each pig. |

Enemy targeting is determined at enemy resolution, using current Cheer. The current Intent is always visible; the fixed track is available in the rules. Later encounter decks can vary these instructions after this loop is understood.

**Cooperation example, round 2:** Pepper leads with Duck Into the Mud for 4 Guard including her bonus. Rosie plays Toy Sword for 3 Progress because Pepper helped, then Big Wind-Up for 4. Put 3 Guard on Rosie's damage and 1 on Pepper's: Rosie loses none, Pepper loses 2. All Guard expires afterward.

## Reusable frame contract

One chassis owns perimeter, title, illustration window, rules cartridge and footer. The four variants supply fields, not custom per-card coordinates:

| Variant | Required fields | Omitted fields |
| --- | --- | --- |
| Legend | Name, epithet, original pig art, Cheer, ability name/text, favored styles | Energy; Rank; Training |
| Move | Energy, name, family, target, art, complete rules, source ID | Legend Cheer; enemy intent |
| Critter | Move fields + explicit Critter type and lifetime (“Discard after resolving”) | Permanent readiness or health in v0.1 |
| Encounter | Name, original enemy art, Progress target/current, Intent text, round | Player Energy; Rank; Training |

Data: `testId`, `rulesVersion`, `canonicalSourceCardId`, `artKey`, `template`, `name`, `energyCost?`, `family`, `target`, `rulesText`, `flavor?`, `finish`. Transient selection, current Cheer, Energy, and readiness belong to game state. Content is rendered as text, not painted into art. Energy must be labelled distinctly from the old Rank medallion.

### Style and art boundaries

- The **live game sprite packs** are authoritative for pig bodies, not standalone masters or card full art. Use `sprites/{pig}/idle_1.png` for front and `face_1.png` for three-quarter views. Preserve the large round head, compact torso and short legs. See [game body reference](game-body-reference/README.md), which supersedes the first master-based template. Midjourney C3 supplies only the depth/composition reference; do not use its alternate Rosie as the character model sheet.
- Palette: paper `#fffaf0`, cream `#fbeee2`, ink `#2a1f15`, rose `#ffd6dc`, sage `#c9dec1`, lilac `#d6c8f0`, sun `#ffd87a`. Caprasimo names/numerals, Nunito rules, Patrick Hand flavor. Follow `docs/design/design-system-spec.md`.
- Standard and break-out versions share identical information zones and gameplay. Depth is cosmetic; it never grants power.
- Layers from back to front: environment plate → in-window character → frame rim → optional character/foliage breakout → protected title/cost/stats/rules. External safe bounds are explicit so adjacent cards and hit targets remain clear.
- Art may breach inner and side rims; it may not cover identity, cost, target or rules. Text stays still while art springs. Reduced motion shows a static depth pose. Compact hand cards open a full readable inspection view.
- Require clean source illustration/cutout layers. A crop of a finished printed card is not an acceptable breakout asset. If only a printed card exists, show it as source reference or mark clean art pending.

## Test plan

1. **Template coverage:** two Legends, eight card definitions, encounter and multiple Intents. Stress a long name, 55-word ability, two-digit cost, missing art, 280/320/393 widths and 200% text. No clipped rules or illegible whole-card scaling; inspect can scroll.
2. **Art protection:** compare standard/break-out versions with protected information zones visible. Replay pop; verify no title/rules overlap. Toggle reduced motion. Source identity remains canonical.
3. **Rules:** deterministic replay of the collaboration example; once-per-round triggers; legal energy/target/discard validation; draw/reshuffle conservation; Guard allocation; win before enemy; both loss paths; reset.
4. **Synthetic balance:** compare attack-first and team-aware policies across fixed seeds; report win rate and finish round as diagnostics, never as human fun or production balance evidence.
5. **Human test next:** two people play without coaching; observe whether they can explain their cards, discuss protection/combos, and finish in about ten minutes. Record dead hands, unused Energy, wasted Guard and confusion over targets. This is still required even when automated checks pass.

Rules-model and repository gate results are recorded in [verification.md](verification.md). The private [Claude Design project](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d) contains the reusable card component and workshop exploration. This canvas is a visual prototype independent from the tested local rules model.
