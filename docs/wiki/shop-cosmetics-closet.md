---
title: Shop, Cosmetics & Closet
aliases: [shop, closet, cosmetics, hats, wardrobe, loadout]
tags: [system, cosmetics, economy, progression]
status: stable
sources:
  - code: constants/hats.ts
  - code: constants/slots.ts
  - code: constants/theme.ts
  - code: components/ClosetView.tsx
  - code: app/(tabs)/shop.tsx
  - sql: supabase/migrations/20260584000000_daily_shop_exclude_free.sql
  - sql: supabase/migrations/20260544000000_season_pass_missing_hats.sql
  - sql: supabase/migrations/20260519010000_shop_titles.sql
  - sql: supabase/migrations/20260502030000_shop_catalog.sql
last_compiled: 2026-06-13
---

# Shop, Cosmetics & Closet

The cosmetic economy: a daily-rotating shop sells hats/items for snouts, a typed-slot Closet dresses up Rosie the pig, and a Titles tab sells name decorations. The Shop tab has four views — Today, Browse, Titles, Closet (`app/(tabs)/shop.tsx`).

## How it works

**Items.** Every cosmetic is a `hats` catalog row (`HatRow` in `constants/hats.ts`) with a `category`, `rarity`, `cost`, and either a per-id PNG in `HAT_IMAGES` or an `emoji` fallback. Categories span hats, bows, glasses, masks, scarves, auras, held items, backgrounds, flags, and tickle particles. `scarf`/`cape`/`necklace` are in `HIDDEN_CATEGORIES` — their front-only art breaks on the leaning pig, so they're filtered out of shop + closet.

**Typed slots.** `constants/slots.ts` maps each category to an `EquipSlotKey` (head, face, neck, held, tickle, aura, background, flag). Slots at different body anchors stack; categories sharing a region share one slot. Glasses + masks share the player-facing **Face** chip but persist to separate `profiles` columns (`columnForCategory` routes the write). The **held** slot tracks `hand_r` so the pig can hold a wand/sword/coffee. Each slot persists to its own `profiles.active_*_id` column (`SLOT_COLUMN`).

**Rarities.** Five tiers (common→legendary). `RARITY_GRADIENT` drives the Shop card LinearGradient backgrounds; `RARITY_BG_SOLID` is the light-end shorthand for solid surfaces; `RARITY_COLORS` is the dot/accent color — all in `constants/theme.ts`, one source of truth so surfaces can't drift.

**Daily shop RNG.** `daily_shop()` deterministically picks 5 items the player doesn't own, ranked by `abs(hashtext(id || current_date))` — same drop for everyone, reshuffled at UTC midnight (`shop_resets_in_seconds()`). Cost-0 items (season-pass / referral exclusives) and `cape`/`flag` are excluded (`supabase/migrations/20260584000000_daily_shop_exclude_free.sql`). `buy_hat()` validates ownership/funds server-side, returning reasons like `insufficient` / `already_owned` / `not_for_sale`; the "today only" restriction is enforced client-side in `handleBuy`.

**Closet / loadout.** `components/ClosetView.tsx` is the fitting room: a live `PigStage` preview, slot chips (only for owned/worn slots), by-category grids, and a title nameplate. Tap to equip (writes the column), tap ✕ to remove.

**Titles.** `shop_titles()` / `buy_title()` (`supabase/migrations/20260519010000_shop_titles.sql`) sell pre/post name decorations; buying happens in the Titles tab, equipping in the Closet (`active_title_id`).

## Key files
- `constants/hats.ts` — `HatRow`/catalog types, `HAT_IMAGES`, per-anchor overlays, `RARITY_COLORS`, `HIDDEN_CATEGORIES`.
- `constants/slots.ts` — category→slot→column mapping, the typed-slot loadout model.
- `constants/theme.ts` — `RARITY_GRADIENT`/`RARITY_BG_SOLID`/`RARITY_COLORS` + design tokens.
- `components/ClosetView.tsx` — the dress-up fitting room (preview, slot chips, equip).
- `app/(tabs)/shop.tsx` — four-view Shop (Today/Browse/Titles/Closet), buy/equip handlers.
- `supabase/migrations/20260584000000_daily_shop_exclude_free.sql` — daily RNG rotation.
- `supabase/migrations/20260544000000_season_pass_missing_hats.sql` — `buy_hat()` purchase logic.

## Connects to
- [[snouts-economy]] — items + titles are priced in and spent from snouts.
- [[design-system]] — rarity tokens, sticker shadows, and fonts come from the design tokens.
- [[battle-pass-and-slop-club]] — cost-0 catalog rows are pass-exclusive rewards, kept out of the shop.
- [[referral-program]] — the `messenger` hat is a referral-milestone grant, not for sale.
- [[world-cup-allegiance]] — `flag_*` cosmetics + soccer backgrounds are granted by the allegiance pick.
- [[achievements-and-titles]] — Titles tab + Closet nameplate share the same title model.
- [[trough]] — the Trough top-up surfaces inline in the Today view / preview to refill snouts.
- [[barn-and-habitat]] — backgrounds equipped here set the barn backdrop; default `homestead_barn`.
- [[identity-model]] — equipped cosmetics + title decorate the pig/handle shown to others.

## Open questions / risks
- `buy_hat()` is not verified to gate on today's drop server-side; the "Today only" guard lives only in `handleBuy` (`app/(tabs)/shop.tsx`). A stale/forged client could attempt to buy a non-rotation item — worth confirming the RPC doesn't allow it.
- `EquipSlotKey` still carries a legacy `eyes` slot merged into `face`; back-compat readers may diverge.
- Daily RNG is per-UTC-day and excludes owned items, so a near-complete collector sees a thinning shop — no fallback handling noted.
