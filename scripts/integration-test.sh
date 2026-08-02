#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
PID=""

cleanup() {
  if [[ -n "$PID" ]]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

cp -a "$ROOT/module" "$TMP/module"
sed -i '1s|^#!/system/bin/sh$|#!/bin/sh|' "$TMP/module/bin/module-control"
mkdir -p "$TMP/module/run" "$TMP/module/logs"

cd "$ROOT"
go build -trimpath -o "$TMP/webui-server" ./server/cmd/webui-server

TOKEN=0123456789abcdef0123456789abcdef0123456789abcdef
"$TMP/webui-server" \
  -listen 127.0.0.1:0 \
  -webroot "$TMP/module/webroot" \
  -control "$TMP/module/bin/module-control" \
  -module-dir "$TMP/module" \
  -token "$TOKEN" \
  -idle-timeout 1m \
  -state-file "$TMP/module/run/state.json" \
  -pid-file "$TMP/module/run/pid" \
  > "$TMP/server.log" 2>&1 &
PID=$!

for _ in $(seq 1 50); do
  [[ -s "$TMP/module/run/state.json" ]] && break
  sleep 0.1
done

PORT=$(sed -n 's/.*"port":\([0-9][0-9]*\).*/\1/p' "$TMP/module/run/state.json")
[[ "$PORT" =~ ^[0-9]+$ ]]
BASE="http://127.0.0.1:$PORT"

curl -fsS "$BASE/api/v1/health" | grep -Fq '"ok":true'
curl -fsS -H "X-WebUI-Token: $TOKEN" "$BASE/api/v1/status" | grep -Fq 'standalone_webui_example'

curl -fsS \
  -X POST \
  -H "Origin: $BASE" \
  -H "X-WebUI-Token: $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"enabled":true,"mode":"battery","log_level":"debug","interval_seconds":120}' \
  "$BASE/api/v1/config" | grep -Fq '"ok":true'

curl -fsS -H "X-WebUI-Token: $TOKEN" "$BASE/api/v1/config" | grep -Fq '"mode":"battery"'

status=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/v1/status")
[[ "$status" == 401 ]]

status=$(curl -sS \
  -o /dev/null \
  -w '%{http_code}' \
  -X POST \
  -H 'Origin: http://evil.invalid' \
  -H "X-WebUI-Token: $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"name":"apply"}' \
  "$BASE/api/v1/action")
[[ "$status" == 403 ]]

kill "$PID"
wait "$PID" || true
PID=""

echo "RESULT: INTEGRATION_PASS"
