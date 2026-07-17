#!/usr/bin/env bash
# Snout-wars DB harness — validates the war/league migration chain + smokes
# on a throwaway plain-Postgres container (local `supabase db reset` dies at
# the pg_cron wall; see memory/project_local_db_validation + docs/wiki/outputs/
# memos/db-push-safety-audit-2026-07.md §5.3).
#
# Usage: scripts/db-harness/run.sh [extra_migration.sql ...]
#   Applies: 00_stub.sql → the war/league migration chain (20260707/08/09/10)
#   → any extra migrations passed as args → the numbered *_smoke.sql suites.
#   Exit 0 = every statement + assertion ran clean.
#
# Requires: colima started + docker CLI (both installed via Homebrew).
set -euo pipefail
cd "$(dirname "$0")/../.."

CHAIN=(
	supabase/migrations/20260707000000_sounder_league.sql
	supabase/migrations/20260708000000_sounder_ribbons.sql
	supabase/migrations/20260709000000_season_renumber.sql
	supabase/migrations/20260710000000_season1_achievements.sql
	supabase/migrations/20260713000000_plain_totals_fixtures.sql
	# 20260714 tears the war/league stack back out and rebuilds the co-op dig —
	# the chain builds the whole thing up, then this rips it down + rebuilds.
	supabase/migrations/20260714000000_coop_dig_rebuild.sql
	# 20260715 layers the 24h dig-off (versus) back on top of the co-op dig.
	supabase/migrations/20260715000000_digoff.sql
	# 20260716 wraps open_rooting/submit_rooting in the {ok:...} rpcAction envelope.
	supabase/migrations/20260716000000_rooting_rpc_envelope.sql
	# 20260717 fixes the 22P02 shimmer landmine in rooting_finds (untyped ||
	# literal) — replaces 00_stub's copy so the smokes exercise the REAL board fn.
	supabase/migrations/20260717000000_rooting_finds_shimmer_cast.sql
	# 20260718 adds the three dig-off push moments + the 10-min sweeper cron.
	supabase/migrations/20260718000000_digoff_pushes.sql
	# 20260719 replaces the 1-v-1 dig-off with the global Mon/Thu race.
	supabase/migrations/20260719000000_digoff_race.sql
	# 20260720 makes the race weekly Monday-anchored + adds the season board.
	supabase/migrations/20260720000000_weekly_race_season_board.sql
	# 20260721 adds the 4h-open/4h-guarded patch phase + the ttp.fake_now clock.
	supabase/migrations/20260721000000_patch_phase.sql
	# 20260722 adds race_crew_detail — the per-member dig-off ledger RPC.
	supabase/migrations/20260722000000_race_crew_detail.sql
	# 20260723 adds rename_crew — leader-only Sounder rename.
	supabase/migrations/20260723000000_rename_crew.sql
	# 20260724 flips the world_boss per-user override for the founder profile.
	supabase/migrations/20260724000000_world_boss_brian_override.sql
	# 20260725 makes create_crew assign a random Sounder name (ignores p_name).
	supabase/migrations/20260725000000_random_crew_names.sql
	# 00c prep: backfills profiles.is_test/hide_from_leaderboard + user_items +
	# seed rows the graduation block (20260726 → 20260737) reads/writes. Must
	# precede 20260726 (check_function_bodies validates the graduate body).
	scripts/db-harness/00c_lifetime_tickles_prep.sql
	# 20260726 graduates the Season-0 board (folds tickles into the lifetime base).
	supabase/migrations/20260726000000_graduate_season0_board.sql
	# 20260727 adds the premium-pass member cosmetics band.
	supabase/migrations/20260727000000_premium_pass_member_cosmetics.sql
	# 20260728 adds the Season-1 relic pool + Burrow Book: open_rooting rolls +
	# returns unique_id, submit_rooting claims 'unique' into user_uniques. Carries
	# open_rooting/submit_rooting VERBATIM from 20260721. Exercised by 22_uniques.
	supabase/migrations/20260728000000_patch_uniques.sql
	# 20260730 layers "the one that got away" carry-over (user_patch_carry +
	# best_gild + p_missed) on top; carries the LATEST open_rooting/submit_rooting
	# defs (unique_id key + {ok} envelope + race attribution) that 15/16/22 assert.
	supabase/migrations/20260730000000_patch_carryover.sql
	# 00b prep: backfills hats.name/rarity/emoji/cost/display_order/category onto
	# the minimal stub so redeem_code()/the crown INSERT parse. Must precede 20260732.
	scripts/db-harness/00b_redemption_prep.sql
	# 20260732 adds redeem_code() + redemption_codes; exercised by 36_redemption.
	supabase/migrations/20260732000000_qr_redemption.sql
	# 20260733 seeds the grant-only Release Party Crown hat.
	supabase/migrations/20260733000000_release_party_crown.sql
	# 20260734 caps ticket-taker redemptions.
	supabase/migrations/20260734000000_ticket_takers_cap.sql
	# 20260735 adds graduate_season0_probe() — the dry-run graduation counter.
	supabase/migrations/20260735000000_graduation_probe.sql
	# 20260736 fixes the safeupdate footgun in the graduation path.
	supabase/migrations/20260736000000_graduation_safeupdate_fix.sql
	# 20260737 adds profiles.tickles_lifetime_base + folds season totals in;
	# exercised by 50_lifetime_tickles_smoke.sql.
	supabase/migrations/20260737000000_lifetime_tickles.sql
	# 20260738000000 makes the invite cap count members + pending invites (a
	# pending ask reserves a seat) + adds cancel_crew_invite. Carries
	# invite_to_crew/accept_crew_invite (20260707) + join_crew (20260719)
	# VERBATIM. Exercised by 23_invite_seats_smoke.sql.
	supabase/migrations/20260738000000_sounder_invite_seats.sql
	# 20260738100000 adds rename_username() — the paid-rename ladder; 51 smoke.
	# (51 is self-contained: it preps its own username unique index + moderation.)
	supabase/migrations/20260738100000_username_rename.sql
	# 00d prep: builds a minimal public.truffles (stub lacks it) so the carried
	# reclaim_truffle/bury_truffle bodies validate. Must precede 20260738400000.
	scripts/db-harness/00d_truffle_prep.sql
	# 20260738400000 adds the 12h truffle-reclaim re-bury cooldown; 52 smoke.
	# (52 is self-contained: it re-preps its own truffle tables via IF NOT EXISTS.)
	supabase/migrations/20260738400000_truffle_reclaim_cooldown.sql
	# NOTE: 20260738200000 (6/7 flag), 20260738300000 (happiness precision),
	# 20260738500000 (deprecate items), 20260738700000 (barn-tap XP nerf) are
	# deliberately OMITTED — no smoke exercises them and no later chained migration
	# depends on them; chaining them would only need stub bloat (profiles.happiness,
	# home_stats deps, etc.) for zero test coverage. Add them here if a future smoke
	# starts asserting apply_happiness/home_stats/tickle_at_barn behavior.
	# 20260738 widens the name pools (16 adj × 12 noun); no-name founding client.
	supabase/migrations/20260738600000_sounder_random_names.sql
	# 20260738800000 adds me_lifetime_stats() — the Me-tab lifetime dashboard's
	# aggregate counts; exercised by 53_me_lifetime_stats_smoke.sql.
	supabase/migrations/20260738800000_me_lifetime_stats.sql
	# 20260738900000 adds claim_beginners_snout() — the one-time first-practice
	# Golden Truffle grant; exercised by 37_beginners_snout_smoke.sql.
	supabase/migrations/20260738900000_beginners_snout.sql
	# 20260739000000 adds barn_pair_locks() — the friends-list per-pair barn lock
	# probe (same pairwise lock as barn_visit_status); exercised by
	# 38_barn_pair_locks_smoke.sql. It self-stands its own barn_visits table.
	supabase/migrations/20260739000000_barn_pair_locks.sql
	# 20260739100000 seeds the Season-1 finale reward (Hungerer's Crown hat +
	# "Starver of the Hunger" title) + grant_season1_finale() — grants both to
	# every digger with >=10 Season-1 credited finds. Exercised by
	# 39_finale_reward_smoke.sql. Needs the 20260714 war_rootings shape
	# (credited_finds) already built above in the chain.
	supabase/migrations/20260739100000_season1_finale_reward.sql
	# 20260739300000 adds friend_favorites — the owner-only pin table (direct
	# table access under RLS, no RPC); exercised by 40_friend_favorites_smoke.sql.
	# Depends only on auth.users (stubbed) + the `authenticated` role (stubbed).
	supabase/migrations/20260739300000_friend_favorites.sql
	# 20260742000000 makes open Sounders knock-to-join: a crewless pig files a
	# crew_join_requests row (request_to_join), any member accepts/declines. Carries
	# join_crew (20260738000000) — repurposed into request semantics — + crew_state
	# (20260714000000) VERBATIM + two new join_requests arrays. Exercised by
	# 41_join_requests_smoke.sql.
	supabase/migrations/20260742000000_join_requests.sql
	# 00e prep: builds minimal public.tickle_trades + public.barn_visits (the stub
	# has neither) so 20260743's AFTER triggers + backfill apply. Must precede it.
	scripts/db-harness/00e_pair_bonds_prep.sql
	# 20260743000000 adds pair_bonds — the friendship-bond ledger (trades +
	# blessings + visits), its fail-soft maintenance triggers, the one-time
	# backfill, and pair_leaderboard/pair_bond_with. Exercised by 42_pair_bonds_smoke.
	supabase/migrations/20260743000000_pair_bonds.sql
	# 20260744000000 shifts the feeding-window anchor +2h (boundaries at 02/10/18
	# UTC): carries patch_phase_open/feeding_state/open_rooting/submit_rooting
	# with offset-aware window math. The 15/16/22 smokes compute their pinned
	# block starts offset-aware; 17 asserts the new anchor edges.
	supabase/migrations/20260744000000_window_shift.sql
	# 20260744100000 makes the schedule SERVER-AUTHORITATIVE: app_settings +
	# app_setting()/_feeding_sched(), and re-carries the four window functions to
	# read the config row (one UPDATE = a schedule shift, no binary). Exercised
	# by 10_feeding_flip_smoke (legacy seed + release-day flip rehearsal) and
	# 43_feeding_schedule_smoke; 15/16/17/22 run against the FLIPPED row.
	supabase/migrations/20260744100000_feeding_schedule_config.sql
	# 20260745000000 adds the Den — player feedback: submit_feedback (in-app),
	# submit_feedback_web (anon, honeypot + hourly cap), feedback_dump/mark
	# (secret-gated founder archive). RPC-only feedback table (zero-policy RLS).
	# Needs app_settings (20260744100000, above). Exercised by 54_feedback_den_smoke.
	supabase/migrations/20260745000000_feedback_den.sql
	# 20260748000000 seeds crew boards (wedge 5a): open_rooting derives the board
	# seed from f(window, crew_id) instead of f(window, user_id), so the whole
	# Sounder digs the identical patch each feeding. Carries open_rooting VERBATIM
	# from 20260744100000 (the latest def; 20260746/20260747 don't touch it) with
	# only the seed line changed. Exercised by 46_seeded_boards_smoke.sql.
	supabase/migrations/20260748000000_seeded_crew_boards.sql
	# 00f prep: builds item_drives + are_blocked() + system_announcements.seen_at
	# + hats.name AHEAD of 20260746 (passed as $@) so check_function_bodies can
	# validate the redefined nudge_trough body. Exercised by
	# 44_trough_nudge_supersede_smoke.sql (auto-globbed by [1234]*_smoke.sql).
	scripts/db-harness/00f_trough_nudge_prep.sql
	# 00g prep: builds item_drive_donations + the item_drives reward columns AND
	# seeds the claw-back fixture AHEAD of 20260751 (spec 15, passed as $@) so
	# check_function_bodies validates the redefined donate_to_drive/claim_drive_reward
	# and the migration's one-shot claw-back consumes the seed. Exercised by
	# 49_trough_retire_smoke.sql (auto-globbed by [1234]*_smoke.sql).
	scripts/db-harness/00g_trough_retire_prep.sql
	# 00h prep: builds truffle_digs + adds claimed_at to daily_lucky_claims /
	# user_tier_claims AHEAD of 20260753 (spec 17, passed as $@) so
	# check_function_bodies validates the tickle_breakdown body. Exercised by
	# 56_tickle_breakdown_smoke.sql (explicitly appended below — 5x isn't globbed).
	scripts/db-harness/00h_tickle_breakdown_prep.sql
)

NAME="pgharness_$$"
docker run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=postgres postgres:15-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
# The alpine image restarts once during init — wait for the FINAL server.
until docker logs "$NAME" 2>&1 | grep -q "init process complete"; do :; done
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do :; done

cat scripts/db-harness/00_stub.sql "${CHAIN[@]}" "$@" \
		scripts/db-harness/[1234]*_smoke.sql \
		scripts/db-harness/54_feedback_den_smoke.sql \
		scripts/db-harness/55_field_guide_smoke.sql \
		scripts/db-harness/56_tickle_breakdown_smoke.sql \
	| docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 > /tmp/db-harness.out 2>&1 \
	|| { echo "HARNESS FAILED — tail of /tmp/db-harness.out:"; tail -25 /tmp/db-harness.out; exit 1; }

grep -E "chk|ribbons after" /tmp/db-harness.out | head -40
echo "DB HARNESS OK (full output: /tmp/db-harness.out)"
