# RevenueCat — demo a subscription purchase

The **app code is ready**. The Me-page "Slop Club" card, paywall, restore, plan
toggle, and the RevenueCat adapter (`utils/iap.ts`) are all built; the iOS pods
(RevenueCat 5.70.0) ship in build-101. The only code gate was the kill switch,
now env-driven:

- `IAP_ENABLED` is `false` unless **`EXPO_PUBLIC_IAP_ENABLED=true`** at build time.

So a demo is purely **config** (RevenueCat dashboard + a store source + the
webhook). Two demo paths — pick one.

---

## What already exists (verified)
- `react-native-purchases` + `-ui` v10.1.0; native pods present in the build.
- `utils/iap.ts`: adapter with `presentPaywall`, `purchasePackage`, `restorePurchases`,
  `presentCustomerCenter`, entitlement `tickle_the_pig_pro`, product ids `monthly` /
  `yearly` / `season_pass`, sandbox API key default (override with `EXPO_PUBLIC_REVENUECAT_IOS_KEY`).
- `initIAP(userId)` is called on login (`app/(tabs)/_layout.tsx`).
- Me page (`components/Account.tsx`): the Slop Club card + `handleUnlockPro` →
  `presentPaywall`, `handleRestore`, `handleManage` — gated by `IAP_ENABLED`.
- Server webhook: `supabase/functions/revenuecat-webhook/` is the server-side
  entitlement writer (sets `is_vip`). `dev_set_vip` is locked down (revoke
  migrations 20260537–539); the webhook is the real grant path.

## What's NOT done yet (the demo gaps)
1. RevenueCat dashboard: iOS app, product→entitlement mapping, an Offering, a Paywall.
2. A store source for the products: **StoreKit config file** (fast, local) OR **App Store Connect** products (device/sandbox).
3. The real RevenueCat iOS public API key.
4. The webhook deployed + its URL set in the RC dashboard (so a purchase flips `is_vip` server-side).

---

## Path A — fastest local demo (Simulator, StoreKit Configuration)
No App Store Connect products needed; purchases are simulated in the sim.

1. **Xcode → New File → StoreKit Configuration File** (`ios/ttp/TickleThePig.storekit`).
   Add, with product IDs **exactly** matching `PRODUCT_IDS`:
   - Auto-Renewable Subscription group "Slop Club": `monthly` ($3.99 / P1M), `yearly` ($29.99 / P1Y).
   - Consumable: `season_pass` ($4.99).
2. **Xcode → Edit Scheme → Run → Options → StoreKit Configuration → select the file.**
3. **RevenueCat dashboard:** create the iOS app, map `monthly`/`yearly`/`season_pass`
   to entitlement `tickle_the_pig_pro`, create a default Offering with those packages,
   and design a Paywall on it. Put the iOS public key in `EXPO_PUBLIC_REVENUECAT_IOS_KEY`.
4. Build with `EXPO_PUBLIC_IAP_ENABLED=true` (and the RC key) →
   Me page shows Slop Club → **Unlock** opens the paywall → buy → simulated success.

> RevenueCat caveat: `getOfferings()` still reads the Offering structure from the
> RC dashboard, so step 3 is required even for the local path. If the offering
> can't load, the Me page falls back to a "storefront not configured — unlock
> free in dev?" alert (already coded), so the demo never hard-fails.

## Path B — device/sandbox demo (App Store Connect)
Most production-faithful; needed before any real launch anyway.
1. App Store Connect: sign Paid Apps Agreement + banking/tax; create the 3
   products (subs group + consumable) — they can demo while "Ready to Submit".
2. RevenueCat dashboard: paste the App-Specific Shared Secret; same
   product→entitlement→Offering→Paywall as above.
3. Create a **Sandbox Tester** (ASC → Users and Access → Sandbox).
4. `EXPO_PUBLIC_IAP_ENABLED=true` build on a device (or sim signed into the
   sandbox tester) → buy through the paywall.

---

## To make the purchase grant VIP server-side (full demo)
Deploy + wire the webhook so a sandbox purchase flips `is_vip`:
```
supabase functions deploy revenuecat-webhook --no-verify-jwt
```
Then in RevenueCat dashboard → Integrations → Webhooks, set the URL to
`https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`.
Without this, a purchase shows VIP **client-side only** (optimistic) — fine for
a visual demo, but server perks (the bigger tickle cap) won't apply until the
webhook lands.

## Note for after the demo
Before this ships for real, finish the subscription redesign: remove the VIP
2× regen pay-to-win (keep the cap as a convenience perk), wire the VIP battle
pass, and drop the dead client `dev_set_vip` calls. See `SKILL.md` decisions.
