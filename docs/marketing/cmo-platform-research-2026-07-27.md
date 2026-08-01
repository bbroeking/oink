# CMO platform research — 2026-07-27

Scope: current, official first-party documentation for a future Tickle the Pig
campaign. This is implementation guidance only; it does not establish account
access, billing readiness, consent status, or permission to publish.

## Cross-channel measurement recommendation

Use a distinct, URL-safe UTM-tagged `https://ticklethepig.com/` URL per
platform, placement, and experiment arm. The website CTA must then preserve
the full Apple campaign link; website UTMs and Apple campaign parameters solve
different attribution steps. Validate the final redirect and captured params
in a non-production test before activating a campaign.

Do not treat missing platform or App Store data as zero. Apple reports campaign
data only after the campaign is at least 24 hours old and has at least five
first-time downloads; app usage is limited to people who opt in to sharing
diagnostics and usage data. [Apple: campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links),
[Apple: measuring app performance](https://developer.apple.com/app-store/measuring-app-performance/).

## Apple App Store Connect Analytics

**Verified.** Create links in App Store Connect: **Apps → Analytics →
Acquisition → Campaigns**. A generated link contains `pt` (provider token),
`ct` (campaign token), and `mt` (media type), for example:

```
https://apps.apple.com/app/idAPP_ID?pt=PROVIDER_TOKEN&ct=CAMPAIGN_TOKEN&mt=8
```

Apple requires provider and campaign tokens for campaign reporting. A
first-time download is attributed when it occurs within 24 hours of use of the
campaign link/token; where multiple links are clicked, the most recent gets
credit for subsequent sales. The `ct` token can be up to 30 characters using
Apple's permitted characters. Campaign reporting can include impressions,
product-page views, downloads, usage, sales, and subscriptions, subject to the
threshold above. [Apple campaign-links reference](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links).

**Blocker.** The exact App Store app ID and provider token were not available
in the workspace. A human with App Store Connect Analytics access must generate
the provider token and each campaign token; do not guess either value. The site
CTA must retain these Apple parameters after its UTM-tagged landing URL.

For paid-web measurement, Apple also documents privacy-preserving
[AdAttributionKit](https://developer.apple.com/app-store/ad-attribution/);
its postbacks and fields are conditional on platform privacy rules. Treat it
as a separately approved engineering/measurement integration, not as a
substitute for campaign links.

## Meta (Facebook and Instagram)

**Verified.** Meta Ads Manager organizes a campaign by objective, ad set by
audience/placements/budget/schedule, and ad by creative/link. The manual setup
flow exposes an **A/B test** toggle after campaign publication. For a clean
creative test, hold objective, conversion location, audience, placements,
budget, schedule, optimization, destination, and every creative field except
the single tested variable constant. Do not use dynamic creative for that
isolated comparison; it changes delivery and may be unavailable in some
app/sales flows. [Meta Ads Manager setup](https://www.facebook.com/help/messenger-app/621956575422138/).

**Privacy hold.** Meta Business Tools include Pixel, Conversions API, and app
events, and may send off-Meta website/app event data to Meta. Before any Pixel,
CAPI, or app-event activation, a human owner must confirm the lawful basis,
consent/opt-out behavior where required, published privacy disclosure, and
Meta terms acceptance. [Meta Business Tools overview](https://www.facebook.com/help/331509497253087/),
[Meta Pixel information](https://www.facebook.com/help/336858938174917/).

**Account check required.** The precise available A/B-test types and experiment
controls vary by account/setup. Verify them read-only in the actual Ads Manager
before promising a native experiment design.

## TikTok

**Verified for auction in-feed creative.** Prefer a 9:16 video at least
540×960, with clear audio and all key text/logo inside TikTok's downloaded safe
zone. Non-Spark auction ads support `.mp4`, `.mov`, `.mpeg`, `.3gp`, or `.avi`,
up to 10 minutes and 500 MB; the TikTok page recommends vertical video. Spark
uses the published organic post. [TikTok auction in-feed specifications](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads?lang=en-GB).

For a practical small-game creative, use high-resolution 9:16, sound-on,
5–60 seconds, and a dynamic game-footage-plus-human/story framing—not a static
screen recording. TikTok's game requirements say videos solely showing screen
recordings are not allowed in the cited format. Check the current in-account
preview and placement-specific safe zone before approval. [TikTok TopView
specifications](https://ads.tiktok.com/help/article/tiktok-reservation-topview?redirected=2).

TikTok exposes Video Insights at **Ads Manager → Analytics**. [TikTok Video
Insights](https://ads.tiktok.com/help/article/video-insights?lang=en).

**Destination check.** The campaign brief calls for the website as the single
funnel. Use a normal in-feed/web destination, not TopView: TikTok's TopView
documentation says App Store/Google Play download links are not supported.
Confirm the exact destination policy and preview for the selected auction
placement at build time. [TikTok TopView URL rules](https://ads.tiktok.com/help/article/tiktok-reservation-topview?redirected=1).

## X

**Verified.** X Ads Manager is the workspace to plan, manage, and report. It
supports campaign/ad-group/ad levels; ad groups set goals, bids, targeting,
placements, daily budget, and flight dates. The dashboard can show
impressions, CPM, clicks, CTR, CPC and objective-dependent results; exports can
be total, weekly, or daily. [X Ads Manager](https://business.x.com/en/help/campaign-setup/x-ads-manager).

X reports campaign measurement such as reach, frequency, clicks, installs, and
cost per action. Its website measurement options include X Pixel and
Conversions API; mobile-app measurement is needed to attribute installs and
in-app events. Availability of some measurement products varies by market.
[X measurement](https://business.x.com/en/advertising/measurement).

**Activation blocker.** X states a payment method is required before a campaign
can run; no account, billing, or analytics access was verified in this run.
[X Ads getting started](https://business.x.com/en/advertising/get-started-with-twitter-ads).

## Required human confirmations before any paid test

1. Read-only access to the Meta Business Portfolio/Page/Instagram, ad account,
   Events Manager dataset, TikTok Ads Manager/Analytics, X Ads/Analytics, site
   analytics, and App Store Connect Analytics.
2. Meta/X/TikTok billing readiness and the permitted spend cap.
3. Website analytics and consent/privacy-disclosure review for each tracking
   technology before it is enabled.
4. The generated Apple provider token, app ID, and a unique campaign token for
   every final variant; then a redirect check that proves the site CTA preserves
   the full Apple link.

