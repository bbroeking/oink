#!/bin/zsh
# App Store screenshot capture helper.
#
# Usage:  ./dev-tools/capture-screenshot.sh <name>
# Output: docs/screenshots/v1/<name>.png  (1290 x 2796)
#
# Before each capture, navigate the sim to the screen you want and
# make sure NO sim chrome is showing (no home indicator overlay, no
# debug menu, no Metro logger banner).
#
# Recommended shot list:
#   barn-default       — Barn at rest, pig with halo + alignment glow
#   barn-tickled       — mid-tap, particle burst visible (snap during)
#   friends-list       — Friends segment with multiple rows + wears X
#   inbox-active       — Inbox showing actionable + passive bands
#   season-bounty      — Season tab with bounty cards + claimable
#   shop-cosmetic      — Shop preview modal on a tickle particle
#   leaderboard        — Global leaderboard with champion poster
#   achievement-digest — AchievementDigestModal (trigger with unseen achievements)

set -e

if [[ -z "$1" ]]; then
	echo "Usage: $0 <name>"
	echo "  Output: docs/screenshots/v1/<name>.png"
	exit 1
fi

REPO=$(git rev-parse --show-toplevel)
OUT_DIR="$REPO/docs/screenshots/v1"
mkdir -p "$OUT_DIR"

OUT="$OUT_DIR/$1.png"
xcrun simctl io booted screenshot "$OUT"

# App Store Connect accepts 1284×2778 (the 6.7" Plus / 14 Pro Max
# era) — newer Pro Max sims output 1290×2796 (6.9") which App Store
# Connect's upload form rejects with "Screenshots dimensions should
# be: 1242 × 2688px, 2688 × 1242px, 1284 × 2778px or 2778 × 1284px".
# Auto-resize to the closest accepted shape so the capture is
# upload-ready.
DIMS=$(sips -g pixelWidth -g pixelHeight "$OUT" 2>/dev/null | awk '/pixel/ {print $2}' | tr '\n' 'x' | sed 's/x$//')
if [[ "$DIMS" != "1284x2778" ]]; then
	magick "$OUT" -resize 1284x2778! "$OUT"
	DIMS=$(sips -g pixelWidth -g pixelHeight "$OUT" 2>/dev/null | awk '/pixel/ {print $2}' | tr '\n' 'x' | sed 's/x$//')
fi
echo "Captured: $OUT  ($DIMS)"
