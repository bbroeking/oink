-- Push delivery for daily blessings + curses.
--
-- Mirrors tickle_trades_push_notify (20260520050000): an AFTER INSERT
-- trigger fires a fire-and-forget push to the receiver. They already
-- see the event in the Friends-tab Inbox; this makes it reach the
-- device too. Season-1 social redesign, Phase D (bless/curse wired).
--
-- One trigger function, branched on TG_TABLE_NAME, drives both tables.

CREATE OR REPLACE FUNCTION public.ritual_push_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	actor_name text;
	is_curse   boolean := TG_TABLE_NAME = 'curses';
	push_title text;
	push_body  text;
BEGIN
	SELECT username INTO actor_name
		FROM public.profiles WHERE id = NEW.sender_id;

	IF is_curse THEN
		push_title := COALESCE(actor_name, 'Someone') || ' cursed you';
		push_body := CASE NEW.kind
			WHEN 'sluggish_snout' THEN 'A sluggish snout — your tickles crawl.'
			WHEN 'phantom_itch'   THEN 'A phantom itch is on you.'
			WHEN 'goblin_whisper' THEN 'A goblin whisper follows you.'
			WHEN 'coin_pinch'     THEN 'A coin pinch — snouts gone missing.'
			ELSE 'A little mischief lands on you.'
		END;
	ELSE
		push_title := COALESCE(actor_name, 'A friend') || ' blessed you';
		push_body := CASE NEW.kind
			WHEN 'warm_tea'         THEN 'Warm tea — your tickles brew faster.'
			WHEN 'sun_beam'         THEN 'A sun beam — your next Lucky Pig shines.'
			WHEN 'halo_kiss'        THEN 'A halo kiss — you''re glowing.'
			WHEN 'bountiful_snouts' THEN 'Bountiful snouts — +5 landed in your barn.'
			ELSE 'A friend sent something kind your way.'
		END;
	END IF;

	-- Fire-and-forget; a push failure must never roll back the ritual.
	BEGIN
		PERFORM public.send_push_to_user(
			NEW.receiver_id,
			push_title,
			push_body,
			jsonb_build_object(
				'kind', CASE WHEN is_curse THEN 'curse' ELSE 'blessing' END,
				'screen', 'friends'
			)
		);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;

	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS blessings_push ON public.blessings;
CREATE TRIGGER blessings_push
	AFTER INSERT ON public.blessings
	FOR EACH ROW EXECUTE FUNCTION public.ritual_push_notify();

DROP TRIGGER IF EXISTS curses_push ON public.curses;
CREATE TRIGGER curses_push
	AFTER INSERT ON public.curses
	FOR EACH ROW EXECUTE FUNCTION public.ritual_push_notify();
