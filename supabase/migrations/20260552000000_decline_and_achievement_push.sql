-- Two silent paths get pushes:
--
-- 1. Trade declined / withdrawn — the existing push trigger only
--    fired on pending→fulfilled. A target who declined an incoming
--    request left the requester to wonder forever; the card just
--    sat in their outgoing pile until they noticed.
--
-- 2. Achievement claimed — a player who unlocked a tier while
--    offline learned about it only on next app open via the launch
--    modal queue. A push gets it to the device immediately.
--
-- For decline, the trigger needs to know WHICH side cancelled so
-- it pushes the right party (and never self-pushes the canceller).
-- Adds a `cancelled_by uuid` column populated by cancel_tickle_trade.

set check_function_bodies = off;

-- ── 1. cancelled_by + rewrite of cancel_tickle_trade ───────────────
ALTER TABLE public.tickle_trades
	ADD COLUMN IF NOT EXISTS cancelled_by uuid;

CREATE OR REPLACE FUNCTION public.cancel_tickle_trade(trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	trade     record;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO trade FROM public.tickle_trades
		WHERE id = trade_id FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF caller_id NOT IN (trade.requester_id, trade.target_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_involved');
	END IF;
	IF trade.status <> 'pending' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_status');
	END IF;

	UPDATE public.tickle_trades
		SET status = 'cancelled',
		    cancelled_at = now(),
		    cancelled_by = caller_id
		WHERE id = trade.id;

	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── 2. tickle_trades_push_notify — add pending→cancelled branch ────
CREATE OR REPLACE FUNCTION public.tickle_trades_push_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	actor_name      text;
	target_user_id  uuid;
	push_title      text;
	push_body       text;
	push_data       jsonb;
BEGIN
	IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
		SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.requester_id;
		target_user_id := NEW.target_id;
		push_title := COALESCE(actor_name, 'A friend') || ' asked for tickles';
		push_body  := NEW.amount || ' tickle' || CASE WHEN NEW.amount > 1 THEN 's' ELSE '' END
			|| '. Tap to fulfill or decline.';
		push_data  := jsonb_build_object(
			'kind', 'trade_requested',
			'trade_id', NEW.id::text,
			'screen', 'trade'
		);
	ELSIF TG_OP = 'UPDATE'
	      AND OLD.status = 'pending' AND NEW.status = 'fulfilled' THEN
		SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.target_id;
		target_user_id := NEW.requester_id;
		push_title := COALESCE(actor_name, 'A friend') || ' answered your trade';
		push_body  := '+' || (NEW.amount * 2) || ' tickles landed in your barn.';
		push_data  := jsonb_build_object(
			'kind', 'trade_fulfilled',
			'trade_id', NEW.id::text,
			'screen', 'trade'
		);

	-- NEW: pending → cancelled. Push the OTHER party (never the
	-- canceller). Body softens by side: target declined → "passed
	-- on it"; requester withdrew → "withdrew their ask". If
	-- cancelled_by is null (legacy rows before this migration's
	-- column existed), skip the push.
	ELSIF TG_OP = 'UPDATE'
	      AND OLD.status = 'pending' AND NEW.status = 'cancelled'
	      AND NEW.cancelled_by IS NOT NULL THEN
		IF NEW.cancelled_by = NEW.target_id THEN
			-- Target declined → requester gets the news.
			SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.target_id;
			target_user_id := NEW.requester_id;
			push_title := COALESCE(actor_name, 'A friend') || ' passed on your trade';
			push_body  := 'Try someone else in your sounder.';
			push_data  := jsonb_build_object(
				'kind', 'trade_declined',
				'trade_id', NEW.id::text,
				'screen', 'trade'
			);
		ELSIF NEW.cancelled_by = NEW.requester_id THEN
			-- Requester withdrew → target's outstanding "asked you"
			-- card goes stale. Tell them so the push they got
			-- earlier doesn't lie.
			SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.requester_id;
			target_user_id := NEW.target_id;
			push_title := COALESCE(actor_name, 'A friend') || ' withdrew their ask';
			push_body  := 'Their trade card is gone — no action needed.';
			push_data  := jsonb_build_object(
				'kind', 'trade_withdrawn',
				'trade_id', NEW.id::text,
				'screen', 'trade'
			);
		ELSE
			RETURN NEW;
		END IF;

	ELSE
		RETURN NEW;
	END IF;

	BEGIN
		PERFORM public.send_push_to_user(target_user_id, push_title, push_body, push_data);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;

	RETURN NEW;
END;
$function$;

-- ── 3. Achievement claim push ─────────────────────────────────────
-- AFTER INSERT on user_achievements fires a push to the user who
-- just unlocked. The push lands when offline players cross
-- thresholds via someone else's action (e.g., their trade was
-- fulfilled, bumping their trade_receiver volume). For multi-tier
-- crossings in one call, they get one push per new tier — rare in
-- practice (would need to cross 10→50→250 in a single action),
-- and the launch-modal queue handles the visual reveal.
CREATE OR REPLACE FUNCTION public.user_achievements_push_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	a_name text;
	a_desc text;
BEGIN
	SELECT name, description INTO a_name, a_desc
		FROM public.achievements WHERE id = NEW.achievement_id;
	IF a_name IS NULL THEN
		RETURN NEW;
	END IF;
	BEGIN
		PERFORM public.send_push_to_user(
			NEW.user_id,
			'Achievement unlocked: ' || a_name,
			COALESCE(a_desc, 'Tap to claim your reward.'),
			jsonb_build_object(
				'kind', 'achievement_unlocked',
				'achievement_id', NEW.achievement_id,
				'screen', 'achievements'
			)
		);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS user_achievements_push ON public.user_achievements;
CREATE TRIGGER user_achievements_push
	AFTER INSERT ON public.user_achievements
	FOR EACH ROW EXECUTE FUNCTION public.user_achievements_push_notify();
