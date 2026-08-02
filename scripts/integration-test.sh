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
mkdir -p "$TMP/state" "$TMP/runtime"
chmod 0700 "$TMP/state" "$TMP/runtime"

cd "$ROOT"
go build -buildvcs=false -trimpath -o "$TMP/webui-server" ./server/cmd/webui-server

TOKEN=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
printf '%s\n' "$TOKEN" > "$TMP/runtime/bootstrap.token"
chmod 0600 "$TMP/runtime/bootstrap.token"

"$TMP/webui-server" \
  -listen 127.0.0.1:0 \
  -webroot "$TMP/module/webroot" \
  -control "$TMP/module/bin/module-control" \
  -module-dir "$TMP/module" \
  -state-dir "$TMP/state" \
  -runtime-dir "$TMP/runtime" \
  -token-file "$TMP/runtime/bootstrap.token" \
  -idle-timeout 1m \
  -session-ttl 1m \
  -job-timeout 1m \
  -max-jobs 2 \
  -state-file "$TMP/runtime/state.json" \
  -pid-file "$TMP/runtime/pid" \
  > "$TMP/server.log" 2>&1 &
PID=$!

for _ in $(seq 1 80); do
  [[ -s "$TMP/runtime/state.json" ]] && break
  sleep 0.1
done

PORT=$(sed -n 's/.*"port":[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$TMP/runtime/state.json")
[[ "$PORT" =~ ^[0-9]+$ ]]
BASE="http://127.0.0.1:$PORT"
COOKIE="$TMP/cookies.txt"

curl -fsS "$BASE/api/v1/health" | grep -Fq '"ok":true'

cmdline=$(tr '\000' ' ' < "/proc/$PID/cmdline")
if grep -Fq "$TOKEN" <<< "$cmdline"; then
  echo "FAIL token_visible_in_process_argv"
  exit 1
fi

bootstrap_code=$(curl -sS -c "$COOKIE" -o /dev/null -w '%{http_code}' "$BASE/bootstrap?token=$TOKEN")
[[ "$bootstrap_code" == 303 ]]
[[ ! -e "$TMP/runtime/bootstrap.token" ]]

second_code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/bootstrap?token=$TOKEN")
[[ "$second_code" == 403 ]]

curl -fsS -b "$COOKIE" "$BASE/" | grep -Fq 'Root Module WebUI'
curl -fsS -b "$COOKIE" "$BASE/api/v1/capabilities" | grep -Fq 'root-module-webui.capabilities.v1'
curl -fsS -b "$COOKIE" "$BASE/api/v1/status" | grep -Fq 'standalone_webui_example'

curl -fsS \
  -b "$COOKIE" \
  -X POST \
  -H "Origin: $BASE" \
  -H 'X-WebUI-Request: 1' \
  -H 'Content-Type: application/json' \
  --data '{"enabled":true,"mode":"battery","log_level":"debug","interval_seconds":120}' \
  "$BASE/api/v1/config" | grep -Fq '"ok":true'

curl -fsS -b "$COOKIE" "$BASE/api/v1/config" | grep -Fq '"mode":"battery"'

curl -fsS \
  -b "$COOKIE" \
  -X POST \
  -H "Origin: $BASE" \
  -H 'X-WebUI-Request: 1' \
  -H 'Content-Type: application/json' \
  --data '{"name":"apply","dry_run":true}' \
  "$BASE/api/v1/action" | grep -Fq '"dry_run":true'

confirmation_code=$(curl -sS \
  -b "$COOKIE" \
  -o /dev/null \
  -w '%{http_code}' \
  -X POST \
  -H "Origin: $BASE" \
  -H 'X-WebUI-Request: 1' \
  -H 'Content-Type: application/json' \
  --data '{"name":"reset-config","dry_run":false,"confirmation":"WRONG"}' \
  "$BASE/api/v1/action")
[[ "$confirmation_code" == 400 ]]

job_json=$(curl -fsS \
  -b "$COOKIE" \
  -X POST \
  -H "Origin: $BASE" \
  -H 'X-WebUI-Request: 1' \
  -H 'Content-Type: application/json' \
  --data '{"name":"diagnostics"}' \
  "$BASE/api/v1/jobs")
JOB_ID=$(sed -n 's/.*"id":"\([a-f0-9][a-f0-9]*\)".*/\1/p' <<< "$job_json")
[[ "$JOB_ID" =~ ^[a-f0-9]{32}$ ]]

job_status=""
for _ in $(seq 1 80); do
  job_status=$(curl -fsS -b "$COOKIE" "$BASE/api/v1/jobs/$JOB_ID")
  grep -Fq '"status":"success"' <<< "$job_status" && break
  sleep 0.1
done
grep -Fq '"status":"success"' <<< "$job_status"
curl -fsS -b "$COOKIE" "$BASE/api/v1/jobs/$JOB_ID/output?stream=stdout&offset=0&limit=65536" | grep -Fq 'EXAMPLE_DIAGNOSTICS_DONE'

curl -fsS -b "$COOKIE" "$BASE/api/v1/inventory?name=examples" | grep -Fq '"items"'

unauthenticated=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/v1/status")
[[ "$unauthenticated" == 401 ]]

origin_rejected=$(curl -sS \
  -b "$COOKIE" \
  -o /dev/null \
  -w '%{http_code}' \
  -X POST \
  -H 'Origin: http://evil.invalid' \
  -H 'X-WebUI-Request: 1' \
  -H 'Content-Type: application/json' \
  --data '{"name":"apply","dry_run":true}' \
  "$BASE/api/v1/action")
[[ "$origin_rejected" == 403 ]]

kill "$PID"
wait "$PID" || true
PID=""

echo "RESULT: INTEGRATION_PASS"
