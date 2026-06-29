# RevenueCat + App Store Connect setup — to a real TestFlight purchase

Goal: turn the "Storefront not configured" dev fallback into a real, testable
purchase. The app code is already wired — these are the dashboard steps (yours;
they can't be done from code). The exact identifiers the app expects are in
`utils/iap.ts` and listed below — **they must match exactly.**

| Thing | Identifier (must match) |
|---|---|
| Entitlement | `tickle_the_pig_pro` |
| Monthly sub product id | `monthly` |
| Yearly sub product id | `yearly` |
| Season Pass product id | `season_pass` |
| Slop Club offering id | `slop_club` |
| Season Pass offering id | `season_pass` |

Plan selection (monthly/yearly) **and** the purchase happen in **RevenueCat's
hosted paywall** (`presentPaywall`) — our card just has a "Join the Slop Club"
button. So you need **ASC products + an RC Offering + a Paywall designed on the
`slop_club` offering** (that's where the monthly vs yearly choice lives).

---

## 1. App Store Connect — products
1. **Agreements** → sign the **Paid Apps Agreement**; add **banking + tax** info. (IAP won't work until this is done.)
2. **Your app → Subscriptions** → create a **Subscription Group** (e.g. "Slop Club"). Add two auto-renewable subscriptions in it:
   - Product ID **`monthly`** — duration 1 month — set the price (this is also where you change price later).
   - Product ID **`yearly`** — duration 1 year — set the price.
   - Fill the required localization (display name, description) + a review screenshot, or they stay "Missing Metadata" and won't be purchasable in sandbox.
3. **Your app → In-App Purchases** → create a **Consumable**:
   - Product ID **`season_pass`** — set the price (~$4.99). (Consumable, because it's re-bought each season; the per-season scoping is server-side via `grant_season_pass`.)
4. Note the **App-Specific Shared Secret** (App → Subscriptions → top) and create an **In-App Purchase Key** (Users and Access → Integrations → In-App Purchase) — you'll paste both into RevenueCat. *Each key downloads only once.*

## 2. RevenueCat dashboard
1. Create the **iOS app** in your RC project; paste the **App-Specific Shared Secret** and upload the **In-App Purchase Key**.
2. **Products**: import/add `monthly`, `yearly`, `season_pass`.
3. **Entitlement** `tickle_the_pig_pro`: attach **`monthly`**, **`yearly`** (and, if you want the one-time pass to also flip `is_vip`, attach `season_pass` — but see note below).
4. **Offerings**:
   - `slop_club` → add packages for **`monthly`** + **`yearly`**.
   - `season_pass` → add a package for **`season_pass`**.
5. **Paywall** (Tools → Paywalls): design a paywall on the **`slop_club`** offering showing the monthly + yearly packages — this is the screen players see when they tap "Join the Slop Club" (`presentPaywall`). Without it, `presentPaywall` has nothing to show and you get the "Storefront not configured" fallback.
6. **Webhook**: point RevenueCat → Integrations → Webhooks at the deployed edge function URL (`.../functions/v1/revenuecat-webhook`). This is what flips `is_vip` server-side on purchase/expiration. Deploy it first: `supabase functions deploy revenuecat-webhook`.
7. Get the **public iOS API key** (Project → API keys) → set it at build time as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (or replace the default in `utils/iap.ts`).

> Note on `season_pass` + the entitlement: the **subscription** should grant
> `tickle_the_pig_pro`. The **one-time Season Pass** unlocks the premium *track*
> via `grant_season_pass`, NOT the subscription entitlement — so do NOT map
> `season_pass` to `tickle_the_pig_pro` unless you want a one-time pass buyer to
> get full Slop Club. (Slop Club already *includes* the season pass via
> `season_state`/`claim_tier_reward` honoring `is_vip` — migration 20260686.)

## 3. Build
- Build with **`EXPO_PUBLIC_IAP_ENABLED=true`** (and `EXPO_PUBLIC_REVENUECAT_IOS_KEY` if not hardcoded). Local: `eas build --local --platform ios --profile production`.

## 4. Test on TestFlight (sandbox)
- TestFlight runs IAP against Apple's **StoreKit sandbox** — real flow, no real charge.
- Create a **Sandbox Tester** (ASC → Users and Access → Sandbox) and sign into it on the device (Settings → App Store → Sandbox Account on newer iOS, or when prompted at purchase).
- Buy monthly/yearly from the Slop Club card → the purchase sheet appears → confirm. **Sandbox renewals are accelerated** (a "1 month" sub renews ~every 5 min, then expires after ~6 cycles) so you can watch buy → renew → expire fast.
- Verify the **webhook** fired (RC dashboard → customer → events) and `profiles.is_vip` flipped true → the Slop Club card shows the member state, and the Season tab premium track unlocks.
- ⚠️ The local `ios/ttp/TickleThePig.storekit` file is **simulator/Xcode only** — TestFlight ignores it and uses the real ASC sandbox, so the ASC products MUST exist.

## Common gotchas
- Products show as "product_not_found" (our dev fallback) until ASC metadata is complete AND RC has imported them AND ~hours of propagation.
- Sandbox subs can take a few minutes; metadata changes can lag up to ~1h.
- If `is_vip` never flips after a sandbox purchase, the webhook isn't wired or the edge function isn't deployed.
