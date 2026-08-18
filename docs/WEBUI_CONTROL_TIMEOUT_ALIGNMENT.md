# WebUI control timeout alignment

Status: implemented in core 0.4.0
Origin: Pixel Thermal & Memory Control alpha4 device verification, 2026-08-17

## Resolution

The standalone server now defines one named status-control timeout and uses it for both the normal HTTP status adapter call and the status portion of `-self-test`.

Self-test therefore cannot kill a status adapter earlier than the runtime endpoint it validates. Action, inventory and background-job deadlines remain independently scoped.

## Consumer guidance

Frequent status calls should remain inexpensive. Expensive validation belongs in verified caches, explicit inventories or background jobs.
