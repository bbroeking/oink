# Bullion's Market: pigs trade finds for tickles (2026-10-29)

Founder ask (2026-10-29): *"A little stock-market-style experience with a simple order book where players can buy, sell, and trade items using tickles as the currency … introduce a new stock-market character, possibly a bull … keep buying, selling, and the order book simple, approachable, and fun. Players should be able to understand what their items are worth and how much they've made or lost … a playful way to learn how markets work while encouraging player-to-player trading."*

**One sentence:** *Post the price you'll pay or take for a find, and Bullion matches you with a pig who agrees.*

Pillars: **Collect** first (a missing find, a third pinecone for a trade-up, or a friend's wish can be bought from another pig), **Connect** (every trade has a pig on the other side: "Maya bought your pinecone for 5"). **Contend** is not touched: no Board points move.

## How we got here

Three passes on the mechanics, the same brief to each (`brief.md`):

1. **Draft (Claude):** Bullion as an NPC market maker with a real shelf (he only resells what pigs sold him), prices driven by his stock plus a daily news multiplier, pig offers inside his spread, money = the tickled count.
2. **Codex critique (`codex-critique.md`):** spending the tickled count spends the leaderboard; the faucet proof is false once his prices move (buy from him at the bottom, sell back at the top mints tickles every cycle); a global shelf of 40 is easy to corner; "worth" promises liquidity nobody has. Alternative: *Bullion's village noticeboard*, pig offers only, no NPC inventory, no news.
3. **ChatGPT critique (`chatgpt-critique.md`):** the same verdict independently: keep Bullion and pig-to-pig trading, cut the dynamic market maker; separate the score from spendable tickles; show real sale prices, not theoretical worth; the Ghost Sheep should be the source of price differences and Bullion the facilitator. Labels: "I'll pay" / "I'm asking" / "Last sold for" / "Paid 4 · sold for 6 · gained 2".

The synthesis below takes both critiques' structure (player-only book, Bullion hosts) and keeps the draft's best pieces (the Ghost Sheep's fancy as the reason values differ, cost on every find, friends named).

## The rules (v1)

1. **Only the twelve Finds trade, one per offer.** Never cosmetics, never anything bought with money.
2. **The money is tickles ready** (the coin, `user_items.item_count`). Buying spends them; a sale banks them for the seller, even past the cap (the coin reads "banked", the referral reward's precedent). **Pig to pig only: every tickle a buyer pays lands with a seller.** The market mints nothing, burns nothing, and never touches the tickled count, snouts or the Board.
3. **The board, per find:** *Pigs selling* (asking prices, cheapest first) and *Pigs buying* (offered prices, highest first). Ties go to the earliest offer. A friend's offer carries their name; anyone else is "a pig". No offer gets priority for being a friend's.
4. **Name your price.** A *sell* offer takes the find out of your bag and puts it on the board. A *buy* offer needs the tickles ready when you post it (enough for all your open buy offers together) and is paid when it fills; if you have tapped them away by then, it quietly lapses. Offers last **24 hours**, cancel any time; an expired sell offer's find comes home to the bag.
5. **Buy now / Sell now** take the best offer on the board. You pass the price you saw as "at most" / "at least": a better price is taken gladly, a worse one answers *the price moved* with the new one.
6. **An offer that meets the board fills at once,** at the price already waiting (the resting price).
7. **Limits (server tuning):** 4 open offers a pig; prices from 1 to 3× the Ghost Sheep's price for that rarity (commons 1 to 9, uncommons 1 to 24, the tin whistle 1 to 60); 30 offers posted a day; never with yourself.
8. **What it's worth:** *last sold for* (a real trade, never a quote), a seven-day strip of each day's last sale, and the Ghost Sheep's price as the anchor ("the Sheep pays 3 · yours fancies these today: 6").
9. **What you made or lost:** every find carries what you paid for it (dug, given, swapped: nothing). A sale's receipt says *Paid 4 · sold for 6 · up 2* or *Dug it up · sold for 6*. The market page keeps a plain ledger: *spent 23 · took in 31*.
10. **Bullion** hosts. He never buys, sells, holds or takes a cut. He announces yesterday's busiest find from real trades ("14 pinecones changed hooves yesterday, last at 5"), says one tip per visit, and cheers both sides of a deal. **The Ghost Sheep** stays the once-a-day buyer who takes finds out of the world; his per-pig fancy is why two pigs value the same pinecone differently, which is why they trade.
11. **The resting side hears it:** an Inbox row and a push when an offer fills ("Maya bought your pinecone for 5").
12. **Ships dark:** `app_settings.market_tuning.enabled = false`; `is_test` profiles see it. The bank, snouts and Satchel reset at The Feast's flip (2026-11-09), so the market turns on after the flip; any later reset clears open offers first (`_market_close_all`).

### What v1 cuts, and why

| Cut | Why |
| --- | --- |
| Bullion's own stock and quotes | Moving NPC prices mint tickles over time and a few pigs can corner a global shelf (Codex, ChatGPT). |
| News multipliers | A scheduled price shock rewards camping the reset. Chatter from real trades replaces it. |
| Mark-to-market "worth" of the whole bag | Worth nobody can sell at is fiction; *last sold for* is the honest number. |
| Fees | Pig-to-pig is zero-sum already; a fee only discourages the trades we want. |
| Quantity > 1, charts beyond the 7-day strip | Legibility first. |

### What it teaches, never called a lesson

| The idea | On screen |
| --- | --- |
| A thing is worth what a pig will pay | *Last sold for 5* |
| Buyers and sellers meet in the gap | *Pigs buying 3 · Pigs selling 5* |
| Waiting can pay, and guarantees nothing | *Name your price* vs *Buy now for 5* |
| Different pigs value things differently | *Your Ghost Sheep fancies these today: pays 6* |
| It isn't a gain until it's sold | *Paid 4 · sold for 6 · up 2* |

Bullion's tips (one per visit, rotating): "A thing is worth what a pig will pay for it." · "Ask high and you might wait. Ask low and it goes quick." · "Every pig's Ghost Sheep fancies something different. That's why we trade!" · "It's not a gain till it's sold." · "The gap between *I'll pay* and *I'm asking* is where deals live." · "Last sold is a clue, not a promise."

## Characters

- **Bullion** (the bull): loud, sunny, permanently bullish ("Up, up, up!"), celebrates every completed deal regardless of who did better. Lives at the market all day. Art: Codex ImageGen sticker in the Ghost Sheep's hand (variants A visor + waistcoat + chalk slate, B straw boater + bell, C striped apron + scale); recommended A.
- **The Ghost Sheep** (unchanged): quiet, hooded, once a day, collects. Cross-links only: his sheet points to the market when you are one find short of a pair or a trade-up; the market shows his fancy and price.

## Where it lives

A **Market** row on the Barn button's fan (the one home of secondary actions), present while the market is open for the pig, opening `app/market.tsx` (the Riddle's pattern). The screen: Bullion's header (tip or chatter) → your coin and ledger → *your offers* → the twelve finds (glyph, name, last sold and its change, best "selling" and "buying", how many you hold). Tapping a find opens its page: the price strip, the board, your holding, **Buy now / Sell now / Name your price**. The receipt lands on the same page.

## Server (migration `20261030120000_bullions_market.sql`)

Tables: `market_offers` (one find, one price, one side; a sell offer carries the bag row's provenance and cost so a return restores it), `market_trades` (the ledger), `market_receipts` (nonce idempotency). `satchel_items` gains `cost int` (what this pig paid; NULL = dug/given/swapped) and the source `'market'`.

Matching runs inside `market_place` under a per-find advisory lock: price, then time; never your own offers; trade at the resting price. The buyer's tickles are settled and debited in the same transaction (`settle_tickles`, then a conditional update, the Exchange's pattern); the seller is credited through `grant_tickles` (no clamp). A lapsed buy offer (buyer short at fill time) is closed and matching moves on. Expired offers are swept lazily on every read and write.

### Wire contract (all `SECURITY DEFINER`, granted to `authenticated`; fail-closed `{ok:false, reason}`)

`market_status() → jsonb`
```
{ ok, enabled, now,
  tuning: { open_offers, offer_hours, band_multiple, daily_posts, base: {common, uncommon, rare} },
  wallet: { ready, cap },
  finds: [ { find_id, rarity, held, last_price|null, prev_price|null, best_ask|null, asks, best_bid|null, bids, sold_today } ],   -- all 12, catalog order
  offers: [ { id, find_id, side, price, created_at, expires_at } ],                                                             -- mine, open
  ledger: { spent, taken_in, bought, sold },
  chatter: { find_id, sold, last_price } | null,                                                                                -- yesterday (UTC), busiest find
  sheep: { present, want_find_id|null, prices: {common, uncommon, rare}, want_multiplier },
  fills: [ { trade_id, find_id, price, side: 'sold'|'bought', who, friend, cost|null, at } ],                                     -- mine, last 24 h; who = the other pig's name; cost on my sales
  closed: [ { id, find_id, side, price, status: 'expired'|'lapsed', closed_at } ] }                                             -- mine, closed without a trade, last 24 h
```
`enabled:false` answers `{ok:true, enabled:false}` and nothing else.

`market_book(p_find_id text) → jsonb`
```
{ ok, find_id,
  asks: [ { price, n, friends: [name] } ],   -- ascending, up to 6 price levels
  bids: [ { price, n, friends: [name] } ],   -- descending, up to 6
  history: [ { day: 'YYYY-MM-DD', price } ], -- last 7 UTC days that had a trade, that day's last price
  recent: [ { price, at, who|null } ],       -- last 5 trades; who = a friend's name, else null
  holding: { held, bought: [cost, ...] },    -- costs of the rows this pig paid for
  mine: [ { id, side, price, expires_at } ] }
```

`market_place(p_find_id text, p_side text, p_price int, p_rest boolean, p_nonce uuid) → jsonb`
- `p_rest = false`: Buy now / Sell now; fills against the best offer at `p_price` or better, else `price_moved` with `best`.
- `p_rest = true`: Name your price; fills if it meets the board, else rests.
- `ok`: `{ ok, filled, trade: { id, find_id, price, side: 'sold'|'bought', who, friend, cost|null, gained|null } | null, offer: { id, find_id, side, price, expires_at } | null, wallet: {ready, cap}, held }` (`who` = the other pig's name, always, once a trade happens; `cost`/`gained` on a sale only: what you paid and `price − cost`; null cost = dug or given).
- reasons: `not_authenticated` · `closed` · `bad_nonce` · `unknown_find` · `bad_side` · `bad_price` (+ `min`, `max`) · `too_many_offers` · `too_many_today` · `not_enough_tickles` (+ `ready`, `needed`) · `none_in_bag` · `price_moved` (+ `best`).
- Idempotent on `(user, nonce)`: a replay answers the original.

`market_cancel(p_offer_id bigint) → jsonb` → `{ ok, offer_id, returned: 'find'|'nothing', wallet, held }`; reasons `not_authenticated` · `not_found` · `not_open`.

`dev_market_seed() → jsonb` (is_test only): gives two or three other test pigs a few finds and posts a spread of sell and buy offers, so a simulator has a board to trade against.

## Client

- `constants/market.ts`: compiled fallback tuning, Bullion's tips, the band rule.
- `utils/market.ts`: shapes, fail-soft parsers (an un-pushed server reads as closed), pure rules (band, receipt words, change words), RPC wrappers.
- `hooks/useMarket.ts`: status, the open find's book, place/cancel with a fresh nonce per attempt.
- `app/market.tsx` + `components/market/*`: the slate, the find page, the price stepper, the receipt, `BullionArt`.
- Fan row in `components/BarnButton.tsx` while `enabled`.

## Open for the founder

1. **Which tickles.** Built: *tickles ready* (the coin). The alternative is the *tickled count* (what the Ghost Sheep pays), which makes "buy for 5, sell to the Sheep for 7" one currency but lowers the Board when you buy and lets friends move Board points by overpaying. The wallet is three small server functions, so switching is one migration.
2. **Bullion's look:** A (visor, waistcoat, chalk slate), B (boater, bell), C (apron, scale).
3. **Strangers' names:** v1 names friends and shows everyone else as "a pig" until a trade (the receipt names them). Name everyone instead?
