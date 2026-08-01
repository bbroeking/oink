# CMO platform research — 2026-07-28

Scope: current first-party guidance for a future Tickle the Pig campaign. This
memo is research only: it neither verifies account access, consent status,
billing readiness, nor authorizes implementation, publishing, or spend.

## Meta: native A/B tests and measurement privacy

**Verified.** In the current Ads Manager creation flow, campaign, ad set, and
ad have distinct responsibilities: objective at campaign; audience,
placements, budget and schedule at ad set; creative and link at ad. The A/B
test toggle is selected while creating the campaign and is configured after it
is published. Account eligibility and options can vary, so verify the native
Experiment controls read-only in the actual ad account before promising a
particular setup. [Meta: create campaigns in Ads Manager](https://www.facebook.com/help/messenger-app/621956575422138/)

**Recommendation.** For a defensible hook test, hold objective, conversion
location, audience, placements, optimization, budget, schedule, destination,
and all creative fields constant; change only the declared hook. Avoid dynamic
or automated creative optimization in that isolated test, since it can alter
the treatment.

**Privacy hold.** Meta Pixel and Conversions API are Business Tools and share
event data such as site visits, installs, and purchases. Meta's Business Tools
Terms require the business to have the necessary rights/lawful basis, provide a
clear and prominent notice on every page using the tools, and obtain verifiable
informed consent before storing/accessing cookies or device information where
the jurisdiction requires it (including the EU example). Do not enable Pixel,
CAPI, or optimization to their events until a human confirms the consent flow,
privacy notice, data minimization, and applicable terms. Do not send
child-under-13, health, financial, or other sensitive data. [Meta Business
Tools](https://www.facebook.com/help/331509497253087/), [Meta Business Tools
Terms](https://www.facebook.com/legal/terms/businesstools/preview)

**Dataset note.** Meta now presents website, app, and offline events together
as a dataset; a Pixel-derived dataset retains the Pixel ID. This is a
measurement configuration fact, not evidence that TTP has a dataset or that it
is consent-ready. [Meta: set up and install the Pixel](https://www.facebook.com/help/messenger-app/952192354843755/)

## TikTok: paid and organic creative

**Verified paid constraints.** For non-Spark auction in-feed video, TikTok
recommends vertical 9:16 at least 540×960; allowed formats include MP4/MOV;
duration is up to 10 minutes and maximum file size is 500 MB. Key elements
must use the relevant downloadable safe zone. Non-Spark captions cannot use
clickable links, @ symbols, or hashtags; Spark captions are pulled from the
organic post. [TikTok: auction in-feed specifications, updated June
2026](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads?lang=en-GB)

**Verified creative guidance.** TikTok recommends TikTok-native 9:16 creative,
at least 720p, sound/music, safe-zone framing, a clear proposition in the
first three seconds, a hook within the first six seconds, captions/overlays,
and a strong CTA. It recommends 3–5 materially different creatives per ad
group, which is useful for exploration but not evidence for an isolated A/B
winner. For a winner claim, create a dedicated matched two-variant test.
[TikTok: performance creative best practices](https://ads.tiktok.com/help/article/creative-best-practices?lang=en)

**Recommendation.** Use real 9:16 game footage with either an owner/creator
voiceover or licensed/commercially cleared sound. Keep vital text in the safe
zone and preview the actual placement. Treat the cited organic-playbook
cadence (2–3 posts/week) as a recommendation to test, not a platform
requirement. [TikTok: Organic Playbook (PDF)](https://ads.tiktok.com/business/library/Organic_Playbook.pdf)

## X: essential campaign measurement

**Verified.** X's campaign dashboard reports impressions, objective-specific
results, engagement rate, and cost per result, with analysis by campaign,
post, and targeting. Broader X measurement availability varies by market.
[X: campaign dashboard](https://business.x.com/en/help/campaign-measurement-and-analytics/campaign-dashboard), [X: measurement](https://business.x.com/en/advertising/measurement)

**Website conversion requirement.** A website-sales campaign's Web conversions
goal requires X Pixel and/or Conversion API plus at least one conversion event.
The base Pixel belongs on every page; X Click ID (`twclid`) must survive to the
landing page, so avoid redirects that strip it. If both Pixel and CAPI are
used, manage deduplication with `conversion_id`; X otherwise does not dedupe
lower-funnel events. CAPI setup needs X Ads API access and an active Developer
Account. [X: conversion tracking for websites](https://business.x.com/en/help/campaign-measurement-and-analytics/conversion-tracking-for-websites?lang=en), [X: create a website-sales campaign](https://business.x.com/en/help/campaign-setup/create-website-conversions-campaign)

**Recommendation/hold.** Do not call site clicks downloads or optimize to
web conversions until a human verifies tag/CAPI status, consent/privacy
requirements, and `twclid` preservation. In the interim, use distinct UTMs
for directional site analytics only and label attribution incomplete.

## Apple App Store campaign attribution

**Verified.** Generate campaign links in **App Store Connect → Apps →
Analytics → Acquisition → Campaigns**. The link carries `pt` (provider token),
`ct` (campaign token), and `mt` (media type), for example:

```
https://apps.apple.com/app/idAPP_ID?pt=PROVIDER_TOKEN&ct=CAMPAIGN_TOKEN&mt=8
```

Apple permits campaign tokens of up to 30 characters (using its listed allowed
characters). Campaign analytics includes the linked campaign's impressions,
product-page views, downloads, usage, sales, and subscriptions. A first-time
download is credited when it occurs within 24 hours of the campaign
link/token; the most recently clicked campaign link receives later-sales
credit. Campaign data appears only after 24 hours and at least five first-time
downloads, and the link must include both provider and campaign tokens.
[Apple: campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links)

**Implementation recommendation.** Give every platform and experiment arm its
own Apple `ct` token. A `https://ticklethepig.com/` URL with distinct UTMs is
separate, upstream web attribution; the site's App Store CTA must preserve the
full Apple link with `pt`, `ct`, and `mt=8`. Before any campaign, manually test
the real redirect and captured parameters. The App Store app ID, provider
token, and final campaign tokens are not present in this workspace: a human
with App Store Connect Analytics access must create and provide the generated
links.

## Current blockers before paid activation

1. Read-only confirmation of Meta Business Portfolio/Page/Instagram, ad
   account/Experiments, and Events Manager dataset access; consent and privacy
   disclosure approval before Business Tools activation.
2. Read-only TikTok Ads Manager/analytics and X Ads/Events Manager access;
   billing readiness and permitted spend require explicit human approval.
3. Site analytics access plus a tested consent-aware measurement plan.
4. App Store Connect access to create unique campaign links and a manual proof
   that the site preserves them.

Until those conditions are satisfied, creative and test designs are
**test-ready, not tested**.
