# Security policy

## Supported versions

Only the latest commit on the default branch is supported until the first tagged release.

## Reporting

Do not publish a working exploit for the root API. Open a private security advisory in the GitHub repository after publication, or contact the repository owner privately.

## Security invariants

A change must not be merged if it:

- binds the server to a non-loopback address;
- disables session-token authentication;
- adds arbitrary command execution;
- accepts unrestricted filesystem paths;
- writes configuration without validation and atomic replacement;
- keeps the server permanently running at boot;
- allows the WebUI to become a boot dependency;
- introduces remote scripts, fonts, analytics, or CDN assets.

See `docs/SECURITY_MODEL.md`.
