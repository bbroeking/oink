#!/usr/bin/env bash
# Run Bullion's Market locally (iOS simulator, dev build).
#
#   bash scripts/run-market-local.sh            # checkout, install, (optional) DB push, run
#   SKIP_DB=1 bash scripts/run-market-local.sh  # never ask about the DB push
#
# Steps:
#   1. Fetch and check out claude/backend-ui-implementation-buzz5y (refuses on a dirty tree).
#   2. pnpm install (frozen lockfile).
#   3. OPTIONAL: apply supabase/migrations/20261031100000_bullions_market.sql with
#      `npm run db:push` — only after you type "push it now" (CLAUDE.md: DB pushes
#      need an explicit go). Without it the app runs, but the Market row stays
#      hidden and /market says "Bullion isn't open yet".
#   4. CocoaPods (with the null-byte-flake fallback from CLAUDE.md), then
#      `expo run:ios` with Metro's 16 GB heap.
# The Market is the "Market" row on the Barn button's fan.
set -euo pipefail

BRANCH="claude/backend-ui-implementation-buzz5y"
MIGRATION="supabase/migrations/20261031100000_bullions_market.sql"
export NODE_OPTIONS="--max-old-space-size=16384"

cd "$(git rev-parse --show-toplevel)"

echo "==> 1/4  Checking out $BRANCH"
if [ -n "$(git status --porcelain)" ]; then
	echo "Your working tree has uncommitted changes. Commit or stash them first:" >&2
	git status --short >&2
	exit 1
fi
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> 2/4  Installing dependencies"
command -v pnpm >/dev/null || npm i -g pnpm
pnpm install --frozen-lockfile

echo "==> 3/4  Database migration"
if [ "${SKIP_DB:-0}" = "1" ]; then
	echo "SKIP_DB=1: not pushing. The market will stay hidden until $MIGRATION is applied."
else
	echo "This applies $MIGRATION to the Supabase project this repo is linked to"
	echo "(market tables + functions, satchel_items.market_cost, source 'market')."
	read -r -p 'Type "push it now" to apply it, or press Enter to skip: ' answer
	if [ "$answer" = "push it now" ]; then
		npx supabase db push --dry-run
		read -r -p "That's what will be applied. Continue? [y/N] " ok
		if [ "$ok" = "y" ] || [ "$ok" = "Y" ]; then
			npm run db:push
		else
			echo "Skipped the push."
		fi
	else
		echo "Skipped the push. The market will stay hidden until it's applied."
	fi
fi

echo "==> 4/4  Building and running on the iOS simulator"
if ! (cd ios && COCOAPODS_DISABLE_STATS=true pod install); then
	echo "pod install failed; cleaning and retrying (CLAUDE.md's null-byte flake fix)"
	(cd ios && pod cache clean --all && rm -rf Pods Podfile.lock && COCOAPODS_DISABLE_STATS=true pod install)
fi
npx expo run:ios
