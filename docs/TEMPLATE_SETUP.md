# Template repository setup

The public source requires no repository secrets.

Recommended GitHub settings:

1. Public repository.
2. **Template repository** enabled.
3. Default branch `main`.
4. Pull requests required for changes.
5. CI required before merge.
6. Force pushes disabled.
7. Delete-head-branch policy chosen deliberately.
8. Security advisories enabled.

Before publishing a generated module:

- replace example metadata and backend logic;
- retain applicable credits and licenses;
- run `scripts/verify.sh` and `scripts/build.sh`;
- review `dist/build-manifest.json`;
- install and verify the exact ZIP on supported hardware;
- publish only through the project's confirmed release process.

The normal build creates no `.sha256` sidecar. SHA-256 is recorded in the build
log and build manifest.
