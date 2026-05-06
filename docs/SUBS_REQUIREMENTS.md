# What's needed to actually take subscription / IAP money

Current state: the **code wiring is complete**, the **infra setup is not**. You can flip the bits below and start charging cards.

---

## Code already done

- `utils/iap.ts` — RevenueCat client, `purchaseProductId`, `hasPremium`, `hasPremiumPlus`, `hasVIP`, `restorePurchases`.
- `app/(tabs)/season.tsx` — `handleUnlockPremium` calls the RC purchase flow, then mirrors the entitlement to `profiles.premium_unlocked` via `dev_unlock_premium` RPC.
- `components/Account.tsx` — `handleSubscribe` for VIP monthly/yearly with the same pattern.
- Fallback path: if RC says `product_not_found` (i.e. not configured), an Alert offers a dev-only unlock so you can keep testing.
- Supabase migrations: `is_vip` on profiles, `premium_unlocked` on season state, `dev_set_vip` / `dev_unlock_premium` RPCs.

## Infra setup — these are the gates

In rough order of how Apple processes them. Each is a one-time thing.

### 1. Apple Paid Apps Agreement
- App Store Connect → **Agreements, Tax, and Banking**
- Sign **Paid Applications** agreement (free apps don't need this, paid IAP does)
- Provide bank info + tax forms (W-9 for US)
- Status: **PENDING** until forms are accepted (24-48h)

### 2. Create products in App Store Connect

App Store Connect → your app → **Monetization → Subscriptions** + **In-App Purchases**.

**Non-renewing (one-time unlocks):**
| Product ID | Type | Price |
|---|---|---|
| `snout_premium` | Non-Consumable | $2.99 |
| `snout_premium_plus` | Non-Consumable | $9.99 |

**Auto-renewable subscriptions** (need a Subscription Group, e.g. "Snout VIP"):
| Product ID | Duration | Price |
|---|---|---|
| `snout_vip_monthly` | 1 month | $4.99 |
| `snout_vip_yearly` | 1 year | $39.99 |

**Consumables** (currency packs):
| Product ID | Type | Price |
|---|---|---|
| `tickle_bundle_100` | Consumable | $0.99 |
| `tickle_bundle_600` | Consumable | $4.99 |
| `tickle_bundle_1500` | Consumable | $9.99 |

Each product needs:
- Display name + description (shown in App Store)
- Localizations
- Review screenshot
- Status: "Ready to Submit" (don't need to actually submit until you're shipping)

### 3. RevenueCat

- Sign up: https://app.revenuecat.com (free tier handles up to $10k MTR)
- Create a project for "Tickle the Pig"
- Add iOS app — paste in the **App-Specific Shared Secret** from App Store Connect → app → App Information → App-Specific Shared Secret
- Map products → entitlements:
  - `snout_premium` → entitlement `premium_pass`
  - `snout_premium_plus` → entitlement `premium_pass_plus`
  - `snout_vip_monthly` + `snout_vip_yearly` → entitlement `vip` (both grant the same entitlement)
- Optional but recommended: webhook to your Supabase server for purchase/refund events so the DB stays in sync without polling.
- Copy the **public iOS API key** and paste into `utils/iap.ts:31` replacing `appl_REPLACE_ME_WITH_REVENUECAT_PUBLIC_KEY`.

### 4. Sandbox testing

App Store Connect → **Users and Access → Sandbox Testers** — create a fake Apple ID. On the simulator: Settings → App Store → sign out of your real account, sign in with the sandbox tester. Purchases will go through RC + ASC with no actual charge.

You can also use **StoreKit Configuration files** in Xcode for offline simulation — `ios/ttp/Configuration.storekit` if it doesn't exist; create one with the same product IDs. Then in the scheme editor, set "StoreKit Configuration" to that file. No internet needed for purchase testing.

### 5. Apple-required UX (these are gating for App Store review)

These are NOT in the code yet:

- [ ] **"Restore purchases" button** — required by Apple. Add to Account screen. Calls `restorePurchases()` from `utils/iap.ts`.
- [ ] **Auto-renew disclosure** — for the VIP subscription, the purchase screen MUST display:
  - Subscription length (1 month / 1 year)
  - Price + auto-renew terms (renews unless cancelled 24h before period end)
  - Link to Privacy Policy
  - Link to Terms of Service / EULA
  - "Manage subscription" link (we have this — `Linking.openURL("https://apps.apple.com/account/subscriptions")`)
- [ ] **Privacy Policy page** — must be hosted at a public URL and linked from App Store metadata. Required for any account/subscription. We have `legal/` files locally — host them.
- [ ] **EULA / Terms** — Apple has a default EULA you can use, OR provide your own.
- [ ] **In-app purchase price localization** — RC handles this, but verify the displayed price uses `pkg.product.priceString` (not a hardcoded string). The current code shows `$2.99` hardcoded — fix to use the live offering price.

### 6. Server-side receipt validation (recommended, not strictly required)

Right now we trust the client (`hasPremium()` → `dev_unlock_premium` RPC). A determined user could spoof the entitlement check.

Better: configure the RevenueCat → Supabase webhook so when someone buys, RC POSTs to a Supabase Edge Function that validates the receipt and writes `premium_unlocked` directly to the DB. That way the source of truth is the server, not the client.

Order of priority: not blocking. Ship as-is, monitor for fraud, lock down later if it's an issue.

---

## Concrete next-step checklist (in order)

- [ ] Sign Paid Apps Agreement in ASC
- [ ] Add banking + tax info
- [ ] Create the 7 products in ASC
- [ ] Sign up for RevenueCat
- [ ] Map products → entitlements in RC
- [ ] Replace `REVENUECAT_IOS_API_KEY` in `utils/iap.ts:31`
- [ ] Create a sandbox tester in ASC
- [ ] **In code**: add Restore Purchases button to Account screen
- [ ] **In code**: replace hardcoded prices with `pkg.product.priceString`
- [ ] **In code**: add subscription terms + EULA + Privacy Policy links to the VIP card before the purchase buttons
- [ ] **In code**: optionally surface a small "manage / cancel" link if the user is currently a VIP subscriber
- [ ] Host privacy policy + terms publicly
- [ ] (Later) Wire RC webhook → Supabase Edge Function for receipt validation

Once #1-6 are done you can charge real cards. Items 7-9 are the App Store review gates.

## How to find each thing

- ASC home: https://appstoreconnect.apple.com
- ASC app: https://appstoreconnect.apple.com/apps/6740339848
- ASC IAP: https://appstoreconnect.apple.com/apps/6740339848/distribution/inApp
- RC dashboard: https://app.revenuecat.com
- Sandbox testers: https://appstoreconnect.apple.com/access/users/sandbox
