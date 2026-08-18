# Upstream provenance

## External MIT sources

| Upstream | Pinned commit | Role | Code status |
|---|---|---|---|
| `Coolapk-Code9527/F2FS-Optimizer` | `651b66b14087b5d60e4b9d3fd69de899a8cd43b8` | Standalone localhost lifecycle, Action launch, timeout and atomic-state concepts | Clean reimplementation informed by upstream |
| `KOWX712/ksu-webui-demo` | `5ff958423202e9af7675e83e8ce57a34d80ddcd9` | Vanilla JavaScript layout and compatibility concepts | Clean reimplementation informed by upstream |
| `barsikus007/ksu-webui-module-template` | `4ec624e2514043064d3b50ff5ec585acff4ffc97` | Packaging, multi-manager structure and CI concepts | Clean reimplementation informed by upstream |
| `Aurora-Nasa-1/AMMF2` | `98d2ef7d0491f6524cee09c958ef239338b49d3c` | Logging, theme, localization and component concepts | Reference only |
| `Drizzy07x/Supercharger_Pixel_9_Series` | `be76cbe57d01fa475196b7afb3729b9ad19f0a26` | WebUI readiness/busy-state, duplicate-action and stale-response regression patterns | Clean generic adaptation; no Supercharger tuning or device logic imported |

Matching license texts for imported/reimplemented MIT-licensed source work are
retained in `third_party/licenses/`.

## External design references — no code imported

| Upstream | Pinned commit | Role | Code status |
|---|---|---|---|
| `RipperHybrid/AshLooper` (AshReXcue) | `6db87ffba007560eff443a0330037cd6a2563c2b` | Global unsaved-change awareness, session activity diagnostics and raw-state inspection concepts | Design reference only; GPL-3.0 code/assets were not imported or copied |

Design-only references do not contribute source files or assets to this MIT
repository. Their licenses are not relicensed by this project; implementation
ideas are independently expressed behind this template's existing typed API and
security model.

## First-party pattern sources

| Source | Pinned commit | Patterns consolidated |
|---|---|---|
| `Lycidias93/heimnetz-geraete` | `8169f038b62a39caaca2626ce03f86d5246dcecc` | Pixel Readable Fonts session/launcher model; MX500 jobs, inventory, locks and confirmation workflow |
| `Lycidias93/magisk-boot-watch` | `9ea961ebed8e6926713a71c2a0a41e983767165e` | Read-only status, logs, history and safety UI |
| `Lycidias93/module-reflash-trigger` | `1e8566c60261027f43a1b5d49e289ce93d307a93` | Background jobs, honest status, dry-run and selection workflows |
| `Lycidias93/ssh-drop-dispatcher` | `491efc1857632d4956a085089ff084f91ad96c16` | Control, diagnostics, enable/disable and secret-safe settings concepts |

These are first-party references, not additional third-party license
dependencies.

## Update procedure

1. Inspect the new source commit and license.
2. Compare only the component relevant to the shared core.
3. Import complete files or complete components only when the source license is compatible; otherwise keep the source design-reference-only and implement independently.
4. Update this document, `NOTICE`, `CREDITS.md`, and licenses when applicable to imported material.
5. Update `CORE_VERSION` for a contract or managed-file change.
6. Run `scripts/verify.sh` and `scripts/build.sh`.
7. Record security and migration impact in the pull request.

Do not import assets, fonts, generated bundles or dependencies with an
undocumented or incompatible license.
