-- "Wasted tickles" leaderboard — how many tickles each player has lost to
-- the bank cap since they last touched their balance.
--
-- Tickles regen +1/hr (VIP: +1 per 30min) up to a cap of 25 (VIP: 50).
-- tickle_balance clamps at the cap: LEAST(cap, item_count + elapsed_regen).
-- So the WASTED amount = the overflow the clamp threw away:
--     GREATEST(0, (item_count + raw_regen) - cap)
-- e.g. parked at 25 for 3h → raw = 28, cap = 25 → 3 wasted. ✔
--
-- IMPORTANT: this is a SNAPSHOT. item_count + last_increment only reflect
-- the state since the player last spent/was granted tickles — there's no
-- history table, so this is "wasted since last touch," NOT a lifetime total.
-- last_increment is NOT bumped by read-only balance checks, so an idle
-- player parked at full keeps accruing waste here — which is exactly the
-- "who leaves tickles on the table" ranking you want.

SELECT
    p.username,
    ui.item_count                                   AS stored_count,
    cfg.cap,
    -- raw (uncapped) regen the player would have if the cap didn't exist
    (ui.item_count + floor(
        EXTRACT(EPOCH FROM (now() - ui.last_increment)) / cfg.regen_secs
    )::int)                                          AS uncapped_balance,
    -- the leaderboard number: tickles eaten by the cap
    GREATEST(0,
        (ui.item_count + floor(
            EXTRACT(EPOCH FROM (now() - ui.last_increment)) / cfg.regen_secs
        )::int) - cfg.cap
    )                                                AS wasted_tickles
FROM public.user_items ui
JOIN public.profiles p ON p.id = ui.user_id
CROSS JOIN LATERAL (
    SELECT
        CASE WHEN COALESCE(p.is_vip, false) THEN 50   ELSE 25   END AS cap,
        CASE WHEN COALESCE(p.is_vip, false) THEN 1800 ELSE 3600 END AS regen_secs
) cfg
WHERE p.username IS NOT NULL AND p.username <> ''
ORDER BY wasted_tickles DESC;
