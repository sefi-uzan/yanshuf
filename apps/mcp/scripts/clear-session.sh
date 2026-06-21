#!/usr/bin/env bash
set -euo pipefail

USER_DATA="${YANSHUF_USER_DATA:-$HOME/Library/Application Support/Yanshuf}"
MCP_DIR="$USER_DATA/data/mcp"
TOKEN_FILE="$MCP_DIR/token.json"
CONFIG_FILE="$MCP_DIR/config.json"

if [[ ! -f "$TOKEN_FILE" ]]; then
  exit 0
fi

TOKEN=$(python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['token'])" 2>/dev/null || true)
PORT=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['port'])" 2>/dev/null || echo "9473")

if [[ -z "${TOKEN:-}" ]]; then
  exit 0
fi

curl -sf -X POST "http://127.0.0.1:${PORT}/capture/clear" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  >/dev/null 2>&1 || true

exit 0
