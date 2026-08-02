#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
MANIFEST="$ROOT/core/manifest.txt"
MODE=plan
TARGET=""

usage() {
  echo "Usage: $0 [--apply] <target-repository>"
}

for argument in "$@"; do
  case "$argument" in
    --apply) MODE=apply ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $argument" >&2; usage; exit 2 ;;
    *)
      [[ -z "$TARGET" ]] || { echo "Only one target is allowed" >&2; exit 2; }
      TARGET=$argument
      ;;
  esac
done

[[ -n "$TARGET" ]] || { usage; exit 2; }
TARGET=$(cd -- "$TARGET" && pwd)
[[ -d "$TARGET/.git" ]] || {
  echo "FAIL target_is_not_git_repository target=$TARGET"
  exit 1
}
[[ -s "$MANIFEST" ]] || {
  echo "FAIL core_manifest_missing"
  exit 1
}

if [[ -n "$(git -C "$TARGET" status --porcelain)" ]]; then
  echo "FAIL target_worktree_not_clean target=$TARGET"
  exit 1
fi

core_version=$(tr -d '\r\n' < "$ROOT/CORE_VERSION")
source_commit=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)
manifest_sha256=$(sha256sum "$MANIFEST" | awk '{print $1}')
changed=0

while IFS= read -r path || [[ -n "$path" ]]; do
  [[ -n "$path" ]] || continue
  source="$ROOT/$path"
  destination="$TARGET/$path"
  [[ -f "$source" ]] || {
    echo "FAIL core_source_missing path=$path"
    exit 1
  }
  if [[ -f "$destination" ]] && cmp -s "$source" "$destination"; then
    echo "UNCHANGED $path"
    continue
  fi
  changed=$((changed + 1))
  echo "UPDATE $path"
  if [[ "$MODE" == apply ]]; then
    mkdir -p "$(dirname -- "$destination")"
    cp -f "$source" "$destination"
    chmod --reference="$source" "$destination" 2>/dev/null || true
  fi
done < "$MANIFEST"

if [[ "$MODE" == apply ]]; then
  lock="$TARGET/webui.lock"
  {
    echo "schema=root-module-webui-lock-v1"
    echo "core_version=$core_version"
    echo "source_repository=Lycidias93/android-root-module-webui-template"
    echo "source_commit=$source_commit"
    echo "manifest_sha256=$manifest_sha256"
  } > "$lock"
  echo "lock_file=$lock"
  echo "RESULT: WEBUI_CORE_SYNC_APPLIED outcome=success changed_files=$changed"
else
  echo "RESULT: WEBUI_CORE_SYNC_PLAN outcome=success changed_files=$changed"
  echo "Re-run with --apply after reviewing the plan."
fi
