# Rewarded ads platform research

**Researched:** 2026-08-03  
**Scope:** AppLovin MAX, Google AdMob, and Unity LevelPlay for the current Expo 52 / React Native 0.76.9, iOS-first app. No application code or configuration was changed.

## Recommendation

Rewarded ads are technically feasible, but **do not ship the proposed five ordinary-tickle rewards per day as-is**.

If the product decision is to test ads, use **direct Google AdMob first**, iOS-only, behind a feature flag. It has the cleanest Expo integration, the strongest documented server-side verification, and child/teen request controls. Start with **one optional sponsor refill when the bank is empty**, not five standing daily chores. Do not add mediation adapters during the pilot.

Three blockers must be resolved before implementation:

1. **Product promise:** current App Store/privacy and Play materials explicitly promise no ads (`docs/APP_STORE_LISTING.md`, `landing/privacy.html`, `docs/google-play/store-listing.md`, and `docs/google-play/data-safety.md`). The project principles also reject grind and uncoupled reward faucets (`PRODUCT.md`, `SKILL.md`). Five daily ad opportunities would reverse a public promise and make ad-watching a high-yield routine.
2. **Reward policy:** Google permits virtual rewards only when they are usable within the app and **non-transferable**. Tickle the Pig's ordinary bank can be spent to fulfill a friend's tickle request, so a normal `grant_tickles()` payout does not cleanly fit Google's rewarded-ad policy. An AdMob reward would need to be a separate, personal-use refill/bonus bank that cannot fund trades or gifts. Each ad must clearly disclose the exact action and reward and be separately, affirmatively opted into. [Google rewarded-ad policy](https://support.google.com/admob/answer/7313578?hl=en-GB)
3. **Audience/privacy:** the app is currently rated 4+, says it is not directed to children under 13, and requires age 13+ in its terms, but it has no explicit age gate. This is especially incompatible with AppLovin's current rule that its SDK must not be initialized or used for any user who qualifies as a child. [MAX privacy and children policy](https://support.applovin.com/en/max/react-native/overview/privacy)

## Platform comparison

| | Google AdMob | AppLovin MAX | Unity LevelPlay |
|---|---|---|---|
| React Native package | `react-native-google-mobile-ads` 16.4.0, maintained by Invertase | `react-native-applovin-max` 9.6.0 | `unity-levelplay-mediation` 9.2.0 |
| Expo 52 fit | Best. Declares Expo `>=47`, ships a config plugin, and documents Expo configuration for app IDs, SKAdNetwork IDs, ATT text, and rebuilds. [Package source](https://github.com/invertase/react-native-google-mobile-ads/blob/main/package.json), [installation](https://docs.page/invertase/react-native-google-mobile-ads) | Technically plausible. v9 supports React Native New Architecture, but the official package does not ship an Expo config plugin. Native settings and adapters need local config-plugin or native-project work. [Integration](https://support.applovin.com/en/max/react-native/overview/integration), [package source](https://github.com/AppLovin/AppLovin-MAX-React-Native/blob/master/package.json) | Technically plausible. Official docs support RN 0.66+, while v9 adds New Architecture support for RN 0.74+. The package does not ship an Expo config plugin; setup includes manual native configuration. [Integration](https://docs.unity.com/en-us/grow/levelplay/sdk/react/plugin-integration), [changelog](https://docs.unity.com/en-us/grow/levelplay/sdk/react/changelog), [package source](https://github.com/ironsource-mobile/react-native-SDK/blob/master/package.json) |
| Reward callback | Client `EARNED_REWARD`; request can carry SSV user/custom data. [React Native rewarded ads](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads) | Client load/display/hide/failure/reward listeners. [MAX rewarded ads](https://support.applovin.com/en/max/react-native/ad-formats/rewarded-ads) | `onAdRewarded` plus load/display/close/failure listeners; reward and close order is asynchronous. [LevelPlay rewarded ads](https://docs.unity.com/en-us/grow/levelplay/sdk/react/rewarded-ads-integration) |
| Server verification | Best documented: unique `transaction_id`, ECDSA signature, and rotating public keys. Google says economy-sensitive apps may wait for verified SSV. [Google SSV](https://developers.google.com/admob/ios/ssv) | Unique event ID plus SHA-1 event token or SHA-256 token over callback fields; callbacks may be delayed by minutes and retry twice. [MAX S2S callbacks](https://support.applovin.com/en/max/advanced-features/s2s-rewarded-callback-api) | Unique event ID and shared-secret MD5 signature. Requires a fast provider-specific acknowledgement and has a long retry schedule. [LevelPlay S2S callbacks](https://docs.unity.com/en-us/grow/levelplay/platform/settings/server-to-server-callback) |
| Child-directed handling | Supports child/teen/unspecified treatment and maximum content rating. [Google targeting](https://developers.google.com/admob/ios/targeting), [wrapper request configuration](https://github.com/invertase/react-native-google-mobile-ads/blob/main/src/types/RequestConfiguration.ts) | Decisive blocker without age assurance: cannot be used for a child user or in an exclusively child-directed/Kids Category app. [MAX privacy](https://support.applovin.com/en/max/react-native/overview/privacy) | Supports COPPA, GDPR, and US privacy signals, including mixed-audience guidance. Each mediated network still has its own obligations. [LevelPlay regulation settings](https://docs.unity.com/en-us/grow/levelplay/sdk/react/regulation-advanced-settings) |
| Operational weight | Lowest for direct AdMob. Adding mediation still adds native adapters and sometimes network-specific bridges. [AdMob mediation](https://docs.page/invertase/react-native-google-mobile-ads/mediation) | Higher: configure the MAX waterfall, selected network adapters, consent propagation, SKAdNetwork IDs, and creative review/debugging. [MAX mediated networks](https://support.applovin.com/en/max/react-native/preparing-mediated-networks) | Highest for this pilot: native settings, mediated adapters, privacy settings, and an automatically integrated Ad Quality SDK. Its iOS setup currently also documents `NSAllowsArbitraryLoads=YES`. [LevelPlay integration](https://docs.unity.com/en-us/grow/levelplay/sdk/react/plugin-integration) |

All three packages contain native code. They require a rebuilt development client and cannot be tested in Expo Go. Tickle the Pig already uses `expo-dev-client` and has native iOS/Android projects, so this is a rebuild cost rather than a workflow blocker. [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)

## Economy impact

The ordinary free-player bank regenerates roughly one tickle per hour before modifiers, or 24 tickles per day if none are wasted. Each home tickle currently also adds one snout, one season-board tickle, three season XP, happiness, and a chance at the Lucky Pig bonus. The direct daily effect of the proposed cap is therefore:

| Reward per ad | Five-ad daily grant | Increase over 24 base tickles | Direct season XP when consumed |
|---:|---:|---:|---:|
| 1 tickle | 5 | 21% | 15 |
| 3 tickles | 15 | 63% | 45 |
| 5 tickles | 25 | 104% | 75 |

These figures exclude Lucky Pig bonuses and downstream happiness effects. Five ads for one tickle each is the only modest version economically, but it creates five interruptions for a small reward. One refill is the better-shaped experiment.

## Recommended server design

The five-per-day rule must be authoritative in Supabase; a client counter or network dashboard cap is only defense in depth.

1. An authenticated `begin_rewarded_ad` RPC atomically reserves an attempt if the user is eligible. Count completed grants plus unexpired reservations so two devices cannot both consume the last slot.
2. Return an opaque attempt ID. Pass that ID—not a raw stable profile identifier—as SSV custom data where supported.
3. Show the ad only after a clear button such as “Watch one ad for +N personal tickles.” A client reward callback changes the UI to **Reward pending**; it never grants currency.
4. A public Supabase Edge Function receives the provider callback, validates its signature/token, expected app and ad-unit IDs, reward amount, timestamp, user binding, and attempt.
5. In one database transaction, insert a unique `(provider, event_id)` ledger row, consume the reservation, enforce the rolling limit, and grant the personal-use reward. Duplicate callbacks return success without paying twice.
6. The app refreshes server state. No-fill, early close, offline, expired reservation, delayed callback, and cap-reached states must remain non-punitive.

Use a **rolling 24-hour limit** if the user-facing copy says “in the last 24 hours”; otherwise define and display the exact server reset boundary. Provider frequency caps can mirror the product cap, but MAX and LevelPlay both document platform caps as delivery controls, not an economy ledger. [MAX ad-unit frequency caps](https://support.applovin.com/en/max/max-dashboard/ad-units/create-an-ad-unit), [LevelPlay capping and pacing](https://docs.unity.com/en-us/grow/levelplay/platform/settings/capping-pacing)

## Privacy and store requirements

- Resolve regional consent before initializing an ad SDK because initialization or mediation adapters may preload ads. Google requires a certified CMP for personalized ads in the EEA, UK, and Switzerland; Google UMP is the simplest fit for an AdMob pilot. [Google CMP requirements](https://support.google.com/admob/answer/13554116?hl=en)
- ATT is required when the app or included SDK tracks users across companies' apps/sites or accesses IDFA. The reward may not be gated on, or increased for, granting ATT; denied users must retain the same product functionality and reward opportunity with eligible nontracking inventory. [Apple privacy and ATT](https://developer.apple.com/app-store/user-privacy-and-data-use/)
- Apple requires ads to match the app's age rating, be clearly presented and dismissible, and the app must let users report inappropriate or age-inappropriate ads. For the current 4+ rating, configure the lowest/general-audience ad-content ceiling and add an in-app ad-report path. [Apple App Review Guidelines 2.5.18](https://developer.apple.com/app-store/review/guidelines/), [AdMob content labels](https://support.google.com/admob/answer/10478094?hl=en)
- Update the in-app/public privacy policy, App Store privacy answers, Play Data safety form, Play “contains ads” declaration, store copy, and review notes before release. Apple requires disclosures to include third-party SDK data practices. [Apple app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- If Google Play's declared target audience includes children, ads shown to children or unknown-age users must use Families self-certified SDK versions and comply with Families ad/content rules. [Google Play target-audience policy](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en)

## Go/no-go

**Technical go:** a direct AdMob proof of concept is viable on the current stack.

**Product no-go on the original shape:** do not introduce five daily ordinary-tickle payouts. A safer experiment is one feature-flagged, empty-bank sponsor refill per rolling 24 hours, paid into a non-transferable personal-use reward bucket, with verified SSV and no client grant. Revisit MAX only after a defensible audience/age strategy; revisit mediation only after the direct pilot proves that ads improve the product enough to justify the privacy, store, and operational cost.
