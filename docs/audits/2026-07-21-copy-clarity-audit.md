# App copy clarity audit

Date: 2026-07-21

Scope: player-facing copy in `app/`, `components/`, `hooks/`, `constants/`, and
`utils/`. This is a language and state-honesty audit of the React Native app;
marketing pages and release-note history are out of scope.

## Outcome

The app has a strong, recognizable storybook voice, but important mechanics are
sometimes expressed only as metaphor. The largest problem is terminology drift:
`heart`, `tickle`, `joy`, and `find` can refer to overlapping or entirely
different numbers. A second pattern is fail-soft data handling that presents a
network/read failure as real zero progress.

| Dimension | Score | Finding |
|---|---:|---|
| Terminology consistency | 1/4 | Core counters change names across onboarding, the dig, and the season meter. |
| Action clarity | 2/4 | Most primary actions are clear; Sounder and achievement actions sometimes hide their actual effect. |
| State honesty | 1/4 | Some failed reads render as empty, undiscovered, or sold-out states. |
| Voice without ambiguity | 2/4 | The voice is distinctive, but flavor occasionally replaces required instructions. |
| **Copy health** | **6/16** | **Needs a focused terminology and state-copy pass.** |

Issues: **0 P0 · 4 P1 · 5 P2 · 1 P3**

## Fixed in this pass

1. The dig receipt no longer says `joy reclaimed`; it reports the number of
   finds added against the Hungerer.
2. Sounder onboarding no longer claims that a full Sounder `digs deeper`.
   It now explains the actual trigger and benefit: dig after a crewmate for up
   to five more rubs before the Hungerer wakes.

## P1 — fix before release

### 1. Onboarding teaches a currency that does not exist

- Location: `components/Onboarding.tsx:37`
- Current: `Each tickle earns a heart. Spend hearts in the shop...`
- Impact: A new player looks for a heart balance, while the shop prices items in
  snouts.
- Rewrite: `Each tickle earns a snout. Spend snouts in the Shop on outfits and
  decorations, then dress Rosie from your Closet.`

### 2. One season contribution has four names

- Locations: `hooks/useHungerMeter.ts:39`,
  `components/season1/HungerHero.tsx:213`,
  `components/season1/SeasonGuideModal.tsx:135`, and formerly the dig receipt.
- Current concepts: `joy reclaimed`, `tickles reclaimed`, and `finds` all
  describe the credited-find contribution; heart art implies a fourth resource.
- Impact: Players cannot tell whether they earned currency, restored health, or
  advanced shared progress.
- Rewrite strategy:
  - Use **find/finds** for the measurable season contribution.
  - Label ladder values, for example `600 finds` rather than bare `600`.
  - Reserve **joy** for story prose only.
  - Reserve **tickles** for the leaderboard/earnings counter and **snouts** for
    spendable currency.

### 3. A failed Burrow Book read becomes `0/12`

- Locations: `utils/uniques.ts:3-4`, `app/dig-collection.tsx:55-81`
- Current behavior: `null` from a missing table, network error, or read error is
  converted to an empty collection.
- Impact: A collector can be told they found nothing when their collection
  simply failed to load. This damages trust in the core collection loop.
- Recommendation: Preserve `loading`, `loaded`, and `error` as distinct states.
  On error, keep silhouettes but replace the count with `—/12` and show:
  `We couldn't load your Burrow Book. Check your connection and try again.`
  Add a `Try again` action.

### 4. `Claim` does not claim an achievement reward

- Locations: `app/achievements.tsx:163`, `app/achievements.tsx:224`,
  `app/achievements.tsx:329`
- Current behavior: Rewards are already granted server-side. Tapping `Claim`
  only calls `mark_achievement_viewed`.
- Impact: The UI promises a transaction that does not happen and makes players
  wonder whether rewards were actually delivered.
- Rewrite: Rename the filter to `New`, the count to `N new`, the empty state to
  `No new achievements`, and the acknowledgment action to `Mark as seen`.

## P2 — next clarity pass

### 5. Wallow does not plainly state what restarts

- Location: `app/(tabs)/season.tsx:182-210`
- Current: `Begin another sparse reward path`, `Keep everything`, and
  `Fill the last XP to Wallow`.
- Impact: At a prestige decision, players need exact consequences. `Everything`
  and `sparse` do not say whether XP, tiers, rewards, currency, or cosmetics are
  reset.
- Rewrite: `Restart this Season Pass at Tier 1. You keep every reward and raise
  your Wallow Rank. Your first two Wallows also speed up tickle regeneration.`
  Disabled CTA: `Finish Tier {total} to Wallow`.

### 6. Hunger ladder numbers have no unit

- Locations: `components/season1/HungerHero.tsx:213-229`,
  `components/season1/SeasonGuideModal.tsx:135-150`
- Current: stage names sit beside bare values such as `600` and `1,800` under
  `steal back the tickles`.
- Impact: The values can be read as tickles, snouts, health, or XP.
- Rewrite: Heading `Finds needed to weaken him`; values `600 finds`,
  `1,800 finds`, and so on.

### 7. Tickle receipt hides a read failure behind flavor

- Location: `components/TickleBreakdownSheet.tsx:190-205`
- Current: `the pig keeps its secrets for now`; empty state says
  `no tickles reclaimed yet this season`.
- Impact: Players cannot distinguish unavailable data from private data or a
  true zero. `Reclaimed` also incorrectly ties the personal ledger to the
  Hungerer story.
- Rewrite: Error: `We couldn't load this breakdown. The total is still shown
  below.` Empty: `No tickles earned yet this season.`

### 8. Generic failures lack a reason or next step

- Representative locations: `components/PurchaseToast.tsx:124`,
  `app/(tabs)/shop.tsx:767-809`, `components/UsernameSetup.tsx:68`,
  `components/Inbox.tsx:382`, and `components/SounderCard.tsx:174-202`.
- Current pattern: `Couldn't ... Try again.` The shop can also expose a raw RPC
  reason through `r.reason`.
- Impact: Players cannot tell whether retrying will help, and internal reason
  codes may leak into the UI.
- Recommendation: Map every known reason to a player message. Use the fallback:
  `We couldn't reach the barn. Check your connection and try again.` Never show
  raw server reason strings.

### 9. Sounder actions overuse metaphor at decision points

- Locations: `components/JoinableSounders.tsx:80-96`,
  `components/SounderCard.tsx:233`, `components/SounderCard.tsx:419-474`
- Current: `take it back`, `let it go`, `Found the Sounder`, and
  `Call a snout to your banner`.
- Impact: The surrounding context often rescues these phrases, but isolated
  buttons and screen-reader announcements do not state the action.
- Rewrite set: `Cancel request`, `Decline invite`, `Create a Sounder`, and
  `Invite a friend`. Keep the metaphor in supporting copy.

## P3 — polish

### 10. `heart` art still behaves like an unlabeled metric

- Locations: `components/BarnVisitModal.tsx:532-561`, leaderboard score rows,
  and the dig receipt icon.
- Impact: The same heart image accompanies personal tickles, shared visit gains,
  and Hungerer contributions.
- Recommendation: Add a nearby noun wherever a heart has a number. Decorative
  flying hearts can remain unlabeled.

## Recommended terminology

| Term | Use it for | Do not use it for |
|---|---|---|
| Tickle | A tap/visit action and the lifetime or seasonal tickle score | Hungerer contribution |
| Snout | Spendable shop currency earned from tickles | Visual hearts or season finds |
| Find | A claimed Truffle Patch item that advances season progress | Shop currency |
| Golden Truffle | Spendable Season 1 Exchange currency | The First Truffle relic |
| Sounder | A crew of up to four pigs | A bonus that requires a full crew |
| Feeding | One eight-hour Hungerer cycle; patch open for its first four hours | A dig action |
| Rub | A tap that costs one attention point | A generic season contribution |
| Shove | A hold that costs three attention points | A generic dig |
| Wallow | Restarting a completed pass at Tier 1 while keeping earned rewards | A vague rank-up with unstated consequences |
| Joy | Story language only | Any displayed counter or receipt line |

## Positive findings

- Account deletion copy names every major consequence and offers `Keep account`.
- Insufficient-funds shop copy says how many more snouts are needed.
- Referral-code onboarding explains the reward and makes skipping safe.
- The Truffle Patch help sheet clearly distinguishes rub from shove and explains
  that the Hungerer's attention is the session clock.
- Empty states generally pair a state explanation with a useful next step.

## Recommended order

1. Fix onboarding currency and achievement acknowledgment language.
2. Establish and apply the terminology table across Season 1 surfaces.
3. Separate empty, loading, and error states for collections and ledgers.
4. Replace generic/raw errors with reason maps and recovery instructions.
5. Distill Sounder decision labels while preserving flavor in supporting text.
6. Run a final copy and layout polish pass on-device at large text sizes.
