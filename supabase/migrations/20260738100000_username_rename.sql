-- Paid username rename. The first rename is free; the second costs 1,000
-- snouts, every rename after that costs 10,000. Snouts live in
-- profiles.counter (same currency buy_hat spends from — 20260501210000).
--
-- rename_username models buy_hat's atomic-deduction shape: lock the caller's
-- profile row FOR UPDATE, check the balance, then UPDATE in one statement so
-- the deduction and the name change land together. The UPDATE trips the
-- username-moderation trigger (20260645000000) and the profiles_username_key
-- unique index; both are caught and mapped to jsonb refusal envelopes rather
-- than propagating as a rolled-back exception.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS renames_used int NOT NULL DEFAULT 0;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rename_username(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  v_name text;
  v_current_name text;
  v_counter bigint;
  v_used int;
  v_cost int;
  v_next_cost int;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authed');
  END IF;

  -- Length rules mirror UsernameSetup.tsx (trimmed, 3–24 chars).
  v_name := btrim(p_name);
  IF char_length(v_name) < 3 OR char_length(v_name) > 24 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_name');
  END IF;

  SELECT username, counter, renames_used
    INTO v_current_name, v_counter, v_used
    FROM public.profiles WHERE id = caller_id FOR UPDATE;
  IF v_counter IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
  END IF;

  -- No-op rename: identical to the current name, no charge.
  IF v_current_name IS NOT NULL AND v_name = v_current_name THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'same_name');
  END IF;

  -- Cost ladder: first rename free, second 1,000, third+ 10,000.
  v_cost := CASE
    WHEN v_used = 0 THEN 0
    WHEN v_used = 1 THEN 1000
    ELSE 10000
  END;

  IF v_counter < v_cost THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'not_enough_snouts', 'cost', v_cost
    );
  END IF;

  -- Atomic: name + deduction + rename-count in one UPDATE. The moderation
  -- trigger fires here on the username change; the unique index guards
  -- collisions. Discriminator is left untouched.
  BEGIN
    UPDATE public.profiles
      SET username = v_name,
          counter = counter - v_cost,
          renames_used = renames_used + 1
      WHERE id = caller_id;
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      -- profiles_enforce_username_moderation raises 'username_not_allowed'.
      IF SQLERRM LIKE '%username_not_allowed%' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'not_allowed');
      END IF;
      RAISE;
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'name_taken');
  END;

  -- next_cost = what the NEXT rename after this one would cost.
  v_next_cost := CASE
    WHEN v_used + 1 = 1 THEN 1000
    ELSE 10000
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'remaining', v_counter - v_cost,
    'cost', v_cost,
    'next_cost', v_next_cost
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rename_username(text) TO authenticated;
