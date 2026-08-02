# Android Root Module Standalone WebUI Template

A public foundation for Magisk-compatible root modules with a local browser
interface that works **without a companion app**.

The module Action button starts a short-lived native server on `127.0.0.1`,
opens the default Android browser, exchanges a one-time bootstrap token for an
HttpOnly session cookie, and exposes only typed, allowlisted module operations.

## Foundation status

`CORE_VERSION=0.2.1`

| Capability | Included |
|---|---|
| Magisk Action → default browser | Yes |
| Companion app, Termux, Python, CDN or cloud dependency | No |
| Loopback-only dynamic port | Yes |
| Token absent from server argv | Yes |
| One-time bootstrap → clean URL + HttpOnly cookie | Yes |
| Exact Host, loopback peer and same-origin mutation checks | Yes |
| Capability-driven settings and actions | Yes |
| Capability-driven read-only navigation | Yes |
| Adapter-defined Overview summary cards | Yes |
| Bounded background jobs with status and output | Yes |
| Typed inventory views | Yes |
| Bounded logs | Yes |
| ARM64 Android build | Yes |
| 32-bit/x86 builds | No; intentionally not advertised |
| WebUI boot dependency | No |

## Design goals

- Capability-driven tabs for read-only dashboards without empty settings/action views.
- Adapter-defined Overview summary cards with shared rendering and risk levels.
- One coherent core for read-only dashboards, settings modules, diagnostics,
  inventories and long-running workflows.
- Module-specific shell or native logic remains authoritative.
- JavaScript never constructs or executes arbitrary shell commands.
- Every mutable field and action is validated in both server and module adapter.
- Runtime session files remain outside the replaceable module directory.
- Persistent configuration survives module updates under `/data/adb/<module-id>`.
- A broken WebUI cannot prevent boot or normal module operation.
- Credits and source provenance stay explicit.

## Runtime flow

```text
Module manager Action
        |
        v
module/action.sh
        |
        +-- creates private /data/local/tmp/<module-id>-webui
        +-- writes a 0600 one-time token file
        +-- starts bundled arm64 server on 127.0.0.1:0
        +-- opens /bootstrap?token=<one-time-token>
        |
        v
server
        |
        +-- consumes and deletes token file
        +-- sets short-lived HttpOnly SameSite=Lax cookie
        +-- redirects to clean /
        +-- serves offline UI and typed /api/v1 endpoints
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
```

The server invokes `module-control` with an argument array. It never evaluates
shell text supplied by the browser.

## Repository layout

```text
CORE_VERSION                     Version of the reusable core
core/manifest.txt                Files managed by core synchronization
module/action.sh                 Secure browser launcher
module/bin/module-control        Example module-owned adapter
module/config/*.default          Packaged defaults only
module/webroot/                  Generic capability-driven UI
server/cmd/webui-server/         Native loopback server and tests
scripts/sync-core.sh             Plan/apply core updates to another repo
scripts/verify.sh                Policy, syntax, unit and integration checks
scripts/build.sh                 ARM64 module ZIP + build manifest
docs/                            API, architecture, migration and security
third_party/licenses/            Retained upstream MIT licenses
```

## Create a module

1. Use **Use this template** on GitHub.
2. Edit `module/module.prop`.
3. Replace the example implementation in `module/bin/module-control`.
4. Keep its `capabilities` document aligned with implemented operations.
5. Replace example defaults in `module/config/module.conf.default`.
6. Keep the generic UI, or extend it through reviewed capability-schema changes.
7. Run:

```text
./scripts/verify.sh
./scripts/build.sh
```

The installable ZIP and `build-manifest.json` are written to `dist/`. The
manifest records SHA-256 and size without publishing a per-ZIP `.sha256`
sidecar.

## Module adapter boundary

The core understands only these fixed operations:

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

The request files are created under the private WebUI runtime directory and
removed after use. A module adapter must reject files outside that directory,
revalidate all values, and use atomic persistent writes.

See [API contract](docs/API_CONTRACT.md) and
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

Backup, restore, retention, scans and debug collection can therefore run
without holding an HTTP request open.

## Reusing the core in existing projects

A generated project can periodically import reviewed core updates:

```text
./scripts/sync-core.sh /path/to/module-repository
./scripts/sync-core.sh --apply /path/to/module-repository
```

The target must be a clean Git worktree. The script copies only files listed in
`core/manifest.txt` and writes `webui.lock`. It does not overwrite
`module-control`, `module.prop`, module services or module documentation.

See [core synchronization](docs/CORE_SYNC.md).

## Recommended migration order

1. Read-only status/log modules.
2. Small settings and control modules.
3. Modules with scans, diagnostics or other jobs.
4. Inventory and retention workflows.
5. Restore, destructive actions and high-risk tuning only after dry-run,
   readiness and exact-confirmation contracts are proven.

The specific patterns extracted from existing Lycidias93 projects are recorded
in [PATTERN_LIBRARY.md](docs/PATTERN_LIBRARY.md).

## Security invariants

A contribution must not:

- bind to `0.0.0.0`, Wi-Fi, mobile, Tailscale or another network interface;
- put bootstrap or session secrets in server argv;
- add a generic command or unrestricted path endpoint;
- bypass exact Origin checks for mutations;
- package live config, logs, session state or private values;
- make the WebUI start at boot;
- fetch scripts, fonts, analytics or UI dependencies from the network;
- claim unsupported ABIs.

Review [SECURITY_MODEL.md](docs/SECURITY_MODEL.md) before extending the core.

## Credits and provenance

The foundation combines clean implementations of ideas from several
MIT-licensed Android root-module projects and first-party patterns from existing
Lycidias93 modules. Attribution, pinned commits and retained licenses are in
[CREDITS.md](CREDITS.md), [UPSTREAMS.md](UPSTREAMS.md), `NOTICE`, and
`third_party/licenses/`.

No upstream project is represented as endorsing this template.

## License

Original project code is MIT-licensed. Third-party notices remain under their
respective retained license files.
