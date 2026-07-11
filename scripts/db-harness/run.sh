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
)

NAME="pgharness_$$"
docker run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=postgres postgres:15-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
# The alpine image restarts once during init — wait for the FINAL server.
until docker logs "$NAME" 2>&1 | grep -q "init process complete"; do :; done
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do :; done

cat scripts/db-harness/00_stub.sql "${CHAIN[@]}" "$@" scripts/db-harness/[123]*_smoke.sql \
	| docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 > /tmp/db-harness.out 2>&1 \
	|| { echo "HARNESS FAILED — tail of /tmp/db-harness.out:"; tail -25 /tmp/db-harness.out; exit 1; }

grep -E "chk|ribbons after" /tmp/db-harness.out | head -40
echo "DB HARNESS OK (full output: /tmp/db-harness.out)"
