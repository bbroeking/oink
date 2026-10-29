# Rosie's Loadout: Hedge Run

Status: implementable async pilot  
Players: two sealed runs compared head-to-head, or solo Practice  
Active play target: 2–3 minutes per player  
Async elapsed time: minutes to days, depending on when the second player plays  
Rounds: 6

## The one-sentence rule

**Face the same six Hungerer events as your friend: each round Play one card into your loadout or Train it for +1 Search, then find what you can without running out of Cheer.**

Each run is designed for one 2–3 minute sitting and resumes from the same state if interrupted. The friend may be offline. This is asynchronous because the result waits for both completed runs, not because the game asks players to return for six separate turns.

## What the players compare

Both players receive the same borrowed 12-card kit, shuffled card order, six events in the same order, and rules version. They make their own six Play-or-Train choices against that shared seed. Neither player sees the other's choices, progress, score, or completed result until both runs are locked.

Compare, in order:

1. most **Discoveries** found;
2. most **Cheer** remaining; then
3. a draw.

There is no speed tiebreak. Taking time to read is never a disadvantage.

## Relationship to the existing 88 cards

Hedge Run is a separate digital rules mode. It does not replace or reinterpret the printed rules in `base-set-84/cards.mjs`, *Rosie's Loadout: Duel*, or *Playtest Rules v2*.

The existing 88-card art set remains the collection. The pilot lends both players the same twelve cards regardless of ownership and reads a versioned `quick` record keyed by each existing stable card ID. Printed rank, style, rarity, Training strip, and ability do not resolve here. Enemies, Places, and Stunts appear as event fiction or collection art, not as playable card types in this pilot.

Rarity, foil, full art, animation, and alternate art never change Hedge Run values. The three Special Illustration cards in the starter follow the same point budgets as every other card in their slot. All six Legends are guaranteed, start at 10 Cheer, and are mechanically equal.

## Match boundary

Hedge Run follows the project's 2026-10-04 matchmade-play ruling:

- a challenge is a temporary table of two pigs, not a standing team;
- the competitive pilot supports named-friend challenges only;
- Practice uses the same seed generator and reducer but is plainly labelled Practice;
- a Practice pig never occupies a real opponent seat;
- there are no stakes and no match changes currency, card inventory, Happiness, Streak, season progress, or other game resources;
- losing removes nothing; and
- results are private to the two participants and are excluded from monthly wins, public boards, and matchmaking ratings.

Open-link and random competitive modes are deferred. They need their own abuse and matchmaking design; this pilot does not approximate them with forfeits, lockouts, or bots.

Playing or Training a card is match state only. It never burns, locks, upgrades, or grants a collected card.

## The two numbers

Every loadout contributes **Guard** and **Search**. Guard protects Cheer from the event's Danger. Search finds the event's Discovery.

Every Legend supplies **1 base Guard**. Cards add their quick values while they occupy a slot. Training supplies **+1 Search** for the rest of the run, beginning in the round it is tucked. A player may Train at most two cards.

After the player's choice each round, resolve in this order:

```text
damage = max(0, event Danger - total Guard)
apply damage
bank the Discovery only if Cheer remains above 0 and Search >= event Search target
```

Damage and the Discovery check use the newly updated loadout. Damage cannot reduce Cheer below 0. Reaching 0 means the pig escapes without the current event's Discovery; Discoveries banked in earlier rounds remain safe. The run then ends and all later events count as missed.

There are no random checks, energy, ranks, styles, target selection, action chains, critical hits, or card-text timing windows.

## Matched 12-card kit

Every slot offers an assertive, balanced, and protective shape. Cards in a row share a total point budget, so no finish is a strict upgrade.

| No. | Stable ID | Card | Slot | Guard | Search |
|---:|---|---|---|---:|---:|
| 007 | `ticket_takers_cap` | Ticket Taker's Cap | Head | 2 | 1 |
| 010 | `bog_helmet` | Bog Helmet | Head | 3 | 0 |
| 013 | `release_party_crown` | Release Party Crown | Head | 1 | 2 |
| 016 | `toy_sword` | Toy Sword | Held | 0 | 3 |
| 019 | `mud_shovel` | Mud Shovel | Held | 1 | 2 |
| 022 | `golden_truffle` | Golden Truffle | Held | 2 | 1 |
| 025 | `firefly_aura` | Firefly Aura | Aura | 1 | 1 |
| 028 | `shadow_aura` | Shadow Aura | Aura | 0 | 2 |
| 031 | `golden_bog_aura` | Golden Bog Aura | Aura | 2 | 0 |
| 040 | `lantern_rabbit` | Lantern Rabbit | Critter | 0 | 2 |
| 041 | `bog_frog` | Bog Frog | Critter | 2 | 0 |
| 042 | `truffle_mole` | Truffle Mole | Critter | 1 | 1 |

This matrix makes the card choice real without prose effects. Toy Sword finds more but leaves the pig exposed; Golden Truffle protects more but searches less; Mud Shovel splits the difference. Special Illustration status does not predict which axis a card favors.

## Seeded event trail

A challenge uses six events drawn without replacement from this pilot table. The seed determines event order and card order. The player sees the current event and the next event before choosing; round 6 has no next-event preview. Each visible event names its Danger, Search target, and Discovery.

| Event ID | Event | Danger | Search target | Discovery |
|---|---|---:|---:|---|
| `rattling_reeds` | Rattling Reeds | 2 | 2 | Reed Ribbon |
| `muddy_footprints` | Muddy Footprints | 3 | 3 | Bent Spoon |
| `snuffling_shadow` | Snuffling Shadow | 4 | 3 | Button Bell |
| `hungerling_scramble` | Hungerling Scramble | 4 | 5 | Pocket Apple |
| `root_tangle` | Root Tangle | 5 | 4 | Knotted Charm |
| `hungerer_reaches` | The Hungerer Reaches | 6 | 6 | Golden Acorn |
| `bog_bubbles` | Bog Bubbles | 3 | 5 | Glassy Pebble |
| `crow_swoop` | Crow Swoop | 5 | 3 | Blue Feather |
| `moonlit_gap` | Moonlit Gap | 2 | 6 | Moon Button |

The generator validates a trail before issuing it:

- exactly six distinct events;
- at least one event with Danger 5 or 6;
- at least one event with Search target 5 or 6; and
- no more than two events with Danger 5 or 6.

A hard Search event early can make Training attractive; high Danger can make an immediate defensive Play matter. These are pilot content constraints, not a live economy.

## Setup and hand flow

1. Choose any guaranteed Legend and set it to **10 Cheer**.
2. The server derives the 12-card deck order and six-event trail from the challenge seed and rules version.
3. Draw **4 cards**.
4. Begin with Head, Held, Aura, Critter, and both Training spaces empty.
5. Show the current and next events before the choice. On round 6, show only the current event.

At the start of each round, including round 1, draw one card. The player chooses from five cards in round 1 and sees ten of twelve cards by round 6.

## One round

1. **Reveal:** show the current event's Danger, Search target, and named Discovery, plus the same information for the next event when one remains.
2. **Choose:** select one hand card and either Play it into its matching slot or Train it for +1 Search this and later rounds. With two Training cards, Train is unavailable. There is no pass while a legal card remains.
3. **Apply:** a played card replaces any card in that slot. A Trained card contributes only universal Training Search, not its printed quick values.
4. **Resolve:** total Guard and Search, then lose uncovered Danger as Cheer. Only if Cheer remains above 0, bank the Discovery when Search meets its target. At 0 Cheer, keep prior Discoveries, miss the current Discovery, and end the run. Otherwise advance the event preview.

After round 6, lock the run. A normal run contains exactly six decisions.

## Worked run

This sample assumes the seed supplies the needed cards by each listed round. Clover starts at 10 Cheer with 1 base Guard.

| Round | Event (Danger / Search) | Choice | Guard | Search | Result | Cheer | Discoveries |
|---:|---|---|---:|---:|---|---:|---:|
| 1 | Rattling Reeds (2 / 2) | Play Ticket Taker's Cap (2 / 1) | 3 | 1 | safe; miss | 10 | 0 |
| 2 | Muddy Footprints (3 / 3) | Play Toy Sword (0 / 3) | 3 | 4 | safe; find | 10 | 1 |
| 3 | Snuffling Shadow (4 / 3) | Train Bog Frog (+1 Search) | 3 | 5 | lose 1; find | 9 | 2 |
| 4 | Hungerling Scramble (4 / 5) | Play Firefly Aura (1 / 1) | 4 | 6 | safe; find | 9 | 3 |
| 5 | Root Tangle (5 / 4) | Play Truffle Mole (1 / 1) | 5 | 7 | safe; find | 9 | 4 |
| 6 | The Hungerer Reaches (6 / 6) | Train Golden Truffle (+1 Search) | 5 | 8 | lose 1; find | **8** | **5** |

Clover's locked score is **5 Discoveries, 8 Cheer**.

The round-6 choice is not automatic. Playing Golden Truffle would replace Toy Sword: Guard would rise from 5 to 7, but Search would fall from 7 to 5, preventing the Golden Acorn discovery. Training keeps the current loadout, raises Search to 8, and accepts 1 damage. A player on 1 Cheer cannot bank the Golden Acorn by Training because Danger resolves first and reduces Cheer to 0; prior Discoveries remain, but the current one is missed. Playing Golden Truffle instead survives with the same prior Discovery total and more Cheer, so defense is correct in that state. The same card supports a different choice under a different run state.

## Why choices are meaningful

The earlier equal-type prototype made every Head interchangeable and often reduced later draws to forced Training. This matrix gives each slot a visible Guard/Search tradeoff while keeping all rules on two numbers.

Adverse hand: `Bog Helmet, Golden Bog Aura, Bog Frog, Ticket Taker's Cap, Golden Truffle` is heavily defensive. Against low Danger and high Search, the player can Train a defensive card for permanent Search. Against immediate Danger, playing it may preserve enough Cheer to take risks later.

Aggressive hand: `Release Party Crown, Toy Sword, Shadow Aura, Lantern Rabbit, Mud Shovel` can find early Discoveries but may lose several Cheer to a Danger spike. Replacing Toy Sword with Mud Shovel later sacrifices 1 Search for 1 Guard. There is no universally dominant slot order because event order, current Cheer, hand, occupied slots, and remaining Training space all matter.

A perfectly mirrored set of choices produces the same score and therefore a draw. Hedge Run never uses completion speed, rarity, a hidden roll, or first-player status to force a winner.

This is a compact optimization puzzle, not a claim of deep constructed-card strategy. Its pilot question is whether six state-dependent Play-or-Train choices feel satisfying in one mobile sitting.

## Async challenge lifecycle

### Create for a named friend

1. The authenticated creator selects one existing friend. Blocks and friend eligibility are checked before creation.
2. In one transaction, the server binds creator ID and recipient ID, commits the cryptographic seed and immutable rules version, creates one durable run ID per participant, sets expiration, and exposes the pending challenge to the recipient.
3. Only that bound recipient can play the second run. There is no transferable join token and no open seat to claim.
4. Allow at most one active Hedge Run for an unordered friend pair: Alice-to-Ben and Ben-to-Alice are the same pair. Ordinary per-user pending-invitation limits also apply.

The recipient may be offline and does not need to accept before the creator begins. Once creation succeeds and the pending challenge exists for both accounts, the creator may immediately open the seeded hand and finish their one run. Neither participant can restart, reset, or move their durable run to another seed. The client never supplies deck order, event order, or score.

Binding and exposing the challenge before the creator sees cards prevents the supported UI from selectively sending only a favorable completed seed to that friend. The product cannot prevent participants from sharing screenshots or discussing choices outside the app. Sealed in-app state prevents accidental information leakage; it is not an anti-collusion guarantee.

### Sealed runs

Each participant gets one durable run ID and one run. The server reveals only that player's current legal state. Choices append to an authoritative event log. Refresh, backgrounding, or device loss resumes the same run; it does not create another attempt.

Before both runs lock, a participant may see their own run and completed run summary; whether the friend has not started, is in progress, or is complete; and the expiration time. A completed creator does not need to check in or take another turn. The friend's “Complete” state reveals no score, cards, decisions, or duration.

When both runs lock and pass server verification, reveal the comparison to both players.

### Expiration and inactivity

- A pending named-friend challenge expires **7 days after creation**, whether or not either player has started.
- When the recipient starts, expiration becomes the later of the existing expiration or **48 hours after that first start**. A creator who already finished simply waits.
- An unfinished run at expiry does not forfeit and does not award the other player a win. The challenge closes as incomplete.
- If the recipient never starts, a finished creator keeps access to their own run summary; it is labelled an unmatched Hedge Run, and no comparison or win is recorded.
- If either run remains unfinished at expiry, the finished player keeps their own summary, and no comparison or win is recorded.
- Expired and incomplete challenges change no public number and send no shame message.

The 7-day and 48-hour values are product defaults to test, not economy settings.

## Determinism and server replay

Minimum authoritative state:

```text
challenge: id, seed, rulesVersion, creatorId, recipientId, status, createdAt, expiresAt
run: id, challengeId, playerId, legendId?, round, cheer, discoveries[], status
run zones: deckOrder[12], hand[], slots, trainingIds[], replaced[]
choice log: round, cardId, mode, resulting state hash
```

The versioned rules module is a pure reducer. Given `seed + rulesVersion + legendId + ordered choices`, it reproduces deck order, event trail, every intermediate state, and final score. Comparison uses replayed server scores, never client totals.

A rules update creates a new version and never re-judges an open challenge. Both players in a challenge always use its pinned version.

## Practice

Practice generates the same seeded six-event run and uses the same reducer. It may compare the player with a clearly named prerecorded Practice run generated under the same seed, or simply show the player's own score. It does not create a friend challenge, record a win, affect a rating, or change resources.

Practice can expose the seed after completion for bug reports. Named-friend challenges keep the raw seed private until expiry or both runs lock.

## Playtest questions

1. Do measured active sessions land between 2 and 3 minutes, including reveal animation and reading time?
2. Can a first-time player repeat the one-sentence rule after round 1?
3. What percentage of events produce a real choice between immediate Guard, immediate Search, and Training?
4. How often does the first five-card hand lack a useful answer for the first event despite the three-way slot matrices?
5. Does Discovery-first scoring make Cheer an interesting risk budget, or make defensive cards feel like traps?
6. How often do players reach 0 Cheer before round 6? Target occasional danger, not routine truncation.
7. How often do equal seeds produce exact ties between different choice logs? Draws are acceptable; frequent draws signal insufficient expression.
8. Does showing the current and next event create useful two-step planning without slowing the run? If it overloads first-time players, test current-only in onboarding rather than changing competitive information by player.
9. Are any assertive, balanced, or protective cards chosen or Trained overwhelmingly across seeds?
10. Do players understand that 2–3 minutes describes their active run while the async comparison may arrive later?

Do not add card clauses until this numeric matrix survives these tests. If card identity remains too thin, the next isolated experiment may give each card at most one short line, such as `On Play: +1 Guard this round` or `When Trained: draw one, then put one card on the bottom`. Such lines must use the same timing windows, follow equal power budgets, and remain independent of rarity.
