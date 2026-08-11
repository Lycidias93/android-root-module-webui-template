# Architecture

## Boundaries

The foundation has three independent layers:

1. **Core transport** — launcher, native server, authentication and HTTP API.
2. **Generic presentation** — capability-driven offline HTML, CSS and JavaScript.
3. **Module adapter** — module-owned `module-control` implementation and runtime.

The core can be synchronized between projects. The adapter must remain in the
individual module repository because it owns module semantics and risk.

v0.3 keeps this boundary while adding optional generic administration
primitives. The core understands typed collections, bounded import/export and
preview/apply state, but it still does not understand SSH, schedules, backup
archive meaning or another module domain.

## Storage model

| Path | Lifetime | Contents |
|---|---|---|
| `/data/adb/modules/<id>` | Replaceable on module update | Packaged code, defaults, server and UI |
| `/data/adb/<id>` | Persistent | Validated config, module logs and module-owned state |
| `/data/local/tmp/<id>-webui` | Ephemeral | PID, ready/token/request files plus v0.3 uploads and preview state |

Session tokens, request/upload/preview files and server PID files must never be
stored in the persistent state tree or packaged ZIP. Module-owned rollback
backups belong in the persistent module state tree, not in the WebUI runtime.

## Authentication

1. `action.sh` creates a random 64-hex-character token in a mode-0600 file.
2. The server reads the file and generates an independent random session value.
3. Android opens `/bootstrap?token=...`.
4. The server performs constant-time comparison and permits exactly one use.
5. The token file is deleted.
6. The browser receives an HttpOnly, SameSite=Lax cookie.
7. The browser is redirected to `/`, removing the token from the final URL.

The server command line contains only paths and bounded settings, never tokens.

## Request protection

All requests must come from a loopback peer and use the exact
`127.0.0.1:<dynamic-port>` Host header.

JSON mutations additionally require:

- authenticated cookie;
- exact `Origin`;
- `Content-Type: application/json`;
- `X-WebUI-Request: 1`;
- bounded body;
- strict JSON decoding;
- declared capability and server-side validation;
- adapter-side domain validation.

The v0.3 import-preview endpoint uses the same authenticated Origin/request
guard but accepts only bounded declared JSON/ZIP/octet-stream upload media. The
server creates the private upload filename; browser filenames never become
device paths.

## Capability schemas

`module-control capabilities` is loaded before the listener starts. Invalid or
duplicate config keys, action names, jobs or inventories fail startup.

Base schema:

```text
root-module-webui.capabilities.v1
```

Optional v0.3 administration schema:

```text
root-module-webui.extensions.v1
```

The extension is queried through `module-control capabilities-v03`. Absence is
not a startup failure; it means the module does not enable typed collection or
transfer tabs. If present, its module ID must match the base capability document
and every collection/import/export definition is validated before use.

Capability documents are contracts between adapter and UI. They do not grant
arbitrary execution; the server still has fixed routes and subcommand
allowlists.

## Configuration

The browser submits one complete configuration object. The server validates it
against declared fields, writes a private request file, and invokes
`config-apply`.

The adapter must:

- accept only a request file under the private runtime directory;
- reject symlinks and oversized files;
- revalidate all required values;
- acquire its own lock;
- write one complete replacement file;
- set restrictive permissions;
- atomically rename it into persistent state.

## Typed collections

A collection is a repeated set of typed records with a stable declared identity
and a bounded record count.

Preview flow:

1. browser submits the whole edited collection;
2. server validates every declared field and identity;
3. server writes a canonical private request file;
4. adapter receives `collection-preview` and returns a read-only planned change;
5. server issues a short-lived token bound to the canonical record payload.

Apply flow:

1. browser resubmits the same records plus preview token and any exact confirmation;
2. server rejects any payload mismatch or expired preview;
3. adapter receives one whole-collection `collection-apply` request;
4. adapter revalidates domain invariants, creates rollback state, commits atomically and verifies effective state.

The browser cannot submit partial shell/config writes and cannot introduce
undeclared record fields.

## Import/export

Import preview stages a bounded file only in the private WebUI runtime, computes
SHA-256 and passes its server-generated path to one declared adapter operation.
The adapter validates file format, module/schema identity and archive contents
without productive mutation.

Import apply requires the same preview token and rechecks:

- private runtime containment;
- regular-file/no-symlink state;
- byte limit;
- SHA-256 equality.

The adapter then owns pre-import backup, atomic application, verification and
rollback.

Export never accepts a browser-selected device path. A declared adapter export
returns bounded JSON or ZIP bytes directly. Generic export policy permits only
redacted or safe-reference data; credential material remains outside the generic
core.

## Actions

Actions are declared with:

- name and label;
- risk: `safe`, `caution`, or `danger`;
- optional dry-run support;
- optional exact confirmation text.

The server rejects undeclared actions and mismatched confirmations before the
adapter runs. The adapter repeats domain safety checks.

## Jobs

The Go server owns:

- random job IDs;
- concurrency limit;
- timeout;
- state transitions;
- bounded stdout and stderr;
- session-local retention.

The adapter receives only `job-run <declared-name>`. It cannot select its own job
ID or output paths. Active jobs prevent idle shutdown.

For work that must survive WebUI shutdown or reboot, the module adapter should
handoff to its existing durable runtime and return a durable operation ID in
job output. The browser server itself remains ephemeral.

## Inventory

Inventories are typed, read-only JSON responses selected only by a declared
name. Expensive remote scans should be represented as jobs and should populate a
bounded module-owned cache that the inventory endpoint reads.

## Failure isolation

- The server is never started by `service.sh`.
- Failure to launch the browser does not change module state.
- Failed/expired v0.3 previews do not authorize later apply.
- WebUI upload/runtime files are disposable and are not module state.
- Removing or updating the module removes packaged WebUI code but leaves persistent state untouched unless the module explicitly provides a separately confirmed cleanup action.
