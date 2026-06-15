---
title: Battle Pass & Slop Club (Pro)
aliases: [season-pass, slop-club, tickle-the-pig-pro, vip, battle-pass]
tags: [system, monetization, economy, season, iap]
status: draft
sources:
  - doc: docs/pass-and-slop-club-spec.md
  - doc: docs/subscriptions-spec.md
  - doc: docs/SUBS_REQUIREMENTS.md
  - code: utils/iap.ts
  - code: app/(tabs)/season.tsx
last_compiled: 2026-06-13
---

# Battle Pass & Slop Club (Pro)

The game's two monetization products: a **Season Pass** (one-time, per-season unlock of the premium reward track) and **Slop Club** (a recurring "Pro" subscription granting quality-of-life perks). Both are currently kill-switched off (`docs/pass-and-slop-club-spec.md`, `utils/iap.ts:47`).

## How it works

**Battle pass tracks.** Each season has a tier ladder with a `free` and a `premium` track; tiers carry typed jsonb rewards (`reward_type` / `reward_value`) and players advance by earning XP per tier (`app/(tabs)/season.tsx:59-99`). Rewards are **claimed** tier-by-tier from the snaking track UI; claims are recorded server-side (`ClaimRow`, `season.tsx:86-99`). The premium track is gated: per the locked spec it unlocks via a per-season `season_passes` entitlement (`has_season_pass`), replacing the old auto-claim-on-VIP path (`docs/pass-and-slop-club-spec.md`). The live `season.tsx` still mirrors entitlement to `profiles.premium_unlocked` via the `dev_unlock_premium` RPC (`season.tsx:1127-1177`), gated behind `PAID_BATTLE_PASS_ENABLED = false` (`season.tsx:52`).

**Slop Club / Pro.** A subscription mapped to the server flag `profiles.is_vip` (the product was renamed from "Tickle the Pig Pro" to "Slop Club"; the column name stays for migration safety — `docs/subscriptions-spec.md §1`, `docs/pass-and-slop-club-spec.md`). Perks read `is_vip` server-side: **2× tickle regen** (1800s vs 3600s), **higher cap** (50 vs 25), **5 ritual casts** vs 3, plus a planned **monthly snout stipend** (`claim_slop_stipend`, idempotent per calendar month — `docs/subscriptions-spec.md §3`, `docs/pass-and-slop-club-spec.md`).

**IAP adapter pair.** `utils/iap.ts` exposes one `IAP` interface with two implementations at a single seam: `realIAP` (RevenueCat) and `noopIAP` (every call resolves cancelled/empty). `const iap = IAP_ENABLED ? realIAP : noopIAP` selects at load; entitlement is `ENTITLEMENT_PRO = "tickle_the_pig_pro"` (`utils/iap.ts:62,93-296`). The RevenueCat→Supabase webhook is the only writer of `is_vip` (`docs/subscriptions-spec.md §4-5`).

## Key files

- `utils/iap.ts` — RevenueCat client, `IAP_ENABLED` kill-switch, realIAP/noopIAP adapter pair, product IDs.
- `app/(tabs)/season.tsx` — battle pass UI: tier ladder, free/premium tracks, claim flow, `PAID_BATTLE_PASS_ENABLED` gate.
- `components/BattlePassSaleModal.tsx` — Season Pass buy prompt (formerly "Premium/Premium Plus").
- `docs/pass-and-slop-club-spec.md` — the locked two-product split (Season Pass + Slop Club).
- `docs/subscriptions-spec.md` — Pro = VIP mapping and perk inventory.
- `docs/SUBS_REQUIREMENTS.md` — ops/infra checklist + Apple review gates.

## Connects to

- [[seasons-and-judgement-day]] — the pass is scoped per season; tracks reset and re-buy each season.
- [[regen]] — Slop Club's 2× regen and higher cap read `is_vip`.
- [[blessings-curses-effects]] — Pro raises the daily ritual cast cap (5 vs 3).
- [[snouts-economy]] — the monthly snout stipend mints currency for members.
- [[shop-cosmetics-closet]] — premium-track rewards include season cosmetic exclusives.
- [[architecture-seams]] — the realIAP/noopIAP kill-switch is a textbook adapter seam.
- [[achievements-and-titles]] — finale crowns stay achievement-gated; money never buys the leaderboard.

## Open questions / risks

- **Conflicting price specs (unreconciled).** `subscriptions-spec.md` says **$3.99/mo, $19.99/yr, no lifetime**; `pass-and-slop-club-spec.md` says **$3.99/mo or $29.99/yr** + Season Pass $4.99; `SUBS_REQUIREMENTS.md` lists yet another set (`snout_vip_monthly` $4.99, `snout_vip_yearly` $39.99, plus non-renewing `snout_premium`/`snout_premium_plus` and currency packs). `utils/iap.ts:9` comments **$29.99/yr, $3.99/mo**. Treat iap.ts + pass-and-slop-club-spec as newest; the rest are stale. **Status: draft** until one source of truth is picked.
- **Product-ID drift.** `iap.ts` uses `yearly`/`monthly`/`season_pass`; `SUBS_REQUIREMENTS.md` uses `snout_vip_*`/`snout_premium*`. Confirm what's actually configured in App Store Connect / RevenueCat.
- **Live code vs spec gap.** `season.tsx` still gates premium on `premium_unlocked` + `dev_unlock_premium`, not the spec'd `has_season_pass` / `season_passes` table — entitlement migration appears unbuilt.
- Everything is off: `IAP_ENABLED` and `PAID_BATTLE_PASS_ENABLED` are both `false`; nothing charges until ASC/RevenueCat ops land (`docs/SUBS_REQUIREMENTS.md`).
