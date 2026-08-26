# Android Root Module Standalone WebUI Template

A public foundation for Magisk-compatible root modules with a local browser
interface that works **without a companion app**. Supported embedded root-manager
hosts such as KsuWebUI can optionally bootstrap the same standalone loopback
session instead of acting as a second privileged API backend.

The module Action button starts a short-lived native server on `127.0.0.1`,
opens the default Android browser, exchanges a one-time bootstrap token for an
HttpOnly session cookie, and exposes only typed, allowlisted module operations.
An embedded KsuWebUI launch uses its host bridge only to start that same server
and then redirects the WebView to the authenticated loopback session.

## Foundation status

`CORE_VERSION=0.6.1`

| Capability | Included |
|---|---|
| Magisk Action → default browser | Yes |
| KsuWebUI embedded launch → same standalone loopback session | Yes |
| Companion app, Termux, Python, CDN or cloud dependency | No |
| Loopback-only dynamic port | Yes |
| Token absent from server argv | Yes |
| One-time bootstrap → clean URL + HttpOnly cookie | Yes |
| Exact Host, loopback peer and same-origin mutation checks | Yes |
| Capability-driven settings and actions | Yes |
| Capability-driven read-only navigation | Yes |
| Adapter-defined Overview summary cards | Yes |
| Adapter-reported active/blocked action state | Yes, optional status convention |
| Preview-vs-apply action UX | Yes |
| Bounded background jobs with status and output | Yes |
| Typed inventory views | Yes |
| Session-cached inventory switching + explicit live refresh | Yes |
| Mobile responsive inventory rows and touch navigation | Yes |
| Typed repeated-record/profile editor | Yes, optional v0.3 extension |
| Preview-bound whole-collection apply | Yes, optional v0.3 extension |
| Bounded schema-declared import/export | Yes, optional v0.3 extension |
| Secret/reference/credential export policy metadata | Yes |
| Startup mutation lock and stale-response guard | Yes |
| Global unsaved-area coordinator | Yes |
| Typed operation timeline + safe diagnostics | Yes |
| Bounded logs | Yes |
| ARM64 Android build | Yes |
| 32-bit/x86 builds | No; intentionally not advertised |
| WebUI boot dependency | No |

The v0.3 administration extension is opt-in. Modules that do not implement
`capabilities-v03` continue to use the same base v1 UI/API and do not show the
additional Profiles/Backup tabs.

Core v0.5 added the browser-session observability layer. Core v0.6 keeps the
server action allowlist unchanged and adds state-aware/mobile base-UI behavior:
optional adapter-reported active/blocked actions, explicit Preview vs Apply
wording, session-cached inventory switching with stale-response protection,
and responsive mobile inventory/navigation rendering. Core v0.6.1 adds a
bounded embedded-host bootstrap for KsuWebUI-style hosts while keeping every
privileged module operation on the existing loopback HTTP API. Base-v1, v0.3
and v0.4 consumers remain API-compatible when they omit optional state objects.

## Design goals

- Capability-driven tabs for read-only dashboards without empty settings/action views.
- Adapter-defined Overview summary cards with shared rendering and risk levels.
- Optional action-state reporting makes the current effective choice visible without moving domain authority into JavaScript.
- Dry-run is presented as **Preview only** and never visually confused with a productive Apply action.
- Inventory view switching should be instant after first load; explicit Refresh performs the live adapter read.
- Stale or out-of-order inventory responses must never replace the currently selected view.
- One coherent core for read-only dashboards, settings modules, diagnostics,
  inventories, long-running workflows and typed administration.
- Repeated records are edited as typed collections, never raw config or shell text.
- Import is preview-first, bounded and staged only in the private WebUI runtime.
- Generic export is secret-safe and cannot expose arbitrary device files.
- Module-specific shell or native logic remains authoritative.
- Normal authenticated UI JavaScript never constructs or executes arbitrary shell commands.
- The optional embedded-host bootstrap may construct only one fixed launcher command from a strictly validated installed-module path; no UI field, action name, payload or user text enters that command.
- State-dependent base mutations remain locked until status is ready and while
  a previous mutation is still completing.
- Stale overlapping status/log responses are prevented from replacing newer UI state.
- Session diagnostics record typed operation metadata and allowlisted redacted state,
  never arbitrary request payloads, shell commands, logs or job output.
- Global draft UX never pretends independent mutations are one atomic "save all" action.
- Every mutable value is validated in the server and again at the module/domain boundary.
- Runtime session/upload/preview files remain outside the replaceable module directory.
- Persistent configuration survives module updates under `/data/adb/<module-id>`.
- A broken WebUI cannot prevent boot or normal module operation.
- Credits and source provenance stay explicit.

## Runtime flow

```text
Module manager Action                         KsuWebUI module selection
        |                                              |
        v                                              v
module/action.sh                               embedded-host-bootstrap.js
        |                                              |
        |                                              +-- validates /data/adb/modules/<id>
        |                                              +-- invokes fixed launcher --print-url
        |                                              +-- redirects WebView to 127.0.0.1 bootstrap URL
        |                                              |
        +----------------------+-----------------------+
                               |
                               v
                    short-lived loopback server
                               |
                               +-- private /data/local/tmp/<module-id>-webui
                               +-- 0600 one-time token file
                               +-- listens on 127.0.0.1:0
                               +-- consumes /bootstrap?token=<one-time-token>
                               +-- sets short-lived HttpOnly SameSite=Lax cookie
                               +-- redirects to clean /
                               +-- serves offline UI and typed /api/v1 endpoints
                               +-- optionally exposes v0.3 typed collection/import/export endpoints
                               |
                               v
                    module/bin/module-control
                               |
                               +-- capabilities
                               +-- status
                               +-- config-get / config-apply
                               +-- log
                               +-- action-file
                               +-- job-run
                               +-- inventory
                               +-- optional capabilities-v03
                               +-- optional collection-get / collection-preview / collection-apply
                               +-- optional import-preview / import-apply / export
```

The server invokes `module-control` with an argument array. It never evaluates
shell text supplied by the browser. KsuWebUI is used only for the initial fixed
launcher handoff; after redirect the WebUI uses the same authenticated HTTP path
as the normal browser launch.

## Repository layout

```text
CORE_VERSION                     Version of the reusable core
core/manifest.txt                Files managed by core synchronization
module/action.sh                 Secure browser/embedded-host launcher
module/bin/module-control        Example module-owned base adapter
module/config/*.default          Packaged defaults only
module/webroot/embedded-host-bootstrap.js  Bounded KsuWebUI bootstrap redirect
module/webroot/                  Generic capability-driven UI + observability + optional extensions
server/cmd/webui-server/         Native loopback server and tests
scripts/sync-core.sh             Plan/apply core updates to another repo
scripts/verify.sh                Policy, syntax, unit and integration checks
scripts/webui-release-audit.py   Pre-release HTTP/static-route contract audit
docs/                            API, architecture, migration, security and release-audit policy
third_party/licenses/            Retained licenses for imported third-party code
```

## Create a module

1. Use **Use this template** on GitHub.
2. Edit `module/module.prop`.
3. Replace the example implementation in `module/bin/module-control`.
4. Keep its `capabilities` document aligned with implemented base operations.
5. Optionally report current `status.action_state` so stateful actions are marked active/blocked in the shared UI.
6. If typed collections/import/export are needed, implement `capabilities-v03`
   and only the declared extension operations.
7. Replace example defaults in `module/config/module.conf.default`.
8. Keep the generic UI; extend module semantics through the adapter rather than
   forking browser shell/path behavior.
9. Run:

```text
./scripts/verify.sh
./scripts/build.sh
```

The installable ZIP and `build-manifest.json` are written to `dist/`. The
manifest records SHA-256 and size without publishing a per-ZIP `.sha256`
sidecar.

## Release audit

Any release candidate that changes HTTP handling, WebUI, WebUI Core/server/static assets, embedded-host bootstrap, API/schema behavior, or a WebUI-backed module adapter must additionally pass the candidate-bound release audit before publication:

```text
./scripts/verify.sh
python3 scripts/webui-release-audit.py
./scripts/build.sh
```

The exact installed candidate must then pass the consumer repository's device WebUI audit, including HTTP reachability of every shipped page-referenced asset and a safe Settings `GET -> POST -> GET/effective-state` round-trip when config is enabled. Package/install/postboot verification by itself is not full WebUI functional acceptance. See [RELEASE_AUDIT.md](docs/RELEASE_AUDIT.md).

## Module adapter boundary

Base operations:

```text
module-control capabilities
module-control status
module-control config-get
module-control config-apply <server-created-request-file>
module-control log <validated-line-count>
module-control action-file <declared-action> <server-created-request-file>
module-control job-run <declared-job>
module-control inventory <declared-inventory>
```

Optional v0.3 extension operations:

```text
module-control capabilities-v03
module-control collection-get <declared-collection>
module-control collection-preview <declared-collection> <private-request-file>
module-control collection-apply <declared-collection> <private-request-file>
module-control import-preview <declared-import> <private-upload-file>
module-control import-apply <declared-import> <private-upload-file> <private-request-file>
module-control export <declared-export>
```

The core owns authentication, private staging, byte/field bounds and preview
binding. The adapter owns domain validation, persistent backup, atomic commit,
effective-state verification and rollback. A module must reject files outside
the expected private runtime paths and never turn typed fields into arbitrary
shell/config channels.

See [API contract](docs/API_CONTRACT.md),
[import/export contract](docs/IMPORT_EXPORT_CONTRACT_V1.md), and
[module migration guide](docs/MIGRATION_GUIDE.md).

## Background jobs

The server owns job identity and lifecycle:

- at most a configured number of concurrent jobs;
- fixed module-declared job names;
- context timeout;
- bounded stdout and stderr;
- explicit `queued`, `running`, `success`, or `failed` state;
- no false percentage progress;
- the idle shutdown waits for active jobs.

Expensive diagnostics, scans or backup generation can therefore run without
holding an HTTP request open. Import preview/apply itself remains a separate
preview-bound transaction contract rather than a generic background shell job.

## Reusing the core in existing projects

A generated project can periodically import reviewed core updates:

```text
./scripts/sync-core.sh /path/to/module-repository
./scripts/sync-core.sh --apply /path/to/module-repository
```

The target must be a clean Git worktree. The script copies only files listed in
`core/manifest.txt` and writes `webui.lock`. It does not overwrite
`module-control`, `module.prop`, module services or module documentation.

Consumer release candidates must pin a concrete template commit/core version;
do not consume floating `main` silently.

See [core synchronization](docs/CORE_SYNC.md).

## Recommended migration order

1. Read-only status/log modules.
2. Small settings and control modules.
3. Modules with scans, diagnostics or other jobs.
4. Typed inventories and repeated-record/profile administration.
5. Secret-safe configuration import/export with preview and rollback.
6. Restore, destructive actions and high-risk tuning only after dry-run,
   readiness and exact-confirmation contracts are proven.

The specific patterns extracted from existing Lycidias93 projects are recorded
in [PATTERN_LIBRARY.md](docs/PATTERN_LIBRARY.md).

## Security invariants

A contribution must not:

- bind to `0.0.0.0`, Wi-Fi, mobile, Tailscale or another network interface;
- put bootstrap or session secrets in server argv;
- turn a root-manager bridge into a generic command or API transport;
- add a generic command, raw SSH-config editor or unrestricted path endpoint;
- let an uploaded filename choose a device path;
- bypass exact Origin checks for mutations;
- expose private-key bytes, tokens or credential material through generic export;
- package live config, logs, session state or private values;
- make the WebUI start at boot;
- fetch scripts, fonts, analytics or UI dependencies from the network;
- claim unsupported ABIs.

Review [SECURITY_MODEL.md](docs/SECURITY_MODEL.md) before extending the core.

## Credits and provenance

The foundation combines clean implementations of ideas from public Android
root-module projects and first-party patterns from existing Lycidias93 modules.
GPL-licensed projects may be listed only as design references when no code or
assets are imported. Attribution and pinned commits are in
[CREDITS.md](CREDITS.md), [UPSTREAMS.md](UPSTREAMS.md), `NOTICE`, and retained
license files where applicable.

No upstream project is represented as endorsing this template.

## License

Original project code is MIT-licensed. Third-party notices remain under their
respective retained license files.

## Core v0.4 typed async extension

Core v0.4 keeps the base v1 and v0.3 contracts backward compatible and adds an opt-in `capabilities-v04` extension for workflows that need typed parameters without exposing an arbitrary command or path channel.

Reusable primitives:

- typed parameterized background jobs staged through private request files;
- active-job dedupe on declared identity fields;
- collection-backed reference parameters;
- inventory-bound operations that re-resolve a selected identity before launch;
- visibility-aware bounded polling without fake percentage progress;
- one shared status timeout for HTTP status and server self-test.

Modules that do not implement `capabilities-v04` continue to use the existing UI/API unchanged. See [Core v0.4 contract](docs/ROADMAP_V0_4.md).

## Core v0.5 observability layer

Core v0.5 keeps the base-v1, v0.3 and v0.4 server/adapter contracts unchanged and adds generic browser-session UX:

- one global indicator for unsaved Settings, Profiles and Import drafts;
- a bounded typed API operation timeline with result and duration;
- a Diagnostics tab with safe, redacted snapshots of selected API state;
- copyable diagnostics with no request bodies, query parameters, shell commands, logs or job output;
- local discard through page reload instead of a cross-transaction "save all" action.

See [Core v0.5 contract](docs/ROADMAP_V0_5.md).

## Core v0.6 state-aware mobile UX

Core v0.6 keeps all existing typed server mutation contracts and adds reusable browser behavior for stateful root-module controls:

- optional `status.action_state.active` marks declared actions as currently effective;
- optional `status.action_state.blocked` gives display-safe dependency reasons while the server/module remain authoritative;
- dry-run controls are labeled **Preview only**, and the action button explicitly says Preview, Apply, or Reapply;
- loaded inventory views are cached for the browser session and switched without another root adapter invocation;
- an explicit **Refresh view** performs the live inventory read;
- request sequencing prevents stale inventory results from replacing the selected view;
- base job polling is single-flight and pauses while the document is hidden;
- operation errors no longer mark the whole local session disconnected unless the session itself is invalid;
- mobile inventory rows wrap long values and tabs avoid smooth-centering/visible scrollbars.

The status convention is optional. Consumers that do not report `action_state` keep the same action capability contract and simply omit active/blocked highlighting.

## Core v0.6.1 embedded-host bootstrap

Core v0.6.1 keeps the typed API and standalone-server security model unchanged
while adding compatibility with KsuWebUI-style embedded module hosts:

- `embedded-host-bootstrap.js` detects the fixed `mui.kernelsu.org` asset host and
  the host-provided KernelSU-compatible bridge;
- the bridge is used only to invoke the installed module's fixed launcher with
  `--print-url`;
- the launcher returns a one-time `127.0.0.1` bootstrap URL without opening the
  external browser;
- the WebView validates and follows that URL, after which the ordinary HttpOnly
  session and same-origin typed API apply;
- temporary `/api/v1/*` requests against the asset host are held during the
  redirect instead of surfacing misleading static-file `404 Not Found` errors;
- no settings, actions, jobs, inventory or arbitrary shell input are transported
  through the root-manager bridge.

This lets the default-browser Action path and compatible embedded WebUI hosts
coexist without maintaining two privileged backends.
