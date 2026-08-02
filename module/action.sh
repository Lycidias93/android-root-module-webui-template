#!/system/bin/sh
set -u

MODDIR=${0%/*}
RUN_DIR="$MODDIR/run"
LOG_DIR="$MODDIR/logs"
STATE_FILE="$RUN_DIR/webui-state.json"
PID_FILE="$RUN_DIR/webui.pid"
SERVER_LOG="$LOG_DIR/webui-server.log"
IDLE_TIMEOUT="${WEBUI_IDLE_TIMEOUT:-10m}"

mkdir -p "$RUN_DIR" "$LOG_DIR"

select_binary() {
  case "$(getprop ro.product.cpu.abi 2>/dev/null)" in
    arm64-v8a) printf '%s\n' "$MODDIR/bin/webui-server-arm64" ;;
    armeabi-v7a) printf '%s\n' "$MODDIR/bin/webui-server-arm" ;;
    x86_64) printf '%s\n' "$MODDIR/bin/webui-server-amd64" ;;
    x86) printf '%s\n' "$MODDIR/bin/webui-server-386" ;;
    *)
      case "$(uname -m 2>/dev/null)" in
        aarch64|arm64) printf '%s\n' "$MODDIR/bin/webui-server-arm64" ;;
        armv7l|armv8l) printf '%s\n' "$MODDIR/bin/webui-server-arm" ;;
        x86_64|amd64) printf '%s\n' "$MODDIR/bin/webui-server-amd64" ;;
        i?86) printf '%s\n' "$MODDIR/bin/webui-server-386" ;;
        *) return 1 ;;
      esac
      ;;
  esac
}

is_our_pid() {
  pid=$1
  case "$pid" in *[!0-9]*|"") return 1 ;; esac
  [ -r "/proc/$pid/cmdline" ] || return 1
  tr '\000' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -Fq "$MODDIR/bin/webui-server-"
}

stop_stale_server() {
  [ -f "$PID_FILE" ] || return 0
  read -r old_pid < "$PID_FILE" 2>/dev/null || old_pid=""
  if is_our_pid "$old_pid"; then
    kill "$old_pid" 2>/dev/null
    sleep 1
    is_our_pid "$old_pid" && kill -9 "$old_pid" 2>/dev/null
  fi
  rm -f "$PID_FILE" "$STATE_FILE"
}

make_token() {
  if [ -r /proc/sys/kernel/random/uuid ]; then
    tr -d '-\n' < /proc/sys/kernel/random/uuid
    return
  fi
  if [ -r /dev/urandom ]; then
    od -An -N32 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n'
    return
  fi
  return 1
}

SERVER=$(select_binary) || {
  echo "! Unsupported device ABI"
  exit 1
}

[ -x "$SERVER" ] || {
  echo "! WebUI server binary is missing or not executable"
  echo "! Expected: $SERVER"
  exit 1
}

TOKEN=$(make_token) || {
  echo "! Could not generate a secure session token"
  exit 1
}

stop_stale_server

"$SERVER"   -listen "127.0.0.1:0"   -webroot "$MODDIR/webroot"   -control "$MODDIR/bin/module-control"   -module-dir "$MODDIR"   -token "$TOKEN"   -idle-timeout "$IDLE_TIMEOUT"   -state-file "$STATE_FILE"   -pid-file "$PID_FILE"   >> "$SERVER_LOG" 2>&1 &

server_pid=$!
echo "$server_pid" > "$PID_FILE"

attempt=0
port=""
while [ "$attempt" -lt 50 ]; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "! WebUI server exited during startup"
    tail -n 20 "$SERVER_LOG" 2>/dev/null
    exit 1
  fi

  if [ -s "$STATE_FILE" ]; then
    port=$(sed -n 's/.*"port":[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$STATE_FILE" | head -n 1)
    case "$port" in
      *[!0-9]*|"") ;;
      *) break ;;
    esac
  fi

  attempt=$((attempt + 1))
  sleep 0.1
done

case "$port" in
  *[!0-9]*|"")
    echo "! WebUI server did not publish a valid port"
    kill "$server_pid" 2>/dev/null
    exit 1
    ;;
esac

url="http://127.0.0.1:${port}/#token=${TOKEN}"

if am start -a android.intent.action.VIEW -d "$url" >/dev/null 2>&1; then
  echo "- WebUI opened in the system browser"
elif cmd activity start-activity -a android.intent.action.VIEW -d "$url" >/dev/null 2>&1; then
  echo "- WebUI opened in the system browser"
else
  echo "! Automatic browser launch failed"
  echo "- Open manually: $url"
  echo "- The local server remains available until its idle timeout"
  exit 1
fi

echo "- Server bound to loopback only"
echo "- It will stop automatically after inactivity"
exit 0
