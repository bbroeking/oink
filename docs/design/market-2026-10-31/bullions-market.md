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

## Audit hardening (2026-10-31)

An independent review of the SQL and the client found, and this build fixes: finds minted when the bag shrank
mid-trade (every `_market_take_units` result is now the locked check), prices growing ~2 decimal digits a tick
(rounded to 6 places), one unsettleable listing taking every pig's read down (each crossing is its own
subtransaction; a pig with no bank row is refused), the tape leaking stranger ids, one-friend targets and other
pigs' cost basis, notices handed over twice by overlapping reads, the tape out of order after a quiet spell (sorted
by tick), listings coming home as fresh `market` rows (escrow now keeps source, age and giver), notices carrying a
stale `open` status, and a moved-back test clock rewriting history. Client: notices sized from the server's own
qty, a receipt queue that drops nothing and waits under sheets, the price band's taps, VoiceOver reach on board
cards, back gestures walking the in-route stack, local times on the tape and chart, a write's refresh never reusing
an older read, one nonce per sheet (true double-tap idempotency), unpayable wanted ads locked, and copy edge cases.
Smoke section 11 + a two-session race check cover the SQL; Jest covers the client.

Lap 2 of the same audit fixed what lap 1 introduced: a deleted gift-giver no longer breaks a returning set,
every expiry and crossing is its own subtransaction (failures log a WARNING), the season guard is read once per
call, the in-route back no longer intercepts navigation (the iOS edge swipe is off while deeper than the market
home), your own receipts jump the queue and no card's clock runs under a sheet, and a network failure keeps the
confirm sheet and its nonce so a retry replays rather than trading twice.

Still open (low): `poster_coin_ok` tells anyone whether a wanted ad's pig can pay; the board runs one
`tickle_balance` per wanted ad per poll; a Satchel swap or gift keeps the giver's `market_cost` on the moved row.

## Open questions for the founder

- **Economy.** Buying a set at the counter and handing it to a Ghost Sheep who fancies it can pay more (in score
  tickles) than the set cost (in bank tickles). The prototype embraces this ("your Ghost Sheep pays 24 today"); the
  Sheep's daily visit and per-visit cap bound it. Watch the `market_trades` ledger after launch.
- **Season 2's fresh start** archives and zeroes the bank and the Satchel at the flip. The market handles its side
  without touching `flip_season_2`: any listing pinned before the latest `season_reset_archive` (kind `satchel`) is
  ended by the next market read, and its held set does **not** come home (it was part of the bag that was reset).
  Wanted ads lapse naturally against a zeroed bank. The guard reads when the flip actually **ran**
  (`app_settings.season2_flip.ran_at`, only while `app_config.season2_flipped` is on and the Satchel was in scope)
  against each listing's real-clock `posted_at`, so a test clock can't misfire it. Such a listing ends as `reset`
  with its own notice. Known gap: `unflip_season_2()` does not restore sets on listings ended this way.
- **The tick lock** serialises every market write. Fine at today's volume; per-find locks are the next step if the
  market gets busy.

## Pushing the migration (2026-10-31)

The remote holds three older local migrations that were never applied, deliberately (dark features):
`20261004230000_matchmade_play`, `20261014180000_seasonal_card_item_unlocks`,
`20261014200000_halloween_login_costume_gift`. `supabase db push` refuses while they exist; **never pass
`--include-all`**. Move the three out of `supabase/migrations/`, `npx supabase db push --linked --dry-run` (it must
list only `20261031100000_bullions_market.sql`), push, then move them back.
