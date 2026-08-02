#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

required=(
  README.md
  LICENSE
  NOTICE
  CREDITS.md
  UPSTREAMS.md
  module/module.prop
  module/action.sh
  module/customize.sh
  module/service.sh
  module/uninstall.sh
  module/bin/module-control
  module/webroot/index.html
  module/webroot/app.js
  module/webroot/app.css
  server/cmd/webui-server/main.go
)

for file in "${required[@]}"; do
  [[ -s "$file" ]] || {
    echo "FAIL missing_or_empty file=$file"
    exit 1
  }
done

if grep -rIl --exclude-dir=.git --exclude='*.zip' --exclude='*.bundle' -- $'\r' . | grep -q .; then
  echo "FAIL crlf_detected"
  exit 1
fi

for file in scripts/*.sh; do
  head -n 1 "$file" | grep -Fxq '#!/usr/bin/env bash' || {
    echo "FAIL bash_shebang file=$file"
    exit 1
  }
  [[ -x "$file" ]] || {
    echo "FAIL not_executable file=$file"
    exit 1
  }
  bash -n "$file"
done

for file in module/action.sh module/customize.sh module/service.sh module/uninstall.sh module/bin/module-control module/META-INF/com/google/android/update-binary; do
  head -n 1 "$file" | grep -Eq '^#!/(system/bin/sh|sbin/sh)$' || {
    echo "FAIL android_shebang file=$file"
    exit 1
  }
  [[ -x "$file" ]] || {
    echo "FAIL not_executable file=$file"
    exit 1
  }
  sh -n "$file"
done

grep -Fq '127.0.0.1' server/cmd/webui-server/main.go
if grep -Eq '0\.0\.0\.0|ListenAndServe\(' server/cmd/webui-server/main.go; then
  echo "FAIL unsafe_listener_pattern"
  exit 1
fi

if grep -RInE 'https?://(cdn|unpkg|jsdelivr|fonts\.googleapis|google-analytics)' module/webroot; then
  echo "FAIL remote_web_asset"
  exit 1
fi

gofmt_output=$(gofmt -l server)
if [[ -n "$gofmt_output" ]]; then
  echo "FAIL gofmt"
  printf '%s\n' "$gofmt_output"
  exit 1
fi

go vet ./...
go test ./...
./scripts/integration-test.sh

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for target in arm64; do
  CGO_ENABLED=0 GOOS=android GOARCH="$target" go build -trimpath -o "$tmp/webui-server-$target" ./server/cmd/webui-server
  [[ -s "$tmp/webui-server-$target" ]] || {
    echo "FAIL android_cross_build target=$target"
    exit 1
  }
done

echo "RESULT: VERIFY_PASS"
