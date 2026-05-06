-- Hats shop: catalog of hats, user inventory, equipped hat, buy RPC.

CREATE TABLE public.hats (
  id text PRIMARY KEY,
  name text NOT NULL,
  emoji text,
  image_path text,
  cost integer NOT NULL CHECK (cost >= 0),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_hats (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hat_id text NOT NULL REFERENCES public.hats(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hat_id)
);

ALTER TABLE public.profiles
  ADD COLUMN active_hat_id text REFERENCES public.hats(id) ON DELETE SET NULL;

ALTER TABLE public.hats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hats catalog public" ON public.hats FOR SELECT USING (true);
CREATE POLICY "View own inventory" ON public.user_hats FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.hats TO authenticated, anon;
GRANT SELECT ON public.user_hats TO authenticated;

-- Seed
INSERT INTO public.hats (id, name, emoji, cost, display_order) VALUES
  ('party',  'Party Hat',   '🥳', 25,  1),
  ('cowboy', 'Cowboy Hat',  '🤠', 50,  2),
  ('wizard', 'Wizard Hat',  '🧙', 100, 3),
  ('tophat', 'Top Hat',     '🎩', 200, 4);

set check_function_bodies = off;

-- Buy a hat: atomic deduction from counter + inventory insert
CREATE OR REPLACE FUNCTION public.buy_hat(target_hat_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  hat_cost integer;
  current_counter bigint;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT cost INTO hat_cost FROM public.hats WHERE id = target_hat_id;
  IF hat_cost IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_hat');
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = caller_id AND hat_id = target_hat_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_owned');
  END IF;

  SELECT counter INTO current_counter FROM public.profiles WHERE id = caller_id FOR UPDATE;
  IF current_counter IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
  END IF;
  IF current_counter < hat_cost THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'insufficient',
      'have', current_counter, 'need', hat_cost
    );
  END IF;

  UPDATE public.profiles SET counter = counter - hat_cost WHERE id = caller_id;
  INSERT INTO public.user_hats (user_id, hat_id) VALUES (caller_id, target_hat_id);

  RETURN jsonb_build_object('ok', true, 'remaining', current_counter - hat_cost);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.buy_hat(text) TO authenticated;
