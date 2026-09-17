# ntfy Notifications Contract V1

Core 0.7.0 standardizes optional notifications without turning WebUI into a secret store.

## Capability

Enable `features.notifications=true` and declare provider `ntfy`, `supports_test`, and a lifecycle subset of `start`, `success`, `fail`, `warn`. Consumers that do not enable it retain the previous API/UI.

## HTTP contract

`GET /api/v1/notifications/status` accepts only schema `root-module-webui.notifications.status.v1`: provider, enabled flag, non-secret source/mode, configured booleans and lifecycle names. `POST /api/v1/notifications/test` is same-origin/request-guard protected and accepts only schema `root-module-webui.notifications.test.v1`: provider, sent boolean and reason token. Unknown adapter fields are rejected.

## Shared helper

`module/lib/ntfy.sh` understands `NTFY_ENABLED`, `NTFY_URL`, `NTFY_TOPIC`, `NTFY_TOKEN_FILE`, `NTFY_PRIORITY`, and `NTFY_TAGS`. The allowlisted loader never sources/evaluates the input file. Delivery is bounded and returns a non-secret state; consumers must treat failure as non-fatal. Tests use a fake transport with no external network.
