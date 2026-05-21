# Spec — Subscriptions ("Tickle the Pig Pro")

Status: **decisions locked** (2026-05-20). The plumbing exists and is
switched off; this spec defines the product, what it unlocks, how it
gates content, and the build order.

---

## 1. What already exists

A fair amount — `utils/iap.ts` is built, just kill-switched.

| Piece | State |
|---|---|
| RevenueCat SDK (`react-native-purchases` + `-ui`) | wired |
| `IAP_ENABLED` master kill switch | **`false`** |
| `PAID_BATTLE_PASS_ENABLED` (season.tsx) | **`false`** |
| Product ids: `lifetime`, `yearly`, `monthly` | declared in `PRODUCT_IDS` |
| Entitlement `tickle_the_pig_pro` | declared (`ENTITLEMENT_PRO`) |
| Paywall, Customer Center, restore, purchase helpers | implemented, no-op while disabled |
| Battle-pass free vs premium tracks | schema + UI exist (`track: 'free' | 'premium'`, `premium_unlocked`) |
| `BattlePassSaleModal` | exists |

So this spec is mostly **decisions + wiring**, not greenfield.

---

## 2. The product

**"Tickle the Pig Pro"** — one entitlement, two ways to buy it:

| Package | Type | Price | Intent |
|---|---|---|---|
| `monthly` | auto-renewable sub | **$3.99/mo** | low-commitment entry |
| `yearly` | auto-renewable sub | **$19.99/yr** | the headline value option (≈58% off monthly) |

**No `lifetime` product** — dropped (decision, 2026-05-20). Pro is a
subscription only.

Both packages grant the **same `tickle_the_pig_pro` entitlement**. The
app never checks *which* package — only "does the caller have Pro."
Gating is a single boolean.

**Model — LOCKED: ongoing.** Pro is an *account-level ongoing*
benefit, NOT a per-season battle-pass purchase. Subscribe once → the
premium track of *every* season is yours while active.

This retires the old per-season purchase model: `premium_plus` (the
schema's third tier — `premium_plus_price_cents`, `BattlePassSaleModal`'s
"Unlock Plus") is **folded away**. There is one paid tier — Pro. The
`premium_plus_*` columns stay in the schema (harmless) but are unused;
`BattlePassSaleModal` is superseded by the RevenueCat paywall.

---

## 3. What Pro unlocks — "more power in the battle pass"

The free experience stays complete and fun. Pro adds:

1. **The premium battle-pass track** — every tier already has a
   `free` and `premium` reward; Pro unlocks the `premium` side for
   the whole season. This is the core of it.
2. **Season cosmetic exclusives** — of the 10 Season 1 items, the
   four mid-tier ones (`angel_wings`, `holy_radiance`, `goblin_ears`,
   `goblin_crown`) sit on the premium track. Free players still earn
   `daisy_crown` / `angel_halo` / `gold_tooth` / `coin_monocle` via
   alignment; Pro players also get the showier ones.
3. **A gameplay perk — faster tickle regen.** Pro raises the bank
   regen rate (e.g. 1.5×). This is the "more power" — it compounds
   into everything (more to tickle, more to give, more to trade).
4. **Extra daily ritual casts** — 5 blessings/curses per day instead
   of 3.
5. **A Pro-only title** ("Patron") + a subtle Pro badge on the
   profile.
6. **Finale exclusives** stay achievement-gated (top 3), NOT
   Pro-gated — money shouldn't buy the leaderboard crown.

The split keeps it ethical: Pro buys *cosmetics + convenience + a
mild boost*, never the competitive finale rewards and never anything
that lets you curse-grief harder.

---

## 4. Entitlement gating

One source of truth. `utils/iap.ts` already exposes the customer
info; add a single `useProEntitlement()` hook:

```
useProEntitlement() → { isPro: boolean, loading: boolean }
```

backed by RevenueCat `CustomerInfo.entitlements.active[ENTITLEMENT_PRO]`.
Every gate is then `if (isPro)`:

- season.tsx — `premium_unlocked = isPro`; premium TierStones claimable.
- The regen-rate RPC reads a server-side Pro flag (see §5).
- RitualPicker daily cap: `isPro ? 5 : 3`.

**Server side:** RevenueCat can webhook entitlement changes to a
Supabase Edge function that sets `profiles.is_pro`. Gameplay perks
that must not be client-spoofable (regen rate, ritual cap) check
`profiles.is_pro`; purely cosmetic gates can trust the client.

---

## 5. Server trust boundary

- **Cosmetic unlocks** (premium track items) — client-gated is fine;
  worst case someone sideloads a hat.
- **Gameplay perks** (regen multiplier, ritual cap) — MUST be
  server-enforced. Add `profiles.is_pro boolean`, set it from a
  RevenueCat webhook → Supabase Edge function. The regen RPC and
  `send_blessing`/`send_curse` cap read that column.
- Never trust a client-passed "I'm Pro" flag for anything that mints
  resources.

---

## 6. Activation checklist

Mostly already documented in the `utils/iap.ts` header. In order:

1. App Store Connect — sign Paid Apps Agreement, add banking + tax.
2. ASC — create the 3 products (`lifetime` non-consumable; `yearly`
   + `monthly` auto-renewable in one Subscription Group).
3. RevenueCat — create the iOS app, paste the ASC shared secret,
   map all 3 products to `tickle_the_pig_pro`, build the default
   Offering + a Paywall.
4. Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` to the production key.
5. Build the RevenueCat → Supabase webhook + `profiles.is_pro`.
6. Flip `IAP_ENABLED` and `PAID_BATTLE_PASS_ENABLED` to `true`.
7. Sandbox-test all 3 purchase paths + restore + cancel.

---

## 7. Decisions

| # | Decision | Status |
|---|---|---|
| Pricing | $3.99/mo, $19.99/yr — no lifetime | ✅ locked |
| Model | Ongoing (subscribe → every season's premium track) | ✅ locked |
| Pro unlocks | §3 proposal accepted as-is | ✅ locked |
| `premium_plus` | Folded away — Pro is the single paid tier | ✅ locked |
| Regen multiplier | 1.5× (tune in playtest) | provisional |
| Free trial | 7-day intro on both packages | recommend yes — confirm at ASC setup |
| Premium-track items | The 4 mid-tier (angel_wings, holy_radiance, goblin_ears, goblin_crown) | ✅ locked (§3) |

---

## 8. Build order (once decisions land)

1. `profiles.is_pro` column + RevenueCat webhook Edge function.
2. `useProEntitlement()` hook.
3. Gate the battle-pass premium track on it (season.tsx).
4. Server-side perks: regen-rate RPC + ritual-cap read `is_pro`.
5. Pro title + profile badge.
6. Wire `BattlePassSaleModal` / paywall entry points.
7. Flip the kill switches, sandbox-test, ship.
