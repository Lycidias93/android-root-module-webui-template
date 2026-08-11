# Import/export contract v1

Status: draft implementation contract for core v0.3

## Goals

Provide a reusable, typed and bounded file-exchange primitive for root-module WebUIs without exposing arbitrary device files, shell commands, credentials or raw module configuration.

## Capability declarations

Adapters may declare `exports`, `imports` and `collections` in the capabilities document.

An export declaration contains:

- `name`, `label`, `description`;
- `format` (`json` or module-defined bounded archive);
- `max_bytes`;
- `risk`;
- `secret_policy` (`redacted` by default);
- optional exact confirmation for high-risk modes.

An import declaration contains:

- `name`, `label`, `description`;
- accepted media/format identifier;
- `max_bytes`;
- `risk`;
- `requires_preview=true`;
- explicit confirmation for apply.

A collection declaration contains stable record identity plus a typed field list. Browser operations are whole-collection preview/apply transactions, never partial shell commands.

## Server operations

The reusable core owns private upload/request files under the WebUI runtime directory and invokes only declared adapter operations:

- `module-control export <declared-export> <private-request-file>`
- `module-control import-preview <declared-import> <private-upload-file>`
- `module-control import-apply <declared-import> <private-request-file>`
- `module-control collection-get <declared-collection>`
- `module-control collection-preview <declared-collection> <private-request-file>`
- `module-control collection-apply <declared-collection> <private-request-file>`

The adapter remains authoritative for domain validation, backup, rollback and atomic commit semantics.

## Security invariants

- Upload/download byte limits are mandatory.
- Uploaded filenames do not select device paths.
- Import preview is read-only.
- Import/collection apply requires a server-created private request file and adapter-side revalidation.
- Cross-module/schema-mismatched imports fail closed.
- Generic core never returns private-key bytes, tokens or credential material by default.
- Default export is secret-safe/redacted.
- No raw SSH-config, arbitrary command or arbitrary path editing is introduced.
- Malformed JSON, archives with traversal/symlinks or undeclared files are rejected by the consuming adapter before apply.

## Transaction result model

Preview/apply responses may report:

- validation state;
- planned additions/changes/disables/removals;
- backup-created state;
- apply state;
- verify state;
- rollback availability/state;
- restart or reboot requirement.

The frontend renders these fields without inventing progress percentages.
