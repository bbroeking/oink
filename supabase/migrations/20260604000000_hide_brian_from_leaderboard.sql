-- Hide the project owner's account (Brian, is_test=true) from the leaderboards.
-- The global board already excludes is_test accounts, but the alignment_leaderboard
-- RPC only filters hide_from_leaderboard — so Brian (alignment_score -36) was
-- topping the GREEDY side there. Setting the dedicated flag removes him from every
-- board that honors it (global + alignment). Same mechanism as 20260586.
-- Single account: username 'Brian', discriminator '4075', id 07dd600b-…-fd4689f5ebe6.

UPDATE public.profiles
SET hide_from_leaderboard = true
WHERE username = 'Brian' AND discriminator = '4075' AND is_test = true;
