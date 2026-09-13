-- Earned-Mote wagering protocol v2. Wager rollout defaults OFF.
-- Depends on 20260905174000_prestige_mote_rewards.sql. Authored only: applying
-- any migration still requires the founder's explicit database-push "go".

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mote_wallet_revision bigint NOT NULL DEFAULT 0
  CHECK (mote_wallet_revision BETWEEN 0 AND 9007199254740991);

-- One central revision clock covers every writer of mote_balance: Shimmers,
-- prestige, legacy Reveal, v2 settlement, and future direct balance updates.
CREATE OR REPLACE FUNCTION public.bump_mote_wallet_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.mote_wallet_revision <> OLD.mote_wallet_revision THEN
    RAISE EXCEPTION 'mote_wallet_revision is server managed';
  END IF;
  IF OLD.mote_wallet_revision = 9007199254740991 THEN
    RAISE EXCEPTION 'mote wallet revision overflow';
  END IF;
  NEW.mote_wallet_revision := OLD.mote_wallet_revision + 1;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.bump_mote_wallet_revision() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_bump_mote_wallet_revision ON public.profiles;
CREATE TRIGGER profiles_bump_mote_wallet_revision
  BEFORE UPDATE OF mote_balance ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.bump_mote_wallet_revision();

CREATE OR REPLACE FUNCTION public.guard_mote_wallet_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  RAISE EXCEPTION 'mote_wallet_revision is server managed';
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_mote_wallet_revision() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_guard_mote_wallet_revision
  BEFORE UPDATE OF mote_wallet_revision ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_mote_wallet_revision();

ALTER TABLE public.mote_machine_spins
  ADD COLUMN IF NOT EXISTS wallet_revision bigint;

CREATE TABLE public.mote_game_rules (
  version text PRIMARY KEY CHECK (version ~ '^(reveal|wager)-v[1-9][0-9]*$'),
  mode text NOT NULL CHECK (mode IN ('reveal', 'wager')),
  allowed_stakes int[] NOT NULL,
  presentation_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (allowed_stakes <@ ARRAY[1,3,5] AND cardinality(allowed_stakes) BETWEEN 1 AND 3)
);

CREATE TABLE public.mote_game_paytable (
  rules_version text NOT NULL REFERENCES public.mote_game_rules(version),
  outcome text NOT NULL CHECK (outcome IN ('legacy_resource','loss','returned_stake','small','big','jackpot')),
  weight int NOT NULL CHECK (weight > 0),
  motes_multiplier int NOT NULL CHECK (motes_multiplier >= 0),
  acorns_multiplier int NOT NULL CHECK (acorns_multiplier >= 0),
  PRIMARY KEY (rules_version, outcome)
);

INSERT INTO public.mote_game_rules(version, mode, allowed_stakes, presentation_version) VALUES
  ('reveal-v1', 'reveal', ARRAY[1], 'mote-animation-v4'),
  ('wager-v1', 'wager', ARRAY[1,3,5], 'mote-animation-v4');

INSERT INTO public.mote_game_paytable VALUES
  ('reveal-v1','legacy_resource',5000,0,1),
  ('reveal-v1','small',3000,0,2),
  ('reveal-v1','big',1500,0,3),
  ('reveal-v1','jackpot',500,0,5),
  ('wager-v1','loss',5000,0,0),
  ('wager-v1','returned_stake',2500,1,0),
  ('wager-v1','small',1800,2,0),
  ('wager-v1','big',600,3,1),
  ('wager-v1','jackpot',100,10,5);

CREATE OR REPLACE FUNCTION public.reject_mote_rule_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  RAISE EXCEPTION 'Mote game rules are immutable; publish a new version';
END;
$function$;
CREATE TRIGGER mote_game_rules_immutable BEFORE UPDATE OR DELETE ON public.mote_game_rules
  FOR EACH ROW EXECUTE FUNCTION public.reject_mote_rule_mutation();
CREATE TRIGGER mote_game_paytable_immutable BEFORE UPDATE OR DELETE ON public.mote_game_paytable
  FOR EACH ROW EXECUTE FUNCTION public.reject_mote_rule_mutation();

ALTER TABLE public.mote_game_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mote_game_paytable ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mote_game_rules, public.mote_game_paytable FROM PUBLIC, anon, authenticated;

INSERT INTO public.app_settings(key, value, description)
VALUES ('mote_wager_enabled', 'false'::jsonb,
  'Server rollout flag for earned-Mote Wager mode; migration default is false.')
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings(key, value, description)
VALUES ('mote_game_active_rules', '{"reveal":"reveal-v1","wager":"wager-v1"}'::jsonb,
  'Active immutable Mote rules versions. Settlement and state read the same mapping.')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.mote_game_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 8 AND 128),
  protocol_version smallint NOT NULL DEFAULT 2 CHECK (protocol_version = 2),
  mode text NOT NULL CHECK (mode IN ('reveal','wager')),
  stake_motes int NOT NULL CHECK (stake_motes IN (1,3,5)),
  outcome text NOT NULL CHECK (outcome IN ('legacy_resource','loss','returned_stake','small','big','jackpot')),
  motes_returned int NOT NULL CHECK (motes_returned >= 0),
  net_motes int NOT NULL,
  motes_remaining int NOT NULL CHECK (motes_remaining >= 0),
  wallet_revision bigint NOT NULL CHECK (wallet_revision BETWEEN 0 AND 9007199254740991),
  contraption_id text REFERENCES public.contraption_catalog(id),
  resource_id text,
  resource_amount int NOT NULL CHECK (resource_amount >= 0),
  resource_balance int,
  newly_unlocked boolean NOT NULL DEFAULT false,
  reel_stops int[] NOT NULL CHECK (cardinality(reel_stops) = 3),
  reel_value int CHECK (reel_value IN (3,5,10,25)),
  paytable_version text NOT NULL REFERENCES public.mote_game_rules(version),
  presentation_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, request_id),
  CHECK (net_motes = motes_returned - stake_motes),
  CHECK ((resource_amount = 0 AND contraption_id IS NULL AND resource_id IS NULL AND resource_balance IS NULL AND NOT newly_unlocked)
      OR (resource_amount > 0 AND contraption_id IS NOT NULL AND resource_id IS NOT NULL AND resource_balance IS NOT NULL))
);
CREATE INDEX mote_game_plays_owner_history_idx
  ON public.mote_game_plays(user_id, created_at DESC, id DESC);
ALTER TABLE public.mote_game_plays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View your Mote game receipts" ON public.mote_game_plays FOR SELECT TO authenticated
  USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.mote_game_plays FROM PUBLIC, anon, authenticated;
CREATE TRIGGER mote_game_plays_immutable BEFORE UPDATE OR DELETE ON public.mote_game_plays
  FOR EACH ROW EXECUTE FUNCTION public.reject_mote_rule_mutation();

-- Rejection sampling over 16 random bits: 60,000 is exactly divisible by
-- 10,000, so modulo cannot bias any paytable bucket.
CREATE OR REPLACE FUNCTION public._mote_secure_bucket(p_size int)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE b bytea; n int; ceiling int;
BEGIN
  IF p_size IS NULL OR p_size < 1 OR p_size > 10000 THEN RAISE EXCEPTION 'bad bucket size'; END IF;
  ceiling := (65536 / p_size) * p_size;
  LOOP
    -- Supabase installs pgcrypto in `extensions`; the plain-Postgres harness
    -- may expose it in `public`. Resolve only these fixed trusted names.
    IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NOT NULL THEN
      EXECUTE 'SELECT extensions.gen_random_bytes(2)' INTO b;
    ELSIF to_regprocedure('public.gen_random_bytes(integer)') IS NOT NULL THEN
      EXECUTE 'SELECT public.gen_random_bytes(2)' INTO b;
    ELSE
      RAISE EXCEPTION 'pgcrypto gen_random_bytes is unavailable';
    END IF;
    n := get_byte(b, 0) * 256 + get_byte(b, 1);
    IF n < ceiling THEN RETURN n % p_size; END IF;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public._mote_secure_bucket(int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._mote_v2_receipt(p public.mote_game_plays)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT jsonb_build_object(
    'protocol_version',2,'spin_id',p.id,'request_id',p.request_id,'mode',p.mode,
    'stake_motes',p.stake_motes,'outcome',p.outcome,'motes_returned',p.motes_returned,
    'net_motes',p.net_motes,'motes_remaining',p.motes_remaining,
    'wallet_revision',p.wallet_revision,'contraption_id',p.contraption_id,
    'resource_id',p.resource_id,'resource_amount',p.resource_amount,
    'resource_balance',p.resource_balance,'newly_unlocked',p.newly_unlocked,
    'reel_stops',to_jsonb(p.reel_stops),'reel_value',p.reel_value,
    'paytable_version',p.paytable_version,'presentation_version',p.presentation_version,
    'created_at',p.created_at);
$function$;
REVOKE ALL ON FUNCTION public._mote_v2_receipt(public.mote_game_plays) FROM PUBLIC, anon, authenticated;

-- Stable adapter for both historical Mote eras: early receipts granted
-- Tickles, later protocol-1 receipts granted Contraption resources. Unknown
-- historical facts stay null rather than being reconstructed from live state.
CREATE OR REPLACE FUNCTION public._mote_v1_receipt(p public.mote_machine_spins)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT jsonb_build_object(
    'protocol_version',1,'spin_id',p.id,'request_id',p.request_id,'mode','reveal',
    'stake_motes',1,'outcome','legacy_resource','motes_returned',0,'net_motes',-1,
    'motes_remaining',p.motes_remaining,'wallet_revision',p.wallet_revision,
    'contraption_id',p.contraption_id,'resource_id',p.resource_id,
    'resource_amount',p.resource_amount,'resource_balance',NULL,'newly_unlocked',false,
    'reel_stops',CASE WHEN p.reel_value IS NULL THEN NULL ELSE jsonb_build_array(p.reel_value,p.reel_value,p.reel_value) END,
    'reel_value',p.reel_value,'reward_tickles',p.reward_tickles,
    'tickles_balance',p.tickles_balance,'paytable_version',NULL,
    'presentation_version','mote-animation-v3','created_at',p.spun_at);
$function$;
REVOKE ALL ON FUNCTION public._mote_v1_receipt(public.mote_machine_spins) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mote_game_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE caller_id uuid := auth.uid(); p public.profiles; inv jsonb; wager_on boolean; active jsonb; reveal_version text; wager_version text;
BEGIN
  IF caller_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unauthenticated'); END IF;
  SELECT * INTO p FROM public.profiles WHERE id=caller_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','profile_missing'); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('contraption_id',c.id,'name',c.name,
    'resource_id',c.resource_id,'resource_name',c.resource_name,'resource_icon',c.resource_icon,
    'resource_balance',u.resource_balance,'active_until',u.active_until,'unlocked_at',u.unlocked_at)
    ORDER BY u.unlocked_at),'[]'::jsonb) INTO inv
    FROM public.user_contraptions u JOIN public.contraption_catalog c ON c.id=u.contraption_id
    WHERE u.user_id=caller_id;
  wager_on := COALESCE((SELECT value = 'true'::jsonb FROM public.app_settings WHERE key='mote_wager_enabled'),false);
  active := COALESCE((SELECT value FROM public.app_settings WHERE key='mote_game_active_rules'),'{}'::jsonb);
  reveal_version:=active->>'reveal'; wager_version:=active->>'wager';
  RETURN jsonb_build_object('ok',true,'modes',jsonb_build_array('reveal','wager'),
    'allowed_stakes',jsonb_build_object(
      'reveal',to_jsonb((SELECT allowed_stakes FROM public.mote_game_rules WHERE version=reveal_version AND mode='reveal')),
      'wager',to_jsonb((SELECT allowed_stakes FROM public.mote_game_rules WHERE version=wager_version AND mode='wager'))),
    'rules_versions',jsonb_build_object('reveal',reveal_version,'wager',wager_version),
    'paytables',jsonb_build_object(
      'reveal',(SELECT jsonb_agg(jsonb_build_object('outcome',outcome,'weight',weight,'motes_multiplier',motes_multiplier,'acorns_multiplier',acorns_multiplier) ORDER BY outcome) FROM public.mote_game_paytable WHERE rules_version=reveal_version),
      'wager',(SELECT jsonb_agg(jsonb_build_object('outcome',outcome,'weight',weight,'motes_multiplier',motes_multiplier,'acorns_multiplier',acorns_multiplier) ORDER BY outcome) FROM public.mote_game_paytable WHERE rules_version=wager_version)),
    'wallet',jsonb_build_object('motes',p.mote_balance,'revision',p.mote_wallet_revision),
    'inventory',inv,'required_presentation_version',(
      SELECT presentation_version FROM public.mote_game_rules WHERE version=wager_version AND mode='wager'
    ),'wager_enabled',wager_on);
END;
$function$;

CREATE OR REPLACE FUNCTION public.play_mote_game(p_request_id text, p_mode text,
  p_stake_motes int, p_expected_rules_version text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  caller_id uuid := auth.uid(); p public.profiles; prior public.mote_game_plays; rule public.mote_game_rules; active_version text;
  row public.mote_game_paytable; play public.mote_game_plays; draw int; cumulative int := 0;
  chosen text; returned int; acorns int; stops int[]; selector int; was_unlocked boolean;
  resource_balance int; wager_on boolean; max_int constant bigint := 2147483647;
BEGIN
  IF caller_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unauthenticated'); END IF;
  IF p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 8 AND 128 THEN RETURN jsonb_build_object('ok',false,'reason','bad_request_id'); END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('reveal','wager') OR p_stake_motes IS NULL OR p_expected_rules_version IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','bad_request'); END IF;

  -- Global order: profile, then receipt, then inventory. Prestige/Shimmer and
  -- legacy Reveal touch the same profile lock first.
  SELECT * INTO p FROM public.profiles WHERE id=caller_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','profile_missing'); END IF;
  SELECT * INTO prior FROM public.mote_game_plays WHERE user_id=caller_id AND request_id=p_request_id;
  IF FOUND THEN
    IF prior.mode<>p_mode OR prior.stake_motes<>p_stake_motes OR prior.paytable_version<>p_expected_rules_version THEN
      RETURN jsonb_build_object('ok',false,'reason','request_conflict'); END IF;
    RETURN jsonb_build_object('ok',true,'receipt',public._mote_v2_receipt(prior),
      'wallet',jsonb_build_object('motes',p.mote_balance,'revision',p.mote_wallet_revision),'replayed',true);
  END IF;
  IF EXISTS(SELECT 1 FROM public.mote_machine_spins WHERE user_id=caller_id AND request_id=p_request_id) THEN
    RETURN jsonb_build_object('ok',false,'reason','request_conflict'); END IF;
  active_version:=(SELECT value->>p_mode FROM public.app_settings WHERE key='mote_game_active_rules');
  SELECT * INTO rule FROM public.mote_game_rules WHERE version=active_version AND mode=p_mode;
  IF NOT FOUND THEN RAISE EXCEPTION 'active Mote rules missing for mode %',p_mode; END IF;
  IF rule.version IS DISTINCT FROM p_expected_rules_version THEN
    RETURN jsonb_build_object('ok',false,'reason','rules_changed','rules_version',rule.version); END IF;
  IF NOT p_stake_motes=ANY(rule.allowed_stakes) THEN RETURN jsonb_build_object('ok',false,'reason','bad_stake'); END IF;
  wager_on := COALESCE((SELECT value='true'::jsonb FROM public.app_settings WHERE key='mote_wager_enabled'),false);
  IF p_mode='wager' AND NOT wager_on THEN RETURN jsonb_build_object('ok',false,'reason','wager_disabled'); END IF;
  IF p.mote_balance < p_stake_motes THEN RETURN jsonb_build_object('ok',false,'reason','insufficient_motes','motes',p.mote_balance); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contraption_catalog WHERE id='auto_tickler' AND enabled) THEN
    RETURN jsonb_build_object('ok',false,'reason','reward_unavailable'); END IF;
  IF (SELECT sum(weight) FROM public.mote_game_paytable WHERE rules_version=rule.version) <> 10000 THEN RAISE EXCEPTION 'invalid paytable weight'; END IF;
  draw := public._mote_secure_bucket(10000);
  FOR row IN SELECT * FROM public.mote_game_paytable WHERE rules_version=rule.version ORDER BY outcome LOOP
    cumulative := cumulative + row.weight; IF draw < cumulative THEN chosen:=row.outcome; returned:=row.motes_multiplier*p_stake_motes; acorns:=row.acorns_multiplier*p_stake_motes; EXIT; END IF;
  END LOOP;
  IF chosen IS NULL THEN RAISE EXCEPTION 'paytable gap'; END IF;
  IF p.mote_balance::bigint - p_stake_motes + returned > max_int THEN
    RETURN jsonb_build_object('ok',false,'reason','wallet_overflow'); END IF;
  IF chosen='loss' THEN stops := CASE public._mote_secure_bucket(4)
    WHEN 0 THEN ARRAY[0,1,2] WHEN 1 THEN ARRAY[1,2,3]
    WHEN 2 THEN ARRAY[2,3,0] ELSE ARRAY[3,0,1] END;
  ELSIF chosen='returned_stake' THEN stops:=ARRAY[0,0,0]; ELSIF chosen='small' THEN stops:=ARRAY[1,1,1];
  ELSIF chosen='big' THEN stops:=ARRAY[2,2,2]; ELSIF chosen='jackpot' THEN stops:=ARRAY[3,3,3];
  ELSE stops:=ARRAY[0,0,0]; END IF;
  selector := CASE WHEN p_mode='reveal' THEN CASE acorns WHEN 1 THEN 3 WHEN 2 THEN 5 WHEN 3 THEN 10 WHEN 5 THEN 25 END END;
  IF p_mode='reveal' THEN
    chosen:='legacy_resource';
    stops:=ARRAY[selector,selector,selector];
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_contraptions WHERE user_id=caller_id AND contraption_id='auto_tickler') INTO was_unlocked;
  IF acorns > 0 THEN
    IF COALESCE((SELECT uc.resource_balance::bigint FROM public.user_contraptions uc WHERE uc.user_id=caller_id AND uc.contraption_id='auto_tickler'),0)+acorns > max_int THEN
      RETURN jsonb_build_object('ok',false,'reason','resource_overflow'); END IF;
    INSERT INTO public.user_contraptions(user_id,contraption_id,resource_balance,unlocked_at,updated_at)
      VALUES(caller_id,'auto_tickler',acorns,now(),now()) ON CONFLICT(user_id,contraption_id) DO UPDATE
      SET resource_balance=public.user_contraptions.resource_balance+EXCLUDED.resource_balance,updated_at=now()
      RETURNING user_contraptions.resource_balance INTO resource_balance;
  END IF;
  UPDATE public.profiles SET mote_balance=mote_balance-p_stake_motes+returned WHERE id=caller_id RETURNING * INTO p;
  INSERT INTO public.mote_game_plays(user_id,request_id,mode,stake_motes,outcome,motes_returned,net_motes,
    motes_remaining,wallet_revision,contraption_id,resource_id,resource_amount,resource_balance,newly_unlocked,
    reel_stops,reel_value,paytable_version,presentation_version)
  VALUES(caller_id,p_request_id,p_mode,p_stake_motes,chosen,returned,returned-p_stake_motes,p.mote_balance,p.mote_wallet_revision,
    CASE WHEN acorns>0 THEN 'auto_tickler' END,CASE WHEN acorns>0 THEN 'clockwork_acorn' END,acorns,resource_balance,
    acorns>0 AND NOT was_unlocked,stops,selector,rule.version,rule.presentation_version) RETURNING * INTO play;
  RETURN jsonb_build_object('ok',true,'receipt',public._mote_v2_receipt(play),
    'wallet',jsonb_build_object('motes',p.mote_balance,'revision',p.mote_wallet_revision),'replayed',false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mote_play_receipt(p_request_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE caller_id uuid:=auth.uid(); p public.profiles; play public.mote_game_plays; legacy public.mote_machine_spins; receipt jsonb;
BEGIN
  IF caller_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unauthenticated'); END IF;
  SELECT * INTO p FROM public.profiles WHERE id=caller_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','profile_missing'); END IF;
  IF p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 8 AND 128 THEN RETURN jsonb_build_object('ok',false,'reason','bad_request_id'); END IF;
  SELECT * INTO play FROM public.mote_game_plays WHERE user_id=caller_id AND request_id=p_request_id;
  IF FOUND THEN receipt:=public._mote_v2_receipt(play);
  ELSE
    SELECT * INTO legacy FROM public.mote_machine_spins WHERE user_id=caller_id AND request_id=p_request_id;
    IF FOUND THEN receipt:=public._mote_v1_receipt(legacy); END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'receipt',receipt,
    'wallet',jsonb_build_object('motes',p.mote_balance,'revision',p.mote_wallet_revision));
END;
$function$;

CREATE OR REPLACE FUNCTION public.mote_play_history(p_cursor text DEFAULT NULL,p_limit int DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE caller_id uuid:=auth.uid(); p public.profiles; cut_time timestamptz; cut_id uuid; plays jsonb; next_cursor text;
BEGIN
  IF caller_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unauthenticated'); END IF;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>50 THEN RETURN jsonb_build_object('ok',false,'reason','bad_limit'); END IF;
  SELECT * INTO p FROM public.profiles WHERE id=caller_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','profile_missing'); END IF;
  IF p_cursor IS NOT NULL THEN
    BEGIN cut_time:=split_part(convert_from(decode(p_cursor,'base64'),'UTF8'),'|',1)::timestamptz; cut_id:=split_part(convert_from(decode(p_cursor,'base64'),'UTF8'),'|',2)::uuid;
    EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'reason','bad_cursor'); END;
  END IF;
  WITH combined AS (
      SELECT g.created_at,g.id,public._mote_v2_receipt(g) AS receipt FROM public.mote_game_plays g WHERE g.user_id=caller_id
      UNION ALL
      SELECT s.spun_at,s.id,public._mote_v1_receipt(s) AS receipt FROM public.mote_machine_spins s WHERE s.user_id=caller_id
    ), page AS (SELECT * FROM combined
      WHERE p_cursor IS NULL OR (created_at,id)<(cut_time,cut_id) ORDER BY created_at DESC,id DESC LIMIT p_limit+1),
    visible AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT p_limit)
  SELECT COALESCE(jsonb_agg(v.receipt ORDER BY created_at DESC,id DESC),'[]'::jsonb),
    CASE WHEN (SELECT count(*) FROM page)>p_limit THEN (SELECT encode(convert_to(created_at::text||'|'||id::text,'UTF8'),'base64') FROM visible ORDER BY created_at,id LIMIT 1) END
    INTO plays,next_cursor FROM visible v;
  RETURN jsonb_build_object('ok',true,'plays',plays,'next_cursor',next_cursor,
    'wallet',jsonb_build_object('motes',p.mote_balance,'revision',p.mote_wallet_revision));
END;
$function$;

-- Preserve protocol 1 and add revision/current-wallet replay semantics without
-- changing its one-argument request or guaranteed Acorn distribution.
CREATE OR REPLACE FUNCTION public.spin_mote_machine(p_request_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE caller_id uuid:=auth.uid(); p public.profiles; prior public.mote_machine_spins; receipt public.mote_machine_spins;
  draw int; reward int; selector int; was_unlocked boolean; rb int;
BEGIN
  IF caller_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unauthenticated'); END IF;
  IF p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 8 AND 128 THEN RETURN jsonb_build_object('ok',false,'reason','bad_request_id'); END IF;
  SELECT * INTO p FROM public.profiles WHERE id=caller_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','profile_missing'); END IF;
  SELECT * INTO prior FROM public.mote_machine_spins WHERE user_id=caller_id AND request_id=p_request_id;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'spin_id',prior.id,'reward_tickles',prior.reward_tickles,'tickles_balance',prior.tickles_balance,'contraption_id',prior.contraption_id,
    'contraption_name','Auto-Tickler','resource_id',prior.resource_id,'resource_name','Clockwork Acorn','resource_icon','acorn',
    'resource_amount',prior.resource_amount,'resource_balance',(SELECT resource_balance FROM public.user_contraptions WHERE user_id=caller_id AND contraption_id=prior.contraption_id),
    'reel_value',prior.reel_value,'newly_unlocked',false,'motes_remaining',prior.motes_remaining,
    'wallet_revision',p.mote_wallet_revision,'wallet',jsonb_build_object('motes',p.mote_balance,'revision',p.mote_wallet_revision),'replayed',true); END IF;
  IF EXISTS(SELECT 1 FROM public.mote_game_plays WHERE user_id=caller_id AND request_id=p_request_id) THEN
    RETURN jsonb_build_object('ok',false,'reason','request_conflict'); END IF;
  IF p.mote_balance<1 THEN RETURN jsonb_build_object('ok',false,'reason','no_motes','motes',p.mote_balance); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.contraption_catalog WHERE id='auto_tickler' AND enabled) THEN
    RETURN jsonb_build_object('ok',false,'reason','reward_unavailable'); END IF;
  draw:=public._mote_secure_bucket(10000); reward:=CASE WHEN draw<5000 THEN 1 WHEN draw<8000 THEN 2 WHEN draw<9500 THEN 3 ELSE 5 END;
  selector:=CASE reward WHEN 1 THEN 3 WHEN 2 THEN 5 WHEN 3 THEN 10 ELSE 25 END;
  SELECT EXISTS(SELECT 1 FROM public.user_contraptions WHERE user_id=caller_id AND contraption_id='auto_tickler') INTO was_unlocked;
  INSERT INTO public.user_contraptions(user_id,contraption_id,resource_balance,unlocked_at,updated_at) VALUES(caller_id,'auto_tickler',reward,now(),now())
    ON CONFLICT(user_id,contraption_id) DO UPDATE SET resource_balance=public.user_contraptions.resource_balance+EXCLUDED.resource_balance,updated_at=now()
    RETURNING resource_balance INTO rb;
  UPDATE public.profiles SET mote_balance=mote_balance-1 WHERE id=caller_id RETURNING * INTO p;
  INSERT INTO public.mote_machine_spins(user_id,request_id,reward_tickles,motes_remaining,tickles_balance,contraption_id,resource_id,resource_amount,reel_value,wallet_revision)
    VALUES(caller_id,p_request_id,NULL,p.mote_balance,COALESCE((public.tickle_info(caller_id)->>'balance')::int,0),'auto_tickler','clockwork_acorn',reward,selector,p.mote_wallet_revision) RETURNING * INTO receipt;
  RETURN jsonb_build_object('ok',true,'spin_id',receipt.id,'reward_tickles',receipt.reward_tickles,'tickles_balance',receipt.tickles_balance,'contraption_id','auto_tickler','contraption_name','Auto-Tickler',
    'resource_id','clockwork_acorn','resource_name','Clockwork Acorn','resource_icon','acorn','resource_amount',reward,'resource_balance',rb,
    'reel_value',selector,'newly_unlocked',NOT was_unlocked,'motes_remaining',p.mote_balance,'wallet_revision',p.mote_wallet_revision,
    'wallet',jsonb_build_object('motes',p.mote_balance,'revision',p.mote_wallet_revision),'replayed',false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mote_machine_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE s jsonb;
BEGIN
  s:=public.mote_game_state();
  IF NOT COALESCE((s->>'ok')::boolean,false) THEN RETURN s; END IF;
  RETURN jsonb_build_object('ok',true,'motes',(s#>>'{wallet,motes}')::int,
    'wallet_revision',(s#>>'{wallet,revision}')::bigint,'wallet',s->'wallet',
    'reward_family',jsonb_build_object('contraption_id','auto_tickler','name','Auto-Tickler',
      'resource_id','clockwork_acorn','resource_name','Clockwork Acorn','resource_icon','acorn'),
    'inventory',s->'inventory');
END;
$function$;

REVOKE ALL ON FUNCTION public.mote_game_state() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.play_mote_game(text,text,int,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.mote_play_receipt(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.mote_play_history(text,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mote_game_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.play_mote_game(text,text,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mote_play_receipt(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mote_play_history(text,int) TO authenticated;
