# Credits

This project is an original combined implementation maintained by
**Lycidias93**. It consolidates proven ideas from public upstream references and
first-party module projects into one standalone browser WebUI foundation while
keeping imported code and license boundaries explicit.

## Public upstream projects

### Coolapk-Code9527 — F2FS-Optimizer

- Project: `Coolapk-Code9527/F2FS-Optimizer`
- Pinned source: `651b66b14087b5d60e4b9d3fd69de899a8cd43b8`
- Contribution: localhost lifecycle, Action launch, idle timeout, temporary
  runtime state and atomic-configuration concepts.
- License: MIT

### KOWX712 — ksu-webui-demo

- Project: `KOWX712/ksu-webui-demo`
- Pinned source: `5ff958423202e9af7675e83e8ce57a34d80ddcd9`
- Contribution: compact vanilla-JavaScript structure and card-based root-module
  UI concepts.
- License: MIT

### barsikus007 — ksu-webui-module-template

- Project: `barsikus007/ksu-webui-module-template`
- Pinned source: `4ec624e2514043064d3b50ff5ec585acff4ffc97`
- Contribution: multi-manager packaging, build layout and template-repository
  workflow concepts.
- License: MIT

### AuroraNasa — AMMF2

- Project: `Aurora-Nasa-1/AMMF2`
- Pinned source: `98d2ef7d0491f6524cee09c958ef239338b49d3c`
- Contribution: modular logging, themes, localization and reusable component
  concepts.
- License: MIT

### Drizzy07x / Drizzy11 — Supercharger Pixel 9 Series

- Project: `Drizzy07x/Supercharger_Pixel_9_Series`
- Pinned source: `be76cbe57d01fa475196b7afb3729b9ad19f0a26`
- Contribution: WebUI interaction-race regression scenarios, status-readiness
  gating, duplicate-action prevention and stale-response handling concepts.
- License: MIT

### AshBorn — AshReXcue / AshLooper

- Project: `RipperHybrid/AshLooper`
- Pinned source: `6db87ffba007560eff443a0330037cd6a2563c2b`
- Contribution: design-review inspiration for global unsaved-change awareness,
  session activity diagnostics and raw-state inspection.
- License: GPL-3.0; design reference only. No AshLooper JavaScript, CSS, shell
  code, assets or other GPL-covered implementation was copied or imported.

## First-party pattern sources

The foundation also consolidates patterns developed in these Lycidias93
projects:

- Pixel Readable Fonts and Pixel Termux/MX500 Backup from
  `Lycidias93/heimnetz-geraete@8169f038b62a39caaca2626ce03f86d5246dcecc`
- Boot Watch Collector from
  `Lycidias93/magisk-boot-watch@9ea961ebed8e6926713a71c2a0a41e983767165e`
- Module Reflash Trigger from
  `Lycidias93/module-reflash-trigger@1e8566c60261027f43a1b5d49e289ce93d307a93`
- SSH Drop Dispatcher from
  `Lycidias93/ssh-drop-dispatcher@491efc1857632d4956a085089ff084f91ad96c16`

The adopted and deliberately rejected patterns are documented in
`docs/PATTERN_LIBRARY.md`.

## Attribution policy

When importing external code or assets:

1. Pin the exact source commit.
2. Record imported paths and modifications in `UPSTREAMS.md`.
3. Preserve copyright headers.
4. Retain the matching license under `third_party/licenses/`.
5. Update `NOTICE` and this file.
6. Add tests for every security-relevant adaptation.

Design-only references must be identified as such and must not be represented as
imported code. The listed upstream authors do not endorse this project.
