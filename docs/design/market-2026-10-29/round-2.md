# Bullion's Market, round 2: sets, straight up, outlets, and a market you can feel (2026-10-29)

Founder notes on round 1 (the built pig-to-pig board):

> *"Can we think through some different options for the UI for this. Maybe make it feel a little more like a market? … The tickles are what are used to trade here. Basically the optimization should be to sell high to others. We need to think about other outlets. We need to trade in sets of 3 or 4 of the item. We can also trade straight up."*

What that changes, in one line each:

1. **The game is selling high to other pigs.** The seller's skill is the point, so the screen should make a good sale feel like a win and make demand visible (who wants what, and why).
2. **More outlets.** A pig only pays a high price for a find it can use. Round 1 had one outlet (the Ghost Sheep) plus friends' wishes. Round 2 adds demand that wants *sets*.
3. **Sets, not singles.** Every offer is a set of one find.
4. **Straight up.** A set can be swapped for finds with no tickles changing hands.
5. **Market feel.** Four UI directions on a new canvas (below); the round-1 slate becomes one of the inputs, not the answer.

## Sets

**Proposed: a set is three of one find, for every find; the tin whistle trades alone.** (Revised after Codex's review, `codex-round-2.md`.)

- Rarity-sized sets (four commons, three uncommons) would mislead: there are eight commons, so one *specific* common drops barely more often than one specific uncommon (70%/8 = 8.8% vs 25%/3 = 8.3% of finds).
- Three matches the Ghost Sheep's "three alike trade up", so a set is already a shape players know.
- A "3 or 4, your choice" rule splits a thin board into 3-sets and 4-sets. Fixed three, with the price per find shown beside the set price, keeps every pinecone price comparable.
- **Supply is the catch.** At two digs a day a pig finds about 1.8 finds, spread across twelve kinds, so three of one *specific* find takes about 19 days from empty (four takes about 25). Sellers will have a set every week or so of whatever they happen to stack up; a buyer chasing one particular set will usually have to buy it. That is the market working, but the board will be thin at first. Levers if it is too thin: finds per dig in The Feast's tuning, and errands.
- Leftovers stay useful: two pinecones still go to the Sheep, a friend's wish, or a straight-up swap's asking side.

## Straight up

An offer is priced in tickles **or** in finds: *"3 pinecones for 1 old key."* You give one set and ask for 1 to 3 of one other find (singles allowed on the asking side, so a set can buy the one thing you're missing). Both sides move at once; no tickles, nothing minted. It shows under both finds ("swaps for an old key" under pinecones; "a pig gives 3 pinecones for one" under old keys).

## Outlets: why a pig would pay a high price

| Outlet | Status | What it wants | Why it raises prices between pigs |
| --- | --- | --- | --- |
| **The Ghost Sheep** | live | singles; ×2 for his fancy, pairs pay half again, three alike trade up | His fancy differs per pig, so the same pinecone is worth 3 to you and 6 to Maya today. |
| **A friend's wish** | live | one find a friend's pig is hoping for | Buying the find a friend wants and handing it over pays you both 3 and grows the bond. |
| **The Stamp Book** | **new, proposed for v1** | one set of each find, handed to Bullion | Each set becomes that find's illustrated stamp; every four stamps unlocks a cosmetic. A missing stamp is a specific shopping target. Consumes finds, mints no tickles. (Codex's top pick for buying per build effort.) |
| **Bullion's Orders** | **new, proposed for v1** | a set of three commons | Personal and calm: each pig sees its own short menu of town orders ("the miller wants 3 red berries: 14"), accepts one, and has a week to fill it; at most two a week. The pay sits above what the Sheep gives for the set, so a pig holding the order can pay another pig 11 or 12 and still come out ahead. No global race, no speed bonus. This is the one new place tickles enter: at most 28 a pig a week. |
| **The workbench** | later | sets in a recipe: 3 pinecones + 3 berries make a table decoration | Finishing the second ingredient is a strong reason to buy. Needs recipe art the pipeline can feed. |
| **The herd's Larder** (The Feast) | later | sets stocked for the season | The Sounder wants them together (Contend); a personal keepsake for contributing. Weaker pull, since others can carry the goal. |

Every outlet a find has is printed on its page, with the buyer's gain spelled out: *"Pay 11 for these three, fill your miller's order for 14."* A good sale never needs a "fair price" label; the seller's surplus and the buyer's reason are both on screen.

## The money, in plain words

The app shows two tickle numbers:

- **the coin** (top right, "18 of 25 ready"): the tickles in your pocket, refilled over time, spent by tickling Rosie;
- **the tickled total** (top left): every tickle you've ever given, the number the Board ranks.

Round 1 trades with **the coin**: buying spends it, selling adds to it (past 25 is fine), so profit from selling high piles up as tickles you can spend. The tickled total and the Board never move when you trade.

## UI directions (canvas: see the link in the round-2 summary)

All four carry the same rules (sets, straight up, Orders, the Ghost Sheep on every find), so they compare as looks, not mechanics. The one exception is the Sale Ring, which sells sets at timed auctions instead of fixed prices.

| | Direction | The feel | Home | Best at |
| --- | --- | --- | --- | --- |
| **A** | **The Market Square** | a farmers' market | a painted square: every pig selling has a stall (awning, pig face, baskets of sets on the counter), friends' stalls first, Bullion at the bell, the day's Orders on a noticeboard | every trade has a pig; warmest |
| **B** | **The Big Board** | a stock exchange | a huge chalk price board: one row per find with last price, up/down, sets selling and wanted; a ticker of real deals across the top | reading prices; closest to the first "stock market" ask |
| **C** | **The Sale Ring** | a livestock sale | sets go into the ring as lots with a closing time; pigs bid, the gavel falls on the highest | drama, and the highest price is found for the seller |
| **D** | **The Market Paper** | a market-day newspaper | a front page with yesterday's prices and a headline from real trades, then the classifieds: FOR SALE, WANTED, WILL SWAP | straight-up swaps read naturally as ads |
