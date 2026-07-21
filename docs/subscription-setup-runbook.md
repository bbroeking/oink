# Subscription Setup — Runbook

> **⚠️ SUPERSEDED (2026-07-20).** This runbook is the pre-rebrand
> "Tickle the Pig Pro" checklist and its boxes are stale — the storefront
> went LIVE 2026-07-17 under the **Slop Club** branding. Verified state:
> ASC products (`monthly`/`yearly`/`season_pass`) staged with the 1.3
> review (`docs/appstore/iap-review-notes.md`), RevenueCat app + `appl_`
> key wired (`eas.json`), `revenuecat-webhook` edge function **deployed
> ACTIVE v3** with `RC_WEBHOOK_AUTH_HEADER` set 2026-07-18 (checked via
> `supabase functions list` / `secrets list`), sandbox purchases
> completing (`constants/featureFlags.ts` → `PURCHASES_LIVE`).
> The **current** setup doc is `docs/revenuecat-asc-setup.md`; product
> copy below (prices, leaderboard star) predates the redesign — don't
> paste it anywhere.

The do-this-now checklist for turning on "Tickle the Pig Pro".
Design rationale lives in `subscriptions-spec.md`; this file is the
step-by-step. Check boxes as you go.

**3 things to hand back to Claude when you have them:**
1. Final subscription **Product IDs** (Step 2)
2. RevenueCat **iOS public API key** — `appl_…` (Step 4)
3. Supabase **project ref** — the `xxxx` in `dashboard/project/xxxx` (Step 5)

---

## Step 1 — Apple agreements & banking ✅ DONE
🔗 https://appstoreconnect.apple.com/agreements
Paid Apps agreement is **Active**.

## Step 2 — Create the two subscription products  ⬜ IN PROGRESS
🔗 https://appstoreconnect.apple.com/apps → Tickle the Pig → **Subscriptions**

- ⬜ Subscription Group — Reference Name `Tickle the Pig Pro`
- ⬜ Monthly subscription (fields below)
- ⬜ Yearly subscription (fields below)
- ⬜ Both products show **"Ready to Submit"** (not "Missing Metadata")

Note: Apple's "first IAP must ship with an app version" message is
**expected** — ignore it. The products only need to reach "Ready to
Submit" for sandbox testing. The actual App Review submission happens
later, attached to build 62's version page.

### Monthly — paste these
| Field | Value |
|---|---|
| Reference Name | `Pro Monthly` |
| Product ID | `monthly` *(or prefixed if Apple forces it — record it)* |
| Duration | 1 Month |
| Price | $3.99 USD |

Display Name: `Tickle the Pig Pro`
Description:
> Faster tickle regen, double the cap, the full premium season pass, extra daily blessings, and a leaderboard star — billed monthly.

### Yearly — paste these
| Field | Value |
|---|---|
| Reference Name | `Pro Yearly` |
| Product ID | `yearly` |
| Duration | 1 Year |
| Price | $19.99 USD |

Display Name: `Tickle the Pig Pro`
Description:
> Everything in Pro — faster tickles, double cap, the premium season pass, extra daily rituals, leaderboard star — billed yearly, our best value.

### Review Notes (both products)
> Tickle the Pig Pro is an auto-renewable subscription that grants
> cosmetic and convenience benefits: 2x tickle-bank regeneration, a
> higher tickle cap, the premium battle-pass reward track, extra
> daily in-game "blessing/curse" actions, and a profile star. It does
> not gate core gameplay. To reach the offer in-app: open the Season
> tab and tap "Unlock Premium," or tap the Pro banner on the home
> screen. Monthly and yearly are the same entitlement at two prices.

### Review screenshot
- Spec: PNG/JPEG, **min 640×920 px**.
- Must show the paywall (where the subscription is offered).
- **Now:** the real paywall isn't built (`IAP_ENABLED` is false) →
  upload any current in-app screenshot as a placeholder to clear
  "Ready to Submit." Apple doesn't review it yet.
- **Before build 62 goes to review:** Claude flips IAP on in a dev
  build, you capture the real RevenueCat paywall, swap it in.
- (Optional) 7-day free trial: each subscription → Subscription
  Prices → Introductory Offers → Create → Free → 1 week.

## Step 3 — Sandbox tester  ⬜
🔗 https://appstoreconnect.apple.com/access/users → **Sandbox** tab
- ⬜ Add a sandbox Apple ID with a fresh email (used for test buys, no real money).

## Step 4 — RevenueCat  ⬜
🔗 https://app.revenuecat.com  ·  Apple setup guide:
🔗 https://www.revenuecat.com/docs/getting-started/installation/app-store-connect
- ⬜ Create Project → add iOS app
- ⬜ Connect App Store Connect (RC walks you through the IAP key)
- ⬜ Entitlement with identifier exactly `tickle_the_pig_pro`
- ⬜ Attach both products to that entitlement
- ⬜ Offering (id `default`) with both packages
- ⬜ Build a Paywall: https://www.revenuecat.com/docs/tools/paywalls
- ⬜ **Copy the iOS public API key (`appl_…`) → hand to Claude**

## Step 5 — Webhook (RevenueCat → Supabase)  ⬜
🔗 https://www.revenuecat.com/docs/integrations/webhooks
- ⬜ Generate a random secret string, keep it
- ⬜ RC → Integrations → Webhooks → New:
  - URL: `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`
  - Authorization header: `Bearer <your secret>`
- ⬜ **Hand Claude the Supabase project ref**

## Step 6 — Deploy the Edge function  ⬜
Function code already exists (`supabase/functions/revenuecat-webhook`).
From the project root:
```
supabase login           # if not already
supabase link --project-ref <ref>
supabase functions deploy revenuecat-webhook --no-verify-jwt
supabase secrets set RC_WEBHOOK_AUTH_HEADER=<same secret as Step 5>
```

## Step 7 — Wire the key + flip switches  ⬜ (Claude does this)
Once Claude has the API key + product IDs + project ref:
- set `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- fix `PRODUCT_IDS` in `utils/iap.ts` if Apple changed the IDs
- flip `IAP_ENABLED` + `PAID_BATTLE_PASS_ENABLED` → `true`

## Step 8 — Sandbox test  ⬜
🔗 https://www.revenuecat.com/docs/test-and-launch/sandbox
- ⬜ Device build, sign in with the sandbox tester
- ⬜ Buy monthly → RC shows the purchase
- ⬜ `profiles.is_vip` flips true → 2× regen + premium pass confirmed

---

## Production submission (later, with build 62)
When build 62 goes to App Review: open its version page → **In-App
Purchases and Subscriptions** section → add `monthly` + `yearly` →
submit them with the build. First IAPs must ride a version; after
that they submit independently.
