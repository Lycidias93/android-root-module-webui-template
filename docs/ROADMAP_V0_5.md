# Core v0.5 observability and draft-state contract

Core v0.5 adds browser-session observability and cross-surface draft awareness without changing the server API or adapter command contract.

## Scope

The v0.5 layer is generic and always available when the shared WebUI is loaded:

- one bounded, in-memory operation timeline for typed `/api/v1/` requests;
- one global unsaved-area indicator across base Settings, v0.3 Profiles and v0.3 Imports;
- a Diagnostics tab with core version, draft count, operation metadata and safe raw API snapshots;
- one copyable diagnostics payload;
- one local discard action that reloads the page instead of attempting a multi-transaction save.

No v0.5 adapter capability is required. Base-v1, v0.3 and v0.4 modules remain API-compatible.

## Dirty-state rules

The browser marks only local draft surfaces:

- `settings` after a user edits the base config form;
- `profiles` after a user edits/adds/removes a v0.3 collection record;
- `import` after a user selects a v0.3 import file.

A scope clears only after a request that proves the local draft is no longer pending:

- successful `GET /api/v1/config` clears Settings when authoritative state is reloaded;
- successful `POST /api/v1/config` clears Settings after apply;
- successful `GET /api/v1/v03/collection` clears Profiles because the editor has reloaded authoritative state;
- successful `POST /api/v1/v03/import/apply` clears Import.

The global bar deliberately has no "Save all" operation. Independent adapter transactions are never chained into a false atomic action. `Discard local` reloads the browser session and therefore cannot mutate module state.

## Operation timeline

The timeline stores at most 200 entries. Each entry is limited to:

- timestamp;
- typed operation class;
- HTTP method;
- endpoint path without query parameters;
- HTTP/network result;
- elapsed milliseconds;
- bounded transport error text when the request itself fails.

It does not retain request payloads, response bodies, shell commands, job output, query parameters, cookies, bootstrap/session tokens or arbitrary filesystem paths.

For v0.3 collection requests the implementation may inspect only a bounded prefix of the already-supplied JSON string to classify `mode=preview|apply`; it never parses or persists the record payload.

## Safe raw state

Diagnostics may snapshot only selected JSON responses:

- base capabilities;
- base status;
- base job summaries;
- v0.3 capability declarations;
- v0.4 capability declarations.

Config responses, log text, job output, collection contents, imports, exports and arbitrary inventory rows are excluded.

Snapshots are bounded recursively. Keys matching password, secret, token, credential, cookie, authorization/auth, private-key, API-key or key-material patterns are replaced with `[redacted]`. Adapter authors must still follow the existing requirement to never return secrets under misleading field names.

## Security invariants

v0.5 must not:

- add a new HTTP endpoint;
- change authentication or Origin checks;
- read arbitrary device files;
- execute shell or root-manager bridge commands;
- persist diagnostics in localStorage/sessionStorage or on disk;
- transmit diagnostics off-device;
- record request bodies or response payloads outside the allowlisted safe snapshots;
- expose generic "save all" behavior across independent mutations.

## Compatibility

`CORE_VERSION=0.5.0` is a managed-file change. Consumers should sync the full core manifest and pin the exact template commit. No module adapter migration is required solely for v0.5.

A consumer with custom WebUI markup must retain the script order:

1. `race-guard.js`
2. `observability.js`
3. `app.js`
4. optional `v03.js`
5. optional `v04.js`

This ensures operation observation wraps the guarded fetch path before productive UI requests begin.
