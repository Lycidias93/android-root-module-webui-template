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
  CORE_VERSION
  core/manifest.txt
  module/module.prop
  module/action.sh
  module/customize.sh
  module/service.sh
  module/uninstall.sh
  module/bin/module-control
  module/config/module.conf.default
  module/webroot/index.html
  module/webroot/app.js
  module/webroot/app.css
  server/cmd/webui-server/main.go
  docs/API_CONTRACT.md
  docs/ARCHITECTURE.md
  docs/CORE_SYNC.md
  docs/MIGRATION_GUIDE.md
  docs/PATTERN_LIBRARY.md
  docs/SECURITY_MODEL.md
)

for file in "${required[@]}"; do
  [[ -s "$file" ]] || {
    echo "FAIL missing_or_empty file=$file"
    exit 1
  }
done

[[ ! -e module/config/module.conf ]] || {
  echo "FAIL runtime_config_tracked"
  exit 1
}

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

grep -Fq '/data/local/tmp/' module/action.sh
grep -Fq -- '-token-file' module/action.sh
[[ $(grep -Fc "sed 's/-//g' < /proc/sys/kernel/random/uuid" module/action.sh) -eq 2 ]] || {
  echo "FAIL portable_uuid_filter_missing"
  exit 1
}
if grep -Fq "tr -d '-\\n'" module/action.sh; then
  echo "FAIL busybox_tr_leading_hyphen_token_filter"
  exit 1
fi
if grep -Eq -- '(^|[[:space:]])-token([[:space:]]|$)' module/action.sh; then
  echo "FAIL token_passed_in_argv"
  exit 1
fi
grep -Fq 'SERVER="$MODDIR/bin/webui-server-arm64"' module/action.sh
if grep -Fq 'webui-server-amd64' module/action.sh || grep -Fq 'webui-server-386' module/action.sh; then
  echo "FAIL unsupported_abi_launcher_branch"
  exit 1
fi

grep -Fq '127.0.0.1' server/cmd/webui-server/main.go
grep -Fq 'HttpOnly: true' server/cmd/webui-server/main.go
grep -Fq 'SameSite: http.SameSiteLaxMode' server/cmd/webui-server/main.go
grep -Fq 'requestGuardHeader' server/cmd/webui-server/main.go
grep -Fq 'root-module-webui.capabilities.v1' server/cmd/webui-server/main.go
if grep -Eq '0\.0\.0\.0|ListenAndServe\(' server/cmd/webui-server/main.go; then
  echo "FAIL unsafe_listener_pattern"
  exit 1
fi

if grep -RInE 'https?://(cdn|unpkg|jsdelivr|fonts\.googleapis|google-analytics)' module/webroot; then
  echo "FAIL remote_web_asset"
  exit 1
fi
if grep -RInE 'ksu\.exec|apatch\.exec|magisk\.exec|webui\.exec|Android\.exec' module/webroot; then
  echo "FAIL root_exec_bridge_in_core_ui"
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
python3 scripts/webui-contract-test.py
./scripts/integration-test.sh

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
CGO_ENABLED=0 GOOS=android GOARCH=arm64 go build \
  -buildvcs=false \
  -trimpath \
  -o "$tmp/webui-server-arm64" \
  ./server/cmd/webui-server
[[ -s "$tmp/webui-server-arm64" ]] || {
  echo "FAIL android_cross_build target=arm64"
  exit 1
}

echo "RESULT: VERIFY_PASS"
