# Architecture

## Runtime path

```text
Module manager action
        |
        v
module/action.sh
        |
        +-- selects the bundled ABI binary
        +-- creates a random session token
        +-- starts the server on 127.0.0.1:0
        +-- waits for an atomic state file
        +-- opens the system browser
        v
webui-server
        |
        +-- serves module/webroot
        +-- verifies loopback peer, Host, Origin and token
        +-- accepts only fixed API routes
        v
module/bin/module-control
        |
        +-- validates keys, values and actions again
        +-- performs atomic configuration updates
        +-- returns bounded JSON or log text
```

## Separation of responsibilities

- `action.sh`: lifecycle and browser launch only.
- `webui-server`: HTTP security, request validation, size limits and fixed dispatch.
- `module-control`: module-specific root operations.
- `webroot`: unprivileged UI; it never constructs shell commands.
- module boot scripts: independent of the WebUI.

## Failure behavior

If the server binary is missing, unsupported, or fails to start, the module action exits with an error. The installed module continues operating normally.

The WebUI server is not started by `service.sh`.

## ABI policy

The initial build lane ships `arm64-v8a`, matching current Pixel-class devices. Adding x86_64 or 32-bit Android targets requires an NDK-backed cgo lane and is intentionally not faked with generic Linux binaries.
