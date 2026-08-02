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
- [ ] `./scripts/build.sh`
- [ ] build manifest reviewed
- [ ] exact ZIP installed on supported test device when runtime behavior changed

## Documentation and provenance

- [ ] API/architecture/security docs updated
- [ ] `CORE_VERSION` updated when required
- [ ] Credits, NOTICE, UPSTREAMS and licenses updated when required
- [ ] migration impact documented

## Rollback

State the previous commit, affected persistent data, and device rollback path.
