# Codex critique of the market draft (codex exec, gpt-6-astra, high effort, 2026-10-29)

**I’d ship a player market first. Bullion’s moving inventory prices add more complexity than useful trading.**

- **The biggest conflict is spending your leaderboard score.** Buying a feather feels like losing progress; friends/alts can funnel tickles into one account through overpriced purchases. Wash trades can also inflate personal profit records. Keep spendable tickles, but make the leaderboard count only direct gameplay earnings, excluding market receipts **and Sheep sales**, since gifted finds can funnel those too. That adds a score definition, not a currency. If this change is unacceptable, spending tickles conflicts with your fairness charter.

- **The faucet proof is false.** Your formula lets Bullion ask **9** for a rare at minimum stock/news factors and later pay **33** at maximum factors: repeated price changes permit repeated minting from the same find. His maximum bid also exceeds the Sheep’s ordinary 20. If pair and fancy bonuses stack, the Sheep pays **60 per rare** in a fancied pair. Model total issuance across trades, bonuses and trade-ups; a positive spread only prevents profit from an immediate, unchanged-price round trip.

- **A global shelf of 40 is easy to dominate.** Seven finds away from target already hits your stock-factor clamp. A few players can move prices, empty shelves or fill them to deny other sellers access. Scheduled news rewards camping the reset; personalized Sheep fancies create intended arbitrage, but wealthy players can capture much of it.

- **“Worth” promises liquidity you don’t have.** Bullion might quote 12 but lack capacity to buy all your holdings—or stop buying entirely. His lowest common bid rounds to **zero**. Use “Best offer: 4 · buying 2,” and calculate whole-bag value only against executable demand. Gifts, swaps and trade-ups also need cost rules; otherwise “profit” becomes fiction. Drop lifetime profit initially; show purchase-and-sale receipts where the cost is known.

- **Several rules need a second explanation.** Why doesn’t a resting offer fill when Bullion’s price crosses it? Why can I post a price but still lose the race? Why does buying reduce my score? Why is my “worth” unavailable? Also, your actual Sheep prices don’t include 7; demonstrate **buy for 5, sell for 6, gain 1**.

- **Offers need protection, not just escrow.** Match and settle atomically on the server, make retries idempotent, prevent self-matching, and rate-limit posting/canceling. Honor “pay at most” / “receive at least,” accepting improved prices instead of failing every changed quote. Hide identities until execution to reduce targeted transfers and social pressure; this does not eliminate collusion.

**Alternative — Bullion’s village noticeboard**

- **One sentence:** *“Tell Bullion what you’ll pay or accept for a find, and he matches you with another pig when your prices agree.”*
- No NPC inventory, stock formula or news shocks. Show player buy/sell offers; crossing offers fill at the resting price, with earliest offers winning ties. Ghost Sheep remains the only NPC purchaser and sink. Personal fancies create different valuations.
- Start with **3 open offers per pig, one find each, 24-hour expiry, prices 1–3× rarity base**. The upper bound accommodates stacked Sheep bonuses. Show “No offer yet” when empty; return expired escrow with “Back in your satchel.” Expect thin trading, especially for whistles.
- Keep the common’s **2/4 spread** if retaining Bullion: it leaves one clear player price, 3. Remove news initially and replace the ±8%-per-item rule with population-scaled inventory bands.

**Names, personality and quiet discoveries**

- Bull: **Bullion, Barley, Sir Loin**. Market: **Hay Exchange, Snout & About, Clover Market**. He’s chatty, wears a crooked bow tie, and celebrates both pigs getting what they wanted—contrasting with the Sheep’s quiet mystery.
- **Different buyers value things differently:** “Your Sheep pays…”
- **A posted price isn’t a completed sale:** “Your offer” / “Last sold for…”
- **Buying and selling prices differ:** “Buy now” / “Sell now” / “Price gap.”
- **Waiting may help, but guarantees nothing:** “Pay up to…” / “Sell for at least…”
- **Proceeds aren’t profit:** “Paid 5 · received 6 · gained 1.” Loss receipt: “Paid 5 · received 4 · 1 fewer tickle.” Private, neutral, no red shame badge.
