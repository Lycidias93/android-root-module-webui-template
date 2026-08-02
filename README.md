# Android Root Module Standalone WebUI Template

A public starter template for Magisk-compatible root modules with a local WebUI that works **without a companion app**.

The module action button starts a short-lived HTTP server bound only to `127.0.0.1`, opens the system browser, and exposes a small allowlisted API to the module backend. KernelSU/APatch-style `webroot/` hosting can be added as an optional second renderer, but it is not required for Magisk users.

## Goals

- No MMRL, WebUI X, Termux, or custom companion APK required.
- Entire UI and backend shipped inside the module ZIP.
- Loopback-only server with a per-session token and idle shutdown.
- No arbitrary shell execution from JavaScript.
- Atomic configuration writes and fixed backend actions.
- Reproducible Android binaries and module ZIPs via GitHub Actions.
- Explicit upstream credits and retained MIT license notices.

## Current scope

| Capability | Status |
|---|---|
| Magisk `action.sh` → system browser | Included |
| Loopback-only server | Included |
| Random per-launch session token | Included |
| Automatic idle shutdown | Included |
| Status/config/log API | Included |
| Allowlisted module actions | Included |
| Offline responsive UI | Included |
| arm64-v8a | Included |
| x86_64 / 32-bit Android | Not included in v0.1; requires an Android NDK/cgo build lane |
| Native KernelSU/APatch bridge | Planned adapter; standalone browser mode already works |

## Repository layout

```text
module/                 Module files packaged into the ZIP
server/                 Small Go HTTP server
scripts/build.sh        Builds Android binaries and module ZIP
scripts/verify.sh       Syntax, policy, Go, and cross-build checks
docs/                   Architecture, security model, and setup notes
third_party/licenses/   Retained upstream MIT licenses
UPSTREAMS.md            Pinned source credits and adaptation notes
```

## Start a module from this template

1. Create a repository from this template.
2. Edit `module/module.prop`.
3. Replace the example behavior in `module/bin/module-control`.
4. Adjust the UI in `module/webroot/`.
5. Run:

```bash
./scripts/verify.sh
./scripts/build.sh
```

The installable ZIP and checksum are written to `dist/`.

## End-user flow

1. Install the generated ZIP in Magisk, KernelSU, or APatch.
2. Reboot if the module itself requires it.
3. Open the module manager and press the module **Action** button.
4. The default browser opens the local WebUI.
5. The local server exits after the configured idle timeout.

The server never listens on Wi-Fi, mobile data, Tailscale, or another network interface.

## Backend contract

The server never runs user-provided command strings. It invokes only:

```text
module/bin/module-control status
module/bin/module-control config-get
module/bin/module-control config-set <allowed-key> <validated-value>
module/bin/module-control log <validated-line-count>
module/bin/module-control action <allowlisted-action>
```

Keep this contract narrow. Add new functionality by extending both allowlists and validation, not by adding a generic command endpoint.

## Template defaults

The example configuration contains:

- `enabled=true|false`
- `mode=balanced|performance|battery`
- `log_level=error|info|debug`
- `interval_seconds=15..3600`

These are demonstration values. Replace them with fields relevant to your module.

## Build requirements

- Bash
- Go as declared in `go.mod`
- `zip` and `unzip`
- `sha256sum`

GitHub Actions installs Go automatically and uploads the built ZIP as a workflow artifact.

## Security

Read [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) before extending the API.

Key rules:

- Keep the listener on `127.0.0.1`.
- Keep token authentication enabled.
- Never expose a generic shell endpoint.
- Validate every key, value, action, path, and size at both API and backend layers.
- Keep the server action-triggered; do not run it permanently at boot.
- Keep the WebUI optional so a UI failure cannot block module boot.

## Credits and provenance

This repository is a clean combined implementation informed by several MIT-licensed Android root-module projects. See [CREDITS.md](CREDITS.md), [UPSTREAMS.md](UPSTREAMS.md), and `third_party/licenses/`.

No upstream project is represented as endorsing this template.

## License

The original template code is MIT-licensed. Third-party notices remain under their respective MIT license files.
