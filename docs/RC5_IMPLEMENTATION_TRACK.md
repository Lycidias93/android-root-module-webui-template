# RC5 implementation track

Status: runtime-proven / follow-up maintained

This file tracks implementation work shared with SSH Drop Dispatcher RC5 and its WebUI follow-up.

## Proven generic core v0.3 primitives

- typed collection/profile editing;
- schema-versioned bounded import/export;
- preview/apply transaction binding;
- rollback/result state rendering boundary;
- secret-aware export policy metadata;
- capability-driven settings/actions/jobs/inventories;
- loopback-only standalone browser transport.

SSH Drop Dispatcher RC5 completed installed-runtime verification with the typed target collection, alias canonicalization, safe export/import preview, inventories, standalone action flow and the unchanged Dispatcher delivery core.

## Follow-up extracted back into the template

The RC5 mobile/runtime review identified reusable UX improvements that remain domain-neutral:

- secret/write-only fields may show a non-secret `<field_key>_configured` status indicator while values remain undisclosed;
- Add record on long mobile collections scrolls/focuses the new card and shows record count;
- preview/apply and import/apply controls remain disabled until their fresh preview token and exact confirmation are both present;
- preview/import output starts with a compact result/change summary before detailed JSON;
- horizontally scrollable tabs keep the selected tab visible.

Consumer-specific SSH/target semantics, ntfy state extraction, aggregate target readiness and Sortify companion status remain outside the shared core.
