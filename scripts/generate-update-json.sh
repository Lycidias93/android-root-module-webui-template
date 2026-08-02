#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
PROP="$ROOT/module/module.prop"

version=$(sed -n 's/^version=//p' "$PROP" | head -n 1)
version_code=$(sed -n 's/^versionCode=//p' "$PROP" | head -n 1)
repo=${1:-Lycidias93/android-root-module-webui-template}

[[ -n "$version" && -n "$version_code" ]] || {
  echo "FAIL invalid_module_prop"
  exit 1
}

printf '{\n  "version": "%s",\n  "versionCode": %s,\n  "zipUrl": "https://github.com/%s/releases/download/%s/standalone_webui_example-%s.zip",\n  "changelog": "https://github.com/%s/releases/tag/%s"\n}\n'   "$version" "$version_code" "$repo" "$version" "$version" "$repo" "$version"   > "$ROOT/update.json"

echo "RESULT: UPDATE_JSON_PASS"
