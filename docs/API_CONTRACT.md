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

## Configuration

### `GET /api/v1/config`

Adapter source: `module-control config-get`

Returns one object containing exactly the declared fields.

### `POST /api/v1/config`

The server validates the complete object and invokes:

```text
module-control config-apply <private-request-file>
```

Adapters must perform one atomic whole-config update. Partial multi-command
writes are not the contract.

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
adapter repeats those checks.

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

## Mutation headers

All POST requests require:

```text
Origin: http://127.0.0.1:<active-port>
Content-Type: application/json
X-WebUI-Request: 1
```

The browser sends the session cookie automatically with same-origin requests.
