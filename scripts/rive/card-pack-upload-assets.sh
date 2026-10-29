#!/usr/bin/env bash
set -euo pipefail

RIVE_MCP_URL="${RIVE_MCP_URL:-http://127.0.0.1:9791/mcp}"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

upload() {
  local file="$1"
  local display_name="$2"
  local payload session_id encoded_name
  payload="$(mktemp "${TMPDIR:-/tmp}/card-pack-rive-upload.XXXXXX")"
  encoded_name="$(basename "$file" | sed 's/ /%20/g')"
  session_id="$(curl -si "$RIVE_MCP_URL" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"card-pack-upload","version":"1"}}}' \
    | tr -d '\r' | sed -n 's/^mcp-session-id: //p')"
  {
    printf '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"upload_asset","arguments":{"file":"data:application/octet-stream;name=%s;base64,' "$encoded_name"
    base64 -i "$file" | tr -d '\n'
    printf '","name":"%s"}}}' "$display_name"
  } > "$payload"
  curl -s "$RIVE_MCP_URL" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H "mcp-session-id: $session_id" \
    --data-binary "@$payload"
  rm -f "$payload"
}

upload "$PROJECT_ROOT/landing/cards/img/034-firefly_swarm.webp" "Firefly Swarm"
upload "$PROJECT_ROOT/landing/cards/img/019-mud_shovel.webp" "Mud Shovel"
upload "$PROJECT_ROOT/landing/cards/img/038-puddle_duckling.webp" "Puddle Duckling"
upload "$PROJECT_ROOT/landing/cards/img/009-mushroom_cap.webp" "Mushroom Cap"
upload "$PROJECT_ROOT/landing/cards/img/046-moon_firefly.webp" "Moon Firefly"
