# WebUI core v0.4 typed async contract

Status: implementation track

## Goal

Core v0.4 adds reusable UI/server primitives for bounded asynchronous workflows without creating an arbitrary command, path or filesystem channel.

The motivating consumers include SSH Drop Dispatcher Return Channel work, backup/restore workflows, diagnostic collectors and other modules that need an operator to select a known object and start a declared background operation.

## Generic primitives

### Typed parameterized jobs

A module may expose `capabilities-v04` with schema `root-module-webui.extensions.v2` and declared background jobs.

Each job may declare bounded parameters using:

- `boolean`
- `integer`
- `string`
- `enum`
- `reference`

The browser sends one typed JSON request. The server validates it, stages a private request file and invokes only:

```text
module-control job-run-file <declared-job> <server-created-private-request-file>
```

Browser values never become argv command fragments or arbitrary shell text.

### Active-job dedupe

Jobs may declare `dedupe_keys`. If an identical declared identity is already queued/running, the server returns the existing job rather than creating a second mutation.

Dedupe is session-local and never turns a completed job into a permanent cache.

### Collection-backed references

A v0.4 `reference` points to the identity field of an already declared v0.3 typed collection. The server resolves current identities through `collection-get` before accepting a referenced parameter.

This is intended for domain-neutral relations such as:

- target profile → target identity
- restore job → known backup identity
- return collection job → known return identity

It is not a generic filesystem picker, SSH-config editor or path browser.

### Inventory-bound operations

A module may declare an operation that binds:

1. one existing read-only inventory;
2. one stable identity field in that inventory;
3. one declared typed job;
4. one declared job parameter.

Before launch the server refreshes the inventory and proves that the requested item identity is still present. Only the stable identity is forwarded to the job request file.

This prevents stale browser rows from becoming arbitrary adapter inputs.

### Honest async UX

The shared frontend:

- reports queued/running/success/failed state without fake percentage progress;
- shows declared phase vocabulary only as a workflow description, not as fabricated runtime progress;
- polls with bounded backoff;
- pauses polling while the document is hidden;
- reuses an active deduplicated job rather than launching duplicates.

## Timeout alignment

The normal status endpoint and server self-test use the same named status-control timeout. Self-test must never kill an adapter that is still within the status runtime contract.

Action, inventory and background-job deadlines remain separate.

## Security invariants

Core v0.4 preserves:

- loopback-only server;
- one-time bootstrap and HttpOnly session;
- exact same-origin mutation guard;
- bounded JSON and output;
- declared adapter operation names only;
- private server-created request paths;
- no arbitrary command input;
- no arbitrary filesystem path input;
- no secret reconstruction in the browser;
- adapter/domain revalidation remains mandatory.

## Consumer rules

Consumers pin an exact template commit and `CORE_VERSION`.

A consumer that adds module-specific job phases, return states, target schemas, backup semantics or verification rules keeps those semantics in its adapter. Only the typed request/job/inventory/reference transport belongs to the shared core.

## Acceptance

Required tests include:

- capability declaration validation;
- parameter type/bounds/pattern checks;
- stable active-job dedupe;
- private request-file lifecycle;
- stale inventory identity rejection;
- reference lookup through declared collections;
- timeout alignment regression;
- frontend static contract for v0.4 endpoint use and visibility-aware polling;
- existing v0.3 collection/import/export and base v1 tests unchanged.

Acceptance marker:

```text
RESULT: WEBUI_CORE_V04_TYPED_ASYNC_CONTRACT_PASS
```
