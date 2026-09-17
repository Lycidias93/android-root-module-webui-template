#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/state" "$TMP/runtime/requests"
cat > "$TMP/bin/sed" <<'SED'
#!/bin/sh
for arg in "$@"; do
  case "$arg" in *'\|'*) exit 0 ;; esac
done
exec /bin/sed "$@"
SED
chmod +x "$TMP/bin/sed"
ENV=(PATH="$TMP/bin:/usr/bin:/bin" MODULE_DIR="$ROOT/module" MODULE_STATE_DIR="$TMP/state" WEBUI_RUNTIME_DIR="$TMP/runtime")
env "${ENV[@]}" sh "$ROOT/module/bin/module-control" capabilities >/dev/null
before=$(sha256sum "$TMP/state/config/module.conf" | awk '{print $1}')
printf '%s\n' '{"name":"apply","dry_run":true}' > "$TMP/runtime/requests/action.json"
out=$(env "${ENV[@]}" sh "$ROOT/module/bin/module-control" action-file apply "$TMP/runtime/requests/action.json")
after=$(sha256sum "$TMP/state/config/module.conf" | awk '{print $1}')
grep -Fq '"dry_run":true' <<< "$out"
[[ "$before" == "$after" ]]
! grep -Fq '\(true\|false\)' "$ROOT/module/bin/module-control"
echo "RESULT: ANDROID_JSON_BOOL_PORTABILITY_PASS"