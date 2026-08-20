# Migration guide

## Migration principle

Do not replace a working module backend with UI code. Keep existing module
logic, wrap it in the typed adapter contract, then move presentation to the
shared core.

## Phase 0: inventory

Record:

- current module ID and runtime paths;
- persistent and ephemeral files;
- existing Action behavior;
- current WebUI bridge or server;
- status, config, log, action, job and inventory operations;
- repeated profile/record data that may need a typed collection editor;
- import/export or backup formats already owned by the module;
- secret-bearing and credential-bearing values;
- destructive operations and rollback;
- live verification markers.

## Phase 1: adapter

Implement `module/bin/module-control` operations one by one.

Start with:

1. `capabilities`
2. `status`
3. `config-get`
4. `log`

Then add mutations with backend validation:

5. `config-apply`
6. `action-file`
7. `job-run`
8. `inventory`

Do not expose old CLI parsing directly when it accepts arbitrary commands or
paths. Add narrow wrapper operations.

For v0.3 administration features, add only the operations the module actually
supports:

9. `capabilities-v03`
10. `collection-get` / `collection-preview` / `collection-apply`
11. `import-preview` / `import-apply`
12. `export`

Keep collection schema, archive meaning, generated configuration and rollback
semantics module-owned. The shared core provides typed transport and UX, not
domain logic.

## Phase 2: core import

On a clean task branch:

```text
/path/to/template/scripts/sync-core.sh /path/to/module
/path/to/template/scripts/sync-core.sh --apply /path/to/module
```

Review `webui.lock` and all core changes. Pin the exact template commit and
`CORE_VERSION`; do not build a release candidate from floating `main`.

For Core v0.6.1 or newer, custom WebUI launchers must also preserve the
`--print-url` contract if the module wants embedded KsuWebUI compatibility. The
mode starts the same loopback server, prints exactly one validated bootstrap URL
for the host handoff, and must not open an external browser.

## Phase 3: data separation

Move:

- persistent config and module history to `/data/adb/<module-id>`;
- WebUI PID, token, ready, request, upload and preview files to
  `/data/local/tmp/<module-id>-webui`;
- packaged defaults to `module/config/*.default`.

Do not package live config or runtime JSON. Imported files must remain in the
private WebUI runtime until preview/apply consumes or expires them.

## Phase 4: operation classes

### Read-only

Status, logs, run history and safety facts. Migrate first.

### Settings

Use one complete config object and one atomic adapter update.

### Immediate actions

Declare risk, dry-run support and exact confirmation where required.

### Background jobs

Use for scans, diagnostics, debug bundles, retention and expensive backup work.
Return accurate states rather than fake percentages.

### Inventory

Return normalized columns and items. Use a job to refresh expensive data.

### Typed collections

Use for repeated records such as targets, schedules or rules only when each
field can be explicitly declared and bounded. Require stable identity, preview
before apply, one atomic whole-collection commit and module-owned rollback.
Never turn a collection field into raw command or raw config text.

### Import/export

Use the v0.3 transfer contract when configuration must move between installs or
when the module already owns a backup format.

- default export is secret-safe/redacted;
- browser-supplied filenames never choose device paths;
- preview is read-only;
- import apply requires the same staged file and preview token;
- adapter validates module/schema/archive structure before apply;
- create a pre-import backup before the first productive write;
- credential material is outside generic export.

## Phase 5: tests

Minimum:

- shell syntax;
- Go unit tests;
- WebUI DOM/API contract test;
- local HTTP integration test;
- token absent from argv;
- one-time bootstrap;
- unauthenticated rejection;
- Origin rejection;
- config validation and atomic update;
- action confirmation;
- job lifecycle and output limits;
- typed collection field/identity/count validation when enabled;
- collection preview/apply mismatch rejection when enabled;
- import size/private-path/SHA/preview binding when enabled;
- malformed/wrong-module/traversal/symlink import rejection in the module adapter;
- default export secret/credential exclusion when enabled;
- v0.5 diagnostics snapshot allowlist/redaction and bounded operation history;
- v0.5 dirty-state marking/clearing without cross-transaction save behavior;
- v0.6.1 embedded-host bootstrap validates the installed module path and loopback bootstrap URL and never proxies module operations over the host bridge;
- ZIP contents and permissions;
- ARM64 Android cross-build.

## Phase 6: device proof

Repository tests are not installed runtime proof.

Verify:

- supported battery threshold and power state;
- exact module ZIP identity;
- install and reboot when required;
- Action opens default browser;
- final URL contains no token;
- server binds only to loopback;
- configuration persists across module update;
- jobs finish or time out correctly;
- enabled typed editor round-trips the effective configuration;
- enabled imports show accurate preview and create rollback before apply;
- enabled exports contain only the declared safe data;
- v0.5 Diagnostics exposes only allowlisted redacted state and session-local operation metadata;
- global dirty state follows enabled Settings/Profile/Import drafts and clears only after authoritative success/reload;
- when embedded-host support is enabled, selecting the module in KsuWebUI starts the same loopback session without a false asset-host 404 and without opening a second browser;
- WebUI failure does not affect boot/runtime;
- module-specific rollback works.

## Project order

1. **Boot Watch** — read-only pilot for status, logs and run history.
2. **SSH Drop Dispatcher** — typed controls, diagnostics, then v0.3 target/SSH administration and safe import/export.
3. **Module Reflash Trigger** — background scans, filters and dry-run actions.
4. **Pixel Termux/MX500 Backup** — inventory, retention, locks and restore gates.
5. **Pixel Thermal and other Action modules** — risk acknowledgements, debug jobs and hardware/build readiness.
6. **Pixel Readable Fonts** — converge its already strong browser security model back onto the shared core without weakening its trial state machine.

Each migration is a separate PR with its own device verification and rollback.

## Opting into v0.4 typed async

No migration is required for modules that remain on base-v1 or v0.3. To opt in, implement `capabilities-v04` plus only the declared `job-run-file` operations. Keep parameters typed and bounded and prefer collection-backed references or inventory-bound operations over free-form identifiers, paths or commands.

## Adopting v0.5 observability

No adapter migration is required solely for v0.5. Sync the complete core,
including `observability.js`, `observability.css`, the managed `index.html` and
the observability contract test, then pin the exact `CORE_VERSION=0.5.0`
template commit. Custom WebUI markup must load observability after the race
guard and before `app.js`/optional extension scripts.

The diagnostics layer must remain session-local and redacted. Do not add module
secrets, raw config, logs, job output or arbitrary inventory payloads merely to
make Diagnostics more detailed.

## Adopting v0.6.1 embedded-host bootstrap

No adapter API migration is required. Sync the complete v0.6.1 core, including
`embedded-host-bootstrap.js`, the managed `index.html`, launcher behavior and
verification rules. If the consumer uses a custom launcher, add the fixed
`--print-url` mode without changing its normal Action behavior.

Do not implement a parallel `ksu.exec` adapter for status/config/actions/jobs.
The embedded host is only a launch transport; after redirect, the existing
loopback server remains the single privileged API boundary.
