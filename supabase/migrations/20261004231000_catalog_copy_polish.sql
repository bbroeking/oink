-- Catalog copy polish (the 2026-10-04 UI polish pass, server-copy findings).
--
-- Copy that lives in the database and that the polish agents could not fix in
-- the client (docs/design/polish-2026-10-04/findings-*.md, "server copy"):
--   1. em dashes in title descriptions (the 2026-09-22 ruling: no em dash in
--      anything a player reads; an explanation takes a colon, two thoughts a
--      full stop) — 48 World Cup titles and five others;
--   2. thousands written "1000" where every other surface writes "1,000";
--   3. the perfect-week achievement still names the Dig-Off, retired with the
--      herd race on 2026-09-21 (the achievement now reads the drum: a dig in
--      every Feeding of one week);
--   4. friend-count achievements and two titles still say "sounder", a word
--      that has meant the eight-pig crew since 2026-09-11 (CONTEXT.md:
--      Recruits): friends are friends, recruits are recruits.
--
-- Every UPDATE matches the exact old text, so it is idempotent and never
-- overwrites a row someone has already reworded. Copy only: no ids, names,
-- rewards, thresholds or ownership change.
--
-- AUTHORED, NOT PUSHED. Needs the founder's explicit "go" (CLAUDE.md).

-- ── 1. Em dashes in title descriptions ───────────────────────────────────────
UPDATE public.titles
SET description = replace(description, 'World Cup 2026 — represent ', 'World Cup 2026: represent ')
WHERE description LIKE 'World Cup 2026 — represent %';

UPDATE public.titles SET description = 'Czech for "lucky pig": eats forward, never back.'
WHERE description = 'Czech for "lucky pig" — eats forward, never back.';

UPDATE public.titles SET description = 'German "lucky pig": bringer of new-year fortune.'
WHERE description = 'German "lucky pig" — bringer of new-year fortune.';

UPDATE public.titles SET description = 'German for "had a pig", meaning you got lucky.'
WHERE description = 'German for "had a pig" — i.e., got lucky.';

UPDATE public.titles SET description = 'Polish piggy bank, keeper of coins.'
WHERE description = 'Polish piggy bank — keeper of coins.';

UPDATE public.titles SET description = 'Your Sounder starved him of 1,800 truffles. A legend of the bog.'
WHERE description = 'Your Sounder starved him of 1,800 truffles — a legend of the bog.';

-- Crown Hog dates from when "sounder" meant the referral downline (May 2026).
UPDATE public.titles SET description = 'The big boar: fifty recruits.'
WHERE description = 'The big boar — fifty in your sounder.';

-- ── 2. Thousands ─────────────────────────────────────────────────────────────
UPDATE public.achievements SET description = 'Fulfill 1,000 trades.'
WHERE description = 'Fulfill 1000 trades.';
UPDATE public.achievements SET description = 'Give 1,000 tickles via trades.'
WHERE description = 'Give 1000 tickles via trades.';
UPDATE public.achievements SET description = 'Have 1,000 of your requests fulfilled.'
WHERE description = 'Have 1000 of your requests fulfilled.';
UPDATE public.achievements SET description = 'Receive 1,000 tickles via trades.'
WHERE description = 'Receive 1000 tickles via trades.';
UPDATE public.titles SET description = 'Brought 1,000 friends into the world.'
WHERE description = 'Brought 1000 friends into the world.';
UPDATE public.titles SET description = 'Gave 1,000 tickles via trades.'
WHERE description = 'Gave 1000 tickles via trades.';
UPDATE public.titles SET description = 'Received 1,000 tickles via trades.'
WHERE description = 'Received 1000 tickles via trades.';

-- ── 3. The perfect week reads the drum, not the Dig-Off ──────────────────────
UPDATE public.achievements SET description = 'Dig in every Feeding of one week.'
WHERE description = 'Dig in every Feeding of a full Dig-Off week.';
UPDATE public.titles SET description = 'Dug every Feeding in one week.'
WHERE description = 'Dug every Feeding in a full Dig-Off week.';

-- ── 4. Friends are friends ───────────────────────────────────────────────────
UPDATE public.achievements SET description = 'Make 5 friends.'
WHERE description = '5 friends in your sounder.';
UPDATE public.achievements SET description = 'Make 20 friends.'
WHERE description = '20 friends in your sounder.';
UPDATE public.achievements SET description = 'Make 100 friends.'
WHERE description = 'A full sounder of 100.';
UPDATE public.titles SET description = 'A hundred friends.'
WHERE description = 'A full sounder of 100.';
