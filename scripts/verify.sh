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
  module/webroot/embedded-host-bootstrap.js
  module/webroot/app.js
  module/webroot/app.css
  module/webroot/race-guard.js
  module/webroot/race-guard.css
  module/webroot/observability.js
  module/webroot/observability.css
  module/webroot/v03.js
  module/webroot/v04.js
  server/cmd/webui-server/main.go
  server/cmd/webui-server/v03.go
  server/cmd/webui-server/v03_collection_digest.go
  server/cmd/webui-server/v03_test.go
  server/cmd/webui-server/v04.go
  server/cmd/webui-server/v04_test.go
  scripts/webui-observability-static.test.py
  docs/API_CONTRACT.md
  docs/IMPORT_EXPORT_CONTRACT_V1.md
  docs/ARCHITECTURE.md
  docs/CORE_SYNC.md
  docs/MIGRATION_GUIDE.md
  docs/PATTERN_LIBRARY.md
  docs/ROADMAP_V0_4.md
  docs/ROADMAP_V0_5.md
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

grep -Fq 'MODULE_NAME=$(sed -n '\''s/^name=//p'\'' "$MODPATH/module.prop" | head -n 1)' module/customize.sh
grep -Fq 'MODULE_VERSION=$(sed -n '\''s/^version=//p'\'' "$MODPATH/module.prop" | head -n 1)' module/customize.sh
grep -Fq 'ui_print "- Installing $MODULE_NAME $MODULE_VERSION"' module/customize.sh
if grep -Fq 'Installing Standalone WebUI Foundation Example' module/customize.sh; then
  echo "FAIL hardcoded_installer_metadata"
  exit 1
fi

grep -Fq '/data/local/tmp/' module/action.sh
grep -Fq -- '-token-file' module/action.sh
grep -Fq -- '--print-url' module/action.sh
grep -Fq 'WEBUI_BOOTSTRAP_URL=' module/action.sh
grep -Fq 'bootstrap_transport=embedded_host_redirect' module/action.sh
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
grep -Fq 'registerV03Handlers(mux, app)' server/cmd/webui-server/main.go
grep -Fq 'registerV04Handlers(mux, app)' server/cmd/webui-server/main.go
grep -Fq 'statusControlTimeout' server/cmd/webui-server/main.go
grep -Fq 'root-module-webui.extensions.v1' server/cmd/webui-server/v03.go
grep -Fq 'matching unexpired preview required' server/cmd/webui-server/v03.go
grep -Fq 'file outside private upload directory' server/cmd/webui-server/v03.go
grep -Fq 'root-module-webui.extensions.v2' server/cmd/webui-server/v04.go
grep -Fq 'job-run-file' server/cmd/webui-server/v04.go
if grep -Eq '0\.0\.0\.0|ListenAndServe\(' server/cmd/webui-server/main.go server/cmd/webui-server/v03.go server/cmd/webui-server/v04.go; then
  echo "FAIL unsafe_listener_pattern"
  exit 1
fi

if grep -RInE 'https?://(cdn|unpkg|jsdelivr|fonts\.googleapis|google-analytics)' module/webroot; then
  echo "FAIL remote_web_asset"
  exit 1
fi
if grep -RInE 'ksu\.exec|apatch\.exec|magisk\.exec|webui\.exec|Android\.exec' module/webroot; then
  echo "FAIL unrestricted_root_exec_bridge_in_core_ui"
  exit 1
fi
grep -Fq 'const bridge = window.ksu;' module/webroot/embedded-host-bootstrap.js
grep -Fq 'location.hostname === "mui.kernelsu.org"' module/webroot/embedded-host-bootstrap.js
grep -Fq 'moduleDir.endsWith(`/${moduleId}`)' module/webroot/embedded-host-bootstrap.js
grep -Fq 'bridge.exec(command, `window.${callbackName}`);' module/webroot/embedded-host-bootstrap.js
grep -Fq -- '--print-url' module/webroot/embedded-host-bootstrap.js
grep -Fq 'WEBUI_BOOTSTRAP_URL=' module/webroot/embedded-host-bootstrap.js
grep -Fq 'target.startsWith("/api/v1/")' module/webroot/embedded-host-bootstrap.js
if ! grep -Eq '/data.*adb.*modules.*A-Za-z0-9' module/webroot/embedded-host-bootstrap.js; then
  echo "FAIL embedded_host_module_path_guard_missing"
  exit 1
fi
if grep -Eq 'apatch|magisk|Android\.exec|eval\(|new Function' module/webroot/embedded-host-bootstrap.js; then
  echo "FAIL embedded_host_bootstrap_scope_expanded"
  exit 1
fi
if grep -RInE 'eval\(|new Function|insertAdjacentHTML|innerHTML[[:space:]]*=' module/webroot; then
  echo "FAIL dynamic_code_or_html_in_core_ui"
  exit 1
fi
for file in module/webroot/embedded-host-bootstrap.js module/webroot/app.js module/webroot/race-guard.js module/webroot/observability.js module/webroot/v03.js module/webroot/v04.js; do
  node --check "$file"
done

gofmt_output=$(gofmt -l server)
if [[ -n "$gofmt_output" ]]; then
  echo "FAIL gofmt"
  printf '%s\n' "$gofmt_output"
  exit 1
fi

go vet ./...
go test ./...
python3 scripts/webui-contract-test.py
python3 scripts/webui-v04-static.test.py
python3 scripts/webui-observability-static.test.py
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

echo "RESULT: WEBUI_CORE_V04_TYPED_ASYNC_CONTRACT_PASS"
echo "RESULT: WEBUI_CORE_V05_OBSERVABILITY_CONTRACT_PASS"
echo "RESULT: WEBUI_CORE_V06_STATEFUL_MOBILE_UX_CONTRACT_PASS"
echo "RESULT: WEBUI_CORE_V061_EMBEDDED_HOST_BOOTSTRAP_CONTRACT_PASS"
echo "RESULT: VERIFY_PASS"
