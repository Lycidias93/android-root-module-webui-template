# Core synchronization

`core/manifest.txt` defines the files owned by the common WebUI foundation.

## Preview

```text
./scripts/sync-core.sh /path/to/target-repository
```

The script prints `UPDATE` and `UNCHANGED` entries without writing.

## Apply

```text
./scripts/sync-core.sh --apply /path/to/target-repository
```

Requirements:

- source and target are local Git checkouts;
- target worktree is clean;
- target uses the standard `module/`, `server/`, and `scripts/` layout;
- update is performed on a non-default task branch.

The script copies complete files and writes `webui.lock` with:

- lock schema;
- core version;
- source repository;
- source commit;
- manifest SHA-256.

## v0.3 synchronized core

The v0.3 core manifest additionally owns the reusable typed-administration
extension:

- `module/webroot/v03.js`;
- v0.3 server handlers and tests under `server/cmd/webui-server/`;
- the base `index.html` loader for the optional extension;
- the WebUI contract test that verifies both base and extension scripts.

The extension is opt-in at the adapter boundary. A consumer that does not
implement `module-control capabilities-v03` keeps the existing base UI and the
v0.3 frontend quietly hides its additional administration tabs.

Consumers that enable it must update their module-owned adapter to the current
[API contract](API_CONTRACT.md), including collection/import/export domain
validation, rollback and secret policy.

## Deliberately not synchronized

- `module/bin/module-control`
- `module/module.prop`
- installer and service behavior
- persistent defaults
- module-specific tests
- project documentation

These remain module-owned because their semantics and risk cannot be generalized.
For v0.3 this boundary is especially important: the shared core owns typed
transport and UI mechanics, while each module owns record schemas, import archive
meaning, generated configuration, backup contents and rollback semantics.

## Pinning rule

A consuming module must pin the exact template source commit and core version in
`webui.lock` or its equivalent build lock. Do not consume floating `main` in a
release candidate. If the template commit changes after a candidate build, the
consumer candidate must be rebuilt and reverified before device acceptance.

## Review after sync

1. Inspect every changed core file.
2. Update the target adapter to the current API contract when its enabled capabilities require it.
3. Verify that no module-specific secret/path/command semantics leaked into the core.
4. Run target repository tests.
5. Run the candidate-bound WebUI release audit from [RELEASE_AUDIT.md](RELEASE_AUDIT.md), including `python3 scripts/webui-release-audit.py`.
6. Build the exact module ZIP.
7. Verify installation and Action launch on a test device.
8. Exercise every enabled HTTP/WebUI surface on the exact installed candidate; Settings requires a safe `GET -> POST -> GET/effective-state` round-trip when config is enabled.
9. Exercise enabled v0.3 preview/apply/import/export paths with safe fixtures.
10. Exercise v0.5 Diagnostics and verify that only redacted allowlisted state appears.
11. Verify global dirty-state marking/clearing on every enabled mutable UI surface.
12. Verify every script/stylesheet referenced by the shipped page returns the expected HTTP response; referenced asset 404s are release blockers.
13. Record `webui.lock` in the migration PR.
14. Do not publish a release until repository and exact-device WebUI release audits both report `verdict=pass` and `failure_count=0`.

## v0.4 consumers

A consumer using typed async features pins `CORE_VERSION=0.4.0` or newer and the exact template commit. Sync the v0.4 manifest as one unit, including `v04.js`, `v04.go` and their tests. A candidate built against an older core must be rebuilt and reverified after adopting v0.4.

## v0.5 consumers

Core v0.5 adds the synchronized `observability.js` and `observability.css` layer
plus its static contract test and loader order in `index.html`. It changes no
server endpoint and requires no new adapter capability. Base-v1, v0.3 and v0.4
modules can therefore adopt `CORE_VERSION=0.5.0` without an adapter migration,
but must sync the complete manifest and pin the exact template commit.

## v0.6.1 embedded-host consumers

Core v0.6.1 adds `embedded-host-bootstrap.js` and the launcher `--print-url`
contract. Supported root-manager WebViews such as KsuWebUI may use their existing
root bridge only to start the bundled loopback server and obtain its one-time
bootstrap URL. The WebView immediately redirects to `127.0.0.1`; all status,
settings, actions, jobs and inventories continue through the same authenticated
HTTP API as the normal browser path. The embedded host is therefore a bootstrap
transport, not a second privileged API backend.

Consumers with a custom launcher must implement the same `--print-url` result:
`WEBUI_BOOTSTRAP_URL=http://127.0.0.1:<port>/bootstrap?token=<one-time-token>` and
must not open an external browser in that mode. Consumers that keep the template
`module/action.sh` receive this behavior directly.

Consumers with custom WebUI markup must preserve the managed script order:
`embedded-host-bootstrap.js` → `race-guard.js` → `observability.js` → `app.js` →
optional `v03.js` → optional `v04.js`. Rebuild and reverify any existing release
candidate after the core pin changes.
