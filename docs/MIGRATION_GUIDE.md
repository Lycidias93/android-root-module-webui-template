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
- secret-bearing values;
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

## Phase 2: core import

On a clean task branch:

```text
/path/to/template/scripts/sync-core.sh /path/to/module
/path/to/template/scripts/sync-core.sh --apply /path/to/module
```

Review `webui.lock` and all core changes.

## Phase 3: data separation

Move:

- persistent config and module history to `/data/adb/<module-id>`;
- WebUI PID, token, ready and request files to
  `/data/local/tmp/<module-id>-webui`;
- packaged defaults to `module/config/*.default`.

Do not package live config or runtime JSON.

## Phase 4: operation classes

### Read-only

Status, logs, run history and safety facts. Migrate first.

### Settings

Use one complete config object and one atomic adapter update.

### Immediate actions

Declare risk, dry-run support and exact confirmation where required.

### Background jobs

Use for scans, diagnostics, debug bundles, retention, backup and restore.
Return accurate states rather than fake percentages.

### Inventory

Return normalized columns and items. Use a job to refresh expensive data.

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
- WebUI failure does not affect boot/runtime;
- module-specific rollback works.

## Project order

1. **Boot Watch** — read-only pilot for status, logs and run history.
2. **SSH Drop Dispatcher** — typed controls and diagnostics.
3. **Module Reflash Trigger** — background scans, filters and dry-run actions.
4. **Pixel Termux/MX500 Backup** — inventory, retention, locks and restore gates.
5. **Pixel Thermal and other Action modules** — risk acknowledgements, debug jobs
   and hardware/build readiness.
6. **Pixel Readable Fonts** — converge its already strong browser security model
   back onto the shared core without weakening its trial state machine.

Each migration is a separate PR with its own device verification and rollback.
