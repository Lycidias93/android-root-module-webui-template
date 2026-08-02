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

## Deliberately not synchronized

- `module/bin/module-control`
- `module/module.prop`
- installer and service behavior
- persistent defaults
- module-specific tests
- project documentation

These remain module-owned because their semantics and risk cannot be generalized.

## Review after sync

1. Inspect every changed core file.
2. Update the target adapter to the current API contract.
3. Run target repository tests.
4. Build the exact module ZIP.
5. Verify installation and Action launch on a test device.
6. Record `webui.lock` in the migration PR.
7. Do not publish a release until device verification is complete.
