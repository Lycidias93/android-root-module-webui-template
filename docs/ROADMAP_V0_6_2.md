# Core v0.6.2 — Persistent action results

Core v0.6.2 keeps the base v1 action API unchanged and tightens real-device action UX.

## Contract

- `/api/v1/action` remains the only base action endpoint.
- Action responses are mirrored into a bounded browser-tab history so output is not lost when the transient top notice hides.
- History is stored in `sessionStorage`, limited to eight entries, and individual messages are truncated at 32768 characters.
- Actions declared with `risk=safe` are presented as **Run check** rather than **Apply change**.
- The persistent result area is copyable and explicitly clearable by the operator.
- No request body, shell command, secret, credential, arbitrary path or new privileged transport is introduced.

## Acceptance

A consumer release that exposes actions must not rely on static listener checks alone. Device acceptance must execute every declared safe/read-only action through the authenticated HTTP endpoint and verify its HTTP/result semantics. Mutating actions should be exercised against isolated disposable state when a production-device invocation would alter user data.

For WebUI releases, the page-referenced `action-output.js` asset must be reachable over the authenticated loopback server.
