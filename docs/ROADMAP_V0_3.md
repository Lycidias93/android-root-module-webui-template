# WebUI core v0.3 roadmap

Status: design / not yet released

## Goal

Extend the standalone WebUI foundation from single-object configuration plus read-only inventories into safe editing of repeated typed records and schema-versioned import/export workflows without introducing arbitrary shell, arbitrary path or raw-config editing.

The first consumer is expected to be SSH Drop Dispatcher RC5, but the primitives must remain domain-neutral and reusable by other Magisk/root modules.

## Candidate core capabilities

### Typed collection editor

Add a capability-declared collection form for repeated records such as profiles, targets, schedules or rules.

Required properties:

- stable record identity;
- declared fields using the existing typed field model where possible;
- add/edit/disable/delete operations declared separately;
- server-side and adapter-side validation;
- bounded record counts and field lengths;
- deterministic ordering where the module requires it;
- preview/diff before apply;
- one atomic whole-collection commit rather than partial browser-driven shell commands;
- exact confirmation for destructive operations when declared.

The shared core must not define SSH semantics. A consuming module may use the collection editor for SSH host profiles, but host aliases, usernames, ports, shell profiles and other domain rules remain adapter-owned.

### Import and export

Add a generic, bounded file-exchange contract for structured module configuration.

Design constraints:

- JSON first; schema identifier and schema version mandatory;
- explicit module id and export format version;
- maximum upload/download sizes enforced by the server;
- uploads land only in the private WebUI runtime directory;
- adapter receives a server-created private request/import file;
- import is validate/preview first, apply second;
- apply is atomic and rollback-capable in the adapter;
- export is generated from typed adapter data, never by exposing arbitrary files;
- default export mode is secret-safe/redacted;
- secret/full export, when a module supports it, requires an explicit declared capability and stronger confirmation;
- generic core never exports private-key bytes, tokens or credential contents by default;
- imported documents cannot choose arbitrary filesystem paths or commands;
- checksum/metadata can be displayed to the user without separate sidecar files.

Potential adapter operations:

```text
module-control export <declared-export> <private-request-file>
module-control import-preview <declared-import> <private-upload-file>
module-control import-apply <declared-import> <private-request-file>
```

Exact operation names and server endpoints remain subject to implementation review.

### Transaction and rollback UX

Provide reusable frontend language for:

- validation result;
- planned changes;
- backup created;
- apply success/failure;
- rollback available/completed;
- restart/reboot required.

The core renders state; module adapters own actual backup and rollback semantics.

### Secret-aware fields and exports

Keep the existing write-only secret-field model and extend it with explicit export policy metadata:

- `public`: safe to export;
- `reference`: path/name reference may be exportable when module policy permits;
- `secret`: value never returned through normal status/config/export;
- `credential_material`: excluded from generic export entirely.

Final names may change during schema design, but the distinction between references and credential contents is mandatory.

## SSH Drop Dispatcher RC5 mapping

The shared core should provide only the generic primitives above. SDD RC5 owns:

- target/host record schema;
- alias/name validation;
- host/address field policy;
- username and port constraints;
- remote drop path validation;
- shell profile (`bash`/`sh`) rules;
- SCP profile including BerylAX `-O`;
- SSH key-reference selection policy;
- dispatcher verification-owner and remote-SHA invariants;
- per-target readiness/test jobs;
- migration from the current registry/config files;
- atomic regeneration of the Dispatcher SSH/target configuration;
- rollback snapshots.

Private SSH key bytes are out of scope for browser import/export. RC5 may expose references to already-installed keys only through an allowlisted adapter contract.

## Security gates

A v0.3 implementation must keep all current invariants and additionally prove:

- no raw SSH-config editor in generic core;
- no arbitrary path picker capable of reading/writing device files;
- no browser-supplied shell command construction;
- imports are schema-bound and size-bound;
- preview has no productive mutation;
- apply creates adapter-owned rollback state before first productive write;
- exports do not expose undeclared fields;
- default exports contain no secret/credential contents;
- loopback/session/origin protections remain unchanged;
- malformed or cross-module imports fail closed.

## Versioning

This roadmap does not change `CORE_VERSION` by itself. Increase the core version only when the new API/frontend/server contract is implemented, tested and documented consistently across README, API contract, security model, migration/core-sync docs, manifest and verification tests.
