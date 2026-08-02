#!/system/bin/sh

ui_print "- Installing Standalone WebUI Foundation Example"
ui_print "- No companion app, Termux, Python, or remote service is required"

case "$(getprop ro.product.cpu.abi 2>/dev/null)" in
  arm64-v8a) ;;
  *)
    ui_print "! Unsupported primary ABI"
    abort "This template build intentionally supports arm64-v8a only"
    ;;
esac

MODULE_ID=$(sed -n 's/^id=//p' "$MODPATH/module.prop" | head -n 1)
case "$MODULE_ID" in
  ""|*[!A-Za-z0-9._-]*) abort "Invalid module id" ;;
esac

STATE_DIR="/data/adb/$MODULE_ID"
mkdir -p "$STATE_DIR/config" "$STATE_DIR/logs"
chmod 0700 "$STATE_DIR" "$STATE_DIR/config" "$STATE_DIR/logs" 2>/dev/null || true

if [ ! -f "$STATE_DIR/config/module.conf" ]; then
  cp -f "$MODPATH/config/module.conf.default" "$STATE_DIR/config/module.conf"
  chmod 0600 "$STATE_DIR/config/module.conf"
fi

set_perm_recursive "$MODPATH" 0 0 0755 0644
set_perm "$MODPATH/action.sh" 0 0 0755
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/uninstall.sh" 0 0 0755
set_perm "$MODPATH/bin/module-control" 0 0 0755
set_perm "$MODPATH/bin/webui-server-arm64" 0 0 0755

ui_print "- Persistent state: $STATE_DIR"
ui_print "- WebUI starts only from the module Action button"
ui_print "- Installation complete"
