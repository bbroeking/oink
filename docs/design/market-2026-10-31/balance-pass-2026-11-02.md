# Bullion's Market: a balance pass for fun (2026-11-02)

Founder's instruction: **"Balance the game for fun."** This is a simulation-driven read of the market as shipped
(`20261031100000_bullions_market.sql`, `20261031110000_market_followups.sql`, `20261101150000_bullion_board.sql`),
with a proposed tuning. Nothing here changes a migration or the app; the parent session decides and implements.

Simulator: `tools/balance_market.py` (seeded, reproducible, `--help`). Every number below came from
`python3 tools/balance_market.py --compare --seeds 3 --small-seeds 8` and `... --sweep --seeds 3 --small-seeds 8`.
They are model outputs under the assumptions stated in Method, not measurements.

## Decided (2026-11-07)

Founder: *"Set sizes should be 3/2/1. The rest seems good."* Shipped as recommended: sets 3 / 2 / 1, impact 0.05,
wiggle 0.02, 48-hour listings (`20261102200000`, applied 2026-11-07), the Ghost Sheep's x2 only for a find you did not
buy, and his fancy as a real 70 / 25 / 5 draw from each pig's Season 2 day one (`20261107120000`). "Bought" is a bag row
with a market cost basis, so a *swapped* find still doubles (a straight-up swap is a trade, not a buy); the simulator's
`fancy_found_only` modelled only counter, shelf and board purchases, which is the same rule. Watch list below unchanged.

## In one paragraph

The shipped market has one dominant daily move and one dead corner. **The move:** when your Ghost Sheep is at the
hedge, buy the set he fancies at Bullion's counter (about 15 bank tickles) and hand it straight to him (36 count).
A market pig who catches him makes that move on 90 to 97% of those days. It adds about 21 count a day and makes market
users earn 1.25 to 1.28x the race score of non-users in the same tier. **The dead corner:** sets of 4/3/3 take
a regular pig 11 to 13 days to hold (only 15 to 22% hold one by day 7). A tin-whistle set costs 62 to 83 bank, above
every bank cap (25, or 50 in Slop Club), so pigs trade zero whistles with each other at every population. The
recommendation is five changes. Four are `market_tuning` levers: set sizes 3/2/1, impact 0.05, wiggle 0.02 and 48-hour
listings. The fifth is a rule **outside** the market: the Ghost Sheep's x2 for his fancy applies only to finds you
did not buy. On the fun scorecard below, the market goes from **6 to 7 of 16** to **13 to 14 of 16** at 30, 150 and 600 daily
players.

## Method

**The rules, as shipped.** U = the Sheep's price for one find x the set size (12 / 24 / 60). P is a float kept in
[0.85 U, 1.15 U], seeded at U x (0.97 + 0.06 r). Bullion sells at max(U + 1, ceil(1.2 P)) and buys at
min(U, floor(0.8 P)). A counter set moves P by 3% of U; a pig sale pulls it a third of the way to the price paid. Every
30-minute tick, P += U x 0.01 x (2r - 1), then P += 0.05 (U - P), then clamp. Resting listings cross the counter
every tick. Listings: 4 open, 30 posts a day, 24 h, priced 1 to 3U. The newest 120 listings are visible, and a wanted
ad whose pig can't pay is hidden. Bullion's shelf: 3 random finds at each UTC midnight, quoted at the integer midpoint
when ask - bid >= 2, each sold once, moving P like a counter buy. Counter caps are off.

**The economy around it.** The Ghost Sheep makes one 6 h visit per pig per local day, arriving uniformly between
08:00 and 16:00 local. He pays the count (never bank or snouts): 3 / 8 / 20, x2 for his fancy, and the second of a
pair in one visit pays half again on the two. He takes 9 finds a visit. His fancy is replicated exactly
(`unit x 70/25/5`, never yesterday's), which makes it **a common on 99.995% of days**. Digs: one per 8-hour feeding
(anchored at local 05:00); 0/1/2 finds at 30/50/20%, rarity 70/25/5, uniform within a rarity (8 commons, 3 uncommons,
the whistle). Bank: regen 1 an hour to the cap (25; 50 for the 10% in Slop Club); sales may bank past it; a tap
turns 1 bank tickle into 1 count + 1 snout. Friend wishes: 70/25/5, 48 h. Swaps: one per pair per day, 3 count +
3 snouts to each pig, taking from the host's biggest stacks. Season 2 starts fresh: empty bank and Satchel at t = 0.
Errands are flag-off and not modelled. Neither are the trade-up, the Riddle, regen modifiers, friend-targeted
listings or push notifications.

**Pigs.** 30, 150 and 600 daily players: 50% casual (1 session a day), 35% regular (3), 15% engaged (7), at random
times 07:00 to 23:00 local, in US time zones. Each pig has about 2 player-friends. 70% of pigs use the market. Each pig
values a bank tickle at `bw` count: 40% at 1.0 ("a tickle is a tickle"), 40% at 1.5, 20% at 2.0 ("a tap pays a count
**and** a snout"). 30% of market pigs are collectors who want to have held every find. Patient pigs (40/70/90% by
tier) list rather than sell now.

**Policies (greedy and ex ante, in the pig's own worth).**

- A complete set goes to the best of:
  - the Sheep now;
  - Bullion's counter;
  - the best payable wanted ad;
  - a listing inside Bullion's gap, undercutting the cheapest visible one, with its expected value from the live
    24 h fill rate;
  - the Sheep later today, if the pig has a session inside his visit;
  - hold, worth the drift home, discounted 10%.
- The **Sheep loop:** while he is here, buy a set from the cheapest source (shelf, board, counter) whenever handing it
  to him pays at least 1 more count than the bank is worth. Engaged pigs who will be back inside his visit post a
  midpoint wanted ad instead of paying the ask.
- When the Sheep is here, a pig hands over everything he fancies. Of other finds it keeps one of each, for wishes.
  A market pig also keeps stacks that the market pays it more for.
- Collectors buy, or post a wanted ad or a straight-up swap for, any find they have never held.
- Shelf sets are bought when they beat the pig's best use: meeting the find, flipping it on the board, or the Sheep later.
- Multi-session market pigs keep a bank reserve of about one common set; everyone taps the rest.

**Runs.** 28 days at the 30-minute tick, pooled over 8 seeds at 30 players and 3 seeds at 150 and 600.
Steady-state flows are days 8 to 28. A full `--compare` takes about 20 s; `--sweep` about 2.5 min.

## Baseline: the shipped tuning

### 1. Sets

| | 30 | 150 | 600 |
| --- | --- | --- | --- |
| Days to first set held, own finds (casual / regular / engaged, median) | 22.6 / 11.2 / 11.4 | 19.9 / 13.5 / 11.9 | 18.6 / 12.7 / 10.8 |
| Same, had nothing gone to the Sheep | 14.9 / 7.1 / 5.8 | 15.7 / 7.8 / 5.8 | 15.6 / 7.8 / 5.9 |
| Regulars holding a set by day 7 | 22% | 15% | 19% |
| Sets a pig digs a week (common / uncommon / whistle) | 0.96 / 0.56 / 0.09 | 0.99 / 0.58 / 0.08 | 1.04 / 0.59 / 0.09 |

The Sheep buys singles at 1.5x in pairs, so most finds leave before they ever form a set; even a pig who keeps
everything waits a week. **The whistle market is not alive at sets of 3.** Bullion's bid/ask at U is 48/72, and his
ask runs 62 to 83, above both bank caps, so pigs can only buy a whistle set with sale proceeds that bank past the cap.
Pig-to-pig whistle trades are **0.00 a day at every population**. Whistle listings (0.4 / 1.4 / 3.4 a day) expire or
end at Bullion, and collectors are priced out 1.6 / 6.7 / 35 times a day.

### 2. Board liquidity

| | 30 | 150 | 600 |
| --- | --- | --- | --- |
| Visible at a market open: for sale + wanted | 2.7 + 0.8 | 5.7 + 3.9 | 9.6 + 13.6 |
| Listings visible per find | 0.29 | 0.80 | 1.93 |
| Finds (of 12) with any listing | 2.8 | 5.7 | 8.5 |
| Sell listings filled by a pig within 24 h | 30% | 45% | 71% |
| Median time to fill | 10.5 h | 3.0 h | 0.5 h |

**At 30 players the board is half dead for sellers.** Two in three for-sale listings (68%) expire unsold, and a market open
shows three or four cards across fewer than three finds. Something is still new on 94% of opens, mostly a price that
moved.

### 3. Decision quality (one decision per pig, find and day)

| | 30 | 150 | 600 |
| --- | --- | --- | --- |
| Board (list in the gap / take a wanted ad) | 57% / 3% | 53% / 9% | 40% / 18% |
| Sheep (now / later today) | 28% / 3% | 26% / 2% | 26% / 3% |
| Counter | 10% | 10% | 10% |
| Hold | 0% | 0% | 4% |
| Second-best within 15% of the best | 74% | 78% | 77% |

How a pig values bank sorts it into one lane. At 150, a 1.0-valuer gives the Sheep 59% of its sets, and a 2.0-valuer
lists 81% (87% with wanted ads). The choice for a held set is real. The **dominant strategy is on the buy side**: the
loop (section 4).

### 4. The Ghost Sheep loop

| | 30 | 150 | 600 |
| --- | --- | --- | --- |
| Pig-days he is caught | 59% | 60% | 61% |
| Market-pig days with the loop | 52% | 56% | 59% |
| ... of days he was caught | 90% | 96% | 97% |
| By tier (casual / regular / engaged) | 37 / 68 / 77% | 37 / 74 / 90% | 34 / 74 / 94% |
| Count from bought finds, per market pig per day | 21.1 | 21.2 | 22.0 |
| A loop day: median cost, net count over the bank spent | 15 bank, +21 | 16, +20 | 17, +19 |
| Market users' count vs non-users' (same tier) | 1.28x | 1.25x | 1.25x |

Here is the arithmetic. He fancies a common, and four fancied pebbles pay 6 + 12 + 6 + 12 = 36 count. Bullion sells
the set for 13 to 17 bank. **For almost everyone who catches him, it is the best move of the day, every day.**
Across the population, the Sheep pays as much count for bought finds as all tapping produces (87 to 101%): a race
(Contend) advantage bought with snouts.

### 5. Price feel (commons; uncommons and whistle in brackets)

| | 30 | 150 | 600 |
| --- | --- | --- | --- |
| Daily range of P, % of U | 6.4% | 11.8% | 11.0% |
| Days the ask never moved | 20% | 0% | 0% |
| Ticks within 2% of a band edge; mean P/U | 0%, 1.02 | 9%, 1.07 | **41%, 1.11** |
| One counter trade moves the ask / the bid | 45% / 40% | 35% / 37% | **6%** / 37% |
| ... uncommon ask / bid | 90% / 58% | 90% / 64% | 89% / 71% |
| ... whistle | 100% / 100% (no trades) | 100% / 100% | 100% / 100% |

"You moved the price" is always visible on the one-decimal P: a set moves it 0.36 / 0.72 / 1.8 tickles. Bullion's
**integer** prices move on 78 to 84% of trades (bid or ask). At 600 players the loop pins commons near the top of the band,
so the ask sits at 16 or 17 and one more trade changes it only 6% of the time. Quiet prices barely breathe: the
wiggle's stationary spread is 1.8% of U, so a common's ask is frozen all day on a fifth of days at 30 players.

### 6. Bullion's daily shelf

| | 30 | 150 | 600 |
| --- | --- | --- | --- |
| Sets sold | 86% | 90% | 90% |
| Hours after the UTC-midnight drop (median / p90) | 3.0 / 17 | 0.0 / 13 | 0.0 / 0.0 |
| Engaged pigs' share vs their population share | 2.3x | 2.5x | 3.0x |
| Most shelf sets one pig took | 42% | 8% | 5% |

It is a first-come rush from 150 players up. The drop lands at 16:00 to 19:00 US time, and the midpoint quote is a
straight discount on the loop, so engaged pigs take 2.3 to 3x their share. The unsold ~10% are the whistle sets
(quoted at about 60, which nobody can afford): every whistle slot went unsold, and every common slot sold.

### 7. Economy flows, per pig per day (150 players, days 8 to 28)

| | No market | Shipped | Proposed |
| --- | --- | --- | --- |
| Bank regen kept / wasted at the cap | 22.9 / 1.1 | 21.8 / 2.3 | 21.7 / 2.3 |
| Bank tapped (each = 1 count + 1 snout) | 22.9 | 16.1 | 20.8 |
| Bank into Bullion (counter + shelf) | 0 | 6.0 | 1.5 |
| Bank Bullion paid out / pig to pig | 0 / 0 | 0.3 / 0.6 | 0.6 / 1.8 |
| Finds dug | 1.41 | 1.41 | 1.40 |
| Finds Bullion created / consumed | 0 / 0 | **1.47** / 0.05 | 0.31 / 0.10 |
| Finds the Sheep consumed | 1.30 | 2.72 | 1.57 |
| Count from the Sheep (from bought finds) | 8.5 (0) | 22.0 (14.0) | 11.0 (4.3) |
| **Count, total** | **34.8** | **41.9** | **34.9** |
| **Snouts** | **26.3** | **19.9** | **24.0** |

The shipped market is a pipe: bank, then Bullion, then finds, then the Sheep, then count. Bullion **mints more finds
than the dig** (1.47 vs 1.41 a pig a day) and buys back almost none. Market days run +20% count and -24% snouts
against a non-market day; at 30 and 600 the figures are +21% / +22% and -28%. The proposal returns count to the
non-market level (34.8 / 34.9 / 34.9 at 30 / 150 / 600, against 34.7 / 34.8 / 35.0), with snouts 9 to 12% lower.

## Fun, defined for this game

Fun here means the charter's lens made measurable. Each criterion scores 0 to 2 (2 / 1 / 0 at the stated thresholds).

| # | Criterion (pillar) | Measured as | 2 point | 1 point |
| --- | --- | --- | --- | --- |
| 1 | A goal within a week (Collect) | regulars holding a set of their own finds by day 7 | >= 60% | >= 30% |
| 2 | A real choice most days | no outlet takes > 60% of set decisions, and >= 25% are close calls (2nd best within 15%) | both | top <= 75% |
| 3 | No chore, no dominant loop (rendezvous over grind) | market-pig days running the Sheep loop | <= 25% | <= 45% |
| 4 | A reason to check the board, even at 30 players (Connect) | 30 players: sell listings filled within 24 h; finds with any listing per open | >= 50% and >= 3 | >= 25% or >= 2 |
| 5 | Visible consequences (the world responds now) | one counter trade moves Bullion's bid or ask; commons' ask frozen all day | >= 60%, <= 30% | >= 40% |
| 6 | Fair Contend (fair by construction) | market users' count vs non-users', same tier | <= 1.15x | <= 1.35x |
| 7 | A shelf that isn't a rush | engaged pigs' shelf share vs population; one pig's largest share | <= 1.5x, <= 10% | <= 2.5x |
| 8 | Losing feels warm | market users whose bank ledger ends "down" | <= 40% | <= 60% |

| Criterion | Shipped 30 / 150 / 600 | Proposed 30 / 150 / 600 |
| --- | --- | --- |
| 1 A goal within a week | 0 / 0 / 0 (22, 15, 19%) | 2 / 2 / 2 (88, 85, 92%) |
| 2 A real choice | 2 / 2 / 2 | 2 / 2 / 2 |
| 3 No chore | 0 / 0 / 0 (52, 56, 59%) | 1 / 1 / 2 (29, 27, 25%) |
| 4 Board alive at 30 | 1 (30% fill, 2.8 finds) | 2 (61% fill, 4.1 finds) |
| 5 Visible consequences | 2 / 2 / 2 | 2 / 2 / 2 |
| 6 Fair Contend | 1 / 1 / 1 (1.28, 1.25, 1.25x) | 2 / 2 / 2 (1.05, 1.02, 1.01x) |
| 7 Shelf not a rush | 1 / 0 / 0 | 1 / 1 / 1 |
| 8 Losing warm | 0 / 0 / 0 (100% "down") | 1 / 1 / 1 (50, 48, 42%) |
| **Total** | **7 / 6 / 6** | **13 / 13 / 14** |

Criterion 8 is a UX finding on its own. Under the shipped tuning, **every** loop player's ledger ("spent / took in /
up or down") reads *down*, even while the Sheep pays them more count than it cost. The receipt is honest, but it frames
the market's best move as losing.

## Recommended tuning

Every `app_settings.market_tuning` lever, plus the one change outside the market. The smallest set that moves the
score most is the first four rows plus the Sheep rule. Without the Sheep rule the levers score 7 to 8 of 16; the
Sheep rule alone scores 9 to 11.

| Lever | Now | Proposed | Why |
| --- | --- | --- | --- |
| `set_size.common` | 4 | **3** | U 12 becomes 9: bid/ask at U 7/11 (ask 10 to 13). "Three alike" is already the Sheep's trade-up word. A regular's first set falls from about 12 days to 3. |
| `set_size.uncommon` | 3 | **2** | U 24 becomes 16: ask 17 to 23, **under the 25 bank cap**. Was 25 to 34, which nobody outside Slop Club could pay from regen. A pair is the Sheep's own unit (pays half again). |
| `set_size.rare` | 3 | **1** | The whistle trades on its own. U 60 becomes 20, ask 21 to 28 (affordable below P = 1.05U, or at the shelf or board). Pig-to-pig whistle trades go from 0 to 0.4 / 2.9 / 12 a day. |
| `price.lo` / `price.hi` | 0.85 / 1.15 | keep | The band holds the loop-free market comfortably; edge time is 0 to 11%. |
| `price.sell_factor` / `buy_factor` | 1.2 / 0.8 | keep | The cut keeps the invariant below; narrower cuts change little at small U (integer rounding dominates). |
| `price.impact` | 0.03 | **0.05** | Smaller U shrinks each move. At 0.05 a common set moves P 0.45 (was 0.36), and one trade moves Bullion's bid or ask 81 to 90% of the time (68 to 74% at 0.03 with the new sets). Far below the 0.425 ride limit. |
| `price.pig_pull` | 1/3 | keep | |
| `price.wiggle` | 0.01 | **0.02** | Quiet prices breathe: spread 1.8% to 3.7% of U; days a common's ask never moves at 30 players, 20% to 4%. The "quiet" moment gets more to show. |
| `price.home` | 0.05 | keep | A half-life of about 7 h is right for a daily rhythm. |
| `print_chance` | 0.2 / 0.1 / 0.03 | keep | Cosmetic. |
| `list_multiple` | 3 | keep | |
| `open_offers` / `daily_posts` | 4 / 30 | keep | Never binding in the runs. |
| `offer_hours` | 24 | **48** | At 30 players a listing waits longer for its buyer: finds with a listing per open 3.3 to 4.1, fills (ever) to 72%. Expiry is still a warm "it came home". |
| `tick_minutes` / `catch_up_ticks` | 30 / 144 | keep | |
| `counter_caps` | null | keep null | Tested as the loop valve ({buy: 1}): the loop stays on 49 to 52% of days and the count ratio at 1.20 to 1.24x. A cap bounds the chore without removing it. |
| `bullion_board.daily_listings` | 3 | keep 3, watch | It lives up to its launch job at 30 players (sells over hours, adds stock). From 150 up it is a rush whatever the tuning: see Risks. |
| Shelf quote (code: midpoint) | midpoint | keep | Tried ask - 1: no rush at 30 (13 h median), but sold within an hour at 150 and instantly at 600, and one pig's share at 30 rises to 43%. |
| **OUTSIDE the market: the Ghost Sheep's x2 for his fancy** (`trade_with_trader`) | any find | **only a find you did not buy** (bag row `source <> 'market'`) | Kills the loop's margin at its source. A bought set handed to him pays at most 1.5U (the pair bonus), against Bullion's ask of about 1.2U plus rounding. The loop falls from 52 to 59% of market-pig days to 25 to 29%, at +5 to 7 count instead of +20. Count returns to the non-market level, and the race rewards digging ("He pays double for the find you found"). |
| Outside: the Sheep's pair bonus on bought finds | 1.5 | keep | It is the board's demand engine. Tested without it: the loop falls to 11 to 14%, but 30-player fills fall from 61% to 35%. |
| Outside: finds per dig, rarity weights, bank caps, Sheep prices, per-visit cap | as shipped | keep | Set sizes do the work; nothing else needs to move. |

Observed, not changed: the fancy formula (`unit x weight`) makes the Sheep fancy a common on 99.995% of days and never
the whistle. That made the shipped loop cheap and daily. Under the proposal the fancy only touches finds you found, so
it matters much less. If he should sometimes fancy an uncommon, the formula should be a weighted draw (a separate,
trader-side decision).

### The fairness invariant ("the cut is wider than the swing")

For every find, **Bullion's lowest possible selling price is above his highest possible buying price**, so no
sequence of counter trades, by you or anyone, lets a set bought from him sell back to him for more:

- **Float form:** `sell_factor x lo > buy_factor x hi`, i.e. 1.2 x 0.85 = 1.02 > 0.8 x 1.15 = 0.92 (unchanged).
- **Integer form actually in force:** `min over P of ask(P) = max(U + 1, ceil(1.02 U)) > max over P of bid(P) =
  min(U, floor(0.92 U))`. The clamps alone guarantee it for any U (ask >= U + 1 > U >= bid). Proposed: commons ask
  10 to 13 vs bid 6 to 8; uncommons 17 to 23 vs 10 to 14; whistle 21 to 28 vs 13 to 18.
- **Your own trade can't ride the cut:** a buy lifts P by impact x U, and selling straight back pays
  bid(P + impact U) < ask(P) for every P in the band iff `impact < (sell_factor - buy_factor) x lo / buy_factor` =
  0.425. Proposed 0.05.
- **What it never covered: the Sheep.** He pays a different currency (count), so the cut did not protect him. Shipped,
  a bought fancied set paid 3U count against an ask of about 1.25U. With the proposed rule a bought set pays at most
  1.5U: 12 for three commons vs an ask of 11 at U, 24 for an uncommon pair vs 20, 20 for a whistle vs 24. So the cut
  covers the Sheep for any pig who values a bank tickle at 1.2 count or more. A tap pays a count *and* a snout, so it
  should be at least 1.0. The residual is a +2 to +3 count margin on shelf or board sets for "a tickle is a tickle"
  pigs, bounded by one visit and 9 finds.

## Before and after, per population

| | Shipped 30 / 150 / 600 | Proposed 30 / 150 / 600 |
| --- | --- | --- |
| Regular's first set (median days); by day 7 | 11.2 / 13.5 / 12.7; 22 / 15 / 19% | 3.6 / 3.2 / 3.0; 88 / 85 / 92% |
| Casual's first set (median days) | 22.6 / 19.9 / 18.6 | 6.7 / 6.1 / 5.7 |
| Sets dug a pig a week (common / uncommon / whistle), 150 | 0.99 / 0.58 / 0.08 | 1.66 / 1.03 / 0.49 |
| Whistle pig-to-pig trades a day | 0 / 0 / 0 | 0.4 / 2.9 / 12.1 |
| Collectors priced out a day | 1.6 / 6.7 / 35 | 0.1 / 0.4 / 3.1 |
| Visible at an open (for sale + wanted) | 2.7+0.8 / 5.7+3.9 / 9.6+13.6 | 5.5+0.8 / 7.7+3.7 / 11.5+9.4 |
| Finds with any listing per open | 2.8 / 5.7 / 8.5 | 4.1 / 5.0 / 6.5 (fills faster at 600) |
| Sell listings filled in 24 h; median fill | 30 / 45 / 71%; 10.5 / 3.0 / 0.5 h | 61 / 86 / 97%; 10.5 / 2.0 / 0.5 h |
| Set decisions: board / Sheep / counter / hold | 60/31/10/0, 62/28/10/0, 58/29/10/4 | 56/24/16/4, 45/26/15/15, 34/21/11/34 |
| Close calls (2nd best within 15%) | 74 / 78 / 77% | 81 / 78 / 85% |
| Loop: market-pig days; when caught | 52, 56, 59%; 90, 96, 97% | 29, 27, 25%; 49, 46, 40% |
| Net count over bank on a loop day | +21 / +20 / +19 | +7 / +6 / +5 |
| Market users' count vs non-users' | 1.28 / 1.25 / 1.25x | 1.05 / 1.02 / 1.01x |
| One trade moves bid or ask | 80 / 84 / 78% | 90 / 88 / 81% |
| Commons: ask frozen all day; time near a band edge | 20/0/0%; 0/9/41% | 4/1/0%; 0/1/11% |
| Shelf: hours to sell (median); engaged x share; top pig | 3.0/0/0; 2.3/2.5/3.0x; 42/8/5% | 0.5/0/0; 2.3/2.1/2.4x; 22/8/4% |
| Count / snouts a pig a day vs no market (150) | +20% / -24% | +0% / -9% |
| Bullion's finds created vs consumed a pig a day (150) | 1.47 vs 0.05 | 0.31 vs 0.10 |

The proposal's "hold" at 600 is mostly whistles. With a whistle per set, about 0.5 a pig a week arrive, so supply
pushes the whistle's price to about 0.92U, and holders wait for it to wander home. The market is working, and the
"quiet" moment has something to say.

### What else was tried (`--sweep`)

| Variant | Score 30 / 150 / 600 | What it showed |
| --- | --- | --- |
| Shipped | 7 / 6 / 6 | |
| Sheep x2 for found finds only, shipped sets | 9 / 10 / 11 | Fixes the loop and Contend alone; sets still take about 12 days. |
| Sets 3/2/1 only | 7 / 8 / 8 | Faster sets but a **cheaper** loop: the count ratio rises to 1.37x at 30. Never ship smaller sets without the Sheep rule. |
| Sets 3/2/1 + buy cap 1 a day | 9 / 8 / 7 | The cap bounds the chore, doesn't remove it. |
| Proposed with sets 3/3/1 | 13 / 13 / 14 | Uncommons back above the cap (ask 29 at U); 65 to 73% of regulars by day 7. |
| Proposed with sets 3/2/2 | 13 / 12 / 13 | A whistle pair costs 48 at U, above the cap. |
| Proposed with shipped sets 4/3/3 | 9 / 10 / 10 | Shows the set size is half the gain. |
| Proposed + one shelf set per pig a day (code) | 13 / 13 / 13 | No measurable change; drop it. |
| Proposed + per-pig shelf of 1 (code) | 12 / 12 / 12 | No rush (12 to 14 h median), engaged 1.5 to 1.7x, but the loop rises to 33 to 36% and 600-player fills fall from 97% to 74%. |
| Proposed, no shelf | 13 / 13 / 14 | The shelf adds a little stock at 30 players (4.1 vs 2.9 finds listed). |
| Proposed + bought finds earn no pair bonus | 13 / 13 / 14 | Loop 11 to 14%, but the 30-player board thins (35% fills). |

**Robustness** (shipped vs proposed, 30 / 150). The proposal wins under every alternative assumption tried:
adoption 0.4 (5-6 vs 12-13 of 16), friends 1 or 4, Slop Club at 25%, and a minimum profit of 3. Two extremes are worth
knowing. If **every** pig values bank like count (1.0), the residual loop rises to 55 to 57% even under the proposal
(ratio 1.07 to 1.11x); removing the pair bonus on bought finds is then the next valve. If **every** pig values bank at
2.0, almost nobody buys and fills drop to 4 to 6%. The market needs pigs who disagree about what a bank tickle is
worth, and the Sheep's count against Bullion's bank is that disagreement.

## Risks

- **Switching set sizes with listings open loses finds.** Settlement uses the *current* set size, but a listing's escrow
  holds the old count. A 4-pebble listing taken after the switch gives the buyer 3, and the 4th is gone
  (`_market_settle_pig` gives `_market_costs(sz, ...)`). A crossing pays the new U's bid for 4 escrowed finds. Switch
  only on an empty board. The cleanest moment is the Season 2 flip (Mon Nov 9), when the reset guard ends every
  pre-flip listing. Otherwise cancel or expire all open listings in the same migration.
- **Prices need re-seeding at the switch.** Stored P is about 12 for a common. On the next read it clamps to the new
  band's edge (10.35 = 1.15 x 9), and the sparkline shows a cliff. Delete the `market_prices` rows (and
  `market_price_points`) so they re-seed near the new U. The yesterday comparison ("up 0.4") restarts.
- **Copy and fallbacks.** `components/market/MarketSheets.tsx:498` hard-codes "four of a common, three of the rest".
  `constants/market.ts` `MARKET_TUNING` (setSize, impact, wiggle, offerHours) must mirror the server; the client
  already reads set sizes from `market_state`. Onboarding and receipt lines that quote the Sheep's price for a set need
  the new rule.
- **The Sheep rule is code, outside the market.** It needs `trade_with_trader`, carried from its latest def in
  `20261029210000`: `was_want := item.find_id = v.want_find_id AND item.source <> 'market'`. The trader sheet must price
  a bought find at x1, so its payload needs each bag row's source. It also needs a SKILL.md decision. Laundering: a
  bought find given to a friend on a visit becomes `gift` (the swap rewrites `source`) and earns that friend x2. That
  is bounded by one swap per pair per day and the friend's wish matching. Accept it and watch it.
- **The shelf stays a rush from about 150 players** (2.1 to 2.4x engaged share in every variant). The founder chose a
  shared stock. If it matters, the fair-by-construction fix is a per-pig shelf; its trade-offs are above. The cheap
  valve is `daily_listings` down to 1 or 0 once the board is busy enough not to need it.
- **Model risk.** Policies are greedy and numerate; valuations, adoption and collector share are assumptions; the
  thresholds are mine. Real pigs are less consistent. The shipped loop's margin, though, is large (+20 count on a
  15-bank buy) and his sheet prints it.
- **More wiggle means more noise moments.** `wanderingHome` (2% of U, 3 h quiet) will fire more often from noise.
  Fine for a once-per-install moment.

## What to watch after launch

Weekly, with `scripts/market-economy.sql` (Q1 to Q6) plus three additions:

1. **The loop** (Q1): count the Sheep paid for finds bought that day, against the bank spent. Healthy: under 15% of
   trader count and under 30% of market-pig days. Over 45%: drop the pair bonus on bought finds.
2. **Board health** (Q6): sell listings filled by a pig within 24 h (healthy >= 50% at launch size), median time to fill,
   and expired share.
3. **Prices** (Q4): share of ticks within 2% of a band edge per find. Over 25% for a week means one-way pressure; look
   at impact and Bullion's cut for that find.
4. **Bullion as a faucet** (Q5, plus finds): sets he sold vs bought per day x set size. Healthy: he creates no more than
   about a third of what the dig does.
5. **New: time to first set.** For each pig with a fresh Season 2 bag, the first time any find reaches its set size.
   Healthy: median under 5 days for daily diggers.
6. **New: the shelf.** Minutes from the UTC-midnight drop to each sale, and the top buyer's share per week. Over 20%
   of a week's sets to one pig, or sold out within 15 minutes on most days: turn `daily_listings` down.
7. **New: Contend.** Season count per day for pigs with any market trade vs pigs with none, same activity band.
   Healthy: within 15%.

## Reproduce

```sh
python3 tools/balance_market.py --compare --seeds 3 --small-seeds 8   # baseline vs proposal vs no market + scorecards
python3 tools/balance_market.py --sweep --seeds 3 --small-seeds 8     # every variant + robustness tables
python3 tools/balance_market.py --tuning proposed --set shelf_n=0 --pops 30   # any lever, any population
```

`--set` overrides any lever (`set_size.common` is `set_size.c`; `counter_caps=[null,1]`; `fancy_found_only=true`;
`shelf_mode=per_pig`). `--adoption`, `--bw-mix`, `--collectors`, `--friend-degree`, `--vip` and `--min-profit`
change the population.
