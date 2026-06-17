-- No-emoji sweep (server side). The client UI no longer renders emoji
-- (replaced with the Icon/art system); this migration removes the emoji that
-- the SERVER still emits or stores:
--
--   1. system_announcements.title/body — the only user-visible server copy
--      (truffle "found!", trough "needs your help!", referral "made it!" /
--      "used your code!", "War Spoils!"). A BEFORE INSERT/UPDATE trigger strips
--      emoji on the way in, so every current AND future announcement is clean
--      regardless of which function inserts it — no need to re-define (and risk)
--      the business-logic functions (dig_truffle, nudge_trough,
--      redeem_referral_code, grant_war_spoils_on_resolve).
--   2. Non-rendered data columns that still hold emoji: hats.emoji,
--      achievements.icon, onboarding_milestones.icon. The client now uses
--      categoryIcon()/achievementIcon()/MILESTONE_ICON art instead, so these
--      are invisible — scrubbed here for completeness (kept reversible: NULLIF
--      so any non-emoji label survives, and keep-set print glyphs ✦/☁ are
--      preserved by the pattern).
--
-- strip_emoji() removes emoji pictographs while preserving the design-system
-- "print characters" ★ ✦ ♥ ☁ ✓ ✕ (documented in components/BountyCard.tsx)
-- and all normal/accented text. Pattern excludes those six codepoints by
-- carving them out of the BMP symbol ranges.

-- Pattern is assembled from explicit codepoints via chr() (encoding-independent,
-- no reliance on \u/\U regex escapes). It matches emoji pictographs across the
-- supplementary plane (U+1F000-1FAFF), the BMP symbol blocks (U+2300-23FF,
-- 2600-26FF, 2700-27BF, 2B00-2BFF), and the emoji modifiers (VS U+FE0E/FE0F,
-- ZWJ U+200D, keycap U+20E3) — while carving out the six design-system "print
-- characters" that must survive: ☁ U+2601, ★ U+2605, ♥ U+2665, ✓ U+2713,
-- ✕ U+2715, ✦ U+2726.
CREATE OR REPLACE FUNCTION public.strip_emoji(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT btrim(regexp_replace(
		regexp_replace(
			s,
			'[' ||
				chr(126976) || '-' || chr(129791) ||                  -- 1F000-1FAFF
				chr(65038) || chr(65039) || chr(8205) || chr(8419) || -- FE0E FE0F ZWJ keycap
				chr(8960)  || '-' || chr(9215) ||                     -- 2300-23FF
				chr(11008) || '-' || chr(11263) ||                    -- 2B00-2BFF
				-- 2600-26FF minus 2601 ☁, 2605 ★, 2665 ♥
				chr(9728) || chr(9730) || '-' || chr(9732) ||
				chr(9734) || '-' || chr(9828) || chr(9830) || '-' || chr(9983) ||
				-- 2700-27BF minus 2713 ✓, 2715 ✕, 2726 ✦
				chr(9984) || '-' || chr(10002) || chr(10004) ||
				chr(10006) || '-' || chr(10021) || chr(10023) || '-' || chr(10175) ||
			']',
			'',
			'g'
		),
		'  +', ' ', 'g'
	));
$$;

-- 1a. Trigger: keep announcement copy emoji-free on every insert/update.
CREATE OR REPLACE FUNCTION public.strip_emoji_from_announcement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	-- title/body are NOT NULL; if stripping would empty a value (an all-emoji
	-- string — never happens with real copy), keep the original rather than
	-- violate the constraint.
	IF NEW.title IS NOT NULL THEN
		NEW.title := COALESCE(NULLIF(public.strip_emoji(NEW.title), ''), NEW.title);
	END IF;
	IF NEW.body IS NOT NULL THEN
		NEW.body := COALESCE(NULLIF(public.strip_emoji(NEW.body), ''), NEW.body);
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS strip_emoji_announcement ON public.system_announcements;
CREATE TRIGGER strip_emoji_announcement
	BEFORE INSERT OR UPDATE ON public.system_announcements
	FOR EACH ROW EXECUTE FUNCTION public.strip_emoji_from_announcement();

-- 1b. Scrub announcements already sent.
UPDATE public.system_announcements
SET title = public.strip_emoji(title),
    body  = public.strip_emoji(body)
WHERE title <> public.strip_emoji(title)
   OR body  <> public.strip_emoji(body);

-- 2. Non-rendered data columns (NULLIF keeps any non-emoji label; keep-set
--    print glyphs ✦/☁ are preserved by strip_emoji and so are left untouched).
UPDATE public.hats
SET emoji = NULLIF(public.strip_emoji(emoji), '')
WHERE emoji IS NOT NULL
  AND emoji <> public.strip_emoji(emoji);

UPDATE public.achievements
SET icon = NULLIF(public.strip_emoji(icon), '')
WHERE icon IS NOT NULL
  AND icon <> public.strip_emoji(icon);

UPDATE public.onboarding_milestones
SET icon = NULLIF(public.strip_emoji(icon), '')
WHERE icon IS NOT NULL
  AND icon <> public.strip_emoji(icon);
