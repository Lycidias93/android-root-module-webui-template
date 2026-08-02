#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

./scripts/verify.sh

BUILD_DIR="$ROOT/build"
DIST_DIR="$ROOT/dist"
STAGE="$BUILD_DIR/module"

rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$STAGE" "$DIST_DIR"
cp -a module/. "$STAGE/"
cp -f LICENSE NOTICE CREDITS.md UPSTREAMS.md CORE_VERSION "$STAGE/"
mkdir -p "$STAGE/third_party/licenses"
cp -f third_party/licenses/*.LICENSE "$STAGE/third_party/licenses/"

version=$(sed -n 's/^version=//p' module/module.prop | head -n 1)
version_code=$(sed -n 's/^versionCode=//p' module/module.prop | head -n 1)
module_id=$(sed -n 's/^id=//p' module/module.prop | head -n 1)
core_version=$(tr -d '\r\n' < CORE_VERSION)

[[ -n "$version" && -n "$version_code" && -n "$module_id" && -n "$core_version" ]] || {
  echo "FAIL invalid_build_metadata"
  exit 1
}

ldflags="-s -w -X main.version=${core_version}"
CGO_ENABLED=0 GOOS=android GOARCH=arm64 go build \
  -buildvcs=false \
  -trimpath \
  -ldflags "$ldflags" \
  -o "$STAGE/bin/webui-server-arm64" \
  ./server/cmd/webui-server

chmod 0755 \
  "$STAGE/action.sh" \
  "$STAGE/customize.sh" \
  "$STAGE/service.sh" \
  "$STAGE/uninstall.sh" \
  "$STAGE/bin/module-control" \
  "$STAGE/bin/webui-server-arm64" \
  "$STAGE/META-INF/com/google/android/update-binary"

artifact="$DIST_DIR/${module_id}-${version}.zip"
repro="$BUILD_DIR/repro.zip"
python3 "$ROOT/scripts/package-module.py" "$STAGE" "$artifact"
python3 "$ROOT/scripts/package-module.py" "$STAGE" "$repro"
cmp -s "$artifact" "$repro" || {
  echo "FAIL package_not_reproducible"
  exit 1
}

unzip -tq "$artifact" >/dev/null
entries=$(unzip -Z1 "$artifact")
for entry in \
  module.prop \
  action.sh \
  bin/module-control \
  bin/webui-server-arm64 \
  webroot/index.html \
  webroot/app.js \
  webroot/app.css \
  CORE_VERSION \
  LICENSE \
  NOTICE \
  CREDITS.md \
  UPSTREAMS.md \
  third_party/licenses/F2FS-Optimizer.LICENSE; do
  grep -Fxq "$entry" <<< "$entries" || {
    echo "FAIL archive_entry_missing entry=$entry"
    exit 1
  }
done

if grep -Fxq 'config/module.conf' <<< "$entries"; then
  echo "FAIL runtime_config_must_not_be_packaged"
  exit 1
fi

sha256=$(sha256sum "$artifact" | awk '{print $1}')
bytes=$(wc -c < "$artifact" | tr -d ' ')
manifest="$DIST_DIR/build-manifest.json"
printf '{\n' > "$manifest"
printf '  "schema": "root-module-webui-build.v1",\n' >> "$manifest"
printf '  "module_id": "%s",\n' "$module_id" >> "$manifest"
printf '  "module_version": "%s",\n' "$version" >> "$manifest"
printf '  "module_version_code": %s,\n' "$version_code" >> "$manifest"
printf '  "core_version": "%s",\n' "$core_version" >> "$manifest"
printf '  "artifact": "%s",\n' "$(basename "$artifact")" >> "$manifest"
printf '  "sha256": "%s",\n' "$sha256" >> "$manifest"
printf '  "bytes": %s\n' "$bytes" >> "$manifest"
printf '}\n' >> "$manifest"

echo "artifact=$artifact"
echo "artifact_sha256=$sha256"
echo "artifact_bytes=$bytes"
echo "build_manifest=$manifest"
echo "RESULT: BUILD_PASS"
