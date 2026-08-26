# WebUI release audit

Any release candidate that changes HTTP handling, the standalone WebUI, WebUI Core, server routes, static assets, embedded-host bootstrap behavior, API/schema behavior, or a module adapter used by the WebUI must pass the WebUI release audit before publication.

This is a release gate, not a replacement for ordinary unit/integration tests or device installation verification. Package/install/postboot acceptance alone does not prove that browser controls work.

## Gate A — repository and HTTP contract

Run against the exact candidate commit:

```text
./scripts/verify.sh
python3 scripts/webui-release-audit.py
./scripts/build.sh
```

`webui-release-audit.py` checks the HTTP-serving contract that static HTML tests cannot prove by themselves. Every local script/stylesheet referenced by `module/webroot/index.html` must have a server route, and the integration test must retain bootstrap, status, config round-trip, action, jobs, inventory, authentication, and Origin-rejection coverage.

Required result:

```text
verdict=pass
failure_count=0
RESULT: WEBUI_RELEASE_AUDIT_STATIC_PASS outcome=success workflow_exit_code=0
```

A successful process that reports `verdict=fail` is not accepted. A missing route, 404 asset, failed config POST, adapter error, or incomplete integration contract blocks the release.

## Gate B — exact installed candidate

For Android/root-module releases, install the exact candidate package and run a repo-owned, read-only or isolated-state device audit against the installed bytes. The audit is module-specific at the adapter boundary, but must cover every enabled WebUI surface.

Minimum matrix:

1. exact installed version/package identity and postboot state when applicable;
2. loopback server start, bootstrap/session establishment, health and authenticated root page;
3. HTTP GET for every script and stylesheet referenced by the shipped page; no referenced asset may return 404;
4. enabled API routes with their expected success/disabled status;
5. Settings `GET -> validated POST -> GET/effective-state` using isolated temporary state unless the release acceptance explicitly authorizes a harmless production mutation;
6. adapter request-path validation, lock/serialization behavior and cleanup after success/failure;
7. UI wiring for refresh, save, logs, inventories, actions/jobs, dirty-state review/discard and diagnostics;
8. safe actions/jobs/inventories exercised live where they are read-only; productive/dangerous controls covered by safe fixtures or bounded dispatch verification unless explicitly approved for live execution;
9. bounded backend error capture sufficient to classify a failed operation instead of reporting only a generic browser error;
10. `evidence_collection=complete`, `verdict=pass`, `failure_count=0`, and a stable candidate-bound result marker.

The audit must bind its evidence to the exact candidate package/installed runtime. Rebuilding, changing the template pin, changing adapter/server/static bytes, or changing a release candidate after the audit invalidates that acceptance and requires a fresh audit.

## Release boundary

A release touching the WebUI/HTTP surfaces above is not release-ready until both gates are green. The final release-readiness summary should record:

- candidate commit and package identity;
- WebUI Core/template pin when used;
- repository audit result;
- installed/device audit result;
- HTTP asset-route result;
- Settings round-trip result when config is enabled;
- stable result marker and evidence location.

No tag, release, or update-channel promotion should be published from a candidate with a missing/failed WebUI audit.

## Consumer integration

Consumers that synchronize this template should keep `scripts/webui-release-audit.py` with the core and include this release gate in their own release checklist/CI. Module-specific adapter assertions remain in the consumer repository; reusable HTTP/static/server checks belong here in the shared template.
