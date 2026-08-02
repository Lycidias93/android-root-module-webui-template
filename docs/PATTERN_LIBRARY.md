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

## Template policy

A pattern enters the shared core only when it is:

- domain-neutral;
- compatible with the security model;
- testable without a device;
- useful to multiple modules;
- represented by a stable adapter/API contract.

Domain logic stays in the originating module.
