-- GREAT HUNGER STAGE REWARDS
--
-- The top-of-Season ladder matches hunger_meter exactly: five transitions
-- (Stuffed, Full, Peckish, Hungry, Famished), each worth 15 Golden Truffles to
-- every pig who contributed at least one credited find during that stage.
--
-- Delivery policy: the durable server mint is truth; the push is best-effort
-- re-engagement. `foreground: quiet` makes the new client suppress an OS alert
-- while already in-game, so the dig that crosses a tier is not interrupted by
-- its own reward. Backgrounded players still receive the ordinary push.

CREATE TABLE IF NOT EXISTS public.hunger_stage_unlocks (
	stage_key  text PRIMARY KEY CHECK (stage_key IN ('stuffed', 'full', 'peckish', 'hungry', 'famished')),
	threshold  bigint      NOT NULL,
	reached_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hunger_stage_rewards (
	stage_key text        NOT NULL REFERENCES public.hunger_stage_unlocks(stage_key) ON DELETE CASCADE,
	user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	reward    int         NOT NULL DEFAULT 0 CHECK (reward BETWEEN 0 AND 15),
	granted_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (stage_key, user_id)
);

ALTER TABLE public.hunger_stage_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunger_stage_rewards ENABLE ROW LEVEL SECURITY;

-- Stamp each submitted dig with the visible stage it helped drain. The latest
-- submit_rooting updates hunger_drain before it stamps war_rootings, so a tiny
-- transaction-local handoff captures the meter's OLD stage without carrying
-- that large RPC body (and its many later features) into this migration.
ALTER TABLE public.war_rootings
	ADD COLUMN IF NOT EXISTS hunger_stage_key text
	CHECK (hunger_stage_key IN ('gorged', 'stuffed', 'full', 'peckish', 'hungry', 'famished'));

DROP POLICY IF EXISTS "Read reached hunger stages" ON public.hunger_stage_unlocks;
CREATE POLICY "Read reached hunger stages" ON public.hunger_stage_unlocks
	FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Read own hunger stage rewards" ON public.hunger_stage_rewards;
CREATE POLICY "Read own hunger stage rewards" ON public.hunger_stage_rewards
	FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.capture_hunger_stage_before_drain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	v_stage text;
BEGIN
	v_stage := CASE
		WHEN OLD.total >= 9000 THEN 'famished'
		WHEN OLD.total >= 6000 THEN 'hungry'
		WHEN OLD.total >= 3600 THEN 'peckish'
		WHEN OLD.total >= 1800 THEN 'full'
		WHEN OLD.total >= 600  THEN 'stuffed'
		ELSE 'gorged'
	END;
	PERFORM set_config('ttp.hunger_stage_before_drain', v_stage, true);
	RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_hunger_stage_before_drain()
	FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hunger_stage_before_drain ON public.hunger_drain;
CREATE TRIGGER hunger_stage_before_drain
	BEFORE UPDATE OF total ON public.hunger_drain
	FOR EACH ROW
	EXECUTE FUNCTION public.capture_hunger_stage_before_drain();

CREATE OR REPLACE FUNCTION public.stamp_rooting_hunger_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	v_stage text;
	v_total bigint;
BEGIN
	IF OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL THEN
		v_stage := NULLIF(current_setting('ttp.hunger_stage_before_drain', true), '');
		-- Defensive fallback for a future submit path that stamps the rooting
		-- without first updating hunger_drain.
		IF v_stage IS NULL THEN
			SELECT total INTO v_total FROM public.hunger_drain WHERE id = true;
			v_stage := CASE
				WHEN COALESCE(v_total, 0) >= 9000 THEN 'famished'
				WHEN COALESCE(v_total, 0) >= 6000 THEN 'hungry'
				WHEN COALESCE(v_total, 0) >= 3600 THEN 'peckish'
				WHEN COALESCE(v_total, 0) >= 1800 THEN 'full'
				WHEN COALESCE(v_total, 0) >= 600  THEN 'stuffed'
				ELSE 'gorged'
			END;
		END IF;
		NEW.hunger_stage_key := v_stage;
	END IF;
	RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.stamp_rooting_hunger_stage()
	FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hunger_stage_stamp_rooting ON public.war_rootings;
CREATE TRIGGER hunger_stage_stamp_rooting
	BEFORE UPDATE OF submitted_at ON public.war_rootings
	FOR EACH ROW
	EXECUTE FUNCTION public.stamp_rooting_hunger_stage();

CREATE OR REPLACE FUNCTION public.grant_reached_hunger_stage_rewards(
	p_send_push boolean DEFAULT true
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	v_total       bigint;
	v_stage       record;
	v_recipient   record;
	v_stage_landed int;
	v_reward_landed int;
	v_actual      int;
	v_grants      int := 0;
BEGIN
	SELECT total INTO v_total FROM public.hunger_drain WHERE id = true;

	FOR v_stage IN
		SELECT * FROM (VALUES
			('stuffed'::text,  600::bigint,  'Stuffed'::text, 'gorged'::text),
			('full'::text,    1800::bigint,  'Full'::text,    'stuffed'::text),
			('peckish'::text, 3600::bigint,  'Peckish'::text, 'full'::text),
			('hungry'::text,  6000::bigint,  'Hungry'::text,  'peckish'::text),
			('famished'::text,9000::bigint,  'Famished'::text,'hungry'::text)
		) AS stages(stage_key, threshold, stage_name, contribution_stage)
		ORDER BY threshold
	LOOP
		IF COALESCE(v_total, 0) < v_stage.threshold THEN CONTINUE; END IF;

		INSERT INTO public.hunger_stage_unlocks (stage_key, threshold)
			VALUES (v_stage.stage_key, v_stage.threshold)
			ON CONFLICT (stage_key) DO NOTHING;
		GET DIAGNOSTICS v_stage_landed = ROW_COUNT;
		IF v_stage_landed = 0 THEN CONTINUE; END IF;

		-- A live crossing pays only pigs who dug during the stage just completed.
		-- A migration-time backfill cannot reconstruct the old global ordering
		-- precisely, so it generously includes every historical contributor.
		FOR v_recipient IN
			SELECT DISTINCT user_id
			FROM public.war_rootings
			WHERE submitted_at IS NOT NULL
			  AND credited_finds > 0
			  AND (NOT p_send_push OR hunger_stage_key = v_stage.contribution_stage)
		LOOP
			INSERT INTO public.hunger_stage_rewards (stage_key, user_id)
				VALUES (v_stage.stage_key, v_recipient.user_id)
				ON CONFLICT (stage_key, user_id) DO NOTHING;
			GET DIAGNOSTICS v_reward_landed = ROW_COUNT;
			IF v_reward_landed = 0 THEN CONTINUE; END IF;

			v_actual := public.mint_truffles(
				v_recipient.user_id,
				15,
				'hunger_stage_' || v_stage.stage_key,
				NULL
			);
			UPDATE public.hunger_stage_rewards
				SET reward = v_actual
				WHERE stage_key = v_stage.stage_key AND user_id = v_recipient.user_id;
			v_grants := v_grants + 1;

			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (
					v_recipient.user_id,
					'hunger_stage_reward',
					'The herd reached ' || v_stage.stage_name,
					CASE WHEN v_actual > 0
						THEN '+' || v_actual || ' Golden Truffles. You helped starve the Great Hungerer.'
						ELSE 'You helped starve the Great Hungerer. Your truffle pouch is already full.'
					END,
					jsonb_build_object(
						'stage', v_stage.stage_key,
						'threshold', v_stage.threshold,
						'reward', v_actual,
						'screen', 'season'
					)
				);
			EXCEPTION WHEN OTHERS THEN NULL;
			END;

			IF p_send_push AND v_actual > 0 THEN
				BEGIN
					PERFORM public.send_push_to_user(
						v_recipient.user_id,
						'The herd reached ' || v_stage.stage_name,
						'+' || v_actual || ' Golden Truffles — the Hungerer is weakening.',
						jsonb_build_object(
							'kind', 'hunger_stage_reward',
							'stage', v_stage.stage_key,
							'reward', v_actual,
							'screen', 'season',
							'foreground', 'quiet'
						)
					);
				EXCEPTION WHEN OTHERS THEN NULL;
				END;
			END IF;
		END LOOP;
	END LOOP;

	RETURN v_grants;
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_reached_hunger_stage_rewards(boolean)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.war_rootings_hunger_stage_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL THEN
		PERFORM public.grant_reached_hunger_stage_rewards(true);
	END IF;
	RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.war_rootings_hunger_stage_rewards()
	FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_war_rootings_hunger_stage_rewards ON public.war_rootings;
CREATE TRIGGER zz_war_rootings_hunger_stage_rewards
	AFTER UPDATE OF submitted_at ON public.war_rootings
	FOR EACH ROW
	EXECUTE FUNCTION public.war_rootings_hunger_stage_rewards();

-- Backfill any already-reached visible stage without sending a deployment-time
-- push blast. The durable announcement explains the grant on next open.
SELECT public.grant_reached_hunger_stage_rewards(false);
