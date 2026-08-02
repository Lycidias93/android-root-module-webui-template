# Contributing

1. Create a focused non-default branch.
2. Keep module semantics in `module/bin/module-control`.
3. Change core files only when the behavior is useful across multiple modules.
4. Update `CORE_VERSION` for managed-core or API-contract changes.
5. Keep the browser API typed and allowlisted.
6. Add or update unit, WebUI-contract and HTTP-integration tests.
7. Run `./scripts/verify.sh`.
8. Run `./scripts/build.sh`.
9. Update architecture, security, migration and provenance documentation.
10. Describe rollback and installed-runtime verification in the pull request.

A pull request must not weaken loopback binding, one-time bootstrap, cookie
authentication, same-origin mutation checks, output limits, adapter
revalidation or WebUI/boot separation.
