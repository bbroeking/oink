---
title: Snouts Economy
aliases: [snouts, currency, counter, soft-currency]
tags: [economy, currency, monetization, leaderboard]
status: stable
sources:
  - code: app/(tabs)/shop.tsx
  - code: utils/iap.ts
  - code: hooks/useStipend.ts
  - sql: supabase/migrations/20260501210000_hats_shop.sql
  - sql: supabase/migrations/20260519010000_shop_titles.sql
  - sql: supabase/migrations/20260527000000_trade_economy_flip.sql
  - sql: supabase/migrations/20260535000000_season_pass_and_slop_club.sql
  - sql: supabase/migrations/20260646000000_visit_tickles_to_leaderboard.sql
  - sql: supabase/migrations/20260628000000_trough_reward_to_leaderboard.sql
  - sql: supabase/migrations/20260647000000_mud_fights.sql
  - sql: supabase/migrations/20260519020000_lucky_pig.sql
  - doc: docs/BONUS_SPEC.md
  - doc: docs/trough-pool-spec.md
last_compiled: 2026-06-13
---

# Snouts Economy

Snouts are TTP's single soft currency, stored as the integer `profiles.counter`. They are the cosmetic spendable: earned through play, drained almost entirely by Shop purchases. A parallel column, `profiles.tickles_earned`, is the lifetime score the leaderboard ranks by — it never decreases, so spending snouts never costs you rank.

## How it works

There is **one** balance, `profiles.counter`, shown as the snout-coin chip in the Shop header (`app/(tabs)/shop.tsx` ~line 1097). Two columns split what used to be one (`docs/BONUS_SPEC.md`): `counter` is the spendable wallet; `tickles_earned` is the lifetime leaderboard sort and only ever goes up.

**Faucets.** Most earn-events credit *both* columns by the same amount, so each snout earned also banks a point of rank:
- Trades pay the receiver `amount * 2` to both columns (`20260527000000_trade_economy_flip.sql` ~line 67).
- Lucky Pig adds `+1` to both (`20260519020000_lucky_pig.sql`); the daily Lucky-Tickle bonus adds `+5` (`docs/BONUS_SPEC.md`). See [[lucky-pig]].
- Barn visits credit the host's leaderboard *and* bank (`20260646000000_visit_tickles_to_leaderboard.sql` ~line 68).
- Trough donor rewards convert at 2:1, paid to both columns (`20260628000000_trough_reward_to_leaderboard.sql`).
- Mud-fight payouts credit both (`20260647000000_mud_fights.sql` ~line 639).
- The **Slop Club stipend is the exception**: `claim_slop_stipend()` adds 250 to `counter` only — wallet, not score (`20260535000000_season_pass_and_slop_club.sql` ~line 91).

**Sinks.** Effectively one: cosmetics. `buy_hat` (`20260501210000_hats_shop.sql` ~line 77) and `buy_title` (`20260519010000_shop_titles.sql` ~line 117) atomically debit `counter`; both leave `tickles_earned` untouched. Each is a **one-time** purchase per item — there is no consumable or recurring snout drain.

Real money (RevenueCat IAP) buys the Season Pass + Slop Club, **not** snouts directly (`utils/iap.ts`); snouts stay an earn-only soft currency. Note `IAP_ENABLED = false` today.

## Key files

- `app/(tabs)/shop.tsx` — the only snout-spend UI; renders the balance chip, calls `buy_hat` / `buy_title`.
- `hooks/useStipend.ts` — claims the monthly Slop Club snout stipend (counter-only faucet).
- `utils/iap.ts` — RevenueCat seam; sells passes/membership, never snouts.
- `supabase/migrations/20260501210000_hats_shop.sql` — `buy_hat`, the primary sink.
- `supabase/migrations/20260519010000_shop_titles.sql` — `buy_title`, the secondary sink.
- `docs/BONUS_SPEC.md` — the counter / tickles_earned split + Lucky-Tickle faucet.

## Connects to

- [[core-loop-and-tickle-trade]] — trades are the largest snout faucet (2N to both columns).
- [[shop-cosmetics-closet]] — the only place snouts are spent (`buy_hat` / `buy_title`).
- [[trough]] — donor rewards convert spent snouts into snouts+score at 2:1.
- [[lucky-pig]] — random and daily-lucky bonuses are pure snout/score faucets.
- [[barn-visiting]] — visiting credits the host's wallet + leaderboard.
- [[sounder-mud-fights]] — winners' payouts credit both columns.
- [[battle-pass-and-slop-club]] — the Slop Club stipend is the one counter-only faucet; IAP funds it.
- [[seasons-and-judgement-day]] — `tickles_earned` is the season-ranked score snouts shadow.
- [[achievements-and-titles]] — titles are a snout sink and an earnable.

## Open questions / risks

- **Inflation / no real sink.** Faucets are many and several pay *both* wallet and score; the only drains are one-time cosmetic buys. Once a player owns the items they want, snouts accumulate unbounded with nothing to spend them on. No recurring or consumable sink exists in the surveyed sources.
- **`counter` is a misnomer.** `docs/BONUS_SPEC.md` keeps the name "counter" for the spendable wallet to avoid a ~10-RPC rename; new readers may confuse it with the leaderboard.
- **Stipend asymmetry.** The stipend feeds wallet-only, while every other faucet feeds both — paying real money for Slop Club buys spend power but no rank, which is intentional but undocumented player-side.
