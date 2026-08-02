#!/system/bin/sh
MODDIR=${0%/*}

if [ -f "$MODDIR/run/webui.pid" ]; then
  read -r pid < "$MODDIR/run/webui.pid"
  case "$pid" in
    *[!0-9]*|"") ;;
    *)
      if [ -r "/proc/$pid/cmdline" ] && tr '\000' ' ' < "/proc/$pid/cmdline" | grep -Fq "$MODDIR/bin/webui-server-"; then
        kill "$pid" 2>/dev/null
      fi
      ;;
  esac
fi

rm -rf "$MODDIR/run"
exit 0
