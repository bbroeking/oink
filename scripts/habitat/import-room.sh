#!/usr/bin/env bash
# Import an ImageGen room repaint (Codex CLI lane or ChatGPT download) as a habitat room source.
#   scripts/habitat/import-room.sh <warm_plank_barn|spring_whitewash|midnight_rafters> <downloaded.png> [version]
# Center-crops to the 780:1688 room aspect (Codex's 853x1844 is already there;
# ChatGPT's tallest portrait is 1024x1536, wider than the 390x844 HabitatScene
# canvas, so the brief keeps the architecture inside the central 70%), writes assets/images/habitat/source/imagegen-<room>-empty-v<N>.png,
# and points generate-art.mjs at it (which resizes to 780x1688 + thumbnail).
set -euo pipefail
ROOM=$1; IN=$2; VER=${3:-2}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SRC="$ROOT/assets/images/habitat/source"
SLUG=${ROOM//_/-}
OUT="$SRC/imagegen-$SLUG-empty-v$VER.png"
W=$(magick identify -format "%w" "$IN"); H=$(magick identify -format "%h" "$IN")
# target width for the source height at 780:1688
TW=$(python3 -c "print(min($W, round($H*780/1688)))")
TH=$(python3 -c "print(min($H, round($TW*1688/780)))")
magick "$IN" -gravity center -crop "${TW}x${TH}+0+0" +repage -strip "$OUT"
echo "wrote $OUT ($(magick identify -format '%wx%h' "$OUT")) from ${W}x${H}"
# generate-art.mjs lists [room, source-file] pairs; swap this room's file.
python3 - "$ROOT/scripts/habitat/generate-art.mjs" "$ROOM" "imagegen-$SLUG-empty-v$VER.png" <<'PY'
import re, sys
path, room, file = sys.argv[1:]
s = open(path).read()
new, n = re.subn(r'\["%s", "imagegen-[^"]+"\]' % room, '["%s", "%s"]' % (room, file), s)
assert n == 1, "room pair not found in generate-art.mjs"
open(path, "w").write(new)
PY
(cd "$ROOT" && node scripts/habitat/generate-art.mjs)
