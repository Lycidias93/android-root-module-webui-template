#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/config.env" <<EOF
NTFY_ENABLED=1
NTFY_TOPIC=fixture-topic
NTFY_TOKEN_FILE=$TMP/token
NTFY_PRIORITY=high
NTFY_TAGS=package,test
EOF
printf '%s\n' 'super-secret-fixture-token' > "$TMP/token"
cat > "$TMP/curl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "${NTFY_TEST_CAPTURE:?}"
exit 0
EOF
chmod +x "$TMP/curl"
source "$ROOT/module/lib/ntfy.sh"
webui_ntfy_load_config_file "$TMP/config.env"
export CURL_BIN="$TMP/curl" NTFY_TEST_CAPTURE="$TMP/capture"
status=$(webui_ntfy_status_json sdd all start,success,fail)
grep -Fq '"provider":"ntfy"' <<< "$status"
grep -Fq '"enabled":true' <<< "$status"
grep -Fq '"endpoint_configured":true' <<< "$status"
grep -Fq '"token_file_configured":true' <<< "$status"
! grep -Fq 'fixture-topic' <<< "$status"
! grep -Fq 'super-secret-fixture-token' <<< "$status"
send=$(webui_ntfy_send PASS 'Core test' 'loopback fixture body')
grep -Fxq 'ntfy_send_state=sent' <<< "$send"
grep -Fq 'Authorization: Bearer super-secret-fixture-token' "$TMP/capture"
! grep -Fq 'super-secret-fixture-token' <<< "$send"
NTFY_ENABLED=0
send=$(webui_ntfy_send INFO 'Disabled' 'no send')
grep -Fxq 'ntfy_send_state=disabled' <<< "$send"
echo 'RESULT: WEBUI_CORE_NTFY_LIBRARY_PASS'
