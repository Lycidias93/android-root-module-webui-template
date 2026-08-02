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
