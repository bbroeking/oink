#!/usr/bin/env bash
# One-command ship to TestFlight.
#   - Bumps build number
#   - Archives + exports IPA
#   - Uploads via altool if an API key is configured, else opens Transporter
#
# Usage: pnpm ship      (or: ./scripts/ship-ios.sh)
#
# To enable auto-upload, do this once:
#   1. Create an App Store Connect API key (App Manager role)
#      https://appstoreconnect.apple.com/access/integrations/api
#   2. Download the .p8, drop it here:
#      ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
#   3. Note the Key ID and Issuer ID, add to ~/.zshrc:
#        export ASC_KEY_ID="ABCDE12345"
#        export ASC_KEY_ISSUER="00000000-0000-0000-0000-000000000000"

set -euo pipefail

WORKSPACE="ios/ttp.xcworkspace"
SCHEME="ttp"
CONFIG="Release"
BUILD_DIR=".build"
ARCHIVE_PATH="$BUILD_DIR/ttp.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_PLIST="scripts/ExportOptions.plist"
IPA="$EXPORT_PATH/ttp.ipa"

if [ ! -f "$WORKSPACE/contents.xcworkspacedata" ]; then
  echo "Run from project root."
  exit 1
fi

# 1. Bump build
./scripts/bump-build.sh

# 1b. Optimize bundled images (idempotent — only shrinks new/unoptimized art, so
# anything that didn't come through the slice pipeline still ships small).
echo ""
echo "→ Optimizing images..."
python3 scripts/optimize_assets.py

# 2. Clean prior artifacts
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"
mkdir -p "$BUILD_DIR"

# 3. Archive
echo ""
echo "→ Archiving (~5 min)..."
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  archive \
  -quiet

if [ ! -d "$ARCHIVE_PATH" ]; then
  echo "✖ Archive failed."
  exit 1
fi
echo "✔ Archive ready"

# 4. Export
echo ""
echo "→ Exporting IPA..."
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -allowProvisioningUpdates \
  -quiet

if [ ! -f "$IPA" ]; then
  echo "✖ Export failed."
  exit 1
fi
echo "✔ IPA: $IPA ($(du -h "$IPA" | cut -f1))"

# 5. Upload — find the right path
echo ""

# Try env-configured API key first
if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_KEY_ISSUER:-}" ]; then
  KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
  if [ -f "$KEY_PATH" ]; then
    echo "→ Uploading via API key ($ASC_KEY_ID)..."
    xcrun altool --upload-app -f "$IPA" -t ios \
      --apiKey "$ASC_KEY_ID" \
      --apiIssuer "$ASC_KEY_ISSUER"
    echo ""
    echo "✔ Uploaded to App Store Connect — Apple is processing."
    echo "  Check: https://appstoreconnect.apple.com/apps/6740339848/testflight/ios"
    exit 0
  else
    echo "⚠ ASC_KEY_ID set but key file not found at:"
    echo "  $KEY_PATH"
    echo ""
  fi
fi

# Fallback: scan for any API key in the standard location
KEY_FILE=$(ls "$HOME/.appstoreconnect/private_keys/"AuthKey_*.p8 2>/dev/null | head -1 || true)
if [ -n "$KEY_FILE" ] && [ -z "${ASC_KEY_ISSUER:-}" ]; then
  KEY_ID=$(basename "$KEY_FILE" | sed -E 's/AuthKey_(.+)\.p8/\1/')
  echo "Found a key file (KEY_ID=$KEY_ID) but no ASC_KEY_ISSUER set."
  echo "Add this to ~/.zshrc and re-run:"
  echo "  export ASC_KEY_ID=\"$KEY_ID\""
  echo "  export ASC_KEY_ISSUER=\"<issuer-uuid-from-asc>\""
  echo ""
fi

# Last resort: open Transporter so user can drag the IPA in
echo "→ Opening Transporter for manual upload..."
echo "  (drag $IPA into the window, click Deliver)"
open -a Transporter "$IPA" 2>/dev/null || {
  echo ""
  echo "Transporter not installed. Either:"
  echo "  1. Install Transporter from the Mac App Store, then drag $IPA into it"
  echo "  2. Or open Xcode → Window → Organizer, select latest archive, Distribute App"
  echo ""
  echo "IPA: $IPA"
}
