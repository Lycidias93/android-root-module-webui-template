# Security model

The HTTP process and backend run with root privileges. Treat every browser request as untrusted even though the listener is loopback-only.

## Implemented controls

- IPv4 loopback listener: `127.0.0.1`.
- Loopback peer verification.
- Strict Host and port verification.
- Per-launch random token passed in the URL fragment, not the HTTP request.
- Constant-time token comparison.
- Origin validation for state-changing requests.
- 32 KiB JSON request limit.
- Fixed API routes.
- Typed configuration schema and value bounds.
- Fixed backend command and argument construction through `exec.Command`.
- Backend-side duplicate validation.
- Bounded command output and execution timeout.
- Security headers and restrictive CSP.
- Atomic state and configuration files.
- Automatic idle shutdown.
- No remote assets, analytics, or external scripts.

## Threats not solved by loopback alone

Another local application may attempt to access loopback. The session token is therefore mandatory. A malicious rooted process can still read module files or process state; this template does not attempt to defend against an already-compromised root environment.

## Extension checklist

For every new endpoint:

1. Define a typed request.
2. Limit request size.
3. Reject unknown JSON fields.
4. Validate all values.
5. Add a fixed backend operation.
6. Revalidate in `module-control`.
7. Bound execution time and output.
8. Add tests.
9. Document the rollback path.
