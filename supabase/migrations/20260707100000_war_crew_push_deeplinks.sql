-- War/crew push deep-links — fire a deep-linked push when a scuffle/crew event
-- lands, gated on the recipient's effective mud_wars flag.
-- HELD FOR REVIEW; push only on go.
--
-- WHY: the war/crew RPCs INLINE their system_announcements INSERTs (hard rule:
-- user RPCs can't call send_system_announcement — admin_only rollback), so those
-- events (challenge, resolve, crew invite) never call send_push_to_user — they
-- surface in-app only, with no push and no deep-link. Rather than CREATE OR
-- REPLACE the core war RPCs (resolve_war is scoring-math — ask-Brian-first), this
-- rides an AFTER INSERT trigger on system_announcements: for a curated whitelist
-- of push-worthy war/crew kinds it derives a `screen` and fires a best-effort push.
--
-- DARK-LAUNCH SAFE: only pushes to a recipient whose EFFECTIVE mud_wars flag is on
-- (per-user override else global default — same rule as feature_flags(), 20260692),
-- so no one is notified about a season they can't open. Best-effort: a push fault
-- never touches the announcement row (the source of truth).
--
-- Screen values MUST stay in sync with utils/notificationRouting.ts (routeForScreen):
--   war_*        -> 'scuffle' (/mud-war)
--   crew_invite  -> 'sounder' (the crew hub on the Friends tab)
-- Noisy kinds (crew_join, trough_chip, war_started) are deliberately NOT pushed.
--
-- Note: send_system_announcement() already pushes inline, but it's admin-only and
-- is never called with these war/crew kinds (they're produced only by the inline
-- INSERTs in the war/crew RPCs), so there is no double-push.

CREATE OR REPLACE FUNCTION public.push_war_crew_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
DECLARE
	target_screen text;
	flag_on       boolean;
BEGIN
	target_screen := CASE
		WHEN NEW.kind IN ('war_challenge','war_won','war_lost','war_draw','war_over','war_expired') THEN 'scuffle'
		WHEN NEW.kind = 'crew_invite' THEN 'sounder'
		ELSE NULL
	END;
	IF target_screen IS NULL THEN RETURN NEW; END IF;

	-- Effective mud_wars flag for the recipient (per-user override else global default).
	SELECT COALESCE((p.feature_overrides ->> 'mud_wars')::boolean, c.enabled, false)
		INTO flag_on
		FROM public.profiles p
		LEFT JOIN public.app_config c ON c.key = 'mud_wars'
		WHERE p.id = NEW.user_id;
	IF NOT COALESCE(flag_on, false) THEN RETURN NEW; END IF;

	-- Best-effort push; the announcement row is already committed and is the
	-- source of truth, so a push fault must never fail the insert.
	BEGIN
		PERFORM public.send_push_to_user(
			NEW.user_id,
			NEW.title,
			NEW.body,
			COALESCE(NEW.data, '{}'::jsonb)
				|| jsonb_build_object('kind', NEW.kind, 'screen', target_screen, 'announcement_id', NEW.id::text)
		);
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_push_war_crew_announcement ON public.system_announcements;
CREATE TRIGGER trg_push_war_crew_announcement
	AFTER INSERT ON public.system_announcements
	FOR EACH ROW EXECUTE FUNCTION public.push_war_crew_announcement();
