# API contract

Base path: `/api/v1`

All endpoints except `health` and `bootstrap` require the session cookie.

## Bootstrap

### `GET /bootstrap?token=<one-time-token>`

Successful response:

- deletes token file;
- sets HttpOnly session cookie;
- redirects with `303` to `/`.

The token cannot be reused.

## Health

### `GET /api/v1/health`

Returns only service liveness and no module data.

## Capabilities

### `GET /api/v1/capabilities`

Adapter source: `module-control capabilities`

Schema identifier:

```text
root-module-webui.capabilities.v1
```

The document declares module identity, feature switches, config fields, actions,
jobs and inventories. Names must match `[a-z][a-z0-9._-]{0,63}`.

Supported config types:

- `boolean`
- `integer` with optional `min` and `max`
- `string` with optional `required`, `max_length`, `pattern`, and `secret`
- `enum` with explicit value/label options

Supported action and job risk levels:

- `safe`
- `caution`
- `danger`

Feature switches also control frontend visibility. A feature set to `false`
hides its navigation tab and panel, which lets read-only modules reuse the same
frontend without empty settings or action views.

## Status

### `GET /api/v1/status`

Adapter source: `module-control status`

The response is module-defined valid JSON. Recommended top-level keys:

- `ok`
- `module`
- `summary`
- `config`
- `runtime`
- `safety`
- `health`
- `readiness`

`summary` is optional and allows adapters to define the Overview cards without
forking the shared frontend:

```json
[
  {"label":"Result","value":"PASS","level":"good"},
  {"label":"Run ID","value":"20260802_230000_boot","level":"muted"}
]
```

Supported `level` values are `good`, `caution`, `danger`, and `muted`.
Adapters should report safety facts as positive assertions whose healthy value
is `true`, for example `arbitrary_shell_blocked=true`.

### Secret configured-state convention

A config field declared with `secret:true` remains write-only: its value must not
be returned by `config-get`, status, logs or exports. When useful, an adapter may
expose only a non-secret configured indicator under:

```text
status.runtime.<field_key>_configured
```

Accepted truthy representations in the shared UI are boolean/numeric truth or
`yes`, `true`, `1`, or `configured`. The UI renders only configured/not-configured
state and never reconstructs, masks, fingerprints or displays the secret value.
This convention is optional and does not change the configuration request schema.

## Configuration

### `GET /api/v1/config`

Adapter source: `module-control config-get`

Returns one object containing exactly the declared fields. Secret/write-only
fields may therefore be returned as empty placeholders while their configured
state is separately reported through the optional status convention above.

### `POST /api/v1/config`

The server validates the complete object and invokes:

```text
module-control config-apply <private-request-file>
```

Adapters must perform one atomic whole-config update. Partial multi-command
writes are not the contract. If an adapter defines empty secret input as
`preserve existing`, that behavior is module-owned and must be documented by the
field description; the shared core does not infer or read the secret.

## Logs

### `GET /api/v1/log?lines=1..1000`

Adapter source:

```text
module-control log <validated-line-count>
```

Output is bounded plain text. Adapters must select approved sources and redact
secrets before returning content.

## Actions

### `POST /api/v1/action`

Request:

```json
{
  "name": "declared-action",
  "dry_run": true,
  "confirmation": "optional exact text"
}
```

Adapter invocation:

```text
module-control action-file <declared-action> <private-request-file>
```

The server enforces declaration, dry-run support and exact confirmation. The
shared UI may additionally keep the action button disabled until the declared
confirmation text matches, but server enforcement remains authoritative. The
adapter repeats domain validation and may repeat the confirmation check when it
is part of the module operation contract.

## Jobs

### `POST /api/v1/jobs`

```json
{"name":"declared-job"}
```

Returns `202` with a random job record.

### `GET /api/v1/jobs`

Lists jobs retained in the current WebUI session.

### `GET /api/v1/jobs/<id>`

Returns lifecycle, timestamps, exit code, error and output sizes.

### `GET /api/v1/jobs/<id>/output`

Query parameters:

- `stream=stdout|stderr`
- `offset=0..262144`
- `limit=1..65536`

Adapter invocation:

```text
module-control job-run <declared-job>
```

The server owns IDs, timeout, concurrency and output limits.

## Inventory

### `GET /api/v1/inventory?name=<declared-inventory>`

Adapter invocation:

```text
module-control inventory <declared-inventory>
```

Recommended response:

```json
{
  "ok": true,
  "name": "backups",
  "columns": ["name", "state", "detail"],
  "items": [
    {"name": "example", "state": "ready", "detail": "verified"}
  ]
}
```

Inventories are read-only. Use jobs for expensive refreshes or mutations.

## v0.3 typed administration extension

The v0.3 core adds an optional extension capability document. Existing adapters
that do not implement it continue to use the v1 endpoints above; `/v03.js`
quietly disables the additional tabs when the extension is absent.

### `GET /api/v1/v03/capabilities`

Adapter source:

```text
module-control capabilities-v03
```

Extension schema:

```text
root-module-webui.extensions.v1
```

The module ID must exactly match the base capability document. The extension
may declare:

- `collections`: repeated typed records such as profiles, schedules or rules;
- `imports`: bounded named import formats;
- `exports`: bounded named export formats;
- feature switches `collections` and `transfer`.

Collection fields reuse `boolean`, `integer`, `string` and `enum` semantics and
add `export_policy` metadata: `public`, `reference`, `secret`, or
`credential_material`. Credential material is never eligible for generic
export.

### `GET /api/v1/v03/collection?name=<declared-collection>`

Adapter invocation:

```text
module-control collection-get <declared-collection>
```

The adapter returns the current typed records. Stable identity, maximum record
count and fields are declared in the extension capability document.

### `POST /api/v1/v03/collection`

Preview request:

```json
{
  "name": "profiles",
  "mode": "preview",
  "records": []
}
```

Apply request:

```json
{
  "name": "profiles",
  "mode": "apply",
  "records": [],
  "preview_token": "server-issued-token",
  "confirmation": "optional exact text"
}
```

The server validates every record and field. Preview invokes:

```text
module-control collection-preview <declared-collection> <private-request-file>
```

A successful preview creates a short-lived server-side token bound to the
canonical collection payload. Apply is rejected unless that exact payload has a
matching unexpired preview token and any declared exact confirmation succeeds.
The shared UI also invalidates its local preview state after edits and keeps
Apply disabled until the current preview token and exact confirmation are both
present. Server validation remains authoritative. Apply invokes:

```text
module-control collection-apply <declared-collection> <private-request-file>
```

The adapter revalidates the typed payload, creates module-specific rollback
state before the first productive write, commits the whole collection
atomically, and reports verification/rollback state. Browser-driven partial
shell/config writes are outside the contract.

### `POST /api/v1/v03/import?name=<declared-import>`

The request body is the import file itself. Supported generic media are bounded
JSON or ZIP payloads. The server:

- enforces the declaration-specific byte limit, capped by the core maximum;
- creates the filename in the private WebUI runtime directory;
- never derives a device path from the uploaded filename;
- computes SHA-256;
- invokes only the declared adapter import:

```text
module-control import-preview <declared-import> <private-upload-file>
```

The consuming adapter must reject malformed schema/module IDs, traversal,
symlinks and undeclared archive members before preview succeeds. Preview is
read-only.

### `POST /api/v1/v03/import/apply`

```json
{
  "name": "config",
  "preview_token": "server-issued-token",
  "confirmation": "optional exact text"
}
```

The server rechecks the staged regular file, private-directory containment,
size and SHA-256 before invoking:

```text
module-control import-apply <declared-import> <private-upload-file> <private-request-file>
```

A module adapter must create its rollback/pre-import backup before the first
productive write, apply atomically, and verify the resulting effective state.
Successful apply consumes the staged upload and preview token. The shared UI
keeps Apply disabled until a fresh preview and any declared exact confirmation
are both present.

### `POST /api/v1/v03/export`

```json
{
  "name": "config",
  "confirmation": "optional exact text"
}
```

Adapter invocation:

```text
module-control export <declared-export>
```

The server accepts only declared `json` or `zip` exports with bounded output.
Generic export policy is restricted to `redacted` or `reference`. The adapter
must generate the export from typed/domain-owned data rather than expose an
arbitrary file path. Private-key bytes, tokens and credential material are not
a generic export mode.

See [Import/export contract](IMPORT_EXPORT_CONTRACT_V1.md) for the design and
adapter responsibilities.

## Mutation headers

All JSON POST requests require:

```text
Origin: http://127.0.0.1:<active-port>
Content-Type: application/json
X-WebUI-Request: 1
```

The browser sends the session cookie automatically with same-origin requests.
The v0.3 import-preview upload endpoint uses the same exact Origin and
`X-WebUI-Request` guard but accepts only declared bounded JSON/ZIP/octet-stream
payload media instead of a JSON control request.
