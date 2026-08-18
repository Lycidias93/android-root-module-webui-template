# Core synchronization

`core/manifest.txt` defines the files owned by the common WebUI foundation.

## Preview

```text
./scripts/sync-core.sh /path/to/target-repository
```

The script prints `UPDATE` and `UNCHANGED` entries without writing.

## Apply

```text
./scripts/sync-core.sh --apply /path/to/target-repository
```

Requirements:

- source and target are local Git checkouts;
- target worktree is clean;
- target uses the standard `module/`, `server/`, and `scripts/` layout;
- update is performed on a non-default task branch.

The script copies complete files and writes `webui.lock` with:

- lock schema;
- core version;
- source repository;
- source commit;
- manifest SHA-256.

## v0.3 synchronized core

The v0.3 core manifest additionally owns the reusable typed-administration
extension:

- `module/webroot/v03.js`;
- v0.3 server handlers and tests under `server/cmd/webui-server/`;
- the base `index.html` loader for the optional extension;
- the WebUI contract test that verifies both base and extension scripts.

The extension is opt-in at the adapter boundary. A consumer that does not
implement `module-control capabilities-v03` keeps the existing base UI and the
v0.3 frontend quietly hides its additional administration tabs.

Consumers that enable it must update their module-owned adapter to the current
[API contract](API_CONTRACT.md), including collection/import/export domain
validation, rollback and secret policy.

## Deliberately not synchronized

- `module/bin/module-control`
- `module/module.prop`
- installer and service behavior
- persistent defaults
- module-specific tests
- project documentation

These remain module-owned because their semantics and risk cannot be generalized.
For v0.3 this boundary is especially important: the shared core owns typed
transport and UI mechanics, while each module owns record schemas, import archive
meaning, generated configuration, backup contents and rollback semantics.

## Pinning rule

A consuming module must pin the exact template source commit and core version in
`webui.lock` or its equivalent build lock. Do not consume floating `main` in a
release candidate. If the template commit changes after a candidate build, the
consumer candidate must be rebuilt and reverified before device acceptance.

## Review after sync

1. Inspect every changed core file.
2. Update the target adapter to the current API contract.
3. Verify that no module-specific secret/path/command semantics leaked into the core.
4. Run target repository tests.
5. Build the exact module ZIP.
6. Verify installation and Action launch on a test device.
7. Exercise enabled v0.3 preview/apply/import/export paths with safe fixtures.
8. Record `webui.lock` in the migration PR.
9. Do not publish a release until device verification is complete.

## v0.4 consumers

A consumer using typed async features pins `CORE_VERSION=0.4.0` and the exact template commit. Sync the v0.4 manifest as one unit, including `v04.js`, `v04.go` and their tests. A candidate built against an older core must be rebuilt and reverified after adopting v0.4.
