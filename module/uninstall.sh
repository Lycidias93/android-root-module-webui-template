#!/system/bin/sh
set -u

MODDIR=${0%/*}
MODULE_ID=$(sed -n 's/^id=//p' "$MODDIR/module.prop" 2>/dev/null | head -n 1)
case "$MODULE_ID" in ""|*[!A-Za-z0-9._-]*) exit 0 ;; esac

SERVER="$MODDIR/bin/webui-server-arm64"
RUNTIME_DIR="/data/local/tmp/${MODULE_ID}-webui"
PID_FILE="$RUNTIME_DIR/server.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null || true)
  case "$PID" in ""|*[!0-9]*) PID="" ;; esac
  if [ -n "$PID" ] && [ -r "/proc/$PID/cmdline" ] &&
    tr '\000' ' ' < "/proc/$PID/cmdline" 2>/dev/null | grep -Fq "$SERVER"; then
    kill "$PID" 2>/dev/null || true
  fi
fi

rm -rf "$RUNTIME_DIR"

# Persistent data under /data/adb/$MODULE_ID is deliberately retained.
# Modules may add an explicit, separately confirmed data-removal action.
exit 0
