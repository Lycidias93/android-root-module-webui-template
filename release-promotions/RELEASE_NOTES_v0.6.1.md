# Android Root Module WebUI Core 0.6.1

## What changed

- Added bounded KsuWebUI-style embedded launch support that starts the same authenticated `127.0.0.1` standalone session used by the module Action button instead of introducing a second privileged backend.
- Hardened WebUI startup against the fork-to-exec readiness race before server identity and ready-state verification.
- Retained the Core 0.6 state-aware mobile UI, capability-driven settings/actions/inventory, preview-vs-apply wording and backwards-compatible optional administration extensions.

## Compatibility

Existing base-v1, v0.3 and v0.4 module adapters remain compatible. Embedded-host support is optional; standalone browser launch remains available without a companion app, Termux, CDN or cloud dependency.
