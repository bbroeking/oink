# Bullion's Market, round 4: one price, two ways to trade (2026-10-30)

Founder ask:

> *"How do we make this work as a two-part system? 1. Instant buying and selling, with trades moving the price over time and slight price jitter when there's no trading activity. 2. Trading directly with other users, possibly through simple straight-up swaps. How should those two mechanisms work together?"* Plus designs for both parts and the feature's onboarding (instant buying and selling, how prices move, trading directly with other players).

## The answer in one breath

**Every find has one price. You can trade at it two ways: instantly at Bullion's counter, where he takes a small cut, or directly with another pig, where there's no cut but you need a partner.**

| | **Part 1 · The Counter** (instant) | **Part 2 · The Noticeboard** (direct) |
| --- | --- | --- |
| Who's on the other side | Bullion, always | another pig |
| When it happens | now | when a pig takes your listing, or you take theirs |
| The price | Bullion **sells** a little over the price and **buys** a little under it (his cut) | whatever the two pigs agree; a listing shows how it compares to the price |
| What moves the price | every set bought pushes it **up**, every set sold pulls it **down**; quiet hours it **wiggles** and **drifts back** to its usual level | a pig-to-pig sale nudges it a third of the way toward what was paid; swaps don't move it |
| Best for | a quick sale, or a set you need right now | **selling high** and **buying cheap**; trading finds straight up; trading with friends |

### How they work together

1. **The price is the yardstick for everything.** Every listing on the noticeboard wears a tag against it ("3 under the price", "2 over"); every swap shows both sides at today's price ("4 pinecones ≈ 12 · 1 old key ≈ 8"). A player always knows whether a deal is good.
2. **The counter is the safety net; the noticeboard is the better deal.** You can always sell a set to Bullion right now, or list it to pigs for more. A buyer can always buy from Bullion right now, or pay a pig less. A listing priced between Bullion's two prices beats the counter for *both* pigs. That gap is where player trading lives, and it is what "sell high to others" means.
3. **The counter keeps the noticeboard honest.** A listing priced at or under what Bullion pays sells to him at once (you get his better price); one at or over what he charges just sits (a buyer would go to him). So listings settle inside the gap on their own.
4. **One tape, one chart.** Counter trades, pig sales and the townsfolk's small trades all print on the same tape and the same chart.
5. **The outlets are why prices differ between pigs.** The Ghost Sheep's per-pig fancy, a friend's wish, (later) orders and stamps make a set worth more to one pig than another, so a pig will pay above Bullion's buying price to another pig, and both come out ahead.

## Part 1 · The Counter: instant buying and selling

- **The usual price** of a set = the Ghost Sheep's price for one find × set size (pinecones 3 × 4 = 12, old keys 8 × 3 = 24, tin whistles 20 × 3 = 60).
- **The price** moves inside **0.85x to 1.15x** of the usual price.
- **Bullion sells** a set at **1.2x the price**, rounded up, never below the usual price + 1. **Bullion buys** a set at **0.8x the price**, rounded down, never above the usual price.
- **Each set bought at the counter pushes the price up 3% of the usual price; each set sold pulls it down 3%.** The confirm sheet shows it before you tap: *"Buy for 15. The price goes 12 → 12.4."*
- **When it's quiet** (every 30 minutes): the townsfolk's small trades wiggle the price up to ±1% of the usual price, and it drifts 5% of the way back toward the usual price. A price pushed to the top by a rush of buyers settles back over a day or two.
- **A pig-to-pig sale** moves the price a third of the way toward what was paid.
- **No daily caps by default.** The cut and the coin are the limits: a round trip at the counter always loses (see Fairness), and a pig's coin refills at about 24 a day. Caps stay as a tuning valve.

### Fairness by construction

- Bullion's best possible buying price (0.8 × 1.15 = **0.92** of the usual price) is below his worst possible selling price (1.2 × 0.85 = **1.02**), and the code clamps them to "never above the usual price" and "never below the usual price + 1". So **buying from Bullion and selling back to him always loses, whatever the price has done in between**, and no amount of pushing the price can make a loop pay. (The rule that makes it hold: the cut, 20%, is wider than the price's swing, 15%.)
- Pushing the price yourself costs you: you pay the counter's selling price on every set you buy to push it.
- What the counter adds to the economy is bounded by digging (pigs can only sell him what they dig) and by the coin (pigs can only buy what they can pay for at a premium).

## Part 2 · The Noticeboard: trading directly with pigs

- **For sale:** a set for tickles. The board suggests the middle of Bullion's two prices; the price-tag chip compares it to the price.
- **Wanted:** "I'll pay 13 for 4 pinecones." Not set aside; paid when a pig fills it, lapses if you've tickled the tickles away.
- **Straight up:** a set for 1 to N of another find ("4 pinecones for 1 old key"), with both sides valued at today's price.
- **To a friend:** any listing can be sent to one friend instead of the whole board ("Offer it to Maya"). It lands in their Inbox and on a visit to your Barn. (New: the round-3 server has public listings only.)
- **Limits:** 4 listings up at a time, 24 hours each, cancel any time. Friends are named; other pigs are "a pig" until a trade names them.
- **Selling high feels like it:** the receipt says how much better than the counter you did ("Maya paid 14 · Bullion would have paid 9 · +5 for listing it").

## Onboarding

**When:** the first time a pig opens the Market (the fan row wears a "new here?" tag until then), a three-card sheet in Bullion's voice, then one guided first trade. Same pattern as the Pop-up Stall's onboarding (2026-10-29).

1. **"Buy or sell any set, any time."** Bullion at his counter. *"Hand me a set and I'll pay you on the spot. Need a set? I've always got one. Four of a common, three of anything else."*
2. **"Prices move."** A small live chart. *"Every set you buy from me pushes the price up. Every set you sell pulls it down. When it's quiet the price wiggles, then wanders back home. I buy a little under the price and sell a little over: that's my cut."*
3. **"Or trade with a pig."** The noticeboard. *"Post your set on the noticeboard at your own price, or swap it straight up. Price it between my two prices and you'll both beat my counter. That's how you sell high."*
4. **Ends on "Step up to the counter".** A coach mark then points at a set the pig already holds: *"You've got 4 pinecones. Sell them to me for 9, or put them on the board for more?"* Either choice completes onboarding.

**Moments after onboarding** (once each): the first time you move a price ("You moved the price! 12 → 12.4"), the first quiet drift you see ("Nobody's traded pinecones for a while: the price is wandering home"), the first listing that beats the counter ("Maya paid 5 more than I would have. Nice selling.").

## What changes on the server (after the founder picks)

The round-3 migration already has the pieces; the delta:

- The town's price (`ref`) moves with **counter trades** (±3% of the usual price per set) and **pig sales** (a third of the way to the price paid); its idle step shrinks to ±1% with a 5% pull home; band 0.85–1.15; quotes 0.8 / 1.2 (guards unchanged).
- The **patient townsfolk fills go**: listings on the noticeboard sell to pigs only. A listing at or under the counter's buying price still sells to Bullion at once.
- The daily town caps default to off (tuning stays).
- **Offers to one friend:** `market_offers.target_user_id`, shown only to that friend, plus an Inbox row.
- Player-facing names: the town's quotes become **Bullion's counter**; the townsfolk stay as flavor on the tape (their trades are the jitter).
