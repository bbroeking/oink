-- pgTAP tests for the pure (fixture-free) Season 1 SQL functions.
-- Run with:  supabase test db
--
-- These pin the threshold + rotation contracts that the TypeScript
-- mirrors (utils/alignment.ts, utils/rituals.ts, utils/bounties.ts)
-- depend on. If a test here fails, the client and server disagree.

BEGIN;
SELECT plan(13);

-- ── alignment_label thresholds (±34 hysteresis) ───────────────────
SELECT is(public.alignment_label(0),    'neutral', 'score 0 is neutral');
SELECT is(public.alignment_label(34),   'angel',   'score +34 is angel (exact threshold)');
SELECT is(public.alignment_label(33),   'neutral', 'score +33 is neutral (one below)');
SELECT is(public.alignment_label(-34),  'goblin',  'score -34 is goblin (exact threshold)');
SELECT is(public.alignment_label(-33),  'neutral', 'score -33 is neutral (one above)');
SELECT is(public.alignment_label(100),  'angel',   'score +100 is angel');
SELECT is(public.alignment_label(-100), 'goblin',  'score -100 is goblin');

-- ── daily ritual rotations land inside their kind sets ────────────
SELECT ok(
	public.daily_blessing_kind() IN
		('warm_tea', 'sun_beam', 'halo_kiss', 'bountiful_snouts'),
	'daily_blessing_kind returns a valid blessing kind'
);
SELECT ok(
	public.daily_curse_kind() IN
		('sluggish_snout', 'phantom_itch', 'goblin_whisper', 'coin_pinch'),
	'daily_curse_kind returns a valid curse kind'
);

-- blessing + curse rotations share the same daily index
SELECT is(
	array_position(
		ARRAY['warm_tea','sun_beam','halo_kiss','bountiful_snouts'],
		public.daily_blessing_kind()
	),
	array_position(
		ARRAY['sluggish_snout','phantom_itch','goblin_whisper','coin_pinch'],
		public.daily_curse_kind()
	),
	'blessing and curse rotations use the same daily index'
);

-- ── current_week_start is a Monday, not in the future ─────────────
SELECT is(
	EXTRACT(ISODOW FROM public.current_week_start())::int,
	1,
	'current_week_start lands on a Monday'
);
SELECT ok(
	public.current_week_start() <= (now() AT TIME ZONE 'UTC')::date,
	'current_week_start is not in the future'
);
SELECT ok(
	(now() AT TIME ZONE 'UTC')::date - public.current_week_start() < 7,
	'current_week_start is within the last 7 days'
);

SELECT * FROM finish();
ROLLBACK;
