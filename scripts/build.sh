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
cp -f LICENSE NOTICE CREDITS.md UPSTREAMS.md "$STAGE/"
mkdir -p "$STAGE/third_party/licenses"
cp -f third_party/licenses/*.LICENSE "$STAGE/third_party/licenses/"

version=$(sed -n 's/^version=//p' module/module.prop | head -n 1)
module_id=$(sed -n 's/^id=//p' module/module.prop | head -n 1)
[[ -n "$version" && -n "$module_id" ]] || {
  echo "FAIL invalid_module_prop"
  exit 1
}

ldflags="-s -w -X main.version=${version}"

CGO_ENABLED=0 GOOS=android GOARCH=arm64 go build -trimpath -ldflags "$ldflags" -o "$STAGE/bin/webui-server-arm64" ./server/cmd/webui-server

chmod 0755   "$STAGE/action.sh"   "$STAGE/customize.sh"   "$STAGE/service.sh"   "$STAGE/uninstall.sh"   "$STAGE/bin/module-control"   "$STAGE/bin"/webui-server-*   "$STAGE/META-INF/com/google/android/update-binary"

artifact="$DIST_DIR/${module_id}-${version}.zip"
(
  cd "$STAGE"
  zip -q -r -9 "$artifact" .
)
unzip -tq "$artifact" >/dev/null
for entry in   module.prop   action.sh   bin/module-control   bin/webui-server-arm64   webroot/index.html   LICENSE   NOTICE   CREDITS.md   UPSTREAMS.md   third_party/licenses/F2FS-Optimizer.LICENSE; do
  unzip -Z1 "$artifact" | grep -Fxq "$entry" || {
    echo "FAIL archive_entry_missing entry=$entry"
    exit 1
  }
done

sha256sum "$artifact" > "${artifact}.sha256"

echo "artifact=$artifact"
echo "checksum=${artifact}.sha256"
echo "RESULT: BUILD_PASS"
