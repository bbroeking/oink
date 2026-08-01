# Player interaction readout + opportunity ladder

**Snapshot:** 2026-07-26 23:47 UTC  
**Source:** production `analytics_overview()` aggregate RPC, current migrations,
and the interaction/design docs in this repo. No individual player identities
were used in this analysis.

## Executive read

The clearest supported preference is **quick, asynchronous kindness centered on
another player's pig**.

- Barn tickles account for **6,815 of 8,735 measured social actions in the last
  14 days (78%)**.
- Blessings are the most durable secondary action: **533 in 14 days**, almost
  unchanged week over week, and **1.96 blessings per curse** all-time.
- The older dig-a-friend's-truffle loop is the second-largest measured action
  family (**777 digs in 14 days**), suggesting that social interaction becomes
  stronger when it also contains a small reveal or collectible.
- Tickle trades fell from **264 to 49 week over week (-81%)**. This is a reason
  to pause expansion and investigate, not enough evidence by itself to delete
  the system.

The reusable engagement kernel is:

> **See another pig → make one small positive gesture → leave a visible trace →
> let the other player discover it later.**

Build new interactions by remixing that kernel, not by adding unrelated
currencies or another obligation timer.

## What the current data says

### Current herd

| Signal | Value | Read |
|---|---:|---|
| Total non-test profiles | 65 | Small enough that a few power users can move totals |
| Active 1d / 7d / 30d | 21 / 34 / 50 | 68% of 30d active players appeared in 7d; 62% of 7d active appeared today |
| Friendships | 313 | Dense base for async social loops |
| Push enabled | 23 (35%) | Most discovery still needs to work in-app |
| Happiness | 15 happy / 11 neutral / 39 sad | Care loop is not keeping most pigs visibly happy |
| Tickles earned / wasted | 43,066 / 12,247 | 22% of potential tickles shown by this counter were wasted at cap |

### Measured actions, last 14 days

| Action | Count | Share of measured action set |
|---|---:|---:|
| Barn tickles | 6,815 | 78.0% |
| Friend-truffle digs | 777 | 8.9% |
| Blessings | 533 | 6.1% |
| Tickle trades | 313 | 3.6% |
| Curses | 297 | 3.4% |

`barn_visits` currently records one row per successful barn tickle, so these are
interaction taps, not distinct visit sessions. The shares are useful for
relative volume but do not tell us how many unique players used each feature.

### Week-over-week durability

Previous seven days are Jul 13–19; latest seven are Jul 20–26. Jul 26 was nearly
complete in UTC but remains a partial local day.

| Action | Previous 7d | Latest 7d | Change |
|---|---:|---:|---:|
| Barn tickles | 3,782 | 3,033 | -20% |
| Blessings | 268 | 265 | -1% |
| Curses | 139 | 158 | +14% |
| Tickle trades | 264 | 49 | -81% |
| Friend-truffle digs | 458 | 319 | -30% |
| Truffles buried | 70 | 39 | -44% |
| Signups | 11 | 2 | -82% |

The broad decline is partly consistent with fewer new players. Blessings'
flatness is therefore more interesting than the raw ranking: the kindness
ritual held while acquisition and most other actions fell.

## What this data cannot support yet

The analytics RPC predates much of the current game. It does **not** measure
exposure, unique users, repeat-user rates, or the current interaction funnels
for:

- Feeding/rooting sessions and race contributions
- Sounder surfaces and co-op participation
- Lounge entry, movement, seats, or emotes
- Shop previews, purchases, equipping, Closet use, or pig selection
- Season/bounty views and claims
- Field Guide discoveries
- Share-card creation and completed shares
- Onboarding step completion

That means “barn visits are 78%” really means **78% of the older action set the
dashboard happens to count**, not 78% of the whole game. Raw counts also are not
normalized by how often an action is offered. The current `season.players`
aggregate is 84 while there are 65 non-test profiles, so its filtering/join
semantics also need repair before using it for product decisions.

Use the findings above as a direction, not a verdict on unmeasured systems.

## Opportunity ladder

### 0. Measurement foundation — do before judging newer systems

Add a privacy-light, first-party event seam and a dashboard v2. Prefer
server-authoritative success events from existing tables/RPCs; use client
events only for impressions, starts, cancels, and shares that leave the app.

Minimum common fields:

- pseudonymous `user_id`, `session_id`, `event_name`, `surface`, `occurred_at`
- optional `target_kind`, `result`, `content_id`, `experiment`, and small
  allow-listed properties
- never free-form text, usernames, or message contents

Minimum funnels:

| Family | Exposure/start | Success |
|---|---|---|
| Barn | `barn_opened` | `barn_tickle_succeeded`, `visit_stamp_left` |
| Ritual | `ritual_picker_opened` | `blessing_cast`, `curse_cast` |
| Feeding | `rooting_opened` | `rooting_submitted`, `find_revealed` |
| Lounge | `lounge_entered` | `emote_sent`, `seat_claimed` |
| Shop/Closet | `item_previewed` | `item_bought`, `item_equipped` |
| Season | `season_opened` | `bounty_claimed`, `tier_claimed` |
| Sharing | `share_created` | `share_sheet_completed` |

For every feature, report **unique exposed users, conversion, actions per
actor, 7-day repeat rate, recipient breadth, and 7/14-day return correlation**.
Raw action count remains a supporting metric, never the ranking metric.

No database migration or production push is authorized by this document.

### 1. Barn guestbook stamps — smallest high-confidence bet

After a successful barn tickle, offer one optional one-tap hoofprint/stamp.
The host's Barn keeps a warm, non-expiring guestbook page. A stamp is expression
and identity, not currency.

Why it fits:

- Extends the dominant measured behavior without adding another destination.
- Makes the gesture leave a visible trace for the recipient.
- Works asynchronously and for the 65% of players without push.
- Obeys the Covenant: the book only accumulates; nobody is shown as absent.

Ship as a small A/B test on the post-tickle state. Success gate: at least 30% of
eligible visitors stamp, no reduction in completed barn tickles, and higher
7-day repeat visiting among stampers.

### 2. Porch Round — organize the existing three-Barn window

Turn the existing “three distinct fresh Barns per window” allowance into an
optional scrapbook route. Each completed stop adds that pig's portrait/stamp to
a finished three-panel page. Completing fewer stops never produces an empty,
expired, or sad artifact; every page is simply a record of visits that happened.

This is a new wrapper around an already-understood behavior, not a new economy.
It gives players a legible reason to visit more than one friend and lets the
game showcase outfits, moods, and pig identities.

Success gate: lift in distinct barns visited per active visitor and host return
rate, with no concentration increase toward only the most popular pigs.

### 3. Kindness card — connect visits and blessings

On some completed visits, offer the currently available blessing as an optional
second gesture: “Leave a little warmth?” The recipient discovers one combined
card later: who visited, the stamp they chose, and the blessing left.

This combines the highest-volume measured loop with the most durable secondary
loop. Keep it optional and respect existing ritual cooldowns; do not turn every
visit into a multi-step checklist.

Success gate: blessing breadth and unique casters increase, while median visit
completion time and barn-tickle conversion stay flat.

### 4. Dig postcards + cheers — validate after Feeding instrumentation

The existing Shared Dig text-grid/share direction is the right first bet for
current Feeding. Add a friend-facing in-app version: a completed dig can become
a small postcard in the Barn/Inbox, and another pig can leave one non-economic
cheer or stamp.

This remixes the same kernel around a reveal/collectible, which the older
friend-truffle counts weakly support. Do not expand this until current rooting
has unique-user and repeat-rate instrumentation; the existing dashboard does
not measure it.

Success gate: share/postcard creation, recipient opens, cheers per recipient,
and next-window rooting return.

### 5. Oinkograms — later synthesis, not the next build

If stamps, kindness cards, and dig postcards all show recipient-open and return
lift, synthesize them into the already-designed Oinkogram: a short comic made
from events that actually occurred. That should be a celebratory export of
social history, never a report about who failed to appear.

## Recommended sequence

1. Repair/extend measurement and baseline the current systems for 14 days.
2. Test Barn guestbook stamps.
3. If stamps lift repeat visiting, add Porch Round.
4. If blessings gain breadth without harming visit completion, add Kindness
   cards.
5. Validate current Feeding, then promote Dig postcards.
6. Promote Oinkograms only if the smaller visible-trace experiments work.

## Decisions to avoid making from this snapshot

- Do not conclude Lounge, Shop, Closet, Feeding, or Field Guide are weak; they
  are absent from the data.
- Do not delete tickle trades solely from the -81% week; first check exposure,
  availability, and whether a release changed their entry point.
- Do not use happiness or wasted tickles as proof of enjoyment. They describe
  system state/friction, not preference.
- Do not optimize for total taps. Optimize for voluntary repeat use, breadth
  across players, recipient delight, and return.
