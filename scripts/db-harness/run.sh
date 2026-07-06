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
