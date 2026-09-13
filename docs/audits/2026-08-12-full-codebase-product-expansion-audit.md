# Tickle the Pig: full codebase, product, and expansion audit

**Date:** 2026-08-12  
**Scope:** product charter, live client, Supabase history, tests and quality
gates, current aggregate analytics, public positioning, prototypes, and the
adjacent-market research in
[`docs/research/2026-08-12-market-niche-expansion.md`](../research/2026-08-12-market-niche-expansion.md).

## Executive verdict

Tickle the Pig should not position itself as a clicker with many side games.
Its defensible niche is:

> **Tactile pig comedy × a friendship ritual for a real group chat × cozy
> collection.**

The immediate hook is **touch this pig and get a funny response**. The durable
reason to return is **my actual friends can affect, visit, remember, and show
off this authored pig world**.

The founder instinct that every road should lead to more tickles is right, with
one necessary refinement: every feature should lead **back to the tickle loop**,
but not every feature should be an unlimited raw-tickle faucet. A new activity
may:

1. award a small bounded number of tickles;
2. change where the next tickles have extra effect;
3. make a friend's tickles socially meaningful;
4. convert tickling into a lasting reaction, discovery, room object, story, or
   shared memory.

That preserves one understandable economy and stops new modes from inflating
the bank, Wallow progression, season scoring, and leaderboards.

The recommended expansion order is:

1. deepen tickling itself with discoverable reactions and techniques;
2. deepen visible friendship history around visits, guestbooks, and Porch
   Rounds;
3. make the six-slot Barn interior the durable collection and social-display
   sink;
4. add one rotating asynchronous pig-native micro-game lane, not an arcade;
5. ship the smallest observed-and-validated Homegrown Adventures loop;
6. reuse those verbs for seasons rather than inventing a new game every season.

Defer a combat RPG, a synchronous Lounge as a core loop, a broad mini-game hub,
and any new permanent currency.

## What exists today

The shipped product already has three coherent layers.

### Core care and tactile loop

- Tickle the Home pig through a regenerating bank.
- Earn spendable and scored progress.
- See happiness as Rosie's pose rather than as a meter.
- Trigger authored animations, Lucky Pig moments, effects, and cosmetics.
- Build long-term prestige through Wallow.

### Friendship loop

- Find and add friends.
- Visit and tap-tickle their pigs.
- See their mood and equipped identity.
- Bless, curse, trade, stamp guestbooks, and leave asynchronous traces.
- Form a Sounder and preserve visits in a Porch Round scrapbook.

### Collection and contention loop

- Buy, earn, preview, and equip cosmetics, titles, companions, backgrounds,
  effects, and discoveries.
- Complete achievements, bounties, season tiers, Field Guide/Burrow Book
  collections, and Wallow laps.
- Join communal Feeding digs, weaken the Great Hunger, and run a weekly
  Sounder Dig-Off.

That is a much better product than the public store description currently
communicates. The product problem is not a lack of mechanics. It is that the
existing breadth is not yet organized around one market promise or measured as
one group-activation funnel.

Several rich directions are prototypes, not current market promises:

- Expedition is development-only.
- Lounge redirects to Shop in production.
- Homegrown Adventures is a substantial browser/Rive prototype, not a shipped
  native loop.
- Rewarded ads are compiled and feature-dark, with deployment work deferred.

The game should not call itself an RPG, farm sim, MMO, or arcade based on these
candidate systems.

## Current live-data read

The production aggregate RPC returned the following snapshot at approximately
14:03 UTC on 2026-08-12. These are account aggregates, not a cleaned investor
metric, and `barn_visits` records successful visit tickles rather than distinct
visit sessions.

| Signal | Current read | What it suggests |
|---|---:|---|
| Profiles in aggregate | 76 | Still founder-network scale; a few people can move totals |
| Active 1d / 7d / 30d | 15 / 28 / 51 | The existing base has real repeat use |
| DAU / 30d active | 29% | Encouraging early stickiness, not yet a mature retention measure |
| 7d / 30d active | 55% | A meaningful weekly habit exists for part of the base |
| Friendships | 327 | About 4.3 accepted edges per profile; enough for async social play |
| Push enabled | 24 (32%) | In-app discovery and history must work without push |
| Successful visit-tickle rows | 17,436 | The friend pig is the strongest measured social surface |
| Blessings / curses / trades | 2,057 / 1,105 / 1,101 | Lightweight directed acts have sustained usage |
| Feeding/truffle digs | 1,904 | The communal dig has non-trivial participation |
| Referrals completed | 4 | Acquisition/group activation is a much bigger constraint than content breadth |
| Tickles earned / wasted | 92,602 / 18,697 | About 17% of measured potential was wasted at cap |
| Slop Club profiles | 1 | Monetization is not yet validated |

Across the 13 complete days from July 30 through August 11, the aggregate
averaged roughly:

- 333 successful visit tickles per day;
- 32.8 Feeding/truffle digs per day;
- 31.5 blessings and 18.6 curses per day;
- 11.7 trade rows per day;
- 0.8 signups per day.

The strongest behavioral inference remains:

> **See another pig → perform one small gesture → leave a trace → let the
> other person discover it later.**

### Data that must not drive decisions yet

- `season.players` reports 94 against 76 aggregate profiles. Season rows are
  duplicated across seasons/laps and the RPC does not isolate the active
  season, so the season aggregate is currently not decision-grade.
- The analytics vocabulary declares events for Barn, Feeding, ritual, Lounge,
  Shop, Season, and sharing, but current call sites are concentrated around
  visits, guestbook actions, and Porch Round. Exposure, unique actors,
  recipient opens, and repeat rates are largely missing.
- Fifty-five of 76 pigs currently fall in the sad happiness band, but this
  includes inactive/stale accounts. Happiness must be cut by active cohort
  before interpreting it as a care-loop failure.
- The aggregate has zero negatively aligned profiles. That may mean the
  Greedy/Giver choice has collapsed into an obvious answer, or simply that the
  current audience and reward rules favor generosity. Measure choice exposure
  and consequences before either removing or expanding alignment.

## Product and market niche

### The niche to claim

Acquisition line:

> **Raise a ridiculous pig with your friends.**

Brand line:

> **Your group chat has a pig now.**

Product category:

> **A cozy friendship pet for small groups.**

This is distinct from:

- couple-first shared-pet apps;
- solo virtual-pet and cozy-idle collectors;
- chat-led mini-game hubs;
- public social feeds;
- high-commitment synchronous multiplayer games.

The moat is the intersection, not any single mechanic: one authored mascot,
directed real-friend acts, harmless mischief, visible history, collection with
an audience, and seasonal communal stakes without a public feed.

### The strategic constraint

The product currently has more systems than its player acquisition funnel can
support. Four completed referrals and fewer than one signup per complete day
say that another large isolated mode will not solve the primary bottleneck.
Expansion should make the existing promise easier to show, invite into, and
repeat with another person.

The north-star unit should be a **weekly activated group**, defined as a pair or
Sounder where at least two distinct members complete one meaningful shared act
within the week. Raw taps and installs are supporting measures.

## Expansion ranking

### 1. Reaction Book: deepen the namesake verb

**Verdict: build first.**

Create a small catalog of authored Rosie reactions discovered through
understandable tickle conditions:

- tap, rub, short swipe, pause-and-tap, or simple rhythm phrases;
- mood, outfit, time, friend hoofprint, or active-effect variations;
- a daily hint such as “Rosie’s ear looks especially ticklish today”;
- a photo/scrapbook entry when a reaction is first discovered;
- a bounded first-discovery tickle reward and no repeatable infinite faucet.

Why it wins:

- It makes the title's verb deeper without adding a destination.
- It produces highly shareable character comedy.
- It supplies collectible content in small authorable batches.
- It works solo and becomes richer when a friend triggers a variant.
- It gives Homegrown Adventures, cosmetics, rituals, and seasons something to
  modify later.

MVP: 8–12 reactions, 3 input phrases, one Reaction Book page, one daily hint,
and first-discovery rewards capped across the set.

Success gate: at least 40% of exposed active players discover a second
reaction, at least 25% revisit the book, and Home tickle completion does not
fall.

### 2. Friendship history: finish the social compounding loop

**Verdict: deepen next; much of the foundation is already live.**

Guestbooks and Porch Rounds are the right direction. Unify them into a visible,
non-expiring record of actual visits:

- outfit/mood portrait at the moment of the visit;
- one optional stamp, kindness card, or prepared tiny gift;
- a calm host recap with the visitor's trace;
- finished three-stop Porch pages that remain warm when incomplete;
- one-tap group-chat sharing of the page.

Do not add a timer, show who failed to visit, or turn every visit into a
checklist. A bounded bonus may celebrate a naturally completed page; the page
must remain valuable without it.

Success gate: lift distinct friends visited per weekly actor, recipient-open
rate, and both-active D14 for connected pairs without concentrating visits on
only the most popular pigs.

### 3. Barn interior/Habitat: give collecting a stage

**Verdict: strongest durable sink.**

The existing six typed slots are the correct solo-developer scope. The Barn
interior should be where:

- snouts buy ordinary decor;
- discoveries unlock unusual decor or recipes;
- seasons and Sounders award trophy objects;
- Slop Club sells expression, saved room looks, and photo props;
- friends see and leave a non-economic reaction to the room.

This compounds Shop, visits, Adventure finds, physical cards, and membership
without turning decor into stat equipment.

Success gate: owned-to-placed conversion, percentage of visits that reach the
interior, reactions per viewed room, and higher repeat visiting among players
with a customized room.

### 4. One rotating asynchronous micro-game lane

**Verdict: build one engine and one game; do not build a hub.**

The first lane should use a shared daily seed and be complete in 20–60 seconds.
A good first expression is a **Tickle Rhythm** or **Mud Putt** challenge:

- one input verb;
- one legible result;
- the same seed for friends/Sounders;
- personal completion first, friend/Sounder comparison second;
- 1–3 bounded tickles or a once-daily bonus for participation;
- a Sounder target that sums runs without ranking individual members.

Architecturally, the reusable module should own seed issuance, attempt
admission, authoritative scoring, idempotent settlement, result history, and
payout caps behind a small interface. A second game is justified only after
the first proves repeat use; then the shared-seed adapter becomes a real seam.

Success gate: 30% weekly reach among exposed players, 35% next-week repeat,
measurable group reactivation, and no material leaderboard movement from the
new faucet.

### 5. Homegrown Adventures

**Verdict: highest-upside larger expansion, after observation.**

This is the best large concept in the repo because it expands out from Rosie
and Home rather than importing another genre. The loop is understandable:

> grow or choose a provision → prepare Rosie's Bag → send her beyond the
> hedge → welcome her Home → discover one named thing → change the Barn.

Use tickles as send-off affection or a bounded preparation choice, not as
energy that blocks departure. Return a few tickles plus a named Find, story,
seed, tool mark, or visible Home change. Duplicates should advance a visible
relationship or object rather than become vendor trash.

Do not move the full browser prototype directly into production. Complete five
fresh-player observed tests against the existing validation criteria, then
ship one destination, two meaningful preparation changes, one complete
Discovery, one Near-Discovery, and one lasting Barn consequence.

### 6. Seasonal reuse and platform amplification

Continue communal seasons, but assemble them from proven verbs: tickle, visit,
prepare, dig, decorate, and discover. New art and narrative can change the
fantasy without adding a new economy every time.

After the core loop is clearer, high-leverage amplifiers are:

- a Rosie widget for mood/readiness/recent hoofprints;
- Pig Cards/postcards and physical-to-digital collection;
- one Apple In-App Event for a genuine season opening or finale;
- narrow Game Center achievements/leaderboards for discovery, not a second
  social graph.

## What to defer

### Combat-forward Expedition

Keep the good ideas—away-time, preparation, postcards, discoveries, Sounder
walls—but do not make DPS, gear rarity, enemies, or formations the headline.
That makes tickling secondary and creates a balance/content treadmill.

### Synchronous Lounge as a core bet

At this audience size, an empty real-time room creates a failure state that an
asynchronous Barn never does. The Lounge can become an occasional member
delight or scheduled event after the async loop is stronger.

### Broad mini-game hub

Breadth divides QA, art, instrumentation, economy tuning, and player attention.
One rotating lane should prove itself before a second concurrent activity.

### New currencies and permanent tracks

Tickles, snouts, Golden Truffles, season XP, Wallow, collections, cosmetics,
and membership are already enough. Prefer a named object or progress in an
existing collection.

### Another appointment cadence

The game already has happiness decay, tickle regeneration, visit windows,
four Feeding windows, bounties, shop rotation, and seasons. New content should
add anticipation or history, not another way to be late.

## Economy and fairness audit

### Treat tickles as the universal output contract

Every new source needs an explicit declaration:

- maximum award per player per day/week;
- whether it enters spendable balance, scored/lifetime tickles, or both;
- whether it can move competitive standings;
- how it appears in the Tickle Breakdown receipt;
- idempotency and concurrency behavior;
- how a free player reaches the same status ceiling.

No source should launch until the dashboard can break it out and report its
share of leaderboard movement.

### Wallow is the largest current fairness risk

The current permanent curve reduces the base wait by 25 percentage points at
W1 and W2, then five points per rank to a 70% reduction at W6. A 70% shorter
wait is **3.33× base output**, not “70% faster.” It also shortens the shared
three-Barn visit window from eight hours to three.

That permanent advantage carries into future seasons, accelerates scored
tickles and XP, and helps earn the next rank. A new player begins behind in
both progression and competitive capacity.

Before adding meaningful new tickle faucets:

- keep permanent Wallow rank, cosmetics, aura, and history;
- move mechanical power to a gentler season-local rank or cap it near 1.5×;
- separate permanent prestige from seasonal competitive power in server
  fields and UI copy;
- report tickles and Dig-Off outcomes by Wallow cohort.

The Golden Truffle cap deadlock identified in the July audit is now addressed
by the authored overflow migration and its contract test. The broader fairness
curve remains.

### Slop Club and rewarded ads

Current server code explicitly removed paid regen; members and free players
share the same base clock. Preserve that decision. Favor:

- companions, looks, room themes, saved rooms, and photo props;
- premium collection lanes;
- additional authored story/visual choices;
- convenience that does not create a status ceiling free players cannot reach.

The live App Store promise says “No ads,” while opt-in rewarded-refill code is
compiled and dark. Choose one strategy before activation. If ads launch,
update store/privacy claims first, keep them optional and capped, and keep the
result out of competitive score unless the economy analysis proves otherwise.

## Architecture audit

### Foundation strengths

The codebase has several genuinely deep modules and good seam discipline:

- one config-cell lifecycle for server-tuned values;
- a shared rooting physics kernel and pure dig-session reducer;
- season/pass math separated from presentation;
- a centralized popup precedence state machine;
- a reusable realtime subscription lifecycle;
- typed pig-roster, reward-art, race, friendship, and cosmetic rules;
- server-owned economy mutations, refusal envelopes, row locks, and
  idempotency in high-value paths;
- 124 test files and replay fixtures for founder-reported incidents.

The fast quality boundary passed completely. The full boundary produced:

- TypeScript: pass;
- production lint: pass with warnings;
- 124/124 Jest suites and 1,280/1,280 tests: pass;
- simulator-free iOS export: pass;
- security and layout contracts: pass;
- database harness: not run because the local Docker/Colima socket was absent.

The database result is **unverified**, not a failing schema assertion.

### 1. Feature orchestration is too broad

The largest live surfaces are acting as shallow integration points:

| File | Approx. lines | Local dependency fan-out |
|---|---:|---:|
| `components/Account.tsx` | 2,899 | 24 |
| `components/mudwar/TrufflePatch.tsx` | 2,697 | 15 |
| `app/(tabs)/season.tsx` | 2,604 | 47 |
| `components/BarnVisitModal.tsx` | 2,007 | 18 |
| `components/Barn.tsx` | 1,310 | 33 |
| `app/(tabs)/shop.tsx` | 1,111 | 28 |
| `components/Friends.tsx` | 1,097 | 17 |

Line count alone is not the problem. These files know too many ordering rules,
fallbacks, states, and cross-feature refresh contracts. New feature work will
be safer if it creates one deep domain module and a thin screen adapter rather
than adding another hook, modal, and refresh callback to Barn or Season.

Priorities:

1. a launch-inbox coordinator for root boot reads and acknowledgement;
2. a Season home/view-model module that returns one structured render state;
3. a visit-session module owning admission, tap state, optional traces, and
   completion;
4. an Account settings/profile module split from progression and referral
   history;
5. a micro-game engine module before the first mini-game UI.

Tests should cross those same interfaces. Replace internal behavior tests when
the deep interface makes them redundant.

### 2. RPC failure semantics are only partially deepened

`rpcOutcome` and `rpcAction` now distinguish important failure classes and new
write paths such as cosmetic equip fail closed. That fixes part of the July
audit. The historical `rpc<T>() -> T | null` interface still has about 65
callers and can collapse valid absence, dark migration, network failure, and
server failure into one value.

Rule for expansion: all new mutations use `rpcAction` or a domain-specific
gateway over `rpcOutcome`; compatibility fallback is allowed only on a proven
`missing_function`, never on network or authorization failure.

### 3. Migration history is carrying too much current policy

There are 338 migration files and repeated whole-function definitions:

- `tickle_at_barn`: 21 definitions;
- `update_profile_and_item_count`: 16;
- `daily_shop`: 16;
- `submit_rooting`: 15;
- `open_rooting`, `send_blessing`, and `home_stats`: 11 each.

This has already produced carry-latest-definition warnings throughout the
repo. Deepen the server modules: short public RPC facades, stable revoked
internal helpers, and final-schema contract tests. Restore the full local DB
harness before the next broad economy feature and add a fresh-chain ACL/RLS/
signature gate that tests the final schema rather than a curated migration
subset.

### 4. Analytics is a declared interface without enough adapters

The closed event vocabulary and server validation are good. Most event families
are not yet wired, so the dashboard cannot rank new systems honestly.

Before expansion, instrument:

- exposure/open;
- successful server action;
- recipient open/reaction;
- 7-day repeat;
- group breadth;
- tickle award by source.

Prefer server-authored success events from existing ledgers; use client events
for impressions, cancels, and native share-sheet outcomes.

### 5. Platform and dependency debt is now material

The app is on Expo 52 / React Native 0.76. Expo's current documentation lists
SDK 57 / React Native 0.86 and recommends incremental one-SDK-at-a-time
upgrades. This is no longer routine package freshness; it is a multi-release
native migration involving React 19, Router, Reanimated, Skia, Sentry, safe
areas, and New Architecture behavior.

Create a dedicated upgrade train before another native-heavy mode. Go 52 → 53
→ 54 → 55 → 56/57 with a green quality boundary and device smoke test at each
step. Do not combine it with Homegrown Adventures or Lounge rollout.

### 6. Asset and binary growth need an admission policy

The source `assets/` directory is about 950 MB. Build 172 is about 88 MB
compressed and 125 MB uncompressed. Its package includes approximately:

- 337 pig sprite assets totaling 36.4 MB;
- 20 vector-icon fonts totaling 3.9 MB;
- a 6.1 MB packaged JS bundle;
- production-packaged prototype Rive textures;
- Lounge and other currently unreachable assets.

The full export generated a 9.57 MB Hermes bundle. Before adding more pigs,
destinations, or mini-games:

- generate a production asset reachability manifest;
- stop barrel imports that admit every vector font;
- separate prototype/source assets from runtime assets;
- lazy-admit pig animation packs by owned/present pig;
- establish per-feature compressed and decoded-memory budgets;
- compare every release IPA manifest against the previous build.

### 7. Known native UX debt remains

The July native re-audit still identifies unresolved performance and
accessibility work: root launch effects, Inbox/Lounge realtime work, Dynamic
Type modal behavior, VoiceOver labeling/state, sub-44pt targets, Friends
keyboard geometry, and theme-token drift. The current lint run also reports
missing hook dependencies in Season, Barn, burial sheets, and SwipeElement.

These are not reasons to halt all content. They are reasons to reserve a fixed
quality budget in every expansion and to avoid adding new unmanaged modal and
orchestrator patterns.

## Public positioning and compliance blockers

Resolve these before meaningful acquisition spend or rewarded-ad activation:

1. **Store positioning:** the subtitle “A pig sounder & a kind game” is opaque,
   and the description foregrounds an older alignment era rather than the
   current friendship pet, Great Hunger, visits, and collection.
2. **Privacy:** the live page says “Data Not Collected,” while the product has
   accounts, social/gameplay state, diagnostics, purchases, and first-party
   analytics. Audit the App Privacy answers immediately.
3. **Age:** iOS is 4+ while the Google draft says the game is not directed to
   children under 13. Make an explicit audience decision before expanding ads,
   links, analytics, or social features.
4. **Ads:** “No ads” conflicts with the compiled, dark rewarded-ad lane.
5. **Live versus documented product:** older membership and season documents
   still describe mechanics that current migrations removed or changed.

## Recommended 90-day sequence

### Phase 0: make decisions measurable and fair

- Rewrite the App Store promise around the friendship pet.
- Reconcile privacy, age, and ad claims.
- Repair the active-season aggregate.
- Wire the declared analytics funnels.
- Publish the tickle-source economy contract.
- Decide the Wallow fairness change.
- Run five fresh-player Homegrown Adventures sessions.
- Restore the database harness and schedule the Expo upgrade train.

### Phase 1: compound the proven loop

- Ship the Reaction Book MVP behind a server flag.
- Measure discovery, repeat, sharing, and effect on ordinary tickling.
- Unify guestbook/Porch Round/while-away traces into visible friendship
  history.
- Improve the invite so it shows a concrete shared artifact rather than only a
  referral reward.

### Phase 2: give collection a home

- Ship the six-slot Barn interior with a small decor set.
- Let friends visit and react.
- Move Slop Club value toward rooms, companions, looks, and photo props.
- Connect Reaction Book and season rewards to displayable objects.

### Phase 3: add one tributary

- Build one shared-seed micro-game through a deep reusable module.
- Award a small bounded tickle payout and a Sounder-wide participation target.
- Keep it only if next-week repeat and group reactivation clear the gate.

### Phase 4: deepen the world

- Ship the smallest playtest-proven Homegrown Adventures chapter.
- Add a widget, Pig Cards, or Game Center only after the core product page and
  group-activation funnel are clear.

## Final call

Tickle the Pig has enough systems. What it needs now is a sharper center and
features that compound one another.

The correct expansion question is not:

> What other genre can fit in this app?

It is:

> **What is another small, pig-native way for me and my friends to create,
> earn, spend, or remember tickles?**

Build Reaction Book first. Deepen visits second. Give collections a Barn
interior. Add one measured rotating micro-game. Then let a validated Homegrown
Adventures loop turn all of that care into a wider authored world.
