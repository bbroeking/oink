-- Stub for 20261004231000_catalog_copy_polish.sql: the two catalog tables with
-- the columns the migration touches, seeded with the old copy.
CREATE TABLE IF NOT EXISTS public.titles (id text PRIMARY KEY, name text NOT NULL, description text);
CREATE TABLE IF NOT EXISTS public.achievements (id text PRIMARY KEY, name text NOT NULL, description text);
INSERT INTO public.titles (id, name, description) VALUES
	('wc_brazil', 'Samba Star', 'World Cup 2026 — represent Brazil.'),
	('wc_civ', 'Elephant', 'World Cup 2026 — represent Côte d''Ivoire.'),
	('crown_hog', 'Crown Hog', 'The big boar — fifty in your sounder.'),
	('schwein', 'Schwein Gehabt', 'German for "had a pig" — i.e., got lucky.'),
	('worldbringer', 'Worldbringer', 'Brought 1000 friends into the world.'),
	('unmissable', 'The Unmissable', 'Dug every Feeding in a full Dig-Off week.'),
	('full_sounder', 'Full Sounder', 'A full sounder of 100.'),
	('reworded', 'Already Fine', 'Someone already fixed this.')
ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, name, description) VALUES
	('hog_of_hearts', 'Hog of Hearts', 'Fulfill 1000 trades.'),
	('every_last_feeding', 'Every Last Feeding', 'Dig in every Feeding of a full Dig-Off week.'),
	('small_sounder', 'Small Sounder', '5 friends in your sounder.'),
	('full_sounder', 'Full Sounder', 'A full sounder of 100.')
ON CONFLICT DO NOTHING;
