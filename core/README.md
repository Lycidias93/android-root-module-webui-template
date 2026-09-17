# WebUI core

The files listed in `manifest.txt` form the reusable transport and presentation core.

They are intentionally separate from module-owned files:

- `module/bin/module-control`
- `module/module.prop`
- `module/customize.sh`
- module runtime and service logic
- module-specific tests and documentation

Use `scripts/sync-core.sh` from a clean checkout to preview or apply a core update.
The target repository must use the same `module/`, `server/`, and `scripts/`
layout. A generated `webui.lock` records the imported core version and source
commit.

## Notifications ownership (Core 0.7.0)

The shared core owns notification capability validation, secret-safe status/test transport, Notifications UI, observability labels and `module/lib/ntfy.sh`. Consumers own lifecycle timing, authorized private config source and message content. Notification transport failure never changes the primary operation result.
