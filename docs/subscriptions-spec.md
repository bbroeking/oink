# Spec — Subscriptions ("Tickle the Pig Pro")

Status: **decisions locked; system ~90% pre-built**. This spec is now
mostly a map of what already exists + the short list of what's left.

---

## 1. The big realization — Pro IS VIP

"Tickle the Pig Pro" is the **product / marketing name**. The server
flag is **`profiles.is_vip`**, added long ago in
`20260504010000_vip.sql`. A dormant, near-complete VIP subscription
system already exists. Pro does not need a second entitlement flag —
it *is* VIP.

(An earlier draft of this spec added a parallel `profiles.is_pro`
column; that was removed once VIP was found.)

---

## 2. The product

One entitlement (`tickle_the_pig_pro` in RevenueCat → `profiles.is_vip`
in Postgres), two packages:

| Package | Type | Price |
|---|---|---|
| `monthly` | auto-renewable sub | **$3.99/mo** |
| `yearly` | auto-renewable sub | **$19.99/yr** |

No `lifetime` — dropped. Subscriptions only. **Ongoing model**:
subscribe once → every season's premium track while active.

---

## 3. What Pro unlocks — and what's already built

| Perk | Built? | Where |
|---|---|---|
| **2× tickle regen** (1800s vs 3600s) | ✅ built | `vip.sql` — `tickle_info` / `tickle_balance` / `update_profile_and_item_count` all VIP-aware |
| **+25 tickle cap** (50 vs 25) | ✅ built | same |
| **Premium battle-pass track auto-unlock** | ✅ built | webhook calls `dev_unlock_premium` on activation |
| **Leaderboard star / profile badge** | ✅ built | `is_vip` rendered in `Account.tsx` |
| **5 daily ritual casts** (vs 3) | ✅ **new this cycle** | `send_blessing` / `send_curse` read `is_vip` |
| Season cosmetic exclusives (4 mid-tier items) | ⏳ blocked on art | wire once icon-gen runs |

The "more power" the player asked for is, almost entirely, **already
in the codebase** — it just needs the storefront switched on.

Finale crowns stay achievement-gated (top 3) — money never buys the
leaderboard.

---

## 4. The plumbing — already built

| Piece | State |
|---|---|
| RevenueCat SDK + `utils/iap.ts` (`isPro`, paywall, restore, Customer Center) | ✅ built, kill-switched |
| `IAP_ENABLED` master switch | `false` |
| `PAID_BATTLE_PASS_ENABLED` | `false` |
| Product ids `monthly` / `yearly` | declared (`lifetime` removed) |
| `profiles.is_vip` + `vip_until` | ✅ built (`vip.sql`) |
| **RevenueCat → Supabase webhook** (`supabase/functions/revenuecat-webhook`) | ✅ **already built** — maps `app_user_id`, flips `is_vip` + `vip_until` on activate/deactivate events, unlocks premium |
| `useProEntitlement()` hook | ✅ new this cycle — client RevenueCat check for UI gates |

---

## 5. Trust boundary

- **Gameplay perks that mint resources** — regen rate, tickle cap,
  ritual cap — all read **`profiles.is_vip`** server-side. ✅ correct.
- **Cosmetic / UI gates** — may read the client RevenueCat entitlement
  via `useProEntitlement()`; worst case is a sideloaded hat.
- The webhook is the only writer of `is_vip` (service role); no client
  path can grant it.

---

## 6. What's actually left to ship

1. **App Store Connect** — Paid Apps Agreement, banking/tax, create the
   `monthly` + `yearly` auto-renewable products in one Subscription Group.
2. **RevenueCat dashboard** — iOS app, shared secret, map both products
   to `tickle_the_pig_pro`, build the Offering + Paywall.
3. **Deploy the webhook** — `supabase functions deploy revenuecat-webhook
   --no-verify-jwt`; `supabase secrets set RC_WEBHOOK_AUTH_HEADER=…`;
   paste that token into the RevenueCat webhook config.
4. **Set** `EXPO_PUBLIC_REVENUECAT_IOS_KEY` to the production key.
5. **Wire the 4 mid-tier Season 1 cosmetics** onto the premium track
   (after icon-gen produces the art).
6. **Flip** `IAP_ENABLED` and `PAID_BATTLE_PASS_ENABLED` to `true`.
7. **Sandbox-test** both purchase paths + restore + cancel + the
   webhook activate/deactivate path.

Items 1-4, 6, 7 are configuration / ops — no app code. Item 5 is the
only remaining *code*, and it's blocked on art.

---

## 7. Decisions — all locked

| Decision | Value |
|---|---|
| Pricing | $3.99/mo, $19.99/yr — no lifetime |
| Model | Ongoing |
| Pro = VIP | Yes — one flag, `is_vip` |
| Pro unlocks | VIP perks + 5 ritual casts (§3) |
| `premium_plus` | Folded away — single paid tier |
| Free trial | 7-day intro — confirm at ASC setup |
| Regen multiplier | 2× (VIP's existing value — kept) |
