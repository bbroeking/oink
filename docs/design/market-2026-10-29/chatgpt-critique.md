# ChatGPT critique of the market draft (chatgpt.com, 2026-10-29)

Condensed from the reply to `brief.md` (the full exchange lives in the founder's ChatGPT history, "Stock Market Alternatives").

**Verdict:** keep Bullion and player-to-player trading; cut the dynamic NPC market maker for v1. The draft has a good economic foundation but adds stock manipulation, score inflation and too many pricing rules for a cozy game.

## Attacks

- **Tickles cannot both only go up and be spendable.** Separate the leaderboard view (never decreases) from a spendable balance; no new currency, two views of existing tickles.
- **Wash trading inflates scores.** Only newly earned tickles should count toward the leaderboard; transfers, refunds and returned escrow never count.
- **The Sheep becomes an arbitrage machine** if Bullion sells cheap to whoever's Sheep fancies the find.
- **Bullion's shelf can be manipulated:** at ±8% a unit, seven units hit the clamp.
- **The faucet claim is incorrect:** Bullion's bid can exceed the Sheep's price under scarcity and news, and one find can cycle repeatedly. The invariant should be that NPC purchases are funded or capped.
- **Daily news rewards sniping** the reset.
- **The board can be griefed** with post-and-cancel or slot hogging.
- **The one sentence hides six explanations:** inventory pricing, news, spread, matching, cost basis, Sheep arbitrage.
- **"Paid 10 · Worth 12 · Up 2" is the most dangerous screen:** the +2 isn't real until someone buys. Show real sale proceeds in receipts.

## Alternative: the Daily Pig Market

*"Put a find up for sale, name your price, and another pig can buy it with Tickles."* No NPC market maker, no news multiplier, no inventory algorithm. Listings sorted cheapest first, instant buy, unsold finds return after 24 h, the Ghost Sheep stays the guaranteed outlet, a board of real last-sold prices. The Sheep anchors prices; a pig whose Sheep fancies pinecones will happily pay 4 or 5.

## Names and personality

Bullion the Bull; the Snout Exchange (alternatives: Bramble Bull / Bramble Bazaar, Sir Loin / the Trading Post, Benny Bull / the Pig Pit). The Sheep whispers and appears mysteriously; Bullion loudly announces every sale, loves even tiny deals, and celebrates a completed trade either way: "A fine deal between fine pigs!"

## Labels

Bid / ask → "I'll pay" / "I'm asking" · spread → "difference" · limit order → "my offer" · market price → "last sold for" · profit → "You paid 4 · sold for 6 · gained 2". Avoid stock charts, percentages and red losses in v1.

## Numbers

Remove the NPC spread, stock factor and shelf cap; news as flavour only; expiry 48 h → 24 h; open offers 6 → 3; band 1 to 4× base; quantity 1; no fee; server-side escrow and atomic settlement; a 10-minute minimum listing life; no tickles for volume; friends visible but never prioritised.

## Ship order it proposed

v1 listings + instant buy + recent sales + the Sheep's prices beside offers; v1.1 market chatter from real trades; v2 "I'll pay X" buy offers if pigs want finds nobody lists. Strongest recommendation: the Ghost Sheep is the source of interesting price differences and Bullion the facilitator, rather than two NPCs pricing the same objects.
