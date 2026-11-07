# Brief: a tiny stock market for a cozy pig game (critique + alternatives wanted)

## The game
"Tickle the Pig" is a cozy mobile game (iOS). Friends form herds ("Sounders"). Each player has a pig (Rosie). Charter: Connect friends, Collect things, Contend as a herd. Design lens: a player must be able to hold any mechanic in ONE sentence; losing must still feel warm (no shame states, no public zeros); fairness by construction (server-side, no exploits); no pay-to-win; no new currencies.

## The economy today
- **Tickles (the "tickled" count)**: a big per-player number (hundreds to thousands) that only goes up today. Earned by tapping your pig (from a small regenerating bank of 25), digging, events. It is also the per-player leaderboard score. It never converts into the shop currency.
- **Snouts**: the shop currency (cosmetics). Off-limits for this feature.
- **Finds**: 12 small countryside objects (river pebble, blue feather, four-leaf clover, snail shell, brass button, tuft of wool, red berries, pinecone = common; old key, honeycomb chip, glass marble = uncommon; tin whistle = rare). Dropped by digging: ~0.9 finds per dig, 1 to 3 digs a day, rarity odds 70/25/5. They live in an unbounded bag (the Satchel). Today a find can be: given or swapped 1-for-1 to a friend on a visit (both get a flat 3 tickles, capped per day), or sold to the Ghost Sheep.
- **The Ghost Sheep Trader**: a hooded wandering NPC who visits each player once a day for 6 hours at a random time (seeded per player per day). He buys finds for tickles: 3 / 8 / 20 by rarity, ×2 for the one find he "fancies" that day (different per player), a pair in one visit pays half again, three alike trade up one rarity, max 9 finds per visit. Finds he takes are consumed (he is the only find sink).

## The founder's ask
"A little stock-market-style experience with a simple order book where players can buy, sell, and trade items using tickles as the currency. For example, you might buy something for five tickles and later sell it to the trader for seven. Introduce a new stock-market character, possibly a bull. Keep buying, selling and the order book simple, approachable, and fun. Players should understand what their items are worth and how much they've made or lost. A playful way to learn how markets work while encouraging player-to-player trading."

## My draft (to be attacked)
**One sentence:** *Bullion the bull buys and sells finds for tickles at prices that move; post your own price and another pig can take it.*

1. **What trades:** only the 12 finds. Never cosmetics, never anything bought with money.
2. **Money:** the tickled count (same tickles the Ghost Sheep pays), so "buy for 5, sell to the Sheep for 7" is literally +2. Snouts untouched.
3. **Bullion (market maker NPC)**, one global market for all players, always open:
   - quotes a buy price (bid) and sell price (ask) per find;
   - **only sells finds a pig sold him** (his shelf is real stock; nothing is minted);
   - price per find = base (3/8/20 by rarity) × stock factor (each find below his target stock +8%, above −8%, clamped 0.5×..1.5×) × today's news factor; bid = floor(0.75 × mid), ask = ceil(1.25 × mid). So a common at target: he pays 2, asks 4; the Sheep pays 3 (6 when fancied).
   - shelf cap per find (e.g. 40): when full he stops buying that find ("no buyers today").
   - **Daily news**: one seeded headline a day, same for everyone, moves one find up (×1.5) or down (×0.7): "The Ghost Sheep has been asking around for old keys", "A wet night: snail shells everywhere".
4. **Pig offers (limit orders, quantity 1 each):** post "selling a pinecone for 5" (the find leaves your bag into the offer) or "buying a pinecone for 3" (the tickles are set aside). Offers expire after 48 h, cancel any time, max 6 open per pig, price band 1..3× base. Placing an offer fills immediately if it crosses the best price on the book (a pig's or Bullion's, at the resting price), otherwise it rests. Bullion never takes resting pig offers later.
   - "Buy now" / "Sell now" = take the best price on the book (pig or Bullion), with a stale-price guard (fails as "the price moved" if the quote changed).
   - Pig offers naturally sit inside Bullion's spread, so pig-to-pig trades beat him for both sides: that is the encouragement to trade with players. Friends' offers are named and marked.
   - Push when your offer fills: "Maya bought your pinecone for 5".
5. **Worth and profit:** every find in the bag carries a cost basis (dug = 0, bought = price paid). Holdings show "3 held · paid 10 · worth 12 now · up 2", worth = what Bullion pays right now. Each sale's receipt says "+2 on what you paid". A lifetime "made at the market" line.
6. **The Ghost Sheep's role:** the collector who takes finds out of the world; his personal ×2 fancy means different pigs value different finds differently each day, which is the reason to trade. The market shows "your Sheep fancies pinecones today (pays 6)".
7. **Faucet math:** Bullion's bid < the Sheep's price, and every round trip through Bullion is a net sink (ask > bid), so the most tickles any one find can ever mint is max(Sheep price, Bullion's bid). P2P is zero-sum.

## What I want from you
1. Attack the draft: exploits (wash trading between friends/alts to move score, cornering Bullion's shelf, sniping the news, griefing with offers), confusing parts, anything that needs two explanations.
2. Propose ONE materially different alternative mechanic that also meets the ask (e.g. no NPC market maker; or an auction/clearing price once a day; or a "market day" rhythm), with its one sentence.
3. Name ideas for the bull and the market (cozy, punny, short). Two or three personality notes that contrast him with the quiet hooded Ghost Sheep.
4. The 3 to 5 market lessons this should teach without ever saying "lesson", and the plain-word labels you'd use on screen (e.g. what to call bid/ask/spread/limit order for a 10-year-old and a 40-year-old at once).
5. Any number you'd change (spread, stock factor, cap, offer expiry, band).

Be concrete and brief: bullet points, under ~700 words.
