# Bullion's Market, round 3: sets of 4 and 3, straight up, and the town (2026-10-30)

Founder rulings on round 2:

> *"4 for commons 3 for everything else. We need to add some simulated buying and selling to the market too."*

## Sets

**A set is four of a common, three of an uncommon, three tin whistles.** Every offer, swap and town trade is one set of one find. Prices are per set, with the price per find shown beside it. Set size is server tuning (`market_tuning.set_size`), so it can move without a build.

Supply note, for tuning later: at two digs a day one pig gathers four of one specific common in about 25 days and three of one specific uncommon in about 20; three tin whistles (5% of drops) take months. The town (below) keeps every set on the board anyway.

## Straight up

A **swap offer** gives one set of a find and asks for 1 to N of one other find (N = that find's set size): *"4 pinecones for 1 old key."* Any pig holding what's asked can take it; both sides move at once, no tickles, nothing minted. Swaps never involve the town.

## The town: simulated buying and selling

**One sentence:** *Bullion's townsfolk trade every day too: they'll always buy a set for a low price and sell one for a high price, their prices drift with the town's mood, and now and then they buy a pig's set that's priced fairly.*

The townsfolk are named characters (the Miller, the Baker's boy, Old Mrs Hedge, the Tinker, Farmer Bramble, the Postmistress), always labelled as the town, never passed off as pigs.

### What they do

1. **A town price per find** (`ref`) drifts every tick (30 minutes): a small seeded random step plus a pull back toward the Ghost Sheep's price for that rarity, kept between 0.8x and 1.2x of it.
2. **Standing quotes, always there:** the town **buys** any set at `0.7 x ref x set size` (rounded down) and **sells** any set at `1.3 x ref x set size` (rounded up). Sell now / Buy now take the better of the best pig and the town (a tie goes to the pig).
3. **Town trades on the tape:** each tick, each find has a chance (common 20%, uncommon 10%, whistle 3%) that two townsfolk trade a set near `ref`. These are what keep *last sold*, the chart and the ticker moving on a quiet day. They are labelled town trades and move nothing in the game.
4. **Patient buyers:** each tick, a pig's resting **sell** offer priced at or under the town's fair cap (`min(ref, the Sheep's price) x set size`) has a 35% chance a townsfolk buys it at the pig's price. A pig's resting **buy** offer at or above the town's sell quote is filled by the town at the pig's price. The pig hears it: *"The Miller bought your 4 pinecones for 11."*
5. **Daily limits a pig:** sell at most **3 sets** to the town and buy at most **2 sets** from it per UTC day (both tuning).

### Why it can't be gamed (fair by construction)

- **The most the town ever pays is always below the least it ever charges.** Highest town buy: `0.7 x 1.2 = 0.84` of the Sheep's price per find; patient buyers pay at most `1.0`. Lowest town sell: `1.3 x 0.8 = 1.04`. So buying from the town and selling back to it always loses, at any two moments. (The first draft's dealer was cut for exactly this hole; the gap closes it.)
- **Selling high is still to pigs.** The town is the floor and the ceiling. Pigs pay more than the town because finds are worth more to them (a fancying Sheep, an order, a stamp, a friend's wish).
- **What the town adds to the economy is bounded:** tickles in only when a pig sells it a set (at most 3 sets a day, at or under the Sheep's price, and supply-limited by digging); tickles out when a pig buys a set from it (at most 2 a day, above the Sheep's price). Finds the town sells are new finds, at most two sets a pig a day, paid for at a premium.
- The ticks are seeded per (tick, find), so every device sees the same town and a test can pin it. No cron: the first read after a tick is due catches the town up (at most two days of ticks).

## Wire contract changes (supersedes spec.md where they differ)

`market_status()` adds: `tuning.set_size {common, uncommon, rare}` and `tuning.town {sells_per_day, buys_per_day}`; per find `set_size`, `sets_held`, `last_by` ('pig' | 'town' | null), `town_bid`, `town_ask`, `swaps` (open swap offers giving this find, not yours); `town_today {sold, bought}`; `ticker: [{find_id, price, qty, seller, buyer, kind: 'pig'|'town', at}]` (the last 12 trades anywhere; names are a friend's name, "a pig", or a townsfolk name); `offers[]` gain `qty`, `want_find_id`, `want_qty` and `side` can be `'swap'` (price null); `ledger` adds `swapped`; `fills[]` gain `qty` and `town` (bool). All prices are per set.

`market_book(find)` adds: `set_size`; `town {bid, ask, name}`; `swaps_giving: [{id, want_find_id, want_qty, who|null}]` (offers giving a set of this find); `swaps_wanting: [{id, give_find_id, give_qty, who|null}]` (offers asking for this find); `recent[]` gain `town_name|null`; `holding` adds `sets`.

`market_place(find, side, price, rest, nonce)`: price is per set; a sale needs a full set in the bag (`not_a_set` with `held`, `set_size`); the town's quote is part of the board; `trade` gains `qty` and `town`.

New: `market_swap_post(p_give_find text, p_want_find text, p_want_qty int, p_nonce uuid)` → `{ok, offer}`; reasons `not_a_set`, `bad_want`, `too_many_offers`, `too_many_today`, `closed`, `bad_nonce`. `market_swap_take(p_offer_id bigint, p_nonce uuid)` → `{ok, trade: {id, give_find_id, give_qty, want_find_id, want_qty, who, friend}, held}`; reasons `not_found`, `not_open`, `own_offer`, `not_enough` (+ `held`, `needed`), `closed`. `market_cancel` handles swap offers (the set comes home). `dev_market_run_town(p_ticks int)` (is_test) runs the town forward now.
