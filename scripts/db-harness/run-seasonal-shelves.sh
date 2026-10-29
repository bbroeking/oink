#!/usr/bin/env bash
# Focused seasonal-shelf contract tests (20261029220000_seasonal_shelves.sql).
# Uses only a disposable local database.
set -euo pipefail
cd "$(dirname "$0")/../.."

task_container="ttp-seasonal-shelf-tests-$$"
task_image="${SEASONAL_SHELF_TEST_IMAGE:-postgres:15-alpine}"

cleanup() {
	docker rm --force "$task_container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# No published ports, network access, mounted files, or production credentials.
# The official image must already be available locally.
docker run --detach --rm --pull=never --network none \
	--name "$task_container" -e POSTGRES_HOST_AUTH_METHOD=trust \
	"$task_image" >/dev/null

task_ready=false
for _attempt in {1..80}; do
	# The image briefly starts a temporary initialization server. Wait until
	# PostgreSQL replaces the entrypoint as PID 1 before accepting readiness.
	if docker exec "$task_container" sh -c \
		'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres' \
		>/dev/null 2>&1; then
		task_ready=true
		break
	fi
	sleep 0.25
done
if [[ "$task_ready" != true ]]; then
	echo 'Seasonal shelf test database did not become ready.' >&2
	exit 1
fi

for task_sql in \
	scripts/db-harness/00_stub.sql \
	scripts/db-harness/00zc_seasonal_shelves_prep.sql \
	supabase/migrations/20261029170000_halloween_weekend_shelf.sql \
	supabase/migrations/20261029220000_seasonal_shelves.sql \
	supabase/migrations/20261029230000_halloween_2026_catalog.sql \
	scripts/db-harness/A3_seasonal_shelves_smoke.sql; do
	docker exec -i "$task_container" psql -q -U postgres -d postgres \
		-v ON_ERROR_STOP=1 < "$task_sql"
done

echo 'Seasonal shelf database contracts passed.'
