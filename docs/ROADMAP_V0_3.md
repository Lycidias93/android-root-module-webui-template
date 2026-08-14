# WebUI core v0.3 roadmap

Status: implemented / maintained

## Goal

The v0.3 standalone WebUI extends the foundation from single-object configuration plus read-only inventories into safe editing of repeated typed records and schema-versioned import/export workflows without introducing arbitrary shell, arbitrary path or raw-config editing.

SSH Drop Dispatcher RC5 is the first runtime-proven consumer, while the primitives remain domain-neutral and reusable by other Magisk/root modules.

## Implemented core capabilities

### Typed collection editor

The capability-declared collection form supports repeated records such as profiles, targets, schedules or rules.

Properties:

- stable record identity;
- declared typed fields using the shared field model;
- bounded record counts and field lengths;
- server-side and adapter-side validation;
- deterministic whole-collection payloads;
- preview/diff before apply;
- short-lived preview token bound to the canonical record payload;
- one atomic whole-collection adapter call rather than partial browser-driven shell commands;
- exact confirmation for destructive operations when declared.

The shared core does not define SSH semantics. A consuming module may use the collection editor for SSH host profiles, but host aliases, usernames, ports, shell profiles and other domain rules remain adapter-owned.

### Import and export

The generic file-exchange contract is bounded and schema-declared.

Design constraints:

- JSON-first structured exchange with module-owned schema/version validation;
- maximum upload/download sizes enforced by the server;
- uploads land only in the private WebUI runtime directory;
- adapter receives server-created private paths;
- import is validate/preview first, apply second;
- preview token is bound to staged file SHA-256;
- apply remains adapter-owned, atomic and rollback-capable;
- export is generated from typed adapter data, never by exposing arbitrary files;
- default export remains secret-safe/redacted or safe-reference only;
- private-key bytes, tokens and credential contents are excluded from generic export;
- imported documents cannot choose arbitrary filesystem paths or commands;
- checksum/metadata can be displayed without sidecar files.

### Transaction and mobile UX

The maintained v0.3 UI provides reusable frontend behavior for:

- validation and preview result summaries;
- planned add/change/remove counts;
- exact-confirmation gating before apply;
- stale-preview invalidation after edits;
- visible record counts;
- Add record scroll/focus feedback on long mobile forms;
- import preview/apply gating;
- accessible live result output;
- horizontally scrollable tabs that keep the active tab in view.

The core renders state; module adapters own actual backup, rollback, restart and reboot semantics.

### Secret-aware fields and exports

The write-only secret-field model remains intact. Export policy metadata distinguishes:

- `public`: safe to export;
- `reference`: path/name reference may be exportable when module policy permits;
- `secret`: value never returned through normal status/config/export;
- `credential_material`: excluded from generic export entirely.

A module may expose only a boolean/non-secret configured indicator through `status.runtime.<field_key>_configured`. The generic UI can render `Configured · leave blank to preserve` without receiving the underlying secret value.

## SSH Drop Dispatcher mapping

The shared core provides only the generic primitives above. SSH Drop Dispatcher owns:

- target/host record schema;
- alias/name validation and stored-profile compatibility;
- host/address field policy;
- username and port constraints;
- remote drop path validation;
- shell profile (`bash`/`sh`) rules;
- SCP profile including BerylAX `-O`;
- SSH key-reference selection policy;
- dispatcher verification-owner and remote-SHA invariants;
- per-target and aggregate readiness/test jobs;
- migration from the registry/config files;
- atomic regeneration of Dispatcher SSH/target configuration;
- rollback snapshots;
- companion integration status such as Sortify read-only state.

Private SSH key bytes remain out of scope for browser import/export.

## Security gates

The v0.3 implementation keeps the original invariants and additionally proves:

- no raw SSH-config editor in generic core;
- no arbitrary path picker capable of reading/writing device files;
- no browser-supplied shell command construction;
- imports are schema-bound and size-bound;
- preview has no productive mutation;
- apply is bound to a matching unexpired preview token;
- module adapters create rollback state before productive writes when their domain requires it;
- exports do not expose undeclared fields;
- default exports contain no secret/credential contents;
- configured-state indicators reveal only boolean/non-secret state;
- loopback/session/origin protections remain unchanged;
- malformed or cross-module imports fail closed.

## Versioning

`CORE_VERSION` remains the authoritative core version. Consumer candidates must pin a concrete template commit as well as the core version. Any future core-version change must keep README, API contract, security model, migration/core-sync docs, pattern library, manifest and tests consistent.
