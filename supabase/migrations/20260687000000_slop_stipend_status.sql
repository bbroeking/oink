-- Slop Club monthly stipend: a read-only STATUS RPC so the UI can show a
-- real "Claim 250 snouts" button (claimable vs already-claimed-this-month +
-- when the next one unlocks). The claim itself (claim_slop_stipend, +250 to
-- counter once per UTC month for is_vip members) already ships in 20260535 and
-- is unchanged — this only adds the read surface. Modeled on lucky_today() /
-- season_state(). Pure read; no carry-latest-def concern.

CREATE OR REPLACE FUNCTION public.slop_stipend_status()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'is_member', COALESCE(p.is_vip, false),
    'amount', 250,
    -- 'on the 1st' = the UTC calendar month, matching claim_slop_stipend.
    'claimed_this_month',
      (p.last_stipend_month IS NOT DISTINCT FROM
        to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM')),
    'next_at',
      (date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month')::date
  )
  FROM public.profiles p
  WHERE p.id = auth.uid();
$function$;

GRANT EXECUTE ON FUNCTION public.slop_stipend_status() TO authenticated;
