-- Analytics overview RPC for the Vercel dashboard.
--
-- One SECURITY DEFINER function that returns a single jsonb blob of
-- AGGREGATE-ONLY metrics across every user-facing action: signups, active
-- users, home tickles, barn visits, blessings, curses, tickle trades, truffles
-- buried/dug, season XP, happiness + alignment distributions, plus a 14-day
-- daily time series and small leaderboards (public usernames only).
--
-- No PII beyond usernames that already appear on the in-app leaderboard.
-- Test accounts (profiles.is_test) are excluded from user-population metrics.
-- Granted to anon so the dashboard can read it with the public anon key; the
-- dashboard itself is password-gated. SECURITY DEFINER so it can read
-- auth.users.created_at for the signup time series.

create or replace function public.analytics_overview()
returns jsonb
language sql
security definer
set search_path = public, auth
stable
as $$
  with
  real_profiles as (
    select * from profiles where coalesce(is_test, false) = false
  ),
  -- 14-day calendar (today back 13 days), in UTC.
  days as (
    select (current_date - g) as day
    from generate_series(0, 13) as g
  ),
  series as (
    select
      d.day,
      (select count(*) from auth.users u where u.created_at::date = d.day)               as signups,
      (select count(*) from barn_visits  v where v.created_at::date = d.day)             as visits,
      (select coalesce(sum(v.tickles),0) from barn_visits v where v.created_at::date = d.day) as visit_tickles,
      (select count(*) from blessings    b where b.sent_at::date   = d.day)             as blessings,
      (select count(*) from curses       c where c.sent_at::date   = d.day)             as curses,
      (select count(*) from tickle_trades t where t.created_at::date = d.day)           as trades,
      (select count(*) from truffles     t where t.buried_at::date = d.day)             as truffles_buried,
      (select count(*) from truffle_digs t where t.dug_at::date    = d.day)             as truffle_digs
    from days d
    order by d.day
  )
  select jsonb_build_object(
    'generated_at', now(),

    'totals', jsonb_build_object(
      'users',            (select count(*) from real_profiles),
      'active_1d',        (select count(*) from real_profiles where last_active_date >= current_date),
      'active_7d',        (select count(*) from real_profiles where last_active_date >= current_date - 6),
      'active_30d',       (select count(*) from real_profiles where last_active_date >= current_date - 29),
      'push_enabled',     (select count(*) from real_profiles where expo_push_token is not null),
      'vip',              (select count(*) from real_profiles where is_vip),
      'tickles_earned',   (select coalesce(sum(tickles_earned),0) from real_profiles),
      'tickles_wasted',   (select coalesce(sum(tickles_wasted_total),0) from real_profiles),
      'referrals_done',   (select coalesce(sum(referrals_completed),0) from real_profiles),
      'barn_visits',      (select count(*) from barn_visits),
      'blessings',        (select count(*) from blessings),
      'curses',           (select count(*) from curses),
      'trades',           (select count(*) from tickle_trades),
      'trades_open',      (select count(*) from tickle_trades where status = 'open'),
      'trades_fulfilled', (select count(*) from tickle_trades where status = 'fulfilled'),
      'truffles_buried',  (select count(*) from truffles),
      'truffle_digs',     (select count(*) from truffle_digs),
      'friendships',      (select count(*) from friendships where status = 'accepted')
    ),

    'series', (select jsonb_agg(to_jsonb(series)) from series),

    'happiness', (
      select jsonb_build_object(
        'sad',     count(*) filter (where happiness < 34),
        'neutral', count(*) filter (where happiness >= 34 and happiness < 67),
        'happy',   count(*) filter (where happiness >= 67),
        'avg',     round(coalesce(avg(happiness),0), 1)
      ) from real_profiles
    ),

    'alignment', (
      select jsonb_build_object(
        'angel',   count(*) filter (where alignment_score > 0),
        'neutral', count(*) filter (where coalesce(alignment_score,0) = 0),
        'goblin',  count(*) filter (where alignment_score < 0)
      ) from real_profiles
    ),

    'season', (
      select jsonb_build_object(
        'players',       count(*),
        'avg_xp',        round(coalesce(avg(xp),0)),
        'avg_tier',      round(coalesce(avg(floor(xp/100.0)),0), 1),
        'premium',       count(*) filter (where premium_unlocked),
        'tier_complete', count(*) filter (where xp >= 3000)
      )
      from user_season_progress
      where user_id in (select id from real_profiles)
    ),

    'top_tickles', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select username, tickles_earned as value
        from real_profiles
        where coalesce(hide_from_leaderboard, false) = false and username is not null
        order by tickles_earned desc nulls last
        limit 10
      ) t
    ),

    'top_xp', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select p.username, sp.xp as value
        from user_season_progress sp
        join real_profiles p on p.id = sp.user_id
        where coalesce(p.hide_from_leaderboard, false) = false and p.username is not null
        order by sp.xp desc nulls last
        limit 10
      ) t
    )
  );
$$;

grant execute on function public.analytics_overview() to anon, authenticated;
