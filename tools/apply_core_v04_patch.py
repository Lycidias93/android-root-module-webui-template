#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, value):
    (ROOT / path).write_text(value, encoding="utf-8")


def replace_once(path, old, new):
    value = read(path)
    count = value.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one match in {path}, got {count}: {old[:80]!r}")
    write(path, value.replace(old, new, 1))


def append_once(path, marker, block):
    value = read(path)
    if marker in value:
        return
    if not value.endswith("\n"):
        value += "\n"
    write(path, value + "\n" + block.strip() + "\n")


main = "server/cmd/webui-server/main.go"
replace_once(
    main,
    '\trequestGuardHeader = "X-WebUI-Request"\n)',
    '\trequestGuardHeader = "X-WebUI-Request"\n\tstatusControlTimeout = 15 * time.Second\n)',
)
replace_once(
    main,
    '''\tif selfTest {\n\t\tctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)\n\t\tdefer cancel()\n\t\tif _, err := app.runControl(ctx, maxControlOutput, "status"); err != nil {\n\t\t\tlogger.Fatalf("status self-test: %v", err)\n\t\t}\n\t\tif _, err := app.runControl(ctx, maxControlOutput, "config-get"); err != nil && app.capabilities.Features["config"] {\n\t\t\tlogger.Fatalf("config self-test: %v", err)\n\t\t}\n\t\tfmt.Printf("service=webui-server\\nversion=%s\\ncapability_schema=%s\\nmodule_id=%s\\nRESULT: WEBUI_SERVER_SELF_TEST_PASS\\n",\n\t\t\tversion, app.capabilities.Schema, app.capabilities.Module.ID)\n\t\treturn\n\t}\n''',
    '''\tif selfTest {\n\t\tstatusCtx, statusCancel := context.WithTimeout(context.Background(), statusControlTimeout)\n\t\tif _, err := app.runControl(statusCtx, maxControlOutput, "status"); err != nil {\n\t\t\tstatusCancel()\n\t\t\tlogger.Fatalf("status self-test: %v", err)\n\t\t}\n\t\tstatusCancel()\n\t\tif app.capabilities.Features["config"] {\n\t\t\tconfigCtx, configCancel := context.WithTimeout(context.Background(), 10*time.Second)\n\t\t\tif _, err := app.runControl(configCtx, maxControlOutput, "config-get"); err != nil {\n\t\t\t\tconfigCancel()\n\t\t\t\tlogger.Fatalf("config self-test: %v", err)\n\t\t\t}\n\t\t\tconfigCancel()\n\t\t}\n\t\tfmt.Printf("service=webui-server\\nversion=%s\\ncapability_schema=%s\\nmodule_id=%s\\nRESULT: WEBUI_SERVER_SELF_TEST_PASS\\n",\n\t\t\tversion, app.capabilities.Schema, app.capabilities.Module.ID)\n\t\treturn\n\t}\n''',
)
replace_once(
    main,
    '''func (a *application) status(w http.ResponseWriter, r *http.Request) {\n\tif r.Method != http.MethodGet {\n\t\tmethodNotAllowed(w, http.MethodGet)\n\t\treturn\n\t}\n\tctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)''',
    '''func (a *application) status(w http.ResponseWriter, r *http.Request) {\n\tif r.Method != http.MethodGet {\n\t\tmethodNotAllowed(w, http.MethodGet)\n\t\treturn\n\t}\n\tctx, cancel := context.WithTimeout(r.Context(), statusControlTimeout)''',
)
replace_once(main, '\tregisterV03Handlers(mux, app)\n', '\tregisterV03Handlers(mux, app)\n\tregisterV04Handlers(mux, app)\n')

replace_once(
    "module/webroot/index.html",
    '  <script src="/v03.js"></script>\n',
    '  <script src="/v03.js"></script>\n  <script src="/v04.js"></script>\n',
)

write("CORE_VERSION", "0.4.0\n")

manifest = read("core/manifest.txt")
for entry in [
    "module/webroot/v04.js",
    "server/cmd/webui-server/v04.go",
    "server/cmd/webui-server/v04_test.go",
    "scripts/webui-v04-static.test.py",
]:
    if entry not in manifest.splitlines():
        manifest += entry + "\n"
write("core/manifest.txt", manifest)

verify = "scripts/verify.sh"
replace_once(verify, '  module/webroot/v03.js\n', '  module/webroot/v03.js\n  module/webroot/v04.js\n')
replace_once(verify, '  server/cmd/webui-server/v03_test.go\n', '  server/cmd/webui-server/v03_test.go\n  server/cmd/webui-server/v04.go\n  server/cmd/webui-server/v04_test.go\n')
replace_once(verify, '  docs/PATTERN_LIBRARY.md\n', '  docs/PATTERN_LIBRARY.md\n  docs/ROADMAP_V0_4.md\n')
replace_once(verify, "grep -Fq 'registerV03Handlers(mux, app)' server/cmd/webui-server/main.go\n", "grep -Fq 'registerV03Handlers(mux, app)' server/cmd/webui-server/main.go\ngrep -Fq 'registerV04Handlers(mux, app)' server/cmd/webui-server/main.go\ngrep -Fq 'statusControlTimeout' server/cmd/webui-server/main.go\n")
replace_once(verify, "grep -Fq 'root-module-webui.extensions.v1' server/cmd/webui-server/v03.go\n", "grep -Fq 'root-module-webui.extensions.v1' server/cmd/webui-server/v03.go\ngrep -Fq 'root-module-webui.extensions.v2' server/cmd/webui-server/v04.go\ngrep -Fq 'job-run-file' server/cmd/webui-server/v04.go\n")
replace_once(verify, "python3 scripts/webui-contract-test.py\n", "python3 scripts/webui-contract-test.py\npython3 scripts/webui-v04-static.test.py\n")

readme = "README.md"
replace_once(readme, '`CORE_VERSION=0.3.1`', '`CORE_VERSION=0.4.0`')
append_once(readme, "## Core v0.4 typed async extension", '''
## Core v0.4 typed async extension

Core v0.4 keeps the v1 and v0.3 contracts backward compatible and adds an opt-in `capabilities-v04` extension for workflows that need typed parameters without exposing an arbitrary command or path channel.

Reusable primitives:

- typed parameterized background jobs staged through private request files;
- active-job dedupe on declared identity fields;
- collection-backed reference parameters;
- inventory-bound operations that re-resolve the selected identity before launch;
- visibility-aware bounded polling without fake percentage progress;
- one shared status timeout for HTTP status and server self-test.

The server invokes only declared adapter operations. Parameter values never become browser-supplied shell fragments. Modules that do not implement `capabilities-v04` continue to behave exactly as before.

See [Core v0.4 contract](docs/ROADMAP_V0_4.md).
''')

append_once("docs/API_CONTRACT.md", "## v0.4 typed async extension", '''
## v0.4 typed async extension

The v0.4 core adds a second optional extension. Existing base-v1 and v0.3 consumers remain valid.

### `GET /api/v1/v04/capabilities`

Adapter source:

```text
module-control capabilities-v04
```

Schema: `root-module-webui.extensions.v2`.

The extension may declare typed jobs, collection-backed references and inventory-bound operations. Supported job parameter types are `boolean`, `integer`, `string`, `enum` and `reference`.

### `GET /api/v1/v04/reference?name=<declared-reference>`

The server resolves the identity field of a declared v0.3 collection through `collection-get`. It returns only the current stable identity values. A reference never exposes an arbitrary filesystem path or raw configuration document.

### `POST /api/v1/v04/jobs`

Request:

```json
{"name":"collect","parameters":{"return_id":"SDR-example"}}
```

The server validates every declared parameter, resolves `reference` parameters against current collection identities, stages a private request file, and invokes only:

```text
module-control job-run-file <declared-job> <private-request-file>
```

If the job declares `dedupe_keys` and an identical job is already queued/running in the WebUI session, the existing job is returned with `reused=true`.

### `POST /api/v1/v04/inventory-operation`

Request:

```json
{"name":"collect","item_id":"stable-item-id"}
```

The operation declaration binds one existing inventory, its stable identity field, one typed job and one job parameter. The server refreshes the inventory and rejects stale/missing identities before launching the job. The browser cannot provide an adapter command or device path.

The shared v0.4 frontend polls active jobs with bounded backoff and pauses polling while the document is hidden. Declared phases are descriptive vocabulary only; the UI never fabricates percentage completion.
''')

append_once("docs/PATTERN_LIBRARY.md", "## Typed asynchronous workflow primitives", '''
## Typed asynchronous workflow primitives

Core v0.4 generalizes a safe pattern needed by return collection, backup/restore and diagnostic workflows:

- a browser selects or enters only declared typed values;
- reference values come from stable identities in typed collections;
- inventory-row actions first re-resolve the row identity server-side;
- the server writes a private request file and invokes one declared adapter job;
- active duplicate work can be coalesced by declared dedupe keys;
- polling is visibility-aware and reports real lifecycle states rather than fake progress.

Domain-specific phases, target identities, return states, backup semantics and verification rules stay adapter-owned.
''')

append_once("docs/SECURITY_MODEL.md", "## v0.4 typed asynchronous boundary", '''
## v0.4 typed asynchronous boundary

The v0.4 extension does not add arbitrary command execution. Typed job parameters are validated and serialized into a server-created private request file. The adapter receives a declared job name plus that private path.

Inventory-bound operations accept only a stable item identity and re-read the declared inventory before launch. Collection-backed references accept only identities currently returned by the declared typed collection.

The browser cannot select an arbitrary executable, shell fragment, SSH command or device path through these primitives. Consumer adapters must still revalidate all domain invariants.
''')

append_once("docs/ARCHITECTURE.md", "## Core v0.4 typed async flow", '''
## Core v0.4 typed async flow

```text
browser typed form / inventory item
        |
        v
loopback server declaration + type/reference validation
        |
        +-- private request file
        +-- active-job dedupe
        v
module-control job-run-file <declared-job> <private-request-file>
        |
        v
bounded session job state/output
```

Inventory operations add one server-side re-resolution step before the request file is created. The generic core owns transport, validation and job lifecycle; the module adapter owns domain behavior and verification.
''')

append_once("docs/CORE_SYNC.md", "## v0.4 consumers", '''
## v0.4 consumers

A consumer using typed async features must pin both `CORE_VERSION=0.4.0` and the exact template commit. Sync the v0.4 manifest as one unit, including `v04.js`, `v04.go`, tests and documentation. A consumer candidate built against an older core must be rebuilt and reverified after adopting v0.4.
''')

append_once("docs/MIGRATION_GUIDE.md", "## Opting into v0.4 typed async", '''
## Opting into v0.4 typed async

No migration is required for modules that stay on the base-v1 or v0.3 capability contracts.

To opt in, implement `module-control capabilities-v04` and only the declared `job-run-file` operations. Keep v0.4 job parameters typed and bounded, and use collection-backed references or inventory-bound operations instead of accepting free-form paths or commands. Pin the exact core commit in the consuming repository before candidate verification.
''')

write("docs/WEBUI_CONTROL_TIMEOUT_ALIGNMENT.md", '''# WebUI control timeout alignment

Status: implemented in core 0.4.0
Origin: Pixel Thermal & Memory Control alpha4 device verification, 2026-08-17

## Resolution

The standalone server now defines one named status-control timeout and uses it for both the normal HTTP status adapter call and the status portion of `-self-test`.

Self-test therefore cannot kill a status adapter earlier than the runtime endpoint it validates. Configuration self-test keeps a separate bounded timeout, and action, inventory and background-job deadlines remain independently scoped.

Regression coverage is part of the v0.4 verification contract.

## Consumer guidance

Frequent status calls should still remain inexpensive. Expensive full validation belongs in verified caches, explicit inventories or background jobs; successful mutations should refresh their effective-state evidence before reporting completion.
''')

print("RESULT: CORE_V04_INTEGRATION_PATCH_APPLIED")
