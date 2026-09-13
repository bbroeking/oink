# Tickle the Pig: market niche and expansion audit

**Date:** 2026-08-12  
**Scope:** the shipped product, the current public App Store presence, the most
relevant in-repo prototypes/specifications, and first-party materials for
adjacent products and Apple platform opportunities.

## Executive verdict

Tickle the Pig's most defensible niche is not "idle game," "clicker," "virtual
pet," or "mini-game collection" on its own. It is the intersection of three
things:

> **Tactile pig comedy × a friendship ritual for a real group chat × cozy
> collection.**

The durable social proposition is:

> **A tiny friendship ritual for a real group chat, embodied by one funny,
> authored pig.**

A plainer acquisition line is **"Raise a ridiculous pig with your friends."**
The warmer brand line is **"Your group chat has a pig now."**

That niche sits between couple-oriented shared-pet apps, solo cozy collectors,
and broad multiplayer game hubs:

- [Widgetable](https://apps.apple.com/us/app/widgetable-besties-couples/id1641107226)
  lets two people co-parent pets and share widgets; [Friends/Pengu](https://play.google.com/store/apps/details?id=com.slay.pengu&hl=en)
  centers evolving AI companions raised alone or with someone else.
- [Cozy Couples](https://apps.apple.com/us/app/cozy-couples-relationship-app/id6463766369)
  combines a private two-person home, pet care, questions, mood sharing,
  streaks, and decoration; [SumOne](https://apps.apple.com/us/app/sumone-for-relationships/id1469506430)
  uses one daily question and a shared character for couples.
- [Neko Atsume](https://apps.apple.com/us/app/neko-atsume-kitty-collector/id923917775)
  owns an exceptionally simple solo return-and-discover loop; [Cats & Soup](https://apps.apple.com/us/app/cats-soup-relaxing-cozy-games/id1581431235)
  owns relaxing idle animal production, collection, care, dress-up, and
  decoration.
- [Plato](https://apps.apple.com/us/app/plato-fun-multiplayer-games/id1054747306)
  competes on breadth with more than 50 games plus chat. Tickle the Pig should
  not try to out-Plato Plato.

Tickle the Pig's opening is the combination those products do not foreground:
**one memorable character, small-group friendship, kindness plus harmless
mischief, visible social history, authored seasonal lore, and no public feed.**
The target can be women-forward without being gender-exclusive: the ESA's 2026
U.S. survey reports that 46% of players are female and that games serve a wide
age range, so the useful niche is psychographic—cute self-expression,
friendship, collecting, humor, and low-pressure play—not "games for women" as
a closed category. [ESA 2026 Essential Facts](https://www.theesa.com/resources/essential-facts-about-the-us-video-game-industry/2026-data/)

The immediate hook is simpler—**touch this pig and get a funny, satisfying
reaction**—while friendship and collection explain why someone returns. SUSH
already combines shared virtual-pet raising, mini-games, a widget,
subscriptions, and consumables, while My Talking Tom 2 combines pet care,
physical reactions, customization, travel, mini-games, and events.
[SUSH App Store listing](https://apps.apple.com/us/app/sush-virtual-pet-grow-evolve/id1622502023),
[My Talking Tom 2 Google Play listing](https://play.google.com/store/apps/details?id=com.outfit7.mytalkingtom2)
Tickle the Pig therefore cannot differentiate as merely "a pet you touch with
some games." Its specific pig, comic animation, authored voice, and known-friend
consequences must be unmistakable.

The recommended product strategy is to make **tickles the universal output**:
every new activity should either earn tickles, improve the way tickles are
earned, make tickles socially meaningful, or create something worth spending
tickle-earned snouts on. New modes should be tributaries into one economy, not
separate games with separate currencies.

## What the product actually is today

### Shipped spine

The current app shell has five destinations: Barn, Friends, Season, Shop, and
Me ([tab layout](<../../app/(tabs)/_layout.tsx>)). The shipped or production-shaped
systems form a coherent three-layer product:

1. **Emotional/core loop:** tickle Rosie, manage the regenerating tickle bank,
   observe her mood, and convert interaction into snouts and visible reactions
   ([Barn](../../components/Barn.tsx), [domain context](../../CONTEXT.md)).
2. **Friendship loop:** visit and tickle friends' pigs, leave guestbook traces,
   trade, bless or curse, use an inbox, form a Sounder, and preserve visits in a
   Porch Round scrapbook ([Friends hub](<../../app/(tabs)/friends.tsx>),
   [Porch Round](../../app/porch-round.tsx)).
3. **Progression/collection loop:** cosmetics, titles, achievements, a seasonal
   pass, Wallow prestige, Sounder co-op Feeding, Golden Truffles, the Burrow
   Book/Field Guide, weekly races, and Slop Club membership
   ([Season](<../../app/(tabs)/season.tsx>), [Shop](<../../app/(tabs)/shop.tsx>),
   [collection](../../app/dig-collection.tsx)).

This is already much larger than the public description implies. The strongest
conceptual through-line is not simply "earn currency." It is:

> **Touch the pig → create a reaction → earn a little progress → let friends
> see or affect what happened.**

The repo's only available interaction snapshot reinforces that direction,
while remaining too small and incomplete for a final verdict. As of 2026-07-26,
successful Barn tickles dominated the older measured action set, blessings were
the most durable secondary action, and the report identified the reusable
kernel as "see another pig → make one small positive gesture → leave a visible
trace → let the other player discover it later." It also explicitly warns that
Feeding, Lounge, Shop, Closet, Season, Field Guide, and sharing were not fully
instrumented ([interaction opportunity audit](../design/player-interaction-opportunities-2026-07.md)).

### Important evidence boundary: prototypes are not the market promise yet

The repo contains several appealing expansion directions, but they should not
be treated as shipped breadth:

- Rosie's Ramble/Expedition redirects to Home outside development builds
  ([route](../../app/expedition.tsx)).
- The Lounge currently redirects to Shop in its exported production route
  ([route](../../app/lounge.tsx)).
- Homegrown Adventures has a substantial prototype and build plan, but the
  latest build record still lists rollout as deferred
  ([build 174](../builds/2026-08-09-build-174.md),
  [build goals](../homegrown-adventures-build-goals.md)).
- Rewarded-ad plumbing is compiled but dark and its database/deployment work is
  deferred ([build 174](../builds/2026-08-09-build-174.md)).

That distinction matters. The market position should be based on the lovable,
repeatable product people can use now; prototypes are candidate extensions,
not reasons to describe Tickle the Pig as an RPG, MMO, farm sim, or arcade.

## Where the niche is strongest

### 1. A friendship pet, not a generic virtual pet

Widgetable's official listing emphasizes co-parenting a pet with a best friend
or loved one, shared screens, mood/status sharing, and subscription access.
[Friends/Pengu](https://play.google.com/store/apps/details?id=com.slay.pengu&hl=en)
emphasizes AI personalization, routines, widgets, and a two-person shared
companion. Tickle the Pig should not copy their generic-pet or AI-memory axis.
Rosie is authored, specific, visually recognizable, and capable of carrying a
world's tone. That is a stronger mascot/IP foundation than "choose any pet and
feed it."

The promise is also broader than romance. Couples, best friends, siblings,
roommates, families, small Discords, and existing group chats can all
understand "we have a pig together." This keeps the intimacy of couple apps
without making a romantic relationship a prerequisite.

### 2. Social without social media

The product does not need a public feed, algorithm, or user-generated content
firehose to feel social. Its best interactions are small, directed, and
asynchronous: a tickle, blessing, curse, outfit, guestbook mark, dig
contribution, or discovery that another known person encounters later.

That is a real differentiation from a chat-led game hub. Plato's official
listing makes breadth, chat, voice, public competition, and dozens of games the
product. [Plato App Store listing](https://apps.apple.com/us/app/plato-fun-multiplayer-games/id1054747306)
Tickle the Pig can instead be the **one-minute social toy that creates something
to talk about back in the group's existing chat**.

### 3. Cozy collection with a recipient

Neko Atsume proves the clarity of "prepare, leave, return, discover, catalog,"
including a visitor book and photo album. [Neko Atsume App Store listing](https://apps.apple.com/us/app/neko-atsume-kitty-collector/id923917775)
Animal Crossing: Pocket Camp Complete packages decoration, animal friendships,
seasonal events, a huge item catalog, player cards, and asynchronous visits in
a one-time-purchase product. [Pocket Camp Complete App Store listing](https://apps.apple.com/us/app/animal-crossing-pocket-camp-c/id6547834967)

Tickle the Pig can make this category more social: a find is not only something
I collect; it can change my Barn, be seen by my Sounder, become a postcard, or
prompt a friend to visit. That gives collecting an audience without requiring
open posting.

### 4. A humane alternative to noisy idle monetization

Cats & Soup openly combines idle production, care, cosmetics, mini-games,
events, ads, and in-app purchases. [Cats & Soup App Store listing](https://apps.apple.com/us/app/cats-soup-relaxing-cozy-games/id1581431235)
Widgetable combines subscriptions, premium currency, consumables, and
advertising-supported pet needs. [Widgetable App Store listing](https://apps.apple.com/us/app/widgetable-besties-couples/id1641107226)
Pocket Camp Complete demonstrates a contrasting premium route: a $19.99
one-time purchase with seven years of collected content and no additional
in-game purchases. [Pocket Camp Complete App Store listing](https://apps.apple.com/us/app/animal-crossing-pocket-camp-c/id6547834967)

The takeaway is not that one model is universally best. It is that Tickle the
Pig's quietness and trust are commercially meaningful positioning choices. A
small game cannot win an offer-volume arms race against mature idle products;
it can win by being legible, fair, and unusually personal.

## The public-positioning problem

The live App Store page currently undersells and partially misclassifies the
game:

- The subtitle is **"A pig sounder & a kind game,"** which asks a new prospect
  to understand "sounder" before understanding the product.
- The main description still foregrounds the Greedy/Generous alignment season,
  while the version history describes the newer Great Hunger, Sounders,
  Feeding, and Burrow Book.
- The page says **"Data Not Collected,"** even though an account-backed social
  game necessarily handles account and gameplay data and the repo's store draft
  lists identifiers, purchase history, and diagnostics. This needs an immediate
  App Store Connect/privacy audit, not a marketing workaround.
- The live iOS page is rated 4+, while the Google Play draft says the product is
  not directed to children under 13. That is not merely copy: a deliberate
  audience decision affects social design, analytics, advertising, and store
  compliance.
- Apple's current "You Might Also Like" set is mostly unrelated, a weak signal
  that the storefront does not yet understand the comparison category.

These observations come directly from the current [Tickle the Pig App Store
page](https://apps.apple.com/us/app/tickle-the-pig/id6740339848) and the repo's
[App Store draft](../APP_STORE_LISTING.md) and
[Google Play draft](../google-play/store-listing.md). If children become a
target audience, review Apple's child-safety/Kids Category requirements and
Google Play Families rules before expanding ads, links, analytics, or social
features. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
[Google Play Families policy](https://support.google.com/googleplay/android-developer/answer/9867159)

Before adding a major mode, update the subtitle, description, screenshots, and
privacy disclosures so the existing product can be evaluated honestly. Apple's
Product Page Optimization can compare the control with up to three alternate
sets of icons/screenshots/previews, while Custom Product Pages can carry
different acquisition promises. [Apple Product Page Optimization](https://developer.apple.com/app-store/product-page-optimization/),
[Apple Custom Product Pages](https://developer.apple.com/help/app-store-connect/create-custom-product-pages/configure-multiple-product-page-versions/)

Recommended page narratives:

1. **Friendship pet:** "Your group chat has a pig now"—visits, blessings,
   harmless curses, guestbook, Sounder.
2. **Cozy character:** Rosie reactions, mood, closet, Barn, discoveries.
3. **Play together:** Feeding, Sounder contribution, world boss, weekly result.

At the current volume, these are hypotheses, not statistically proven winners.
Avoid splitting already-thin traffic across too many treatments.

## Expansion rule: all roads lead to tickles

The user instinct—every activity should ultimately earn more tickles—is
directionally right, with one refinement. Tickles currently act as both the
emotional verb and a regenerating/scored resource. Unlimited faucets would make
the bank, Wallow, membership boosts, and lifetime rankings meaningless. New
activities should therefore use one of four controlled relationships:

1. **Earn:** grant a small bounded number of tickles.
2. **Redirect:** choose where the next regenerated tickles have extra effect.
3. **Amplify socially:** a friend's act makes a limited portion more valuable.
4. **Remember:** convert tickling into lasting collection, decoration, story,
   or social history rather than more raw currency.

This creates variety without multiplying currencies or collapsing the core
economy. A player should always be able to answer: **"I did this because it
helps my pig, my friends, or my next tickle."**

## Ranked expansion spaces

### 1. Deepen tickling itself: techniques, reactions, and mastery

**Recommendation: smallest and most direct product bet.**

Before adding another destination, make the namesake verb capable of surprise
and mastery. Build a small **Reaction Book** or **Pigglepedia** around Rosie's
authored physical comedy:

- rare reactions triggered by understandable conditions—mood, outfit, time of
  day, friend hoofprint, or a short tap/rub/rhythm pattern,
- a daily "Rosie feels like…" hint that suggests a technique without making
  failure punitive,
- short tickle chains that end in a distinct animation rather than only a
  larger number,
- a catalog of discovered reactions, favorite snapshots, and friend-triggered
  moments,
- bounded bonus tickles for first discovery and occasional mastery, not an
  infinitely farmable multiplier.

My Talking Tom 2 is the scale warning and the useful pattern: its official
listing ties the central character to care, skills, travel, customization,
mini-games, and puzzles. [My Talking Tom 2 App Store listing](https://apps.apple.com/us/app/my-talking-tom-2/id1337578317)
Tickle the Pig should borrow the idea that the pet remains the stage while
using a far smaller, more authored set of interactions.

For long-term progression, [Egg, Inc.](https://apps.apple.com/us/app/egg-inc/id993492744)
is a useful structural reference: it deepens one simple tactile production
verb through missions, research, co-op, and prestige. The transfer is not
"build an egg tycoon." It is **let tickling open new decisions and visible
transformations while the core verb remains legible.** Wallow already supplies
prestige; the missing layer is more tactile/collectible meaning between
Wallows.

### 2. Deepen the Barn visit into a visible friendship history

**Recommendation: build next.**

Finish and elevate the guestbook/Porch Round direction: stamps, tiny prepared
gifts, friend photos, visit milestones, and a calm "while you were away" recap.
The important reward is not another counter; it is proof that another real
person came by. A small bounded tickle bonus can reward completing a naturally
formed three-Barn round, but the page should remain valuable even when
unfinished.

Why this wins:

- It extends an already-used interaction instead of inventing a new
  destination.
- It makes outfits, moods, pig identities, Barn decoration, and membership
  cosmetics socially visible.
- It works asynchronously and does not depend on a large concurrent audience.
- It strengthens the niche competitors cannot easily copy: **my actual friends
  did things to this specific pig.**

The in-repo [player-interaction opportunity ladder](../design/player-interaction-opportunities-2026-07.md)
already reaches the same conclusion from the available product data.

### 3. Homegrown Adventures: farm, prepare, send Rosie, return to discovery

**Recommendation: highest-upside medium-term expansion, after a focused
playtest.**

The Homegrown Adventures concept is the best large expansion in the repo
because it grows outward from Rosie and Home: tend a tiny crop, choose a tool or
provision, send Rosie beyond the hedge, and return to a named discovery that
changes the Barn. It borrows the strongest return-loop qualities of Neko Atsume
without copying cats, and the emotional self-development structure of Finch
without turning Tickle the Pig into a wellness app. Finch uses short self-care
actions to power a pet's daily exploration and return story. [Finch App Store
listing](https://apps.apple.com/us/app/finch-self-care-pet/id1528595748)

For Tickle the Pig, the economic bridge should remain simple:

- Tickling supplies a bounded **send-off charge** or chooses Rosie's intention.
- Crops/provisions alter what kind of encounter is possible, not a DPS number.
- Returns grant a few tickles plus a named Find, story beat, seed, tool mark, or
  Barn change.
- Duplicate finds should advance something visible, not become vendor trash.

Do not ship the current large concept by faith. The repository's playtest
result sheet still says the fresh-player sessions have not happened
([playtest results](../explorations/beyond-the-hedge-playtest-results.md)). Run
those tests before committing production scope.

### 4. One rotating pig-native micro-game lane

**Recommendation: yes to a lane, no to an arcade.**

Add one prominent rotating activity at a time, each playable in roughly 20–90
seconds and each paying bounded tickles or advancing a Sounder goal. Strong
formats for the current stack are asynchronous and server-verifiable:

- a shared daily seed (dig, memory, rhythm phrase, mud putt, truffle plinko),
- a turn-based friend challenge on the same seed,
- a Sounder-wide cooperative target using individual runs,
- a daily riddle or prediction where the server owns the answer.

Widgetable's official version history shows that shared-pet competitors are
already adding mini-games and leaderboards. [Widgetable App Store listing](https://apps.apple.com/us/app/widgetable-besties-couples/id1641107226)
That validates the adjacency, not the need to chase breadth. Plato's 50-game
catalog shows the endpoint Tickle the Pig should avoid.

Design constraints:

- Every game uses Rosie, the Barn, the bog, truffles, or Sounder fiction.
- One input verb, one legible score, one tickle-facing payout.
- Reuse a seed/scoring shell so new games are content, not new infrastructure.
- Prefer friend and Sounder comparison over global Elo.
- Never require another permanent currency, equipment rarity ladder, or gacha
  roster.

### 5. A visitable, decoratable Barn interior

**Recommendation: build as the durable collection sink.**

Decoration is not merely another shop category; it gives earned objects a
place and gives visits a reason. Pocket Love's first-party listing makes home
design, fashion, pets, and small character moments its entire promise.
[Pocket Love App Store listing](https://apps.apple.com/us/app/pocket-love/id1575412509)
Cozy Couples ties shared actions to stars used for decorating a private home.
[Cozy Couples App Store listing](https://apps.apple.com/us/app/cozy-couples-relationship-app/id6463766369)

The repo's six-slot Habitat design is appropriately scoped for a solo developer
and safer than free placement ([Habitat spec](../habitat.md)). Connect it to the
tickle economy without making every object a stat stick:

- snouts buy ordinary decor,
- discoveries unlock unusual decor recipes,
- seasonal/social achievements grant trophy objects,
- friends can leave a non-economic reaction to a room,
- Slop Club expands expression (extra themes, saved rooms, photo props) rather
  than multiplying leaderboard tickles.

### 6. A Rosie widget and glanceable return surface

**Recommendation: prototype after the core listing and visit loop are clear.**

Both Widgetable and Friends/Pengu make home-screen presence a central benefit.
Apple's current frameworks support glanceable widgets plus interactive buttons
or toggles through App Intents. [Apple widgets and App Intents](https://developer.apple.com/documentation/appintents/widgets-and-live-activities)

The Tickle the Pig version should be narrow:

- show Rosie's current mood/pose and whether tickles are ready,
- show one recent friend hoofprint or the next Feeding state,
- deep-link directly to the Barn or friend visit,
- consider one bounded interactive tickle only if server authority and widget
  refresh behavior stay honest.

Do not turn the widget into another notification channel or a care alarm. Its
job is presence and affection.

### 7. Pig cards, postcards, and physical-to-digital collection

**Recommendation: low-risk growth/identity extension.**

The existing QR redemption and Rosie's Loadout work can become collectible Pig
Cards: outfit, title, Wallow ring, one favorite discovery, and a claimable
cosmetic or social encounter. Pocket Camp Complete's Camper Cards let players
create, scan, trade, and collect player introductions without requiring a live
social network. [Pocket Camp Complete App Store listing](https://apps.apple.com/us/app/animal-crossing-pocket-camp-c/id6547834967)

Use this for creator collaborations, café/bookstore/stationery placements,
release events, and group-chat sharing. Keep codes permissioned and measurable;
do not depend on uncontrolled sticker placement.

### 8. Seasonal communal moments using existing verbs

**Recommendation: continue, but reduce bespoke live-ops burden.**

The Great Hunger is strategically correct: it gives individual taps/digs a
shared consequence. Future seasons should reuse a small library of proven
verbs—tickle, visit, prepare, dig, choose, decorate—under new art, story,
collections, and thresholds. Do not build three unrelated mini-games and a new
economy every season.

Apple In-App Events are built for limited-time competitions, challenges, and
content launches, can reach new/current/lapsed players, and expose event-level
discovery and acquisition analytics. Apple explicitly says repetitive daily
tasks are not appropriate events. [Apple In-App Events](https://developer.apple.com/app-store/in-app-events/),
[In-App Event analytics](https://developer.apple.com/help/app-store-connect-analytics/acquisition/in-app-events/)
Use them for a season opening, world-boss finale, collection launch, or annual
festival—not every Feeding window.

## Expansions to defer or reject

### Full idle battler / combat RPG

The Expedition/idle-battler prototype contains good return ritual ideas, but a
combat-forward product would pull Tickle the Pig toward formations, DPS,
equipment tiers, enemy content, and multi-currency progression. Those systems
make "earn more tickles" less central and put a heavy balance/content burden on
one developer. Keep idle return, preparation choices, training, and postcards;
drop combat as the headline.

### Real-time lounge as a core retention bet

The Lounge is charming, but synchronous presence is a weak foundation for a
small audience: empty rooms feel emptier than asynchronous Barns, and chat adds
moderation and safety obligations. Treat a lounge as an occasional Slop Club
delight or scheduled event after asynchronous interactions are strong, not as
the next core loop.

### A broad mini-game hub

More games do not automatically create more value. They divide matchmaking,
instrumentation, art, QA, and economy tuning. Build one reusable micro-game
lane, observe repeat behavior, then rotate or replace activities. The product
should feel like one pig world, not a menu of reskins.

### More permanent currencies and reward tracks

The product already contains tickles, snouts, Golden Truffles, season XP,
Wallow, collections, cosmetics, membership, rituals, and Feeding schedules.
Every new currency adds an explanation cost and weakens the user's proposed
clarity. New modes should pay tickles, snouts, collection progress, or a
specific lasting object.

### Punitive care and appointment overload

Friendship/care apps can easily turn affection into chores. Tickle the Pig
already has happiness decay, devotion/streak ideas, limited visit windows, four
Feeding windows, bounties, shop rotation, and season clocks. Expansion should
add anticipation, not another way to fail Rosie. Prefer wide windows,
non-expiring return rewards, streak forgiveness, and completed-history
artifacts that never shame absence.

## Monetization and trust

### Move Slop Club value toward expression, not core power

Older membership documents and some product copy still describe faster tickle
regeneration, but the current server migration explicitly removed that paid
advantage: members and free players use the same base regen clock, while the
larger tickle-bank cap remains ([paid-regen removal](../../supabase/migrations/20260679000000_remove_vip_regen_paytowin.sql),
[IAP adapter](../../utils/iap.ts), [current Season](<../../app/(tabs)/season.tsx>)).
That is the right fairness direction. Because lifetime tickles and tickle
earning remain central status measures, future membership benefits should not
reintroduce paid acceleration; even cap and convenience benefits should be
checked against actual leaderboard movement and play cadence.

The healthier recurring-value bundle is:

- more Barn expression and saved looks/rooms,
- member cosmetics and animated treatments,
- the companion pig choice,
- extra photo/postcard props,
- a premium seasonal collection track,
- additional adventure stories or cosmetic preparation choices,
- quality-of-life that does not reduce the free player's dignity.

Keep basic visiting, one useful outfit workflow, core season participation,
social history, and tickle earning fair for everyone.

### Decide whether "no ads" remains a promise

The live App Store description explicitly says "No ads," while build 174
contains dark rewarded-ad refill scaffolding. [Tickle the Pig App Store page](https://apps.apple.com/us/app/tickle-the-pig/id6740339848),
[build 174](../builds/2026-08-09-build-174.md)

Both choices are viable, but ambiguity is not:

- **Trust-first choice:** keep ads dark; use membership, bounded passes,
  cosmetic/room packs, and occasional physical collectibles.
- **Rewarded-ad choice:** launch only opt-in refills, never interrupt play,
  update the store/privacy disclosures before activation, cap the competitive
  advantage, and stop using "no ads" as positioning.

Do not combine paid regen, paid cap, paid pass, rewarded refills, consumable
currency, and frequent offers merely because different competitors use each of
them. A small legible shop is part of the niche.

## Platform opportunity: Apple Games and Game Center

Apple says the preinstalled Games app on iOS/iPadOS/macOS 26 surfaces games
through friends, achievements, leaderboards, challenges, multiplayer
activities, and In-App Events. Game Center-enabled titles can receive social
recommendations, friend-score notifications, and additional discovery
placements. [Apple Games app](https://developer.apple.com/games-app/index.html),
[Game Center](https://developer.apple.com/game-center/)

Tickle the Pig already has achievements, lifetime scores, Sounder competition,
and short scoreable activities, so a lightweight integration is more credible
than another acquisition-only feature. Start with initialization plus one
leaderboard/achievement set; evaluate discovery before attempting Game Center
multiplayer. Preserve the Supabase friend graph as the richer in-game social
identity.

## Recommended sequence

### Now: clarify and measure

1. Rewrite the live store page around the friendship-pet wedge; reconcile
   privacy and "no ads" claims with the actual product.
2. Instrument exposure → action → recipient-open → repeat for Barn, visits,
   blessings, Feeding, Shop/Closet, Season, and sharing.
3. Define the economy contract for new tickle faucets: payout bounds, caps,
   source labels, and leaderboard treatment.
4. Complete five fresh-player Homegrown Adventures tests before production
   scope.

### Next: compound the proven loop

1. Pilot the Reaction Book with a small set of discoverable tickle animations
   and bounded first-discovery rewards.
2. Finish the visible friendship-history loop: guestbook, Porch Round, calm
   while-away recap.
3. Add a visitable six-slot Barn interior so social actions and collection have
   a shared stage.
4. Pilot one rotating shared-seed micro-game that grants bounded tickles and
   contributes to a Sounder target.
5. Package one real season moment as an App Store In-App Event.

### Then: deepen the world

1. Ship the smallest validated Homegrown Adventures loop.
2. Prototype a Rosie widget.
3. Expand Pig Cards/postcards and creator/physical distribution.
4. Add Game Center initialization plus a narrow achievement/leaderboard set.

### Only after evidence

- More than one concurrent mini-game.
- A synchronous Lounge rollout.
- Combat/idle-battler progression.
- Additional currencies, passes, or paid acceleration.

## Scorecard

The primary growth unit should be an **activated friendship group**, not an
install or raw tap count:

- New player connects to one known person within 72 hours.
- New player joins/forms a Sounder within seven days.
- First successful friend visit, blessing, or shared activity.
- Recipient opens a guestbook trace/postcard and returns.
- Distinct tickle-earning sources used per active player.
- D1/D7/D30 retention by solo, connected-pair, and connected-group cohort.
- Weekly active groups and percentage with actions from two or more members.
- Tickles earned by source, including paid/rewarded sources, and their share of
  leaderboard movement.
- Cosmetic ownership → equip → friend-view conversion.
- Feature repeat rate after novelty week, not just launch-day starts.

## Bottom line

Do not expand Tickle the Pig by asking, "What other mobile genre can we bolt
on?" Expand it by asking:

> **What is another small, pig-native way for me and my friends to create,
> earn, spend, or remember tickles?**

The smallest high-confidence answer is to deepen the tickling verb with
discoverable authored reactions. The strongest social answer is deeper Barn
visiting and visible friendship history. The highest-upside larger answer is a
validated Homegrown Adventures loop. Mini-games are useful as short rotating
tickle tributaries. Decoration is the durable sink. Widgets, Pig Cards, Game
Center, and In-App Events can amplify the same promise. Combat RPG depth,
real-time hangouts, currency proliferation, and monetization clutter would pull
the game away from the niche it can credibly own.
