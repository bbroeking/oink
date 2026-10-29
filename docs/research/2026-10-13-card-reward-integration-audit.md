# Card/reward integration audit — 2026-10-13

## Executive finding

Tickle the Pig already has a coherent, mechanically specified card product: **Rosie's Loadout: The Hunger in the Bog**, 88 unique cards, six guaranteed Legends, an 18-card matched learn-to-play format, a 24-card constructed format, generated card fronts, full source art coverage, printable proofs, and a public web gallery. What does **not** exist is an in-app card catalog, pack inventory, card ownership ledger, pack-opening receipt, deck persistence, or server game contract.

The cleanest integration is therefore additive:

1. give every player a fixed playable starter kit (including all six Legends; never randomize Legends);
2. add one earned weekly pack to the Monday Drum and one pack to each Wallow lap;
3. let the server commit the pack contents before a Rive pack-opening performance begins;
4. launch collection/deck building against the already specified Rosie's Loadout rules rather than inventing another card game;
5. keep cards out of Tickles, Snouts, Motes, cosmetics, and Dig-find drop tables at first.

That gives packs two understandable homes—weekly participation and long-horizon prestige—without replacing the current economy or turning every tap/dig into card noise.

## Existing card product (current, reusable)

The canonical machine-readable definition is `docs/marketing/trading-cards/base-set-84/cards.mjs`; `landing/cards/cards.json` is a generated gallery export, not the authoring source. The gallery declares set id `rosies_loadout_base_1`, code `RLB`, and 88 cards. The current distribution is:

| Class | Count |
| --- | ---: |
| Legends | 6 |
| Gear (Head / Held / Aura) | 27 (9 each) |
| Critters | 19 |
| Enemies | 13 |
| Stunts | 16 |
| Places | 7 |

Rarity is 31 common, 26 uncommon, 16 rare, 6 epic, and 9 legendary. Rarity explicitly controls collectibility, rules complexity, and showcase treatment rather than raw strength (`docs/marketing/trading-cards/base-set-84/README.md`). Rank controls when a card can be played.

Reusable definitions and assets:

- `docs/marketing/trading-cards/base-set-84/cards.mjs`: source card records, mechanics, Training strips, art assignments, styles, ranks, rarities, and collector numbers.
- `landing/cards/cards.json`: generated JSON suitable as a starting client catalog export; includes `img`/`thumb` paths and Legend-specific fields.
- `landing/cards/img/`: 88 full WebP fronts plus thumbnails, already used by the public gallery.
- `docs/marketing/trading-cards/base-set-84/visual-system/*.svg`: editable vector masters for all fronts.
- `docs/marketing/trading-cards/base-set-84/visual-system/*.png`: generated proof fronts/contact sheets.
- `assets/images/trading-cards/base-set-art/` and `assets/images/trading-cards/full-art/`: assigned illustration sources.
- `docs/marketing/trading-cards/base-set-84/VISUAL-SYSTEM.md`: eight front layouts, typography, rarity symbols, information hierarchy, and animation-friendly identity accents.
- `scripts/validate-trading-card-base-set.mjs`: set validation.
- `scripts/render-trading-card-visual-system.mjs` and `scripts/build-trading-card-gallery.mjs`: renderer/export pipeline.
- `scripts/prototypes/rosies-loadout-sim/game.mjs`: pure in-memory rules prototype with a CLI; useful as a behavioral reference, not production authority.

The six Legends—Rosie, Copper, Pepper, Bandit, Pickles, Biscuit—start outside the deck at 12 Cheer and are guaranteed play pieces. `docs/marketing/trading-cards/base-set-84/LEGENDS.md` explicitly says they are never obtained by a random in-game effect; only cosmetic alternate art may be collectible. Preserve that invariant in digital packs.

The existing game is already more than a visual mock. `docs/marketing/trading-cards/ROSIES-LOADOUT-DUEL-SPEC.md` defines an 18-card-per-player matched prototype. `PLAYTEST-RULES-V2.md` and the simulator cover Training, level-gated play, Gear, Critters, combat, and deterministic damage. The expanded set specifies a 24-card constructed deck, two-copy limit, one-copy Legendary limit, and style matching to the chosen Legend (`base-set-84/README.md`). This is the obvious simple-game starting point: ship the matched learn-to-play format first, then constructed decks.

## What is not implemented

A repository-wide search finds no production `card_catalog`, `user_cards`, deck, pack, or pack-opening schema/RPC/UI. The card gallery and printed-card redemption work are separate web/marketing artifacts. Existing QR-backed cards grant cosmetics through redemption; they do not establish digital card ownership (`docs/marketing/trading-cards/README.md`, `utils/redemption.ts`).

There is a July design/prototype for Rosie's Ramble in `docs/expedition-idle-battler-plan.md`, `docs/expedition-handoff.md`, `utils/expedition.ts`, and `hooks/useExpedition.ts`. It proposes `expedition_card_catalog`, `user_expedition_cards`, duplicate counts consumed as permanent Training, and card-related RPC names. None of those tables/RPCs exists in migrations or generated database types. The hook persists client-local v0 state under AsyncStorage key `expedition_v0`. Treat the document as an exploration, not a live seam.

It also uses an older class term, **Trick**, while the current 88-card set uses **Stunt**, and its duplicate-consuming Training changes the tabletop meaning of Training. In current Rosie's Loadout, Training is an alternative way to use a card during a match; it does not consume a duplicate from the collection. Do not silently merge those meanings.

## Current reward economy and cadence

### Core Tickle/Snout loop

The Home tap uses `update_home_tickle(uid)` when rewarded ads are enabled and otherwise `update_profile_and_item_count(uid)` (`components/Barn.tsx`). A successful manual tap consumes one spendable Tickle and raises both `profiles.tickles_earned` and `profiles.counter` (Snouts). `utils/homeTickleConnection.ts` optimistically mirrors those fields, then reconciles to the RPC result. Daily lucky-number hits can grant +5 banked Tickles, and the separate Lucky Pig presentation can call `lucky_bonus_tickle()` for a bonus applied Tickle.

`apply_tickles(p_user, p_n)` is the named server seam for non-bank applied Tickles (`supabase/migrations/20260913120000_dig_find_tickles.sql`). It increments lifetime/standing `tickles_earned` and Snout `counter`, but never the spendable Tickle bank. Card grants should not pass through it: that would falsely alter both standings and Snouts.

### Dig/Feeding cadence

Feedings currently use uniform eight-hour windows, with three opportunities per UTC day (`CONTEXT.md`, Feeding clock). A submitted Snout Deep board is durably represented by `rooting_receipts`, unique per `(user_id, window_index)`. Current submit doors are `submit_rooting`, `submit_rooting_checked`, and `submit_rooting_deep`, ultimately carried through `_submit_rooting_deep_core` / `_submit_rooting_reward_v1` in the latest migration chain.

Every banked Dig Find already awards applied Tickles by configured kind through `_dig_find_tickles()` and `apply_tickles()`; the receipt stores the itemized tally (`20260913120000_dig_find_tickles.sql`, with the latest core carried into `20260921150000_drum_draw.sql`). Shimmer Pockets also mint one Mote. Adding a pack roll to individual finds would stack a fourth reward language onto an already dense receipt and could expose up to three pack chances daily. Avoid it for MVP.

### Monday Drum (active weekly Dig reward)

The current weekly Dig reward is the Drum, not the older herd race or Barn/herd draw. `20260921150000_drum_draw.sql` is later than `20260916110000_monday_tickle_draw.sql`, `20260916120000_barn_draw_and_trough_quarter_reward.sql`, and `20260917120000_herd_prize_announce.sql`, and explicitly retires/stubs the older race/herd-prize contracts.

Each submitted Dig produces one ball, capped by the player's expected Feeding windows for that week (21 under the default schedule). `monday_draw_state()` returns the drawable/running snapshots; `draw_monday_purse()` takes a per-user advisory lock, checks the `(user_id, iso_week)` receipt, commits all tier rolls to `monday_draws`, and pays the best purse through `apply_tickles()`. `hooks/useMondayDraw.ts` is the current client read/write seam.

This is the strongest weekly pack attachment point because it already has a once-per-player-per-week, server-committed reveal ceremony. A pack can be granted alongside the draw receipt without inventing another weekly screen or replacing the Tickle purse.

### Weekly bounties (quest-like system)

The game calls these **Bounties**, not quests. `my_weekly_bounties()` returns three rotating social goals with progress and Snout rewards; the latest definition is in `20260674000000_lucky_pig_hits.sql`. `claim_bounty(bounty_code)` re-derives eligibility server-side and inserts `user_bounty_claims(user_id, bounty_code, week_start)` before paying Snouts (`20260524000000_bounties.sql`).

The individual claim is reliable and idempotent, but there is no current “completed all three” receipt or single weekly finale claim. A bounty pack would therefore require a new aggregate claim seam. It is a reasonable later social pack source, but it adds more machinery than the Drum for MVP and would create two weekly pack lanes immediately.

### Wallow / Prestige Path (active long horizon)

The latest contract is the September chain ending at `20260922100000_endless_wallow.sql`, documented in the rewritten `docs/prestige-wallow-spec.md`. `season_state()` reads the current lap and rewards. `claim_season_tier(...)` / `claim_ready_tiers(...)` are the client-facing consolidated claims and delegate to `claim_wallow_tier()` for Prestige Path rewards. `wallow()` is row-locked and advances a lap only after required rewards are claimed.

Each lap currently offers 375 Snouts, four Golden Truffles, one Mystery Hat Box, and—at permanent W3+—five Motes across 30 tiers. Ranks 1–6 grant regalia and ranks 7+ are protected by `wallow_rank_prizes(user_id, rank)` receipts. Wallow is explicitly not a Tickle payout.

A pack per completed lap is a coherent second faucet. The safest MVP placement is a normal Prestige Path tier with the same season/lap/tier claim identity as other path rewards, rather than modifying the rank-prize rule. This keeps card cadence lap-based, visible before earning, and idempotent through the existing claim structure.

### Adventures / errands

“Adventure” is a designed domain in `CONTEXT.md`, but the active server feature closest to it is the Pen **Errand**, one per pig per local day. `pig_errands` is unique on `(user_id, pig_id, local_day)` and `(user_id, nonce)`; `claim_errand(p_id, p_action, p_nonce)` materializes a Find into the Satchel (`20260918120000_pig_errands.sql`). Errands mint Finds, and their current design explicitly says “Only a Find is ever minted.” Do not attach packs here without revisiting that domain promise.

The Beyond the Hedge Adventure material and Rive authoring docs are useful narrative/animation references, not a shipped card reward seam.

### Motes and the Mote Machine

Motes are scarce earned consumables from Shimmer Pockets and the Wallow path. The server owns `profiles.mote_balance` plus `mote_wallet_revision`; reveal/wager receipts commit outcomes before animation (`20260905174000_prestige_mote_rewards.sql`, `20260906010000_mote_wagering_v2.sql`). The Mote Machine is reserved for Contraption unlock/charge rewards. Packs should not consume Motes or appear in that paytable: doing so would replace the identity of an existing scarce resource and confuse the two reveal machines.

## Reliable patterns to reuse

The codebase has several proven grant patterns:

- **Receipt first, grant second:** `draw_monday_purse()` inserts the unique `monday_draws` row before calling `apply_tickles()`. `claim_bounty()` inserts `user_bounty_claims` and checks whether its row actually landed before updating Snouts.
- **Request replay keys:** errands use `(user_id, nonce)`; Mote plays use request ids and replay their stored outcome.
- **Ownership plus acquisition receipt:** `_require_habitat_grant(...)` inserts the unique ownership row and a source/source-ref receipt with `newly_owned`, allowing UI presentation without guessing whether ownership changed (`20260906190000_player_barn_housing.sql`, carried and expanded later).
- **Wallet revision:** the Mote wallet bumps a server-managed revision on balance changes to detect another-device races.
- **Server outcome, client performance:** Monday Draw and Mote Machine return committed results for animation. The animation never selects or grants the reward.

Cards need both quantity and provenance, so the Barn's boolean-ownership schema cannot be copied literally. A minimal robust shape would be:

- immutable/versioned card catalog keyed by set + card id;
- `user_card_inventory(user_id, card_id, quantity, first_acquired_at, updated_at)`;
- `card_pack_openings(user_id, opening_id/request_id, source, source_ref, set_id, committed_at, presented_at)` with uniqueness on both replay id and `(user_id, source, source_ref)`;
- ordered `card_pack_opening_cards(opening_id, position, card_id, treatment)` rows;
- server RPC that locks/claims the source, chooses from a versioned collation table, writes opening + contents + inventory in one transaction, and replays the exact stored result on retry.

Do not infer “new” by reading the inventory after opening. Return `quantity_before`, `quantity_after`, and `newly_owned` from the committed receipt, mirroring the Barn acquisition journal. Do not let Rive choose rarity, card, treatment, or duplicate conversion.

## Recommended MVP integration

### 1. Fixed starter, not an opening gamble

Grant a versioned starter collection exactly once. Include all six Legends and two fixed, balanced 18-card matched decks (or the exact contents selected from the existing duel spec). This makes the card game playable before the first random pack and respects the guaranteed-Legend rule. The starter receipt should be replayable and should not fire the premium pack ceremony card-by-card.

### 2. Two earned pack sources

**Monday Drum pack:** one standard five-card pack when the player draws an eligible week's purse. Grant it in the same server transaction or through a source claim uniquely keyed to that Drum `(user_id, iso_week)`. Keep the existing Tickle purse unchanged. One pack maximum per week; ball count may improve the current purse odds but should not multiply packs.

**Wallow pack:** one showcase five-card pack on a visible Prestige Path milestone each lap. Use the existing season + lap + tier claim identity. Keep Golden Truffle, Mote, Snout, Mystery Hat Box, and rank prizes intact.

This yields a predictable baseline of roughly one pack per active week plus one per completed Wallow lap. Hold bounty, individual Dig, Errand, ad, shop, ritual, visit, and Mote-machine packs until collection data shows the cadence is too slow.

### 3. Conservative pack collation

Start with five deck cards, Legends excluded, and commit a versioned collation rule server-side. One practical first rule is three commons, one uncommon-or-better, and one rare-or-better slot, with explicit duplicate protection only for a player's first few packs. Keep card power tied to rank/style and rarity tied to collectibility as the existing set requires.

Avoid automatic duplicate conversion in MVP. The constructed game already allows two copies, so quantity matters. Display the owned count and use only the copies a deck actually needs. Decide later whether surplus copies feed cosmetic mastery/foil progress. Do not reuse the Ramble plan's permanent-stat Training proposal unless that separate power economy is deliberately revived and server-capped.

### 4. Rive pack opening as a receipt player

The client calls the pack-open RPC first. After it receives the immutable ordered contents, the Rive state machine performs sealed → tear → fan → per-card reveal → summary. Inputs should describe presentation only: pack/set theme, card count, current reveal index, rarity/treatment beat, skip/reduce-motion flags, and completion triggers. The actual card fronts can use the existing WebP/SVG export pipeline; animated card treatments should be layered effects around a stable front rather than 88 independent Rive files for MVP.

If the app closes mid-animation, reopening reads the unpresented committed receipt and resumes or shows the summary. Acknowledge presentation separately after the collection state is already durable. Reduce Motion should skip continuous foil/parallax motion and retain a short readable reveal.

### 5. Game rollout

Ship one fixed matched matchup using the existing 18-card rules before opening constructed deck building. Port `scripts/prototypes/rosies-loadout-sim/game.mjs` into the platform-free `multiplayer/games/` pattern only after pinning rules with replay fixtures. The existing matchmade-play architecture in `CONTEXT.md` already separates pure rules, room engine, protocol, server persistence, and React Native board rendering. Card matches must preserve its current rule that matchmade play does not touch currency, inventory, Happiness, Streak, or season state; collection ownership may determine deck legality at matchmaking time, but match results should not grant economy rewards in MVP.

## Pitfalls and stale-doc warnings

- `landing/cards/cards.json` is generated; editing it would be overwritten. Author in `cards.mjs` and rebuild.
- The directory name `base-set-84` is historical; the live set contains 88 cards after Sounder Spoils 085–088.
- The physical-card README still describes reward-card QR codes and expired/capped cosmetic campaigns. Those are not digital pack supply rules.
- The July expedition handoff says its work was uncommitted and proposes nonexistent server tables. Current source still has local prototype files, but no migration/backend implementation.
- Older Barn Draw/herd race docs and RPCs are superseded by the 2026-09-21 Drum migration. `herd_prize_state()` and race endpoints remain callable only as retired stubs for shipped binaries.
- “Quest” is not current product vocabulary. Use Bounty for the weekly social system, Errand for Pen searches, and Adventure only for Beyond the Hedge.
- The set's Legends are guaranteed external-deck play pieces. Putting base Legends into packs would make collection randomness gate basic play and contradict `LEGENDS.md`.
- An 88-unique-card collector set is not enough to provide two constructed physical/digital decks without duplicate copies; starter grants must deliberately include playable quantities.
- Existing card fronts are static outputs. “Animated cards” needs a treatment contract (foil/glint/parallax/character loop) and asset-budget decision; do not assume first-pass generated illustrations are final production art. The base-set README says 34 selected paintings still need human identity/anatomy/crop/print review and nine adaptations still need dedicated illustration treatment.
- This is a major economy/player-system change. When implementation begins, enqueue it in `docs/release-followups.json`, use the quality loop for player-facing/server-contract changes, and follow the release checklist for any distributable build. Database push still requires explicit user “go.”

## Minimal implementation order

1. Freeze a v1 catalog export and starter deck lists from `cards.mjs`; validate the current set.
2. Add catalog/inventory/opening/content schema plus an idempotent fixed-starter claim and a developer-only deterministic pack-open RPC.
3. Build collection and receipt-summary UI using static fronts; prove recovery/replay and duplicate counts before Rive.
4. Author the Rive pack-opening state machine against the frozen receipt/presentation contract; animation consumes committed results.
5. Attach one pack source to the Drum, then one Prestige Path milestone to Wallow; preserve existing payouts.
6. Port and test one 18-card matched game through the existing platform-free match architecture.
7. Add constructed decks only after ownership/deck legality and two-copy rules are stable.

