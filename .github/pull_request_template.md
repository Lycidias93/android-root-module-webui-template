## What changed

## Why

## Modules/workflows enabled by this change

## User impact

## Security impact

- [ ] Listener remains exact `127.0.0.1`
- [ ] Bootstrap token is absent from argv
- [ ] One-time bootstrap and HttpOnly cookie remain enforced
- [ ] Mutations require exact Origin and `X-WebUI-Request`
- [ ] No arbitrary shell or unrestricted path endpoint was added
- [ ] New config/actions/jobs/inventories are declared and validated twice
- [ ] WebUI remains optional and Action-triggered

## Validation

- [ ] `./scripts/verify.sh`
- [ ] `python3 scripts/webui-release-audit.py --self-test`
- [ ] `./scripts/build.sh`
- [ ] build manifest reviewed
- [ ] exact ZIP installed on supported test device when runtime behavior changed

## Release audit

Required before publishing any candidate that changes HTTP handling, WebUI, WebUI Core/server/static assets, embedded-host bootstrap, API/schema behavior, or a WebUI-backed module adapter.

- [ ] `python3 scripts/webui-release-audit.py` reports `verdict=pass`, `failure_count=0`, and `WEBUI_RELEASE_AUDIT_STATIC_PASS`
- [ ] every shipped page-referenced script/stylesheet is HTTP-reachable on the exact candidate
- [ ] exact installed candidate passes the consumer's repo-owned WebUI device audit
- [ ] enabled Settings passes a safe `GET -> POST -> GET/effective-state` round-trip
- [ ] enabled actions/jobs/inventories and dirty/review/discard/diagnostics controls are covered by live safe checks or bounded fixtures
- [ ] candidate/template/adapter bytes did not change after the accepted audit

## Documentation and provenance

- [ ] API/architecture/security docs updated
- [ ] `CORE_VERSION` updated when required
- [ ] Credits, NOTICE, UPSTREAMS and licenses updated when required
- [ ] migration impact documented
- [ ] release-audit impact documented when HTTP/WebUI surfaces changed

## Rollback

State the previous commit, affected persistent data, and device rollback path.
