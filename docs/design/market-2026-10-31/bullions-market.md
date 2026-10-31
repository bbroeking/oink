# Bullion's Market: one price, two ways to trade

Shipped from the round-4 playable prototype, "Bullion's Market"
(https://claude.ai/artifact/P1zcYweBHJbd4XYJtUi9dA, `engine.js` + `index.html`, 2026-10-30).
Implemented 2026-10-31. Decision: `SKILL.md` 2026-10-31 "Bullion's Market".

## The game in one paragraph

Every [[Find]] has **one price per set**. Bullion the bull runs a **Counter** that always buys and always sells a
set, a little under the price and a little over (his cut). Pigs pin listings on the **Noticeboard** at their own
price (for sale, wanted, or a straight-up swap), to everyone or to one friend. A listing priced between Bullion's two
prices beats his counter for both sides, which is how you sell high. Every counter trade nudges the price; a pig
sale pulls it a third of the way toward what was paid; a swap moves nothing; when it is quiet the price wiggles and
wanders home.

## Rules (server: `supabase/migrations/20261031100000_bullions_market.sql`)

| Rule | Value (`app_settings.market_tuning`) |
| --- | --- |
| Set size | 4 of a common, 3 of an uncommon or a rare |
| Usual price **U** of a set | the Ghost Sheep's price for one find (`trader_tuning.prices`: 3 / 8 / 20) × the set size (12 / 24 / 60) |
| The price **P** | a float kept in [0.85 U, 1.15 U]; seeded near U |
| Bullion sells at | max(U + 1, ceil(1.2 P)) |
| Bullion buys at | min(U, floor(0.8 P)) |
| A set at the counter | moves P ± 3% of U |
| A pig sale | moves P a third of the way to what was paid |
| A swap | moves nothing |
| Every tick (30 min) | P += U × 0.01 × (2r − 1), then P += 0.05 × (U − P); r = md5(find, tick) |
| A townsfolk print on the tape | per tick, 20% / 10% / 3% by rarity (one of the wiggle's small trades) |
| Listing price | 1 … 3 × U per set |
| Listings up at a time / posts a day / lifetime | 4 / 30 / 24 h |
| Counter caps | off (`counter_caps: null`; `{sell, buy}` per pig per UTC day is the valve) |

**Crossing.** The counter keeps the board honest: a resting for-sale listing at or under Bullion's buying price sells
to him (at his price); a wanted ad at or over his selling price buys from him (at his price). A new sell listing
takes the better of the best wanted ad it meets and the counter (a tie goes to the pig); likewise a new wanted ad.

**Holding.** A for-sale or swap listing takes its set out of the bag while pinned (the per-unit cost basis rides in
`market_offers.escrow`) and returns it on take-down or expiry. A wanted ad is not set aside: the tickles must be
ready for all your wanted ads when you post, and the ad **lapses** if a seller comes and they are not.

**Currency.** The tickle bank ("tickles ready", `user_items.item_count`): buying spends it after `settle_tickles`;
selling pays into it through `grant_tickles`, which may bank past the cap. Never snouts, never the earned count.

**Cost basis.** `satchel_items.market_cost` (null = dug up, given, swapped). Receipts say "paid 13 · sold for 14 · up 1"
or "you dug them up · +9". A set is taken newest first, so a set just bought is the set sold next.

**Time without a cron.** `_market_advance()` runs at the start of every market read and write: it walks each find's
price from its last tick to now (at most `catch_up_ticks`, three days, after which the start no longer matters),
expires listings, and lets the counter cross resting listings at the price as it stands. A read takes the market
lock only when a tick is due.

**Concurrency.** Every market write takes one transaction-scoped advisory lock (`'market'`). Trades touch shared
prices, crossing and two bags at once; serialising them is the simplest deadlock-free order at this volume.

**Privacy.** Another pig is "a pig" on the board and the tape unless they are your friend. A listing sent to one
friend is visible only to them (and lands in their notices as "for you"). Blocked pairs never see each other's
listings. Targets must be accepted friends.

## RPCs

| RPC | What |
| --- | --- |
| `market_state()` | the whole market for the caller: every find's price, Bullion's two prices, the day's sparkline, change since yesterday; your bank, ledger, holdings (held, paid, on offer), open listings, posts today; the board (visible listings with poster, for_you, whether a wanted ad's pig can pay); the tape (24); notices handed over **once**; friends (for "who sees it"); yesterday's busiest find |
| `market_find(find)` | two days of price points, the trades on the chart, the last ten trades, today's counts |
| `market_counter(find, side, limit, nonce)` | buy or sell a set at the counter; `limit` guards the price the confirm sheet showed (`price_moved`) |
| `market_post(side, find, price, want_find, want_qty, target, nonce)` | pin a listing, or fill at once against a pig or the counter |
| `market_take(offer_id, limit, nonce)` | buy a for-sale set, fill a wanted ad, or take a swap |
| `market_cancel(offer_id)` | take your listing down; the set comes home |
| `market_ping()` | read-only peek for the Barn fan (open, notices waiting, offers for you, your listings) |

Writes are fail-closed `{ok:false, reason}` and idempotent on the nonce (`market_requests`). Reasons:
`price_moved · not_enough_tickles · not_a_set · too_many_offers · too_many_today · not_found · own_offer · lapsed ·
not_enough · not_a_friend · bad_price · bad_want · bad_side · unknown_find · counter_limit · closed · bad_nonce`.

Smoke: `scripts/db-harness/00x_market_prep.sql` + `C1_bullions_market_smoke.sql` (stand-alone, plain Postgres 16).

## Client

- `constants/market.ts`: the tuning fallback and the pure rules (Bullion's prices, moves, `previewList`, the words).
- `utils/market.ts`: payload narrowing, RPC wrappers, `boardBest`, `marketFanLine`.
- `hooks/useMarket.ts` (focus + 20 s poll while on screen, writes refresh), `hooks/useMarketPing.ts` (the fan).
- `app/market.tsx`: one route with its own small stack (Market → Counter → a find; Market → Noticeboard), a pinned
  action bar, the confirm/post/bag/onboarding sheets, Bullion's receipt cards.
- `components/market/`: `MarketViews` (the four places), `MarketSheets`, `MarketArt` (Bullion's five poses, the
  corkboard, the sparkline and the price chart), `ReceiptStack`, `marketCopy` (every sentence).
- Entry: a **Market** row on the Barn button's fan, drawn once `market_ping` answers; its line says
  "an offer for you" / "news on your listing" / "N listings pinned up" / "buy, sell, swap".

## Prototype parts deliberately not shipped

- **The simulated pigs** (Maya, Biscuit, forty strangers): in the real market they are real pigs.
- **The demo Ghost Sheep** ("one set a day"): the real Ghost Sheep Trader is unchanged. The market reads him for the
  find he fancies (a star on the counter row, his price on the find screen) and the receipts mention what he pays.
- **The demo clock controls**, the side tape panel, and the opening board (`seedDemo`).
- **The coach mark spotlight**: replaced by finishing onboarding on the find you hold a set of, with Bullion's card
  asking whether to sell to him or list it.
- **The drag slider**: the price band is tappable (and VoiceOver-adjustable) with − / + steppers, showing the same
  three zones (crosses with Bullion · the green gap · just sits).

## Open questions for the founder

- **Economy.** Buying a set at the counter and handing it to a Ghost Sheep who fancies it can pay more (in score
  tickles) than the set cost (in bank tickles). The prototype embraces this ("your Ghost Sheep pays 24 today"); the
  Sheep's daily visit and per-visit cap bound it. Watch the `market_trades` ledger after launch.
- **Season 2's fresh start** archives and zeroes the bank and the Satchel at the flip. Open listings hold sets in
  escrow and wanted ads promise bank tickles; the flip should cancel every open listing first (its sets would then
  be zeroed with the bag). Not wired yet.
- **The tick lock** serialises every market write. Fine at today's volume; per-find locks are the next step if the
  market gets busy.
