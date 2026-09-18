# The scavenging pigs — the plan (2026-09-17)

The build plan for *the pig searches*: errands, pig stats, Find families, sets, and the Trader's new offers. Supersedes the open items in `pig-search-2026-09-17.md` and `finds-sets-and-scavenging-2026-09-17.md`; those hold the reasoning, this holds the decisions and the order. Plan-optimizer score 88/100 (trajectory 64 → 78 → 86 → 88 → 88).

## 1. Goal and "done"

**Goal.** The Pen becomes a place you open every day: you send a pig to look for a Find, it comes back hours later with it or without it, and what it brings back is for giving, holding as a set, or the Trader — never a new currency.

**Done** = all three builds shipped and, four weeks after Build 1: ≥35% of D7-retained players send an errand on a given day; ≥60% of returns are opened within 24 h; ≥40% of friend-targeted returns end in *Give*; the Trader's applied-tickle payout stays within ±20% of its pre-errand saturation per pig-day; zero standings complaints traceable to errand supply.

## 2. Rulings (settled; append to SKILL.md's log when Build 1 ships)

| # | Ruling |
| --- | --- |
| R1 | **Rosie is sendable.** The yard is empty while she's out; the mound and a hand line say so; tap → the Pen. Membership adds a second worker (the companion), never a faucet. |
| R2 | **Only a Find is ever minted by a search.** Postcards are receipts. Keepsakes come from sets. |
| R3 | **One errand per pig per local day** (UNIQUE like `trader_visits`). A recall is a choice, not a retry: it ends the errand empty-handed and spends the day. A failed send never spends the day. |
| R4 | **Picker order:** friends' wishes → your wish → *anything*. Two entrances (Pen card pig-first, Friends row target-first), one confirm ticket. |
| R5 | **Specialisation, never superiority.** Seven pips per pig across Nose · Trot · Pockets · Glint; Nose only applies inside the pig's family; any pig can go anywhere. No growth in v1. |
| R6 | **Families are the unit of sets and noses.** Brook · Hedge · Meadow · Lost things (three each). |
| R7 | **A set is a moment, not a vault.** Family completion = holding all three at once, checked on every bag write, granted once; the Finds stay yours to give the next minute. |
| R8 | **The set reward is one furnishing that fills** — the curio case (`shelf` position, five states) — plus the title *Hedgerow* when it's full. No room in v1. |
| R9 | **The wish bias is spoken.** Two-of-three on a family → +15 pts toward it, and the bubble says *"Rosie's been thinking about the brook."* |
| R10 | **The Trader stays one sentence per build:** family fancy (×2 on the first two matching finds) + trade-up (three alike → one of the next rarity, his pick, seeded per day) in Build 2; hands in Build 3; never snouts, money, wishes, decor, cosmetics or Motes. |
| R11 | **A search never touches Contend.** No Dig Finds, no dig help, no season points. Trader and swap tickles already feed standings; they stay capped **per pig per day**, so a second worker changes how often a member hits the cap, never the cap. |
| R12 | **While Rosie is out:** the Auto-Tickler pauses (nothing to tickle); a visitor finds the yard empty with the same hand line, the visit still counts for the Visit Streak (opening the yard is the visit), blessings and wishes work, tickling doesn't. A lapsed member's companion rests in the Pen (not sendable); Rosie still is. |

## 3. The three builds

### Build 1 — the Errand (the loop, no stats)

**Scope.** Every pig is a generic worker (Nose 1 · Trot 2 · Pockets 1 · Glint 1 — the same for all; the pips table is catalog data with one row per pig so Build 2 is a data change). The Pen's card gets the **job segment** (At home · In the Pen · Out looking) and the one action *Send … to look for…*. The picker sheet (R4). The confirm ticket (target · back by · one a day). The out state (paddock, dashed medallion, fan row *Bandit · out*, Home's empty yard for Rosie). The push at `ends_at`. The **homecoming** on next open (walk in, find on the `snout` anchor, tape note, **Give to Maya** / **Keep**). The **corkboard** under the paddock as the inbox (returns wait there as pins; three unclaimed pins and the pig rests). The while-away line. Field Guide silhouette lift on first carry (exists).

**Server.** Migration `2026MMDDHHMMSS_pig_errands.sql` (additive): `pig_errands` (id, user_id, pig_id, target_find_id?, for_user_id?, started_at, ends_at, seed, status `out|back|kept|given|recalled`, result_find_ids text[], nonce) UNIQUE (user_id, pig_id, local_day); RPCs `send_pig`, `pig_errands()` (materialises returns lazily like `trader_status()`), `claim_errand(id, action keep|give, nonce)` (give = the existing `swap_with_host` gift path, provenance `source='errand'`), `recall_pig(id)`; all fail-closed `{ok:false, reason}`; `app_settings.errand_tuning` (enabled flag, durations, base odds, pigs table, corkboard cap); pg_cron tick that queues the push at `ends_at` through the existing notification routing (`utils/notificationRouting.ts` gains `pig_errand_back` → `/pen`); `dev_summon_return()` behind the `is_test` gate; `tickle_breakdown` carried verbatim (errands pay no tickles — a Give pays through the swap lane that exists).

**Client.** `hooks/usePigErrands.ts` (config cell + compiled fallback `constants/errands.ts`, never bare constants); `components/pen/` — `Paddock` (PigStage ×2, idle loops, Reduce Motion = rest frame), `FenceRow` (medallions: home · selected · out · back · resting), `PigCard` (job segment + action + hand line), `SendSheet`, `ErrandTicket`, `Homecoming`, `Corkboard`; the yard's *Rosie's out* line on the Barn tab; the fan row; Friends row's *send a pig for it* door on a marked wish. All through `Sticker`/`Button`/`EmptyState`/`LoadingBeat`/`Glyph`; tokens only.

**Art.** One *walk out / walk in* strip per pig from the Lounge walk sheets (six pigs, one pass). The find glyphs exist. No new painted scenes.

**Tests.** Kernel: one errand per pig-day; recall spends the day; failed send does not; result rolled from the seed only at `ends_at` (fake_now); Satchel-full hold; wish-fulfilled-meanwhile → Satchel; give path is the swap path (nothing minted); Auto-Tickler pauses while Rosie is out. UI: send optimistic then reverts on `{ok:false}`; corkboard caps at three; homecoming shows once.

**Exit.** Errands on for `is_test` accounts for one week; then `errand_tuning.enabled = true` for all. Signals: send rate, return-open-within-24h, Give:Keep, Trader payout per pig-day unchanged. Kill switch: `enabled=false` hides the action and the row; open errands still return.

### Build 2 — families, stats, the case, the Trader's two offers

**Scope.** `satchel_finds.family` + the client catalog; the pips table gets its real rows (R5, the six pigs in `finds-sets-and-scavenging §2.2`); the *about {pig}* sheet off the nameplate (pips, family, tally); the ticket's *"Pepper's the better nose for a marble"* hint; the wish bias (R9) with its bubble line; **family sets** checked on every bag write → the **curio case** furnishing (five states) granted into the Barn collection with an acquisition-journal receipt, and the title *Hedgerow* on the fourth; the Trader's **family fancy** and **trade-up** (R10) on his sheet; Field Guide pages for *families* and *the case*.

**Server.** Migration (additive): `family` column; `find_sets (user_id, set_id, completed_at)` + `_check_find_sets(uid)` called from every RPC that inserts a bag row (dig receipt, `claim_errand`, `swap_with_host`, `trade_up_with_trader`); `trade_up_with_trader(find_id, nonce)` (3 rows → 1, ledgered `trader_sales.kind='trade_up'`); `_trader_want_for` gains a family mode; wish roll gains the two-of-three bias; `errand_tuning.pigs` carries the pips; `trader_tuning.family_multiplier_count = 2`, `trader_tuning.daily_tickle_ceiling` (new, see §4).

**Art.** The curio case: one shelf furnishing with four overlay states (pebble jar · feather-and-cone wreath · honey-and-clover posy · the key on its nail). The Trader sheet's family strip uses the existing find glyphs.

**Exit.** `tools/balance_trader.py` re-run with two errands/day and the family fancy: payout per pig-day within the ceiling; set-completion curve (Hedge median ≤ 7 days, Lost things ≤ 45 days for a daily player); the wish bias not detectable as "rigged" in the playtest guide questions.

### Build 3 — hands, and the herd's wishbook

**Scope.** Poker hands judged inside `trade_with_trader` over the visit's finds (pair · three · flush · full house · the countryside), the Trader's fancy-as-a-hand on some days, Field Guide hand pages; the **herd wishbook** (five different pigs' wishes fulfilled in a week, per giver → title *Good Neighbour*; herd-level wish bunting till Monday). Only after Build 2's numbers hold for two weeks.

## 4. Economy (the numbers that must hold)

Supply today: ~1–2 digs/day × E[finds] 0.9 ≈ **1–2 Finds/day**. Errands add ≈0.7/day per worker (Rosie) → free players ≈2×, members ≈3×. Sinks are all **per pig per day**: Satchel cap 6; swaps 3 per pair / 10 per pig (30 tickles max); Trader six finds per visit, visits every other day on average (≈3 finds/day, ≈6 tickles/day today, ≈9 at Build 3's top). New guard: `trader_tuning.daily_tickle_ceiling` *(tuned, start 24)* so no offer stack can exceed it. Because every cap is per pig, the member's extra worker raises how often they *reach* the caps, never the caps — that is the fairness argument in one line, and it is why R11 lets errand supply touch standings-feeding tickles at all. Tuning lives in `app_settings` (server config over constants).

## 5. Risks and kill switches

| Risk | Mitigation |
| --- | --- |
| Members read as buying a faucet | R1 (Rosie for everyone) + per-pig caps + the ceiling; the playtest guide asks the question directly. |
| Rosie away hurts the core loop (no tickling) | Trot 2 = 4 h; the ticket says *back by*; players learn to send her at bedtime; a recall is always one tap. Watch tickles/day for senders vs non-senders. |
| Auto-Tickler drains while she's out | Paused by R12, tested. |
| Push fires, return not materialised | `pig_errands()` materialises lazily on open; the fan row says *back — opening the gate…* until it does. |
| Sets feel like a vault (hoarding blocks giving) | R7: a moment, checked at write time; copy says *give them away now if you like*. |
| Lost things is a dead end | Nose (Bandit/Biscuit), the spoken wish bias, trade-up. Track median days-to-complete. |
| The Trader grows past one sentence | R10 sequencing; each build adds exactly one line to his sheet. |
| Any of it misfires in prod | Flags: `errand_tuning.enabled`, `find_sets.enabled`, `trader_tuning.family_fancy`, `trader_tuning.trade_up`, `trader_tuning.hands`. Migrations are additive; disabling never orphans a bag row. |

## 6. Docs and instrumentation

- `CONTEXT.md`: **Errand**, **Family**, **Curio case**, **Hand**, **Trade-up**; amend **Pig roster** and **Trader**. `SKILL.md` decision log at each build. `docs/agents/…` untouched.
- Analytics (emitted in the grant transaction, never inferred): `errand_sent` (pig, target kind, for_friend), `errand_returned` (found, count), `errand_claimed` (give|keep), `errand_recalled`, `find_set_completed` (family, days), `trader_trade_up`, `trader_hand`.
- Field Guide: *the Pen*, *families*, *the case*, *hands* — silhouettes until met, numbers fed from tuning.

## 7. First actions (in order)

1. Draw Build 1 on the canvas: Pen card with the job segment · target-first door on the Friends row · the *who goes?* ticket · out state (Pen, fan row, empty yard) · homecoming Give/Keep · corkboard · empty hands · Satchel full · recall · send failed · the *about* sheet (Build 2's, drawn now so the card's hand line has somewhere to point).
2. Write `docs/pig-errands-spec.md` from §3 Build 1 + §2 (the RPC contract and the tuning JSON), the way `satchel-spec.md` is written.
3. Migration + kernel tests under the stubbed-Postgres harness; **no push without the explicit go**.
4. Walk strips for six pigs (one Codex ImageGen pass off the Lounge sheets).
5. Client, `is_test`-gated; changelog before the build; Transporter.

## 8. Still open (small, non-blocking)

- Title for the full case: *Hedgerow* is the working name.
- Family fancy: ×2 on the first two matching finds is the working rule; ×1.5 on all is the alternative if the sheet reads better.
- Whether Build 3's herd bunting is a furnishing or a yard decoration.
