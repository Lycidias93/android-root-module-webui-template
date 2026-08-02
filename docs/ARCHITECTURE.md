# Architecture

## Boundaries

The foundation has three independent layers:

1. **Core transport** — launcher, native server, authentication and HTTP API.
2. **Generic presentation** — capability-driven offline HTML, CSS and JavaScript.
3. **Module adapter** — module-owned `module-control` implementation and runtime.

The core can be synchronized between projects. The adapter must remain in the
individual module repository because it owns module semantics and risk.

## Storage model

| Path | Lifetime | Contents |
|---|---|---|
| `/data/adb/modules/<id>` | Replaceable on module update | Packaged code, defaults, server and UI |
| `/data/adb/<id>` | Persistent | Validated config, module logs and module-owned state |
| `/data/local/tmp/<id>-webui` | Ephemeral | PID, ready file, token file and staged request files |

Session tokens, request files and server PID files must never be stored in the
persistent state tree or packaged ZIP.

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

Mutations additionally require:

- authenticated cookie;
- exact `Origin`;
- `Content-Type: application/json`;
- `X-WebUI-Request: 1`;
- bounded body;
- strict JSON decoding;
- declared capability and server-side validation;
- adapter-side validation.

## Capability schema

`module-control capabilities` is loaded before the listener starts. Invalid or
duplicate config keys, action names, jobs or inventories fail startup.

The document is the contract between adapter and UI. It does not grant arbitrary
execution; the server still has fixed route and subcommand allowlists.

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

## Actions

Actions are declared with:

- name and label;
- risk: `safe`, `caution`, or `danger`;
- optional dry-run support;
- optional exact confirmation text.

The server rejects undeclared actions and mismatched confirmations before the
adapter runs. The adapter repeats all safety checks.

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
- Removing or updating the module removes packaged WebUI code but leaves
  persistent state untouched unless the module explicitly provides a separately
  confirmed cleanup action.
