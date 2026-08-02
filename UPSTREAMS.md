# Upstream provenance

All upstream references are pinned so later updates can be reviewed intentionally.

| Upstream | Pinned commit | Role in this template | Initial code status |
|---|---|---|---|
| `Coolapk-Code9527/F2FS-Optimizer` | `651b66b14087b5d60e4b9d3fd69de899a8cd43b8` | Standalone localhost WebUI lifecycle, action launch, timeout, state and atomic-config patterns | Clean reimplementation informed by upstream |
| `KOWX712/ksu-webui-demo` | `5ff958423202e9af7675e83e8ce57a34d80ddcd9` | Vanilla JS layout and compatibility concepts | Clean reimplementation informed by upstream |
| `barsikus007/ksu-webui-module-template` | `4ec624e2514043064d3b50ff5ec585acff4ffc97` | Packaging, multi-manager structure and CI concepts | Clean reimplementation informed by upstream |
| `Aurora-Nasa-1/AMMF2` | `98d2ef7d0491f6524cee09c958ef239338b49d3c` | Logging, themes, localization and component concepts | Reference only in v0.1 |

## Update procedure

1. Inspect the new upstream commit and license.
2. Compare only the component relevant to this template.
3. Import complete files or complete components; do not paste undocumented fragments.
4. Update this table, `NOTICE`, `CREDITS.md`, and the matching license copy.
5. Run `scripts/verify.sh` and `scripts/build.sh`.
6. Record security-impacting changes in the pull request.

## License boundaries

All four pinned sources are MIT-licensed at the listed commits. Do not import dependencies, assets, fonts, images, or generated bundles from other licenses without documenting and reviewing them separately.
