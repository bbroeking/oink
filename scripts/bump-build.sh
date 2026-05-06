#!/usr/bin/env bash
# Bumps CURRENT_PROJECT_VERSION (the iOS build number) by 1.
# Run before each archive: ./scripts/bump-build.sh
set -euo pipefail

PROJECT="ios/ttp.xcodeproj/project.pbxproj"
if [ ! -f "$PROJECT" ]; then
  echo "Run this from the project root."
  exit 1
fi

CURRENT=$(grep -m1 "CURRENT_PROJECT_VERSION" "$PROJECT" | sed -E 's/.*= ([0-9]+);/\1/')
NEXT=$((CURRENT + 1))

# In-place sed (BSD on macOS needs the -i '' form)
sed -i '' -E "s/CURRENT_PROJECT_VERSION = ${CURRENT};/CURRENT_PROJECT_VERSION = ${NEXT};/g" "$PROJECT"

echo "Build number: $CURRENT → $NEXT"
