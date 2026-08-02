#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
PROP="$ROOT/module/module.prop"

module_id=$(sed -n 's/^id=//p' "$PROP" | head -n 1)
version=$(sed -n 's/^version=//p' "$PROP" | head -n 1)
version_code=$(sed -n 's/^versionCode=//p' "$PROP" | head -n 1)
repo=${1:-Lycidias93/android-root-module-webui-template}

[[ -n "$module_id" && -n "$version" && -n "$version_code" ]] || {
  echo "FAIL invalid_module_prop"
  exit 1
}

printf '{\n' > "$ROOT/update.json"
printf '  "version": "%s",\n' "$version" >> "$ROOT/update.json"
printf '  "versionCode": %s,\n' "$version_code" >> "$ROOT/update.json"
printf '  "zipUrl": "https://github.com/%s/releases/download/%s/%s-%s.zip",\n' \
  "$repo" "$version" "$module_id" "$version" >> "$ROOT/update.json"
printf '  "changelog": "https://github.com/%s/releases/tag/%s"\n' \
  "$repo" "$version" >> "$ROOT/update.json"
printf '}\n' >> "$ROOT/update.json"

echo "update_json=$ROOT/update.json"
echo "RESULT: UPDATE_JSON_PASS"
