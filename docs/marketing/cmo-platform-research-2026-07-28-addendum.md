# CMO platform research addendum — 2026-07-28

Scope: current, first-party operating constraints for future Tickle the Pig
creative and measurement. This research does **not** establish account access,
consent, billing readiness, a live tag, or permission to publish or spend.

## Meta: isolated creative tests and privacy

**Verified.** Meta Ads Manager assigns objective to the campaign; audience,
placements, budget, and schedule to the ad set; and creative, copy, and link to
the ad. Its campaign flow offers an A/B-test toggle for setup after publication.
The available options can vary by account and campaign setup, so the actual
account's read-only Experiment controls must be checked before a test is
promised. [Meta: create campaigns in Ads Manager](https://www.facebook.com/help/messenger-app/621956575422138/)

**Recommendation.** For a hook test, lock objective, conversion location,
audience, placements, optimization, budget, schedule, destination, and every
creative field other than the opening hook. Do not use dynamic or automated
creative optimization in that comparison.

**Privacy hold.** Meta Business Tools includes Pixel and Conversions API. The
terms require prominent website notice describing third-party collection and
ad-targeting choices, and verifiable consent before cookie/device access where
required. Do not activate a Meta dataset, Pixel, CAPI, or event optimization
until a human verifies the consent flow, privacy disclosure, event map, and
account role. [Meta Business Tools Terms](https://www.facebook.com/legal/terms/businesstools/preview)

## TikTok: native split test, creative, and web measurement

**Verified.** TikTok Ads Manager supports split tests. Its standard design uses
random, mutually exclusive, equal audience groups; TikTok recommends a schedule
of at least seven days and reports a winner only at 90% statistical significance.
For an interpretable test, alter one variable only. [TikTok: split testing](https://ads.tiktok.com/help/article/split-testing?lang=en&redirected=2), [TikTok: split-test variables](https://ads.tiktok.com/help/article/split-testing-variables?lang=en)

**Creative recommendation.** Lead real, vertical game footage with the benefit
in the first 2–3 seconds, keep vital text in the placement safe zone, and use
sound plus clear captions. Video Insights is available under **Ads Manager →
Analytics** to compare creative interactions; that access has not been verified
for TTP. [TikTok: Video Insights](https://ads.tiktok.com/help/article/video-insights?redirected=2)

**Measurement/privacy hold.** TikTok supports URL UTMs and its web data
connections use Pixel, Events API, or both. Pixel cookies support matching and
attribution, so do not install or enable them until the site consent mechanism,
privacy disclosure, and data-minimization review are approved. [TikTok: UTM tracking](https://ads.tiktok.com/help/article/track-offsite-web-events-with-utm-parameters?lang=en), [TikTok: website data connections](https://ads.tiktok.com/help/article/website-data-connection-setup-methods?lang=en), [TikTok: Pixel cookies and consent](https://ads.tiktok.com/help/article/using-cookies-with-tiktok-pixel/)

## X: website attribution

**Verified.** X web conversion tracking requires at least one of X Pixel or
Conversions API. The base Pixel belongs sitewide; the API requires X Ads API
access and an active Developer Account. X Click ID is `twclid`; retain it through
the landing flow. If Pixel and API are both used, pass `conversion_id` for
deduplication. [X: conversion tracking for websites](https://business.x.com/en/help/campaign-measurement-and-analytics/conversion-tracking-for-websites?lang=en)

**Hold.** Treat unique UTMs as directional click attribution only until a human
verifies X access, tag/API implementation, consent/privacy posture, and
`twclid` preservation. Do not call a site click a download.

## Apple App Store campaign links

**Verified.** Generate campaign links in **App Store Connect → Apps → Analytics
→ Acquisition → Campaigns**. The link includes a provider token (`pt`), campaign
token (`ct`), and media type (`mt`), for example:

```
https://apps.apple.com/app/idAPP_ID?pt=PROVIDER_TOKEN&ct=CAMPAIGN_TOKEN&mt=8
```

Campaign reporting includes impressions, product-page views, downloads, usage,
sales, and subscriptions. It appears after at least 24 hours and five
first-time downloads. First-time downloads within 24 hours receive campaign
credit; where multiple campaign links are clicked, the most recent receives
credit for later sales. [Apple: campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links)

**Recommendation.** Give each platform and test arm a distinct URL-safe
`utm_*` URL on `https://ticklethepig.com/` and a distinct Apple `ct` token. The
site's App Store CTA must preserve the complete generated Apple link, including
`pt`, `ct`, and `mt=8`. The app ID, provider token, and generated campaign
tokens are unavailable in this workspace, so a human with App Store Connect
Analytics access must create them and manually verify the final redirect.

## Activation prerequisites

1. Read-only confirmation of Meta, TikTok, and X roles, experiment controls,
   data connections, and billing readiness.
2. Human approval of consent/privacy disclosure and permitted event payloads
   before any platform tag/API activation.
3. Site-analytics access and a redirect check for platform click IDs, UTMs, and
   the generated Apple campaign link.

Until then, creative and test designs are **test-ready, not tested**.
