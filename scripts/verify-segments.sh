#!/usr/bin/env bash
# Quick check: list segments stored on the server (run after using the app).
# Usage: ./scripts/verify-segments.sh   or   curl -s http://localhost:3001/api/session/segments | jq
BASE="${API_BASE_URL:-http://localhost:3001}"
echo "GET $BASE/api/session/segments"
curl -s "$BASE/api/session/segments" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/session/segments"
