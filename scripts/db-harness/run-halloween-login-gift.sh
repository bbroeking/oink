#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

task_container="ttp-halloween-gift-tests-$$"
task_image="${HALLOWEEN_GIFT_TEST_IMAGE:-postgres:17.6}"
cleanup() { docker rm --force "$task_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run --detach --rm --pull=never --network none \
	--name "$task_container" -e POSTGRES_HOST_AUTH_METHOD=trust "$task_image" >/dev/null
task_ready=false
for _attempt in {1..80}; do
	if docker exec "$task_container" sh -c \
		'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres' >/dev/null 2>&1; then
		task_ready=true
		break
	fi
	sleep 0.25
done
if [[ "$task_ready" != true ]]; then
	echo 'Halloween gift test database did not become ready.' >&2
	exit 1
fi

for task_sql in \
	scripts/db-harness/00_stub.sql \
	supabase/migrations/20261014180000_seasonal_card_item_unlocks.sql \
	scripts/db-harness/00za_halloween_login_gift_prep.sql \
	supabase/migrations/20261014200000_halloween_login_costume_gift.sql \
	scripts/db-harness/75_halloween_login_gift_smoke.sql \
	scripts/db-harness/76_halloween_login_gift_concurrency_smoke.sql; do
	docker exec -i "$task_container" psql -q -U postgres -d postgres \
		-v ON_ERROR_STOP=1 < "$task_sql"
done

echo 'Halloween login gift database contracts passed.'
