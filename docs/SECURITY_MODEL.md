# Security model

## Protected assets

The WebUI may read or modify privileged module state. The security design
protects against access from another local app, browser origin, network peer,
malformed request, unsafe adapter extension and accidental secret packaging.

## Enforced invariants

### Network

- IPv4 listener is exactly `127.0.0.1`.
- Dynamic port is selected by the kernel.
- Host header must exactly match the active loopback address and port.
- Remote peer must be loopback.
- No external listener fallback exists.

### Session

- Bootstrap token is random and stored mode `0600`.
- Token is not passed in argv.
- Bootstrap is one use.
- Token file is removed after successful exchange and at server exit.
- Session cookie is random, HttpOnly and SameSite=Lax.
- Final browser URL is clean.
- Responses are non-cacheable and use `Referrer-Policy: no-referrer`.

### Browser

- Strong Content Security Policy.
- No inline scripts or remote assets.
- No root-manager exec bridge in the core UI.
- No generic shell or path endpoint.
- Mutations require exact Origin and `X-WebUI-Request: 1`.

### Input

- Request body and output limits.
- Unknown JSON fields rejected.
- Config fields validated from a trusted startup schema.
- Actions, jobs and inventories must be declared.
- Request files are private, short-lived and server-created.
- Adapter repeats validation and atomic-write checks.

### Process

- Server is Action-triggered only.
- PID cleanup verifies process identity.
- Idle shutdown pauses while jobs are active.
- Job concurrency and duration are bounded.
- Persistent module runtime is independent from WebUI availability.

## Adapter review checklist

Before adding an operation:

1. Define a narrow capability with a stable name.
2. Assign the correct risk.
3. Add dry-run for consequential operations.
4. Add readiness reasons rather than a single boolean where applicable.
5. Require exact confirmation for destructive work.
6. Revalidate everything in the adapter.
7. Reject unrestricted paths.
8. Redact secrets from status, logs, job output and inventory.
9. Bound output and external waits.
10. Add unit, contract and integration tests.

## Secret handling

Prefer references to existing protected secret files. Do not return secret
contents to the browser. A UI can show only:

- configured/not configured;
- protected file path when safe;
- last test result;
- non-sensitive metadata.

Never package live configuration, tokens, SSH keys, ntfy topics, private
hostnames, personal paths or runtime logs.

## High-risk workflows

Backup deletion, restore, module reflashing and performance tuning require
additional module-specific contracts:

- preview or dry-run;
- exact candidate set;
- readiness reasons;
- lock ownership;
- protected rollback or pre-action backup;
- exact text confirmation;
- post-action verification.

The generic core supplies the mechanism but cannot prove module-specific safety.

## Unsupported changes

Do not merge a change that:

- adds `0.0.0.0`, `localhost`, IPv6 or configurable bind addresses;
- transmits secrets in argv, URL after bootstrap, logs or JavaScript storage;
- accepts command strings from JavaScript;
- weakens mutation Origin checks;
- runs the server permanently;
- uses remote scripts, fonts, analytics or CDN assets;
- silently adds unbuilt ABI branches;
- turns WebUI success into a boot requirement.
