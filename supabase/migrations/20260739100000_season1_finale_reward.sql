-- Season 1 finale reward — the herd takes the Hungerer's crown.
--
-- When the herd starves the Great Hungerer to Famished (or the season ends,
-- whichever comes first), every digger who put in the work gets the prestige
-- of having been there: an exclusive hat (the Hungerer's Crown) + a title
-- ("Starver of the Hunger"). Earned-only, cost 0, zero economy inflation —
-- it mints no currency, it's pure "I was there" proof (SKILL.md: Contend).
--
-- The grant is fired MANUALLY by the admin (there's no reliable "the world
-- ended" trigger, and we want a human to pull it at the right beat). See the
-- gating note on grant_season1_finale() below.
--
-- Eligibility: a player's Season-1 credited finds >= 10. Source is
-- SUM(war_rootings.credited_finds) for submitted digs — the canonical per-user
-- per-window credited-find count written by submit_rooting (20260730). The
-- co-op dig IS Season 1 and war_rootings carries no earlier/later-season rows,
-- so all-time == Season 1 for this ledger today. (war_truffles is a currency
-- mint ledger, not finds; the dig_count achievement counts sessions, not finds
-- — neither is the right denominator here.)

-- ── The hat ───────────────────────────────────────────────────────────
-- Grant-only: cost 0 keeps it out of daily_shop (WHERE cost > 0) and buy_hat
-- (cost <= 0 → not_for_sale), and out of Browse unless already owned. No
-- pass_exclusive / members_only flag — cost 0 is the whole exclusion, matching
-- release_party_crown / ticket_takers_cap.
INSERT INTO public.hats (id, name, emoji, cost, display_order, category, rarity, description)
VALUES
	('hungerers_crown', 'The Hungerer''s Crown', NULL, 0, 472, 'hat', 'legendary',
	 'A dented iron-and-tarnished-gold crown, pried off the Great Hungerer''s head when the herd starved him. Earned, never sold.')
ON CONFLICT (id) DO NOTHING;

-- ── The title ─────────────────────────────────────────────────────────
-- for_sale = false (never enters the shop); source 'season' is already in the
-- titles_source_check enum. placement 'post' → reads "<name>, Starver of the
-- Hunger".
INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('starver_of_the_hunger', 'Starver of the Hunger', 'post',
	 'Dug ten finds against the Great Hungerer and helped starve him to Famished.',
	 'season', false, 410)
ON CONFLICT (id) DO NOTHING;

-- ── The grant RPC ─────────────────────────────────────────────────────
-- ADMIN-ONLY the SAFE way: SECURITY DEFINER + REVOKE from PUBLIC/anon/
-- authenticated, so only the service role / SQL console can EXECUTE it. This
-- mirrors grant_beta_rewards() and deliberately AVOIDS the send_system_
-- announcement 'admin_only' RAISE footgun (a RAISE inside a DEFINER fn granted
-- to authenticated poisons any caller's transaction → silent rollback). There
-- is no is_admin()/admins table in this schema; GRANT-gating is the pattern.
--
-- Idempotent: user_hats / user_titles inserts are ON CONFLICT DO NOTHING, and
-- the announcement only fires for a user who did NOT already hold the hat, so
-- re-running grants nothing new and sends no duplicate announcement. Returns
-- the counts touched this run.
CREATE OR REPLACE FUNCTION public.grant_season1_finale()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	rec           record;
	hats_granted  int := 0;
	titles_granted int := 0;
	announced     int := 0;
	had_hat       boolean;
	had_title     boolean;
BEGIN
	FOR rec IN
		SELECT wr.user_id, COALESCE(SUM(wr.credited_finds), 0) AS s1_finds
		FROM public.war_rootings wr
		WHERE wr.submitted_at IS NOT NULL
		GROUP BY wr.user_id
		HAVING COALESCE(SUM(wr.credited_finds), 0) >= 10
	LOOP
		-- Track whether this user already held the reward BEFORE we grant, so
		-- the announcement (and the counts) only reflect genuinely new grants.
		SELECT EXISTS (
			SELECT 1 FROM public.user_hats
			WHERE user_id = rec.user_id AND hat_id = 'hungerers_crown'
		) INTO had_hat;
		SELECT EXISTS (
			SELECT 1 FROM public.user_titles
			WHERE user_id = rec.user_id AND title_id = 'starver_of_the_hunger'
		) INTO had_title;

		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (rec.user_id, 'hungerers_crown') ON CONFLICT DO NOTHING;
		INSERT INTO public.user_titles (user_id, title_id)
			VALUES (rec.user_id, 'starver_of_the_hunger') ON CONFLICT DO NOTHING;

		IF NOT had_hat THEN hats_granted := hats_granted + 1; END IF;
		IF NOT had_title THEN titles_granted := titles_granted + 1; END IF;

		-- Announce once, only to a freshly-crowned digger. Inlined INSERT (never
		-- send_system_announcement) so a push/announcement hiccup can't roll the
		-- whole grant back.
		IF NOT had_hat THEN
			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (
					rec.user_id,
					'season',
					'The Hungerer''s Crown is yours',
					'You starved him with the herd. Take his crown — you were there when the valley got its joy back.',
					jsonb_build_object('screen', 'shop', 'hat', 'hungerers_crown', 'title', 'starver_of_the_hunger')
				);
				announced := announced + 1;
			EXCEPTION WHEN OTHERS THEN
				NULL;  -- never let an announcement failure abort the grant
			END;
		END IF;
	END LOOP;

	RETURN jsonb_build_object(
		'ok', true,
		'hats_granted', hats_granted,
		'titles_granted', titles_granted,
		'announced', announced
	);
END;
$$;

-- Service role / SQL console only — no user-facing EXECUTE (mirrors
-- grant_beta_rewards's gating).
REVOKE ALL ON FUNCTION public.grant_season1_finale() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_season1_finale() FROM anon, authenticated;
