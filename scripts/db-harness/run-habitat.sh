#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
NAME="pghabitat_$$"
docker run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=postgres postgres:15-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
until docker logs "$NAME" 2>&1 | grep -q "init process complete"; do :; done
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do :; done
cat scripts/db-harness/00_stub.sql \
		scripts/db-harness/00o_habitat_prep.sql \
		supabase/migrations/20260786000000_interaction_analytics.sql \
		supabase/migrations/20260906190000_player_barn_housing.sql \
		scripts/db-harness/73_habitat_smoke.sql \
		scripts/db-harness/74_habitat_concurrency_smoke.sql \
		supabase/migrations/20260907010000_barn_furnishing_expansion.sql \
		scripts/db-harness/76_barn_furnishing_expansion_smoke.sql \
		scripts/db-harness/77_barn_furnishing_expansion_concurrency_smoke.sql \
		supabase/migrations/20260908000000_habitat_starter_provisioning.sql \
		scripts/db-harness/78_habitat_starter_provisioning_smoke.sql \
		scripts/db-harness/00k_sluggish_snout_regen_prep.sql \
		scripts/db-harness/00q_habitat_prestige_prep.sql \
		supabase/migrations/20260910120000_habitat_prestige_rewards.sql \
		scripts/db-harness/79_habitat_prestige_rewards_smoke.sql \
		scripts/db-harness/00r_habitat_completion_prep.sql \
		supabase/migrations/20260910130000_habitat_completion.sql \
		scripts/db-harness/80_habitat_completion_smoke.sql \
		scripts/db-harness/00s_empty_starter_barns_prep.sql \
		supabase/migrations/20260913050000_empty_starter_barns.sql \
		scripts/db-harness/81_empty_starter_barns_smoke.sql \
		supabase/migrations/20260913020000_retire_barn_guestbook.sql \
		scripts/db-harness/85_retire_barn_guestbook_smoke.sql \
	| docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 > /tmp/db-habitat-harness.out 2>&1 \
	|| { echo "HABITAT HARNESS FAILED — tail of /tmp/db-habitat-harness.out:"; tail -35 /tmp/db-habitat-harness.out; exit 1; }
grep -E "chk habitat|chk empty starter barns|chk habitat guestbook retired" /tmp/db-habitat-harness.out
echo "HABITAT DB HARNESS OK (full output: /tmp/db-habitat-harness.out)"
