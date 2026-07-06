---
title: Core Loop & Tickle Trade
aliases: [core-loop, tickle-trade, trade, ask-fulfill]
tags: [system, economy, core-loop, social, season]
status: stable
sources:
  - doc: docs/systems-overview.md
  - doc: CONTEXT.md
  - sql: supabase/migrations/20260520010000_tickle_trades.sql
  - sql: supabase/migrations/20260527000000_trade_economy_flip.sql
  - sql: supabase/migrations/20260521000000_alignment.sql
  - code: utils/season.ts
last_compiled: 2026-06-13
---

# Core Loop & Tickle Trade

The minute-to-minute loop — tap the pig to bank tickles, then spend them on cosmetics — and the friend-to-friend **Tickle Trade** that turns that bank into Season 0's moral engine, where asking is the greedy-but-profitable move.

## How it works

**The tap loop.** Tapping Rosie earns tickles, which accrue in a regenerating bank (`user_items.item_count`) and credit lifetime totals (`profiles.counter` + `profiles.tickles_earned`); the bank converts to [[snouts-economy]] currency spent on [[shop-cosmetics-closet]]. Regen rate is multiplied by [[happiness-and-mood]], [[streak-and-garden]], and active [[blessings-curses-effects]] (see [[regen]]).

**The trade.** Player A asks friend B for **N** tickles (1–5, DB-CHECKed). When B **fulfills**, B spends N from their own bank and **A pockets 2N** — A gets *double* what was asked, B gets nothing material, only a social promise. There is **no repay step**; a fulfilled trade is terminal (`supabase/migrations/20260527000000_trade_economy_flip.sql`, the reconciliation migration that carries the flip forward as proper DDL). Asking is therefore the mechanically profitable, greedy move — deliberately so; [[alignment]] is the only counterweight (`request_tickles` / `fulfill_tickle_trade` headers).

**Guards.** Friends-only ([[friends-graph]]); max one *pending* trade per pair (either direction); a **24h per-pair cooldown** measured from the most recent trade's `created_at`, returning `reason: 'cooldown'` with `hours_remaining` until the window clears (`20260527000000_trade_economy_flip.sql:131`). Push fires on both request and fulfill (see [[notifications]]).

**Feeds alignment.** A trigger on `pending → fulfilled` shifts the giver **+2** (generous) and the asker **−2** (greedy) via `shift_alignment` (`supabase/migrations/20260521000000_alignment.sql:87`), and a fulfill also auto-grants Trade Master [[achievements-and-titles]].

## Key files

- `supabase/migrations/20260520010000_tickle_trades.sql` — table, RLS, `request_tickles` / `fulfill_tickle_trade` / `cancel_tickle_trade` / `my_tickle_trades` RPCs.
- `supabase/migrations/20260527000000_trade_economy_flip.sql` — current behavior: asker gets 2N, no repay, 24h cooldown in `request_tickles`.
- `supabase/migrations/20260521000000_alignment.sql` — trigger turning a fulfilled trade into a ±2 alignment shift.
- `utils/season.ts` — Season 0 schedule; `seasonActive` gates whether the moral layer is live.
- `docs/systems-overview.md` — prose spec of the loop and economy.

## Connects to

- [[snouts-economy]] — banked tickles are the currency you earn and spend.
- [[shop-cosmetics-closet]] — the primary spend sink for banked tickles/snouts.
- [[alignment]] — fulfilling = +2 generous, asking-and-pocketing = −2 greedy.
- [[friends-graph]] — trades are friends-only (`are_friends` gate).
- [[regen]] — sets how fast the tap-loop refills the spendable bank.
- [[happiness-and-mood]], [[streak-and-garden]] — multipliers on regen.
- [[achievements-and-titles]] — Trade Master tiers granted on fulfill.
- [[notifications]] — push on request + fulfill, deep-linked to the trade.
- [[seasons-and-judgement-day]] — alignment accrued via trades is ranked + reset at the finale.

## Open questions / risks

- `my_tickle_trades` comments still describe an "outgoing fulfilled: actionable (repay!)" state (`20260520010000_tickle_trades.sql:226`) — stale since the repay step was removed; confirm the UI no longer surfaces a repay prompt.
- The 24h cooldown keys off `MAX(created_at)`, so a *cancelled* trade still starts the cooldown clock — verify this is intended (a cancel costs the pair a day).
- The dead `repaid_at` column and the `'repaid'` status still permitted by the CHECK are left in place deliberately (harmless), per the flip migration header.
