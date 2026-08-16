# Pattern library

This document records the first-party project patterns intentionally unified in
the common foundation. It is not a license substitute and does not make one
module's domain logic generic.

## Pixel Readable Fonts

Source: `Lycidias93/heimnetz-geraete@8169f038b62a39caaca2626ce03f86d5246dcecc`

Adopted patterns:

- bundled native browser server;
- one-time token to HttpOnly cookie;
- exact Host and same-origin mutation checks;
- private runtime directory;
- process-identity cleanup;
- clean post-bootstrap URL;
- WebUI contract tests;
- protected pending/trial/confirm/revert state-machine concept.

Font-specific state and font licensing remain outside this template.

## Boot Watch Collector

Source: `Lycidias93/magisk-boot-watch@9ea961ebed8e6926713a71c2a0a41e983767165e`

Adopted patterns:

- read-only overview;
- bounded logs and run history;
- search, copy and timeline UX;
- explicit scope and safety facts;
- build-time placeholders rather than packaged live logs.

Boot evidence paths and protected export names remain module-specific.

## Module Reflash Trigger

Source: `Lycidias93/module-reflash-trigger@1e8566c60261027f43a1b5d49e289ce93d307a93`

Adopted patterns:

- honest background-job state;
- polling without fake percentage progress;
- bounded output retrieval;
- dry-run before consequential actions;
- filters, cards and selection-oriented workflow concepts;
- allowlist and self-protection principles.

The old root-manager JavaScript exec bridge is deliberately not adopted.

## SSH Drop Dispatcher

Source: `Lycidias93/ssh-drop-dispatcher@491efc1857632d4956a085089ff084f91ad96c16`

Adopted patterns:

- clear Status, Control, Diagnostics and Notifications groupings;
- persistent enable/disable semantics;
- doctor and target-matrix concepts;
- secret-file references rather than secret display;
- explicit refusal of operations in unsafe state.

Direct shell construction in JavaScript and unrestricted path inputs are not
adopted.

RC5 additionally motivates reusable v0.3 primitives without moving SSH domain
logic into the core:

- typed repeated-record/profile editor;
- preview-bound whole-collection apply;
- bounded schema-declared import/export;
- private upload staging with digest binding;
- transaction/rollback result presentation;
- secret/reference/credential export classification.

Target aliases, SSH users/hosts/ports, remote drop rules, shell/SCP profiles,
key-reference policy and Dispatcher verification semantics remain SDD-owned.

## Pixel Termux/MX500 Backup

Source: `Lycidias93/heimnetz-geraete@8169f038b62a39caaca2626ce03f86d5246dcecc`

Adopted patterns:

- scheduler and condition form concepts;
- serialized expensive inventory refresh;
- bounded cache and timeout;
- retention preview before apply;
- readiness reasons;
- exact-name confirmation;
- exclusive locks;
- pre-restore backup and integrity checks.

Termux Python dependency and fixed-port server are not adopted.

## Supercharger Pixel 9 Series interaction reliability

Source: `Drizzy07x/Supercharger_Pixel_9_Series@be76cbe57d01fa475196b7afb3729b9ad19f0a26`

Adopted generic patterns:

- state-dependent mutations stay unavailable until the first valid status is
  available;
- a second mutation is rejected while the first mutation is still completing;
- stale, out-of-order log or status responses must not replace newer UI state;
- task launch state is released only after the matching completion refresh;
- regression tests exercise the race windows rather than only static rendering.

The shared implementation keeps the template's loopback HTTP API and does not
adopt Supercharger's root-manager JavaScript exec bridge, Pixel 9 device policy,
static thermal profiles, VM/network tuning, IRQ masks, GPU floors, app optimizer
or maintenance domain logic.

## Capability-driven read-only dashboard

For a status/log module, declare only the features that exist:

- `config=false`
- `actions=false`
- `jobs=false`
- `inventory=true` when typed history tables are useful
- `logs=true`

The shared frontend hides unsupported tabs. The adapter may provide a
`status.summary` array for module-specific Overview cards, while all rendering,
session handling and API transport remain in the common core.

## Typed collection/profile administration

For repeated records such as targets, schedules or rules, prefer the v0.3
collection extension over a raw configuration textbox.

Generic core responsibilities:

- declared stable record identity;
- typed and bounded fields;
- maximum record count;
- client and server validation;
- preview token bound to the canonical record payload;
- exact confirmation when declared;
- one adapter call for whole-collection apply.

Module responsibilities:

- domain-specific validation and invariants;
- effective-config generation;
- backup before first productive write;
- atomic commit;
- health/lint/readiness verification;
- rollback semantics.

A collection is not a generic command or config-text channel.

## Schema-bound import/export

Use the v0.3 transfer extension for portable configuration or adapter-owned
backup formats.

Generic core responsibilities:

- declared format/risk/byte limits;
- exact Origin/session/request guards;
- server-generated private upload path;
- SHA-256 binding between preview and apply;
- bounded output download;
- secret-safe `redacted` or safe-reference export policy.

Module responsibilities:

- schema/module/version validation;
- archive member allowlist;
- traversal/symlink rejection;
- redacted preview/diff;
- pre-import backup and rollback;
- effective-state verification;
- explicit handling of any domain-specific sensitive backup mode.

Private key bytes, tokens and credential material are deliberately not a generic
core export feature.

## Template policy

A pattern enters the shared core only when it is:

- domain-neutral;
- compatible with the security model;
- testable without a device;
- useful to multiple modules;
- represented by a stable adapter/API contract.

Domain logic stays in the originating module.
