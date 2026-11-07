-- Bullion's Market — the economy watch. READ-ONLY queries for the Supabase SQL
-- editor (or psql). Run weekly after launch; every number is from the ledgers
-- (market_trades, market_ledgers, market_prices, trader_sales), never a guess.
--
-- What to look for:
--   Q1 the Sheep loop: pigs who buy a set at Bullion's counter and hand it to
--      their Ghost Sheep the same day for more (score) tickles than it cost.
--   Q2 who profits from the market itself (took in − spent), top 20.
--   Q3 how much the counter is used vs the board, per day.
--   Q4 where prices sit vs their usual price (pinned at a band edge = one-way
--      pressure: Bullion's cut or impact may be wrong for that find).
--   Q5 tickles in and out of the bank through Bullion (the market's net faucet).
--   Q6 the board's health: listings posted, filled, crossed, expired, lapsed.
-- Levers (app_settings.market_tuning, no build needed): price.sell_factor /
-- buy_factor (his cut), price.impact, counter_caps {"sell": n, "buy": n}.

-- Q1. The Sheep loop: per pig, find and UTC day, bank tickles spent buying sets
-- at the counter vs score tickles the Ghost Sheep paid for that find that day.
WITH buys AS (
	SELECT tr.buyer_id AS user_id, tr.find_id, tr.created_at::date AS day,
	       COUNT(*) AS sets_bought, SUM(tr.price) AS spent_bank
	FROM public.market_trades tr
	WHERE tr.kind = 'counter' AND tr.side = 'buy' AND tr.created_at > now() - interval '7 days'
	GROUP BY 1, 2, 3
), sheep AS (
	SELECT s.user_id, s.find_id, s.created_at::date AS day, SUM(s.tickles) AS sheep_paid, COUNT(*) AS finds_sold
	FROM public.trader_sales s
	WHERE s.kind = 'sale' AND s.created_at > now() - interval '7 days'
	GROUP BY 1, 2, 3
)
SELECT p.username, b.day, b.find_id, b.sets_bought, b.spent_bank, sh.finds_sold, sh.sheep_paid,
       sh.sheep_paid - b.spent_bank AS gain
FROM buys b
JOIN sheep sh USING (user_id, find_id, day)
JOIN public.profiles p ON p.id = b.user_id
ORDER BY gain DESC
LIMIT 25;

-- Q2. Market profit by pig (bank tickles in − out), top 20 either way.
SELECT p.username, l.took_in, l.spent, l.took_in - l.spent AS net
FROM public.market_ledgers l JOIN public.profiles p ON p.id = l.user_id
ORDER BY abs(l.took_in - l.spent) DESC
LIMIT 20;

-- Q3. Counter vs board, per day.
SELECT date_trunc('day', created_at)::date AS day,
       COUNT(*) FILTER (WHERE kind = 'counter' AND side = 'sell') AS sold_to_bullion,
       COUNT(*) FILTER (WHERE kind = 'counter' AND side = 'buy')  AS bought_from_bullion,
       COUNT(*) FILTER (WHERE kind = 'pig')  AS pig_sales,
       COUNT(*) FILTER (WHERE kind = 'swap') AS swaps,
       COUNT(DISTINCT COALESCE(seller_id, buyer_id)) FILTER (WHERE kind <> 'print') AS pigs_trading
FROM public.market_trades
WHERE created_at > now() - interval '14 days'
GROUP BY 1 ORDER BY 1 DESC;

-- Q4. Prices vs usual (1.00 = home; 0.85 / 1.15 = pinned at a band edge).
SELECT mp.find_id, sf.rarity, ROUND(mp.price, 2) AS price,
       ROUND(mp.price / (public._market_usual(mp.find_id, public._market_tuning())), 3) AS vs_usual,
       mp.tick - mp.last_active_tick AS quiet_ticks
FROM public.market_prices mp JOIN public.satchel_finds sf ON sf.id = mp.find_id
ORDER BY vs_usual DESC;

-- Q5. Bullion as a faucet/sink of bank tickles (positive = he paid out more).
SELECT date_trunc('day', created_at)::date AS day,
       SUM(price) FILTER (WHERE kind = 'counter' AND side = 'sell') AS bullion_paid,
       SUM(price) FILTER (WHERE kind = 'counter' AND side = 'buy')  AS bullion_charged,
       COALESCE(SUM(price) FILTER (WHERE kind = 'counter' AND side = 'sell'), 0)
         - COALESCE(SUM(price) FILTER (WHERE kind = 'counter' AND side = 'buy'), 0) AS net_to_pigs
FROM public.market_trades
WHERE created_at > now() - interval '14 days'
GROUP BY 1 ORDER BY 1 DESC;

-- Q6. The noticeboard's health.
SELECT side, status, COUNT(*) AS listings,
       COUNT(*) FILTER (WHERE target_id IS NOT NULL) AS to_one_friend
FROM public.market_offers
WHERE created_at > now() - interval '14 days'
GROUP BY side, status ORDER BY side, listings DESC;
