-- One-time happiness floor at 50 (true middle of the Content band, 38-62).
--
-- The live population had decayed sad: of 31 real pigs, 17 were Sad (live avg
-- ~36), most pinned near the 20 floor from inactivity. This lifts every pig
-- whose LIVE (decayed) happiness has sunk below 50 up to a stored 50 and resets
-- its decay clock so the value renders immediately. Pigs already at/above 50
-- live are left COMPLETELY untouched — this only pushes up, never demotes the
-- engaged (e.g. Jen at 68.6 stays put).
--
-- The decay model mirrors public.happiness_now() / analytics: live =
-- clamp(stored - 0.5/hr * hours_since_update, 20, 80). We floor on the LIVE
-- value (not the stored one) so a pig that looks sad on screen is actually
-- lifted, and stamp happiness_updated_at = now() so live == stored == 50 right
-- away (otherwise an old timestamp would immediately re-decay it below 50).
--
-- One-time data op; safe to re-run (idempotent — anyone already >= 50 live is
-- skipped). Not a schema change.

UPDATE public.profiles
   SET happiness              = 50,
       happiness_updated_at   = now(),
       happiness_window_start = now(),
       happiness_window_gain  = 0
 WHERE GREATEST(20, LEAST(80,
         happiness
         - EXTRACT(EPOCH FROM (now() - COALESCE(happiness_updated_at, now()))) / 3600.0 * 0.5
       )) < 50;
