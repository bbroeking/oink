# Tickle the Pig animated cards and pack opening

Implementation update: the connected local prototype, all 88 card identities, cloud-authored Rive export, and native smoke evidence are now delivered. See [current handoff](card-packs-2026-10-13/HANDOFF.md) for the authoritative implementation boundary and remaining acceptance gates. The proposal below preserves design reasoning.

Design proposal, 13 October 2026. Builds on **Rosie's Loadout: The Hunger in the Bog** rather than replacing its 88 illustrations, card identities, or printed rules. The first digital experience makes cards enjoyable to open, admire, display, and use in a short friendly game.

Claude Design canvas: [Tickle the Pig Card Packs](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d). The project's existing **Tickle the Pig Design System** is attached. Its five pages cover SeedPacket, PigCard, Pack Directions, Pack Opening Prototype, and Hedge Run. Canvas animation is a motion reference; runtime Rive verification is a separate deliverable.

## The experience

**Care for your pig, earn a parcel of cards, bring them to life, and challenge a friend whenever they can play.**

Opening is a small tactile ritual. The reward has four durable destinations: an album, a favorite display, a living illustration to inspect, and a playable card. An ordinary card should be delightful even when the player has seen it before.

Three reference lessons guide the proposal:

- Pokémon TCG Pocket gives the player physical authorship over opening and time to admire digital art. Its official material documents swipe opening, immersive/parallax cards, binders, display boards, and streamlined battles. [Official collecting guide](https://www.pokemon.com/uk/strategy/a-guide-to-collecting-cards-and-using-wonder-picks-in-pokemon-trading-card-game-pocket), [official product site](https://tcgpocket.pokemon.com/en-us/).
- Marvel Snap uses a small deck and readable board to support short decisions. Its publisher describes 12-card decks and approximately three-minute matches. This is a useful session target, not evidence that our rules already meet it. [Official overview](https://marvelsnap.com/).
- Hearthstone's duplicate protection makes early collection breadth more reliable. TTP should protect useful first copies and make later repeats legible. [Official duplicate-protection explanation](https://hearthstone.blizzard.com/en-gb/expansions-adventures/titans).

The [reference research](../research/2026-10-13-card-game-references.md) separates publisher facts from these design interpretations.

## Card set and animation

Retain the existing RLB set: six Legends, 27 Gear, 19 Critters, 13 Enemies, 16 Stunts, and seven Places. `docs/marketing/trading-cards/base-set-84/cards.mjs` remains the card identity and printed-rules source. `landing/cards/cards.json` is a generated gallery export, not the new database schema.

All six Legends are guaranteed play pieces. A random pack may contain a Legend's alternate illustration or finish only after that representation is explicitly modeled; it cannot gate choosing that pig.

Separate three concepts:

| Concept | Meaning |
| --- | --- |
| Card identity | Stable RLB ID, name, illustration, collection slot, and rules records |
| Rarity | Existing collectible classification; never a damage multiplier |
| Finish | Standard, foil, or living illustration; presentation only |

Every card uses the same outer silhouette and readable still typography. The illustration owns the space. Its animation does not move rules, names, or gameplay values.

| Treatment | What the player sees | Production scope |
| --- | --- | --- |
| Standard | Weighted reveal, tiny surface life, one tap response, beautiful static art | Shared rig across the set; moving a still is not claimed as an independently rigged character |
| Foil | Masked grazing highlight, subtle depth, touch-driven tilt | Shared 2D rig, separately authored foreground layers where available |
| Living illustration | An optional short visit inside the painting, followed by a readable card | Start with three showcase scenes; each needs actual layered/rigged art |

Finish can be applied to common art too. The player must be able to favorite a Puddle Duckling for its character rather than its rarity. Only the inspected card animates. Album grids and the opening receipt use stills.

Use the established paper, cream, ink, sage, sun, rose, and lilac palette, hard offset shadows, existing fonts, bog-truffle rarity marks, and hand-cut iconography. Pack material studies in Claude Design compare a waxed seed packet with a folded barn parcel. The production material must follow the chosen canvas direction.

## Opening choreography

Proposed timings below are tuning targets, not measurements of another game or final device acceptance.

| Beat | Player action and response | Timing target | Sound and haptic |
| --- | --- | --- | --- |
| Arrival | Earned packet appears with its source and Open action | 350–500 ms | Soft paper landing; light impact if enabled |
| Pick up | Touch lifts and tilts the packet with elastic lag | Immediate, then 120–180 ms settle | Quiet crinkle tied to motion |
| Tear | Drag the seam; progress follows distance and holds on release | Player-paced | Sparse paper fibers; one light tick at completion |
| Bloom | Seam separates, cards rise, a small puff of paper flecks | 450–650 ms | Paper release and a pleased snort |
| Reveal | Tap or swipe advances one of five cards | 220–400 ms ordinary; 600–900 ms highlight | Card flick and landing; rarity changes restraint, not loudness |
| Inspect | Tilt, touch the art, optionally Step inside | Player-paced | One character response; no constant looping sound |
| Receipt | All five cards, new count, repeat outcome, album destination | 180–300 ms | Album sleeve slide |

Partial tearing persists within the current opening. Dragging backwards does not destroy progress. Tap to open offers the same outcome without a gesture. Skip is available from the first pack and goes to the complete receipt. Rapid taps coalesce into one next-card request; they never stack multiple flips.

Use five predetermined results in the design fixture: Firefly Swarm, Mud Shovel, Puddle Duckling, Mushroom Cap, and Moon Firefly. Keep source order. Do not sort the best card last, reveal a pre-opening rarity omen, or imply that choosing a wrapper/tear direction affects the contents.

The first-time path has one short prompt at the seam and one prompt at the first card. The tenth-pack path drops teaching and allows quick reveal. A new card or chosen favorite can still earn a longer inspection voluntarily. The Claude fixture was checked through all five reveals, its repeat/foil row, optional Step inside and return, the complete receipt, and Keep in album under Reduce Motion. Partial tear retention and the accessible tap path were also exercised. These are design-fixture checks, not native device acceptance.

## Collection and use

The album has set pages, a missing-card silhouette, a favorite sleeve, and an unopened-pack shelf. One detail view shows the card's living art, ownership, finish, and the rules for the selected game mode. Do not shrink a print-ready rules block into unreadable mobile microtype.

After opening, show `3 new cards` and quiet per-card `New` or `Repeat` marks. Keep in album closes the ceremony; cards are already owned before that action. Try a practice game is a clear secondary destination. New-card inspection offers Try this look in Hedge Run only where that illustration/finish has an approved matching loaned-card representation. Both players borrow the same mechanical kit; changing expression cannot alter its values or disguise which option is being played. Other identities remain inspectable album cards until the playable pool expands. A repeat contributes to the one selected foil-finish goal, making an all-repeat pack useful too.

A future constructed mode may expose collection-dependent choices once its balance is established. It must label its rules and remain distinct from both Hedge Run and the printed Tabletop Duel.

## Earned pack integration

The [reward audit](../research/2026-10-13-card-reward-integration-audit.md) identifies real receipt-backed seams. No pack/catalog/ownership RPC currently exists. The following is a proposed addition, not a claim of shipped behavior.

### Proposed launch cadence

1. **Guaranteed welcome kit:** all six Legends, the complete matched 12-card Hedge Run starter, and two fixed tutorial packs. Everyone can play immediately. Tutorial fixtures are explicit, versioned grants, not disguised random draws.
2. **Daily parcel:** one five-card pack after the first successful, server-receipted Dig in a UTC day. Grant the entitlement in the Dig receipt transaction, keyed by `(user, daily_dig, receipt UTC date)`; the player opens it later from the pack shelf. A server reconciliation on pack-shelf read can repair an absent entitlement from an eligible authoritative receipt after the feature activation date, using that same unique key. Further Feedings that day do not mint another pack. There is no streak, missed-day penalty, or catch-up purchase. Display the reset time honestly in the player's locale. A crewless eligibility path needs a real server receipt before this faucet can ship; a client-only practice board cannot qualify.
3. **Monday parcel:** one five-card pack alongside the confirmed eligible Monday Drum purse claim. Grant it in `draw_monday_purse()`'s receipt transaction and key it to that receipt's ISO week, with idempotent reconciliation from a committed draw receipt if needed. Extra Drum balls retain their existing purse effect and do not mint extra packs. An eligible purse that is never drawn before expiry does not independently mint a pack. Existing Tickle payouts remain intact. The packet waits on the shelf rather than stacking another ceremony onto the Drum reveal.

The [1,000-run seeded cadence model](../research/2026-10-13-card-pack-cadence-model.md) used the exact 82 eligible deck identities, the starter, and explicitly hypothetical rarity weights. Weekly-only reached 90% coverage at a median 105 days and full coverage at 336 days. Daily plus Monday reached those milestones at 14 and 42 days respectively. This supports a daily habit rather than a weekly-only launch. These are full-participation model outputs, not live-player forecasts or approved launch odds. The model also found a sharp fall in new-card frequency around packs 15–20, so useful repeats are part of the first release, not deferred polish.

Keep a **Prestige parcel** as a later long-horizon milestone, with one visible fixed tier per lap if adopted. It is not necessary to launch the two recurring sources. Confirm its exact tier against the final claim table and preserve existing rewards before implementing it.

Keep packs out of individual Dig Find drops, Mote spending, Snout purchases, advertisements, and membership advantages in the pilot. Motes already have a distinct Contraption purpose. Cards used in matches never move balances or inventory, following the October matchmade-play ruling in `SKILL.md`; wins and losses do not mint packs. The loop runs from normal pig care to collecting and then social play, rather than paying players to farm matches.

### Pack policy to model

Five cards per ordinary pack. Proposed slots: two common, one uncommon, one common/uncommon/rare mixture, and one rare-or-better. Final mixture weights must be simulated and made part of a versioned server policy before implementation; they are not approved launch odds.

Prevent duplicate identities inside the same ordinary pack while the eligible tier contains five distinct choices. Within a drawn rarity, prioritize an unowned playable identity before surplus; exclude guaranteed base Legends. If a selected tier is exhausted, sample its eligible owned identities according to the explicit policy. A pack-source name cannot imply a guaranteed new card unless the server actually guarantees it.

For the pilot, the first identity copy unlocks its use in any deck that permits it. Collection counts are keepsakes, not a requirement to own two copies to run two in a deck. Repeats never automatically destroy a copy.

Choose one owned card as a **foil goal**. Every repeat contributes one unit to shared finish progress; the provisional threshold is ten repeats for one chosen foil finish. Progress is banked even before a goal is selected and survives changing the target. On reaching the threshold, the player explicitly claims the foil; surplus progress carries forward. An already-foil target cannot consume progress. The server grants the finish idempotently without removing copies. Show only the selected card and `Foil progress 4/10` on the receipt, not a new spendable wallet or a second ceremony. The threshold needs a separate finish-cadence simulation. Bespoke living scenes are not automatically craftable until their authored assets exist. **Training** remains the match action and must not name finish progression.

## Reward authority and recovery

Two separate transactions have distinct meanings:

1. A qualifying source event grants an **unopened pack entitlement**. The grant is uniquely keyed by user, source, and source period/receipt. Client retries and concurrent claim doors return that same pack.
2. Opening that entitlement locks it, selects all five ordered outcomes under a versioned policy, stores the opening receipt, and grants ownership atomically. All replay requests return the same cards and receipt. The animation starts only after that transaction is confirmed.

Suggested records are `card_catalog`, `card_variants`, `user_card_ownership`, `card_pack_grants`, `card_pack_openings`, and a finish-progress/claim ledger. These are design names, not implemented tables. The opened pack ID is the idempotency identity. A client-supplied request ID may aid tracing; changing it must never permit opening the same entitlement twice. The server derives rarity, finish, ownership, duplicate labels, collection deltas, and the repeat-progress credit in the same opening transaction. A finish claim locks its progress balance and records a unique claim before granting/debiting, so concurrent claim doors cannot spend progress twice.

Persist the pending entitlement/opening ID before the request. After a network timeout, ask for that same receipt, never a new roll. If the app closes after commit, the shelf offers Resume opening or View receipt. Reveal progress is presentation state: skipping, crashing, uninstalling, or failing to receive an animation callback cannot change ownership.

History shows the earned source and date, five outcomes, and whether the result was reviewed. Reading history and rewatching the animation grant nothing.

## Rive and application contract

The installed native runtime supports data binding and the existing Mote Machine provides the lifecycle pattern. Prefer a script-free 2D asset: true 3D/GPU Canvas requires a newer iOS runtime than this project currently installs. [Rive feasibility and official sources](../research/2026-10-13-card-rive-feasibility.md).

One active `RiveView` draws one active card. Static card backs make the fan; static fronts make the receipt. React Native owns all readable rules and controls, accessibility, server calls, saved state, gesture capture, audio/haptic preferences, and navigation. Rive owns material response, lifting, flipping, foil, local character motion, and visual checkpoints.

Minimum production artboard and machine: `CardPackReveal` / `CardPackRevealMachine`. Default view model: `CardPackRevealViewModel`, instance `Default`.

| Property | Type | Direction and purpose |
| --- | --- | --- |
| `tearProgress` | Number 0–1 | App to Rive, monotonic gesture progress |
| `tiltX`, `tiltY` | Number −1–1 | App to Rive, clamped and frame-coalesced |
| `revealIndex` | Number 0–4 | App to Rive, confirmed source order |
| `finish` | Enum | App to Rive, presentation treatment |
| `cardArt` | Image | App to Rive, currently inspected art |
| `reduceMotion` | Boolean | App to Rive, rest/crossfade lane |
| `open`, `reveal`, `inspect`, `reset` | Trigger | App to Rive, one visual action per presentation token |
| `tearComplete`, `cardSettled`, `sequenceComplete` | Trigger | Rive to app, optional visual checkpoints, never ownership authority |

The exact compiled names/types must be recorded in an asset manifest and checked against the binary. App-side timeouts substitute a still and Continue if any checkpoint is absent. Touch tilt is the default; motion sensors are an optional device experiment, not a prerequisite.

Rive's official CLI can create script-free local `.riv` files while signed out. Keep reproducible RML source and build version beside a prototype; compile and inspect the actual output. Editor/cloud round-tripping and signed publishing are separate account-dependent actions. [Official CLI getting-started source](https://github.com/rive-app/rive-docs/blob/main/cli/getting-started.mdx).

### Actual local Rive prototype

The [editable RML source and instructions](./card-packs-2026-10-13/rive/README.md) and [compiled card-pack-reveal.riv](./card-packs-2026-10-13/rive/build/card-pack-reveal.riv) now exist. The binary is 874,795 bytes, built with official CLI 1.5.1; SHA-256 `8817f2284e967795a49b52c3808e4844fce7ac3fd7859213614418c8fc831bf6`.

Its inspected artboard, machine, and view model match the names above. It implements `tearProgress`, `revealIndex`, `reduceMotion`, `tiltX`, `tiltY`, `open`, and `reset`; five embedded gallery fronts; a split seam; a 700 ms opening; vector foil; and prototype Next/Reset controls. CLI verification reports zero errors/warnings and inspection reports no wiring problems. Captures exercise one-card advance, five-click wrap, reset after advancement, reduced motion, and foil/tilt. This is an interaction proof with a schematic pig stamp, not the final material artwork or rigged living card set.

The remaining production properties in the table, including dynamic `cardArt`, finish selection, and completion triggers, are authoring requirements rather than properties already present in this binary. Production reveal order must stop at card five and go to the app receipt; the prototype's wrap control is only for repeated review. The exact binary still needs import, binding, memory, and frame-pacing checks on the app's installed iOS/Android runtime.

## Simple game

[Rosie's Loadout: Hedge Run](./2026-10-13-card-quick-play-rules.md) meets the user's corrected design brief: **a two-to-three-minute active session with asynchronous play**. Each participant makes six Play-or-Train choices through the same Great Hungerer trail. Twelve loaned cards offer visible Guard/Search tradeoffs in four loadout slots. Training supplies permanent Search for that run. Current and next events are visible, so the player can plan. Apply Danger first, then bank the event's Discovery only if the pig survives and meets its Search target. Compare Discoveries, then remaining Cheer, then draw. A found Discovery is a game piece and never an actual inventory or season grant.

Bind a named friend at challenge creation and commit the common seed, deck order, and rules before revealing the creator's hand. The creator plays immediately while that friend may be offline; the friend plays later in one sitting. Both get the same loaned mechanical choices and NPC events. Neither sees the other pig's moves or score before both finish. Runs resume after interruptions. There are no six paired-turn check-ins, ranked results, public win counts, or forfeits for an unfinished challenge. Off-app screenshots and choice sharing remain possible; this is a private friendly challenge, not a claim of cheat-proof ranked competition. Open-link and random competitive modes are deferred.

The clock describes each pig's active play, not elapsed time waiting for an offline friend. Card inspection is outside that session budget. The exact rules, scoring, adverse draws, ties, and invite/replay boundaries belong in the linked rules document. Collection expression enters through pigs, illustrations, and finishes; balanced loaned mechanical choices preserve fairness independently of pack luck.

The fixed six-round walkthrough has been checked with an independent arithmetic replay: its legal choices finish at **five Discoveries and eight Cheer**. Playing Toy Sword before the Cap instead finishes at **six Discoveries and seven Cheer**, demonstrating that card order can change the result. A one-Cheer final-round Training choice reaches zero and cannot bank that event; defensive Play survives and wins the equal-Discovery tiebreak. These checks validate the example and resolution order, not the session duration or long-term balance.

The Claude fixture has also been clicked through all six rounds manually. It matched the five-Discovery/eight-Cheer walkthrough, resumed a closed fourth-round run without duplicating its result, kept Sam's result concealed while pending, and then compared correctly as a draw. Its review controls produced and compared a four-Discovery/nine-Cheer loss and a six-Discovery/eight-Cheer win. The fixture currently has ten clearly marked placeholder card illustrations; production art exists in the repository and must be brought into those faces. Some Discovery names in the fixture are placeholder flavor names. These checks do not validate a real invitation, server sealing, cross-device resume, or session duration.

## Implementation sequence and acceptance

| Slice | Reviewable output | Acceptance |
| --- | --- | --- |
| Design and material choice | Claude canvas, interactive fixture, storyboard | Review actual tear, reveal, inspection, receipt, 320pt and Reduce Motion paths |
| Rive spike | Editable local RML, actual `.riv`, visual captures | Existing fixture proves open/index/reset/Reduce Motion; real receipts require dynamic art/finish, stop at five, completion/fallback, and exact native import/memory/frame tests first |
| Collection spine | Catalog, entitlement and ownership contract behind a flag | Concurrency/retry/resume preserve one opening and exactly five grants |
| Earned hooks | Welcome, daily first-Dig and Monday grants | Original rewards unchanged; source entitlements unique; crewless eligibility has a real receipt; queued packets do not interrupt care |
| Hedge Run | Shared pure rules module, labelled Practice, async friend challenge | Complete run targets 2–3 active minutes; same-seed comparison, deterministic scoring, concealed opponent result, replay and expiry verified |
| Collection economy trial | Acquisition simulation and small cohort | Known cadence, useful repeats, no pay advantage, production capacity for new living art |

Any authored production economy/native/player-system implementation must enqueue `docs/release-followups.json` through the existing tool. Run `npm run quality:loop` while changing player layouts or API contracts and `npm run quality:check` before handoff. Database pushes still need explicit user go. Any distributable build follows `docs/RELEASE_CHECKLIST.md`.

No production economy change, database migration, deployment, or distributable build is part of this design proposal. The outstanding acceptance is actual playtesting and exact native Rive verification, not more reference collection.
