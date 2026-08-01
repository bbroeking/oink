# Mobile social-game growth research — 2026-07-28

Scope: current, first-party platform capabilities relevant to a future Tickle
the Pig acquisition and social-growth program. This is a strategy memo, not
evidence that any account, integration, asset, feature, budget, or approval is
present. It authorizes neither product changes nor paid activation.

## Verified capabilities

### Apple: match the store page to the acquisition promise

**Custom Product Pages (CPPs).** Apple supports up to 70 approved, localizable
CPPs per app, each with a unique URL and alternate screenshots, previews,
promotional text, and keywords. A CPP is visible via its link (or optional
approved search keywords), and App Analytics supplies page-level impressions,
downloads, and conversion rate after five first-time downloads. Apple Ads can
use a CPP as an ad variation so a keyword or audience promise can land on
matching store creative. [Apple: CPPs](https://developer.apple.com/help/app-store-connect/create-custom-product-pages/configure-multiple-product-page-versions), [Apple Ads: ad variations](https://ads.apple.com/app-store/help/ads/0077-create-ad-variations)

**Product Page Optimization (PPO).** For an app already Ready for Distribution,
Apple can randomly compare the default page against up to three variants of
icons, screenshots, or previews; one test runs for up to 90 days. Apple’s
Analytics uses confidence reporting, and 90% confidence is its threshold for
"Performing Better" or "Performing Worse." A test cannot be changed after it
starts. [Apple: PPO overview](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/), [Apple: PPO analytics](https://developer.apple.com/help/app-store-connect-analytics/acquisition/product-page-optimization/)

**Timely live moments.** Apple In-App Events can promote a time-limited game
event on the App Store and Apple Games; customers can discover, opt in for a
reminder, download, and open into the relevant in-app area. Analytics includes
event impressions, page views, reminders, opens, downloads, usage, and sales.
The event itself and its assets require App Review; up to 10 can be live at a
time. [Apple: In-App Events overview](https://developer.apple.com/help/app-store-connect/offer-in-app-events/overview-of-in-app-events), [Apple: In-App Events analytics](https://developer.apple.com/help/app-store-connect-analytics/acquisition/in-app-events/)

**Optional platform-native friend loop.** Game Center has identity, friends,
leaderboards, challenges, and multiplayer capabilities. Its challenge feature
lets players invite Game Center friends or contacts to a score-based round and
see results/notifications; Apple states Game Center games may be discovered via
friends in Apple Games and the App Store. This is a **potential future product
integration**, not proof that TTP currently supports it. [Apple: Game Center](https://developer.apple.com/game-center/), [Apple: Game Center challenges](https://developer.apple.com/documentation/appstoreconnectapi/configuring-game-center-challenges?changes=_5)

### Meta: creator distribution and app measurement

**Creator partnerships.** Instagram Creator Marketplace lives in Meta Business
Suite and supports creator discovery/evaluation. Partnership Ads can distribute
approved creator content across Feed, Stories, and Reels; creator permissions
are managed in Partnership Ads Hub. Eligibility and available tools require a
read-only check in the actual portfolio/account. [Meta: Creator Marketplace and
Partnership Ads](https://www.facebook.com/business/ads/creator-marketplace),
[Meta: partnership-ad eligibility](https://www.facebook.com/help/116947042301556/)

**App campaign measurement.** Meta’s Conversions API can receive mobile-app
events and supports measurement/optimization, but it is governed by Business
Tools Terms and does not replace privacy/consent obligations. This is not
evidence that TTP has an SDK, MMP, event map, or consent-ready app/site
instrumentation. [Meta: Conversions API](https://www.facebook.com/business/help/AboutConversionsAPI), [Meta: Business Tools Terms](https://www.facebook.com/legal/terms/businesstools/preview)

### TikTok: creator-led reach, installs, and experiments

**Creator/community distribution.** TikTok One supports creator-marketing
projects (direct/open creator collaboration) and authorized creator posts may
be synced to Ads Manager. Spark Ads use an organic post as the ad creative;
views, comments, shares, likes, and follows gained during promotion attach to
that organic post. Paid use therefore needs creator authorization and a clear
rights/deliverables agreement before any boost. [TikTok One collaboration](https://ads.tiktok.com/help/article/about-working-with-creators-on-tiktok-one-campaigns?lang=en), [TikTok: Spark Ads](https://ads.tiktok.com/help/article/spark-ads?lang=en&q=Spark&redirected=2)

**App acquisition and measurement.** TikTok’s App Promotion objective supports
install, retargeting, and in-app-event/value optimization. Its non-app-promotion
campaigns can also measure app activity only after an MMP, App Events SDK, or
App Events API connection; TikTok says to separate iOS and Android ad groups
when measuring both. TTP should not claim this attribution is available unless
the required connection is verified. [TikTok: App Promotion](https://ads.tiktok.com/help/article/what-is-app-promotion-objective?lang=en&redirected=1), [TikTok: app activity measurement](https://ads.tiktok.com/help/article/how-to-measure-app-activity-for-non-app-promotion-campaigns?lang=en)

**Test hygiene.** TikTok split tests randomize mutually exclusive equal audience
groups, recommend at least seven days, and label a result as a winner at 90%
statistical significance. [TikTok: split testing](https://ads.tiktok.com/help/article/split-testing?lang=en&redirected=2)

## Recommendations for a small social game

1. **One social promise per acquisition lane.** Draft separate, truthful
   creative lanes around only currently shipped experiences—for example, a
   friend visit, a co-op goal, or a daily cozy ritual *only after release status
   is verified*. Each lane should show real footage, use a single CTA, and lead
   to its own UTM-tagged `https://ticklethepig.com/` URL.
2. **Use creators as a creative collaboration, not fabricated community proof.**
   Start with small creators whose normal content already includes cozy games,
   friendship play, or mobile-game discovery. Give a narrow factual brief,
   require disclosure/rights approval, and preserve the creator’s actual voice.
   Do not pay, publish, or boost without current-run human approval.
3. **Build a share loop only around a player benefit.** A social invite should
   offer a concrete, non-pay-to-win reason to play together (for example,
   joining a cooperative moment), have a clear recipient experience, and avoid
   automatic contact import/spam. A Game Center challenge is a future technical
   option if it matches the game’s actual mechanics; it is not the immediate
   marketing plan.
4. **Align creative → web → App Store.** If a lane earns qualified traffic,
   make one CPP that repeats the same factual promise in its first screenshots
   or preview. Run PPO separately to isolate one store asset variable. This
   avoids conflating a social-video hook test with a store-conversion test.
5. **Measure in funnel order.** Use platform video hold/engagement and UTM site
   visits first; then Apple product-page views and first-time downloads via a
   generated `pt`/`ct` campaign link. Only optimize toward activation after an
   approved, privacy-safe measurement connection proves that event is reliable.

## Recommended test sequence (test-ready, not tested)

| Stage | Single variable | Primary metric | Guardrail / decision |
| --- | --- | --- | --- |
| Organic short video | First 1–2 second hook | Qualified video hold | Same footage, caption, CTA, timing, and audience hypothesis; sequential organic results are directional, not a simultaneous A/B winner. |
| Paid TikTok/Meta creative | Opening hook | Platform video-view or landing-page-view result | Native split test where available; hold audience, placements, destination, budget, and all non-hook creative constant. |
| App Store page | First screenshot/value proposition | Apple product-page conversion rate | PPO only; one asset variable and wait for Apple’s reported confidence threshold. |
| Creator amplification | Creator format, after a validated owner post | Qualified views / site click-through | Use approved, rights-cleared creator content; compare like with like and never infer a causal winner from different audiences or flights. |

## Required human checks before activation

1. Confirm which product surfaces are actually live and suitable for promotion;
   do not market a prototype, planned social loop, or unreleased migration.
2. Confirm Meta Business Portfolio/Page/Instagram, TikTok One/Ads Manager,
   Apple Ads/App Store Connect roles, billing, rights/disclosure process, and
   permitted budget.
3. Confirm site analytics, UTM capture, privacy/consent posture, and the exact
   Apple provider/campaign tokens. The site’s App Store CTA must preserve each
   generated Apple campaign link.
4. Define a trustworthy first-session/activation event before treating installs
   as retained players or optimizing paid media beyond qualified reach.

Until those checks are complete, the strategy is **test-ready, not tested**.
