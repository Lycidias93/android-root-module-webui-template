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

## v0.6.5 Action SIGHUP survival consumers

Core v0.6.5 corrects the detached Action-server lifetime contract. The launcher already starts the server with `SIGHUP` ignored, but older server code subscribed to `SIGHUP` and therefore re-enabled the signal. Consumers using standalone Action browser launch must sync the complete v0.6.5 core, pin its exact template commit, rebuild, and verify that the Action-launched loopback listener survives launcher exit before browser bootstrap.

## v0.6.4 session/job lifetime consumers

Core v0.6.4 changes the reusable launcher defaults without changing the HTTP
API. The normal and embedded-host launch paths keep a 15-minute idle shutdown,
use a one-hour default authenticated session, and retain the 30-minute default
background-job timeout. This prevents the default browser session from expiring
before a valid default job can complete while preserving bounded, user-triggered
loopback lifetime.

Consumers must sync the complete core, pin the exact v0.6.4 template commit,
rebuild the candidate, and verify a productive background job remains observable
past the old 15-minute boundary. Consumer overrides of `WEBUI_SESSION_TTL` or
`WEBUI_JOB_TIMEOUT` remain explicit consumer policy and must be verified so the
chosen session lifetime does not undercut the intended job-observation window.

## v0.6.3 action apply-job consumers

Core v0.6.3 adds the optional base action field `apply_job`. Use it when the
same user-facing operation has a quick read-only Preview but a productive Apply
that can exceed synchronous HTTP action bounds. The target must be an already
declared base job with the same risk; Jobs must be enabled, the action must
support dry-run, and base-action confirmation is not allowed on the binding.

Consumers adopting this contract must sync the complete core manifest, add the
named `job-run` adapter case, keep the preview path read-only, and exercise both
the synchronous Preview and background Apply on the exact installed candidate.
The productive path must be observed through Jobs until terminal success/failure;
a browser notice that the job started is not completion evidence.

## v0.6.2 Action-browser consumers

Core v0.6.2 changes only the reusable launcher lifetime contract. Consumers
using the template `module/action.sh` should pin the exact v0.6.2 template
commit and rebuild their candidate so the standalone loopback server is detached
from the Action shell's stdin/SIGHUP lifetime before the external browser opens.

The expected launcher evidence includes `server_detach=hup_safe`. Exact-device
acceptance must exercise the module-manager Action button itself, not only an
embedded KsuWebUI launch, and prove that the browser consumes the one-time token
and reaches the clean authenticated root after `action.sh` has returned.

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

## v0.6.6 Android boolean parser consumers

Core v0.6.6 adds a portability contract for module-owned JSON boolean parsing. Android/Toybox `sed` must not depend on GNU BRE `\|` alternation for `true|false`. Consumers must update their module-owned adapter, rebuild, and prove that a `dry_run=true` request returns without changing persistent or runtime state. The adapter remains deliberately outside `core/manifest.txt`; the shared core owns the contract and regression guidance, while each consumer owns its concrete action semantics.


## v0.6.7 mobile UX consumers

Core v0.6.7 removes the global fixed dirty toolbar and the custom focused-control viewport scroller. Consumers must sync the complete manifest, including deletion of `mobile-input-viewport.js`, and must not retain stale page references or HTTP allowlist entries for that asset. Dirty tracking remains available through Diagnostics and `beforeunload`; saving remains owned by each typed editor. Exact-device acceptance must exercise a real boolean Settings change through Save and authoritative reload, plus field focus with the on-screen keyboard, using the same root-manager launch environment as production.

## v0.7.0 notifications consumers

Pin the exact Core 0.7.0 commit and sync the complete manifest including `module/lib/ntfy.sh`. Consumers enabling notifications implement the strict status operation and optional test operation; private provider values never cross the API. Rebuild and repeat repository plus exact-device WebUI acceptance after changing the core pin.
