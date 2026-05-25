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
#   achievement-unlock — AchievementUnlockModal (open via /achievements)

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

# Verify dimensions — App Store wants 1290 x 2796 for 6.7"
DIMS=$(sips -g pixelWidth -g pixelHeight "$OUT" 2>/dev/null | awk '/pixel/ {print $2}' | tr '\n' 'x' | sed 's/x$//')
echo "Captured: $OUT  ($DIMS)"

if [[ "$DIMS" != "1290x2796" ]]; then
	echo "⚠️  Size is $DIMS — App Store wants 1290x2796 (iPhone 6.7\")."
	echo "    Boot an iPhone 16 Pro Max sim and run from that one."
fi
