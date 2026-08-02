#!/system/bin/sh

ui_print "- Installing Standalone WebUI Example"
ui_print "- No companion app is required"

case "$(getprop ro.product.cpu.abi 2>/dev/null)" in
  arm64-v8a) ;;
  *)
    ui_print "! Unsupported primary ABI"
    abort "Supported ABI: arm64-v8a"
    ;;
esac

mkdir -p "$MODPATH/run" "$MODPATH/logs" "$MODPATH/config"

if [ ! -f "$MODPATH/config/module.conf" ]; then
  cp -f "$MODPATH/config/module.conf.default" "$MODPATH/config/module.conf"
fi

set_perm_recursive "$MODPATH" 0 0 0755 0644
set_perm "$MODPATH/action.sh" 0 0 0755
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/uninstall.sh" 0 0 0755
set_perm "$MODPATH/bin/module-control" 0 0 0755

for binary in "$MODPATH"/bin/webui-server-*; do
  [ -f "$binary" ] && set_perm "$binary" 0 0 0755
done

set_perm "$MODPATH/config/module.conf" 0 0 0600
ui_print "- Installation complete"
