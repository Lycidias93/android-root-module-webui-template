# WebUI control timeout alignment

Status: planned generic core hardening
Target: next core revision after 0.3.1
Origin: Pixel Thermal & Memory Control alpha4 device verification, 2026-08-17

## Problem

The standalone server currently gives the normal HTTP `status` adapter call a 15 second context, while `-self-test` gives the same `status` adapter only 10 seconds. A valid but comparatively expensive adapter can therefore be killed by the self-test even though the normal API contract allows more time.

Observed consumer evidence: the Pixel alpha4 adapter completed `capabilities`, then its self-test `status` child was terminated by `exec.CommandContext` at the shorter self-test deadline and surfaced as `module-control failed: signal: killed`.

## Required generic follow-up

- Define one named status-control timeout used by both `-self-test` and the HTTP status handler, or otherwise guarantee that self-test is never stricter than the runtime endpoint it validates.
- Add a regression test with a deliberately slow but in-contract status adapter proving the self-test/runtime timeout relationship.
- Keep action, inventory, and background-job deadlines separate because their risk and latency contracts differ.
- Bump `CORE_VERSION` when the server behavior changes and keep README, architecture/core-sync docs, tests, and core manifest mutually consistent.

## Consumer guidance until the core change lands

Consumers should keep frequent `status` calls bounded and inexpensive. Expensive full validation belongs in boot/service-owned verified caches or explicit validation/inventory operations; successful mutations should refresh their cache before reporting completion.

This roadmap item records the generic part of the Pixel alpha4 finding. Consumer-specific status caching remains in the Pixel module.
