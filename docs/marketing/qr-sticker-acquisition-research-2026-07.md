# QR Sticker Acquisition Research

**Date:** July 2026  
**Goal:** Use physical stickers to drive qualified App Store downloads and let
players claim a special Tickle the Pig item.

## Recommendation

Ship a small iPhone-only pilot using the redemption system that already exists.
The sticker QR should point to:

`https://ticklethepig.com/redeem/PIG-XXXX-XXXX`

That URL already behaves appropriately:

- If Tickle the Pig is installed, iOS can open the app through its Universal
  Link and the app can submit the code.
- If the app is installed but the player is signed out, the app preserves the
  code through authentication.
- If the app is not installed, the redemption website opens and directs the
  visitor to the App Store. After installation, the player rescans the sticker
  or manually enters the printed code.

Apple's Universal Link behavior intentionally falls back to the website when
the app is not installed. A normal Universal Link does not carry arbitrary
redemption state through an App Store installation. See
[Supporting associated domains](https://developer.apple.com/documentation/Xcode/supporting-associated-domains).

For the first pilot, keep that handoff explicit rather than adding a third-party
deferred-deep-link SDK:

> Scan to claim the **[named cosmetic]**.  
> No app yet? Download free, then scan again or enter this code:
> **PIG-XXXX-XXXX**

The landing page should preview the exact reward, offer a copy-code action, and
make the rescan/manual-entry step unmistakable.

## Two Sticker Programs

### 1. Public acquisition sticker

Use for coffee shops, event tables, community boards, packaging inserts, and
other broadly visible placements.

- One shared campaign code per test arm or distribution batch.
- A cosmetic reward with no competitive or progression advantage.
- One claim per account, a finite campaign-wide cap, and an expiry date.
- Treat the QR as public and shareable. Anyone can photograph or repost it.
- Use only placements where the property owner has given permission.

This is the recommended acquisition format. Sharing is not a security failure;
it can extend the campaign, while the per-account rule and campaign cap bound
the cost.

### 2. Collector or scarce-reward sticker

Use when physical possession is meant to confer a genuinely limited reward.

- Mint a unique, single-use code for every unit.
- Hide it under a scratch-off layer, opaque seal, or inside packaging.
- Print a human-readable fallback code beneath or beside the QR.
- Never display an unclaimed rare code openly; a photo could redeem it first.

A visible QR proves knowledge of the code, not possession of the sticker.

## What Is Already Implemented

The repository already has most of the difficult redemption infrastructure:

- Universal Link association for `ticklethepig.com/redeem/*`.
- App routing and authentication-aware pending-code handling.
- A web redemption fallback with an App Store call to action.
- Server-authoritative claims with row locking, expiry, usage caps, and
  one-claim-per-player enforcement.
- Support for cosmetics, golden truffles, and snout grants.
- A minting script that creates QR PNGs and a manifest.
- Zero direct table access through RLS; claims pass through the
  `redeem_code` function.

Relevant implementation files:

- `landing/redeem/index.html`
- `landing/.well-known/apple-app-site-association`
- `app/scan-code.tsx`
- `utils/redemption.ts`
- `scripts/mint-redemption-codes.mjs`
- `supabase/migrations/20260732000000_qr_redemption.sql`
- `supabase/migrations/20260776000000_cosmetic_owner_caps.sql`
- `docs/qr-redemption-implementation-notes.md`

## Gaps Before Printing

### 1. Improve the install handoff

The current fallback page uses a plain App Store link. Give each test arm an
Apple campaign link using the provider token, campaign token, and media type
parameters (`pt`, `ct`, and `mt=8`). Apple attributes a campaign when the user
downloads for the first time within 24 hours of tapping the campaign link.
Campaign reporting requires at least five first-time downloads and can take
24 hours to appear. See
[Campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links).

The campaign token is measurement metadata only. It must never authorize or
select the in-game grant; the redemption service remains the authority.

### 2. Add first-party funnel events

Record, by opaque campaign/test-arm identifier:

1. Redemption landing view or scan.
2. App Store call-to-action click.
3. Successful claim.
4. Optional first-party activation or retention milestones.

Join only aggregated campaign results unless a user-level join is necessary,
documented, and consistent with the privacy policy. App Store Connect can
report product-page views, downloads, usage, and campaign dimensions; see
[Measuring app performance](https://developer.apple.com/app-store/measuring-app-performance/)
and
[App Analytics filters and dimensions](https://developer.apple.com/help/app-store-connect/reference/app-analytics-filters-and-dimensions/).

### 3. Correct the QR quiet zone

The current minting script requests QR error-correction level Q, which is a
good choice for a sticker that may be scuffed. However, it sets `margin: 2`.
The QR specification requires a clear four-module margin on all four sides.
Change the print output to `margin: 4` before ordering stickers.

DENSO's QR guidance specifies the
[four-module quiet zone](https://www.qrcode.com/en/howto/code.html). Level Q
can restore approximately 25% of codewords, while level M restores
approximately 15%; see
[Error correction](https://www.qrcode.com/en/about/error_correction.html).
Error correction does not compensate for a missing quiet zone, distortion, or
art laid over functional modules; see
[Problems reading QR Codes](https://www.qrcode.com/en/howto/trouble.html).

### 4. Define abuse limits before scale

The existing implementation deliberately has no failed-attempt rate limiter.
That is acceptable for a small, low-value cosmetic pilot because the codes have
substantial entropy and grants are capped. Before using valuable rewards or
running at scale, add rate limiting and monitoring around unsuccessful
redemption attempts.

### 5. Keep the existing marketing risk gate

The roadmap already calls for a lawyer review before paid scale because the
game may appeal to children and includes reward mechanics. The sticker pilot
should remain inside that gate. Avoid copy that implies a purchase, chance,
cash value, or guaranteed scarcity unless those claims have been reviewed and
are operationally true.

## Creative Direction

The conversion-oriented sticker should sell the reward, not the QR technology.

Recommended hierarchy:

1. Rosie or the most recognizable pig artwork.
2. A concrete promise: **Scan to give Rosie the Golden Party Hat.**
3. A visible reward preview.
4. A large, high-contrast QR.
5. “Free iPhone game” and the fallback redemption code.
6. `ticklethepig.com` as a trust cue.

Avoid vague “mystery reward” language in the main acquisition treatment.
Curiosity can be an A/B variant, but a named reward gives the player a clearer
reason to act.

For the physical pilot:

- Preserve the four-module quiet zone.
- Do not place a logo or illustration over the QR modules.
- Export the QR as vector artwork where the printer supports it.
- Keep the code square; do not stretch or perspective-warp it.
- Start with a QR symbol around 1.25 inches including its quiet zone, then
  validate the actual material and viewing distance rather than treating that
  size as universal.
- Test several current and older iPhones under glare, low light, curvature,
  distance, fingerprints, and light scuffing.
- Test the final production proof, not only a desktop print.

## A/B Pilot

Create two visually matched arms and change only the lead message:

- **A — explicit value:** “Scan to give Rosie the Golden Party Hat.”
- **B — curiosity:** “Rosie left you something. Scan to find it.”

Each arm should have:

- Its own shared redemption code and internal campaign label.
- Its own Apple campaign token.
- The same item, artwork size, QR size, placement mix, quantity, dates, and
  distribution method.
- Random or alternating distribution across comparable locations.

Primary outcome:

`successful claims / stickers distributed`

Supporting funnel:

`scans → App Store clicks → first-time downloads → successful claims`

Use an equal small batch first as an operational pilot. Its purpose is to
verify scanning, attribution, handoff, and fraud assumptions. Do not declare a
creative winner from a handful of conversions; use the pilot baseline to size
the next test and predefine its decision rule.

## App Clip: A Later Upgrade

An App Clip is Apple's native option for making the pre-install experience
more seamless. A QR can invoke an App Clip with its URL, and the full app
replaces the App Clip after installation. App Groups can share a limited amount
of data between the App Clip and full app. See:

- [Configuring an App Clip launch experience](https://developer.apple.com/documentation/appclip/configuring-the-launch-experience-of-your-app-clip)
- [Encoding a URL in an App Clip Code](https://developer.apple.com/documentation/appclip/encoding-a-url-in-an-app-clip-code)
- [Configuring App Groups](https://developer.apple.com/documentation/xcode/configuring-app-groups)
- [App Clip analytics](https://developer.apple.com/help/app-store-connect-analytics/acquisition/app-clips/)

This could let a player inspect or reserve the reward before installing, but it
adds another native target, entitlements, invocation configuration, App Store
review surface, and lifecycle testing. It is not necessary to validate the
sticker channel. Reconsider it only if the initial funnel shows substantial
drop-off specifically between the landing page and post-install claim.

## Proposed Rollout

1. Choose one desirable, non-competitive cosmetic and name the campaign.
2. Update QR output to a four-module margin.
3. Add reward preview, copy-code/rescan instructions, Apple campaign links, and
   first-party landing events.
4. Mint two capped, expiring shared codes for the first A/B pilot.
5. Print a small proof run and complete real-device abuse and scan testing.
6. Run the equal-distribution operational pilot.
7. Compare scans, clicks, first-time downloads, and claims by arm.
8. Fix funnel failures, then size a proper creative test from the observed
   conversion rate.
9. Introduce hidden unique codes only for scarce collector promotions.

No database push, production deployment, paid campaign, or sticker order should
be part of the preparation step without its normal explicit approval.
